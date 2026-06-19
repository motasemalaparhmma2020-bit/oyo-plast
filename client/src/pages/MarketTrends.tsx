import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, TrendingUp, ArrowUpRight, ArrowDownRight, Package, ShoppingCart, DollarSign, Calendar, BarChart3 } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, PieChart, Pie, Cell,
} from "recharts";

/* ─── Types ─────────────────────────────────────────────────────────── */
interface MarketTrendsData {
  summary: {
    totalRevenue: number;
    totalOrders: number;
    avgOrderValue: number;
    revenueGrowth: number;        // vs last month %
    ordersGrowth: number;         // vs last month %
    topProductRevenue: number;
    topProductName: string;
    bestDayRevenue: number;
    bestDayName: string;
    worstDayRevenue: number;
    worstDayName: string;
  };
  dailyTrends: Array<{
    day: string;
    revenue: number;
    orders: number;
    avgValue: number;
    dayOfWeek: string;
  }>;
  weeklyTrends: Array<{
    week: string;
    revenue: number;
    orders: number;
    growthRate: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    revenue: number;
    orders: number;
    growthRate: number;
  }>;
  productDemand: Array<{
    productName: string;
    productId: number;
    revenue: number;
    units: number;
    trend: "rising" | "falling" | "stable";
    trendChange: number;          // % change vs previous period
    lastWeekRevenue: number;
    orders: number;
  }>;
  categoryTrends: Array<{
    categoryName: string;
    categoryId: number;
    revenue: number;
    orders: number;
    trend: "rising" | "falling" | "stable";
    trendChange: number;
    sharePercent: number;
  }>;
  hourlyHeatmap: Array<{
    hour: string;
    orders: number;
    revenue: number;
  }>;
  seasonalInsights: {
    peakDay: string;
    peakDayOrders: number;
    peakHour: string;
    peakHourOrders: number;
    slowestDay: string;
    slowestDayOrders: number;
    weekendRevenue: number;
    weekdayRevenue: number;
    trendDirection: "rising" | "falling" | "stable";
    trendPercent: number;
  };
}

/* ─── Helpers ───────────────────────────────────────────────────────── */
function fmt(n: number) {
  return n.toLocaleString("ar-YE");
}

function fmtShort(n: number) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toLocaleString("ar-YE");
}

function arDayName(day: string) {
  const map: Record<string, string> = {
    Saturday: "السبت", Sunday: "الأحد", Monday: "الاثنين",
    Tuesday: "الثلاثاء", Wednesday: "الأربعاء", Thursday: "الخميس", Friday: "الجمعة",
  };
  return map[day] || day;
}

function arMonthName(month: string) {
  const [y, m] = month.split("-");
  const months = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
  ];
  return months[parseInt(m) - 1] || month;
}

const COLORS = ["#2196F3", "#FF9800", "#4CAF50", "#E91E63", "#9C27B0", "#00BCD4", "#FF5722", "#795548"];

const TREND_COLOR = { rising: "text-green-600", falling: "text-red-600", stable: "text-gray-600" };
const TREND_ICON = { rising: ArrowUpRight, falling: ArrowDownRight, stable: BarChart3 };
const TREND_BG = { rising: "bg-green-50", falling: "bg-red-50", stable: "bg-gray-50" };

/* ─── Main Component ────────────────────────────────────────────────── */
export default function MarketTrends({ adminToken }: { adminToken: string | null }) {
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");

  const { data, isLoading, error } = useQuery<MarketTrendsData>({
    queryKey: ["/api/admin/market-trends"],
    queryFn: async () => {
      const res = await fetch("/api/admin/market-trends", {
        headers: { "x-admin-token": adminToken || "" },
      });
      if (!res.ok) throw new Error("فشل جلب بيانات الاتجاهات");
      return res.json();
    },
    enabled: !!adminToken,
    staleTime: 120000,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-gray-500">جاري تحميل تحليلات الاتجاهات...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-20 text-red-600">
        <p className="font-semibold">فشل تحميل البيانات</p>
        <p className="text-sm text-gray-500 mt-2">{(error as Error)?.message || "يرجى المحاولة لاحقاً"}</p>
      </div>
    );
  }

  const { summary, dailyTrends, weeklyTrends, monthlyTrends, productDemand, categoryTrends, hourlyHeatmap, seasonalInsights } = data;

  const trendData = period === "daily" ? dailyTrends : period === "weekly" ? weeklyTrends : monthlyTrends;
  const trendXKey = period === "daily" ? "day" : period === "weekly" ? "week" : "month";
  const trendLabel = period === "daily" ? "اليوم" : period === "weekly" ? "الأسبوع" : "الشهر";

  return (
    <div className="space-y-6 pb-10" dir="rtl">

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          icon={<DollarSign className="h-5 w-5 text-blue-600" />}
          label="إجمالي المبيعات"
          value={fmt(summary.totalRevenue)}
          suffix="ر.ي"
          trend={summary.revenueGrowth}
          trendLabel="vs الشهر الماضي"
        />
        <SummaryCard
          icon={<ShoppingCart className="h-5 w-5 text-green-600" />}
          label="إجمالي الطلبات"
          value={fmt(summary.totalOrders)}
          suffix=""
          trend={summary.ordersGrowth}
          trendLabel="vs الشهر الماضي"
        />
        <SummaryCard
          icon={<Package className="h-5 w-5 text-orange-600" />}
          label="الأكثر مبيعاً"
          value={summary.topProductName}
          suffix=""
          subValue={fmt(summary.topProductRevenue) + " ر.ي"}
          compact
        />
        <SummaryCard
          icon={<Calendar className="h-5 w-5 text-purple-600" />}
          label="أفضل يوم"
          value={summary.bestDayName}
          suffix=""
          subValue={fmt(summary.bestDayRevenue) + " ر.ي"}
          compact
        />
      </div>

      {/* ── Trend Chart ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-right flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                اتجاهات المبيعات
              </CardTitle>
              <CardDescription className="text-right mt-1">
                تحليل المبيعات والطلبات عبر الزمن
              </CardDescription>
            </div>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {(["daily", "weekly", "monthly"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    period === p ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {p === "daily" ? "يومي" : p === "weekly" ? "أسبوعي" : "شهري"}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2196F3" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2196F3" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey={trendXKey}
                  tickFormatter={(v) => {
                    if (period === "monthly") return arMonthName(v);
                    if (period === "daily") return v.slice(5);
                    return v;
                  }}
                  tick={{ fontSize: 11, fill: "#666" }}
                />
                <YAxis
                  yAxisId="left"
                  tickFormatter={(v) => fmtShort(v)}
                  tick={{ fontSize: 11, fill: "#666" }}
                  orientation="right"
                />
                <YAxis
                  yAxisId="right"
                  tickFormatter={(v) => fmtShort(v)}
                  tick={{ fontSize: 11, fill: "#666" }}
                  orientation="left"
                />
                <Tooltip
                  contentStyle={{ direction: "rtl", fontFamily: "inherit", borderRadius: "8px", border: "1px solid #e5e7eb" }}
                  formatter={(value: any, name: any) => {
                    if (name === "revenue") return [fmt(value) + " ر.ي", "المبيعات"];
                    if (name === "orders") return [fmt(value), "الطلبات"];
                    return [value, name];
                  }}
                  labelFormatter={(label: any) => {
                    if (period === "monthly") return arMonthName(label);
                    return label;
                  }}
                />
                <Legend
                  wrapperStyle={{ direction: "rtl" }}
                  formatter={(value: any) => (value === "revenue" ? "المبيعات" : "الطلبات")}
                />
                <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="#2196F3" fill="url(#revGrad)" strokeWidth={2} dot={false} />
                <Bar yAxisId="right" dataKey="orders" fill="#4CAF50" radius={[4, 4, 0, 0]} barSize={period === "daily" ? 12 : 20} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ── Seasonal Insights + Hourly Heatmap ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-right flex items-center gap-2">
              <Calendar className="h-5 w-5 text-amber-600" />
              رؤى موسمية
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InsightRow label="أنشط يوم" value={arDayName(seasonalInsights.peakDay)} chip={fmt(seasonalInsights.peakDayOrders) + " طلب"} color="amber" />
            <InsightRow label="أنشط ساعة" value={seasonalInsights.peakHour} chip={fmt(seasonalInsights.peakHourOrders) + " طلب"} color="orange" />
            <InsightRow label="أبطأ يوم" value={arDayName(seasonalInsights.slowestDay)} chip={fmt(seasonalInsights.slowestDayOrders) + " طلب"} color="gray" />
            <div className="pt-2 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">مبيعات نهاية الأسبوع</span>
                <span className="font-bold text-sm">{fmt(seasonalInsights.weekendRevenue)} ر.ي</span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-sm text-gray-600">مبيعات أيام العمل</span>
                <span className="font-bold text-sm">{fmt(seasonalInsights.weekdayRevenue)} ر.ي</span>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Badge className={`${TREND_BG[seasonalInsights.trendDirection]} ${TREND_COLOR[seasonalInsights.trendDirection]} border-0`}>
                {seasonalInsights.trendDirection === "rising" ? "صاعد" : seasonalInsights.trendDirection === "falling" ? "هابط" : "مستقر"}
              </Badge>
              <span className="text-sm text-gray-600">
                {Math.abs(seasonalInsights.trendPercent).toFixed(1)}% vs الفترة السابقة
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-right flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-cyan-600" />
              خريطة الساعات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyHeatmap} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} orientation="right" />
                  <Tooltip
                    contentStyle={{ direction: "rtl", fontFamily: "inherit", borderRadius: "8px" }}
                    formatter={(value: any) => [fmt(value), "الطلبات"]}
                  />
                  <Bar dataKey="orders" fill="#00BCD4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Product Demand + Category Trends ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Product Demand */}
        <Card>
          <CardHeader>
            <CardTitle className="text-right flex items-center gap-2">
              <Package className="h-5 w-5 text-emerald-600" />
              الطلب على المنتجات
            </CardTitle>
            <CardDescription className="text-right">
              المنتجات الأكثر مبيعاً واتجاهاتها
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {productDemand.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">لا توجد بيانات كافية</p>
            ) : (
              productDemand.map((p, i) => {
                const Icon = TREND_ICON[p.trend];
                return (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium truncate">{p.productName}</p>
                        <div className="flex items-center gap-1">
                          <Icon className={`h-3.5 w-3.5 ${TREND_COLOR[p.trend]}`} />
                          <span className={`text-xs font-bold ${TREND_COLOR[p.trend]}`}>
                            {p.trendChange > 0 ? "+" : ""}{p.trendChange.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-gray-500">{fmt(p.units)} قطعة</span>
                        <span className="text-xs text-gray-500">{fmt(p.revenue)} ر.ي</span>
                        <span className="text-xs text-gray-500">{fmt(p.orders)} طلب</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Category Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="text-right flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-600" />
              أداء الأقسام
            </CardTitle>
            <CardDescription className="text-right">
              توزيع المبيعات حسب الأقسام
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryTrends}
                    dataKey="revenue"
                    nameKey="categoryName"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                  >
                    {categoryTrends.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ direction: "rtl", fontFamily: "inherit", borderRadius: "8px" }}
                    formatter={(value: any, name: any) => [fmt(value) + " ر.ي", name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {categoryTrends.map((c, i) => {
                const Icon = TREND_ICON[c.trend];
                return (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <div className="flex-1 flex items-center justify-between">
                      <span className="text-sm font-medium">{c.categoryName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{c.sharePercent.toFixed(1)}%</span>
                        <Icon className={`h-3.5 w-3.5 ${TREND_COLOR[c.trend]}`} />
                        <span className={`text-xs font-bold ${TREND_COLOR[c.trend]}`}>
                          {c.trendChange > 0 ? "+" : ""}{c.trendChange.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Daily Trend Table ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-right flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-slate-600" />
            تفاصيل الأداء اليومي
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" dir="rtl">
              <thead>
                <tr className="border-b">
                  <th className="text-right py-2 px-3 font-semibold">اليوم</th>
                  <th className="text-right py-2 px-3 font-semibold">المبيعات</th>
                  <th className="text-right py-2 px-3 font-semibold">الطلبات</th>
                  <th className="text-right py-2 px-3 font-semibold">متوسط الطلب</th>
                  <th className="text-right py-2 px-3 font-semibold">الاتجاه</th>
                </tr>
              </thead>
              <tbody>
                {dailyTrends.slice(0, 14).map((d, i) => {
                  const prev = dailyTrends[i + 1];
                  const change = prev ? ((d.revenue - prev.revenue) / prev.revenue * 100) : 0;
                  const isRising = change > 0;
                  return (
                    <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 px-3 font-medium">
                        {d.day} <span className="text-xs text-gray-500">({arDayName(d.dayOfWeek)})</span>
                      </td>
                      <td className="py-2 px-3">{fmt(d.revenue)} ر.ي</td>
                      <td className="py-2 px-3">{fmt(d.orders)}</td>
                      <td className="py-2 px-3">{fmt(Math.round(d.avgValue))} ر.ي</td>
                      <td className="py-2 px-3">
                        {prev ? (
                          <span className={`inline-flex items-center gap-1 text-xs font-bold ${isRising ? "text-green-600" : "text-red-600"}`}>
                            {isRising ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {Math.abs(change).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Sub-components ────────────────────────────────────────────────── */
function SummaryCard({ icon, label, value, suffix, trend, trendLabel, subValue, compact }: any) {
  return (
    <Card className="border-0 shadow-sm bg-gradient-to-br from-slate-50 to-white">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="p-1.5 rounded-lg bg-white shadow-sm">{icon}</div>
          {trend != null && (
            <Badge variant="outline" className={`text-xs ${trend >= 0 ? "text-green-600 border-green-200" : "text-red-600 border-red-200"}`}>
              {trend >= 0 ? "+" : ""}{trend.toFixed(1)}%
            </Badge>
          )}
        </div>
        <p className={`font-bold ${compact ? "text-sm" : "text-xl"} text-slate-800`}>{value}</p>
        {suffix && <p className="text-xs text-gray-500">{suffix}</p>}
        {subValue && <p className="text-xs text-gray-500 mt-0.5">{subValue}</p>}
        {trendLabel && <p className="text-[10px] text-gray-400 mt-1">{trendLabel}</p>}
      </CardContent>
    </Card>
  );
}

function InsightRow({ label, value, chip, color }: any) {
  const colorMap: Record<string, string> = {
    amber: "bg-amber-50 text-amber-700",
    orange: "bg-orange-50 text-orange-700",
    gray: "bg-gray-50 text-gray-700",
  };
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{value}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${colorMap[color] || colorMap.gray}`}>{chip}</span>
      </div>
    </div>
  );
}
