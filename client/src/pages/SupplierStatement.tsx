import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Wallet, TrendingUp, Package, CheckCircle2, Clock,
  ChevronRight, Loader2, Receipt, Calendar, AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STORAGE_KEY = "supplier_session";

const fmt = (n: any) => Number(n || 0).toLocaleString("ar-YE");
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("ar-YE", { year: "numeric", month: "short", day: "numeric" });

const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "قيد الانتظار", color: "bg-amber-100 text-amber-700" },
  processing: { label: "قيد التجهيز", color: "bg-blue-100 text-blue-700" },
  shipped: { label: "تم الشحن", color: "bg-purple-100 text-purple-700" },
  delivered: { label: "تم التوصيل", color: "bg-green-100 text-green-700" },
  completed: { label: "مكتمل", color: "bg-green-100 text-green-700" },
};

export default function SupplierStatement() {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSession(JSON.parse(raw));
    } catch {}
  }, []);

  const { data: statement, isLoading, isError } = useQuery<any>({
    queryKey: ["/api/supplier/statement"],
    enabled: !!session?.token,
    queryFn: async () => {
      const res = await fetch("/api/supplier/statement", {
        headers: {
          "x-supplier-token": session.token,
          "x-supplier-id": String(session.supplier?.id || ""),
        },
      });
      if (!res.ok) throw new Error("فشل جلب كشف الحساب");
      return res.json();
    },
    refetchOnWindowFocus: true,
  });

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" dir="rtl">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto text-amber-500" />
            <h2 className="text-xl font-bold">كشف حساب المورد</h2>
            <p className="text-muted-foreground text-sm">يجب تسجيل الدخول من بوابة الموردين</p>
            <Link href="/supplier">
              <Button className="w-full" data-testid="button-supplier-login">دخول</Button>
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

  if (isError || !statement) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" dir="rtl">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto text-rose-500" />
            <p>تعذّر تحميل كشف الحساب. حاول لاحقاً.</p>
            <Link href="/supplier">
              <Button variant="outline" className="w-full">عودة</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const t = statement.totals || {};
  const orders = statement.recentOrders || [];
  const remittances = statement.recentRemittances || [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-24" dir="rtl">
      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 text-white">
        <div className="container max-w-3xl mx-auto px-4 pt-4 pb-8">
          <div className="flex items-center justify-between mb-3">
            <Link href="/supplier">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" data-testid="link-back">
                <ChevronRight className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-xl font-bold">كشف الحساب</h1>
            <div className="w-9" />
          </div>
          <p className="text-center text-white/80 text-sm">{statement.supplier?.name}</p>

          {/* Balance Due — البطاقة الكبيرة */}
          <div className="mt-6 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 text-center shadow-lg">
            <p className="text-white/90 text-xs">رصيد مستحق التوريد للمنصة</p>
            <p className="text-4xl font-bold mt-2" data-testid="text-balance-due">
              {fmt(t.balanceDue)} <span className="text-base">ر.ي</span>
            </p>
            <p className="text-xs text-white/80 mt-2">
              المبيعات: {fmt(t.totalSales)} | المُورَّد: {fmt(t.totalRemitted)}
            </p>
          </div>
        </div>
      </div>

      <div className="container max-w-3xl mx-auto px-4 -mt-4 space-y-4">
        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-white dark:bg-slate-900">
            <CardContent className="p-3 text-center">
              <Package className="h-5 w-5 mx-auto text-blue-600 mb-1" />
              <p className="text-xs text-muted-foreground">طلبات نشطة</p>
              <p className="text-xl font-bold" data-testid="stat-active">{fmt(t.activeCount)}</p>
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-slate-900">
            <CardContent className="p-3 text-center">
              <CheckCircle2 className="h-5 w-5 mx-auto text-green-600 mb-1" />
              <p className="text-xs text-muted-foreground">مُسلَّمة</p>
              <p className="text-xl font-bold" data-testid="stat-delivered">{fmt(t.deliveredCount)}</p>
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-slate-900">
            <CardContent className="p-3 text-center">
              <Wallet className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
              <p className="text-xs text-muted-foreground">مُحصَّل COD</p>
              <p className="text-lg font-bold">{fmt(t.totalCollectedCOD)}</p>
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-slate-900">
            <CardContent className="p-3 text-center">
              <TrendingUp className="h-5 w-5 mx-auto text-purple-600 mb-1" />
              <p className="text-xs text-muted-foreground">أرباحك</p>
              <p className="text-lg font-bold">{fmt(t.totalEarned)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent orders */}
        <Card className="bg-white dark:bg-slate-900">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-5 w-5 text-slate-700 dark:text-slate-300" />
              <h2 className="font-bold">آخر الطلبات</h2>
              <Badge variant="outline" className="mr-auto">{orders.length}</Badge>
            </div>
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">لا توجد طلبات بعد</p>
            ) : (
              <div className="space-y-2">
                {orders.slice(0, 10).map((o: any) => {
                  const st = ORDER_STATUS[o.status] || { label: o.status, color: "bg-gray-100 text-gray-700" };
                  return (
                    <div key={o.id} className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-slate-800 rounded-lg" data-testid={`row-order-${o.id}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">#{o.id}</span>
                          <Badge className={`text-[10px] ${st.color}`}>{st.label}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {o.customer_name} · {o.shipping_city}
                        </p>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-sm">{fmt(o.supplier_amount)} ر.ي</p>
                        <p className="text-[10px] text-muted-foreground">{fmtDate(o.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Remittances */}
        <Card className="bg-white dark:bg-slate-900">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Receipt className="h-5 w-5 text-green-600" />
              <h2 className="font-bold">سجل التوريدات للمنصة</h2>
              <Badge variant="outline" className="mr-auto">{remittances.length}</Badge>
            </div>
            {remittances.length === 0 ? (
              <div className="text-center py-4">
                <Clock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">لم تقم بتوريد أي مبلغ بعد</p>
              </div>
            ) : (
              <div className="space-y-2">
                {remittances.slice(0, 10).map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between p-2.5 bg-green-50 dark:bg-green-950/30 rounded-lg" data-testid={`row-remittance-${r.id}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <p className="font-bold text-sm">{fmt(r.amount)} ر.ي</p>
                        <Badge variant="outline" className="text-[10px]">{r.method || "نقدي"}</Badge>
                      </div>
                      {r.notes && <p className="text-xs text-muted-foreground mt-1">{r.notes}</p>}
                    </div>
                    <div className="text-left flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" /> {fmtDate(r.paid_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
