import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Search, Users, Wallet, Snowflake, History, Save, AlertCircle,
  Pencil, Phone, RefreshCw, ShieldOff, Filter, X, TrendingUp,
} from "lucide-react";

interface Tier {
  id: number;
  tier_key: string;
  tier_name_ar: string;
  tier_icon: string;
  tier_color: string;
  credit_limit: string;
  payment_term_days: number;
  down_payment_percent: string;
  cash_discount_percent: string;
}

interface CreditCustomer {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  user_created_at: string;
  credit_id: number | null;
  tier: string;
  manual_override: boolean;
  credit_limit_override: string | null;
  discount_override: string | null;
  payment_term_override: number | null;
  down_payment_override: string | null;
  opening_balance: string;
  current_balance: string;
  total_orders: number;
  total_paid_amount: string;
  on_time_payments: number;
  late_payments: number;
  last_order_at: string | null;
  last_payment_at: string | null;
  is_frozen: boolean;
  frozen_until: string | null;
  frozen_reason: string | null;
  admin_notes: string | null;
}

interface HistoryEntry {
  id: number;
  customer_id: string;
  from_tier: string | null;
  to_tier: string;
  reason: string;
  changed_by: string;
  notes: string | null;
  created_at: string;
}

const fmt = (n: string | number | null) =>
  n == null ? "0" : Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" });
};

export default function AdminCreditCustomers({ adminToken }: { adminToken: string | null }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [frozenFilter, setFrozenFilter] = useState(false);
  const [debtFilter, setDebtFilter] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [freezingId, setFreezingId] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);

  // ── جلب الفئات (للقوائم المنسدلة) ──
  const tiersQuery = useQuery<Tier[]>({
    queryKey: ["/api/admin/credit/tiers"],
    queryFn: async () => {
      const r = await fetch("/api/admin/credit/tiers", {
        headers: { "x-admin-token": adminToken || "" },
        cache: "no-store",
      });
      if (!r.ok) throw new Error("فشل تحميل الفئات");
      return r.json();
    },
    enabled: !!adminToken,
    staleTime: 60_000,
  });

  // ── جلب قائمة العملاء ──
  const params = new URLSearchParams();
  if (tierFilter !== "all") params.set("tier", tierFilter);
  if (frozenFilter) params.set("frozen", "true");
  if (debtFilter) params.set("hasDebt", "true");
  if (search.trim()) params.set("search", search.trim());
  params.set("limit", "200");

  const customersQuery = useQuery<CreditCustomer[]>({
    queryKey: ["/api/admin/credit/customers", tierFilter, frozenFilter, debtFilter, search],
    queryFn: async () => {
      const r = await fetch(`/api/admin/credit/customers?${params.toString()}`, {
        headers: { "x-admin-token": adminToken || "" },
        cache: "no-store",
      });
      if (!r.ok) throw new Error("فشل تحميل العملاء");
      return r.json();
    },
    enabled: !!adminToken,
    staleTime: 30_000,
  });

  const tiers = tiersQuery.data || [];
  const customers = customersQuery.data || [];
  const editingCustomer = useMemo(
    () => customers.find((c) => c.id === editingId) || null,
    [customers, editingId],
  );
  const freezingCustomer = useMemo(
    () => customers.find((c) => c.id === freezingId) || null,
    [customers, freezingId],
  );

  // ── إحصائيات سريعة ──
  const stats = useMemo(() => {
    const totalDebt = customers.reduce((s, c) => s + Number(c.current_balance || 0), 0);
    const frozenCount = customers.filter((c) => c.is_frozen).length;
    const debtors = customers.filter((c) => Number(c.current_balance || 0) > 0).length;
    const byTier = tiers.reduce<Record<string, number>>((acc, t) => {
      acc[t.tier_key] = customers.filter((c) => c.tier === t.tier_key).length;
      return acc;
    }, {});
    return { totalDebt, frozenCount, debtors, byTier, total: customers.length };
  }, [customers, tiers]);

  if (!adminToken) {
    return <div className="text-center py-8 text-muted-foreground">يجب تسجيل الدخول كمسؤول</div>;
  }

  return (
    <div className="space-y-5" dir="rtl" data-testid="admin-credit-customers">
      {/* ═══ رأس الصفحة ═══ */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            العملاء والائتمان
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة فئات العملاء، الأرصدة، التجاوزات اليدوية، والتجميد
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => customersQuery.refetch()}
          data-testid="button-refresh-customers"
        >
          <RefreshCw className={`h-4 w-4 ms-2 ${customersQuery.isFetching ? "animate-spin" : ""}`} />
          تحديث
        </Button>
      </div>

      {/* ═══ بطاقات الإحصائيات ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="إجمالي العملاء"
          value={fmt(stats.total)}
          color="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"
        />
        <StatCard
          icon={<Wallet className="h-5 w-5" />}
          label="إجمالي الديون"
          value={`${fmt(stats.totalDebt)} ر.ي`}
          color="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="عليهم ديون"
          value={fmt(stats.debtors)}
          color="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300"
        />
        <StatCard
          icon={<Snowflake className="h-5 w-5" />}
          label="مجمَّدون"
          value={fmt(stats.frozenCount)}
          color="bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300"
        />
      </div>

      {/* ═══ شريط الفلاتر ═══ */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">الفلاتر والبحث</span>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <div className="relative md:col-span-2">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="ابحث بالاسم أو الهاتف أو البريد..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pe-10"
                data-testid="input-search-customer"
              />
            </div>
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger data-testid="select-tier-filter">
                <SelectValue placeholder="كل الفئات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الفئات</SelectItem>
                {tiers.map((t) => (
                  <SelectItem key={t.tier_key} value={t.tier_key}>
                    {t.tier_icon} {t.tier_name_ar}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={debtFilter ? "default" : "outline"}
              size="sm"
              onClick={() => setDebtFilter((v) => !v)}
              data-testid="button-filter-debt"
            >
              <Wallet className="h-4 w-4 ms-2" />
              عليهم ديون فقط
            </Button>
            <Button
              variant={frozenFilter ? "default" : "outline"}
              size="sm"
              onClick={() => setFrozenFilter((v) => !v)}
              data-testid="button-filter-frozen"
            >
              <Snowflake className="h-4 w-4 ms-2" />
              المجمَّدون فقط
            </Button>
            {(search || tierFilter !== "all" || frozenFilter || debtFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setTierFilter("all");
                  setFrozenFilter(false);
                  setDebtFilter(false);
                }}
                data-testid="button-clear-filters"
              >
                <X className="h-4 w-4 ms-2" />
                مسح الفلاتر
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ═══ جدول العملاء ═══ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span>قائمة العملاء</span>
            <Badge variant="outline">{customers.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {customersQuery.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : customersQuery.error ? (
            <div className="text-center py-8 text-red-600">
              <AlertCircle className="h-8 w-8 mx-auto mb-2" />
              <p>{(customersQuery.error as Error).message}</p>
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>لا يوجد عملاء مطابقون للفلاتر</p>
            </div>
          ) : (
            <div className="space-y-2">
              {customers.map((customer) => (
                <CustomerRow
                  key={customer.id}
                  customer={customer}
                  tiers={tiers}
                  onEdit={() => setEditingId(customer.id)}
                  onFreeze={() => setFreezingId(customer.id)}
                  onHistory={() => setHistoryId(customer.id)}
                  adminToken={adminToken}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ نوافذ منبثقة ═══ */}
      {editingCustomer && (
        <EditCustomerDialog
          customer={editingCustomer}
          tiers={tiers}
          adminToken={adminToken}
          onClose={() => setEditingId(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["/api/admin/credit/customers"] });
            setEditingId(null);
            toast({ title: "✅ تم حفظ بيانات العميل" });
          }}
        />
      )}

      {freezingCustomer && (
        <FreezeCustomerDialog
          customer={freezingCustomer}
          adminToken={adminToken}
          onClose={() => setFreezingId(null)}
          onDone={(action) => {
            qc.invalidateQueries({ queryKey: ["/api/admin/credit/customers"] });
            setFreezingId(null);
            toast({
              title: action === "freeze" ? "❄️ تم تجميد العميل" : "✅ تم فك التجميد",
            });
          }}
        />
      )}

      {historyId && (
        <HistoryDialog
          customerId={historyId}
          customerName={customers.find((c) => c.id === historyId)?.full_name || "عميل"}
          adminToken={adminToken}
          onClose={() => setHistoryId(null)}
        />
      )}
    </div>
  );
}

// ─── بطاقة إحصائية ─────────────────────────────────────────────────────────
function StatCard({
  icon, label, value, color,
}: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`inline-flex items-center justify-center p-2 rounded-lg mb-2 ${color}`}>
          {icon}
        </div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

// ─── صف عميل ─────────────────────────────────────────────────────────────
function CustomerRow({
  customer, tiers, onEdit, onFreeze, onHistory,
}: {
  customer: CreditCustomer;
  tiers: Tier[];
  onEdit: () => void;
  onFreeze: () => void;
  onHistory: () => void;
  adminToken: string | null;
}) {
  const tierInfo = tiers.find((t) => t.tier_key === customer.tier);
  const balance = Number(customer.current_balance || 0);
  const limit = Number(customer.credit_limit_override || tierInfo?.credit_limit || 0);
  const utilization = limit > 0 ? Math.min(100, (balance / limit) * 100) : 0;

  return (
    <div
      className={`border rounded-lg p-3 transition-all hover:shadow-sm ${
        customer.is_frozen ? "bg-cyan-50/50 dark:bg-cyan-950/20 border-cyan-300" : "bg-card"
      }`}
      data-testid={`row-customer-${customer.id}`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        {/* معلومات العميل */}
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-2xl" style={{ color: tierInfo?.tier_color }}>
              {tierInfo?.tier_icon || "👤"}
            </span>
            <h3 className="font-bold" data-testid={`text-name-${customer.id}`}>
              {customer.full_name || "بدون اسم"}
            </h3>
            <Badge
              variant="outline"
              className="text-xs"
              style={{ borderColor: tierInfo?.tier_color, color: tierInfo?.tier_color }}
            >
              {tierInfo?.tier_name_ar || customer.tier}
            </Badge>
            {customer.manual_override && (
              <Badge variant="secondary" className="text-xs">
                ⚙️ تجاوز يدوي
              </Badge>
            )}
            {customer.is_frozen && (
              <Badge className="text-xs bg-cyan-600">
                <Snowflake className="h-3 w-3 ms-1" />
                مجمَّد
              </Badge>
            )}
          </div>
          {customer.phone && (
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {customer.phone}
            </div>
          )}
        </div>

        {/* الرصيد */}
        <div className="text-end">
          <p className="text-xs text-muted-foreground">الرصيد الحالي</p>
          <p
            className={`text-xl font-bold ${balance > 0 ? "text-red-600" : "text-green-600"}`}
            data-testid={`text-balance-${customer.id}`}
          >
            {fmt(customer.current_balance)} ر.ي
          </p>
          <p className="text-xs text-muted-foreground">من {fmt(limit)}</p>
        </div>
      </div>

      {/* شريط الاستخدام */}
      {limit > 0 && (
        <div className="mt-3">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                utilization >= 90 ? "bg-red-500" : utilization >= 70 ? "bg-amber-500" : "bg-green-500"
              }`}
              style={{ width: `${utilization}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>استخدام {utilization.toFixed(0)}%</span>
            <span>{customer.total_orders} طلب • آخر طلب: {fmtDate(customer.last_order_at)}</span>
          </div>
        </div>
      )}

      {/* أزرار الإجراءات */}
      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          data-testid={`button-edit-${customer.id}`}
        >
          <Pencil className="h-3.5 w-3.5 ms-1" />
          تعديل
        </Button>
        <Button
          variant={customer.is_frozen ? "default" : "outline"}
          size="sm"
          onClick={onFreeze}
          className={customer.is_frozen ? "bg-cyan-600 hover:bg-cyan-700" : ""}
          data-testid={`button-freeze-${customer.id}`}
        >
          {customer.is_frozen ? (
            <>
              <ShieldOff className="h-3.5 w-3.5 ms-1" />
              فك التجميد
            </>
          ) : (
            <>
              <Snowflake className="h-3.5 w-3.5 ms-1" />
              تجميد
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onHistory}
          data-testid={`button-history-${customer.id}`}
        >
          <History className="h-3.5 w-3.5 ms-1" />
          السجل
        </Button>
      </div>
    </div>
  );
}

// ─── نافذة تعديل العميل ──────────────────────────────────────────────────
function EditCustomerDialog({
  customer, tiers, adminToken, onClose, onSaved,
}: {
  customer: CreditCustomer;
  tiers: Tier[];
  adminToken: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [activeTab, setActiveTab] = useState("tier");
  const [tier, setTier] = useState(customer.tier);
  const [manualOverride, setManualOverride] = useState(customer.manual_override);
  const [creditLimitOverride, setCreditLimitOverride] = useState(customer.credit_limit_override || "");
  const [discountOverride, setDiscountOverride] = useState(customer.discount_override || "");
  const [paymentTermOverride, setPaymentTermOverride] = useState(
    customer.payment_term_override?.toString() || "",
  );
  const [downPaymentOverride, setDownPaymentOverride] = useState(customer.down_payment_override || "");
  const [openingBalance, setOpeningBalance] = useState(customer.opening_balance || "0");
  const [adminNotes, setAdminNotes] = useState(customer.admin_notes || "");

  const tierInfo = tiers.find((t) => t.tier_key === tier);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        tier,
        manualOverride,
        creditLimitOverride: manualOverride && creditLimitOverride ? creditLimitOverride : null,
        discountOverride: manualOverride && discountOverride ? discountOverride : null,
        paymentTermOverride: manualOverride && paymentTermOverride ? Number(paymentTermOverride) : null,
        downPaymentOverride: manualOverride && downPaymentOverride ? downPaymentOverride : null,
        openingBalance,
        adminNotes,
      };
      const r = await fetch(`/api/admin/credit/customers/${customer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken || "" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json()).message || "فشل الحفظ");
      return r.json();
    },
    onSuccess: onSaved,
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{tierInfo?.tier_icon}</span>
            تعديل: {customer.full_name || customer.phone || customer.id.slice(0, 8)}
          </DialogTitle>
          <DialogDescription>
            تعديل فئة العميل أو إضافة تجاوز يدوي خاص به
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="tier" data-testid="tab-tier">الفئة</TabsTrigger>
            <TabsTrigger value="override" data-testid="tab-override">تجاوز يدوي</TabsTrigger>
            <TabsTrigger value="balance" data-testid="tab-balance">الرصيد</TabsTrigger>
          </TabsList>

          {/* تبويب الفئة */}
          <TabsContent value="tier" className="space-y-4 pt-3">
            <div>
              <Label>اختر الفئة</Label>
              <Select value={tier} onValueChange={setTier}>
                <SelectTrigger data-testid="select-customer-tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tiers.map((t) => (
                    <SelectItem key={t.tier_key} value={t.tier_key}>
                      {t.tier_icon} {t.tier_name_ar} — سقف {fmt(t.credit_limit)} / {t.payment_term_days} يوم
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {tierInfo && (
              <Card className="bg-muted/30">
                <CardContent className="p-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">السقف الافتراضي</p>
                    <p className="font-bold">{fmt(tierInfo.credit_limit)} ر.ي</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">مدة السداد</p>
                    <p className="font-bold">{tierInfo.payment_term_days} يوم</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">الدفعة المقدمة</p>
                    <p className="font-bold">{tierInfo.down_payment_percent}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">خصم الكاش</p>
                    <p className="font-bold text-green-600">{tierInfo.cash_discount_percent}%</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* تبويب التجاوز اليدوي */}
          <TabsContent value="override" className="space-y-4 pt-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200">
              <div>
                <Label className="font-bold">تفعيل التجاوز اليدوي</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  استخدم القيم المخصصة بدلاً من قيم الفئة الافتراضية
                </p>
              </div>
              <Switch
                checked={manualOverride}
                onCheckedChange={setManualOverride}
                data-testid="switch-manual-override"
              />
            </div>

            {manualOverride && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>سقف ائتماني خاص (ر.ي)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={creditLimitOverride}
                    onChange={(e) => setCreditLimitOverride(e.target.value)}
                    placeholder={`الافتراضي: ${fmt(tierInfo?.credit_limit ?? 0)}`}
                    data-testid="input-limit-override"
                  />
                </div>
                <div>
                  <Label>مدة سداد خاصة (يوم)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={paymentTermOverride}
                    onChange={(e) => setPaymentTermOverride(e.target.value)}
                    placeholder={`الافتراضي: ${tierInfo?.payment_term_days}`}
                    data-testid="input-term-override"
                  />
                </div>
                <div>
                  <Label>خصم كاش خاص %</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={discountOverride}
                    onChange={(e) => setDiscountOverride(e.target.value)}
                    placeholder={`الافتراضي: ${tierInfo?.cash_discount_percent}%`}
                    data-testid="input-discount-override"
                  />
                </div>
                <div>
                  <Label>دفعة مقدمة خاصة %</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={downPaymentOverride}
                    onChange={(e) => setDownPaymentOverride(e.target.value)}
                    placeholder={`الافتراضي: ${tierInfo?.down_payment_percent}%`}
                    data-testid="input-down-override"
                  />
                </div>
              </div>
            )}
          </TabsContent>

          {/* تبويب الرصيد */}
          <TabsContent value="balance" className="space-y-4 pt-3">
            <div>
              <Label>الرصيد الافتتاحي (ديون قديمة من نظام SMS)</Label>
              <Input
                type="number"
                min="0"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="0"
                data-testid="input-opening-balance"
              />
              <p className="text-xs text-muted-foreground mt-1">
                💡 استخدم هذا الحقل لاستيراد ديون العميل المتراكمة قبل تفعيل النظام
              </p>
            </div>

            <Card className="bg-muted/30">
              <CardContent className="p-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">الرصيد الحالي</p>
                  <p className="font-bold text-red-600">{fmt(customer.current_balance)} ر.ي</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">إجمالي المدفوع</p>
                  <p className="font-bold text-green-600">{fmt(customer.total_paid_amount)} ر.ي</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">دفع في الوقت</p>
                  <p className="font-bold">{customer.on_time_payments} مرة</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">تأخر في الدفع</p>
                  <p className="font-bold text-amber-600">{customer.late_payments} مرة</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="border-t pt-3">
          <Label>ملاحظات إدارية (اختياري)</Label>
          <Textarea
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            rows={2}
            placeholder="مثال: عميل قديم منذ 5 سنوات، التزام ممتاز"
            data-testid="textarea-admin-notes"
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-edit">
            إلغاء
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            data-testid="button-save-customer"
          >
            {save.isPending ? (
              <Loader2 className="h-4 w-4 ms-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 ms-2" />
            )}
            حفظ التغييرات
          </Button>
        </DialogFooter>
        {save.error && (
          <div className="text-sm text-red-600 mt-2">
            ❌ {(save.error as Error).message}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── نافذة التجميد ───────────────────────────────────────────────────────
function FreezeCustomerDialog({
  customer, adminToken, onClose, onDone,
}: {
  customer: CreditCustomer;
  adminToken: string | null;
  onClose: () => void;
  onDone: (action: "freeze" | "unfreeze") => void;
}) {
  const [reason, setReason] = useState("");
  const [untilDate, setUntilDate] = useState("");

  const freeze = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/admin/credit/customers/${customer.id}/freeze`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken || "" },
        body: JSON.stringify({ reason, untilDate: untilDate || null }),
      });
      if (!r.ok) throw new Error("فشل التجميد");
      return r.json();
    },
    onSuccess: () => onDone("freeze"),
  });

  const unfreeze = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/admin/credit/customers/${customer.id}/unfreeze`, {
        method: "POST",
        headers: { "x-admin-token": adminToken || "" },
      });
      if (!r.ok) throw new Error("فشل فك التجميد");
      return r.json();
    },
    onSuccess: () => onDone("unfreeze"),
  });

  if (customer.is_frozen) {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>فك تجميد العميل</DialogTitle>
            <DialogDescription>
              {customer.full_name || customer.phone}
            </DialogDescription>
          </DialogHeader>

          {customer.frozen_reason && (
            <Card className="bg-cyan-50 dark:bg-cyan-950/30">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">سبب التجميد الحالي:</p>
                <p className="font-medium mt-1">{customer.frozen_reason}</p>
              </CardContent>
            </Card>
          )}

          <p className="text-sm">هل أنت متأكد من فك تجميد هذا العميل؟ سيستطيع الشراء بالأجل مجدداً.</p>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={onClose}>إلغاء</Button>
            <Button
              onClick={() => unfreeze.mutate()}
              disabled={unfreeze.isPending}
              data-testid="button-confirm-unfreeze"
            >
              {unfreeze.isPending ? <Loader2 className="h-4 w-4 ms-2 animate-spin" /> : <ShieldOff className="h-4 w-4 ms-2" />}
              تأكيد فك التجميد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-cyan-700">
            <Snowflake className="h-5 w-5" />
            تجميد العميل
          </DialogTitle>
          <DialogDescription>
            {customer.full_name || customer.phone} — لن يستطيع الشراء بالأجل حتى فك التجميد
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>سبب التجميد *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="مثال: تأخر في السداد لأكثر من 14 يوم"
              data-testid="textarea-freeze-reason"
            />
          </div>

          <div>
            <Label>التجميد حتى (اختياري)</Label>
            <Input
              type="date"
              value={untilDate}
              onChange={(e) => setUntilDate(e.target.value)}
              data-testid="input-freeze-until"
            />
            <p className="text-xs text-muted-foreground mt-1">
              اتركه فارغاً للتجميد بدون تاريخ نهاية
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button
            variant="destructive"
            onClick={() => freeze.mutate()}
            disabled={freeze.isPending || !reason.trim()}
            data-testid="button-confirm-freeze"
          >
            {freeze.isPending ? <Loader2 className="h-4 w-4 ms-2 animate-spin" /> : <Snowflake className="h-4 w-4 ms-2" />}
            تأكيد التجميد
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── نافذة السجل ─────────────────────────────────────────────────────────
function HistoryDialog({
  customerId, customerName, adminToken, onClose,
}: {
  customerId: string;
  customerName: string;
  adminToken: string | null;
  onClose: () => void;
}) {
  const historyQuery = useQuery<HistoryEntry[]>({
    queryKey: ["/api/admin/credit/customers", customerId, "history"],
    queryFn: async () => {
      const r = await fetch(`/api/admin/credit/customers/${customerId}/history`, {
        headers: { "x-admin-token": adminToken || "" },
      });
      if (!r.ok) throw new Error("فشل تحميل السجل");
      return r.json();
    },
  });

  const reasonLabel = (reason: string): string => {
    const map: Record<string, string> = {
      manual_admin: "تعديل إداري",
      freeze: "تجميد",
      unfreeze: "فك تجميد",
      auto_upgrade: "ترقية تلقائية",
      auto_downgrade: "تخفيض تلقائي",
    };
    return map[reason] || reason;
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            سجل تغييرات: {customerName}
          </DialogTitle>
        </DialogHeader>

        {historyQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (historyQuery.data || []).length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>لا يوجد سجل تغييرات بعد</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {(historyQuery.data || []).map((entry) => (
              <div
                key={entry.id}
                className="border rounded-lg p-3 text-sm"
                data-testid={`history-entry-${entry.id}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="outline">{reasonLabel(entry.reason)}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {fmtDate(entry.created_at)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {entry.from_tier && <span className="text-muted-foreground">{entry.from_tier}</span>}
                  {entry.from_tier && <span>←</span>}
                  <span className="font-bold">{entry.to_tier}</span>
                </div>
                {entry.notes && (
                  <p className="text-xs text-muted-foreground mt-1 border-t pt-1">{entry.notes}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">بواسطة: {entry.changed_by}</p>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
