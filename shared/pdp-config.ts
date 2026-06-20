import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════════════
// إعدادات صفحة المنتج الجديدة (New PDP) — مصدر واحد يتحكم به الأدمن من لوحة واحدة
// تُخزَّن كـ JSON في جدول settings تحت المفتاح SETTINGS_KEY.
// ═══════════════════════════════════════════════════════════════════════════

export const PDP_CONFIG_SETTINGS_KEY = "pdp_layout_config";

// أقسام الصفحة (قابلة لإعادة الترتيب + الإظهار/الإخفاء). الأقسام المقفلة لا يُخفى ترتيبها الطرفي.
export const pdpSectionSchema = z.object({
  id: z.string(),
  label: z.string(),
  visible: z.boolean(),
  order: z.number(),
  locked: z.boolean().optional(),
});
export type PdpSection = z.infer<typeof pdpSectionSchema>;

// مفاتيح العناصر الدقيقة داخل الأقسام (تفعيل/تعطيل كل زر). كلها موصولة بعناصر فعلية في الصفحة.
export const pdpElementsSchema = z.object({
  wishlist: z.boolean(),        // زر المفضلة في الأعلى
  share: z.boolean(),           // زر القائمة/المشاركة في الأعلى
  bagColor: z.boolean(),        // اختيار لون الكيس
  printColor: z.boolean(),      // اختيار لون الطباعة
  logoUpload: z.boolean(),      // زر رفع الشعار
  quickPreview: z.boolean(),    // المعاينة الفورية للشعار
  studioPreview: z.boolean(),   // زر التحسين بالذكاء الاصطناعي
  quantityStepper: z.boolean(), // بطاقات اختيار الكمية
  trustBadges: z.boolean(),     // شارات الثقة (شحن/دفع/جودة)
});
export type PdpElements = z.infer<typeof pdpElementsSchema>;

export const pdpScopeSchema = z.object({
  mode: z.enum(["all", "printable", "specific"]),
  productIds: z.array(z.number()).default([]),
});
export type PdpScope = z.infer<typeof pdpScopeSchema>;

export const pdpConfigSchema = z.object({
  version: z.number().default(1),
  enabled: z.boolean().default(false),
  scope: pdpScopeSchema,
  sections: z.array(pdpSectionSchema),
  elements: pdpElementsSchema,
});
export type PdpConfig = z.infer<typeof pdpConfigSchema>;

// ── الإعداد الافتراضي (آمن: معطّل بالكامل حتى يفعّله الأدمن) ──────────────────
export const DEFAULT_PDP_CONFIG: PdpConfig = {
  version: 1,
  enabled: false,
  scope: { mode: "printable", productIds: [] },
  sections: [
    { id: "gallery", label: "معرض الصور + المعاينة", visible: true, order: 10, locked: true },
    { id: "summary", label: "الاسم والسعر والتقييم", visible: true, order: 20 },
    { id: "smartVariants", label: "ألوان الكيس ولون الطباعة", visible: true, order: 30 },
    { id: "volumeOffers", label: "عروض الكميات", visible: true, order: 40 },
    { id: "printingCalculator", label: "اختيار الكمية والسعر", visible: true, order: 50 },
    { id: "designStudio", label: "رفع الشعار + المعاينة الفورية", visible: true, order: 60 },
    { id: "description", label: "الوصف", visible: true, order: 70 },
    { id: "reviews", label: "التقييمات", visible: true, order: 80 },
    { id: "related", label: "منتجات مشابهة", visible: true, order: 90 },
    { id: "stickyCart", label: "شريط الشراء الثابت", visible: true, order: 999, locked: true },
  ],
  elements: {
    wishlist: true,
    share: true,
    bagColor: true,
    printColor: true,
    logoUpload: true,
    quickPreview: true,
    studioPreview: true,
    quantityStepper: true,
    trustBadges: true,
  },
};

// يدمج الإعداد المخزّن مع الافتراضي حتى لا تنكسر العناصر/الأقسام الجديدة المضافة لاحقاً.
export function mergePdpConfig(stored: Partial<PdpConfig> | null | undefined): PdpConfig {
  if (!stored) return DEFAULT_PDP_CONFIG;
  const knownIds = new Set(DEFAULT_PDP_CONFIG.sections.map((s) => s.id));
  const storedById = new Map((stored.sections ?? []).map((s) => [s.id, s]));
  // ابدأ من الأقسام المعروفة (مع تطبيق المخزّن إن وُجد)، ثم احتفظ بأي قسم مخزّن غير معروف.
  const known: PdpSection[] = DEFAULT_PDP_CONFIG.sections.map((def) => {
    const s = storedById.get(def.id);
    if (!s) return def;
    const merged = { ...def, ...s, id: def.id, label: def.label, locked: def.locked };
    if (def.locked) merged.visible = true; // الأقسام الأساسية (المعرض/شريط الشراء) تبقى ظاهرة دائماً
    return merged;
  });
  // احتفظ بأي أقسام مخزّنة غير معروفة (تجارب مستقبلية) حتى لا تُفقد عند القراءة/الحفظ.
  const unknown: PdpSection[] = (stored.sections ?? []).filter((s) => !knownIds.has(s.id));
  const sections: PdpSection[] = [...known, ...unknown];
  return {
    version: stored.version ?? DEFAULT_PDP_CONFIG.version,
    enabled: stored.enabled ?? DEFAULT_PDP_CONFIG.enabled,
    scope: {
      mode: stored.scope?.mode ?? DEFAULT_PDP_CONFIG.scope.mode,
      productIds: stored.scope?.productIds ?? [],
    },
    sections,
    elements: { ...DEFAULT_PDP_CONFIG.elements, ...(stored.elements ?? {}) },
  };
}

// ── منطق "هل المنتج قابل للطباعة؟" ──────────────────────────────────────────
export interface ProductPrintFlags {
  productType?: string | null;
  allowDesignUpload?: boolean | null;
  hasPrintingOptions?: boolean | null;
  showLivePreview?: boolean | null;
  enableStudioPreview?: boolean | null;
  printingCategoryId?: number | null;
}

export function isPrintableProduct(p: ProductPrintFlags): boolean {
  return Boolean(
    p.productType === "customizable" ||
      p.allowDesignUpload ||
      p.hasPrintingOptions ||
      p.showLivePreview ||
      p.enableStudioPreview ||
      (p.printingCategoryId != null),
  );
}

// ── القرار: هل تُعرض الصفحة الجديدة لهذا المنتج؟ ─────────────────────────────
export function decideUseNewPdp(
  product: ProductPrintFlags & { id: number },
  config: PdpConfig,
): boolean {
  if (!config.enabled) return false;
  switch (config.scope.mode) {
    case "all":
      return true;
    case "printable":
      return isPrintableProduct(product);
    case "specific":
      return config.scope.productIds.includes(product.id);
    default:
      return false;
  }
}

// ترتيب الأقسام المرئية حسب order.
export function visibleSectionsSorted(config: PdpConfig): PdpSection[] {
  return [...config.sections].filter((s) => s.visible).sort((a, b) => a.order - b.order);
}
