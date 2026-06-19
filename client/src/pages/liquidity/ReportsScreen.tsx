import { useState } from "react";
import { BarChart3, AlertTriangle, PieChart, FileText, PackageSearch, ChevronLeft } from "lucide-react";
import { fmt, type LiquidityData } from "./lib";

export default function ReportsScreen({ data }: { data: LiquidityData }) {
  const [open, setOpen] = useState<string | null>(null);
  const totalBalance = data.liquiditySources.reduce((s, x) => s + x.balance, 0);

  const toggle = (k: string) => setOpen(open === k ? null : k);

  const reports = [
    {
      key: "sales",
      accent: "bg-blue-500",
      iconBg: "bg-blue-600",
      icon: BarChart3,
      title: "تقرير المبيعات اليومي",
      sub: "إجمالي مبيعات اليوم + أفضل المنتجات",
      chip: `${fmt(data.sales.today)} ر.ي`,
      chipTime: "اليوم",
      detail: (
        <div className="space-y-2 pt-1">
          <Row label="مبيعات اليوم" value={`${fmt(data.sales.today)} ر.ي`} />
          <Row label="مبيعات أمس" value={`${fmt(data.sales.yesterday)} ر.ي`} />
          <Row label="الإجمالي التراكمي" value={`${fmt(data.sales.allTime)} ر.ي`} />
          <p className="text-xs font-bold text-slate-500 pt-2">أفضل المنتجات</p>
          {data.sales.topProducts.length === 0 ? (
            <p className="text-xs text-slate-400">لا توجد بيانات</p>
          ) : data.sales.topProducts.map((p, i) => (
            <Row key={i} label={`${p.name} (${p.qty})`} value={`${fmt(p.total)} ر.ي`} />
          ))}
        </div>
      ),
    },
    {
      key: "credit",
      accent: "bg-rose-500",
      iconBg: "bg-rose-500",
      icon: AlertTriangle,
      title: "التقرير الائتماني الأسبوعي",
      sub: "العملاء المتأخرون عن السداد",
      chip: `${data.credit.lateCount} عملاء`,
      chipTime: "أسبوعي",
      detail: (
        <div className="space-y-2 pt-1">
          {data.credit.lateCustomers.length === 0 ? (
            <p className="text-xs text-slate-400">لا يوجد عملاء متأخرون حالياً 🎉</p>
          ) : data.credit.lateCustomers.map((c, i) => (
            <Row key={i} label={`${c.name} (${c.ordersCount} طلب)`} value={`${fmt(c.amount)} ر.ي`} danger />
          ))}
        </div>
      ),
    },
    {
      key: "liquidity",
      accent: "bg-slate-800",
      iconBg: "bg-slate-800",
      icon: PieChart,
      title: "تقرير السيولة",
      sub: "أرصدة البنوك والمحافظ والكاش",
      chip: `${fmt(totalBalance)} ر.ي`,
      chipTime: "لحظي",
      detail: (
        <div className="space-y-2 pt-1">
          <p className="text-[11px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full w-fit">بيانات حقيقية ✓</p>
          {data.liquiditySources.map((s) => (
            <Row key={s.id} label={s.name} value={`${fmt(s.balance)} ر.ي`} />
          ))}
        </div>
      ),
    },
    {
      key: "suppliers",
      accent: "bg-emerald-500",
      iconBg: "bg-emerald-500",
      icon: FileText,
      title: "كشف حساب الموردين",
      sub: "مبيعات ومدفوعات لكل مورد",
      chip: `${data.suppliers.count} مورد`,
      chipTime: "محدّث",
      detail: (
        <div className="space-y-2 pt-1">
          {data.suppliers.list.length === 0 ? (
            <p className="text-xs text-slate-400">لا يوجد موردون</p>
          ) : data.suppliers.list.map((s, i) => (
            <Row key={i} label={s.name} value={`مستحق: ${fmt(s.balanceDue)} ر.ي`} />
          ))}
        </div>
      ),
    },
    {
      key: "inventory",
      accent: "bg-orange-500",
      iconBg: "bg-orange-500",
      icon: PackageSearch,
      title: "تقرير المخزون",
      sub: "أصناف وصلت حد إعادة الطلب",
      chip: `${data.inventory.lowStockCount} صنف`,
      chipTime: "لحظي",
      detail: (
        <div className="space-y-2 pt-1">
          {data.inventory.lowStock.length === 0 ? (
            <p className="text-xs text-slate-400">المخزون بحالة جيدة ✅</p>
          ) : data.inventory.lowStock.map((p, i) => (
            <Row key={i} label={p.name} value={`متبقٍ ${p.stock} (حد ${p.reorderPoint})`} danger />
          ))}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 pb-4">
      {/* بطاقة الأسبوع */}
      <div className="rounded-3xl p-6 text-white shadow-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 text-right">
        <p className="text-sm text-white/80">📅 هذا الأسبوع</p>
        <p className="text-4xl font-extrabold my-1">{reports.length} تقارير</p>
        <p className="text-sm text-white/80">تُصدر تلقائياً حسب الجدول</p>
      </div>

      {reports.map((r) => {
        const Icon = r.icon;
        const isOpen = open === r.key;
        return (
          <div key={r.key} className="rounded-2xl border bg-white overflow-hidden" data-testid={`report-${r.key}`}>
            <div className={`h-1.5 ${r.accent}`} />
            <button onClick={() => toggle(r.key)} className="w-full p-4 flex items-center gap-3 text-right">
              <ChevronLeft className={`h-5 w-5 text-slate-300 transition ${isOpen ? "-rotate-90" : ""}`} />
              <div className="flex-1">
                <p className="font-bold text-slate-800">{r.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{r.sub}</p>
                <div className="flex items-center gap-2 mt-2 justify-end">
                  <span className="text-xs font-bold bg-slate-100 px-2 py-1 rounded-md">{r.chip}</span>
                  <span className="text-[11px] text-slate-400">🕐 {r.chipTime}</span>
                </div>
              </div>
              <div className={`w-12 h-12 rounded-2xl ${r.iconBg} flex items-center justify-center shrink-0`}>
                <Icon className="h-6 w-6 text-white" />
              </div>
            </button>
            {isOpen && <div className="px-4 pb-4 border-t pt-3">{r.detail}</div>}
          </div>
        );
      })}
    </div>
  );
}

function Row({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm py-1">
      <span className={`font-semibold ${danger ? "text-rose-600" : "text-slate-700"}`}>{value}</span>
      <span className="text-slate-500">{label}</span>
    </div>
  );
}
