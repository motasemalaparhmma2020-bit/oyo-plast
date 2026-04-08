import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown, DollarSign, ShoppingBag, Package, MapPin, Star, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface FinancialData {
  summary: {
    totalRevenue: number;
    totalSupplierPaid: number;
    platformCommission: number;
    totalOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    todayOrders: number;
    todayRevenue: number;
  };
  daily: { day: string; revenue: number; orders: number }[];
  monthly: { month: string; revenue: number; orders: number }[];
  topProducts: { name: string; revenue: number; units: number }[];
  topCities: { city: string; orders: number; revenue: number }[];
  comparison: {
    this_month: string;
    last_month: string;
    this_month_orders: string;
    last_month_orders: string;
  };
}

function fmt(n: number) {
  return n.toLocaleString("ar-YE");
}

function pct(current: number, previous: number) {
  if (!previous) return null;
  return ((current - previous) / previous * 100).toFixed(1);
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const w = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${w}%` }} />
    </div>
  );
}

export default function FinancialReports({ adminToken }: { adminToken: string | null }) {
  const { data, isLoading } = useQuery<FinancialData>({
    queryKey: ["/api/admin/reports/financial"],
    queryFn: async () => {
      const res = await fetch("/api/admin/reports/financial", {
        headers: { "x-admin-token": adminToken || "" },
      });
      if (!res.ok) throw new Error("فشل جلب التقارير");
      return res.json();
    },
    enabled: !!adminToken,
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) return null;

  const { summary, daily, monthly, topProducts, topCities, comparison } = data;
  const thisMonth = Number(comparison.this_month);
  const lastMonth = Number(comparison.last_month);
  const thisMonthOrders = Number(comparison.this_month_orders);
  const lastMonthOrders = Number(comparison.last_month_orders);
  const monthPct = pct(thisMonth, lastMonth);
  const ordersPct = pct(thisMonthOrders, lastMonthOrders);

  const maxDailyRevenue = Math.max(...daily.map(d => d.revenue), 1);
  const maxProductRevenue = Math.max(...topProducts.map(p => p.revenue), 1);
  const maxCityOrders = Math.max(...topCities.map(c => c.orders), 1);

  return (
    <div className="space-y-6 pb-10" dir="rtl">

      {/* البطاقات الرئيسية */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-emerald-50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <Badge variant="outline" className="text-xs text-green-700 border-green-200">إجمالي</Badge>
            </div>
            <p className="text-2xl font-bold text-green-700">{fmt(summary.totalRevenue)}</p>
            <p className="text-xs text-gray-500 mt-0.5">إجمالي المبيعات ر.ي</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <Badge variant="outline" className="text-xs text-blue-700 border-blue-200">صافي</Badge>
            </div>
            <p className="text-2xl font-bold text-blue-700">{fmt(summary.platformCommission)}</p>
            <p className="text-xs text-gray-500 mt-0.5">أرباح المنصة ر.ي</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-orange-50 to-amber-50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <ShoppingBag className="h-5 w-5 text-orange-600" />
              <Badge variant="outline" className="text-xs text-orange-700 border-orange-200">طلبات</Badge>
            </div>
            <p className="text-2xl font-bold text-orange-700">{fmt(summary.totalOrders)}</p>
            <p className="text-xs text-gray-500 mt-0.5">إجمالي الطلبات</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-violet-50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <Star className="h-5 w-5 text-purple-600" />
              <Badge variant="outline" className="text-xs text-purple-700 border-purple-200">اليوم</Badge>
            </div>
            <p className="text-2xl font-bold text-purple-700">{fmt(summary.todayRevenue)}</p>
            <p className="text-xs text-gray-500 mt-0.5">مبيعات اليوم ({summary.todayOrders} طلب)</p>
          </CardContent>
        </Card>
      </div>

      {/* مقارنة الشهر */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm font-bold text-gray-500 mb-3">مبيعات هذا الشهر vs الشهر الماضي</p>
            <div className="flex items-end gap-4">
              <div>
                <p className="text-xs text-gray-400">هذا الشهر</p>
                <p className="text-2xl font-bold text-primary">{fmt(thisMonth)} ر.ي</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">الشهر الماضي</p>
                <p className="text-lg font-medium text-gray-400">{fmt(lastMonth)} ر.ي</p>
              </div>
              {monthPct !== null && (
                <div className={`flex items-center gap-1 text-sm font-bold ${Number(monthPct) >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {Number(monthPct) >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  {Math.abs(Number(monthPct))}%
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm font-bold text-gray-500 mb-3">ملخص الطلبات</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-2 bg-green-50 rounded-lg">
                <p className="text-xl font-bold text-green-600">{summary.deliveredOrders}</p>
                <p className="text-xs text-gray-500">مسلَّمة</p>
              </div>
              <div className="text-center p-2 bg-orange-50 rounded-lg">
                <p className="text-xl font-bold text-orange-500">{summary.totalOrders - summary.deliveredOrders}</p>
                <p className="text-xs text-gray-500">جارية</p>
              </div>
              <div className="text-center p-2 bg-red-50 rounded-lg">
                <p className="text-xl font-bold text-red-500">{summary.cancelledOrders}</p>
                <p className="text-xs text-gray-500">ملغاة</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* الإيرادات الشهرية */}
      {monthly.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              الإيرادات الشهرية (آخر 12 شهر)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {monthly.map((m) => {
                const maxM = Math.max(...monthly.map(x => x.revenue), 1);
                const w = Math.round((m.revenue / maxM) * 100);
                return (
                  <div key={m.month} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-16 flex-shrink-0">{m.month}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-3">
                      <div className="h-3 rounded-full bg-primary" style={{ width: `${w}%` }} />
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-sm font-bold">{fmt(m.revenue)}</span>
                      <span className="text-xs text-gray-400">({m.orders} طلب)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* المبيعات اليومية آخر 30 يوم */}
      {daily.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">المبيعات اليومية (آخر 30 يوم)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="flex items-end gap-1 h-24 min-w-max">
                {daily.map((d) => {
                  const h = Math.max(Math.round((d.revenue / maxDailyRevenue) * 80), 4);
                  const isToday = new Date(d.day).toDateString() === new Date().toDateString();
                  return (
                    <div key={d.day} className="flex flex-col items-center gap-0.5 group relative">
                      <div
                        className={`w-5 rounded-t transition-all ${isToday ? "bg-primary" : "bg-primary/30 group-hover:bg-primary/60"}`}
                        style={{ height: `${h}px` }}
                      />
                      <div className="absolute bottom-full mb-1 bg-gray-800 text-white text-xs rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                        {new Date(d.day).toLocaleDateString("ar-YE", { month: "short", day: "numeric" })}
                        <br />{fmt(d.revenue)} ر.ي
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* أفضل المنتجات */}
      {topProducts.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              أفضل المنتجات مبيعاً
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs
                    ${i === 0 ? "bg-yellow-100 text-yellow-700" : i === 1 ? "bg-gray-100 text-gray-600" : i === 2 ? "bg-orange-100 text-orange-600" : "bg-blue-50 text-blue-600"}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <MiniBar value={p.revenue} max={maxProductRevenue} color="bg-primary" />
                  </div>
                  <div className="text-left flex-shrink-0">
                    <p className="text-sm font-bold">{fmt(p.revenue)} ر.ي</p>
                    <p className="text-xs text-gray-400">{p.units} وحدة</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* أفضل المدن */}
      {topCities.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              أفضل المدن حسب الطلبات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topCities.map((c, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold flex-shrink-0 text-gray-600">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{c.city}</p>
                    <MiniBar value={c.orders} max={maxCityOrders} color="bg-emerald-400" />
                  </div>
                  <div className="text-left flex-shrink-0">
                    <p className="text-sm font-bold">{c.orders} طلب</p>
                    <p className="text-xs text-gray-400">{fmt(c.revenue)} ر.ي</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* توزيع الأرباح */}
      <Card className="border-0 shadow-sm bg-gradient-to-br from-slate-50 to-blue-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">توزيع الإيرادات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600">أرباح المنصة</span>
                <span className="text-sm font-bold text-blue-700">{fmt(summary.platformCommission)} ر.ي</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div
                  className="h-3 rounded-full bg-blue-500"
                  style={{ width: summary.totalRevenue > 0 ? `${(summary.platformCommission / summary.totalRevenue * 100).toFixed(0)}%` : "0%" }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600">مستحقات الموردين</span>
                <span className="text-sm font-bold text-green-700">{fmt(summary.totalSupplierPaid)} ر.ي</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div
                  className="h-3 rounded-full bg-green-400"
                  style={{ width: summary.totalRevenue > 0 ? `${(summary.totalSupplierPaid / summary.totalRevenue * 100).toFixed(0)}%` : "0%" }}
                />
              </div>
            </div>
            <p className="text-xs text-gray-400 text-left mt-2">
              نسبة الربح: {summary.totalRevenue > 0 ? (summary.platformCommission / summary.totalRevenue * 100).toFixed(1) : 0}%
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
