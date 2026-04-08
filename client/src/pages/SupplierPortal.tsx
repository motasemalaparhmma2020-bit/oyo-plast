import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Clock, AlertCircle, RefreshCw,
} from "lucide-react";

const STORAGE_KEY = "supplier_session";

type SupplierSession = { token: string; supplier: any };

const DELIVERY_STATUS_OPTIONS = [
  { value: "pending",   label: "قيد الانتظار" },
  { value: "picked_up", label: "استلمته" },
  { value: "shipped",   label: "في الطريق" },
  { value: "delivered", label: "تم التسليم ✅" },
  { value: "failed",    label: "فشل التوصيل ❌" },
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
  pending:    "bg-gray-100 text-gray-600",
  picked_up:  "bg-blue-100 text-blue-700",
  shipped:    "bg-indigo-100 text-indigo-700",
  delivered:  "bg-green-100 text-green-700",
  failed:     "bg-red-100 text-red-700",
};

const DELIVERY_LABEL: Record<string, string> = {
  pending:    "قيد الانتظار",
  picked_up:  "استلمته",
  shipped:    "في الطريق",
  delivered:  "تم التسليم",
  failed:     "فشل التوصيل",
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
                <span className="font-medium text-sm">{order.customer_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-500" />
                <a href={`tel:${order.customer_phone}`} className="text-sm text-primary font-medium">{order.customer_phone}</a>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-500" />
                <span className="text-sm">{order.shipping_city} — {order.shipping_address}</span>
              </div>
            </CardContent>
          </Card>

          {/* المنتجات */}
          <div>
            <p className="text-xs font-bold text-gray-500 mb-2 uppercase">المنتجات</p>
            {itemsLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
            ) : (
              <div className="space-y-2">
                {(items || []).map((item: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg p-2.5">
                    {item.product_image && (
                      <img src={item.product_image} alt="" className="w-10 h-10 rounded object-cover" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.product_name || item.product_name_db}</p>
                      <p className="text-xs text-gray-500">× {item.quantity}</p>
                    </div>
                    <span className="text-sm font-bold whitespace-nowrap">{Number(item.price || 0).toLocaleString()} {currency}</span>
                  </div>
                ))}
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
function Dashboard({ session, onLogout }: { session: SupplierSession; onLogout: () => void }) {
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [filter, setFilter] = useState<"all" | "active" | "delivered">("active");
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
      </header>

      <div className="px-4 py-4 space-y-4 max-w-xl mx-auto">

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
                        </div>
                        <p className="font-medium text-sm truncate">{order.customer_name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 text-gray-400" />
                          <span className="text-xs text-gray-500 truncate">{order.shipping_city} — {order.shipping_address}</span>
                        </div>
                      </div>
                      <div className="text-left flex-shrink-0">
                        <p className="font-bold text-base text-green-700">{Number(order.total).toLocaleString()}</p>
                        <p className="text-xs text-gray-400">{order.currency || "ر.ي"}</p>
                        <p className="text-xs text-gray-400 mt-1">{formatDate(order.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-2 border-t">
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-gray-400" />
                        <a
                          href={`tel:${order.customer_phone}`}
                          className="text-xs text-primary font-medium"
                          onClick={e => e.stopPropagation()}
                        >
                          {order.customer_phone}
                        </a>
                      </div>
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
  return <Dashboard session={session} onLogout={handleLogout} />;
}
