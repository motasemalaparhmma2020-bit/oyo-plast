import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

export function PromoBar() {
  const { data: settings } = useQuery<any>({
    queryKey: ["/api/display-settings"],
    staleTime: 60000,
  });
  const [open, setOpen] = useState(false);

  const enabled = settings?.promoBarEnabled === true;
  if (!enabled) return null;

  const text = settings?.promoBarText ?? "خصم 15%: بدون حد أدنى للشراء";
  const color = settings?.promoBarColor ?? "#ef4444";
  const details = settings?.promoBarDetails ?? "";

  return (
    <>
      <button
        className="w-full flex items-center justify-between px-4 py-2 text-white text-sm font-semibold"
        style={{ background: color }}
        onClick={() => setOpen(true)}
        data-testid="button-promo-bar-global"
      >
        <span>🏷️ {text}</span>
        <span className="text-white/80 text-xs">›</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full bg-white dark:bg-gray-900 rounded-t-2xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
            <h3 className="text-lg font-bold mb-3 text-center" style={{ color }}>
              🏷️ تفاصيل العروض الترويجية
            </h3>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
              {details || text}
            </p>
            <button
              className="mt-4 w-full py-3 rounded-xl font-bold text-white"
              style={{ background: color }}
              onClick={() => setOpen(false)}
              data-testid="button-promo-close-global"
            >
              حسناً، فهمت
            </button>
          </div>
        </div>
      )}
    </>
  );
}
