import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Package, Truck, CheckCircle, XCircle, Clock, DollarSign,
  LogOut, User, AlertCircle, RefreshCw, Phone, MapPin,
  TrendingUp, ShoppingBag, Banknote, BarChart2, Plus, Edit, Trash2,
  MessageCircle, Wallet, Building2, Calculator, Calendar, Timer,
  ClipboardList, Users, FileText, ChevronDown, ChevronUp, CheckSquare
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────
const orderStatusMap: Record<string, { label: string; color: string; icon: any }> = {
  pending:    { label: "قيد الانتظار", color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: Clock },
  processing: { label: "قيد التجهيز",  color: "bg-orange-100 text-orange-800 border-orange-200", icon: Package },
  shipped:    { label: "تم الشحن",      color: "bg-indigo-100 text-indigo-800 border-indigo-200", icon: Truck },
  delivered:  { label: "تم التوصيل",    color: "bg-teal-100 text-teal-800 border-teal-200",   icon: CheckCircle },
  completed:  { label: "مكتمل",          color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle },
  cancelled:  { label: "ملغي",           color: "bg-red-100 text-red-800 border-red-200",     icon: XCircle },
};
const paymentStatusMap: Record<string, { label: string; color: string }> = {
  unpaid:        { label: "لم يُحصَّل",         color: "bg-red-100 text-red-700" },
  cod_collected: { label: "تم التحصيل (كاش)",  color: "bg-green-100 text-green-700" },
  transferred:   { label: "محوّل ✅",            color: "bg-blue-100 text-blue-700" },
  partial:       { label: "دفع جزئي",           color: "bg-yellow-100 text-yellow-700" },
  refunded:      { label: "مُسترجَع",           color: "bg-gray-100 text-gray-700" },
};
const paymentMethodLabel: Record<string, { label: string; icon: any; needsVerify: boolean }> = {
  cash_on_delivery:      { label: "كاش عند التسليم", icon: Banknote, needsVerify: false },
  bank_transfer:         { label: "تحويل بنكي",      icon: Building2, needsVerify: true },
  digital_wallet:        { label: "محفظة إلكترونية", icon: Wallet,    needsVerify: true },
  installment_deposit_cod:{ label: "تقسيط (مقدّم)",  icon: Calculator, needsVerify: true },
  supplier_guaranteed:   { label: "تقسيط بكفيل",     icon: Users,     needsVerify: false },
};
const expenseTypeLabels: Record<string, string> = {
  salary: "رواتب 👥", rent: "إيجار 🏢", marketing: "تسويق 📢",
  maintenance: "صيانة 🔧", utilities: "فواتير 💡", depreciation: "اهلاك 📉", other: "أخرى 📌",
};
const roleLabels: Record<string, string> = {
  product_manager: "مدير المنتجات", order_manager: "مدير الطلبات",
  delivery: "موظف التوصيل", finance: "المسؤول المالي", owner: "المالك",
};
const paymentModelLabels: Record<string, string> = {
  fixed: "راتب ثابت", per_order: "بالقطعة", hybrid: "مختلط (ثابت + قطعة)",
};

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(n: any) { return Number(n || 0).toLocaleString("ar-YE"); }
function fmtMins(mins: number) {
  if (!mins) return "0 دقيقة";
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h} س ${m > 0 ? m + " د" : ""}` : `${m} دقيقة`;
}
function today() { return new Date().toISOString().slice(0, 10); }
function thisMonth() { return new Date().toISOString().slice(0, 7); }

// ── StaffLogin ─────────────────────────────────────────────────────────────
function StaffLogin({ onLogin }: { onLogin: (u: any) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "خطأ في تسجيل الدخول");
      const meRes = await fetch("/api/staff/me", { credentials: "include" });
      if (!meRes.ok) { await fetch("/api/auth/logout", { method: "POST", credentials: "include" }); throw new Error("ليس لديك صلاحية دخول بوابة الموظفين"); }
      onLogin(await meRes.json());
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center p-4" dir="rtl">
      <Card className="w-full max-w-sm shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-3"><User className="w-8 h-8 text-white" /></div>
          <CardTitle className="text-2xl">بوابة الموظفين</CardTitle>
          <p className="text-muted-foreground text-sm">أويو بلاست — نظام إدارة الفريق</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div><label className="text-sm font-medium mb-1 block">البريد الإلكتروني</label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="example@oyoplast.com" required /></div>
            <div><label className="text-sm font-medium mb-1 block">كلمة المرور</label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required /></div>
            {error && <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg p-3 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "جاري الدخول..." : "تسجيل الدخول"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ── AttendanceWidget ────────────────────────────────────────────────────────
function AttendanceWidget({ userId }: { userId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: att, refetch } = useQuery<any>({
    queryKey: ["/api/staff/attendance/today", userId],
    queryFn: async () => { const r = await fetch("/api/staff/attendance/today", { credentials: "include" }); return r.ok ? r.json() : null; },
    refetchInterval: 60000,
  });
  const isIn = att && !att.check_out;
  const doAction = async (action: "checkin" | "checkout") => {
    const r = await fetch(`/api/staff/attendance/${action}`, { method: "POST", credentials: "include" });
    const d = await r.json();
    if (!r.ok) { toast({ title: "خطأ", description: d.message, variant: "destructive" }); return; }
    toast({ title: action === "checkin" ? "✅ تم تسجيل الحضور" : "✅ تم تسجيل الانصراف", description: action === "checkout" ? `إجمالي: ${fmtMins(d.total_minutes)}` : "" });
    refetch();
    qc.invalidateQueries({ queryKey: ["/api/finance/attendance-summary"] });
  };
  return (
    <div className="flex items-center gap-2">
      {att && (
        <span className="text-xs text-muted-foreground hidden sm:block">
          {isIn ? `حضور: ${new Date(att.check_in).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}` : `${fmtMins(att.total_minutes)}`}
        </span>
      )}
      <Button size="sm" variant={isIn ? "destructive" : "default"} className="text-xs h-8 gap-1" onClick={() => doAction(isIn ? "checkout" : "checkin")}>
        <Timer className="w-3.5 h-3.5" />
        {isIn ? "انصراف" : "حضور"}
      </Button>
    </div>
  );
}

// ── OrderCard (enhanced for order_manager) ─────────────────────────────────
function OrderCard({ order, staffRole, deliveryTeam, onRefresh }: { order: any; staffRole: string; deliveryTeam: any[]; onRefresh: () => void }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [payLoading, setPayLoading] = useState(false);

  const statusInfo = orderStatusMap[order.status] || { label: order.status, color: "bg-gray-100 text-gray-700", icon: Clock };
  const payInfo = paymentStatusMap[order.payment_status || "unpaid"] || paymentStatusMap["unpaid"];
  const pmInfo = paymentMethodLabel[order.payment_method] || { label: order.payment_method, icon: Banknote, needsVerify: false };
  const needsVerify = pmInfo.needsVerify && (order.payment_status || "unpaid") === "unpaid";
  const StatusIcon = statusInfo.icon;
  const PmIcon = pmInfo.icon;
  const isCOD = order.payment_method === "cash_on_delivery";

  const updateStatus = async (s: string) => {
    setStatusLoading(true);
    const r = await fetch(`/api/staff/orders/${order.id}/status`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ status: s }) });
    const d = await r.json();
    if (!r.ok) toast({ title: "خطأ", description: d.message, variant: "destructive" });
    else { toast({ title: "✅ تم تحديث الحالة" }); onRefresh(); }
    setStatusLoading(false);
  };
  const updatePayment = async (ps: string) => {
    setPayLoading(true);
    const r = await fetch(`/api/staff/orders/${order.id}/payment`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ paymentStatus: ps }) });
    if (r.ok) { toast({ title: "✅ تم تحديث الدفع" }); onRefresh(); }
    setPayLoading(false);
  };
  const assignDelivery = async (uid: string) => {
    const r = await fetch(`/api/staff/orders/${order.id}/assign`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ deliveryUserId: uid }) });
    if (r.ok) { toast({ title: "✅ تم التخصيص" }); onRefresh(); }
  };

  return (
    <Card className={`mb-3 border shadow-sm transition-shadow hover:shadow-md ${needsVerify ? "border-orange-300 bg-orange-50/30" : ""}`}>
      {needsVerify && (
        <div className="bg-orange-100 border-b border-orange-200 px-4 py-2 flex items-center gap-2 text-orange-800 text-xs font-bold rounded-t-lg">
          <AlertCircle className="w-3.5 h-3.5" />
          ⚠️ ينتظر تحقق الدفع — {pmInfo.label}
          {order.purchase_code && <span className="font-mono bg-white px-2 py-0.5 rounded border border-orange-200">#{order.purchase_code}</span>}
        </div>
      )}
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-lg text-primary">#{order.id}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${statusInfo.color}`}>
              <StatusIcon className="w-3 h-3 inline ml-1" />{statusInfo.label}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${needsVerify ? "bg-orange-100 text-orange-700" : pmInfo.needsVerify ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
              <PmIcon className="w-3 h-3" />{pmInfo.label}
            </span>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${payInfo.color}`}>{payInfo.label}</span>
        </div>

        {isCOD && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-3 flex items-center justify-between">
            <span className="text-xs text-green-700 font-medium">الكاش المطلوب عند التسليم</span>
            <span className="font-extrabold text-green-700 text-lg">{fmt(order.total)} ر.ي</span>
          </div>
        )}

        <div className="space-y-1 text-sm mb-3">
          <div className="flex items-center gap-2 font-medium"><User className="w-4 h-4 text-muted-foreground" />{order.customer_name || "—"}</div>
          {order.customer_phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="w-4 h-4" />
              <a href={`tel:${order.customer_phone}`} className="underline hover:text-primary">{order.customer_phone}</a>
              <a href={`https://wa.me/${(order.customer_phone||"").replace(/\D/g,"")}`} target="_blank" rel="noreferrer" className="text-green-600 hover:text-green-700 ml-1">
                <MessageCircle className="w-4 h-4" />
              </a>
            </div>
          )}
          {order.shipping_city && <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="w-4 h-4" />{order.shipping_city}{order.shipping_address && ` — ${order.shipping_address}`}</div>}
        </div>

        <div className="flex items-center justify-between mb-3 text-sm">
          <span className="font-bold text-green-700 text-base">{fmt(order.total)} {order.currency || "ر.ي"}</span>
          <span className="text-muted-foreground text-xs">{new Date(order.created_at).toLocaleDateString("ar-SA")}</span>
        </div>

        {order.notes && <div className="text-xs text-muted-foreground bg-slate-50 rounded p-2 mb-3 line-clamp-2">📝 {order.notes}</div>}

        {order.items?.length > 0 && (
          <>
            <button onClick={() => setExpanded(!expanded)} className="text-xs text-primary underline mb-2 flex items-center gap-1">
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? "إخفاء" : `عرض ${order.items.length} منتج`}
            </button>
            {expanded && (
              <div className="bg-slate-50 rounded-lg p-2 mb-3 space-y-1">
                {order.items.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span>منتج #{item.product_id} × {item.quantity}</span>
                    <span>{fmt(item.price)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <div className="space-y-2 pt-2 border-t">
          {(staffRole === "order_manager" || staffRole === "owner" || staffRole === "delivery") && (
            <div>
              <p className="text-xs text-muted-foreground mb-1 font-medium">تغيير الحالة:</p>
              <div className="flex flex-wrap gap-1">
                {(staffRole === "delivery" ? ["shipped", "delivered", "completed"] : ["pending", "processing", "shipped", "delivered", "completed", "cancelled"]).map(s => (
                  <button key={s} onClick={() => updateStatus(s)} disabled={statusLoading || order.status === s}
                    className={`text-xs px-2 py-1 rounded-lg border transition-all ${order.status === s ? "bg-primary text-white border-primary" : "bg-white hover:bg-slate-50 border-slate-200"}`}>
                    {orderStatusMap[s]?.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(staffRole === "finance" || staffRole === "order_manager" || staffRole === "delivery" || staffRole === "owner") && (
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground font-medium shrink-0">حالة الدفع:</p>
              <Select onValueChange={updatePayment} defaultValue={order.payment_status || "unpaid"}>
                <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(paymentStatusMap).map(([v, { label }]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
              {isCOD && (order.payment_status || "unpaid") !== "cod_collected" && (
                <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700 shrink-0" onClick={() => updatePayment("cod_collected")}>
                  <CheckSquare className="w-3 h-3 ml-1" />تحصيل
                </Button>
              )}
              {pmInfo.needsVerify && (order.payment_status || "unpaid") === "unpaid" && (
                <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700 shrink-0" onClick={() => updatePayment("transferred")}>
                  <CheckCircle className="w-3 h-3 ml-1" />اعتماد
                </Button>
              )}
            </div>
          )}

          {(staffRole === "order_manager" || staffRole === "owner") && deliveryTeam.length > 0 && (
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground font-medium shrink-0">مندوب:</p>
              <Select onValueChange={assignDelivery} defaultValue={order.assigned_to || "none"}>
                <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="اختر مندوب" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون</SelectItem>
                  {deliveryTeam.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.fullName || d.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── OrdersDashboard ─────────────────────────────────────────────────────────
function OrdersDashboard({ staffRole }: { staffRole: string }) {
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPayment, setFilterPayment] = useState("all");
  const [search, setSearch] = useState("");
  const { data: orders = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/staff/orders"],
    queryFn: async () => { const r = await fetch("/api/staff/orders", { credentials: "include" }); return r.ok ? r.json() : []; },
    refetchInterval: 30000,
  });
  const { data: deliveryTeam = [] } = useQuery<any[]>({
    queryKey: ["/api/staff/delivery-team"],
    queryFn: async () => { if (staffRole !== "order_manager" && staffRole !== "owner") return []; const r = await fetch("/api/staff/delivery-team", { credentials: "include" }); return r.ok ? r.json() : []; },
    enabled: staffRole === "order_manager" || staffRole === "owner",
  });

  const pendingVerify = orders.filter(o => paymentMethodLabel[o.payment_method]?.needsVerify && (o.payment_status || "unpaid") === "unpaid" && o.status !== "cancelled");
  const filtered = orders.filter(o => {
    const ms = filterStatus === "all" || o.status === filterStatus;
    const mp = filterPayment === "all" || (filterPayment === "needs_verify" ? (paymentMethodLabel[o.payment_method]?.needsVerify && (o.payment_status || "unpaid") === "unpaid") : (o.payment_method === filterPayment));
    const msearch = !search || (o.customer_name||"").toLowerCase().includes(search.toLowerCase()) || (o.customer_phone||"").includes(search) || String(o.id).includes(search);
    return ms && mp && msearch;
  });
  const counts: Record<string, number> = {};
  orders.forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1; });

  return (
    <div>
      {pendingVerify.length > 0 && (
        <div className="bg-orange-100 border border-orange-300 rounded-xl p-3 mb-4 flex items-center gap-3 cursor-pointer" onClick={() => setFilterPayment("needs_verify")}>
          <AlertCircle className="w-5 h-5 text-orange-600 shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-orange-800 text-sm">{pendingVerify.length} طلب ينتظر تحقق الدفع</p>
            <p className="text-xs text-orange-600">تحويل بنكي أو محفظة إلكترونية — اضغط للعرض</p>
          </div>
          <span className="bg-orange-500 text-white rounded-full w-7 h-7 flex items-center justify-center font-bold text-sm">{pendingVerify.length}</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 mb-4">
        {["pending", "shipped", "completed"].map(s => (
          <button key={s} onClick={() => setFilterStatus(s === filterStatus ? "all" : s)}
            className={`rounded-xl p-2 text-center border transition-all ${filterStatus === s ? "border-primary bg-primary/5" : "border-transparent bg-white"}`}>
            <div className="text-2xl font-bold text-primary">{counts[s] || 0}</div>
            <div className="text-xs text-muted-foreground">{orderStatusMap[s]?.label}</div>
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <Input placeholder="بحث بالاسم أو الجوال..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 h-9 text-sm min-w-[140px]" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32 h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل ({orders.length})</SelectItem>
            {Object.entries(orderStatusMap).map(([v, { label }]) => <SelectItem key={v} value={v}>{label} ({counts[v]||0})</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPayment} onValueChange={setFilterPayment}>
          <SelectTrigger className="w-36 h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الدفع</SelectItem>
            <SelectItem value="needs_verify">⚠️ ينتظر تحقق</SelectItem>
            <SelectItem value="cash_on_delivery">كاش عند التسليم</SelectItem>
            <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
            <SelectItem value="digital_wallet">محفظة إلكترونية</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="h-9"><RefreshCw className="w-4 h-4" /></Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12"><RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground"><Package className="w-12 h-12 mx-auto mb-3 opacity-30" />لا توجد طلبات</div>
      ) : (
        <div>
          <p className="text-xs text-muted-foreground mb-3">{filtered.length} طلب</p>
          {filtered.map(o => <OrderCard key={o.id} order={o} staffRole={staffRole} deliveryTeam={deliveryTeam} onRefresh={refetch} />)}
        </div>
      )}
    </div>
  );
}

// ── ExpensesPanel ───────────────────────────────────────────────────────────
function ExpensesPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [month, setMonth] = useState(thisMonth());
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ type: "other", description: "", amount: "", currency: "YER", date: today(), notes: "" });

  const { data: exps = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/finance/expenses", month],
    queryFn: async () => { const r = await fetch(`/api/finance/expenses?month=${month}`, { credentials: "include" }); return r.ok ? r.json() : []; },
  });

  const save = async () => {
    if (!form.description || !form.amount) { toast({ title: "أدخل الوصف والمبلغ", variant: "destructive" }); return; }
    const url = editing ? `/api/finance/expenses/${editing.id}` : "/api/finance/expenses";
    const method = editing ? "PUT" : "POST";
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(form) });
    const d = await r.json();
    if (!r.ok) { toast({ title: "خطأ", description: d.message, variant: "destructive" }); return; }
    toast({ title: editing ? "✅ تم التعديل" : "✅ تم الإضافة" });
    qc.invalidateQueries({ queryKey: ["/api/finance/expenses"] });
    setShowForm(false); setEditing(null); setForm({ type: "other", description: "", amount: "", currency: "YER", date: today(), notes: "" });
  };
  const del = async (id: number) => {
    if (!confirm("حذف هذا المصروف؟")) return;
    await fetch(`/api/finance/expenses/${id}`, { method: "DELETE", credentials: "include" });
    toast({ title: "✅ تم الحذف" });
    qc.invalidateQueries({ queryKey: ["/api/finance/expenses"] });
  };

  const totalByType: Record<string, number> = {};
  exps.forEach(e => { totalByType[e.type] = (totalByType[e.type] || 0) + Number(e.amount); });
  const grandTotal = exps.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="h-9 w-40 text-sm" />
        <Button size="sm" onClick={() => { setEditing(null); setForm({ type: "other", description: "", amount: "", currency: "YER", date: today(), notes: "" }); setShowForm(true); }}>
          <Plus className="w-4 h-4 ml-1" />إضافة مصروف
        </Button>
      </div>

      {/* ملخص حسب النوع */}
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(totalByType).map(([type, total]) => (
          <Card key={type} className="border-0 shadow-sm">
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">{expenseTypeLabels[type] || type}</div>
              <div className="font-bold text-base">{fmt(total)} <span className="text-xs font-normal">ر.ي</span></div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="bg-primary/5 rounded-xl p-3 flex justify-between items-center">
        <span className="font-bold">الإجمالي ({month})</span>
        <span className="font-extrabold text-lg text-primary">{fmt(grandTotal)} ر.ي</span>
      </div>

      {isLoading ? <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div> : (
        <div className="space-y-2">
          {exps.map(e => (
            <Card key={e.id} className="border shadow-sm">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full">{expenseTypeLabels[e.type] || e.type}</span>
                    <span className="text-xs text-muted-foreground">{e.date}</span>
                  </div>
                  <p className="font-medium text-sm mt-1">{e.description}</p>
                  {e.notes && <p className="text-xs text-muted-foreground">{e.notes}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-base">{fmt(e.amount)} <span className="text-xs">{e.currency}</span></p>
                  <div className="flex gap-1 mt-1">
                    <button onClick={() => { setEditing(e); setForm({ type: e.type, description: e.description, amount: e.amount, currency: e.currency, date: e.date, notes: e.notes||"" }); setShowForm(true); }} className="text-blue-500 hover:text-blue-700"><Edit className="w-3.5 h-3.5" /></button>
                    <button onClick={() => del(e.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader><DialogTitle>{editing ? "تعديل مصروف" : "إضافة مصروف جديد"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm font-medium mb-1 block">النوع</label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(expenseTypeLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium mb-1 block">الوصف *</label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="مثال: راتب محمد أغسطس" /></div>
            <div className="flex gap-2">
              <div className="flex-1"><label className="text-sm font-medium mb-1 block">المبلغ *</label><Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" /></div>
              <div><label className="text-sm font-medium mb-1 block">العملة</label>
                <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="YER">ر.ي</SelectItem><SelectItem value="SAR">ر.س</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div><label className="text-sm font-medium mb-1 block">التاريخ</label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div><label className="text-sm font-medium mb-1 block">ملاحظة</label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="اختياري" /></div>
            <Button className="w-full" onClick={save}>{editing ? "حفظ التعديلات" : "إضافة"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── AssetsPanel ─────────────────────────────────────────────────────────────
function AssetsPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", originalValue: "", purchaseDate: today().slice(0, 7), usefulLifeMonths: "24", notes: "" });

  const { data: assets = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/finance/assets"],
    queryFn: async () => { const r = await fetch("/api/finance/assets", { credentials: "include" }); return r.ok ? r.json() : []; },
  });

  const save = async () => {
    if (!form.name || !form.originalValue || !form.purchaseDate || !form.usefulLifeMonths) { toast({ title: "أدخل كل البيانات المطلوبة", variant: "destructive" }); return; }
    const r = await fetch("/api/finance/assets", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ ...form, purchaseDate: form.purchaseDate + "-01" }) });
    const d = await r.json();
    if (!r.ok) { toast({ title: "خطأ", description: d.message, variant: "destructive" }); return; }
    toast({ title: "✅ تم إضافة الأصل" });
    qc.invalidateQueries({ queryKey: ["/api/finance/assets"] });
    setShowForm(false); setForm({ name: "", originalValue: "", purchaseDate: today().slice(0, 7), usefulLifeMonths: "24", notes: "" });
  };
  const del = async (id: number) => {
    if (!confirm("حذف هذا الأصل؟")) return;
    await fetch(`/api/finance/assets/${id}`, { method: "DELETE", credentials: "include" });
    toast({ title: "✅ تم الحذف" });
    qc.invalidateQueries({ queryKey: ["/api/finance/assets"] });
  };

  const totalDepreciation = assets.reduce((s: number, a: any) => s + Number(a.monthlyDepreciation || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
          <span className="text-red-700 font-medium">إجمالي الاهلاك الشهري: </span>
          <span className="font-bold text-red-800">{fmt(totalDepreciation)} ر.ي</span>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}><Plus className="w-4 h-4 ml-1" />إضافة أصل</Button>
      </div>

      {isLoading ? <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div> : (
        <div className="space-y-2">
          {assets.map((a: any) => (
            <Card key={a.id} className="border shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-bold text-sm">{a.name}</p>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                      <span>شراء: {a.purchase_date?.slice(0, 7)}</span>
                      <span>عمر: {a.useful_life_months} شهر</span>
                      <span>مضى: {a.monthsElapsed} شهر</span>
                    </div>
                  </div>
                  <button onClick={() => del(a.id)} className="text-red-500 hover:text-red-700 shrink-0"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                  <div className="bg-slate-50 rounded p-2"><div className="text-xs text-muted-foreground">القيمة الأصلية</div><div className="font-bold text-sm">{fmt(a.original_value)}</div></div>
                  <div className="bg-blue-50 rounded p-2"><div className="text-xs text-blue-600">القيمة الحالية</div><div className="font-bold text-sm text-blue-700">{fmt(a.currentValue)}</div></div>
                  <div className="bg-red-50 rounded p-2"><div className="text-xs text-red-600">اهلاك شهري</div><div className="font-bold text-sm text-red-700">{fmt(a.monthlyDepreciation)}</div></div>
                </div>
              </CardContent>
            </Card>
          ))}
          {assets.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm">لا توجد أصول مسجّلة</div>}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader><DialogTitle>إضافة أصل ثابت</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm font-medium mb-1 block">اسم الأصل *</label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="مثال: سيارة توصيل، طابعة، رف تخزين" /></div>
            <div><label className="text-sm font-medium mb-1 block">قيمة الشراء (ر.ي) *</label><Input type="number" value={form.originalValue} onChange={e => setForm(f => ({ ...f, originalValue: e.target.value }))} /></div>
            <div><label className="text-sm font-medium mb-1 block">تاريخ الشراء *</label><Input type="month" value={form.purchaseDate} onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))} /></div>
            <div><label className="text-sm font-medium mb-1 block">العمر الافتراضي (شهر) *</label>
              <Select value={form.usefulLifeMonths} onValueChange={v => setForm(f => ({ ...f, usefulLifeMonths: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[12, 24, 36, 48, 60, 84, 120].map(m => <SelectItem key={m} value={String(m)}>{m} شهر ({m/12} سنة)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium mb-1 block">ملاحظة</label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            {form.originalValue && form.usefulLifeMonths && (
              <div className="bg-blue-50 rounded p-2 text-sm text-blue-700 text-center">
                الاهلاك الشهري = {fmt(Number(form.originalValue) / Number(form.usefulLifeMonths))} ر.ي
              </div>
            )}
            <Button className="w-full" onClick={save}>إضافة</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── PayrollPanel ────────────────────────────────────────────────────────────
function PayrollPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [period, setPeriod] = useState(thisMonth());
  const [rates, setRates] = useState<any[]>([]);
  const [editingRate, setEditingRate] = useState<any>(null);
  const [rateForm, setRateForm] = useState<any>({});
  const [bonusDialog, setBonusDialog] = useState<any>(null);
  const [bonusAmount, setBonusAmount] = useState("");
  const [bonusNotes, setBonusNotes] = useState("");
  const [showRates, setShowRates] = useState(false);

  const { data: payroll = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/finance/payroll", period],
    queryFn: async () => { const r = await fetch(`/api/finance/payroll?period=${period}`, { credentials: "include" }); return r.ok ? r.json() : []; },
  });
  useEffect(() => {
    fetch("/api/finance/staff-rates", { credentials: "include" }).then(r => r.ok ? r.json() : []).then(setRates);
  }, []);

  const saveBonus = async (row: any) => {
    const bonus = Number(bonusAmount) || 0;
    const total = row.totalPay - (row.bonuses || 0) + bonus;
    await fetch("/api/finance/payroll/save", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ ...row, bonuses: bonus, totalPay: total, notes: bonusNotes }),
    });
    toast({ title: "✅ تم الحفظ" });
    qc.invalidateQueries({ queryKey: ["/api/finance/payroll"] });
    setBonusDialog(null); setBonusAmount(""); setBonusNotes("");
  };
  const markPaid = async (row: any) => {
    await fetch("/api/finance/payroll/save", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ ...row, isPaid: true }),
    });
    toast({ title: `✅ تم تسجيل دفع راتب ${row.fullName}` });
    qc.invalidateQueries({ queryKey: ["/api/finance/payroll"] });
  };
  const saveRate = async () => {
    await fetch(`/api/finance/staff-rates/${editingRate.role}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(rateForm) });
    toast({ title: "✅ تم تحديث إعدادات الأجر" });
    fetch("/api/finance/staff-rates", { credentials: "include" }).then(r => r.json()).then(setRates);
    setEditingRate(null);
    qc.invalidateQueries({ queryKey: ["/api/finance/payroll"] });
  };

  const totalPayroll = payroll.reduce((s, r) => s + (r.totalPay || 0), 0);
  const paidCount = payroll.filter(r => r.isPaid).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="h-9 w-40 text-sm" />
        <Button size="sm" variant="outline" onClick={() => setShowRates(!showRates)}><Calculator className="w-3.5 h-3.5 ml-1" />إعداد الأجور</Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Card className="border-0 shadow-sm bg-primary/5"><CardContent className="p-3 text-center"><div className="text-xs text-muted-foreground">إجمالي الرواتب</div><div className="font-bold">{fmt(totalPayroll)} <span className="text-xs font-normal">ر.ي</span></div></CardContent></Card>
        <Card className="border-0 shadow-sm bg-green-50"><CardContent className="p-3 text-center"><div className="text-xs text-green-600">مدفوع</div><div className="font-bold text-green-700">{paidCount}/{payroll.length}</div></CardContent></Card>
        <Card className="border-0 shadow-sm bg-orange-50"><CardContent className="p-3 text-center"><div className="text-xs text-orange-600">متبقي</div><div className="font-bold text-orange-700">{payroll.length - paidCount}</div></CardContent></Card>
      </div>

      {/* إعداد الأجور */}
      {showRates && (
        <Card className="border">
          <CardHeader className="pb-2"><CardTitle className="text-sm">إعداد نموذج الأجر لكل دور</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {rates.map((r: any) => (
                <div key={r.role} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <div>
                    <span className="font-medium">{roleLabels[r.role] || r.role}</span>
                    <span className="text-xs text-muted-foreground mr-2">— {paymentModelLabels[r.payment_model] || r.payment_model}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {r.payment_model !== "per_order" && <span>أساسي: {fmt(r.base_salary)}</span>}
                    {r.rate_per_order > 0 && <span>قطعة: {fmt(r.rate_per_order)}</span>}
                    <button onClick={() => { setEditingRate(r); setRateForm({ baseSalary: r.base_salary, ratePerOrder: r.rate_per_order, paymentModel: r.payment_model, workingDaysPerMonth: r.working_days_per_month }); }} className="text-blue-500"><Edit className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* قائمة الرواتب */}
      {isLoading ? <div className="text-center py-8 text-muted-foreground">جاري الاحتساب...</div> : (
        <div className="space-y-3">
          {payroll.map((row: any) => (
            <Card key={row.userId} className={`border shadow-sm ${row.isPaid ? "opacity-60" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold">{row.fullName}</p>
                    <p className="text-xs text-muted-foreground">{roleLabels[row.role] || row.role} — {paymentModelLabels[row.paymentModel] || row.paymentModel}</p>
                  </div>
                  {row.isPaid ? <Badge className="bg-green-100 text-green-700 border-green-200">مدفوع ✅</Badge> : <Badge variant="outline" className="text-orange-600 border-orange-300">معلّق</Badge>}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
                  <div className="bg-slate-50 rounded p-2"><div className="text-muted-foreground">حضور</div><div className="font-bold">{row.attendanceDays} يوم</div></div>
                  <div className="bg-slate-50 rounded p-2"><div className="text-muted-foreground">غياب</div><div className="font-bold text-red-600">{row.absenceDays} يوم</div></div>
                  <div className="bg-slate-50 rounded p-2"><div className="text-muted-foreground">طلبات</div><div className="font-bold">{row.ordersCompleted}</div></div>
                </div>
                <div className="space-y-1 text-sm border-t pt-2">
                  {row.baseSalary > 0 && <div className="flex justify-between"><span className="text-muted-foreground">أساسي:</span><span>{fmt(row.baseSalary)} ر.ي</span></div>}
                  {row.orderBonus > 0 && <div className="flex justify-between"><span className="text-muted-foreground">أجر قطعة ({row.ordersCompleted} × {fmt(row.ratePerOrder)}):</span><span className="text-green-600">+{fmt(row.orderBonus)}</span></div>}
                  {row.deductions > 0 && <div className="flex justify-between"><span className="text-muted-foreground">خصم غياب:</span><span className="text-red-600">−{fmt(row.deductions)}</span></div>}
                  {row.bonuses > 0 && <div className="flex justify-between"><span className="text-muted-foreground">مكافأة:</span><span className="text-blue-600">+{fmt(row.bonuses)}</span></div>}
                  <div className="flex justify-between font-bold text-base border-t pt-1 mt-1"><span>الصافي:</span><span className="text-primary">{fmt(row.totalPay)} ر.ي</span></div>
                </div>
                {!row.isPaid && (
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700" onClick={() => markPaid(row)}><CheckCircle className="w-3 h-3 ml-1" />دفع الراتب</Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setBonusDialog(row); setBonusAmount(String(row.bonuses||"")); setBonusNotes(row.notes||""); }}>
                      <Plus className="w-3 h-3 ml-1" />مكافأة/خصم
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {payroll.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm">لا يوجد موظفون نشطون في النظام</div>}
        </div>
      )}

      {/* إعداد الأجر Dialog */}
      <Dialog open={!!editingRate} onOpenChange={v => { if (!v) setEditingRate(null); }}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader><DialogTitle>إعداد أجر — {roleLabels[editingRate?.role] || editingRate?.role}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm font-medium mb-1 block">نموذج الأجر</label>
              <Select value={rateForm.paymentModel} onValueChange={v => setRateForm((f: any) => ({ ...f, paymentModel: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(paymentModelLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {rateForm.paymentModel !== "per_order" && <div><label className="text-sm font-medium mb-1 block">الراتب الأساسي (ر.ي)</label><Input type="number" value={rateForm.baseSalary} onChange={e => setRateForm((f: any) => ({ ...f, baseSalary: e.target.value }))} /></div>}
            {rateForm.paymentModel !== "fixed" && <div><label className="text-sm font-medium mb-1 block">أجر كل طلب (ر.ي)</label><Input type="number" value={rateForm.ratePerOrder} onChange={e => setRateForm((f: any) => ({ ...f, ratePerOrder: e.target.value }))} /></div>}
            <div><label className="text-sm font-medium mb-1 block">أيام العمل الشهرية</label><Input type="number" value={rateForm.workingDaysPerMonth} onChange={e => setRateForm((f: any) => ({ ...f, workingDaysPerMonth: e.target.value }))} /></div>
            <Button className="w-full" onClick={saveRate}>حفظ</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* مكافأة Dialog */}
      <Dialog open={!!bonusDialog} onOpenChange={v => { if (!v) setBonusDialog(null); }}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader><DialogTitle>مكافأة / خصم — {bonusDialog?.fullName}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm font-medium mb-1 block">المبلغ (موجب = مكافأة، سالب = خصم)</label><Input type="number" value={bonusAmount} onChange={e => setBonusAmount(e.target.value)} placeholder="0" /></div>
            <div><label className="text-sm font-medium mb-1 block">السبب</label><Input value={bonusNotes} onChange={e => setBonusNotes(e.target.value)} placeholder="مثال: مكافأة أداء يونيو" /></div>
            <Button className="w-full" onClick={() => saveBonus(bonusDialog)}>حفظ</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── AttendanceSummary Panel ────────────────────────────────────────────────
function AttendanceSummaryPanel() {
  const [month, setMonth] = useState(thisMonth());
  const [override, setOverride] = useState<any>(null);
  const [overrideForm, setOverrideForm] = useState({ userId: "", date: today(), checkIn: "", checkOut: "", notes: "" });
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: summary = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/finance/attendance-summary", month],
    queryFn: async () => { const r = await fetch(`/api/finance/attendance-summary?month=${month}`, { credentials: "include" }); return r.ok ? r.json() : []; },
    refetchInterval: 60000,
  });

  const doOverride = async () => {
    const r = await fetch("/api/finance/attendance/override", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(overrideForm) });
    const d = await r.json();
    if (!r.ok) { toast({ title: "خطأ", description: d.message, variant: "destructive" }); return; }
    toast({ title: "✅ تم التعديل" });
    qc.invalidateQueries({ queryKey: ["/api/finance/attendance-summary"] });
    setOverride(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="h-9 w-40 text-sm" />
        <Button size="sm" variant="outline" onClick={() => { setOverride(true); setOverrideForm({ userId: "", date: today(), checkIn: "", checkOut: "", notes: "" }); }}><Edit className="w-3.5 h-3.5 ml-1" />تعديل يدوي</Button>
      </div>

      {isLoading ? <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div> : (
        <div className="space-y-2">
          {summary.map((s: any) => (
            <Card key={s.id} className="border shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-sm">{s.full_name || s.email}</p>
                    <p className="text-xs text-muted-foreground">{roleLabels[s.role] || s.role}</p>
                  </div>
                  {s.is_checked_in_now == 1 && (
                    <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block ml-1 animate-pulse" />حاضر الآن
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-blue-50 rounded p-2"><div className="text-blue-600">أيام الحضور</div><div className="font-bold text-blue-700">{s.days_present || 0}</div></div>
                  <div className="bg-green-50 rounded p-2"><div className="text-green-600">الساعات</div><div className="font-bold text-green-700">{Math.round((s.total_minutes || 0) / 60)}</div></div>
                  <div className="bg-slate-50 rounded p-2"><div className="text-muted-foreground">الدخول اليوم</div><div className="font-bold text-xs">{s.today_check_in ? new Date(s.today_check_in).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" }) : "—"}</div></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!override} onOpenChange={v => { if (!v) setOverride(null); }}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader><DialogTitle>تعديل حضور يدوي</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm font-medium mb-1 block">الموظف</label>
              <Select value={overrideForm.userId} onValueChange={v => setOverrideForm(f => ({ ...f, userId: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                <SelectContent>{summary.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.full_name || s.email}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium mb-1 block">التاريخ</label><Input type="date" value={overrideForm.date} onChange={e => setOverrideForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-sm font-medium mb-1 block">وقت الحضور</label><Input type="time" value={overrideForm.checkIn} onChange={e => setOverrideForm(f => ({ ...f, checkIn: overrideForm.date + "T" + e.target.value }))} /></div>
              <div><label className="text-sm font-medium mb-1 block">وقت الانصراف</label><Input type="time" value={overrideForm.checkOut} onChange={e => setOverrideForm(f => ({ ...f, checkOut: overrideForm.date + "T" + e.target.value }))} /></div>
            </div>
            <div><label className="text-sm font-medium mb-1 block">ملاحظة</label><Input value={overrideForm.notes} onChange={e => setOverrideForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <Button className="w-full" onClick={doOverride}>حفظ التعديل</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── FinancialDashboard ──────────────────────────────────────────────────────
function FinancialDashboard({ staffRole }: { staffRole: string }) {
  const qc = useQueryClient();
  const { data: summary, isLoading } = useQuery<any>({
    queryKey: ["/api/staff/financial-summary"],
    queryFn: async () => { const r = await fetch("/api/staff/financial-summary", { credentials: "include" }); return r.ok ? r.json() : null; },
    refetchInterval: 60000,
  });
  const { data: pendingOrders = [], refetch: refetchPending } = useQuery<any[]>({
    queryKey: ["/api/staff/orders/pending-verification"],
    queryFn: async () => { const r = await fetch("/api/staff/orders/pending-verification", { credentials: "include" }); return r.ok ? r.json() : []; },
    refetchInterval: 30000,
  });
  const { data: allOrders = [] } = useQuery<any[]>({
    queryKey: ["/api/staff/orders"],
    queryFn: async () => { const r = await fetch("/api/staff/orders", { credentials: "include" }); return r.ok ? r.json() : []; },
  });

  const { toast } = useToast();
  const approvePayment = async (orderId: number, status: string) => {
    const r = await fetch(`/api/staff/orders/${orderId}/payment`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ paymentStatus: status }) });
    if (r.ok) { toast({ title: status === "transferred" ? "✅ تم اعتماد الدفع" : "❌ تم رفض الدفع" }); refetchPending(); qc.invalidateQueries({ queryKey: ["/api/staff/orders"] }); }
  };

  const stats = summary ? [
    { label: "المبالغ المحصّلة (30 يوم)", value: `${fmt(summary.collected_amount)} ر.ي`, icon: CheckCircle, color: "text-green-600 bg-green-50" },
    { label: "مبالغ معلّقة", value: `${fmt(summary.pending_amount)} ر.ي`, icon: Clock, color: "text-yellow-600 bg-yellow-50" },
    { label: "طلبات مكتملة", value: summary.delivered_count || 0, icon: TrendingUp, color: "text-blue-600 bg-blue-50" },
    { label: "تحصيل كاش", value: summary.cod_collected_count || 0, icon: Banknote, color: "text-emerald-600 bg-emerald-50" },
    { label: "غير محصّل", value: summary.unpaid_count || 0, icon: AlertCircle, color: "text-orange-600 bg-orange-50" },
    { label: "ملغاة", value: summary.cancelled_count || 0, icon: XCircle, color: "text-red-600 bg-red-50" },
  ] : [];

  return (
    <Tabs defaultValue="summary">
      <TabsList className="grid w-full grid-cols-5 mb-4 bg-white border shadow-sm rounded-xl text-xs h-auto">
        {[
          { value: "summary", label: "ملخص", icon: BarChart2 },
          { value: "receipts", label: `إيصالات (${pendingOrders.length})`, icon: FileText },
          { value: "expenses", label: "مصاريف", icon: DollarSign },
          { value: "assets", label: "أصول", icon: Building2 },
          { value: "payroll", label: "رواتب", icon: Users },
        ].map(t => (
          <TabsTrigger key={t.value} value={t.value} className="flex flex-col items-center gap-0.5 py-2 text-xs rounded-lg">
            <t.icon className="w-3.5 h-3.5" />
            <span className="text-[10px] leading-none">{t.label}</span>
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="summary">
        {isLoading ? <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div> : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {stats.map((s, i) => { const Icon = s.icon; return (
                <Card key={i} className="border-0 shadow-sm"><CardContent className="p-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${s.color}`}><Icon className="w-5 h-5" /></div>
                  <div className="font-bold text-lg">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </CardContent></Card>
              ); })}
            </div>
            <Card><CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><AlertCircle className="w-5 h-5 text-orange-500" />الطلبات غير المحصّلة ({allOrders.filter(o => (o.payment_status||"unpaid")==="unpaid" && o.status!=="cancelled").length})</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="divide-y max-h-72 overflow-y-auto">
                  {allOrders.filter(o => (o.payment_status||"unpaid")==="unpaid" && o.status!=="cancelled").map(o => (
                    <div key={o.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <div><span className="font-medium">#{o.id}</span> — {o.customer_name}</div>
                      <div className="flex items-center gap-2"><span className="font-bold text-orange-600">{fmt(o.total)} ر.ي</span></div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </TabsContent>

      <TabsContent value="receipts">
        <div className="space-y-3">
          {pendingOrders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30 text-green-500" />لا توجد إيصالات بانتظار التحقق 🎉</div>
          ) : pendingOrders.map((o: any) => {
            const pmInfo = paymentMethodLabel[o.payment_method] || { label: o.payment_method, icon: Banknote };
            const PmIcon = pmInfo.icon;
            return (
              <Card key={o.id} className="border-orange-200 bg-orange-50/30">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="font-bold text-primary">#{o.id}</span>
                      <span className="text-sm mr-2">{o.customer_name}</span>
                    </div>
                    <span className="font-bold text-green-700">{fmt(o.total)} ر.ي</span>
                  </div>
                  <div className="flex items-center gap-2 mb-3 text-sm">
                    <PmIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{pmInfo.label}</span>
                    {o.purchase_code && <span className="font-mono bg-white px-2 py-0.5 rounded border text-xs">#{o.purchase_code}</span>}
                    <span className="text-xs text-muted-foreground mr-auto">{new Date(o.created_at).toLocaleDateString("ar-SA")}</span>
                  </div>
                  {o.customer_phone && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                      <Phone className="w-3.5 h-3.5" />{o.customer_phone}
                      <a href={`https://wa.me/${(o.customer_phone||"").replace(/\D/g,"")}`} target="_blank" rel="noreferrer" className="text-green-600"><MessageCircle className="w-3.5 h-3.5" /></a>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700" onClick={() => approvePayment(o.id, "transferred")}><CheckCircle className="w-3 h-3 ml-1" />اعتماد الدفع</Button>
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={() => approvePayment(o.id, "unpaid")}>رفض / إلغاء</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </TabsContent>

      <TabsContent value="expenses"><ExpensesPanel /></TabsContent>
      <TabsContent value="assets"><AssetsPanel /></TabsContent>
      <TabsContent value="payroll">
        <Tabs defaultValue="payroll-calc">
          <TabsList className="w-full grid grid-cols-2 mb-4 h-8 text-xs">
            <TabsTrigger value="payroll-calc" className="text-xs">احتساب الرواتب</TabsTrigger>
            <TabsTrigger value="attendance-sum" className="text-xs">سجل الدوام</TabsTrigger>
          </TabsList>
          <TabsContent value="payroll-calc"><PayrollPanel /></TabsContent>
          <TabsContent value="attendance-sum"><AttendanceSummaryPanel /></TabsContent>
        </Tabs>
      </TabsContent>
    </Tabs>
  );
}

// ── ProductsDashboard (enhanced with add/edit) ──────────────────────────────
function ProductsDashboard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", price: "", priceSar: "", categoryId: "", stock: "0", description: "" });

  const { data: products = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/staff/products"],
    queryFn: async () => { const r = await fetch("/api/staff/products", { credentials: "include" }); return r.ok ? r.json() : []; },
  });
  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["/api/categories"],
    queryFn: async () => { const r = await fetch("/api/categories"); return r.ok ? r.json() : []; },
  });
  const catMap: Record<number, string> = {};
  categories.forEach((c: any) => { catMap[c.id] = c.name; });

  const save = async () => {
    if (!form.name || !form.price || !form.categoryId) { toast({ title: "الاسم والسعر والفئة مطلوبة", variant: "destructive" }); return; }
    const url = editing ? `/api/staff/products/${editing.id}` : "/api/staff/products";
    const method = editing ? "PUT" : "POST";
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ ...form, categoryId: Number(form.categoryId) }) });
    const d = await r.json();
    if (!r.ok) { toast({ title: "خطأ", description: d.message, variant: "destructive" }); return; }
    toast({ title: editing ? "✅ تم التعديل" : "✅ تم الإضافة" });
    qc.invalidateQueries({ queryKey: ["/api/staff/products"] });
    setShowForm(false); setEditing(null); setForm({ name: "", price: "", priceSar: "", categoryId: "", stock: "0", description: "" });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{products.length} منتج</p>
        <Button size="sm" onClick={() => { setEditing(null); setForm({ name: "", price: "", priceSar: "", categoryId: "", stock: "0", description: "" }); setShowForm(true); }}>
          <Plus className="w-4 h-4 ml-1" />إضافة منتج
        </Button>
      </div>

      {isLoading ? <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div> : (
        <div className="space-y-2">
          {products.map((p: any) => (
            <Card key={p.id} className="border shadow-sm">
              <CardContent className="p-3 flex items-center gap-3">
                {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="w-14 h-14 rounded-lg object-cover shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{catMap[p.categoryId] || "—"}</p>
                  <p className="text-xs font-bold text-primary mt-1">{fmt(p.price)} ر.ي{p.priceSar && ` / ${fmt(p.priceSar)} ر.س`}</p>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <Badge variant={p.stock > 0 ? "default" : "destructive"} className="text-xs block">{p.stock > 0 ? `${p.stock} متوفر` : "نفذ"}</Badge>
                  <button onClick={() => { setEditing(p); setForm({ name: p.name, price: p.price, priceSar: p.priceSar||"", categoryId: String(p.categoryId||""), stock: String(p.stock||0), description: p.description||"" }); setShowForm(true); }} className="text-blue-500 hover:text-blue-700 block mx-auto"><Edit className="w-3.5 h-3.5" /></button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader><DialogTitle>{editing ? "تعديل منتج" : "إضافة منتج جديد"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm font-medium mb-1 block">اسم المنتج *</label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label className="text-sm font-medium mb-1 block">الفئة *</label>
              <Select value={form.categoryId} onValueChange={v => setForm(f => ({ ...f, categoryId: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر الفئة" /></SelectTrigger>
                <SelectContent>{categories.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-sm font-medium mb-1 block">السعر ر.ي *</label><Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} /></div>
              <div><label className="text-sm font-medium mb-1 block">السعر ر.س</label><Input type="number" value={form.priceSar} onChange={e => setForm(f => ({ ...f, priceSar: e.target.value }))} /></div>
            </div>
            <div><label className="text-sm font-medium mb-1 block">المخزون</label><Input type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} /></div>
            <div><label className="text-sm font-medium mb-1 block">الوصف</label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <Button className="w-full" onClick={save}>{editing ? "حفظ التعديلات" : "إضافة"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── MyAttendance Panel ──────────────────────────────────────────────────────
function MyAttendancePanel() {
  const { data: history = [] } = useQuery<any[]>({
    queryKey: ["/api/staff/attendance/history"],
    queryFn: async () => { const r = await fetch("/api/staff/attendance/history", { credentials: "include" }); return r.ok ? r.json() : []; },
  });
  const totalMins = history.reduce((s: number, a: any) => s + (a.total_minutes || 0), 0);
  const days = new Set(history.map((a: any) => a.date)).size;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-0 shadow-sm bg-blue-50"><CardContent className="p-3 text-center"><div className="text-xs text-blue-600">أيام العمل</div><div className="font-bold text-xl text-blue-700">{days}</div></CardContent></Card>
        <Card className="border-0 shadow-sm bg-green-50"><CardContent className="p-3 text-center"><div className="text-xs text-green-600">إجمالي الساعات</div><div className="font-bold text-xl text-green-700">{Math.round(totalMins / 60)}</div></CardContent></Card>
      </div>
      <div className="space-y-2">
        {history.slice(0, 14).map((a: any) => (
          <div key={a.id} className="flex items-center justify-between bg-white border rounded-lg px-3 py-2 text-sm">
            <div className="font-medium">{a.date}</div>
            <div className="flex items-center gap-3 text-muted-foreground text-xs">
              <span>دخول: {a.check_in ? new Date(a.check_in).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" }) : "—"}</span>
              <span>خروج: {a.check_out ? new Date(a.check_out).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" }) : "—"}</span>
              {a.total_minutes && <span className="font-medium text-primary">{fmtMins(a.total_minutes)}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main StaffPortal ────────────────────────────────────────────────────────
export default function StaffPortal() {
  const [staffUser, setStaffUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/staff/me", { credentials: "include" }).then(r => r.ok ? r.json() : null).then(u => { if (u) setStaffUser(u); }).finally(() => setCheckingAuth(false));
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setStaffUser(null);
    toast({ title: "تم تسجيل الخروج" });
  };

  if (checkingAuth) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-white text-center"><RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />جاري التحقق...</div>
    </div>
  );
  if (!staffUser) return <StaffLogin onLogin={setStaffUser} />;

  const role = staffUser.role;

  const tabs: { value: string; label: string; icon: any }[] = [];
  if (role === "delivery") {
    tabs.push({ value: "my-orders", label: "طلباتي", icon: Truck });
    tabs.push({ value: "my-attendance", label: "دوامي", icon: Timer });
  }
  if (role === "order_manager" || role === "owner") {
    tabs.push({ value: "orders", label: "الطلبات", icon: ShoppingBag });
  }
  if (role === "finance" || role === "owner") {
    tabs.push({ value: "financial", label: "المالية", icon: Banknote });
  }
  if (role === "product_manager" || role === "owner") {
    tabs.push({ value: "products", label: "المنتجات", icon: Package });
    tabs.push({ value: "my-attendance", label: "دوامي", icon: Timer });
  }
  if (role === "order_manager") {
    tabs.push({ value: "my-attendance", label: "دوامي", icon: Timer });
  }
  if (role === "owner") {
    tabs.push({ value: "all-orders", label: "كل الطلبات", icon: BarChart2 });
    tabs.push({ value: "my-attendance", label: "دوامي", icon: Timer });
  }

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div>
            <h1 className="font-bold text-base">أويو بلاست</h1>
            <p className="text-xs text-muted-foreground">{roleLabels[role] || role}</p>
          </div>
          <div className="flex items-center gap-2">
            <AttendanceWidget userId={staffUser.id} />
            <div className="text-right hidden sm:block"><p className="text-xs font-medium">{staffUser.fullName || staffUser.email}</p></div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-red-500 hover:text-red-600 h-8 w-8 p-0"><LogOut className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {tabs.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground"><AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />لا توجد صلاحيات مخصصة لحسابك</div>
        ) : (
          <Tabs defaultValue={tabs[0].value}>
            <TabsList className="grid w-full mb-4 bg-white border shadow-sm rounded-xl" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
              {tabs.map(t => {
                const Icon = t.icon;
                return (
                  <TabsTrigger key={t.value} value={t.value} className="text-xs flex items-center gap-1 rounded-lg py-2">
                    <Icon className="w-3.5 h-3.5" />{t.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {role === "delivery" && <TabsContent value="my-orders"><OrdersDashboard staffRole={role} /></TabsContent>}
            {(role === "order_manager" || role === "owner") && <TabsContent value="orders"><OrdersDashboard staffRole={role} /></TabsContent>}
            {(role === "finance" || role === "owner") && <TabsContent value="financial"><FinancialDashboard staffRole={role} /></TabsContent>}
            {(role === "product_manager" || role === "owner") && <TabsContent value="products"><ProductsDashboard /></TabsContent>}
            {role === "owner" && <TabsContent value="all-orders"><OrdersDashboard staffRole="owner" /></TabsContent>}
            <TabsContent value="my-attendance"><MyAttendancePanel /></TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
