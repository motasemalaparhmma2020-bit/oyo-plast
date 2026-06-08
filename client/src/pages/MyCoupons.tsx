import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Ticket, Loader2, ShoppingBag, Gift } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

function goBackSafe(setLocation: (p: string) => void) {
  try {
    const last = sessionStorage.getItem("lastSafePath");
    if (last && last !== "/my-coupons") return setLocation(last);
  } catch {}
  setLocation("/profile");
}

type MyCoupon = {
  code: string;
  usageCount: number;
  totalDiscount: number;
  lastUsedAt: string | null;
};

export default function MyCouponsPage() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  const { data: coupons = [], isLoading } = useQuery<MyCoupon[]>({
    queryKey: ["/api/my/coupons"],
    enabled: isAuthenticated,
  });

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("ar-YE", { year: "numeric", month: "short", day: "numeric" }) : "";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-24" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-br from-rose-600 via-pink-500 to-rose-500 text-white">
        <div className="container max-w-2xl mx-auto px-4 pt-4 pb-10 relative">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost" size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => goBackSafe(setLocation)}
              data-testid="button-back-coupons"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-bold">كوبوناتي</h1>
            <div className="w-9" />
          </div>

          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
              <Ticket className="h-7 w-7 text-white" />
            </div>
            <div>
              <p className="text-white/80 text-xs">الكوبونات المستخدمة</p>
              <p className="text-3xl font-extrabold" data-testid="text-coupons-count">
                {isLoading ? "—" : coupons.length.toLocaleString("ar-YE")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-2xl mx-auto px-4 -mt-6 relative z-10 space-y-3">
        {/* Info card */}
        <Card className="bg-gradient-to-l from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30 border-rose-200/60 dark:border-rose-900/40">
          <CardContent className="p-4 flex items-start gap-3">
            <Gift className="h-5 w-5 text-rose-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-bold text-rose-900 dark:text-rose-100 mb-1">كيف أحصل على كوبونات؟</p>
              <p className="text-xs text-rose-800/80 dark:text-rose-200/80 leading-relaxed">
                استخدم رمز خصم من مسوّقي أويو بلاست عند الدفع للحصول على خصم فوري. يظهر هنا سجل جميع الكوبونات التي استخدمتها في طلباتك السابقة.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Coupons list */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm">سجل كوبوناتي</h3>
              {coupons.length > 0 && (
                <Badge variant="secondary" className="text-xs">{coupons.length}</Badge>
              )}
            </div>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-rose-500" />
              </div>
            ) : coupons.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Ticket className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium mb-1">لا توجد كوبونات بعد</p>
                <p className="text-xs">عند استخدامك لرمز خصم في أي طلب، سيظهر هنا تلقائياً.</p>
                <Link href="/products">
                  <Button size="sm" className="mt-4 bg-rose-600 hover:bg-rose-700 text-white" data-testid="button-shop-now">
                    <ShoppingBag className="h-4 w-4 ml-1" />
                    تسوّق الآن
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {coupons.map((c) => (
                  <div
                    key={c.code}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50"
                    data-testid={`coupon-${c.code}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center shrink-0">
                      <Ticket className="h-5 w-5 text-rose-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate" data-testid={`text-coupon-code-${c.code}`}>
                        {c.code}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        استُخدم {c.usageCount.toLocaleString("ar-YE")} مرة
                        {c.lastUsedAt && ` • آخر استخدام ${formatDate(c.lastUsedAt)}`}
                      </p>
                    </div>
                    {c.totalDiscount > 0 && (
                      <div className="text-left shrink-0">
                        <p className="text-[10px] text-muted-foreground">إجمالي الخصم</p>
                        <p className="text-sm font-bold text-rose-600">
                          {c.totalDiscount.toLocaleString("ar-YE")} ر.ي
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {!isAuthenticated && (
          <div className="text-center mt-6">
            <Link href="/auth"><Button>تسجيل الدخول لرؤية كوبوناتك</Button></Link>
          </div>
        )}
      </div>
    </div>
  );
}
