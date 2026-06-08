import { useState } from "react";
import { CheckCircle2, Truck, Package, MapPin, ChevronLeft, ChevronRight, Box } from "lucide-react";
import { fmt, currencyLabel, relativeTime, type LiquidityData, type OrderRow } from "./lib";

const TONE_BADGE: Record<string, string> = {
  new: "bg-blue-50 text-blue-700",
  confirmed: "bg-violet-50 text-violet-700",
  processing: "bg-orange-50 text-orange-700",
  shipping: "bg-amber-50 text-amber-700",
  delivered: "bg-emerald-50 text-emerald-700",
  completed: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-rose-50 text-rose-700",
};

const STAGES = [
  { key: "pending", label: "جديد" },
  { key: "deposit_paid", label: "مؤكد" },
  { key: "processing", label: "تجهيز" },
  { key: "shipped", label: "قيد الشحن" },
  { key: "delivered", label: "مسلّم" },
];

function stageIndex(status: string): number {
  if (status === "completed") return 4;
  if (status === "cancelled") return -1;
  const i = STAGES.findIndex((s) => s.key === status);
  return i < 0 ? 0 : i;
}

export default function OrdersScreen({ data }: { data: LiquidityData }) {
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const [filter, setFilter] = useState<string>("all");

  if (selected) return <OrderDetail order={selected} onBack={() => setSelected(null)} />;

  const { list, stats } = data.orders;
  const statuses = Object.keys(stats.byStatus);
  const shown = filter === "all" ? list : list.filter((o) => o.status === filter);

  return (
    <div className="space-y-4 pb-4">
      {/* بطاقات إحصائية */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard color="from-emerald-500 to-green-600" icon={CheckCircle2} value={stats.delivered} label="مسلّمة" />
        <StatCard color="from-orange-500 to-amber-600" icon={Truck} value={stats.processing} label="قيد المعالجة" />
        <StatCard color="from-blue-500 to-indigo-600" icon={Package} value={stats.total} label="إجمالي الطلبات" />
      </div>

      {/* تصفية الحالة */}
      <div className="flex gap-2 overflow-x-auto pb-1 flex-row-reverse" style={{ direction: "rtl" }}>
        <Chip active={filter === "all"} onClick={() => setFilter("all")} label={`الكل (${list.length})`} />
        {statuses.map((s) => {
          const sample = list.find((o) => o.status === s);
          return (
            <Chip key={s} active={filter === s} onClick={() => setFilter(s)} label={`${sample?.statusLabel || s} (${stats.byStatus[s]})`} />
          );
        })}
      </div>

      {/* قائمة الطلبات */}
      {shown.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-10">لا توجد طلبات</p>
      ) : (
        <div className="space-y-3">
          {shown.map((o) => (
            <div key={o.id} className="rounded-2xl border bg-white p-4" data-testid={`order-card-${o.id}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1 ${TONE_BADGE[o.statusTone] || "bg-slate-100 text-slate-600"}`}>
                    <Box className="h-3 w-3" />{o.statusLabel}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">{o.code}</span>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-800">{o.customerName}</p>
                  {o.city && <p className="text-xs text-slate-500 flex items-center gap-1 justify-end mt-0.5"><span>{o.city}</span><MapPin className="h-3 w-3" /></p>}
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t">
                <button onClick={() => setSelected(o)} data-testid={`button-view-order-${o.id}`} className="text-blue-600 text-sm font-medium flex items-center gap-1">
                  <ChevronLeft className="h-4 w-4" />عرض
                </button>
                <div className="text-left">
                  <p className="font-extrabold text-slate-900">{fmt(o.total)}</p>
                  <p className="text-[11px] text-slate-400">{currencyLabel(o.currency)}</p>
                </div>
                <p className="text-xs text-slate-400">{o.itemCount} منتج · {relativeTime(o.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OrderDetail({ order, onBack }: { order: OrderRow; onBack: () => void }) {
  const idx = stageIndex(order.status);
  const cancelled = order.status === "cancelled";
  return (
    <div className="space-y-4 pb-4">
      <button onClick={onBack} data-testid="button-back-orders" className="flex items-center gap-1 text-blue-600 font-medium">
        <ChevronRight className="h-5 w-5" />رجوع للطلبات
      </button>

      <div className="rounded-2xl border bg-white p-5 text-right">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-slate-400 font-mono">{order.code}</span>
          <h2 className="text-xl font-extrabold">{order.customerName}</h2>
        </div>
        {order.city && <p className="text-sm text-slate-500 flex items-center gap-1 justify-end"><span>{order.city}</span><MapPin className="h-3.5 w-3.5" /></p>}
        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <span className="text-2xl font-extrabold text-blue-700">{fmt(order.total)} {currencyLabel(order.currency)}</span>
          <span className="text-sm text-slate-500">{order.itemCount} منتج · {relativeTime(order.createdAt)}</span>
        </div>
      </div>

      {/* شريط المراحل */}
      <div className="rounded-2xl border bg-white p-5">
        <h3 className="font-bold text-right mb-5">مراحل الطلب</h3>
        {cancelled ? (
          <p className="text-center text-rose-600 font-bold py-2">تم إلغاء هذا الطلب</p>
        ) : (
          <div className="flex items-center justify-between" style={{ direction: "rtl" }}>
            {STAGES.map((s, i) => {
              const reached = i <= idx;
              return (
                <div key={s.key} className="flex-1 flex flex-col items-center relative">
                  {i > 0 && <div className={`absolute top-3.5 right-1/2 w-full h-0.5 ${i <= idx ? "bg-blue-600" : "bg-slate-200"}`} />}
                  <div className={`w-7 h-7 rounded-full z-10 flex items-center justify-center text-xs font-bold ${reached ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-400"}`}>
                    {reached ? "✓" : i + 1}
                  </div>
                  <span className={`text-[10px] mt-1.5 text-center ${reached ? "text-blue-700 font-medium" : "text-slate-400"}`}>{s.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ color, icon: Icon, value, label }: { color: string; icon: any; value: number; label: string }) {
  return (
    <div className={`rounded-2xl p-4 text-white bg-gradient-to-br ${color} text-center`}>
      <Icon className="h-5 w-5 mx-auto mb-1 opacity-90" />
      <p className="text-2xl font-extrabold">{value}</p>
      <p className="text-xs text-white/90">{label}</p>
    </div>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
    >{label}</button>
  );
}
