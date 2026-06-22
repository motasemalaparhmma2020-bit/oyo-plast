import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronRight, Award, Loader2, Clock, Gift, ShoppingBag, TrendingUp,
  Flame, CheckCircle2, CalendarCheck,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { RewardPoints, PointsTransaction } from "@shared/schema";

type CheckinStatus = {
  checkedInToday: boolean;
  currentStreak: number;
  nextReward: number;
  last7: Array<{ date: string; checked: boolean; points: number }>;
};
const DAY_LABELS = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

function goBackSafe(setLocation: (p: string) => void) {
  try {
    const last = sessionStorage.getItem("lastSafePath");
    if (last && last !== "/loyalty") return setLocation(last);
  } catch {}
  setLocation("/account");
}

export default function LoyaltyPage() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: points, isLoading } = useQuery<{ points: number; lifetimePoints: number }>({
    queryKey: ["/api/points"],
    enabled: isAuthenticated,
  });
  const { data: txs = [], isLoading: txLoading } = useQuery<PointsTransaction[]>({
    queryKey: ["/api/points/transactions"],
    enabled: isAuthenticated,
  });
  const { data: checkin } = useQuery<CheckinStatus>({
    queryKey: ["/api/loyalty/checkin/status"],
    enabled: isAuthenticated,
  });

  const checkinMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/loyalty/checkin");
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "🎉 تم تسجيل دخولك اليومي", description: data?.message || "تمت إضافة نقاطك" });
      queryClient.invalidateQueries({ queryKey: ["/api/loyalty/checkin/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/points"] });
      queryClient.invalidateQueries({ queryKey: ["/api/points/transactions"] });
    },
    onError: (err: any) => {
      toast({ title: "تنبيه", description: err?.message || "سجّلت دخولك اليوم بالفعل", variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["/api/loyalty/checkin/status"] });
    },
  });

  const current = points?.points ?? 0;
  const lifetime = points?.lifetimePoints ?? 0;

  const formatDate = (d: string | Date | null) =>
    d ? new Date(d).toLocaleDateString("ar-YE", { year: "numeric", month: "short", day: "numeric" }) : "";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-24" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-br from-amber-500 via-yellow-500 to-orange-500 text-white">
        <div className="container max-w-2xl mx-auto px-4 pt-4 pb-12 relative">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost" size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => goBackSafe(setLocation)}
              data-testid="button-back-loyalty"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-bold">نقاط الولاء</h1>
            <div className="w-9" />
          </div>

          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
              <Award className="h-7 w-7 text-white" />
            </div>
            <div>
              <p className="text-white/80 text-xs">نقاطي الحالية</p>
              <p className="text-3xl font-extrabold" data-testid="text-current-points">
                {isLoading ? "—" : current.toLocaleString("ar-YE")}
                <span className="text-base font-bold mr-1">نقطة</span>
              </p>
              {lifetime > 0 && (
                <p className="text-white/80 text-xs mt-0.5">
                  المجموع التراكمي: {lifetime.toLocaleString("ar-YE")}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-2xl mx-auto px-4 -mt-8 relative z-10 space-y-4">
        {/* Daily check-in */}
        {isAuthenticated && (
          <Card data-testid="card-daily-checkin">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm flex items-center gap-1.5">
                  <CalendarCheck className="h-4 w-4 text-sky-600" />
                  الدخول اليومي
                </h3>
                {(checkin?.currentStreak ?? 0) > 0 && (
                  <span className="flex items-center gap-1 text-xs font-bold text-orange-600" data-testid="text-checkin-streak">
                    <Flame className="h-4 w-4" />
                    سلسلة {checkin?.currentStreak} {checkin?.currentStreak === 1 ? "يوم" : "أيام"}
                  </span>
                )}
              </div>

              {/* تقويم آخر 7 أيام */}
              <div className="grid grid-cols-7 gap-1.5 mb-3">
                {(checkin?.last7 ?? Array.from({ length: 7 }, () => null)).map((d, i) => {
                  const dayNum = d ? new Date(d.date + "T00:00:00").getDay() : i;
                  const checked = !!d?.checked;
                  return (
                    <div key={i} className="flex flex-col items-center gap-1" data-testid={`checkin-day-${i}`}>
                      <span className="text-[9px] text-muted-foreground">{DAY_LABELS[dayNum]}</span>
                      <div className={`w-full aspect-square rounded-lg flex items-center justify-center border ${
                        checked
                          ? "bg-sky-500 border-sky-500 text-white"
                          : "bg-muted/40 border-border/50 text-muted-foreground"
                      }`}>
                        {checked
                          ? <CheckCircle2 className="h-4 w-4" />
                          : <span className="text-[10px]">{d ? "؟" : ""}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button
                className="w-full bg-sky-500 hover:bg-sky-600 text-white disabled:opacity-60"
                disabled={checkin?.checkedInToday || checkinMutation.isPending}
                onClick={() => checkinMutation.mutate()}
                data-testid="button-daily-checkin"
              >
                {checkinMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin ml-1" />
                ) : checkin?.checkedInToday ? (
                  <><CheckCircle2 className="h-4 w-4 ml-1" /> سجّلت دخولك اليوم ✓</>
                ) : (
                  <><Gift className="h-4 w-4 ml-1" /> سجّل دخولك واكسب {checkin?.nextReward ?? 2} نقاط</>
                )}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center mt-2">
                داوم يومياً: 3 أيام = نقاط ×1.5 ⚡ — 7 أيام = نقاط ×2 🔥
              </p>
            </CardContent>
          </Card>
        )}

        {/* How to earn */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-bold text-sm mb-3 flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              كيف تكسب نقاطك؟
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-2 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20">
                <ShoppingBag className="h-5 w-5 text-emerald-600 shrink-0" />
                <p className="text-sm">كل <strong>100 ر.ي</strong> من المشتريات = <strong>1 نقطة</strong></p>
              </div>
              <div className="flex items-center gap-3 p-2 rounded-lg bg-blue-50/60 dark:bg-blue-950/20">
                <Gift className="h-5 w-5 text-blue-600 shrink-0" />
                <p className="text-sm">عند التسجيل أول مرة = <strong>10 نقاط</strong> هدية ترحيب</p>
              </div>
              <div className="flex items-center gap-3 p-2 rounded-lg bg-purple-50/60 dark:bg-purple-950/20">
                <Award className="h-5 w-5 text-purple-600 shrink-0" />
                <p className="text-sm">إكمال طلب وتقييمه = <strong>5 نقاط</strong> إضافية</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* How to redeem */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-bold text-sm mb-3 flex items-center gap-1.5">
              <Gift className="h-4 w-4 text-orange-600" />
              كيف تستبدل نقاطك؟
            </h3>
            <div className="space-y-2 text-sm">
              <p>• <strong>100 نقطة</strong> = خصم <strong>1,000 ر.ي</strong> على طلبك التالي.</p>
              <p>• <strong>500 نقطة</strong> = شحن مجاني داخل اليمن.</p>
              <p>• يتم التطبيق تلقائياً عند الدفع، أو تواصل مع الإدارة للاستبدال اليدوي.</p>
            </div>
            <a
              href={`https://wa.me/967774997589?text=${encodeURIComponent("مرحباً، أريد استبدال نقاط الولاء")}`}
              target="_blank" rel="noopener noreferrer"
              data-testid="button-redeem-points"
            >
              <Button className="w-full mt-3 bg-orange-500 hover:bg-orange-600 text-white" size="sm">
                <Gift className="h-4 w-4 ml-1" />
                طلب استبدال
              </Button>
            </a>
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm">سجل الحركات</h3>
              <Badge variant="secondary" className="text-xs">{txs.length}</Badge>
            </div>
            {txLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />
              </div>
            ) : txs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">لا توجد حركات بعد</p>
              </div>
            ) : (
              <div className="space-y-2">
                {txs.slice(0, 15).map((tx: any) => {
                  const amount = Number(tx.points || 0);
                  const isEarned = amount > 0;
                  return (
                    <div key={tx.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 border border-border/50" data-testid={`points-tx-${tx.id}`}>
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                        isEarned ? "bg-yellow-100 dark:bg-yellow-950/40" : "bg-red-100 dark:bg-red-950/40"
                      }`}>
                        <Award className={`h-4 w-4 ${isEarned ? "text-yellow-600" : "text-red-600"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{tx.description || (isEarned ? "كسب نقاط" : "استبدال")}</p>
                        <p className="text-[11px] text-muted-foreground">{formatDate(tx.createdAt)}</p>
                      </div>
                      <p className={`text-sm font-bold shrink-0 ${isEarned ? "text-yellow-600" : "text-red-600"}`}>
                        {isEarned ? "+" : ""}{amount.toLocaleString("ar-YE")}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {!isAuthenticated && (
          <div className="text-center mt-6">
            <Link href="/auth"><Button>تسجيل الدخول</Button></Link>
          </div>
        )}
      </div>
    </div>
  );
}
