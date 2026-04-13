import { useState } from "react";
import { ChevronDown, ChevronUp, Printer, Paperclip, StickyNote, ExternalLink } from "lucide-react";

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

function ColorDot({ color, size = "sm" }: { color: string; size?: "sm" | "xs" }) {
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

function hasMeta(item: OrderItemMeta): boolean {
  return !!(
    item.selectedSize || item.selectedColor || item.selectedBagColor ||
    item.printColor1 || item.customPrinting || item.designNotes || item.designFileUrl
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

/* ── عرض بسيط مضغوط (للفاتورة المطبوعة) ── */
export function OrderItemInlineMeta({ item }: { item: OrderItemMeta }) {
  if (!hasMeta(item)) return null;
  const printColors = [item.printColor1, item.printColor2, item.printColor3].filter(Boolean) as string[];

  return (
    <div className="flex flex-wrap gap-1 mt-0.5">
      {item.selectedColor && (
        <span className="inline-flex items-center gap-0.5 text-[9px] border rounded px-1 py-0.5 bg-gray-50 text-gray-600">
          <ColorDot color={item.selectedColor} size="xs" />
          {item.selectedColor}
        </span>
      )}
      {item.selectedSize && (
        <span className="inline-flex items-center gap-0.5 text-[9px] border rounded px-1 py-0.5 bg-gray-50 text-gray-600">
          📐 {item.selectedSize}
        </span>
      )}
      {item.selectedBagColor && (
        <span className="inline-flex items-center gap-0.5 text-[9px] border rounded px-1 py-0.5 bg-cyan-50 text-cyan-700">
          <ColorDot color={item.selectedBagColor} size="xs" />
          كيس: {item.selectedBagColor}
        </span>
      )}
      {printColors.length > 0 && (
        <span className="inline-flex items-center gap-0.5 text-[9px] border rounded px-1 py-0.5 bg-violet-50 text-violet-700">
          🖨️ {printColors.map((c, i) => (
            <span key={i} className="inline-flex items-center gap-0.5">
              <ColorDot color={c} size="xs" />
              {c}{i < printColors.length - 1 && "+"}
            </span>
          ))}
        </span>
      )}
      {item.designNotes && (
        <span className="inline-flex items-center gap-0.5 text-[9px] border rounded px-1 py-0.5 bg-amber-50 text-amber-700">
          📝 {item.designNotes}
        </span>
      )}
      {item.designFileUrl && (
        <span className="inline-flex items-center gap-0.5 text-[9px] border rounded px-1 py-0.5 bg-blue-50 text-blue-600">
          📎 تصميم مرفق
        </span>
      )}
    </div>
  );
}

/* ── عرض قابل للطي (للعميل والأدمن والموصل) ── */
export function OrderItemCollapsibleMeta({ item, defaultOpen = false }: { item: OrderItemMeta; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!hasMeta(item)) return null;

  const printColors = [item.printColor1, item.printColor2, item.printColor3].filter(Boolean) as string[];
  const hasPrinting = item.customPrinting && (item.selectedBagColor || printColors.length > 0);

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
        type="button"
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        <span>التفاصيل</span>
        {/* ملخص سريع حين مطوية */}
        {!open && (
          <span className="flex items-center gap-0.5 mr-1">
            {item.selectedColor && <ColorDot color={item.selectedColor} />}
            {item.selectedSize && <span className="text-[10px] bg-gray-100 rounded px-1">{item.selectedSize}</span>}
            {item.customPrinting && <Printer className="h-3 w-3 text-violet-500" />}
            {item.designFileUrl && <Paperclip className="h-3 w-3 text-blue-500" />}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-1.5 space-y-1.5 bg-gray-50 dark:bg-gray-800/40 rounded-lg p-2 border border-border/50">
          {/* اللون والمقاس */}
          {(item.selectedColor || item.selectedSize) && (
            <div className="flex flex-wrap gap-1">
              {item.selectedColor && (
                <Chip>
                  <ColorDot color={item.selectedColor} />
                  {item.selectedColor}
                </Chip>
              )}
              {item.selectedSize && (
                <Chip>
                  📐 {item.selectedSize}
                </Chip>
              )}
            </div>
          )}

          {/* طباعة مخصصة */}
          {hasPrinting && (
            <div className="space-y-1">
              {item.selectedBagColor && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground w-16 shrink-0">لون الكيس:</span>
                  <Chip color="cyan">
                    <ColorDot color={item.selectedBagColor} />
                    {item.selectedBagColor}
                  </Chip>
                </div>
              )}
              {printColors.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] text-muted-foreground w-16 shrink-0">ألوان طباعة:</span>
                  {printColors.map((c, i) => (
                    <Chip key={i} color="violet">
                      <ColorDot color={c} />
                      {c}
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* الملاحظات */}
          {item.designNotes && (
            <div className="flex items-start gap-1">
              <StickyNote className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
              <span className="text-[10px] text-amber-700 dark:text-amber-400">{item.designNotes}</span>
            </div>
          )}

          {/* ملف التصميم */}
          {item.designFileUrl && (
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
