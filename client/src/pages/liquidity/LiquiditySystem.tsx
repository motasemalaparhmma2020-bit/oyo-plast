import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wallet, FileText, Package, CheckCircle2, Loader2 } from "lucide-react";
import WalletScreen from "./WalletScreen";
import ReportsScreen from "./ReportsScreen";
import OrdersScreen from "./OrdersScreen";
import AutomationScreen from "./AutomationScreen";
import type { LiquidityData } from "./lib";

type Tab = "wallet" | "reports" | "orders" | "automation";

const TABS: { key: Tab; label: string; icon: any; subtitle: string }[] = [
  { key: "wallet", label: "المحفظة", icon: Wallet, subtitle: "المحفظة والسيولة" },
  { key: "reports", label: "التقارير", icon: FileText, subtitle: "تقارير دورية تلقائية" },
  { key: "orders", label: "الطلبات", icon: Package, subtitle: "كل الطلبات لحظياً" },
  { key: "automation", label: "الأتمتة", icon: CheckCircle2, subtitle: "نظام الأتمتة الكاملة (معاينة)" },
];

export default function LiquiditySystem() {
  const [tab, setTab] = useState<Tab>("wallet");

  const { data, isLoading, isError } = useQuery<LiquidityData>({
    queryKey: ["/api/liquidity-preview"],
    refetchInterval: 60_000,
  });

  const current = TABS.find((t) => t.key === tab)!;

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 font-sans" style={{ fontFamily: "'IBM Plex Sans Arabic', 'Cairo', sans-serif" }}>
      {/* رأس أزرق */}
      <header className="bg-gradient-to-l from-blue-700 to-blue-600 text-white px-4 pt-5 pb-4 sticky top-0 z-30 shadow-md">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="bg-white text-blue-700 font-extrabold rounded-xl px-3 py-1.5 text-lg shadow-sm">OYO</div>
          <div className="text-right">
            <h1 className="text-lg font-extrabold">أويو بلاست</h1>
            <p className="text-xs text-white/80">{current.subtitle}</p>
          </div>
        </div>
      </header>

      {/* المحتوى */}
      <main className="max-w-lg mx-auto px-4 pt-4 pb-28">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mb-3" />
            <p className="text-sm">جارٍ تحميل البيانات…</p>
          </div>
        ) : isError || !data ? (
          <div className="text-center py-24 text-slate-400">
            <p className="text-sm">تعذّر تحميل البيانات. حدّث الصفحة.</p>
          </div>
        ) : (
          <>
            {tab === "wallet" && <WalletScreen data={data} />}
            {tab === "reports" && <ReportsScreen data={data} />}
            {tab === "orders" && <OrdersScreen data={data} />}
            {tab === "automation" && <AutomationScreen />}
          </>
        )}
      </main>

      {/* شريط تنقّل سفلي */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t z-30">
        <div className="max-w-lg mx-auto grid grid-cols-4">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                data-testid={`nav-${t.key}`}
                className={`flex flex-col items-center gap-1 py-2.5 transition ${isActive ? "text-blue-600" : "text-slate-400"}`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[11px] font-medium">{t.label}</span>
                {isActive && <span className="w-1 h-1 rounded-full bg-blue-600" />}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
