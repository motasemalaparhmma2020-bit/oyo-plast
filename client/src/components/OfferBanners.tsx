import { Truck, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

interface OfferBannersProps {
  height?: number;
  columns?: number;
  backgroundColor?: string;
  shippingBg?: string;
  dealsBg?: string;
}

function useCountdownToMidnight() {
  const getSecondsLeft = () => {
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    return Math.floor((midnight.getTime() - now.getTime()) / 1000);
  };

  const [secondsLeft, setSecondsLeft] = useState(getSecondsLeft);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft(getSecondsLeft());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const h = Math.floor(secondsLeft / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function resolveBg(bg: string | undefined, fallback: string): { style: React.CSSProperties } {
  if (!bg) return { style: { background: fallback } };
  const isGradient = bg.includes("gradient") || bg.includes("(");
  return { style: isGradient ? { background: bg } : { backgroundColor: bg } };
}

export function OfferBanners({
  height = 72,
  shippingBg,
  dealsBg,
  backgroundColor,
}: OfferBannersProps) {
  const countdown = useCountdownToMidnight();
  const [, navigate] = useLocation();

  const shippingStyle = resolveBg(
    shippingBg || backgroundColor,
    "linear-gradient(135deg,#f0fdf4 0%,#ecfdf5 100%)"
  );
  const dealsStyle = resolveBg(
    dealsBg || backgroundColor,
    "linear-gradient(135deg,#fefce8 0%,#fffbeb 100%)"
  );

  return (
    <div className="px-4 py-2 w-full" data-testid="offer-banners">
      <div
        className="rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-row items-stretch overflow-hidden shadow-sm"
        style={{ minHeight: `${height}px` }}
      >
        {/* ── شحن مجاني ────────────────────────────────── */}
        <button
          className="flex-1 flex flex-row items-center gap-2.5 px-4 py-3 text-right transition-opacity active:opacity-70 hover:opacity-90"
          style={shippingStyle.style}
          onClick={() => navigate("/products?filter=free-shipping")}
          data-testid="banner-free-shipping"
          aria-label="عرض منتجات الشحن المجاني"
        >
          <div className="bg-green-100 dark:bg-green-900/40 rounded-full p-2 flex-shrink-0">
            <Truck className="w-4 h-4 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="font-bold text-xs text-gray-900 dark:text-white leading-tight">
              شحن مجاني
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight mt-0.5">
              على جميع الطلبات
            </p>
          </div>
        </button>

        {/* ── فاصل عمودي ──────────────────────────────── */}
        <div className="w-px self-stretch bg-gray-200 dark:bg-gray-600 my-3" />

        {/* ── عروض سريعة + عداد ──────────────────────── */}
        <button
          className="flex-1 flex flex-row items-center gap-2.5 px-4 py-3 text-right transition-opacity active:opacity-70 hover:opacity-90"
          style={dealsStyle.style}
          onClick={() => navigate("/products?filter=flash-deals")}
          data-testid="banner-flash-deals"
          aria-label="عرض العروض السريعة"
        >
          <div className="bg-yellow-100 dark:bg-yellow-900/40 rounded-full p-2 flex-shrink-0">
            <Zap className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-xs text-gray-900 dark:text-white leading-tight">
              عروض سريعة
            </h3>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-xs text-gray-400 dark:text-gray-500">تنتهي خلال</span>
              <span
                className="font-mono text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 rounded"
                data-testid="countdown-timer"
              >
                {countdown}
              </span>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
