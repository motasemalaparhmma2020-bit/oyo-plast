import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ChevronRight, Heart, ShoppingCart, MoreVertical, Camera, Sparkles, X, Upload, Check, Loader2, Star, ArrowLeft } from "lucide-react";
import { useAddToCart } from "@/hooks/use-cart";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Product } from "@shared/schema";

interface PrintColorOption { name: string; hex: string; }
interface QuantityTier { qty: number; totalPrice: number; unitPrice: number; }
interface BagColor { name: string; hex: string; imageUrl?: string; }

const DEFAULT_BAG_COLORS: BagColor[] = [
  { name: "أزرق", hex: "#3B82F6" },
  { name: "أحمر", hex: "#EF4444" },
  { name: "أخضر", hex: "#10B981" },
  { name: "أصفر", hex: "#F59E0B" },
  { name: "أسود", hex: "#111827" },
  { name: "أبيض", hex: "#F9FAFB" },
];

const DEFAULT_PRINT_COLORS: PrintColorOption[] = [
  { name: "أبيض", hex: "#FFFFFF" },
  { name: "أسود", hex: "#000000" },
  { name: "ذهبي", hex: "#D4AF37" },
  { name: "فضي", hex: "#C0C0C0" },
  { name: "أحمر", hex: "#DC2626" },
];

const DEFAULT_TIERS: QuantityTier[] = [
  { qty: 100, totalPrice: 6000, unitPrice: 60 },
  { qty: 500, totalPrice: 27000, unitPrice: 54 },
  { qty: 1000, totalPrice: 50000, unitPrice: 50 },
];

function formatNum(n: number) {
  return n.toLocaleString("ar-EG");
}

function parseJson<T>(v: any, fallback: T): T {
  if (!v) return fallback;
  if (typeof v === "object") return v as T;
  try { return JSON.parse(v) as T; } catch { return fallback; }
}

// Build Cloudinary URL with color replacement
function buildBagImageUrl(product: any, color: BagColor): string {
  // If user provided imageUrl per color, use it directly
  if (color.imageUrl) return color.imageUrl;
  // If Cloudinary baseImagePublicId exists, use e_replace_color transform
  const publicId = product?.baseImagePublicId;
  const cloudName = (import.meta as any).env?.VITE_CLOUDINARY_CLOUD_NAME || "dxkkme1ed";
  if (publicId) {
    const hex = color.hex.replace("#", "");
    return `https://res.cloudinary.com/${cloudName}/image/upload/e_replace_color:${hex}:50:white/${publicId}.jpg`;
  }
  // Fallback to main image
  return product?.imageUrl || product?.mainImage || "/placeholder.png";
}

export default function ProductDetailV2() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  // ── Fetch product ──
  const { data: product, isLoading } = useQuery<Product & any>({
    queryKey: ["/api/products", id],
    staleTime: 5 * 60_000,
  });

  // ── Parse admin-controlled customizations ──
  const printColorOptions = useMemo(
    () => {
      const parsed = parseJson<PrintColorOption[]>((product as any)?.printColorOptions, []);
      return parsed.length > 0 ? parsed : DEFAULT_PRINT_COLORS;
    },
    [product]
  );
  const quantityTiers = useMemo(
    () => {
      const parsed = parseJson<QuantityTier[]>((product as any)?.quantityTiers, []);
      return parsed.length > 0 ? parsed : DEFAULT_TIERS;
    },
    [product]
  );
  const bagColors = useMemo<BagColor[]>(
    () => {
      const ac = parseJson<any[]>((product as any)?.availableColors, []);
      if (Array.isArray(ac) && ac.length > 0) {
        return ac.map((c: any) => ({
          name: c.name || c.label || "",
          hex: c.hex || c.color || "#3B82F6",
          imageUrl: c.imageUrl || c.image || undefined,
        }));
      }
      return DEFAULT_BAG_COLORS;
    },
    [product]
  );
  const previewWidth = (product as any)?.previewWidth ?? 200;
  const previewHeight = (product as any)?.previewHeight ?? 250;
  const printArea = parseJson<{ x: number; y: number; width: number; height: number }>(
    (product as any)?.printArea,
    { x: 25, y: 25, width: 50, height: 50 }
  );

  // ── Selection state ──
  const [selectedBagColor, setSelectedBagColor] = useState<BagColor>(bagColors[0]);
  const [selectedPrintColor, setSelectedPrintColor] = useState<PrintColorOption>(printColorOptions[0]);
  const [selectedTier, setSelectedTier] = useState<QuantityTier>(quantityTiers[0]);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoCloudUrl, setLogoCloudUrl] = useState<string | null>(null);
  const [isUploadingCloud, setIsUploadingCloud] = useState(false);
  const [originalLogoUrl, setOriginalLogoUrl] = useState<string | null>(null);
  const [enhancedLogoUrl, setEnhancedLogoUrl] = useState<string | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [enhanceModalOpen, setEnhanceModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiEnhancing, setIsAiEnhancing] = useState(false);

  // رفع الشعار إلى Cloudinary (يستبدل dataURL ضخم بـ URL قصير وآمن)
  const uploadLogoToCloud = async (dataUrl: string): Promise<string | null> => {
    try {
      setIsUploadingCloud(true);
      const res = await fetch("/api/upload/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.url) {
        setLogoCloudUrl(json.url);
        return json.url;
      }
      return null;
    } catch (err: any) {
      console.warn("[uploadLogoToCloud]", err?.message);
      toast({ title: "⚠️ تعذّر حفظ الشعار سحابياً", description: "سيُحفظ مؤقتاً", variant: "destructive" });
      return null;
    } finally {
      setIsUploadingCloud(false);
    }
  };
  const [imageIdx, setImageIdx] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset selections when product loads
  useEffect(() => {
    if (bagColors.length > 0) setSelectedBagColor(bagColors[0]);
  }, [bagColors]);
  useEffect(() => {
    if (printColorOptions.length > 0) setSelectedPrintColor(printColorOptions[0]);
  }, [printColorOptions]);
  useEffect(() => {
    if (quantityTiers.length > 0) setSelectedTier(quantityTiers[0]);
  }, [quantityTiers]);

  // ── Images list ──
  const images: string[] = useMemo(() => {
    const list = [
      (product as any)?.imageUrl,
      (product as any)?.mainImage,
      ...((product as any)?.imageUrls || []),
    ].filter(Boolean);
    return Array.from(new Set(list));
  }, [product]);

  // ── Current image with bag color (Cloudinary swap) ──
  const currentBagImage = useMemo(() => {
    if (selectedBagColor?.imageUrl) return selectedBagColor.imageUrl;
    if (imageIdx > 0 && images[imageIdx]) return images[imageIdx];
    return buildBagImageUrl(product, selectedBagColor) || images[0] || "/placeholder.png";
  }, [product, selectedBagColor, imageIdx, images]);

  // ── Canvas-based background removal ──
  const removeWhiteBackground = (file: File): Promise<{ dataUrl: string; hasMixedBg: boolean }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          // Limit max dimension for performance
          const MAX = 1200;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("Canvas not supported"));
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;
          let edgeWhite = 0;
          let edgeColored = 0;
          const W = canvas.width, H = canvas.height;
          // Sample edge pixels to detect if BG is uniformly white
          for (let x = 0; x < W; x += 8) {
            for (const y of [0, H - 1]) {
              const i = (y * W + x) * 4;
              const r = data[i], g = data[i + 1], b = data[i + 2];
              if (r > 240 && g > 240 && b > 240) edgeWhite++; else edgeColored++;
            }
          }
          const hasMixedBg = edgeColored > edgeWhite * 0.3;
          // Remove white-ish pixels (with anti-alias zone)
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            if (r > 245 && g > 245 && b > 245) {
              data[i + 3] = 0;
            } else if (r > 225 && g > 225 && b > 225) {
              data[i + 3] = Math.round(((255 - Math.min(r, g, b)) / 30) * 255);
            }
          }
          ctx.putImageData(imgData, 0, 0);
          resolve({ dataUrl: canvas.toDataURL("image/png"), hasMixedBg });
        };
        img.onerror = () => reject(new Error("فشل تحميل الصورة"));
        img.src = ev.target?.result as string;
      };
      reader.onerror = () => reject(new Error("فشل قراءة الملف"));
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "❌ ملف كبير جداً", description: "الحد الأقصى ٥ ميجا", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    try {
      // Show original
      const origReader = new FileReader();
      origReader.onload = (ev) => setOriginalLogoUrl(ev.target?.result as string);
      origReader.readAsDataURL(file);

      const { dataUrl, hasMixedBg } = await removeWhiteBackground(file);
      setLogoDataUrl(dataUrl);
      setEnhancedLogoUrl(dataUrl);
      setLogoCloudUrl(null); // إعادة تعيين قبل الرفع الجديد
      setUploadModalOpen(false);
      if (hasMixedBg) {
        toast({
          title: "⚠️ خلفية معقدة",
          description: "اضغط على \"تحسين بالذكاء الاصطناعي\" للحصول على نتيجة أفضل",
        });
      } else {
        toast({ title: "✅ تم رفع الشعار", description: "جارٍ حفظه سحابياً..." });
      }
      // رفع متوازٍ إلى Cloudinary (لا يُعيق المعاينة)
      uploadLogoToCloud(dataUrl).then((url) => {
        if (url) toast({ title: "☁️ تم حفظ الشعار سحابياً" });
      });
    } catch (err: any) {
      toast({ title: "❌ خطأ", description: err.message || "فشل معالجة الصورة", variant: "destructive" });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── AI Enhancement via Gemini Vision (server-side, optional) ──
  const handleAiEnhance = async () => {
    if (!originalLogoUrl) return;
    setIsAiEnhancing(true);
    try {
      // Send to server-side endpoint for Gemini-based background removal
      const res = await fetch("/api/ai/enhance-logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: originalLogoUrl }),
      });
      if (!res.ok) throw new Error("Server returned error");
      const json = await res.json();
      if (json.enhancedDataUrl) {
        setEnhancedLogoUrl(json.enhancedDataUrl);
        setEnhanceModalOpen(true);
      } else {
        throw new Error("لم يتم إرجاع صورة محسّنة");
      }
    } catch (err: any) {
      // Fallback: apply client-side contrast enhancement to current logo
      toast({
        title: "ℹ️ التحسين السحابي غير متاح",
        description: "تم استخدام التحسين المحلي بدلاً منه",
      });
      // Re-run with stricter threshold as fallback enhancement
      if (originalLogoUrl) {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0);
          const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
          for (let i = 0; i < d.data.length; i += 4) {
            const r = d.data[i], g = d.data[i + 1], b = d.data[i + 2];
            if (r > 220 && g > 220 && b > 220) d.data[i + 3] = 0;
            // boost contrast on remaining
            d.data[i] = Math.min(255, (r - 128) * 1.2 + 128);
            d.data[i + 1] = Math.min(255, (g - 128) * 1.2 + 128);
            d.data[i + 2] = Math.min(255, (b - 128) * 1.2 + 128);
          }
          ctx.putImageData(d, 0, 0);
          setEnhancedLogoUrl(canvas.toDataURL("image/png"));
          setEnhanceModalOpen(true);
        };
        img.src = originalLogoUrl;
      }
    } finally {
      setIsAiEnhancing(false);
    }
  };

  // ── Wishlist ──
  const { data: wishlistItems = [] } = useQuery<any[]>({
    queryKey: ["/api/wishlist"],
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
  const inWishlist = wishlistItems.some((w: any) => String(w.productId) === String(id));
  const toggleWishlist = useMutation({
    mutationFn: async () => {
      if (!isAuthenticated) {
        setLocation("/login");
        throw new Error("login");
      }
      if (inWishlist) {
        await fetch(`/api/wishlist/${id}`, { method: "DELETE", credentials: "include" });
      } else {
        await fetch("/api/wishlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ productId: Number(id) }),
        });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/wishlist"] }),
  });

  // ── Add to cart ──
  const addToCartMutation = useAddToCart();
  const handleAddToCart = async () => {
    if (!product) return;
    // إن وُجد شعار محلي لم يُرفع بعد، نضمن رفعه أوّلاً (لمنع تخزين data URL ضخم)
    let finalLogoUrl: string | null = logoCloudUrl;
    if (logoDataUrl && !logoCloudUrl) {
      if (isUploadingCloud) {
        toast({ title: "⏳ جارٍ حفظ الشعار", description: "يرجى الانتظار ثانية..." });
        return;
      }
      finalLogoUrl = await uploadLogoToCloud(logoDataUrl);
      if (!finalLogoUrl) {
        toast({ title: "❌ تعذّر حفظ الشعار", description: "حاول مرة أخرى", variant: "destructive" });
        return;
      }
    }
    const designOptions = {
      bagColor: selectedBagColor?.name,
      bagColorHex: selectedBagColor?.hex,
      printColor: selectedPrintColor?.name,
      printColorHex: selectedPrintColor?.hex,
      logo: finalLogoUrl ? "uploaded" : null,
      printArea,
    };
    addToCartMutation.mutate({
      productId: Number(id),
      quantity: selectedTier.qty,
      selectedBagColor: selectedBagColor?.name,
      printColor1: selectedPrintColor?.name,
      printColorCount: 1,
      unitPrice: selectedTier.unitPrice,
      designFileUrl: finalLogoUrl || undefined,
      designOptions,
    } as any);
  };

  // ── Reviews ──
  const { data: reviews = [] } = useQuery<any[]>({
    queryKey: ["/api/products", Number(id), "reviews"],
    queryFn: async () => {
      const r = await fetch(`/api/products/${id}/reviews`);
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!id,
    staleTime: 60_000,
  });
  const avgRating = reviews.length > 0
    ? reviews.reduce((s: number, r: any) => s + (Number(r.rating) || 0), 0) / reviews.length
    : Number((product as any)?.rating) || 0;

  // ── Related Products (same category, exclude current) ──
  const productCategoryId = (product as any)?.categoryId;
  const { data: relatedRaw = [] } = useQuery<any[]>({
    queryKey: ["/api/products", { categoryId: productCategoryId }],
    queryFn: async () => {
      if (!productCategoryId) return [];
      const r = await fetch(`/api/products?categoryId=${productCategoryId}`);
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!productCategoryId,
    staleTime: 60_000,
  });
  const relatedProducts = useMemo(() => {
    return (relatedRaw || [])
      .filter((p: any) => p && p.id !== Number(id))
      .slice(0, 6);
  }, [relatedRaw, id]);

  // ── Cart count for header badge ──
  const { data: cartItems = [] } = useQuery<any[]>({ queryKey: ["/api/cart"], staleTime: 30_000 });
  const cartCount = cartItems.reduce((s: number, it: any) => s + (it.quantity || 0), 0);

  // ── Volume Offers (عروض الكميات) ──
  const numericProductId = Number(id);
  const { data: volumeOffers = [] } = useQuery<any[]>({
    queryKey: ["/api/products", numericProductId, "volume-offers"],
    queryFn: async () => {
      const res = await fetch(`/api/products/${numericProductId}/volume-offers`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!numericProductId && !!(product as any)?.enableVolumeOffers,
    staleTime: 5 * 60_000,
  });
  const sortedOffers = useMemo(
    () => [...volumeOffers].sort((a, b) => (a.minQuantity ?? 0) - (b.minQuantity ?? 0)),
    [volumeOffers]
  );
  const activeOffer = useMemo(() => {
    const q = selectedTier?.qty ?? 0;
    const m = sortedOffers.filter(
      (o) => q >= (o.minQuantity ?? 0) && (o.maxQuantity == null || q <= o.maxQuantity)
    );
    return m[m.length - 1] || null;
  }, [sortedOffers, selectedTier]);
  const nextOffer = useMemo(() => {
    const q = selectedTier?.qty ?? 0;
    return sortedOffers.find((o) => (o.minQuantity ?? 0) > q) || null;
  }, [sortedOffers, selectedTier]);

  if (isLoading || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  const discountPercent = (product as any).discountPercent || 0;
  const originalPrice = (product as any).originalPrice;
  const rating = (product as any).rating || (product as any).averageRating || 4.8;
  const reviewCount = (product as any).reviewCount || 0;

  return (
    <div className="min-h-screen bg-gray-100 pb-24" dir="rtl" data-testid="product-detail-v2">
      <div className="max-w-[480px] mx-auto bg-white min-h-screen shadow-xl">

        {/* ── ① Header ── */}
        <header className="sticky top-0 bg-white/95 backdrop-blur z-40 flex items-center justify-between px-4 h-14 border-b border-gray-100">
          <button
            onClick={() => setLocation("/products")}
            className="p-2 -mr-2 text-gray-700"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5 -scale-x-100" />
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleWishlist.mutate()}
              className="p-2 relative"
              data-testid="button-wishlist"
            >
              <Heart className={`w-5 h-5 ${inWishlist ? "fill-red-500 text-red-500" : "text-gray-700"}`} />
            </button>
            <Link href="/cart" className="p-2 relative" data-testid="link-cart-header">
              <ShoppingCart className="w-5 h-5 text-gray-700" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -left-0.5 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {cartCount}
                </span>
              )}
            </Link>
            <button className="p-2 -ml-2 text-gray-700" data-testid="button-more">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* ── ② Main Image (1:1) ── */}
        <div className="relative bg-gray-50">
          <div
            className="w-full aspect-square flex items-center justify-center relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${selectedBagColor.hex}22, ${selectedBagColor.hex}44)` }}
            data-testid="img-main"
          >
            <img
              src={currentBagImage}
              alt={product.name}
              className="max-w-[80%] max-h-[80%] object-contain transition-all"
              onError={(e) => { (e.target as HTMLImageElement).src = product.mainImage || "/placeholder.png"; }}
            />
            {/* Logo overlay on print area — tinted via CSS mask so any color works */}
            {logoDataUrl && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: `${printArea.x}%`,
                  top: `${printArea.y}%`,
                  width: `${printArea.width}%`,
                  height: `${printArea.height}%`,
                  background: selectedPrintColor?.hex || "#000000",
                  WebkitMaskImage: `url(${logoDataUrl})`,
                  maskImage: `url(${logoDataUrl})`,
                  WebkitMaskRepeat: "no-repeat",
                  maskRepeat: "no-repeat",
                  WebkitMaskSize: "contain",
                  maskSize: "contain",
                  WebkitMaskPosition: "center",
                  maskPosition: "center",
                }}
                data-testid="logo-overlay-main"
              />
            )}
            {/* Image counter dots */}
            {images.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setImageIdx(i)}
                    className={`w-2 h-2 rounded-full transition ${i === imageIdx ? "bg-cyan-500" : "bg-gray-300"}`}
                    data-testid={`button-img-dot-${i}`}
                  />
                ))}
              </div>
            )}
            {/* Discount badge */}
            {discountPercent > 0 && (
              <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-md">
                -{discountPercent}%
              </div>
            )}
          </div>
        </div>

        {/* ── Content body ── */}
        <div className="px-4 pt-3 pb-4 space-y-3">

          {/* ③ Title + Rating */}
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight" data-testid="text-product-name">
              {product.name}
            </h1>
            <div className="flex items-center gap-2 mt-1 text-xs">
              <span className="flex items-center gap-0.5 text-amber-500 font-bold">
                <Star className="w-3 h-3 fill-amber-500" /> {Number(rating).toFixed(1)}
                {reviewCount > 0 && <span className="text-gray-500 font-normal">({formatNum(reviewCount)})</span>}
              </span>
              {(product as any).isHot && <span className="text-orange-500 font-bold">🔥 رائج</span>}
            </div>
          </div>

          {/* ⑤ Price block */}
          <div className="flex items-baseline gap-2 flex-wrap" data-testid="block-price">
            <span className="text-2xl font-extrabold text-red-600 transition-transform" data-testid="text-price-total">
              {formatNum(selectedTier.totalPrice)} ر.ي
            </span>
            {originalPrice && (
              <span className="text-sm text-gray-400 line-through">{formatNum(Number(originalPrice))}</span>
            )}
            {discountPercent > 0 && (
              <span className="bg-red-100 text-red-700 text-xs font-bold px-1.5 py-0.5 rounded">-{discountPercent}%</span>
            )}
            <span className="block w-full text-xs text-gray-600 mt-0.5" data-testid="text-price-unit">
              {formatNum(selectedTier.unitPrice)} ر.ي / كيس
            </span>
          </div>

          {/* ⑤b Volume Offers — عروض الكميات */}
          {sortedOffers.length > 0 && (
            <div className="space-y-2" data-testid="section-volume-offers">
              {activeOffer && (
                <div className="rounded-xl border-2 border-orange-400 bg-gradient-to-l from-orange-50 to-amber-50 p-3 shadow-sm" data-testid={`banner-active-offer-${activeOffer.id}`}>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    {activeOffer.badgeText && (
                      <span className="bg-orange-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                        🔥 {activeOffer.badgeText}
                      </span>
                    )}
                    {activeOffer.hasFreeShipping && (
                      <span className="bg-green-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">🚚 شحن مجاني</span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-xl font-extrabold text-orange-600" data-testid="text-offer-price">
                      {formatNum(Number(activeOffer.offerPriceYer))} ر.ي / قطعة
                    </span>
                    {activeOffer.originalPriceYer && Number(activeOffer.originalPriceYer) > Number(activeOffer.offerPriceYer) && (
                      <>
                        <span className="text-xs line-through text-gray-400">
                          {formatNum(Number(activeOffer.originalPriceYer))} ر.ي
                        </span>
                        <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                          -{Math.round(((Number(activeOffer.originalPriceYer) - Number(activeOffer.offerPriceYer)) / Number(activeOffer.originalPriceYer)) * 100)}%
                        </span>
                      </>
                    )}
                  </div>
                  {activeOffer.displayLabel && (
                    <p className="text-[11px] text-orange-700 mt-1">{activeOffer.displayLabel}</p>
                  )}
                </div>
              )}
              {nextOffer && (selectedTier?.qty ?? 0) < (nextOffer.minQuantity ?? 0) && (
                <div className="rounded-xl border border-blue-300 bg-blue-50 p-2.5 text-[11px] text-blue-900" data-testid="banner-next-offer">
                  أضِف <strong>{(nextOffer.minQuantity ?? 0) - (selectedTier?.qty ?? 0)}</strong> قطعة لتحصل على سعر <strong>{formatNum(Number(nextOffer.offerPriceYer))} ر.ي</strong>
                </div>
              )}
              <div className="rounded-xl border border-cyan-200 bg-cyan-50/50 p-2.5">
                <p className="text-xs font-bold text-cyan-700 mb-2">🎯 عروض الكمية</p>
                <div className="grid grid-cols-2 gap-2">
                  {sortedOffers.map((o: any) => {
                    const isActive = activeOffer?.id === o.id;
                    return (
                      <button
                        key={o.id}
                        onClick={() => {
                          const minQ = o.minQuantity ?? 1;
                          const match = quantityTiers.find((t) => t.qty >= minQ) || quantityTiers[quantityTiers.length - 1];
                          if (match) setSelectedTier(match);
                        }}
                        className={`text-right rounded-lg border-2 p-2 transition-all bg-white ${isActive ? "border-orange-500 bg-orange-100 shadow-md" : "border-gray-200 hover:border-cyan-400"}`}
                        data-testid={`button-volume-tier-${o.id}`}
                      >
                        <div className="text-[11px] font-bold text-gray-700">
                          {o.minQuantity}{o.maxQuantity ? `–${o.maxQuantity}` : "+"} قطعة
                        </div>
                        <div className="text-sm font-extrabold text-orange-600">
                          {formatNum(Number(o.offerPriceYer))} ر.ي
                        </div>
                        {o.badgeText && <div className="text-[10px] text-orange-700 mt-0.5">{o.badgeText}</div>}
                        {o.hasFreeShipping && <div className="text-[10px] text-green-700">🚚 مجاني</div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ⑥ Bag Colors */}
          {bagColors.length > 0 && (
            <div data-testid="block-bag-colors">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-semibold text-gray-700">🎨 لون الكيس:</span>
                <span className="text-xs font-bold text-cyan-600" data-testid="text-bag-color-name">
                  {selectedBagColor.name}
                </span>
              </div>
              <div className="flex gap-2.5 items-center flex-wrap">
                {bagColors.map((c) => (
                  <button
                    key={c.name + c.hex}
                    onClick={() => setSelectedBagColor(c)}
                    className={`w-9 h-9 rounded-full border-2 border-white transition-all ${
                      selectedBagColor.hex === c.hex
                        ? "ring-2 ring-cyan-500 scale-110"
                        : "ring-1 ring-gray-300"
                    }`}
                    style={{ background: c.hex }}
                    title={c.name}
                    data-testid={`button-bag-color-${c.name}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ⑦ Print Color */}
          {printColorOptions.length > 0 && (
            <div className="flex items-center justify-between" data-testid="block-print-color">
              <span className="text-sm font-semibold text-gray-700">✏️ لون الطباعة:</span>
              <select
                value={selectedPrintColor.hex}
                onChange={(e) => {
                  const opt = printColorOptions.find((p) => p.hex === e.target.value);
                  if (opt) setSelectedPrintColor(opt);
                }}
                className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white font-semibold"
                data-testid="select-print-color"
              >
                {printColorOptions.map((p) => (
                  <option key={p.hex} value={p.hex} style={{ background: p.hex, color: p.hex === "#FFFFFF" ? "#000" : "#fff" }}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* ⑧ Tiered Pricing */}
          {quantityTiers.length > 0 && (
            <div data-testid="block-tiers">
              <div className="text-sm font-semibold text-gray-700 mb-1.5">📦 اختر الكمية:</div>
              <div className="flex gap-2">
                {quantityTiers.map((t) => {
                  const active = selectedTier.qty === t.qty;
                  return (
                    <button
                      key={t.qty}
                      onClick={() => setSelectedTier(t)}
                      className={`flex-1 border-2 rounded-xl p-2.5 text-center transition-all bg-white ${
                        active
                          ? "border-cyan-500 bg-cyan-50 shadow-md"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                      data-testid={`button-tier-${t.qty}`}
                    >
                      <div className="font-extrabold text-base">{formatNum(t.qty)}</div>
                      <div className="text-[11px] text-gray-500 -mt-0.5">كيس</div>
                      <div className={`inline-block text-[10px] px-2 py-0.5 rounded-full mt-1 ${
                        active ? "bg-cyan-500 text-white" : "bg-gray-100 text-gray-600"
                      }`}>
                        {formatNum(t.unitPrice)} ر/كيس
                      </div>
                      <div className="text-[11px] font-bold text-gray-700 mt-1">
                        {formatNum(t.totalPrice)} ر.ي
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ⑨ Upload Logo Button */}
          <button
            onClick={() => setUploadModalOpen(true)}
            className="w-full bg-gradient-to-l from-cyan-500 to-blue-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-cyan-200 flex items-center justify-center gap-2 text-sm hover:from-cyan-600 hover:to-blue-600 transition animate-pulse"
            data-testid="button-open-upload"
          >
            <Camera className="w-5 h-5" />
            {logoDataUrl ? "تغيير الشعار" : "ارفع شعارك وشاهد المعاينة فوراً"}
          </button>

          {/* ⑩ Preview (visible when logo uploaded) */}
          {logoDataUrl && (
            <div data-testid="block-preview">
              <div className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5 justify-between">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-cyan-500" />
                  معاينتك الفورية:
                </span>
                {originalLogoUrl && (
                  <button
                    onClick={handleAiEnhance}
                    disabled={isAiEnhancing}
                    className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 px-2 py-1 rounded-lg font-bold disabled:opacity-50"
                    data-testid="button-ai-enhance"
                  >
                    {isAiEnhancing ? <Loader2 className="w-3 h-3 animate-spin" /> : "🪄 تحسين بالـ AI"}
                  </button>
                )}
              </div>
              <div className="flex justify-center">
                <div
                  className="border-2 border-cyan-200 rounded-xl p-2 bg-cyan-50 relative overflow-hidden flex items-center justify-center"
                  style={{
                    width: `${previewWidth}px`,
                    height: `${previewHeight}px`,
                    background: `linear-gradient(135deg, ${selectedBagColor.hex}33, ${selectedBagColor.hex}66)`,
                  }}
                  data-testid="block-preview-canvas"
                >
                  {/* Bag silhouette behind logo */}
                  <div
                    className="absolute inset-2 rounded-lg"
                    style={{ background: selectedBagColor.hex, opacity: 0.85 }}
                  />
                  <img
                    src={logoDataUrl}
                    alt="logo preview"
                    className="relative z-10 object-contain"
                    style={{
                      width: `${printArea.width}%`,
                      height: `${printArea.height}%`,
                      // Tint logo with print color
                      filter: (() => {
                        const c = selectedPrintColor.hex.toLowerCase();
                        if (c === "#ffffff") return "brightness(0) invert(1)";
                        if (c === "#000000") return "brightness(0)";
                        return undefined;
                      })(),
                    }}
                  />
                  {selectedPrintColor.hex !== "#FFFFFF" && selectedPrintColor.hex !== "#000000" && (
                    <div
                      className="absolute z-20 pointer-events-none"
                      style={{
                        width: `${printArea.width}%`,
                        height: `${printArea.height}%`,
                        background: selectedPrintColor.hex,
                        WebkitMaskImage: `url(${logoDataUrl})`,
                        maskImage: `url(${logoDataUrl})`,
                        WebkitMaskRepeat: "no-repeat",
                        maskRepeat: "no-repeat",
                        WebkitMaskSize: "contain",
                        maskSize: "contain",
                        WebkitMaskPosition: "center",
                        maskPosition: "center",
                      }}
                    />
                  )}
                </div>
              </div>
              <p className="text-center text-[11px] text-gray-500 mt-1.5">
                الموقع تلقائي من إعدادات المنتج • {previewWidth}×{previewHeight}
              </p>
            </div>
          )}

        </div>

        {/* Description */}
        {product.description && (
          <div className="border-t border-gray-100 mt-2 px-4 py-4 space-y-3">
            <div>
              <h3 className="font-bold text-sm mb-1.5">📝 وصف المنتج</h3>
              <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line" data-testid="text-description">
                {product.description}
              </p>
            </div>
          </div>
        )}

        {/* Reviews */}
        <div className="border-t border-gray-100 mt-2 px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm">⭐ التقييمات والمراجعات</h3>
            <div className="flex items-center gap-1" data-testid="rating-summary">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span className="text-sm font-bold">{avgRating.toFixed(1)}</span>
              <span className="text-xs text-gray-500">({reviews.length})</span>
            </div>
          </div>
          {reviews.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-3" data-testid="text-no-reviews">
              لا توجد مراجعات بعد. كن أول من يقيّم هذا المنتج ✨
            </p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {reviews.slice(0, 10).map((rv: any) => (
                <div key={rv.id} className="bg-gray-50 rounded-lg p-2.5" data-testid={`review-${rv.id}`}>
                  <div className="flex items-center gap-1 mb-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3 h-3 ${i < (Number(rv.rating) || 0) ? "fill-amber-400 text-amber-400" : "text-gray-300"}`}
                      />
                    ))}
                    <span className="text-[11px] text-gray-500 mr-auto">
                      {rv.userName || rv.user_name || "زبون"}
                    </span>
                  </div>
                  {rv.comment && (
                    <p className="text-xs text-gray-700 leading-relaxed">{rv.comment}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="border-t border-gray-100 mt-2 px-4 py-4">
            <h3 className="font-bold text-sm mb-3">🛍️ منتجات مشابهة</h3>
            <div className="grid grid-cols-2 gap-3" data-testid="related-products">
              {relatedProducts.map((rp: any) => {
                const rpImg = (rp.imageUrls && rp.imageUrls[0]) || rp.imageUrl || "/placeholder.png";
                const rpPrice = Number(rp.price) || 0;
                return (
                  <Link
                    key={rp.id}
                    href={`/product-v2/${rp.id}`}
                    className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-cyan-400 transition active:scale-[0.98]"
                    data-testid={`related-product-${rp.id}`}
                  >
                    <div className="aspect-square bg-gray-100 overflow-hidden">
                      <img src={rpImg} alt={rp.name} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                    <div className="p-2">
                      <h4 className="text-xs font-bold text-gray-800 line-clamp-2 min-h-[2.2em]">{rp.name}</h4>
                      <p className="text-cyan-600 font-bold text-sm mt-1">
                        {formatNum(rpPrice)} <span className="text-[10px] text-gray-500">ر.ي</span>
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom spacer to avoid sticky CTA overlap */}
        <div className="h-24" aria-hidden="true" />

      </div>

      {/* ── ⑪ Sticky CTA ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-[0_-2px_8px_rgba(0,0,0,0.05)]">
        <div className="max-w-[480px] mx-auto flex items-center gap-2 p-3">
          <button
            onClick={() => setLocation("/cart")}
            className="bg-cyan-50 text-cyan-700 p-2.5 rounded-xl border border-cyan-200 relative"
            data-testid="button-go-cart"
          >
            <ShoppingCart className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -left-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {cartCount}
              </span>
            )}
          </button>
          <button
            onClick={handleAddToCart}
            disabled={addToCartMutation.isPending}
            className="flex-1 bg-gradient-to-l from-cyan-500 to-blue-600 text-white font-bold py-3 rounded-xl shadow-md flex items-center justify-center gap-2 text-sm disabled:opacity-60"
            data-testid="button-add-to-cart"
          >
            {addToCartMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>أضف للسلة — <span>{formatNum(selectedTier.totalPrice)} ر.ي</span></>
            )}
          </button>
        </div>
      </div>

      {/* ── Upload Modal ── */}
      {uploadModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-5"
          onClick={(e) => { if (e.target === e.currentTarget) setUploadModalOpen(false); }}
          data-testid="modal-upload"
        >
          <div className="bg-white rounded-2xl p-5 max-w-xs w-full">
            <div className="text-center mb-3">
              <div className="text-3xl mb-1">📤</div>
              <h3 className="font-bold text-base">ارفع شعارك</h3>
              <p className="text-xs text-gray-500 mt-1">PNG / JPG — حتى ٥ ميجا</p>
            </div>
            <label className="block border-2 border-dashed border-cyan-300 rounded-xl p-6 text-center cursor-pointer bg-cyan-50 hover:bg-cyan-100 transition">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
                disabled={isProcessing}
                data-testid="input-file-logo"
              />
              {isProcessing ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
                  <div className="text-sm font-bold text-cyan-700">جارٍ المعالجة...</div>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 mx-auto mb-1 text-cyan-500" />
                  <div className="text-sm font-bold text-cyan-700">اختر صورة من جوالك</div>
                  <div className="text-[11px] text-gray-500 mt-1">سنزيل الخلفية البيضاء تلقائياً</div>
                </>
              )}
            </label>
            <button
              onClick={() => setUploadModalOpen(false)}
              className="w-full mt-3 text-sm text-gray-500 py-2"
              data-testid="button-cancel-upload"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* ── AI Enhancement Approval Modal ── */}
      {enhanceModalOpen && originalLogoUrl && enhancedLogoUrl && (
        <div
          className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4"
          data-testid="modal-enhance"
        >
          <div className="bg-white rounded-2xl p-4 max-w-sm w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-base">🪄 اختر النسخة الأفضل</h3>
              <button onClick={() => setEnhanceModalOpen(false)} data-testid="button-close-enhance">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => {
                  setLogoDataUrl(originalLogoUrl);
                  setLogoCloudUrl(null);
                  setEnhanceModalOpen(false);
                  toast({ title: "✓ تم اختيار النسخة الأصلية" });
                  if (originalLogoUrl) uploadLogoToCloud(originalLogoUrl);
                }}
                className="border-2 border-gray-200 rounded-xl p-2 hover:border-cyan-400 transition"
                data-testid="button-pick-original"
              >
                <div className="aspect-square bg-gray-50 rounded-lg overflow-hidden mb-2">
                  <img src={originalLogoUrl} alt="original" className="w-full h-full object-contain" />
                </div>
                <div className="text-xs font-bold text-gray-700">الأصلية</div>
              </button>
              <button
                onClick={() => {
                  setLogoDataUrl(enhancedLogoUrl);
                  setLogoCloudUrl(null);
                  setEnhanceModalOpen(false);
                  toast({ title: "✓ تم اختيار النسخة المحسّنة" });
                  if (enhancedLogoUrl) uploadLogoToCloud(enhancedLogoUrl);
                }}
                className="border-2 border-cyan-500 rounded-xl p-2 bg-cyan-50 hover:bg-cyan-100 transition relative"
                data-testid="button-pick-enhanced"
              >
                <div className="absolute -top-1.5 -right-1.5 bg-cyan-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  ✨ موصى به
                </div>
                <div
                  className="aspect-square rounded-lg overflow-hidden mb-2"
                  style={{ background: `linear-gradient(135deg, ${selectedBagColor.hex}33, ${selectedBagColor.hex}55)` }}
                >
                  <img src={enhancedLogoUrl} alt="enhanced" className="w-full h-full object-contain" />
                </div>
                <div className="text-xs font-bold text-cyan-700">المحسّنة</div>
              </button>
            </div>
            <p className="text-[11px] text-center text-gray-500">
              اضغط على الصورة المفضلة لديك. النسخة المحسّنة تم إزالة الخلفية وتحسين التباين منها.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
