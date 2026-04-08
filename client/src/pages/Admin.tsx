import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Order, Product } from "@shared/schema";
import FinancialReports from "@/components/FinancialReports";
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
  FileText
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import PrintableInvoice from "@/components/PrintableInvoice";
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

type SmartVariantType = "color" | "size" | "weight" | "image";
interface SmartVariant {
  id: string;
  type: SmartVariantType;
  label: string;
  price: string;
  priceSar: string;
  discount: string;
  hex: string;
  imageUrl: string;
}
const SMART_VARIANT_TYPE_LABELS: Record<SmartVariantType, string> = {
  color: "لون",
  size: "مقاس",
  weight: "وزن",
  image: "صورة",
};
const SMART_VARIANT_TYPE_ICONS: Record<SmartVariantType, string> = {
  color: "🎨",
  size: "📐",
  weight: "⚖️",
  image: "🖼️",
};

interface ProductFormData {
  name: string;
  description: string;
  price: string;
  priceSar: string;
  categoryId: number;
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
  tags: string;
  showReviews: boolean;
  enableVariantUI: boolean;
  colorImages: ColorImageEntry[];
  enableSmartVariants: boolean;
  originalPrice: string;
  originalPriceSar: string;
  discountPercent: string;
  promotionalTags: string[];
  supplierId: number;
}

const emptyProductForm: ProductFormData = {
  name: "",
  description: "",
  price: "",
  priceSar: "",
  categoryId: 0,
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
  tags: "",
  showReviews: true,
  enableVariantUI: false,
  colorImages: [],
  enableSmartVariants: false,
  originalPrice: "",
  originalPriceSar: "",
  discountPercent: "",
  promotionalTags: [],
  supplierId: 0,
};

interface CategoryFormData {
  name: string;
  slug: string;
  imageUrl: string;
}

const emptyCategoryForm: CategoryFormData = {
  name: "",
  slug: "",
  imageUrl: ""
};

interface OrderItemWithName {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  price: string;
  productName: string;
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
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : products.length > 0 ? (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {products.map((product) => (
              <div
                key={product.id}
                className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
              >
                <input
                  type="checkbox"
                  checked={product.showInPrinting || false}
                  onChange={() => handleToggleProduct(product.id, product.showInPrinting || false)}
                  disabled={updatePrintingStatusMutation.isPending}
                  className="w-5 h-5 cursor-pointer"
                  data-testid={`checkbox-printing-${product.id}`}
                />
                {product.imageUrl && (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-12 h-12 rounded object-cover"
                  />
                )}
                <div className="flex-1">
                  <p className="font-semibold">{product.name}</p>
                  <p className="text-xs text-gray-500">{product.price} ر.ي</p>
                </div>
                {product.showInPrinting && (
                  <Badge className="bg-green-100 text-green-800">مفعل</Badge>
                )}
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
            <p className="text-xs text-muted-foreground mt-1">أضف وأدر الأقسام التي تظهر في الصفحة الرئيسية تحت الأقسام الدائرية</p>
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
              {[...sections].sort((a, b) => a.priority - b.priority).map((section) => (
                <div key={section.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${section.enabled ? 'border-primary/30 bg-primary/5' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">أولوية</span>
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
              ))}
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
          <div className="flex items-center justify-between">
            <Label>إظهار الأقسام</Label>
            <Switch
              checked={settings?.showCategories ?? true}
              onCheckedChange={v => handleUpdate('showCategories', v)}
              disabled={updateMutation.isPending}
              data-testid="switch-show-categories"
            />
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
        <div className="border-2 border-blue-200 rounded-lg p-4 space-y-4 bg-blue-50/30">
          <h3 className="font-semibold text-base flex items-center gap-2 text-blue-700">
            <Package className="h-4 w-4" />
            إعدادات صفحة المنتج
          </h3>
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

        {/* ─── تحكم البنرات والعروض ─────────────────────────────────────── */}
        <div className="border-2 border-blue-200 dark:border-blue-800 rounded-xl overflow-hidden">
          <div className="bg-gradient-to-l from-blue-600 to-cyan-600 px-5 py-4 flex items-center gap-3">
            <Zap className="h-5 w-5 text-white flex-shrink-0" />
            <div>
              <h3 className="font-bold text-white text-base">تحكم البنرات والعروض</h3>
              <p className="text-blue-100 text-xs">ضبط الأبعاد (عرض + ارتفاع) للسلايدر وبنرات العروض</p>
            </div>
          </div>

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
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 🌌 سديم الذكية — لوحة التحكم المتقدمة لصفحة المنتج          */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="border-2 border-purple-200 dark:border-purple-800 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-l from-purple-600 to-indigo-600 px-5 py-4 flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-white flex-shrink-0" />
            <div>
              <h3 className="font-bold text-white text-base">سديم الذكية</h3>
              <p className="text-purple-100 text-xs">تحكم ديناميكي كامل بعناصر صفحة المنتج</p>
            </div>
          </div>

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
            </div>

          </div>
        </div>
        {/* ═══════════════════════════════════════════════════════════════ */}

        {/* 💳 إعدادات الدفع والشحن */}
        <div className="border-2 border-green-200 dark:border-green-800 rounded-xl overflow-hidden">
          <div className="bg-gradient-to-l from-green-600 to-emerald-600 px-5 py-4 flex items-center gap-3">
            <Banknote className="h-5 w-5 text-white flex-shrink-0" />
            <div>
              <h3 className="font-bold text-white text-base">إعدادات الدفع والشحن</h3>
              <p className="text-green-100 text-xs">تحكم في رسوم الشحن وطرق الدفع المتاحة</p>
            </div>
          </div>

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
          </div>
        </div>
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
        <div className="mb-3 bg-white border border-cyan-200 rounded-lg p-2.5">
          <p className="text-xs text-gray-500">المورد الحالي</p>
          <p className="font-bold">{currentSupplier.name}</p>
          <p className="text-xs text-gray-500" dir="ltr">{currentSupplier.phone}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs text-green-700">
              نصيبه: {Number(order.supplierAmount || order.supplier_amount || 0).toLocaleString()} ر.ي
            </span>
            <span className="text-xs text-purple-600">
              / عمولة المنصة: {Number(order.platformCommission || order.platform_commission || 0).toLocaleString()} ر.ي
            </span>
          </div>
          {(order.supplierNotified || order.supplier_notified) && (
            <span className="text-xs text-green-600">✓ تم إشعاره</span>
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

export default function Admin() {
  const [activeSection, setActiveSection] = useState("orders");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItemWithName[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [exchangeRate, setExchangeRate] = useState("140");
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<number | null>(null);
  const [productForm, setProductForm] = useState<ProductFormData>(emptyProductForm);
  const [colorImagesList, setColorImagesList] = useState<ColorImageEntry[]>([]);
  const [smartVariantsList, setSmartVariantsList] = useState<SmartVariant[]>([]);
  const [smartActiveTypes, setSmartActiveTypes] = useState<SmartVariantType[]>([]);
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

  const updateProductStock = useMutation({
    mutationFn: async ({ productId, stock }: { productId: number; stock: number }) => {
      const res = await fetch(`/api/admin/products/${productId}/stock`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-token': adminToken || '' 
        },
        body: JSON.stringify({ stock })
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
          tags: data.tags ? data.tags.split(',').map(t => t.trim()).filter(t => t) : null,
          showReviews: data.showReviews,
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
          supplierId: data.supplierId || null,
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.details || 'Failed to create product');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/categories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({ title: "تم إضافة المنتج بنجاح" });
      setShowProductForm(false);
      setProductForm(emptyProductForm);
      setColorImagesList([]);
      setSmartVariantsList([]);
      setSmartActiveTypes([]);
    },
    onError: () => {
      toast({ title: "حدث خطأ أثناء إضافة المنتج", variant: "destructive" });
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
        stock: data.stock,
        allowDesignUpload: data.allowDesignUpload,
        printingPricePerUnit: numOrNull(data.printingPricePerUnit),
        hasPrintingOptions: data.hasPrintingOptions,
        baseBagPrice: numOrNull(data.baseBagPrice),
        singleColorPrintPrice: numOrNull(data.singleColorPrintPrice),
        colors: data.colors ? data.colors.split(',').map(c => c.trim()).filter(c => c) : null,
        sizes: data.sizes ? data.sizes.split(',').map(s => s.trim()).filter(s => s) : null,
        availableBagColors: data.availableBagColors ? data.availableBagColors.split(',').map(c => c.trim()).filter(c => c) : null,
        tags: data.tags ? data.tags.split(',').map(t => t.trim()).filter(t => t) : null,
        showReviews: data.showReviews,
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
        supplierId: data.supplierId || null,
      };
      
      if (data.imageUrls && data.imageUrls.length > 0) {
        payload.imageUrls = data.imageUrls;
        payload.imageUrl = data.imageUrls[0];
      } else if (data.imageUrl) {
        payload.imageUrl = data.imageUrl;
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
      queryClient.invalidateQueries({ queryKey: ['/api/admin/categories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
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
      imageUrl: category.imageUrl
    });
    setShowCategoryForm(true);
  };

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
      imageUrl: product.imageUrl,
      imageUrls: existingImageUrls,
      stock: product.stock,
      colors: product.colors ? product.colors.join(', ') : "",
      sizes: product.sizes ? product.sizes.join(', ') : "",
      allowDesignUpload: product.allowDesignUpload ?? false,
      printingPricePerUnit: product.printingPricePerUnit != null ? String(product.printingPricePerUnit) : "",
      hasPrintingOptions: product.hasPrintingOptions ?? false,
      showReviews: product.showReviews ?? true,
      baseBagPrice: product.baseBagPrice != null ? String(product.baseBagPrice) : "",
      singleColorPrintPrice: product.singleColorPrintPrice != null ? String(product.singleColorPrintPrice) : "",
      availableBagColors: product.availableBagColors ? product.availableBagColors.join(', ') : "",
      tags: product.tags ? product.tags.join(', ') : "",
      enableVariantUI: (product as any).enableVariantUI ?? false,
      colorImages: [],
      enableSmartVariants: (product as any).enableSmartVariants ?? false,
      originalPrice: (product as any).originalPrice != null ? String((product as any).originalPrice) : "",
      originalPriceSar: (product as any).originalPriceSar != null ? String((product as any).originalPriceSar) : "",
      discountPercent: (product as any).discountPercent != null ? String((product as any).discountPercent) : "",
      promotionalTags: (product as any).promotionalTags ?? [],
      supplierId: (product as any).supplierId ?? (product as any).supplier_id ?? 0,
    });
    // Parse colorImages JSON if present
    try {
      const ci = (product as any).colorImages;
      setColorImagesList(ci ? JSON.parse(ci) : []);
    } catch {
      setColorImagesList([]);
    }
    // Parse smartVariants JSON if present
    try {
      const sv = (product as any).smartVariants;
      if (sv) {
        const parsed = JSON.parse(sv);
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
    setShowProductForm(true);
  };

  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      
      if (response.ok) {
        const data = await response.json();
        setAdminToken(data.token);
        setIsAuthenticated(true);
        localStorage.setItem("admin_token", data.token);
        toast({ title: "مرحباً بك في لوحة التحكم" });
      } else {
        toast({ title: "كلمة المرور غير صحيحة", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "حدث خطأ في الاتصال", variant: "destructive" });
    }
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
              <Button type="submit" className="w-full" data-testid="button-admin-login">
                دخول
              </Button>
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
        <div className="container mx-auto">
          <h1 className="text-lg font-bold">لوحة تحكم OYO PLAST</h1>
          <p className="text-primary-foreground/80 text-xs">إدارة الطلبات والمنتجات</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-4">

        {/* Admin Navigation Grid */}
        <AdminNav activeSection={activeSection} onSelectSection={setActiveSection} />

        <Tabs value={activeSection} onValueChange={setActiveSection} className="space-y-4">
          <TabsList style={{ display: "none" }} />

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>إدارة الطلبات</CardTitle>
              </CardHeader>
              <CardContent>
                {ordersLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : orders && orders.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">رقم الطلب</TableHead>
                          <TableHead className="text-right">العميل</TableHead>
                          <TableHead className="text-right">المدينة</TableHead>
                          <TableHead className="text-right">الإجمالي</TableHead>
                          <TableHead className="text-right">طريقة الدفع</TableHead>
                          <TableHead className="text-right">الحالة</TableHead>
                          <TableHead className="text-right">التاريخ</TableHead>
                          <TableHead className="text-right">إجراءات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((order) => {
                          const status = statusMap[order.status] || statusMap.pending;
                          const StatusIcon = status.icon;
                          return (
                            <TableRow key={order.id}>
                              <TableCell className="font-medium">#{order.id}</TableCell>
                              <TableCell>{order.customerPhone || '-'}</TableCell>
                              <TableCell>{order.shippingCity || '-'}</TableCell>
                              <TableCell className="font-bold">{formatPrice(order.total)} ر.ي</TableCell>
                              <TableCell>
                                {order.paymentMethod === 'karimi' && 'الكريمي'}
                                {order.paymentMethod === 'najm' && 'النجم'}
                                {order.paymentMethod === 'cash_on_delivery' && 'عند الاستلام'}
                                {!order.paymentMethod && '-'}
                              </TableCell>
                              <TableCell>
                                <Badge className={`${status.color} gap-1`}>
                                  <StatusIcon className="h-3 w-3" />
                                  {status.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">{formatDate(order.createdAt)}</TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleOpenInvoice(order, "customer")}
                                    disabled={loadingItems}
                                    title="فاتورة العميل"
                                    data-testid={`button-admin-customer-invoice-${order.id}`}
                                    className="text-primary hover:text-primary"
                                  >
                                    {loadingItems ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                                  </Button>
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    onClick={() => handleOpenInvoice(order, "delivery")}
                                    disabled={loadingItems}
                                    title="بوليصة التوصيل"
                                    data-testid={`button-admin-print-invoice-${order.id}`}
                                    className="text-orange-500 hover:text-orange-600"
                                  >
                                    {loadingItems ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Truck className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button size="icon" variant="ghost" onClick={() => setSelectedOrder(order)}>
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-lg">
                                      <DialogHeader>
                                        <DialogTitle>تفاصيل الطلب #{order.id}</DialogTitle>
                                      </DialogHeader>
                                      <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                          <div>
                                            <p className="text-muted-foreground">الهاتف</p>
                                            <p className="font-medium">{order.customerPhone || '-'}</p>
                                          </div>
                                          <div>
                                            <p className="text-muted-foreground">المدينة</p>
                                            <p className="font-medium">{order.shippingCity || '-'}</p>
                                          </div>
                                          <div className="col-span-2">
                                            <p className="text-muted-foreground">العنوان</p>
                                            <p className="font-medium">{order.shippingAddress || '-'}</p>
                                          </div>
                                          {order.notes && (
                                            <div className="col-span-2">
                                              <p className="text-muted-foreground">ملاحظات</p>
                                              <p className="font-medium">{order.notes}</p>
                                            </div>
                                          )}
                                          <div>
                                            <p className="text-muted-foreground">الإجمالي</p>
                                            <p className="font-bold text-primary">{formatPrice(order.total)} ر.ي</p>
                                          </div>
                                          {order.depositAmount && (
                                            <div>
                                              <p className="text-muted-foreground">العربون</p>
                                              <p className="font-medium">{formatPrice(order.depositAmount)} ر.ي</p>
                                            </div>
                                          )}
                                        </div>

                                        {order.receiptImageUrl && (
                                          <div>
                                            <p className="text-muted-foreground mb-2">صورة الإشعار</p>
                                            <p className="text-sm bg-gray-100 p-2 rounded">{order.receiptImageUrl}</p>
                                          </div>
                                        )}

                                        <Separator />

                                        <div>
                                          <Label>تغيير الحالة</Label>
                                          <Select
                                            value={order.status}
                                            onValueChange={(value) => updateOrderStatus.mutate({ orderId: order.id, status: value })}
                                          >
                                            <SelectTrigger className="mt-1">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="pending">قيد الانتظار</SelectItem>
                                              <SelectItem value="deposit_paid">تم دفع العربون</SelectItem>
                                              <SelectItem value="processing">قيد التجهيز</SelectItem>
                                              <SelectItem value="shipped">تم الشحن</SelectItem>
                                              <SelectItem value="delivered">تم التوصيل</SelectItem>
                                              <SelectItem value="completed">مكتمل</SelectItem>
                                              <SelectItem value="cancelled">ملغي</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>

                                        {/* ─── تعيين المورد يدوياً ─── */}
                                        <OrderSupplierAssign
                                          order={order}
                                          adminToken={adminToken}
                                        />
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-10 text-muted-foreground">
                    <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>لا توجد طلبات بعد</p>
                  </div>
                )}
              </CardContent>
            </Card>
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
                    <form onSubmit={handleProductSubmit} className="space-y-4">
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
                            onValueChange={(value) => setProductForm({...productForm, categoryId: parseInt(value)})}
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
                        <Label htmlFor="product-supplier">المورد المسؤول عن هذا المنتج (اختياري)</Label>
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

                      <div className="grid md:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="product-price">السعر بالريال اليمني *</Label>
                          <Input
                            id="product-price"
                            type="number"
                            value={productForm.price}
                            onChange={(e) => {
                              const yer = e.target.value;
                              const rate = parseFloat(exchangeRate) || 140;
                              const autoSar = yer ? (parseFloat(yer) / rate).toFixed(2) : "";
                              setProductForm({...productForm, price: yer, priceSar: autoSar});
                            }}
                            placeholder="5000"
                            required
                            data-testid="input-product-price"
                          />
                        </div>
                        <div>
                          <Label htmlFor="product-price-sar">
                            السعر بالريال السعودي
                            <span className="text-xs text-muted-foreground mr-1">(محسوب تلقائياً)</span>
                          </Label>
                          <Input
                            id="product-price-sar"
                            type="number"
                            value={productForm.priceSar}
                            onChange={(e) => setProductForm({...productForm, priceSar: e.target.value})}
                            placeholder="35"
                            data-testid="input-product-price-sar"
                          />
                        </div>
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

                      <div>
                        <Label htmlFor="product-image">صور المنتج * (2-5 صور)</Label>
                        <div className="flex items-center gap-4">
                          <label 
                            htmlFor="product-image-upload"
                            className={`flex items-center gap-2 px-4 py-2 rounded-md cursor-pointer transition-colors ${
                              productForm.imageUrls.length >= 5 
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                                : 'bg-primary text-white hover:bg-primary/90'
                            }`}
                          >
                            <ImagePlus className="h-4 w-4" />
                            <span>{isUploading ? 'جاري الرفع...' : `رفع صورة (${productForm.imageUrls.length}/5)`}</span>
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

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="product-colors">الألوان المتاحة (مفصولة بفاصلة)</Label>
                          <Input
                            id="product-colors"
                            value={productForm.colors}
                            onChange={(e) => setProductForm({...productForm, colors: e.target.value})}
                            placeholder="أبيض, أسود, أحمر"
                            data-testid="input-product-colors"
                          />
                          <ColorCircles colorsString={productForm.colors} />
                        </div>
                        <div>
                          <Label htmlFor="product-sizes">المقاسات المتاحة (مفصولة بفاصلة)</Label>
                          <Input
                            id="product-sizes"
                            value={productForm.sizes}
                            onChange={(e) => setProductForm({...productForm, sizes: e.target.value})}
                            placeholder="صغير, وسط, كبير"
                            data-testid="input-product-sizes"
                          />
                        </div>
                      </div>

                      <div className="border-t pt-4 mt-4">
                        <div className="flex items-center gap-2 mb-4">
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
                        <p className="text-xs text-muted-foreground mb-3">عند التفعيل: يمكن للعميل رفع ملف التصميم وإضافة ملاحظات</p>
                        
                        {productForm.allowDesignUpload && (
                          <div className="p-4 bg-muted/50 rounded-lg space-y-4">
                            <div>
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
                          </div>
                        )}
                      </div>

                      <div className="border-t pt-4 mt-4">
                        <div className="flex items-center gap-2 mb-4">
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
                          <div className="grid md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
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
                              <p className="text-xs text-muted-foreground mt-1">الألوان التي يمكن للعميل اختيارها للكيس</p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="border-t pt-4 mt-4">
                        <div className="flex items-center gap-2 mb-4">
                          <input
                            type="checkbox"
                            id="product-show-reviews"
                            checked={productForm.showReviews}
                            onChange={(e) => setProductForm({...productForm, showReviews: e.target.checked})}
                            className="rounded border-gray-300"
                            data-testid="checkbox-show-reviews"
                          />
                          <Label htmlFor="product-show-reviews" className="font-bold flex items-center gap-2">
                            <Star className="h-4 w-4" />
                            إظهار التقييمات والمراجعات
                          </Label>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="product-tags">الكلمات الدلالية (tags) - مفصولة بفاصلة</Label>
                        <Input
                          id="product-tags"
                          value={productForm.tags}
                          onChange={(e) => setProductForm({...productForm, tags: e.target.value})}
                          placeholder="كيس-قماشي, أكياس-بلاستيك, طباعة-مخصصة"
                          data-testid="input-product-tags"
                        />
                        <p className="text-xs text-muted-foreground mt-1">تُستخدم للبحث وتصنيف المنتجات في صفحة الطباعة</p>
                      </div>

                      {/* ─── قسم الخصومات ─── */}
                      <div className="border-2 border-red-200 bg-red-50 dark:bg-red-900/10 rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded font-bold">خصم</span>
                          <Label className="font-bold text-base">إعدادات الخصم والتصنيفات الترويجية</Label>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="original-price" className="text-xs">السعر الأصلي قبل الخصم (ر.ي)</Label>
                            <Input
                              id="original-price"
                              type="number"
                              value={productForm.originalPrice}
                              onChange={(e) => {
                                const newOrig = e.target.value;
                                setProductForm(prev => {
                                  let disc = prev.discountPercent;
                                  if (newOrig && prev.price) {
                                    const orig = Number(newOrig);
                                    const curr = Number(prev.price);
                                    if (orig > curr && orig > 0) disc = String(Math.round(((orig - curr) / orig) * 100));
                                  }
                                  return {...prev, originalPrice: newOrig, discountPercent: disc};
                                });
                              }}
                              placeholder="مثال: 5000"
                              data-testid="input-original-price"
                            />
                          </div>
                          <div>
                            <Label htmlFor="original-price-sar" className="text-xs">السعر الأصلي (ر.س)</Label>
                            <Input
                              id="original-price-sar"
                              type="number"
                              value={productForm.originalPriceSar}
                              onChange={(e) => setProductForm({...productForm, originalPriceSar: e.target.value})}
                              placeholder="مثال: 35"
                              data-testid="input-original-price-sar"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">نسبة الخصم % (تُحسب تلقائياً أو أدخلها يدوياً)</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <Input
                              type="number"
                              min="0"
                              max="99"
                              value={productForm.discountPercent}
                              onChange={(e) => setProductForm({...productForm, discountPercent: e.target.value})}
                              placeholder="0"
                              className="w-24"
                              data-testid="input-discount-percent"
                            />
                            <span className="text-sm font-bold text-red-600">%</span>
                            {productForm.discountPercent && Number(productForm.discountPercent) > 0 && (
                              <span className="text-xs bg-red-500 text-white px-2 py-1 rounded font-bold">
                                -{productForm.discountPercent}%
                              </span>
                            )}
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
                      </div>

                      {/* ─── قسم الواجهة المتطورة (SHEIN-Style) ─── */}
                      <div className="border-2 border-amber-200 bg-amber-50 dark:bg-amber-900/10 rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded font-bold">اختياري</span>
                              <Label className="font-bold text-base">الواجهة المتطورة (SHEIN-Style)</Label>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">عند التفعيل يظهر صورة كبيرة + تغيير الصورة حسب اللون المختار. يشترط تفعيل المفتاح الرئيسي من إعدادات التنقل أيضاً.</p>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <input
                              type="checkbox"
                              id="enable-variant-ui"
                              checked={productForm.enableVariantUI}
                              onChange={(e) => setProductForm({...productForm, enableVariantUI: e.target.checked})}
                              className="w-6 h-6 cursor-pointer accent-amber-500"
                              data-testid="checkbox-enable-variant-ui"
                            />
                            <span className={`text-xs font-bold ${productForm.enableVariantUI ? 'text-green-600' : 'text-gray-400'}`}>
                              {productForm.enableVariantUI ? 'مفعّل' : 'موقوف'}
                            </span>
                          </div>
                        </div>

                        {productForm.enableVariantUI && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="font-semibold">ربط الألوان بصور مختلفة</Label>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="gap-1 h-7 text-xs"
                                onClick={() => setColorImagesList([...colorImagesList, { color: "", hex: "#000000", imageUrl: "" }])}
                                data-testid="button-add-color-image"
                              >
                                <Plus className="h-3 w-3" />
                                إضافة لون
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">اربط كل لون بصورة مختلفة — عند اختيار اللون تتغير الصورة الرئيسية تلقائياً</p>
                            {colorImagesList.length === 0 && (
                              <p className="text-xs text-amber-600 text-center py-2 border border-dashed border-amber-300 rounded">لا يوجد ربط بعد — يمكنك الإضافة لاحقاً</p>
                            )}
                            {colorImagesList.map((entry, idx) => (
                              <div key={idx} className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 items-center bg-white dark:bg-gray-800 rounded p-2 border">
                                <div className="flex flex-col items-center gap-1">
                                  <input
                                    type="color"
                                    value={entry.hex || "#000000"}
                                    onChange={(e) => {
                                      const updated = [...colorImagesList];
                                      updated[idx] = { ...updated[idx], hex: e.target.value };
                                      setColorImagesList(updated);
                                    }}
                                    className="w-8 h-8 cursor-pointer rounded border"
                                    title="اختر اللون"
                                  />
                                </div>
                                <Input
                                  placeholder="اسم اللون (مثال: أزرق)"
                                  value={entry.color}
                                  onChange={(e) => {
                                    const updated = [...colorImagesList];
                                    updated[idx] = { ...updated[idx], color: e.target.value };
                                    setColorImagesList(updated);
                                  }}
                                  className="h-8 text-xs"
                                  data-testid={`input-color-name-${idx}`}
                                />
                                <Input
                                  placeholder="رابط صورة هذا اللون"
                                  value={entry.imageUrl}
                                  onChange={(e) => {
                                    const updated = [...colorImagesList];
                                    updated[idx] = { ...updated[idx], imageUrl: e.target.value };
                                    setColorImagesList(updated);
                                  }}
                                  className="h-8 text-xs"
                                  data-testid={`input-color-imageurl-${idx}`}
                                />
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => setColorImagesList(colorImagesList.filter((_, i) => i !== idx))}
                                  data-testid={`button-remove-color-${idx}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ))}
                            {colorImagesList.some(e => e.imageUrl) && (
                              <div className="flex gap-2 flex-wrap mt-2">
                                {colorImagesList.filter(e => e.imageUrl).map((entry, idx) => (
                                  <div key={idx} className="flex flex-col items-center gap-1">
                                    <div className="w-12 h-12 rounded overflow-hidden border">
                                      <img src={entry.imageUrl} alt={entry.color} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }} />
                                    </div>
                                    <span className="text-[10px] text-center" style={{ color: entry.hex }}>{entry.color || '—'}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ─── قسم الخيارات الذكية ─── */}
                      <div className="border-2 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded font-bold">جديد</span>
                              <Label className="font-bold text-base">الخيارات الذكية للمنتج</Label>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">أضف خيارات للمقاس أو اللون أو الوزن أو الصورة — كل خيار بسعره وخصمه الخاص. يظهر كمربعات تحت السعر في صفحة المنتج.</p>
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
                            {/* أزرار أنواع الخيارات */}
                            <div>
                              <Label className="text-sm font-semibold mb-2 block">أنواع الخيارات المفعّلة</Label>
                              <div className="flex gap-2 flex-wrap">
                                {(["size", "weight", "color", "image"] as SmartVariantType[]).map(type => {
                                  const isActive = smartActiveTypes.includes(type);
                                  return (
                                    <button
                                      key={type}
                                      type="button"
                                      onClick={() => {
                                        setSmartActiveTypes(prev =>
                                          isActive ? prev.filter(t => t !== type) : [...prev, type]
                                        );
                                      }}
                                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-all ${
                                        isActive
                                          ? 'bg-emerald-600 text-white border-emerald-600'
                                          : 'bg-white dark:bg-gray-800 text-gray-600 border-gray-300 hover:border-emerald-400'
                                      }`}
                                      data-testid={`button-toggle-type-${type}`}
                                    >
                                      <span>{SMART_VARIANT_TYPE_ICONS[type]}</span>
                                      <span>{SMART_VARIANT_TYPE_LABELS[type]}</span>
                                    </button>
                                  );
                                })}
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
                                          };
                                          setSmartVariantsList(prev => [...prev, newItem]);
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
                                    {smartActiveTypes.map(type => {
                                      const typeVariants = smartVariantsList.filter(v => v.type === type && v.label);
                                      if (typeVariants.length === 0) return null;
                                      return (
                                        <div key={type} className="mb-2">
                                          <p className="text-[10px] text-gray-500 mb-1">{SMART_VARIANT_TYPE_ICONS[type]} {SMART_VARIANT_TYPE_LABELS[type]}</p>
                                          <div className="flex gap-1.5 flex-wrap">
                                            {typeVariants.map((v, i) => (
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
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 pt-4">
                        <Button 
                          type="submit" 
                          disabled={createProductMutation.isPending || updateProductMutation.isPending}
                          className="gap-2"
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
                          <p className="font-semibold truncate">{category.name}</p>
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
          </TabsContent>

          <TabsContent value="inventory">
            <Card>
              <CardHeader>
                <CardTitle>إدارة المخزون</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-end mb-3 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => refetchProducts()}
                    disabled={productsLoading}
                    data-testid="button-refresh-inventory"
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
                    data-testid="button-refresh-all-inventory"
                  >
                    <RefreshCw className="h-4 w-4" />
                    تحديث الكل
                  </Button>
                </div>

                {productsLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : productsError ? (
                  <div className="text-center py-10">
                    <Package className="h-12 w-12 mx-auto mb-4 text-destructive opacity-60" />
                    <p className="text-destructive font-medium mb-2">تعذّر تحميل المخزون</p>
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => refetchProducts()}
                      data-testid="button-retry-inventory"
                    >
                      <RefreshCw className="h-4 w-4" />
                      إعادة المحاولة
                    </Button>
                  </div>
                ) : productsList.length > 0 ? (
                  <div className="space-y-2">
                    {productsList.map((product) => (
                      <div
                        key={product.id}
                        className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm"
                        data-testid={`row-inventory-${product.id}`}
                      >
                        {/* صورة المنتج */}
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="h-full w-full object-contain"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        </div>

                        {/* اسم المنتج والأسعار */}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatPrice(product.price)} ر.ي
                            {product.priceSar ? ` · ${formatPrice(product.priceSar)} ر.س` : ''}
                          </p>
                        </div>

                        {/* حالة المخزون الحالي */}
                        <Badge
                          variant={product.stock > 10 ? "default" : product.stock > 0 ? "secondary" : "destructive"}
                          className="shrink-0 text-xs"
                        >
                          {product.stock > 0 ? `${product.stock} قطعة` : 'نفذ'}
                        </Badge>

                        {/* حقل تعديل المخزون */}
                        <Input
                          type="number"
                          min={0}
                          defaultValue={product.stock}
                          className="w-20 shrink-0 text-center"
                          onBlur={(e) => {
                            const newStock = parseInt(e.target.value);
                            if (!isNaN(newStock) && newStock !== product.stock) {
                              updateProductStock.mutate({ productId: product.id, stock: newStock });
                            }
                          }}
                          data-testid={`input-stock-${product.id}`}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>لا توجد منتجات بعد</p>
                  </div>
                )}
              </CardContent>
            </Card>
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
            <SupplierManagement adminToken={adminToken} />
          </TabsContent>

          {/* ─── Invoice Settings Tab ──────────────────────────────────── */}
          <TabsContent value="invoice-settings">
            <InvoiceSettingsSection adminToken={adminToken} />
          </TabsContent>

          {/* ─── Team Management Tab ───────────────────────────────────── */}
          <TabsContent value="team">
            <TeamManagement adminToken={adminToken} />
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
