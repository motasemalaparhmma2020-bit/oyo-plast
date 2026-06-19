import { useState, useEffect, useMemo, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Order, Product, type PrintingCategory } from "@shared/schema";
import FinancialReports from "@/components/FinancialReports";
import AdminInstallments from "@/components/AdminInstallments";
import AdminPaymentVerification from "@/components/AdminPaymentVerification";
import AdminBankAccounts from "@/components/AdminBankAccounts";
import { AdminMarketers } from "@/components/AdminMarketers";
import AdminPricing from "@/components/AdminPricing";
import AdminSecurityLogs from "@/components/AdminSecurityLogs";
import AdminSupplierProducts from "@/components/AdminSupplierProducts";
import AdminSupplierApplications from "@/components/AdminSupplierApplications";
import { AdminReviews } from "@/components/AdminReviews";
import AdminPayroll from "@/components/AdminPayroll";
import AdminContracts from "@/components/AdminContracts";
import AdminBackup from "@/components/AdminBackup";
import AdminAISales from "@/components/AdminAISales";
import AdminStudioPreviewSettings from "@/components/AdminStudioPreviewSettings";
import AdminSectionSettings from "@/components/AdminSectionSettings";
import AdminPDPLayout from "@/components/AdminPDPLayout";
import { AdminSubcategories } from "@/components/AdminSubcategories";
import AdminCreditTiers from "@/components/AdminCreditTiers";
import AdminCreditCustomers from "@/components/AdminCreditCustomers";
import { FinancialAlertsBadge } from "@/components/FinancialAlertsBadge";
import InlineVolumeOffers from "@/components/InlineVolumeOffers";
import MarketTrends from "@/pages/MarketTrends";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { 
  ShoppingBag, 
  Package, 
  Eye, 
  EyeOff,
  Loader2, 
  Lock, 
  CheckCircle, 
  Clock, 
  XCircle,
  TrendingUp,
  DollarSign,
  Users,
  Settings,
  Save,
  Plus,
  Pencil,
  Trash2,
  X,
  ImagePlus,
  Printer,
  UserCircle2,
  ExternalLink,
  Star,
  Grid2x2,
  LayoutGrid,
  Zap,
  Palette,
  RefreshCw,
  Edit,
  LayoutDashboard,
  Truck,
  RefreshCcw,
  Percent,
  Sparkles,
  Banknote,
  FileText,
  ChevronDown, ChevronUp,
  PrinterCheck,
  MessageSquare,
  Phone,
  AlertTriangle,
  ShieldCheck,
  Megaphone,
  GripVertical,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import PrintableInvoice from "@/components/PrintableInvoice";
import { OrderItemCollapsibleMeta } from "@/components/OrderItemDetails";
import { DigitalWalletsManager } from "@/components/DigitalWalletsManager";
import { ImageDimensionsManager } from "@/components/ImageDimensionsManager";
import { AdminNav } from "@/components/AdminNav";
import { LoginManagementSection } from "@/components/LoginManagementSection";
import TeamManagement from "@/components/TeamManagement";
import InvoiceSettingsSection from "@/components/InvoiceSettings";
import SupplierManagement from "@/components/SupplierManagement";
import { compressImage, formatFileSize } from "@/lib/imageCompression";

const statusMap: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "قيد الانتظار", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  deposit_paid: { label: "تم دفع العربون", color: "bg-blue-100 text-blue-800", icon: DollarSign },
  processing: { label: "قيد التجهيز", color: "bg-orange-100 text-orange-800", icon: Package },
  shipped: { label: "تم الشحن", color: "bg-indigo-100 text-indigo-800", icon: TrendingUp },
  delivered: { label: "تم التوصيل", color: "bg-teal-100 text-teal-800", icon: CheckCircle },
  completed: { label: "مكتمل", color: "bg-green-100 text-green-800", icon: CheckCircle },
  cancelled: { label: "ملغي", color: "bg-red-100 text-red-800", icon: XCircle },
};

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
  return colorMap[trimmed] || "#9CA3AF";
}

function ColorCircles({ colorsString }: { colorsString: string }) {
  if (!colorsString || !colorsString.trim()) return null;
  
  const colors = colorsString.split(',').map(c => c.trim()).filter(c => c);
  if (colors.length === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {colors.map((color, index) => (
        <div 
          key={index}
          className="flex items-center gap-1.5 bg-blue-50 text-blue-900 border border-blue-200 rounded-full px-2 py-1"
        >
          <div 
            className="w-5 h-5 rounded-full border-2 border-blue-300 shadow-sm"
            style={{ 
              backgroundColor: getColorCode(color),
              backgroundImage: color === 'شفاف' ? 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)' : 'none',
              backgroundSize: '8px 8px',
              backgroundPosition: '0 0, 4px 4px'
            }}
          />
          <span className="text-xs font-medium text-blue-900">{color}</span>
        </div>
      ))}
    </div>
  );
}

interface Category {
  id: number;
  name: string;
  slug: string;
  imageUrl: string;
}

interface ColorImageEntry {
  color: string;
  hex: string;
  imageUrl: string;
}

type SmartVariantType = "color" | "size" | "weight" | "image" | "bundle" | "strength" | "preview";
interface SmartVariant {
  id: string;
  type: SmartVariantType;
  label: string;
  price: string;
  priceSar: string;
  discount: string;
  hex: string;
  imageUrl: string;
  count?: number; // عدد القطع في الشدّة (للنوع bundle فقط)
  // ── COGS (Phase 1 — May 2026) ──────────────────────────────────────────
  costPriceY?: string; // سعر التكلفة (ريال يمني) — تكلفة الشراء من المورد
  costPriceSar?: string; // سعر التكلفة (ريال سعودي) — اختياري
  minOrderQty?: number; // أقل كمية شراء من المورد
}
const SMART_VARIANT_TYPE_LABELS: Record<SmartVariantType, string> = {
  color: "لون",
  size: "مقاس",
  weight: "وزن",
  image: "صورة",
  bundle: "شدة",
  strength: "شدة",
  preview: "معاينة فورية",
};
const SMART_VARIANT_TYPE_ICONS: Record<SmartVariantType, string> = {
  color: "🎨",
  size: "📐",
  weight: "⚖️",
  image: "🖼️",
  bundle: "🎁",
  strength: "💪",
  preview: "🎨",
};

interface ProductFormData {
  name: string;
  description: string;
  price: string;
  priceSar: string;
  categoryId: number;
  subcategoryId: number;
  isActive: boolean;
  imageUrl: string;
  imageUrls: string[];
  stock: number;
  colors: string;
  sizes: string;
  allowDesignUpload: boolean;
  printingPricePerUnit: string;
  hasPrintingOptions: boolean;
  baseBagPrice: string;
  singleColorPrintPrice: string;
  availableBagColors: string;
  printingCategoryId: string;
  printingDesignFeeOverride: string;
  printingColorPriceOverride: string;
  printingSidePriceOverride: string;
  printArea: { x: number; y: number; width: number; height: number } | null;
  baseImagePublicId: string;
  availableColors: string; // JSON كنص — يُحفظ كـ array
  tags: string;
  showReviews: boolean;
  showInPrinting: boolean;
  enableVariantUI: boolean;
  colorImages: ColorImageEntry[];
  enableSmartVariants: boolean;
  showLivePreview: boolean;
  enableVolumeOffers: boolean;
  enableQuantityTiers: boolean;
  originalPrice: string;
  originalPriceSar: string;
  discountPercent: string;
  promotionalTags: string[];
  hasFreeShipping: boolean;
  productType?: 'ready' | 'customizable';
  supplierId: number;
  // ── Phase 7: تخصيصات المنتج (Admin-controlled) ──────────────────────────
  printColorOptions: Array<{ name: string; hex: string }>;
  quantityTiers: Array<{ qty: number; totalPrice: number; unitPrice: number; costPrice?: number }>;
  previewWidth: number;
  previewHeight: number;
}

const emptyProductForm: ProductFormData = {
  name: "",
  description: "",
  price: "",
  priceSar: "",
  categoryId: 0,
  subcategoryId: 0,
  isActive: true,
  imageUrl: "",
  imageUrls: [],
  stock: 100,
  colors: "",
  sizes: "",
  allowDesignUpload: false,
  printingPricePerUnit: "",
  hasPrintingOptions: false,
  baseBagPrice: "",
  singleColorPrintPrice: "",
  availableBagColors: "",
  printingCategoryId: "",
  printingDesignFeeOverride: "",
  printingColorPriceOverride: "",
  printingSidePriceOverride: "",
  printArea: null,
  baseImagePublicId: "",
  availableColors: "",
  tags: "",
  showReviews: true,
  showInPrinting: false,
  enableVariantUI: false,
  colorImages: [],
  enableSmartVariants: false,
  showLivePreview: false,
  enableVolumeOffers: false,
  enableQuantityTiers: false,
  originalPrice: "",
  originalPriceSar: "",
  discountPercent: "",
  promotionalTags: [],
  hasFreeShipping: false,
  productType: 'ready' as 'ready' | 'customizable',
  supplierId: 0,
  // ── Phase 7 ──
  printColorOptions: [
    { name: "أبيض", hex: "#FFFFFF" },
    { name: "أسود", hex: "#000000" },
    { name: "ذهبي", hex: "#D4AF37" },
  ],
  quantityTiers: [
    { qty: 100, totalPrice: 6000, unitPrice: 60, costPrice: 0 },
    { qty: 500, totalPrice: 27000, unitPrice: 54, costPrice: 0 },
    { qty: 1000, totalPrice: 50000, unitPrice: 50, costPrice: 0 },
  ],
  previewWidth: 200,
  previewHeight: 250,
};

interface CategoryFormData {
  name: string;
  slug: string;
  imageUrl: string;
  isActive: boolean;
}

const emptyCategoryForm: CategoryFormData = {
  name: "",
  slug: "",
  imageUrl: "",
  isActive: true,
};

interface OrderItemWithName {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  price: string;
  productName: string;
  selectedSize?: string | null;
  selectedColor?: string | null;
  customPrinting?: boolean;
  designNotes?: string | null;
}

interface BannerData {
  id?: number;
  title: string;
  subtitle: string;
  imageUrl: string;
  linkUrl: string;
  isActive: boolean;
  sortOrder: number;
}

interface OfferData {
  id?: number;
  title: string;
  discountPercent: number;
  imageUrl: string;
  linkUrl: string;
  bgColor: string;
  isActive: boolean;
  sortOrder: number;
}

const emptyBannerForm: BannerData = {
  title: "",
  subtitle: "",
  imageUrl: "",
  linkUrl: "/products",
  isActive: true,
  sortOrder: 0
};

const emptyOfferForm: OfferData = {
  title: "",
  discountPercent: 10,
  imageUrl: "",
  linkUrl: "/products",
  bgColor: "blue",
  isActive: true,
  sortOrder: 0
};

const bgColorOptions = [
  { value: "blue", label: "أزرق", class: "bg-blue-50 dark:bg-blue-900/20" },
  { value: "pink", label: "وردي", class: "bg-pink-50 dark:bg-pink-900/20" },
  { value: "green", label: "أخضر", class: "bg-green-50 dark:bg-green-900/20" },
  { value: "purple", label: "بنفسجي", class: "bg-purple-50 dark:bg-purple-900/20" },
  { value: "orange", label: "برتقالي", class: "bg-orange-50 dark:bg-orange-900/20" },
];

// ─── Logo & Splash Manager ────────────────────────────────────────────────────
function LogoSplashManager({ adminToken, toast }: { adminToken: string | null; toast: any }) {
  const queryClient = useQueryClient();
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bgPreview, setBgPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    splashBgColor: "#1565C0",
    splashText: "أويو بلاست",
    splashTextColor: "#ffffff",
    showSplash: true,
  });

  const { data: current, isLoading } = useQuery<any>({
    queryKey: ["/api/logo-settings"],
    queryFn: async () => {
      const res = await fetch("/api/logo-settings");
      if (!res.ok) return null;
      return res.json();
    },
  });

  useEffect(() => {
    if (current) {
      setForm({
        splashBgColor: current.splashBgColor || "#1565C0",
        splashText: current.splashText || "أويو بلاست",
        splashTextColor: current.splashTextColor || "#ffffff",
        showSplash: current.showSplash !== false,
      });
    }
  }, [current]);

  const handleSave = async () => {
    if (!adminToken) return;
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append("splashBgColor", form.splashBgColor);
      formData.append("splashText", form.splashText);
      formData.append("splashTextColor", form.splashTextColor);
      formData.append("showSplash", String(form.showSplash));

      if (logoPreview && logoPreview.startsWith("data:")) {
        // Convert base64 to file
        const res = await fetch(logoPreview);
        const blob = await res.blob();
        formData.append("logo", blob, "logo.jpg");
      }
      if (bgPreview && bgPreview.startsWith("data:")) {
        const res = await fetch(bgPreview);
        const blob = await res.blob();
        formData.append("splashBg", blob, "splash-bg.jpg");
      }

      const response = await fetch("/api/admin/logo-settings", {
        method: "PATCH",
        headers: { "x-admin-token": adminToken },
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to save");
      queryClient.invalidateQueries({ queryKey: ["/api/logo-settings"] });
      toast({ title: "✅ تم حفظ إعدادات الشعار بنجاح" });
    } catch (err) {
      toast({ title: "❌ فشل الحفظ", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (v: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Compress image automatically
      const originalSize = file.size;
      const compressedBlob = await compressImage(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.75,
        format: 'webp'
      });

      const compressedSize = compressedBlob.size;
      const savings = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
      
      toast({
        title: "✅ صورة مضغوطة",
        description: `${formatFileSize(originalSize)} → ${formatFileSize(compressedSize)} (توفير ${savings}%)`
      });

      // Convert compressed blob to base64
      const reader = new FileReader();
      reader.onload = (ev) => setter(ev.target?.result as string);
      reader.readAsDataURL(compressedBlob);
    } catch (err) {
      toast({
        title: "⚠️ خطأ في ضغط الصورة",
        description: "سيتم رفع الصورة بحجمها الأصلي",
        variant: "destructive"
      });
      // Fallback to original
      const reader = new FileReader();
      reader.onload = (ev) => setter(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = async () => {
    if (!adminToken) return;
    setLogoPreview(null);
    await fetch("/api/admin/logo-settings", {
      method: "PATCH",
      headers: { "x-admin-token": adminToken, "Content-Type": "application/json" },
      body: JSON.stringify({ logoUrl: null }),
    });
    queryClient.invalidateQueries({ queryKey: ["/api/logo-settings"] });
    toast({ title: "تم حذف الشعار" });
  };

  const removeBg = async () => {
    if (!adminToken) return;
    setBgPreview(null);
    await fetch("/api/admin/logo-settings", {
      method: "PATCH",
      headers: { "x-admin-token": adminToken, "Content-Type": "application/json" },
      body: JSON.stringify({ splashBgUrl: null }),
    });
    queryClient.invalidateQueries({ queryKey: ["/api/logo-settings"] });
    toast({ title: "تم حذف خلفية السبلاش" });
  };

  const currentLogo = logoPreview || current?.logoUrl;
  const currentBg = bgPreview || current?.splashBgUrl;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

      {/* Left: Logo Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-right">🖼️ شعار المتجر</CardTitle>
          <CardDescription className="text-right">
            الشعار يظهر في شاشة التحميل وفي الـ Navbar وعلى PWA
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Preview */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-gray-300 overflow-hidden bg-gray-50 flex items-center justify-center">
              {currentLogo ? (
                <img src={currentLogo} alt="logo" className="w-full h-full object-contain" />
              ) : (
                <span className="text-gray-400 text-sm text-center px-2">لا يوجد شعار</span>
              )}
            </div>
            {currentLogo && (
              <Button variant="destructive" size="sm" onClick={removeLogo}>
                <Trash2 className="h-4 w-4 ml-1" /> حذف الشعار
              </Button>
            )}
          </div>

          {/* Upload */}
          <div>
            <Label className="block text-right mb-1">رفع شعار جديد (512×512 px)</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileChange(e, setLogoPreview)}
              className="text-right"
            />
            <p className="text-xs text-gray-500 text-right mt-1">JPG أو PNG • حجم أقصى 2MB</p>
          </div>
        </CardContent>
      </Card>

      {/* Right: Splash Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-right">🚀 شاشة البداية (Splash)</CardTitle>
          <CardDescription className="text-right">
            تظهر للعميل عند أول فتح للتطبيق
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Preview of splash */}
          <div
            className="w-full h-40 rounded-xl flex flex-col items-center justify-center gap-2 relative overflow-hidden border"
            style={{
              backgroundColor: form.splashBgColor,
              backgroundImage: currentBg ? `url(${currentBg})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            {currentBg && <div className="absolute inset-0 bg-black/40" />}
            <div className="relative z-10 flex flex-col items-center gap-1">
              {currentLogo && (
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-white flex items-center justify-center">
                  <img src={currentLogo} className="w-full h-full object-contain" alt="" />
                </div>
              )}
              <span className="font-bold text-base" style={{ color: currentBg ? "#fff" : form.splashTextColor }}>
                {form.splashText}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-3" dir="rtl">
            <div>
              <Label>نص الشاشة</Label>
              <Input
                value={form.splashText}
                onChange={(e) => setForm({ ...form, splashText: e.target.value })}
                placeholder="أويو بلاست"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>لون الخلفية</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    value={form.splashBgColor}
                    onChange={(e) => setForm({ ...form, splashBgColor: e.target.value })}
                    className="h-8 w-8 rounded border cursor-pointer"
                  />
                  <span className="text-sm text-gray-500">{form.splashBgColor}</span>
                </div>
              </div>
              <div>
                <Label>لون النص</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    value={form.splashTextColor}
                    onChange={(e) => setForm({ ...form, splashTextColor: e.target.value })}
                    className="h-8 w-8 rounded border cursor-pointer"
                  />
                  <span className="text-sm text-gray-500">{form.splashTextColor}</span>
                </div>
              </div>
            </div>

            <div>
              <Label>صورة خلفية (اختياري) - 1200×400 px</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, setBgPreview)}
                className="mt-1"
              />
              {currentBg && (
                <Button variant="ghost" size="sm" className="text-red-500 mt-1" onClick={removeBg}>
                  <Trash2 className="h-3 w-3 ml-1" /> حذف الخلفية
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between border rounded-lg p-3">
              <Switch
                checked={form.showSplash}
                onCheckedChange={(v) => setForm({ ...form, showSplash: v })}
              />
              <span className="text-sm font-medium">تفعيل شاشة البداية</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="md:col-span-2 flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isSaving || !adminToken}
          className="bg-blue-600 hover:bg-blue-700 text-white px-8"
        >
          {isSaving ? <><Loader2 className="h-4 w-4 ml-2 animate-spin" /> جاري الحفظ...</> : <><Save className="h-4 w-4 ml-2" /> حفظ الإعدادات</>}
        </Button>
      </div>
    </div>
  );
}

function BannersOffersSection({ adminToken }: { adminToken: string | null }) {
  const [showBannerForm, setShowBannerForm] = useState(false);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [editingBanner, setEditingBanner] = useState<BannerData | null>(null);
  const [editingOffer, setEditingOffer] = useState<OfferData | null>(null);
  const [bannerForm, setBannerForm] = useState<BannerData>(emptyBannerForm);
  const [offerForm, setOfferForm] = useState<OfferData>(emptyOfferForm);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const { data: banners, isLoading: bannersLoading } = useQuery<BannerData[]>({
    queryKey: ['/api/admin/banners'],
    queryFn: async () => {
      const res = await fetch('/api/admin/banners', {
        headers: { 'x-admin-token': adminToken! }
      });
      if (!res.ok) throw new Error('Failed to fetch banners');
      return res.json();
    },
    enabled: !!adminToken,
  });

  const { data: offers, isLoading: offersLoading } = useQuery<OfferData[]>({
    queryKey: ['/api/admin/offers'],
    queryFn: async () => {
      const res = await fetch('/api/admin/offers', {
        headers: { 'x-admin-token': adminToken! }
      });
      if (!res.ok) throw new Error('Failed to fetch offers');
      return res.json();
    },
    enabled: !!adminToken,
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['/api/admin/categories'],
    enabled: !!adminToken,
    queryFn: async () => {
      const res = await fetch('/api/admin/categories', {
        headers: { 'x-admin-token': adminToken || '' }
      });
      if (!res.ok) throw new Error('Failed to fetch categories');
      return res.json();
    },
  });

  const handleBannerImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !adminToken) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { 'x-admin-token': adminToken },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setBannerForm(prev => ({ ...prev, imageUrl: data.imageUrl }));
        toast({ title: "تم رفع الصورة بنجاح" });
      } else {
        toast({ title: "فشل رفع الصورة", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "حدث خطأ أثناء رفع الصورة", variant: "destructive" });
    }
    setIsUploading(false);
    e.target.value = '';
  };

  const handleOfferImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !adminToken) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { 'x-admin-token': adminToken },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setOfferForm(prev => ({ ...prev, imageUrl: data.imageUrl }));
        toast({ title: "تم رفع الصورة بنجاح" });
      } else {
        toast({ title: "فشل رفع الصورة", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "حدث خطأ أثناء رفع الصورة", variant: "destructive" });
    }
    setIsUploading(false);
    e.target.value = '';
  };

  const createBanner = useMutation({
    mutationFn: async (data: BannerData) => {
      const res = await fetch('/api/admin/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken! },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create banner');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/banners'] });
      queryClient.invalidateQueries({ queryKey: ['/api/banners'] });
      setShowBannerForm(false);
      setBannerForm(emptyBannerForm);
      toast({ title: "تم إنشاء البنر بنجاح" });
    },
    onError: () => toast({ title: "فشل إنشاء البنر", variant: "destructive" })
  });

  const updateBanner = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<BannerData> }) => {
      const res = await fetch(`/api/admin/banners/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken! },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update banner');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/banners'] });
      queryClient.invalidateQueries({ queryKey: ['/api/banners'] });
      setShowBannerForm(false);
      setEditingBanner(null);
      setBannerForm(emptyBannerForm);
      toast({ title: "تم تحديث البنر بنجاح" });
    },
    onError: () => toast({ title: "فشل تحديث البنر", variant: "destructive" })
  });

  const deleteBanner = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/banners/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': adminToken! }
      });
      if (!res.ok) throw new Error('Failed to delete banner');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/banners'] });
      queryClient.invalidateQueries({ queryKey: ['/api/banners'] });
      toast({ title: "تم حذف البنر بنجاح" });
    },
    onError: () => toast({ title: "فشل حذف البنر", variant: "destructive" })
  });

  const createOffer = useMutation({
    mutationFn: async (data: OfferData) => {
      const res = await fetch('/api/admin/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken! },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create offer');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/offers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/offers'] });
      setShowOfferForm(false);
      setOfferForm(emptyOfferForm);
      toast({ title: "تم إنشاء العرض بنجاح" });
    },
    onError: () => toast({ title: "فشل إنشاء العرض", variant: "destructive" })
  });

  const updateOffer = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<OfferData> }) => {
      const res = await fetch(`/api/admin/offers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken! },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update offer');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/offers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/offers'] });
      setShowOfferForm(false);
      setEditingOffer(null);
      setOfferForm(emptyOfferForm);
      toast({ title: "تم تحديث العرض بنجاح" });
    },
    onError: () => toast({ title: "فشل تحديث العرض", variant: "destructive" })
  });

  const deleteOffer = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/offers/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': adminToken! }
      });
      if (!res.ok) throw new Error('Failed to delete offer');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/offers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/offers'] });
      toast({ title: "تم حذف العرض بنجاح" });
    },
    onError: () => toast({ title: "فشل حذف العرض", variant: "destructive" })
  });

  const handleEditBanner = (banner: BannerData) => {
    setEditingBanner(banner);
    setBannerForm({
      title: banner.title,
      subtitle: banner.subtitle || "",
      imageUrl: banner.imageUrl,
      linkUrl: banner.linkUrl || "/products",
      isActive: banner.isActive,
      sortOrder: banner.sortOrder || 0
    });
    setShowBannerForm(true);
  };

  const handleEditOffer = (offer: OfferData) => {
    setEditingOffer(offer);
    setOfferForm({
      title: offer.title,
      discountPercent: offer.discountPercent,
      imageUrl: offer.imageUrl || "",
      linkUrl: offer.linkUrl || "/products",
      bgColor: offer.bgColor || "blue",
      isActive: offer.isActive,
      sortOrder: offer.sortOrder || 0
    });
    setShowOfferForm(true);
  };

  const handleSubmitBanner = () => {
    if (!bannerForm.title || !bannerForm.imageUrl) {
      toast({ title: "يرجى ملء جميع الحقول المطلوبة", variant: "destructive" });
      return;
    }
    if (editingBanner?.id) {
      updateBanner.mutate({ id: editingBanner.id, data: bannerForm });
    } else {
      createBanner.mutate(bannerForm);
    }
  };

  const handleSubmitOffer = () => {
    if (!offerForm.title) {
      toast({ title: "يرجى ملء جميع الحقول المطلوبة", variant: "destructive" });
      return;
    }
    if (editingOffer?.id) {
      updateOffer.mutate({ id: editingOffer.id, data: offerForm });
    } else {
      createOffer.mutate(offerForm);
    }
  };

  const linkOptions = [
    { value: "/products", label: "جميع المنتجات" },
    { value: "/printing-and-design", label: "طباعة وتصميم" },
    ...(categories?.map(c => ({ value: `/products?category=${c.id}`, label: c.name })) || [])
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>إدارة البنرات الرئيسية (Slider)</CardTitle>
          <Button 
            onClick={() => { setShowBannerForm(true); setEditingBanner(null); setBannerForm(emptyBannerForm); }}
            data-testid="button-add-banner"
          >
            <Plus className="h-4 w-4 ml-2" />
            إضافة بنر جديد
          </Button>
        </CardHeader>
        <CardContent>
          {showBannerForm && (
            <div className="border rounded-lg p-4 mb-4 bg-muted/50">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-semibold">{editingBanner ? "تعديل البنر" : "إضافة بنر جديد"}</h4>
                <Button variant="ghost" size="icon" onClick={() => { setShowBannerForm(false); setEditingBanner(null); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>عنوان البنر *</Label>
                  <Input
                    value={bannerForm.title}
                    onChange={(e) => setBannerForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="مثال: أكياس قماشية"
                    data-testid="input-banner-title"
                  />
                </div>
                <div>
                  <Label>العنوان الفرعي</Label>
                  <Input
                    value={bannerForm.subtitle}
                    onChange={(e) => setBannerForm(prev => ({ ...prev, subtitle: e.target.value }))}
                    placeholder="مثال: صديقة للبيئة وقابلة لإعادة الاستخدام"
                    data-testid="input-banner-subtitle"
                  />
                </div>
                <div>
                  <Label>رابط التوجيه</Label>
                  <Select 
                    value={bannerForm.linkUrl} 
                    onValueChange={(value) => setBannerForm(prev => ({ ...prev, linkUrl: value }))}
                  >
                    <SelectTrigger data-testid="select-banner-link">
                      <SelectValue placeholder="اختر القسم" />
                    </SelectTrigger>
                    <SelectContent>
                      {linkOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>ترتيب العرض</Label>
                  <Input
                    type="number"
                    value={bannerForm.sortOrder}
                    onChange={(e) => setBannerForm(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                    data-testid="input-banner-sort"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>صورة البنر *</Label>
                  <div className="flex items-center gap-4">
                    {bannerForm.imageUrl && (
                      <img src={bannerForm.imageUrl} alt="Preview" className="h-20 w-32 object-cover rounded" />
                    )}
                    <Label className="cursor-pointer border-2 border-dashed rounded-lg p-4 flex items-center gap-2">
                      <ImagePlus className="h-5 w-5" />
                      {isUploading ? "جاري الرفع..." : "رفع صورة"}
                      <input type="file" accept="image/*" className="hidden" onChange={handleBannerImageUpload} disabled={isUploading} />
                    </Label>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={bannerForm.isActive}
                    onChange={(e) => setBannerForm(prev => ({ ...prev, isActive: e.target.checked }))}
                    id="banner-active"
                  />
                  <Label htmlFor="banner-active">تفعيل البنر</Label>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => { setShowBannerForm(false); setEditingBanner(null); }}>إلغاء</Button>
                <Button onClick={handleSubmitBanner} disabled={createBanner.isPending || updateBanner.isPending}>
                  {(createBanner.isPending || updateBanner.isPending) && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
                  {editingBanner ? "تحديث" : "حفظ"}
                </Button>
              </div>
            </div>
          )}

          {bannersLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : banners && banners.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {banners.map((banner) => (
                <div key={banner.id} className="relative border rounded-lg overflow-hidden group">
                  <img src={banner.imageUrl} alt={banner.title} className="w-full h-32 object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex flex-col justify-end p-3">
                    <h4 className="text-white font-bold text-sm">{banner.title}</h4>
                    {banner.subtitle && <p className="text-white/80 text-xs">{banner.subtitle}</p>}
                  </div>
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Badge variant={banner.isActive ? "default" : "secondary"}>
                      {banner.isActive ? "مفعل" : "معطل"}
                    </Badge>
                  </div>
                  <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="icon" variant="secondary" onClick={() => handleEditBanner(banner)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="destructive" onClick={() => banner.id && deleteBanner.mutate(banner.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>لا توجد بنرات بعد</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>إدارة العروض الخاصة</CardTitle>
          <Button 
            onClick={() => { setShowOfferForm(true); setEditingOffer(null); setOfferForm(emptyOfferForm); }}
            data-testid="button-add-offer"
          >
            <Plus className="h-4 w-4 ml-2" />
            إضافة عرض جديد
          </Button>
        </CardHeader>
        <CardContent>
          {showOfferForm && (
            <div className="border rounded-lg p-4 mb-4 bg-muted/50">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-semibold">{editingOffer ? "تعديل العرض" : "إضافة عرض جديد"}</h4>
                <Button variant="ghost" size="icon" onClick={() => { setShowOfferForm(false); setEditingOffer(null); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>اسم العرض *</Label>
                  <Input
                    value={offerForm.title}
                    onChange={(e) => setOfferForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="مثال: خصم الجملة"
                    data-testid="input-offer-title"
                  />
                </div>
                <div>
                  <Label>نسبة الخصم (%)</Label>
                  <Input
                    type="number"
                    value={offerForm.discountPercent}
                    onChange={(e) => setOfferForm(prev => ({ ...prev, discountPercent: parseInt(e.target.value) || 0 }))}
                    placeholder="15"
                    data-testid="input-offer-discount"
                  />
                </div>
                <div>
                  <Label>رابط التوجيه (Deep Link)</Label>
                  <Select 
                    value={offerForm.linkUrl} 
                    onValueChange={(value) => setOfferForm(prev => ({ ...prev, linkUrl: value }))}
                  >
                    <SelectTrigger data-testid="select-offer-link">
                      <SelectValue placeholder="اختر القسم" />
                    </SelectTrigger>
                    <SelectContent>
                      {linkOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>لون الخلفية</Label>
                  <Select 
                    value={offerForm.bgColor} 
                    onValueChange={(value) => setOfferForm(prev => ({ ...prev, bgColor: value }))}
                  >
                    <SelectTrigger data-testid="select-offer-color">
                      <SelectValue placeholder="اختر اللون" />
                    </SelectTrigger>
                    <SelectContent>
                      {bgColorOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded ${opt.class}`}></div>
                            {opt.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>ترتيب العرض</Label>
                  <Input
                    type="number"
                    value={offerForm.sortOrder}
                    onChange={(e) => setOfferForm(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                    data-testid="input-offer-sort"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={offerForm.isActive}
                    onChange={(e) => setOfferForm(prev => ({ ...prev, isActive: e.target.checked }))}
                    id="offer-active"
                  />
                  <Label htmlFor="offer-active">تفعيل العرض</Label>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => { setShowOfferForm(false); setEditingOffer(null); }}>إلغاء</Button>
                <Button onClick={handleSubmitOffer} disabled={createOffer.isPending || updateOffer.isPending}>
                  {(createOffer.isPending || updateOffer.isPending) && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
                  {editingOffer ? "تحديث" : "حفظ"}
                </Button>
              </div>
            </div>
          )}

          {offersLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : offers && offers.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {offers.map((offer) => {
                const colorClass = bgColorOptions.find(c => c.value === offer.bgColor)?.class || "bg-blue-50";
                return (
                  <div key={offer.id} className={`relative rounded-xl p-4 ${colorClass} group`}>
                    <span className="text-3xl font-extrabold text-blue-600">{offer.discountPercent}%</span>
                    <p className="text-sm font-bold text-foreground mt-1">{offer.title}</p>
                    <p className="text-xs text-muted-foreground">{offer.linkUrl}</p>
                    <div className="absolute top-2 right-2 flex gap-1">
                      <Badge variant={offer.isActive ? "default" : "secondary"} className="text-xs">
                        {offer.isActive ? "مفعل" : "معطل"}
                      </Badge>
                    </div>
                    <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="secondary" onClick={() => handleEditOffer(offer)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="destructive" onClick={() => offer.id && deleteOffer.mutate(offer.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>لا توجد عروض بعد</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Twilio SMS Test Section
function TwilioSmsTest({ adminToken }: { adminToken: string | null }) {
  const { toast } = useToast();
  const [testPhone, setTestPhone] = useState("+967774997589");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runTest = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/test-sms", {
        method: "POST",
        headers: { "x-admin-token": adminToken!, "Content-Type": "application/json" },
        body: JSON.stringify({ testPhone }),
      });
      const data = await res.json();
      setResult(data);
      if (data.tests?.twilio?.ok) {
        toast({ title: "✅ Twilio يعمل بنجاح! تم إرسال رسالة تجريبية." });
      } else {
        const diagnosis = data.tests?.twilio?.diagnosis || data.tests?.twilio?.note || "تعذّر إرسال الرسائل عبر Twilio";
        toast({ title: "❌ Twilio لا يعمل", description: diagnosis, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "خطأ في الاختبار", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (ok: boolean | undefined) =>
    ok === true ? "text-green-600" : ok === false ? "text-red-600" : "text-gray-400";

  return (
    <Card className="border-2 border-blue-200 dark:border-blue-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          📱 فحص Twilio — إرسال رسائل التحقق
        </CardTitle>
        <CardDescription>اختبر اتصال Twilio وإرسال رسائل SMS التحقق من داخل لوحة الإدارة</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={testPhone}
            onChange={e => setTestPhone(e.target.value)}
            className="flex-1 px-3 py-2 text-sm border rounded-lg font-mono"
            placeholder="+967XXXXXXXXX"
            dir="ltr"
            data-testid="input-twilio-test-phone"
          />
          <button
            onClick={runTest}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg disabled:opacity-50"
            data-testid="button-twilio-test"
          >
            {loading ? "جاري الإرسال..." : "اختبر Twilio"}
          </button>
        </div>

        {result && (
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-sm space-y-2 font-mono">
            <div>
              <span className="font-bold">Twilio: </span>
              <span className={statusColor(result.tests?.twilio?.ok)}>
                {result.tests?.twilio?.ok ? "✅ يعمل" : "❌ فشل"}
              </span>
            </div>
            <div className="text-xs text-gray-500 break-all">
              <span className="font-bold">التشخيص: </span>
              {result.tests?.twilio?.diagnosis || result.tests?.twilio?.note || result.tests?.twilio?.error}
            </div>
            {!result.config?.twilio?.configured && (
              <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-yellow-800 dark:text-yellow-200 text-xs">
                <strong>الإعداد مطلوب:</strong>
                <br />• أضف <code>TWILIO_ACCOUNT_SID</code> في Replit Secrets
                <br />• أضف <code>TWILIO_AUTH_TOKEN</code> في Replit Secrets
                <br />• أضف <code>TWILIO_FROM_NUMBER</code> (رقم Twilio بالصيغة +1XXXXXXXXXX)
              </div>
            )}
            {result.config && (
              <div className="text-xs text-gray-400 pt-1 border-t">
                Account SID: {result.config.twilio.accountSid} — من: {result.config.twilio.fromNumber}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── عارض رموز OTP النشطة ──────────────────────────────────────────
function ActiveOTPViewer({ adminToken }: { adminToken: string | null }) {
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data, isLoading, refetch, isFetching } = useQuery<{ otps: any[] }>({
    queryKey: ["/api/admin/active-otps", adminToken],
    queryFn: async () => {
      const res = await fetch("/api/admin/active-otps", {
        headers: { "x-admin-token": adminToken! },
      });
      if (!res.ok) throw new Error("فشل جلب الرموز");
      return res.json();
    },
    enabled: !!adminToken,
    refetchInterval: autoRefresh ? 10000 : false,
    staleTime: 5000,
  });

  const otps = data?.otps || [];

  const timeLeft = (expiresAt: string) => {
    const diff = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
    if (diff <= 0) return "منتهي";
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <Card className="border-2 border-amber-200 dark:border-amber-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              🔑 رموز التحقق النشطة
            </CardTitle>
            <CardDescription className="mt-0.5">
              عرض رموز OTP المولّدة — أرسلها يدوياً للعميل إذا لم تصله الرسالة
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={e => setAutoRefresh(e.target.checked)}
                className="w-3 h-3"
              />
              تحديث تلقائي
            </label>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="px-3 py-1 bg-amber-600 text-white text-xs font-bold rounded-lg disabled:opacity-50 flex items-center gap-1"
              data-testid="button-refresh-otps"
            >
              {isFetching ? "..." : "🔄 تحديث"}
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-6 text-muted-foreground text-sm">جاري التحميل...</div>
        ) : otps.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-4xl mb-2">📭</p>
            <p className="text-sm">لا توجد رموز نشطة حالياً</p>
            <p className="text-xs text-muted-foreground mt-1">تظهر هنا حين يطلب العميل رمز التحقق</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground mb-3">
              {otps.length} رمز نشط — اضغط على الرمز لنسخه
            </p>
            {otps.map((otp, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border-2 border-amber-100 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-900/10"
                data-testid={`otp-row-${idx}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm font-bold text-foreground" dir="ltr">
                    {otp.phone}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    المحاولات: {otp.attempts} / 5
                  </p>
                </div>
                <button
                  onClick={() => copyToClipboard(otp.code)}
                  className="text-3xl font-black font-mono tracking-widest text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 transition-colors bg-amber-100 dark:bg-amber-900/30 px-3 py-1 rounded-lg"
                  title="اضغط لنسخ الرمز"
                  data-testid={`button-copy-otp-${idx}`}
                >
                  {otp.code}
                </button>
                <div className="text-xs text-center min-w-[50px]">
                  <p className="font-mono font-bold text-orange-600 dark:text-orange-400">
                    {timeLeft(otp.expires_at)}
                  </p>
                  <p className="text-muted-foreground">متبقّي</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-700 dark:text-blue-300">
          <strong>📌 كيف تستخدم هذه الصفحة:</strong>
          <ol className="list-decimal list-inside mt-1 space-y-0.5">
            <li>العميل يدخل رقمه ويضغط "إرسال رمز التحقق"</li>
            <li>اضغط "تحديث" هنا لترى الرمز المولّد</li>
            <li>اضغط الرمز لنسخه، ثم أرسله للعميل عبر واتساب أو اتصال</li>
            <li>العميل يُدخل الرمز ويكمل تسجيل الدخول</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}

function NavigationSettingsSection({ adminToken }: { adminToken: string | null }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings } = useQuery<any>({
    queryKey: ['/api/navigation-settings'],
    queryFn: async () => {
      const res = await fetch('/api/navigation-settings');
      if (!res.ok) throw new Error('Failed to fetch settings');
      return res.json();
    },
    enabled: !!adminToken,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/admin/navigation-settings', {
        method: 'PATCH',
        headers: { 'x-admin-token': adminToken!, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update settings');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/navigation-settings'] });
      toast({ title: "تم تحديث الإعدادات بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل تحديث الإعدادات", variant: "destructive" });
    },
  });

  const handleTogglePrinting = (newValue: boolean) => {
    updateSettingsMutation.mutate({ showPrintingSection: newValue });
  };

  const handleToggleSignup = (newValue: boolean) => {
    updateSettingsMutation.mutate({ showSignupEntryPoint: newValue });
  };

  const handleToggleVariantPage = (newValue: boolean) => {
    updateSettingsMutation.mutate({ enableVariantProductPage: newValue });
  };

  const handleToggleMobileLock = (newValue: boolean) => {
    updateSettingsMutation.mutate({
      lockMobilePwaMode: newValue,
      disablePinchZoom: newValue,
      disableHorizontalScroll: newValue,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>إعدادات التنقل</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div>
            <p className="font-semibold">إظهار قسم الطباعة والتصميم</p>
            <p className="text-sm text-gray-500">تفعيل/تعطيل قسم الطباعة في قائمة التنقل</p>
          </div>
          <input
            type="checkbox"
            checked={settings?.showPrintingSection ?? true}
            onChange={(e) => handleTogglePrinting(e.target.checked)}
            disabled={updateSettingsMutation.isPending}
            className="w-5 h-5 cursor-pointer"
          />
        </div>
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div>
            <p className="font-semibold">زر الدخول/التسجيل</p>
            <p className="text-sm text-gray-500">إظهار أو إخفاء زر الحساب في الشريط السفلي</p>
          </div>
          <input
            type="checkbox"
            checked={settings?.showSignupEntryPoint ?? true}
            onChange={(e) => handleToggleSignup(e.target.checked)}
            disabled={updateSettingsMutation.isPending}
            className="w-5 h-5 cursor-pointer"
            data-testid="checkbox-show-signup-entry"
          />
        </div>
        <div className="flex items-center justify-between p-4 border-2 border-amber-200 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded font-bold">مفتاح رئيسي</span>
              <p className="font-semibold">صفحة المنتج المتطورة (SHEIN-Style)</p>
            </div>
            <p className="text-sm text-gray-500">تفعيل/إيقاف واجهة المنتج المتطورة عالمياً — إذا أوقفته يعود المتجر للواجهة الأصلية فوراً دون أي أثر</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <input
              type="checkbox"
              checked={settings?.enableVariantProductPage ?? false}
              onChange={(e) => handleToggleVariantPage(e.target.checked)}
              disabled={updateSettingsMutation.isPending}
              className="w-6 h-6 cursor-pointer accent-amber-500"
              data-testid="checkbox-enable-variant-product-page"
            />
            <span className={`text-xs font-bold ${settings?.enableVariantProductPage ? 'text-green-600' : 'text-gray-400'}`}>
              {settings?.enableVariantProductPage ? 'مفعّل' : 'موقوف'}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between p-4 border-2 border-blue-200 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded font-bold">PWA</span>
              <p className="font-semibold">قفل وضع الموبايل</p>
            </div>
            <p className="text-sm text-gray-500">يمنع التكبير باللمس والتمرير الأفقي ويُبقي التطبيق المثبت بمظهر موبايل ثابت.</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <input
              type="checkbox"
              checked={settings?.lockMobilePwaMode ?? true}
              onChange={(e) => handleToggleMobileLock(e.target.checked)}
              disabled={updateSettingsMutation.isPending}
              className="w-6 h-6 cursor-pointer accent-blue-500"
              data-testid="checkbox-lock-mobile-pwa-mode"
            />
            <span className={`text-xs font-bold ${settings?.lockMobilePwaMode ? 'text-green-600' : 'text-gray-400'}`}>
              {settings?.lockMobilePwaMode ? 'مفعّل' : 'موقوف'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Printing Products Section
function PrintingProductsSection({ adminToken }: { adminToken: string | null }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/admin/printing-products'],
    enabled: !!adminToken,
    queryFn: async () => {
      const res = await fetch('/api/admin/products', {
        headers: { 'x-admin-token': adminToken || '' }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.details || err.message || `Failed to fetch printing products: ${res.status}`);
      }
      return res.json();
    },
    retry: false,
    placeholderData: [],
  });

  const updatePrintingStatusMutation = useMutation({
    mutationFn: async (data: { productId: number; showInPrinting: boolean }) => {
      const res = await fetch(`/api/admin/products/${data.productId}/printing-status`, {
        method: 'PATCH',
        headers: { 'x-admin-token': adminToken!, 'Content-Type': 'application/json' },
        body: JSON.stringify({ showInPrinting: data.showInPrinting }),
      });
      if (!res.ok) throw new Error('Failed to update product');
      return res.json();
    },
  });

  const handleToggleProduct = async (productId: number, currentValue: boolean) => {
    updatePrintingStatusMutation.mutate(
      { productId, showInPrinting: !currentValue },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['/api/admin/products'] });
          queryClient.invalidateQueries({ queryKey: ['/api/admin/printing-products'] });
          queryClient.invalidateQueries({ queryKey: ['/api/products'] });
          queryClient.invalidateQueries({ queryKey: ['/api/printing-products'] });
          toast({ title: "تم تحديث المنتج بنجاح" });
        },
        onError: () => {
          toast({ title: "فشل تحديث المنتج", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>منتجات الطباعة والتصميم</CardTitle>
        <CardDescription>اختر المنتجات التي تظهر في قسم الطباعة</CardDescription>
      </CardHeader>
      <CardContent>
        {/* ملاحظة توجيهية */}
        <div className="mb-3 p-3 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg text-sm text-teal-700 dark:text-teal-300 flex items-start gap-2">
          <span className="text-lg leading-none mt-0.5">💡</span>
          <div>
            <p className="font-semibold">يمكنك الآن التحكم من نموذج المنتج مباشرة</p>
            <p className="text-xs mt-0.5 opacity-80">عند إضافة أو تعديل أي منتج، ستجد خياراً "ظهور في قسم الطباعة والتصميم" بجانب خيار التقييمات. يمكنك أيضاً تغيير الحالة من هنا.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : products.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {products.map((product) => (
              <div
                key={product.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${product.showInPrinting ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800' : 'bg-gray-50 dark:bg-gray-900 border-transparent'}`}
              >
                <input
                  type="checkbox"
                  checked={product.showInPrinting || false}
                  onChange={() => handleToggleProduct(product.id, product.showInPrinting || false)}
                  disabled={updatePrintingStatusMutation.isPending}
                  className="w-5 h-5 cursor-pointer accent-teal-600"
                  data-testid={`checkbox-printing-${product.id}`}
                />
                {product.imageUrl && (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-10 h-10 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{product.name}</p>
                  <p className="text-xs text-gray-500">{product.price} ر.ي</p>
                </div>
                {product.showInPrinting
                  ? <Badge className="bg-teal-600 text-white shrink-0">🖨️ مفعّل</Badge>
                  : <span className="text-xs text-gray-400 shrink-0">غير مفعّل</span>
                }
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-400 py-10">لا توجد منتجات</p>
        )}
      </CardContent>
    </Card>
  );
}

// Home Page Settings Section (Madeline Theme)
const OYO_PRESET = {
  productCardHeight: 200, productCardWidth: 160, productCardMargin: 8,
  productCardPaddingV: 12, priceFontSize: 16, discountBubbleSize: 0,
  quantityButtonHeight: 40, imageMode: 'card',
};
const SHEIN_PRESET = {
  productCardHeight: 380, productCardWidth: 200, productCardMargin: 0,
  productCardPaddingV: 4, priceFontSize: 22, discountBubbleSize: 36,
  quantityButtonHeight: 48, imageMode: 'full-bleed',
};

// ──────────────────────────────────────────────────────────────────────────────
// Home Sections Manager — إدارة أقسام الصفحة الرئيسية
// ──────────────────────────────────────────────────────────────────────────────
const PROMO_TAG_OPTIONS = [
  { value: 'bestsellers', label: 'الأكثر مبيعاً' },
  { value: 'new', label: 'إصدارات جديدة' },
  { value: 'offers', label: 'عروض حصرية' },
  { value: 'discounts', label: 'تخفيضات' },
  { value: 'deals', label: 'صفقات' },
  { value: 'clearance', label: 'تصفيات مخزون' },
  { value: 'featured', label: 'عروض مميزة' },
];

const emptySection = {
  title: '',
  promotionalTag: 'bestsellers',
  enabled: true,
  priority: 0,
  itemCount: 6,
  displayMode: 'grid2',
  bannerHeight: 180,
  bannerItemWidth: 160,
  bannerPriceFontSize: 14,
  bannerNameFontSize: 12,
};

function HomeSectionsSection({ adminToken }: { adminToken: string | null }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingSection, setEditingSection] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ ...emptySection });

  const { data: sections = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/home-sections'],
    staleTime: 0,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/admin/home-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken || '' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('فشل الإنشاء');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/home-sections'] });
      toast({ title: 'تم إضافة القسم بنجاح' });
      setShowForm(false);
      setForm({ ...emptySection });
    },
    onError: () => toast({ title: 'حدث خطأ', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/admin/home-sections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken || '' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('فشل التحديث');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/home-sections'] });
      toast({ title: 'تم التحديث' });
      setEditingSection(null);
      setShowForm(false);
    },
    onError: () => toast({ title: 'حدث خطأ', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/admin/home-sections/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': adminToken || '' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/home-sections'] });
      toast({ title: 'تم الحذف' });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (ordered: any[]) => {
      await Promise.all(
        ordered.map((s, i) =>
          s.priority === i
            ? Promise.resolve()
            : fetch(`/api/admin/home-sections/${s.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken || '' },
                body: JSON.stringify({ priority: i }),
              })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/home-sections'] });
      toast({ title: 'تم حفظ الترتيب الجديد' });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/home-sections'] });
      toast({ title: 'فشل حفظ الترتيب', variant: 'destructive' });
    },
  });

  const [dragId, setDragId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);

  const handleSectionDrop = (sorted: any[], targetId: number) => {
    if (dragId === null || dragId === targetId) { setDragId(null); setOverId(null); return; }
    const from = sorted.findIndex((s) => s.id === dragId);
    const to = sorted.findIndex((s) => s.id === targetId);
    if (from < 0 || to < 0) { setDragId(null); setOverId(null); return; }
    const next = [...sorted];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setDragId(null);
    setOverId(null);
    reorderMutation.mutate(next);
  };

  const toggleEnabled = (section: any) => {
    updateMutation.mutate({ id: section.id, data: { enabled: !section.enabled } });
  };

  const openEdit = (section: any) => {
    setForm({ ...section });
    setEditingSection(section);
    setShowForm(true);
  };

  const openNew = () => {
    setForm({ ...emptySection });
    setEditingSection(null);
    setShowForm(true);
  };

  const handleSubmit = () => {
    const payload = {
      ...form,
      priority: Number(form.priority),
      itemCount: Number(form.itemCount),
      bannerHeight: Number(form.bannerHeight),
      bannerItemWidth: Number(form.bannerItemWidth),
      bannerPriceFontSize: Number(form.bannerPriceFontSize),
      bannerNameFontSize: Number(form.bannerNameFontSize),
    };
    if (editingSection) {
      updateMutation.mutate({ id: editingSection.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">أقسام الصفحة الرئيسية</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">أضف وأدر الأقسام التي تظهر في الصفحة الرئيسية تحت الأقسام الدائرية. اسحب من المقبض ⠿ لإعادة الترتيب.</p>
          </div>
          <Button size="sm" onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" /> إضافة قسم
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
          ) : sections.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>لا توجد أقسام بعد. أضف أول قسم!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(() => { const sorted = [...sections].sort((a, b) => a.priority - b.priority); return sorted.map((section) => (
                <div
                  key={section.id}
                  onDragOver={(e) => { e.preventDefault(); if (overId !== section.id) setOverId(section.id); }}
                  onDrop={(e) => { e.preventDefault(); handleSectionDrop(sorted, section.id); }}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${dragId === section.id ? 'opacity-40' : ''} ${overId === section.id && dragId !== null && dragId !== section.id ? 'ring-2 ring-primary border-primary' : ''} ${section.enabled ? 'border-primary/30 bg-primary/5' : 'border-gray-200 bg-gray-50 opacity-60'}`}
                >
                  <div
                    draggable
                    onDragStart={() => setDragId(section.id)}
                    onDragEnd={() => { setDragId(null); setOverId(null); }}
                    className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground flex-shrink-0 touch-none"
                    title="اسحب لإعادة الترتيب"
                    data-testid={`drag-home-section-${section.id}`}
                  >
                    <GripVertical className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">ترتيب</span>
                    <span className="font-bold text-lg w-8 text-center">{section.priority}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm">{section.title}</span>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                        {PROMO_TAG_OPTIONS.find(t => t.value === section.promotionalTag)?.label || section.promotionalTag}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${section.displayMode === 'banner' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                        {section.displayMode === 'banner' ? '🎠 بنر متحرك' : '⊞ شبكة 2×2'}
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{section.itemCount} منتجات</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => toggleEnabled(section)}
                      className={`relative w-10 h-6 rounded-full transition-colors ${section.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                      data-testid={`toggle-section-${section.id}`}
                    >
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${section.enabled ? 'right-1' : 'left-1'}`} />
                    </button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(section)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => deleteMutation.mutate(section.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )); })()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* نموذج الإضافة/التعديل */}
      {showForm && (
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle className="text-base">{editingSection ? 'تعديل القسم' : 'إضافة قسم جديد'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">عنوان القسم *</Label>
                <Input value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} placeholder="مثال: عروض مميزة" data-testid="input-section-title" />
              </div>
              <div>
                <Label className="text-xs">الأولوية (ترتيب الظهور)</Label>
                <Input type="number" value={form.priority} onChange={(e) => setForm({...form, priority: Number(e.target.value)})} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">التصنيف الترويجي</Label>
                <select
                  value={form.promotionalTag}
                  onChange={(e) => setForm({...form, promotionalTag: e.target.value})}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  data-testid="select-promo-tag"
                >
                  {PROMO_TAG_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">عدد المنتجات في الرئيسية</Label>
                <select
                  value={form.itemCount}
                  onChange={(e) => setForm({...form, itemCount: Number(e.target.value)})}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  data-testid="select-item-count"
                >
                  <option value={4}>4 منتجات</option>
                  <option value={6}>6 منتجات</option>
                  <option value={8}>8 منتجات</option>
                </select>
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold block mb-2">طريقة العرض</Label>
              <div className="flex gap-3">
                <label className={`flex-1 flex items-center gap-2 border-2 rounded-xl p-3 cursor-pointer transition-all ${form.displayMode === 'grid2' ? 'border-primary bg-primary/10' : 'border-gray-200'}`}>
                  <input type="radio" name="displayMode" value="grid2" checked={form.displayMode === 'grid2'} onChange={() => setForm({...form, displayMode: 'grid2'})} className="accent-primary" />
                  <div>
                    <p className="font-bold text-sm">⊞ شبكة 2×2</p>
                    <p className="text-xs text-muted-foreground">منتجان جنباً لجنب</p>
                  </div>
                </label>
                <label className={`flex-1 flex items-center gap-2 border-2 rounded-xl p-3 cursor-pointer transition-all ${form.displayMode === 'banner' ? 'border-primary bg-primary/10' : 'border-gray-200'}`}>
                  <input type="radio" name="displayMode" value="banner" checked={form.displayMode === 'banner'} onChange={() => setForm({...form, displayMode: 'banner'})} className="accent-primary" />
                  <div>
                    <p className="font-bold text-sm">🎠 بنر متحرك</p>
                    <p className="text-xs text-muted-foreground">سكرول أفقي تلقائي</p>
                  </div>
                </label>
              </div>
            </div>
            {form.displayMode === 'banner' && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-200">
                <div>
                  <Label className="text-xs">ارتفاع البنر (px)</Label>
                  <Input type="number" value={form.bannerHeight} onChange={(e) => setForm({...form, bannerHeight: Number(e.target.value)})} placeholder="180" />
                </div>
                <div>
                  <Label className="text-xs">عرض بطاقة المنتج (px)</Label>
                  <Input type="number" value={form.bannerItemWidth} onChange={(e) => setForm({...form, bannerItemWidth: Number(e.target.value)})} placeholder="160" />
                </div>
                <div>
                  <Label className="text-xs">حجم خط اسم المنتج (px)</Label>
                  <Input type="number" value={form.bannerNameFontSize} onChange={(e) => setForm({...form, bannerNameFontSize: Number(e.target.value)})} placeholder="12" />
                </div>
                <div>
                  <Label className="text-xs">حجم خط السعر (px)</Label>
                  <Input type="number" value={form.bannerPriceFontSize} onChange={(e) => setForm({...form, bannerPriceFontSize: Number(e.target.value)})} placeholder="14" />
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="section-enabled" checked={form.enabled} onChange={(e) => setForm({...form, enabled: e.target.checked})} className="rounded" />
              <Label htmlFor="section-enabled">تفعيل القسم (ظاهر في الرئيسية)</Label>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={!form.title} data-testid="button-save-section">
                {editingSection ? 'حفظ التعديلات' : 'إضافة القسم'}
              </Button>
              <Button variant="outline" onClick={() => { setShowForm(false); setEditingSection(null); }}>إلغاء</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CollapsibleSection({
  id, title, subtitle, icon, gradient, border, children, defaultOpen = false
}: {
  id: string;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  gradient: string;
  border: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const storageKey = `admin-cs-${id}`;
  const [open, setOpen] = useState(() => {
    try {
      const v = localStorage.getItem(storageKey);
      if (v !== null) return v === 'true';
    } catch {}
    return defaultOpen;
  });
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try { localStorage.setItem(storageKey, String(next)); } catch {}
  };
  return (
    <div className={`border-2 ${border} rounded-xl overflow-hidden`}>
      <button
        type="button"
        onClick={toggle}
        className={`w-full ${gradient} px-5 py-4 flex items-center justify-between gap-3 cursor-pointer`}
        dir="rtl"
      >
        <div className="flex items-center gap-3">
          {icon}
          <div className="text-right">
            <h3 className="font-bold text-white text-base">{title}</h3>
            {subtitle && <p className="text-white/80 text-xs">{subtitle}</p>}
          </div>
        </div>
        {open
          ? <ChevronUp className="h-5 w-5 text-white/70 shrink-0" />
          : <ChevronDown className="h-5 w-5 text-white/70 shrink-0" />}
      </button>
      {open && children}
    </div>
  );
}

function DisplaySettingsSection({ adminToken }: { adminToken: string | null }) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/display-settings')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setSettings(data); })
      .finally(() => setLoading(false));
  }, []);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/admin/display-settings', {
        method: 'PATCH',
        headers: { 'x-admin-token': adminToken!, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: (data) => {
      setSettings((prev: any) => ({ ...prev, ...data }));
      toast({ title: "تم تحديث إعدادات العرض بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل تحديث إعدادات العرض", variant: "destructive" });
    },
  });

  const handleUpdate = (key: string, value: any) => {
    updateMutation.mutate({ [key]: value });
  };

  const applyPreset = (preset: Record<string, any>) => {
    setSettings((s: any) => ({ ...s, ...preset }));
    updateMutation.mutate(preset);
  };

  // تطبيق CSS Variables فوراً بعد التحديث (للمعاينة المباشرة)
  const applyLiveCSS = (key: string, value: any) => {
    const root = document.documentElement;
    const cssMap: Record<string, string> = {
      productCardHeight: '--card-image-height',
      productCardMargin: '--card-margin',
      productCardPaddingV: '--card-padding-v',
      priceFontSize: '--price-font-size',
      quantityButtonHeight: '--qty-btn-height',
      discountBubbleSize: '--discount-bubble',
      productCardWidth: '--card-width',
      discountBadgeBg: '--discount-badge-bg',
    };
    if (cssMap[key]) root.style.setProperty(cssMap[key], typeof value === 'number' ? `${value}px` : String(value));
    if (key === 'discountBubbleSize') root.style.setProperty('--discount-bubble-display', Number(value) > 0 ? 'flex' : 'none');
    if (key === 'imageMode') root.style.setProperty('--card-border-radius', value === 'full-bleed' ? '4px' : '16px');
    // ── تطبيق الخطوط فوراً ─────────────────────────────────────────────────
    const FONT_MAP: Record<string, string> = {
      'cairo':           "'Cairo', 'Segoe UI', sans-serif",
      'tajawal':         "'Tajawal', sans-serif",
      'almarai':         "'Almarai', sans-serif",
      'ibm-plex-arabic': "'IBM Plex Sans Arabic', sans-serif",
      'noto-kufi':       "'Noto Kufi Arabic', sans-serif",
      'roboto-condensed':"'Roboto Condensed', sans-serif",
      'barlow':          "'Barlow', sans-serif",
      'inter':           "'Inter', sans-serif",
      'oswald':          "'Oswald', sans-serif",
    };
    if (key === 'appFontArabic') {
      const f = FONT_MAP[value] ?? FONT_MAP['cairo'];
      root.style.setProperty('--font-arabic', f);
      root.style.setProperty('--font-sans', f);
      root.style.setProperty('--font-display', f);
      document.body.style.fontFamily = f;
    }
    if (key === 'appFontNumbers') {
      const f = FONT_MAP[value] ?? FONT_MAP['cairo'];
      root.style.setProperty('--font-numbers', f);
      // بث حدث مخصص ليلتقطه أي مكوّن يستمع
      window.dispatchEvent(new CustomEvent('oyo-font-numbers-change', { detail: { font: f } }));
    }
  };

  const handleUpdateLive = (key: string, value: any) => {
    applyLiveCSS(key, value);
    handleUpdate(key, value);
  };

  const applyPresetLive = (preset: Record<string, any>) => {
    Object.entries(preset).forEach(([k, v]) => applyLiveCSS(k, v));
    applyPreset(preset);
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Grid2x2 className="h-5 w-5" />
          إعدادات العرض والأحجام
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* ═══ أزرار الإعداد السريع ═══ */}
        <div className="bg-gradient-to-l from-primary/5 to-blue-50 border border-primary/20 rounded-xl p-4">
          <h3 className="font-bold mb-3 text-primary flex items-center gap-2">
            <Zap className="h-4 w-4" />
            إعداد سريع — تطبيق نمط كامل بضغطة واحدة
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => applyPresetLive(OYO_PRESET)}
              disabled={updateMutation.isPending}
              className="flex flex-col items-center gap-2 bg-white border-2 border-gray-200 hover:border-primary rounded-xl p-4 transition-all hover:shadow-md disabled:opacity-50"
              data-testid="button-preset-oyo"
            >
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="text-lg">🟦</span>
              </div>
              <div className="text-center">
                <p className="font-bold text-sm">وضع OYO</p>
                <p className="text-xs text-muted-foreground">صورة مرتفعة · هوامش طبيعية</p>
              </div>
            </button>
            <button
              onClick={() => applyPresetLive(SHEIN_PRESET)}
              disabled={updateMutation.isPending}
              className="flex flex-col items-center gap-2 bg-white border-2 border-orange-200 hover:border-orange-500 rounded-xl p-4 transition-all hover:shadow-md disabled:opacity-50"
              data-testid="button-preset-shein"
            >
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <span className="text-lg">🟧</span>
              </div>
              <div className="text-center">
                <p className="font-bold text-sm text-orange-600">وضع SHEIN</p>
                <p className="text-xs text-muted-foreground">Full-Bleed · سعر كبير · خصم بارز</p>
              </div>
            </button>
          </div>
          {updateMutation.isPending && (
            <p className="text-xs text-center text-muted-foreground mt-2 animate-pulse">جاري الحفظ...</p>
          )}
        </div>

        {/* Category Settings */}
        <div className="border rounded-lg p-4 space-y-4">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            إعدادات الأقسام
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>حجم أيقونة القسم (بكسل)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={40}
                  max={200}
                  value={settings?.categorySize ?? 72}
                  onChange={e => setSettings((s: any) => ({ ...s, categorySize: +e.target.value }))}
                  onBlur={e => handleUpdate('categorySize', +e.target.value)}
                  className="w-24"
                  data-testid="input-category-size"
                  disabled={updateMutation.isPending}
                />
                <span className="text-sm text-muted-foreground">بكسل</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>عدد الأقسام في الصف</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={2}
                  max={6}
                  value={settings?.categoriesPerRow ?? 4}
                  onChange={e => setSettings((s: any) => ({ ...s, categoriesPerRow: +e.target.value }))}
                  onBlur={e => handleUpdate('categoriesPerRow', +e.target.value)}
                  className="w-24"
                  data-testid="input-categories-per-row"
                  disabled={updateMutation.isPending}
                />
                <span className="text-sm text-muted-foreground">أقسام</span>
              </div>
            </div>
          </div>
          {/* إعدادات صفحة الأقسام الفرعية (CategoryPage) */}
          <div className="border-t pt-3 space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">صفحة الفئة الفرعية (شريط الدوائر)</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>حجم الدائرة (بكسل)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={48}
                    max={150}
                    value={settings?.subcategoryCircleSize ?? 72}
                    onChange={e => setSettings((s: any) => ({ ...s, subcategoryCircleSize: +e.target.value }))}
                    onBlur={e => handleUpdate('subcategoryCircleSize', +e.target.value)}
                    className="w-24"
                    data-testid="input-subcategory-circle-size"
                    disabled={updateMutation.isPending}
                  />
                  <span className="text-sm text-muted-foreground">بكسل</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>ارتفاع شريط الدوائر</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={80}
                    max={300}
                    value={settings?.subcategoryStripHeight ?? 110}
                    onChange={e => setSettings((s: any) => ({ ...s, subcategoryStripHeight: +e.target.value }))}
                    onBlur={e => handleUpdate('subcategoryStripHeight', +e.target.value)}
                    className="w-24"
                    data-testid="input-subcategory-strip-height"
                    disabled={updateMutation.isPending}
                  />
                  <span className="text-sm text-muted-foreground">بكسل</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <Label>إظهار الأقسام</Label>
            <Switch
              checked={settings?.showCategories ?? true}
              onCheckedChange={v => handleUpdate('showCategories', v)}
              disabled={updateMutation.isPending}
              data-testid="switch-show-categories"
            />
          </div>

          {/* ── طريقة عرض الأقسام الدائرية ── */}
          <div className="border-t pt-4 space-y-3">
            <Label className="text-sm font-semibold">طريقة عرض الأقسام الدائرية</Label>
            <div className="grid grid-cols-2 gap-3">
              {/* صف واحد متحرك */}
              <button
                type="button"
                onClick={() => { setSettings((s: any) => ({ ...s, categoriesLayout: "scroll" })); handleUpdate('categoriesLayout', 'scroll'); }}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                  (settings?.categoriesLayout ?? "scroll") === "scroll"
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-primary/40"
                }`}
                data-testid="layout-scroll"
                disabled={updateMutation.isPending}
              >
                {/* مؤشر مرئي — صف واحد */}
                <div className="flex gap-1.5 items-center">
                  {[0,1,2,3,4].map(i => (
                    <div key={i} className="w-6 h-6 rounded-full bg-muted-foreground/30 flex-shrink-0" />
                  ))}
                  <span className="text-xs text-muted-foreground">←</span>
                </div>
                <span className="text-xs font-semibold">صف واحد متحرك</span>
                <span className="text-[10px] text-muted-foreground text-center">السحب يميناً ويساراً</span>
              </button>

              {/* شبكة صفوف */}
              <button
                type="button"
                onClick={() => { setSettings((s: any) => ({ ...s, categoriesLayout: "grid" })); handleUpdate('categoriesLayout', 'grid'); }}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                  (settings?.categoriesLayout ?? "scroll") === "grid"
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-primary/40"
                }`}
                data-testid="layout-grid"
                disabled={updateMutation.isPending}
              >
                {/* مؤشر مرئي — شبكة */}
                <div className="grid grid-cols-4 gap-1">
                  {[0,1,2,3,4,5,6,7].map(i => (
                    <div key={i} className="w-5 h-5 rounded-full bg-muted-foreground/30" />
                  ))}
                </div>
                <span className="text-xs font-semibold">شبكة صفوف</span>
                <span className="text-[10px] text-muted-foreground text-center">4 أقسام في كل صف</span>
              </button>
            </div>

            {/* عدد الصفوف — يظهر فقط في وضع الشبكة */}
            {(settings?.categoriesLayout ?? "scroll") === "grid" && (
              <div className="flex items-center justify-between pt-1">
                <div>
                  <Label className="text-sm font-medium">عدد الصفوف</Label>
                  <p className="text-xs text-muted-foreground">كل صف يحتوي على 4 أقسام</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { const v = Math.max(1, (settings?.categoriesRows ?? 2) - 1); setSettings((s: any) => ({ ...s, categoriesRows: v })); handleUpdate('categoriesRows', v); }}
                    className="w-8 h-8 rounded-lg border flex items-center justify-center text-lg font-bold hover:bg-muted"
                    disabled={updateMutation.isPending}
                    data-testid="btn-rows-minus"
                  >−</button>
                  <span className="w-8 text-center font-bold text-lg">{settings?.categoriesRows ?? 2}</span>
                  <button
                    type="button"
                    onClick={() => { const v = Math.min(6, (settings?.categoriesRows ?? 2) + 1); setSettings((s: any) => ({ ...s, categoriesRows: v })); handleUpdate('categoriesRows', v); }}
                    className="w-8 h-8 rounded-lg border flex items-center justify-center text-lg font-bold hover:bg-muted"
                    disabled={updateMutation.isPending}
                    data-testid="btn-rows-plus"
                  >+</button>
                </div>
              </div>
            )}

            {/* معاينة نصية */}
            <p className="text-[11px] text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
              {(settings?.categoriesLayout ?? "scroll") === "scroll"
                ? "✅ الأقسام ستظهر في صف واحد أفقي يمكن السحب عليه يميناً ويساراً — جميع الأقسام ظاهرة"
                : `✅ الأقسام ستظهر في شبكة ${settings?.categoriesRows ?? 2} صفوف × 4 أعمدة = ${(settings?.categoriesRows ?? 2) * 4} قسم — الزائد يخفى`}
            </p>
          </div>

          {/* ── شكل حدود الأقسام ── */}
          <div className="border-t pt-4 space-y-4">
            <Label className="text-sm font-semibold">شكل حدود الأقسام</Label>

            {/* اختيار الشكل */}
            <div className="grid grid-cols-2 gap-3">
              {/* دائري */}
              <button
                type="button"
                onClick={() => { setSettings((s: any) => ({ ...s, categoriesShape: "circle" })); handleUpdate('categoriesShape', 'circle'); }}
                className={`flex flex-col items-center gap-2.5 p-4 rounded-xl border-2 transition-all ${
                  (settings?.categoriesShape ?? "circle") === "circle"
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-primary/40"
                }`}
                data-testid="shape-circle"
                disabled={updateMutation.isPending}
              >
                <div className="flex gap-2 items-center">
                  {[0,1,2,3].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full bg-muted-foreground/25 border border-muted-foreground/20" />
                  ))}
                </div>
                <span className="text-xs font-bold">دائري ●</span>
                <span className="text-[10px] text-muted-foreground">الشكل الكامل المستدير</span>
              </button>

              {/* زوايا مستديرة */}
              <button
                type="button"
                onClick={() => { setSettings((s: any) => ({ ...s, categoriesShape: "rounded" })); handleUpdate('categoriesShape', 'rounded'); }}
                className={`flex flex-col items-center gap-2.5 p-4 rounded-xl border-2 transition-all ${
                  (settings?.categoriesShape ?? "circle") === "rounded"
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-primary/40"
                }`}
                data-testid="shape-rounded"
                disabled={updateMutation.isPending}
              >
                <div className="flex gap-2 items-center">
                  {[0,1,2,3].map(i => (
                    <div
                      key={i}
                      className="w-8 h-8 bg-muted-foreground/25 border border-muted-foreground/20"
                      style={{ borderRadius: `${settings?.categoriesBorderRadius ?? 12}px` }}
                    />
                  ))}
                </div>
                <span className="text-xs font-bold">زوايا مستديرة ▪</span>
                <span className="text-[10px] text-muted-foreground">تحكم يدوي بالانحناء</span>
              </button>
            </div>

            {/* سلايدر الانحناء — يظهر فقط في وضع rounded */}
            {(settings?.categoriesShape ?? "circle") === "rounded" && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">درجة انحناء الزوايا</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={50}
                      className="w-16 h-8 text-sm text-center font-bold"
                      value={settings?.categoriesBorderRadius ?? 12}
                      onChange={e => {
                        const v = Math.max(0, Math.min(50, +e.target.value));
                        setSettings((s: any) => ({ ...s, categoriesBorderRadius: v }));
                      }}
                      onBlur={e => handleUpdate('categoriesBorderRadius', Math.max(0, Math.min(50, +e.target.value)))}
                      disabled={updateMutation.isPending}
                      data-testid="input-border-radius"
                    />
                    <span className="text-xs text-muted-foreground">بكسل</span>
                  </div>
                </div>

                {/* سلايدر */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-6 text-center">0</span>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    value={settings?.categoriesBorderRadius ?? 12}
                    onChange={e => {
                      const v = +e.target.value;
                      setSettings((s: any) => ({ ...s, categoriesBorderRadius: v }));
                    }}
                    onMouseUp={e => handleUpdate('categoriesBorderRadius', +(e.target as HTMLInputElement).value)}
                    onTouchEnd={e => handleUpdate('categoriesBorderRadius', +(e.target as HTMLInputElement).value)}
                    className="flex-1 accent-primary"
                    disabled={updateMutation.isPending}
                    data-testid="slider-border-radius"
                  />
                  <span className="text-xs text-muted-foreground w-6 text-center">50</span>
                </div>

                {/* معاينة حية للشكل */}
                <div className="flex items-center gap-3 pt-1">
                  <span className="text-xs text-muted-foreground">معاينة:</span>
                  <div className="flex gap-2">
                    {[0,1,2,3].map(i => (
                      <div
                        key={i}
                        className="bg-primary/20 border-2 border-primary/40 transition-all duration-200"
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: `${settings?.categoriesBorderRadius ?? 12}px`,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    {settings?.categoriesBorderRadius ?? 12}px
                  </span>
                </div>

                <p className="text-[10px] text-muted-foreground">
                  0 = مربع تماماً &nbsp;·&nbsp; 12 = ناعم &nbsp;·&nbsp; 50 = شبه دائري
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Product Card Settings */}
        <div className="border rounded-lg p-4 space-y-4">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            إعدادات بطاقة المنتج
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>عرض البطاقة (بكسل)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={100}
                  max={400}
                  value={settings?.productCardWidth ?? 160}
                  onChange={e => setSettings((s: any) => ({ ...s, productCardWidth: +e.target.value }))}
                  onBlur={e => handleUpdateLive('productCardWidth', +e.target.value)}
                  className="w-24"
                  data-testid="input-product-card-width"
                  disabled={updateMutation.isPending}
                />
                <span className="text-sm text-muted-foreground">بكسل</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>ارتفاع صورة المنتج (بكسل)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={100}
                  max={600}
                  value={settings?.productCardHeight ?? 200}
                  onChange={e => setSettings((s: any) => ({ ...s, productCardHeight: +e.target.value }))}
                  onBlur={e => handleUpdateLive('productCardHeight', +e.target.value)}
                  className="w-24"
                  data-testid="input-product-card-height"
                  disabled={updateMutation.isPending}
                />
                <span className="text-sm text-muted-foreground">بكسل</span>
              </div>
            </div>
          </div>

          {/* ─── التصميم البصري الديناميكي ─── */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-4 mt-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">التصميم البصري</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">الهوامش الجانبية (بكسل)</Label>
                <p className="text-xs text-muted-foreground">0 = Full-Bleed · 8 = عادي</p>
                <div className="flex items-center gap-2">
                  <Input type="number" min={0} max={32}
                    value={settings?.productCardMargin ?? 8}
                    onChange={e => setSettings((s: any) => ({ ...s, productCardMargin: +e.target.value }))}
                    onBlur={e => handleUpdateLive('productCardMargin', +e.target.value)}
                    className="w-20" data-testid="input-card-margin" disabled={updateMutation.isPending}
                  />
                  <span className="text-sm text-muted-foreground">بكسل</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">الحشو العمودي بين العناصر</Label>
                <p className="text-xs text-muted-foreground">4 = مضغوط · 12 = مريح</p>
                <div className="flex items-center gap-2">
                  <Input type="number" min={2} max={24}
                    value={settings?.productCardPaddingV ?? 8}
                    onChange={e => setSettings((s: any) => ({ ...s, productCardPaddingV: +e.target.value }))}
                    onBlur={e => handleUpdateLive('productCardPaddingV', +e.target.value)}
                    className="w-20" data-testid="input-card-padding-v" disabled={updateMutation.isPending}
                  />
                  <span className="text-sm text-muted-foreground">بكسل</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">حجم خط السعر</Label>
                <p className="text-xs text-muted-foreground">16 = عادي · 22 = بارز · 28 = ضخم</p>
                <div className="flex items-center gap-2">
                  <Input type="number" min={12} max={36}
                    value={settings?.priceFontSize ?? 16}
                    onChange={e => setSettings((s: any) => ({ ...s, priceFontSize: +e.target.value }))}
                    onBlur={e => handleUpdateLive('priceFontSize', +e.target.value)}
                    className="w-20" data-testid="input-price-font-size" disabled={updateMutation.isPending}
                  />
                  <span className="text-sm text-muted-foreground">بكسل</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">حجم فقاعة الخصم</Label>
                <p className="text-xs text-muted-foreground">0 = مخفية · 28 = عادي · 40 = كبيرة</p>
                <div className="flex items-center gap-2">
                  <Input type="number" min={0} max={60}
                    value={settings?.discountBubbleSize ?? 28}
                    onChange={e => setSettings((s: any) => ({ ...s, discountBubbleSize: +e.target.value }))}
                    onBlur={e => handleUpdateLive('discountBubbleSize', +e.target.value)}
                    className="w-20" data-testid="input-discount-bubble" disabled={updateMutation.isPending}
                  />
                  <span className="text-sm text-muted-foreground">بكسل</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">ارتفاع زر الإضافة للسلة</Label>
                <p className="text-xs text-muted-foreground">40 = عادي · 56 = كبير</p>
                <div className="flex items-center gap-2">
                  <Input type="number" min={32} max={72}
                    value={settings?.quantityButtonHeight ?? 40}
                    onChange={e => setSettings((s: any) => ({ ...s, quantityButtonHeight: +e.target.value }))}
                    onBlur={e => handleUpdateLive('quantityButtonHeight', +e.target.value)}
                    className="w-20" data-testid="input-qty-btn-height" disabled={updateMutation.isPending}
                  />
                  <span className="text-sm text-muted-foreground">بكسل</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">وضع الصورة</Label>
                <p className="text-xs text-muted-foreground">card = مستدير · full-bleed = حواف حادة</p>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => handleUpdateLive('imageMode', 'card')}
                    className={`flex-1 text-xs py-1.5 px-3 rounded-lg border-2 transition-all ${(settings?.imageMode ?? 'card') === 'card' ? 'border-primary bg-primary/10 text-primary font-bold' : 'border-gray-200 text-gray-500'}`}
                    data-testid="button-image-mode-card"
                  >
                    📦 Card
                  </button>
                  <button
                    onClick={() => handleUpdateLive('imageMode', 'full-bleed')}
                    className={`flex-1 text-xs py-1.5 px-3 rounded-lg border-2 transition-all ${(settings?.imageMode ?? 'card') === 'full-bleed' ? 'border-orange-500 bg-orange-50 text-orange-600 font-bold' : 'border-gray-200 text-gray-500'}`}
                    data-testid="button-image-mode-full-bleed"
                  >
                    🖼️ Full-Bleed
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ إعدادات صفحة المنتج ═══ */}
        <CollapsibleSection
          id="product-page-settings"
          title="إعدادات صفحة المنتج"
          icon={<Package className="h-5 w-5 text-white flex-shrink-0" />}
          gradient="bg-gradient-to-l from-blue-500 to-sky-500"
          border="border-blue-200 dark:border-blue-800"
        >
          <div className="p-4 space-y-4 bg-blue-50/30">
          <div className="grid grid-cols-2 gap-4">
            {/* ارتفاع الصورة الرئيسية */}
            <div className="space-y-1.5">
              <Label className="text-sm">ارتفاع الصورة الرئيسية</Label>
              <p className="text-xs text-muted-foreground">280 = مضغوط · 380 = عادي · 500 = كبير</p>
              <div className="flex items-center gap-2">
                <Input type="number" min={200} max={600}
                  value={settings?.detailImageHeight ?? 380}
                  onChange={e => setSettings((s: any) => ({ ...s, detailImageHeight: +e.target.value }))}
                  onBlur={e => handleUpdate('detailImageHeight', +e.target.value)}
                  className="w-20" data-testid="input-detail-image-height" disabled={updateMutation.isPending}
                />
                <span className="text-sm text-muted-foreground">بكسل</span>
              </div>
            </div>
            {/* حجم الصور المصغرة */}
            <div className="space-y-1.5">
              <Label className="text-sm">حجم الصور المصغرة</Label>
              <p className="text-xs text-muted-foreground">48 = صغير · 64 = عادي · 80 = كبير</p>
              <div className="flex items-center gap-2">
                <Input type="number" min={36} max={100}
                  value={settings?.detailThumbnailSize ?? 64}
                  onChange={e => setSettings((s: any) => ({ ...s, detailThumbnailSize: +e.target.value }))}
                  onBlur={e => handleUpdate('detailThumbnailSize', +e.target.value)}
                  className="w-20" data-testid="input-detail-thumb-size" disabled={updateMutation.isPending}
                />
                <span className="text-sm text-muted-foreground">بكسل</span>
              </div>
            </div>
            {/* حجم خط السعر */}
            <div className="space-y-1.5">
              <Label className="text-sm">حجم خط السعر</Label>
              <p className="text-xs text-muted-foreground">18 = عادي · 22 = بارز · 28 = ضخم</p>
              <div className="flex items-center gap-2">
                <Input type="number" min={14} max={40}
                  value={settings?.detailPriceFontSize ?? 22}
                  onChange={e => setSettings((s: any) => ({ ...s, detailPriceFontSize: +e.target.value }))}
                  onBlur={e => handleUpdate('detailPriceFontSize', +e.target.value)}
                  className="w-20" data-testid="input-detail-price-size" disabled={updateMutation.isPending}
                />
                <span className="text-sm text-muted-foreground">بكسل</span>
              </div>
            </div>
            {/* ارتفاع زر أضف للسلة */}
            <div className="space-y-1.5">
              <Label className="text-sm">ارتفاع زر الإضافة للسلة</Label>
              <p className="text-xs text-muted-foreground">44 = عادي · 52 = كبير · 64 = ضخم</p>
              <div className="flex items-center gap-2">
                <Input type="number" min={36} max={80}
                  value={settings?.detailAddToCartHeight ?? 52}
                  onChange={e => setSettings((s: any) => ({ ...s, detailAddToCartHeight: +e.target.value }))}
                  onBlur={e => handleUpdate('detailAddToCartHeight', +e.target.value)}
                  className="w-20" data-testid="input-detail-cart-btn-height" disabled={updateMutation.isPending}
                />
                <span className="text-sm text-muted-foreground">بكسل</span>
              </div>
            </div>
            {/* الحشو العمودي بين العناصر */}
            <div className="space-y-1.5">
              <Label className="text-sm">الحشو العمودي بين العناصر</Label>
              <p className="text-xs text-muted-foreground">0 = مضغوط · 8 = عادي · 16 = مريح</p>
              <div className="flex items-center gap-2">
                <Input type="number" min={0} max={32}
                  value={settings?.detailPaddingV ?? 8}
                  onChange={e => setSettings((s: any) => ({ ...s, detailPaddingV: +e.target.value }))}
                  onBlur={e => handleUpdate('detailPaddingV', +e.target.value)}
                  className="w-20" data-testid="input-detail-padding-v" disabled={updateMutation.isPending}
                />
                <span className="text-sm text-muted-foreground">بكسل</span>
              </div>
            </div>
            {/* الهوامش الجانبية */}
            <div className="space-y-1.5">
              <Label className="text-sm">الهوامش الجانبية</Label>
              <p className="text-xs text-muted-foreground">0 = Full-Bleed · 8 = ضيق · 16 = عادي</p>
              <div className="flex items-center gap-2">
                <Input type="number" min={0} max={32}
                  value={settings?.detailMarginH ?? 16}
                  onChange={e => setSettings((s: any) => ({ ...s, detailMarginH: +e.target.value }))}
                  onBlur={e => handleUpdate('detailMarginH', +e.target.value)}
                  className="w-20" data-testid="input-detail-margin-h" disabled={updateMutation.isPending}
                />
                <span className="text-sm text-muted-foreground">بكسل</span>
              </div>
            </div>
            {/* المسافة بين الأقسام */}
            <div className="space-y-1.5">
              <Label className="text-sm">المسافة بين أقسام المنتج</Label>
              <p className="text-xs text-muted-foreground">المسافة بين السعر، المقاس، الألوان، الوصف… · 8=مضغوط · 12=عادي · 20=مريح</p>
              <div className="flex items-center gap-2">
                <Input type="number" min={0} max={40}
                  value={settings?.detailSectionGap ?? 12}
                  onChange={e => setSettings((s: any) => ({ ...s, detailSectionGap: +e.target.value }))}
                  onBlur={e => handleUpdate('detailSectionGap', +e.target.value)}
                  className="w-20" data-testid="input-detail-section-gap" disabled={updateMutation.isPending}
                />
                <span className="text-sm text-muted-foreground">بكسل</span>
              </div>
            </div>
            {/* المسافة العلوية */}
            <div className="space-y-1.5">
              <Label className="text-sm">المسافة العلوية للصفحة</Label>
              <p className="text-xs text-muted-foreground">المسافة من أعلى الصفحة حتى بداية المحتوى · 0=بلا · 8=عادي · 16=واسع</p>
              <div className="flex items-center gap-2">
                <Input type="number" min={0} max={40}
                  value={settings?.detailTopPadding ?? 8}
                  onChange={e => setSettings((s: any) => ({ ...s, detailTopPadding: +e.target.value }))}
                  onBlur={e => handleUpdate('detailTopPadding', +e.target.value)}
                  className="w-20" data-testid="input-detail-top-padding" disabled={updateMutation.isPending}
                />
                <span className="text-sm text-muted-foreground">بكسل</span>
              </div>
            </div>
            {/* حجم فقاعة الخصم */}
            <div className="space-y-1.5">
              <Label className="text-sm">حجم فقاعة الخصم</Label>
              <p className="text-xs text-muted-foreground">0 = مخفية · 24 = صغيرة · 36 = عادية · 48 = كبيرة</p>
              <div className="flex items-center gap-2">
                <Input type="number" min={0} max={64}
                  value={settings?.detailDiscountBubbleSize ?? 36}
                  onChange={e => setSettings((s: any) => ({ ...s, detailDiscountBubbleSize: +e.target.value }))}
                  onBlur={e => handleUpdate('detailDiscountBubbleSize', +e.target.value)}
                  className="w-20" data-testid="input-detail-discount-bubble" disabled={updateMutation.isPending}
                />
                <span className="text-sm text-muted-foreground">بكسل</span>
              </div>
            </div>
          </div>

          {/* وضع الصورة */}
          <div className="space-y-1.5">
            <Label className="text-sm">وضع عرض الصورة الرئيسية</Label>
            <p className="text-xs text-muted-foreground">contain = كاملة مع حواف · cover = ملء الإطار</p>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => handleUpdate('detailImageMode', 'contain')}
                className={`flex-1 text-xs py-2 px-3 rounded-lg border-2 transition-all ${(settings?.detailImageMode ?? 'contain') === 'contain' ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold' : 'border-gray-200 text-gray-500'}`}
                data-testid="button-detail-image-contain"
              >
                📦 Contain (كاملة)
              </button>
              <button
                onClick={() => handleUpdate('detailImageMode', 'cover')}
                className={`flex-1 text-xs py-2 px-3 rounded-lg border-2 transition-all ${(settings?.detailImageMode ?? 'contain') === 'cover' ? 'border-orange-500 bg-orange-50 text-orange-600 font-bold' : 'border-gray-200 text-gray-500'}`}
                data-testid="button-detail-image-cover"
              >
                🖼️ Cover (ملء)
              </button>
            </div>
          </div>

          {/* مفاتيح الأقسام */}
          <div className="space-y-3 pt-2 border-t">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">إظهار / إخفاء الأقسام</p>
            {/* الصور المصغرة */}
            <div className="flex items-center justify-between">
              <div>
                <Label>الصور المصغرة تحت الصورة الرئيسية</Label>
                <p className="text-xs text-muted-foreground">شريط الصور الصغيرة أسفل صورة المنتج الرئيسية</p>
              </div>
              <Switch
                checked={settings?.detailShowThumbnails ?? true}
                onCheckedChange={v => handleUpdate('detailShowThumbnails', v)}
                disabled={updateMutation.isPending}
                data-testid="switch-detail-show-thumbnails"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>المنتجات المشابهة</Label>
                <p className="text-xs text-muted-foreground">قسم "منتجات مشابهة" أسفل الصفحة</p>
              </div>
              <Switch
                checked={settings?.detailShowRelated ?? true}
                onCheckedChange={v => handleUpdate('detailShowRelated', v)}
                disabled={updateMutation.isPending}
                data-testid="switch-detail-show-related"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>التقييمات والمراجعات</Label>
                <p className="text-xs text-muted-foreground">قسم التقييمات أسفل الصفحة</p>
              </div>
              <Switch
                checked={settings?.detailShowReviews ?? true}
                onCheckedChange={v => handleUpdate('detailShowReviews', v)}
                disabled={updateMutation.isPending}
                data-testid="switch-detail-show-reviews"
              />
            </div>
            {/* شريط السلة الثابت */}
            <div className="flex items-center justify-between">
              <div>
                <Label>شريط "أضف للسلة" الثابت أسفل الشاشة</Label>
                <p className="text-xs text-muted-foreground">يظهر شريط لاصق بزرَّي "أضف للسلة" و"تسوق الآن" في صفحة المنتج</p>
              </div>
              <Switch
                checked={settings?.showStickyCartBar ?? true}
                onCheckedChange={v => handleUpdate('showStickyCartBar', v)}
                disabled={updateMutation.isPending}
                data-testid="switch-show-sticky-cart-bar"
              />
            </div>

            {/* أزرار السلة في صفحة المنتج */}
            <div className="flex items-center justify-between">
              <div>
                <Label>زر "أضف للسلة" في الشريط الثابت</Label>
                <p className="text-xs text-muted-foreground">يُظهر/يُخفي زر إضافة للسلة في الشريط اللاصق أسفل صفحة المنتج</p>
              </div>
              <Switch
                checked={settings?.detailShowAddToCart ?? true}
                onCheckedChange={v => handleUpdate('detailShowAddToCart', v)}
                disabled={updateMutation.isPending}
                data-testid="switch-detail-show-add-to-cart"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>زر "تسوق الآن" في الشريط الثابت</Label>
                <p className="text-xs text-muted-foreground">يُظهر/يُخفي زر الشراء الفوري في الشريط اللاصق أسفل صفحة المنتج</p>
              </div>
              <Switch
                checked={settings?.detailShowShopNow ?? true}
                onCheckedChange={v => handleUpdate('detailShowShopNow', v)}
                disabled={updateMutation.isPending}
                data-testid="switch-detail-show-shop-now"
              />
            </div>

            {/* لون بادج الخصم */}
            <div className="flex items-center justify-between">
              <div>
                <Label>لون بادج الخصم</Label>
                <p className="text-xs text-muted-foreground">لون خلفية فقاعة النسبة المئوية للخصم على بطاقة المنتج</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings?.discountBadgeBg ?? '#ef4444'}
                  onChange={e => setSettings((s: any) => ({ ...s, discountBadgeBg: e.target.value }))}
                  onBlur={e => handleUpdate('discountBadgeBg', e.target.value)}
                  className="w-10 h-10 rounded-lg border cursor-pointer"
                  data-testid="input-discount-badge-bg"
                />
                <span className="text-xs font-mono">{settings?.discountBadgeBg ?? '#ef4444'}</span>
              </div>
            </div>
          </div>
          </div>

          {/* ─── منتقي الألوان (PDP) ───────────────────────────────────────────── */}
          <div className="mt-4 border-t pt-4 space-y-4">
            <p className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide flex items-center gap-2">
              <span>🎨</span> منتقي الألوان
            </p>

            {/* عرض وارتفاع الصورة المصغرة */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">عرض الصورة</Label>
                <p className="text-xs text-muted-foreground">48=صغير · 72=عادي · 96=كبير</p>
                <div className="flex items-center gap-1.5">
                  <Input type="number" min={32} max={160}
                    value={settings?.pdpColorThumbnailW ?? 72}
                    onChange={e => setSettings((s: any) => ({ ...s, pdpColorThumbnailW: +e.target.value }))}
                    onBlur={e => handleUpdate('pdpColorThumbnailW', +e.target.value)}
                    className="w-20" data-testid="input-pdp-color-w" disabled={updateMutation.isPending}
                  />
                  <span className="text-xs text-muted-foreground">بكسل</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">ارتفاع الصورة</Label>
                <p className="text-xs text-muted-foreground">48=صغير · 72=عادي · 96=كبير</p>
                <div className="flex items-center gap-1.5">
                  <Input type="number" min={32} max={160}
                    value={settings?.pdpColorThumbnailH ?? 72}
                    onChange={e => setSettings((s: any) => ({ ...s, pdpColorThumbnailH: +e.target.value }))}
                    onBlur={e => handleUpdate('pdpColorThumbnailH', +e.target.value)}
                    className="w-20" data-testid="input-pdp-color-h" disabled={updateMutation.isPending}
                  />
                  <span className="text-xs text-muted-foreground">بكسل</span>
                </div>
              </div>
            </div>

            {/* تخطيط الألوان */}
            <div className="space-y-1.5">
              <Label className="text-sm">تخطيط الألوان</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {[
                  { v: 'scroll', label: '↔ تمرير أفقي', desc: 'شريط قابل للتمرير' },
                  { v: 'grid2', label: '⊞ شبكة × 2', desc: 'عمودان متوازيان' },
                  { v: 'grid3', label: '⊟ شبكة × 3', desc: 'ثلاثة أعمدة' },
                ].map(opt => (
                  <button key={opt.v}
                    onClick={() => handleUpdate('pdpColorLayout', opt.v)}
                    title={opt.desc}
                    className={`text-xs py-1.5 px-3 rounded-lg border-2 transition-all ${(settings?.pdpColorLayout ?? 'scroll') === opt.v ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                    data-testid={`button-pdp-color-layout-${opt.v}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* قابل للطي */}
            <div className="flex items-center justify-between py-1">
              <div>
                <Label className="text-sm">قابل للطي</Label>
                <p className="text-xs text-muted-foreground">يُمكن إخفاء الألوان وإظهارها بالضغط على العنوان</p>
              </div>
              <Switch
                checked={settings?.pdpColorCollapsible ?? false}
                onCheckedChange={v => handleUpdate('pdpColorCollapsible', v)}
                disabled={updateMutation.isPending}
                data-testid="switch-pdp-color-collapsible"
              />
            </div>
          </div>

          {/* ─── منتقي المقاس (PDP) ────────────────────────────────────────────── */}
          <div className="mt-4 border-t pt-4 space-y-4">
            <p className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide flex items-center gap-2">
              <span>📐</span> منتقي المقاس
            </p>

            {/* أبعاد زر المقاس */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">عرض الزر</Label>
                <p className="text-xs text-muted-foreground">0 = تلقائي · أو عدد بكسل محدد</p>
                <div className="flex items-center gap-1.5">
                  <Input type="number" min={0} max={240}
                    value={settings?.pdpSizeButtonW ?? 0}
                    onChange={e => setSettings((s: any) => ({ ...s, pdpSizeButtonW: +e.target.value }))}
                    onBlur={e => handleUpdate('pdpSizeButtonW', +e.target.value)}
                    className="w-20" data-testid="input-pdp-size-w" disabled={updateMutation.isPending}
                  />
                  <span className="text-xs text-muted-foreground">بكسل</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">ارتفاع الزر</Label>
                <p className="text-xs text-muted-foreground">44=عادي · 56=كبير · 68=ضخم</p>
                <div className="flex items-center gap-1.5">
                  <Input type="number" min={32} max={100}
                    value={settings?.pdpSizeButtonH ?? 56}
                    onChange={e => setSettings((s: any) => ({ ...s, pdpSizeButtonH: +e.target.value }))}
                    onBlur={e => handleUpdate('pdpSizeButtonH', +e.target.value)}
                    className="w-20" data-testid="input-pdp-size-h" disabled={updateMutation.isPending}
                  />
                  <span className="text-xs text-muted-foreground">بكسل</span>
                </div>
              </div>
            </div>

            {/* تخطيط المقاسات */}
            <div className="space-y-1.5">
              <Label className="text-sm">تخطيط المقاسات</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {[
                  { v: 'wrap', label: '⬛ لف تلقائي', desc: 'أزرار تنتقل للسطر التالي عند الامتلاء' },
                  { v: 'row', label: '↔ صف أفقي', desc: 'شريط أفقي قابل للتمرير' },
                  { v: 'vertical', label: '↕ عمودي', desc: 'أزرار رأسية كاملة العرض' },
                  { v: 'grid2', label: '⊞ شبكة × 2', desc: 'عمودان' },
                ].map(opt => (
                  <button key={opt.v}
                    onClick={() => handleUpdate('pdpSizeLayout', opt.v)}
                    title={opt.desc}
                    className={`text-xs py-1.5 px-3 rounded-lg border-2 transition-all ${(settings?.pdpSizeLayout ?? 'wrap') === opt.v ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                    data-testid={`button-pdp-size-layout-${opt.v}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* شكل الزر */}
            <div className="space-y-1.5">
              <Label className="text-sm">شكل الزر</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {[
                  { v: 'card', label: '🟦 بطاقة', desc: 'زوايا دائرية كبيرة' },
                  { v: 'pill', label: '💊 حبة', desc: 'حواف دائرية كاملة' },
                  { v: 'square', label: '⬜ مربع', desc: 'زوايا مستقيمة' },
                  { v: 'full', label: '🔳 كامل العرض', desc: 'يأخذ كامل عرض الصف' },
                ].map(opt => (
                  <button key={opt.v}
                    onClick={() => handleUpdate('pdpSizeStyle', opt.v)}
                    title={opt.desc}
                    className={`text-xs py-1.5 px-3 rounded-lg border-2 transition-all ${(settings?.pdpSizeStyle ?? 'card') === opt.v ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                    data-testid={`button-pdp-size-style-${opt.v}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* إظهار السعر مع المقاس */}
            <div className="flex items-center justify-between py-1">
              <div>
                <Label className="text-sm">إظهار السعر مع كل مقاس</Label>
                <p className="text-xs text-muted-foreground">يُظهر سعر المقاس داخل الزر عند وجود أسعار متعددة</p>
              </div>
              <Switch
                checked={settings?.pdpSizeShowPrice !== false}
                onCheckedChange={v => handleUpdate('pdpSizeShowPrice', v)}
                disabled={updateMutation.isPending}
                data-testid="switch-pdp-size-show-price"
              />
            </div>

            {/* قابل للطي */}
            <div className="flex items-center justify-between py-1">
              <div>
                <Label className="text-sm">قابل للطي</Label>
                <p className="text-xs text-muted-foreground">يُمكن إخفاء المقاسات وإظهارها بالضغط على العنوان</p>
              </div>
              <Switch
                checked={settings?.pdpSizeCollapsible ?? false}
                onCheckedChange={v => handleUpdate('pdpSizeCollapsible', v)}
                disabled={updateMutation.isPending}
                data-testid="switch-pdp-size-collapsible"
              />
            </div>
          </div>

        </CollapsibleSection>

        {/* ─── الخطوط وتصميم الواجهة ──────────────────────────────────────── */}
        <CollapsibleSection
          id="fonts-ui"
          title="الخطوط وتصميم الواجهة"
          subtitle="اختر خط النصوص العربية وخط الأرقام لمطابقة هوية متجرك"
          icon={<span className="text-xl">🔤</span>}
          gradient="bg-gradient-to-l from-purple-600 to-violet-600"
          border="border-purple-200 dark:border-purple-800"
        >
          <div className="p-4 space-y-4 bg-white dark:bg-gray-900">
            {/* خط العربية */}
            <div className="space-y-2">
              <Label className="font-semibold">خط النصوص العربية</Label>
              <p className="text-xs text-muted-foreground">يطبّق على جميع نصوص الواجهة — العناوين، الأوصاف، الأزرار</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'cairo',           label: 'Cairo',            preview: 'أويو بلاست',    hint: 'مستخدم في Noon / Namshi' },
                  { key: 'tajawal',         label: 'Tajawal',          preview: 'أويو بلاست',    hint: 'مستخدم في Amazon Arabia' },
                  { key: 'almarai',         label: 'Almarai',          preview: 'أويو بلاست',    hint: 'مستخدم في أسواق الخليج' },
                  { key: 'ibm-plex-arabic', label: 'IBM Plex Arabic',  preview: 'أويو بلاست',    hint: 'خط تقني واضح' },
                  { key: 'noto-kufi',       label: 'Noto Kufi Arabic', preview: 'أويو بلاست',    hint: 'خط كوفي حديث' },
                ].map(f => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => { setSettings((s: any) => ({ ...s, appFontArabic: f.key })); handleUpdateLive('appFontArabic', f.key); }}
                    data-testid={`button-font-arabic-${f.key}`}
                    className={`p-3 rounded-xl border-2 text-right transition-all ${
                      (settings?.appFontArabic ?? 'cairo') === f.key
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                        : 'border-gray-200 hover:border-purple-300'
                    }`}
                    style={{ fontFamily: f.key === 'cairo' ? 'Cairo' : f.key === 'tajawal' ? 'Tajawal' : f.key === 'almarai' ? 'Almarai' : f.key === 'ibm-plex-arabic' ? '"IBM Plex Sans Arabic"' : '"Noto Kufi Arabic"' }}
                  >
                    <div className="text-sm font-bold">{f.preview}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{f.label}</div>
                    <div className="text-[9px] text-purple-500 mt-0.5">{f.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* خط الأرقام */}
            <div className="space-y-2">
              <Label className="font-semibold">خط الأرقام والأسعار</Label>
              <p className="text-xs text-muted-foreground">يطبّق على الأرقام والأسعار فقط — يمنح مظهر متجر احترافي</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'cairo',            label: 'Cairo',             preview: '١٢٫٥٠٠ ر.ي', hint: 'افتراضي' },
                  { key: 'roboto-condensed', label: 'Roboto Condensed',  preview: '12,500 ر.ي',  hint: 'مستخدم في Amazon' },
                  { key: 'barlow',           label: 'Barlow',            preview: '12,500 ر.ي',  hint: 'خط عصري' },
                  { key: 'inter',            label: 'Inter',             preview: '12,500 ر.ي',  hint: 'مستخدم في SHEIN' },
                  { key: 'oswald',           label: 'Oswald',            preview: '12,500 ر.ي',  hint: 'خط قوي للأسعار' },
                ].map(f => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => { setSettings((s: any) => ({ ...s, appFontNumbers: f.key })); handleUpdateLive('appFontNumbers', f.key); }}
                    data-testid={`button-font-numbers-${f.key}`}
                    className={`p-3 rounded-xl border-2 text-right transition-all ${
                      (settings?.appFontNumbers ?? 'cairo') === f.key
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                        : 'border-gray-200 hover:border-purple-300'
                    }`}
                    style={{ fontFamily: f.key === 'cairo' ? 'Cairo' : f.key === 'roboto-condensed' ? '"Roboto Condensed"' : f.key === 'barlow' ? 'Barlow' : f.key === 'inter' ? 'Inter' : 'Oswald' }}
                  >
                    <div className="text-base font-bold">{f.preview}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{f.label}</div>
                    <div className="text-[9px] text-purple-500 mt-0.5">{f.hint}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* ─── تحكم البنرات والعروض ─────────────────────────────────────── */}
        <CollapsibleSection
          id="banners-offers"
          title="تحكم البنرات والعروض"
          subtitle="ضبط الأبعاد (عرض + ارتفاع) للسلايدر وبنرات العروض"
          icon={<Zap className="h-5 w-5 text-white flex-shrink-0" />}
          gradient="bg-gradient-to-l from-blue-600 to-cyan-600"
          border="border-blue-200 dark:border-blue-800"
        >
          <div className="p-5 space-y-6 bg-blue-50/30 dark:bg-blue-950/20">

            {/* ── البنرات الرئيسية (Slider) ── */}
            <div className="space-y-4">
              <p className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                🖼 البنرات الرئيسية (السلايدر)
              </p>

              {/* الارتفاع */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">الارتفاع</Label>
                  <p className="text-xs text-muted-foreground">ارتفاع صورة السلايدر (بكسل)</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Input
                    type="number"
                    min={120}
                    max={700}
                    step={10}
                    value={settings?.sliderHeight ?? 414}
                    onChange={e => setSettings((s: any) => ({ ...s, sliderHeight: +e.target.value }))}
                    onBlur={e => handleUpdate('sliderHeight', +e.target.value)}
                    className="w-24 text-center font-bold"
                    data-testid="input-slider-height"
                    disabled={updateMutation.isPending}
                  />
                  <span className="text-xs text-muted-foreground">px</span>
                </div>
              </div>

              {/* العرض — معلومة */}
              <div className="flex items-center justify-between py-2 border-t border-blue-100 dark:border-blue-900">
                <div>
                  <Label className="text-sm font-medium">العرض</Label>
                  <p className="text-xs text-muted-foreground">السلايدر دائماً بعرض الشاشة كاملاً (100%)</p>
                </div>
                <span className="text-xs font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">
                  100%
                </span>
              </div>

              {/* معاينة الارتفاع */}
              <div className="bg-blue-100/50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  معاينة: السلايدر بارتفاع{" "}
                  <span className="font-bold text-sm">{settings?.sliderHeight ?? 414}px</span>
                  {" "}× عرض الشاشة كاملاً
                </p>
                <div
                  className="mt-2 bg-blue-300/40 rounded-lg flex items-center justify-center text-blue-600 font-bold text-xs"
                  style={{ height: `${Math.min((settings?.sliderHeight ?? 414) / 4, 80)}px` }}
                >
                  {settings?.sliderHeight ?? 414}px
                </div>
              </div>
            </div>

            {/* ── بنرات العروض الخاصة ── */}
            <div className="space-y-4 pt-4 border-t-2 border-blue-100 dark:border-blue-900">
              <p className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                ⚡ بنرات العروض (شحن مجاني / عروض سريعة)
              </p>

              {/* الارتفاع */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">الارتفاع</Label>
                  <p className="text-xs text-muted-foreground">ارتفاع كل بطاقة عرض (بكسل)</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Input
                    type="number"
                    min={40}
                    max={200}
                    step={4}
                    value={settings?.offerBannerHeight ?? 72}
                    onChange={e => setSettings((s: any) => ({ ...s, offerBannerHeight: +e.target.value }))}
                    onBlur={e => handleUpdate('offerBannerHeight', +e.target.value)}
                    className="w-24 text-center font-bold"
                    data-testid="input-offer-banner-height"
                    disabled={updateMutation.isPending}
                  />
                  <span className="text-xs text-muted-foreground">px</span>
                </div>
              </div>

              {/* ألوان البنرات */}
              <div className="py-3 border-t border-blue-100 dark:border-blue-900 space-y-3">
                <Label className="text-sm font-medium block">ألوان خلفية البنرات</Label>
                <div className="grid grid-cols-2 gap-3">
                  {/* شحن مجاني */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">🚚 شحن مجاني</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings?.offerBannerShippingBg?.startsWith('#') ? settings.offerBannerShippingBg : '#f0fdf4'}
                        onChange={e => setSettings((s: any) => ({ ...s, offerBannerShippingBg: e.target.value }))}
                        onBlur={e => handleUpdate('offerBannerShippingBg', e.target.value)}
                        className="h-9 w-12 rounded border cursor-pointer"
                        data-testid="color-shipping-bg"
                      />
                      <Input
                        value={settings?.offerBannerShippingBg ?? ''}
                        onChange={e => setSettings((s: any) => ({ ...s, offerBannerShippingBg: e.target.value }))}
                        onBlur={e => handleUpdate('offerBannerShippingBg', e.target.value)}
                        placeholder="linear-gradient(…) أو #f0fdf4"
                        className="text-xs h-9 font-mono"
                        data-testid="input-shipping-bg"
                      />
                    </div>
                  </div>
                  {/* عروض سريعة */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">⚡ عروض سريعة</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings?.offerBannerDealsBg?.startsWith('#') ? settings.offerBannerDealsBg : '#fefce8'}
                        onChange={e => setSettings((s: any) => ({ ...s, offerBannerDealsBg: e.target.value }))}
                        onBlur={e => handleUpdate('offerBannerDealsBg', e.target.value)}
                        className="h-9 w-12 rounded border cursor-pointer"
                        data-testid="color-deals-bg"
                      />
                      <Input
                        value={settings?.offerBannerDealsBg ?? ''}
                        onChange={e => setSettings((s: any) => ({ ...s, offerBannerDealsBg: e.target.value }))}
                        onBlur={e => handleUpdate('offerBannerDealsBg', e.target.value)}
                        placeholder="linear-gradient(…) أو #fefce8"
                        className="text-xs h-9 font-mono"
                        data-testid="input-deals-bg"
                      />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">يمكنك إدخال لون (#hex) أو تدرج (linear-gradient(…))</p>
              </div>

              {/* العرض — عدد الأعمدة */}
              <div className="flex items-center justify-between py-3 border-t border-blue-100 dark:border-blue-900">
                <div>
                  <Label className="text-sm font-medium">العرض (عدد الأعمدة)</Label>
                  <p className="text-xs text-muted-foreground">
                    {(settings?.offerBannerCols ?? 2) === 1
                      ? "عمود واحد — كل بطاقة بعرض الشاشة كاملاً"
                      : "عمودان — كل بطاقة بنصف عرض الشاشة"}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {[1, 2].map(col => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => { handleUpdate('offerBannerCols', col); setSettings((s: any) => ({ ...s, offerBannerCols: col })); }}
                      disabled={updateMutation.isPending}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                        (settings?.offerBannerCols ?? 2) === col
                          ? "bg-blue-600 text-white shadow-sm"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                      data-testid={`button-offer-cols-${col}`}
                    >
                      {col === 1 ? "□ عمود" : "□□ عمودان"}
                    </button>
                  ))}
                </div>
              </div>

              {/* إظهار / إخفاء */}
              <div className="flex items-center justify-between py-3 border-t border-blue-100 dark:border-blue-900">
                <div>
                  <Label className="text-sm font-medium">إظهار بنرات العروض</Label>
                  <p className="text-xs text-muted-foreground">إخفاء هذا القسم من الصفحة الرئيسية</p>
                </div>
                <Switch
                  checked={settings?.showOfferBanners ?? true}
                  onCheckedChange={v => handleUpdate('showOfferBanners', v)}
                  disabled={updateMutation.isPending}
                  data-testid="switch-show-offer-banners"
                />
              </div>

              {/* ── بنر عروض اليوم (Flash Sale) ── */}
              <div className="space-y-3 rounded-xl border-2 border-orange-200 dark:border-orange-800 p-4 bg-orange-50/30 dark:bg-orange-950/20 mt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-semibold text-sm">🔥 بنر عروض اليوم</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">إظهار/إخفاء قسم عروض اليوم في الصفحة الرئيسية</p>
                  </div>
                  <Switch
                    checked={settings?.flashSaleEnabled !== false}
                    onCheckedChange={v => { setSettings((s: any) => ({ ...s, flashSaleEnabled: v })); handleUpdate('flashSaleEnabled', v); }}
                    disabled={updateMutation.isPending}
                    data-testid="switch-flash-sale-enabled"
                  />
                </div>
                {settings?.flashSaleEnabled !== false && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">الوسم المرتبط بالمنتجات</Label>
                      <Input
                        value={settings?.flashSaleTag ?? "flash"}
                        onChange={e => setSettings((s: any) => ({ ...s, flashSaleTag: e.target.value }))}
                        onBlur={e => handleUpdate('flashSaleTag', e.target.value)}
                        placeholder="flash"
                        data-testid="input-flash-sale-tag"
                      />
                      <p className="text-xs text-muted-foreground">أضف منتجات بهذا الوسم من إدارة المنتجات لتظهر هنا</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">لون/تدرج خلفية البنر</Label>
                      <div className="flex gap-2 items-center">
                        <Input
                          type="color"
                          defaultValue="#ff4e00"
                          onChange={e => { setSettings((s: any) => ({ ...s, flashSaleBg: e.target.value })); handleUpdate('flashSaleBg', e.target.value); }}
                          className="w-12 h-9 p-1 cursor-pointer"
                          data-testid="color-flash-sale-bg"
                        />
                        <Input
                          value={settings?.flashSaleBg ?? "linear-gradient(135deg, #ff4e00 0%, #ec9f05 100%)"}
                          onChange={e => setSettings((s: any) => ({ ...s, flashSaleBg: e.target.value }))}
                          onBlur={e => handleUpdate('flashSaleBg', e.target.value)}
                          placeholder="linear-gradient(…) أو #hex"
                          className="text-xs h-9 font-mono flex-1"
                          data-testid="input-flash-sale-bg"
                        />
                      </div>
                      <div className="rounded-xl px-4 py-2.5 flex items-center gap-2"
                        style={{ background: settings?.flashSaleBg ?? "linear-gradient(135deg, #ff4e00 0%, #ec9f05 100%)" }}>
                        <span className="text-white font-black text-sm">🔥 عروض اليوم</span>
                        <span className="text-white/80 text-xs">— معاينة</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* معاينة مصغّرة */}
              <div className="bg-blue-100/50 dark:bg-blue-900/20 rounded-xl p-3">
                <p className="text-xs text-blue-600 dark:text-blue-400 text-center mb-2">معاينة التخطيط</p>
                <div className={`grid gap-1 ${(settings?.offerBannerCols ?? 2) === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                  {[0, 1].slice(0, (settings?.offerBannerCols ?? 2) > 1 ? 2 : 1).map(i => (
                    <div
                      key={i}
                      className="bg-blue-200/60 dark:bg-blue-800/40 rounded flex items-center justify-center text-blue-600 text-xs font-bold"
                      style={{ height: `${Math.min((settings?.offerBannerHeight ?? 72) / 2.5, 48)}px` }}
                    >
                      {i === 0 ? "🚚 شحن" : "⚡ عروض"}
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </CollapsibleSection>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 🌌 سديم الذكية — لوحة التحكم المتقدمة لصفحة المنتج          */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <CollapsibleSection
          id="sadeem-smart"
          title="سديم الذكية"
          subtitle="تحكم ديناميكي كامل بعناصر صفحة المنتج"
          icon={<Sparkles className="h-5 w-5 text-white flex-shrink-0" />}
          gradient="bg-gradient-to-l from-purple-600 to-indigo-600"
          border="border-purple-200 dark:border-purple-800"
        >
          <div className="p-5 space-y-6 bg-purple-50/30 dark:bg-purple-950/20">

            {/* ─── 1. قسم السعر والخصم ─────────────────────────────────── */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wide flex items-center gap-2">
                <Percent className="h-3.5 w-3.5" /> السعر والخصم
              </p>

              <div className="flex items-center justify-between py-2 border-b border-purple-100 dark:border-purple-900">
                <div>
                  <Label className="text-sm font-medium">السعر القديم المشطوب</Label>
                  <p className="text-xs text-muted-foreground">عرض السعر الأصلي مشطوباً بجانب السعر الجديد</p>
                </div>
                <Switch
                  checked={settings?.sadeemShowOldPrice ?? true}
                  onCheckedChange={v => handleUpdate('sadeemShowOldPrice', v)}
                  disabled={updateMutation.isPending}
                  data-testid="switch-sadeem-show-old-price"
                />
              </div>

              <div className="flex items-center justify-between py-2 border-b border-purple-100 dark:border-purple-900">
                <div>
                  <Label className="text-sm font-medium">بادج نسبة الخصم (-%)</Label>
                  <p className="text-xs text-muted-foreground">الشارة الحمراء التي تُظهر نسبة الخصم</p>
                </div>
                <Switch
                  checked={settings?.sadeemShowDiscountBadge ?? true}
                  onCheckedChange={v => handleUpdate('sadeemShowDiscountBadge', v)}
                  disabled={updateMutation.isPending}
                  data-testid="switch-sadeem-show-discount-badge"
                />
              </div>
            </div>

            {/* ─── 2. قسم معلومات المنتج ───────────────────────────────── */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wide flex items-center gap-2">
                <Star className="h-3.5 w-3.5" /> معلومات المنتج
              </p>

              <div className="flex items-center justify-between py-2 border-b border-purple-100 dark:border-purple-900">
                <div>
                  <Label className="text-sm font-medium">تقييم النجوم</Label>
                  <p className="text-xs text-muted-foreground">عرض نجوم التقييم وعدد المراجعات</p>
                </div>
                <Switch
                  checked={settings?.sadeemShowRating ?? true}
                  onCheckedChange={v => handleUpdate('sadeemShowRating', v)}
                  disabled={updateMutation.isPending}
                  data-testid="switch-sadeem-show-rating"
                />
              </div>

              <div className="flex items-center justify-between py-2 border-b border-purple-100 dark:border-purple-900">
                <div>
                  <Label className="text-sm font-medium">عدد الوحدات المباعة</Label>
                  <p className="text-xs text-muted-foreground">شارة "تم بيع X قطعة"</p>
                </div>
                <Switch
                  checked={settings?.sadeemShowSoldCount ?? true}
                  onCheckedChange={v => handleUpdate('sadeemShowSoldCount', v)}
                  disabled={updateMutation.isPending}
                  data-testid="switch-sadeem-show-sold-count"
                />
              </div>
            </div>

            {/* ─── 3. قسم الشحن والخدمات ───────────────────────────────── */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wide flex items-center gap-2">
                <Truck className="h-3.5 w-3.5" /> الشحن والخدمات
              </p>

              <div className="flex items-center justify-between py-2 border-b border-purple-100 dark:border-purple-900">
                <div>
                  <Label className="text-sm font-medium">بطاقة معلومات الشحن</Label>
                  <p className="text-xs text-muted-foreground">تُظهر حالة الشحن المجاني أو شرطه</p>
                </div>
                <Switch
                  checked={settings?.sadeemShowShipping ?? true}
                  onCheckedChange={v => handleUpdate('sadeemShowShipping', v)}
                  disabled={updateMutation.isPending}
                  data-testid="switch-sadeem-show-shipping"
                />
              </div>

              {/* الحد الأدنى للشحن المجاني */}
              <div className="py-2 border-b border-purple-100 dark:border-purple-900 space-y-2">
                <Label className="text-sm font-medium">الحد الأدنى للشحن المجاني</Label>
                <p className="text-xs text-muted-foreground">اضبط على 0 للشحن المجاني الدائم لجميع الطلبات</p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    step={1000}
                    value={settings?.sadeemFreeShippingMin ?? 0}
                    onChange={e => setSettings((s: any) => ({ ...s, sadeemFreeShippingMin: +e.target.value }))}
                    onBlur={e => handleUpdate('sadeemFreeShippingMin', +e.target.value)}
                    className="w-36"
                    disabled={updateMutation.isPending}
                    data-testid="input-sadeem-free-shipping-min"
                  />
                  <span className="text-sm text-muted-foreground">ريال يمني (0 = مجاني دائماً)</span>
                </div>
                {(settings?.sadeemFreeShippingMin ?? 0) > 0 && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-1 rounded">
                    💡 الشحن مجاني للطلبات فوق {Number(settings?.sadeemFreeShippingMin ?? 0).toLocaleString('ar')} ريال يمني
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between py-2 border-b border-purple-100 dark:border-purple-900">
                <div>
                  <Label className="text-sm font-medium">سياسة الإرجاع المجاني</Label>
                  <p className="text-xs text-muted-foreground">بطاقة "إرجاع مجاني خلال 7 أيام"</p>
                </div>
                <Switch
                  checked={settings?.sadeemShowReturns ?? true}
                  onCheckedChange={v => handleUpdate('sadeemShowReturns', v)}
                  disabled={updateMutation.isPending}
                  data-testid="switch-sadeem-show-returns"
                />
              </div>
            </div>

            {/* ─── 4. نظام المسوقين ─────────────────────────────────────── */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wide flex items-center gap-2">
                <Users className="h-3.5 w-3.5" /> نظام المسوقين
              </p>

              <div className="py-2 space-y-2">
                <Label className="text-sm font-medium">نسبة خصم المسوقين الإضافي</Label>
                <p className="text-xs text-muted-foreground">
                  هذا الخصم يظهر فقط للزوار القادمين عبر رابط المسوق
                  <span className="font-mono text-purple-600 dark:text-purple-400 mx-1">?ref=CODE</span>
                  أو
                  <span className="font-mono text-purple-600 dark:text-purple-400 mx-1">?promo=CODE</span>
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={80}
                    value={settings?.sadeemMarketerDiscount ?? 0}
                    onChange={e => setSettings((s: any) => ({ ...s, sadeemMarketerDiscount: +e.target.value }))}
                    onBlur={e => handleUpdate('sadeemMarketerDiscount', +e.target.value)}
                    className="w-24"
                    disabled={updateMutation.isPending}
                    data-testid="input-sadeem-marketer-discount"
                  />
                  <span className="text-sm text-muted-foreground">% خصم إضافي</span>
                </div>
                {(settings?.sadeemMarketerDiscount ?? 0) > 0 && (
                  <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-lg p-3 space-y-1">
                    <p className="text-xs font-semibold text-purple-700 dark:text-purple-300">مثال على رابط المسوق:</p>
                    <code className="text-xs text-purple-600 dark:text-purple-400 break-all">
                      oyoplast.com/product/123?ref=AHMED
                    </code>
                    <p className="text-xs text-muted-foreground">
                      عند فتح هذا الرابط سيظهر للزائر خصم {settings?.sadeemMarketerDiscount}% إضافي على السعر
                    </p>
                  </div>
                )}
                {(settings?.sadeemMarketerDiscount ?? 0) === 0 && (
                  <p className="text-xs text-muted-foreground italic">اضبط نسبة {'>'} 0 لتفعيل نظام المسوقين</p>
                )}
              </div>

              {/* ── إظهار سعر الكوبون لجميع العملاء ── */}
              {(settings?.sadeemMarketerDiscount ?? 0) > 0 && (
                <div className="flex items-center justify-between rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 px-4 py-3">
                  <div>
                    <Label className="font-semibold text-sm">إظهار سعر الكوبون لجميع العملاء</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">يظهر "مع كوبون: X ر.ي" بأسلوب SHEIN لجميع الزوار</p>
                  </div>
                  <Switch
                    checked={settings?.showMarketerCouponToAll ?? false}
                    onCheckedChange={v => handleUpdate('showMarketerCouponToAll', v)}
                    disabled={updateMutation.isPending}
                    data-testid="switch-show-marketer-coupon-all"
                  />
                </div>
              )}

              {/* ── شريط العروض الترويجية (SHEIN-style) ── */}
              <div className="space-y-3 rounded-lg border-2 border-orange-200 dark:border-orange-800 p-4 bg-orange-50/30 dark:bg-orange-950/20">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-semibold text-sm">شريط العروض الترويجية</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">شريط برتقالي/أحمر قابل للضغط تحت السعر مباشرة</p>
                  </div>
                  <Switch
                    checked={settings?.promoBarEnabled ?? false}
                    onCheckedChange={v => handleUpdate('promoBarEnabled', v)}
                    disabled={updateMutation.isPending}
                    data-testid="switch-promo-bar-enabled"
                  />
                </div>
                {(settings?.promoBarEnabled ?? false) && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">نص الشريط</Label>
                      <Input
                        value={settings?.promoBarText ?? "خصم 15%: بدون حد أدنى للشراء"}
                        onChange={e => setSettings((s: any) => ({ ...s, promoBarText: e.target.value }))}
                        onBlur={e => handleUpdate('promoBarText', e.target.value)}
                        placeholder="خصم 15%: بدون حد أدنى للشراء"
                        data-testid="input-promo-bar-text"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">لون الخلفية</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="color"
                          value={settings?.promoBarColor ?? "#ef4444"}
                          onChange={e => { setSettings((s: any) => ({ ...s, promoBarColor: e.target.value })); handleUpdate('promoBarColor', e.target.value); }}
                          className="w-12 h-9 p-1 cursor-pointer"
                          data-testid="input-promo-bar-color"
                        />
                        <div className="flex-1 rounded-lg py-2 px-3 text-white text-sm font-semibold text-center"
                          style={{ background: settings?.promoBarColor ?? '#ef4444' }}>
                          🏷️ {settings?.promoBarText ?? "خصم 15%: بدون حد أدنى للشراء"}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">تفاصيل العروض (تظهر عند الضغط)</Label>
                      <Textarea
                        value={settings?.promoBarDetails ?? ""}
                        onChange={e => setSettings((s: any) => ({ ...s, promoBarDetails: e.target.value }))}
                        onBlur={e => handleUpdate('promoBarDetails', e.target.value)}
                        placeholder="اكتب تفاصيل العروض هنا... مثلاً: خصم 15% على جميع المنتجات بدون حد أدنى للشراء"
                        rows={3}
                        data-testid="input-promo-bar-details"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* ── إخفاء اسم المنتج في الشريط العلوي ── */}
              <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                <div>
                  <Label className="font-semibold text-sm">إخفاء الاسم فوق الصورة (نمط SHEIN)</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">الصورة تبدأ من أعلى الشاشة مباشرة — الرجوع يكون أيقونة شفافة على الصورة</p>
                </div>
                <Switch
                  checked={settings?.detailHideHeaderName ?? false}
                  onCheckedChange={v => handleUpdate('detailHideHeaderName', v)}
                  disabled={updateMutation.isPending}
                  data-testid="switch-detail-hide-header-name"
                />
              </div>
            </div>
          </div>
        </CollapsibleSection>
        {/* ═══════════════════════════════════════════════════════════════ */}

        {/* 💬 زر واتساب العائم */}
        <CollapsibleSection
          id="whatsapp-float"
          title="زر واتساب العائم"
          subtitle="خدمة عملاء مباشرة — أيقونة واتساب تظهر في الموقع"
          icon={<svg viewBox="0 0 24 24" fill="white" className="h-5 w-5 flex-shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>}
          gradient="bg-gradient-to-l from-green-500 to-teal-600"
          border="border-green-200 dark:border-green-800"
        >
          <div className="p-5 space-y-4 bg-green-50/30 dark:bg-green-950/20">
            {/* تفعيل/إيقاف */}
            <div className="flex items-center justify-between rounded-lg border px-4 py-3 bg-white dark:bg-background">
              <div>
                <Label className="font-semibold text-sm">إظهار زر واتساب في الموقع</Label>
                <p className="text-xs text-muted-foreground mt-0.5">يظهر كأيقونة عائمة في الزاوية السفلية اليسرى</p>
              </div>
              <Switch
                checked={settings?.showWhatsappButton ?? false}
                onCheckedChange={v => handleUpdate('showWhatsappButton', v)}
                disabled={updateMutation.isPending}
                data-testid="switch-show-whatsapp-button"
              />
            </div>
            {/* رقم الواتساب */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">رقم واتساب خدمة العملاء</Label>
              <p className="text-xs text-muted-foreground">مثال: 9677XXXXXXXX+ أو 009677XXXXXXXX</p>
              <Input
                value={settings?.whatsappNumber ?? ""}
                onChange={e => setSettings((s: any) => ({ ...s, whatsappNumber: e.target.value }))}
                onBlur={e => handleUpdate('whatsappNumber', e.target.value)}
                placeholder="+9677xxxxxxxx"
                dir="ltr"
                data-testid="input-whatsapp-number"
              />
            </div>
            {/* الرسالة الافتراضية */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">الرسالة الافتراضية عند الضغط</Label>
              <Input
                value={settings?.whatsappMessage ?? "مرحباً، أحتاج مساعدة"}
                onChange={e => setSettings((s: any) => ({ ...s, whatsappMessage: e.target.value }))}
                onBlur={e => handleUpdate('whatsappMessage', e.target.value)}
                placeholder="مرحباً، أحتاج مساعدة"
                data-testid="input-whatsapp-message"
              />
            </div>
            {/* معاينة */}
            {settings?.showWhatsappButton && settings?.whatsappNumber && (
              <div className="bg-white dark:bg-background border rounded-xl p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#25D366] flex items-center justify-center shadow-md shrink-0">
                  <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-sm text-green-700">الزر مُفعَّل ✅</p>
                  <p className="text-xs text-muted-foreground">الرقم: <span dir="ltr">{settings.whatsappNumber}</span></p>
                </div>
              </div>
            )}
          </div>
        </CollapsibleSection>
        {/* ═══════════════════════════════════════════════════════════════ */}

        {/* 🎛️ تحكم الأزرار العائمة */}
        <CollapsibleSection
          id="floating-buttons"
          title="الأزرار العائمة — التحكم الكامل"
          subtitle="إظهار/إخفاء الموظف الذكي · روبوت الدعم · واتساب — وتحديد الصفحات"
          icon={<span className="text-white text-lg flex-shrink-0">🎛️</span>}
          gradient="bg-gradient-to-l from-violet-600 to-purple-700"
          border="border-violet-200 dark:border-violet-800"
        >
          <div className="p-5 space-y-6 bg-violet-50/30 dark:bg-violet-950/20">

            {/* ── مساعد للصفحات ── */}
            {(() => {
              const PAGE_OPTIONS = [
                { label: "الصفحة الرئيسية", value: "/" },
                { label: "صفحة المنتج", value: "/product" },
                { label: "المنتجات", value: "/products" },
                { label: "السلة", value: "/cart" },
                { label: "الدفع", value: "/checkout" },
                { label: "الطباعة", value: "/printing" },
                { label: "تتبع الطلب", value: "/track" },
              ];

              const PagesSelector = ({ fieldKey, isAll }: { fieldKey: string; isAll: boolean }) => {
                const current = (settings?.[fieldKey] ?? "all") as string;
                const isAllChecked = current === "all";
                const selected = isAllChecked ? [] : current.split(",").map((p: string) => p.trim()).filter(Boolean);

                const toggle = (val: string) => {
                  if (isAllChecked) {
                    const next = PAGE_OPTIONS.map(p => p.value).filter(v => v !== val).join(",");
                    handleUpdate(fieldKey, next || "all");
                  } else {
                    const newSet = selected.includes(val)
                      ? selected.filter((v: string) => v !== val)
                      : [...selected, val];
                    handleUpdate(fieldKey, newSet.length === 0 ? "all" : newSet.join(","));
                  }
                };

                return (
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={isAllChecked}
                        onChange={() => handleUpdate(fieldKey, isAllChecked ? "/" : "all")}
                        className="w-4 h-4 accent-violet-600"
                        id={`${fieldKey}-all`} />
                      <label htmlFor={`${fieldKey}-all`} className="text-sm font-semibold cursor-pointer">كل الصفحات</label>
                    </div>
                    {!isAllChecked && (
                      <div className="grid grid-cols-2 gap-1 mt-2">
                        {PAGE_OPTIONS.map(p => (
                          <div key={p.value} className="flex items-center gap-2">
                            <input type="checkbox" checked={selected.includes(p.value)}
                              onChange={() => toggle(p.value)}
                              className="w-4 h-4 accent-violet-600"
                              id={`${fieldKey}-${p.value}`} />
                            <label htmlFor={`${fieldKey}-${p.value}`} className="text-xs cursor-pointer">{p.label}</label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              };

              return (
                <>
                  {/* الموظف الذكي */}
                  <div className="rounded-xl border bg-white dark:bg-background p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-cyan-600 flex items-center justify-center">
                          <span className="text-white text-lg">🤖</span>
                        </div>
                        <div>
                          <p className="font-semibold text-sm">الموظف الذكي (AI)</p>
                          <p className="text-xs text-muted-foreground">مساعد مبيعات بالذكاء الاصطناعي — أسفل اليسار</p>
                        </div>
                      </div>
                      <Switch
                        checked={settings?.showAiEmployee !== false}
                        onCheckedChange={v => handleUpdate('showAiEmployee', v)}
                        data-testid="switch-show-ai-employee"
                      />
                    </div>
                    {settings?.showAiEmployee !== false && (
                      <>
                        <p className="text-xs text-muted-foreground font-medium">الصفحات التي يظهر فيها:</p>
                        <PagesSelector fieldKey="aiEmployeePages" isAll={settings?.aiEmployeePages === "all" || !settings?.aiEmployeePages} />
                      </>
                    )}
                  </div>

                  {/* روبوت الدعم */}
                  <div className="rounded-xl border bg-white dark:bg-background p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-cyan-600 flex items-center justify-center">
                          <span className="text-white text-lg">✥</span>
                        </div>
                        <div>
                          <p className="font-semibold text-sm">روبوت الدعم (قابل للسحب)</p>
                          <p className="text-xs text-muted-foreground">شكاوي · اقتراحات · دعم — أسفل اليمين (فوق واتساب)</p>
                        </div>
                      </div>
                      <Switch
                        checked={settings?.showSupportRobot !== false}
                        onCheckedChange={v => handleUpdate('showSupportRobot', v)}
                        data-testid="switch-show-support-robot"
                      />
                    </div>
                    {settings?.showSupportRobot !== false && (
                      <>
                        <p className="text-xs text-muted-foreground font-medium">الصفحات التي يظهر فيها:</p>
                        <PagesSelector fieldKey="supportRobotPages" isAll={settings?.supportRobotPages === "all" || !settings?.supportRobotPages} />
                      </>
                    )}
                  </div>

                  {/* واتساب */}
                  <div className="rounded-xl border bg-white dark:bg-background p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center">
                          <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                          </svg>
                        </div>
                        <div>
                          <p className="font-semibold text-sm">زر واتساب</p>
                          <p className="text-xs text-muted-foreground">رقم الواتساب يُعدَّل من قسم "زر واتساب العائم" أعلاه</p>
                        </div>
                      </div>
                      <Switch
                        checked={settings?.showWhatsappButton ?? false}
                        onCheckedChange={v => handleUpdate('showWhatsappButton', v)}
                        data-testid="switch-show-whatsapp-float-pages"
                      />
                    </div>
                    {settings?.showWhatsappButton && (
                      <>
                        <p className="text-xs text-muted-foreground font-medium">الصفحات التي يظهر فيها:</p>
                        <PagesSelector fieldKey="whatsappPages" isAll={settings?.whatsappPages === "all" || !settings?.whatsappPages} />
                      </>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </CollapsibleSection>
        {/* ═══════════════════════════════════════════════════════════════ */}

        {/* 🛒 إعدادات عرض تفاصيل المنتج في السلة / الدفع / الطلب */}
        <CollapsibleSection
          id="item-display-settings"
          title="تفاصيل المنتج في السلة والطلبات"
          subtitle="تحكم بما يظهر في السلة وصفحة الدفع وتأكيد الطلب"
          icon={<ShoppingBag className="h-5 w-5 text-white flex-shrink-0" />}
          gradient="bg-gradient-to-l from-teal-600 to-cyan-600"
          border="border-teal-200 dark:border-teal-800"
        >
          <div className="p-5 space-y-6 bg-teal-50/30 dark:bg-teal-950/20">
            {/* ─── دالة مساعدة للتبديل ─── */}
            {(["cart", "checkout", "order"] as const).map((section) => {
              const labels: Record<string, string> = {
                cart: "🛒 سلة التسوق",
                checkout: "💳 صفحة الدفع",
                order: "✅ تأكيد الطلب",
              };
              const keyMap: Record<string, Record<string, string>> = {
                cart: {
                  showColor: "cartShowColor", showSize: "cartShowSize",
                  showBagColor: "cartShowBagColor", showPrintColors: "cartShowPrintColors",
                  showDesignFile: "cartShowDesignFile", showDesignNotes: "cartShowDesignNotes",
                  mode: "cartItemMode",
                },
                checkout: {
                  showColor: "checkoutShowColor", showSize: "checkoutShowSize",
                  showBagColor: "checkoutShowBagColor", showPrintColors: "checkoutShowPrintColors",
                  showDesignFile: "checkoutShowDesignFile", showDesignNotes: "checkoutShowDesignNotes",
                  mode: "checkoutItemMode",
                },
                order: {
                  showColor: "orderShowColor", showSize: "orderShowSize",
                  showBagColor: "orderShowBagColor", showPrintColors: "orderShowPrintColors",
                  showDesignFile: "orderShowDesignFile", showDesignNotes: "orderShowDesignNotes",
                  mode: "orderItemMode",
                },
              };
              const km = keyMap[section];
              return (
                <div key={section} className="rounded-xl border border-teal-200/60 bg-white dark:bg-card p-4 space-y-4">
                  <p className="font-bold text-sm text-teal-700 dark:text-teal-300">{labels[section]}</p>

                  {/* طريقة العرض */}
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">طريقة العرض</p>
                      <p className="text-xs text-muted-foreground">مضغوط: كل شيء ظاهر مباشرة | قابل للطي: تُخفى التفاصيل داخل زر</p>
                    </div>
                    <div className="flex items-center gap-1 bg-muted rounded-full p-0.5">
                      {(["compact", "collapsible"] as const).map(mode => (
                        <button
                          key={mode}
                          onClick={() => handleUpdate(km.mode, mode)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-full transition-colors ${
                            (settings?.[km.mode] ?? (section === "order" ? "collapsible" : "compact")) === mode
                              ? "bg-teal-500 text-white shadow"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                          data-testid={`button-${section}-mode-${mode}`}
                        >
                          {mode === "compact" ? "مضغوط" : "قابل للطي"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="h-px bg-border" />

                  {/* التبديلات */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: "showColor", label: "اللون", desc: "دائرة اللون + اسمه" },
                      { key: "showSize", label: "المقاس", desc: "مقاس المنتج (S/M/XL...)" },
                      { key: "showBagColor", label: "لون الكيس", desc: "لون كيس الطباعة" },
                      { key: "showPrintColors", label: "ألوان الطباعة", desc: "ألوان الطباعة المختارة" },
                      { key: "showDesignFile", label: "ملف التصميم", desc: "مؤشر وجود ملف مرفق" },
                      { key: "showDesignNotes", label: "ملاحظات التصميم", desc: "ملاحظات الطباعة المخصصة" },
                    ].map(({ key, label, desc }) => (
                      <div key={key} className="flex items-center justify-between gap-2 bg-muted/40 rounded-lg px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold">{label}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{desc}</p>
                        </div>
                        <Switch
                          checked={settings?.[km[key]] ?? true}
                          onCheckedChange={v => handleUpdate(km[key], v)}
                          data-testid={`switch-${section}-${key}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CollapsibleSection>
        {/* ═══════════════════════════════════════════════════════════════ */}

        {/* 💳 إعدادات الدفع والشحن */}
        <CollapsibleSection
          id="payment-shipping"
          title="إعدادات الدفع والشحن"
          subtitle="تحكم في رسوم الشحن وطرق الدفع المتاحة"
          icon={<Banknote className="h-5 w-5 text-white flex-shrink-0" />}
          gradient="bg-gradient-to-l from-green-600 to-emerald-600"
          border="border-green-200 dark:border-green-800"
        >
          <div className="p-5 space-y-5 bg-green-50/30 dark:bg-green-950/20">
            {/* رسوم الشحن */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-green-700 dark:text-green-300 uppercase tracking-wide">رسوم الشحن الثابتة</p>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Label className="text-sm font-medium">قيمة الشحن (ر.ي)</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    القيمة التي تُضاف للطلبات — اكتب 0 للشحن المجاني دائماً
                  </p>
                </div>
                <Input
                  type="number"
                  min={0}
                  className="w-28 h-9 text-sm text-center font-bold"
                  value={settings?.shippingFee ?? 0}
                  onChange={e => setSettings((s: any) => ({ ...s, shippingFee: +e.target.value }))}
                  onBlur={e => handleUpdate('shippingFee', +e.target.value)}
                  data-testid="input-shipping-fee"
                />
              </div>
              {(settings?.shippingFee ?? 0) === 0 ? (
                <p className="text-xs text-green-600 font-medium">✅ الشحن مجاني لجميع الطلبات</p>
              ) : (
                <p className="text-xs text-orange-600">
                  رسوم شحن {Number(settings?.shippingFee ?? 0).toLocaleString('ar')} ر.ي على كل طلب
                  {(settings?.sadeemFreeShippingMin ?? 0) > 0 &&
                    ` — مجاني للطلبات فوق ${Number(settings?.sadeemFreeShippingMin ?? 0).toLocaleString('ar')} ر.ي`}
                </p>
              )}
            </div>

            {/* COD Toggle */}
            <div className="flex items-center justify-between py-3 border-t border-green-100 dark:border-green-900">
              <div>
                <Label className="text-sm font-medium">الدفع عند الاستلام (COD)</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  السماح للعملاء بالدفع نقداً عند استلام الطلب
                </p>
              </div>
              <Switch
                checked={settings?.codEnabled ?? true}
                onCheckedChange={v => handleUpdate('codEnabled', v)}
                disabled={updateMutation.isPending}
                data-testid="switch-cod-enabled"
              />
            </div>
            {!(settings?.codEnabled ?? true) && (
              <p className="text-xs text-orange-600 bg-orange-50 dark:bg-orange-950/30 rounded-lg px-3 py-2">
                ⚠️ الدفع عند الاستلام معطّل — سيُجبر العملاء على استخدام المحافظ الإلكترونية
              </p>
            )}

            {/* ── إعدادات التقسيط ── */}
            <div className="border-t border-green-100 dark:border-green-900 pt-5 space-y-4">
              <p className="text-xs font-bold text-green-700 dark:text-green-300 uppercase tracking-wide">نظام التقسيط</p>

              {/* تفعيل / إيقاف التقسيط */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">تفعيل نظام التقسيط</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    السماح للعملاء بتقسيط مشترياتهم عند الدفع
                  </p>
                </div>
                <Switch
                  checked={settings?.installmentEnabled ?? true}
                  onCheckedChange={v => handleUpdate('installmentEnabled', v)}
                  disabled={updateMutation.isPending}
                  data-testid="switch-installment-enabled"
                />
              </div>
              {!(settings?.installmentEnabled ?? true) && (
                <p className="text-xs text-orange-600 bg-orange-50 dark:bg-orange-950/30 rounded-lg px-3 py-2">
                  ⚠️ خيار التقسيط مخفي من صفحة الدفع
                </p>
              )}

              {/* الحد الأدنى لتفعيل التقسيط */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <Label className="text-sm font-medium">الحد الأدنى للتقسيط (ر.ي)</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    لا يظهر خيار التقسيط إلا إذا تجاوز إجمالي الطلب هذا المبلغ
                  </p>
                </div>
                <Input
                  type="number"
                  min={0}
                  step={1000}
                  className="w-32 h-9 text-sm text-center font-bold"
                  value={settings?.installmentMinAmount ?? 50000}
                  onChange={e => setSettings((s: any) => ({ ...s, installmentMinAmount: +e.target.value }))}
                  onBlur={e => handleUpdate('installmentMinAmount', +e.target.value)}
                  disabled={updateMutation.isPending}
                  data-testid="input-installment-min"
                />
              </div>

              {/* نسب البدل المتاحة */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">نسب المقدّم المتاحة (%)</Label>
                <p className="text-xs text-muted-foreground">
                  أدخل النسب المتاحة للعميل مفصولة بفاصلة — مثال: 30,40,50
                </p>
                <div className="flex items-center gap-3">
                  <Input
                    type="text"
                    className="flex-1 h-9 text-sm font-mono"
                    placeholder="30,40,50"
                    value={settings?.installmentPercentages ?? "30,40,50"}
                    onChange={e => setSettings((s: any) => ({ ...s, installmentPercentages: e.target.value }))}
                    onBlur={e => handleUpdate('installmentPercentages', e.target.value)}
                    disabled={updateMutation.isPending}
                    data-testid="input-installment-percentages"
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">% من الإجمالي</span>
                </div>
                {/* معاينة النسب */}
                {(settings?.installmentPercentages ?? "30,40,50").split(',').filter((p: string) => p.trim()).length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {(settings?.installmentPercentages ?? "30,40,50").split(',').map((p: string) => p.trim()).filter((p: string) => p && !isNaN(Number(p))).map((p: string) => (
                      <span key={p} className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-xs font-bold px-2 py-1 rounded-full">
                        {p}%
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CollapsibleSection>
        {/* ═══════════════════════════════════════════════════════════════ */}

        {updateMutation.isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            جاري الحفظ...
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HomePageSettingsSection({ adminToken }: { adminToken: string | null }) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/home-settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (e) {
      console.error('Failed to fetch home settings', e);
    } finally {
      setLoading(false);
    }
  };

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/admin/home-settings', {
        method: 'PATCH',
        headers: { 'x-admin-token': adminToken!, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update settings');
      return res.json();
    },
    onSuccess: (newSettings) => {
      setSettings(newSettings);
      toast({ title: "تم تحديث إعدادات الصفحة الرئيسية بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل تحديث الإعدادات", variant: "destructive" });
    },
  });

  const handleColorChange = (colorType: string, color: string) => {
    updateSettingsMutation.mutate({
      [colorType]: color,
    });
  };

  const handleToggle = (key: string, value: boolean) => {
    updateSettingsMutation.mutate({
      [key]: value,
    });
  };

  const handleText = (key: string, value: string) => {
    updateSettingsMutation.mutate({
      [key]: value,
    });
  };

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          إعدادات الصفحة الرئيسية (مادلين)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Primary Color */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">اللون الأساسي</Label>
          <div className="flex items-center gap-4">
            <input
              type="color"
              value={settings?.primaryColor || "#06B6D4"}
              onChange={(e) => handleColorChange("primaryColor", e.target.value)}
              className="w-16 h-12 rounded cursor-pointer border-2 border-gray-200"
              disabled={updateSettingsMutation.isPending}
              data-testid="input-primary-color"
            />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                {settings?.primaryColor || "#06B6D4"}
              </p>
              <p className="text-xs text-gray-500">اللون المستخدم في الأزرار والعناوين الرئيسية</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Accent Color */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">لون التمييز</Label>
          <div className="flex items-center gap-4">
            <input
              type="color"
              value={settings?.accentColor || "#0891B2"}
              onChange={(e) => handleColorChange("accentColor", e.target.value)}
              className="w-16 h-12 rounded cursor-pointer border-2 border-gray-200"
              disabled={updateSettingsMutation.isPending}
              data-testid="input-accent-color"
            />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                {settings?.accentColor || "#0891B2"}
              </p>
              <p className="text-xs text-gray-500">اللون المستخدم في العروضات والبطاقات</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* ─── إعدادات القائمة الجانبية (Drawer) ─── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">☰</span>
            <Label className="text-base font-semibold">القائمة الجانبية (الخطوط الثلاثة)</Label>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">تحكم في مظهر القائمة التي تظهر عند الضغط على الخطوط الثلاثة في الجوال</p>

          <div className="grid grid-cols-2 gap-4">
            {/* لون البداية */}
            <div className="space-y-2">
              <Label className="text-sm">لون الخلفية — البداية</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={settings?.drawerBgFrom || "#0891B2"}
                  onChange={(e) => setSettings((s: any) => ({ ...s, drawerBgFrom: e.target.value }))}
                  onBlur={(e) => updateSettingsMutation.mutate({ drawerBgFrom: e.target.value })}
                  className="w-14 h-10 rounded cursor-pointer border-2 border-gray-200"
                  data-testid="input-drawer-bg-from"
                />
                <code className="text-xs text-gray-500">{settings?.drawerBgFrom || "#0891B2"}</code>
              </div>
            </div>
            {/* لون النهاية */}
            <div className="space-y-2">
              <Label className="text-sm">لون الخلفية — النهاية</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={settings?.drawerBgTo || "#164e63"}
                  onChange={(e) => setSettings((s: any) => ({ ...s, drawerBgTo: e.target.value }))}
                  onBlur={(e) => updateSettingsMutation.mutate({ drawerBgTo: e.target.value })}
                  className="w-14 h-10 rounded cursor-pointer border-2 border-gray-200"
                  data-testid="input-drawer-bg-to"
                />
                <code className="text-xs text-gray-500">{settings?.drawerBgTo || "#164e63"}</code>
              </div>
            </div>
          </div>

          {/* معاينة التدرج */}
          <div
            className="w-full h-12 rounded-xl shadow-inner"
            style={{ background: `linear-gradient(135deg, ${settings?.drawerBgFrom || "#0891B2"} 0%, ${settings?.drawerBgTo || "#164e63"} 100%)` }}
          />

          {/* العرض */}
          <div className="space-y-2">
            <Label className="text-sm">عرض القائمة: <strong>{settings?.drawerWidth ?? 300}px</strong></Label>
            <input
              type="range" min={260} max={380} step={10}
              value={settings?.drawerWidth ?? 300}
              onChange={(e) => setSettings((s: any) => ({ ...s, drawerWidth: +e.target.value }))}
              onMouseUp={(e) => updateSettingsMutation.mutate({ drawerWidth: +(e.target as HTMLInputElement).value })}
              onTouchEnd={(e) => updateSettingsMutation.mutate({ drawerWidth: +(e.target as HTMLInputElement).value })}
              className="w-full accent-primary"
              data-testid="input-drawer-width"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>260px (ضيق)</span>
              <span>380px (واسع)</span>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <Label className="text-base font-semibold block">تحكم التذييل</Label>
          <div className="grid gap-4">
            <div>
              <Label>سياسة الخصوصية</Label>
              <Input value={settings?.footerPrivacyText || ""} onChange={(e) => handleText("footerPrivacyText", e.target.value)} data-testid="input-footer-privacy" />
            </div>
            <div>
              <Label>التسويق بالعمولة</Label>
              <Input value={settings?.footerAffiliateText || ""} onChange={(e) => handleText("footerAffiliateText", e.target.value)} data-testid="input-footer-affiliate" />
            </div>
            <div>
              <Label>سياسة الاسترجاع</Label>
              <Input value={settings?.footerReturnsText || ""} onChange={(e) => handleText("footerReturnsText", e.target.value)} data-testid="input-footer-returns" />
            </div>
            <div>
              <Label>النص السفلي</Label>
              <Input value={settings?.footerBottomText || ""} onChange={(e) => handleText("footerBottomText", e.target.value)} data-testid="input-footer-bottom" />
            </div>
            <div>
              <Label>مكان إظهار التسجيل</Label>
              <Select value={settings?.signupEntryMode || "cart"} onValueChange={(value) => handleText("signupEntryMode", value)}>
                <SelectTrigger data-testid="select-signup-entry-mode">
                  <SelectValue placeholder="اختر" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cart">من السلة</SelectItem>
                  <SelectItem value="profile">من صفحة أنا</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>متى يُطلب تسجيل الدخول</Label>
              <Select value={settings?.loginFlow || "checkout"} onValueChange={(value) => handleText("loginFlow", value)}>
                <SelectTrigger data-testid="select-login-flow">
                  <SelectValue placeholder="اختر" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checkout">عند إتمام الطلب فقط</SelectItem>
                  <SelectItem value="cart">عند إضافة للسلة</SelectItem>
                  <SelectItem value="none">لا يُطلب (دائماً ضيف)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">يتحكم في متى يُطلب من المستخدم تسجيل الدخول</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Page Content Editor */}
        <div className="space-y-4">
          <Label className="text-base font-semibold block">محتوى الصفحات (اختياري)</Label>
          <p className="text-xs text-muted-foreground">إذا تركت الحقل فارغاً سيُعرض المحتوى الافتراضي. عند الكتابة يُستبدل المحتوى الافتراضي بما تكتبه.</p>
          <div className="grid gap-4">
            <div>
              <Label>محتوى صفحة سياسة الخصوصية</Label>
              <textarea
                className="w-full border rounded-md p-3 text-sm bg-background resize-y min-h-[120px]"
                value={settings?.privacyContent || ""}
                onChange={(e) => handleText("privacyContent", e.target.value)}
                placeholder="اكتب محتوى صفحة سياسة الخصوصية هنا..."
                data-testid="textarea-privacy-content"
              />
            </div>
            <div>
              <Label>محتوى صفحة سياسة الاسترجاع</Label>
              <textarea
                className="w-full border rounded-md p-3 text-sm bg-background resize-y min-h-[120px]"
                value={settings?.returnsContent || ""}
                onChange={(e) => handleText("returnsContent", e.target.value)}
                placeholder="اكتب محتوى صفحة سياسة الاسترجاع هنا..."
                data-testid="textarea-returns-content"
              />
            </div>
            <div>
              <Label>محتوى صفحة التسويق بالعمولة</Label>
              <textarea
                className="w-full border rounded-md p-3 text-sm bg-background resize-y min-h-[120px]"
                value={settings?.affiliateContent || ""}
                onChange={(e) => handleText("affiliateContent", e.target.value)}
                placeholder="اكتب محتوى صفحة التسويق بالعمولة هنا..."
                data-testid="textarea-affiliate-content"
              />
            </div>
          </div>
        </div>

        {/* Visibility Toggles */}
        <div className="space-y-4">
          <Label className="text-base font-semibold block">إظهار/إخفاء الأقسام</Label>
          
          {/* Show Header */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div>
              <p className="font-semibold">الشعار والبحث</p>
              <p className="text-xs text-gray-500">إظهار رأس الصفحة</p>
            </div>
            <input
              type="checkbox"
              checked={settings?.showHeader ?? true}
              onChange={(e) => handleToggle("showHeader", e.target.checked)}
              disabled={updateSettingsMutation.isPending}
              className="w-5 h-5 cursor-pointer"
              data-testid="checkbox-show-header"
            />
          </div>

          {/* Show Banners */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div>
              <p className="font-semibold">البنرات</p>
              <p className="text-xs text-gray-500">إظهار دوران البنرات</p>
            </div>
            <input
              type="checkbox"
              checked={settings?.showBanners ?? true}
              onChange={(e) => handleToggle("showBanners", e.target.checked)}
              disabled={updateSettingsMutation.isPending}
              className="w-5 h-5 cursor-pointer"
              data-testid="checkbox-show-banners"
            />
          </div>

          {/* Show Offers */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div>
              <p className="font-semibold">العروضات</p>
              <p className="text-xs text-gray-500">إظهار صناديق العروضات</p>
            </div>
            <input
              type="checkbox"
              checked={settings?.showOffers ?? true}
              onChange={(e) => handleToggle("showOffers", e.target.checked)}
              disabled={updateSettingsMutation.isPending}
              className="w-5 h-5 cursor-pointer"
              data-testid="checkbox-show-offers"
            />
          </div>

          {/* Show Categories */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div>
              <p className="font-semibold">الأقسام</p>
              <p className="text-xs text-gray-500">إظهار شبكة الأقسام الدائرية</p>
            </div>
            <input
              type="checkbox"
              checked={settings?.showCategories ?? true}
              onChange={(e) => handleToggle("showCategories", e.target.checked)}
              disabled={updateSettingsMutation.isPending}
              className="w-5 h-5 cursor-pointer"
              data-testid="checkbox-show-categories"
            />
          </div>
        </div>

        {updateSettingsMutation.isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            جاري التحديث...
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── تعيين مورد لطلب محدد ──────────────────────────────────────────────────────
function OrderSupplierAssign({ order, adminToken }: { order: any; adminToken: string | null }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");

  const { data: suppliers = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/suppliers"],
    queryFn: async () => {
      if (!adminToken) return [];
      const res = await fetch("/api/admin/suppliers", { headers: { "x-admin-token": adminToken } });
      return res.ok ? res.json() : [];
    },
    enabled: !!adminToken,
    staleTime: 60000,
  });

  const { mutate: assignSupplier, isPending } = useMutation({
    mutationFn: async (supplierId: number) => {
      const res = await fetch(`/api/admin/orders/${order.id}/assign-supplier`, {
        method: "PUT",
        headers: { "x-admin-token": adminToken!, "Content-Type": "application/json" },
        body: JSON.stringify({ supplierId }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: `✅ تم تعيين المورد — يستلم ${Number(data.supplierAmount).toLocaleString()} ر.ي` });
      if (data?.notify && !data.notify.ok) {
        toast({
          title: "⚠️ لم يصل إشعار للمورد",
          description: data.notify.error || "تعذّر إرسال الرسالة",
          variant: "destructive",
        });
      } else if (data?.notify?.ok) {
        const ch = data.notify.channel === "sms" ? "SMS رسالة نصية" : "واتساب";
        toast({ title: `📱 وصل الإشعار للمورد عبر ${ch}` });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/suppliers"] });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const { mutate: notifySupplier, isPending: isNotifying } = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/orders/${order.id}/notify-supplier`, {
        method: "POST",
        headers: { "x-admin-token": adminToken! },
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => toast({ title: "✅ تم إرسال الإشعار للمورد" }),
    onError: (e: any) => toast({ title: "خطأ في الإشعار", description: e.message, variant: "destructive" }),
  });

  const activeSuppliers = suppliers.filter((s: any) => s.is_active);
  const currentSupplier = suppliers.find((s: any) => s.id === order.supplierId || s.id === order.supplier_id);

  return (
    <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4" dir="rtl">
      <p className="font-semibold text-sm text-cyan-800 mb-3 flex items-center gap-2">
        🤝 تعيين المورد / الموزع
      </p>
      {currentSupplier ? (
        <div className="mb-3 bg-white border border-cyan-200 rounded-lg p-2.5 space-y-1.5">
          <p className="text-xs text-gray-500">المورد الحالي</p>
          <p className="font-bold">{currentSupplier.name}</p>
          <p className="text-xs text-gray-500" dir="ltr">{currentSupplier.phone}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-green-700">
              نصيبه: {Number(order.supplierAmount || order.supplier_amount || 0).toLocaleString()} ر.ي
            </span>
            <span className="text-xs text-purple-600">
              / عمولة المنصة: {Number(order.platformCommission || order.platform_commission || 0).toLocaleString()} ر.ي
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(order.supplierNotified || order.supplier_notified) && (
              <span className="text-xs text-green-600">✓ تم إشعاره</span>
            )}
            {/* حالة المورد من البوابة */}
            {(order.supplierStatus || order.supplier_status) && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                (order.supplierStatus || order.supplier_status) === "delivered" ? "bg-green-100 text-green-700" :
                (order.supplierStatus || order.supplier_status) === "shipped"   ? "bg-purple-100 text-purple-700" :
                (order.supplierStatus || order.supplier_status) === "accepted"  ? "bg-blue-100 text-blue-700" :
                (order.supplierStatus || order.supplier_status) === "cancelled" ? "bg-red-100 text-red-700" :
                "bg-yellow-100 text-yellow-700"
              }`}>
                {{pending:"⏳ في الانتظار", accepted:"✅ قبل الطلب", shipped:"🚚 تم الشحن", delivered:"🎉 تم التوصيل", cancelled:"❌ ألغى الطلب"}[(order.supplierStatus || order.supplier_status) as string] || (order.supplierStatus || order.supplier_status)}
              </span>
            )}
          </div>
          {/* زر نسخ رابط بوابة المورد */}
          {(order.supplierToken || order.supplier_token) && (
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs gap-1.5 mt-1"
              data-testid="button-copy-supplier-link"
              onClick={() => {
                const link = `https://oyoplast.com/supplier/order/${order.supplierToken || order.supplier_token}`;
                navigator.clipboard.writeText(link).then(() =>
                  toast({ title: "✅ تم نسخ رابط بوابة المورد" })
                );
              }}
            >
              🔗 نسخ رابط بوابة المورد
            </Button>
          )}
        </div>
      ) : (
        <p className="text-xs text-orange-600 mb-3">⚠️ لم يُعيَّن مورد بعد لهذا الطلب</p>
      )}

      <div className="flex gap-2">
        <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
          <SelectTrigger className="flex-1 text-sm" data-testid="select-order-supplier">
            <SelectValue placeholder="اختر مورداً..." />
          </SelectTrigger>
          <SelectContent>
            {activeSuppliers.map((s: any) => (
              <SelectItem key={s.id} value={String(s.id)}>
                {s.name} — {(s.cities || []).slice(0, 2).join("، ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={() => selectedSupplierId && assignSupplier(Number(selectedSupplierId))}
          disabled={!selectedSupplierId || isPending}
          data-testid="button-assign-supplier"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "تعيين"}
        </Button>
        {currentSupplier && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => notifySupplier()}
            disabled={isNotifying}
            title="إعادة إرسال الإشعار"
          >
            {isNotifying ? <Loader2 className="w-4 h-4 animate-spin" /> : "📲"}
          </Button>
        )}
      </div>
    </div>
  );
}

// ── مكوّن إدارة مناطق الخدمة GPS ─────────────────────────────────────────────
function AdminServiceAreas({ adminToken }: { adminToken: string | null }) {
  const { data: areas = [], refetch } = useQuery<any[]>({
    queryKey: ["/api/admin/service-areas"],
    queryFn: () =>
      fetch("/api/admin/service-areas", { headers: { "x-admin-token": adminToken ?? "" } })
        .then(r => r.json()),
  });

  const [form, setForm] = useState({ city: "", radiusKm: "15", lat: "", lng: "", isActive: true });
  const [saving, setSaving] = useState(false);
  const toast = useToast().toast;

  const handleSave = async () => {
    if (!form.city) return;
    setSaving(true);
    await fetch("/api/admin/service-areas", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": adminToken ?? "" },
      body: JSON.stringify({ city: form.city, radiusKm: parseFloat(form.radiusKm), lat: form.lat ? parseFloat(form.lat) : null, lng: form.lng ? parseFloat(form.lng) : null, isActive: form.isActive }),
    });
    setSaving(false);
    setForm({ city: "", radiusKm: "15", lat: "", lng: "", isActive: true });
    refetch();
    toast({ title: "✅ تم حفظ منطقة الخدمة" });
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/admin/service-areas/${id}`, { method: "DELETE", headers: { "x-admin-token": adminToken ?? "" } });
    refetch();
    toast({ title: "🗑️ تم حذف المنطقة" });
  };

  const handleToggle = async (id: number, current: boolean) => {
    await fetch(`/api/admin/service-areas/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-admin-token": adminToken ?? "" },
      body: JSON.stringify({ isActive: !current }),
    });
    refetch();
  };

  return (
    <div className="mt-6 border rounded-xl p-4 bg-green-50/30 space-y-4" dir="rtl">
      <h3 className="font-bold text-green-900 flex items-center gap-2">📍 إدارة مناطق خدمة GPS</h3>
      <p className="text-xs text-muted-foreground">حدّد نطاق التغطية لكل مدينة — الطلبات داخل النطاق تُوجَّه لأقرب موزع GPS أولاً</p>

      {/* إضافة منطقة */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 bg-white p-3 rounded-lg border">
        <div>
          <Label className="text-xs">المدينة</Label>
          <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="صنعاء" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">نطاق التغطية (كم)</Label>
          <Input type="number" min={1} value={form.radiusKm} onChange={e => setForm(f => ({ ...f, radiusKm: e.target.value }))} className="mt-1" dir="ltr" />
        </div>
        <div>
          <Label className="text-xs">خط العرض (Lat) — اختياري</Label>
          <Input value={form.lat} onChange={e => setForm(f => ({ ...f, lat: e.target.value }))} placeholder="15.3547" className="mt-1 font-mono text-xs" dir="ltr" />
        </div>
        <div>
          <Label className="text-xs">خط الطول (Lng) — اختياري</Label>
          <Input value={form.lng} onChange={e => setForm(f => ({ ...f, lng: e.target.value }))} placeholder="44.2067" className="mt-1 font-mono text-xs" dir="ltr" />
        </div>
        <div className="flex items-end">
          <Button onClick={handleSave} disabled={saving || !form.city} size="sm" className="w-full">
            {saving ? "..." : "+ إضافة منطقة"}
          </Button>
        </div>
      </div>

      {/* قائمة المناطق */}
      <div className="space-y-2">
        {areas.map((area: any) => (
          <div key={area.id} className="flex items-center justify-between bg-white border rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{area.city}</span>
              <span className="text-xs text-muted-foreground bg-gray-100 px-2 py-0.5 rounded-full">{area.radius_km} كم</span>
              {area.lat && area.lng && <span className="text-[10px] text-green-600 font-mono">{Number(area.lat).toFixed(3)}°، {Number(area.lng).toFixed(3)}°</span>}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleToggle(area.id, area.is_active)}
                className={`text-xs px-2 py-0.5 rounded-full font-semibold ${area.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
              >
                {area.is_active ? "نشط" : "معطّل"}
              </button>
              <button onClick={() => handleDelete(area.id)} className="text-red-400 hover:text-red-600 text-sm">×</button>
            </div>
          </div>
        ))}
        {areas.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">لا توجد مناطق خدمة محددة بعد</p>}
      </div>
    </div>
  );
}

// ── InventorySection — إدارة المخزون المتقدمة ────────────────────────────────
function InventorySection({ productsList, productsLoading, productsError, refetchProducts, refreshAll, categoriesLoading, updateProductStock, formatPrice }: {
  productsList: any[];
  productsLoading: boolean;
  productsError: any;
  refetchProducts: () => void;
  refreshAll: () => void;
  categoriesLoading: boolean;
  updateProductStock: any;
  formatPrice: (v: any) => string;
}) {
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "out">("all");
  const [search, setSearch] = useState("");

  const stats = useMemo(() => {
    const out = productsList.filter(p => p.stock === 0).length;
    const low = productsList.filter(p => {
      const rp = (p as any).reorderPoint ?? (p as any).reorder_point ?? 5;
      return p.stock > 0 && p.stock <= rp;
    }).length;
    return { total: productsList.length, out, low, ok: productsList.length - out - low };
  }, [productsList]);

  const filtered = useMemo(() => {
    let list = productsList;
    if (search.trim()) list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    if (stockFilter === "out") list = list.filter(p => p.stock === 0);
    else if (stockFilter === "low") list = list.filter(p => {
      const rp = (p as any).reorderPoint ?? (p as any).reorder_point ?? 5;
      return p.stock > 0 && p.stock <= rp;
    });
    return list;
  }, [productsList, stockFilter, search]);

  return (
    <div className="space-y-4" dir="rtl">
      {/* ─── إحصائيات المخزون ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-gray-200">
          <CardContent className="pt-4 pb-3 text-center">
            <Package className="h-5 w-5 mx-auto mb-1 text-blue-500" />
            <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
            <p className="text-xs text-muted-foreground">إجمالي المنتجات</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50/30 dark:bg-green-950/10">
          <CardContent className="pt-4 pb-3 text-center">
            <div className="w-5 h-5 rounded-full bg-green-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-green-600">{stats.ok}</p>
            <p className="text-xs text-muted-foreground">متاح بشكل جيد</p>
          </CardContent>
        </Card>
        <Card className={`border-yellow-200 ${stats.low > 0 ? "bg-yellow-50/40 dark:bg-yellow-950/10" : ""}`}>
          <CardContent className="pt-4 pb-3 text-center">
            <div className="w-5 h-5 rounded-full bg-yellow-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-yellow-600">{stats.low}</p>
            <p className="text-xs text-muted-foreground">قارب على النفاد</p>
          </CardContent>
        </Card>
        <Card className={`border-red-200 ${stats.out > 0 ? "bg-red-50/40 dark:bg-red-950/10" : ""}`}>
          <CardContent className="pt-4 pb-3 text-center">
            <div className="w-5 h-5 rounded-full bg-red-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-red-600">{stats.out}</p>
            <p className="text-xs text-muted-foreground">نفذ من المخزون</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">قائمة المنتجات</CardTitle>
            <Button variant="outline" size="sm" className="gap-2" onClick={refetchProducts} disabled={productsLoading} data-testid="button-refresh-inventory">
              {productsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              تحديث
            </Button>
          </div>
          {/* ─── فلتر + بحث ─── */}
          <div className="flex flex-col sm:flex-row gap-2 mt-2">
            <Input
              placeholder="🔍 ابحث عن منتج..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-9 text-sm flex-1"
              data-testid="input-inventory-search"
            />
            <div className="flex gap-1">
              {([["all","الكل"], ["low","منخفض ⚠️"], ["out","نفذ 🔴"]] as const).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setStockFilter(val)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    stockFilter === val
                      ? val === "all" ? "bg-primary text-white" : val === "low" ? "bg-yellow-500 text-white" : "bg-red-500 text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                  data-testid={`button-filter-${val}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {productsLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : productsError ? (
            <div className="text-center py-10">
              <Package className="h-12 w-12 mx-auto mb-4 text-destructive opacity-60" />
              <p className="text-destructive font-medium mb-2">تعذّر تحميل المخزون</p>
              <Button variant="outline" className="gap-2" onClick={refetchProducts} data-testid="button-retry-inventory">
                <RefreshCw className="h-4 w-4" /> إعادة المحاولة
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{search || stockFilter !== "all" ? "لا توجد منتجات تطابق الفلتر" : "لا توجد منتجات بعد"}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* مفتاح الألوان */}
              <div className="flex gap-3 text-xs text-muted-foreground mb-3 flex-wrap">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />متاح</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" />قارب على النفاد</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />نفذ</span>
                <span className="text-muted-foreground/60 mr-2">({filtered.length} منتج)</span>
              </div>
              {filtered.map((product) => {
                const reorderPt = (product as any).reorderPoint ?? (product as any).reorder_point ?? 5;
                const stockStatus = product.stock === 0 ? "out" : product.stock <= reorderPt ? "low" : "ok";
                const borderColor = stockStatus === "out" ? "border-red-300 bg-red-50/40 dark:bg-red-950/10" : stockStatus === "low" ? "border-yellow-300 bg-yellow-50/40 dark:bg-yellow-950/10" : "border-gray-200 bg-card";
                const dotColor = stockStatus === "out" ? "bg-red-500" : stockStatus === "low" ? "bg-yellow-400" : "bg-green-500";
                return (
                  <div key={product.id} className={`flex items-center gap-3 rounded-xl border-2 p-3 shadow-sm transition-colors ${borderColor}`} data-testid={`row-inventory-${product.id}`}>
                    <div className={`w-3 h-3 rounded-full shrink-0 ${dotColor}`} />
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                      <img src={product.imageUrl} alt={product.name} className="h-full w-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatPrice(product.price)} ر.ي
                        {stockStatus === "low" && <span className="text-yellow-600 font-medium mr-2">⚠️ قارب على النفاد</span>}
                        {stockStatus === "out" && <span className="text-red-600 font-medium mr-2">🔴 نفذ من المخزون</span>}
                      </p>
                    </div>
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <span className="text-[10px] text-muted-foreground">الحد</span>
                      <Input
                        type="number" min={0} defaultValue={reorderPt} className="w-16 h-7 text-center text-xs" title="حد إعادة الطلب"
                        onBlur={(e) => { const val = parseInt(e.target.value); if (!isNaN(val)) updateProductStock.mutate({ productId: product.id, reorderPoint: val }); }}
                        data-testid={`input-reorder-${product.id}`}
                      />
                    </div>
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <span className="text-[10px] text-muted-foreground">المخزون</span>
                      <Input
                        type="number" min={0} defaultValue={product.stock}
                        className={`w-20 h-7 text-center text-xs font-bold ${stockStatus === "out" ? "border-red-400 text-red-600" : stockStatus === "low" ? "border-yellow-400 text-yellow-700" : ""}`}
                        onBlur={(e) => { const newStock = parseInt(e.target.value); if (!isNaN(newStock) && newStock !== product.stock) updateProductStock.mutate({ productId: product.id, stock: newStock }); }}
                        data-testid={`input-stock-${product.id}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── إدارة فئات الطباعة الاحترافية ─────────────────────────────────────────
function AdminPrintingCategories({ adminToken }: { adminToken: string | null }) {
  const qc = useQueryClient();
  const [editCat, setEditCat] = useState<PrintingCategory | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "", pricePerSqMeter: "", pricePerSqCm: "", finishOptionsRaw: "",
    colorSeparationPrice: "", minWidthCm: "", minHeightCm: "", isActive: true,
    // Phase 4 — تسعير الطباعة الفوري
    designFeePerMockup: "", colorPricePerColor: "", pricePerSide: "",
  });

  const { data: cats = [], isLoading } = useQuery<PrintingCategory[]>({
    queryKey: ["/api/printing-categories"],
  });

  const headers = { "Content-Type": "application/json", "x-admin-token": adminToken || "" };

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        pricePerSqMeter: form.pricePerSqMeter || null,
        pricePerSqCm: form.pricePerSqCm || null,
        finishOptions: form.finishOptionsRaw ? form.finishOptionsRaw.split("،").map(s => s.trim()).filter(Boolean) : [],
        colorSeparationPrice: form.colorSeparationPrice || null,
        minWidthCm: form.minWidthCm || null,
        minHeightCm: form.minHeightCm || null,
        // Phase 4
        designFeePerMockup: form.designFeePerMockup || "0",
        colorPricePerColor: form.colorPricePerColor || "0",
        pricePerSide: form.pricePerSide || "0",
        isActive: form.isActive,
      };
      if (editCat) {
        await fetch(`/api/admin/printing-categories/${editCat.id}`, { method: "PATCH", headers, body: JSON.stringify(payload) });
      } else {
        await fetch("/api/admin/printing-categories", { method: "POST", headers, body: JSON.stringify(payload) });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/printing-categories"] }); setShowForm(false); setEditCat(null); },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/admin/printing-categories/${id}`, { method: "DELETE", headers });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/printing-categories"] }),
  });

  function openNew() {
    setEditCat(null);
    setForm({
      name: "", pricePerSqMeter: "", pricePerSqCm: "", finishOptionsRaw: "",
      colorSeparationPrice: "", minWidthCm: "", minHeightCm: "", isActive: true,
      designFeePerMockup: "", colorPricePerColor: "", pricePerSide: "",
    });
    setShowForm(true);
  }

  function openEdit(cat: PrintingCategory) {
    setEditCat(cat);
    setForm({
      name: cat.name,
      pricePerSqMeter: cat.pricePerSqMeter || "",
      pricePerSqCm: cat.pricePerSqCm || "",
      finishOptionsRaw: (cat.finishOptions || []).join("، "),
      colorSeparationPrice: cat.colorSeparationPrice || "",
      minWidthCm: cat.minWidthCm || "",
      minHeightCm: cat.minHeightCm || "",
      isActive: cat.isActive,
      designFeePerMockup: (cat as any).designFeePerMockup || "",
      colorPricePerColor: (cat as any).colorPricePerColor || "",
      pricePerSide: (cat as any).pricePerSide || "",
    });
    setShowForm(true);
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-1 rounded bg-primary" />
          <h2 className="text-lg font-bold">فئات الطباعة الاحترافية</h2>
          <span className="text-xs text-muted-foreground">(لوحات، كروت، أوصق، فواتير...)</span>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition">
          <Plus className="h-4 w-4" /> إضافة فئة جديدة
        </button>
      </div>

      {/* نموذج الإضافة/التعديل */}
      {showForm && (
        <div className="bg-muted/30 border rounded-xl p-4 space-y-3">
          <h3 className="font-bold text-sm">{editCat ? "تعديل الفئة" : "إضافة فئة جديدة"}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">اسم الفئة *</label>
              <input className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="مثال: لوحات إعلانية" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">سعر المتر المربع (ر.ي)</label>
              <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                value={form.pricePerSqMeter} onChange={e => setForm(p => ({ ...p, pricePerSqMeter: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">سعر السم المربع (ر.ي)</label>
              <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                value={form.pricePerSqCm} onChange={e => setForm(p => ({ ...p, pricePerSqCm: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">سعر فرز الألوان (ر.ي)</label>
              <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                value={form.colorSeparationPrice} onChange={e => setForm(p => ({ ...p, colorSeparationPrice: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">الحد الأدنى للعرض (سم)</label>
              <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                value={form.minWidthCm} onChange={e => setForm(p => ({ ...p, minWidthCm: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">الحد الأدنى للارتفاع (سم)</label>
              <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                value={form.minHeightCm} onChange={e => setForm(p => ({ ...p, minHeightCm: e.target.value }))} placeholder="0" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">خيارات التشطيب (افصل بـ ،)</label>
              <input className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                value={form.finishOptionsRaw}
                onChange={e => setForm(p => ({ ...p, finishOptionsRaw: e.target.value }))}
                placeholder="فلكس ضد الماء، فلكس عادي، مسلف، ورق" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="cat-active" checked={form.isActive}
                onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} className="w-4 h-4 rounded" />
              <label htmlFor="cat-active" className="text-sm cursor-pointer">فئة نشطة</label>
            </div>
          </div>

          {/* ── Phase 4: تسعير الطباعة الفوري ─────────────────────────── */}
          <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg space-y-3">
            <div className="flex items-start gap-2">
              <span className="text-lg">🖨️</span>
              <div>
                <h4 className="font-bold text-sm text-purple-900 dark:text-purple-200">تسعير الطباعة الفوري (Phase 4)</h4>
                <p className="text-xs text-purple-700 dark:text-purple-300 mt-0.5">
                  أسعار افتراضية للمنتجات في هذه الفئة. يمكن تجاوزها لكل منتج على حدة.
                  ✨ <strong>المنطق الجديد:</strong> سعر الطباعة لكل قطعة = (الألوان × الأوجه × سعر اللون). كل لون وكل وجه مدفوع.
                  مثال: 100 كيس × (1 لون × 2 وجه × 10 ر.ي) = 2,000 ر.ي طباعة + رسوم تصميم.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">🎨 رسوم التصميم (لكل طلب — ر.ي)</label>
                <input type="number" min="0" step="any"
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                  value={form.designFeePerMockup}
                  onChange={e => setForm(p => ({ ...p, designFeePerMockup: e.target.value }))}
                  placeholder="مثال: 1000"
                  data-testid="input-design-fee-per-mockup" />
                <p className="text-[10px] text-muted-foreground mt-1">رسم ثابت يُضاف مرة واحدة لكل طلب فيه طباعة</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">🎨 سعر اللون × الوجه × القطعة (ر.ي)</label>
                <input type="number" min="0" step="any"
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                  value={form.colorPricePerColor}
                  onChange={e => setForm(p => ({ ...p, colorPricePerColor: e.target.value }))}
                  placeholder="مثال: 10"
                  data-testid="input-color-price-per-color" />
                <p className="text-[10px] text-muted-foreground mt-1">يُضرب بـ (عدد الألوان × عدد الأوجه × الكمية)</p>
              </div>
            </div>
            {/* حقل سعر الوجه القديم — مُلغى في v2، لكن نُبقيه مخفياً للتوافق */}
            <input type="hidden" value={form.pricePerSide || "0"}
              onChange={e => setForm(p => ({ ...p, pricePerSide: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowForm(false); setEditCat(null); }}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-muted transition">إلغاء</button>
            <button onClick={() => saveMut.mutate()} disabled={!form.name || saveMut.isPending}
              className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition disabled:opacity-50">
              {saveMut.isPending ? "جاري الحفظ..." : editCat ? "حفظ التعديل" : "إضافة"}
            </button>
          </div>
        </div>
      )}

      {/* قائمة الفئات */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
      ) : cats.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
          <PrinterCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>لا توجد فئات طباعة بعد. أضف أولى الفئات!</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {cats.map((cat) => (
            <div key={cat.id} className="border rounded-xl p-4 bg-card flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-base">{cat.name}</h3>
                  {!cat.isActive && <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">غير نشط</span>}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                  {cat.pricePerSqMeter && <span>المتر²: <strong className="text-foreground">{Number(cat.pricePerSqMeter).toLocaleString("ar-YE")} ر.ي</strong></span>}
                  {cat.pricePerSqCm && <span>السم²: <strong className="text-foreground">{Number(cat.pricePerSqCm).toLocaleString("ar-YE")} ر.ي</strong></span>}
                  {cat.colorSeparationPrice && <span>فرز الألوان: <strong className="text-foreground">+{Number(cat.colorSeparationPrice).toLocaleString("ar-YE")} ر.ي</strong></span>}
                </div>
                {(Number((cat as any).designFeePerMockup) > 0 || Number((cat as any).colorPricePerColor) > 0 || Number((cat as any).pricePerSide) > 0) && (
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px]">
                    {Number((cat as any).designFeePerMockup) > 0 && (
                      <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full" data-testid={`badge-design-fee-${cat.id}`}>
                        🎨 تصميم: {Number((cat as any).designFeePerMockup).toLocaleString("ar-YE")} ر.ي
                      </span>
                    )}
                    {Number((cat as any).colorPricePerColor) > 0 && (
                      <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full" data-testid={`badge-color-price-${cat.id}`}>
                        🎨 لون إضافي: {Number((cat as any).colorPricePerColor).toLocaleString("ar-YE")} ر.ي
                      </span>
                    )}
                    {Number((cat as any).pricePerSide) > 0 && (
                      <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full" data-testid={`badge-side-price-${cat.id}`}>
                        📄 وجه إضافي: {Number((cat as any).pricePerSide).toLocaleString("ar-YE")} ر.ي
                      </span>
                    )}
                  </div>
                )}
                {(cat.finishOptions || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(cat.finishOptions || []).map((opt, i) => (
                      <span key={i} className="text-[11px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">{opt}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => openEdit(cat)} className="px-3 py-1.5 text-xs border rounded-lg hover:bg-muted transition">تعديل</button>
                <button onClick={() => { if (confirm("حذف هذه الفئة؟")) deleteMut.mutate(cat.id); }}
                  className="px-3 py-1.5 text-xs border border-destructive/30 text-destructive rounded-lg hover:bg-destructive/10 transition">حذف</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── مكونات مساعدة لتفاصيل الطلب ──────────────────────────────────────────
function OrderDetailSection({
  title, icon, children, defaultOpen = false
}: { title: string; icon: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-900/40 hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors text-right"
        onClick={() => setOpen(!open)}
      >
        <span className="text-primary">{icon}</span>
        <span className="font-bold text-sm flex-1">{title}</span>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {open && <div className="px-4 py-3">{children}</div>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium text-sm">{value}</p>
    </div>
  );
}

export default function Admin() {
  const [activeSection, setActiveSection] = useState("orders");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  // ── 2FA state ──
  const [otpSessionId, setOtpSessionId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItemWithName[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [openStatusGroups, setOpenStatusGroups] = useState<Set<string>>(new Set(["pending", "deposit_paid", "processing"]));
  const [exchangeRate, setExchangeRate] = useState("140");
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<number | null>(null);
  const [productForm, setProductForm] = useState<ProductFormData>(emptyProductForm);
  const [colorImagesList, setColorImagesList] = useState<ColorImageEntry[]>([]);
  const [smartVariantsList, setSmartVariantsList] = useState<SmartVariant[]>([]);
  const [smartActiveTypes, setSmartActiveTypes] = useState<SmartVariantType[]>([]);
  const [formSections, setFormSections] = useState<Record<string, boolean>>({
    basics: true,
    media: true,
    discount: false,
    smart: false,
    printing: false,
  });
  const toggleSection = (key: string) => setFormSections(prev => ({ ...prev, [key]: !prev[key] }));
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryFormData>(emptyCategoryForm);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const { data: suppliers = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/suppliers"],
    queryFn: async () => {
      if (!adminToken) return [];
      const res = await fetch("/api/admin/suppliers", { headers: { "x-admin-token": adminToken } });
      return res.ok ? res.json() : [];
    },
    enabled: !!adminToken,
    staleTime: 60000,
  });

  const { data: printingCategoriesAdmin = [] } = useQuery<any[]>({
    queryKey: ["/api/printing-categories"],
    staleTime: 60000,
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'product' | 'category' = 'product') => {
    const files = e.target.files;
    if (!files || files.length === 0 || !adminToken) return;

    setIsUploading(true);
    
    try {
      const uploadedUrls: string[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('image', file);

        const res = await fetch('/api/admin/upload', {
          method: 'POST',
          headers: { 'x-admin-token': adminToken },
          body: formData
        });

        if (res.ok) {
          const data = await res.json();
          uploadedUrls.push(data.imageUrl);
        } else {
          const errorData = await res.json().catch(() => ({}));
          toast({ 
            title: `فشل رفع الصورة ${i + 1}`, 
            description: errorData.error || `خطأ ${res.status}`,
            variant: "destructive" 
          });
          console.error('Upload failed:', res.status, errorData);
        }
      }
      
      if (uploadedUrls.length > 0) {
        if (type === 'product') {
          setProductForm(prev => {
            const newImageUrls = [...prev.imageUrls, ...uploadedUrls].slice(0, 5);
            return { 
              ...prev, 
              imageUrl: prev.imageUrl || newImageUrls[0],
              imageUrls: newImageUrls
            };
          });
          toast({ title: `تم رفع ${uploadedUrls.length} صورة بنجاح` });
        } else {
          setCategoryForm(prev => ({ ...prev, imageUrl: uploadedUrls[0] }));
          toast({ title: "تم رفع الصورة بنجاح" });
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({ 
        title: "حدث خطأ أثناء رفع الصورة", 
        description: error instanceof Error ? error.message : "خطأ في الاتصال",
        variant: "destructive" 
      });
    }
    setIsUploading(false);
    e.target.value = '';
  };
  
  const removeProductImage = (indexToRemove: number) => {
    setProductForm(prev => {
      const newImageUrls = prev.imageUrls.filter((_, idx) => idx !== indexToRemove);
      return {
        ...prev,
        imageUrls: newImageUrls,
        imageUrl: newImageUrls[0] || ''
      };
    });
  };

  const [invoiceType, setInvoiceType] = useState<"customer" | "delivery">("delivery");

  const handleOpenInvoice = async (order: Order, type: "customer" | "delivery") => {
    if (!adminToken) return;
    setLoadingItems(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/items`, {
        headers: { 'x-admin-token': adminToken }
      });
      if (res.ok) {
        const items = await res.json();
        setOrderItems(items);
      }
    } catch (error) {
      console.error("Failed to fetch order items:", error);
    }
    setLoadingItems(false);
    setInvoiceType(type);
    setSelectedOrderForInvoice(order);
  };

  const handlePrintDeliveryInvoice = (order: Order) => handleOpenInvoice(order, "delivery");

  useEffect(() => {
    const savedToken = localStorage.getItem("admin_token");
    if (savedToken) {
      fetch('/api/admin/stats', { headers: { 'x-admin-token': savedToken } })
        .then(res => {
          if (res.ok) {
            setAdminToken(savedToken);
            setIsAuthenticated(true);
          } else {
            localStorage.removeItem("admin_token");
          }
        })
        .catch(() => {
          setAdminToken(savedToken);
          setIsAuthenticated(true);
        });
    }
  }, []);

  const { data: adminSettings, refetch: refetchSettings } = useQuery({
    queryKey: ['/api/admin/settings'],
    enabled: isAuthenticated && !!adminToken,
    queryFn: async () => {
      const res = await fetch('/api/admin/settings', {
        headers: { 'x-admin-token': adminToken || '' }
      });
      if (!res.ok) throw new Error('Failed to fetch settings');
      return res.json();
    }
  });

  useEffect(() => {
    if (adminSettings) {
      const rateSetting = adminSettings.find((s: any) => s.key === 'exchange_rate');
      if (rateSetting) {
        setExchangeRate(rateSetting.value);
      }
    }
  }, [adminSettings]);

  const saveSettingsMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-token': adminToken || '' 
        },
        body: JSON.stringify({ key, value })
      });
      if (!res.ok) throw new Error('Failed to save settings');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings'] });
      toast({ title: "تم حفظ سعر الصرف بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ أثناء الحفظ", variant: "destructive" });
    }
  });

  const saveExchangeRate = () => {
    saveSettingsMutation.mutate({ key: 'exchange_rate', value: exchangeRate });
  };

  const { data: orders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ['/api/admin/orders'],
    enabled: isAuthenticated && !!adminToken,
    queryFn: async () => {
      const res = await fetch('/api/admin/orders', {
        headers: { 'x-admin-token': adminToken || '' }
      });
      if (!res.ok) throw new Error('Failed to fetch orders');
      return res.json();
    }
  });

  const { data: products, isLoading: productsLoading, isError: productsError, refetch: refetchProducts } = useQuery<Product[]>({
    queryKey: ['/api/admin/products'],
    enabled: isAuthenticated && !!adminToken,
    queryFn: async () => {
      const res = await fetch('/api/admin/products', {
        headers: { 'x-admin-token': adminToken || '' }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.details || err.message || `Failed to fetch products: ${res.status}`);
      }
      return res.json();
    },
    retry: 1,
    staleTime: 0,
  });

  const productsList = Array.isArray(products) ? products : [];

  const updateOrderStatus = useMutation({
    mutationFn: async ({ orderId, status, trackingNumber }: { orderId: number; status: string; trackingNumber?: string }) => {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-token': adminToken || '' 
        },
        body: JSON.stringify({ status, trackingNumber })
      });
      if (!res.ok) throw new Error('Failed to update order');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/orders'] });
      toast({ title: "تم تحديث حالة الطلب" });
    }
  });

  // تأكيد الطلب يدوياً بعد الاتصال الهاتفي بالعميل
  const confirmOrderMutation = useMutation({
    mutationFn: async ({ orderId, confirmed }: { orderId: number; confirmed: boolean }) => {
      const res = await fetch(`/api/admin/orders/${orderId}/confirm`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken || ''
        },
        body: JSON.stringify({ confirmed })
      });
      if (!res.ok) throw new Error('Failed to confirm order');
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/orders/unconfirmed-count'] });
      toast({ title: vars.confirmed ? "تم تأكيد الطلب" : "تم إلغاء التأكيد" });
    },
    onError: () => {
      toast({ title: "فشل التأكيد", variant: "destructive" });
    }
  });

  // عدد الطلبات غير المؤكدة منذ أكثر من ساعة
  const { data: unconfirmedData } = useQuery<{ count: number }>({
    queryKey: ['/api/admin/orders/unconfirmed-count'],
    enabled: isAuthenticated && !!adminToken,
    queryFn: async () => {
      const res = await fetch('/api/admin/orders/unconfirmed-count', {
        headers: { 'x-admin-token': adminToken || '' }
      });
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    refetchInterval: 60000, // تحديث كل دقيقة
  });
  const unconfirmedCount = unconfirmedData?.count || 0;

  const updateProductStock = useMutation({
    mutationFn: async ({ productId, stock, reorderPoint }: { productId: number; stock?: number; reorderPoint?: number }) => {
      const res = await fetch(`/api/admin/products/${productId}/stock`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-token': adminToken || '' 
        },
        body: JSON.stringify({ ...(stock !== undefined ? { stock } : {}), ...(reorderPoint !== undefined ? { reorderPoint } : {}) })
      });
      if (!res.ok) throw new Error('Failed to update stock');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({ title: "تم تحديث المخزون" });
    }
  });

  const refreshAll = () => {
    refetchProducts();
    refetchCategories();
  };

  const { data: salesStats } = useQuery<{ totalSales: number; totalOrders: number; averageOrderValue: number }>({
    queryKey: ['/api/admin/stats'],
    enabled: isAuthenticated && !!adminToken,
    queryFn: async () => {
      const res = await fetch('/api/admin/stats', {
        headers: { 'x-admin-token': adminToken || '' }
      });
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    }
  });

  // الأقسام الفرعية لاستخدامها في نموذج المنتج (تشمل المخفية للأدمن)
  const { data: subcategories } = useQuery<any[]>({
    queryKey: ['/api/subcategories', 'admin-all'],
    enabled: isAuthenticated && !!adminToken,
    queryFn: async () => {
      const res = await fetch('/api/subcategories?includeHidden=1');
      if (!res.ok) throw new Error('Failed to fetch subcategories');
      return res.json();
    },
  });

  const { data: categories, isLoading: categoriesLoading, isError: categoriesError, refetch: refetchCategories } = useQuery<Category[]>({
    queryKey: ['/api/admin/categories'],
    enabled: isAuthenticated && !!adminToken,
    queryFn: async () => {
      const res = await fetch('/api/admin/categories', {
        headers: { 'x-admin-token': adminToken || '' }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.details || err.message || `Failed to fetch categories: ${res.status}`);
      }
      return res.json();
    },
    retry: 1,
    staleTime: 0,
  });

  const categoriesList = Array.isArray(categories) ? categories : [];

  // ── جلب عناصر الطلب للديالوج ──────────────────────────────────────
  const { data: dialogOrderItems = [], isLoading: dialogItemsLoading } = useQuery<any[]>({
    queryKey: ['/api/admin/orders', selectedOrder?.id, 'items'],
    enabled: !!selectedOrder?.id && !!adminToken,
    queryFn: async () => {
      const res = await fetch(`/api/admin/orders/${selectedOrder!.id}/items`, {
        headers: { 'x-admin-token': adminToken || '' },
      });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 0,
  });

  const createProductMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const numOrNull = (v: string) => (v && v.trim() !== '' ? v.trim() : null);
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-token': adminToken || '' 
        },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          price: data.price,
          priceSar: numOrNull(data.priceSar),
          categoryId: data.categoryId,
          subcategoryId: data.subcategoryId || null,
          isActive: data.isActive,
          stock: data.stock,
          imageUrl: data.imageUrls[0] || data.imageUrl,
          imageUrls: data.imageUrls.length > 0 ? data.imageUrls : null,
          colors: data.colors ? data.colors.split(',').map(c => c.trim()).filter(c => c) : null,
          sizes: data.sizes ? data.sizes.split(',').map(s => s.trim()).filter(s => s) : null,
          allowDesignUpload: data.allowDesignUpload,
          printingPricePerUnit: numOrNull(data.printingPricePerUnit),
          hasPrintingOptions: data.hasPrintingOptions,
          baseBagPrice: numOrNull(data.baseBagPrice),
          singleColorPrintPrice: numOrNull(data.singleColorPrintPrice),
          availableBagColors: data.availableBagColors ? data.availableBagColors.split(',').map(c => c.trim()).filter(c => c) : null,
          printingCategoryId: data.printingCategoryId ? Number(data.printingCategoryId) : null,
          printingDesignFeeOverride: numOrNull(data.printingDesignFeeOverride),
          printingColorPriceOverride: numOrNull(data.printingColorPriceOverride),
          printingSidePriceOverride: numOrNull(data.printingSidePriceOverride),
          printArea: data.printArea || null,
          baseImagePublicId: data.baseImagePublicId?.trim() || null,
          availableColors: (() => {
            const s = (data.availableColors || "").trim();
            if (!s) return null;
            try { const j = JSON.parse(s); return Array.isArray(j) ? j : null; } catch { return null; }
          })(),
          tags: data.tags ? data.tags.split(',').map(t => t.trim()).filter(t => t) : null,
          showReviews: data.showReviews,
          showInPrinting: data.showInPrinting,
          showLivePreview: data.showLivePreview,
          enableVolumeOffers: data.enableVolumeOffers,
          enableQuantityTiers: data.enableQuantityTiers,
          enableVariantUI: data.enableVariantUI,
          colorImages: colorImagesList.length > 0 ? JSON.stringify(colorImagesList) : null,
          enableSmartVariants: data.enableSmartVariants,
          smartVariants: (smartVariantsList.length > 0 || smartActiveTypes.length > 0)
            ? JSON.stringify({ activeTypes: smartActiveTypes, variants: smartVariantsList })
            : null,
          originalPrice: data.originalPrice || null,
          originalPriceSar: data.originalPriceSar || null,
          discountPercent: data.discountPercent ? Number(data.discountPercent) : null,
          promotionalTags: data.promotionalTags.length > 0 ? data.promotionalTags : null,
          hasFreeShipping: data.hasFreeShipping,
          productType: data.productType ?? 'ready',
          supplierId: data.supplierId || null,
          // ── Phase 7: تخصيصات الأدمن ──
          printColorOptions: Array.isArray(data.printColorOptions) && data.printColorOptions.length > 0
            ? data.printColorOptions.filter(c => c.name?.trim() && c.hex?.trim())
            : null,
          quantityTiers: Array.isArray(data.quantityTiers) && data.quantityTiers.length > 0
            ? data.quantityTiers.filter(t => t.qty > 0 && t.totalPrice > 0)
            : null,
          previewWidth: Number(data.previewWidth) || 200,
          previewHeight: Number(data.previewHeight) || 250,
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.details || 'فشل إنشاء المنتج');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/printing-products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/categories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/printing-products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({ title: "تم إضافة المنتج بنجاح" });
      setShowProductForm(false);
      setProductForm(emptyProductForm);
      setColorImagesList([]);
      setSmartVariantsList([]);
      setSmartActiveTypes([]);
    },
    onError: (error: any) => {
      toast({ 
        title: "حدث خطأ أثناء إضافة المنتج", 
        description: error.message || "تأكد من اكتمال جميع الحقول المطلوبة",
        variant: "destructive" 
      });
    }
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ProductFormData }) => {
      const numOrNull = (v: string) => (v && v.trim() !== '' ? v.trim() : null);
      const payload: Record<string, unknown> = {
        name: data.name,
        description: data.description,
        price: data.price,
        priceSar: numOrNull(data.priceSar),
        categoryId: data.categoryId,
        subcategoryId: data.subcategoryId || null,
        isActive: data.isActive,
        stock: data.stock,
        allowDesignUpload: data.allowDesignUpload,
        printingPricePerUnit: numOrNull(data.printingPricePerUnit),
        hasPrintingOptions: data.hasPrintingOptions,
        baseBagPrice: numOrNull(data.baseBagPrice),
        singleColorPrintPrice: numOrNull(data.singleColorPrintPrice),
        colors: data.colors ? data.colors.split(',').map(c => c.trim()).filter(c => c) : null,
        sizes: data.sizes ? data.sizes.split(',').map(s => s.trim()).filter(s => s) : null,
        availableBagColors: data.availableBagColors ? data.availableBagColors.split(',').map(c => c.trim()).filter(c => c) : null,
        printingCategoryId: data.printingCategoryId ? Number(data.printingCategoryId) : null,
        printingDesignFeeOverride: numOrNull(data.printingDesignFeeOverride),
        printingColorPriceOverride: numOrNull(data.printingColorPriceOverride),
        printingSidePriceOverride: numOrNull(data.printingSidePriceOverride),
        printArea: data.printArea || null,
        baseImagePublicId: data.baseImagePublicId?.trim() || null,
        availableColors: (() => {
          const s = (data.availableColors || "").trim();
          if (!s) return null;
          try { const j = JSON.parse(s); return Array.isArray(j) ? j : null; } catch { return null; }
        })(),
        tags: data.tags ? data.tags.split(',').map(t => t.trim()).filter(t => t) : null,
        showReviews: data.showReviews,
        showInPrinting: data.showInPrinting,
        showLivePreview: data.showLivePreview,
        enableVolumeOffers: data.enableVolumeOffers,
        enableQuantityTiers: data.enableQuantityTiers,
        enableVariantUI: data.enableVariantUI,
        colorImages: colorImagesList.length > 0 ? JSON.stringify(colorImagesList) : null,
        enableSmartVariants: data.enableSmartVariants,
        smartVariants: (smartVariantsList.length > 0 || smartActiveTypes.length > 0)
          ? JSON.stringify({ activeTypes: smartActiveTypes, variants: smartVariantsList })
          : null,
        originalPrice: data.originalPrice || null,
        originalPriceSar: data.originalPriceSar || null,
        discountPercent: data.discountPercent ? Number(data.discountPercent) : null,
        promotionalTags: data.promotionalTags.length > 0 ? data.promotionalTags : null,
        hasFreeShipping: data.hasFreeShipping,
        productType: data.productType ?? 'ready',
        supplierId: data.supplierId || null,
        // ── Phase 7: تخصيصات الأدمن ──
        printColorOptions: Array.isArray(data.printColorOptions) && data.printColorOptions.length > 0
          ? data.printColorOptions.filter(c => c.name?.trim() && c.hex?.trim())
          : null,
        quantityTiers: Array.isArray(data.quantityTiers) && data.quantityTiers.length > 0
          ? data.quantityTiers.filter(t => t.qty > 0 && t.totalPrice > 0)
          : null,
        previewWidth: Number(data.previewWidth) || 200,
        previewHeight: Number(data.previewHeight) || 250,
      };
      
      const realImageUrls = (data.imageUrls || []).filter(
        (url: string) => !url.startsWith('/api/products/image/')
      );
      const isProxyMain = data.imageUrl && data.imageUrl.startsWith('/api/products/image/');
      if (realImageUrls.length > 0) {
        payload.imageUrls = realImageUrls;
        payload.imageUrl = realImageUrls[0];
      } else {
        delete payload.imageUrls;
        if (data.imageUrl && !isProxyMain) payload.imageUrl = data.imageUrl;
        else delete payload.imageUrl;
      }
      
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-token': adminToken || '' 
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.details || err.error || 'Failed to update product');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/printing-products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/categories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/printing-products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({ title: "تم تحديث المنتج بنجاح" });
      setShowProductForm(false);
      setEditingProduct(null);
      setProductForm(emptyProductForm);
      setColorImagesList([]);
      setSmartVariantsList([]);
      setSmartActiveTypes([]);
    },
    onError: (error: any) => {
      toast({ 
        title: "حدث خطأ أثناء تحديث المنتج", 
        description: error.message || "حاول مرة أخرى",
        variant: "destructive" 
      });
    }
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': adminToken || '' }
      });
      if (res.status === 401) {
        handleSessionExpired();
        throw new Error("انتهت الجلسة - يرجى تسجيل الدخول مجدداً");
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.details || err.error || 'Failed to delete product');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({ title: "تم حذف المنتج بنجاح" });
    },
    onError: (error: any) => {
      toast({ 
        title: "حدث خطأ أثناء حذف المنتج", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data: CategoryFormData) => {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-token': adminToken || '' 
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create category');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/categories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({ title: "تم إضافة القسم بنجاح" });
      setShowCategoryForm(false);
      setCategoryForm(emptyCategoryForm);
    },
    onError: () => {
      toast({ title: "حدث خطأ أثناء إضافة القسم", variant: "destructive" });
    }
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: CategoryFormData }) => {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-token': adminToken || '' 
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update category');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/categories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({ title: "تم تحديث القسم بنجاح" });
      setShowCategoryForm(false);
      setEditingCategory(null);
      setCategoryForm(emptyCategoryForm);
    },
    onError: () => {
      toast({ title: "حدث خطأ أثناء تحديث القسم", variant: "destructive" });
    }
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': adminToken || '' }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to delete category');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/categories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({ title: "تم حذف القسم بنجاح" });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "حدث خطأ أثناء حذف القسم", variant: "destructive" });
    }
  });

  const handleCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, data: categoryForm });
    } else {
      createCategoryMutation.mutate(categoryForm);
    }
  };

  const openEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      slug: category.slug,
      imageUrl: category.imageUrl,
      isActive: (category as any).isActive !== false,
    });
    setShowCategoryForm(true);
  };

  // ─── Toggle Visibility Mutations ──────────────────────────────────
  const toggleProductVisibility = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await fetch(`/api/admin/products/${id}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken || '' },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error('فشل التبديل');
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({ title: vars.isActive ? "تم إظهار المنتج" : "تم إخفاء المنتج" });
    },
    onError: () => toast({ title: "فشل تحديث الحالة", variant: "destructive" }),
  });

  const toggleCategoryVisibility = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await fetch(`/api/admin/categories/${id}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken || '' },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error('فشل التبديل');
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/categories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({ title: vars.isActive ? "تم إظهار القسم" : "تم إخفاء القسم" });
    },
    onError: () => toast({ title: "فشل تحديث الحالة", variant: "destructive" }),
  });

  const openEditProduct = (product: Product) => {
    setEditingProduct(product);
    const existingImageUrls = product.imageUrls && product.imageUrls.length > 0 
      ? product.imageUrls 
      : (product.imageUrl ? [product.imageUrl] : []);
    setProductForm({
      name: product.name,
      description: product.description,
      price: product.price,
      priceSar: product.priceSar ?? "",
      categoryId: product.categoryId,
      subcategoryId: (product as any).subcategoryId ?? 0,
      isActive: (product as any).isActive !== false,
      imageUrl: product.imageUrl,
      imageUrls: existingImageUrls,
      stock: product.stock,
      colors: product.colors ? product.colors.join(', ') : "",
      sizes: product.sizes ? product.sizes.join(', ') : "",
      allowDesignUpload: product.allowDesignUpload ?? false,
      printingPricePerUnit: product.printingPricePerUnit != null ? String(product.printingPricePerUnit) : "",
      hasPrintingOptions: product.hasPrintingOptions ?? false,
      showReviews: product.showReviews ?? true,
      showInPrinting: (product as any).showInPrinting ?? false,
      baseBagPrice: product.baseBagPrice != null ? String(product.baseBagPrice) : "",
      singleColorPrintPrice: product.singleColorPrintPrice != null ? String(product.singleColorPrintPrice) : "",
      availableBagColors: product.availableBagColors ? product.availableBagColors.join(', ') : "",
      printingCategoryId: (product as any).printingCategoryId != null ? String((product as any).printingCategoryId) : "",
      printingDesignFeeOverride: (product as any).printingDesignFeeOverride != null ? String((product as any).printingDesignFeeOverride) : "",
      printingColorPriceOverride: (product as any).printingColorPriceOverride != null ? String((product as any).printingColorPriceOverride) : "",
      printingSidePriceOverride: (product as any).printingSidePriceOverride != null ? String((product as any).printingSidePriceOverride) : "",
      printArea: (product as any).printArea && typeof (product as any).printArea === "object" ? (product as any).printArea : null,
      baseImagePublicId: (product as any).baseImagePublicId || "",
      availableColors: Array.isArray((product as any).availableColors) ? JSON.stringify((product as any).availableColors, null, 2) : "",
      tags: product.tags ? product.tags.join(', ') : "",
      enableVariantUI: (product as any).enableVariantUI ?? false,
      colorImages: [],
      enableSmartVariants: (product as any).enableSmartVariants ?? false,
      showLivePreview: (product as any).showLivePreview ?? false,
      enableVolumeOffers: (product as any).enableVolumeOffers ?? false,
      enableQuantityTiers: (product as any).enableQuantityTiers ?? false,
      originalPrice: (product as any).originalPrice != null ? String((product as any).originalPrice) : "",
      originalPriceSar: (product as any).originalPriceSar != null ? String((product as any).originalPriceSar) : "",
      discountPercent: (product as any).discountPercent != null ? String((product as any).discountPercent) : "",
      promotionalTags: (product as any).promotionalTags ?? [],
      hasFreeShipping: (product as any).hasFreeShipping ?? false,
      productType: ((product as any).productType === 'customizable' ? 'customizable' : 'ready') as 'ready' | 'customizable',
      supplierId: (product as any).supplierId ?? (product as any).supplier_id ?? 0,
      // ── Phase 7: تحميل تخصيصات الأدمن ──
      printColorOptions: (() => {
        const v = (product as any).printColorOptions;
        if (!v) return emptyProductForm.printColorOptions;
        try { return typeof v === "string" ? JSON.parse(v) : v; } catch { return emptyProductForm.printColorOptions; }
      })(),
      quantityTiers: (() => {
        const v = (product as any).quantityTiers;
        if (!v) return emptyProductForm.quantityTiers;
        try { return typeof v === "string" ? JSON.parse(v) : v; } catch { return emptyProductForm.quantityTiers; }
      })(),
      previewWidth: (product as any).previewWidth ?? 200,
      previewHeight: (product as any).previewHeight ?? 250,
    });
    // Parse colorImages JSON if present
    try {
      const ci = (product as any).colorImages;
      setColorImagesList(ci ? (typeof ci === "string" ? JSON.parse(ci) : ci) : []);
    } catch {
      setColorImagesList([]);
    }
    // Parse smartVariants JSON if present
    try {
      const sv = (product as any).smartVariants;
      if (sv) {
        const parsed = typeof sv === "string" ? JSON.parse(sv) : sv;
        setSmartVariantsList(parsed.variants ?? []);
        setSmartActiveTypes(parsed.activeTypes ?? []);
      } else {
        setSmartVariantsList([]);
        setSmartActiveTypes([]);
      }
    } catch {
      setSmartVariantsList([]);
      setSmartActiveTypes([]);
    }
    setFormSections({
      basics: false,
      media: false,
      discount: false,
      smart: false,
      printing: false,
    });
    setShowProductForm(true);
  };

  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const imageUrl = productForm.imageUrls[0] || productForm.imageUrl;
    if (!productForm.name?.trim()) {
      toast({ title: "يرجى إدخال اسم المنتج", variant: "destructive" });
      return;
    }
    if (!productForm.price) {
      toast({ title: "يرجى إدخال سعر المنتج", variant: "destructive" });
      return;
    }
    if (!productForm.categoryId) {
      toast({ title: "يرجى اختيار قسم المنتج", variant: "destructive" });
      return;
    }
    if (!imageUrl) {
      toast({ title: "يرجى رفع صورة واحدة على الأقل للمنتج", variant: "destructive" });
      return;
    }
    if (editingProduct) {
      updateProductMutation.mutate({ id: editingProduct.id, data: productForm });
    } else {
      createProductMutation.mutate(productForm);
    }
  };

  const handleSessionExpired = () => {
    localStorage.removeItem("admin_token");
    setAdminToken(null);
    setIsAuthenticated(false);
    toast({ title: "انتهت الجلسة", description: "يرجى تسجيل الدخول مجدداً", variant: "destructive" });
  };

  const adminFetch = async (url: string, options: RequestInit = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: { ...options.headers as any, 'x-admin-token': adminToken || '' }
    });
    if (res.status === 401) {
      handleSessionExpired();
      throw new Error("انتهت جلسة المدير - يرجى تسجيل الدخول مجدداً");
    }
    return res;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await response.json();

      if (!response.ok) {
        toast({ title: data?.message || "كلمة المرور غير صحيحة", variant: "destructive" });
        return;
      }

      // الحالة 1: المصادقة الثنائية مفعّلة → اطلب رمز OTP
      if (data.requiresOtp && data.sessionId) {
        setOtpSessionId(data.sessionId);
        toast({
          title: "📱 تم إرسال رمز التحقق",
          description: data.message || "افحص واتساب وأدخل الرمز",
        });
        return;
      }

      // الحالة 2: دخول مباشر (Twilio معطّل أو رقم المدير غير معرّف)
      setAdminToken(data.token);
      setIsAuthenticated(true);
      localStorage.setItem("admin_token", data.token);
      if (data.warning2fa) {
        toast({
          title: "⚠️ تم الدخول بدون مصادقة ثنائية",
          description: `سبب التعطيل: ${data.warning2fa}`,
          variant: "destructive",
        });
      } else {
        toast({ title: "مرحباً بك في لوحة التحكم" });
      }
    } catch (error) {
      toast({ title: "حدث خطأ في الاتصال", variant: "destructive" });
    } finally {
      setLoginLoading(false);
    }
  };

  // ── 2FA: التحقق من رمز OTP ──
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpSessionId || !otpCode) return;
    setLoginLoading(true);
    try {
      const response = await fetch('/api/admin/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: otpSessionId, code: otpCode }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast({ title: data?.message || "رمز خاطئ", variant: "destructive" });
        // إن انتهت الجلسة، أعد المستخدم لشاشة كلمة المرور
        if (response.status === 401 && data?.message?.includes("الجلسة")) {
          setOtpSessionId(null);
          setOtpCode("");
        }
        return;
      }
      setAdminToken(data.token);
      setIsAuthenticated(true);
      localStorage.setItem("admin_token", data.token);
      setOtpSessionId(null);
      setOtpCode("");
      setPassword("");
      toast({ title: "✅ تم التحقق، مرحباً بك" });
    } catch {
      toast({ title: "حدث خطأ في الاتصال", variant: "destructive" });
    } finally {
      setLoginLoading(false);
    }
  };

  const handleCancelOtp = () => {
    setOtpSessionId(null);
    setOtpCode("");
    setPassword("");
  };

  const formatPrice = (price: string | number | null) => {
    if (!price) return '0';
    return Number(price).toLocaleString('ar-YE');
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('ar-YE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isAuthenticated) {
    // ── شاشة 2FA: إدخال رمز واتساب ──
    if (otpSessionId) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                <Lock className="h-8 w-8 text-emerald-600" />
              </div>
              <CardTitle className="text-2xl">رمز التحقق</CardTitle>
              <p className="text-muted-foreground mt-2">
                تم إرسال رمز من 6 أرقام إلى واتساب المدير.
                <br />
                أدخله لإكمال الدخول. صالح لمدة 5 دقائق.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <Label htmlFor="otp-code">رمز التحقق</Label>
                  <Input
                    id="otp-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    className="mt-1 text-center text-2xl tracking-[0.5em] font-mono"
                    autoFocus
                    autoComplete="one-time-code"
                    data-testid="input-admin-otp"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginLoading || otpCode.length !== 6}
                  data-testid="button-verify-otp"
                >
                  {loginLoading ? "جاري التحقق..." : "تحقق ودخول"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={handleCancelOtp}
                  data-testid="button-cancel-otp"
                >
                  ← العودة لإدخال كلمة المرور
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      );
    }

    // ── شاشة كلمة المرور ──
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">لوحة التحكم</CardTitle>
            <p className="text-muted-foreground">أدخل كلمة المرور للوصول</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="password">كلمة المرور</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور"
                  className="mt-1"
                  data-testid="input-admin-password"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={loginLoading || !password}
                data-testid="button-admin-login"
              >
                {loginLoading ? "جاري الإرسال..." : "دخول"}
              </Button>
              <p className="text-xs text-center text-muted-foreground mt-2">
                🔐 محمي بالمصادقة الثنائية — رمز التحقق يُرسل لواتساب المدير
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalRevenue = orders?.reduce((sum, o) => sum + Number(o.total || 0), 0) || 0;
  const pendingOrders = orders?.filter(o => o.status === 'pending' || o.status === 'deposit_paid').length || 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-primary text-white px-4 py-3">
        <div className="container mx-auto flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold">لوحة تحكم OYO PLAST</h1>
            <p className="text-primary-foreground/80 text-xs">إدارة الطلبات والمنتجات</p>
          </div>
          <div className="flex items-center gap-2">
            <FinancialAlertsBadge adminToken={adminToken} />
            <Link href="/admin/broadcast">
              <Button size="sm" variant="secondary" className="gap-1.5" data-testid="button-open-broadcast">
                <Megaphone className="h-4 w-4" /> بث إشعار
              </Button>
            </Link>
            <Link href="/admin/inbox">
              <Button size="sm" variant="secondary" className="gap-1.5" data-testid="button-open-inbox">
                <MessageSquare className="h-4 w-4" /> صندوق الرسائل
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-4">

        {/* Admin Navigation Grid */}
        <AdminNav activeSection={activeSection} onSelectSection={setActiveSection} />

        <Tabs value={activeSection} onValueChange={setActiveSection} className="space-y-4">
          <TabsList style={{ display: "none" }} />

          <TabsContent value="orders">
            {/* تنبيه: طلبات بانتظار التأكيد منذ أكثر من ساعة */}
            {unconfirmedCount > 0 && (
              <div
                className="mb-3 flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 shadow-sm"
                data-testid="alert-unconfirmed-orders"
              >
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <div className="flex-1 text-sm text-amber-900">
                  <span className="font-bold">{unconfirmedCount}</span> طلب بانتظار التأكيد منذ أكثر من ساعة — يُفضّل الاتصال بالعميل للتأكيد.
                </div>
              </div>
            )}
            {ordersLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : !orders || orders.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-40" />
                <p>لا توجد طلبات بعد</p>
              </div>
            ) : (() => {
              const payLabel = (pm: string | null | undefined) => {
                if (!pm) return '—';
                return pm === 'karimi' ? '🏦 الكريمي'
                  : pm === 'najm' ? '🏦 النجم'
                  : pm === 'cash_on_delivery' ? '💵 استلام'
                  : pm === 'bank_transfer' ? '🏦 تحويل'
                  : pm === 'digital_wallet' ? '📱 محفظة'
                  : pm === 'jawal' ? '📱 جوالي'
                  : pm === 'installment_deposit_cod' ? '💳 تقسيط'
                  : pm;
              };
              const STATUS_GROUPS = [
                { status: 'pending',      emoji: '⏳', label: 'قيد الانتظار',   bgCls: 'bg-yellow-50', borderCls: 'border-yellow-300', textCls: 'text-yellow-800' },
                { status: 'deposit_paid', emoji: '💳', label: 'تم دفع العربون', bgCls: 'bg-blue-50',   borderCls: 'border-blue-300',   textCls: 'text-blue-800'   },
                { status: 'processing',   emoji: '🔧', label: 'قيد التجهيز',    bgCls: 'bg-orange-50', borderCls: 'border-orange-300', textCls: 'text-orange-800' },
                { status: 'shipped',      emoji: '🚚', label: 'تم الشحن',        bgCls: 'bg-indigo-50', borderCls: 'border-indigo-300', textCls: 'text-indigo-800' },
                { status: 'delivered',    emoji: '✅', label: 'تم التوصيل',     bgCls: 'bg-teal-50',   borderCls: 'border-teal-300',   textCls: 'text-teal-800'   },
                { status: 'completed',    emoji: '🎉', label: 'مكتمل',           bgCls: 'bg-green-50',  borderCls: 'border-green-300',  textCls: 'text-green-800'  },
                { status: 'cancelled',    emoji: '❌', label: 'ملغي',            bgCls: 'bg-red-50',    borderCls: 'border-red-300',    textCls: 'text-red-800'    },
              ];
              const toggleGroup = (s: string) => setOpenStatusGroups(prev => {
                const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n;
              });
              return (
                <div className="space-y-3">
                  {/* ── شريط الإحصاء السريع ── */}
                  <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                    {STATUS_GROUPS.map(g => {
                      const cnt = orders.filter(o => o.status === g.status).length;
                      if (!cnt) return null;
                      const isOpen = openStatusGroups.has(g.status);
                      return (
                        <button
                          key={g.status}
                          onClick={() => toggleGroup(g.status)}
                          className={`rounded-xl border-2 p-2 text-center transition-all hover:opacity-90 ${isOpen ? `${g.bgCls} ${g.borderCls} ${g.textCls}` : 'bg-white border-gray-200 text-gray-400'}`}
                          data-testid={`btn-status-summary-${g.status}`}
                        >
                          <p className="text-xl">{g.emoji}</p>
                          <p className="font-bold text-lg leading-none">{cnt}</p>
                          <p className="text-xs leading-tight mt-0.5">{g.label}</p>
                        </button>
                      );
                    })}
                  </div>

                  {/* ── مجموعات الطلبات القابلة للطي ── */}
                  {STATUS_GROUPS.map(group => {
                    const groupOrders = orders.filter(o => o.status === group.status);
                    if (!groupOrders.length) return null;
                    const isOpen = openStatusGroups.has(group.status);
                    const groupTotal = groupOrders.reduce((s, o) => s + Number(o.total || 0), 0);
                    return (
                      <Card key={group.status} className={`overflow-hidden border-2 ${group.borderCls} shadow-sm`}>
                        {/* رأس المجموعة */}
                        <button
                          className={`w-full flex items-center justify-between px-4 py-3 ${group.bgCls} hover:opacity-90 transition-all`}
                          onClick={() => toggleGroup(group.status)}
                          data-testid={`btn-toggle-group-${group.status}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{group.emoji}</span>
                            <div className="text-right">
                              <p className={`font-bold ${group.textCls}`}>{group.label}</p>
                              <p className="text-xs text-gray-500">{groupOrders.length} طلب · المجموع: {formatPrice(groupTotal)} ر.ي</p>
                            </div>
                          </div>
                          <ChevronDown className={`h-5 w-5 ${group.textCls} transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* قائمة الطلبات */}
                        {isOpen && (
                          <div className="divide-y">
                            {groupOrders.map((order) => {
                              const status = statusMap[order.status] || statusMap.pending;
                              const StatusIcon = status.icon;
                              // حساب التأكيد + تنظيف الجوال للروابط
                              const isConfirmed = !!(order as any).adminConfirmed;
                              const orderClosed = ['cancelled', 'delivered', 'completed'].includes(order.status);
                              const showAwaiting = !isConfirmed && !orderClosed;
                              const rawPhone = (order.customerPhone || '').replace(/[^\d+]/g, '');
                              // تنسيق الجوال للواتساب: إزالة + والأصفار البادئة، وإضافة 967 إن لم يبدأ بكود الدولة
                              const waPhone = (() => {
                                let p = rawPhone.replace(/^\+/, '');
                                if (p.startsWith('00')) p = p.slice(2);
                                if (p.startsWith('7') && p.length === 9) p = '967' + p;
                                else if (p.startsWith('07') && p.length === 10) p = '967' + p.slice(1);
                                return p;
                              })();
                              const waMessage = encodeURIComponent(
                                `السلام عليكم ${order.customerName || ''}\nنتواصل معكم من *أويو بلاست* بخصوص طلبكم رقم #${order.id}.\nنرجو تأكيد الطلب لنبدأ بتجهيزه. شكراً لكم.`
                              );
                              return (
                                <div key={order.id} className={`p-3 hover:bg-gray-50/60 transition-colors ${showAwaiting ? 'border-r-4 border-amber-400' : ''}`}>
                                  <div className="flex items-center gap-2">
                                    {/* رقم الطلب */}
                                    <div className="shrink-0 text-center w-10 hidden sm:block">
                                      <p className="text-[10px] text-gray-400">رقم</p>
                                      <p className="font-bold text-primary text-sm">#{order.id}</p>
                                    </div>

                                    {/* بيانات العميل */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-bold text-[11px] text-gray-400 sm:hidden">#{order.id}</span>
                                        <p className="font-semibold text-sm">{order.customerName || '—'}</p>
                                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 shrink-0">{payLabel(order.paymentMethod)}</Badge>
                                        {showAwaiting && (
                                          <Badge
                                            className="text-[10px] h-4 px-1.5 shrink-0 bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-100"
                                            data-testid={`badge-awaiting-confirm-${order.id}`}
                                          >
                                            <Clock className="h-2.5 w-2.5 ml-0.5" />
                                            بانتظار التأكيد
                                          </Badge>
                                        )}
                                        {isConfirmed && (
                                          <Badge
                                            className="text-[10px] h-4 px-1.5 shrink-0 bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-100"
                                            data-testid={`badge-confirmed-${order.id}`}
                                          >
                                            <ShieldCheck className="h-2.5 w-2.5 ml-0.5" />
                                            مؤكد
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                                        <span>📱 {order.customerPhone || '—'}</span>
                                        <span>📍 {order.shippingCity || '—'}</span>
                                      </div>
                                      {order.shippingAddress && (
                                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">🏠 {order.shippingAddress}</p>
                                      )}
                                    </div>

                                    {/* المبلغ والتاريخ */}
                                    <div className="shrink-0 text-left hidden sm:block">
                                      <p className="font-bold text-sm text-primary">{formatPrice(order.total)} ر.ي</p>
                                      <p className="text-[11px] text-muted-foreground">{formatDate(order.createdAt)}</p>
                                    </div>

                                    {/* الإجراءات */}
                                    <div className="flex gap-0.5 shrink-0">
                                      {/* اتصال بالعميل */}
                                      {rawPhone && (
                                        <a
                                          href={`tel:${rawPhone}`}
                                          title="اتصال بالعميل"
                                          data-testid={`button-call-customer-${order.id}`}
                                          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-blue-600 hover:bg-blue-50 transition-colors"
                                        >
                                          <Phone className="h-3.5 w-3.5" />
                                        </a>
                                      )}
                                      {/* فتح واتساب */}
                                      {waPhone && (
                                        <a
                                          href={`https://wa.me/${waPhone}?text=${waMessage}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          title="مراسلة عبر واتساب"
                                          data-testid={`button-whatsapp-customer-${order.id}`}
                                          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors"
                                        >
                                          <MessageSquare className="h-3.5 w-3.5" />
                                        </a>
                                      )}
                                      {/* تأكيد الطلب يدوياً */}
                                      {showAwaiting && (
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={() => confirmOrderMutation.mutate({ orderId: order.id, confirmed: true })}
                                          disabled={confirmOrderMutation.isPending}
                                          title="تم التأكيد مع العميل"
                                          data-testid={`button-confirm-order-${order.id}`}
                                          className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-8 w-8"
                                        >
                                          {confirmOrderMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                                        </Button>
                                      )}
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => handleOpenInvoice(order, "customer")}
                                        disabled={loadingItems}
                                        title="فاتورة العميل"
                                        data-testid={`button-admin-customer-invoice-${order.id}`}
                                        className="text-primary hover:text-primary h-8 w-8"
                                      >
                                        {loadingItems ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => handleOpenInvoice(order, "delivery")}
                                        disabled={loadingItems}
                                        title="بوليصة التوصيل"
                                        data-testid={`button-admin-print-invoice-${order.id}`}
                                        className="text-orange-500 hover:text-orange-600 h-8 w-8"
                                      >
                                        {loadingItems ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />}
                                      </Button>
                                      <Dialog onOpenChange={(open) => { if (!open) setSelectedOrder(null); }}>
                                        <DialogTrigger asChild>
                                          <Button size="icon" variant="ghost" onClick={() => setSelectedOrder(order)} data-testid={`button-order-detail-${order.id}`} className="h-8 w-8">
                                            <Eye className="h-3.5 w-3.5" />
                                          </Button>
                                        </DialogTrigger>
                                    <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" dir="rtl">
                                      <DialogHeader className="border-b pb-3">
                                        <DialogTitle className="flex items-center gap-2 text-lg">
                                          <FileText className="h-5 w-5 text-primary" />
                                          تفاصيل الطلب
                                          <Badge variant="outline" className="font-mono text-base">#{order.id}</Badge>
                                          <Badge className={`${statusMap[order.status]?.color || ''} mr-auto`}>
                                            {statusMap[order.status]?.label || order.status}
                                          </Badge>
                                        </DialogTitle>
                                      </DialogHeader>

                                      <div className="space-y-3 py-2">

                                        {/* ── بيانات العميل ── */}
                                        <OrderDetailSection title="بيانات العميل" icon={<Users className="h-4 w-4" />} defaultOpen>
                                          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                                            <Row label="الاسم" value={order.customerName || '-'} />
                                            <Row label="الجوال" value={order.customerPhone || '-'} />
                                            <Row label="المدينة" value={order.shippingCity || '-'} />
                                            <Row label="الشحن" value={order.shippingOption === 'express' ? 'سريع' : 'عادي'} />
                                            <div className="col-span-2">
                                              <Row label="العنوان" value={order.shippingAddress || '-'} />
                                            </div>
                                          </div>
                                        </OrderDetailSection>

                                        {/* ── الدفع والإيصال ── */}
                                        <OrderDetailSection title="الدفع والإيصال" icon={<Banknote className="h-4 w-4" />} defaultOpen>
                                          <div className="space-y-2 text-sm">
                                            <div className="flex items-center justify-between">
                                              <span className="text-muted-foreground">طريقة الدفع</span>
                                              <Badge variant="secondary" className="font-medium">
                                                {order.paymentMethod === 'cash_on_delivery' ? '💵 عند الاستلام'
                                                  : order.paymentMethod === 'bank_transfer' ? '🏦 تحويل بنكي'
                                                  : order.paymentMethod === 'digital_wallet' ? '📱 محفظة إلكترونية'
                                                  : order.paymentMethod === 'karimi' ? '🏦 بنك الكريمي'
                                                  : order.paymentMethod === 'najm' ? '🏦 بنك النجم'
                                                  : order.paymentMethod === 'jawal' ? '📱 جوالي'
                                                  : order.paymentMethod === 'installment_deposit_cod' ? '💳 دفع جزئي'
                                                  : order.paymentMethod || '-'}
                                              </Badge>
                                            </div>
                                            {(order as any).paymentStatus && (
                                              <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground">حالة الدفع</span>
                                                <Badge className={(order as any).paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                                                  {(order as any).paymentStatus === 'paid' ? '✅ مدفوع' : (order as any).paymentStatus === 'pending_verification' ? '⏳ قيد التحقق' : (order as any).paymentStatus}
                                                </Badge>
                                              </div>
                                            )}
                                            {order.receiptImageUrl && (
                                              <div>
                                                <p className="text-muted-foreground mb-1.5">سند الدفع</p>
                                                <a href={order.receiptImageUrl} target="_blank" rel="noopener noreferrer" className="block">
                                                  <div className="relative inline-block group">
                                                    <img
                                                      src={order.receiptImageUrl}
                                                      alt="سند الدفع"
                                                      className="h-20 w-20 object-cover rounded-lg border-2 border-gray-200 group-hover:border-primary transition-colors cursor-zoom-in"
                                                      onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }}
                                                    />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors flex items-center justify-center">
                                                      <ExternalLink className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </div>
                                                  </div>
                                                  <p className="text-xs text-primary mt-1">اضغط لعرض كامل</p>
                                                </a>
                                              </div>
                                            )}
                                          </div>
                                        </OrderDetailSection>

                                        {/* ── الأسعار والخصم ── */}
                                        <OrderDetailSection title="ملخص المبالغ" icon={<DollarSign className="h-4 w-4" />} defaultOpen>
                                          <div className="space-y-1.5 text-sm">
                                            {(order as any).subtotalBeforeDiscount && (
                                              <div className="flex justify-between">
                                                <span className="text-muted-foreground">المجموع قبل الخصم</span>
                                                <span>{formatPrice((order as any).subtotalBeforeDiscount)} ر.ي</span>
                                              </div>
                                            )}
                                            {(order as any).couponCode && (
                                              <div className="flex justify-between text-green-700">
                                                <span className="flex items-center gap-1">
                                                  <Percent className="h-3.5 w-3.5" />
                                                  كوبون: <code className="bg-green-50 px-1 rounded font-mono text-xs">{(order as any).couponCode}</code>
                                                </span>
                                                <span className="font-bold">- {formatPrice((order as any).discountAmount || 0)} ر.ي</span>
                                              </div>
                                            )}
                                            {(order as any).shippingCost > 0 ? (
                                              <div className="flex justify-between">
                                                <span className="text-muted-foreground">الشحن</span>
                                                <span>{formatPrice((order as any).shippingCost)} ر.ي</span>
                                              </div>
                                            ) : (
                                              <div className="flex justify-between text-green-600">
                                                <span>الشحن</span>
                                                <span className="font-bold">مجاني 🎁</span>
                                              </div>
                                            )}
                                            {order.depositAmount && (
                                              <div className="flex justify-between text-blue-600">
                                                <span>العربون المدفوع</span>
                                                <span className="font-bold">{formatPrice(order.depositAmount)} ر.ي</span>
                                              </div>
                                            )}
                                            <Separator />
                                            <div className="flex justify-between font-bold text-base text-primary">
                                              <span>الإجمالي النهائي</span>
                                              <span>{formatPrice(order.total)} ر.ي</span>
                                            </div>
                                          </div>
                                        </OrderDetailSection>

                                        {/* ── عناصر الطلب ── */}
                                        <OrderDetailSection title={`عناصر الطلب (${dialogOrderItems.length})`} icon={<Package className="h-4 w-4" />} defaultOpen>
                                          {dialogItemsLoading ? (
                                            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                                          ) : dialogOrderItems.length === 0 ? (
                                            <p className="text-sm text-muted-foreground text-center py-2">لا توجد عناصر</p>
                                          ) : (
                                            <div className="divide-y">
                                              {dialogOrderItems.map((item: any, idx: number) => (
                                                <div key={item.id || idx} className="py-2.5 flex gap-3">
                                                  {item.productImage && (
                                                    <img src={item.productImage} alt={item.productName} className="w-12 h-12 object-cover rounded-lg flex-shrink-0 border" />
                                                  )}
                                                  <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-sm leading-snug line-clamp-2">{item.productName || `منتج #${item.productId}`}</p>
                                                    {item.customPrinting && (
                                                      <Badge className="bg-purple-100 text-purple-700 text-xs py-0 h-5 gap-1 mt-0.5">
                                                        <Printer className="h-3 w-3" />طباعة مخصصة
                                                      </Badge>
                                                    )}
                                                    <OrderItemCollapsibleMeta item={item} defaultOpen={false} />
                                                  </div>
                                                  <div className="text-left flex-shrink-0">
                                                    <p className="text-xs text-muted-foreground">×{item.quantity}</p>
                                                    <p className="font-bold text-sm text-primary">{formatPrice(Number(item.price) * item.quantity)} ر.ي</p>
                                                    <p className="text-xs text-gray-400">{formatPrice(item.price)}/وحدة</p>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </OrderDetailSection>

                                        {/* ── ملاحظات العميل ── */}
                                        {order.notes && (
                                          <OrderDetailSection title="ملاحظات العميل" icon={<FileText className="h-4 w-4" />}>
                                            <p className="text-sm bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 rounded-lg p-3 text-yellow-800 dark:text-yellow-200">
                                              💬 {order.notes}
                                            </p>
                                          </OrderDetailSection>
                                        )}

                                        {/* ── تغيير الحالة ── */}
                                        <div className="border rounded-xl p-3 bg-gray-50 dark:bg-gray-900/40 space-y-3">
                                          <div>
                                            <Label className="text-sm font-bold">تغيير حالة الطلب</Label>
                                            <Select
                                              value={order.status}
                                              onValueChange={(value) => updateOrderStatus.mutate({ orderId: order.id, status: value })}
                                            >
                                              <SelectTrigger className="mt-1">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="pending">⏳ قيد الانتظار</SelectItem>
                                                <SelectItem value="deposit_paid">💳 تم دفع العربون</SelectItem>
                                                <SelectItem value="processing">🔧 قيد التجهيز</SelectItem>
                                                <SelectItem value="shipped">🚚 تم الشحن</SelectItem>
                                                <SelectItem value="delivered">✅ تم التوصيل</SelectItem>
                                                <SelectItem value="completed">🎉 مكتمل</SelectItem>
                                                <SelectItem value="cancelled">❌ ملغي</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>
                                          <OrderSupplierAssign order={order} adminToken={adminToken} />
                                        </div>

                                      </div>
                                    </DialogContent>
                                      </Dialog>
                                    </div>
                                  </div>
                                  {/* المبلغ والتاريخ على الجوال */}
                                  <div className="flex items-center justify-between mt-1.5 sm:hidden">
                                    <span className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</span>
                                    <span className="font-bold text-sm text-primary">{formatPrice(order.total)} ر.ي</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              );
            })()}
          </TabsContent>

          <TabsContent value="products">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <CardTitle>إدارة المنتجات</CardTitle>
                <Button 
                  onClick={() => {
                    setEditingProduct(null);
                    setProductForm(emptyProductForm);
                    setShowProductForm(true);
                  }}
                  className="gap-2"
                  data-testid="button-add-product"
                >
                  <Plus className="h-4 w-4" />
                  إضافة منتج
                </Button>
              </CardHeader>
              <CardContent>
                {showProductForm && (
                  <div className="mb-6 p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-lg">
                        {editingProduct ? 'تعديل المنتج' : 'إضافة منتج جديد'}
                      </h3>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => {
                          setShowProductForm(false);
                          setEditingProduct(null);
                          setProductForm(emptyProductForm);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <form onSubmit={handleProductSubmit} className="space-y-2">

                      {/* ══ القسم 1: الأساسيات ══ */}
                      <div className="border rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => toggleSection('basics')}
                          className="w-full flex items-center justify-between px-4 py-3 bg-primary/5 hover:bg-primary/10 transition-colors text-right"
                          data-testid="section-basics-toggle"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">١</span>
                            <span className="font-semibold text-sm">الأساسيات</span>
                            <span className="text-xs text-muted-foreground">الاسم · القسم · الوصف · السعر · المخزون</span>
                            {(productForm.name && productForm.price && productForm.categoryId > 0) ? (
                              <span className="text-xs bg-primary text-white px-1.5 py-0.5 rounded-full">✓ مكتمل</span>
                            ) : productForm.name ? (
                              <span className="text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded-full">ناقص</span>
                            ) : null}
                          </div>
                          <ChevronDown className={`h-4 w-4 transition-transform text-muted-foreground ${formSections.basics ? 'rotate-180' : ''}`} />
                        </button>
                        {formSections.basics && (
                          <div className="p-4 space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="product-name">اسم المنتج *</Label>
                                <Input
                                  id="product-name"
                                  value={productForm.name}
                                  onChange={(e) => setProductForm({...productForm, name: e.target.value})}
                                  placeholder="مثال: أكياس بلاستيك شفافة"
                                  required
                                  data-testid="input-product-name"
                                />
                              </div>
                              <div>
                                <Label htmlFor="product-category">القسم *</Label>
                                <Select
                                  value={productForm.categoryId.toString()}
                                  onValueChange={(value) => setProductForm({...productForm, categoryId: parseInt(value), subcategoryId: 0})}
                                >
                                  <SelectTrigger data-testid="select-product-category">
                                    <SelectValue placeholder="اختر القسم" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {categories?.map((cat) => (
                                      <SelectItem key={cat.id} value={cat.id.toString()}>
                                        {cat.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* القسم الفرعي + حالة الظهور */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <Label htmlFor="product-subcategory">القسم الفرعي (اختياري)</Label>
                                <Select
                                  value={productForm.subcategoryId ? productForm.subcategoryId.toString() : "0"}
                                  onValueChange={(value) => setProductForm({...productForm, subcategoryId: parseInt(value)})}
                                  disabled={!productForm.categoryId}
                                >
                                  <SelectTrigger data-testid="select-product-subcategory">
                                    <SelectValue placeholder={productForm.categoryId ? "اختر قسماً فرعياً (اختياري)" : "اختر القسم الرئيسي أولاً"} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="0">— بدون قسم فرعي —</SelectItem>
                                    {(subcategories ?? [])
                                      .filter((s: any) => s.categoryId === productForm.categoryId)
                                      .map((sub: any) => (
                                        <SelectItem key={sub.id} value={sub.id.toString()}>
                                          {sub.name}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex items-end">
                                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border hover:bg-accent w-full" data-testid="toggle-product-active-form">
                                  <input
                                    type="checkbox"
                                    checked={productForm.isActive}
                                    onChange={(e) => setProductForm({...productForm, isActive: e.target.checked})}
                                    className="w-4 h-4"
                                  />
                                  <span className="text-sm font-medium">
                                    {productForm.isActive ? "👁️ ظاهر في المتجر" : "🚫 مخفي عن المتجر"}
                                  </span>
                                </label>
                              </div>
                            </div>
                            <div>
                              <Label htmlFor="product-description">الوصف *</Label>
                              <Textarea
                                id="product-description"
                                value={productForm.description}
                                onChange={(e) => setProductForm({...productForm, description: e.target.value})}
                                placeholder="وصف تفصيلي للمنتج"
                                rows={3}
                                required
                                data-testid="input-product-description"
                              />
                            </div>
                            <div>
                              <Label htmlFor="product-supplier">المورد المسؤول (اختياري)</Label>
                              <Select
                                value={productForm.supplierId ? productForm.supplierId.toString() : "0"}
                                onValueChange={(v) => setProductForm({...productForm, supplierId: parseInt(v)})}
                              >
                                <SelectTrigger data-testid="select-product-supplier" className="mt-1">
                                  <SelectValue placeholder="اختر مورداً (اختياري)" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="0">— بلا مورد محدد (حسب المدينة)</SelectItem>
                                  {(suppliers as any[]).map((s: any) => (
                                    <SelectItem key={s.id} value={s.id.toString()}>
                                      {s.name} — {(s.cities || []).slice(0, 3).join(", ")}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground mt-0.5">إذا تركته فارغاً، يُعيَّن المورد تلقائياً حسب مدينة الشحن</p>
                            </div>
                            {/* ── 💰 السعر يُحدَّد من الخيارات الذكية فقط ── */}
                            <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-900/15 dark:border-blue-800 p-3 text-sm">
                              <div className="flex items-start gap-2">
                                <span className="text-blue-600 dark:text-blue-300 mt-0.5">ℹ️</span>
                                <div className="flex-1">
                                  <p className="font-bold text-blue-900 dark:text-blue-100 mb-1">
                                    السعر يُحدَّد عبر «الخيارات الذكية» أدناه
                                  </p>
                                  <p className="text-blue-800 dark:text-blue-200 text-xs leading-relaxed">
                                    أضف خياراً واحداً على الأقل (مقاس · لون · وزن · شدة) وأدخل سعره بالريال اليمني.
                                    سيُحسب السعر السعودي تلقائياً من سعر الصرف الحالي
                                    (<span className="font-mono font-bold">1 ر.س = {exchangeRate || "140"} ر.ي</span>).
                                  </p>
                                  {productForm.price && Number(productForm.price) > 0 && (
                                    <p className="mt-1.5 text-xs text-blue-700 dark:text-blue-300">
                                      <span className="opacity-70">السعر الأساسي الحالي (محسوب تلقائياً):</span>
                                      <span className="font-bold mx-1">{Number(productForm.price).toLocaleString()} ر.ي</span>
                                      {productForm.priceSar && <>· <span className="font-bold">{productForm.priceSar} ر.س</span></>}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="grid md:grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="product-stock">المخزون</Label>
                                <Input
                                  id="product-stock"
                                  type="number"
                                  value={productForm.stock}
                                  onChange={(e) => setProductForm({...productForm, stock: parseInt(e.target.value) || 0})}
                                  placeholder="100"
                                  data-testid="input-product-stock"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* ══ القسم 2: الصور والألوان ══ */}
                      <div className="border rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => toggleSection('media')}
                          className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 dark:bg-blue-900/10 hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors text-right"
                          data-testid="section-media-toggle"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-bold">٢</span>
                            <span className="font-semibold text-sm">الصور والألوان</span>
                            <span className="text-xs text-muted-foreground">صور المنتج · الألوان · المقاسات · الكلمات الدلالية</span>
                            {productForm.imageUrls.length > 0 ? (
                              <span className="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded-full">✓ {productForm.imageUrls.length} صورة</span>
                            ) : productForm.imageUrl ? (
                              <span className="text-xs bg-blue-400 text-white px-1.5 py-0.5 rounded-full">✓ صورة رئيسية</span>
                            ) : null}
                          </div>
                          <ChevronDown className={`h-4 w-4 transition-transform text-muted-foreground ${formSections.media ? 'rotate-180' : ''}`} />
                        </button>
                        {formSections.media && (
                          <div className="p-4 space-y-4">
                            <div>
                              <Label htmlFor="product-image">صور المنتج * (2-5 صور)</Label>
                              <div className="flex items-center gap-4 mt-1">
                                <label
                                  htmlFor="product-image-upload"
                                  className={`flex items-center gap-2 px-4 py-2 rounded-md cursor-pointer transition-colors ${
                                    productForm.imageUrls.length >= 5
                                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                      : 'bg-primary text-white hover:bg-primary/90'
                                  }`}
                                >
                                  <ImagePlus className="h-4 w-4" />
                                  <span>{isUploading ? 'جاري الرفع...' : `رفع صورة (${productForm.imageUrls.filter(u => !u.startsWith('/api/products/image/')).length}/5)`}</span>
                                </label>
                                <input
                                  type="file"
                                  id="product-image-upload"
                                  accept="image/*"
                                  multiple
                                  className="hidden"
                                  onChange={(e) => handleImageUpload(e, 'product')}
                                  disabled={isUploading || productForm.imageUrls.length >= 5}
                                  data-testid="input-product-image-upload"
                                />
                              </div>
                              {productForm.imageUrls.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {productForm.imageUrls.map((url, idx) => (
                                    <div key={idx} className="relative group">
                                      <div className="w-20 h-20 rounded-lg overflow-hidden border">
                                        <img
                                          src={url}
                                          alt={`صورة ${idx + 1}`}
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => removeProductImage(idx)}
                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                        data-testid={`button-remove-image-${idx}`}
                                      >
                                        ×
                                      </button>
                                      {idx === 0 && (
                                        <span className="absolute bottom-0 left-0 right-0 bg-primary/80 text-white text-[10px] text-center py-0.5">رئيسية</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">الصورة الأولى ستكون الصورة الرئيسية للمنتج</p>
                            </div>
                            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 p-3 text-xs text-emerald-700 dark:text-emerald-300">
                              <strong>ملاحظة:</strong> الألوان والمقاسات تُضاف الآن من قسم <strong>«الخيارات الذكية»</strong> أدناه — مع سعرها وصورتها لكل خيار.
                            </div>
                            <div>
                              <Label htmlFor="product-tags">الكلمات الدلالية (مفصولة بفاصلة)</Label>
                              <Input
                                id="product-tags"
                                value={productForm.tags}
                                onChange={(e) => setProductForm({...productForm, tags: e.target.value})}
                                placeholder="كيس-قماشي, أكياس-بلاستيك, طباعة-مخصصة"
                                data-testid="input-product-tags"
                              />
                              <p className="text-xs text-muted-foreground mt-1">تُستخدم للبحث وتصنيف المنتجات</p>
                              <div className="mt-2 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-2 text-xs text-blue-700 dark:text-blue-300">
                                <strong>💡 وسوم خاصة بالموظف الذكي:</strong>
                                <ul className="mt-1 space-y-0.5 list-disc list-inside">
                                  <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">مخزون-مفتوح</code> — مخزون غير محدود (لا يقول الموظف "نفد المخزون")</li>
                                  <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">unlimited-stock</code> — نفس التأثير (بالإنجليزية)</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* ══ القسم 3: الخصم والترويج ══ */}
                      <div className="border rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => toggleSection('discount')}
                          className="w-full flex items-center justify-between px-4 py-3 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors text-right"
                          data-testid="section-discount-toggle"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">٣</span>
                            <span className="font-semibold text-sm">الخصم والترويج</span>
                            <span className="text-xs text-muted-foreground">خصم · تصنيفات ترويجية · شحن مجاني · تقييمات</span>
                            {(productForm.discountPercent && Number(productForm.discountPercent) > 0) && (
                              <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full">-{productForm.discountPercent}%</span>
                            )}
                          </div>
                          <ChevronDown className={`h-4 w-4 transition-transform text-muted-foreground ${formSections.discount ? 'rotate-180' : ''}`} />
                        </button>
                        {formSections.discount && (
                        <div className="p-4 space-y-3">
                        {/* ── 💡 الخصم يُدار من الخيارات الذكية ── */}
                        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-900/15 dark:border-blue-800 p-3 text-sm">
                          <div className="flex items-start gap-2">
                            <span className="text-blue-600 dark:text-blue-300 mt-0.5">ℹ️</span>
                            <div className="flex-1">
                              <p className="font-bold text-blue-900 dark:text-blue-100 mb-1">
                                الخصم يُدار داخل كل خيار ذكي
                              </p>
                              <p className="text-blue-800 dark:text-blue-200 text-xs leading-relaxed">
                                للحصول على خصم على المنتج، أدخل نسبة الخصم في حقل «% خصم» داخل قسم «الخيارات الذكية» لكل متغيّر (مقاس/لون/وزن/شدة).
                                {productForm.discountPercent && Number(productForm.discountPercent) > 0 && (
                                  <span className="block mt-1 font-bold text-emerald-700 dark:text-emerald-300">
                                    ✓ الخصم الفعلي على هذا المنتج (من أرخص خيار ذكي): {productForm.discountPercent}%
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs font-semibold block mb-2">التصنيفات الترويجية (يظهر في أقسام الرئيسية)</Label>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { value: 'new', label: '🆕 إصدارات جديدة' },
                              { value: 'offers', label: '🎁 عروض حصرية' },
                              { value: 'discounts', label: '💸 تخفيضات' },
                              { value: 'deals', label: '🤝 صفقات' },
                              { value: 'clearance', label: '🏷️ تصفيات مخزون' },
                              { value: 'featured', label: '⭐ عروض مميزة' },
                            ].map(tag => (
                              <label key={tag.value} className={`flex items-center gap-1.5 cursor-pointer border rounded-lg px-3 py-1.5 transition-colors text-xs ${productForm.promotionalTags.includes(tag.value) ? 'bg-red-100 border-red-400 font-bold' : 'bg-white dark:bg-gray-800 hover:bg-gray-50'}`}>
                                <input
                                  type="checkbox"
                                  checked={productForm.promotionalTags.includes(tag.value)}
                                  onChange={(e) => {
                                    const tags = e.target.checked
                                      ? [...productForm.promotionalTags, tag.value]
                                      : productForm.promotionalTags.filter(t => t !== tag.value);
                                    setProductForm({...productForm, promotionalTags: tags});
                                  }}
                                  className="rounded"
                                />
                                {tag.label}
                              </label>
                            ))}
                          </div>
                        </div>
                        {/* شحن مجاني + إظهار التقييمات */}
                        <div className="border-t pt-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="product-free-shipping"
                              checked={productForm.hasFreeShipping}
                              onChange={(e) => setProductForm({...productForm, hasFreeShipping: e.target.checked})}
                              className="rounded border-gray-300"
                              data-testid="checkbox-free-shipping"
                            />
                            <Label htmlFor="product-free-shipping" className="font-medium flex items-center gap-2">
                              🚚 شحن مجاني على هذا المنتج
                            </Label>
                          </div>
                          {/* ── نوع المنتج: جاهز / قابل للطباعة ── */}
                          <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 p-3 space-y-2 mt-1">
                            <Label className="font-bold text-sm flex items-center gap-2">
                              🏷️ نوع المنتج
                            </Label>
                            <p className="text-[11px] text-muted-foreground">
                              يتحكم في ظهور خيارات الطباعة/الألوان/رفع الشعار في صفحة المنتج
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                              <label className={`flex items-start gap-2 rounded-md border p-2.5 cursor-pointer transition ${productForm.productType === 'ready' ? 'border-blue-500 bg-blue-100/60 dark:bg-blue-900/30' : 'border-gray-200 hover:border-blue-300'}`}>
                                <input
                                  type="radio"
                                  name="product-type"
                                  value="ready"
                                  checked={productForm.productType === 'ready'}
                                  onChange={() => setProductForm({...productForm, productType: 'ready'})}
                                  className="mt-0.5"
                                  data-testid="radio-product-type-ready"
                                />
                                <div className="flex-1">
                                  <p className="font-bold text-sm">📦 منتج جاهز</p>
                                  <p className="text-[10px] text-muted-foreground">بدون طباعة — لا تظهر خيارات الألوان أو الشعار</p>
                                </div>
                              </label>
                              <label className={`flex items-start gap-2 rounded-md border p-2.5 cursor-pointer transition ${productForm.productType === 'customizable' ? 'border-blue-500 bg-blue-100/60 dark:bg-blue-900/30' : 'border-gray-200 hover:border-blue-300'}`}>
                                <input
                                  type="radio"
                                  name="product-type"
                                  value="customizable"
                                  checked={productForm.productType === 'customizable'}
                                  onChange={() => setProductForm({...productForm, productType: 'customizable'})}
                                  className="mt-0.5"
                                  data-testid="radio-product-type-customizable"
                                />
                                <div className="flex-1">
                                  <p className="font-bold text-sm">🎨 منتج قابل للطباعة</p>
                                  <p className="text-[10px] text-muted-foreground">تظهر كل خيارات التخصيص (ألوان، شعار، طباعة)</p>
                                </div>
                              </label>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="product-show-reviews"
                              checked={productForm.showReviews}
                              onChange={(e) => setProductForm({...productForm, showReviews: e.target.checked})}
                              className="rounded border-gray-300"
                              data-testid="checkbox-show-reviews"
                            />
                            <Label htmlFor="product-show-reviews" className="font-medium flex items-center gap-2">
                              <Star className="h-4 w-4" />
                              إظهار التقييمات والمراجعات
                            </Label>
                          </div>

                          {/* ── ظهور في قسم الطباعة والتصميم ── */}
                          <div className="flex items-center gap-2 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg px-3 py-2">
                            <input
                              type="checkbox"
                              id="product-show-in-printing"
                              checked={productForm.showInPrinting}
                              onChange={(e) => setProductForm({...productForm, showInPrinting: e.target.checked})}
                              className="rounded border-gray-300 accent-teal-600"
                              data-testid="checkbox-show-in-printing"
                            />
                            <Label htmlFor="product-show-in-printing" className="font-medium flex items-center gap-2 text-teal-700 dark:text-teal-300 cursor-pointer">
                              🖨️ ظهور في قسم الطباعة والتصميم
                            </Label>
                            {productForm.showInPrinting && (
                              <span className="mr-auto text-xs bg-teal-600 text-white px-2 py-0.5 rounded-full">مفعّل</span>
                            )}
                          </div>

                        </div>
                        </div>
                        )}
                      </div>

                      {/* ══ القسم 4: الخيارات الذكية والواجهة ══ */}
                      <div className="border rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => toggleSection('smart')}
                          className="w-full flex items-center justify-between px-4 py-3 bg-emerald-50 dark:bg-emerald-900/10 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-colors text-right"
                          data-testid="section-smart-toggle"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">٤</span>
                            <span className="font-semibold text-sm">الخيارات الذكية</span>
                            <span className="text-xs text-muted-foreground">واجهة SHEIN · مقاسات · ألوان · أوزان</span>
                            {(smartVariantsList.length > 0 || productForm.enableVariantUI) && (
                              <span className="text-xs bg-emerald-600 text-white px-1.5 py-0.5 rounded-full">
                                {smartVariantsList.length > 0 ? `${smartVariantsList.length} خيار` : 'SHEIN'}
                              </span>
                            )}
                          </div>
                          <ChevronDown className={`h-4 w-4 transition-transform text-muted-foreground ${formSections.smart ? 'rotate-180' : ''}`} />
                        </button>
                        <div className={formSections.smart ? "p-3 space-y-3" : "hidden"}>
                        {/* الخيارات الذكية للمنتج */}
                        <div className="border rounded-lg p-3 bg-emerald-50 dark:bg-emerald-900/10 space-y-4">
                          <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded font-bold">جديد</span>
                              <Label className="font-bold text-sm">الخيارات الذكية للمنتج</Label>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">أضف خيارات للمقاس أو اللون أو الوزن — كل خيار بسعره وخصمه الخاص.</p>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <input
                              type="checkbox"
                              id="enable-smart-variants"
                              checked={productForm.enableSmartVariants}
                              onChange={(e) => setProductForm({...productForm, enableSmartVariants: e.target.checked})}
                              className="w-6 h-6 cursor-pointer accent-emerald-600"
                              data-testid="checkbox-enable-smart-variants"
                            />
                            <span className={`text-xs font-bold ${productForm.enableSmartVariants ? 'text-emerald-600' : 'text-gray-400'}`}>
                              {productForm.enableSmartVariants ? 'مفعّل' : 'موقوف'}
                            </span>
                          </div>
                        </div>

                        {productForm.enableSmartVariants && (
                          <div className="space-y-4">
                            {/* تنبيه: الخيارات الذكية تتجاوز التسعير القديم */}
                            <div className="bg-blue-50 dark:bg-blue-950/30 border-r-4 border-blue-500 rounded p-2.5 text-xs space-y-1">
                              <p className="font-bold text-blue-900 dark:text-blue-200">ℹ️ معلومة هامة</p>
                              <p className="text-blue-800 dark:text-blue-300 leading-relaxed">
                                عند تفعيل الخيارات الذكية، أسعارها <b>تتجاوز السعر الأساسي للمنتج</b>. السعر الموحد (في الأعلى)
                                يبقى كسعر افتراضي يُستخدم فقط عندما لا يختار العميل أي خيار ذكي بسعر.
                                ننصح بإدخال السعر الكامل لكل خيار (مقاس/وزن/شدة) لتجنب أي تداخل.
                              </p>
                            </div>
                            {/* أزرار أنواع الخيارات */}
                            <div>
                              <Label className="text-sm font-semibold mb-2 block">أنواع الخيارات المفعّلة</Label>
                              <div className="flex gap-2 flex-wrap">
                                {(["size", "weight", "color", "image", "bundle"] as SmartVariantType[]).map(type => (
                                  <button
                                    key={type}
                                    type="button"
                                    onClick={() => {
                                      setSmartActiveTypes(prev =>
                                        smartActiveTypes.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
                                      );
                                    }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-all ${
                                      smartActiveTypes.includes(type)
                                        ? 'bg-emerald-600 text-white border-emerald-600'
                                        : 'bg-white dark:bg-gray-800 text-gray-600 border-gray-300 hover:border-emerald-400'
                                    }`}
                                    data-testid={`button-toggle-type-${type}`}
                                  >
                                    <span>{SMART_VARIANT_TYPE_ICONS[type]}</span>
                                    <span>{SMART_VARIANT_TYPE_LABELS[type]}</span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* قائمة الخيارات */}
                            {smartActiveTypes.length > 0 && (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <Label className="font-semibold">الخيارات ({smartVariantsList.length})</Label>
                                  <div className="flex gap-1.5">
                                    {smartActiveTypes.map(type => (
                                      <Button
                                        key={type}
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs gap-1 border-emerald-300 text-emerald-700"
                                        onClick={() => {
                                          const newItem: SmartVariant = {
                                            id: Date.now().toString(),
                                            type,
                                            label: "",
                                            price: "",
                                            priceSar: "",
                                            discount: "",
                                            hex: "#000000",
                                            imageUrl: "",
                                            ...(type === 'bundle' ? { count: 0 } : {}),
                                          };
                                          setSmartVariantsList(prev => [...prev, newItem]);
                                          setProductForm(prev => ({ ...prev, enableSmartVariants: true }));
                                        }}
                                        data-testid={`button-add-variant-${type}`}
                                      >
                                        <Plus className="h-3 w-3" />
                                        {SMART_VARIANT_TYPE_ICONS[type]} {SMART_VARIANT_TYPE_LABELS[type]}
                                      </Button>
                                    ))}
                                  </div>
                                </div>

                                {smartVariantsList.length === 0 && (
                                  <p className="text-xs text-emerald-600 text-center py-3 border border-dashed border-emerald-300 rounded bg-white dark:bg-gray-800">
                                    اضغط على زر الإضافة أعلاه لإضافة أول خيار
                                  </p>
                                )}

                                <div className="space-y-2">
                                  {smartVariantsList.map((v, idx) => (
                                    <div key={v.id} className="bg-white dark:bg-gray-800 rounded-lg border p-3 space-y-2">
                                      {/* الصف الأول: النوع + الاسم + حذف */}
                                      <div className="flex items-center gap-2">
                                        <span className="text-lg flex-shrink-0">{SMART_VARIANT_TYPE_ICONS[v.type]}</span>
                                        <span className="text-xs font-bold text-emerald-700 flex-shrink-0 bg-emerald-100 px-1.5 py-0.5 rounded">
                                          {SMART_VARIANT_TYPE_LABELS[v.type]}
                                        </span>
                                        <Input
                                          placeholder={
                                            v.type === 'size' ? 'مثال: 50 جرام' :
                                            v.type === 'weight' ? 'مثال: 1 كجم' :
                                            v.type === 'color' ? 'مثال: أحمر' :
                                            v.type === 'bundle' ? 'مثال: شدّة 5 قطع' :
                                            'اسم الصورة'
                                          }
                                          value={v.label}
                                          onChange={(e) => {
                                            const updated = [...smartVariantsList];
                                            updated[idx] = { ...updated[idx], label: e.target.value };
                                            setSmartVariantsList(updated);
                                          }}
                                          className="h-8 text-sm flex-1"
                                          data-testid={`input-variant-label-${idx}`}
                                        />
                                        {v.type === 'color' && (
                                          <input
                                            type="color"
                                            value={v.hex || "#000000"}
                                            onChange={(e) => {
                                              const updated = [...smartVariantsList];
                                              updated[idx] = { ...updated[idx], hex: e.target.value };
                                              setSmartVariantsList(updated);
                                            }}
                                            className="w-8 h-8 cursor-pointer rounded border flex-shrink-0"
                                            title="اختر اللون"
                                          />
                                        )}
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="ghost"
                                          className="h-8 w-8 text-destructive flex-shrink-0"
                                          onClick={() => setSmartVariantsList(prev => prev.filter((_, i) => i !== idx))}
                                          data-testid={`button-remove-variant-${idx}`}
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                      {/* الصف الثاني: السعر + السعر SAR + الخصم */}
                                      <div className="grid grid-cols-3 gap-2">
                                        <div>
                                          <Label className="text-[10px] text-gray-500 mb-0.5 block">سعر YER</Label>
                                          <Input
                                            placeholder="السعر ريال يمني"
                                            value={v.price}
                                            onChange={(e) => {
                                              const updated = [...smartVariantsList];
                                              updated[idx] = { ...updated[idx], price: e.target.value };
                                              setSmartVariantsList(updated);
                                            }}
                                            type="number"
                                            className="h-8 text-sm"
                                            data-testid={`input-variant-price-${idx}`}
                                          />
                                        </div>
                                        <div>
                                          <Label className="text-[10px] text-gray-500 mb-0.5 block">سعر SAR</Label>
                                          <Input
                                            placeholder="السعر ريال سعودي"
                                            value={v.priceSar}
                                            onChange={(e) => {
                                              const updated = [...smartVariantsList];
                                              updated[idx] = { ...updated[idx], priceSar: e.target.value };
                                              setSmartVariantsList(updated);
                                            }}
                                            type="number"
                                            className="h-8 text-sm"
                                            data-testid={`input-variant-pricestar-${idx}`}
                                          />
                                        </div>
                                        <div>
                                          <Label className="text-[10px] text-gray-500 mb-0.5 block">خصم %</Label>
                                          <Input
                                            placeholder="0"
                                            value={v.discount}
                                            onChange={(e) => {
                                              const updated = [...smartVariantsList];
                                              updated[idx] = { ...updated[idx], discount: e.target.value };
                                              setSmartVariantsList(updated);
                                            }}
                                            type="number"
                                            min="0"
                                            max="99"
                                            className="h-8 text-sm"
                                            data-testid={`input-variant-discount-${idx}`}
                                          />
                                        </div>
                                      </div>
                                      {/* 💰 الصف الثالث: تكلفة الشراء (COGS) + هامش الربح */}
                                      <div className="bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800 rounded p-2 space-y-1.5">
                                        <Label className="text-[11px] text-sky-700 dark:text-sky-300 font-semibold block">
                                          💰 تكلفة الشراء من المورد (سرّية — للأدمن فقط)
                                        </Label>
                                        <div className="grid grid-cols-3 gap-2">
                                          <div>
                                            <Label className="text-[10px] text-gray-500 mb-0.5 block">تكلفة YER</Label>
                                            <Input
                                              placeholder="مثال: 7000"
                                              value={v.costPriceY || ""}
                                              onChange={(e) => {
                                                const updated = [...smartVariantsList];
                                                updated[idx] = { ...updated[idx], costPriceY: e.target.value };
                                                setSmartVariantsList(updated);
                                              }}
                                              type="number"
                                              min="0"
                                              className="h-8 text-sm"
                                              data-testid={`input-variant-cost-${idx}`}
                                            />
                                          </div>
                                          <div>
                                            <Label className="text-[10px] text-gray-500 mb-0.5 block">تكلفة SAR</Label>
                                            <Input
                                              placeholder="اختياري"
                                              value={v.costPriceSar || ""}
                                              onChange={(e) => {
                                                const updated = [...smartVariantsList];
                                                updated[idx] = { ...updated[idx], costPriceSar: e.target.value };
                                                setSmartVariantsList(updated);
                                              }}
                                              type="number"
                                              min="0"
                                              className="h-8 text-sm"
                                              data-testid={`input-variant-cost-sar-${idx}`}
                                            />
                                          </div>
                                          <div>
                                            <Label className="text-[10px] text-gray-500 mb-0.5 block">أقل كمية</Label>
                                            <Input
                                              placeholder="1"
                                              value={v.minOrderQty ?? ""}
                                              onChange={(e) => {
                                                const updated = [...smartVariantsList];
                                                updated[idx] = { ...updated[idx], minOrderQty: e.target.value ? parseInt(e.target.value, 10) : undefined };
                                                setSmartVariantsList(updated);
                                              }}
                                              type="number"
                                              min="1"
                                              className="h-8 text-sm"
                                              data-testid={`input-variant-min-qty-${idx}`}
                                            />
                                          </div>
                                        </div>
                                        {(() => {
                                          const sell = parseFloat(v.price || "0");
                                          const cost = parseFloat(v.costPriceY || "0");
                                          if (!(sell > 0) || !(cost > 0)) {
                                            return (
                                              <p className="text-[10px] text-gray-500 dark:text-gray-400">
                                                أدخل سعر التكلفة لحساب هامش الربح تلقائياً.
                                              </p>
                                            );
                                          }
                                          if (sell < cost) {
                                            return (
                                              <div className="bg-red-100 dark:bg-red-950/40 border border-red-300 rounded px-2 py-1 text-[11px] text-red-800 dark:text-red-300 font-bold" data-testid={`warning-loss-${idx}`}>
                                                ⚠️ تحذير: هذا الخيار يُباع بخسارة قدرها {(cost - sell).toLocaleString()} ر.ي!
                                              </div>
                                            );
                                          }
                                          const margin = sell - cost;
                                          const percent = Math.round((margin / sell) * 100);
                                          const color = percent < 10 ? "text-orange-700 dark:text-orange-400"
                                            : percent < 25 ? "text-amber-700 dark:text-amber-400"
                                            : "text-emerald-700 dark:text-emerald-400";
                                          return (
                                            <div className={`text-[11px] font-bold ${color}`} data-testid={`profit-margin-${idx}`}>
                                              ✅ هامش الربح: {margin.toLocaleString()} ر.ي ({percent}%)
                                            </div>
                                          );
                                        })()}
                                      </div>
                                      {/* عدد القطع داخل الشدّة + حساب توفير العميل */}
                                      {v.type === 'bundle' && (
                                        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded p-2 space-y-1.5">
                                          <Label className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold block">
                                            🎁 عدد القطع داخل الشدّة
                                          </Label>
                                          <Input
                                            type="number"
                                            min="1"
                                            placeholder="مثال: 5"
                                            value={v.count ?? ""}
                                            onChange={(e) => {
                                              const updated = [...smartVariantsList];
                                              updated[idx] = { ...updated[idx], count: e.target.value ? parseInt(e.target.value, 10) : undefined };
                                              setSmartVariantsList(updated);
                                            }}
                                            className="h-8 text-sm"
                                            data-testid={`input-variant-count-${idx}`}
                                          />
                                          {(() => {
                                            const base = parseFloat(productForm.price || "0");
                                            const bundlePrice = parseFloat(v.price || "0");
                                            const count = v.count || 0;
                                            if (base > 0 && bundlePrice > 0 && count > 1) {
                                              const fullPrice = base * count;
                                              const save = fullPrice - bundlePrice;
                                              const perPiece = bundlePrice / count;
                                              if (save > 0) {
                                                return (
                                                  <div className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
                                                    ✅ يوفّر العميل {save.toLocaleString()} ر.ي · سعر القطعة في الشدّة: {Math.round(perPiece).toLocaleString()} ر.ي
                                                  </div>
                                                );
                                              }
                                            }
                                            return (
                                              <p className="text-[10px] text-amber-600 dark:text-amber-400">
                                                مثال: 5 شدّات بسعر 9,500 ر.ي بدلاً من 10,000 ر.ي (سعر القطعة × 5)
                                              </p>
                                            );
                                          })()}
                                        </div>
                                      )}
                                      {/* رابط الصورة للصورة واللون */}
                                      {(v.type === 'image' || v.type === 'color') && (
                                        <div className="flex items-center gap-2">
                                          <Input
                                            placeholder="رابط الصورة (اختياري)"
                                            value={v.imageUrl}
                                            onChange={(e) => {
                                              const updated = [...smartVariantsList];
                                              updated[idx] = { ...updated[idx], imageUrl: e.target.value };
                                              setSmartVariantsList(updated);
                                            }}
                                            className="h-8 text-sm flex-1"
                                            data-testid={`input-variant-imageurl-${idx}`}
                                          />
                                          {v.imageUrl && (
                                            <div className="w-10 h-10 rounded overflow-hidden border flex-shrink-0">
                                              <img src={v.imageUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }} />
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>

                                {/* معاينة المربعات */}
                                {smartVariantsList.some(v => v.label) && (
                                  <div className="bg-white dark:bg-gray-900 rounded border p-3">
                                    <p className="text-[10px] text-gray-400 mb-2 font-semibold">معاينة كيف ستظهر في صفحة المنتج:</p>
                                    {smartActiveTypes.filter(type => smartVariantsList.some(v => v.type === type && v.label)).map(type => (
                                      <div key={type} className="mb-2">
                                        <p className="text-[10px] text-gray-500 mb-1">{SMART_VARIANT_TYPE_ICONS[type]} {SMART_VARIANT_TYPE_LABELS[type]}</p>
                                        <div className="flex gap-1.5 flex-wrap">
                                          {smartVariantsList.filter(v => v.type === type && v.label).map((v, i) => (
                                            <div key={i} className="flex flex-col items-center gap-0.5">
                                              <div
                                                className="px-2 py-1 rounded border-2 border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-xs font-bold text-emerald-800 dark:text-emerald-300 min-w-[44px] text-center"
                                              >
                                                {v.type === 'color' && v.hex && (
                                                  <span className="inline-block w-3 h-3 rounded-full border border-gray-300 ml-1 align-middle" style={{ background: v.hex }} />
                                                )}
                                                {v.label}
                                              </div>
                                              {v.price && <span className="text-[9px] text-gray-500">{v.price} ر.ي</span>}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* ══ عروض الكميات (داخل الخيارات الذكية — نفس بيانات /admin/volume-offers) ══ */}
                        <div className="border rounded-lg overflow-hidden bg-cyan-50/40 dark:bg-cyan-900/10" data-testid="smart-panel-volume-offers">
                          <label className="flex items-center justify-between gap-3 px-3 py-2.5 border-b bg-cyan-100/50 dark:bg-cyan-900/20 cursor-pointer">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">📦</span>
                              <div>
                                <span className="text-sm font-bold">عروض الكميات</span>
                                <p className="text-[11px] text-muted-foreground">جدول أسعار تنازلية حسب الكمية — نفس بيانات صفحة «عروض الكميات».</p>
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={productForm.enableVolumeOffers}
                              onChange={(e) => setProductForm({ ...productForm, enableVolumeOffers: e.target.checked })}
                              className="w-5 h-5 accent-cyan-600"
                              data-testid="checkbox-smart-enable-volume-offers"
                            />
                          </label>
                          {productForm.enableVolumeOffers && (
                            <div className="p-3">
                              {editingProduct ? (
                                <InlineVolumeOffers productId={editingProduct.id} adminToken={adminToken} />
                              ) : (
                                <p className="text-xs text-muted-foreground text-center py-3" data-testid="note-save-product-first-offers">💾 احفظ المنتج أولاً ثم افتحه للتعديل لإضافة عروض الكميات.</p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* ══ اختر الكمية (داخل الخيارات الذكية — نفس بيانات quantity_tiers) ══ */}
                        <div className="border rounded-lg overflow-hidden bg-cyan-50/40 dark:bg-cyan-900/10" data-testid="smart-panel-quantity-tiers">
                          <label className="flex items-center justify-between gap-3 px-3 py-2.5 border-b bg-cyan-100/50 dark:bg-cyan-900/20 cursor-pointer">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🔢</span>
                              <div>
                                <span className="text-sm font-bold">اختر الكمية</span>
                                <p className="text-[11px] text-muted-foreground">عروض كمية ثابتة يختار منها العميل — نفس بيانات «عروض الكميات» في قسم الطباعة.</p>
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={productForm.enableQuantityTiers}
                              onChange={(e) => setProductForm({ ...productForm, enableQuantityTiers: e.target.checked })}
                              className="w-5 h-5 accent-cyan-600"
                              data-testid="checkbox-smart-enable-quantity-tiers"
                            />
                          </label>
                          {productForm.enableQuantityTiers && (
                            <div className="p-3">
                              <div className="flex items-center justify-between mb-2">
                                <Label className="font-bold text-sm flex items-center gap-2">🔢 اختر الكمية</Label>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setProductForm({
                                    ...productForm,
                                    quantityTiers: [...productForm.quantityTiers, { qty: 0, totalPrice: 0, unitPrice: 0 }]
                                  })}
                                  disabled={productForm.quantityTiers.length >= 5}
                                  className="text-xs h-7 gap-1"
                                  data-testid="button-smart-add-tier"
                                >
                                  + إضافة عرض
                                </Button>
                              </div>
                              <p className="text-[11px] text-muted-foreground mb-2">يُنصح بـ ٣ عروض (مثلاً ١٠٠ / ٥٠٠ / ١٠٠٠). الافتراضي للعميل هو الأول.</p>
                              <div className="space-y-2">
                                {productForm.quantityTiers.map((t, idx) => (
                                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-muted/30 p-2 rounded">
                                    <div className="col-span-3">
                                      <Label className="text-[10px] text-muted-foreground">الكمية</Label>
                                      <Input
                                        type="number"
                                        min={1}
                                        value={t.qty || ""}
                                        onChange={e => {
                                          const qty = Number(e.target.value) || 0;
                                          const arr = [...productForm.quantityTiers];
                                          arr[idx] = { ...arr[idx], qty, unitPrice: qty > 0 && arr[idx].totalPrice > 0 ? Math.round(arr[idx].totalPrice / qty) : arr[idx].unitPrice };
                                          setProductForm({ ...productForm, quantityTiers: arr });
                                        }}
                                        placeholder="100"
                                        className="text-sm h-8"
                                        data-testid={`input-smart-tier-qty-${idx}`}
                                      />
                                    </div>
                                    <div className="col-span-4">
                                      <Label className="text-[10px] text-muted-foreground">السعر الإجمالي (ر.ي)</Label>
                                      <Input
                                        type="number"
                                        min={0}
                                        value={t.totalPrice || ""}
                                        onChange={e => {
                                          const totalPrice = Number(e.target.value) || 0;
                                          const arr = [...productForm.quantityTiers];
                                          arr[idx] = { ...arr[idx], totalPrice, unitPrice: arr[idx].qty > 0 ? Math.round(totalPrice / arr[idx].qty) : 0 };
                                          setProductForm({ ...productForm, quantityTiers: arr });
                                        }}
                                        placeholder="6000"
                                        className="text-sm h-8"
                                        data-testid={`input-smart-tier-total-${idx}`}
                                      />
                                    </div>
                                    <div className="col-span-4">
                                      <Label className="text-[10px] text-muted-foreground">سعر الوحدة (تلقائي)</Label>
                                      <Input
                                        type="number"
                                        value={t.unitPrice || ""}
                                        readOnly
                                        className="text-sm h-8 bg-muted font-bold text-cyan-700"
                                        data-testid={`input-smart-tier-unit-${idx}`}
                                      />
                                    </div>
                                    <div className="col-span-1 flex items-end justify-end h-full pb-0.5">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setProductForm({
                                          ...productForm,
                                          quantityTiers: productForm.quantityTiers.filter((_, i) => i !== idx)
                                        })}
                                        className="text-red-500 h-8 w-8 p-0"
                                        data-testid={`button-smart-remove-tier-${idx}`}
                                      >
                                        ×
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                                {productForm.quantityTiers.length === 0 && (
                                  <p className="text-xs text-muted-foreground py-2 text-center">لا توجد عروض — أضف عرضاً واحداً على الأقل</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        </div>
                      </div>
                      </div>

                      {/* ══ مفاتيح الميزات المتقدمة (Feature Toggles) ══ */}
                      <div className="border rounded-lg overflow-hidden bg-amber-50/40 dark:bg-amber-900/10">
                        <div className="px-4 py-3 border-b bg-amber-100/60 dark:bg-amber-900/20">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">⚙️</span>
                            <div>
                              <h3 className="font-bold text-sm">مفاتيح الميزات المتقدمة</h3>
                              <p className="text-[11px] text-muted-foreground">كل ميزة لا تظهر في صفحة المنتج إلا بعد تفعيلها هنا.</p>
                            </div>
                          </div>
                        </div>
                        <div className="p-3 space-y-2">
                          {/* showLivePreview */}
                          <label className="flex items-center justify-between gap-3 bg-white dark:bg-gray-800 border rounded-lg p-2.5 cursor-pointer hover:border-amber-400">
                            <div className="flex items-center gap-2">
                              <span>🖼️</span>
                              <div>
                                <span className="text-sm font-semibold">معاينة الطباعة الحية</span>
                                <p className="text-[11px] text-muted-foreground">يسمح للعميل برفع شعار ومعاينته فوراً على المنتج (يتطلب أيضاً "السماح بالطباعة المخصصة")</p>
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={productForm.showLivePreview}
                              onChange={(e) => setProductForm({ ...productForm, showLivePreview: e.target.checked })}
                              className="w-5 h-5 accent-amber-600"
                              data-testid="checkbox-show-live-preview"
                            />
                          </label>
                          {/* enableVolumeOffers */}
                          <label className="flex items-center justify-between gap-3 bg-white dark:bg-gray-800 border rounded-lg p-2.5 cursor-pointer hover:border-amber-400">
                            <div className="flex items-center gap-2">
                              <span>📦</span>
                              <div>
                                <span className="text-sm font-semibold">عروض الكميات</span>
                                <p className="text-[11px] text-muted-foreground">إظهار جدول الأسعار التنازلية حسب الكمية على صفحة المنتج.</p>
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={productForm.enableVolumeOffers}
                              onChange={(e) => setProductForm({ ...productForm, enableVolumeOffers: e.target.checked })}
                              className="w-5 h-5 accent-amber-600"
                              data-testid="checkbox-enable-volume-offers"
                            />
                          </label>
                          {/* enableQuantityTiers */}
                          <label className="flex items-center justify-between gap-3 bg-white dark:bg-gray-800 border rounded-lg p-2.5 cursor-pointer hover:border-amber-400">
                            <div className="flex items-center gap-2">
                              <span>🔢</span>
                              <div>
                                <span className="text-sm font-semibold">اختر الكمية</span>
                                <p className="text-[11px] text-muted-foreground">إظهار عروض الكمية الثابتة (اختر الكمية) على صفحة المنتج.</p>
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={productForm.enableQuantityTiers}
                              onChange={(e) => setProductForm({ ...productForm, enableQuantityTiers: e.target.checked })}
                              className="w-5 h-5 accent-amber-600"
                              data-testid="checkbox-enable-quantity-tiers"
                            />
                          </label>
                          {/* allowDesignUpload — مرئي هنا للتنظيم */}
                          <label className="flex items-center justify-between gap-3 bg-white dark:bg-gray-800 border rounded-lg p-2.5 cursor-pointer hover:border-amber-400">
                            <div className="flex items-center gap-2">
                              <span>🎨</span>
                              <div>
                                <span className="text-sm font-semibold">السماح بالطباعة المخصصة (رفع تصميم)</span>
                                <p className="text-[11px] text-muted-foreground">يسمح للعميل برفع ملف التصميم (PDF/PNG/AI/PSD).</p>
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={productForm.allowDesignUpload}
                              onChange={(e) => setProductForm({ ...productForm, allowDesignUpload: e.target.checked })}
                              className="w-5 h-5 accent-amber-600"
                              data-testid="checkbox-toggle-allow-design-upload"
                            />
                          </label>
                          {/* hasPrintingOptions — حاسبة الطباعة */}
                          <label className="flex items-center justify-between gap-3 bg-white dark:bg-gray-800 border rounded-lg p-2.5 cursor-pointer hover:border-amber-400">
                            <div className="flex items-center gap-2">
                              <span>🧮</span>
                              <div>
                                <span className="text-sm font-semibold">حاسبة الطباعة الذكية</span>
                                <p className="text-[11px] text-muted-foreground">إظهار حاسبة سعر الطباعة (رسوم تصميم + ألوان + وجوه).</p>
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={productForm.hasPrintingOptions}
                              onChange={(e) => setProductForm({ ...productForm, hasPrintingOptions: e.target.checked })}
                              className="w-5 h-5 accent-amber-600"
                              data-testid="checkbox-toggle-has-printing-options"
                            />
                          </label>
                        </div>
                      </div>

                      {/* ══ القسم 5: الطباعة والإضافات ══ */}
                      <div className="border rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => toggleSection('printing')}
                          className="w-full flex items-center justify-between px-4 py-3 bg-purple-50 dark:bg-purple-900/10 hover:bg-purple-100 dark:hover:bg-purple-900/20 transition-colors text-right"
                          data-testid="section-printing-toggle"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs flex items-center justify-center font-bold">٥</span>
                            <span className="font-semibold text-sm">الطباعة والإضافات</span>
                            <span className="text-xs text-muted-foreground">طباعة مخصصة · حاسبة الطباعة الذكية</span>
                            {(productForm.allowDesignUpload || productForm.hasPrintingOptions) && (
                              <span className="text-xs bg-purple-600 text-white px-1.5 py-0.5 rounded-full">مفعّل</span>
                            )}
                          </div>
                          <ChevronDown className={`h-4 w-4 transition-transform text-muted-foreground ${formSections.printing ? 'rotate-180' : ''}`} />
                        </button>
                        {formSections.printing && (
                        <div className="p-4 space-y-4">
                          {/* ─── نظام التسعير القديم (مخفي — تم استبداله بـ Phase 4) ─── */}
                          <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-lg border border-dashed border-gray-300 dark:border-gray-700" data-testid="note-legacy-pricing-hidden">
                            <p className="text-xs text-muted-foreground text-center leading-relaxed">
                              ⭐ النظام القديم ملغي. استخدم <strong className="text-foreground">"فئة الطباعة الاحترافية"</strong> أو <strong className="text-foreground">"تسعير الطباعة الفوري (تجاوز)"</strong> أدناه.
                            </p>
                          </div>
                          {false && (<>
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <input
                                type="checkbox"
                                id="product-design-upload"
                                checked={productForm.allowDesignUpload}
                                onChange={(e) => setProductForm({
                                  ...productForm,
                                  allowDesignUpload: e.target.checked,
                                  printingPricePerUnit: e.target.checked ? productForm.printingPricePerUnit : ""
                                })}
                                className="rounded border-gray-300"
                                data-testid="checkbox-design-upload"
                              />
                              <Label htmlFor="product-design-upload" className="font-bold flex items-center gap-2">
                                <Printer className="h-4 w-4" />
                                السماح بالطباعة المخصصة
                              </Label>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">عند التفعيل: يمكن للعميل رفع ملف التصميم وإضافة ملاحظات</p>
                            {productForm.allowDesignUpload && (
                              <div className="p-3 bg-muted/50 rounded-lg">
                                <Label htmlFor="printing-price-per-unit">سعر الطباعة للوحدة (ريال)</Label>
                                <Input
                                  id="printing-price-per-unit"
                                  type="number"
                                  value={productForm.printingPricePerUnit}
                                  onChange={(e) => setProductForm({...productForm, printingPricePerUnit: e.target.value})}
                                  placeholder="مثال: 50"
                                  data-testid="input-printing-price-per-unit"
                                />
                                <p className="text-xs text-muted-foreground mt-1">يُضاف هذا المبلغ لكل قطعة عند طلب الطباعة</p>
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <input
                                type="checkbox"
                                id="product-printing-options"
                                checked={productForm.hasPrintingOptions}
                                onChange={(e) => setProductForm({...productForm, hasPrintingOptions: e.target.checked})}
                                className="rounded border-gray-300"
                                data-testid="checkbox-printing-options"
                              />
                              <Label htmlFor="product-printing-options" className="font-bold flex items-center gap-2">
                                <Printer className="h-4 w-4" />
                                تفعيل حاسبة الطباعة الذكية (متقدم)
                              </Label>
                            </div>
                            {productForm.hasPrintingOptions && (
                              <div className="grid md:grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg">
                                <div>
                                  <Label htmlFor="base-bag-price">سعر الكيس الصافي (ريال)</Label>
                                  <Input
                                    id="base-bag-price"
                                    type="number"
                                    value={productForm.baseBagPrice}
                                    onChange={(e) => setProductForm({...productForm, baseBagPrice: e.target.value})}
                                    placeholder="مثال: 500"
                                    data-testid="input-base-bag-price"
                                  />
                                  <p className="text-xs text-muted-foreground mt-1">السعر بدون طباعة</p>
                                </div>
                                <div>
                                  <Label htmlFor="single-color-price">سعر طباعة اللون الواحد (ريال)</Label>
                                  <Input
                                    id="single-color-price"
                                    type="number"
                                    value={productForm.singleColorPrintPrice}
                                    onChange={(e) => setProductForm({...productForm, singleColorPrintPrice: e.target.value})}
                                    placeholder="مثال: 100"
                                    data-testid="input-single-color-price"
                                  />
                                  <p className="text-xs text-muted-foreground mt-1">يُضاف لكل لون طباعة</p>
                                </div>
                                <div className="md:col-span-2">
                                  <Label htmlFor="available-bag-colors">ألوان الأكياس المتاحة (مفصولة بفاصلة)</Label>
                                  <Input
                                    id="available-bag-colors"
                                    value={productForm.availableBagColors}
                                    onChange={(e) => setProductForm({...productForm, availableBagColors: e.target.value})}
                                    placeholder="أبيض, شفاف, أسود, أحمر, أزرق"
                                    data-testid="input-available-bag-colors"
                                  />
                                  <ColorCircles colorsString={productForm.availableBagColors} />
                                </div>
                              </div>
                            )}
                          </div>
                          </>)}
                          {/* ─── نهاية النظام القديم المخفي ─── */}

                          {/* ── فئة الطباعة الاحترافية ── */}
                          <div>
                            <Label htmlFor="printing-category" className="font-bold flex items-center gap-2 mb-2">
                              <Printer className="h-4 w-4" />
                              فئة الطباعة الاحترافية (اختياري)
                            </Label>
                            <p className="text-xs text-muted-foreground mb-2">
                              للمنتجات ذات الطباعة الاحترافية (لوحات، كروت، ملصقات...) — تفعّل حاسبة السعر بالمساحة
                            </p>
                            <select
                              id="printing-category"
                              value={productForm.printingCategoryId}
                              onChange={e => setProductForm({ ...productForm, printingCategoryId: e.target.value })}
                              className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                              data-testid="select-printing-category"
                            >
                              <option value="">— بدون فئة طباعة احترافية —</option>
                              {printingCategoriesAdmin.map((cat: any) => (
                                <option key={cat.id} value={String(cat.id)}>{cat.name}</option>
                              ))}
                            </select>
                            {productForm.printingCategoryId && (
                              <p className="text-xs text-green-600 mt-1">
                                ✓ الطباعة الاحترافية مُفعّلة — سيظهر حاسبة المساحة للعميل
                              </p>
                            )}
                          </div>

                          {/* ── Phase 4: تسعير الطباعة الفوري (Override) ── */}
                          <div className="border border-blue-200 dark:border-blue-800 rounded-xl p-3 bg-blue-50/40 dark:bg-blue-950/20">
                            <Label className="font-bold flex items-center gap-2 mb-1 text-sm">
                              🖨️ تسعير الطباعة الفوري (تجاوز)
                            </Label>
                            <p className="text-xs text-muted-foreground mb-3">
                              هذه القيم تتجاوز قيم الفئة المختارة أعلاه. اتركها فارغة لاستخدام القيم الافتراضية للفئة.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <Label htmlFor="printing-design-fee-override" className="text-xs">رسوم التصميم (ر.ي)</Label>
                                <Input
                                  id="printing-design-fee-override"
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={productForm.printingDesignFeeOverride}
                                  onChange={e => setProductForm({ ...productForm, printingDesignFeeOverride: e.target.value })}
                                  placeholder="مثال: 300"
                                  className="mt-1"
                                  data-testid="input-printing-design-fee-override"
                                />
                              </div>
                              <div>
                                <Label htmlFor="printing-color-price-override" className="text-xs">سعر اللون الإضافي (ر.ي)</Label>
                                <Input
                                  id="printing-color-price-override"
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={productForm.printingColorPriceOverride}
                                  onChange={e => setProductForm({ ...productForm, printingColorPriceOverride: e.target.value })}
                                  placeholder="مثال: 20"
                                  className="mt-1"
                                  data-testid="input-printing-color-price-override"
                                />
                              </div>
                              <div>
                                <Label htmlFor="printing-side-price-override" className="text-xs">سعر الوجه الإضافي (ر.ي)</Label>
                                <Input
                                  id="printing-side-price-override"
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={productForm.printingSidePriceOverride}
                                  onChange={e => setProductForm({ ...productForm, printingSidePriceOverride: e.target.value })}
                                  placeholder="مثال: 50"
                                  className="mt-1"
                                  data-testid="input-printing-side-price-override"
                                />
                              </div>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-2">
                              💡 المعادلة: <code>إجمالي الطباعة = رسوم التصميم + (الألوان الإضافية × سعر اللون) + (الأوجه الإضافية × سعر الوجه)</code>
                            </p>
                          </div>

                          {/* ── Phase 5: منطقة الطباعة للمعاينة الفورية ── */}
                          <div className="border border-purple-200 dark:border-purple-800 rounded-xl p-3 bg-purple-50/40 dark:bg-purple-950/20">
                            <Label className="font-bold flex items-center gap-2 mb-1 text-sm">
                              🎯 منطقة الطباعة على صورة المنتج (للمعاينة الفورية)
                            </Label>
                            <p className="text-xs text-muted-foreground mb-3">
                              حدّد موقع وحجم الشعار على صورة المنتج (نسب مئوية 0-100). اتركها فارغة لاستخدام الوسط الافتراضي.
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <div>
                                <Label htmlFor="print-area-x" className="text-xs">X (يسار %)</Label>
                                <Input
                                  id="print-area-x"
                                  type="number" min={0} max={100}
                                  value={productForm.printArea?.x ?? ""}
                                  onChange={e => {
                                    const x = e.target.value === "" ? null : Math.max(0, Math.min(100, Number(e.target.value)));
                                    setProductForm({ ...productForm, printArea: x == null && !productForm.printArea ? null : { x: x ?? 25, y: productForm.printArea?.y ?? 25, width: productForm.printArea?.width ?? 50, height: productForm.printArea?.height ?? 50 } });
                                  }}
                                  placeholder="25"
                                  className="mt-1"
                                  data-testid="input-print-area-x"
                                />
                              </div>
                              <div>
                                <Label htmlFor="print-area-y" className="text-xs">Y (أعلى %)</Label>
                                <Input
                                  id="print-area-y"
                                  type="number" min={0} max={100}
                                  value={productForm.printArea?.y ?? ""}
                                  onChange={e => {
                                    const y = e.target.value === "" ? null : Math.max(0, Math.min(100, Number(e.target.value)));
                                    setProductForm({ ...productForm, printArea: y == null && !productForm.printArea ? null : { x: productForm.printArea?.x ?? 25, y: y ?? 25, width: productForm.printArea?.width ?? 50, height: productForm.printArea?.height ?? 50 } });
                                  }}
                                  placeholder="25"
                                  className="mt-1"
                                  data-testid="input-print-area-y"
                                />
                              </div>
                              <div>
                                <Label htmlFor="print-area-w" className="text-xs">عرض %</Label>
                                <Input
                                  id="print-area-w"
                                  type="number" min={5} max={100}
                                  value={productForm.printArea?.width ?? ""}
                                  onChange={e => {
                                    const w = e.target.value === "" ? null : Math.max(5, Math.min(100, Number(e.target.value)));
                                    setProductForm({ ...productForm, printArea: w == null && !productForm.printArea ? null : { x: productForm.printArea?.x ?? 25, y: productForm.printArea?.y ?? 25, width: w ?? 50, height: productForm.printArea?.height ?? 50 } });
                                  }}
                                  placeholder="50"
                                  className="mt-1"
                                  data-testid="input-print-area-width"
                                />
                              </div>
                              <div>
                                <Label htmlFor="print-area-h" className="text-xs">طول %</Label>
                                <Input
                                  id="print-area-h"
                                  type="number" min={5} max={100}
                                  value={productForm.printArea?.height ?? ""}
                                  onChange={e => {
                                    const h = e.target.value === "" ? null : Math.max(5, Math.min(100, Number(e.target.value)));
                                    setProductForm({ ...productForm, printArea: h == null && !productForm.printArea ? null : { x: productForm.printArea?.x ?? 25, y: productForm.printArea?.y ?? 25, width: productForm.printArea?.width ?? 50, height: h ?? 50 } });
                                  }}
                                  placeholder="50"
                                  className="mt-1"
                                  data-testid="input-print-area-height"
                                />
                              </div>
                            </div>
                            {productForm.printArea && (
                              <button
                                type="button"
                                onClick={() => setProductForm({ ...productForm, printArea: null })}
                                className="mt-2 text-xs text-red-600 hover:underline"
                                data-testid="button-clear-print-area"
                              >
                                مسح منطقة الطباعة
                              </button>
                            )}
                          </div>

                          {/* ── Phase 6: تغيير لون الكيس عبر Cloudinary ── */}
                          <div className="border border-pink-200 dark:border-pink-800 rounded-xl p-3 bg-pink-50/40 dark:bg-pink-950/20">
                            <Label className="font-bold flex items-center gap-2 mb-1 text-sm">
                              🎨 تغيير لون الكيس ديناميكياً (Cloudinary)
                            </Label>
                            <p className="text-xs text-muted-foreground mb-3">
                              لتفعيل هذه الميزة، ارفع صورة كيس <strong>أبيض ناصع بخلفية شفافة</strong> إلى Cloudinary، ثم ضع <code>public_id</code> أدناه + قائمة الألوان المتاحة.
                            </p>
                            <div className="space-y-3">
                              <div>
                                <Label htmlFor="base-image-public-id" className="text-xs">Cloudinary public_id</Label>
                                <div className="flex gap-2 mt-1">
                                  <Input
                                    id="base-image-public-id"
                                    value={productForm.baseImagePublicId}
                                    onChange={e => setProductForm({ ...productForm, baseImagePublicId: e.target.value })}
                                    placeholder="مثال: oyo-plast/products/bag-white-v1"
                                    className="font-mono text-sm flex-1"
                                    data-testid="input-base-image-public-id"
                                  />
                                  <input
                                    type="file"
                                    accept="image/*"
                                    id="white-bag-upload"
                                    className="hidden"
                                    data-testid="input-white-bag-file"
                                    onChange={async e => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      const fd = new FormData();
                                      fd.append("image", file);
                                      try {
                                        const res = await fetch("/api/admin/upload", {
                                          method: "POST",
                                          headers: { "x-admin-token": adminToken || "" },
                                          body: fd,
                                        });
                                        const data = await res.json();
                                        if (!res.ok) throw new Error(data?.message || "فشل الرفع");
                                        if (!data.publicId) {
                                          toast({ title: "تنبيه", description: "تم الرفع لكن Cloudinary غير مُهيّأ — لن تعمل ميزة تغيير اللون.", variant: "destructive" });
                                          return;
                                        }
                                        setProductForm(prev => ({ ...prev, baseImagePublicId: data.publicId }));
                                        toast({ title: "✅ تم", description: "تم رفع الصورة وحفظ public_id بنجاح" });
                                      } catch (err: any) {
                                        toast({ title: "خطأ", description: err.message || "تعذّر رفع الصورة", variant: "destructive" });
                                      } finally {
                                        e.target.value = "";
                                      }
                                    }}
                                  />
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => document.getElementById("white-bag-upload")?.click()}
                                    className="whitespace-nowrap text-xs"
                                    data-testid="button-upload-white-bag"
                                  >
                                    📸 رفع كيس أبيض
                                  </Button>
                                </div>
                                {productForm.baseImagePublicId && (
                                  <div className="mt-2 text-[11px] bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded p-2">
                                    <span className="text-green-700 dark:text-green-300 font-bold">✅ مرفوع:</span>{" "}
                                    <code className="font-mono text-muted-foreground break-all" data-testid="text-public-id-value">{productForm.baseImagePublicId}</code>
                                  </div>
                                )}
                              </div>
                              <div>
                                <Label htmlFor="available-colors" className="text-xs">الألوان المتاحة (JSON)</Label>
                                <Textarea
                                  id="available-colors"
                                  value={productForm.availableColors}
                                  onChange={e => setProductForm({ ...productForm, availableColors: e.target.value })}
                                  placeholder={'[\n  { "id": "red", "name": "أحمر", "code": "#FF0000" },\n  { "id": "blue", "name": "أزرق", "code": "#0000FF" },\n  { "id": "green", "name": "أخضر", "code": "#008000" }\n]'}
                                  rows={6}
                                  className="mt-1 font-mono text-xs"
                                  data-testid="textarea-available-colors"
                                />
                                <p className="text-[11px] text-muted-foreground mt-1">
                                  💡 <code>id</code> = اسم اللون بالإنجليزي يفهمه Cloudinary (red/blue/yellow/green...). <code>code</code> = HEX للعرض في الأيقونة.
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* ═══════════════════════════════════════════════════════════════ */}
                          {/* ── Phase 7: تخصيصات صفحة المنتج (Admin-controlled) ─────────── */}
                          {/* ═══════════════════════════════════════════════════════════════ */}
                          <div className="border-2 border-cyan-300 dark:border-cyan-700 rounded-xl p-3 bg-cyan-50/60 dark:bg-cyan-950/30 space-y-4">
                            <Label className="font-bold flex items-center gap-2 mb-1 text-base text-cyan-900 dark:text-cyan-100">
                              ⚙️ تخصيصات صفحة المنتج الجديدة (يتحكم بها الأدمن)
                            </Label>
                            <p className="text-xs text-muted-foreground -mt-2">
                              💡 تحكّم كامل في ألوان الطباعة + العروض المتدرّجة + حجم نافذة المعاينة (مثل شي إن / علي بابا).
                            </p>

                            {/* ── ✏️ ألوان الطباعة ── */}
                            <div className="border border-cyan-200 dark:border-cyan-800 rounded-lg p-3 bg-white dark:bg-card">
                              <div className="flex items-center justify-between mb-2">
                                <Label className="font-bold text-sm flex items-center gap-2">
                                  ✏️ ألوان الطباعة المتاحة
                                </Label>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setProductForm({
                                    ...productForm,
                                    printColorOptions: [...productForm.printColorOptions, { name: "", hex: "#000000" }]
                                  })}
                                  className="text-xs h-7 gap-1"
                                  data-testid="button-add-print-color"
                                >
                                  + إضافة لون
                                </Button>
                              </div>
                              <div className="space-y-2">
                                {productForm.printColorOptions.map((c, idx) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <input
                                      type="color"
                                      value={c.hex}
                                      onChange={e => {
                                        const arr = [...productForm.printColorOptions];
                                        arr[idx] = { ...arr[idx], hex: e.target.value };
                                        setProductForm({ ...productForm, printColorOptions: arr });
                                      }}
                                      className="w-10 h-10 rounded border cursor-pointer"
                                      data-testid={`input-print-color-hex-${idx}`}
                                    />
                                    <Input
                                      value={c.name}
                                      onChange={e => {
                                        const arr = [...productForm.printColorOptions];
                                        arr[idx] = { ...arr[idx], name: e.target.value };
                                        setProductForm({ ...productForm, printColorOptions: arr });
                                      }}
                                      placeholder="اسم اللون (مثل: أبيض)"
                                      className="text-sm flex-1"
                                      data-testid={`input-print-color-name-${idx}`}
                                    />
                                    <Input
                                      value={c.hex}
                                      onChange={e => {
                                        const arr = [...productForm.printColorOptions];
                                        arr[idx] = { ...arr[idx], hex: e.target.value };
                                        setProductForm({ ...productForm, printColorOptions: arr });
                                      }}
                                      placeholder="#FFFFFF"
                                      className="text-xs font-mono w-24"
                                      data-testid={`input-print-color-hex-text-${idx}`}
                                    />
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setProductForm({
                                        ...productForm,
                                        printColorOptions: productForm.printColorOptions.filter((_, i) => i !== idx)
                                      })}
                                      className="text-red-500 h-8 w-8 p-0"
                                      data-testid={`button-remove-print-color-${idx}`}
                                    >
                                      ×
                                    </Button>
                                  </div>
                                ))}
                                {productForm.printColorOptions.length === 0 && (
                                  <p className="text-xs text-muted-foreground py-2 text-center">لا توجد ألوان — أضف لوناً واحداً على الأقل</p>
                                )}
                              </div>
                            </div>

                            {/* ── 📦 العروض المتدرجة (Tiered Pricing) ── */}
                            <div className="border border-cyan-200 dark:border-cyan-800 rounded-lg p-3 bg-white dark:bg-card">
                              <div className="flex items-center justify-between mb-2">
                                <Label className="font-bold text-sm flex items-center gap-2">
                                  📦 عروض الكميات (Tiered Pricing)
                                </Label>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setProductForm({
                                    ...productForm,
                                    quantityTiers: [...productForm.quantityTiers, { qty: 0, totalPrice: 0, unitPrice: 0 }]
                                  })}
                                  disabled={productForm.quantityTiers.length >= 5}
                                  className="text-xs h-7 gap-1"
                                  data-testid="button-add-tier"
                                >
                                  + إضافة عرض
                                </Button>
                              </div>
                              <p className="text-[11px] text-muted-foreground mb-2">يُنصح بـ ٣ عروض (مثلاً ١٠٠ / ٥٠٠ / ١٠٠٠). الافتراضي للعميل هو الأول.</p>
                              <div className="space-y-2">
                                {productForm.quantityTiers.map((t, idx) => (
                                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-muted/30 p-2 rounded">
                                    <div className="col-span-3">
                                      <Label className="text-[10px] text-muted-foreground">الكمية</Label>
                                      <Input
                                        type="number"
                                        min={1}
                                        value={t.qty || ""}
                                        onChange={e => {
                                          const qty = Number(e.target.value) || 0;
                                          const arr = [...productForm.quantityTiers];
                                          arr[idx] = { ...arr[idx], qty, unitPrice: qty > 0 && arr[idx].totalPrice > 0 ? Math.round(arr[idx].totalPrice / qty) : arr[idx].unitPrice };
                                          setProductForm({ ...productForm, quantityTiers: arr });
                                        }}
                                        placeholder="100"
                                        className="text-sm h-8"
                                        data-testid={`input-tier-qty-${idx}`}
                                      />
                                    </div>
                                    <div className="col-span-4">
                                      <Label className="text-[10px] text-muted-foreground">السعر الإجمالي (ر.ي)</Label>
                                      <Input
                                        type="number"
                                        min={0}
                                        value={t.totalPrice || ""}
                                        onChange={e => {
                                          const totalPrice = Number(e.target.value) || 0;
                                          const arr = [...productForm.quantityTiers];
                                          arr[idx] = { ...arr[idx], totalPrice, unitPrice: arr[idx].qty > 0 ? Math.round(totalPrice / arr[idx].qty) : 0 };
                                          setProductForm({ ...productForm, quantityTiers: arr });
                                        }}
                                        placeholder="6000"
                                        className="text-sm h-8"
                                        data-testid={`input-tier-total-${idx}`}
                                      />
                                    </div>
                                    <div className="col-span-3">
                                      <Label className="text-[10px] text-muted-foreground">سعر الوحدة (تلقائي)</Label>
                                      <Input
                                        type="number"
                                        value={t.unitPrice || ""}
                                        readOnly
                                        className="text-sm h-8 bg-muted font-bold text-cyan-700"
                                        data-testid={`input-tier-unit-${idx}`}
                                      />
                                    </div>
                                    <div className="col-span-3">
                                      <Label className="text-[10px] text-muted-foreground">تكلفة الشراء (ر.ي)</Label>
                                      <Input
                                        type="number"
                                        min={0}
                                        value={t.costPrice || ""}
                                        onChange={e => {
                                          const costPrice = Number(e.target.value) || 0;
                                          const arr = [...productForm.quantityTiers];
                                          arr[idx] = { ...arr[idx], costPrice };
                                          setProductForm({ ...productForm, quantityTiers: arr });
                                        }}
                                        placeholder="مثال: 5000"
                                        className="text-sm h-8"
                                        data-testid={`input-tier-cost-${idx}`}
                                      />
                                    </div>
                                    <div className="col-span-1 flex items-end justify-end h-full pb-0.5">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setProductForm({
                                          ...productForm,
                                          quantityTiers: productForm.quantityTiers.filter((_, i) => i !== idx)
                                        })}
                                        className="text-red-500 h-8 w-8 p-0"
                                        data-testid={`button-remove-tier-${idx}`}
                                      >
                                        ×
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                                {productForm.quantityTiers.length === 0 && (
                                  <p className="text-xs text-muted-foreground py-2 text-center">لا توجد عروض — أضف عرضاً واحداً على الأقل</p>
                                )}
                              </div>
                            </div>

                            {/* ── 🖼️ أبعاد نافذة المعاينة (عرض × ارتفاع) ── */}
                            <div className="border border-cyan-200 dark:border-cyan-800 rounded-lg p-3 bg-white dark:bg-card">
                              <Label className="font-bold text-sm flex items-center gap-2 mb-2">
                                🖼️ أبعاد نافذة المعاينة (مطابقة لشكل الكيس الحقيقي)
                              </Label>
                              <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
                                💡 <strong>مثال:</strong> كيس عرضه ٣٠سم وارتفاعه ٤٠سم → اضبط ٢٠٠ × ٢٧٠ بكسل (نسبة ٣:٤).
                                <br />هذا يضمن أن التصميم يظهر للعميل بنفس نسبة الكيس الحقيقي.
                              </p>
                              <div className="grid grid-cols-2 gap-3 mb-3">
                                <div>
                                  <Label className="text-xs text-muted-foreground">العرض (Width)</Label>
                                  <div className="flex items-center gap-1 mt-1">
                                    <Input
                                      type="number"
                                      min={80}
                                      max={400}
                                      value={productForm.previewWidth}
                                      onChange={e => setProductForm({ ...productForm, previewWidth: Number(e.target.value) || 200 })}
                                      className="text-center font-bold text-cyan-700"
                                      data-testid="input-preview-width"
                                    />
                                    <span className="text-xs text-muted-foreground">px</span>
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">الارتفاع (Height)</Label>
                                  <div className="flex items-center gap-1 mt-1">
                                    <Input
                                      type="number"
                                      min={80}
                                      max={500}
                                      value={productForm.previewHeight}
                                      onChange={e => setProductForm({ ...productForm, previewHeight: Number(e.target.value) || 250 })}
                                      className="text-center font-bold text-cyan-700"
                                      data-testid="input-preview-height"
                                    />
                                    <span className="text-xs text-muted-foreground">px</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1.5 mb-3">
                                <span className="text-[10px] text-muted-foreground self-center">قوالب جاهزة:</span>
                                {[
                                  { label: "مربع 200×200", w: 200, h: 200 },
                                  { label: "كيس 30×40 (200×270)", w: 200, h: 270 },
                                  { label: "كيس طويل 20×40 (150×300)", w: 150, h: 300 },
                                  { label: "كيس عريض 40×30 (270×200)", w: 270, h: 200 },
                                ].map(p => (
                                  <button
                                    key={p.label}
                                    type="button"
                                    onClick={() => setProductForm({ ...productForm, previewWidth: p.w, previewHeight: p.h })}
                                    className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-100 hover:bg-cyan-200 dark:bg-cyan-900 dark:hover:bg-cyan-800 text-cyan-800 dark:text-cyan-200 transition"
                                    data-testid={`button-preset-${p.w}x${p.h}`}
                                  >
                                    {p.label}
                                  </button>
                                ))}
                              </div>
                              <div className="flex items-center justify-center bg-muted/30 rounded p-3 min-h-[280px]">
                                <div
                                  className="border-2 border-dashed border-cyan-400 bg-cyan-50 dark:bg-cyan-950/40 rounded flex items-center justify-center text-xs text-cyan-700 dark:text-cyan-300 font-bold transition-all"
                                  style={{ width: `${productForm.previewWidth}px`, height: `${productForm.previewHeight}px` }}
                                >
                                  معاينة<br />{productForm.previewWidth} × {productForm.previewHeight}
                                </div>
                              </div>
                            </div>

                            {/* ── 🎨 ملاحظة حول ألوان الكيس ── */}
                            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5 text-xs">
                              <span className="font-bold text-amber-900 dark:text-amber-200">🎨 ألوان الكيس:</span>
                              <span className="text-amber-800 dark:text-amber-300 mr-1">
                                تُدار من قسم <strong>"الخيارات الذكية"</strong> أعلاه (نوع <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">color</code>) — ارفع <strong>صورة حقيقية</strong> لكل لون كما تفعل شي إن.
                              </span>
                            </div>

                          </div>

                        </div>
                        )}
                      </div>

                      {/* ══ أزرار الحفظ ══ */}
                      <div className="flex gap-2 pt-3 border-t">
                        <Button
                          type="submit"
                          disabled={createProductMutation.isPending || updateProductMutation.isPending}
                          className="gap-2 flex-1"
                          data-testid="button-save-product"
                        >
                          {(createProductMutation.isPending || updateProductMutation.isPending) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          {editingProduct ? 'حفظ التعديلات' : 'إضافة المنتج'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowProductForm(false);
                            setEditingProduct(null);
                            setProductForm(emptyProductForm);
                            setColorImagesList([]);
                            setSmartVariantsList([]);
                            setSmartActiveTypes([]);
                          }}
                        >
                          إلغاء
                        </Button>
                      </div>
                    </form>
                  </div>
                )}

                <div className="flex justify-end mb-3 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => refetchProducts()}
                    disabled={productsLoading}
                    data-testid="button-refresh-products"
                  >
                    {productsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    تحديث
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={refreshAll}
                    disabled={productsLoading || categoriesLoading}
                    data-testid="button-refresh-all"
                  >
                    <RefreshCw className="h-4 w-4" />
                    تحديث الكل
                  </Button>
                </div>

                {/* ── مربعات الأقسام ── */}
                {!productsLoading && categoriesList.length > 0 && (
                  <div className="mb-5">
                    <p className="text-xs text-muted-foreground mb-2 font-medium">تصفية حسب القسم:</p>
                    <div className="flex flex-wrap gap-2">
                      {/* زر الكل */}
                      <button
                        onClick={() => setSelectedCategoryFilter(null)}
                        className={`flex flex-col items-center gap-1 rounded-xl border-2 p-2 transition-all min-w-[72px] ${
                          selectedCategoryFilter === null
                            ? 'border-primary bg-primary/10 shadow-sm'
                            : 'border-border hover:border-primary/50 bg-card'
                        }`}
                        data-testid="button-filter-all"
                      >
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                          <Package className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <span className="text-[11px] font-semibold text-center leading-tight">الكل</span>
                        <span className="text-[10px] text-muted-foreground">{productsList.length}</span>
                      </button>
                      {/* زر لكل قسم */}
                      {categoriesList.map((cat) => {
                        const count = productsList.filter(p => p.categoryId === cat.id).length;
                        const firstImg = productsList.find(p => p.categoryId === cat.id)?.imageUrl;
                        return (
                          <button
                            key={cat.id}
                            onClick={() => setSelectedCategoryFilter(selectedCategoryFilter === cat.id ? null : cat.id)}
                            className={`flex flex-col items-center gap-1 rounded-xl border-2 p-2 transition-all min-w-[72px] ${
                              selectedCategoryFilter === cat.id
                                ? 'border-primary bg-primary/10 shadow-sm'
                                : 'border-border hover:border-primary/50 bg-card'
                            }`}
                            data-testid={`button-filter-cat-${cat.id}`}
                          >
                            <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden flex items-center justify-center">
                              {cat.imageUrl ? (
                                <img src={cat.imageUrl} alt={cat.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />
                              ) : firstImg ? (
                                <img src={firstImg} alt={cat.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />
                              ) : (
                                <Package className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                            <span className="text-[11px] font-semibold text-center leading-tight max-w-[70px] truncate">{cat.name}</span>
                            <span className="text-[10px] text-muted-foreground">{count} منتج</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {productsLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : productsError ? (
                  <div className="text-center py-10">
                    <Package className="h-12 w-12 mx-auto mb-4 text-destructive opacity-60" />
                    <p className="text-destructive font-medium mb-2">تعذّر تحميل المنتجات</p>
                    <p className="text-sm text-muted-foreground mb-4">تأكد من اتصالك بالإنترنت ثم أعد المحاولة</p>
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => refetchProducts()}
                      data-testid="button-retry-products"
                    >
                      <RefreshCw className="h-4 w-4" />
                      إعادة المحاولة
                    </Button>
                  </div>
                ) : (() => {
                  const displayedProducts = productsList.filter(p => selectedCategoryFilter === null || p.categoryId === selectedCategoryFilter);
                  return displayedProducts.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {displayedProducts
                      .map((product) => (
                      <div
                        key={product.id}
                        className="flex items-start gap-3 rounded-xl border bg-card p-3 shadow-sm hover:shadow-md transition-shadow"
                        data-testid={`card-product-${product.id}`}
                      >
                        {/* صورة المنتج */}
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="h-full w-full object-contain"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        </div>

                        {/* بيانات المنتج */}
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate text-sm">{product.name}</p>
                          <p className="text-xs text-muted-foreground truncate mb-1">
                            {categoriesList.find(c => c.id === product.categoryId)?.name || '—'}
                          </p>
                          <div className="flex flex-wrap gap-1 mb-2">
                            <Badge variant="secondary" className="text-xs">
                              {formatPrice(product.price)} ر.ي
                            </Badge>
                            {product.priceSar && (
                              <Badge variant="outline" className="text-xs">
                                {formatPrice(product.priceSar)} ر.س
                              </Badge>
                            )}
                            <Badge
                              variant={product.stock > 10 ? "default" : product.stock > 0 ? "secondary" : "destructive"}
                              className="text-xs"
                            >
                              {product.stock > 0 ? `${product.stock} قطعة` : 'نفذ'}
                            </Badge>
                          </div>

                          {/* أزرار الإجراءات */}
                          <div className="flex gap-1 flex-wrap">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 gap-1 text-xs text-blue-600 border-blue-200 hover:border-blue-400"
                              onClick={() => window.open(`/products/${product.id}`, '_blank')}
                              data-testid={`button-view-product-${product.id}`}
                            >
                              <Eye className="h-3 w-3" />
                              عرض
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 gap-1 text-xs"
                              onClick={() => openEditProduct(product)}
                              data-testid={`button-edit-product-${product.id}`}
                            >
                              <Pencil className="h-3 w-3" />
                              تعديل
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className={`h-7 px-2 gap-1 text-xs ${(product as any).isActive === false ? 'text-orange-600 border-orange-300' : 'text-green-600 border-green-300'}`}
                              onClick={() => toggleProductVisibility.mutate({ id: product.id, isActive: (product as any).isActive === false })}
                              disabled={toggleProductVisibility.isPending}
                              data-testid={`button-toggle-visibility-product-${product.id}`}
                              title={(product as any).isActive === false ? "إظهار في المتجر" : "إخفاء من المتجر"}
                            >
                              {(product as any).isActive === false ? '🚫 مخفي' : '👁️ ظاهر'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 gap-1 text-xs text-destructive hover:text-destructive border-destructive/30 hover:border-destructive"
                              onClick={() => {
                                if (confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
                                  deleteProductMutation.mutate(product.id);
                                }
                              }}
                              data-testid={`button-delete-product-${product.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                              حذف
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : selectedCategoryFilter !== null ? (
                  <div className="text-center py-10 text-muted-foreground" data-testid="empty-category-products">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>لا توجد منتجات في هذا القسم</p>
                    <p className="text-xs mt-1">اختر قسماً آخر أو أضف منتجاً جديداً</p>
                  </div>
                ) : (
                  <div className="text-center py-10 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="mb-4">لا توجد منتجات بعد</p>
                    <Button
                      className="gap-2"
                      onClick={() => setShowProductForm(true)}
                      data-testid="button-add-first-product"
                    >
                      <Plus className="h-4 w-4" />
                      إضافة أول منتج
                    </Button>
                  </div>
                );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle>إدارة الأقسام</CardTitle>
                <Button 
                  className="gap-2"
                  onClick={() => {
                    setShowCategoryForm(true);
                    setEditingCategory(null);
                    setCategoryForm(emptyCategoryForm);
                  }}
                  data-testid="button-add-category"
                >
                  <Plus className="h-4 w-4" />
                  إضافة قسم
                </Button>
              </CardHeader>
              <CardContent>
                {showCategoryForm && (
                  <div className="mb-6 p-4 border rounded-lg bg-muted/30">
                    <h3 className="font-semibold mb-4">
                      {editingCategory ? 'تعديل القسم' : 'إضافة قسم جديد'}
                    </h3>
                    <form onSubmit={handleCategorySubmit} className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="cat-name">اسم القسم</Label>
                          <Input
                            id="cat-name"
                            value={categoryForm.name}
                            onChange={(e) => setCategoryForm({...categoryForm, name: e.target.value})}
                            placeholder="مثال: بلاستيكيات"
                            required
                            data-testid="input-category-name"
                          />
                        </div>
                        <div>
                          <Label htmlFor="cat-slug">الرابط (slug)</Label>
                          <Input
                            id="cat-slug"
                            value={categoryForm.slug}
                            onChange={(e) => setCategoryForm({...categoryForm, slug: e.target.value})}
                            placeholder="مثال: plastics"
                            required
                            data-testid="input-category-slug"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="cat-image">صورة القسم</Label>
                        <div className="flex items-center gap-4">
                          <label 
                            htmlFor="category-image-upload"
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md cursor-pointer hover:bg-primary/90 transition-colors"
                          >
                            <ImagePlus className="h-4 w-4" />
                            <span>{isUploading ? 'جاري الرفع...' : 'رفع صورة'}</span>
                          </label>
                          <input
                            type="file"
                            id="category-image-upload"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleImageUpload(e, 'category')}
                            disabled={isUploading}
                            data-testid="input-category-image-upload"
                          />
                        </div>
                        {categoryForm.imageUrl && (
                          <div className="mt-2 w-20 h-20 bg-gray-100 rounded-lg overflow-hidden">
                            <img src={categoryForm.imageUrl} alt="معاينة" className="w-full h-full object-contain" />
                          </div>
                        )}
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border hover:bg-accent" data-testid="toggle-category-active-form">
                        <input
                          type="checkbox"
                          checked={categoryForm.isActive}
                          onChange={(e) => setCategoryForm({ ...categoryForm, isActive: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <span className="text-sm font-medium">
                          {categoryForm.isActive ? "👁️ القسم ظاهر للزوار" : "🚫 القسم مخفي عن الزوار"}
                        </span>
                      </label>
                      <div className="flex gap-2 pt-4">
                        <Button 
                          type="submit" 
                          disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
                          className="gap-2"
                          data-testid="button-save-category"
                        >
                          {(createCategoryMutation.isPending || updateCategoryMutation.isPending) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          {editingCategory ? 'حفظ التعديلات' : 'إضافة القسم'}
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline"
                          onClick={() => {
                            setShowCategoryForm(false);
                            setEditingCategory(null);
                            setCategoryForm(emptyCategoryForm);
                          }}
                        >
                          إلغاء
                        </Button>
                      </div>
                    </form>
                  </div>
                )}

                <div className="flex justify-end mb-3 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => refetchCategories()}
                    disabled={categoriesLoading}
                    data-testid="button-refresh-categories"
                  >
                    {categoriesLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    تحديث
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={refreshAll}
                    disabled={productsLoading || categoriesLoading}
                    data-testid="button-refresh-all-categories"
                  >
                    <RefreshCw className="h-4 w-4" />
                    تحديث الكل
                  </Button>
                </div>

                {categoriesLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : categoriesError ? (
                  <div className="text-center py-10">
                    <Package className="h-12 w-12 mx-auto mb-4 text-destructive opacity-60" />
                    <p className="text-destructive font-medium mb-2">تعذّر تحميل الأقسام</p>
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => refetchCategories()}
                      data-testid="button-retry-categories"
                    >
                      <RefreshCw className="h-4 w-4" />
                      إعادة المحاولة
                    </Button>
                  </div>
                ) : categoriesList.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {categoriesList.map((category) => (
                      <div
                        key={category.id}
                        className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm hover:shadow-md transition-shadow"
                        data-testid={`card-category-${category.id}`}
                      >
                        {/* صورة القسم */}
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                          <img
                            src={category.imageUrl}
                            alt={category.name}
                            className="h-full w-full object-contain"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        </div>

                        {/* بيانات القسم */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold truncate">{category.name}</p>
                            {(category as any).isActive === false && (
                              <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">🚫 مخفي</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate mb-1">{category.slug}</p>
                          <Badge variant="secondary" className="text-xs">
                            {productsList.filter(p => p.categoryId === category.id).length} منتج
                          </Badge>
                        </div>

                        {/* أزرار الإجراءات */}
                        <div className="flex flex-col gap-1 shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className={`h-8 w-8 ${(category as any).isActive === false ? 'text-orange-600' : 'text-green-600'}`}
                            onClick={() => toggleCategoryVisibility.mutate({ id: category.id, isActive: (category as any).isActive === false })}
                            disabled={toggleCategoryVisibility.isPending}
                            data-testid={`button-toggle-visibility-category-${category.id}`}
                            title={(category as any).isActive === false ? "إظهار القسم" : "إخفاء القسم"}
                          >
                            {(category as any).isActive === false ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => openEditCategory(category)}
                            data-testid={`button-edit-category-${category.id}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm(`هل أنت متأكد من حذف قسم "${category.name}"؟`)) {
                                deleteCategoryMutation.mutate(category.id);
                              }
                            }}
                            disabled={deleteCategoryMutation.isPending}
                            data-testid={`button-delete-category-${category.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="mb-4">لا توجد أقسام بعد</p>
                    <Button
                      className="gap-2"
                      onClick={() => setShowCategoryForm(true)}
                      data-testid="button-add-first-category"
                    >
                      <Plus className="h-4 w-4" />
                      إضافة أول قسم
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
            <AdminSubcategories adminToken={adminToken} />
          </TabsContent>

          {/* ─── Subcategories Tab ─────────────────────────────────────── */}
          <TabsContent value="subcategories">
            <AdminSubcategories adminToken={adminToken} />
          </TabsContent>

          <TabsContent value="inventory">
            <div className="mb-4 p-4 bg-gradient-to-l from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border border-blue-200 rounded-lg flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-blue-900 dark:text-blue-100">أوامر الشراء (Purchase Orders)</h3>
                <p className="text-xs text-blue-700 dark:text-blue-300">إنشاء أوامر شراء، تسجيل الاستلام، وحساب متوسط التكلفة (WAC) تلقائياً</p>
              </div>
              <a href="/admin/purchase-orders" data-testid="link-purchase-orders">
                <Button className="gap-1 bg-blue-600 hover:bg-blue-700">
                  فتح
                </Button>
              </a>
            </div>
            <div className="mb-4 p-4 bg-gradient-to-l from-purple-50 to-pink-50 dark:from-purple-950/40 dark:to-pink-950/40 border border-purple-200 dark:border-purple-800 rounded-lg flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-purple-900 dark:text-purple-100 flex items-center gap-2">
                  🤖 فريق الذكاء الاصطناعي
                </h3>
                <p className="text-xs text-purple-700 dark:text-purple-300">9 وكلاء (سفر، نور، ليلى، هدى، ماجد، رامي، عمر، أوبو) + المدير التنفيذي راشد الذي يتفقد قاعدة البيانات</p>
              </div>
              <a href="/admin/ai-agents" data-testid="link-ai-agents">
                <Button className="gap-1 bg-purple-600 hover:bg-purple-700">
                  فتح
                </Button>
              </a>
            </div>
            <div className="mb-4 p-4 bg-gradient-to-l from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/40 border border-orange-200 dark:border-orange-800 rounded-lg flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-orange-900 dark:text-orange-100 flex items-center gap-2">
                  🎯 العروض التحفيزية حسب الكمية
                </h3>
                <p className="text-xs text-orange-700 dark:text-orange-300">عروض شاملة (سعر/كمية + شحن + Anchor + Badge + عمولة مسوّق لكل عرض). يلغي smart variants ورسوم الطباعة عند تطابق الكمية.</p>
              </div>
              <a href="/admin/volume-offers" data-testid="link-volume-offers">
                <Button className="gap-1 bg-orange-600 hover:bg-orange-700">
                  فتح
                </Button>
              </a>
            </div>
            <div className="mb-4 p-4 bg-gradient-to-l from-blue-50 to-sky-50 dark:from-blue-950/40 dark:to-sky-950/40 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-blue-900 dark:text-blue-100 flex items-center gap-2">
                  👥 إدارة الموظفين البشريين
                </h3>
                <p className="text-xs text-blue-700 dark:text-blue-300">إضافة/تعديل/تعطيل أعضاء الفريق + ضبط الأدوار (مدير منتجات، طلبات، مالية، مندوب توصيل). الدخول لاحقاً من <code>/staff</code>.</p>
              </div>
              <a href="/admin/staff" data-testid="link-admin-staff">
                <Button className="gap-1 bg-blue-600 hover:bg-blue-700">
                  فتح
                </Button>
              </a>
            </div>
            <InventorySection
              productsList={productsList}
              productsLoading={productsLoading}
              productsError={productsError}
              refetchProducts={refetchProducts}
              refreshAll={refreshAll}
              categoriesLoading={categoriesLoading}
              updateProductStock={updateProductStock}
              formatPrice={formatPrice}
            />
          </TabsContent>

          <TabsContent value="home-sections">
            <HomeSectionsSection adminToken={adminToken} />
          </TabsContent>

          <TabsContent value="banners-offers">
            <BannersOffersSection adminToken={adminToken} />
          </TabsContent>

          <TabsContent value="navigation">
            <div className="space-y-4">
              <NavigationSettingsSection adminToken={adminToken} />
              <PrintingProductsSection adminToken={adminToken} />
            </div>
          </TabsContent>

          <TabsContent value="sms-test">
            <div className="space-y-4">
              <ActiveOTPViewer adminToken={adminToken} />
              <TwilioSmsTest adminToken={adminToken} />
            </div>
          </TabsContent>

          <TabsContent value="reports">
            <FinancialReports adminToken={adminToken} />
          </TabsContent>

          {/* ─── Market Trends Tab ───────────────────────────────────── */}
          <TabsContent value="market-trends">
            <MarketTrends adminToken={adminToken} />
          </TabsContent>

          <TabsContent value="settings">
            <div className="space-y-4">
              {/* زر تصفح الموقع كعميل */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="font-semibold">تصفح الموقع كعميل</p>
                      <p className="text-sm text-muted-foreground">افتح الموقع بنظرة العميل في تبويب جديد</p>
                    </div>
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => window.open('/', '_blank')}
                      data-testid="button-experience-as-customer"
                    >
                      <UserCircle2 className="h-4 w-4" />
                      تصفح كعميل
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <DisplaySettingsSection adminToken={adminToken} />
              <HomePageSettingsSection adminToken={adminToken} />
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    إعدادات المتجر
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-base font-semibold mb-2 block">سعر صرف الريال اليمني</Label>
                    <p className="text-sm text-muted-foreground mb-3">
                      قيمة الريال السعودي الواحد بالريال اليمني
                    </p>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 max-w-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">1 ر.س =</span>
                          <Input
                            type="number"
                            value={exchangeRate}
                            onChange={(e) => setExchangeRate(e.target.value)}
                            className="w-32 text-center font-bold"
                            data-testid="input-exchange-rate"
                          />
                          <span className="text-muted-foreground">ر.ي</span>
                        </div>
                      </div>
                      <Button 
                        onClick={saveExchangeRate} 
                        disabled={saveSettingsMutation.isPending}
                        className="gap-2"
                        data-testid="button-save-settings"
                      >
                        {saveSettingsMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        حفظ
                      </Button>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">معلومات البنوك</h4>
                    <div className="space-y-2 text-sm">
                      <p><strong>بنك الكريمي:</strong> حساب رقم 0010203040 باسم اويو بلاست</p>
                      <p><strong>بنك النجم:</strong> حساب رقم 9876543210 باسم اويو بلاست</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            </div>
          </TabsContent>
          {/* ─── Logo & Splash Tab ────────────────────────────────────── */}
          <TabsContent value="logo-splash">
            <LogoSplashManager adminToken={adminToken} toast={toast} />
          </TabsContent>

          {/* ─── Image Dimensions Tab ─────────────────────────────────── */}
          <TabsContent value="dimensions">
            <Card>
              <CardHeader>
                <CardTitle className="text-right">📐 مقاسات الصور</CardTitle>
                <CardDescription className="text-right">تحكم يدوي بمقاسات صور المنتجات والبنرات والصور الأخرى</CardDescription>
              </CardHeader>
              <CardContent>
                <ImageDimensionsManager adminToken={adminToken} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Financial Center Tab ─────────────────────────────────── */}
          <TabsContent value="financial">
            <Card>
              <CardHeader>
                <CardTitle className="text-right">💳 المركز المالي</CardTitle>
                <CardDescription className="text-right">إدارة طرق الدفع والمحافظ الإلكترونية</CardDescription>
              </CardHeader>
              <CardContent>
                <DigitalWalletsManager adminToken={adminToken} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="login-management">
            <LoginManagementSection adminToken={adminToken} />
          </TabsContent>

          {/* ─── Suppliers Tab ─────────────────────────────────────────── */}
          <TabsContent value="suppliers">
            <div className="mb-4 p-4 bg-gradient-to-l from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border border-green-200 rounded-lg flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-green-900 dark:text-green-100">💰 سداد مستحقات الموردين</h3>
                <p className="text-xs text-green-700 dark:text-green-300">عرض الموردين بمستحقات، تسجيل دفعات، وسجل المدفوعات السابقة</p>
              </div>
              <a href="/admin/supplier-payments" data-testid="link-supplier-payments">
                <Button className="gap-1 bg-green-600 hover:bg-green-700">
                  فتح
                </Button>
              </a>
            </div>
            <SupplierManagement adminToken={adminToken} />
            <AdminServiceAreas adminToken={adminToken} />
          </TabsContent>

          {/* ─── Supplier Applications Tab (Self-Signup Review) ────── */}
          <TabsContent value="supplier-applications">
            <AdminSupplierApplications adminToken={adminToken} />
          </TabsContent>

          {/* ─── Marketers Tab ─────────────────────────────────────────── */}
          <TabsContent value="marketers">
            <AdminMarketers adminToken={adminToken} />
          </TabsContent>

          {/* ─── Supplier Products Approval Tab ───────────────────────── */}
          <TabsContent value="supplier-products">
            <AdminSupplierProducts adminToken={adminToken} />
          </TabsContent>

          {/* ─── Installments Tab ──────────────────────────────────────── */}
          <TabsContent value="installments">
            <AdminInstallments adminToken={adminToken} />
            <AdminBankAccounts adminToken={adminToken} />
          </TabsContent>

          {/* ─── Payment Verification Tab ──────────────────────────────── */}
          <TabsContent value="payment-verify">
            <AdminPaymentVerification adminToken={adminToken} />
          </TabsContent>

          {/* ─── Smart Pricing Tab ─────────────────────────────────────── */}
          <TabsContent value="pricing">
            <AdminPricing adminToken={adminToken} />
          </TabsContent>

          {/* ─── Security Logs Tab ─────────────────────────────────────── */}
          <TabsContent value="security">
            <AdminSecurityLogs adminToken={adminToken} />
          </TabsContent>

          {/* ─── Reviews Tab ───────────────────────────────────────────── */}
          <TabsContent value="reviews">
            <AdminReviews />
          </TabsContent>

          {/* ─── Invoice Settings Tab ──────────────────────────────────── */}
          <TabsContent value="invoice-settings">
            <InvoiceSettingsSection adminToken={adminToken} />
          </TabsContent>

          {/* ─── Team Management Tab ───────────────────────────────────── */}
          <TabsContent value="team">
            <div className="space-y-8">
              <TeamManagement adminToken={adminToken} />
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-6 w-1 rounded bg-primary" />
                  <h2 className="text-lg font-bold">كشف الرواتب الشهري</h2>
                </div>
                <AdminPayroll adminToken={adminToken} />
              </div>
            </div>
          </TabsContent>

          {/* ─── Section Settings Tab ──────────────────────────────────── */}
          <TabsContent value="section-settings">
            <div className="space-y-8">
              <AdminSectionSettings adminToken={adminToken} />
              <hr />
              <AdminPDPLayout adminToken={adminToken} />
            </div>
          </TabsContent>

          {/* ─── Digital Contracts Tab ─────────────────────────────────── */}
          <TabsContent value="contracts">
            <AdminContracts adminToken={adminToken} />
          </TabsContent>

          {/* ─── Backup System Tab ─────────────────────────────────────── */}
          <TabsContent value="backup">
            <AdminBackup adminToken={adminToken} />
          </TabsContent>

          {/* ─── Printing Categories Tab ────────────────────────────────── */}
          <TabsContent value="printing-categories">
            <AdminPrintingCategories adminToken={adminToken} />
          </TabsContent>

          {/* ─── AI Sales Agent Tab ─────────────────────────────────────── */}
          <TabsContent value="ai-sales">
            <AdminAISales adminToken={adminToken} />
          </TabsContent>

          {/* ─── نظام الائتمان والفئات (المرحلة 1) ─────────────────────── */}
          <TabsContent value="credit-tiers">
            <AdminCreditTiers adminToken={adminToken} />
          </TabsContent>

          {/* ─── العملاء والائتمان (المرحلة 1) ──────────────────────────── */}
          <TabsContent value="credit-customers">
            <AdminCreditCustomers adminToken={adminToken} />
          </TabsContent>

          {/* ─── AI Studio Preview Settings ───────────────────────────── */}
          <TabsContent value="studio-preview">
            <AdminStudioPreviewSettings adminToken={adminToken} />
          </TabsContent>

        </Tabs>
      </div>

      {selectedOrderForInvoice && (
        <PrintableInvoice
          order={selectedOrderForInvoice}
          orderItems={orderItems}
          isDeliveryInvoice={invoiceType === "delivery"}
          adminToken={adminToken}
          onClose={() => {
            setSelectedOrderForInvoice(null);
            setOrderItems([]);
          }}
        />
      )}
    </div>
  );
}
