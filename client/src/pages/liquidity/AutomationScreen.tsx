import { useState } from "react";
import { ChevronDown, Clock } from "lucide-react";
import { AUTOMATION_ITEMS, STATUS_META, type AutomationItem } from "./automationData";

const CATEGORIES: { key: string; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "finance", label: "مالية" },
  { key: "suppliers", label: "موردون" },
  { key: "inventory", label: "مخزون" },
  { key: "reports", label: "تقارير" },
];

export default function AutomationScreen() {
  const [openId, setOpenId] = useState<number | null>(null);
  const [cat, setCat] = useState<string>("all");

  const items = cat === "all" ? AUTOMATION_ITEMS : AUTOMATION_ITEMS.filter((i) => i.category === cat);
  const active = AUTOMATION_ITEMS.filter((i) => i.status !== "planned").length;
  const waiting = AUTOMATION_ITEMS.length - active;
  const score = AUTOMATION_ITEMS.reduce((s, i) => s + (i.status === "done" ? 1 : i.status === "in_progress" ? 0.5 : 0), 0);
  const pct = Math.round((score / AUTOMATION_ITEMS.length) * 100);

  return (
    <div className="space-y-4 pb-4">
      {/* بطاقة التقدّم */}
      <div className="rounded-2xl border bg-white p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-3">
            <div className="rounded-xl bg-slate-50 px-4 py-2 text-center">
              <p className="text-xl font-extrabold text-slate-400">{waiting}</p>
              <p className="text-[11px] text-slate-400">في الانتظار</p>
            </div>
            <div className="rounded-xl bg-blue-50 px-4 py-2 text-center">
              <p className="text-xl font-extrabold text-blue-600">{active}</p>
              <p className="text-[11px] text-blue-500">نشط الآن</p>
            </div>
          </div>
          <div className="text-right">
            <h3 className="font-bold text-slate-800">التقدّم العام للمشروع</h3>
            <p className="text-xs text-slate-500 mt-0.5">{AUTOMATION_ITEMS.length} بند أتمتة مستهدف</p>
          </div>
        </div>
        <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-gradient-to-l from-blue-500 to-indigo-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-slate-500 text-left mt-1">{pct}%</p>
      </div>

      {/* تصفية الفئات */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ direction: "rtl" }}>
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCat(c.key)}
            data-testid={`filter-cat-${c.key}`}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${cat === c.key ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
          >{c.label}</button>
        ))}
      </div>

      {/* بنود الأتمتة */}
      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.id} item={item} open={openId === item.id} onToggle={() => setOpenId(openId === item.id ? null : item.id)} />
        ))}
      </div>
    </div>
  );
}

function Card({ item, open, onToggle }: { item: AutomationItem; open: boolean; onToggle: () => void }) {
  const Icon = item.icon;
  const meta = STATUS_META[item.status];
  return (
    <div className="rounded-2xl border bg-white overflow-hidden" data-testid={`auto-item-${item.id}`}>
      <button onClick={onToggle} className="w-full p-4 flex items-center gap-3 text-right">
        <ChevronDown className={`h-5 w-5 text-slate-300 transition ${open ? "rotate-180" : ""}`} />
        <div className="flex-1">
          <p className="font-bold text-blue-800 leading-snug">{item.id}. {item.title}</p>
          <div className="flex items-center gap-2 mt-2 justify-end">
            <span className="text-[11px] text-slate-400 flex items-center gap-1"><Clock className="h-3 w-3" />{item.estTime}</span>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${meta.cls}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />{meta.label}
            </span>
          </div>
        </div>
        <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-blue-600" />
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t pt-3 space-y-3 text-right">
          <Section title="الوضع اليدوي الحالي" body={item.manualNow} tone="text-slate-600" />
          <Section title="الأتمتة المقترحة" body={item.proposedAuto} tone="text-blue-700" />
          <Section title="كيف ستعمل" body={item.howItWorks} tone="text-slate-600" />
          <Section title="حالات خاصة" body={item.edgeCases} tone="text-amber-700" />
        </div>
      )}
    </div>
  );
}

function Section({ title, body, tone }: { title: string; body: string; tone: string }) {
  return (
    <div>
      <p className={`text-xs font-bold mb-1 ${tone}`}>{title}</p>
      <p className="text-sm text-slate-600 leading-relaxed">{body}</p>
    </div>
  );
}
