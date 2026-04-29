import { useEffect, useState } from "react";
import { X } from "lucide-react";

// ──────────────────────────────────────────────────────────────────
// شاشة تحميل البحث بالكاميرا — بنمط SHEIN
// تعرض الصورة المختارة كاملة + شريط نسبة + نص + زر إلغاء
// ──────────────────────────────────────────────────────────────────

interface VisualSearchOverlayProps {
  imageUrl: string | null;     // URL مؤقت للصورة (Object URL)
  isLoading: boolean;          // هل التحليل جارٍ؟
  onCancel: () => void;        // عند الضغط على إلغاء
}

export function VisualSearchOverlay({ imageUrl, isLoading, onCancel }: VisualSearchOverlayProps) {
  const [progress, setProgress] = useState(0);

  // محاكاة تقدّم سلس: 0→90% خلال ~9 ثوان، ثم 100% فور انتهاء التحليل
  useEffect(() => {
    if (!isLoading) {
      setProgress(100);
      return;
    }
    setProgress(0);
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      // منحنى تباطؤ تدريجي: يصل لـ 90% بسرعة ثم يبطئ
      const t = elapsed / 9000;          // ثوان مرجعية
      const value = Math.min(90, 90 * (1 - Math.exp(-t * 1.8)));
      setProgress(value);
    }, 100);
    return () => clearInterval(interval);
  }, [isLoading]);

  if (!imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black flex flex-col"
      data-testid="visual-search-overlay"
      dir="rtl"
    >
      {/* زر الإغلاق العلوي */}
      <button
        onClick={onCancel}
        aria-label="إلغاء البحث"
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur text-white flex items-center justify-center transition-colors"
        data-testid="button-cancel-visual-search"
      >
        <X className="h-5 w-5" />
      </button>

      {/* الصورة في الخلفية ـ تملأ الشاشة */}
      <div className="absolute inset-0 flex items-center justify-center">
        <img
          src={imageUrl}
          alt="جاري تحليل الصورة"
          className="max-w-full max-h-full object-contain"
          data-testid="img-visual-search-preview"
        />
        {/* تعتيم خفيف لإبراز نص النسبة */}
        <div className="absolute inset-0 bg-black/30" />
      </div>

      {/* النسبة المئوية في الوسط */}
      <div className="relative flex-1 flex flex-col items-center justify-center text-white px-6">
        <div
          className="text-7xl font-bold mb-4 drop-shadow-lg"
          data-testid="text-visual-search-progress"
        >
          {Math.round(progress)}%
        </div>
        <p className="text-lg text-center max-w-sm drop-shadow-md mb-6">
          تستغرق هذه الميزة بضع ثوانٍ تقريباً
        </p>
        <button
          onClick={onCancel}
          className="px-8 py-2 bg-white/95 hover:bg-white text-black rounded-full font-medium text-sm shadow-lg transition-all"
          data-testid="button-cancel-visual-search-bottom"
        >
          إلغاء
        </button>
      </div>

      {/* شريط تقدّم سفلي */}
      <div className="absolute bottom-0 right-0 left-0 h-1 bg-white/20">
        <div
          className="h-full bg-gradient-to-r from-orange-400 to-pink-500 transition-all duration-200 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
