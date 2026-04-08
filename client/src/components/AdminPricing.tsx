import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, TrendingUp, AlertTriangle, CheckCircle, XCircle,
  DollarSign, BarChart3, Factory, Package, ChevronDown, ChevronUp,
  ShieldCheck, Lightbulb, ArrowUpRight
} from "lucide-react";

const fmt = (n: number | string | null | undefined) => n != null ? Number(n).toLocaleString("ar-YE") : "—";
const fmtPct = (n: number | string | null | undefined) => n != null ? `${Number(n).toFixed(1)}%` : "—";

function marginBadge(status: string) {
  switch (status) {
    case "danger":  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700"><XCircle className="h-3 w-3" />خطر</span>;
    case "warning": return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700"><AlertTriangle className="h-3 w-3" />تحذير</span>;
    case "safe":    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700"><CheckCircle className="h-3 w-3" />آمن</span>;
    default:        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-500">لا بيانات</span>;
  }
}

// ── نموذج التكاليف التشغيلية الشهرية ──────────────────────────────────────
function OperationalCostForm({ adminToken, onSaved }: { adminToken: string; onSaved: () => void }) {
  const { toast } = useToast();
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [form, setForm] = useState({
    month: defaultMonth, salaries: "", rent: "", marketing: "", logistics: "", other: "", totalOrders: "", notes: ""
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const total = ["salaries","rent","marketing","logistics","other"].reduce((s, k) => s + (Number((form as any)[k]) || 0), 0);
  const costPerOrder = form.totalOrders && Number(form.totalOrders) > 0 ? (total / Number(form.totalOrders)) : 0;

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/operational-costs", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
        body: JSON.stringify({
          month: form.month,
          salaries: Number(form.salaries) || 0,
          rent: Number(form.rent) || 0,
          marketing: Number(form.marketing) || 0,
          logistics: Number(form.logistics) || 0,
          other: Number(form.other) || 0,
          totalOrders: Number(form.totalOrders) || 1,
          notes: form.notes || undefined,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "✅ تم حفظ التكاليف التشغيلية وإعادة حساب أسعار المنتجات" });
      onSaved();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Factory className="h-4 w-4 text-blue-500" />
          إدخال التكاليف التشغيلية الشهرية
        </CardTitle>
        <p className="text-xs text-muted-foreground">كل تغيير يُعيد حساب خطوط الحماية لجميع المنتجات تلقائياً</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">الشهر (YYYY-MM)</Label>
            <Input value={form.month} onChange={e => set("month", e.target.value)} placeholder="2025-04" data-testid="input-op-month" />
          </div>
          <div>
            <Label className="text-xs">عدد الطلبات في الشهر</Label>
            <Input type="number" value={form.totalOrders} onChange={e => set("totalOrders", e.target.value)} placeholder="0" data-testid="input-op-orders" />
          </div>
          {[
            { key: "salaries",  label: "الرواتب والأجور", icon: "👥" },
            { key: "rent",      label: "الإيجار والمرافق", icon: "🏢" },
            { key: "marketing", label: "التسويق والإعلانات", icon: "📢" },
            { key: "logistics", label: "الشحن واللوجستيات", icon: "🚚" },
            { key: "other",     label: "أخرى (إهلاك، صيانة...)", icon: "⚙️" },
          ].map(({ key, label, icon }) => (
            <div key={key}>
              <Label className="text-xs">{icon} {label} (ر.ي)</Label>
              <Input type="number" value={(form as any)[key]} onChange={e => set(key, e.target.value)} placeholder="0" data-testid={`input-op-${key}`} />
            </div>
          ))}
        </div>

        {/* ملخص حسابي */}
        <div className="rounded-xl bg-blue-50 dark:bg-blue-950/20 p-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">إجمالي التكاليف الشهرية</span>
            <span className="font-bold">{fmt(total)} ر.ي</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">حصة التكلفة لكل طلب</span>
            <span className="font-black text-blue-700">{fmt(costPerOrder.toFixed(0))} ر.ي</span>
          </div>
        </div>

        <div>
          <Label className="text-xs">ملاحظات</Label>
          <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="ملاحظات اختيارية..." className="text-right text-sm min-h-[50px]" />
        </div>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="w-full" data-testid="button-save-op-costs">
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <ShieldCheck className="h-4 w-4 ml-2" />}
          حفظ وإعادة حساب جميع الأسعار
        </Button>
      </CardContent>
    </Card>
  );
}

// ── نموذج تكاليف منتج واحد ──────────────────────────────────────────────────
function ProductCostForm({ product, adminToken, onSaved }: { product: any; adminToken: string; onSaved: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    purchasePrice: product.purchase_price || "",
    inlandShipping: product.inland_shipping || "",
    storageCost: product.storage_cost || "",
    targetMarginPercent: product.target_margin_percent || "30",
    safetyMarginPercent: product.safety_margin_percent || "15",
    notes: product.cost_notes || "",
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // حساب معاينة فورية
  const opShare = Number(product.operational_share || 0);
  const purchase = Number(form.purchasePrice) || 0;
  const shipping = Number(form.inlandShipping) || 0;
  const storage  = Number(form.storageCost) || 0;
  const safety   = Number(form.safetyMarginPercent) || 15;
  const target   = Number(form.targetMarginPercent) || 30;
  const previewRed   = purchase + shipping + storage + opShare;
  const previewGreen = previewRed * (1 + safety / 100);
  const previewSugg  = previewGreen * (1 + target / 100);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/pricing/product/${product.id}/costs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
        body: JSON.stringify({
          purchasePrice: Number(form.purchasePrice) || 0,
          inlandShipping: Number(form.inlandShipping) || 0,
          storageCost: Number(form.storageCost) || 0,
          targetMarginPercent: Number(form.targetMarginPercent) || 30,
          safetyMarginPercent: Number(form.safetyMarginPercent) || 15,
          notes: form.notes || undefined,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: `✅ تم حفظ تكاليف "${product.name}"` });
      setOpen(false);
      onSaved();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const currentPrice = Number(product.price);
  const belowRed = product.red_line_price && currentPrice < Number(product.red_line_price);

  return (
    <Card className={`border-0 shadow-sm overflow-hidden transition-all ${
      product.margin_status === "danger" ? "ring-2 ring-red-300" :
      product.margin_status === "warning" ? "ring-1 ring-yellow-200" : ""
    }`}>
      <button
        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-right hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(!open)}
        data-testid={`toggle-product-cost-${product.id}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Package className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium text-sm truncate">{product.name}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {marginBadge(product.margin_status)}
          <div className="text-left text-xs text-muted-foreground">
            <div>سعر البيع: <span className="font-bold text-foreground">{fmt(product.price)}</span></div>
            {product.red_line_price && <div>الأحمر: <span className={`font-bold ${belowRed ? "text-red-600" : "text-muted-foreground"}`}>{fmt(product.red_line_price)}</span></div>}
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <CardContent className="pt-0 pb-4 px-4 border-t bg-muted/10 space-y-4">
          {/* خطوط الحماية الحالية */}
          {product.red_line_price && (
            <div className="grid grid-cols-3 gap-2 py-3">
              {[
                { label: "الحد الأحمر 🔴", val: product.red_line_price, color: "text-red-600" },
                { label: "الحد الأخضر 🟢", val: product.green_line_price, color: "text-green-600" },
                { label: "السعر المقترح 💡", val: product.suggested_price, color: "text-blue-600" },
              ].map(({ label, val, color }) => (
                <div key={label} className="text-center">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={`font-black text-sm ${color}`}>{fmt(val)}</p>
                </div>
              ))}
            </div>
          )}

          {/* نموذج التكاليف */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "purchasePrice",    label: "تكلفة الشراء (ر.ي)", icon: "💰" },
              { key: "inlandShipping",   label: "شحن داخلي (ر.ي)", icon: "🚚" },
              { key: "storageCost",      label: "تخزين (ر.ي)", icon: "📦" },
              { key: "targetMarginPercent", label: "هامش الهدف %", icon: "📈" },
            ].map(({ key, label, icon }) => (
              <div key={key}>
                <Label className="text-xs">{icon} {label}</Label>
                <Input type="number" value={(form as any)[key]} onChange={e => set(key, e.target.value)} data-testid={`input-cost-${key}-${product.id}`} />
              </div>
            ))}
          </div>

          {/* معاينة فورية */}
          {purchase > 0 && (
            <div className="rounded-xl bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950/20 p-3 space-y-1.5">
              <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1"><Lightbulb className="h-3 w-3" /> معاينة فورية (قبل الحفظ)</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "الحد الأحمر", val: previewRed, color: "text-red-600 bg-red-50" },
                  { label: "الحد الأخضر", val: previewGreen, color: "text-green-700 bg-green-50" },
                  { label: "السعر المقترح", val: previewSugg, color: "text-blue-700 bg-blue-50" },
                ].map(({ label, val, color }) => (
                  <div key={label} className={`rounded-lg p-1.5 ${color}`}>
                    <p className="text-xs opacity-70">{label}</p>
                    <p className="font-black text-sm">{fmt(Math.round(val))}</p>
                  </div>
                ))}
              </div>
              {opShare > 0 && (
                <p className="text-xs text-center text-muted-foreground">
                  + حصة تشغيلية: <span className="font-bold">{fmt(Math.round(opShare))}</span> ر.ي/طلب
                </p>
              )}
            </div>
          )}

          <div>
            <Label className="text-xs">ملاحظات</Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="ملاحظات..." className="text-right text-sm min-h-[50px]" />
          </div>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} size="sm" className="w-full" data-testid={`button-save-cost-${product.id}`}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <ShieldCheck className="h-4 w-4 ml-2" />}
            حفظ تكاليف المنتج
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

// ── المكوّن الرئيسي ──────────────────────────────────────────────────────────
export default function AdminPricing({ adminToken }: { adminToken: string | null }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: products = [], isLoading: loadingProducts, refetch: refetchProducts } = useQuery<any[]>({
    queryKey: ["/api/admin/pricing/products"],
    queryFn: async () => {
      const res = await fetch("/api/admin/pricing/products", { headers: { "x-admin-token": adminToken || "" } });
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: !!adminToken,
  });

  const { data: opCosts = [], isLoading: loadingOp, refetch: refetchOp } = useQuery<any[]>({
    queryKey: ["/api/admin/operational-costs"],
    queryFn: async () => {
      const res = await fetch("/api/admin/operational-costs", { headers: { "x-admin-token": adminToken || "" } });
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: !!adminToken,
  });

  const { data: report } = useQuery<any>({
    queryKey: ["/api/admin/pricing/report"],
    queryFn: async () => {
      const res = await fetch("/api/admin/pricing/report", { headers: { "x-admin-token": adminToken || "" } });
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: !!adminToken,
  });

  const onSaved = () => {
    refetchProducts();
    refetchOp();
    queryClient.invalidateQueries({ queryKey: ["/api/admin/pricing/report"] });
  };

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.margin_status === statusFilter;
    return matchSearch && matchStatus;
  });

  const danger  = products.filter(p => p.margin_status === "danger").length;
  const warning = products.filter(p => p.margin_status === "warning").length;
  const noData  = products.filter(p => p.margin_status === "no_data").length;
  const safe    = products.filter(p => p.margin_status === "safe").length;

  return (
    <div className="space-y-5 pb-10" dir="rtl">

      {/* بطاقات الملخص */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "منتجات في الخطر", val: danger,  bg: "from-red-50 to-rose-50",   text: "text-red-700",    icon: XCircle },
          { label: "تحذير (أقل الأخضر)", val: warning, bg: "from-yellow-50 to-amber-50", text: "text-yellow-700", icon: AlertTriangle },
          { label: "آمن (فوق الأخضر)", val: safe,   bg: "from-green-50 to-emerald-50", text: "text-green-700",  icon: CheckCircle },
          { label: "بلا بيانات تكلفة",  val: noData,  bg: "from-gray-50 to-slate-50",  text: "text-gray-500",   icon: Package },
        ].map(({ label, val, bg, text, icon: Icon }) => (
          <Card key={label} className={`border-0 shadow-sm bg-gradient-to-br ${bg}`}>
            <CardContent className="p-4 text-center">
              <Icon className={`h-5 w-5 mx-auto mb-1 ${text}`} />
              <p className={`text-2xl font-black ${text}`}>{val}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="products">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="products" className="text-xs" data-testid="tab-pricing-products">
            <Package className="h-3.5 w-3.5 ml-1" />تكاليف المنتجات
          </TabsTrigger>
          <TabsTrigger value="operational" className="text-xs" data-testid="tab-pricing-operational">
            <Factory className="h-3.5 w-3.5 ml-1" />التكاليف التشغيلية
          </TabsTrigger>
          <TabsTrigger value="report" className="text-xs" data-testid="tab-pricing-report">
            <BarChart3 className="h-3.5 w-3.5 ml-1" />تقرير الهوامش
          </TabsTrigger>
        </TabsList>

        {/* ── تبويب المنتجات ── */}
        <TabsContent value="products" className="space-y-3 mt-4">
          <div className="flex gap-2 flex-wrap items-center">
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="بحث عن منتج..."
              className="max-w-xs text-right"
              data-testid="input-search-pricing"
            />
            {["all","danger","warning","safe","no_data"].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                data-testid={`filter-pricing-${s}`}
              >
                {s === "all" ? "الكل" : s === "danger" ? "🔴 خطر" : s === "warning" ? "🟡 تحذير" : s === "safe" ? "🟢 آمن" : "⚪ بلا بيانات"}
              </button>
            ))}
          </div>

          {loadingProducts ? (
            <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-2">
              {filtered.map(p => (
                <ProductCostForm key={p.id} product={p} adminToken={adminToken || ""} onSaved={onSaved} />
              ))}
              {filtered.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">لا توجد منتجات بهذا الفلتر</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ── تبويب التكاليف التشغيلية ── */}
        <TabsContent value="operational" className="space-y-4 mt-4">
          <OperationalCostForm adminToken={adminToken || ""} onSaved={onSaved} />

          {/* جدول التاريخ */}
          {opCosts.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">سجل التكاليف الشهرية</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-xs text-muted-foreground">
                        {["الشهر","رواتب","إيجار","تسويق","لوجستيات","أخرى","الطلبات","تكلفة/طلب"].map(h => (
                          <th key={h} className="px-3 py-2 text-right font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {opCosts.map((row, i) => (
                        <tr key={row.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                          <td className="px-3 py-2 font-bold">{row.month}</td>
                          <td className="px-3 py-2">{fmt(row.salaries)}</td>
                          <td className="px-3 py-2">{fmt(row.rent)}</td>
                          <td className="px-3 py-2">{fmt(row.marketing)}</td>
                          <td className="px-3 py-2">{fmt(row.logistics)}</td>
                          <td className="px-3 py-2">{fmt(row.other)}</td>
                          <td className="px-3 py-2">{row.total_orders}</td>
                          <td className="px-3 py-2 font-black text-blue-700">{fmt(Math.round(row.cost_per_order))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── تبويب تقرير الهوامش ── */}
        <TabsContent value="report" className="space-y-4 mt-4">
          {report && (
            <>
              {/* ملخص */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "منتجات تحت التحليل", val: report.summary.total, color: "text-blue-700" },
                  { label: "في الخطر 🔴", val: report.summary.danger,  color: "text-red-600" },
                  { label: "تحذير 🟡", val: report.summary.warning, color: "text-yellow-600" },
                ].map(({ label, val, color }) => (
                  <Card key={label} className="border-0 shadow-sm">
                    <CardContent className="p-3 text-center">
                      <p className={`text-2xl font-black ${color}`}>{val}</p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* جدول المنتجات */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/50 text-muted-foreground">
                          {["المنتج","السعر الحالي","الحد الأحمر","الحد الأخضر","السعر المقترح","الهامش الفعلي%","الحالة"].map(h => (
                            <th key={h} className="px-3 py-2 text-right font-medium whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {report.products.map((p: any, i: number) => (
                          <tr key={p.id} className={`${i % 2 === 0 ? "" : "bg-muted/20"} ${p.margin_status === "danger" ? "bg-red-50/50" : p.margin_status === "warning" ? "bg-yellow-50/50" : ""}`}>
                            <td className="px-3 py-2 font-medium max-w-[120px] truncate">{p.name}</td>
                            <td className="px-3 py-2 font-bold">{fmt(p.current_price)}</td>
                            <td className="px-3 py-2 text-red-600 font-bold">{fmt(p.red_line_price)}</td>
                            <td className="px-3 py-2 text-green-600 font-bold">{fmt(p.green_line_price)}</td>
                            <td className="px-3 py-2 text-blue-600 font-bold">{fmt(p.suggested_price)}</td>
                            <td className={`px-3 py-2 font-black ${Number(p.actual_margin_pct) < 0 ? "text-red-600" : Number(p.actual_margin_pct) < 15 ? "text-yellow-600" : "text-green-600"}`}>
                              {fmtPct(p.actual_margin_pct)}
                            </td>
                            <td className="px-3 py-2">{marginBadge(p.margin_status)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {report.products.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">أضف تكاليف المنتجات أولاً لعرض التقرير</p>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
