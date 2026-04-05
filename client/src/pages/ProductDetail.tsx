import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Product, Review } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useAddToCart } from "@/hooks/use-cart";
import { useAuth } from "@/hooks/use-auth";
import { ShoppingCart, Loader2, Minus, Plus, ArrowRight, Upload, Check, Star, Camera, X, Zap, Package, ChevronLeft, ChevronRight, Printer, Truck, RefreshCcw, Shield, Heart } from "lucide-react";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import useEmblaCarousel from "embla-carousel-react";

// Lazy image component with loading state
const LazyImage = ({ src, alt, className }: { src: string; alt: string; className: string }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setError(false);
  }, [src]);

  if (error) return <div className={`${className} bg-gray-200 dark:bg-gray-800`} />;

  return (
    <>
      {!loaded && <div className={`${className} bg-gray-200 dark:bg-gray-800 animate-pulse`} />}
      <img
        src={src}
        alt={alt}
        className={className}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        style={{ display: loaded ? 'block' : 'none' }}
      />
    </>
  );
};

interface BulkPricing {
  minQty: number;
  price: string;
}

const colorMap: Record<string, string> = {
  أبيض: "#FFFFFF",
  أسود: "#000000",
  أحمر: "#EF4444",
  أزرق: "#3B82F6",
  أخضر: "#22C55E",
  أصفر: "#EAB308",
  برتقالي: "#F97316",
  وردي: "#EC4899",
  بنفسجي: "#8B5CF6",
  رمادي: "#6B7280",
  بني: "#92400E",
  ذهبي: "#D97706",
  فضي: "#9CA3AF",
  شفاف: "transparent",
  سماوي: "#06B6D4",
  زهري: "#F472B6",
  كحلي: "#1E3A8A",
  بيج: "#D4A574",
};

function getColorCode(colorName: string): string {
  const trimmed = colorName.trim();
  return colorMap[trimmed] ?? trimmed;
}

interface SizePricing {
  size: string;
  price: string;
  priceSar?: string;
  colors?: string[];
  stock?: number;
}

interface ColorImageEntry { color: string; hex: string; imageUrl: string; }

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { data: product, isLoading } = useQuery<Product>({
    queryKey: ['/api/products', id],
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const { data: navSettings } = useQuery<any>({
    queryKey: ["/api/navigation-settings"],
    queryFn: async () => {
      const res = await fetch("/api/navigation-settings", { credentials: "include" });
      if (!res.ok) return {};
      return res.json();
    },
    staleTime: 60000,
  });

  const { data: displaySettings } = useQuery<any>({
    queryKey: ["/api/display-settings"],
    staleTime: 60000,
  });
  const detailImgH   = displaySettings?.detailImageHeight    ?? 380;
  const detailImgMode = displaySettings?.detailImageMode     ?? "contain";
  const detailPriceFs = displaySettings?.detailPriceFontSize ?? 22;
  const detailCartH  = displaySettings?.detailAddToCartHeight ?? 52;
  const detailThumb  = displaySettings?.detailThumbnailSize  ?? 64;
  const detailShowRelatedSetting = displaySettings?.detailShowRelated !== false;
  const detailShowReviewsSetting = displaySettings?.detailShowReviews !== false;
  const showStickyCartBar = displaySettings?.showStickyCartBar === true;
  const detailPaddingV  = displaySettings?.detailPaddingV  ?? 8;
  const detailMarginH   = displaySettings?.detailMarginH   ?? 16;
  const detailSectionGap = displaySettings?.detailSectionGap ?? 12;
  const detailTopPadding = displaySettings?.detailTopPadding ?? 8;
  const detailDiscountBubble = displaySettings?.detailDiscountBubbleSize ?? 36;
  const detailShowThumbs = displaySettings?.detailShowThumbnails !== false;

  // ── سديم الذكية ──────────────────────────────────────────────────────────
  const sadeemShowOldPrice      = displaySettings?.sadeemShowOldPrice !== false;
  const sadeemShowDiscountBadge = displaySettings?.sadeemShowDiscountBadge !== false;
  const sadeemShowRating        = displaySettings?.sadeemShowRating !== false;
  const sadeemShowSoldCount     = displaySettings?.sadeemShowSoldCount !== false;
  const sadeemShowShipping      = displaySettings?.sadeemShowShipping !== false;
  const sadeemShowReturns       = displaySettings?.sadeemShowReturns !== false;
  const sadeemFreeShippingMin   = displaySettings?.sadeemFreeShippingMin ?? 0;
  const sadeemMarketerDiscount  = displaySettings?.sadeemMarketerDiscount ?? 0;

  // كشف رابط المسوق ?ref=CODE أو ?promo=CODE
  const marketerRef = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('ref') || params.get('promo') || null;
  }, []);
  const isMarketerLink = !!marketerRef && sadeemMarketerDiscount > 0;

  const { data: reviews = [] } = useQuery<Review[]>({
    queryKey: ['/api/products', id, 'reviews'],
    enabled: !!id,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const { data: relatedProducts = [] } = useQuery<Product[]>({
    queryKey: ['/api/products'],
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 10 * 60 * 1000,
  });

  const filteredRelatedProducts = useMemo(() => {
    if (!product || !relatedProducts.length) return [];
    return relatedProducts
      .filter(p => p.id !== product.id && p.categoryId === product.categoryId)
      .slice(0, 4);
  }, [product, relatedProducts]);

  const addToCartMutation = useAddToCart();
  const { isPending } = addToCartMutation;

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewImageUrl, setReviewImageUrl] = useState<string | null>(null);
  const [isUploadingReviewImage, setIsUploadingReviewImage] = useState(false);
  const reviewImageRef = useRef<HTMLInputElement>(null);

  const handleReviewImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingReviewImage(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch('/api/upload/review', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setReviewImageUrl(data.imageUrl);
        toast({ title: "تم رفع الصورة بنجاح" });
      } else {
        toast({ title: "فشل رفع الصورة", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "حدث خطأ أثناء رفع الصورة", variant: "destructive" });
    }
    setIsUploadingReviewImage(false);
    e.target.value = '';
  };

  const submitReviewMutation = useMutation({
    mutationFn: async ({ rating, comment, imageUrl }: { rating: number; comment: string; imageUrl?: string }) => {
      return apiRequest('POST', `/api/products/${id}/reviews`, { rating, comment, imageUrl });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products', id, 'reviews'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products', id] });
      setReviewComment("");
      setReviewRating(5);
      setReviewImageUrl(null);
      toast({ title: "تم إضافة تقييمك بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ أثناء إضافة التقييم", variant: "destructive" });
    }
  });
  
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedDesignUrl, setUploadedDesignUrl] = useState<string | null>(null);
  const [isUploadingDesign, setIsUploadingDesign] = useState(false);
  const [designNotes, setDesignNotes] = useState("");
  const [enableCustomPrinting, setEnableCustomPrinting] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  const [currency, setCurrency] = useState<'YER' | 'SAR'>(() => {
    return (localStorage.getItem('currency') as 'YER' | 'SAR') || 'YER';
  });

  useEffect(() => {
    const handleCurrencyChange = () => {
      setCurrency((localStorage.getItem('currency') as 'YER' | 'SAR') || 'YER');
    };
    window.addEventListener('currencyChange', handleCurrencyChange);
    return () => window.removeEventListener('currencyChange', handleCurrencyChange);
  }, []);

  const allImages = useMemo(() => {
    if (!product) return [];
    const images = [product.imageUrl];
    if (product.imageUrls && product.imageUrls.length > 0) {
      images.push(...product.imageUrls);
    }
    return images;
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
    if (!product?.bulkPricing) return [];
    try {
      return JSON.parse(product.bulkPricing);
    } catch {
      return [];
    }
  }, [product?.bulkPricing]);

  const sizePricing: SizePricing[] = useMemo(() => {
    if (!product?.sizePricing) return [];
    try {
      return JSON.parse(product.sizePricing);
    } catch {
      return [];
    }
  }, [product?.sizePricing]);

  const currentSizeData = useMemo(() => {
    if (!selectedSize || sizePricing.length === 0) return null;
    return sizePricing.find(sp => sp.size === selectedSize);
  }, [selectedSize, sizePricing]);

  const availableColors = useMemo(() => {
    if (currentSizeData?.colors && currentSizeData.colors.length > 0) {
      return currentSizeData.colors;
    }
    return product?.colors || [];
  }, [currentSizeData, product?.colors]);

  const colorImages: ColorImageEntry[] = useMemo(() => {
    if (!(product as any)?.colorImages) return [];
    try { return JSON.parse((product as any).colorImages); } catch { return []; }
  }, [(product as any)?.colorImages]);

  const showVariantUI = !!(navSettings?.enableVariantProductPage && (product as any)?.enableVariantUI);

  // ── الخيارات الذكية ──────────────────────────────────────────────
  type SmartVType = "color" | "size" | "weight" | "image";
  interface SmartV { id: string; type: SmartVType; label: string; price: string; priceSar: string; discount: string; hex: string; imageUrl: string; }
  interface SmartVData { activeTypes: SmartVType[]; variants: SmartV[]; }
  const SMART_V_LABELS: Record<SmartVType, string> = { color: "اللون", size: "المقاس", weight: "الوزن", image: "الصورة" };

  const smartVariantsData: SmartVData | null = useMemo(() => {
    const sv = (product as any)?.smartVariants;
    if (!sv) return null;
    try { return JSON.parse(sv); } catch { return null; }
  }, [(product as any)?.smartVariants]);

  const showSmartVariants = !!(product as any)?.enableSmartVariants && !!smartVariantsData;

  const [selectedSmartVariant, setSelectedSmartVariant] = useState<Record<string, string>>({});

  const selectedSmartV: SmartV | null = useMemo(() => {
    if (!smartVariantsData) return null;
    const ids = Object.values(selectedSmartVariant);
    for (const id of ids) {
      const v = smartVariantsData.variants.find(v => v.id === id);
      if (v) return v;
    }
    return null;
  }, [selectedSmartVariant, smartVariantsData]);
  const [variantActiveImg, setVariantActiveImg] = useState<string | null>(null);
  const variantHeroImg = variantActiveImg || product?.imageUrl || "";

  useEffect(() => {
    if (sizePricing.length > 0 && !selectedSize) {
      setSelectedSize(sizePricing[0].size);
    }
  }, [sizePricing, selectedSize]);

  useEffect(() => {
    if (selectedSize && availableColors.length > 0 && (!selectedColor || !availableColors.includes(selectedColor))) {
      setSelectedColor(availableColors[0]);
    }
  }, [selectedSize, availableColors, selectedColor]);

  const currentPrice = useMemo(() => {
    if (!product) return '0';

    // الخيارات الذكية لها الأولوية إذا كان هناك خيار محدد
    if (selectedSmartV?.price) {
      if (currency === 'SAR' && selectedSmartV.priceSar) return selectedSmartV.priceSar;
      return selectedSmartV.price;
    }
    
    if (currentSizeData) {
      return currency === 'SAR' && currentSizeData.priceSar 
        ? currentSizeData.priceSar 
        : currentSizeData.price;
    }
    
    let basePrice = currency === 'SAR' && product?.priceSar 
      ? product.priceSar 
      : product?.price || '0';

    if (bulkPricing.length > 0) {
      const applicablePricing = [...bulkPricing]
        .sort((a, b) => b.minQty - a.minQty)
        .find(bp => quantity >= bp.minQty);
      
      if (applicablePricing) {
        basePrice = applicablePricing.price;
      }
    }

    return basePrice;
  }, [product, quantity, currency, bulkPricing, currentSizeData, selectedSmartV]);

  const printingCost = useMemo(() => {
    if (!enableCustomPrinting || !product?.printingPricePerUnit) return 0;
    return Number(product.printingPricePerUnit) * quantity;
  }, [enableCustomPrinting, product?.printingPricePerUnit, quantity]);

  const totalPrice = useMemo(() => {
    return (Number(currentPrice) * quantity) + printingCost;
  }, [currentPrice, quantity, printingCost]);

  const currentStock = useMemo(() => {
    if (currentSizeData?.stock !== undefined) {
      return currentSizeData.stock;
    }
    return product?.stock || 0;
  }, [currentSizeData, product?.stock]);

  const formatPrice = (price: number | string) => {
    return Number(price).toLocaleString('ar-YE');
  };

  const handleDesignUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 10MB for design)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ 
        title: "❌ الملف كبير جداً",
        description: "الحد الأقصى 10MB",
        variant: "destructive" 
      });
      return;
    }

    setIsUploadingDesign(true);
    setUploadedFile(file);

    try {
      // Convert file to base64 directly (NO server upload)
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64String = event.target?.result as string;
        setUploadedDesignUrl(base64String); // Store base64 directly
        
        const sizeInMB = (file.size / 1024 / 1024).toFixed(2);
        toast({
          title: "✅ تم تحضير التصميم",
          description: `${file.name} (${sizeInMB}MB) - جاهز للإضافة`,
        });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast({ title: "❌ خطأ في قراءة الملف", variant: "destructive" });
      setUploadedFile(null);
    }
    setIsUploadingDesign(false);
    e.target.value = '';
  };

  const handleAddToCart = () => {
    if (!product) return;

    try {
      addToCartMutation.mutate({ 
        productId: product.id, 
        quantity,
        selectedSize: selectedSize || undefined,
        selectedColor: selectedColor || undefined,
        customPrinting: enableCustomPrinting,
        designNotes: designNotes || undefined,
        designFileUrl: uploadedDesignUrl || undefined
      });
    } catch (err) {
      console.error('❌ خطأ في الزر:', err);
    }
  };

  const handleBuyNow = async () => {
    if (!product) return;
    try {
      await addToCartMutation.mutateAsync({ 
        productId: product.id, 
        quantity,
        selectedSize: selectedSize || undefined,
        selectedColor: selectedColor || undefined,
        customPrinting: enableCustomPrinting,
        designNotes: designNotes || undefined,
        designFileUrl: uploadedDesignUrl || undefined
      });
      setLocation('/checkout');
    } catch (error) {
      // Error is handled by the mutation's onError
    }
  };

  const sizes = product?.sizes || [];

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-8" />
          <div className="grid md:grid-cols-2 gap-8">
            <div className="aspect-square bg-gray-200 rounded-2xl" />
            <div className="space-y-4">
              <div className="h-8 bg-gray-200 rounded w-3/4" />
              <div className="h-6 bg-gray-200 rounded w-1/2" />
              <div className="h-24 bg-gray-200 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h2 className="text-2xl font-bold mb-4">المنتج غير موجود</h2>
        <Link href="/products">
          <Button>العودة للمنتجات</Button>
        </Link>
      </div>
    );
  }

  /* ───────────────────────────────────────────────────────────────
     SHEIN-STYLE VARIANT UI  (only when BOTH flags are enabled)
  ─────────────────────────────────────────────────────────────── */
  if (showVariantUI) {
    const displayPrice = currency === 'SAR' && product.priceSar ? product.priceSar : product.price;
    const displayCurrencyLabel = currency === 'SAR' ? 'ر.س' : 'ر.ي';
    return (
      <div className="min-h-screen bg-background pb-28" dir="rtl">
        {/* ── Top Nav ── */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b px-3 py-2 flex items-center gap-2">
          <Link href="/products">
            <button className="p-2 rounded-full hover:bg-muted transition-colors" data-testid="button-variant-back">
              <ArrowRight className="h-5 w-5" />
            </button>
          </Link>
          <span className="font-semibold text-sm flex-1 truncate">{product.name}</span>
          {currentStock > 0 && currentStock <= 10 && (
            <span className="text-xs text-orange-500 font-bold">متبقي {currentStock}</span>
          )}
          {currentStock <= 0 && (
            <Badge variant="destructive" className="text-xs">نفذت الكمية</Badge>
          )}
        </div>

        {/* ── Hero Image ── */}
        <div className="relative w-full bg-gray-50 dark:bg-gray-900" style={{ aspectRatio: '3/4', maxHeight: '75vw' }}>
          <img
            src={variantHeroImg}
            alt={product.name}
            className="w-full h-full object-cover"
            data-testid="img-variant-hero"
          />
          {colorImages.length > 0 && (
            <div className="absolute bottom-3 right-3 flex gap-1.5 flex-wrap max-w-[60%] justify-end">
              {colorImages.map((ci, i) => (
                <button
                  key={i}
                  onClick={() => { setVariantActiveImg(ci.imageUrl); setSelectedColor(ci.color); }}
                  className={`w-10 h-10 rounded-lg overflow-hidden border-2 transition-all shadow-sm ${
                    selectedColor === ci.color ? 'border-white ring-2 ring-primary scale-105' : 'border-white/70 opacity-80'
                  }`}
                  title={ci.color}
                  data-testid={`button-variant-color-thumb-${i}`}
                >
                  {ci.imageUrl ? (
                    <img src={ci.imageUrl} alt={ci.color} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full" style={{ background: ci.hex || '#ccc' }} />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Product Info Card ── */}
        <div className="px-4 pt-4 space-y-4">
          {/* Price */}
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-extrabold text-primary" data-testid="text-variant-price">
              {formatPrice(displayPrice)} {displayCurrencyLabel}
            </span>
            {sizePricing.length > 0 && selectedSize && currentSizeData && (
              <span className="text-sm text-muted-foreground line-through">
                {formatPrice(product.price)} {displayCurrencyLabel}
              </span>
            )}
            {currentStock <= 0 && (
              <Badge variant="destructive" className="text-xs mr-auto">نفذ المخزون</Badge>
            )}
          </div>

          {/* Title */}
          <h1 className="text-base font-bold leading-snug" data-testid="text-variant-name">{product.name}</h1>

          {/* Ratings — يتحكم بها سديم الذكية */}
          {(sadeemShowRating || sadeemShowSoldCount) && (
            <div className="flex items-center gap-2">
              {sadeemShowRating && (
                <>
                  <div className="flex">
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} className={`h-3.5 w-3.5 ${s <= Math.floor(Number(product.rating||5)) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">{product.rating || "5"} ({product.reviewCount || 0} تقييم)</span>
                </>
              )}
              {sadeemShowSoldCount && (
                <span className="text-xs text-muted-foreground mr-auto">تم بيع {(product as any).soldCount || 0}</span>
              )}
            </div>
          )}

          {/* Colors (from colorImages) */}
          {colorImages.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold">اللون:</span>
                {selectedColor && (
                  <span className="text-sm text-muted-foreground">{selectedColor}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {colorImages.map((ci, i) => (
                  <button
                    key={i}
                    onClick={() => { setSelectedColor(ci.color); if (ci.imageUrl) setVariantActiveImg(ci.imageUrl); }}
                    className={`relative w-10 h-10 rounded-full border-2 overflow-hidden transition-all ${
                      selectedColor === ci.color ? 'border-primary ring-2 ring-primary/40 scale-110' : 'border-gray-200 hover:border-gray-400'
                    }`}
                    title={ci.color}
                    data-testid={`button-variant-color-${i}`}
                  >
                    {ci.imageUrl ? (
                      <img src={ci.imageUrl} alt={ci.color} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full rounded-full" style={{ background: ci.hex || getColorCode(ci.color) }} />
                    )}
                    {selectedColor === ci.color && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Check className="h-3.5 w-3.5 text-white drop-shadow" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sizes */}
          {sizePricing.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold">الحجم:</span>
                {selectedSize && <span className="text-sm text-muted-foreground">{selectedSize}</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                {sizePricing.map((sp) => (
                  <button
                    key={sp.size}
                    onClick={() => setSelectedSize(sp.size)}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                      selectedSize === sp.size
                        ? 'border-primary bg-primary text-primary-foreground shadow'
                        : 'border-gray-200 hover:border-primary/50 text-foreground'
                    }`}
                    data-testid={`button-variant-size-${sp.size}`}
                  >
                    <div>{sp.size}</div>
                    <div className="text-xs opacity-80">{formatPrice(currency==='SAR'&&sp.priceSar?sp.priceSar:sp.price)} {displayCurrencyLabel}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {sizes.length > 0 && sizePricing.length === 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold">الحجم:</span>
                {selectedSize && <span className="text-sm text-muted-foreground">{selectedSize}</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                {sizes.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedSize(s)}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                      selectedSize === s
                        ? 'border-primary bg-primary text-primary-foreground shadow'
                        : 'border-gray-200 hover:border-primary/50 text-foreground'
                    }`}
                    data-testid={`button-variant-size-text-${s}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Colors (legacy, no colorImages) */}
          {colorImages.length === 0 && availableColors.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold">اللون:</span>
                {selectedColor && <span className="text-sm text-muted-foreground">{selectedColor}</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                {availableColors.map((c) => (
                  <button
                    key={c}
                    onClick={() => setSelectedColor(c)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      selectedColor === c ? 'border-primary ring-2 ring-primary/40 scale-110' : 'border-gray-200'
                    }`}
                    style={{ background: getColorCode(c) }}
                    title={c}
                    data-testid={`button-variant-legacy-color-${c}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {product.description && (
            <div className="text-sm text-muted-foreground leading-relaxed border-t pt-3">
              {product.description}
            </div>
          )}
        </div>

        {/* ── Fixed Bottom Bar ── */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t px-4 py-3 flex items-center gap-3 shadow-lg">
          {/* Quantity */}
          <div className="flex items-center border rounded-lg overflow-hidden">
            <button
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              className="px-3 py-2 hover:bg-muted text-lg font-bold"
              data-testid="button-variant-qty-minus"
            >−</button>
            <span className="px-3 py-2 text-sm font-bold min-w-[2rem] text-center" data-testid="text-variant-qty">{quantity}</span>
            <button
              onClick={() => setQuantity(q => Math.min(currentStock || 999, q + 1))}
              className="px-3 py-2 hover:bg-muted text-lg font-bold"
              data-testid="button-variant-qty-plus"
            >+</button>
          </div>

          {/* Add to cart */}
          <Button
            className="flex-1 gap-2 font-bold"
            disabled={currentStock <= 0 || isPending}
            onClick={handleAddToCart}
            data-testid="button-variant-add-to-cart"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
            {currentStock <= 0 ? 'نفذت الكمية' : 'أضف للسلة'}
          </Button>

          {/* Buy Now */}
          <Button
            variant="outline"
            className="flex-1 gap-2 font-bold border-primary text-primary"
            disabled={currentStock <= 0 || isPending}
            onClick={handleBuyNow}
            data-testid="button-variant-buy-now"
          >
            <Zap className="h-4 w-4" />
            اشتر الآن
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto pb-28" style={{ paddingLeft: detailMarginH, paddingRight: detailMarginH, paddingTop: detailTopPadding }}>
      <Link href="/products">
        <Button variant="ghost" className="mb-4 gap-2" data-testid="button-back">
          <ArrowRight className="h-4 w-4" />
          العودة للمنتجات
        </Button>
      </Link>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="relative">
          {allImages.length > 1 ? (
            <div className="relative">
              <div className="overflow-hidden rounded-2xl" ref={emblaRef}>
                <div className="flex">
                  {allImages.map((img, idx) => (
                    <div key={idx} className="flex-[0_0_100%] min-w-0">
                      <div
                        className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center"
                        style={{ height: detailImgH, padding: detailImgMode === 'contain' ? 16 : 0 }}
                      >
                        <LazyImage
                          src={img}
                          alt={`${product?.name || 'منتج'} - صورة ${idx + 1}`}
                          className={`w-full h-full ${detailImgMode === 'cover' ? 'object-cover' : 'object-contain'}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full shadow-md z-10"
                onClick={scrollNext}
                data-testid="button-image-next"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full shadow-md z-10"
                onClick={scrollPrev}
                data-testid="button-image-prev"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>

              {detailShowThumbs && (
                <div className="flex gap-2 mt-3 justify-center flex-wrap" data-testid="thumbnails-strip">
                  {allImages.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => emblaApi?.scrollTo(idx)}
                      className={`rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${
                        currentImageIndex === idx ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                      style={{ width: detailThumb, height: detailThumb }}
                      data-testid={`button-thumbnail-${idx}`}
                    >
                      <LazyImage src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div
              className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-2xl overflow-hidden flex items-center justify-center"
              style={{ height: detailImgH, padding: detailImgMode === 'contain' ? 16 : 0 }}
            >
              <LazyImage
                src={product?.imageUrl || ''}
                alt={product?.name || 'منتج'}
                className={`w-full h-full ${detailImgMode === 'cover' ? 'object-cover' : 'object-contain'}`}
              />
            </div>
          )}
          
          {currentStock <= 0 && (
            <Badge variant="destructive" className="absolute top-4 right-4 text-sm px-4 py-2">
              نفذت الكمية
            </Badge>
          )}
          {currentStock > 0 && currentStock <= 10 && (
            <Badge variant="secondary" className="absolute top-4 left-4 text-sm px-3 py-1 bg-orange-100 text-orange-700">
              <Package className="h-3 w-3 ml-1" />
              متبقي {currentStock} فقط
            </Badge>
          )}
          {detailDiscountBubble > 0 && (product as any).effectiveDiscount > 0 && (
            <div
              className="absolute bottom-4 left-4 rounded-full flex items-center justify-center font-extrabold text-white shadow-lg"
              style={{
                width: detailDiscountBubble,
                height: detailDiscountBubble,
                fontSize: Math.max(10, detailDiscountBubble * 0.28),
                background: 'var(--discount-badge-bg, #ef4444)',
              }}
              data-testid="badge-detail-discount"
            >
              -{(product as any).effectiveDiscount}%
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: detailSectionGap }}>
          <div>
            <h1 className="text-lg md:text-xl font-extrabold text-foreground mb-2" data-testid="text-product-name">
              {product?.name || 'تحميل المنتج...'}
            </h1>
            
            {/* تقييم ومبيعات — يتحكم بها سديم الذكية */}
            {(sadeemShowRating || sadeemShowSoldCount) && (
              <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-muted/30 rounded-lg">
                {sadeemShowRating && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star 
                          key={star}
                          className={`h-5 w-5 ${
                            star <= Math.floor(Number(product.rating || 5))
                              ? 'text-yellow-400 fill-yellow-400' 
                              : star - 0.5 <= Number(product.rating || 5)
                                ? 'text-yellow-400 fill-yellow-400/50'
                                : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-lg font-bold text-foreground">{product.rating || "5"}</span>
                    <span className="text-sm text-muted-foreground">
                      ({product.reviewCount || 0} تقييم)
                    </span>
                  </div>
                )}
                {sadeemShowSoldCount && (
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="secondary" className="gap-1.5 font-semibold">
                      <ShoppingCart className="h-3.5 w-3.5" />
                      تم بيع {(product as any).soldCount || 0} قطعة
                    </Badge>
                  </div>
                )}
              </div>
            )}
            
            <p className="text-muted-foreground leading-relaxed" data-testid="text-product-description">
              {product?.description || 'لا توجد وصفة متاحة'}
            </p>
          </div>

          {sizePricing.length > 0 && (
            <div>
              <Label className="text-base font-semibold mb-3 block">الحجم</Label>
              <div className="flex flex-wrap gap-2">
                {sizePricing.map((sp) => (
                  <button
                    key={sp.size}
                    onClick={() => setSelectedSize(sp.size)}
                    className={`px-4 py-3 rounded-xl border-2 transition-all font-medium flex flex-col items-center min-w-[80px] ${
                      selectedSize === sp.size 
                        ? 'border-primary bg-primary/10 text-primary shadow-md' 
                        : 'border-gray-200 hover:border-gray-400 text-foreground hover:bg-gray-50'
                    }`}
                    data-testid={`button-size-${sp.size}`}
                  >
                    <span className="font-bold">{sp.size}</span>
                    <span className="text-xs text-muted-foreground mt-1">
                      {formatPrice(currency === 'SAR' && sp.priceSar ? sp.priceSar : sp.price)} {currency === 'YER' ? 'ر.ي' : 'ر.س'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {sizes.length > 0 && sizePricing.length === 0 && (
            <div>
              <Label className="text-base font-semibold mb-3 block">اختر المقاس</Label>
              <div className="flex flex-wrap gap-2">
                {sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`px-4 py-2 rounded-lg border-2 transition-all font-medium ${
                      selectedSize === size 
                        ? 'border-primary bg-primary/10 text-primary' 
                        : 'border-gray-200 hover:border-gray-400 text-foreground'
                    }`}
                    data-testid={`button-size-${size}`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {availableColors.length > 0 && (
            <div>
              <Label className="text-base font-semibold mb-3 block">اللون</Label>
              <div className="flex flex-wrap gap-3">
                {availableColors.map((color) => {
                  const colorCode = getColorCode(color);
                  const isTransparent = color === 'شفاف';
                  return (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                        selectedColor === color 
                          ? 'bg-primary/10 ring-2 ring-primary' 
                          : 'hover:bg-muted'
                      }`}
                      data-testid={`button-color-${color}`}
                    >
                      <div 
                        className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${
                          selectedColor === color ? 'border-primary' : 'border-gray-300'
                        }`}
                        style={{ 
                          backgroundColor: colorCode,
                          backgroundImage: isTransparent ? 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)' : 'none',
                          backgroundSize: '8px 8px',
                          backgroundPosition: '0 0, 4px 4px'
                        }}
                      >
                        {selectedColor === color && (
                          <Check className={`h-5 w-5 drop-shadow-md ${color === 'أبيض' || isTransparent ? 'text-gray-700' : 'text-white'}`} />
                        )}
                      </div>
                      <span className="text-xs font-medium">{color}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── الخيارات الذكية ────────────────────────────────────── */}
          {showSmartVariants && smartVariantsData && (
            <div className="space-y-3" data-testid="smart-variants-section">
              {smartVariantsData.activeTypes.map(type => {
                const typeVariants = smartVariantsData.variants.filter(v => v.type === type && v.label);
                if (typeVariants.length === 0) return null;
                const selectedId = selectedSmartVariant[type];
                return (
                  <div key={type}>
                    <Label className="text-base font-semibold mb-2 block">
                      {SMART_V_LABELS[type]}
                      {selectedId && (() => {
                        const sv = typeVariants.find(v => v.id === selectedId);
                        return sv ? <span className="mr-2 text-sm font-normal text-muted-foreground">— {sv.label}</span> : null;
                      })()}
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {typeVariants.map((v) => {
                        const isSelected = selectedSmartVariant[type] === v.id;
                        const discountNum = Number(v.discount || 0);
                        const priceNum = Number(currency === 'SAR' && v.priceSar ? v.priceSar : v.price || 0);
                        const origPrice = discountNum > 0 ? Math.round(priceNum / (1 - discountNum / 100)) : 0;
                        return (
                          <button
                            key={v.id}
                            onClick={() => {
                              setSelectedSmartVariant(prev => ({ ...prev, [type]: v.id }));
                              if (v.imageUrl) setVariantActiveImg(v.imageUrl);
                            }}
                            className={`px-3 py-2 rounded-xl border-2 transition-all font-medium flex flex-col items-center min-w-[72px] text-center ${
                              isSelected
                                ? 'border-primary bg-primary/10 text-primary shadow-md ring-2 ring-primary/30'
                                : 'border-gray-200 hover:border-gray-400 text-foreground hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                            data-testid={`button-smart-variant-${type}-${v.id}`}
                          >
                            {type === 'color' && v.hex && (
                              <span className="w-5 h-5 rounded-full border-2 border-white shadow mb-1 block mx-auto" style={{ background: v.hex }} />
                            )}
                            {type === 'image' && v.imageUrl && (
                              <img src={v.imageUrl} alt={v.label} className="w-10 h-10 object-cover rounded mb-1 mx-auto" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            )}
                            <span className="font-bold text-sm leading-tight">{v.label}</span>
                            {priceNum > 0 && (
                              <span className="text-xs text-muted-foreground mt-0.5 leading-tight">
                                {formatPrice(priceNum)} {currency === 'YER' ? 'ر.ي' : 'ر.س'}
                              </span>
                            )}
                            {discountNum > 0 && (
                              <span className="text-[10px] font-bold text-red-500 mt-0.5">-{discountNum}%</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <Card className="border-primary/20">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-end justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    {selectedSmartV ? `سعر ${selectedSmartV.label}` : 'السعر للوحدة'}
                  </p>
                  {/* سعر قديم + بادج خصم المتغير الذكي — يتحكم بها سديم الذكية */}
                  {selectedSmartV && Number(selectedSmartV.discount || 0) > 0 && (sadeemShowOldPrice || sadeemShowDiscountBadge) && (() => {
                    const priceNum = Number(currency === 'SAR' && selectedSmartV.priceSar ? selectedSmartV.priceSar : selectedSmartV.price || 0);
                    const discountNum = Number(selectedSmartV.discount);
                    const origPrice = Math.round(priceNum / (1 - discountNum / 100));
                    return (
                      <div className="flex items-center gap-2 mb-1">
                        {sadeemShowOldPrice && (
                          <span className="text-sm line-through text-muted-foreground">{formatPrice(origPrice)}</span>
                        )}
                        {sadeemShowDiscountBadge && (
                          <Badge className="text-xs px-1.5 py-0.5" style={{ background: 'var(--discount-badge-bg, #ef4444)', color: 'white' }}>
                            -{discountNum}%
                          </Badge>
                        )}
                      </div>
                    );
                  })()}
                  {/* السعر الرئيسي — مع خصم المسوق إن وُجد */}
                  {isMarketerLink ? (
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm line-through text-muted-foreground">{formatPrice(currentPrice)}</span>
                        <Badge className="text-xs px-2 py-0.5 bg-purple-600 text-white">
                          خصم مسوق -{sadeemMarketerDiscount}%
                        </Badge>
                      </div>
                      <p className="font-extrabold text-primary" style={{ fontSize: detailPriceFs }} data-testid="text-product-price">
                        {formatPrice(Math.round(Number(currentPrice) * (1 - sadeemMarketerDiscount / 100)))}
                        <span className="text-lg font-normal text-muted-foreground mr-2">
                          {currency === 'YER' ? 'ر.ي' : 'ر.س'}
                        </span>
                      </p>
                    </div>
                  ) : (
                    <p className="font-extrabold text-primary" style={{ fontSize: detailPriceFs }} data-testid="text-product-price">
                      {formatPrice(currentPrice)} 
                      <span className="text-lg font-normal text-muted-foreground mr-2">
                        {currency === 'YER' ? 'ر.ي' : 'ر.س'}
                      </span>
                    </p>
                  )}
                </div>
                <div className="text-left">
                  <p className="text-sm text-muted-foreground mb-1">الإجمالي</p>
                  <p className="text-lg font-bold text-foreground" data-testid="text-total-price">
                    {formatPrice(totalPrice)} 
                    <span className="text-xs font-normal text-muted-foreground mr-1">
                      {currency === 'YER' ? 'ر.ي' : 'ر.س'}
                    </span>
                  </p>
                  {printingCost > 0 && (
                    <p className="text-xs text-muted-foreground">
                      (يشمل {formatPrice(printingCost)} رسوم الطباعة)
                    </p>
                  )}
                </div>
              </div>

              {bulkPricing.length > 0 && (
                <div className="bg-primary/5 rounded-lg p-3">
                  <p className="text-sm font-semibold text-primary mb-2">خصومات الكميات:</p>
                  <div className="flex flex-wrap gap-2">
                    {bulkPricing.map((bp, i) => (
                      <Badge 
                        key={i} 
                        variant={quantity >= bp.minQty ? "default" : "outline"}
                        className="text-xs"
                      >
                        {bp.minQty}+ قطعة: {formatPrice(bp.price)} {currency === 'YER' ? 'ر.ي' : 'ر.س'}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── سديم الذكية: بطاقة الشحن ── */}
          {sadeemShowShipping && (
            <div className="border border-blue-200 dark:border-blue-800 rounded-xl p-4 bg-blue-50/50 dark:bg-blue-950/30 space-y-2" data-testid="card-sadeem-shipping">
              <div className="flex items-center gap-2 mb-1">
                <Truck className="h-4 w-4 text-blue-600" />
                <span className="font-semibold text-sm">معلومات الشحن</span>
              </div>
              {sadeemFreeShippingMin === 0 ? (
                <p className="text-sm text-green-700 dark:text-green-400 font-semibold flex items-center gap-1">
                  <span>🎁</span> شحن مجاني لجميع الطلبات
                </p>
              ) : (
                <div>
                  {totalPrice >= sadeemFreeShippingMin ? (
                    <p className="text-sm text-green-700 dark:text-green-400 font-semibold flex items-center gap-1" data-testid="text-shipping-free">
                      ✅ مبروك! طلبك يستحق شحناً مجانياً
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground" data-testid="text-shipping-condition">
                      أضف <strong className="text-foreground">{formatPrice(sadeemFreeShippingMin - totalPrice)} {currency === 'YER' ? 'ر.ي' : 'ر.س'}</strong> للحصول على شحن مجاني
                      <span className="block text-xs text-muted-foreground mt-0.5">
                        (الحد الأدنى: {formatPrice(sadeemFreeShippingMin)} {currency === 'YER' ? 'ر.ي' : 'ر.س'})
                      </span>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── سديم الذكية: بطاقة الإرجاع ── */}
          {sadeemShowReturns && (
            <div className="border border-green-200 dark:border-green-800 rounded-xl p-4 bg-green-50/50 dark:bg-green-950/30 flex items-center gap-3" data-testid="card-sadeem-returns">
              <RefreshCcw className="h-5 w-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm">إرجاع مجاني</p>
                <p className="text-xs text-muted-foreground">يمكنك إرجاع المنتج خلال 7 أيام من الاستلام</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label className="text-base font-semibold mb-3 block">الكمية</Label>
              <div className="flex items-center gap-3">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                  data-testid="button-decrease-quantity"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  min={1}
                  max={currentStock}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.min(currentStock, parseInt(e.target.value) || 1)))}
                  className="w-20 text-center font-bold text-lg"
                  data-testid="input-quantity"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setQuantity(Math.min(currentStock, quantity + 1))}
                  disabled={quantity >= currentStock}
                  data-testid="button-increase-quantity"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  متوفر: {currentStock} قطعة
                </span>
              </div>
            </div>

            {(product.allowDesignUpload || product.hasPrintingOptions) && (
              <Card className="border-[#2196F3]/30 bg-[#2196F3]/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2 text-[#2196F3]">
                    <Printer className="h-5 w-5" />
                    طباعة مخصصة
                    {product.printingPricePerUnit && (
                      <Badge variant="secondary" className="mr-2">
                        +{formatPrice(product.printingPricePerUnit)} {currency === 'YER' ? 'ر.ي' : 'ر.س'}/قطعة
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="enable-printing"
                      checked={enableCustomPrinting}
                      onChange={(e) => setEnableCustomPrinting(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label htmlFor="enable-printing" className="cursor-pointer">
                      أريد طباعة شعاري أو تصميمي على المنتج
                    </Label>
                  </div>

                  {enableCustomPrinting && (
                    <div className="space-y-2">
                      <div 
                        className="border-2 border-dashed border-[#2196F3]/50 rounded-lg p-3 text-center cursor-pointer hover:border-[#2196F3] transition-colors bg-white dark:bg-gray-800"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*,.pdf,.ai,.psd"
                          onChange={handleDesignUpload}
                          className="hidden"
                          data-testid="input-design-upload"
                        />
                        {isUploadingDesign ? (
                          <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm py-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>جاري الرفع...</span>
                          </div>
                        ) : uploadedFile ? (
                          <div className="flex items-center justify-center gap-2 text-[#2196F3] text-sm py-2">
                            <Check className="h-4 w-4" />
                            <span className="font-medium truncate">{uploadedFile.name}</span>
                          </div>
                        ) : (
                          <div className="text-muted-foreground py-2">
                            <Upload className="h-6 w-6 mx-auto mb-1 text-[#2196F3]" />
                            <p className="font-medium text-sm">ارفع التصميم</p>
                            <p className="text-xs mt-0.5 text-gray-400">PDF, PNG, JPG</p>
                          </div>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="design-notes" className="text-sm mb-1 block">ملاحظات</Label>
                        <Textarea
                          id="design-notes"
                          value={designNotes}
                          onChange={(e) => setDesignNotes(e.target.value)}
                          placeholder="ملاحظات بخصوص التصميم..."
                          className="resize-none text-sm"
                          rows={2}
                          data-testid="input-design-notes"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              size="lg"
              className="flex-1 text-lg font-extrabold gap-3 rounded-xl shadow-lg shadow-primary/20"
              style={{ height: detailCartH }}
              disabled={currentStock <= 0 || isPending}
              onClick={handleAddToCart}
              data-testid="button-add-to-cart"
            >
              {isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ShoppingCart className="h-5 w-5" />
              )}
              {currentStock <= 0 ? "غير متوفر" : "أضف للسلة"}
            </Button>
            
          </div>
        </div>
      </div>

      <Separator className="my-8" />
      
      {product.showReviews !== false && detailShowReviewsSetting && (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">التقييمات والمراجعات</h2>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">أضف تقييمك</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-2 block">التقييم</Label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className="p-1"
                    data-testid={`button-rating-${star}`}
                  >
                    <Star 
                      className={`h-8 w-8 transition-colors ${
                        star <= reviewRating
                          ? 'text-yellow-400 fill-yellow-400' 
                          : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="review-comment" className="mb-2 block">تعليقك (اختياري)</Label>
              <Textarea
                id="review-comment"
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="شاركنا رأيك في هذا المنتج..."
                className="resize-none"
                rows={3}
                data-testid="input-review-comment"
              />
            </div>
            
            <div>
              <Label className="mb-2 block">أضف صورة للمنتج (اختياري)</Label>
              <div className="flex items-center gap-4">
                <input
                  ref={reviewImageRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleReviewImageUpload}
                  disabled={isUploadingReviewImage}
                  data-testid="input-review-image"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => reviewImageRef.current?.click()}
                  disabled={isUploadingReviewImage}
                  className="gap-2"
                  data-testid="button-upload-review-image"
                >
                  {isUploadingReviewImage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                  {isUploadingReviewImage ? 'جاري الرفع...' : 'رفع صورة'}
                </Button>
                
                {reviewImageUrl && (
                  <div className="relative">
                    <img 
                      src={reviewImageUrl} 
                      alt="صورة التقييم" 
                      className="w-16 h-16 object-cover rounded-lg border"
                    />
                    <button
                      type="button"
                      onClick={() => setReviewImageUrl(null)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center"
                      data-testid="button-remove-review-image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                شارك صورة المنتج بعد استلامه
              </p>
            </div>
            
            <Button
              onClick={() => submitReviewMutation.mutate({ 
                rating: reviewRating, 
                comment: reviewComment,
                imageUrl: reviewImageUrl || undefined
              })}
              disabled={submitReviewMutation.isPending}
              data-testid="button-submit-review"
            >
              {submitReviewMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : null}
              إرسال التقييم
            </Button>
          </CardContent>
        </Card>

        {reviews.length > 0 ? (
          <div className="space-y-4">
            {reviews.map((review) => (
              <Card key={review.id} data-testid={`review-card-${review.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-bold">م</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star 
                              key={star}
                              className={`h-4 w-4 ${
                                star <= review.rating
                                  ? 'text-yellow-400 fill-yellow-400' 
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(review.createdAt!).toLocaleDateString('ar-YE')}
                        </span>
                      </div>
                      {review.comment && (
                        <p className="text-sm text-foreground">{review.comment}</p>
                      )}
                      {review.imageUrl && (
                        <img 
                          src={review.imageUrl} 
                          alt="صورة التقييم" 
                          className="mt-2 w-24 h-24 object-cover rounded-lg"
                        />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Star className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>لا توجد تقييمات بعد. كن أول من يقيم هذا المنتج!</p>
            </CardContent>
          </Card>
        )}
      </div>
      )}

      {filteredRelatedProducts.length > 0 && detailShowRelatedSetting && (
        <>
          <Separator className="my-8" />
          <div>
            <h2 className="text-2xl font-bold mb-4">منتجات مشابهة</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {filteredRelatedProducts.map((p) => (
                <Link key={p.id} href={`/products/${p.id}`}>
                  <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                    <div className="aspect-square bg-gray-50 dark:bg-gray-800">
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain p-4" />
                    </div>
                    <CardContent className="p-3">
                      <h3 className="font-medium text-sm line-clamp-2 mb-1">{p.name}</h3>
                      <p className="text-primary font-bold text-sm">
                        {formatPrice(currency === 'SAR' && p.priceSar ? p.priceSar : p.price)} {currency === 'YER' ? 'ر.ي' : 'ر.س'}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── الشريط اللاصق السفلي (يظهر عند تفعيل الإعداد) ── */}
      {showStickyCartBar && (
        <div
          className="fixed bottom-0 left-0 right-0 z-[60] flex items-stretch shadow-2xl border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)', minHeight: 64 }}
          data-testid="sticky-cart-bar"
        >
          {/* أضف للسلة — داكن/أسود، ممتد */}
          <button
            className="flex-1 flex flex-col items-center justify-center gap-0.5 text-white font-extrabold text-sm transition-opacity disabled:opacity-50 px-4 py-3"
            style={{ background: '#111' }}
            disabled={currentStock <= 0 || isPending}
            onClick={handleAddToCart}
            data-testid="sticky-button-add-to-cart"
          >
            {/* بادج الخصم فوق النص */}
            {(product as any).effectiveDiscount > 0 && (
              <span className="text-yellow-400 text-xs font-bold leading-none mb-0.5 flex items-center gap-1">
                <Zap className="h-3 w-3 inline" />
                {(product as any).effectiveDiscount}% خصم!
              </span>
            )}
            <span className="flex items-center gap-1.5">
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShoppingCart className="h-4 w-4" />
              )}
              {currentStock <= 0 ? "نفذ المخزون" : "أضف للسلة"}
            </span>
          </button>

          {/* تسوق الآن — إطار أبيض */}
          <button
            className="flex items-center justify-center gap-1.5 border-r border-gray-200 dark:border-gray-700 px-5 font-extrabold text-sm text-foreground bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            style={{ minWidth: 110 }}
            disabled={currentStock <= 0}
            onClick={handleBuyNow}
            data-testid="sticky-button-buy-now"
          >
            تسوق الآن
          </button>

          {/* قلب/المفضلة */}
          <button
            className="flex items-center justify-center px-4 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            data-testid="sticky-button-wishlist"
            onClick={() => {}}
            aria-label="أضف للمفضلة"
          >
            <Heart className="h-5 w-5 text-gray-500" />
          </button>
        </div>
      )}
    </div>
  );
}
