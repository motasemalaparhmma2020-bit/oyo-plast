import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Package, Truck, CheckCircle, XCircle, Clock, DollarSign,
  LogOut, User, AlertCircle, RefreshCw, Phone, MapPin,
  TrendingUp, ShoppingBag, Banknote, BarChart2
} from "lucide-react";

const orderStatusMap: Record<string, { label: string; color: string; icon: any }> = {
  pending:      { label: "قيد الانتظار",  color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: Clock },
  processing:   { label: "قيد التجهيز",   color: "bg-orange-100 text-orange-800 border-orange-200", icon: Package },
  shipped:      { label: "تم الشحن",       color: "bg-indigo-100 text-indigo-800 border-indigo-200", icon: Truck },
  delivered:    { label: "تم التوصيل",     color: "bg-teal-100 text-teal-800 border-teal-200",   icon: CheckCircle },
  completed:    { label: "مكتمل",           color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle },
  cancelled:    { label: "ملغي",            color: "bg-red-100 text-red-800 border-red-200",     icon: XCircle },
};

const paymentStatusMap: Record<string, { label: string; color: string }> = {
  unpaid:        { label: "لم يُحصَّل",        color: "bg-red-100 text-red-700" },
  cod_collected: { label: "تم التحصيل (كاش)", color: "bg-green-100 text-green-700" },
  transferred:   { label: "محوّل",             color: "bg-blue-100 text-blue-700" },
  partial:       { label: "دفع جزئي",          color: "bg-yellow-100 text-yellow-700" },
  refunded:      { label: "مُسترجَع",          color: "bg-gray-100 text-gray-700" },
};

const roleLabels: Record<string, string> = {
  product_manager: "مدير المنتجات",
  order_manager:   "مدير الطلبات",
  delivery:        "موظف التوصيل",
  finance:         "المسؤول المالي",
  owner:           "المالك",
};

// ─── Login Screen ──────────────────────────────────────────────────────────────
function StaffLogin({ onLogin }: { onLogin: (user: any) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "خطأ في تسجيل الدخول");

      // Check staff role
      const meRes = await fetch("/api/staff/me", { credentials: "include" });
      if (!meRes.ok) {
        // Logout and show error
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
        throw new Error("ليس لديك صلاحية دخول بوابة الموظفين");
      }
      const staffUser = await meRes.json();
      onLogin(staffUser);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center p-4" dir="rtl">
      <Card className="w-full max-w-sm shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-3">
            <User className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl">بوابة الموظفين</CardTitle>
          <p className="text-muted-foreground text-sm">أويو بلاست — نظام إدارة الفريق</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">البريد الإلكتروني</label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@oyoplast.com"
                required
                data-testid="input-staff-email"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">كلمة المرور</label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                data-testid="input-staff-password"
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg p-3 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading} data-testid="button-staff-login">
              {loading ? "جاري الدخول..." : "تسجيل الدخول"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Order Card ─────────────────────────────────────────────────────────────
function OrderCard({ order, staffRole, deliveryTeam, onRefresh }: {
  order: any;
  staffRole: string;
  deliveryTeam: any[];
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [statusLoading, setStatusLoading] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const statusInfo = orderStatusMap[order.status] || { label: order.status, color: "bg-gray-100 text-gray-700", icon: Clock };
  const payInfo = paymentStatusMap[order.payment_status || order.paymentStatus || "unpaid"] || paymentStatusMap["unpaid"];

  const updateStatus = async (newStatus: string) => {
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/staff/orders/${order.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast({ title: "✅ تم تحديث حالة الطلب", description: `#${order.id} → ${orderStatusMap[newStatus]?.label}` });
      onRefresh();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setStatusLoading(false);
    }
  };

  const updatePayment = async (newPayStatus: string) => {
    setPayLoading(true);
    try {
      const res = await fetch(`/api/staff/orders/${order.id}/payment`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ paymentStatus: newPayStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast({ title: "✅ تم تحديث حالة الدفع" });
      onRefresh();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setPayLoading(false);
    }
  };

  const assignDelivery = async (deliveryUserId: string) => {
    setAssignLoading(true);
    try {
      const res = await fetch(`/api/staff/orders/${order.id}/assign`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ deliveryUserId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast({ title: "✅ تم تخصيص الطلب للمندوب" });
      onRefresh();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setAssignLoading(false);
    }
  };

  const StatusIcon = statusInfo.icon;

  return (
    <Card className="mb-3 border shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg text-primary">#{order.id}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${statusInfo.color}`}>
              <StatusIcon className="w-3 h-3 inline ml-1" />
              {statusInfo.label}
            </span>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${payInfo.color}`}>
            {payInfo.label}
          </span>
        </div>

        {/* Customer info */}
        <div className="space-y-1 text-sm mb-3">
          <div className="flex items-center gap-2 font-medium">
            <User className="w-4 h-4 text-muted-foreground" />
            {order.customer_name || order.customerName || "—"}
          </div>
          {(order.customer_phone || order.customerPhone) && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="w-4 h-4" />
              <a href={`tel:${order.customer_phone || order.customerPhone}`} className="underline hover:text-primary">
                {order.customer_phone || order.customerPhone}
              </a>
            </div>
          )}
          {(order.shipping_city || order.shippingCity) && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4" />
              {order.shipping_city || order.shippingCity}
              {(order.shipping_address || order.shippingAddress) && ` — ${order.shipping_address || order.shippingAddress}`}
            </div>
          )}
        </div>

        {/* Total & date */}
        <div className="flex items-center justify-between mb-3 text-sm">
          <span className="font-bold text-green-700 text-base">
            {Number(order.total).toLocaleString()} {order.currency || "YER"}
          </span>
          <span className="text-muted-foreground text-xs">
            {new Date(order.created_at || order.createdAt).toLocaleDateString("ar-SA")}
          </span>
        </div>

        {/* Items toggle */}
        {order.items && order.items.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-primary underline mb-2"
          >
            {expanded ? "إخفاء" : `عرض ${order.items.length} منتج`}
          </button>
        )}
        {expanded && order.items && (
          <div className="bg-slate-50 rounded-lg p-2 mb-3 space-y-1">
            {order.items.map((item: any, i: number) => (
              <div key={i} className="flex justify-between text-xs">
                <span>منتج #{item.product_id || item.productId} × {item.quantity}</span>
                <span>{Number(item.price).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        {/* Actions based on role */}
        <div className="space-y-2">
          {/* Status update */}
          {(staffRole === "order_manager" || staffRole === "owner" || staffRole === "delivery") && (
            <div>
              <p className="text-xs text-muted-foreground mb-1 font-medium">تغيير حالة الطلب:</p>
              <div className="flex flex-wrap gap-1">
                {(staffRole === "delivery"
                  ? ["shipped", "delivered", "completed"]
                  : ["pending", "processing", "shipped", "delivered", "completed", "cancelled"]
                ).map(s => (
                  <button
                    key={s}
                    onClick={() => updateStatus(s)}
                    disabled={statusLoading || order.status === s}
                    className={`text-xs px-2 py-1 rounded-lg border transition-all ${
                      order.status === s
                        ? "bg-primary text-white border-primary"
                        : "bg-white hover:bg-slate-50 border-slate-200"
                    }`}
                  >
                    {orderStatusMap[s]?.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Payment status update */}
          {(staffRole === "finance" || staffRole === "order_manager" || staffRole === "delivery" || staffRole === "owner") && (
            <div>
              <p className="text-xs text-muted-foreground mb-1 font-medium">حالة الدفع:</p>
              <Select onValueChange={updatePayment} defaultValue={order.payment_status || "unpaid"}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(paymentStatusMap).map(([val, { label }]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Assign delivery */}
          {(staffRole === "order_manager" || staffRole === "owner") && deliveryTeam.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1 font-medium">تخصيص مندوب:</p>
              <Select
                onValueChange={assignDelivery}
                defaultValue={order.assigned_to || "none"}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="اختر مندوب" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون تخصيص</SelectItem>
                  {deliveryTeam.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.fullName || d.email} {d.phone ? `(${d.phone})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Orders Dashboard ──────────────────────────────────────────────────────
function OrdersDashboard({ staffRole }: { staffRole: string }) {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");

  const { data: orders = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/staff/orders"],
    queryFn: async () => {
      const res = await fetch("/api/staff/orders", { credentials: "include" });
      if (!res.ok) throw new Error("فشل جلب الطلبات");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: deliveryTeam = [] } = useQuery<any[]>({
    queryKey: ["/api/staff/delivery-team"],
    queryFn: async () => {
      if (staffRole !== "order_manager" && staffRole !== "owner") return [];
      const res = await fetch("/api/staff/delivery-team", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: staffRole === "order_manager" || staffRole === "owner",
  });

  const filtered = orders.filter(o => {
    const matchStatus = filterStatus === "all" || o.status === filterStatus;
    const name = (o.customer_name || o.customerName || "").toLowerCase();
    const phone = (o.customer_phone || o.customerPhone || "");
    const matchSearch = !search || name.includes(search.toLowerCase()) || phone.includes(search) || String(o.id).includes(search);
    return matchStatus && matchSearch;
  });

  const counts: Record<string, number> = {};
  orders.forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1; });

  return (
    <div>
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {["pending", "shipped", "completed"].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`rounded-xl p-2 text-center border transition-all ${filterStatus === s ? "border-primary bg-primary/5" : "border-transparent bg-white"}`}
          >
            <div className="text-2xl font-bold text-primary">{counts[s] || 0}</div>
            <div className="text-xs text-muted-foreground">{orderStatusMap[s]?.label}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <Input
          placeholder="بحث بالاسم أو الجوال..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 h-9 text-sm"
          data-testid="input-search-orders"
        />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32 h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل ({orders.length})</SelectItem>
            {Object.entries(orderStatusMap).map(([val, { label }]) => (
              <SelectItem key={val} value={val}>{label} ({counts[val] || 0})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="h-9">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Orders */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          جاري تحميل الطلبات...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          لا توجد طلبات
        </div>
      ) : (
        <div>
          <p className="text-xs text-muted-foreground mb-3">{filtered.length} طلب</p>
          {filtered.map(o => (
            <OrderCard
              key={o.id}
              order={o}
              staffRole={staffRole}
              deliveryTeam={deliveryTeam}
              onRefresh={refetch}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Financial Summary ──────────────────────────────────────────────────────
function FinancialDashboard() {
  const { data: summary, isLoading } = useQuery<any>({
    queryKey: ["/api/staff/financial-summary"],
    queryFn: async () => {
      const res = await fetch("/api/staff/financial-summary", { credentials: "include" });
      if (!res.ok) throw new Error("فشل جلب الملخص المالي");
      return res.json();
    },
    refetchInterval: 60000,
  });

  const { data: orders = [], isLoading: ordersLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/staff/orders"],
    queryFn: async () => {
      const res = await fetch("/api/staff/orders", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>;

  const stats = [
    { label: "المبالغ المحصّلة (30 يوم)", value: `${Number(summary?.collected_amount || 0).toLocaleString()} ر.ي`, icon: CheckCircle, color: "text-green-600 bg-green-50" },
    { label: "مبالغ معلّقة", value: `${Number(summary?.pending_amount || 0).toLocaleString()} ر.ي`, icon: Clock, color: "text-yellow-600 bg-yellow-50" },
    { label: "طلبات مكتملة", value: summary?.delivered_count || 0, icon: TrendingUp, color: "text-blue-600 bg-blue-50" },
    { label: "طلبات ملغاة", value: summary?.cancelled_count || 0, icon: XCircle, color: "text-red-600 bg-red-50" },
    { label: "تم التحصيل كاش", value: summary?.cod_collected_count || 0, icon: Banknote, color: "text-emerald-600 bg-emerald-50" },
    { label: "غير محصّل", value: summary?.unpaid_count || 0, icon: AlertCircle, color: "text-orange-600 bg-orange-50" },
  ];

  const unpaidOrders = orders.filter(o => (o.payment_status || "unpaid") === "unpaid" && o.status !== "cancelled");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${s.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="font-bold text-lg">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Unpaid orders */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-500" />
            الطلبات غير المحصّلة ({unpaidOrders.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {unpaidOrders.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground text-sm">لا توجد طلبات معلّقة 🎉</p>
          ) : (
            <div className="divide-y max-h-80 overflow-y-auto">
              {unpaidOrders.map(o => (
                <div key={o.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <span className="font-medium">#{o.id}</span>
                    <span className="text-muted-foreground mx-2">—</span>
                    <span>{o.customer_name || o.customerName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-orange-600">{Number(o.total).toLocaleString()} ر.ي</span>
                    <Select
                      onValueChange={async (val) => {
                        await fetch(`/api/staff/orders/${o.id}/payment`, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({ paymentStatus: val }),
                        });
                        refetch();
                      }}
                      defaultValue="unpaid"
                    >
                      <SelectTrigger className="h-7 text-xs w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(paymentStatusMap).map(([val, { label }]) => (
                          <SelectItem key={val} value={val}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Products Panel (product_manager) ────────────────────────────────────────
function ProductsDashboard() {
  const { data: products = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/staff/products"],
    queryFn: async () => {
      const res = await fetch("/api/staff/products", { credentials: "include" });
      if (!res.ok) throw new Error("فشل جلب المنتجات");
      return res.json();
    },
  });

  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const catMap: Record<number, string> = {};
  categories.forEach((c: any) => { catMap[c.id] = c.name; });

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{products.length} منتج</p>
        <Button size="sm" onClick={() => window.open("/admin", "_blank")}>
          إدارة المنتجات ↗
        </Button>
      </div>
      <div className="space-y-2">
        {products.map((p: any) => (
          <Card key={p.id} className="border shadow-sm">
            <CardContent className="p-3 flex items-center gap-3">
              {p.imageUrl && (
                <img
                  src={p.imageUrl}
                  alt={p.name}
                  className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground">{catMap[p.categoryId] || "—"}</p>
                <p className="text-xs font-bold text-primary mt-1">
                  {Number(p.price).toLocaleString()} ر.ي
                  {p.priceSar && ` / ${Number(p.priceSar).toLocaleString()} ر.س`}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <Badge variant={p.stock > 0 ? "default" : "destructive"} className="text-xs">
                  {p.stock > 0 ? `${p.stock} متوفر` : "نفذ"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Main Staff Portal ─────────────────────────────────────────────────────
export default function StaffPortal() {
  const [staffUser, setStaffUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const { toast } = useToast();

  // Check if already logged in as staff
  useEffect(() => {
    fetch("/api/staff/me", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(user => { if (user) setStaffUser(user); })
      .finally(() => setCheckingAuth(false));
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setStaffUser(null);
    toast({ title: "تم تسجيل الخروج" });
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          جاري التحقق...
        </div>
      </div>
    );
  }

  if (!staffUser) {
    return <StaffLogin onLogin={setStaffUser} />;
  }

  const role = staffUser.role;

  // Determine available tabs based on role
  const tabs: { value: string; label: string; icon: any }[] = [];
  if (role === "delivery") {
    tabs.push({ value: "my-orders", label: "طلباتي", icon: Truck });
  }
  if (role === "order_manager" || role === "owner") {
    tabs.push({ value: "orders", label: "الطلبات", icon: ShoppingBag });
  }
  if (role === "finance" || role === "owner") {
    tabs.push({ value: "financial", label: "المالية", icon: Banknote });
  }
  if (role === "product_manager" || role === "owner") {
    tabs.push({ value: "products", label: "المنتجات", icon: Package });
  }
  if (role === "owner") {
    tabs.push({ value: "all-orders", label: "كل الطلبات", icon: BarChart2 });
  }

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-base">أويو بلاست</h1>
            <p className="text-xs text-muted-foreground">{roleLabels[role] || role}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-sm font-medium">{staffUser.fullName || staffUser.email}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-red-500 hover:text-red-600">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-4">
        {tabs.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
            لا توجد صلاحيات مخصصة لحسابك
          </div>
        ) : (
          <Tabs defaultValue={tabs[0].value}>
            <TabsList className={`grid w-full mb-4 bg-white border shadow-sm rounded-xl`} style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
              {tabs.map(t => {
                const Icon = t.icon;
                return (
                  <TabsTrigger key={t.value} value={t.value} className="text-xs flex items-center gap-1 rounded-lg">
                    <Icon className="w-3.5 h-3.5" />
                    {t.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {(role === "delivery") && (
              <TabsContent value="my-orders">
                <OrdersDashboard staffRole={role} />
              </TabsContent>
            )}
            {(role === "order_manager" || role === "owner") && (
              <TabsContent value="orders">
                <OrdersDashboard staffRole={role} />
              </TabsContent>
            )}
            {(role === "finance" || role === "owner") && (
              <TabsContent value="financial">
                <FinancialDashboard />
              </TabsContent>
            )}
            {(role === "product_manager" || role === "owner") && (
              <TabsContent value="products">
                <ProductsDashboard />
              </TabsContent>
            )}
            {role === "owner" && (
              <TabsContent value="all-orders">
                <OrdersDashboard staffRole="owner" />
              </TabsContent>
            )}
          </Tabs>
        )}
      </div>
    </div>
  );
}
