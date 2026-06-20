import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Pencil, Settings2, Trophy, Power, RefreshCw, AlertCircle } from "lucide-react";

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
  min_orders_to_reach: number;
  min_months_to_reach: number;
  max_late_days_allowed: number;
  description: string | null;
  benefits: string[] | null;
  is_active: boolean;
  sort_order: number;
}

interface CreditSettings {
  credit_system_enabled: string;
  credit_reserve_fund_percent: string;
  credit_settlement_day: string;
  credit_auto_freeze_days: string;
  credit_auto_downgrade_days: string;
  credit_auto_freeze_enabled: string;
  credit_show_account_to_all: string;
}

const DAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function formatNumber(n: string | number): string {
  const num = Number(n) || 0;
  return num.toLocaleString("en-US");
}

export default function AdminCreditTiers({ adminToken }: { adminToken: string | null }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editTier, setEditTier] = useState<Tier | null>(null);
  const [tierForm, setTierForm] = useState<Partial<Tier>>({});
  const [settings, setSettings] = useState<CreditSettings | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // ── جلب الفئات (بدون cache لتجنّب الحالات القديمة) ──
  const tiersQuery = useQuery<Tier[]>({
    queryKey: ["/api/admin/credit/tiers"],
    queryFn: async () => {
      const r = await fetch("/api/admin/credit/tiers", {
        headers: { "x-admin-token": adminToken || "" },
        cache: "no-store",
      });
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        throw new Error(`HTTP ${r.status}: ${text || "فشل تحميل الفئات"}`);
      }
      return r.json();
    },
    enabled: !!adminToken,
    staleTime: 0,
    retry: 2,
  });

  // ── جلب الإعدادات ──
  const settingsQuery = useQuery<CreditSettings>({
    queryKey: ["/api/admin/credit/settings"],
    queryFn: async () => {
      const r = await fetch("/api/admin/credit/settings", {
        headers: { "x-admin-token": adminToken || "" },
        cache: "no-store",
      });
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        throw new Error(`HTTP ${r.status}: ${text || "فشل تحميل الإعدادات"}`);
      }
      return r.json();
    },
    enabled: !!adminToken,
    staleTime: 0,
    retry: 2,
  });

  useEffect(() => {
    if (settingsQuery.data) setSettings(settingsQuery.data);
  }, [settingsQuery.data]);

  // ── تحديث فئة ──
  const updateTier = useMutation({
    mutationFn: async (data: Partial<Tier>) => {
      const r = await fetch(`/api/admin/credit/tiers/${editTier!.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken || "" },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error((await r.json()).message || "فشل التحديث");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "✅ تم حفظ الفئة بنجاح" });
      qc.invalidateQueries({ queryKey: ["/api/admin/credit/tiers"] });
      setEditTier(null);
    },
    onError: (e: any) => {
      toast({ title: "❌ فشل الحفظ", description: e.message, variant: "destructive" });
    },
  });

  // ── حفظ الإعدادات ──
  const saveSettings = async () => {
    if (!settings) return;
    setIsSavingSettings(true);
    try {
      const r = await fetch("/api/admin/credit/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken || "" },
        body: JSON.stringify(settings),
      });
      if (!r.ok) throw new Error((await r.json()).message || "فشل الحفظ");
      toast({ title: "✅ تم حفظ الإعدادات بنجاح" });
      qc.invalidateQueries({ queryKey: ["/api/admin/credit/settings"] });
    } catch (e: any) {
      toast({ title: "❌ فشل الحفظ", description: e.message, variant: "destructive" });
    } finally {
      setIsSavingSettings(false);
    }
  };

  // ── المفتاح الرئيسي: حفظ فوري عند التبديل (لا يحتاج زر حفظ منفصل) ──
  const toggleSystemEnabled = async (v: boolean) => {
    if (!settings) return;
    const prev = settings;
    setSettings({ ...settings, credit_system_enabled: v ? "true" : "false" });
    try {
      const r = await fetch("/api/admin/credit/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken || "" },
        body: JSON.stringify({ credit_system_enabled: v ? "true" : "false" }),
      });
      if (!r.ok) throw new Error((await r.json()).message || "فشل الحفظ");
      toast({
        title: v
          ? "✅ تم تفعيل نظام الائتمان"
          : "🚫 تم إيقاف نظام الائتمان — البيع كاش فقط لجميع العملاء",
      });
      qc.invalidateQueries({ queryKey: ["/api/admin/credit/settings"] });
    } catch (e: any) {
      setSettings(prev); // استرجاع الحالة السابقة عند فشل الحفظ
      toast({ title: "❌ فشل حفظ الحالة", description: e.message, variant: "destructive" });
    }
  };

  const openEdit = (tier: Tier) => {
    setEditTier(tier);
    setTierForm({
      tier_name_ar: tier.tier_name_ar,
      tier_icon: tier.tier_icon || "",
      tier_color: tier.tier_color || "#6b7280",
      credit_limit: tier.credit_limit,
      payment_term_days: tier.payment_term_days,
      down_payment_percent: tier.down_payment_percent,
      cash_discount_percent: tier.cash_discount_percent,
      min_orders_to_reach: tier.min_orders_to_reach,
      min_months_to_reach: tier.min_months_to_reach,
      max_late_days_allowed: tier.max_late_days_allowed,
      description: tier.description || "",
      benefits: tier.benefits || [],
      is_active: tier.is_active,
    });
  };

  if (!adminToken) {
    return <div className="text-center py-8 text-muted-foreground">يجب تسجيل الدخول كمسؤول</div>;
  }

  if (tiersQuery.isLoading || settingsQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // عرض الأخطاء بوضوح
  const tiersError = tiersQuery.error as Error | null;
  const settingsError = settingsQuery.error as Error | null;
  const hasError = !!tiersError || !!settingsError;

  const tiers = tiersQuery.data || [];
  const isSystemOn = settings?.credit_system_enabled === "true";

  return (
    <div className="space-y-6" dir="rtl" data-testid="admin-credit-tiers">
      {/* رأس الصفحة مع زر التحديث */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-amber-500" />
            نظام الائتمان والفئات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة فئات العملاء والإعدادات المالية العامة
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            qc.invalidateQueries({ queryKey: ["/api/admin/credit/tiers"] });
            qc.invalidateQueries({ queryKey: ["/api/admin/credit/settings"] });
            tiersQuery.refetch();
            settingsQuery.refetch();
          }}
          data-testid="button-refresh"
        >
          <RefreshCw className="h-4 w-4 ms-2" />
          تحديث
        </Button>
      </div>

      {/* تنبيه خطأ إن وجد */}
      {hasError && (
        <Card className="border-2 border-red-300 bg-red-50 dark:bg-red-950/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-bold text-red-800 dark:text-red-300 mb-2">
                  ⚠️ تعذّر تحميل البيانات
                </h3>
                {tiersError && (
                  <p className="text-sm text-red-700 dark:text-red-400 mb-1">
                    <strong>الفئات:</strong> {tiersError.message}
                  </p>
                )}
                {settingsError && (
                  <p className="text-sm text-red-700 dark:text-red-400">
                    <strong>الإعدادات:</strong> {settingsError.message}
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    tiersQuery.refetch();
                    settingsQuery.refetch();
                  }}
                >
                  <RefreshCw className="h-4 w-4 ms-2" />
                  إعادة المحاولة
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* بطاقات الفئات الأربع — في الأعلى لإبرازها                       */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Card className="border-2 border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/10">
        <CardHeader className="bg-amber-100/50 dark:bg-amber-950/30">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-600" />
              <span>الفئات الائتمانية الأربع</span>
            </div>
            <Badge
              variant={tiers.length > 0 ? "default" : "destructive"}
              className="text-sm"
              data-testid="badge-tier-count"
            >
              {tiers.length} فئات
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {tiers.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <AlertCircle className="h-12 w-12 text-amber-500 mx-auto" />
              <h3 className="font-bold text-lg">لا توجد فئات للعرض</h3>
              <p className="text-sm text-muted-foreground">
                المتوقع 4 فئات: VIP / فضي / برونزي / محظور
              </p>
              <Button
                onClick={() => tiersQuery.refetch()}
                variant="outline"
                data-testid="button-refetch-tiers"
              >
                <RefreshCw className="h-4 w-4 ms-2" />
                إعادة تحميل
              </Button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {tiers.map((tier) => (
                <Card
                  key={tier.id}
                  className={`overflow-hidden border-2 transition-all hover:shadow-lg ${
                    tier.is_active ? "border-gray-200 dark:border-gray-800" : "border-gray-100 opacity-60"
                  }`}
                  data-testid={`card-tier-${tier.tier_key}`}
                >
                  <div
                    className="h-2"
                    style={{ backgroundColor: tier.tier_color }}
                  />
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{tier.tier_icon || "⭐"}</span>
                        <div>
                          <CardTitle className="text-lg">{tier.tier_name_ar}</CardTitle>
                          <p className="text-xs text-muted-foreground mt-1">{tier.tier_key}</p>
                        </div>
                      </div>
                      {!tier.is_active && (
                        <Badge variant="destructive" className="text-xs">
                          معطّلة
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="p-2 rounded-md bg-muted/50">
                        <p className="text-xs text-muted-foreground">السقف الائتماني</p>
                        <p className="font-bold text-base">{formatNumber(tier.credit_limit)} ر.ي</p>
                      </div>
                      <div className="p-2 rounded-md bg-muted/50">
                        <p className="text-xs text-muted-foreground">مدة السداد</p>
                        <p className="font-bold text-base">{tier.payment_term_days} يوم</p>
                      </div>
                      <div className="p-2 rounded-md bg-muted/50">
                        <p className="text-xs text-muted-foreground">الدفعة المقدمة</p>
                        <p className="font-bold text-base">{tier.down_payment_percent}%</p>
                      </div>
                      <div className="p-2 rounded-md bg-green-50 dark:bg-green-950/30">
                        <p className="text-xs text-muted-foreground">خصم الكاش</p>
                        <p className="font-bold text-base text-green-700 dark:text-green-400">
                          {tier.cash_discount_percent}%
                        </p>
                      </div>
                    </div>
                    {tier.description && (
                      <p className="text-xs text-muted-foreground border-t pt-2">{tier.description}</p>
                    )}
                    {tier.benefits && tier.benefits.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {tier.benefits.map((b, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            ✓ {b}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => openEdit(tier)}
                      data-testid={`button-edit-tier-${tier.tier_key}`}
                    >
                      <Pencil className="h-4 w-4 ms-2" />
                      تعديل الفئة
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* الإعدادات العامة — أسفل الفئات                                  */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Card className="border-2 border-primary/20">
        <CardHeader className="bg-primary/5">
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            إعدادات نظام الائتمان العامة
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-5">
          {settings && (
            <>
              {/* تفعيل النظام كاملاً */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-3">
                  <Power className={`h-5 w-5 ${isSystemOn ? "text-green-600" : "text-gray-400"}`} />
                  <div>
                    <Label className="text-sm font-bold">تفعيل نظام الائتمان كاملاً</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      عند الإيقاف: يبقى البيع كاش فقط لجميع العملاء
                    </p>
                  </div>
                </div>
                <Switch
                  checked={isSystemOn}
                  onCheckedChange={toggleSystemEnabled}
                  data-testid="switch-system-enabled"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* صندوق الاحتياطي */}
                <div>
                  <Label>نسبة صندوق الاحتياطي %</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    max="5"
                    value={settings.credit_reserve_fund_percent}
                    onChange={(e) =>
                      setSettings({ ...settings, credit_reserve_fund_percent: e.target.value })
                    }
                    data-testid="input-reserve-fund"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    يُخصم تلقائياً من كل عملية بيع لتغطية الديون المعدومة (0 = معطّل)
                  </p>
                </div>

                {/* يوم التسوية */}
                <div>
                  <Label>يوم التسوية الأسبوعية (للمراجعة الإدارية)</Label>
                  <Select
                    value={settings.credit_settlement_day}
                    onValueChange={(v) =>
                      setSettings({ ...settings, credit_settlement_day: v })
                    }
                  >
                    <SelectTrigger data-testid="select-settlement-day">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAY_NAMES.map((name, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    يوم مراجعة الديون والتسوية أسبوعياً (أيام استحقاق الأقساط مرنة لكل عميل)
                  </p>
                </div>

                {/* عدد أيام التأخير قبل التجميد */}
                <div>
                  <Label>عدد أيام التأخير قبل التجميد التلقائي</Label>
                  <Input
                    type="number"
                    min="0"
                    value={settings.credit_auto_freeze_days}
                    onChange={(e) =>
                      setSettings({ ...settings, credit_auto_freeze_days: e.target.value })
                    }
                    data-testid="input-freeze-days"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    يُجمَّد العميل تلقائياً بعد هذا العدد من الأيام (مرحلة 2)
                  </p>
                </div>

                {/* عدد أيام التأخير قبل التخفيض */}
                <div>
                  <Label>عدد أيام التأخير قبل تخفيض الفئة</Label>
                  <Input
                    type="number"
                    min="0"
                    value={settings.credit_auto_downgrade_days}
                    onChange={(e) =>
                      setSettings({ ...settings, credit_auto_downgrade_days: e.target.value })
                    }
                    data-testid="input-downgrade-days"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    تُخفَّض فئة العميل تلقائياً بعد هذا العدد (مرحلة 2)
                  </p>
                </div>
              </div>

              {/* خيارات أخرى */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <Label className="text-sm">تفعيل التجميد التلقائي عند التأخير</Label>
                    <p className="text-xs text-muted-foreground">قيد التطوير — المرحلة 2</p>
                  </div>
                  <Switch
                    checked={settings.credit_auto_freeze_enabled === "true"}
                    onCheckedChange={(v) =>
                      setSettings({ ...settings, credit_auto_freeze_enabled: v ? "true" : "false" })
                    }
                    data-testid="switch-auto-freeze"
                    disabled
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <Label className="text-sm">إظهار شاشة "حسابي المالي" لجميع العملاء</Label>
                    <p className="text-xs text-muted-foreground">يعزز ثقة العملاء بمعرفة وضعهم بدقة</p>
                  </div>
                  <Switch
                    checked={settings.credit_show_account_to_all === "true"}
                    onCheckedChange={(v) =>
                      setSettings({ ...settings, credit_show_account_to_all: v ? "true" : "false" })
                    }
                    data-testid="switch-show-account"
                  />
                </div>
              </div>

              <Button
                onClick={saveSettings}
                disabled={isSavingSettings}
                className="w-full"
                size="lg"
                data-testid="button-save-settings"
              >
                {isSavingSettings ? (
                  <Loader2 className="h-4 w-4 ms-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 ms-2" />
                )}
                حفظ الإعدادات العامة
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* نافذة التعديل                                                   */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Dialog open={!!editTier} onOpenChange={(o) => !o && setEditTier(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">{tierForm.tier_icon || editTier?.tier_icon}</span>
              تعديل فئة: {tierForm.tier_name_ar || editTier?.tier_name_ar}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* الاسم والأيقونة */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label>اسم الفئة بالعربية</Label>
                <Input
                  value={tierForm.tier_name_ar || ""}
                  onChange={(e) => setTierForm({ ...tierForm, tier_name_ar: e.target.value })}
                  data-testid="input-tier-name"
                />
              </div>
              <div>
                <Label>الأيقونة</Label>
                <Input
                  value={tierForm.tier_icon || ""}
                  onChange={(e) => setTierForm({ ...tierForm, tier_icon: e.target.value })}
                  placeholder="🥇"
                  data-testid="input-tier-icon"
                />
              </div>
            </div>

            {/* اللون */}
            <div>
              <Label>لون البادج</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={tierForm.tier_color || "#6b7280"}
                  onChange={(e) => setTierForm({ ...tierForm, tier_color: e.target.value })}
                  className="w-20 h-10 p-1"
                  data-testid="input-tier-color"
                />
                <Input
                  value={tierForm.tier_color || ""}
                  onChange={(e) => setTierForm({ ...tierForm, tier_color: e.target.value })}
                  placeholder="#6b7280"
                  className="flex-1"
                />
              </div>
            </div>

            {/* الحدود المالية */}
            <div className="border-t pt-4">
              <h3 className="font-bold text-sm mb-3 text-primary">💰 الحدود المالية</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>السقف الائتماني (ر.ي)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={tierForm.credit_limit || "0"}
                    onChange={(e) => setTierForm({ ...tierForm, credit_limit: e.target.value })}
                    data-testid="input-credit-limit"
                  />
                </div>
                <div>
                  <Label>مدة السداد (يوم)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={tierForm.payment_term_days ?? 0}
                    onChange={(e) =>
                      setTierForm({ ...tierForm, payment_term_days: Number(e.target.value) })
                    }
                    data-testid="input-payment-term"
                  />
                </div>
                <div>
                  <Label>الدفعة المقدمة %</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={tierForm.down_payment_percent || "0"}
                    onChange={(e) =>
                      setTierForm({ ...tierForm, down_payment_percent: e.target.value })
                    }
                    data-testid="input-down-payment"
                  />
                </div>
                <div>
                  <Label>خصم الكاش %</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={tierForm.cash_discount_percent || "0"}
                    onChange={(e) =>
                      setTierForm({ ...tierForm, cash_discount_percent: e.target.value })
                    }
                    data-testid="input-cash-discount"
                  />
                </div>
              </div>
            </div>

            {/* شروط الترقية */}
            <div className="border-t pt-4">
              <h3 className="font-bold text-sm mb-3 text-primary">📈 شروط الترقية والتخفيض</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>أقل عدد طلبات</Label>
                  <Input
                    type="number"
                    min="0"
                    value={tierForm.min_orders_to_reach ?? 0}
                    onChange={(e) =>
                      setTierForm({ ...tierForm, min_orders_to_reach: Number(e.target.value) })
                    }
                    data-testid="input-min-orders"
                  />
                </div>
                <div>
                  <Label>أقل عدد أشهر</Label>
                  <Input
                    type="number"
                    min="0"
                    value={tierForm.min_months_to_reach ?? 0}
                    onChange={(e) =>
                      setTierForm({ ...tierForm, min_months_to_reach: Number(e.target.value) })
                    }
                    data-testid="input-min-months"
                  />
                </div>
                <div>
                  <Label>أقصى تأخير (يوم)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={tierForm.max_late_days_allowed ?? 0}
                    onChange={(e) =>
                      setTierForm({ ...tierForm, max_late_days_allowed: Number(e.target.value) })
                    }
                    data-testid="input-max-late"
                  />
                </div>
              </div>
            </div>

            {/* الوصف والمزايا */}
            <div className="border-t pt-4 space-y-3">
              <div>
                <Label>وصف الفئة</Label>
                <Textarea
                  value={tierForm.description || ""}
                  onChange={(e) => setTierForm({ ...tierForm, description: e.target.value })}
                  rows={2}
                  data-testid="textarea-description"
                />
              </div>
              <div>
                <Label>المزايا (افصل كل ميزة بفاصلة)</Label>
                <Input
                  value={(tierForm.benefits || []).join("، ")}
                  onChange={(e) =>
                    setTierForm({
                      ...tierForm,
                      benefits: e.target.value
                        .split(/[،,]/)
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="سقف عالي، خصم 5%، أولوية في التوصيل"
                  data-testid="input-benefits"
                />
              </div>
            </div>

            {/* تفعيل/تعطيل */}
            <div className="border-t pt-4 flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <Label className="font-medium">الفئة مفعّلة وقابلة للاستخدام</Label>
              <Switch
                checked={tierForm.is_active ?? true}
                onCheckedChange={(v) => setTierForm({ ...tierForm, is_active: v })}
                data-testid="switch-tier-active"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditTier(null)} data-testid="button-cancel">
              إلغاء
            </Button>
            <Button
              onClick={() => updateTier.mutate(tierForm)}
              disabled={updateTier.isPending}
              data-testid="button-save-tier"
            >
              {updateTier.isPending ? (
                <Loader2 className="h-4 w-4 ms-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 ms-2" />
              )}
              حفظ التغييرات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
