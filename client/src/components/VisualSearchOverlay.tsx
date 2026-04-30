import { useEffect, useRef, useState } from "react";
import { X, ImageIcon } from "lucide-react";

// ──────────────────────────────────────────────────────────────────
// شاشة البحث بالكاميرا — بنمط SHEIN 100%
// المرحلة 1 (analyzing): الصورة في الخلفية + خط ماسح + دائرة %0→%100 في المنتصف
// المرحلة 2 (results): الصورة تنكمش للأعلى + درج نتائج من الأسفل
// ──────────────────────────────────────────────────────────────────

export interface VisualResultProduct {
  id: number | string;
  name: string;
  image?: string | null;
  price?: number | string | null;
  originalPrice?: number | string | null;
  discount?: number | null;
}

interface VisualSearchOverlayProps {
  imageUrl: string | null;
  isAnalyzing: boolean;
  isLoadingResults?: boolean;
  results?: VisualResultProduct[];
  keywords?: string;
  onCancel: () => void;
  onSelectProduct: (id: number | string) => void;
}

// تنسيق السعر بالريال اليمني (مع فاصلة الآلاف)
function formatPrice(price: number | string | null | undefined): string {
  if (price == null || price === "") return "—";
  const num = typeof price === "string" ? Number(price) : price;
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("ar-YE", { maximumFractionDigits: 0 }).format(num);
}

export function VisualSearchOverlay({
  imageUrl,
  isAnalyzing,
  isLoadingResults = false,
  results = [],
  keywords = "",
  onCancel,
  onSelectProduct,
}: VisualSearchOverlayProps) {
  // ────── عداد النسبة المئوية المتحرك (0% → 100%) ──────
  // يتزايد بشكل لوغاريتمي (سريع في البداية ثم يبطئ) ليعطي إحساس واقعي بالتقدم
  const [percent, setPercent] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const targetCapRef = useRef<number>(92); // لا نتجاوز 92% حتى تصل النتائج فعلياً

  useEffect(() => {
    if (isAnalyzing && imageUrl) {
      setPercent(0);
      startRef.current = performance.now();
      targetCapRef.current = 92;
      const tick = () => {
        const elapsed = (performance.now() - startRef.current) / 1000; // بالثواني
        // منحنى لوغاريتمي: يصل لـ 50% خلال ثانية، 80% خلال 2 ثانية، يقترب من 92% خلال 3 ثوانٍ
        const target = Math.min(targetCapRef.current, Math.round(92 * (1 - Math.exp(-elapsed / 1.2))));
        setPercent(target);
        if (target < targetCapRef.current) {
          rafRef.current = requestAnimationFrame(tick);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    } else if (!isAnalyzing && imageUrl) {
      // عند انتهاء التحليل → قفز سريع إلى 100% ثم نُظهر الدرج
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setPercent(100);
    } else {
      setPercent(0);
    }
  }, [isAnalyzing, imageUrl]);

  // عند انتهاء التحليل، اعرض الدرج بعد لحظة قصيرة (ليرى المستخدم 100% أولاً)
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    if (!isAnalyzing && imageUrl) {
      const t = setTimeout(() => setDrawerOpen(true), 350);
      return () => clearTimeout(t);
    } else {
      setDrawerOpen(false);
    }
  }, [isAnalyzing, imageUrl]);

  if (!imageUrl) return null;

  const showResults = !isAnalyzing;

  // حساب محيط الدائرة لرسم الـ progress ring
  const RADIUS = 54;
  const STROKE = 4;
  const CIRC = 2 * Math.PI * RADIUS;
  const dashOffset = CIRC * (1 - percent / 100);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black flex flex-col overflow-hidden"
      data-testid="visual-search-overlay"
      dir="rtl"
    >
      {/* زر الإغلاق العلوي — دائماً ظاهر */}
      <button
        onClick={onCancel}
        aria-label="إغلاق البحث"
        className="absolute top-4 right-4 z-30 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur text-white flex items-center justify-center transition-colors shadow-lg"
        data-testid="button-cancel-visual-search"
      >
        <X className="h-5 w-5" />
      </button>

      {/* ──────────── منطقة الصورة (تنكمش عند ظهور النتائج) ──────────── */}
      <div
        className="relative w-full bg-black overflow-hidden transition-all duration-500 ease-out"
        style={{ height: showResults ? "32vh" : "100vh" }}
      >
        <img
          src={imageUrl}
          alt="صورة البحث"
          className={`w-full h-full object-contain transition-all duration-500 ${
            isAnalyzing ? "opacity-90" : "opacity-100"
          }`}
          data-testid="img-visual-search-preview"
        />

        {/* ─── طبقة التحليل: ماسح SHEIN + دائرة %0→%100 ─── */}
        {isAnalyzing && (
          <>
            {/* أطر الزوايا الأربع (مثل ماسح QR) */}
            <div className="pointer-events-none absolute inset-6 sm:inset-10 z-10">
              <div className="absolute top-0 right-0 w-8 h-8 border-t-[3px] border-r-[3px] border-cyan-300 rounded-tr-lg" />
              <div className="absolute top-0 left-0 w-8 h-8 border-t-[3px] border-l-[3px] border-cyan-300 rounded-tl-lg" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] border-cyan-300 rounded-br-lg" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[3px] border-l-[3px] border-cyan-300 rounded-bl-lg" />
            </div>

            {/* الخط الماسح المتحرك (من فوق لتحت بلا توقف) */}
            <div className="pointer-events-none absolute inset-x-6 sm:inset-x-10 top-6 sm:top-10 bottom-6 sm:bottom-10 overflow-hidden z-10">
              <div className="visual-scanner-line" />
            </div>

            {/* ─── الدائرة المركزية بنمط SHEIN: %22 + نص ─── */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center z-20">
              <div className="relative w-32 h-32 flex items-center justify-center">
                {/* SVG progress ring */}
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120">
                  {/* خلفية الدائرة */}
                  <circle
                    cx="60"
                    cy="60"
                    r={RADIUS}
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth={STROKE}
                    fill="none"
                  />
                  {/* الدائرة المتقدمة */}
                  <circle
                    cx="60"
                    cy="60"
                    r={RADIUS}
                    stroke="#ffffff"
                    strokeWidth={STROKE}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={CIRC}
                    strokeDashoffset={dashOffset}
                    style={{ transition: "stroke-dashoffset 200ms ease-out" }}
                  />
                </svg>
                {/* الرقم المركزي */}
                <span
                  className="text-white font-black text-4xl tabular-nums drop-shadow-lg"
                  data-testid="text-progress-percent"
                >
                  {percent}%
                </span>
              </div>
              {/* نص "تستغرق هذه الميزة بضع ثوانٍ تقريباً" */}
              <p className="mt-5 text-white/95 text-sm font-medium px-6 text-center drop-shadow-lg max-w-[260px]">
                تستغرق هذه الميزة بضع ثوانٍ تقريباً
              </p>
              <button
                onClick={onCancel}
                className="mt-5 px-7 py-1.5 rounded-full bg-black/40 backdrop-blur border border-white/30 text-white text-sm font-medium hover:bg-black/60 transition-colors pointer-events-auto"
                data-testid="button-cancel-progress"
              >
                إلغاء
              </button>
            </div>
          </>
        )}
      </div>

      {/* ──────────── درج النتائج (ينزل من الأسفل عند انتهاء التحليل) ──────────── */}
      {showResults && (
        <div
          className={`absolute bottom-0 right-0 left-0 bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl flex flex-col transition-transform duration-500 ease-out ${
            drawerOpen ? "translate-y-0" : "translate-y-full"
          }`}
          style={{ height: "68vh" }}
          data-testid="visual-results-drawer"
        >
          {/* مقبض السحب العلوي */}
          <div className="flex justify-center pt-2 pb-1 flex-shrink-0">
            <div className="w-12 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
          </div>

          {/* رأس الدرج: الكلمات المفتاحية + عداد */}
          <div className="px-4 pt-2 pb-3 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-orange-600 dark:text-orange-400 font-bold tracking-wide">
                  نتائج البحث بالصورة
                </p>
                {keywords && (
                  <p
                    className="text-base font-bold text-gray-900 dark:text-white truncate mt-0.5"
                    data-testid="text-visual-keywords"
                  >
                    {keywords}
                  </p>
                )}
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 font-bold flex-shrink-0">
                {results.length} منتج
              </span>
            </div>
          </div>

          {/* قائمة المنتجات (شبكة قابلة للتمرير) */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-3" data-testid="visual-results-scroll">
            {isLoadingResults ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="aspect-square bg-gray-200 dark:bg-gray-800 rounded-xl mb-2" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded mb-1" />
                    <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-800 rounded" />
                  </div>
                ))}
              </div>
            ) : results.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                  <ImageIcon className="h-10 w-10 text-gray-400" />
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">
                  لا توجد منتجات مطابقة
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  جرّب صورة أوضح أو ابحث بالاسم يدوياً
                </p>
                <button
                  onClick={onCancel}
                  className="px-5 py-2 rounded-full bg-[#1a3a4a] hover:bg-[#0f2b3a] text-white text-sm font-bold transition-colors"
                  data-testid="button-close-empty-results"
                >
                  إغلاق
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pb-6">
                {results.map((p) => {
                  const hasDiscount =
                    p.originalPrice != null &&
                    p.price != null &&
                    Number(p.originalPrice) > Number(p.price);
                  return (
                    <button
                      key={p.id}
                      onClick={() => onSelectProduct(p.id)}
                      className="group text-right bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-700 hover:shadow-md active:scale-[0.97] transition-all"
                      data-testid={`visual-result-card-${p.id}`}
                    >
                      <div className="relative aspect-square bg-gray-50 dark:bg-gray-900 overflow-hidden">
                        {p.image ? (
                          <img
                            src={p.image}
                            alt={p.name}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            data-testid={`visual-result-img-${p.id}`}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="h-8 w-8 text-gray-300" />
                          </div>
                        )}
                        {hasDiscount && p.discount != null && (
                          <span className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                            {p.discount}%-
                          </span>
                        )}
                      </div>
                      <div className="p-2">
                        <p
                          className="text-xs text-gray-800 dark:text-gray-100 line-clamp-2 leading-snug min-h-[2.2rem] mb-1"
                          data-testid={`visual-result-name-${p.id}`}
                        >
                          {p.name}
                        </p>
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <span
                            className="text-sm font-extrabold text-orange-600 dark:text-orange-400"
                            data-testid={`visual-result-price-${p.id}`}
                          >
                            {formatPrice(p.price)}
                          </span>
                          <span className="text-[10px] text-gray-500">ريال</span>
                          {hasDiscount && (
                            <span className="text-[10px] text-gray-400 line-through">
                              {formatPrice(p.originalPrice)}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CSS للماسح الضوئي المتحرك — يغطي كامل ارتفاع الحاوية */}
      <style>{`
        @keyframes visualScanMove {
          0%   { top: -80px; opacity: 0; }
          8%   { opacity: 1; }
          92%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .visual-scanner-line {
          position: absolute;
          left: 0;
          right: 0;
          height: 80px;
          background: linear-gradient(
            to bottom,
            rgba(34, 211, 238, 0) 0%,
            rgba(34, 211, 238, 0.15) 40%,
            rgba(34, 211, 238, 0.85) 70%,
            #67e8f9 100%
          );
          box-shadow: 0 0 18px 2px rgba(34, 211, 238, 0.7);
          border-bottom: 2px solid #67e8f9;
          animation: visualScanMove 1.8s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
          will-change: top, opacity;
        }
      `}</style>
    </div>
  );
}
