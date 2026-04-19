import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowRight, Package, CheckCircle2, Clock, Truck, XCircle,
  BadgeDollarSign, RefreshCw,
} from "lucide-react";
import { useSEO } from "@/hooks/use-seo";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending:    { label: "انتظار",     color: "bg-yellow-100 text-yellow-700" },
  processing: { label: "تجهيز",     color: "bg-blue-100 text-blue-700" },
  shipped:    { label: "شحن",       color: "bg-indigo-100 text-indigo-700" },
  delivered:  { label: "مُسلَّم",   color: "bg-green-100 text-green-700" },
  completed:  { label: "مكتمل",     color: "bg-green-100 text-green-700" },
  cancelled:  { label: "ملغى",      color: "bg-red-100 text-red-700" },
  returned:   { label: "مسترجع",    color: "bg-gray-100 text-gray-600" },
  review:     { label: "مراجعة",    color: "bg-orange-100 text-orange-700" },
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("ar-YE", { day: "numeric", month: "short", year: "numeric" });
}

export default function MarketerOrders() {
  useSEO({ title: "طلباتي كمسوق | أويو بلاست" });

  const { data: orders = [], isLoading, isError, refetch } = useQuery<any[]>({
    queryKey: ["/api/me/marketer/orders"],
    staleTime: 0,
    retry: 2,
  });

  const totalCommission = orders.reduce((s, o) => s + (Number(o.commissionAmount) || 0), 0);
  const paidCount = orders.filter(o => o.commissionPaid).length;

  return (
    <div className="min-h-screen bg-[#f2f2f7] dark:bg-background pb-24" dir="rtl">
      {/* هيدر */}
      <div className="bg-gradient-to-bl from-amber-500 to-orange-600 pt-10 pb-5 px-4 relative">
        <Link href="/profile">
          <button className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/20 text-white" data-testid="btn-back-marketer-orders">
            <ArrowRight className="h-5 w-5" />
          </button>
        </Link>
        <h1 className="text-white font-black text-xl text-center">طلباتي كمسوق</h1>
        <p className="text-white/70 text-xs text-center mt-1">جميع الطلبات التي جاءت عبر كوبونك</p>

        {/* ملخص سريع */}
        {!isLoading && orders.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { label: "إجمالي الطلبات", value: String(orders.length) },
              { label: "إجمالي العمولات", value: `${totalCommission.toLocaleString()} ﷼` },
              { label: "عمولات مدفوعة", value: String(paidCount) },
            ].map((s, i) => (
              <div key={i} className="bg-white/15 rounded-xl p-2.5 text-center">
                <p className="text-white font-black text-base leading-none">{s.value}</p>
                <p className="text-white/60 text-[10px] mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mx-3 mt-3">
        {isLoading && (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-white dark:bg-card rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {isError && (
          <div className="bg-white dark:bg-card rounded-2xl p-8 flex flex-col items-center gap-3">
            <XCircle className="h-10 w-10 text-red-300" />
            <p className="text-sm text-gray-500">تعذّر تحميل الطلبات</p>
            <button onClick={() => refetch()} className="text-xs text-amber-600 font-bold flex items-center gap-1" data-testid="btn-retry-orders">
              <RefreshCw className="h-3.5 w-3.5" /> إعادة المحاولة
            </button>
          </div>
        )}

        {!isLoading && !isError && orders.length === 0 && (
          <div className="bg-white dark:bg-card rounded-2xl p-10 flex flex-col items-center gap-3 text-center">
            <Package className="h-12 w-12 text-gray-200" />
            <p className="font-semibold text-gray-500">لا توجد طلبات بعد</p>
            <p className="text-xs text-gray-400">شارك كوبونك لتبدأ تكسب العمولات</p>
          </div>
        )}

        {!isLoading && !isError && orders.length > 0 && (
          <div className="bg-white dark:bg-card rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100 dark:divide-border">
            {orders.map((order: any) => {
              const st = STATUS_MAP[order.status] ?? { label: order.status, color: "bg-gray-100 text-gray-600" };
              const comm = Number(order.commissionAmount) || 0;
              return (
                <div key={order.id} className="px-4 py-3.5 flex items-center gap-3" data-testid={`order-row-${order.id}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-sm text-gray-800 dark:text-foreground truncate">
                        {order.customer_name || "عميل"}
                      </span>
                      {order.shipping_city && (
                        <span className="text-[10px] text-gray-400">{order.shipping_city}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                      <span className="text-[10px] text-gray-400">{formatDate(order.createdAt)}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-black text-gray-800 dark:text-foreground">{Number(order.total || 0).toLocaleString()} ﷼</p>
                    {comm > 0 && (
                      <div className="flex items-center justify-end gap-1 mt-0.5">
                        <BadgeDollarSign className="h-3 w-3 text-amber-500" />
                        <span className={`text-[10px] font-bold ${order.commissionPaid ? "text-green-600" : "text-amber-600"}`}>
                          {comm.toLocaleString()} ﷼ {order.commissionPaid ? "✓" : ""}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
