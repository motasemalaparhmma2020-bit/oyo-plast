import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Edit2, Trash2, Phone, MapPin, Percent, Wallet,
  CheckCircle, XCircle, RefreshCw, Send, DollarSign,
  TrendingUp, ShoppingBag, Users, ChevronRight, BarChart2, Loader2, Package
} from "lucide-react";

interface Supplier {
  id: number;
  name: string;
  phone: string;
  email?: string;
  cities: string[];
  commission_rate: string;
  balance_due: string;
  total_paid: string;
  total_sales: string;
  is_active: boolean;
  notes?: string;
  total_orders?: string;
  unpaid_orders?: string;
  created_at: string;
}

interface SupplierManagementProps {
  adminToken: string | null;
}

const CITIES_PRESET = [
  "صنعاء", "عدن", "تعز", "الحديدة", "إب", "ذمار", "المكلا", "حضرموت",
  "شبوة", "مأرب", "لحج", "أبين", "الضالع", "البيضاء", "الحوف", "ريمة",
  "المحويت", "حجة", "صعدة", "الجوف", "أمانة العاصمة", "سيئون", "زنجبار"
];

function SupplierForm({
  initial,
  onSave,
  isPending,
  onClose,
}: {
  initial?: Partial<Supplier>;
  onSave: (data: any) => void;
  isPending: boolean;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name || "",
    phone: initial?.phone || "",
    email: initial?.email || "",
    cities: initial?.cities || [],
    commissionRate: initial?.commission_rate || "10",
    type: (initial as any)?.type || "distributor",
    notes: initial?.notes || "",
    isActive: initial?.is_active !== false,
    pin: (initial as any)?.pin || "1234",
    // GPS
    lat: (initial as any)?.lat || "",
    lng: (initial as any)?.lng || "",
    serviceRadiusKm: (initial as any)?.service_radius_km || "15",
    province: (initial as any)?.province || "",
    district: (initial as any)?.district || "",
  });
  const [cityInput, setCityInput] = useState("");

  const addCity = (city: string) => {
    const trimmed = city.trim();
    if (trimmed && !form.cities.includes(trimmed)) {
      setForm(f => ({ ...f, cities: [...f.cities, trimmed] }));
    }
    setCityInput("");
  };

  const removeCity = (city: string) =>
    setForm(f => ({ ...f, cities: f.cities.filter(c => c !== city) }));

  const handleSubmit = () => {
    if (!form.name || !form.phone) return;
    onSave({
      ...form,
      commissionRate: Number(form.commissionRate),
      pin: form.pin,
      type: form.type,
      lat: form.lat ? parseFloat(form.lat) : null,
      lng: form.lng ? parseFloat(form.lng) : null,
      serviceRadiusKm: form.serviceRadiusKm ? parseFloat(form.serviceRadiusKm) : 15,
    });
  };

  return (
    <div className="space-y-4 text-right" dir="rtl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">اسم المورد / الشركة *</Label>
          <Input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="محمد الموزع - صنعاء"
            className="mt-1"
            data-testid="input-supplier-name"
          />
        </div>
        <div>
          <Label className="text-xs">رقم واتساب *</Label>
          <Input
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="+967 77XXXXXXX"
            dir="ltr"
            className="mt-1"
            data-testid="input-supplier-phone"
          />
        </div>
        <div>
          <Label className="text-xs">البريد الإلكتروني</Label>
          <Input
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="supplier@example.com"
            dir="ltr"
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">الرمز السري لبوابة المورد 🔑</Label>
          <Input
            value={form.pin}
            onChange={e => setForm(f => ({ ...f, pin: e.target.value }))}
            placeholder="1234"
            dir="ltr"
            className="mt-1 font-mono"
            data-testid="input-supplier-pin"
          />
          <p className="text-xs text-muted-foreground mt-0.5">يستخدمه المورد للدخول لبوابته على /supplier</p>
        </div>
        <div>
          <Label className="text-xs">عمولة المنصة %</Label>
          <div className="flex items-center gap-2 mt-1">
            <Input
              type="number"
              min={0}
              max={100}
              value={form.commissionRate}
              onChange={e => setForm(f => ({ ...f, commissionRate: e.target.value }))}
              dir="ltr"
              className="flex-1"
              data-testid="input-supplier-commission"
            />
            <Percent className="w-4 h-4 text-gray-400 shrink-0" />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            المورد يستلم {100 - Number(form.commissionRate)}% من الطلب
          </p>
        </div>
        <div>
          <Label className="text-xs">نوع الجهة 🏷️</Label>
          <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v }))}>
            <SelectTrigger className="mt-1" data-testid="select-supplier-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="distributor">موزّع (يوصّل للعميل)</SelectItem>
              <SelectItem value="vendor">مورّد (نشتري منه البضاعة)</SelectItem>
              <SelectItem value="both">كلاهما</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-0.5">
            يظهر في "أوامر الشراء" فقط الموردون من نوع <b>vendor</b> أو <b>both</b>
          </p>
        </div>
      </div>

      {/* المدن */}
      <div>
        <Label className="text-xs">المدن / المناطق التي يغطيها</Label>
        <div className="flex gap-2 mt-1">
          <Input
            value={cityInput}
            onChange={e => setCityInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addCity(cityInput))}
            placeholder="اكتب مدينة واضغط Enter..."
            className="flex-1"
          />
          <Button variant="outline" size="sm" onClick={() => addCity(cityInput)} type="button">إضافة</Button>
        </div>
        {/* مدن جاهزة للاختيار */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {CITIES_PRESET.filter(c => !form.cities.includes(c)).map(city => (
            <button
              key={city}
              type="button"
              onClick={() => addCity(city)}
              className="text-xs px-2 py-1 bg-gray-100 hover:bg-primary/10 hover:text-primary rounded-full border transition-colors"
            >
              + {city}
            </button>
          ))}
        </div>
        {/* المدن المختارة */}
        {form.cities.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
            {form.cities.map(city => (
              <span
                key={city}
                className="flex items-center gap-1 text-xs bg-green-600 text-white px-2 py-0.5 rounded-full"
              >
                {city}
                <button onClick={() => removeCity(city)} type="button" className="hover:opacity-70">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── إعدادات GPS / الموقع الجغرافي ── */}
      <div className="border border-green-200 rounded-xl p-3 bg-green-50/40 space-y-3">
        <p className="text-xs font-bold text-green-800 flex items-center gap-1">📍 الموقع الجغرافي (GPS) — اختياري</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">خط العرض (Latitude)</Label>
            <Input
              type="number"
              step="0.00001"
              value={form.lat}
              onChange={e => setForm(f => ({ ...f, lat: e.target.value }))}
              placeholder="15.35472"
              dir="ltr"
              className="mt-1 font-mono text-xs"
              data-testid="input-supplier-lat"
            />
          </div>
          <div>
            <Label className="text-xs">خط الطول (Longitude)</Label>
            <Input
              type="number"
              step="0.00001"
              value={form.lng}
              onChange={e => setForm(f => ({ ...f, lng: e.target.value }))}
              placeholder="44.20667"
              dir="ltr"
              className="mt-1 font-mono text-xs"
              data-testid="input-supplier-lng"
            />
          </div>
          <div>
            <Label className="text-xs">نطاق التغطية (كم)</Label>
            <Input
              type="number"
              min={1}
              max={200}
              value={form.serviceRadiusKm}
              onChange={e => setForm(f => ({ ...f, serviceRadiusKm: e.target.value }))}
              placeholder="15"
              dir="ltr"
              className="mt-1"
              data-testid="input-supplier-radius"
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">الطلبات داخل هذا النطاق تُوجَّه تلقائياً</p>
          </div>
          <div>
            <Label className="text-xs">المحافظة</Label>
            <Input
              value={form.province}
              onChange={e => setForm(f => ({ ...f, province: e.target.value }))}
              placeholder="صنعاء"
              className="mt-1"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">المنطقة / الحي</Label>
          <Input
            value={form.district}
            onChange={e => setForm(f => ({ ...f, district: e.target.value }))}
            placeholder="حدة، الجراف..."
            className="mt-1"
          />
        </div>
        <p className="text-[10px] text-muted-foreground">احصل على الإحداثيات من Google Maps: انقر على الخريطة ← انسخ lat, lng</p>
      </div>

      <div>
        <Label className="text-xs">ملاحظات</Label>
        <Textarea
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="ملاحظات خاصة بهذا المورد..."
          rows={2}
          className="mt-1 resize-none"
        />
      </div>

      {initial?.id && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="supplier-active"
            checked={form.isActive}
            onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
          />
          <Label htmlFor="supplier-active" className="text-sm cursor-pointer">مورد نشط</Label>
        </div>
      )}

      <div className="flex gap-2 justify-end pt-2 border-t">
        <Button variant="outline" onClick={onClose} data-testid="button-supplier-cancel">إلغاء</Button>
        <Button onClick={handleSubmit} disabled={isPending || !form.name || !form.phone} data-testid="button-save-supplier">
          {isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          <span className="mr-1">{initial?.id ? "حفظ التعديلات" : "إضافة المورد"}</span>
        </Button>
      </div>
    </div>
  );
}

function PerformanceDialog({ supplier, adminToken }: { supplier: Supplier; adminToken: string }) {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/suppliers", supplier.id, "performance"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/suppliers/${supplier.id}/performance`, {
        headers: { "x-admin-token": adminToken },
      });
      if (!res.ok) throw new Error("فشل");
      return res.json();
    },
    enabled: open,
    staleTime: 60000,
  });

  const fmt = (n: number | string) => Number(n).toLocaleString("ar-YE");
  const s = data?.stats;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1" data-testid={`button-performance-${supplier.id}`}>
          <BarChart2 className="w-3.5 h-3.5" />
          الأداء
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-primary" />
            أداء المورد — {supplier.name}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : s ? (
          <div className="space-y-4">
            {/* إحصائيات رئيسية */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-blue-700">{s.totalOrders}</p>
                <p className="text-xs text-gray-500">إجمالي الطلبات</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-green-700">{s.deliveredOrders}</p>
                <p className="text-xs text-gray-500">مسلَّمة</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-orange-600">{s.activeOrders}</p>
                <p className="text-xs text-gray-500">جارية</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-red-600">{s.cancelledOrders}</p>
                <p className="text-xs text-gray-500">ملغاة</p>
              </div>
            </div>

            {/* نسبة التسليم */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600">نسبة التسليم</span>
                <span className="font-bold text-green-600">{s.deliveryRate}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div className="h-3 rounded-full bg-green-500" style={{ width: `${s.deliveryRate}%` }} />
              </div>
            </div>

            {/* مالية */}
            <div className="border rounded-lg p-3 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">إجمالي المبيعات</span>
                <span className="font-bold">{fmt(s.totalRevenue)} ر.ي</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">مبالغ مدفوعة</span>
                <span className="font-bold text-green-600">{fmt(s.totalPaid)} ر.ي</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-sm font-medium">مستحق غير مدفوع</span>
                <span className="font-bold text-orange-600">{fmt(s.pendingPayment)} ر.ي</span>
              </div>
            </div>

            {/* أفضل المنتجات */}
            {data.topProducts?.length > 0 && (
              <div>
                <p className="text-sm font-bold mb-2 flex items-center gap-1">
                  <Package className="h-4 w-4" /> أفضل المنتجات
                </p>
                <div className="space-y-1.5">
                  {data.topProducts.map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{i+1}</span>
                        <span className="truncate max-w-[160px]">{p.product_name}</span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="font-medium">{fmt(p.revenue)} ر.ي</span>
                        <span className="text-gray-400 text-xs mr-1">({p.units} وحدة)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* شهري */}
            {data.monthly?.length > 0 && (
              <div>
                <p className="text-sm font-bold mb-2">الأداء الشهري (آخر 6 أشهر)</p>
                <div className="space-y-1.5">
                  {data.monthly.map((m: any) => {
                    const maxRev = Math.max(...data.monthly.map((x: any) => Number(x.revenue)), 1);
                    const w = Math.round((Number(m.revenue) / maxRev) * 100);
                    return (
                      <div key={m.month} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-14 flex-shrink-0">{m.month}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div className="h-2 rounded-full bg-primary" style={{ width: `${w}%` }} />
                        </div>
                        <span className="text-xs font-medium flex-shrink-0">{fmt(m.revenue)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-gray-400 py-6">لا توجد بيانات بعد</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PayDialog({ supplier, adminToken, onDone }: { supplier: Supplier; adminToken: string; onDone: () => void }) {
  const { toast } = useToast();
  const [amount, setAmount] = useState(supplier.balance_due || "");
  const [notes, setNotes] = useState("");
  const [open, setOpen] = useState(false);

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/suppliers/${supplier.id}/pay`, {
        method: "POST",
        headers: { "x-admin-token": adminToken, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), notes }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: `✅ تم تسجيل الدفعة للمورد ${supplier.name}` });
      setOpen(false);
      onDone();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1 text-green-600 border-green-300 hover:bg-green-50">
          <DollarSign className="w-3.5 h-3.5" />
          دفع
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle>تسجيل دفعة — {supplier.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
            <span className="text-gray-500">المستحق له: </span>
            <span className="font-black text-orange-700">{Number(supplier.balance_due || 0).toLocaleString()} ر.ي</span>
          </div>
          <div>
            <Label className="text-xs">المبلغ المدفوع</Label>
            <Input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              dir="ltr"
              className="mt-1"
              data-testid="input-pay-amount"
            />
          </div>
          <div>
            <Label className="text-xs">ملاحظة (اختياري)</Label>
            <Input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="تحويل بنكي، نقداً..."
              className="mt-1"
            />
          </div>
          <Button onClick={() => mutate()} disabled={isPending || !amount || Number(amount) <= 0} className="w-full">
            {isPending ? <RefreshCw className="w-4 h-4 animate-spin ml-2" /> : <CheckCircle className="w-4 h-4 ml-2" />}
            تأكيد الدفع
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SupplierManagement({ adminToken }: SupplierManagementProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Supplier | null>(null);

  const { data: suppliers = [], isLoading, refetch } = useQuery<Supplier[]>({
    queryKey: ["/api/admin/suppliers"],
    queryFn: async () => {
      const res = await fetch("/api/admin/suppliers", {
        headers: { "x-admin-token": adminToken! },
      });
      if (!res.ok) throw new Error("فشل");
      return res.json();
    },
    enabled: !!adminToken,
  });

  const { data: supplierOrders = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/suppliers", selectedSupplier?.id, "orders"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/suppliers/${selectedSupplier!.id}/orders`, {
        headers: { "x-admin-token": adminToken! },
      });
      return res.ok ? res.json() : [];
    },
    enabled: !!selectedSupplier && !!adminToken,
  });

  const { data: supplierPayments = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/suppliers", selectedSupplier?.id, "payments"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/suppliers/${selectedSupplier!.id}/payments`, {
        headers: { "x-admin-token": adminToken! },
      });
      return res.ok ? res.json() : [];
    },
    enabled: !!selectedSupplier && !!adminToken,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/suppliers"] });
    if (selectedSupplier) {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/suppliers", selectedSupplier.id, "orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/suppliers", selectedSupplier.id, "payments"] });
    }
  };

  const { mutate: addSupplier, isPending: isAdding } = useMutation({
    mutationFn: async (data: any) => {
      if (!adminToken) throw new Error("رمز الأدمن مفقود");
      const res = await fetch("/api/admin/suppliers", {
        method: "POST",
        headers: { "x-admin-token": adminToken!, "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => { toast({ title: "✅ تم إضافة المورد" }); setShowAdd(false); invalidate(); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const { mutate: updateSupplier, isPending: isUpdating } = useMutation({
    mutationFn: async (data: any) => {
      if (!adminToken) throw new Error("رمز الأدمن مفقود");
      const res = await fetch(`/api/admin/suppliers/${editSupplier!.id}`, {
        method: "PUT",
        headers: { "x-admin-token": adminToken!, "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => { toast({ title: "✅ تم تعديل المورد" }); setEditSupplier(null); invalidate(); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const { mutate: setActive, isPending: isToggling } = useMutation({
    mutationFn: async ({ supplier, active }: { supplier: Supplier; active: boolean }) => {
      if (!adminToken) throw new Error("رمز الأدمن مفقود");
      const res = await fetch(`/api/admin/suppliers/${supplier.id}`, {
        method: "PUT",
        headers: { "x-admin-token": adminToken!, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: supplier.name,
          phone: supplier.phone,
          email: supplier.email,
          cities: supplier.cities,
          commissionRate: Number(supplier.commission_rate),
          notes: supplier.notes,
          isActive: active,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "فشل");
      return res.json();
    },
    onSuccess: (_d, v) => {
      toast({ title: v.active ? "✅ تم تفعيل المورد" : "تم إيقاف المورد" });
      invalidate();
      if (selectedSupplier) setSelectedSupplier(s => s ? { ...s, is_active: v.active } : s);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const totalBalanceDue = suppliers.reduce((a, s) => a + Number(s.balance_due || 0), 0);
  const totalSales = suppliers.reduce((a, s) => a + Number(s.total_sales || 0), 0);
  const activeCount = suppliers.filter(s => s.is_active).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <RefreshCw className="w-6 h-6 animate-spin ml-2" />
        جاري التحميل...
      </div>
    );
  }

  // صفحة تفاصيل مورد
  if (selectedSupplier) {
    return (
      <div className="space-y-4 max-w-4xl" dir="rtl">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelectedSupplier(null)} className="gap-1">
            <ChevronRight className="w-4 h-4" />
            العودة للموردين
          </Button>
          <ChevronRight className="w-4 h-4 text-gray-300" />
          <span className="font-semibold">{selectedSupplier.name}</span>
        </div>

        {/* ملخص المورد */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "إجمالي المبيعات", value: Number(selectedSupplier.total_sales || 0).toLocaleString() + " ر.ي", icon: <TrendingUp className="w-5 h-5 text-blue-500" />, color: "bg-blue-50 border-blue-200" },
            { label: "مستحق له", value: Number(selectedSupplier.balance_due || 0).toLocaleString() + " ر.ي", icon: <Wallet className="w-5 h-5 text-orange-500" />, color: "bg-orange-50 border-orange-200" },
            { label: "إجمالي ما دُفع", value: Number(selectedSupplier.total_paid || 0).toLocaleString() + " ر.ي", icon: <CheckCircle className="w-5 h-5 text-green-500" />, color: "bg-green-50 border-green-200" },
            { label: "عمولة المنصة", value: `${selectedSupplier.commission_rate}%`, icon: <Percent className="w-5 h-5 text-purple-500" />, color: "bg-purple-50 border-purple-200" },
          ].map((stat, i) => (
            <Card key={i} className={`border ${stat.color}`}>
              <CardContent className="p-3 flex items-center gap-3">
                {stat.icon}
                <div>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                  <p className="font-bold text-sm">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap">
          <PayDialog
            supplier={selectedSupplier}
            adminToken={adminToken!}
            onDone={() => { invalidate(); refetch().then(d => { const updated = (d.data as any)?.find((s: Supplier) => s.id === selectedSupplier.id); if (updated) setSelectedSupplier(updated); }); }}
          />
          <PerformanceDialog supplier={selectedSupplier} adminToken={adminToken!} />
          <Button variant="outline" size="sm" onClick={() => setEditSupplier(selectedSupplier)} className="gap-1">
            <Edit2 className="w-3.5 h-3.5" />
            تعديل
          </Button>
        </div>

        {/* طلبات المورد */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              طلبات هذا المورد ({supplierOrders.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {supplierOrders.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">لا توجد طلبات بعد</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الطلب</TableHead>
                      <TableHead className="text-right">العميل</TableHead>
                      <TableHead className="text-right">المدينة</TableHead>
                      <TableHead className="text-right">الإجمالي</TableHead>
                      <TableHead className="text-right">نصيب المورد</TableHead>
                      <TableHead className="text-right">الدفع</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supplierOrders.map((order: any) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-bold">#{order.id}</TableCell>
                        <TableCell>{order.customer_name || "—"}</TableCell>
                        <TableCell>{order.shipping_city || "—"}</TableCell>
                        <TableCell>{Number(order.total || 0).toLocaleString()} ر.ي</TableCell>
                        <TableCell className="text-green-700 font-semibold">
                          {Number(order.supplier_amount || 0).toLocaleString()} ر.ي
                        </TableCell>
                        <TableCell>
                          {order.supplier_paid
                            ? <Badge className="bg-green-100 text-green-700 text-xs">مدفوع ✓</Badge>
                            : <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">غير مدفوع</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* سجل الدفعات */}
        {supplierPayments.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                سجل الدفعات
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right">ملاحظة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplierPayments.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">{new Date(p.paid_at).toLocaleDateString("ar-YE")}</TableCell>
                      <TableCell className="font-bold text-green-700">{Number(p.amount).toLocaleString()} ر.ي</TableCell>
                      <TableCell className="text-gray-500 text-sm">{p.notes || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* تعديل المورد */}
        {editSupplier && (
          <Dialog open onOpenChange={() => setEditSupplier(null)}>
            <DialogContent className="max-w-2xl" dir="rtl">
              <DialogHeader>
                <DialogTitle>تعديل بيانات المورد</DialogTitle>
              </DialogHeader>
              <SupplierForm
                initial={editSupplier}
                onSave={updateSupplier}
                isPending={isUpdating}
                onClose={() => setEditSupplier(null)}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl" dir="rtl">
      {/* ملخص عام */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-xs text-blue-600">الموردون النشطون</p>
              <p className="text-2xl font-black text-blue-700">{activeCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="p-4 flex items-center gap-3">
            <Wallet className="w-8 h-8 text-orange-500" />
            <div>
              <p className="text-xs text-orange-600">إجمالي المستحق للموردين</p>
              <p className="text-xl font-black text-orange-700">{totalBalanceDue.toLocaleString()} <span className="text-sm">ر.ي</span></p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-xs text-green-600">إجمالي مبيعات الموردين</p>
              <p className="text-xl font-black text-green-700">{totalSales.toLocaleString()} <span className="text-sm">ر.ي</span></p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* زر إضافة + جدول */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          قائمة الموردين
        </h2>
        <Dialog open={showAdd} onOpenChange={setShowAdd} modal={false}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-add-supplier">
              <Plus className="w-4 h-4" />
              إضافة مورد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl" onOpenAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>إضافة مورد جديد</DialogTitle>
            </DialogHeader>
            <SupplierForm
              onSave={addSupplier}
              isPending={isAdding}
              onClose={() => setShowAdd(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {suppliers.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">لا يوجد موردون حتى الآن</p>
            <Button onClick={() => setShowAdd(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              أضف أول مورد
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {suppliers.map(supplier => (
            <Card
              key={supplier.id}
              className={`border-2 transition-all hover:shadow-md cursor-pointer ${supplier.is_active ? "border-gray-200 hover:border-primary/30" : "border-gray-100 opacity-60"}`}
              onClick={() => setSelectedSupplier(supplier)}
              data-testid={`card-supplier-${supplier.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-bold">{supplier.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1" dir="ltr">
                        <Phone className="w-3 h-3" />{supplier.phone}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {supplier.is_active
                      ? <Badge className="bg-green-100 text-green-700 text-xs">نشط</Badge>
                      : <Badge variant="outline" className="text-gray-400 text-xs">موقوف</Badge>}
                  </div>
                </div>

                {/* المدن */}
                {supplier.cities && supplier.cities.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                    {supplier.cities.slice(0, 4).map(city => (
                      <span key={city} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{city}</span>
                    ))}
                    {supplier.cities.length > 4 && (
                      <span className="text-xs text-gray-400">+{supplier.cities.length - 4}</span>
                    )}
                  </div>
                )}

                {/* الأرقام */}
                <div className="grid grid-cols-3 gap-2 text-center border-t pt-3">
                  <div>
                    <p className="text-xs text-gray-400">الطلبات</p>
                    <p className="font-bold text-sm">{Number(supplier.total_orders || 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">العمولة</p>
                    <p className="font-bold text-sm text-purple-600">{supplier.commission_rate}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">المستحق</p>
                    <p className={`font-bold text-sm ${Number(supplier.balance_due) > 0 ? "text-orange-600" : "text-gray-400"}`}>
                      {Number(supplier.balance_due || 0).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* أزرار */}
                <div className="flex gap-2 mt-3 border-t pt-3" onClick={e => e.stopPropagation()}>
                  <PayDialog
                    supplier={supplier}
                    adminToken={adminToken!}
                    onDone={invalidate}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditSupplier(supplier)}
                    className="gap-1"
                    data-testid={`button-edit-supplier-${supplier.id}`}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    تعديل
                  </Button>
                  {supplier.is_active ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeactivateTarget(supplier)}
                      disabled={isToggling}
                      className="gap-1 text-red-500 hover:text-red-600 hover:bg-red-50"
                      data-testid={`button-deactivate-supplier-${supplier.id}`}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      إيقاف
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setActive({ supplier, active: true })}
                      disabled={isToggling}
                      className="gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                      data-testid={`button-activate-supplier-${supplier.id}`}
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      تفعيل
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* تأكيد إيقاف المورد (بديل confirm الأصلي الذي كان يُجمّد الشاشة) */}
      <AlertDialog open={!!deactivateTarget} onOpenChange={o => { if (!o) setDeactivateTarget(null); }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>إيقاف المورد</AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد إيقاف المورد "{deactivateTarget?.name}"؟ لن يظهر في التوزيع، ويمكنك تفعيله لاحقاً بضغطة واحدة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-deactivate">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deactivateTarget) setActive({ supplier: deactivateTarget, active: false }); setDeactivateTarget(null); }}
              className="bg-red-500 hover:bg-red-600"
              data-testid="button-confirm-deactivate"
            >
              إيقاف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* تعديل المورد */}
      {editSupplier && (
        <Dialog open onOpenChange={() => setEditSupplier(null)} modal={false}>
          <DialogContent className="max-w-2xl" dir="rtl" onOpenAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>تعديل بيانات المورد</DialogTitle>
            </DialogHeader>
            <SupplierForm
              initial={editSupplier}
              onSave={updateSupplier}
              isPending={isUpdating}
              onClose={() => setEditSupplier(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
