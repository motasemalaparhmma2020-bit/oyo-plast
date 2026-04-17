import { useState } from "react";
import { ChevronDown, ChevronUp, Printer, Paperclip, StickyNote, ExternalLink } from "lucide-react";
import type { ItemDisplayConfig } from "@/hooks/use-display-settings";

/* ── خريطة الألوان ── */
const colorMap: Record<string, string> = {
  أبيض: "#FFFFFF", أسود: "#000000", أحمر: "#EF4444",
  أزرق: "#3B82F6", أخضر: "#22C55E", أخضرك: "#16A34A",
  أصفر: "#EAB308", برتقالي: "#F97316", وردي: "#EC4899",
  بنفسجي: "#8B5CF6", رمادي: "#6B7280", بني: "#92400E",
  ذهبي: "#D97706", فضي: "#9CA3AF", شفاف: "transparent",
  سماوي: "#06B6D4", زهري: "#F472B6", كحلي: "#1E3A8A",
  بيج: "#D4A574",
};

function getColorHex(name?: string | null): string {
  if (!name) return "#E5E7EB";
  return colorMap[name.trim()] ?? "#E5E7EB";
}

export function ColorDot({ color, size = "sm" }: { color: string; size?: "sm" | "xs" }) {
  const dim = size === "xs" ? "w-3 h-3" : "w-3.5 h-3.5";
  return (
    <span
      className={`${dim} rounded-full border border-gray-300 inline-block shrink-0`}
      style={{ backgroundColor: getColorHex(color) }}
    />
  );
}

export interface OrderItemMeta {
  selectedSize?: string | null;
  selectedColor?: string | null;
  selectedBagColor?: string | null;
  printColor1?: string | null;
  printColor2?: string | null;
  printColor3?: string | null;
  printColorCount?: number | null;
  customPrinting?: boolean | null;
  designNotes?: string | null;
  designFileUrl?: string | null;
}

const ALL_ON: ItemDisplayConfig = {
  showColor: true, showSize: true, showBagColor: true,
  showPrintColors: true, showDesignFile: true, showDesignNotes: true,
  mode: "compact",
};

function hasMeta(item: OrderItemMeta, cfg: ItemDisplayConfig = ALL_ON): boolean {
  return !!(
    (cfg.showColor && item.selectedColor) ||
    (cfg.showSize && item.selectedSize) ||
    (cfg.showBagColor && item.selectedBagColor) ||
    (cfg.showPrintColors && item.printColor1) ||
    (cfg.showDesignNotes && item.designNotes) ||
    (cfg.showDesignFile && item.designFileUrl)
  );
}

/* ── شارة صغيرة ── */
function Chip({ children, color = "default" }: { children: React.ReactNode; color?: "default" | "cyan" | "violet" | "amber" }) {
  const styles = {
    default: "bg-gray-100 text-gray-700 border-gray-200",
    cyan: "bg-cyan-50 text-cyan-700 border-cyan-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium border rounded-full px-1.5 py-0.5 ${styles[color]}`}>
      {children}
    </span>
  );
}

/* ── Compact inline chips — للفاتورة والسلة المضغوطة ── */
export function OrderItemInlineMeta({ item, cfg = ALL_ON }: { item: OrderItemMeta; cfg?: ItemDisplayConfig }) {
  if (!hasMeta(item, cfg)) return null;
  const printColors = [item.printColor1, item.printColor2, item.printColor3].filter(Boolean) as string[];

  return (
    <div className="flex flex-wrap gap-1 mt-0.5">
      {cfg.showColor && item.selectedColor && (
        <span className="inline-flex items-center gap-0.5 text-[9px] border rounded px-1 py-0.5 bg-gray-50 text-gray-600">
          <ColorDot color={item.selectedColor} size="xs" />
          {item.selectedColor}
        </span>
      )}
      {cfg.showSize && item.selectedSize && (
        <span className="inline-flex items-center gap-0.5 text-[9px] border rounded px-1 py-0.5 bg-gray-50 text-gray-600">
          📐 {item.selectedSize}
        </span>
      )}
      {cfg.showBagColor && item.selectedBagColor && (
        <span className="inline-flex items-center gap-0.5 text-[9px] border rounded px-1 py-0.5 bg-cyan-50 text-cyan-700">
          <ColorDot color={item.selectedBagColor} size="xs" />
          كيس: {item.selectedBagColor}
        </span>
      )}
      {cfg.showPrintColors && printColors.length > 0 && (
        <span className="inline-flex items-center gap-0.5 text-[9px] border rounded px-1 py-0.5 bg-violet-50 text-violet-700">
          🖨️ {printColors.map((c, i) => (
            <span key={i} className="inline-flex items-center gap-0.5">
              <ColorDot color={c} size="xs" />
              {c}{i < printColors.length - 1 && <span className="text-violet-300">+</span>}
            </span>
          ))}
        </span>
      )}
      {cfg.showDesignNotes && item.designNotes && (
        <span className="inline-flex items-center gap-0.5 text-[9px] border rounded px-1 py-0.5 bg-amber-50 text-amber-700">
          📝 {item.designNotes}
        </span>
      )}
      {cfg.showDesignFile && item.designFileUrl && (
        <span className="inline-flex items-center gap-0.5 text-[9px] border rounded px-1 py-0.5 bg-blue-50 text-blue-600">
          📎 تصميم مرفق
        </span>
      )}
    </div>
  );
}

/* ── Compact SHEIN-style — للسلة وصفحة الدفع ── */
export function OrderItemCompactMeta({ item, cfg = ALL_ON }: { item: OrderItemMeta; cfg?: ItemDisplayConfig }) {
  if (!hasMeta(item, cfg)) return null;
  const printColors = [item.printColor1, item.printColor2, item.printColor3].filter(Boolean) as string[];
  const hasBaseInfo = (cfg.showColor && item.selectedColor) || (cfg.showSize && item.selectedSize);
  const hasPrinting = item.customPrinting && (
    (cfg.showBagColor && item.selectedBagColor) ||
    (cfg.showPrintColors && printColors.length > 0)
  );
  const hasDesignInfo = (cfg.showDesignFile && item.designFileUrl) || (cfg.showDesignNotes && item.designNotes);

  return (
    <div className="flex flex-col gap-1.5 mt-1.5" data-testid="item-meta-compact">
      {/* سطر اللون / المقاس — أوضح وأبرز */}
      {hasBaseInfo && (
        <div className="flex items-center gap-2 flex-wrap">
          {cfg.showColor && item.selectedColor && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 rounded-md px-2 py-0.5 border border-gray-200 dark:border-gray-700">
              <ColorDot color={item.selectedColor} />
              <span>اللون: {item.selectedColor}</span>
            </span>
          )}
          {cfg.showSize && item.selectedSize && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 rounded-md px-2 py-0.5 border border-gray-200 dark:border-gray-700">
              <span>📐 المقاس: {item.selectedSize}</span>
            </span>
          )}
        </div>
      )}

      {/* طباعة: لون الكيس + ألوان الطباعة */}
      {hasPrinting && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {cfg.showBagColor && item.selectedBagColor && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-800 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/40 rounded-md px-2 py-0.5 border border-cyan-300 dark:border-cyan-800">
              <ColorDot color={item.selectedBagColor} />
              لون الكيس: {item.selectedBagColor}
            </span>
          )}
          {cfg.showPrintColors && printColors.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-violet-800 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/40 rounded-md px-2 py-0.5 border border-violet-300 dark:border-violet-800">
              <Printer className="w-3 h-3" />
              <span>طباعة:</span>
              {printColors.map((c, i) => (
                <span key={i} className="inline-flex items-center gap-0.5">
                  <ColorDot color={c} />
                  {c}{i < printColors.length - 1 && <span className="text-violet-400 mx-0.5">+</span>}
                </span>
              ))}
            </span>
          )}
        </div>
      )}

      {/* ملف + ملاحظات */}
      {hasDesignInfo && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {cfg.showDesignFile && item.designFileUrl && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 rounded-md px-2 py-0.5 border border-blue-300 dark:border-blue-800">
              <Paperclip className="w-3 h-3" />
              ملف تصميم مرفق
            </span>
          )}
          {cfg.showDesignNotes && item.designNotes && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 rounded-md px-2 py-0.5 border border-amber-300 dark:border-amber-800 max-w-full">
              <StickyNote className="w-3 h-3 shrink-0" />
              <span className="truncate">ملاحظة: {item.designNotes}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Collapsible — للطلبات / تأكيد الطلب / الأدمن ── */
export function OrderItemCollapsibleMeta({
  item, cfg = ALL_ON, defaultOpen = false,
}: {
  item: OrderItemMeta; cfg?: ItemDisplayConfig; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!hasMeta(item, cfg)) return null;

  const printColors = [item.printColor1, item.printColor2, item.printColor3].filter(Boolean) as string[];
  const hasPrinting = item.customPrinting && (
    (cfg.showBagColor && item.selectedBagColor) ||
    (cfg.showPrintColors && printColors.length > 0)
  );

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
        type="button"
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        <span>التفاصيل</span>
        {!open && (
          <span className="flex items-center gap-0.5 mr-1">
            {cfg.showColor && item.selectedColor && <ColorDot color={item.selectedColor} />}
            {cfg.showSize && item.selectedSize && (
              <span className="text-[10px] bg-gray-100 rounded px-1">{item.selectedSize}</span>
            )}
            {item.customPrinting && <Printer className="h-3 w-3 text-violet-500" />}
            {cfg.showDesignFile && item.designFileUrl && <Paperclip className="h-3 w-3 text-blue-500" />}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-1.5 space-y-1.5 bg-gray-50 dark:bg-gray-800/40 rounded-lg p-2 border border-border/50">
          {/* اللون والمقاس */}
          {((cfg.showColor && item.selectedColor) || (cfg.showSize && item.selectedSize)) && (
            <div className="flex flex-wrap gap-1">
              {cfg.showColor && item.selectedColor && (
                <Chip><ColorDot color={item.selectedColor} />{item.selectedColor}</Chip>
              )}
              {cfg.showSize && item.selectedSize && (
                <Chip>📐 {item.selectedSize}</Chip>
              )}
            </div>
          )}

          {/* طباعة مخصصة */}
          {hasPrinting && (
            <div className="space-y-1">
              {cfg.showBagColor && item.selectedBagColor && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground w-16 shrink-0">لون الكيس:</span>
                  <Chip color="cyan">
                    <ColorDot color={item.selectedBagColor} />{item.selectedBagColor}
                  </Chip>
                </div>
              )}
              {cfg.showPrintColors && printColors.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] text-muted-foreground w-16 shrink-0">ألوان طباعة:</span>
                  {printColors.map((c, i) => (
                    <Chip key={i} color="violet">
                      <ColorDot color={c} />{c}
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* الملاحظات */}
          {cfg.showDesignNotes && item.designNotes && (
            <div className="flex items-start gap-1">
              <StickyNote className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
              <span className="text-[10px] text-amber-700 dark:text-amber-400">{item.designNotes}</span>
            </div>
          )}

          {/* ملف التصميم */}
          {cfg.showDesignFile && item.designFileUrl && (
            <a
              href={item.designFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              فتح ملف التصميم
            </a>
          )}
        </div>
      )}
    </div>
  );
}
