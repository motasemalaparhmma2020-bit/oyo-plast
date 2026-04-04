import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Order, Product } from "@shared/schema";
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
  Palette
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import PrintableInvoice from "@/components/PrintableInvoice";
import { DigitalWalletsManager } from "@/components/DigitalWalletsManager";
import { ImageDimensionsManager } from "@/components/ImageDimensionsManager";
import { AdminNav } from "@/components/AdminNav";
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
  showReviews: true
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
    queryKey: ['/api/categories'],
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

// Navigation Settings Section
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
      </CardContent>
    </Card>
  );
}

// Printing Products Section
function PrintingProductsSection({ adminToken }: { adminToken: string | null }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/products'],
    enabled: !!adminToken,
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
          queryClient.invalidateQueries({ queryKey: ['/api/products'] });
          queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
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
      setSettings(data);
      toast({ title: "تم تحديث إعدادات العرض بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل تحديث إعدادات العرض", variant: "destructive" });
    },
  });

  const handleUpdate = (key: string, value: any) => {
    updateMutation.mutate({ [key]: value });
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
                  onBlur={e => handleUpdate('productCardWidth', +e.target.value)}
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
                  max={500}
                  value={settings?.productCardHeight ?? 200}
                  onChange={e => setSettings((s: any) => ({ ...s, productCardHeight: +e.target.value }))}
                  onBlur={e => handleUpdate('productCardHeight', +e.target.value)}
                  className="w-24"
                  data-testid="input-product-card-height"
                  disabled={updateMutation.isPending}
                />
                <span className="text-sm text-muted-foreground">بكسل</span>
              </div>
            </div>
          </div>
        </div>

        {/* Offer Banners Settings */}
        <div className="border rounded-lg p-4 space-y-4">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <Zap className="h-4 w-4" />
            إعدادات بنرات العروض
          </h3>
          <div className="space-y-2">
            <Label>ارتفاع البنر (بكسل)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={40}
                max={200}
                value={settings?.offerBannerHeight ?? 72}
                onChange={e => setSettings((s: any) => ({ ...s, offerBannerHeight: +e.target.value }))}
                onBlur={e => handleUpdate('offerBannerHeight', +e.target.value)}
                className="w-24"
                data-testid="input-offer-banner-height"
                disabled={updateMutation.isPending}
              />
              <span className="text-sm text-muted-foreground">بكسل</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label>إظهار بنرات العروض</Label>
            <Switch
              checked={settings?.showOfferBanners ?? true}
              onCheckedChange={v => handleUpdate('showOfferBanners', v)}
              disabled={updateMutation.isPending}
              data-testid="switch-show-offer-banners"
            />
          </div>
        </div>

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
  const [productForm, setProductForm] = useState<ProductFormData>(emptyProductForm);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryFormData>(emptyCategoryForm);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

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

  const handlePrintDeliveryInvoice = async (order: Order) => {
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
    setSelectedOrderForInvoice(order);
  };

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

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ['/api/products'],
    enabled: isAuthenticated && !!adminToken,
    queryFn: async () => {
      const res = await fetch('/api/admin/products', {
        headers: { 'x-admin-token': adminToken || '' }
      });
      if (!res.ok) throw new Error('Failed to fetch products');
      return res.json();
    },
  });

  const productsList = products ?? [];
  const categoriesList = categories ?? [];

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
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({ title: "تم تحديث المخزون" });
    }
  });

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

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
    enabled: isAuthenticated && !!adminToken,
    queryFn: async () => {
      const res = await fetch('/api/admin/categories', {
        headers: { 'x-admin-token': adminToken || '' }
      });
      if (!res.ok) throw new Error('Failed to fetch categories');
      return res.json();
    },
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
          showReviews: data.showReviews
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.details || 'Failed to create product');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({ title: "تم إضافة المنتج بنجاح" });
      setShowProductForm(false);
      setProductForm(emptyProductForm);
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
        showReviews: data.showReviews
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
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({ title: "تم تحديث المنتج بنجاح" });
      setShowProductForm(false);
      setEditingProduct(null);
      setProductForm(emptyProductForm);
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
      tags: product.tags ? product.tags.join(', ') : ""
    });
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
        sessionStorage.setItem("admin_token", data.token);
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
      <div className="bg-primary text-white p-6">
        <div className="container mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">لوحة تحكم OYO PLAST</h1>
            <p className="text-primary-foreground/80">إدارة الطلبات والمنتجات</p>
          </div>
          <Button
            variant="outline"
            className="bg-white/10 border-white/30 text-white hover:bg-white/20 gap-2"
            onClick={() => {
              window.open('/', '_blank');
            }}
            data-testid="button-experience-as-customer"
          >
            <UserCircle2 className="h-4 w-4" />
            تجربة الموقع كعميل
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-xl">
                <ShoppingBag className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الطلبات</p>
                <p className="text-2xl font-bold">{orders?.length || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-yellow-100 p-3 rounded-xl">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">طلبات معلقة</p>
                <p className="text-2xl font-bold">{pendingOrders}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-xl">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي المبيعات</p>
                <p className="text-2xl font-bold">{formatPrice(totalRevenue)} ر.ي</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-purple-100 p-3 rounded-xl">
                <Package className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">المنتجات</p>
                <p className="text-2xl font-bold">{products?.length || 0}</p>
              </div>
            </CardContent>
          </Card>
        </div>

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
                                    onClick={() => handlePrintDeliveryInvoice(order)}
                                    disabled={loadingItems}
                                    title="طباعة فاتورة التوصيل"
                                    data-testid={`button-admin-print-invoice-${order.id}`}
                                  >
                                    {loadingItems ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Printer className="h-4 w-4" />
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

                      <div className="grid md:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="product-price">السعر بالريال اليمني *</Label>
                          <Input
                            id="product-price"
                            type="number"
                            value={productForm.price}
                            onChange={(e) => setProductForm({...productForm, price: e.target.value})}
                            placeholder="5000"
                            required
                            data-testid="input-product-price"
                          />
                        </div>
                        <div>
                          <Label htmlFor="product-price-sar">السعر بالريال السعودي</Label>
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
                          }}
                        >
                          إلغاء
                        </Button>
                      </div>
                    </form>
                  </div>
                )}

                {productsLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : productsList.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">المنتج</TableHead>
                          <TableHead className="text-right">القسم</TableHead>
                          <TableHead className="text-right">السعر (ر.ي)</TableHead>
                          <TableHead className="text-right">المخزون</TableHead>
                          <TableHead className="text-right">إجراءات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {productsList.map((product) => (
                          <TableRow key={product.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain" />
                                </div>
                                <span className="font-medium">{product.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {categoriesList.find(c => c.id === product.categoryId)?.name || '-'}
                            </TableCell>
                            <TableCell>{formatPrice(product.price)}</TableCell>
                            <TableCell>
                              <Badge variant={product.stock > 10 ? "default" : product.stock > 0 ? "secondary" : "destructive"}>
                                {product.stock > 0 ? `${product.stock} قطعة` : 'نفذ'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button 
                                  size="icon" 
                                  variant="ghost"
                                  onClick={() => openEditProduct(product)}
                                  data-testid={`button-edit-product-${product.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="ghost"
                                  className="text-destructive"
                                  onClick={() => {
                                    if (confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
                                      deleteProductMutation.mutate(product.id);
                                    }
                                  }}
                                  data-testid={`button-delete-product-${product.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-10 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>لا توجد منتجات بعد</p>
                    <Button 
                      className="mt-4 gap-2"
                      onClick={() => setShowProductForm(true)}
                    >
                      <Plus className="h-4 w-4" />
                      إضافة أول منتج
                    </Button>
                  </div>
                )}
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

                {categoriesList.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">القسم</TableHead>
                          <TableHead className="text-right">الرابط</TableHead>
                          <TableHead className="text-right">عدد المنتجات</TableHead>
                          <TableHead className="text-right">الإجراءات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categoriesList.map((category) => (
                          <TableRow key={category.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                                  <img src={category.imageUrl} alt={category.name} className="w-full h-full object-contain" />
                                </div>
                                <span className="font-medium">{category.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>{category.slug}</TableCell>
                            <TableCell>
                              <Badge>
                                {productsList.filter(p => p.categoryId === category.id).length} منتج
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => openEditCategory(category)}
                                  data-testid={`button-edit-category-${category.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => {
                                    if (confirm(`هل أنت متأكد من حذف قسم "${category.name}"؟`)) {
                                      deleteCategoryMutation.mutate(category.id);
                                    }
                                  }}
                                  disabled={deleteCategoryMutation.isPending}
                                  data-testid={`button-delete-category-${category.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-10 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>لا توجد أقسام بعد</p>
                    <Button 
                      className="mt-4 gap-2"
                      onClick={() => setShowCategoryForm(true)}
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
                {productsLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : productsList.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">المنتج</TableHead>
                          <TableHead className="text-right">السعر (ر.ي)</TableHead>
                          <TableHead className="text-right">السعر (ر.س)</TableHead>
                          <TableHead className="text-right">المخزون</TableHead>
                          <TableHead className="text-right">تعديل المخزون</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {productsList.map((product) => (
                          <TableRow key={product.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain" />
                                </div>
                                <span className="font-medium">{product.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>{formatPrice(product.price)}</TableCell>
                            <TableCell>{formatPrice(product.priceSar)}</TableCell>
                            <TableCell>
                              <Badge variant={product.stock > 10 ? "default" : product.stock > 0 ? "secondary" : "destructive"}>
                                {product.stock > 0 ? `${product.stock} قطعة` : 'نفذ'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  min={0}
                                  defaultValue={product.stock}
                                  className="w-20"
                                  onBlur={(e) => {
                                    const newStock = parseInt(e.target.value);
                                    if (newStock !== product.stock) {
                                      updateProductStock.mutate({ productId: product.id, stock: newStock });
                                    }
                                  }}
                                  data-testid={`input-stock-${product.id}`}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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

          <TabsContent value="banners-offers">
            <BannersOffersSection adminToken={adminToken} />
          </TabsContent>

          <TabsContent value="navigation">
            <div className="space-y-4">
              <NavigationSettingsSection adminToken={adminToken} />
              <PrintingProductsSection adminToken={adminToken} />
            </div>
          </TabsContent>

          <TabsContent value="reports">
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="p-6 text-center">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 text-green-600" />
                  <p className="text-sm text-muted-foreground mb-2">إجمالي المبيعات</p>
                  <p className="text-3xl font-bold text-green-600">
                    {formatPrice(salesStats?.totalSales || 0)} ر.ي
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-blue-600" />
                  <p className="text-sm text-muted-foreground mb-2">عدد الطلبات</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {salesStats?.totalOrders || 0}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 text-purple-600" />
                  <p className="text-sm text-muted-foreground mb-2">متوسط قيمة الطلب</p>
                  <p className="text-3xl font-bold text-purple-600">
                    {formatPrice(salesStats?.averageOrderValue || 0)} ر.ي
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>ملخص الطلبات حسب الحالة</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(statusMap).map(([key, value]) => {
                    const count = orders?.filter(o => o.status === key).length || 0;
                    const StatusIcon = value.icon;
                    return (
                      <div key={key} className={`p-4 rounded-lg ${value.color}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <StatusIcon className="h-5 w-5" />
                          <span className="font-medium">{value.label}</span>
                        </div>
                        <p className="text-2xl font-bold">{count}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <div className="space-y-4">
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

        </Tabs>
      </div>

      {selectedOrderForInvoice && (
        <PrintableInvoice
          order={selectedOrderForInvoice}
          orderItems={orderItems}
          isDeliveryInvoice={true}
          onClose={() => {
            setSelectedOrderForInvoice(null);
            setOrderItems([]);
          }}
        />
      )}
    </div>
  );
}
