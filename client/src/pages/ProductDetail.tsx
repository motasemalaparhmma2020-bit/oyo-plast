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

// ── PdpCollapsible — حاوية قابلة للطي لمنتقي الألوان والمقاس ───────────────
function PdpCollapsible({
  label, value, collapsible, children,
}: {
  label: string; value?: string; collapsible: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <div
        className={`flex items-center gap-1.5 mb-2.5 ${collapsible ? 'cursor-pointer select-none' : ''}`}
        onClick={collapsible ? () => setOpen(o => !o) : undefined}
      >
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-sm text-muted-foreground">{value}</span>
        {collapsible && (
          open
            ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground mr-auto" />
            : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground mr-auto" />
        )}
        {!collapsible && <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground mr-auto" />}
      </div>
      {(!collapsible || open) && children}
    </div>
  );
}

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
interface QuantityTier { qty: number; totalPrice: number; unitPrice: number; costPrice?: number; }
interface ColorImageEntry { color: string; hex: string; imageUrl: string; }
type SmartVType = "color" | "size" | "weight" | "image" | "bundle" | "strength" | "preview";
interface SmartV { id: string; type: SmartVType; label: string; price: string; priceSar: string; discount: string; hex: string; imageUrl: string; count?: number; costPriceY?: string; costPriceSar?: string; }
interface SmartVData { activeTypes: SmartVType[]; variants: SmartV[]; }
const SMART_V_LABELS: Record<SmartVType, string> = { color: "اللون", size: "المقاس", weight: "الوزن", image: "الصورة", bundle: "الشدة", strength: "الشدة", preview: "معاينة فورية" };

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

  const { isAuthenticated, user } = useAuth();

  // ── Data fetching ───────────────────────────────────────────────────────
  const { data: product, isLoading } = useQuery<Product>({ queryKey: ['/api/products', id], staleTime: 5 * 60000, gcTime: 10 * 60000 });
  const { data: displaySettings } = useQuery<any>({ queryKey: ["/api/display-settings"], staleTime: 60000 });
  const { data: pdpRaw } = useQuery<PdpLayout>({ queryKey: ["/api/pdp-layout"], staleTime: 60000 });
  const { data: reviews = [] } = useQuery<Review[]>({ queryKey: ['/api/products', id, 'reviews'], enabled: !!id, staleTime: 2 * 60000 });
  const { data: allProducts = [] } = useQuery<Product[]>({ queryKey: ['/api/products'], staleTime: 3 * 60000, gcTime: 10 * 60000 });
  const { data: cartItems = [] } = useQuery<any[]>({ queryKey: ['/api/cart'], staleTime: 30000 });
  const cartCount = cartItems.length;

  // ── المفضلة ─────────────────────────────────────────────────────────────────
  const { data: wishlistItems = [] } = useQuery<any[]>({
    queryKey: ['/api/wishlist'],
    enabled: isAuthenticated,
    staleTime: 60000,
  });
  const numericId = parseInt(id || "0");
  const inWishlist = (wishlistItems as any[]).some((w: any) => w.productId === numericId);

  const toggleWishlistMutation = useMutation({
    mutationFn: async () => {
      if (!isAuthenticated) {
        toast({ title: "سجّل دخولك أولاً", description: "لحفظ المفضلة يجب تسجيل الدخول" });
        return;
      }
      if (inWishlist) {
        await fetch(`/api/wishlist/${numericId}`, { method: "DELETE", credentials: "include" });
      } else {
        await fetch("/api/wishlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ productId: numericId }),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wishlist'] });
      toast({ title: inWishlist ? "أُزيل من المفضلة" : "✅ أُضيف للمفضلة" });
    },
    onMutate: () => setWishlistPending(true),
    onSettled: () => setWishlistPending(false),
  });

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
  // ── منتقي الألوان ─────────────────────────────────────────────────────────
  const pdpColorThumbnailW   = displaySettings?.pdpColorThumbnailW ?? 72;
  const pdpColorThumbnailH   = displaySettings?.pdpColorThumbnailH ?? 72;
  const pdpColorLayout       = (displaySettings?.pdpColorLayout ?? "scroll") as "scroll" | "grid2" | "grid3";
  const pdpColorCollapsible  = displaySettings?.pdpColorCollapsible === true;
  // ── منتقي المقاس ──────────────────────────────────────────────────────────
  const pdpSizeLayout        = (displaySettings?.pdpSizeLayout ?? "wrap") as "wrap" | "row" | "vertical" | "grid2";
  const pdpSizeButtonW       = displaySettings?.pdpSizeButtonW ?? 0;   // 0 = auto
  const pdpSizeButtonH       = displaySettings?.pdpSizeButtonH ?? 56;
  const pdpSizeShowPrice     = displaySettings?.pdpSizeShowPrice !== false;
  const pdpSizeCollapsible   = displaySettings?.pdpSizeCollapsible === true;
  const pdpSizeStyle         = (displaySettings?.pdpSizeStyle ?? "card") as "card" | "pill" | "square" | "full";

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
  const [selectedTier, setSelectedTier]   = useState<QuantityTier | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize]   = useState<string | null>(null);
  const [uploadedFile, setUploadedFile]   = useState<File | null>(null);
  const [uploadedDesignUrl, setUploadedDesignUrl] = useState<string | null>(null);
  const [isUploadingDesign, setIsUploadingDesign] = useState(false);
  const [designNotes, setDesignNotes]     = useState("");
  const [enableCustomPrinting, setEnableCustomPrinting] = useState(false);
  // ── Phase 4: حاسبة الطباعة الفورية ──────────────────────────────────────
  // ── Phase 1 Simplification (May 18, 2026) ─────────────────────────────
  // ثابت: لون واحد + وجهين دائماً (الأكثر طلباً) — لا UI للتغيير
  const [printingColors, _setPrintingColors] = useState<number>(1);
  const [printingSides, _setPrintingSides]   = useState<number>(2);
  // أبقينا الـ setters للتوافق مع كود قديم لكنها لا تُستخدم في الواجهة
  const setPrintingColors = _setPrintingColors;
  const setPrintingSides = _setPrintingSides;
  // ── Phase 5: المعاينة الفورية للطباعة ───────────────────────────────────
  const [logoPosition, setLogoPosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [previewImgAspect, setPreviewImgAspect] = useState<number>(1); // عرض / طول صورة المنتج
  // ── Phase 6: تغيير لون الكيس عبر Cloudinary ─────────────────────────────
  const [selectedDynamicBagColor, setSelectedDynamicBagColor] = useState<{ id: string; name: string; code: string } | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ dragging: boolean; offsetX: number; offsetY: number }>({ dragging: false, offsetX: 0, offsetY: 0 });
  // ── Phase 2 UX Revamp (May 18, 2026): main-image preview + ink chips ─────
  const mainPreviewContainerRef = useRef<HTMLDivElement | null>(null);
  const mainDragStateRef = useRef<{ dragging: boolean; offsetX: number; offsetY: number }>({ dragging: false, offsetX: 0, offsetY: 0 });
  const [showUploadZone, setShowUploadZone] = useState(false);
  const [previewPhase, setPreviewPhase] = useState<'idle' | 'countdown' | 'active'>('idle');
  const [previewCountdown, setPreviewCountdown] = useState(3);
  const [selectedInkColor, setSelectedInkColor] = useState<{ name: string; hex: string } | null>(null);
  // ── AI Studio Preview Engine (June 2026) ──
  const [studioPreviewUrl, setStudioPreviewUrl] = useState<string | null>(null);
  const [studioPreviewLoading, setStudioPreviewLoading] = useState(false);
  const [studioPreviewText, setStudioPreviewText] = useState("");
  const [showStudioTextInput, setShowStudioTextInput] = useState(false);
  const [alternativeUrls, setAlternativeUrls] = useState<string[]>([]);
  const [altLoading, setAltLoading] = useState(false);
  const [quickPreviewUrl, setQuickPreviewUrl] = useState<string | null>(null);
  const [quantityDefaultApplied, setQuantityDefaultApplied] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [variantActiveImg, setVariantActiveImg]   = useState<string | null>(null);
  const [promoBarOpen, setPromoBarOpen]           = useState(false);
  const [selectedSmartVariant, setSelectedSmartVariant] = useState<Record<string, string>>({});
  const [lastClickedType, setLastClickedType] = useState<string | null>(null);
  const [reviewRating, setReviewRating]   = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewImageUrl, setReviewImageUrl] = useState<string | null>(null);
  const [isUploadingReviewImage, setIsUploadingReviewImage] = useState(false);
  const [activeTab, setActiveTab]         = useState<"description" | "reviews">("description");
  // ── Phase B: Image Zoom Lightbox ──────────────────────────────────────────
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  // ── Phase B: Collapsible info sections (description, specs, reviews) ──────
  const [openDesc, setOpenDesc] = useState(true);
  const [openSpecs, setOpenSpecs] = useState(false);
  const [openReviewsCol, setOpenReviewsCol] = useState(false);
  const [wishlistPending, setWishlistPending] = useState(false);
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

  // ── تصفير الحالة عند تغيير المنتج ────────────────────────────────────────
  // يحلّ مشكلة: انتقال لمنتج آخر مع بقاء الكمية/الخيارات السابقة
  useEffect(() => {
    setQuantity(1);
    setSelectedColor(null);
    setSelectedSize(null);
    setSelectedSmartVariant({});
    setLastClickedType(null);
    setUploadedFile(null);
    setUploadedDesignUrl(null);
    setDesignNotes("");
    setEnableCustomPrinting(false);
    setEnableBagPrinting(false);
    setSelectedBagColor(null);
    setShowUploadZone(false);
    setPreviewPhase('idle');
    setPreviewCountdown(3);
    setSelectedInkColor(null);
    setQuantityDefaultApplied(false);
    setSelectedTier(null);
    setPrintColors([""]);
    setPrintWidth("");
    setPrintHeight("");
    setPrintFinish("");
    setPrintColorSeparation(false);
    setVariantActiveImg(null);
    setCurrentImageIndex(0);
    setSelectedDynamicBagColor(null); // Phase 6: لا يتسرّب اللون بين المنتجات
  }, [numericId]);

  // ── Derived Data ─────────────────────────────────────────────────────────
  // ── Phase 6: رابط Cloudinary الديناميكي عند اختيار لون كيس ──
  // 🛡️ يطبَّق فقط على المنتجات القابلة للتخصيص (customizable) لمنع تطبيق تغيير اللون
  // على منتجات جاهزة (بلاستيك/معدن/إلخ) لا يصلح فيها استبدال لون البكسلات.
  const dynamicColorImageUrl = useMemo(() => {
    if (!product || !selectedDynamicBagColor) return null;
    const ptype = (product as any).productType ?? "ready";
    if (ptype !== "customizable") return null;
    const publicId = (product as any).baseImagePublicId;
    const cloudName = (product as any).cloudinaryCloudName;
    if (!publicId || !cloudName) return null;
    // e_replace_color:NEW_COLOR:TOLERANCE:FROM_COLOR
    // tolerance=60 مهم لالتقاط جميع ظلال الأبيض على الكيس (وإلا تبقى الصورة بيضاء).
    // نستخدم hex بدون # ليعمل مع أي لون مخصص.
    const targetHex = (selectedDynamicBagColor.code || '').replace('#', '') || selectedDynamicBagColor.id;
    return `https://res.cloudinary.com/${cloudName}/image/upload/e_replace_color:${targetHex}:60:ffffff/${publicId}`;
  }, [product, selectedDynamicBagColor]);

  // Phase 6: عند تحميل منتج قابل للتخصيص فيه ألوان كيس، اختر أول لون افتراضياً
  // حتى تظهر الصورة الملوّنة من Cloudinary بدلاً من الصورة الفارغة/proxy.
  useEffect(() => {
    if (!product) return;
    const ptype = (product as any).productType ?? "ready";
    if (ptype !== "customizable") return;
    const publicId = (product as any).baseImagePublicId;
    const cloudName = (product as any).cloudinaryCloudName;
    if (!publicId || !cloudName) return;
    const colors = (product as any).availableColors;
    if (!Array.isArray(colors) || colors.length === 0) return;
    setSelectedDynamicBagColor((prev) => prev ?? colors[0]);
  }, [product]);

  // الصورة الرئيسية الفعلية (مع تطبيق لون ديناميكي إن وُجد)
  const effectiveMainImageUrl = useMemo(() => dynamicColorImageUrl || product?.imageUrl || "", [dynamicColorImageUrl, product?.imageUrl]);

  // ── Phase 3: استقرار صورة Cloudinary — preload قبل العرض لمنع الـ flicker ──
  // عند تغيير لون الكيس، Cloudinary يولّد URL جديداً يتطلب تحميلاً شبكياً.
  // نُحمّل الصورة الجديدة في الخلفية أولاً، ثم نستبدل المعروضة فقط عند جاهزيتها.
  const [stableMainImageUrl, setStableMainImageUrl] = useState<string>("");
  const [imageTransitioning, setImageTransitioning] = useState(false);
  // عند تغيير المنتج، صفّر الحالة المستقرة لتجنّب تسرّب صورة المنتج السابق
  useEffect(() => {
    setStableMainImageUrl("");
    setImageTransitioning(false);
  }, [numericId]);
  useEffect(() => {
    if (!effectiveMainImageUrl) return;
    if (effectiveMainImageUrl === stableMainImageUrl) return;
    // أول تحميل بدون transition
    if (!stableMainImageUrl) {
      setStableMainImageUrl(effectiveMainImageUrl);
      return;
    }
    setImageTransitioning(true);
    const pre = new window.Image();
    let cancelled = false;
    pre.onload = () => {
      if (cancelled) return;
      setStableMainImageUrl(effectiveMainImageUrl);
      setImageTransitioning(false);
    };
    pre.onerror = () => {
      if (cancelled) return;
      setStableMainImageUrl(effectiveMainImageUrl); // اعرض على أي حال (LazyImage سيتعامل مع الخطأ)
      setImageTransitioning(false);
    };
    pre.src = effectiveMainImageUrl;
    return () => { cancelled = true; };
  }, [effectiveMainImageUrl, stableMainImageUrl]);

  // ── دمج كل الصور: المنتج + متغيرات ذكية + صور الألوان ──
  // Phase 3: نستخدم stableMainImageUrl في العنصر الأول لمنع الـ flicker في الكاروسيل
  const allImages = useMemo(() => {
    if (!product) return [];
    const imgs: string[] = [];
    const mainImg = stableMainImageUrl || dynamicColorImageUrl || product.imageUrl;
    if (mainImg) imgs.push(mainImg);
    if (product.imageUrls?.length) product.imageUrls.forEach(u => { if (u && !imgs.includes(u)) imgs.push(u); });
    // صور المتغيرات الذكية (SHEIN-style)
    try {
      const sv = (product as any).smartVariants;
      if (sv) {
        const parsed = typeof sv === 'string' ? JSON.parse(sv) : sv;
        parsed?.variants?.forEach((v: any) => {
          if (v?.imageUrl && !imgs.includes(v.imageUrl)) imgs.push(v.imageUrl);
        });
      }
    } catch {}
    // صور الألوان (قديم)
    try {
      const ci = (product as any).colorImages;
      if (ci) {
        const parsed = typeof ci === 'string' ? JSON.parse(ci) : ci;
        parsed?.forEach?.((e: any) => {
          if (e?.imageUrl && !imgs.includes(e.imageUrl)) imgs.push(e.imageUrl);
        });
      }
    } catch {}
    return imgs;
  }, [product, dynamicColorImageUrl, stableMainImageUrl]);

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

  // ── Volume Offers — العروض التحفيزية حسب الكمية (May 17, 2026) ────────────
  interface VolumeOffer {
    id: number; productId: number;
    minQuantity: number; maxQuantity: number | null;
    offerPriceYer: number; originalPriceYer: number | null;
    displayLabel: string | null; badgeText: string | null;
    hasFreeShipping: boolean; shippingFeeYer: number;
    marketerCommissionPercent: number | null;
    isActive: boolean; sortOrder: number;
  }
  const { data: volumeOffers = [], isSuccess: volumeOffersLoaded } = useQuery<VolumeOffer[]>({
    queryKey: ['/api/products', id, 'volume-offers'],
    queryFn: async () => {
      const res = await fetch(`/api/products/${numericId}/volume-offers`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!numericId && !!(product as any)?.enableVolumeOffers,
    staleTime: 5 * 60000,
  });
  const sortedOffers = useMemo(() =>
    [...volumeOffers].sort((a, b) => a.minQuantity - b.minQuantity),
    [volumeOffers]);
  const activeOffer = useMemo(() => {
    const matching = sortedOffers.filter(o =>
      quantity >= o.minQuantity && (o.maxQuantity == null || quantity <= o.maxQuantity)
    );
    if (matching.length === 0) return null;
    return matching.sort((a, b) => a.offerPriceYer - b.offerPriceYer)[0];
  }, [sortedOffers, quantity]);
  const nextOffer = useMemo(() => {
    if (sortedOffers.length === 0) return null;
    return sortedOffers.find(o => o.minQuantity > quantity) || null;
  }, [sortedOffers, quantity]);

  const sizePricing: SizePricing[] = useMemo(() => {
    try { return product?.sizePricing ? JSON.parse(product.sizePricing) : []; } catch { return []; }
  }, [product?.sizePricing]);

  // ── Quantity Tiers (اختر الكمية) ──
  const quantityTiers: QuantityTier[] = useMemo(() => {
    try {
      const qt = (product as any)?.quantityTiers;
      if (!qt) return [];
      const parsed = typeof qt === 'string' ? JSON.parse(qt) : qt;
      return Array.isArray(parsed) ? parsed.filter((t: any) => t.qty > 0 && t.totalPrice > 0) : [];
    } catch { return []; }
  }, [(product as any)?.quantityTiers]);
  const showQuantityTiers = !!(product as any)?.enableQuantityTiers && quantityTiers.length > 0;

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

  // ── تحديد افتراضي للمتغيرات الذكية (أرخص متغيّر من كل نوع لجذب العميل) ──
  useEffect(() => {
    if (!smartVariantsData || !showSmartVariants) return;
    smartVariantsData.activeTypes.forEach(type => {
      if (!selectedSmartVariant[type]) {
        // اختيار الأرخص في هذا النوع كافتراضي
        const ofType = smartVariantsData.variants
          .filter(v => v.type === type && v.label)
          .map(v => ({ ...v, _p: parseFloat(String(v.price ?? "0")) }))
          .filter(v => !isNaN(v._p) && v._p > 0)
          .sort((a, b) => a._p - b._p);
        const cheapest = ofType[0] || smartVariantsData.variants.find(v => v.type === type && v.label);
        if (cheapest) {
          setSelectedSmartVariant(p => ({ ...p, [type]: cheapest.id }));
          if (cheapest.imageUrl) setVariantActiveImg(cheapest.imageUrl);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smartVariantsData, showSmartVariants]);

  // ── مزامنة الـ carousel مع صورة المتغير النشط ──
  useEffect(() => {
    if (!variantActiveImg || !emblaApi) return;
    const idx = allImages.indexOf(variantActiveImg);
    if (idx >= 0 && idx !== currentImageIndex) {
      emblaApi.scrollTo(idx);
    }
  }, [variantActiveImg, emblaApi, allImages, currentImageIndex]);

  // ── Price Calculation — أولوية الأسعار الذكية ────────────────────────────
  // منطق (ج): الوزن له أولوية تلقائية، لكن آخر نقرة هي الحكم
  const smartVariantPrice = useMemo(() => {
    if (!smartVariantsData || !showSmartVariants) return null;
    const getV = (type: string): SmartV | null => {
      const id = selectedSmartVariant[type];
      if (!id) return null;
      return smartVariantsData.variants.find(v => v.id === id) || null;
    };
    const pick = (v: SmartV | null) => v?.price
      ? (currency === 'SAR' && v.priceSar ? v.priceSar : v.price)
      : null;
    // 1) آخر ما نقره المستخدم له الأولوية القصوى
    if (lastClickedType) {
      const lastV = getV(lastClickedType);
      const lastP = pick(lastV);
      if (lastP) return { price: lastP, label: lastV?.label || '', type: lastClickedType };
    }
    // 2) الشدّة/البندل — أولوية عُليا تلقائية (تسعير الجملة)
    const bundleV = getV('bundle');
    const bundleP = pick(bundleV);
    if (bundleP) return { price: bundleP, label: bundleV?.label || '', type: 'bundle' };
    // 3) الوزن — أولوية تلقائية
    const weightV = getV('weight');
    const weightP = pick(weightV);
    if (weightP) return { price: weightP, label: weightV?.label || '', type: 'weight' };
    // 4) المقاس
    const sizeV = getV('size');
    const sizeP = pick(sizeV);
    if (sizeP) return { price: sizeP, label: sizeV?.label || '', type: 'size' };
    // 5) الشدة (سرة)
    const strengthV = getV('strength');
    const strengthP = pick(strengthV);
    if (strengthP) return { price: strengthP, label: strengthV?.label || '', type: 'strength' };
    // 6) اللون أو الصورة (نادراً)
    for (const type of ['color', 'image']) {
      const v = getV(type); const p = pick(v);
      if (p) return { price: p, label: v?.label || '', type };
    }
    return null;
  }, [smartVariantsData, showSmartVariants, selectedSmartVariant, lastClickedType, currency]);

  // ── Preview Fee: رسم إضافي للمعاينة الفورية — لا يؤثر على السعر الأساسي ──────
  const previewFee = useMemo(() => {
    if (!showSmartVariants || !smartVariantsData) return 0;
    const previewId = selectedSmartVariant['preview'];
    if (!previewId) return 0;
    const v = smartVariantsData.variants.find(x => x.id === previewId && x.type === 'preview');
    if (!v) return 0;
    const price = Number(currency === 'SAR' && v.priceSar ? v.priceSar : v.price || 0);
    return price;
  }, [showSmartVariants, smartVariantsData, selectedSmartVariant, currency]);

  const currentPrice = useMemo(() => {
    if (!product) return '0';
    // ── Volume Offer له الأولوية المطلقة (يلغي smart variants + الطباعة) ──
    // ملاحظة: سعر العرض مُسجّل بـ YER. عرض SAR لاحقاً عبر mapping على الخادم.
    if (activeOffer) {
      return String(activeOffer.offerPriceYer);
    }
    // ── Quantity Tiers (اختر الكمية) — أولوية بعد العروض ──
    if (showQuantityTiers && selectedTier) {
      return String(selectedTier.unitPrice);
    }
    // الخيارات الذكية لها الأولوية الكاملة عند تفعيلها
    if (showSmartVariants && smartVariantPrice) return smartVariantPrice.price;
    if (currentSizeData) {
      return currency === 'SAR' && currentSizeData.priceSar ? currentSizeData.priceSar : currentSizeData.price;
    }
    let base = currency === 'SAR' && product?.priceSar ? product.priceSar : product?.price || '0';
    if (bulkPricing.length > 0) {
      const applicable = [...bulkPricing].sort((a, b) => b.minQty - a.minQty).find(bp => quantity >= bp.minQty);
      if (applicable) base = applicable.price;
    }
    return base;
  }, [product, quantity, currency, bulkPricing, currentSizeData, showSmartVariants, smartVariantPrice, activeOffer, showQuantityTiers, selectedTier]);

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

  // ── Phase 4: تسعير الطباعة الفوري (Hybrid Override) ─────────────────────
  // المنطق: override المنتج ?? قيمة الفئة ?? 0
  const printingPricing = useMemo(() => {
    const designFee = Number(
      (product as any)?.printingDesignFeeOverride ??
      productPrintingCat?.designFeePerMockup ?? 0
    ) || 0;
    const pricePerColor = Number(
      (product as any)?.printingColorPriceOverride ??
      productPrintingCat?.colorPricePerColor ?? 0
    ) || 0;
    const pricePerSide = Number(
      (product as any)?.printingSidePriceOverride ??
      productPrintingCat?.pricePerSide ?? 0
    ) || 0;
    return { designFee, pricePerColor, pricePerSide };
  }, [product, productPrintingCat]);

  const hasPhase4Pricing = useMemo(() => {
    const enabled = (product as any)?.hasPrintingOptions === true || (product as any)?.printingCategoryId;
    if (!enabled) return false;
    return (printingPricing.designFee + printingPricing.pricePerColor + printingPricing.pricePerSide) > 0;
  }, [printingPricing, product]);

  // ── المنطق الجديد (Phase 4 v2 — May 17, 2026) ────────────────────
  // الصيغة: printingPerBag = colors × sides × pricePerColorSide
  //         totalPrintingCost = (printingPerBag × qty) + designFee
  // كل لون وكل وجه مدفوع. التصميم رسم ثابت لكل طلب.
  const phase4PrintingBreakdown = useMemo(() => {
    if (!enableCustomPrinting || !hasPhase4Pricing) {
      return { designFee: 0, printingPerBag: 0, printingTotal: 0, totalPrintingCost: 0 };
    }
    const colors = Math.max(1, printingColors);
    const sides  = Math.max(1, printingSides);
    const printingPerBag = colors * sides * printingPricing.pricePerColor;
    const printingTotal  = printingPerBag * Math.max(1, quantity);
    const designFee      = printingPricing.designFee;
    return {
      designFee,
      printingPerBag,
      printingTotal,
      // legacy fields محفوظة للتوافق مع كود قديم في cart/checkout
      colorTotal: printingTotal,
      sideTotal: 0,
      totalPrintingCost: designFee + printingTotal,
    };
  }, [enableCustomPrinting, hasPhase4Pricing, printingColors, printingSides, printingPricing, quantity]);

  const effectiveQty = showQuantityTiers && selectedTier ? selectedTier.qty : quantity;

  const totalPrice = useMemo(() => {
    // عند تفعيل العرض، السعر شامل ويُلغي كل رسوم الطباعة والأقسام الأخرى
    if (activeOffer) return Number(currentPrice) * effectiveQty;
    return (Number(currentPrice) * effectiveQty) + printingCost + bagPrintingCost + (professionalPrintingUnitPrice * effectiveQty) + phase4PrintingBreakdown.totalPrintingCost + (previewFee * effectiveQty);
  }, [currentPrice, effectiveQty, printingCost, bagPrintingCost, professionalPrintingUnitPrice, phase4PrintingBreakdown.totalPrintingCost, previewFee, activeOffer]);

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
    // ── الخيارات الذكية لها الأولوية: استخرج تسميات اللون والمقاس من المتغيرات المختارة ──
    let svSize: string | undefined;
    let svColor: string | undefined;
    let svBundleLabel: string | undefined;
    let svBundleCount: number | undefined;
    if (showSmartVariants && smartVariantsData) {
      for (const [type, vid] of Object.entries(selectedSmartVariant)) {
        const v = smartVariantsData.variants.find(x => x.id === vid);
        if (!v) continue;
        if (type === 'size' || type === 'weight') svSize = v.label;
        if (type === 'strength') svSize = svSize ? `${svSize} | ${v.label}` : v.label;
        if (type === 'color' || type === 'image') svColor = v.label;
        if (type === 'bundle') {
          svBundleLabel = v.label;
          svBundleCount = Number((v as any).count) || undefined;
        }
      }
      // ── 🎁 الشدة/البندل لها الأولوية المطلقة في selectedSize ──
      // (الخادم يطابق label مع smart_variants لاستخراج السعر الصحيح)
      // إن وُجد bundle مختار، يُكتب في selectedSize ليصل للخادم ويُحفظ في DB
      // (مهم لإعادة الحساب في PATCH/merge)
      if (svBundleLabel) {
        svSize = svSize ? `${svBundleLabel} | ${svSize}` : svBundleLabel;
      }
    }
    return {
      productId: product?.id ?? 0,
      quantity: effectiveQty,
      selectedSize: svSize || selectedSize || undefined,
      selectedColor: svColor || selectedColor || undefined,
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
      // ── Phase 4: خيارات الطباعة الفورية ──
      ...(enableCustomPrinting && hasPhase4Pricing && phase4PrintingBreakdown.totalPrintingCost > 0 ? {
        designOptions: {
          colors: printingColors,
          sides: printingSides,
          designFee: phase4PrintingBreakdown.designFee,
          colorTotal: phase4PrintingBreakdown.colorTotal,
          sideTotal: phase4PrintingBreakdown.sideTotal,
          totalPrintingCost: phase4PrintingBreakdown.totalPrintingCost,
          // Phase 5: موضع الشعار على المنتج (% نسب 0-100)
          ...(logoPosition ? { logoPosition } : {}),
          // Phase 6: لون الكيس المختار (Cloudinary)
          ...(selectedDynamicBagColor ? { bagColor: selectedDynamicBagColor } : {}),
        },
      } : {}),
      // السعر الوحدوي المحسوب
      unitPrice: totalPrice / effectiveQty || undefined,
      // ── Quantity Tier المختارة (للتكالف والأرباح) ──
      ...(selectedTier ? {
        quantityTier: {
          qty: selectedTier.qty,
          totalPrice: selectedTier.totalPrice,
          unitPrice: selectedTier.unitPrice,
          costPrice: selectedTier.costPrice,
        },
      } : {}),
      // ── Preview Fee (معاينة فورية) — يُمرّر للخادم للتحقق ──
      ...(showSmartVariants && smartVariantsData && selectedSmartVariant['preview'] ? {
        selectedPreview: selectedSmartVariant['preview'],
      } : {}),
    };
  }, [product?.id, effectiveQty, selectedSize, selectedColor, enableCustomPrinting, designNotes, uploadedDesignUrl,
      enableBagPrinting, selectedBagColor, printColors,
      productPrintingCat, printWidth, printHeight, printFinish, printColorSeparation, professionalPrintingUnitPrice,
      totalPrice, selectedSmartVariant, smartVariantsData, showSmartVariants,
      hasPhase4Pricing, printingColors, printingSides, phase4PrintingBreakdown, logoPosition, selectedDynamicBagColor]);

  // ── Phase 5: تهيئة موضع الشعار من إعدادات المنتج عند رفع التصميم ──────
  useEffect(() => {
    if (uploadedDesignUrl && !logoPosition) {
      const defaultArea = (product as any)?.printArea && typeof (product as any).printArea === "object"
        ? (product as any).printArea
        : { x: 25, y: 25, width: 50, height: 50 };
      setLogoPosition({
        x: Number(defaultArea.x) || 25,
        y: Number(defaultArea.y) || 25,
        width: Number(defaultArea.width) || 50,
        height: Number(defaultArea.height) || 50,
      });
    }
    if (!uploadedDesignUrl && logoPosition) {
      setLogoPosition(null);
    }
  }, [uploadedDesignUrl, (product as any)?.printArea]);

  // ── Phase 5: رسم المعاينة على Canvas ──────────────────────────────────
  useEffect(() => {
    if (!uploadedDesignUrl || !logoPosition || !previewCanvasRef.current || !product?.imageUrl) return;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const bg = new Image();
    bg.crossOrigin = "anonymous";
    bg.onload = () => {
      // حدّث aspect ratio لمزامنة الحاوية مع الـ canvas (لا letterboxing → إحداثيات السحب = إحداثيات الرسم)
      if (bg.width > 0 && bg.height > 0) {
        const ar = bg.width / bg.height;
        if (Math.abs(ar - previewImgAspect) > 0.01) setPreviewImgAspect(ar);
      }
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, W, H);
      // ارسم صورة المنتج لتملأ الـ canvas بالكامل (الحاوية بنفس النسبة)
      ctx.drawImage(bg, 0, 0, W, H);
      // ارسم الشعار بنسب مئوية من كامل الـ canvas
      const logo = new Image();
      logo.onload = () => {
        const lx = W * logoPosition.x / 100;
        const ly = H * logoPosition.y / 100;
        const lw = W * logoPosition.width / 100;
        const lh = H * logoPosition.height / 100;
        ctx.drawImage(logo, lx, ly, lw, lh);
      };
      logo.src = uploadedDesignUrl;
    };
    bg.onerror = () => {
      ctx.fillStyle = "#f3f4f6";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#9ca3af";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("لا يمكن تحميل صورة المنتج", W / 2, H / 2);
    };
    bg.src = stableMainImageUrl || effectiveMainImageUrl;
  }, [uploadedDesignUrl, logoPosition, stableMainImageUrl, effectiveMainImageUrl]);

  // ── Phase 5: handlers للسحب ──────────────────────────────────────────
  const handlePreviewPointerDown = (e: React.PointerEvent) => {
    if (!logoPosition || !previewContainerRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = previewContainerRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * 100;
    const py = ((e.clientY - rect.top) / rect.height) * 100;
    dragStateRef.current = {
      dragging: true,
      offsetX: px - logoPosition.x,
      offsetY: py - logoPosition.y,
    };
  };
  const handlePreviewPointerMove = (e: React.PointerEvent) => {
    if (!dragStateRef.current.dragging || !logoPosition || !previewContainerRef.current) return;
    const rect = previewContainerRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * 100;
    const py = ((e.clientY - rect.top) / rect.height) * 100;
    let newX = px - dragStateRef.current.offsetX;
    let newY = py - dragStateRef.current.offsetY;
    newX = Math.max(0, Math.min(100 - logoPosition.width, newX));
    newY = Math.max(0, Math.min(100 - logoPosition.height, newY));
    setLogoPosition({ ...logoPosition, x: newX, y: newY });
  };
  const handlePreviewPointerUp = (e: React.PointerEvent) => {
    dragStateRef.current.dragging = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
  };

  // ── Phase 2 UX: drag handlers للسحب على الصورة الرئيسية ─────────────────
  const handleMainPreviewPointerDown = (e: React.PointerEvent) => {
    if (!logoPosition || !mainPreviewContainerRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = mainPreviewContainerRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * 100;
    const py = ((e.clientY - rect.top) / rect.height) * 100;
    mainDragStateRef.current = { dragging: true, offsetX: px - logoPosition.x, offsetY: py - logoPosition.y };
  };
  const handleMainPreviewPointerMove = (e: React.PointerEvent) => {
    if (!mainDragStateRef.current.dragging || !logoPosition || !mainPreviewContainerRef.current) return;
    const rect = mainPreviewContainerRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * 100;
    const py = ((e.clientY - rect.top) / rect.height) * 100;
    let newX = px - mainDragStateRef.current.offsetX;
    let newY = py - mainDragStateRef.current.offsetY;
    newX = Math.max(0, Math.min(100 - logoPosition.width, newX));
    newY = Math.max(0, Math.min(100 - logoPosition.height, newY));
    setLogoPosition({ ...logoPosition, x: newX, y: newY });
  };
  const handleMainPreviewPointerUp = (e: React.PointerEvent) => {
    mainDragStateRef.current.dragging = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
  };

  // ── Phase 2: عدّاد 3 ثواني بعد رفع التصميم ──────────────────────────────
  useEffect(() => {
    if (!uploadedDesignUrl) { setPreviewPhase('idle'); setPreviewCountdown(3); return; }
    if (previewPhase !== 'idle') return;
    setPreviewPhase('countdown');
    setPreviewCountdown(3);
    let n = 3;
    const t = setInterval(() => {
      n -= 1;
      setPreviewCountdown(n);
      if (n <= 0) {
        clearInterval(t);
        setPreviewPhase('active');
        if (!enableCustomPrinting) setEnableCustomPrinting(true);
      }
    }, 1000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedDesignUrl]);

  // ── Phase 2: الكمية الافتراضية = أصغر عرض كمية متاح (يُطبَّق مرة واحدة) ──
  useEffect(() => {
    if (quantityDefaultApplied) return;
    if (sortedOffers.length === 0) return;
    const minQ = sortedOffers[0].minQuantity;
    if (minQ && minQ > 1) setQuantity(minQ);
    setQuantityDefaultApplied(true);
  }, [sortedOffers, quantityDefaultApplied]);

  // ── Phase 2: تنبيه الأدمن للمنتجات التي لا تحتوي عروض كميات ─────────────
  // يعمل فقط بعد اكتمال fetch (isSuccess) لتجنّب التنبيهات الكاذبة
  useEffect(() => {
    if (!product?.id) return;
    if (!volumeOffersLoaded) return;
    if (sortedOffers.length > 0) return;
    const key = `no-volume-offers-notified-${product.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    fetch('/api/admin/notify-missing-volume-offers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: product.id, productName: product.name }),
    }).catch(() => { /* silent */ });
  }, [product?.id, product?.name, volumeOffersLoaded, sortedOffers.length]);

  // ── Phase 2: ألوان حبر الطباعة — من إعدادات المنتج (printColorOptions) ──
  const productPrintColorOptions: Array<{ name: string; hex: string }> = useMemo(() => {
    try {
      const raw = (product as any)?.printColorOptions;
      if (!raw) return [];
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) ? parsed.filter((c: any) => c?.name && c?.hex) : [];
    } catch { return []; }
  }, [(product as any)?.printColorOptions]);
  // fallback: لو لم يُعيّن الأدمن ألواناً، نعرض لوحة افتراضية
  const inkColorPalette = useMemo(() => (
    productPrintColorOptions.length > 0 ? productPrintColorOptions : [
      { name: 'أسود', hex: '#1a1a1a' },
      { name: 'أبيض', hex: '#FFFFFF' },
      { name: 'ذهبي', hex: '#D4AF37' },
      { name: 'فضي', hex: '#C0C0C0' },
      { name: 'أحمر', hex: '#EF4444' },
      { name: 'أزرق', hex: '#3B82F6' },
      { name: 'أخضر', hex: '#22C55E' },
      { name: 'وردي', hex: '#EC4899' },
      { name: 'برتقالي', hex: '#F97316' },
    ]
  ), [productPrintColorOptions]);

  // ── Phase 2: نصيحة التباين الذكية ───────────────────────────────────────
  const isHexDark = (hex: string): boolean => {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16) || 0;
    const g = parseInt(h.substring(2, 4), 16) || 0;
    const b = parseInt(h.substring(4, 6), 16) || 0;
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq < 128;
  };
  const smartContrastTip = useMemo(() => {
    if (!selectedDynamicBagColor || !selectedInkColor) return null;
    const bagDark = isHexDark(selectedDynamicBagColor.code);
    const inkDark = isHexDark(selectedInkColor.hex);
    if (bagDark === inkDark) {
      return { good: false, text: `⚠️ ${selectedInkColor.name} على ${selectedDynamicBagColor.name} قد لا يكون واضحاً — جرّب لوناً أكثر تبايناً` };
    }
    return { good: true, text: `✨ ${selectedInkColor.name} على ${selectedDynamicBagColor.name} يبرز بشكل احترافي` };
  }, [selectedDynamicBagColor, selectedInkColor]);

  // ── Phase 2: مزامنة selectedInkColor مع printColors[0] (للتوافق مع cart) ─
  // عند إلغاء الاختيار يُمسح اللون الأول أيضاً لتجنّب stale state
  useEffect(() => {
    setPrintColors(prev => {
      const n = [...prev];
      n[0] = selectedInkColor ? selectedInkColor.name : "";
      return n;
    });
  }, [selectedInkColor]);

  // ── التحقق من اختيار المقاس قبل الإضافة للسلة ──
  const validateSelection = (): string | null => {
    // عندما تكون الخيارات الذكية مفعّلة، تجاهل تماماً الفحوصات القديمة
    // (لأن واجهات sizes/sizePricing القديمة مخفية ولا يمكن للمستخدم التفاعل معها)
    if (showSmartVariants && smartVariantsData) {
      const LABELS: Record<string, string> = { color: "اللون", size: "المقاس", weight: "الوزن", image: "الخيار", bundle: "الكمية (شدة/بندل)" };
      for (const type of smartVariantsData.activeTypes) {
        const typeVariants = smartVariantsData.variants.filter(v => v.type === type && v.label);
        if (typeVariants.length > 0 && !selectedSmartVariant[type]) {
          return `⚠️ يرجى اختيار ${LABELS[type] || type} أولاً`;
        }
      }
      return null;
    }
    // 1) sizePricing يلزم اختيار مقاس
    if (sizePricing.length > 0 && !selectedSize) {
      return "⚠️ يرجى اختيار المقاس المناسب أولاً";
    }
    // 2) sizes بدون سعر يلزم اختيار مقاس
    if (sizes.length > 0 && sizePricing.length === 0 && !selectedSize) {
      return "⚠️ يرجى اختيار المقاس أولاً";
    }
    return null;
  };

  const handleAddToCart = () => {
    if (!product) return;
    const err = validateSelection();
    if (err) {
      toast({ title: err, variant: "destructive" });
      document.querySelector('[data-testid^="button-size-"], [data-testid^="button-smart-variant-"]')
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    addToCartMutation.mutate(cartPayload, {
      onSuccess: () => {
        // تصفير الكمية والخيارات بعد الإضافة الناجحة
        setQuantity(1);
        setSelectedSmartVariant({});
        setLastClickedType(null);
        setSelectedColor(null);
        setSelectedSize(null);
      },
    });
  };

  const handleBuyNow = async () => {
    if (!product) return;
    const err = validateSelection();
    if (err) {
      toast({ title: err, variant: "destructive" });
      document.querySelector('[data-testid^="button-size-"], [data-testid^="button-smart-variant-"]')
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
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

  // ── AI Studio Preview Engine handlers ──
  const generateStudioPreview = async () => {
    if (!product || !uploadedDesignUrl) return;
    setStudioPreviewLoading(true);
    setAlternativeUrls([]);
    try {
      const r = await apiRequest('POST', '/api/studio-preview/generate', {
        productId: product.id,
        productImage: product.imageUrl || product.images?.[0],
        logoUrl: uploadedDesignUrl,
        bagColor: selectedDynamicBagColor?.name || selectedBagColor || 'white',
        printColor: selectedInkColor?.name || 'black',
        textContent: studioPreviewText || undefined,
        businessType: user?.businessType || undefined,
      });
      const d = await r.json();
      if (d.success) {
        setStudioPreviewUrl(d.imageUrl);
        toast({ title: "\u2705 \u062a\u0645 \u0625\u0646\u0634\u0627\u0621 \u0645\u0639\u0627\u064a\u0646\u0629 \u0627\u0644\u0627\u0633\u062a\u0648\u062f\u064a\u0648" });
        if (d.recommendation) {
          toast({ title: `\u0646\u0635\u064a\u062d\u0629: ${d.recommendation}` });
        }
      } else {
        toast({ title: d.error || "\u0641\u0634\u0644 \u0641\u064a \u0627\u0644\u0645\u0639\u0627\u064a\u0646\u0629", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: e?.message || "\u0641\u0634\u0644 \u0641\u064a \u0627\u0644\u0645\u0639\u0627\u064a\u0646\u0629", variant: "destructive" });
    } finally {
      setStudioPreviewLoading(false);
    }
  };

  const generateQuickPreview = async () => {
    if (!product || !uploadedDesignUrl) return;
    setStudioPreviewLoading(true);
    try {
      const r = await apiRequest('POST', '/api/studio-preview/quick', {
        productImage: product.imageUrl || product.images?.[0],
        logoUrl: uploadedDesignUrl,
        bagColor: selectedDynamicBagColor?.name || selectedBagColor || 'white',
        printColor: selectedInkColor?.name || 'black',
        textContent: studioPreviewText || undefined,
      });
      const d = await r.json();
      if (d.success) {
        setQuickPreviewUrl(d.imageUrl);
        toast({ title: "\u2705 \u0645\u0639\u0627\u064a\u0646\u0629 \u0633\u0631\u064a\u0639\u0629 \u062c\u0627\u0647\u0632\u0629" });
      } else {
        toast({ title: d.error || "\u0641\u0634\u0644 \u0641\u064a \u0627\u0644\u0645\u0639\u0627\u064a\u0646\u0629 \u0627\u0644\u0633\u0631\u064a\u0639\u0629", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: e?.message || "\u0641\u0634\u0644 \u0641\u064a \u0627\u0644\u0645\u0639\u0627\u064a\u0646\u0629 \u0627\u0644\u0633\u0631\u064a\u0639\u0629", variant: "destructive" });
    } finally {
      setStudioPreviewLoading(false);
    }
  };

  const generateAlternatives = async () => {
    if (!product || !uploadedDesignUrl) return;
    setAltLoading(true);
    try {
      const r = await apiRequest('POST', '/api/studio-preview/alternatives', {
        productId: product.id,
        productImage: product.imageUrl || product.images?.[0],
        logoUrl: uploadedDesignUrl,
        bagColor: selectedDynamicBagColor?.name || selectedBagColor || 'white',
        printColor: selectedInkColor?.name || 'black',
        textContent: studioPreviewText || undefined,
        businessType: user?.businessType || undefined,
      });
      const d = await r.json();
      if (d.success && d.alternatives) {
        setAlternativeUrls(d.alternatives.map((a: any) => a.imageUrl));
        toast({ title: `\u2705 \u062a\u0645 \u062a\u0648\u0644\u064a\u062f ${d.alternatives.length} \u062a\u0635\u0627\u0645\u064a\u0645 \u0628\u062f\u064a\u0644\u0629` });
      } else {
        toast({ title: d.error || "\u0641\u0634\u0644 \u0641\u064a \u0627\u0644\u062a\u0635\u0627\u0645\u064a\u0645 \u0627\u0644\u0628\u062f\u064a\u0644\u0629", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: e?.message || "\u0641\u0634\u0644 \u0641\u064a \u0627\u0644\u062a\u0635\u0627\u0645\u064a\u0645 \u0627\u0644\u0628\u062f\u064a\u0644\u0629", variant: "destructive" });
    } finally {
      setAltLoading(false);
    }
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

  // ── منتجات مشابهة: كامل القائمة (نفس التصنيف أولاً، ثم نكمل بالأعلى مبيعاً) ──
  // عرض بـ Infinite Scroll بدل slice ثابت
  const relatedProducts = useMemo(() => {
    if (!product || !allProducts.length) return [] as typeof allProducts;
    const sameCategory = allProducts.filter(p => p.id !== product.id && p.categoryId === product.categoryId);
    // إذا كان عدد المنتجات في نفس التصنيف قليل، نُكمل من باقي المنتجات
    if (sameCategory.length >= 12) return sameCategory;
    const otherIds = new Set([product.id, ...sameCategory.map(p => p.id)]);
    const fillers = allProducts.filter(p => !otherIds.has(p.id));
    return [...sameCategory, ...fillers];
  }, [product, allProducts]);

  // عرض تدريجي: 12 ثم +12 عند الوصول للأسفل (Infinite Scroll)
  const [relatedShown, setRelatedShown] = useState(12);
  useEffect(() => { setRelatedShown(12); }, [product?.id]);
  const relatedSentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!relatedSentinelRef.current) return;
    if (relatedShown >= relatedProducts.length) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        setRelatedShown(s => Math.min(s + 12, relatedProducts.length));
      }
    }, { rootMargin: "300px" });
    obs.observe(relatedSentinelRef.current);
    return () => obs.disconnect();
  }, [relatedShown, relatedProducts.length]);

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
                        <button
                          type="button"
                          onClick={() => { setZoomScale(1); setZoomOpen(true); }}
                          className="w-full h-full cursor-zoom-in"
                          aria-label="تكبير الصورة"
                          data-testid={`button-zoom-image-${idx}`}
                        >
                          <LazyImage src={img} alt={`${product.name} ${idx + 1}`}
                            className={`w-full h-full ${imgMode === 'cover' ? 'object-cover' : 'object-contain'}`} />
                        </button>
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
                <button
                  type="button"
                  onClick={() => { setZoomScale(1); setZoomOpen(true); }}
                  className="w-full h-full cursor-zoom-in"
                  aria-label="تكبير الصورة"
                  data-testid="button-zoom-image-single"
                >
                  <LazyImage src={stableMainImageUrl || effectiveMainImageUrl} alt={product.name}
                    className={`w-full h-full transition-opacity duration-200 ${imageTransitioning ? 'opacity-70' : 'opacity-100'} ${imgMode === 'cover' ? 'object-cover' : 'object-contain'}`} />
                </button>
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
            {/* ── Phase 3: مؤشر تحميل لون Cloudinary الجديد (shimmer overlay) ── */}
            {imageTransitioning && (
              <div
                className="absolute left-0 right-0 top-0 z-[6] flex items-center justify-center bg-white/30 dark:bg-black/20 backdrop-blur-[1px] pointer-events-none"
                style={{ height: imgH }}
                data-testid="overlay-image-transitioning"
              >
                <div className="bg-white/90 dark:bg-gray-900/90 rounded-full px-3 py-1.5 shadow-md flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-[11px] font-semibold text-sky-700 dark:text-sky-300">جارٍ تطبيق اللون…</span>
                </div>
              </div>
            )}
            {/* ── Phase 2 UX: عدّاد المعاينة فوق الصورة (مُقيّد بارتفاع الصورة فقط) */}
            {previewPhase === 'countdown' && uploadedDesignUrl && (
              <div
                className="absolute left-0 right-0 top-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none"
                style={{ height: imgH }}
                data-testid="overlay-preview-countdown"
              >
                <div className="text-white text-center">
                  <div className="text-7xl font-black mb-2 animate-pulse" data-testid="text-preview-countdown">{previewCountdown}</div>
                  <div className="text-sm">جارٍ تجهيز المعاينة الفورية…</div>
                </div>
              </div>
            )}
            {/* ── Phase 2 UX: شعار العميل مرسوم على الصورة الرئيسية (مُقيّد بارتفاع الصورة) */}
            {previewPhase === 'active' && uploadedDesignUrl && logoPosition && (
              <div
                ref={mainPreviewContainerRef}
                className="absolute left-0 right-0 top-0 z-[5]"
                style={{ touchAction: 'none', height: imgH }}
                data-testid="container-main-image-preview"
              >
                <img
                  src={uploadedDesignUrl}
                  alt="logo preview"
                  className="absolute pointer-events-none select-none"
                  style={{
                    left: `${logoPosition.x}%`,
                    top: `${logoPosition.y}%`,
                    width: `${logoPosition.width}%`,
                    height: `${logoPosition.height}%`,
                    objectFit: 'contain',
                  }}
                  data-testid="img-logo-on-main"
                />
                <div
                  className="absolute cursor-move border-2 border-dashed border-purple-500/80 hover:border-purple-600 transition-colors rounded-md"
                  style={{
                    left: `${logoPosition.x}%`,
                    top: `${logoPosition.y}%`,
                    width: `${logoPosition.width}%`,
                    height: `${logoPosition.height}%`,
                  }}
                  onPointerDown={handleMainPreviewPointerDown}
                  onPointerMove={handleMainPreviewPointerMove}
                  onPointerUp={handleMainPreviewPointerUp}
                  onPointerCancel={handleMainPreviewPointerUp}
                  data-testid="drag-main-logo-overlay"
                />
                <div className="absolute bottom-2 right-2 bg-purple-600 text-white text-[10px] px-2 py-1 rounded-full shadow-lg pointer-events-none">
                  ✋ اسحب الشعار لتغيير موضعه
                </div>
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

        // ── Rating + Sales (SHEIN-style، يسار السعر) ───────────────────────
        const ratingVal = Number(product.rating || 5).toFixed(1);
        const reviewCount = product.reviewCount || 0;
        const soldCount = (product as any).soldCount || 0;
        const showRating = sec["rating"]?.visible !== false && sadeemShowRating;
        const showSold = sec["rating"]?.visible !== false && sadeemShowSoldCount && soldCount > 0;
        // تنسيق المبيعات بأسلوب SHEIN: 1500 → +1.5k، 12000 → +12k، 1000000 → +1m
        const formatSold = (n: number) => {
          if (n >= 1_000_000) return `+${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}m`;
          if (n >= 1_000) return `+${(n / 1_000).toFixed(n % 1_000 === 0 || n >= 10_000 ? 0 : 1)}k`;
          return `+${n}`;
        };

        return (
          <div key="price" className="px-4 pt-3" data-testid="section-price">
            {/* سطر واحد: السعر الجديد + شارة الخصم + السعر القديم مشطوب + التقييم يساراً */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`font-extrabold leading-none price-num ${
                  hasDiscount ? 'text-red-600 dark:text-red-500' : 'text-gray-900 dark:text-white'
                }`}
                style={{ fontSize: priceFontSize, fontFamily: 'var(--font-numbers)' }}
                data-testid="text-product-price" data-price="true">
                {formatPrice(displayedPrice)}
              </span>
              <span className="text-base text-muted-foreground font-medium">{currLabel}</span>
              {showSmartVariants && smartVariantPrice?.label && (
                <span className="text-[11px] bg-gray-100 dark:bg-gray-700 text-muted-foreground px-2 py-0.5 rounded-full border">
                  {smartVariantPrice.label}
                </span>
              )}
              {sadeemShowDiscountBadge && effectiveDiscount > 0 && (
                <Badge className="text-xs px-2 py-0.5 font-bold rounded-md" style={{ background: 'var(--discount-badge-bg,#ef4444)', color:'white' }}
                  data-testid="badge-discount">
                  -{effectiveDiscount}%
                </Badge>
              )}
              {isMarketerLink && (
                <Badge className="text-xs px-2 py-0.5 bg-purple-600 text-white rounded-md">-{sadeemMarketerDiscount}%</Badge>
              )}
              {(() => {
                // ✅ المنطق الصحيح للسعر المشطوب (السعر قبل الخصم)
                // المشكلة السابقة: كان يعرض currentPrice (السعر بعد الخصم) كسعر أصلي مشطوب
                let oldPrice: number | null = null;

                // أ) رابط مسوّق: السعر المشطوب هو السعر العادي قبل خصم المسوّق
                if (isMarketerLink) {
                  oldPrice = Number(currentPrice);
                }
                // ب) خيار ذكي مختار له خصم خاص → احسب السعر الأصلي رياضياً
                else if (selectedSmartV && Number(selectedSmartV.discount || 0) > 0 && sadeemShowOldPrice) {
                  const d = Number(selectedSmartV.discount);
                  if (d > 0 && d < 100) {
                    oldPrice = Math.round(Number(currentPrice) / (1 - d / 100));
                  }
                }
                // ج) منتج عادي بخصم → استخدم originalPrice إن وُجد، وإلا احسب من نسبة الخصم
                else if (sadeemShowOldPrice && effectiveDiscount > 0) {
                  const op = (product as any)?.originalPrice;
                  const opSar = (product as any)?.originalPriceSar;
                  if (op && Number(op) > Number(currentPrice)) {
                    oldPrice = currency === 'SAR' && opSar ? Number(opSar) : Number(op);
                  } else if (effectiveDiscount > 0 && effectiveDiscount < 100) {
                    oldPrice = Math.round(Number(currentPrice) / (1 - effectiveDiscount / 100));
                  }
                }

                // تأكّد أن السعر القديم أعلى فعلاً من السعر المعروض (تجنّب عرض خاطئ)
                if (!oldPrice || oldPrice <= Number(displayedPrice)) return null;
                return (
                  <span className="text-muted-foreground line-through text-sm" data-testid="text-original-price">
                    {formatPrice(oldPrice)} {currLabel}
                  </span>
                );
              })()}
              {/* ⭐ التقييم والمبيعات — يسار السعر (SHEIN-style) */}
              {(showRating || showSold) && (
                <button
                  type="button"
                  onClick={() => {
                    document.getElementById("reviews-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    setOpenReviewsCol(true);
                  }}
                  className="mr-auto flex items-center gap-1.5 hover-elevate active-elevate-2 rounded-md px-1.5 py-0.5 transition cursor-pointer"
                  data-testid="link-rating-summary"
                >
                  {showRating && (
                    <span className="flex items-center gap-1" data-testid="text-product-rating">
                      <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                      <span className="text-sm font-bold text-foreground">{ratingVal}</span>
                      {reviewCount > 0 && (
                        <span className="text-xs text-muted-foreground">({reviewCount})</span>
                      )}
                    </span>
                  )}
                  {showSold && (
                    <>
                      {showRating && <span className="text-muted-foreground text-xs">·</span>}
                      <span className="text-xs text-muted-foreground font-medium" data-testid="text-product-sold">
                        {formatSold(soldCount)} مبيعات
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>
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

      // ── TITLE — الاسم فقط (التقييم انتقل إلى يسار السعر) ──────────────────
      case "title": {
        if (!sec["title"]?.visible) return null;
        const titleFontSize = s.fontSize ?? 15;
        return (
          <div key="title" className="px-4 pt-2" data-testid="section-title">
            <h1
              className="font-bold leading-snug text-foreground line-clamp-2"
              style={{ fontSize: titleFontSize }}
              data-testid="text-product-name"
            >
              {product.name}
            </h1>
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

            {/* ── Smart Variants (SHEIN style) — تستخدم إعدادات العرض الموحدة ── */}
            {showSmartVariants && smartVariantsData && (
              <div className="space-y-4">
                {smartVariantsData.activeTypes.map(type => {
                  const typeVariants = smartVariantsData.variants.filter(v => v.type === type && v.label);
                  if (!typeVariants.length) return null;
                  const selectedId = selectedSmartVariant[type];
                  const selectedLabel = selectedId ? typeVariants.find(v => v.id === selectedId)?.label : null;
                  const isColorOrImage = type === 'color' || type === 'image';
                  // ── إعدادات التخطيط حسب نوع الخيار ──
                  const colorGridClass = pdpColorLayout === 'grid2'
                    ? 'grid grid-cols-2 gap-2'
                    : pdpColorLayout === 'grid3'
                      ? 'grid grid-cols-3 gap-2'
                      : 'flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1';
                  const sizeGridClass =
                    pdpSizeLayout === 'vertical' ? 'flex flex-col gap-2' :
                    pdpSizeLayout === 'row'      ? 'flex flex-row gap-2 overflow-x-auto pb-1 scrollbar-hide' :
                    pdpSizeLayout === 'grid2'    ? 'grid grid-cols-2 gap-2' :
                    'flex flex-wrap gap-2';
                  const sizeRadius =
                    pdpSizeStyle === 'pill'   ? 'rounded-full' :
                    pdpSizeStyle === 'square' ? 'rounded-md' :
                    pdpSizeStyle === 'full'   ? 'rounded-lg' :
                    'rounded-xl';
                  return (
                    <div key={type}>
                      {/* Label SHEIN-style */}
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <span className="text-sm font-semibold">{SMART_V_LABELS[type]}:</span>
                        {selectedLabel && <span className="text-sm text-muted-foreground">{selectedLabel}</span>}
                        <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground mr-auto" />
                      </div>
                      {/* Color/Image → thumbnails بأبعاد قابلة للتحكم */}
                      {isColorOrImage ? (
                        <div className={colorGridClass}>
                          {typeVariants.map(v => {
                            const isSelected = selectedSmartVariant[type] === v.id;
                            return (
                              <button key={v.id}
                                onClick={() => { setLastClickedType(type); setSelectedSmartVariant(p => ({ ...p, [type]: v.id })); if (v.imageUrl) setVariantActiveImg(v.imageUrl); }}
                                className={`relative shrink-0 rounded-xl overflow-hidden border-2 transition-all ${isSelected ? 'border-primary shadow-md scale-105' : 'border-gray-200 hover:border-gray-400'}`}
                                style={{ width: pdpColorThumbnailW, height: pdpColorThumbnailH }}
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
                      ) : type === 'preview' ? (
                        /* Preview → بطاقة خاصة (رسوم إضافية) */
                        <div className={sizeGridClass}>
                          {typeVariants.map(v => {
                            const isSelected = selectedSmartVariant[type] === v.id;
                            const priceNum = Number(currency === 'SAR' && v.priceSar ? v.priceSar : v.price || 0);
                            return (
                              <button key={v.id}
                                onClick={() => { setLastClickedType(type); setSelectedSmartVariant(p => ({ ...p, [type]: isSelected ? '' : v.id })); }}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 font-bold transition-all ${isSelected ? 'border-primary bg-primary text-white shadow' : 'border-gray-300 bg-white dark:bg-gray-800 text-foreground hover:border-gray-400'}`}
                                data-testid={`button-smart-variant-${type}-${v.id}`}>
                                <span className="text-lg">🎨</span>
                                <span className="text-sm">{v.label}</span>
                                {priceNum > 0 && (
                                  <span className={`text-[10px] font-normal mr-auto ${isSelected ? 'text-white/80' : 'text-muted-foreground'}`}>
                                    +{formatPrice(priceNum)} {currLabel}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        /* Size/Weight/Strength → أزرار بأبعاد وتخطيط قابلين للتحكم */
                        <div className={sizeGridClass}>
                          {typeVariants.map(v => {
                            const isSelected = selectedSmartVariant[type] === v.id;
                            const priceNum = Number(currency === 'SAR' && v.priceSar ? v.priceSar : v.price || 0);
                            const btnStyle: React.CSSProperties = {
                              height: pdpSizeButtonH,
                              ...(pdpSizeButtonW > 0 ? { width: pdpSizeButtonW } : { minWidth: 64 }),
                              ...(pdpSizeLayout === 'vertical' ? { width: '100%' } : {}),
                            };
                            return (
                              <button key={v.id}
                                onClick={() => { setLastClickedType(type); setSelectedSmartVariant(p => ({ ...p, [type]: v.id })); }}
                                style={btnStyle}
                                className={`flex flex-col items-center justify-center px-3 py-2 ${sizeRadius} border-2 font-bold transition-all ${isSelected ? 'border-primary bg-primary text-white shadow' : 'border-gray-300 bg-white dark:bg-gray-800 text-foreground hover:border-gray-400'}`}
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

                {/* ── Quantity Tiers — داخل قسم الخيارات الذكية ── */}
                {showQuantityTiers && quantityTiers.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-sm font-semibold">📦 الكمية:</span>
                      <span className="text-xs font-bold text-cyan-600">{selectedTier?.qty || quantity} قطعة</span>
                    </div>
                    <div className="flex gap-2">
                      {quantityTiers.map((t) => {
                        const active = (selectedTier || quantityTiers[0]).qty === t.qty;
                        return (
                          <button
                            key={t.qty}
                            onClick={() => { setSelectedTier(t); setQuantity(t.qty); }}
                            className={`flex-1 border-2 rounded-xl p-2.5 text-center transition-all bg-white ${
                              active ? "border-cyan-500 bg-cyan-50 shadow-md" : "border-gray-200 hover:border-gray-300"
                            }`}
                            data-testid={`button-tier-smart-${t.qty}`}
                          >
                            <div className="font-extrabold text-base">{t.qty}</div>
                            <div className="text-[11px] text-gray-500 -mt-0.5">قطعة</div>
                            <div className={`inline-block text-[10px] px-2 py-0.5 rounded-full mt-1 ${active ? "bg-cyan-500 text-white" : "bg-gray-100 text-gray-600"}`}>
                              {t.unitPrice} ر/قطعة
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Volume Offers — داخل قسم الخيارات الذكية ── */}
                {(() => {
                  const hasOffers = sortedOffers.length > 0;
                  if (!hasOffers) return null;
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-sm font-semibold">🔥 عروض الكمية:</span>
                        {activeOffer && (
                          <span className="text-xs font-bold text-orange-600">
                            {activeOffer.displayLabel || `سعر ${activeOffer.offerPriceYer} ر.ي`}
                          </span>
                        )}
                      </div>
                      {activeOffer && (
                        <div className="rounded-xl border-2 border-orange-400 bg-gradient-to-l from-orange-50 to-amber-50 p-3 shadow-sm mb-2" data-testid="banner-active-offer-smart">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            {activeOffer.badgeText && (
                              <Badge className="bg-orange-500 text-white text-xs animate-pulse">🔥 {activeOffer.badgeText}</Badge>
                            )}
                            {activeOffer.hasFreeShipping && (
                              <Badge className="bg-green-500 text-white text-xs">🚚 شحن مجاني</Badge>
                            )}
                          </div>
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-xl font-bold text-orange-600">{formatPrice(activeOffer.offerPriceYer)} ر.ي / قطعة</span>
                            {activeOffer.originalPriceYer && activeOffer.originalPriceYer > activeOffer.offerPriceYer && (
                              <span className="text-sm line-through text-gray-400">{formatPrice(activeOffer.originalPriceYer)} ر.ي</span>
                            )}
                          </div>
                        </div>
                      )}
                      {nextOffer && (nextOffer.minQuantity - (activeOffer?.maxQuantity ?? 0)) > 0 && (
                        <div className="rounded-xl border border-blue-300 bg-blue-50 p-2 text-xs text-blue-900">
                          أضِف {nextOffer.minQuantity - quantity} قطعة للحصول على سعر <strong>{formatPrice(nextOffer.offerPriceYer)} ر.ي</strong>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ── الألوان من colorImages — صور مصغرة بأبعاد وتخطيط قابل للتحكم ── */}
            {!showSmartVariants && colorImages.length > 0 && (() => {
              const colorGridClass = pdpColorLayout === 'grid2'
                ? 'grid grid-cols-2 gap-2'
                : pdpColorLayout === 'grid3'
                  ? 'grid grid-cols-3 gap-2'
                  : 'flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1';
              const colorContent = (
                <div className={colorGridClass}>
                  {colorImages.map((ci, i) => (
                    <button key={i}
                      onClick={() => { setSelectedColor(ci.color); if (ci.imageUrl) setVariantActiveImg(ci.imageUrl); }}
                      className={`relative shrink-0 rounded-xl overflow-hidden border-2 transition-all ${selectedColor === ci.color ? 'border-primary shadow-md scale-105' : 'border-gray-200 hover:border-gray-400'}`}
                      style={{ width: pdpColorThumbnailW, height: pdpColorThumbnailH }}
                      title={ci.color} data-testid={`button-color-img-${i}`}>
                      {ci.imageUrl
                        ? <img src={ci.imageUrl} alt={ci.color} className="w-full h-full object-cover" />
                        : <div className="w-full h-full" style={{ background: ci.hex || '#ccc' }} />
                      }
                      <span className="absolute bottom-0 inset-x-0 bg-black/40 text-white text-[9px] text-center py-0.5 leading-tight">{ci.color}</span>
                    </button>
                  ))}
                </div>
              );
              return (
                <PdpCollapsible
                  label="لون:" value={selectedColor ?? colorImages[0]?.color}
                  collapsible={pdpColorCollapsible}
                >
                  {colorContent}
                </PdpCollapsible>
              );
            })()}

            {/* ── الألوان العادية (hex/dot) — دوائر بأبعاد وتخطيط قابل للتحكم ── */}
            {!showSmartVariants && colorImages.length === 0 && availableColors.length > 0 && (() => {
              const dotGrid = pdpColorLayout === 'grid2'
                ? 'grid grid-cols-4 gap-2'
                : pdpColorLayout === 'grid3'
                  ? 'grid grid-cols-5 gap-2'
                  : 'flex gap-3 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1';
              const colorContent = (
                <div className={dotGrid}>
                  {availableColors.map(c => (
                    <button key={c}
                      onClick={() => setSelectedColor(c)}
                      className="flex flex-col items-center gap-1 shrink-0 transition-all"
                      data-testid={`button-color-${c}`}>
                      <div
                        className={`rounded-xl border-2 transition-all ${selectedColor === c ? 'border-primary shadow-md scale-105' : 'border-gray-200 hover:border-gray-400'}`}
                        style={{
                          backgroundColor: getColorCode(c),
                          width: pdpColorThumbnailW,
                          height: pdpColorThumbnailH,
                        }}
                      />
                      <span className="text-[10px] font-medium text-muted-foreground leading-tight text-center max-w-[56px] truncate">{c}</span>
                    </button>
                  ))}
                </div>
              );
              return (
                <PdpCollapsible
                  label="لون:" value={selectedColor ?? availableColors[0]}
                  collapsible={pdpColorCollapsible}
                >
                  {colorContent}
                </PdpCollapsible>
              );
            })()}

            {/* ── المقاسات مع سعر — أبعاد وتخطيط وشكل قابل للتحكم ── */}
            {!showSmartVariants && sizePricing.length > 0 && (() => {
              const sizeGridClass =
                pdpSizeLayout === 'vertical' ? 'flex flex-col gap-2' :
                pdpSizeLayout === 'row'      ? 'flex flex-row gap-2 overflow-x-auto pb-1 scrollbar-hide' :
                pdpSizeLayout === 'grid2'    ? 'grid grid-cols-2 gap-2' :
                'flex flex-wrap gap-2';
              const radius =
                pdpSizeStyle === 'pill'   ? 'rounded-full' :
                pdpSizeStyle === 'square' ? 'rounded-md' :
                'rounded-xl';
              const sizeContent = (
                <div className={sizeGridClass}>
                  {sizePricing.map(sp => {
                    const isSelected = selectedSize === sp.size;
                    const btnStyle: React.CSSProperties = {
                      height: pdpSizeButtonH,
                      ...(pdpSizeButtonW > 0 ? { width: pdpSizeButtonW } : { minWidth: 64 }),
                      ...(pdpSizeLayout === 'vertical' ? { width: '100%' } : {}),
                    };
                    return (
                      <button key={sp.size} onClick={() => setSelectedSize(sp.size)}
                        style={btnStyle}
                        className={`flex flex-col items-center justify-center px-3 border-2 font-bold transition-all ${radius} ${isSelected ? 'border-primary bg-primary text-white shadow' : 'border-gray-300 bg-white dark:bg-gray-800 text-foreground hover:border-gray-400'}`}
                        data-testid={`button-size-${sp.size}`}>
                        <span className="text-sm leading-tight">{sp.size}</span>
                        {pdpSizeShowPrice && (
                          <span className={`text-[10px] font-normal mt-0.5 ${isSelected ? 'text-white/80' : 'text-muted-foreground'}`}>
                            {formatPrice(currency === 'SAR' && sp.priceSar ? sp.priceSar : sp.price)} {currLabel}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
              return (
                <PdpCollapsible
                  label="مقاس:" value={selectedSize ?? 'اختر مقاساً'}
                  collapsible={pdpSizeCollapsible}
                >
                  {sizeContent}
                </PdpCollapsible>
              );
            })()}

            {/* ── مقاسات بدون سعر — أبعاد وتخطيط وشكل قابل للتحكم ── */}
            {!showSmartVariants && sizes.length > 0 && sizePricing.length === 0 && (() => {
              const sizeGridClass =
                pdpSizeLayout === 'vertical' ? 'flex flex-col gap-2' :
                pdpSizeLayout === 'row'      ? 'flex flex-row gap-2 overflow-x-auto pb-1 scrollbar-hide' :
                pdpSizeLayout === 'grid2'    ? 'grid grid-cols-2 gap-2' :
                'flex flex-wrap gap-2';
              const radius =
                pdpSizeStyle === 'pill'   ? 'rounded-full' :
                pdpSizeStyle === 'square' ? 'rounded-md' :
                'rounded-xl';
              const sizeContent = (
                <div className={sizeGridClass}>
                  {sizes.map(sz => {
                    const isSelected = selectedSize === sz;
                    const btnStyle: React.CSSProperties = {
                      height: pdpSizeButtonH,
                      ...(pdpSizeButtonW > 0 ? { width: pdpSizeButtonW } : { minWidth: 64 }),
                      ...(pdpSizeLayout === 'vertical' ? { width: '100%' } : {}),
                    };
                    return (
                      <button key={sz} onClick={() => setSelectedSize(sz)}
                        style={btnStyle}
                        className={`flex items-center justify-center px-4 border-2 text-sm font-bold transition-all ${radius} ${isSelected ? 'border-primary bg-primary text-white shadow' : 'border-gray-300 bg-white dark:bg-gray-800 text-foreground hover:border-gray-400'}`}
                        data-testid={`button-size-${sz}`}>{sz}
                      </button>
                    );
                  })}
                </div>
              );
              return (
                <PdpCollapsible
                  label="مقاس:" value={selectedSize ?? 'الافتراضي'}
                  collapsible={pdpSizeCollapsible}
                >
                  {sizeContent}
                </PdpCollapsible>
              );
            })()}
          </div>
        );
      }

      // ── VOLUME OFFERS (May 17, 2026) — Anchor / Progress / Badge / Tiers ─
      case "volume-offers":
      case "bulk": {
        // إذا كانت الخيارات الذكية مُفعّلة، تُعرض عروض الكمية داخل قسم variants الموحد
        if (showSmartVariants) return null;
        // نُدمج عرض العروض التحفيزية مع قسم bulk القديم — لو الاثنان فارغان، لا شيء يُرسم
        const hasOffers = sortedOffers.length > 0;
        const hasBulk = sec["bulk"]?.visible && bulkPricing.length > 0;
        if (!hasOffers && !hasBulk) return null;

        // حساب نسبة التقدّم نحو العرض التالي
        let progressPct = 0;
        let remaining = 0;
        if (nextOffer && quantity < nextOffer.minQuantity) {
          const prevAnchor = activeOffer?.maxQuantity ?? activeOffer?.minQuantity ?? 0;
          const span = Math.max(1, nextOffer.minQuantity - prevAnchor);
          progressPct = Math.min(100, Math.round(((quantity - prevAnchor) / span) * 100));
          remaining = nextOffer.minQuantity - quantity;
        } else if (activeOffer) {
          progressPct = 100;
        }

        return (
          <div key="bulk" className="px-4 space-y-3" data-testid="section-volume-offers">
            {/* ── Active Offer Banner (Anchor + Badge) ── */}
            {activeOffer && (
              <div className="rounded-xl border-2 border-orange-400 bg-gradient-to-l from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/40 p-3 shadow-sm" data-testid={`banner-active-offer-${activeOffer.id}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {activeOffer.badgeText && (
                      <Badge className="bg-orange-500 text-white text-xs animate-pulse" data-testid="badge-offer">
                        🔥 {activeOffer.badgeText}
                      </Badge>
                    )}
                    {activeOffer.hasFreeShipping && (
                      <Badge className="bg-green-500 text-white text-xs">🚚 شحن مجاني</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-2xl font-bold text-orange-600 dark:text-orange-400" data-testid="text-offer-price">
                    {formatPrice(activeOffer.offerPriceYer)} ر.ي / قطعة
                  </span>
                  {activeOffer.originalPriceYer && activeOffer.originalPriceYer > activeOffer.offerPriceYer && (
                    <>
                      <span className="text-sm line-through text-gray-400" data-testid="text-anchor-price">
                        {formatPrice(activeOffer.originalPriceYer)} ر.ي
                      </span>
                      <Badge variant="destructive" className="text-xs">
                        -{Math.round(((activeOffer.originalPriceYer - activeOffer.offerPriceYer) / activeOffer.originalPriceYer) * 100)}%
                      </Badge>
                    </>
                  )}
                </div>
                {activeOffer.displayLabel && (
                  <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">{activeOffer.displayLabel}</p>
                )}
              </div>
            )}

            {/* ── Progress to Next Offer ── */}
            {nextOffer && remaining > 0 && (
              <div className="rounded-xl border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30 p-3" data-testid="banner-next-offer">
                <div className="flex items-center justify-between text-xs mb-2 text-blue-900 dark:text-blue-100">
                  <span>أضِف {remaining} قطعة فقط للحصول على سعر <strong>{formatPrice(nextOffer.offerPriceYer)} ر.ي</strong></span>
                  <span className="font-bold">{progressPct}%</span>
                </div>
                <div className="h-2 bg-blue-200 dark:bg-blue-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-l from-blue-500 to-blue-600 transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                    data-testid="progress-next-offer"
                  />
                </div>
              </div>
            )}

            {/* ── All Tiers Grid (clickable to set quantity) ── */}
            {hasOffers && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                <p className="text-sm font-bold text-primary mb-2">🎯 عروض الكمية</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {sortedOffers.map(o => {
                    const isActive = activeOffer?.id === o.id;
                    return (
                      <button
                        key={o.id}
                        onClick={() => setQuantity(Math.max(o.minQuantity, 1))}
                        className={`text-right rounded-lg border p-2 transition-all ${isActive
                          ? "border-orange-500 bg-orange-100 dark:bg-orange-950/50 shadow-md"
                          : "border-gray-200 dark:border-gray-700 hover:border-primary"}`}
                        data-testid={`button-tier-${o.id}`}
                      >
                        <div className="text-xs font-bold">
                          {o.minQuantity}{o.maxQuantity ? `–${o.maxQuantity}` : "+"} قطعة
                        </div>
                        <div className="text-sm font-bold text-orange-600">
                          {formatPrice(o.offerPriceYer)} ر.ي
                        </div>
                        {o.badgeText && <div className="text-[10px] text-orange-700 dark:text-orange-400 mt-0.5">{o.badgeText}</div>}
                        {o.hasFreeShipping && <div className="text-[10px] text-green-700 dark:text-green-400">🚚 مجاني</div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Legacy bulk pricing badges (if any) ── */}
            {hasBulk && !hasOffers && (
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
            )}
          </div>
        );
      }

      // ── BULK PRICING (legacy — احتُفظ بـ case قديم خاطئ سيُتجاوز فعلياً للـ case أعلاه) ──
      case "bulk-legacy-disabled": {
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
        // إذا كانت الخيارات الذكية مُفعّلة، تُعرض كميات التيير داخل قسم variants الموحد
        if (showSmartVariants) return null;
        if (!sec["quantity"]?.visible) return null;
        // ── Quantity Tiers (اختر الكمية) ──
        if (showQuantityTiers && quantityTiers.length > 0) {
          const chosen = selectedTier || quantityTiers[0];
          return (
            <div key="quantity" className="px-4 space-y-3" data-testid="section-quantity">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-sm">📦 اختر الكمية:</Label>
                <span className="text-xs font-bold text-cyan-600">كمية: {chosen.qty} قطعة</span>
              </div>
              <div className="flex gap-2">
                {quantityTiers.map((t) => {
                  const active = (selectedTier || quantityTiers[0]).qty === t.qty;
                  return (
                    <button
                      key={t.qty}
                      onClick={() => { setSelectedTier(t); setQuantity(t.qty); }}
                      className={`flex-1 border-2 rounded-xl p-2.5 text-center transition-all bg-white ${
                        active
                          ? "border-cyan-500 bg-cyan-50 shadow-md"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                      data-testid={`button-tier-${t.qty}`}
                    >
                      <div className="font-extrabold text-base">{t.qty}</div>
                      <div className="text-[11px] text-gray-500 -mt-0.5">قطعة</div>
                      <div className={`inline-block text-[10px] px-2 py-0.5 rounded-full mt-1 ${
                        active ? "bg-cyan-500 text-white" : "bg-gray-100 text-gray-600"
                      }`}>
                        {t.unitPrice} ر/قطعة
                      </div>
                      <div className="text-[11px] font-bold text-gray-700 mt-1">
                        {t.totalPrice} ر.ي
                      </div>
                    </button>
                  );
                })}
              </div>
              {selectedTier?.costPrice && selectedTier?.costPrice > 0 && (
                <div className="text-[11px] text-muted-foreground">
                  ربح المؤسسة: {selectedTier.totalPrice - selectedTier.costPrice} ر.ي (تكلفة الشراء {selectedTier.costPrice} ر.ي)
                </div>
              )}
            </div>
          );
        }
        // Legacy simple quantity input
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
        // قسم رفع التصميم يكفي تفعيل allowDesignUpload فقط — showLivePreview تتحكم في Canvas فقط داخله
        const hasDesignUpload = !!product.allowDesignUpload;
        // لون الكيس عبر Cloudinary خاص بالمنتجات القابلة للتخصيص
        const isCustomizableProduct = ((product as any).productType ?? "ready") === "customizable";
        const cloudBagColors = ((product as any).availableColors || []) as Array<{id:string;name:string;code:string}>;
        const hasCloudBagColors = isCustomizableProduct && cloudBagColors.length > 0 && !!(product as any).baseImagePublicId && !!(product as any).cloudinaryCloudName;
        if (!hasBagPrinting && !hasProfPrinting && !hasDesignUpload && !hasCloudBagColors) return null;

        return (
          <div key="printing" className="px-4 space-y-3" data-testid="section-printing">

            {/* ════════ Phase 2 UX: لوحة الطباعة البسيطة الجديدة ════════ */}
            {hasDesignUpload && (
              <div className="rounded-2xl border-2 border-purple-300 dark:border-purple-700 bg-gradient-to-br from-purple-50 via-white to-pink-50 dark:from-purple-950/30 dark:via-gray-900 dark:to-pink-950/30 p-4 space-y-3 shadow-sm" data-testid="section-quick-print">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🖨️</span>
                  <div>
                    <h3 className="font-extrabold text-sm">طباعة شعارك على المنتج</h3>
                    <p className="text-[11px] text-muted-foreground">ارفع شعارك وشاهد المعاينة الفورية مباشرة على المنتج</p>
                  </div>
                </div>

                {/* الزر الأساسي — يظهر فقط قبل بدء الرفع */}
                {!showUploadZone && !uploadedDesignUrl && (
                  <Button
                    size="lg"
                    onClick={() => { setShowUploadZone(true); setTimeout(() => fileInputRef.current?.click(), 100); }}
                    className="w-full h-14 text-base font-extrabold bg-gradient-to-l from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg shadow-purple-500/30 rounded-xl"
                    data-testid="button-start-preview">
                    📸 اضغط هنا للمعاينة الفورية
                  </Button>
                )}

                {/* منطقة الرفع */}
                {(showUploadZone || uploadedDesignUrl) && (
                  <div
                    className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${uploadedDesignUrl ? 'border-green-400 bg-green-50/60 dark:bg-green-950/20' : 'border-purple-400 bg-purple-50/60 dark:bg-purple-950/20 hover:border-purple-500'}`}
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="zone-design-upload">
                    <input ref={fileInputRef} type="file" accept="image/*,.pdf,.ai,.psd"
                      onChange={handleDesignUpload} className="hidden" data-testid="input-design-upload" />
                    {isUploadingDesign ? (
                      <div className="flex items-center justify-center gap-2 text-purple-700 dark:text-purple-300">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="text-sm font-bold">جارٍ رفع التصميم…</span>
                      </div>
                    ) : uploadedFile ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-center gap-2 text-green-700 dark:text-green-300">
                          <Check className="h-5 w-5" />
                          <span className="text-sm font-bold truncate max-w-[200px]">{uploadedFile.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setUploadedFile(null);
                            setUploadedDesignUrl(null);
                            setPreviewPhase('idle');
                            setPreviewCountdown(3);
                            setEnableCustomPrinting(false);
                            setLogoPosition(null);
                          }}
                          className="text-[11px] text-purple-700 dark:text-purple-300 hover:underline"
                          data-testid="button-change-design">
                          تغيير التصميم
                        </button>
                      </div>
                    ) : (
                      <div className="text-purple-700 dark:text-purple-300">
                        <Upload className="h-6 w-6 mx-auto mb-1" />
                        <p className="text-sm font-bold">اضغط لرفع التصميم</p>
                        <p className="text-[10px] text-muted-foreground mt-1">PDF · PNG · JPG · AI · PSD</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── AI Studio Preview Engine (June 2026) — يظهر فقط إذا فعّل الأدمن المفتاح ── */}
                {uploadedDesignUrl && !!(product as any)?.enableStudioPreview && (
                  <div className="space-y-2">
                    {/* حقل إدخال النص مطوي */}
                    <button
                      type="button"
                      onClick={() => setShowStudioTextInput(s => !s)}
                      className="flex items-center gap-2 text-xs font-bold text-sky-700 dark:text-sky-300 hover:underline"
                      data-testid="button-toggle-studio-text">
                      <span>📝</span>
                      {showStudioTextInput ? 'إخفاء تفاصيل المتجر' : 'أضف تفاصيل المتجر (اسم / هاتف / عنوان)'}
                    </button>
                    {showStudioTextInput && (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="مثال: محل أبو علي للأسماك • 777123456 • صنعاء • توصيل للأمانة"
                          value={studioPreviewText}
                          onChange={e => setStudioPreviewText(e.target.value)}
                          rows={2}
                          className="text-xs"
                          data-testid="textarea-studio-text"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          سيتم دمج هذا النص في صورة المعاينة المولدة
                        </p>
                      </div>
                    )}

                    {/* أزرار المعاينات */}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={generateQuickPreview}
                        disabled={studioPreviewLoading}
                        className="flex-1 text-xs font-bold border-sky-300 text-sky-700 hover:bg-sky-50"
                        data-testid="button-quick-preview">
                        <Zap className="h-3.5 w-3.5 ml-1" />
                        معاينة سريعة مجانية
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={generateStudioPreview}
                        disabled={studioPreviewLoading}
                        className="flex-1 text-xs font-bold bg-gradient-to-l from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white"
                        data-testid="button-studio-preview">
                        {studioPreviewLoading ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 ml-1 animate-spin" />
                            جارٍ التوليد...
                          </>
                        ) : (
                          <>
                            <Camera className="h-3.5 w-3.5 ml-1" />
                            أنشئ معاينة الاستوديو
                          </>
                        )}
                      </Button>
                    </div>

                    {/* عرض المعاينات المولدة */}
                    {studioPreviewUrl && (
                      <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 overflow-hidden">
                        <img
                          src={studioPreviewUrl}
                          alt="معاينة الاستوديو"
                          className="w-full h-auto object-contain"
                          loading="lazy"
                          data-testid="img-studio-preview"
                        />
                        <div className="bg-indigo-50 dark:bg-indigo-950/30 p-2 text-center">
                          <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                            معاينة الاستوديو الواقعية — الوجهان أمام / خلف
                          </p>
                        </div>
                      </div>
                    )}
                    {quickPreviewUrl && !studioPreviewUrl && (
                      <div className="rounded-xl border border-sky-200 dark:border-sky-800 overflow-hidden">
                        <img
                          src={quickPreviewUrl}
                          alt="معاينة سريعة"
                          className="w-full h-auto object-contain"
                          loading="lazy"
                          data-testid="img-quick-preview"
                        />
                        <div className="bg-sky-50 dark:bg-sky-950/30 p-2 text-center">
                          <p className="text-[10px] font-bold text-sky-700 dark:text-sky-300">
                            معاينة سريعة — عرض فوري عبر Cloudinary
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 3 تصاميم بديلة */}
                    {studioPreviewUrl && (
                      <div className="space-y-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={generateAlternatives}
                          disabled={altLoading}
                          className="w-full text-xs font-bold"
                          data-testid="button-alternatives">
                          {altLoading ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 ml-1 animate-spin" />
                              جارٍ توليد البدائل...
                            </>
                          ) : (
                            <>
                              <RefreshCcw className="h-3.5 w-3.5 ml-1" />
                              أرني 3 تصاميم بديلة
                            </>
                          )}
                        </Button>
                        {alternativeUrls.length > 0 && (
                          <div className="grid grid-cols-3 gap-2">
                            {alternativeUrls.map((url, i) => (
                              <div key={i} className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <img
                                  src={url}
                                  alt={`بديل ${i + 1}`}
                                  className="w-full h-auto object-contain"
                                  loading="lazy"
                                  data-testid={`img-alternative-${i}`}
                                />
                                <div className="bg-gray-50 dark:bg-gray-900 p-1 text-center">
                                  <p className="text-[10px] font-bold text-gray-600 dark:text-gray-300">بديل {i + 1}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* شريط الحجم — يظهر بعد اكتمال المعاينة */}
                {previewPhase === 'active' && logoPosition && (
                  <div className="bg-white dark:bg-gray-900 rounded-lg border border-purple-200 dark:border-purple-800 p-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-purple-700 dark:text-purple-300">📏 حجم الشعار</span>
                      <span className="mr-auto text-xs font-bold text-purple-700 dark:text-purple-300" data-testid="text-logo-size-percent">
                        {Math.round(logoPosition.width)}%
                      </span>
                    </div>
                    <input
                      type="range" min={10} max={90} step={1}
                      value={logoPosition.width}
                      onChange={e => {
                        const newSize = Number(e.target.value);
                        setLogoPosition({
                          ...logoPosition,
                          width: newSize, height: newSize,
                          x: Math.min(logoPosition.x, 100 - newSize),
                          y: Math.min(logoPosition.y, 100 - newSize),
                        });
                      }}
                      className="w-full accent-purple-600"
                      data-testid="slider-logo-size"
                    />
                    <p className="text-[10px] text-muted-foreground text-center mt-1">✋ اسحب الشعار على الصورة لتغيير موضعه</p>
                  </div>
                )}
              </div>
            )}

            {/* ════════ Phase 2 UX: ألوان الكيس (Cloudinary + قديم) ════════ */}
            {hasCloudBagColors && (
              <div className="rounded-2xl border border-sky-300 dark:border-sky-700 bg-sky-50/60 dark:bg-sky-950/20 p-4 space-y-2" data-testid="section-bag-color-picker">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎨</span>
                  <span className="font-bold text-sm">لون الكيس</span>
                  {selectedDynamicBagColor && (
                    <span className="text-[11px] bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded-full font-semibold mr-auto flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full border border-black/20 shadow-sm" style={{ backgroundColor: selectedDynamicBagColor.code || '#ccc' }} />
                      {selectedDynamicBagColor.name}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {cloudBagColors.map((c) => {
                    const isActive = selectedDynamicBagColor?.id === c.id;
                    return (
                      <button key={c.id} type="button"
                        onClick={() => setSelectedDynamicBagColor(isActive ? null : c)}
                        title={c.name}
                        className={`relative w-10 h-10 rounded-full border-2 transition-all ${isActive ? 'border-gray-900 dark:border-white scale-110 ring-2 ring-sky-400' : 'border-gray-300 dark:border-gray-600 hover:scale-105'}`}
                        style={{ backgroundColor: c.code || '#cccccc' }}
                        data-testid={`button-bag-color-${c.id}`}>
                        {isActive && <Check className="absolute inset-0 m-auto h-4 w-4 text-white mix-blend-difference" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ════════ Phase 2 UX: لون الحبر (chips بدل text input) ════════ */}
            {hasBagPrinting && (
              <div className="rounded-2xl border border-orange-300 dark:border-orange-700 bg-orange-50/60 dark:bg-orange-950/20 p-4 space-y-2" data-testid="section-ink-color">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🖊️</span>
                  <span className="font-bold text-sm">لون الطباعة (الحبر)</span>
                  {selectedInkColor && (
                    <span className="text-[11px] bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full font-semibold mr-auto flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full border border-black/20 shadow-sm" style={{ backgroundColor: selectedInkColor.hex || '#ccc' }} />
                      {selectedInkColor.name}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {inkColorPalette.map((ink) => {
                    const isActive = selectedInkColor?.name === ink.name;
                    return (
                      <button key={ink.name} type="button"
                        onClick={() => setSelectedInkColor(isActive ? null : ink)}
                        title={ink.name}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all ${isActive ? "border-orange-500 shadow-md ring-2 ring-orange-200 dark:ring-orange-800 bg-white dark:bg-gray-900" : "border-border bg-white/80 dark:bg-gray-900/60 hover:border-orange-400"}`}
                        data-testid={`button-ink-color-${ink.name}`}>
                        <span className="w-4 h-4 rounded-full border border-black/15 shadow-sm" style={{ backgroundColor: ink.hex }} />
                        {ink.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ════════ Phase 2 UX: نصيحة التباين الذكية ════════ */}
            {smartContrastTip && (
              <div
                className={`rounded-xl p-3 text-sm font-semibold ${smartContrastTip.good
                  ? 'bg-gradient-to-l from-purple-100 to-pink-100 dark:from-purple-900/40 dark:to-pink-900/40 text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-700'
                  : 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700'}`}
                data-testid="banner-smart-contrast-tip">
                {smartContrastTip.text}
              </div>
            )}

            {/* ════════ القسم القديم — مخفي لكن محفوظ للتوافق ════════ */}
            {false && hasBagPrinting && (
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
                  <div className="border-t border-cyan-200/50 divide-y divide-gray-100 dark:divide-border">

                    {/* ══ لون الكيس ══════════════════════════════════════════ */}
                    {(product.availableBagColors || []).length > 0 && (
                      <div className="px-4 py-3 bg-sky-50/60 dark:bg-sky-950/20">
                        <div className="flex items-center gap-2 mb-2.5">
                          <div className="w-7 h-7 rounded-lg bg-sky-500 flex items-center justify-center text-white text-xs font-bold shrink-0">١</div>
                          <div>
                            <p className="text-xs font-bold text-sky-700 dark:text-sky-400">لون الكيس (خلفية)</p>
                            <p className="text-[10px] text-muted-foreground">اختر لون الكيس نفسه</p>
                          </div>
                          {selectedBagColor && (
                            <span className="mr-auto text-[10px] bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded-full font-semibold">
                              {selectedBagColor}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(product.availableBagColors || []).map((color: string) => {
                            const isSelected = selectedBagColor === color;
                            const hex = ({ أبيض:"#FFFFFF",أسود:"#1a1a1a",بيج:"#D4A574",أزرق:"#3B82F6",أحمر:"#EF4444",أخضر:"#22C55E",رمادي:"#6B7280",بني:"#92400E",وردي:"#EC4899" } as Record<string, string>)[color] || "#9CA3AF";
                            return (
                              <button key={color} onClick={() => setSelectedBagColor(isSelected ? null : color)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all ${isSelected ? "border-sky-500 shadow-md ring-2 ring-sky-200 dark:ring-sky-800" : "border-border hover:border-sky-400"}`}
                                data-testid={`bag-color-${color}`}>
                                <span className="w-4 h-4 rounded-full border border-black/15 shadow-sm" style={{ backgroundColor: hex }} />
                                {color}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* ══ لون الطباعة / الخط ════════════════════════════════ */}
                    <div className="px-4 py-3 bg-orange-50/60 dark:bg-orange-950/20">
                      <div className="flex items-center gap-2 mb-2.5">
                        <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center text-white text-xs font-bold shrink-0">٢</div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-orange-700 dark:text-orange-400">لون الطباعة / الخط (حبر)</p>
                          <p className="text-[10px] text-muted-foreground">اكتب اسم لون الحبر المطلوب للطباعة</p>
                        </div>
                        {product.singleColorPrintPrice && (
                          <span className="text-[10px] bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full font-semibold shrink-0">
                            +{formatPrice(Number(product.singleColorPrintPrice))} {currLabel}/لون
                          </span>
                        )}
                      </div>
                      <div className="space-y-2">
                        {printColors.map((color, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className="flex-1 flex items-center gap-2 bg-white dark:bg-background border border-orange-200 dark:border-orange-800 rounded-lg px-3 py-1.5">
                              <span className="text-orange-400 text-sm">🖊️</span>
                              <input
                                className="flex-1 text-sm bg-transparent outline-none"
                                value={color}
                                onChange={e => setPrintColors(prev => { const n = [...prev]; n[i] = e.target.value; return n; })}
                                placeholder={i === 0 ? "مثال: أسود، ذهبي، أحمر..." : `لون إضافي ${i + 1}`}
                                data-testid={`input-print-color-${i}`}
                              />
                            </div>
                            {i > 0 && (
                              <button onClick={() => setPrintColors(prev => prev.filter((_, j) => j !== i))}
                                className="text-destructive hover:text-destructive/70 text-lg font-bold shrink-0 w-7 h-7 flex items-center justify-center">×</button>
                            )}
                          </div>
                        ))}
                        {printColors.length < 3 && (
                          <button onClick={() => setPrintColors(prev => [...prev, ""])}
                            className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 hover:text-orange-700 font-semibold transition"
                            data-testid="add-print-color">
                            <Plus className="h-3.5 w-3.5" /> إضافة لون طباعة آخر
                          </button>
                        )}
                      </div>
                    </div>

                    {/* ══ معاينة + تكلفة ════════════════════════════════════ */}
                    {(selectedBagColor || printColors.some(c => c.trim())) && (
                      <div className="px-4 py-2.5 bg-gray-50/80 dark:bg-muted/20 flex items-center gap-3">
                        {/* معاينة بصرية */}
                        {selectedBagColor && printColors[0]?.trim() && (() => {
                          const bgHex = ({ أبيض:"#FFFFFF",أسود:"#1a1a1a",بيج:"#D4A574",أزرق:"#3B82F6",أحمر:"#EF4444",أخضر:"#22C55E",رمادي:"#6B7280",بني:"#92400E",وردي:"#EC4899" } as Record<string, string>)[selectedBagColor] || "#9CA3AF";
                          const textHex = ({ أسود:"#1a1a1a",أبيض:"#FFFFFF",ذهبي:"#D4AF37",فضي:"#C0C0C0",أحمر:"#EF4444",أزرق:"#3B82F6",أخضر:"#22C55E" } as Record<string, string>)[printColors[0].trim()] || "#1a1a1a";
                          return (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <div className="w-10 h-10 rounded-lg border border-black/10 shadow-sm flex items-center justify-center text-[9px] font-black"
                                style={{ backgroundColor: bgHex, color: textHex }}>
                                ABC
                              </div>
                              <span className="text-[10px] text-muted-foreground leading-tight">
                                كيس {selectedBagColor}<br/>+ طباعة {printColors[0]}
                              </span>
                            </div>
                          );
                        })()}
                        {/* تكلفة */}
                        {bagPrintingCost > 0 && (
                          <div className="flex-1 flex items-center justify-between">
                            <span className="text-[11px] text-muted-foreground">
                              {printColors.filter(c=>c.trim()).length} لون × {quantity} قطعة
                            </span>
                            <span className="font-bold text-primary text-sm">
                              +{formatPrice(bagPrintingCost)} {currLabel}
                            </span>
                          </div>
                        )}
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

            {/* ════════════ Phase 6 — القديم — مخفي (مُكرَّر في القسم الجديد أعلاه) ════════════ */}
            {false && Array.isArray((product as any).availableColors) && (product as any).availableColors.length > 0 && (product as any).baseImagePublicId && (product as any).cloudinaryCloudName && (
              <div className="rounded-xl border border-pink-300/50 bg-pink-50/40 dark:bg-pink-950/20 p-4 space-y-3" data-testid="section-bag-color-picker-old">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🎨</span>
                    <span className="font-bold text-sm">اختر لون الكيس</span>
                  </div>
                  {selectedDynamicBagColor && (
                    <button
                      type="button"
                      onClick={() => setSelectedDynamicBagColor(null)}
                      className="text-[11px] text-pink-700 dark:text-pink-300 hover:underline"
                      data-testid="button-reset-bag-color"
                    >
                      إعادة للون الأصلي
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {((product as any).availableColors as Array<{id:string;name:string;code:string}>).map((c) => {
                    const isActive = selectedDynamicBagColor?.id === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedDynamicBagColor(c)}
                        title={c.name}
                        className={`relative w-10 h-10 rounded-full border-2 transition-all ${isActive ? 'border-gray-900 dark:border-white scale-110 ring-2 ring-pink-400' : 'border-gray-300 dark:border-gray-600 hover:scale-105'}`}
                        style={{ backgroundColor: c.code }}
                        data-testid={`button-bag-color-${c.id}`}
                      >
                        {isActive && (
                          <Check className="absolute inset-0 m-auto h-4 w-4 text-white mix-blend-difference" />
                        )}
                      </button>
                    );
                  })}
                </div>
                {selectedDynamicBagColor && (
                  <p className="text-xs text-pink-700 dark:text-pink-300">
                    اللون المختار: <strong>{selectedDynamicBagColor.name}</strong>
                  </p>
                )}
              </div>
            )}

            {/* ════════════ رفع ملف التصميم — القديم — مخفي ════════════ */}
            {false && hasDesignUpload && (
              <div className="rounded-xl border border-blue-300/50 bg-blue-50/40 dark:bg-blue-950/20 p-4 space-y-2" data-testid="section-design-upload-old">
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

                    {/* ── Phase 5: المعاينة الفورية للطباعة ─────────────── */}
                    {uploadedDesignUrl && logoPosition && (
                      <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl p-3 mt-2" data-testid="section-live-preview">
                        <div className="font-bold text-sm text-purple-700 dark:text-purple-300 flex items-center gap-1 mb-2">
                          🎨 المعاينة الفورية — اسحب الشعار لتغيير موضعه
                        </div>
                        <div
                          ref={previewContainerRef}
                          className="relative mx-auto bg-white dark:bg-gray-900 rounded-lg overflow-hidden border border-purple-200 dark:border-purple-700"
                          style={{ width: 240, height: 240 / previewImgAspect, maxWidth: "100%", touchAction: "none" }}
                          data-testid="container-live-preview"
                        >
                          <canvas
                            ref={previewCanvasRef}
                            width={Math.round(240)}
                            height={Math.round(240 / previewImgAspect)}
                            className="block w-full h-full select-none"
                          />
                          {/* طبقة شفافة للسحب فوق الـ Canvas */}
                          <div
                            className="absolute cursor-move border-2 border-dashed border-purple-500/70 hover:border-purple-600 transition-colors"
                            style={{
                              left: `${logoPosition.x}%`,
                              top: `${logoPosition.y}%`,
                              width: `${logoPosition.width}%`,
                              height: `${logoPosition.height}%`,
                            }}
                            onPointerDown={handlePreviewPointerDown}
                            onPointerMove={handlePreviewPointerMove}
                            onPointerUp={handlePreviewPointerUp}
                            onPointerCancel={handlePreviewPointerUp}
                            data-testid="drag-logo-overlay"
                          />
                        </div>
                        {/* شريط تكبير/تصغير */}
                        <div className="mt-3 flex items-center gap-2">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">حجم الشعار</span>
                          <input
                            type="range"
                            min={10} max={90} step={1}
                            value={logoPosition.width}
                            onChange={e => {
                              const newSize = Number(e.target.value);
                              setLogoPosition({
                                ...logoPosition,
                                width: newSize,
                                height: newSize,
                                x: Math.min(logoPosition.x, 100 - newSize),
                                y: Math.min(logoPosition.y, 100 - newSize),
                              });
                            }}
                            className="flex-1 accent-purple-600"
                            data-testid="slider-logo-size"
                          />
                          <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 w-10 text-center">
                            {Math.round(logoPosition.width)}%
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1 text-center">
                          💡 اسحب الإطار البنفسجي لتغيير الموضع، واستخدم الشريط لتغيير الحجم
                        </p>
                      </div>
                    )}

                    {/* ── Phase 4: حاسبة الطباعة الفورية ─────────────── */}
                    {/* Phase 1 Simplification: مخفية للعميل — السعر مدمج في إجمالي السلة */}
                    {false && hasPhase4Pricing && (
                      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-3 space-y-3 mt-2" data-testid="section-printing-calculator">
                        <div className="font-bold text-sm text-blue-700 dark:text-blue-300 flex items-center gap-1">
                          🖨️ خيارات الطباعة
                        </div>

                        {/* عدد الألوان */}
                        {printingPricing.pricePerColor > 0 && (
                          <div className="flex items-center justify-between">
                            <Label className="text-sm">عدد الألوان</Label>
                            <div className="flex items-center gap-2">
                              <Button type="button" size="sm" variant="outline" className="h-7 w-7 p-0"
                                onClick={() => setPrintingColors(c => Math.max(1, c - 1))}
                                data-testid="button-printing-colors-minus">−</Button>
                              <span className="w-8 text-center font-bold" data-testid="text-printing-colors">{printingColors}</span>
                              <Button type="button" size="sm" variant="outline" className="h-7 w-7 p-0"
                                onClick={() => setPrintingColors(c => Math.min(10, c + 1))}
                                data-testid="button-printing-colors-plus">+</Button>
                            </div>
                          </div>
                        )}

                        {/* عدد الأوجه */}
                        {printingPricing.pricePerColor > 0 && (
                          <div className="flex items-center justify-between">
                            <Label className="text-sm">عدد الأوجه</Label>
                            <div className="flex gap-1">
                              <Button type="button" size="sm"
                                variant={printingSides === 1 ? "default" : "outline"}
                                onClick={() => setPrintingSides(1)}
                                data-testid="button-printing-sides-1">وجه واحد</Button>
                              <Button type="button" size="sm"
                                variant={printingSides === 2 ? "default" : "outline"}
                                onClick={() => setPrintingSides(2)}
                                data-testid="button-printing-sides-2">وجهان</Button>
                            </div>
                          </div>
                        )}

                        {/* تفصيل الأسعار — Phase 4 v2 */}
                        <div className="border-t border-blue-200 dark:border-blue-800 pt-2 space-y-1 text-xs">
                          {phase4PrintingBreakdown.designFee > 0 && (
                            <div className="flex justify-between" data-testid="text-design-fee">
                              <span className="text-muted-foreground">رسوم التصميم (لمرّة واحدة)</span>
                              <span className="font-semibold">{formatPrice(phase4PrintingBreakdown.designFee)} {currLabel}</span>
                            </div>
                          )}
                          {phase4PrintingBreakdown.printingPerBag > 0 && (
                            <>
                              <div className="flex justify-between" data-testid="text-printing-per-bag">
                                <span className="text-muted-foreground">
                                  طباعة/قطعة ({printingColors} لون × {printingSides} وجه × {formatPrice(printingPricing.pricePerColor)})
                                </span>
                                <span className="font-semibold">{formatPrice(phase4PrintingBreakdown.printingPerBag)} {currLabel}</span>
                              </div>
                              <div className="flex justify-between" data-testid="text-printing-total-qty">
                                <span className="text-muted-foreground">إجمالي الطباعة ({quantity} قطعة)</span>
                                <span className="font-semibold">{formatPrice(phase4PrintingBreakdown.printingTotal)} {currLabel}</span>
                              </div>
                            </>
                          )}
                          <div className="flex justify-between pt-1 border-t border-blue-200/60 dark:border-blue-800/60 text-sm">
                            <span className="font-bold text-blue-700 dark:text-blue-300">إجمالي الطباعة + التصميم</span>
                            <span className="font-bold text-blue-700 dark:text-blue-300" data-testid="text-printing-total">
                              {formatPrice(phase4PrintingBreakdown.totalPrintingCost)} {currLabel}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      }

      // ── DESCRIPTION + SPECS + REVIEWS (Phase B: Collapsibles) ─────────────
      case "description": {
        if (!sec["description"]?.visible) return null;
        const sectionBtn = "w-full flex items-center justify-between py-3 px-1 text-right";
        const sectionTitle = "text-sm font-bold text-foreground";
        const chevron = (open: boolean) => open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground" />;
        // مواصفات بسيطة من حقول المنتج
        const specs: Array<[string, string | number | null | undefined]> = [
          ["التصنيف", (product as any)?.categoryName || (product as any)?.category],
          ["الوزن", (product as any)?.weight],
          ["الأبعاد", (product as any)?.dimensions],
          ["الخامة", (product as any)?.material],
          ["البلد", (product as any)?.countryOfOrigin],
          ["الرمز (SKU)", (product as any)?.sku],
        ].filter(([, v]) => v != null && String(v).trim() !== "") as any;

        return (
          <div key="description" className="px-4 space-y-1 divide-y" data-testid="section-description">
            {/* ── الوصف ────────────────────────────────────────────── */}
            <div>
              <button onClick={() => setOpenDesc(o => !o)} className={sectionBtn} data-testid="button-toggle-description">
                <span className={sectionTitle}>📋 الوصف</span>
                {chevron(openDesc)}
              </button>
              {openDesc && (
                <div className="pb-3">
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line" data-testid="text-product-description">
                    {product.description || 'لا يوجد وصف متاح لهذا المنتج.'}
                  </p>
                </div>
              )}
            </div>

            {/* ── المواصفات ───────────────────────────────────────── */}
            {specs.length > 0 && (
              <div>
                <button onClick={() => setOpenSpecs(o => !o)} className={sectionBtn} data-testid="button-toggle-specs">
                  <span className={sectionTitle}>📐 المواصفات</span>
                  {chevron(openSpecs)}
                </button>
                {openSpecs && (
                  <div className="pb-3">
                    <dl className="text-sm divide-y border rounded-lg overflow-hidden">
                      {specs.map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between px-3 py-2" data-testid={`spec-row-${k}`}>
                          <dt className="text-muted-foreground">{k}</dt>
                          <dd className="font-medium text-foreground">{String(v)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </div>
            )}

            {/* ── التقييمات ────────────────────────────────────────── */}
            <div id="reviews-section">
              <button onClick={() => setOpenReviewsCol(o => !o)} className={sectionBtn} data-testid="button-toggle-reviews">
                <span className={sectionTitle}>⭐ التقييمات ({reviews.length})</span>
                {chevron(openReviewsCol)}
              </button>
              {openReviewsCol && (
                <div className="pb-3 space-y-4">
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
          </div>
        );
      }

      // ── REVIEWS (separate section — if reviews tab not used) ──────────────
      case "reviews": return null; // Merged into description tabs

      // ── RELATED (Phase B: Horizontal scroll carousel) ─────────────────────
      case "related": {
        if (!sec["related"]?.visible || relatedProducts.length === 0) return null;
        const shownItems = relatedProducts.slice(0, relatedShown);
        const hasMore = relatedShown < relatedProducts.length;
        return (
          <div key="related" className="pb-2" data-testid="section-related">
            <div className="px-4 flex items-center justify-between mb-3">
              <h2 className="font-bold text-base">منتجات مشابهة</h2>
              <span className="text-xs text-gray-500" data-testid="text-related-count">
                {shownItems.length} من {relatedProducts.length}
              </span>
            </div>
            <div
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 px-4"
              data-testid="grid-related"
            >
              {shownItems.map(p => {
                const op = (p as any).originalPrice;
                const opSar = (p as any).originalPriceSar;
                const hasDisc = currency === 'SAR'
                  ? (opSar && Number(opSar) > Number(p.priceSar || 0))
                  : (op && Number(op) > Number(p.price || 0));
                return (
                  <Link key={p.id} href={`/products/${p.id}`}>
                    <div
                      className="border rounded-xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer bg-white dark:bg-gray-900 h-full"
                      data-testid={`card-related-${p.id}`}
                    >
                      <div className="aspect-square bg-gray-50 dark:bg-gray-800">
                        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain p-2" loading="lazy" />
                      </div>
                      <div className="p-2">
                        <p className="font-medium text-xs line-clamp-2 mb-1 min-h-[2rem]">{p.name}</p>
                        <p className={`font-bold text-sm ${hasDisc ? 'text-red-600 dark:text-red-500' : 'text-gray-900 dark:text-white'}`}>
                          {formatPrice(currency === 'SAR' && p.priceSar ? p.priceSar : p.price)} {currLabel}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            {/* Sentinel للـ Infinite Scroll */}
            {hasMore && (
              <div
                ref={relatedSentinelRef}
                className="flex items-center justify-center py-6"
                data-testid="related-sentinel"
              >
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>جارٍ تحميل المزيد...</span>
                </div>
              </div>
            )}
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
            onClick={() => toggleWishlistMutation.mutate()}
            disabled={wishlistPending}
            className="p-2 rounded-full bg-black/25 hover:bg-black/40 backdrop-blur-sm transition-colors shrink-0"
            data-testid="button-wishlist-top">
            <Heart className={`h-5 w-5 ${inWishlist ? 'text-red-400 fill-red-400' : 'text-white'}`} />
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

      {/* ── Phase B: Image Zoom Lightbox ──────────────────────────────────── */}
      {zoomOpen && (
        <div
          className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center"
          onClick={() => setZoomOpen(false)}
          data-testid="zoom-lightbox"
        >
          {/* زر الإغلاق */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setZoomOpen(false); }}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm transition-colors"
            aria-label="إغلاق"
            data-testid="button-zoom-close"
          >
            <X className="h-6 w-6 text-white" />
          </button>

          {/* عداد الصور */}
          {allImages.length > 1 && (
            <div className="absolute top-4 left-4 z-10 bg-white/15 backdrop-blur-sm text-white text-sm px-3 py-1 rounded-full">
              {currentImageIndex + 1} / {allImages.length}
            </div>
          )}

          {/* الصورة الحالية مع zoom */}
          <div
            className="w-full h-full flex items-center justify-center overflow-auto p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={allImages[currentImageIndex] || stableMainImageUrl || effectiveMainImageUrl}
              alt={product.name}
              onClick={() => setZoomScale(s => (s >= 2.5 ? 1 : s + 0.5))}
              style={{
                transform: `scale(${zoomScale})`,
                transformOrigin: 'center center',
                transition: 'transform 200ms ease',
                cursor: zoomScale >= 2.5 ? 'zoom-out' : 'zoom-in',
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
              }}
              data-testid="img-zoom"
            />
          </div>

          {/* أسهم التنقّل */}
          {allImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setZoomScale(1); scrollPrev(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm"
                aria-label="السابق"
                data-testid="button-zoom-prev"
              >
                <ChevronRight className="h-6 w-6 text-white" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setZoomScale(1); scrollNext(); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm"
                aria-label="التالي"
                data-testid="button-zoom-next"
              >
                <ChevronLeft className="h-6 w-6 text-white" />
              </button>
            </>
          )}

          {/* شريط التحكّم بالتكبير في الأسفل */}
          <div
            className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setZoomScale(s => Math.max(1, s - 0.5))}
              className="p-1.5 text-white hover:bg-white/15 rounded-full"
              aria-label="تصغير"
              data-testid="button-zoom-out"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="text-white text-xs font-bold min-w-[42px] text-center" data-testid="text-zoom-scale">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomScale(s => Math.min(3, s + 0.5))}
              className="p-1.5 text-white hover:bg-white/15 rounded-full"
              aria-label="تكبير"
              data-testid="button-zoom-in"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
