import { useState } from "react";
import { Wallet, Building2, Landmark, Banknote, ArrowUp, ArrowDown, Send, Download, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fmt, type LiquidityData, type LiquiditySource, relativeTime } from "./lib";

function sourceIcon(s: LiquiditySource) {
  const base = "h-5 w-5";
  if (s.kind === "bank")
    return s.icon.includes("green")
      ? <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center"><Building2 className={`${base} text-emerald-600`} /></div>
      : <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center"><Landmark className={`${base} text-blue-600`} /></div>;
  if (s.kind === "wallet")
    return <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center"><Wallet className={`${base} text-purple-600`} /></div>;
  return <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center"><Banknote className={`${base} text-amber-600`} /></div>;
}

export default function WalletScreen({ data }: { data: LiquidityData }) {
  const { toast } = useToast();
  const [filter, setFilter] = useState<"all" | "in" | "out">("all");

  const totalBalance = data.liquiditySources.reduce((s, x) => s + x.balance, 0);
  const incoming = data.sales.today;
  const outgoing = Math.round(data.suppliers.totalDue * 0.15);

  // آخر العمليات: الواردة من طلبات حقيقية + صادرة تمثيلية (موردون)
  const ops = [
    ...data.orders.list.slice(0, 8).map((o) => ({
      dir: "in" as const,
      title: `تحصيل طلب ${o.code}`,
      sub: o.customerName,
      amount: o.total,
      at: o.createdAt,
    })),
    ...data.suppliers.list.slice(0, 4).map((s) => ({
      dir: "out" as const,
      title: `دفعة مورد — ${s.name}`,
      sub: "بيانات تمثيلية",
      amount: Math.round(s.balanceDue || 1000),
      at: "",
    })),
  ];
  const shownOps = ops.filter((o) => filter === "all" || o.dir === filter);

  const preview = () => toast({ title: "وضع المعاينة", description: "هذا زر عرض فقط في النسخة التجريبية." });

  return (
    <div className="space-y-4 pb-4">
      {/* بطاقة الرصيد الإجمالي */}
      <div className="rounded-3xl p-6 text-white shadow-lg bg-gradient-to-br from-blue-800 via-blue-700 to-indigo-900">
        <div className="flex items-start justify-between">
          <Wallet className="h-7 w-7 opacity-70" />
          <div className="text-left">
            <p className="text-sm text-white/70 mb-1">الرصيد الإجمالي</p>
            <p className="text-4xl font-extrabold tracking-tight" data-testid="text-total-balance">{fmt(totalBalance)}</p>
            <p className="text-xs text-white/60 mt-1">ر.ي · جميع المصادر</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-5">
          <div className="rounded-2xl bg-white/10 p-3 backdrop-blur">
            <div className="flex items-center justify-end gap-1 text-white/70 text-xs"><span>الخارج</span><ArrowUp className="h-3.5 w-3.5" /></div>
            <p className="text-lg font-bold text-right" data-testid="text-outgoing">-{fmt(outgoing)}</p>
          </div>
          <div className="rounded-2xl bg-white/15 p-3 backdrop-blur">
            <div className="flex items-center justify-end gap-1 text-white/70 text-xs"><span>الداخل</span><ArrowDown className="h-3.5 w-3.5" /></div>
            <p className="text-lg font-bold text-right" data-testid="text-incoming">+{fmt(incoming)}</p>
          </div>
        </div>
      </div>

      {/* أزرار العرض */}
      <div className="grid grid-cols-3 gap-3">
        <button onClick={preview} data-testid="button-deposit" className="rounded-2xl border bg-white py-4 flex flex-col items-center gap-2 active:scale-95 transition">
          <Download className="h-5 w-5 text-blue-600" /><span className="text-sm font-medium">إيداع</span>
        </button>
        <button onClick={preview} data-testid="button-withdraw" className="rounded-2xl border bg-white py-4 flex flex-col items-center gap-2 active:scale-95 transition">
          <Upload className="h-5 w-5 text-blue-600" /><span className="text-sm font-medium">سحب</span>
        </button>
        <button onClick={preview} data-testid="button-transfer" className="rounded-2xl border bg-white py-4 flex flex-col items-center gap-2 active:scale-95 transition">
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center"><Send className="h-4 w-4 text-white" /></div>
          <span className="text-sm font-medium">تحويل</span>
        </button>
      </div>

      {/* المصادر */}
      <div className="rounded-2xl border bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">بيانات تمثيلية</span>
          <h3 className="font-bold text-right">المصادر</h3>
        </div>
        <div className="divide-y">
          {data.liquiditySources.map((s) => (
            <div key={s.id} className="flex items-center justify-between py-3" data-testid={`source-${s.id}`}>
              <span className="font-bold text-slate-800">{fmt(s.balance)}</span>
              <div className="flex items-center gap-3">
                <span className="font-medium text-slate-700">{s.name}</span>
                {sourceIcon(s)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* آخر العمليات */}
      <div className="rounded-2xl border bg-white p-4">
        <h3 className="font-bold text-right mb-3">آخر العمليات</h3>
        <div className="flex gap-2 mb-4 justify-end">
          {([["all", "الكل"], ["out", "صادر"], ["in", "وارد"]] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              data-testid={`filter-op-${k}`}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${filter === k ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
            >{label}</button>
          ))}
        </div>
        {shownOps.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-6">لا توجد عمليات</p>
        ) : (
          <div className="space-y-2">
            {shownOps.map((o, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 border-b last:border-0" data-testid={`op-row-${i}`}>
                <span className={`font-bold ${o.dir === "in" ? "text-emerald-600" : "text-rose-600"}`}>
                  {o.dir === "in" ? "+" : "-"}{fmt(o.amount)}
                </span>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-800">{o.title}</p>
                  <p className="text-xs text-slate-400">{o.sub}{o.at ? ` · ${relativeTime(o.at)}` : ""}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
