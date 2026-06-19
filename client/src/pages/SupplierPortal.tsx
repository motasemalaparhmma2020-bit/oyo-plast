import { useState, useEffect, useRef } from "react";
import { ContractGate } from "@/components/ContractGate";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, LogOut, Package, Truck, CheckCircle2,
  MapPin, Phone, DollarSign, ChevronLeft, User,
  Clock, AlertCircle, RefreshCw, Plus, ImageIcon,
  Pencil, Trash2, ShoppingBag, ClipboardList, Wallet,
  Lock, PlayCircle, TrendingUp, Receipt, Palette,
  FileImage, StickyNote, Layers,
} from "lucide-react";

const STORAGE_KEY = "supplier_session";

type SupplierSession = { token: string; supplier: any };

const DELIVERY_STATUS_OPTIONS = [
  { value: "pending",       label: "قيد الانتظار" },
  { value: "picked_up",     label: "استلمته" },
  { value: "in_production", label: "🔄 قيد الإنتاج" },
  { value: "shipped",       label: "في الطريق" },
  { value: "delivered",     label: "تم التسليم ✅" },
  { value: "failed",        label: "فشل التوصيل ❌" },
];

const STATUS_BADGE: Record<string, { label: string; variant: "default"|"secondary"|"destructive"|"outline" }> = {
  pending:    { label: "جديد",           variant: "secondary" },
  confirmed:  { label: "مؤكد",           variant: "default" },
  preparing:  { label: "جاري التجهيز",   variant: "secondary" },
  shipped:    { label: "تم الشحن",       variant: "default" },
  delivered:  { label: "تم التسليم",     variant: "default" },
  cancelled:  { label: "ملغي",           variant: "destructive" },
};

const DELIVERY_BADGE: Record<string, string> = {
  pending:       "bg-gray-100 text-gray-600",
  picked_up:     "bg-blue-100 text-blue-700",
  in_production: "bg-amber-100 text-amber-700",
  shipped:       "bg-indigo-100 text-indigo-700",
  delivered:     "bg-green-100 text-green-700",
  failed:        "bg-red-100 text-red-700",
};

const DELIVERY_LABEL: Record<string, string> = {
  pending:       "قيد الانتظار",
  picked_up:     "استلمته",
  in_production: "🔄 قيد الإنتاج",
  shipped:       "في الطريق",
  delivered:     "تم التسليم",
  failed:        "فشل التوصيل",
};

function getAuthHeaders(session: SupplierSession) {
  return {
    "Content-Type": "application/json",
    "x-supplier-token": session.token,
    "x-supplier-id": String(session.supplier.id),
  };
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("ar-YE", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

// ── صفحة تسجيل الدخول ─────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (s: SupplierSession) => void }) {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!phone || !pin) { setError("أدخل رقم الهاتف والرمز"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/supplier/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, pin }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "بيانات خاطئة"); return; }
      const session: SupplierSession = { token: data.token, supplier: data.supplier };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      onLogin(session);
    } catch {
      setError("حدث خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center px-4" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 rounded-2xl mb-4">
            <Truck className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">بوابة الموردين</h1>
          <p className="text-slate-400 text-sm mt-1">أويو بلاست — OYO Plast</p>
        </div>

        <Card className="border-0 shadow-2xl">
          <CardContent className="p-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-1.5 block">رقم الهاتف</Label>
                <Input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+967..."
                  inputMode="tel"
                  data-testid="input-supplier-phone"
                  className="h-11 text-right"
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-1.5 block">الرمز السري</Label>
                <Input
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  type="password"
                  placeholder="أدخل الرمز السري"
                  inputMode="numeric"
                  data-testid="input-supplier-pin"
                  className="h-11 text-right"
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg p-2.5" data-testid="text-login-error">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full h-11 font-bold" disabled={loading} data-testid="button-supplier-login">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "تسجيل الدخول"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-slate-500 text-xs text-center mt-4">
          للحصول على بيانات الدخول تواصل مع إدارة المتجر
        </p>
      </div>
    </div>
  );
}

// ── تفاصيل طلب ─────────────────────────────────────────────────────────────────
function OrderDetailDialog({
  order, session, open, onClose, onUpdated,
}: {
  order: any; session: SupplierSession; open: boolean; onClose: () => void; onUpdated: () => void;
}) {
  const { toast } = useToast();
  const [deliveryStatus, setDeliveryStatus] = useState(order?.delivery_status || "pending");
  const [updating, setUpdating] = useState(false);

  const { data: items, isLoading: itemsLoading } = useQuery<any[]>({
    queryKey: ["/api/supplier/orders", order?.id, "items"],
    enabled: !!order && open,
    queryFn: async () => {
      const res = await fetch(`/api/supplier/orders/${order.id}/items`, {
        headers: getAuthHeaders(session),
      });
      if (!res.ok) throw new Error("فشل");
      return res.json();
    },
  });

  useEffect(() => {
    if (order) setDeliveryStatus(order.delivery_status || "pending");
  }, [order]);

  async function handleUpdateStatus() {
    setUpdating(true);
    try {
      const res = await fetch(`/api/supplier/orders/${order.id}/delivery`, {
        method: "PUT",
        headers: getAuthHeaders(session),
        body: JSON.stringify({ deliveryStatus }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.message, variant: "destructive" }); return; }
      toast({ title: "تم تحديث الحالة بنجاح" });
      onUpdated();
      onClose();
    } catch {
      toast({ title: "حدث خطأ", variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  }

  if (!order) return null;
  const currency = order.currency || "ر.ي";

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>طلب #{order.id}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* بيانات العميل */}
          <Card className="bg-gray-50 border-0">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-500" />
                <span className="font-medium text-sm">{order.customer_name || "—"}</span>
              </div>
              {order.customer_phone ? (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-500" />
                  <a href={`tel:${order.customer_phone}`} className="text-sm text-primary font-medium">{order.customer_phone}</a>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  <Lock className="h-4 w-4" />
                  <span className="text-xs">رقم العميل وعنوانه الكامل يظهران بعد تغيير الحالة إلى "استلمته"</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-500" />
                <span className="text-sm">{order.shipping_city}{order.shipping_address ? ` — ${order.shipping_address}` : ""}</span>
              </div>
            </CardContent>
          </Card>

          {/* المنتجات */}
          <div>
            <p className="text-xs font-bold text-gray-500 mb-2 uppercase">المنتجات</p>
            {itemsLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
            ) : (
              <div className="space-y-3">
                {(items || []).map((item: any, i: number) => {
                  const dOpts = item.designOptions
                    ? (typeof item.designOptions === "string" ? JSON.parse(item.designOptions) : item.designOptions)
                    : null;
                  const hasPrinting = item.customPrinting || item.printColorCount > 0 || dOpts;
                  return (
                    <div key={i} className="bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                      {/* صف المنتج */}
                      <div className="flex items-center gap-3 p-2.5">
                        {(item.productImage || item.product_image) && (
                          <img src={item.productImage || item.product_image} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{item.productName || item.product_name}</p>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            <span className="text-xs text-gray-500">× {item.quantity}</span>
                            {item.selectedSize && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 rounded-full">مقاس: {item.selectedSize}</span>}
                            {item.selectedColor && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 rounded-full">لون: {item.selectedColor}</span>}
                          </div>
                        </div>
                        <span className="text-sm font-bold whitespace-nowrap text-green-700">{Number(item.price || 0).toLocaleString()} {currency}</span>
                      </div>

                      {/* ── تفاصيل الطباعة والتصميم ── */}
                      {hasPrinting && (
                        <div className="border-t border-dashed border-purple-200 bg-purple-50/60 px-3 py-2.5 space-y-2">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Palette className="h-3.5 w-3.5 text-purple-600" />
                            <span className="text-xs font-bold text-purple-700">تفاصيل الطباعة</span>
                          </div>

                          {/* ألوان الطباعة */}
                          {item.printColorCount > 0 && (
                            <div className="flex items-start gap-2">
                              <Layers className="h-3.5 w-3.5 text-purple-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="text-[11px] font-semibold text-purple-700">{item.printColorCount} لون طباعة: </span>
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {[item.printColor1, item.printColor2, item.printColor3].filter(Boolean).map((c: string, ci: number) => (
                                    <span key={ci} className="text-[11px] bg-white border border-purple-200 text-purple-800 px-1.5 py-0.5 rounded-full font-medium">{c}</span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* لون الكيس */}
                          {(item.selectedBagColor || dOpts?.bagColor) && (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-semibold text-purple-700">🎨 لون الكيس:</span>
                              <span className="text-[11px] bg-white border border-purple-200 text-purple-800 px-2 py-0.5 rounded-full font-medium">
                                {(item.selectedBagColor || dOpts?.bagColor?.name || dOpts?.bagColor) as string}
                              </span>
                            </div>
                          )}

                          {/* عدد الألوان والأوجه من design_options */}
                          {dOpts && (dOpts.colors > 0 || dOpts.sides > 0) && (
                            <div className="flex items-center gap-3 text-[11px] text-purple-800">
                              {dOpts.colors > 0 && <span className="bg-white border border-purple-200 px-1.5 py-0.5 rounded-full font-semibold">{dOpts.colors} لون</span>}
                              {dOpts.sides > 0 && <span className="bg-white border border-purple-200 px-1.5 py-0.5 rounded-full font-semibold">{dOpts.sides} وجه</span>}
                              {dOpts.designFee > 0 && <span className="bg-white border border-purple-200 px-1.5 py-0.5 rounded-full font-semibold">رسم تصميم: {dOpts.designFee}</span>}
                            </div>
                          )}

                          {/* موضع الشعار */}
                          {dOpts?.logoPosition && (
                            <div className="text-[11px] text-purple-700 bg-white border border-purple-200 rounded-lg px-2 py-1.5">
                              📍 <span className="font-semibold">موضع الشعار:</span> يسار {Math.round(dOpts.logoPosition.x)}% · أعلى {Math.round(dOpts.logoPosition.y)}% · حجم {Math.round(dOpts.logoPosition.width)}%
                            </div>
                          )}

                          {/* ملف التصميم */}
                          {item.designFileUrl && item.designFileUrl !== "🔒 يظهر عند الاستلام" && (
                            <a href={item.designFileUrl} target="_blank" rel="noreferrer"
                               className="flex items-center gap-1.5 text-[11px] font-bold text-blue-700 hover:text-blue-800 bg-white border border-blue-200 rounded-lg px-2 py-1.5 w-fit"
                               data-testid={`link-design-file-${i}`}>
                              <FileImage className="h-3.5 w-3.5" />
                              عرض ملف التصميم
                            </a>
                          )}
                          {item.designFileUrl === "🔒 يظهر عند الاستلام" && (
                            <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                              <Lock className="h-3 w-3" />
                              ملف التصميم يظهر عند استلام الطلب
                            </div>
                          )}

                          {/* ملاحظات التصميم */}
                          {item.designNotes && item.designNotes !== "🔒 يظهر عند الاستلام" && (
                            <div className="flex items-start gap-1.5 bg-white border border-purple-200 rounded-lg px-2 py-1.5">
                              <StickyNote className="h-3.5 w-3.5 text-purple-500 mt-0.5 flex-shrink-0" />
                              <p className="text-[11px] text-purple-900">{item.designNotes}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* الإجمالي */}
          <div className="flex justify-between items-center bg-primary/5 rounded-lg px-4 py-3">
            <span className="text-sm font-medium">إجمالي التحصيل</span>
            <span className="text-lg font-bold text-primary">{Number(order.total).toLocaleString()} {currency}</span>
          </div>

          {/* تحديث حالة التوصيل */}
          <div>
            <p className="text-xs font-bold text-gray-500 mb-2 uppercase">تحديث حالة التوصيل</p>
            <Select value={deliveryStatus} onValueChange={setDeliveryStatus} dir="rtl">
              <SelectTrigger className="h-11" data-testid="select-delivery-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DELIVERY_STATUS_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleUpdateStatus} className="w-full h-11 font-bold" disabled={updating} data-testid="button-update-delivery">
            {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ التحديث"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── لوحة الطلبات ──────────────────────────────────────────────────────────────
// ── تبويب منتجات المورد ────────────────────────────────────────────────────────
const PRODUCT_STATUS: Record<string, { label: string; color: string }> = {
  pending:  { label: "قيد المراجعة", color: "bg-yellow-100 text-yellow-800" },
  approved: { label: "مقبول ✅",    color: "bg-green-100 text-green-800" },
  rejected: { label: "مرفوض ❌",   color: "bg-red-100 text-red-800" },
};

function SupplierProductsTab({ session }: { session: SupplierSession }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<any | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", price: "", stock: "0",
    categoryId: "", imageUrl: "",
  });

  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: products = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/supplier/products"],
    queryFn: async () => {
      const res = await fetch("/api/supplier/products", {
        headers: getAuthHeaders(session),
      });
      if (!res.ok) throw new Error("فشل");
      return res.json();
    },
  });

  function resetForm() {
    setForm({ name: "", description: "", price: "", stock: "0", categoryId: "", imageUrl: "" });
    setEditProduct(null);
    setShowForm(false);
  }

  function openEdit(p: any) {
    setEditProduct(p);
    setForm({
      name: p.name || "",
      description: p.description || "",
      price: String(p.price || ""),
      stock: String(p.stock || 0),
      categoryId: String(p.category_id || ""),
      imageUrl: p.image_url || "",
    });
    setShowForm(true);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxMb = 10;
    if (file.size > maxMb * 1024 * 1024) {
      toast({ title: "الصورة كبيرة جداً", description: `الحد الأقصى ${maxMb} ميجابايت`, variant: "destructive" });
      return;
    }
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/supplier/upload", {
        method: "POST",
        headers: {
          "x-supplier-token": session.token,
          "x-supplier-id": String(session.supplier.id),
        },
        body: formData,
      });
      if (!res.ok) throw new Error("فشل رفع الصورة");
      const data = await res.json();
      setForm(f => ({ ...f, imageUrl: data.imageUrl }));
      toast({ title: "تم رفع الصورة ✅", description: "الصورة ضُغطت تلقائياً للجودة المثالية" });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name || !form.price) throw new Error("الاسم والسعر مطلوبان");
      const url = editProduct
        ? `/api/supplier/products/${editProduct.id}`
        : "/api/supplier/products";
      const method = editProduct ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { ...getAuthHeaders(session), "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          price: Number(form.price),
          stock: Number(form.stock),
          categoryId: form.categoryId ? Number(form.categoryId) : null,
          imageUrl: form.imageUrl || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "فشل");
      return data;
    },
    onSuccess: () => {
      toast({ title: editProduct ? "تم التعديل ✅" : "تم إرسال المنتج ✅", description: editProduct ? "تم تعديل المنتج وإعادة إرساله للمراجعة" : "سيراجعه الأدمن قريباً" });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/products"] });
      resetForm();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/supplier/products/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(session),
      });
      if (!res.ok) throw new Error("فشل الحذف");
    },
    onSuccess: () => {
      toast({ title: "تم الحذف" });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/products"] });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      {/* زر إضافة منتج */}
      <Button
        className="w-full"
        onClick={() => { resetForm(); setShowForm(true); }}
        data-testid="button-add-product"
      >
        <Plus className="h-4 w-4 ml-1" /> إضافة منتج جديد
      </Button>

      {/* قائمة المنتجات */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">لم تُضف أي منتجات بعد</p>
          <p className="text-xs mt-1">اضغط "إضافة منتج جديد" لإضافة منتجك الأول</p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((p: any) => {
            const st = PRODUCT_STATUS[p.product_status] ?? PRODUCT_STATUS.pending;
            const canEdit = p.product_status !== "approved";
            return (
              <Card key={p.id} className="border-0 shadow-sm" data-testid={`supplier-product-${p.id}`}>
                <CardContent className="p-3 flex gap-3">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <ImageIcon className="h-5 w-5 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <p className="font-bold text-sm line-clamp-1">{p.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${st.color}`}>
                        {st.label}
                      </span>
                    </div>
                    <p className="text-primary font-bold text-sm mt-0.5">{Number(p.price).toLocaleString()} ر.ي</p>
                    {p.admin_notes && (
                      <p className="text-xs text-red-500 mt-1 bg-red-50 rounded px-2 py-1">
                        ملاحظة الإدارة: {p.admin_notes}
                      </p>
                    )}
                    <div className="flex gap-2 mt-2">
                      {canEdit && (
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => openEdit(p)} data-testid={`button-edit-${p.id}`}>
                          <Pencil className="h-3 w-3 ml-1" /> تعديل
                        </Button>
                      )}
                      {canEdit && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs px-2 text-red-500" onClick={() => deleteMutation.mutate(p.id)} data-testid={`button-delete-${p.id}`}>
                          <Trash2 className="h-3 w-3 ml-1" /> حذف
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ─── نموذج إضافة/تعديل منتج ─── */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) resetForm(); }}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">{editProduct ? "تعديل المنتج" : "إضافة منتج جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* رفع الصورة */}
            <div>
              <Label className="text-xs">صورة المنتج</Label>
              <div className="mt-1 flex gap-2 items-center">
                {form.imageUrl ? (
                  <img src={form.imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center">
                    <ImageIcon className="h-6 w-6 text-gray-400" />
                  </div>
                )}
                <div className="flex-1">
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} data-testid="input-image-file" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    data-testid="button-upload-image"
                  >
                    {uploadingImage ? <Loader2 className="h-3 w-3 animate-spin ml-1" /> : <ImageIcon className="h-3 w-3 ml-1" />}
                    {uploadingImage ? "جاري الرفع..." : "رفع صورة (حتى 10 ميجا)"}
                  </Button>
                  <p className="text-xs text-gray-400 mt-1">تُضغط تلقائياً — لا داعي لتصغيرها مسبقاً</p>
                </div>
              </div>
            </div>
            <div>
              <Label className="text-xs">اسم المنتج *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="مثال: أكياس علاقي رقم 10" data-testid="input-product-name" />
            </div>
            <div>
              <Label className="text-xs">الوصف</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="وصف مختصر للمنتج..." data-testid="input-product-desc" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">السعر (ر.ي) *</Label>
                <Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="1500" data-testid="input-product-price" />
              </div>
              <div>
                <Label className="text-xs">المخزون</Label>
                <Input type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} placeholder="100" data-testid="input-product-stock" />
              </div>
            </div>
            <div>
              <Label className="text-xs">القسم</Label>
              <Select value={form.categoryId} onValueChange={v => setForm(f => ({ ...f, categoryId: v }))}>
                <SelectTrigger data-testid="select-category">
                  <SelectValue placeholder="اختر القسم..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">بدون قسم</SelectItem>
                  {categories.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-300 flex gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>المنتج سيُرسل للإدارة للمراجعة قبل نشره في المتجر. لا تضع شعارك أو اسمك التجاري على الصور.</span>
            </div>
            <Button
              className="w-full"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              data-testid="button-save-product"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <CheckCircle2 className="h-4 w-4 ml-1" />}
              {editProduct ? "حفظ التعديلات" : "إرسال للمراجعة"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── زر "بدء التجهيز" (يلتزم المورد بالطلب ويُعلم العميل) ──────────────────────
function StartPreparingButton({
  orderId, session, onDone,
}: { orderId: number; session: SupplierSession; onDone: () => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/supplier/orders/${orderId}/start-preparing`, {
        method: "PUT",
        headers: getAuthHeaders(session),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: data.message || "فشل", variant: "destructive" });
        return;
      }
      toast({ title: "✅ بدأت تجهيز الطلب — تم إعلام العميل" });
      onDone();
    } catch {
      toast({ title: "خطأ في الشبكة", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      className="w-full mt-3 h-9 bg-green-600 hover:bg-green-700 text-white font-bold text-xs"
      data-testid={`button-start-preparing-${orderId}`}
    >
      {loading
        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
        : <><PlayCircle className="h-3.5 w-3.5 ml-1" /> بدء التجهيز</>}
    </Button>
  );
}

// ── تبويب المالية للمورد ──────────────────────────────────────────────────────
function SupplierFinanceTab({ session }: { session: SupplierSession }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/supplier/finance"],
    queryFn: async () => {
      const res = await fetch("/api/supplier/finance", { headers: getAuthHeaders(session) });
      if (!res.ok) throw new Error("فشل");
      return res.json();
    },
    refetchInterval: 60000,
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const fmt = (n: any) => Number(n || 0).toLocaleString("ar-YE");
  const commissionRate = Number(data?.commissionRate || 0);

  return (
    <div className="space-y-4">
      {/* صافي المستحق + هذا الشهر */}
      <Card className="border-0 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="h-4 w-4" />
            <p className="text-xs opacity-90">الرصيد المستحق لك</p>
          </div>
          <p className="text-3xl font-extrabold" data-testid="text-balance-due">{fmt(data?.balanceDue)}</p>
          <p className="text-xs opacity-80 mt-1">ر.ي · سيُسوّى عبر إدارة المنصة</p>
          <a href="/supplier/statement" data-testid="link-statement">
            <button className="mt-3 w-full bg-white/20 hover:bg-white/30 text-white text-sm font-bold py-2 rounded-lg backdrop-blur transition">
              📊 عرض كشف الحساب التفصيلي
            </button>
          </a>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1 text-gray-500">
              <TrendingUp className="h-3.5 w-3.5" />
              <p className="text-xs">هذا الشهر</p>
            </div>
            <p className="text-lg font-bold text-primary" data-testid="text-this-month">{fmt(data?.this_month)}</p>
            <p className="text-[10px] text-gray-400">ر.ي</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1 text-gray-500">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <p className="text-xs">إجمالي مُسلَّم</p>
            </div>
            <p className="text-lg font-bold text-green-600" data-testid="text-delivered-count">{data?.delivered_count || 0}</p>
            <p className="text-[10px] text-gray-400">طلب</p>
          </CardContent>
        </Card>
      </div>

      {/* تفاصيل الحسابات */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Receipt className="h-4 w-4 text-primary" />
            <p className="font-bold text-sm">تفاصيل التسوية</p>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-600">إجمالي المبيعات (مُسلَّمة)</span>
            <span className="font-bold" data-testid="text-gross-sales">{fmt(data?.gross_sales)} ر.ي</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-600">عمولة المنصة ({commissionRate}%)</span>
            <span className="font-bold text-red-600" data-testid="text-commission-total">− {fmt(data?.commission_total)} ر.ي</span>
          </div>

          <div className="h-px bg-gray-100" />

          <div className="flex justify-between text-sm">
            <span className="text-gray-600">إجمالي مستحقاتك</span>
            <span className="font-bold text-emerald-700" data-testid="text-earned-total">{fmt(data?.earned_total)} ر.ي</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-600">تم دفعه إليك</span>
            <span className="font-bold" data-testid="text-total-paid">{fmt(data?.totalPaid)} ر.ي</span>
          </div>

          <div className="flex justify-between text-base bg-emerald-50 rounded-lg px-3 py-2 -mx-1">
            <span className="font-bold text-emerald-800">الرصيد المتبقي</span>
            <span className="font-extrabold text-emerald-700">{fmt(data?.balanceDue)} ر.ي</span>
          </div>
        </CardContent>
      </Card>

      {/* الطلبات المعلّقة */}
      <Card className="border-0 shadow-sm bg-amber-50">
        <CardContent className="p-3 flex items-center gap-3">
          <Clock className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-amber-800">طلبات قيد التوصيل</p>
            <p className="text-sm font-bold text-amber-900">{data?.pending_count || 0} طلب — تُحتسب بعد التسليم</p>
          </div>
        </CardContent>
      </Card>

      <p className="text-[11px] text-center text-gray-400 pt-2">
        التسوية تتم يدوياً عبر إدارة المنصة. للاستفسار اتصل بالدعم.
      </p>
    </div>
  );
}

function Dashboard({ session, onLogout }: { session: SupplierSession; onLogout: () => void }) {
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [filter, setFilter] = useState<"all" | "active" | "delivered">("active");
  const [activeTab, setActiveTab] = useState<"orders" | "products" | "finance">("orders");
  const queryClient = useQueryClient();

  const { data: supplierInfo } = useQuery<any>({
    queryKey: ["/api/supplier/me"],
    queryFn: async () => {
      const res = await fetch("/api/supplier/me", { headers: getAuthHeaders(session) });
      if (!res.ok) throw new Error("فشل");
      return res.json();
    },
  });

  const { data: orders = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/supplier/orders"],
    queryFn: async () => {
      const res = await fetch("/api/supplier/orders", { headers: getAuthHeaders(session) });
      if (!res.ok) throw new Error("فشل");
      return res.json();
    },
    refetchInterval: 60000,
  });

  const filteredOrders = orders.filter(o => {
    if (filter === "active") return o.delivery_status !== "delivered" && o.delivery_status !== "failed" && o.status !== "cancelled";
    if (filter === "delivered") return o.delivery_status === "delivered" || o.delivery_status === "failed";
    return true;
  });

  const totalActive = orders.filter(o => o.delivery_status !== "delivered" && o.delivery_status !== "failed" && o.status !== "cancelled").length;
  const totalDelivered = orders.filter(o => o.delivery_status === "delivered").length;
  const totalAmount = orders.reduce((sum, o) => sum + (Number(o.supplier_amount) || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center">
              <Truck className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">{session.supplier.name}</p>
              <p className="text-xs text-gray-500">بوابة الموردين</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => refetch()} data-testid="button-refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onLogout} data-testid="button-logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* Tab Navigation */}
        <div className="flex border-t">
          <button
            onClick={() => setActiveTab("orders")}
            data-testid="tab-orders"
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors
              ${activeTab === "orders" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-gray-500 hover:text-gray-700"}`}
          >
            <ClipboardList className="h-4 w-4" />
            الطلبات
          </button>
          <button
            onClick={() => setActiveTab("products")}
            data-testid="tab-products"
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors
              ${activeTab === "products" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-gray-500 hover:text-gray-700"}`}
          >
            <ShoppingBag className="h-4 w-4" />
            منتجاتي
          </button>
          <button
            onClick={() => setActiveTab("finance")}
            data-testid="tab-finance"
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors
              ${activeTab === "finance" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-gray-500 hover:text-gray-700"}`}
          >
            <Wallet className="h-4 w-4" />
            المالية
          </button>
        </div>
      </header>

      <div className="px-4 py-4 space-y-4 max-w-xl mx-auto">

        {/* ─── تبويب المنتجات ─── */}
        {activeTab === "products" && <SupplierProductsTab session={session} />}

        {/* ─── تبويب المالية ─── */}
        {activeTab === "finance" && <SupplierFinanceTab session={session} />}

        {/* ─── تبويب الطلبات ─── */}
        {activeTab === "orders" && <>

        {/* إحصائيات */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-orange-500">{totalActive}</p>
              <p className="text-xs text-gray-500 mt-0.5">قيد التوصيل</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{totalDelivered}</p>
              <p className="text-xs text-gray-500 mt-0.5">تم التسليم</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-primary">{totalAmount.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-0.5">إجمالي ر.ي</p>
            </CardContent>
          </Card>
        </div>

        {/* فلاتر */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { key: "active",    label: `نشط (${totalActive})` },
            { key: "all",       label: `الكل (${orders.length})` },
            { key: "delivered", label: `مسلَّم (${totalDelivered})` },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as any)}
              data-testid={`button-filter-${f.key}`}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex-shrink-0
                ${filter === f.key ? "bg-primary text-white shadow-sm" : "bg-white text-gray-600 border"}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* قائمة الطلبات */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">لا توجد طلبات</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order: any) => {
              const ds = order.delivery_status || "pending";
              const masked = !!order._masked;
              const canStart = (order.status === "pending" || order.status === "confirmed");
              return (
                <Card
                  key={order.id}
                  className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedOrder(order)}
                  data-testid={`card-order-${order.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-sm text-primary">#{order.id}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DELIVERY_BADGE[ds] || "bg-gray-100 text-gray-600"}`}>
                            {DELIVERY_LABEL[ds] || ds}
                          </span>
                          {masked && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-0.5" title="تظهر التفاصيل عند الاستلام">
                              <Lock className="h-2.5 w-2.5" />
                              مقفل
                            </span>
                          )}
                        </div>
                        <p className="font-medium text-sm truncate">{order.customer_name || "—"}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 text-gray-400" />
                          <span className="text-xs text-gray-500 truncate">
                            {order.shipping_city}{order.shipping_address ? ` — ${order.shipping_address}` : ""}
                          </span>
                        </div>
                      </div>
                      <div className="text-left flex-shrink-0">
                        <p className="font-bold text-base text-green-700">{Number(order.total).toLocaleString()}</p>
                        <p className="text-xs text-gray-400">{order.currency || "ر.ي"}</p>
                        <p className="text-xs text-gray-400 mt-1">{formatDate(order.created_at)}</p>
                      </div>
                    </div>

                    {/* زر بدء التجهيز (يظهر فقط للطلبات الجديدة/المؤكدة) */}
                    {canStart && (
                      <StartPreparingButton
                        orderId={order.id}
                        session={session}
                        onDone={() => queryClient.invalidateQueries({ queryKey: ["/api/supplier/orders"] })}
                      />
                    )}

                    <div className="flex items-center justify-between mt-3 pt-2 border-t">
                      {order.customer_phone ? (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-gray-400" />
                          <a
                            href={`tel:${order.customer_phone}`}
                            className="text-xs text-primary font-medium"
                            onClick={e => e.stopPropagation()}
                            data-testid={`link-phone-${order.id}`}
                          >
                            {order.customer_phone}
                          </a>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <Lock className="h-3 w-3" />
                          <span>الهاتف يظهر عند الاستلام</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <span>التفاصيل</span>
                        <ChevronLeft className="h-3 w-3" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        </>}
      </div>

      <OrderDetailDialog
        order={selectedOrder}
        session={session}
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onUpdated={() => queryClient.invalidateQueries({ queryKey: ["/api/supplier/orders"] })}
      />
    </div>
  );
}

// ── الصفحة الرئيسية ───────────────────────────────────────────────────────────
export default function SupplierPortal() {
  const [session, setSession] = useState<SupplierSession | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  function handleLogin(s: SupplierSession) {
    setSession(s);
  }

  function handleLogout() {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }

  if (!session) return <LoginScreen onLogin={handleLogin} />;

  return (
    <ContractGate
      contractType="supplier"
      partyId={String(session.supplier.id)}
      partyName={session.supplier.name || session.supplier.business_name || "المورد"}
      partyRole="supplier"
      onAccepted={() => {}}
    >
      <Dashboard session={session} onLogout={handleLogout} />
    </ContractGate>
  );
}
