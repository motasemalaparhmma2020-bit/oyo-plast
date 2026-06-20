import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════════════
// إعدادات «العقل المدبّر» (Mastermind) — راشد المدير التنفيذي + الهيكل الإداري
// تُخزَّن كـ JSON في جدول settings تحت المفتاح MASTERMIND_CONFIG_SETTINGS_KEY.
// تتضمّن: الاستراتيجية + القواعد + الخطوط الحمراء (مُفعّلة فعلياً على الخادم)
//         + خريطة الأقسام (وكلاء AI + موظفون بشر) + ضوابط التنسيق.
// ═══════════════════════════════════════════════════════════════════════════

export const MASTERMIND_CONFIG_SETTINGS_KEY = "mastermind_config";

// ── قسم إداري: يجمع وكلاء AI + أدوار موظفين بشر ───────────────────────────────
export const departmentSchema = z.object({
  id: z.string(),
  label: z.string(),
  icon: z.string().optional(),
  agentNames: z.array(z.string()).default([]), // أسماء وكلاء AI (ai_agents.name)
  staffRoles: z.array(z.string()).default([]), // أدوار موظفين بشر (users.role / team_members.role)
});
export type Department = z.infer<typeof departmentSchema>;

// ── الخطوط الحمراء (ضوابط صارمة تُطبَّق على الخادم قبل تنفيذ أي أداة) ──────────
export const redLinesSchema = z.object({
  // أقصى نسبة خصم مسموح بها على المنتج (٪)
  maxDiscountPercent: z.number().min(0).max(100).default(70),
  // أقصى نسبة تخفيض للسعر في إجراء واحد مقارنةً بالسعر الحالي (٪) — يمنع الانهيارات
  maxPriceDecreasePercent: z.number().min(0).max(100).default(60),
  // حد أدنى مطلق للسعر بالريال اليمني (0 = معطّل)
  minPriceYer: z.number().min(0).default(0),
  // هل يُسمح بإخفاء/إيقاف منتج عبر الوكلاء؟
  allowProductDeactivation: z.boolean().default(true),
  // منتجات محميّة: يُمنع أي تعديل سعر/تفعيل/ترويج عليها عبر الوكلاء
  protectedProductIds: z.array(z.number()).default([]),
  // أقصى عدد إشعارات جماعية/حملات في اليوم
  maxBroadcastsPerDay: z.number().min(0).default(3),
  // كلمات ممنوعة في نصوص الإشعارات/الحملات
  blockedWords: z.array(z.string()).default([]),
  // خطوط حمراء نصّية إضافية (تُحقن في تعليمات راشد — إرشادية وليست صارمة)
  freeText: z.array(z.string()).default([]),
});
export type RedLines = z.infer<typeof redLinesSchema>;

export const orchestrationSchema = z.object({
  maxProposalsPerRun: z.number().min(1).max(10).default(5),
  cooldownMinutes: z.number().min(0).default(10),
  dailyRunCap: z.number().min(1).default(20),
});
export type Orchestration = z.infer<typeof orchestrationSchema>;

export const mastermindConfigSchema = z.object({
  version: z.number().default(1),
  // هل العقل المدبّر مفعّل (يستطيع توليد اقتراحات)؟
  enabled: z.boolean().default(true),
  // الاستراتيجية العامة للمتجر (نص حر يكتبه المالك ويطبّقه راشد)
  strategy: z.string().default(""),
  // قواعد عامة يلتزم بها الفريق (نص حر)
  rules: z.array(z.string()).default([]),
  redLines: redLinesSchema.default({}),
  departments: z.array(departmentSchema),
  orchestration: orchestrationSchema.default({}),
});
export type MastermindConfig = z.infer<typeof mastermindConfigSchema>;

// ── الهيكل الإداري الافتراضي ────────────────────────────────────────────────
export const DEFAULT_DEPARTMENTS: Department[] = [
  {
    id: "orders",
    label: "الطلبات",
    icon: "🛒",
    agentNames: ["oyo", "layla"],
    staffRoles: ["order_manager", "delivery"],
  },
  {
    id: "operations",
    label: "العمليات",
    icon: "⚙️",
    agentNames: ["majed"],
    staffRoles: ["product_manager"],
  },
  {
    id: "finance",
    label: "المالية",
    icon: "💰",
    agentNames: ["huda", "safar"],
    staffRoles: ["finance"],
  },
  {
    id: "marketing",
    label: "التسويق",
    icon: "📣",
    agentNames: ["nour", "omar", "rami"],
    staffRoles: [],
  },
];

export const DEFAULT_MASTERMIND_CONFIG: MastermindConfig = {
  version: 1,
  enabled: true,
  strategy: "",
  rules: [],
  redLines: {
    maxDiscountPercent: 70,
    maxPriceDecreasePercent: 60,
    minPriceYer: 0,
    allowProductDeactivation: true,
    protectedProductIds: [],
    maxBroadcastsPerDay: 3,
    blockedWords: [],
    freeText: [],
  },
  departments: DEFAULT_DEPARTMENTS,
  orchestration: { maxProposalsPerRun: 5, cooldownMinutes: 10, dailyRunCap: 20 },
};

// اسم الوكيل القائد (العقل المدبّر)
export const MASTERMIND_AGENT_NAME = "rashed";

// يدمج المخزّن مع الافتراضي حتى لا تنكسر الحقول الجديدة المضافة لاحقاً.
export function mergeMastermindConfig(
  stored: Partial<MastermindConfig> | null | undefined,
): MastermindConfig {
  if (!stored) return DEFAULT_MASTERMIND_CONFIG;
  // دمج الأقسام: ابدأ من الافتراضي (مع تطبيق المخزّن إن وُجد) ثم احتفظ بأي قسم مخصّص.
  const knownIds = new Set(DEFAULT_DEPARTMENTS.map((d) => d.id));
  const storedById = new Map((stored.departments ?? []).map((d) => [d.id, d]));
  const known: Department[] = DEFAULT_DEPARTMENTS.map((def) => {
    const s = storedById.get(def.id);
    if (!s) return def;
    return {
      ...def,
      ...s,
      id: def.id,
      agentNames: s.agentNames ?? def.agentNames,
      staffRoles: s.staffRoles ?? def.staffRoles,
    };
  });
  const custom: Department[] = (stored.departments ?? []).filter((d) => !knownIds.has(d.id));
  return {
    version: stored.version ?? DEFAULT_MASTERMIND_CONFIG.version,
    enabled: stored.enabled ?? DEFAULT_MASTERMIND_CONFIG.enabled,
    strategy: stored.strategy ?? "",
    rules: stored.rules ?? [],
    redLines: { ...DEFAULT_MASTERMIND_CONFIG.redLines, ...(stored.redLines ?? {}) },
    departments: [...known, ...custom],
    orchestration: { ...DEFAULT_MASTERMIND_CONFIG.orchestration, ...(stored.orchestration ?? {}) },
  };
}

// نص موجز يلخّص الاستراتيجية + القواعد + الخطوط الحمراء — يُحقن في تعليمات راشد.
export function buildPolicyPrompt(cfg: MastermindConfig): string {
  const lines: string[] = [];
  if (cfg.strategy.trim()) {
    lines.push(`## استراتيجية المتجر (طبّقها في اقتراحاتك):\n${cfg.strategy.trim()}`);
  }
  if (cfg.rules.length) {
    lines.push(`## القواعد العامة:\n${cfg.rules.map((r) => `- ${r}`).join("\n")}`);
  }
  const rl = cfg.redLines;
  const hard: string[] = [
    `- أقصى خصم: ${rl.maxDiscountPercent}٪`,
    `- لا تخفّض سعر منتج أكثر من ${rl.maxPriceDecreasePercent}٪ دفعة واحدة`,
    rl.minPriceYer > 0 ? `- لا تنزل بأي سعر تحت ${rl.minPriceYer} ر.ي` : "",
    rl.allowProductDeactivation ? "" : "- يُمنع إخفاء/إيقاف أي منتج",
    rl.protectedProductIds.length ? `- منتجات محميّة لا تمسّها: ${rl.protectedProductIds.join("، ")}` : "",
    `- أقصى ${rl.maxBroadcastsPerDay} إشعار جماعي/حملة في اليوم`,
    rl.blockedWords.length ? `- كلمات ممنوعة في الرسائل: ${rl.blockedWords.join("، ")}` : "",
  ].filter(Boolean);
  if (hard.length) lines.push(`## الخطوط الحمراء (إلزامية — مرفوضة آلياً إن تجاوزتها):\n${hard.join("\n")}`);
  if (rl.freeText.length) {
    lines.push(`## خطوط حمراء إضافية:\n${rl.freeText.map((r) => `- ${r}`).join("\n")}`);
  }
  return lines.join("\n\n");
}
