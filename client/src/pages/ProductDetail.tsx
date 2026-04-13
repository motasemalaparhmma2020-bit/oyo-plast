import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Product, Review } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { useSEO } from "@/hooks/use-seo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAddToCart } from "@/hooks/use-cart";
import {
  ShoppingCart, Loader2, Minus, Plus, ArrowRight, Upload, Check, Star,
  Camera, X, Zap, Package, ChevronLeft, ChevronRight, Printer, Truck,
  RefreshCcw, Heart, CreditCard, Award, Lock, CheckCircle2, Search, ChevronDown, ChevronUp
} from "lucide-react";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import useEmblaCarousel from "embla-carousel-react";

// ── Lazy Image ──────────────────────────────────────────────────────────────
const LazyImage = ({ src, alt, className, style }: { src: string; alt: string; className: string; style?: React.CSSProperties }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => { setLoaded(false); setError(false); }, [src]);
  if (error) return <div className={`${className} bg-gray-100 dark:bg-gray-800`} style={style} />;
  return (
    <>
      {!loaded && <div className={`${className} bg-gray-100 dark:bg-gray-800 animate-pulse`} style={style} />}
      <img src={src} alt={alt} className={className} style={{ ...(style || {}), display: loaded ? 'block' : 'none' }}
        onLoad={() => setLoaded(true)} onError={() => setError(true)} />
    </>
  );
};

// ── Types ──────────────────────────────────────────────────────────────────
interface BulkPricing { minQty: number; price: string; }
interface SizePricing { size: string; price: string; priceSar?: string; colors?: string[]; stock?: number; }
interface ColorImageEntry { color: string; hex: string; imageUrl: string; }
type SmartVType = "color" | "size" | "weight" | "image";
interface SmartV { id: string; type: SmartVType; label: string; price: string; priceSar: string; discount: string; hex: string; imageUrl: string; }
interface SmartVData { activeTypes: SmartVType[]; variants: SmartV[]; }
const SMART_V_LABELS: Record<SmartVType, string> = { color: "اللون", size: "المقاس", weight: "الوزن", image: "الصورة" };

interface PdpSection {
  id: string; visible: boolean; height?: number; thumbSize?: number; mode?: string;
  showThumbs?: boolean; fontSize?: number; count?: number;
}
interface PdpLayout {
  sections: PdpSection[];
  stickyBar: { visible: boolean; cartHeight: number };
  margins: { h: number; v: number; gap: number };
}

const DEFAULT_PDP: PdpLayout = {
  sections: [
    { id: "images", visible: true, height: 420, thumbSize: 64, mode: "contain", showThumbs: true },
    { id: "price", visible: true, fontSize: 22 },
    { id: "title", visible: true },
    { id: "rating", visible: true },
    { id: "trust_badges", visible: true },
    { id: "variants", visible: true },
    { id: "bulk", visible: true },
    { id: "quantity", visible: true },
    { id: "shipping", visible: true },
    { id: "returns", visible: true },
    { id: "installment", visible: true },
    { id: "printing", visible: true },
    { id: "description", visible: true },
    { id: "reviews", visible: true },
    { id: "related", visible: true, count: 4 },
  ],
  stickyBar: { visible: true, cartHeight: 52 },
  margins: { h: 16, v: 8, gap: 12 },
};

const colorMap: Record<string, string> = {
  أبيض:"#FFFFFF",أسود:"#000000",أحمر:"#EF4444",أزرق:"#3B82F6",أخضر:"#22C55E",
  أصفر:"#EAB308",برتقالي:"#F97316",وردي:"#EC4899",بنفسجي:"#8B5CF6",رمادي:"#6B7280",
  بني:"#92400E",ذهبي:"#D97706",فضي:"#9CA3AF",شفاف:"transparent",سماوي:"#06B6D4",
  زهري:"#F472B6",كحلي:"#1E3A8A",بيج:"#D4A574",
};
function getColorCode(c: string): string { return colorMap[c.trim()] ?? c.trim(); }
function formatPrice(p: number | string): string { return Number(p).toLocaleString('en-US'); }

// ── Main Component ──────────────────────────────────────────────────────────
export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reviewImageRef = useRef<HTMLInputElement>(null);

  const { isAuthenticated } = useAuth();

  // ── Data fetching ───────────────────────────────────────────────────────
  const { data: product, isLoading } = useQuery<Product>({ queryKey: ['/api/products', id], staleTime: 5 * 60000, gcTime: 10 * 60000 });
  const { data: displaySettings } = useQuery<any>({ queryKey: ["/api/display-settings"], staleTime: 60000 });
  const { data: pdpRaw } = useQuery<PdpLayout>({ queryKey: ["/api/pdp-layout"], staleTime: 60000 });
  const { data: reviews = [] } = useQuery<Review[]>({ queryKey: ['/api/products', id, 'reviews'], enabled: !!id, staleTime: 2 * 60000 });
  const { data: allProducts = [] } = useQuery<Product[]>({ queryKey: ['/api/products'], staleTime: 3 * 60000, gcTime: 10 * 60000 });
  const { data: cartItems = [] } = useQuery<any[]>({ queryKey: ['/api/cart'], staleTime: 30000 });
  const cartCount = cartItems.length;

  // ── فئات الطباعة الاحترافية ─────────────────────────────────────────────
  const { data: printingCategoriesData = [] } = useQuery<any[]>({
    queryKey: ["/api/printing-categories"],
    staleTime: 5 * 60000,
  });
  const productPrintingCat = useMemo(() =>
    product?.printingCategoryId
      ? printingCategoriesData.find((c: any) => c.id === product.printingCategoryId) ?? null
      : null,
    [product?.printingCategoryId, printingCategoriesData]
  );

  // ── Check if user has a delivered order containing this product ──────────
  const { data: userOrders = [] } = useQuery<any[]>({
    queryKey: ["/api/orders"],
    enabled: isAuthenticated,
    staleTime: 2 * 60000,
  });
  const hasDeliveredOrder = useMemo(() => {
    if (!isAuthenticated || !id) return false;
    return userOrders.some(order =>
      (order.status === "delivered" || order.status === "completed") &&
      Array.isArray(order.items) &&
      order.items.some((item: any) => item.product_id === Number(id) || item.productId === Number(id))
    );
  }, [userOrders, id, isAuthenticated]);

  // ── هل قيّم المستخدم هذا المنتج مسبقاً؟ ─────────────────────────────────
  const { data: myReviewData } = useQuery<{ reviewed: boolean; rating?: number; comment?: string; isApproved?: boolean }>({
    queryKey: ['/api/products', id, 'my-review'],
    queryFn: async () => {
      const res = await fetch(`/api/products/${id}/my-review`, { credentials: 'include' });
      if (!res.ok) return { reviewed: false };
      return res.json();
    },
    enabled: isAuthenticated && !!id,
    staleTime: 2 * 60000,
  });
  const alreadyReviewed = myReviewData?.reviewed === true;

  // ── PDP Layout ─────────────────────────────────────────────────────────
  const pdp: PdpLayout = useMemo(() => {
    if (!pdpRaw) return DEFAULT_PDP;
    const merged = { ...DEFAULT_PDP, ...pdpRaw };
    const existingIds = pdpRaw.sections.map((s: PdpSection) => s.id);
    const missing = DEFAULT_PDP.sections.filter(d => !existingIds.includes(d.id));
    merged.sections = [...pdpRaw.sections, ...missing];
    return merged;
  }, [pdpRaw]);

  const sec = useMemo(() => {
    const m: Record<string, PdpSection> = {};
    pdp.sections.forEach(s => { m[s.id] = s; });
    return m;
  }, [pdp]);

  const orderedSections = useMemo(() => pdp.sections.filter(s => s.visible && s.id !== "images"), [pdp.sections]);
  const imagesSec = useMemo(() => pdp.sections.find(s => s.id === "images") ?? DEFAULT_PDP.sections[0], [pdp.sections]);

  // ── Display settings (sadeem) ──────────────────────────────────────────
  const sadeemShowOldPrice      = displaySettings?.sadeemShowOldPrice !== false;
  const sadeemShowDiscountBadge = displaySettings?.sadeemShowDiscountBadge !== false;
  const sadeemShowRating        = displaySettings?.sadeemShowRating !== false;
  const sadeemShowSoldCount     = displaySettings?.sadeemShowSoldCount !== false;
  const sadeemShowShipping      = displaySettings?.sadeemShowShipping !== false;
  const sadeemShowReturns       = displaySettings?.sadeemShowReturns !== false;
  const sadeemFreeShippingMin   = displaySettings?.sadeemFreeShippingMin ?? 0;
  const sadeemMarketerDiscount  = displaySettings?.sadeemMarketerDiscount ?? 0;
  const installmentEnabled      = displaySettings?.installmentEnabled !== false;
  const installmentMinAmount    = displaySettings?.installmentMinAmount ?? 50000;
  const installmentPercentages  = displaySettings?.installmentPercentages ?? "30,40,50";
  const detailShowAddToCart        = displaySettings?.detailShowAddToCart !== false;
  const detailShowShopNow          = displaySettings?.detailShowShopNow !== false;
  const detailHideHeaderName       = displaySettings?.detailHideHeaderName === true;
  const promoBarEnabled            = displaySettings?.promoBarEnabled === true;
  const promoBarText               = displaySettings?.promoBarText ?? "خصم 15%: بدون حد أدنى للشراء";
  const promoBarColor              = displaySettings?.promoBarColor ?? "#ef4444";
  const promoBarDetails            = displaySettings?.promoBarDetails ?? "";
  const showMarketerCouponToAll    = displaySettings?.showMarketerCouponToAll === true;
  const numberFontClass = displaySettings?.appFontNumbers ? `font-${displaySettings.appFontNumbers}` : "price-num";

  const marketerRef = useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get('ref') || p.get('promo') || null;
  }, []);
  const isMarketerLink = !!marketerRef && sadeemMarketerDiscount > 0;

  useSEO({
    title: product ? `${product.name} | أويو بلاست` : "منتج | أويو بلاست",
    description: product
      ? `اشترِ ${product.name} بسعر ${product.price} ريال من أويو بلاست. ${product.description ?? "مستلزمات تغليف احترافية في اليمن والسعودية."}`
      : "تفاصيل المنتج - أويو بلاست",
    canonical: `https://oyoplast.com/products/${id}`,
  });

  // ── State ────────────────────────────────────────────────────────────────
  const [quantity, setQuantity]           = useState(1);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize]   = useState<string | null>(null);
  const [uploadedFile, setUploadedFile]   = useState<File | null>(null);
  const [uploadedDesignUrl, setUploadedDesignUrl] = useState<string | null>(null);
  const [isUploadingDesign, setIsUploadingDesign] = useState(false);
  const [designNotes, setDesignNotes]     = useState("");
  const [enableCustomPrinting, setEnableCustomPrinting] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [variantActiveImg, setVariantActiveImg]   = useState<string | null>(null);
  const [promoBarOpen, setPromoBarOpen]           = useState(false);
  const [selectedSmartVariant, setSelectedSmartVariant] = useState<Record<string, string>>({});
  const [reviewRating, setReviewRating]   = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewImageUrl, setReviewImageUrl] = useState<string | null>(null);
  const [isUploadingReviewImage, setIsUploadingReviewImage] = useState(false);
  const [activeTab, setActiveTab]         = useState<"description" | "reviews">("description");
  const [wishlist, setWishlist]           = useState(false);
  const [variantsExpanded, setVariantsExpanded] = useState(true);
  const [searchQuery, setSearchQuery]     = useState("");

  // ── حقول الطباعة المخصصة (أكياس) ─────────────────────────────────────────
  const [selectedBagColor, setSelectedBagColor] = useState<string | null>(null);
  const [printColors, setPrintColors]           = useState<string[]>([""]);
  const [enableBagPrinting, setEnableBagPrinting] = useState(false);

  // ── حقول الطباعة الاحترافية ────────────────────────────────────────────────
  const [printFinish, setPrintFinish]           = useState("");
  const [printWidth, setPrintWidth]             = useState("");
  const [printHeight, setPrintHeight]           = useState("");
  const [printColorSeparation, setPrintColorSeparation] = useState(false);

  const [currency, setCurrency] = useState<'YER' | 'SAR'>(() =>
    (localStorage.getItem('currency') as 'YER' | 'SAR') || 'YER'
  );
  useEffect(() => {
    const fn = () => setCurrency((localStorage.getItem('currency') as 'YER' | 'SAR') || 'YER');
    window.addEventListener('currencyChange', fn);
    return () => window.removeEventListener('currencyChange', fn);
  }, []);

  // ── Derived Data ─────────────────────────────────────────────────────────
  const allImages = useMemo(() => {
    if (!product) return [];
    const imgs = [product.imageUrl];
    if (product.imageUrls?.length) imgs.push(...product.imageUrls);
    return imgs;
  }, [product]);

  const [emblaRef, emblaApi] = useEmblaCarousel({ direction: 'rtl' });
  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCurrentImageIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);
  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi, onSelect]);

  const bulkPricing: BulkPricing[] = useMemo(() => {
    try { return product?.bulkPricing ? JSON.parse(product.bulkPricing) : []; } catch { return []; }
  }, [product?.bulkPricing]);

  const sizePricing: SizePricing[] = useMemo(() => {
    try { return product?.sizePricing ? JSON.parse(product.sizePricing) : []; } catch { return []; }
  }, [product?.sizePricing]);

  const currentSizeData = useMemo(() =>
    selectedSize && sizePricing.length ? sizePricing.find(sp => sp.size === selectedSize) || null : null,
    [selectedSize, sizePricing]);

  const availableColors = useMemo(() =>
    (currentSizeData?.colors?.length ? currentSizeData.colors : product?.colors) || [],
    [currentSizeData, product?.colors]);

  const colorImages: ColorImageEntry[] = useMemo(() => {
    try { return (product as any)?.colorImages ? JSON.parse((product as any).colorImages) : []; } catch { return []; }
  }, [(product as any)?.colorImages]);

  const smartVariantsData: SmartVData | null = useMemo(() => {
    try { return (product as any)?.smartVariants ? JSON.parse((product as any).smartVariants) : null; } catch { return null; }
  }, [(product as any)?.smartVariants]);
  const showSmartVariants = !!(product as any)?.enableSmartVariants && !!smartVariantsData;

  const selectedSmartV: SmartV | null = useMemo(() => {
    if (!smartVariantsData) return null;
    for (const sid of Object.values(selectedSmartVariant)) {
      const v = smartVariantsData.variants.find(v => v.id === sid);
      if (v) return v;
    }
    return null;
  }, [selectedSmartVariant, smartVariantsData]);

  const heroImg = variantActiveImg || allImages[0] || "";
  const sizes = product?.sizes || [];

  // ── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (sizePricing.length > 0 && !selectedSize) setSelectedSize(sizePricing[0].size);
  }, [sizePricing, selectedSize]);

  useEffect(() => {
    if (selectedSize && availableColors.length > 0 && (!selectedColor || !availableColors.includes(selectedColor))) {
      setSelectedColor(availableColors[0]);
    }
  }, [selectedSize, availableColors, selectedColor]);

  // ── Price Calculation ────────────────────────────────────────────────────
  const currentPrice = useMemo(() => {
    if (!product) return '0';
    if (selectedSmartV?.price) {
      return currency === 'SAR' && selectedSmartV.priceSar ? selectedSmartV.priceSar : selectedSmartV.price;
    }
    if (currentSizeData) {
      return currency === 'SAR' && currentSizeData.priceSar ? currentSizeData.priceSar : currentSizeData.price;
    }
    let base = currency === 'SAR' && product?.priceSar ? product.priceSar : product?.price || '0';
    if (bulkPricing.length > 0) {
      const applicable = [...bulkPricing].sort((a, b) => b.minQty - a.minQty).find(bp => quantity >= bp.minQty);
      if (applicable) base = applicable.price;
    }
    return base;
  }, [product, quantity, currency, bulkPricing, currentSizeData, selectedSmartV]);

  // ── حساب تكلفة الطباعة ─────────────────────────────────────────────────────
  const bagPrintingCost = useMemo(() => {
    if (!enableBagPrinting || !product?.singleColorPrintPrice) return 0;
    const numColors = printColors.filter(c => c.trim()).length;
    if (numColors === 0) return 0;
    return numColors * Number(product.singleColorPrintPrice) * quantity;
  }, [enableBagPrinting, product?.singleColorPrintPrice, printColors, quantity]);

  const professionalPrintingUnitPrice = useMemo(() => {
    if (!productPrintingCat || !printWidth || !printHeight) return 0;
    const w = Number(printWidth), h = Number(printHeight);
    if (!w || !h) return 0;
    let price = 0;
    if (productPrintingCat.pricePerSqMeter) {
      price = (w * h / 10000) * Number(productPrintingCat.pricePerSqMeter);
    } else if (productPrintingCat.pricePerSqCm) {
      price = w * h * Number(productPrintingCat.pricePerSqCm);
    }
    if (printColorSeparation && productPrintingCat.colorSeparationPrice) {
      price += Number(productPrintingCat.colorSeparationPrice);
    }
    return Math.round(price);
  }, [productPrintingCat, printWidth, printHeight, printColorSeparation]);

  const printingCost = useMemo(() =>
    enableCustomPrinting && product?.printingPricePerUnit ? Number(product.printingPricePerUnit) * quantity : 0,
    [enableCustomPrinting, product?.printingPricePerUnit, quantity]);

  const totalPrice = useMemo(() =>
    (Number(currentPrice) * quantity) + printingCost + bagPrintingCost + (professionalPrintingUnitPrice * quantity),
    [currentPrice, quantity, printingCost, bagPrintingCost, professionalPrintingUnitPrice]);

  const currentStock = useMemo(() =>
    currentSizeData?.stock !== undefined ? currentSizeData.stock : (product?.stock || 0),
    [currentSizeData, product?.stock]);

  const effectiveDiscount = (product as any)?.effectiveDiscount ?? 0;
  const currLabel = currency === 'YER' ? 'ر.ي' : 'ر.س';

  const displayedPrice = isMarketerLink
    ? Math.round(Number(currentPrice) * (1 - sadeemMarketerDiscount / 100))
    : Number(currentPrice);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const addToCartMutation = useAddToCart();
  const { isPending } = addToCartMutation;

  const cartPayload = useMemo(() => {
    const filledColors = printColors.filter(c => c.trim());
    return {
      productId: product?.id ?? 0,
      quantity,
      selectedSize: selectedSize || undefined,
      selectedColor: selectedColor || undefined,
      customPrinting: enableCustomPrinting,
      designNotes: designNotes || undefined,
      designFileUrl: uploadedDesignUrl || undefined,
      // ── حقول طباعة الأكياس ──
      ...(enableBagPrinting && filledColors.length > 0 ? {
        selectedBagColor: selectedBagColor || undefined,
        printColorCount: filledColors.length,
        printColor1: filledColors[0] || undefined,
        printColor2: filledColors[1] || undefined,
        printColor3: filledColors[2] || undefined,
      } : {}),
      // ── حقول الطباعة الاحترافية ──
      ...(productPrintingCat && printWidth && printHeight ? {
        printingCategoryId: productPrintingCat.id,
        printWidth: Number(printWidth) || undefined,
        printHeight: Number(printHeight) || undefined,
        printFinish: printFinish || undefined,
        printColorSeparation,
        printingUnitPrice: professionalPrintingUnitPrice || undefined,
      } : {}),
      // السعر الوحدوي المحسوب
      unitPrice: totalPrice / quantity || undefined,
    };
  }, [product?.id, quantity, selectedSize, selectedColor, enableCustomPrinting, designNotes, uploadedDesignUrl,
      enableBagPrinting, selectedBagColor, printColors,
      productPrintingCat, printWidth, printHeight, printFinish, printColorSeparation, professionalPrintingUnitPrice,
      totalPrice]);

  const handleAddToCart = () => {
    if (!product) return;
    addToCartMutation.mutate(cartPayload);
  };

  const handleBuyNow = async () => {
    if (!product) return;
    try { await addToCartMutation.mutateAsync(cartPayload); setLocation('/checkout'); } catch {}
  };

  const handleDesignUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "❌ الملف كبير جداً (الحد 10MB)", variant: "destructive" });
      return;
    }
    setIsUploadingDesign(true);
    setUploadedFile(file);
    const reader = new FileReader();
    reader.onload = ev => {
      setUploadedDesignUrl(ev.target?.result as string);
      toast({ title: `✅ تم تحضير التصميم: ${file.name}` });
    };
    reader.readAsDataURL(file);
    setIsUploadingDesign(false);
    e.target.value = '';
  };

  const handleReviewImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingReviewImage(true);
    const fd = new FormData();
    fd.append('image', file);
    try {
      const r = await fetch('/api/upload/review', { method: 'POST', body: fd });
      if (r.ok) { const d = await r.json(); setReviewImageUrl(d.imageUrl); toast({ title: "تم رفع الصورة" }); }
      else toast({ title: "فشل رفع الصورة", variant: "destructive" });
    } catch { toast({ title: "خطأ في رفع الصورة", variant: "destructive" }); }
    setIsUploadingReviewImage(false);
    e.target.value = '';
  };

  const submitReviewMutation = useMutation({
    mutationFn: async ({ rating, comment, imageUrl }: { rating: number; comment: string; imageUrl?: string }) =>
      apiRequest('POST', `/api/products/${id}/reviews`, { rating, comment, imageUrl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products', id, 'reviews'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/products', id, 'my-review'] });
      setReviewComment(""); setReviewRating(5); setReviewImageUrl(null);
      toast({ title: "✅ تم إرسال تقييمك — سيظهر بعد المراجعة" });
    },
    onError: (err: any) => {
      if (err?.status === 409) {
        toast({ title: "لقد قيّمت هذا المنتج مسبقاً", variant: "destructive" });
        queryClient.invalidateQueries({ queryKey: ['/api/products', id, 'my-review'] });
      } else {
        toast({ title: "خطأ في إضافة التقييم", variant: "destructive" });
      }
    },
  });

  const relatedProducts = useMemo(() => {
    if (!product || !allProducts.length) return [];
    const count = sec["related"]?.count ?? 4;
    return allProducts.filter(p => p.id !== product.id && p.categoryId === product.categoryId).slice(0, count);
  }, [product, allProducts, sec]);

  // ── Loading / Not Found ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen" dir="rtl">
        <div className="animate-pulse">
          <div className="w-full bg-gray-200 dark:bg-gray-800" style={{ height: 380 }} />
          <div className="p-4 space-y-3">
            <div className="h-7 bg-gray-200 rounded w-2/3" />
            <div className="h-5 bg-gray-200 rounded w-1/3" />
            <div className="h-4 bg-gray-200 rounded" />
            <div className="h-4 bg-gray-200 rounded w-3/4" />
          </div>
        </div>
      </div>
    );
  }
  if (!product) {
    return (
      <div className="container mx-auto px-4 py-8 text-center" dir="rtl">
        <h2 className="text-2xl font-bold mb-4">المنتج غير موجود</h2>
        <Link href="/products"><Button>العودة للمنتجات</Button></Link>
      </div>
    );
  }

  // ── Sections Renderer ────────────────────────────────────────────────────
  const renderSection = (s: PdpSection) => {
    switch (s.id) {

      // ── IMAGES ──────────────────────────────────────────────────────────
      case "images": {
        const imgH = s.height ?? 420;
        const thumbSz = s.thumbSize ?? 64;
        const imgMode = s.mode ?? "contain";
        const showThumbs = s.showThumbs !== false;
        return (
          <div key="images" className="relative bg-white dark:bg-gray-900 w-full" data-testid="section-images">
            {allImages.length > 1 ? (
              <>
                <div className="overflow-hidden" ref={emblaRef} style={{ height: imgH }}>
                  <div className="flex h-full">
                    {allImages.map((img, idx) => (
                      <div key={idx} className="flex-[0_0_100%] min-w-0 h-full flex items-center justify-center"
                        style={{ padding: imgMode === 'contain' ? 8 : 0 }}>
                        <LazyImage src={img} alt={`${product.name} ${idx + 1}`}
                          className={`w-full h-full ${imgMode === 'cover' ? 'object-cover' : 'object-contain'}`} />
                      </div>
                    ))}
                  </div>
                </div>
                <Button variant="ghost" size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full shadow-md z-10 h-9 w-9"
                  onClick={scrollNext} data-testid="button-image-next">
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full shadow-md z-10 h-9 w-9"
                  onClick={scrollPrev} data-testid="button-image-prev">
                  <ChevronRight className="h-5 w-5" />
                </Button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                  {currentImageIndex + 1}/{allImages.length}
                </div>
              </>
            ) : (
              <div className="w-full flex items-center justify-center" style={{ height: imgH, padding: imgMode === 'contain' ? 8 : 0 }}>
                <LazyImage src={product.imageUrl || ''} alt={product.name}
                  className={`w-full h-full ${imgMode === 'cover' ? 'object-cover' : 'object-contain'}`} />
              </div>
            )}
            {/* Stock badges on image */}
            {currentStock <= 0 && (
              <Badge variant="destructive" className="absolute top-3 right-3 text-xs px-3 py-1">نفذت الكمية</Badge>
            )}
            {currentStock > 0 && currentStock <= (product?.reorderPoint ?? 10) && (
              <Badge className="absolute top-3 right-3 text-xs px-3 py-1 bg-orange-500 text-white">
                <Package className="h-3 w-3 ml-1" />متبقي {currentStock} فقط
              </Badge>
            )}
            {effectiveDiscount > 0 && (
              <div className="absolute top-3 left-3 bg-red-500 text-white rounded-full w-10 h-10 flex items-center justify-center font-extrabold text-xs shadow-lg">
                -{effectiveDiscount}%
              </div>
            )}
            {/* Thumbnails */}
            {showThumbs && allImages.length > 1 && (
              <div className="flex gap-2 p-2 justify-center flex-wrap bg-white dark:bg-gray-900 border-t">
                {allImages.map((img, idx) => (
                  <button key={idx} onClick={() => emblaApi?.scrollTo(idx)}
                    className={`rounded-lg overflow-hidden border-2 flex-shrink-0 transition-all ${currentImageIndex === idx ? 'border-primary' : 'border-transparent opacity-50 hover:opacity-80'}`}
                    style={{ width: thumbSz, height: thumbSz }} data-testid={`button-thumbnail-${idx}`}>
                    <LazyImage src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      }

      // ── PRICE ────────────────────────────────────────────────────────────
      case "price": {
        if (!sec["price"]?.visible) return null;
        const priceFontSize = s.fontSize ?? 24;
        const couponPrice = sadeemMarketerDiscount > 0
          ? Math.round(Number(currentPrice) * (1 - sadeemMarketerDiscount / 100))
          : null;
        const showCoupon = couponPrice && (isMarketerLink || showMarketerCouponToAll);
        const hasDiscount = (sadeemShowOldPrice && effectiveDiscount > 0) || isMarketerLink;
        return (
          <div key="price" className="px-4 pt-3" data-testid="section-price">
            {/* سطر واحد: السعر الجديد + شارة الخصم + السعر القديم مشطوب */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-primary leading-none price-num"
                style={{ fontSize: priceFontSize, fontFamily: 'var(--font-numbers)' }}
                data-testid="text-product-price" data-price="true">
                {formatPrice(displayedPrice)}
              </span>
              <span className="text-base text-muted-foreground font-medium">{currLabel}</span>
              {sadeemShowDiscountBadge && effectiveDiscount > 0 && (
                <Badge className="text-xs px-2 py-0.5 font-bold rounded-md" style={{ background: 'var(--discount-badge-bg,#ef4444)', color:'white' }}
                  data-testid="badge-discount">
                  -{effectiveDiscount}%
                </Badge>
              )}
              {isMarketerLink && (
                <Badge className="text-xs px-2 py-0.5 bg-purple-600 text-white rounded-md">-{sadeemMarketerDiscount}%</Badge>
              )}
              {hasDiscount && (
                <span className="text-muted-foreground line-through text-sm" data-testid="text-original-price">
                  {formatPrice(currentPrice)} {currLabel}
                </span>
              )}
              {selectedSmartV && Number(selectedSmartV.discount || 0) > 0 && sadeemShowOldPrice && (
                <span className="text-sm line-through text-muted-foreground">
                  {formatPrice(Math.round(Number(currentPrice) / (1 - Number(selectedSmartV.discount) / 100)))} {currLabel}
                </span>
              )}
            </div>
            {/* كوبون */}
            {showCoupon && (
              <div className="flex items-center gap-2 mt-1.5">
                <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded-md font-bold">مع كوبون</span>
                <span className="font-extrabold text-purple-700 price-num text-base"
                  style={{ fontFamily: 'var(--font-numbers)' }} data-price="true">
                  {formatPrice(couponPrice)} {currLabel}
                </span>
              </div>
            )}
            {/* الإجمالي */}
            {quantity > 1 && (
              <p className="text-sm text-muted-foreground mt-1">
                الإجمالي: <strong className="text-foreground" data-testid="text-total-price">{formatPrice(totalPrice)} {currLabel}</strong>
                {printingCost > 0 && <span className="mr-1">(يشمل {formatPrice(printingCost)} طباعة)</span>}
              </p>
            )}
            {/* شريط العروض الترويجية (SHEIN-style) */}
            {promoBarEnabled && (
              <>
                <button
                  className="mt-3 w-full flex items-center justify-between rounded-lg px-3 py-2 text-white text-sm font-semibold"
                  style={{ background: promoBarColor }}
                  onClick={() => setPromoBarOpen(true)}
                  data-testid="button-promo-bar">
                  <span>🏷️ {promoBarText}</span>
                  <span className="text-white/80 text-xs">›</span>
                </button>
                {promoBarOpen && (
                  <div className="fixed inset-0 z-[100] flex items-end" onClick={() => setPromoBarOpen(false)}>
                    <div className="absolute inset-0 bg-black/40" />
                    <div className="relative w-full bg-white dark:bg-gray-900 rounded-t-2xl p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
                      <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
                      <h3 className="text-lg font-bold mb-3 text-center" style={{ color: promoBarColor }}>🏷️ تفاصيل العروض الترويجية</h3>
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{promoBarDetails || promoBarText}</p>
                      <button
                        className="mt-4 w-full py-3 rounded-xl font-bold text-white"
                        style={{ background: promoBarColor }}
                        onClick={() => setPromoBarOpen(false)}
                        data-testid="button-promo-close">
                        حسناً، فهمت
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );
      }

      // ── TITLE (مدمج مع التقييم — أسلوب SHEIN) ──────────────────────────
      case "title": {
        if (!sec["title"]?.visible) return null;
        const titleFontSize = s.fontSize ?? 15;
        const ratingVal = Number(product.rating || 5).toFixed(1);
        const reviewCount = product.reviewCount || 0;
        const soldCount = (product as any).soldCount || 0;
        const showRating = sec["rating"]?.visible !== false && sadeemShowRating;
        const showSold   = sec["rating"]?.visible !== false && sadeemShowSoldCount && soldCount > 0;
        return (
          <div key="title" className="px-4 pt-2" data-testid="section-title">
            <div className="flex items-start gap-3">
              {/* الاسم — يمين، حد سطرين */}
              <h1
                className="flex-1 font-bold leading-snug text-foreground line-clamp-2"
                style={{ fontSize: titleFontSize }}
                data-testid="text-product-name"
              >
                {product.name}
              </h1>
              {/* التقييم — يسار (أسلوب SHEIN) */}
              {showRating && (
                <div className="flex flex-col items-end shrink-0 gap-0.5 min-w-[76px]">
                  <div className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
                    <span className="text-sm font-bold">{ratingVal}</span>
                    <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    ({reviewCount > 0 ? `+${reviewCount}` : '0'})
                  </span>
                  {showSold && (
                    <span className="text-[10px] text-muted-foreground">
                      {soldCount.toLocaleString('en-US')} مبيع
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      }

      // ── RATING — مدمج في قسم الاسم أعلاه، لا يعرض شيئاً هنا ───────────
      case "rating": {
        return null;
      }

      // ── TRUST BADGES ─────────────────────────────────────────────────────
      case "trust_badges": {
        if (!sec["trust_badges"]?.visible) return null;
        return (
          <div key="trust_badges" className="px-4" data-testid="section-trust-badges">
            <div className="grid grid-cols-4 gap-2">
              {[
                { icon: Truck, label: "شحن سريع", color: "text-blue-500" },
                { icon: Lock, label: "دفع آمن", color: "text-green-500" },
                { icon: RefreshCcw, label: "إرجاع مجاني", color: "text-orange-500" },
                { icon: Award, label: "جودة مضمونة", color: "text-purple-500" },
              ].map(({ icon: Icon, label, color }) => (
                <div key={label} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-muted/40 text-center">
                  <Icon className={`h-5 w-5 ${color}`} />
                  <span className="text-[10px] text-muted-foreground font-medium leading-tight">{label}</span>
                </div>
              ))}
            </div>
          </div>
        );
      }

      // ── VARIANTS — أسلوب SHEIN ────────────────────────────────────────────
      case "variants": {
        if (!sec["variants"]?.visible) return null;
        const hasVariants = sizePricing.length > 0 || sizes.length > 0 || colorImages.length > 0 || availableColors.length > 0 || showSmartVariants;
        if (!hasVariants) return null;
        return (
          <div key="variants" className="px-4 space-y-4" data-testid="section-variants">

            {/* ── Smart Variants (SHEIN style) ── */}
            {showSmartVariants && smartVariantsData && (
              <div className="space-y-4">
                {smartVariantsData.activeTypes.map(type => {
                  const typeVariants = smartVariantsData.variants.filter(v => v.type === type && v.label);
                  if (!typeVariants.length) return null;
                  const selectedId = selectedSmartVariant[type];
                  const selectedLabel = selectedId ? typeVariants.find(v => v.id === selectedId)?.label : null;
                  const isColorOrImage = type === 'color' || type === 'image';
                  return (
                    <div key={type}>
                      {/* Label SHEIN-style */}
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <span className="text-sm font-semibold">{SMART_V_LABELS[type]}:</span>
                        {selectedLabel && <span className="text-sm text-muted-foreground">{selectedLabel}</span>}
                        <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground mr-auto" />
                      </div>
                      {/* Color/Image → thumbnails scroll */}
                      {isColorOrImage ? (
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
                          {typeVariants.map(v => {
                            const isSelected = selectedSmartVariant[type] === v.id;
                            return (
                              <button key={v.id}
                                onClick={() => { setSelectedSmartVariant(p => ({ ...p, [type]: v.id })); if (v.imageUrl) setVariantActiveImg(v.imageUrl); }}
                                className={`relative shrink-0 rounded-xl overflow-hidden border-2 transition-all ${isSelected ? 'border-primary shadow-md scale-105' : 'border-gray-200 hover:border-gray-400'}`}
                                style={{ width: 72, height: 72 }}
                                data-testid={`button-smart-variant-${type}-${v.id}`}>
                                {v.imageUrl
                                  ? <img src={v.imageUrl} alt={v.label} className="w-full h-full object-cover" />
                                  : v.hex
                                    ? <div className="w-full h-full" style={{ background: v.hex }} />
                                    : <div className="w-full h-full bg-gray-200 flex items-center justify-center text-[10px] font-bold">{v.label}</div>
                                }
                                {Number(v.discount || 0) > 0 && (
                                  <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[9px] font-bold px-1 rounded">-{v.discount}%</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        /* Size/Weight → pill buttons */
                        <div className="flex flex-wrap gap-2">
                          {typeVariants.map(v => {
                            const isSelected = selectedSmartVariant[type] === v.id;
                            const priceNum = Number(currency === 'SAR' && v.priceSar ? v.priceSar : v.price || 0);
                            return (
                              <button key={v.id}
                                onClick={() => { setSelectedSmartVariant(p => ({ ...p, [type]: v.id })); }}
                                className={`flex flex-col items-center justify-center px-5 py-3 rounded-xl border-2 font-bold transition-all min-w-[64px] ${isSelected ? 'border-primary bg-primary text-white shadow' : 'border-gray-300 bg-white dark:bg-gray-800 text-foreground hover:border-gray-400'}`}
                                data-testid={`button-smart-variant-${type}-${v.id}`}>
                                <span className="text-sm">{v.label}</span>
                                {priceNum > 0 && (
                                  <span className={`text-[10px] font-normal mt-0.5 ${isSelected ? 'text-white/80' : 'text-muted-foreground'}`}>
                                    {formatPrice(priceNum)} {currLabel}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── الألوان من colorImages — صور أفقية SHEIN ── */}
            {colorImages.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2.5">
                  <span className="text-sm font-semibold">لون:</span>
                  <span className="text-sm text-muted-foreground">{selectedColor ?? colorImages[0]?.color}</span>
                  <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground mr-auto" />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
                  {colorImages.map((ci, i) => (
                    <button key={i}
                      onClick={() => { setSelectedColor(ci.color); if (ci.imageUrl) setVariantActiveImg(ci.imageUrl); }}
                      className={`relative shrink-0 rounded-xl overflow-hidden border-2 transition-all ${selectedColor === ci.color ? 'border-primary shadow-md scale-105' : 'border-gray-200 hover:border-gray-400'}`}
                      style={{ width: 72, height: 72 }}
                      title={ci.color} data-testid={`button-color-img-${i}`}>
                      {ci.imageUrl
                        ? <img src={ci.imageUrl} alt={ci.color} className="w-full h-full object-cover" />
                        : <div className="w-full h-full" style={{ background: ci.hex || '#ccc' }} />
                      }
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── الألوان العادية (hex) — دوائر SHEIN ── */}
            {colorImages.length === 0 && availableColors.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2.5">
                  <span className="text-sm font-semibold">لون:</span>
                  <span className="text-sm text-muted-foreground">{selectedColor ?? availableColors[0]}</span>
                  <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground mr-auto" />
                </div>
                <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
                  {availableColors.map(c => (
                    <button key={c}
                      onClick={() => setSelectedColor(c)}
                      className="flex flex-col items-center gap-1 shrink-0 transition-all"
                      data-testid={`button-color-${c}`}>
                      <div
                        className={`w-12 h-12 rounded-xl border-2 transition-all ${selectedColor === c ? 'border-primary shadow-md scale-105' : 'border-gray-200 hover:border-gray-400'}`}
                        style={{ backgroundColor: getColorCode(c) }}
                      />
                      <span className="text-[10px] font-medium text-muted-foreground">{c}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── المقاسات مع سعر — pill كبير SHEIN ── */}
            {sizePricing.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2.5">
                  <span className="text-sm font-semibold">مقاس:</span>
                  <span className="text-sm font-bold text-foreground">{selectedSize ?? 'اختر مقاساً'}</span>
                  <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground mr-auto" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {sizePricing.map(sp => {
                    const isSelected = selectedSize === sp.size;
                    return (
                      <button key={sp.size} onClick={() => setSelectedSize(sp.size)}
                        className={`flex flex-col items-center justify-center px-5 py-3 rounded-xl border-2 font-bold transition-all min-w-[64px] ${isSelected ? 'border-primary bg-primary text-white shadow' : 'border-gray-300 bg-white dark:bg-gray-800 text-foreground hover:border-gray-400'}`}
                        data-testid={`button-size-${sp.size}`}>
                        <span className="text-sm leading-tight">{sp.size}</span>
                        <span className={`text-[10px] font-normal mt-0.5 ${isSelected ? 'text-white/80' : 'text-muted-foreground'}`}>
                          {formatPrice(currency === 'SAR' && sp.priceSar ? sp.priceSar : sp.price)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── مقاسات بدون سعر — pill كبير SHEIN ── */}
            {sizes.length > 0 && sizePricing.length === 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2.5">
                  <span className="text-sm font-semibold">مقاس:</span>
                  <span className="text-sm font-bold text-foreground">{selectedSize ?? 'الافتراضي'}</span>
                  <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground mr-auto" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {sizes.map(sz => {
                    const isSelected = selectedSize === sz;
                    return (
                      <button key={sz} onClick={() => setSelectedSize(sz)}
                        className={`px-6 py-3 rounded-xl border-2 text-sm font-bold transition-all ${isSelected ? 'border-primary bg-primary text-white shadow' : 'border-gray-300 bg-white dark:bg-gray-800 text-foreground hover:border-gray-400'}`}
                        data-testid={`button-size-${sz}`}>{sz}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      }

      // ── BULK PRICING ──────────────────────────────────────────────────────
      case "bulk": {
        if (!sec["bulk"]?.visible || bulkPricing.length === 0) return null;
        return (
          <div key="bulk" className="px-4" data-testid="section-bulk">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
              <p className="text-sm font-bold text-primary mb-2">💰 خصومات الكميات</p>
              <div className="flex flex-wrap gap-2">
                {bulkPricing.map((bp, i) => (
                  <Badge key={i} variant={quantity >= bp.minQty ? "default" : "outline"} className="text-xs">
                    {bp.minQty}+ قطعة: {formatPrice(bp.price)} {currLabel}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        );
      }

      // ── QUANTITY ──────────────────────────────────────────────────────────
      case "quantity": {
        if (!sec["quantity"]?.visible) return null;
        return (
          <div key="quantity" className="px-4" data-testid="section-quantity">
            <Label className="font-semibold text-sm mb-2 block">الكمية</Label>
            <div className="flex items-center gap-3">
              <div className="flex items-center border rounded-xl overflow-hidden shadow-sm">
                <Button size="icon" variant="ghost" onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={quantity <= 1} className="h-10 w-10 rounded-none" data-testid="button-decrease-quantity">
                  <Minus className="h-4 w-4" />
                </Button>
                <Input type="number" min={1} max={currentStock}
                  value={quantity}
                  onChange={e => setQuantity(Math.max(1, Math.min(currentStock || 9999, parseInt(e.target.value) || 1)))}
                  className="w-16 text-center font-bold border-0 border-x rounded-none h-10"
                  data-testid="input-quantity" />
                <Button size="icon" variant="ghost" onClick={() => setQuantity(q => Math.min(currentStock || 9999, q + 1))} disabled={currentStock > 0 && quantity >= currentStock} className="h-10 w-10 rounded-none" data-testid="button-increase-quantity">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {currentStock > 0 ? (
                <span className={`text-sm font-medium ${currentStock <= (product?.reorderPoint ?? 10) ? 'text-orange-600' : 'text-muted-foreground'}`}>
                  {currentStock <= (product?.reorderPoint ?? 10) ? `⚠️ متبقي ${currentStock} فقط` : `متوفر: ${currentStock} قطعة`}
                </span>
              ) : (
                <span className="text-sm text-red-600 font-medium">❌ غير متوفر</span>
              )}
            </div>
          </div>
        );
      }

      // ── SHIPPING ──────────────────────────────────────────────────────────
      case "shipping": {
        if (!sec["shipping"]?.visible || !sadeemShowShipping) return null;
        return (
          <div key="shipping" className="px-4" data-testid="section-shipping">
            <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/30 p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-blue-600" />
                <span className="font-semibold text-sm">معلومات الشحن</span>
              </div>
              {sadeemFreeShippingMin === 0 ? (
                <p className="text-sm text-green-700 dark:text-green-400 font-semibold">🎁 شحن مجاني لجميع الطلبات</p>
              ) : totalPrice >= sadeemFreeShippingMin ? (
                <p className="text-sm text-green-700 font-semibold" data-testid="text-shipping-free">✅ طلبك يستحق شحناً مجانياً</p>
              ) : (
                <p className="text-sm text-muted-foreground" data-testid="text-shipping-condition">
                  أضف <strong className="text-foreground">{formatPrice(sadeemFreeShippingMin - totalPrice)} {currLabel}</strong> للشحن المجاني
                </p>
              )}
            </div>
          </div>
        );
      }

      // ── RETURNS ───────────────────────────────────────────────────────────
      case "returns": {
        if (!sec["returns"]?.visible || !sadeemShowReturns) return null;
        return (
          <div key="returns" className="px-4" data-testid="section-returns">
            <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50/60 dark:bg-green-950/30 p-3 flex items-center gap-3">
              <RefreshCcw className="h-5 w-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm">إرجاع مجاني</p>
                <p className="text-xs text-muted-foreground">يمكنك إرجاع المنتج خلال 7 أيام من الاستلام</p>
              </div>
            </div>
          </div>
        );
      }

      // ── INSTALLMENT ───────────────────────────────────────────────────────
      case "installment": {
        if (!sec["installment"]?.visible || !installmentEnabled) return null;
        if (totalPrice < installmentMinAmount) return null;
        const percs = installmentPercentages.split(',').map((p: string) => p.trim());
        return (
          <div key="installment" className="px-4" data-testid="section-installment">
            <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/60 dark:bg-purple-950/30 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <CreditCard className="h-4 w-4 text-purple-600" />
                <span className="font-bold text-sm text-purple-800 dark:text-purple-300">يمكنك التقسيط!</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">هذا الطلب يؤهلك لنظام التقسيط. ادفع مقدماً وسدّد الباقي لاحقاً.</p>
              <div className="flex gap-2 flex-wrap">
                {percs.map((p: string) => (
                  <div key={p} className="rounded-lg bg-purple-100 dark:bg-purple-900/40 px-2 py-1 text-xs font-bold text-purple-800 dark:text-purple-200">
                    {p}% مقدماً ({formatPrice(Math.round(totalPrice * Number(p) / 100))} {currLabel})
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      }

      // ── PRINTING ──────────────────────────────────────────────────────────
      case "printing": {
        if (!sec["printing"]?.visible) return null;
        const hasBagPrinting = product.hasPrintingOptions;
        const hasProfPrinting = !!(product as any).printingCategoryId && productPrintingCat;
        const hasDesignUpload = product.allowDesignUpload;
        if (!hasBagPrinting && !hasProfPrinting && !hasDesignUpload) return null;

        return (
          <div key="printing" className="px-4 space-y-3" data-testid="section-printing">

            {/* ════════════ طباعة الأكياس المخصصة ════════════ */}
            {hasBagPrinting && (
              <div className="rounded-xl border border-cyan-300/60 bg-cyan-50/40 dark:bg-cyan-950/20 overflow-hidden">
                <button
                  className="w-full flex items-center gap-2 px-4 py-3 text-right"
                  onClick={() => setEnableBagPrinting(!enableBagPrinting)}
                  data-testid="toggle-bag-printing"
                >
                  <Printer className="h-5 w-5 text-cyan-600 shrink-0" />
                  <span className="font-bold text-sm flex-1">طباعة مخصصة على الكيس</span>
                  {product.singleColorPrintPrice && (
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {formatPrice(Number(product.singleColorPrintPrice))} {currLabel}/لون/قطعة
                    </Badge>
                  )}
                  {enableBagPrinting ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>

                {enableBagPrinting && (
                  <div className="px-4 pb-4 space-y-4 border-t border-cyan-200/50">

                    {/* لون الكيس */}
                    {(product.availableBagColors || []).length > 0 && (
                      <div className="pt-3">
                        <p className="text-xs font-bold text-muted-foreground mb-2">🎨 لون الكيس</p>
                        <div className="flex flex-wrap gap-2">
                          {(product.availableBagColors || []).map((color: string) => {
                            const isSelected = selectedBagColor === color;
                            const hex = ({ أبيض:"#FFF",أسود:"#111",بيج:"#D4A574",أزرق:"#3B82F6",أحمر:"#EF4444",أخضر:"#22C55E" } as Record<string, string>)[color] || "#9CA3AF";
                            return (
                              <button key={color} onClick={() => setSelectedBagColor(isSelected ? null : color)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all ${isSelected ? "border-primary shadow-md scale-105" : "border-border hover:border-primary/50"}`}
                                data-testid={`bag-color-${color}`}>
                                <span className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: hex }} />
                                {color}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* ألوان التصميم */}
                    <div>
                      <p className="text-xs font-bold text-muted-foreground mb-2">🖨️ ألوان التصميم</p>
                      <div className="space-y-2">
                        {printColors.map((color, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <input
                              className="flex-1 border rounded-lg px-3 py-2 text-sm bg-background"
                              value={color}
                              onChange={e => setPrintColors(prev => { const n = [...prev]; n[i] = e.target.value; return n; })}
                              placeholder={`اسم اللون ${i + 1} (مثال: أسود، ذهبي)`}
                              data-testid={`input-print-color-${i}`}
                            />
                            {product.singleColorPrintPrice && color.trim() && (
                              <span className="text-xs text-primary font-bold whitespace-nowrap shrink-0">
                                +{formatPrice(Number(product.singleColorPrintPrice) * quantity)} {currLabel}
                              </span>
                            )}
                            {i > 0 && (
                              <button onClick={() => setPrintColors(prev => prev.filter((_, j) => j !== i))}
                                className="text-destructive hover:text-destructive/70 text-lg font-bold shrink-0">×</button>
                            )}
                          </div>
                        ))}
                        {printColors.length < 3 && (
                          <button onClick={() => setPrintColors(prev => [...prev, ""])}
                            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-semibold transition"
                            data-testid="add-print-color">
                            <Plus className="h-3.5 w-3.5" /> إضافة لون آخر
                          </button>
                        )}
                      </div>
                    </div>

                    {/* ملخص تكلفة الطباعة */}
                    {bagPrintingCost > 0 && (
                      <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          تكلفة الطباعة ({printColors.filter(c=>c.trim()).length} لون × {quantity} قطعة):
                        </span>
                        <span className="font-bold text-primary text-sm">
                          {formatPrice(bagPrintingCost)} {currLabel}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ════════════ الطباعة الاحترافية (لوحات / كروت...) ════════════ */}
            {hasProfPrinting && productPrintingCat && (
              <div className="rounded-xl border border-violet-300/60 bg-violet-50/40 dark:bg-violet-950/20 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3">
                  <Printer className="h-5 w-5 text-violet-600 shrink-0" />
                  <span className="font-bold text-sm">طباعة احترافية — {productPrintingCat.name}</span>
                </div>

                <div className="px-4 pb-4 space-y-4 border-t border-violet-200/50 pt-3">

                  {/* نوع التشطيب */}
                  {(productPrintingCat.finishOptions || []).length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-muted-foreground mb-2">✨ نوع التشطيب</p>
                      <div className="flex flex-wrap gap-2">
                        {(productPrintingCat.finishOptions || []).map((opt: string) => (
                          <button key={opt} onClick={() => setPrintFinish(printFinish === opt ? "" : opt)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all ${printFinish === opt ? "border-violet-500 bg-violet-500 text-white" : "border-border hover:border-violet-400"}`}
                            data-testid={`finish-${opt}`}>
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* المقاسات */}
                  <div>
                    <p className="text-xs font-bold text-muted-foreground mb-2">📐 المقاسات (سنتيمتر)</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-muted-foreground">العرض (سم)</label>
                        <input type="number" min="1"
                          className="w-full border rounded-lg px-3 py-2 text-sm bg-background mt-0.5"
                          value={printWidth} onChange={e => setPrintWidth(e.target.value)}
                          placeholder={productPrintingCat.minWidthCm ? `الحد الأدنى ${productPrintingCat.minWidthCm}` : "مثال: 100"}
                          data-testid="input-print-width" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">الارتفاع (سم)</label>
                        <input type="number" min="1"
                          className="w-full border rounded-lg px-3 py-2 text-sm bg-background mt-0.5"
                          value={printHeight} onChange={e => setPrintHeight(e.target.value)}
                          placeholder={productPrintingCat.minHeightCm ? `الحد الأدنى ${productPrintingCat.minHeightCm}` : "مثال: 200"}
                          data-testid="input-print-height" />
                      </div>
                    </div>
                    {printWidth && printHeight && (
                      <p className="text-xs text-muted-foreground mt-1">
                        المساحة: {((Number(printWidth) * Number(printHeight)) / 10000).toFixed(3)} م²
                      </p>
                    )}
                  </div>

                  {/* فرز الألوان */}
                  {productPrintingCat.colorSeparationPrice && (
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="color-sep" checked={printColorSeparation}
                        onChange={e => setPrintColorSeparation(e.target.checked)}
                        className="w-4 h-4 rounded" data-testid="checkbox-color-separation" />
                      <label htmlFor="color-sep" className="text-sm cursor-pointer">
                        فرز الألوان
                        <span className="text-xs text-muted-foreground mr-1">
                          (+{formatPrice(Number(productPrintingCat.colorSeparationPrice))} {currLabel})
                        </span>
                      </label>
                    </div>
                  )}

                  {/* سعر اللوحة */}
                  {professionalPrintingUnitPrice > 0 && (
                    <div className="bg-violet-50 dark:bg-violet-950/30 border border-violet-200 rounded-lg px-3 py-2 space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>سعر القطعة الواحدة:</span>
                        <span className="font-bold text-violet-700">{formatPrice(professionalPrintingUnitPrice)} {currLabel}</span>
                      </div>
                      {quantity > 1 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">الإجمالي ({quantity} قطعة):</span>
                          <span className="font-bold text-violet-700">{formatPrice(professionalPrintingUnitPrice * quantity)} {currLabel}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ════════════ رفع ملف التصميم ════════════ */}
            {hasDesignUpload && (
              <div className="rounded-xl border border-blue-300/50 bg-blue-50/40 dark:bg-blue-950/20 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4 text-blue-600" />
                  <span className="font-bold text-sm">ارفع ملف التصميم</span>
                  {product.printingPricePerUnit && (
                    <Badge variant="secondary" className="text-xs">+{formatPrice(product.printingPricePerUnit)} {currLabel}/قطعة</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="enable-printing" checked={enableCustomPrinting}
                    onChange={e => setEnableCustomPrinting(e.target.checked)}
                    className="w-4 h-4 rounded text-primary" />
                  <Label htmlFor="enable-printing" className="cursor-pointer text-sm">أريد طباعة شعاري على المنتج</Label>
                </div>
                {enableCustomPrinting && (
                  <div className="space-y-2">
                    <div className="border-2 border-dashed border-blue-400/50 rounded-lg p-3 text-center cursor-pointer hover:border-blue-500 transition-colors"
                      onClick={() => fileInputRef.current?.click()}>
                      <input ref={fileInputRef} type="file" accept="image/*,.pdf,.ai,.psd"
                        onChange={handleDesignUpload} className="hidden" data-testid="input-design-upload" />
                      {uploadedFile ? (
                        <div className="flex items-center justify-center gap-2 text-blue-600 text-sm">
                          <Check className="h-4 w-4" /><span className="truncate">{uploadedFile.name}</span>
                        </div>
                      ) : (
                        <div className="text-muted-foreground text-sm">
                          <Upload className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                          <p>ارفع التصميم (PDF, PNG, JPG)</p>
                        </div>
                      )}
                    </div>
                    <Textarea value={designNotes} onChange={e => setDesignNotes(e.target.value)}
                      placeholder="ملاحظات التصميم..." className="resize-none text-sm" rows={2}
                      data-testid="input-design-notes" />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      }

      // ── DESCRIPTION ───────────────────────────────────────────────────────
      case "description": {
        if (!sec["description"]?.visible) return null;
        return (
          <div key="description" className="px-4" data-testid="section-description">
            {/* Tabs: Description + Reviews toggle */}
            <div className="flex border-b mb-3">
              <button
                onClick={() => setActiveTab("description")}
                className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === "description" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
                data-testid="tab-description">
                الوصف
              </button>
              <button
                onClick={() => setActiveTab("reviews")}
                className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === "reviews" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
                data-testid="tab-reviews">
                التقييمات ({reviews.length})
              </button>
            </div>
            {activeTab === "description" && (
              <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-product-description">
                {product.description || 'لا يوجد وصف متاح لهذا المنتج.'}
              </p>
            )}
            {activeTab === "reviews" && (
              <div className="space-y-4">
                {/* Add Review - only for buyers with delivered orders */}
                {!isAuthenticated ? (
                  <div className="border rounded-xl p-4 text-center space-y-2 bg-gray-50 dark:bg-gray-800/50">
                    <Star className="h-8 w-8 mx-auto text-yellow-400 fill-yellow-200" />
                    <p className="font-semibold text-sm">هل اشتريت هذا المنتج؟</p>
                    <p className="text-xs text-muted-foreground">سجّل دخولك لتترك تقييمك</p>
                    <Button size="sm" variant="outline" onClick={() => setLocation("/login")} className="text-xs" data-testid="button-login-to-review">
                      تسجيل الدخول
                    </Button>
                  </div>
                ) : hasDeliveredOrder && alreadyReviewed ? (
                  <div className="border rounded-xl p-4 text-center space-y-2 bg-blue-50/40 dark:bg-blue-950/20 border-blue-200">
                    <CheckCircle2 className="h-8 w-8 mx-auto text-blue-500" />
                    <p className="font-semibold text-sm">شكراً على تقييمك!</p>
                    {myReviewData?.isApproved === false && (
                      <p className="text-xs text-muted-foreground">تقييمك بانتظار موافقة الفريق</p>
                    )}
                    <div className="flex justify-center gap-0.5 mt-1">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} className={`h-4 w-4 ${s <= (myReviewData?.rating ?? 5) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                      ))}
                    </div>
                    {myReviewData?.comment && <p className="text-xs text-muted-foreground italic">{myReviewData.comment}</p>}
                  </div>
                ) : hasDeliveredOrder ? (
                  <div className="border rounded-xl p-4 space-y-3 bg-green-50/30 dark:bg-green-950/20 border-green-200">
                    <p className="font-semibold text-sm flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-400" />
                      أضف تقييمك <span className="text-xs text-green-600 font-normal">✅ عميل مشترٍ</span>
                    </p>
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(star => (
                        <button key={star} onClick={() => setReviewRating(star)} className="p-0.5" data-testid={`button-rating-${star}`}>
                          <Star className={`h-7 w-7 transition-colors ${star <= reviewRating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                        </button>
                      ))}
                    </div>
                    <Textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)}
                      placeholder="شاركنا رأيك في هذا المنتج..." className="resize-none text-sm" rows={2}
                      data-testid="input-review-comment" />
                    <div className="flex items-center gap-3">
                      <input ref={reviewImageRef} type="file" accept="image/*" className="hidden"
                        onChange={handleReviewImageUpload} disabled={isUploadingReviewImage}
                        data-testid="input-review-image" />
                      <Button type="button" variant="outline" size="sm"
                        onClick={() => reviewImageRef.current?.click()} disabled={isUploadingReviewImage}
                        className="gap-2 text-xs" data-testid="button-upload-review-image">
                        {isUploadingReviewImage ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                        {isUploadingReviewImage ? 'جاري...' : 'أضف صورة'}
                      </Button>
                      {reviewImageUrl && (
                        <div className="relative">
                          <img src={reviewImageUrl} alt="preview" className="w-12 h-12 object-cover rounded-lg border" />
                          <button onClick={() => setReviewImageUrl(null)}
                            className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive text-white rounded-full flex items-center justify-center"
                            data-testid="button-remove-review-image">
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      )}
                      <Button size="sm" onClick={() => submitReviewMutation.mutate({ rating: reviewRating, comment: reviewComment, imageUrl: reviewImageUrl || undefined })}
                        disabled={submitReviewMutation.isPending} className="mr-auto text-xs"
                        data-testid="button-submit-review">
                        {submitReviewMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin ml-1" /> : null}
                        إرسال التقييم
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">سيظهر تقييمك بعد مراجعة الفريق</p>
                  </div>
                ) : (
                  <div className="border rounded-xl p-4 text-center space-y-2 bg-gray-50 dark:bg-gray-800/50">
                    <Package className="h-8 w-8 mx-auto text-gray-300" />
                    <p className="font-semibold text-sm">التقييم متاح للمشترين فقط</p>
                    <p className="text-xs text-muted-foreground">يمكنك تقييم المنتج بعد استلام طلبك</p>
                  </div>
                )}
                {/* Reviews List */}
                {reviews.length > 0 ? (
                  <div className="space-y-3">
                    {reviews.map(review => (
                      <div key={review.id} className="border rounded-xl p-3" data-testid={`review-card-${review.id}`}>
                        <div className="flex items-start gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-primary font-bold text-xs">م</span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="flex">
                                {[1,2,3,4,5].map(s => (
                                  <Star key={s} className={`h-3.5 w-3.5 ${s <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                                ))}
                              </div>
                              <span className="text-xs text-muted-foreground">{new Date(review.createdAt!).toLocaleDateString('ar-YE')}</span>
                            </div>
                            {review.comment && <p className="text-sm">{review.comment}</p>}
                            {review.imageUrl && <img src={review.imageUrl} alt="تقييم" className="mt-2 w-20 h-20 object-cover rounded-lg" />}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    <Star className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    لا توجد تقييمات بعد. كن أول من يقيّم!
                  </div>
                )}
              </div>
            )}
          </div>
        );
      }

      // ── REVIEWS (separate section — if reviews tab not used) ──────────────
      case "reviews": return null; // Merged into description tabs

      // ── RELATED ───────────────────────────────────────────────────────────
      case "related": {
        if (!sec["related"]?.visible || relatedProducts.length === 0) return null;
        return (
          <div key="related" className="px-4 pb-6" data-testid="section-related">
            <h2 className="font-bold text-base mb-3">منتجات مشابهة</h2>
            <div className="grid grid-cols-2 gap-3">
              {relatedProducts.map(p => (
                <Link key={p.id} href={`/products/${p.id}`}>
                  <div className="border rounded-xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer bg-white dark:bg-gray-900"
                    data-testid={`card-related-${p.id}`}>
                    <div className="aspect-square bg-gray-50 dark:bg-gray-800">
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain p-2" />
                    </div>
                    <div className="p-2">
                      <p className="font-medium text-xs line-clamp-2 mb-1">{p.name}</p>
                      <p className="text-primary font-bold text-sm">{formatPrice(currency==='SAR'&&p.priceSar?p.priceSar:p.price)} {currLabel}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );
      }

      default: return null;
    }
  };

  // ── Images section (always rendered first regardless of order) ──────────
  const imagesSection = imagesSec.visible ? renderSection(imagesSec) : null;
  const infoSections = orderedSections.map(s => renderSection(s));

  // ── Add to Cart buttons (inline, before sticky bar) ──────────────────────
  const addCartButtons = (
    <div key="add-cart-buttons" className="px-4 pb-4" data-testid="section-add-cart">
      <div className="flex gap-3">
        <Button
          size="lg"
          className="flex-1 font-extrabold gap-2 rounded-xl shadow-lg shadow-primary/20"
          style={{ height: pdp.stickyBar.cartHeight }}
          disabled={currentStock <= 0 || isPending}
          onClick={handleAddToCart}
          data-testid="button-add-to-cart">
          {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShoppingCart className="h-5 w-5" />}
          {currentStock <= 0 ? "غير متوفر" : "أضف للسلة"}
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="flex-1 font-extrabold gap-2 rounded-xl border-primary text-primary"
          style={{ height: pdp.stickyBar.cartHeight }}
          disabled={currentStock <= 0 || isPending}
          onClick={handleBuyNow}
          data-testid="button-buy-now">
          <Zap className="h-5 w-5" />
          اشتر الآن
        </Button>
      </div>
    </div>
  );

  // ── Sticky Bar ───────────────────────────────────────────────────────────
  const stickyBar = pdp.stickyBar.visible ? (
    <div className="app-fixed-bar fixed bottom-0 left-0 right-0 z-[60] flex items-stretch shadow-2xl border-t bg-white dark:bg-gray-900"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      data-testid="sticky-cart-bar">
      {detailShowAddToCart && (
        <button
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-white font-extrabold text-sm disabled:opacity-50 px-4 py-3"
          style={{ background: '#111' }}
          disabled={currentStock <= 0 || isPending}
          onClick={handleAddToCart}
          data-testid="sticky-button-add-to-cart">
          {effectiveDiscount > 0 && (
            <span className="text-yellow-400 text-xs font-bold leading-none mb-0.5 flex items-center gap-1">
              <Zap className="h-3 w-3 inline" />{effectiveDiscount}% خصم!
            </span>
          )}
          <span className="flex items-center gap-1.5">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
            {currentStock <= 0 ? "نفذ المخزون" : "أضف للسلة"}
          </span>
        </button>
      )}
      {detailShowShopNow && (
        <button
          className="flex items-center justify-center gap-1.5 border-r border-gray-200 dark:border-gray-700 px-5 font-extrabold text-sm text-foreground bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
          style={{ minWidth: 100 }}
          disabled={currentStock <= 0}
          onClick={handleBuyNow}
          data-testid="sticky-button-buy-now">
          <Zap className="h-4 w-4 text-primary" />تسوق الآن
        </button>
      )}
      <button
        className="flex items-center justify-center px-4 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        data-testid="sticky-button-wishlist"
        onClick={() => setWishlist(w => !w)}
        aria-label="أضف للمفضلة">
        <Heart className={`h-5 w-5 transition-colors ${wishlist ? 'text-red-500 fill-red-500' : 'text-gray-400'}`} />
      </button>
    </div>
  ) : null;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen bg-background" dir="rtl" style={{ paddingBottom: pdp.stickyBar.visible ? 84 : 24 }}>
      {/* هيدر شفاف متراكب فوق الصورة — أسلوب SHEIN */}
      <div
        className="absolute top-0 left-0 right-0 z-40 px-3 pt-2 pb-3"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.1) 80%, transparent 100%)' }}
        data-testid="product-nav"
      >
        <div className="flex items-center gap-2">
          {/* زر الرجوع */}
          <Link href="/products">
            <button className="p-2 rounded-full bg-black/25 hover:bg-black/40 backdrop-blur-sm transition-colors shrink-0" data-testid="button-back">
              <ArrowRight className="h-5 w-5 text-white" />
            </button>
          </Link>

          {/* شريط بحث كامل */}
          <form
            className="flex-1"
            onSubmit={e => {
              e.preventDefault();
              const q = searchQuery.trim();
              setLocation(q ? `/products?search=${encodeURIComponent(q)}` : '/products');
            }}
          >
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ابحث عن منتج..."
                className="w-full bg-white/92 backdrop-blur-sm rounded-full pr-9 pl-4 py-2 text-sm text-gray-800 placeholder-gray-400 border-0 outline-none focus:ring-2 focus:ring-primary/70 shadow-sm"
                data-testid="input-search-top"
              />
            </div>
          </form>

          {/* سلة + قلب */}
          <Link href="/cart">
            <button className="relative p-2 rounded-full bg-black/25 hover:bg-black/40 backdrop-blur-sm transition-colors shrink-0" data-testid="button-cart-top">
              <ShoppingCart className="h-5 w-5 text-white" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -left-0.5 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] font-bold flex items-center justify-center leading-none">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </button>
          </Link>
          <button
            onClick={() => setWishlist(w => !w)}
            className="p-2 rounded-full bg-black/25 hover:bg-black/40 backdrop-blur-sm transition-colors shrink-0"
            data-testid="button-wishlist-top">
            <Heart className={`h-5 w-5 ${wishlist ? 'text-red-400 fill-red-400' : 'text-white'}`} />
          </button>
        </div>
      </div>

      {/* Sections in order — بدون فراغ علوي، الصورة تبدأ من الأعلى */}
      <div style={{ gap: pdp.margins.gap, display: 'flex', flexDirection: 'column' }}>
        {imagesSection}
        {infoSections}
        {addCartButtons}
      </div>

      {stickyBar}
    </div>
  );
}
