import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  CreditCard, Wallet, Calendar, Snowflake, AlertTriangle,
  TrendingUp, ChevronLeft, Package, MessageCircle, Phone,
  CheckCircle2, Clock, Loader2, ArrowUp, ShieldCheck, Award,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";

const orderStatus: Record<string, { label: string; color: string }> = {
  pending: { label: "قيد الانتظار", color: "bg-yellow-100 text-yellow-700" },
  processing: { label: "جاري التجهيز", color: "bg-blue-100 text-blue-700" },
  shipped: { label: "تم الشحن", color: "bg-purple-100 text-purple-700" },
  delivered: { label: "تم التوصيل", color: "bg-green-100 text-green-700" },
  completed: { label: "مكتمل", color: "bg-green-100 text-green-700" },
  cancelled: { label: "ملغي", color: "bg-red-100 text-red-700" },
};

export default function MyCredit() {
  const { isAuthenticated } = useAuth();
  const [showAllOrders, setShowAllOrders] = useState(false);

  const { data: credit, isLoading, isError: creditError, refetch: refetchCredit } = useQuery<any>({
    queryKey: ["/api/my/credit"],
    enabled: isAuthenticated,
    retry: false,
    staleTime: 30_000,
  });

  const { data: orders = [], isError: ordersError } = useQuery<any[]>({
    queryKey: ["/api/my/credit/orders"],
    enabled: isAuthenticated,
    retry: false,
  });

  const { data: settings } = useQuery<any>({
    queryKey: ["/api/display-settings"],
    staleTime: 60_000,
  });

  const { data: tiers = [] } = useQuery<any[]>({
    queryKey: ["/api/credit/tiers/public"],
    staleTime: 60_000,
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" dir="rtl">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <CreditCard className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-bold">حسابك المالي</h2>
            <p className="text-muted-foreground text-sm">
              يجب تسجيل الدخول لعرض رصيدك ومعاملاتك
            </p>
            <Link href="/auth">
              <Button className="w-full" data-testid="button-login">تسجيل الدخول</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (creditError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" dir="rtl">
        <Card className="max-w-md w-full border-red-200">
          <CardContent className="pt-6 text-center space-y-3">
            <AlertTriangle className="h-12 w-12 mx-auto text-red-500" />
            <h2 className="text-lg font-bold">تعذّر تحميل بياناتك المالية</h2>
            <p className="text-sm text-muted-foreground">يرجى التحقق من الاتصال والمحاولة مرة أخرى</p>
            <Button onClick={() => refetchCredit()} data-testid="button-retry">
              إعادة المحاولة
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const limit = Number(credit?.effective_credit_limit ?? 0);
  const balance = Number(credit?.current_balance ?? 0);
  const available = Number(credit?.available_credit ?? 0);
  const totalPaid = Number(credit?.total_paid_amount ?? 0);
  const totalOrders = Number(credit?.total_orders ?? 0);
  const onTime = Number(credit?.on_time_payments ?? 0);
  const late = Number(credit?.late_payments ?? 0);
  const term = Number(credit?.tier_payment_term_days ?? 0);
  const downPct = Number(credit?.tier_down_payment_percent ?? 0);
  const discount = Number(credit?.effective_cash_discount ?? 0);
  const tierName = credit?.tier_name_ar || "برونزي";
  const tierIcon = credit?.tier_icon || "🥉";
  const tierColor = credit?.tier_color || "#cd7f32";
  const isFrozen = credit?.is_frozen === true;
  const isBlocked = credit?.tier === "blocked" || limit <= 0;
  const benefits = credit?.tier_benefits ? String(credit.tier_benefits).split("\n").filter(Boolean) : [];
  const usagePercent = limit > 0 ? Math.min(100, (balance / limit) * 100) : 0;

  const adminWhatsapp = (settings?.whatsappNumber || "").replace(/\D/g, "");
  const whatsappLink = adminWhatsapp
    ? `https://wa.me/${adminWhatsapp.startsWith("9") ? adminWhatsapp : "967" + adminWhatsapp}?text=${encodeURIComponent(
        `السلام عليكم، أرغب في سداد رصيدي المستحق (${balance.toLocaleString()} ر.ي)`,
      )}`
    : null;

  const tierOrder = ["bronze", "silver", "vip", "blocked"];
  const currentIdx = tierOrder.indexOf(credit?.tier ?? "bronze");
  const nextTier = currentIdx >= 0 && currentIdx < 2 ? tiers.find((t) => t.tier_key === tierOrder[currentIdx + 1]) : null;

  const visibleOrders = showAllOrders ? orders : orders.slice(0, 5);

  return (
    <div className="min-h-screen bg-muted/30 dark:bg-background pb-20" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/account">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ChevronLeft className="h-5 w-5 rotate-180" />
            </Button>
          </Link>
          <h1 className="text-lg font-bold">حسابي المالي</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-4 max-w-2xl space-y-4">
        {/* تنبيهات حالات خاصة */}
        {isFrozen && (
          <Card className="border-cyan-300 bg-cyan-50 dark:bg-cyan-950/30">
            <CardContent className="pt-4 flex items-start gap-3">
              <Snowflake className="h-6 w-6 text-cyan-600 shrink-0" />
              <div className="flex-1">
                <p className="font-bold text-cyan-800 dark:text-cyan-200">حسابك مجمَّد مؤقتاً</p>
                <p className="text-sm text-cyan-700 dark:text-cyan-300 mt-1">
                  {credit?.frozen_reason || "يرجى التواصل مع الإدارة لمعرفة التفاصيل"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {isBlocked && !isFrozen && (
          <Card className="border-red-300 bg-red-50 dark:bg-red-950/30">
            <CardContent className="pt-4 flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-red-600 shrink-0" />
              <div className="flex-1">
                <p className="font-bold text-red-800 dark:text-red-200">الشراء بالأجل غير متاح حالياً</p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  تواصل مع الإدارة لتفعيل خدمة الشراء بالأجل لحسابك
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* بطاقة الفئة */}
        <Card
          className="border-2 overflow-hidden shadow-lg"
          style={{ borderColor: tierColor }}
          data-testid="card-tier-summary"
        >
          <div
            className="p-4 flex items-center gap-4"
            style={{ background: `linear-gradient(135deg, ${tierColor}25, ${tierColor}10)` }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl shrink-0 shadow-md"
              style={{ background: `${tierColor}30` }}
            >
              {tierIcon}
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">فئتك الائتمانية</p>
              <p className="text-2xl font-bold" style={{ color: tierColor }} data-testid="text-tier-name">
                {tierName}
              </p>
              {credit?.tier_description && (
                <p className="text-xs text-muted-foreground mt-1">{credit.tier_description}</p>
              )}
            </div>
          </div>

          {/* شريط استخدام السقف */}
          {limit > 0 && (
            <div className="px-4 py-3 border-t">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">استخدام السقف</span>
                <span className="font-bold">{usagePercent.toFixed(0)}%</span>
              </div>
              <Progress value={usagePercent} className="h-2" />
              <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                <span>{balance.toLocaleString()} ر.ي</span>
                <span>{limit.toLocaleString()} ر.ي</span>
              </div>
            </div>
          )}
        </Card>

        {/* شبكة الأرقام */}
        <div className="grid grid-cols-2 gap-3">
          <Card data-testid="card-available">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Wallet className="h-4 w-4" />
                <span>المتاح للشراء</span>
              </div>
              <p className="text-xl font-bold text-green-600" data-testid="text-available">
                {available.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">ر.ي</p>
            </CardContent>
          </Card>

          <Card data-testid="card-balance">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <CreditCard className="h-4 w-4" />
                <span>رصيد مستحق</span>
              </div>
              <p className="text-xl font-bold text-amber-600" data-testid="text-balance">
                {balance.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">ر.ي</p>
            </CardContent>
          </Card>

          <Card data-testid="card-term">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Calendar className="h-4 w-4" />
                <span>مدة السداد</span>
              </div>
              <p className="text-xl font-bold" data-testid="text-term">
                {term}
              </p>
              <p className="text-xs text-muted-foreground">يوم من تاريخ الطلب</p>
            </CardContent>
          </Card>

          <Card data-testid="card-paid">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <CheckCircle2 className="h-4 w-4" />
                <span>إجمالي المسدَّد</span>
              </div>
              <p className="text-xl font-bold text-blue-600" data-testid="text-total-paid">
                {totalPaid.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">ر.ي</p>
            </CardContent>
          </Card>
        </div>

        {/* زر سداد */}
        {balance > 0 && (
          <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-start gap-3">
                <CreditCard className="h-6 w-6 text-amber-600 shrink-0" />
                <div className="flex-1">
                  <p className="font-bold text-amber-900 dark:text-amber-100">
                    لديك رصيد مستحق: {balance.toLocaleString()} ر.ي
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    تواصل مع الإدارة لتسديد المبلغ نقداً أو عبر التحويل
                  </p>
                </div>
              </div>
              {whatsappLink ? (
                <a href={whatsappLink} target="_blank" rel="noreferrer" className="block">
                  <Button className="w-full bg-green-600 hover:bg-green-700" data-testid="button-pay-whatsapp">
                    <MessageCircle className="h-4 w-4 ml-2" />
                    تواصل عبر واتساب لتسديد المستحق
                  </Button>
                </a>
              ) : (
                <p className="text-xs text-center text-muted-foreground">
                  تواصل مع الإدارة عبر القنوات المتاحة
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* مزايا الفئة */}
        {benefits.length > 0 && (
          <Card data-testid="card-benefits">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="h-5 w-5" style={{ color: tierColor }} />
                مزايا فئتك
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {discount > 0 && (
                <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/30 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="text-sm">
                    خصم نقدي <span className="font-bold text-green-700">{discount}%</span> عند الدفع المباشر
                  </span>
                </div>
              )}
              {downPct === 0 && limit > 0 && (
                <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/30 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="text-sm">بدون دفعة مقدمة</span>
                </div>
              )}
              {benefits.map((b, i) => (
                <div key={i} className="flex items-start gap-2 p-2 bg-muted/40 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span className="text-sm flex-1">{b}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* الترقية للفئة التالية */}
        {nextTier && !isFrozen && !isBlocked && (
          <Card
            className="border-2"
            style={{ borderColor: nextTier.tier_color }}
            data-testid="card-next-tier"
          >
            <CardContent className="pt-4">
              <div className="flex items-center gap-3 mb-3">
                <ArrowUp className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">الفئة التالية</p>
                  <p className="font-bold text-lg flex items-center gap-2">
                    <span>{nextTier.tier_icon}</span>
                    <span style={{ color: nextTier.tier_color }}>{nextTier.tier_name_ar}</span>
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-muted/40 rounded">
                  <p className="text-muted-foreground">سقف أعلى</p>
                  <p className="font-bold">{Number(nextTier.credit_limit).toLocaleString()} ر.ي</p>
                </div>
                <div className="p-2 bg-muted/40 rounded">
                  <p className="text-muted-foreground">مدة أطول</p>
                  <p className="font-bold">{nextTier.payment_term_days} يوم</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                التزم بالسداد في الموعد لترتقي تلقائياً
              </p>
            </CardContent>
          </Card>
        )}

        {/* سجل الانتظام */}
        {(onTime > 0 || late > 0) && (
          <Card data-testid="card-payment-record">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                سجل الانتظام
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                <p className="text-2xl font-bold text-green-700">{onTime}</p>
                <p className="text-xs text-green-600">سداد في الموعد</p>
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                <p className="text-2xl font-bold text-red-700">{late}</p>
                <p className="text-xs text-red-600">سداد متأخر</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* طلبات الأجل */}
        <Card data-testid="card-credit-orders">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                طلبات الأجل ({orders.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ordersError ? (
              <p className="text-center text-sm text-red-600 py-4">
                تعذّر تحميل قائمة الطلبات
              </p>
            ) : orders.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">
                لم تقم بأي عملية شراء بالأجل بعد
              </p>
            ) : (
              <div className="space-y-2">
                {visibleOrders.map((o: any) => {
                  const st = orderStatus[o.status] || { label: o.status, color: "bg-gray-100 text-gray-700" };
                  const date = o.created_at ? new Date(o.created_at).toLocaleDateString("ar-EG", {
                    year: "numeric", month: "short", day: "numeric",
                  }) : "—";
                  return (
                    <Link key={o.id} href={`/track/${o.id}`}>
                      <div
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/40 transition-colors cursor-pointer"
                        data-testid={`order-row-${o.id}`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                          <CreditCard className="h-5 w-5 text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm">طلب #{o.id}</span>
                            <Badge className={`${st.color} text-[10px] px-1.5 py-0`}>{st.label}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />
                            {date}
                          </p>
                        </div>
                        <div className="text-left shrink-0">
                          <p className="font-bold text-amber-600">{Number(o.total).toLocaleString()}</p>
                          <p className="text-[10px] text-muted-foreground">ر.ي</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
                {orders.length > 5 && (
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => setShowAllOrders(!showAllOrders)}
                    data-testid="button-toggle-orders"
                  >
                    {showAllOrders ? "إخفاء" : `عرض الكل (${orders.length})`}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* معلومات اتصال */}
        <Card>
          <CardContent className="pt-4 text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              لأي استفسار حول حسابك المالي
            </p>
            {whatsappLink && (
              <a href={whatsappLink} target="_blank" rel="noreferrer">
                <Button variant="outline" size="sm" data-testid="button-contact-admin">
                  <MessageCircle className="h-4 w-4 ml-2" />
                  تواصل مع الإدارة
                </Button>
              </a>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
