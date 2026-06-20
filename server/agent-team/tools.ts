/**
 * أدوات الوكلاء التنفيذية (Function-Calling مع موافقة بشرية)
 *
 * الفلسفة: الوكيل لا ينفّذ شيئاً مباشرة. هو فقط *يقترح* أداة عبر كتلة JSON،
 * فنُسجّلها كإجراء معلّق (ai_agent_actions.status='pending')، ثم ينفّذها
 * النظام فعلياً *فقط* بعد موافقة الأدمن في لوحة /admin/ai-agents.
 */
import { pool } from "../db";
import { createNotification, broadcastPromo } from "../lib/notifications";
import {
  mergeMastermindConfig,
  MASTERMIND_CONFIG_SETTINGS_KEY,
  type MastermindConfig,
} from "@shared/mastermind-config";

export interface ToolExecResult {
  ok: boolean;
  message: string;
  data?: any;
}

export interface AgentTool {
  name: string;
  label: string; // اسم عربي مختصر
  description: string; // ماذا تفعل + متى تُستخدم
  argsHint: string; // شكل المعطيات المتوقعة
  /** أسماء الوكلاء المسموح لهم باقتراح هذه الأداة. "*" = الجميع */
  allow: string[];
  execute: (args: any) => Promise<ToolExecResult>;
}

// ─── سجل الأدوات ───────────────────────────────────────────────────────────
export const AGENT_TOOLS: AgentTool[] = [
  {
    name: "notify_customer",
    label: "إرسال إشعار لعميل",
    description: "إرسال إشعار داخل التطبيق لعميل محدّد (تذكير، عرض، متابعة طلب). يصل فوراً لجرس الإشعارات لدى العميل.",
    argsHint: '{ "userId": "<معرّف العميل>", "title": "عنوان قصير", "message": "نص الرسالة" }',
    allow: ["layla", "oyo", "huda", "rami", "rashed"],
    async execute(args) {
      const userId = String(args?.userId || "").trim();
      const title = String(args?.title || "").trim();
      const message = String(args?.message || "").trim();
      if (!userId || !title || !message) return { ok: false, message: "ينقص userId أو title أو message" };
      const id = await createNotification({ userId, type: "system", title, message, priority: "normal", bypass: true });
      return id
        ? { ok: true, message: `تم إرسال الإشعار للعميل ${userId}`, data: { notificationId: id } }
        : { ok: false, message: "تعذّر إنشاء الإشعار (قد يكون العميل غير موجود)" };
    },
  },
  {
    name: "broadcast_notification",
    label: "إشعار جماعي",
    description: "إرسال إشعار لجميع العملاء النشطين (إعلان، عرض، تنبيه). استخدمه بحذر — يصل لكل العملاء.",
    argsHint: '{ "title": "عنوان قصير", "message": "نص الإعلان" }',
    allow: ["nour", "rashed"],
    async execute(args) {
      const title = String(args?.title || "").trim();
      const message = String(args?.message || "").trim();
      if (!title || !message) return { ok: false, message: "ينقص title أو message" };
      const r = await pool.query(`SELECT id FROM users ORDER BY created_at DESC LIMIT 1000`);
      let sent = 0;
      for (const row of r.rows) {
        const nid = await createNotification({ userId: String(row.id), type: "promo", title, message, priority: "normal", bypass: true });
        if (nid) sent++;
      }
      return { ok: true, message: `تم إرسال الإشعار الجماعي إلى ${sent} عميل`, data: { sent } };
    },
  },
  {
    name: "promote_product",
    label: "حملة ترويجية لمنتج",
    description:
      "إنشاء إشعار ترويجي لمنتج حقيقي وإرساله فقط للعملاء الذين فعّلوا إشعارات العروض (opt-in). يقرأ اسم المنتج وسعره وخصمه من قاعدة البيانات — لا تخترع بيانات.",
    argsHint: '{ "productId": 52, "headline": "عنوان جذّاب اختياري" }',
    allow: ["nour", "omar", "rashed"],
    async execute(args) {
      const productId = Number(args?.productId);
      if (!productId) return { ok: false, message: "productId غير صالح" };
      const r = await pool.query(
        `SELECT id, name, price, original_price, discount_percent, is_active
         FROM products WHERE id=$1`,
        [productId],
      );
      const p = r.rows[0];
      if (!p) return { ok: false, message: `المنتج #${productId} غير موجود` };
      if (p.is_active === false)
        return { ok: false, message: `المنتج «${p.name}» غير مُفعّل — فعّله أولاً قبل الترويج له` };

      const headline = String(args?.headline || "").trim();
      const price = Number(p.price) || 0;
      const discount = Number(p.discount_percent) || 0;
      const title = headline || `🎉 عرض على ${p.name}`;
      const priceText = price > 0 ? ` — ${price.toLocaleString()} ر.ي` : "";
      const discountText = discount > 0 ? ` · خصم ${discount}%` : "";
      const message = `${p.name}${priceText}${discountText}. اطلبه الآن قبل نفاد الكمية!`;

      const { recipients } = await broadcastPromo({
        title,
        message,
        actionUrl: `/product/${p.id}`,
        mode: "opt_in",
      });
      return {
        ok: true,
        message:
          recipients > 0
            ? `تم إرسال عرض «${p.name}» إلى ${recipients} عميل (مفعّلي إشعارات العروض فقط)`
            : `تمّت العملية لكن لا يوجد عملاء فعّلوا إشعارات العروض حالياً — لم يصل لأحد`,
        data: { productId: p.id, recipients },
      };
    },
  },
  {
    name: "adjust_product_price",
    label: "تعديل سعر منتج",
    description: "تغيير السعر المعروض لمنتج (بالريال اليمني). استخدمه للعروض أو تصحيح التسعير.",
    argsHint: '{ "productId": 52, "price": 5500 }',
    allow: ["safar", "rashed"],
    async execute(args) {
      const productId = Number(args?.productId);
      const price = Number(args?.price);
      if (!productId || !(price > 0)) return { ok: false, message: "productId غير صالح أو price ليس رقماً موجباً" };
      const r = await pool.query(`UPDATE products SET price=$1 WHERE id=$2 RETURNING id, name, price`, [price, productId]);
      if (!r.rows[0]) return { ok: false, message: `المنتج #${productId} غير موجود` };
      return { ok: true, message: `تم تحديث سعر «${r.rows[0].name}» إلى ${price} ر.ي`, data: r.rows[0] };
    },
  },
  {
    name: "set_promo_tag",
    label: "تعيين تصنيف ترويجي",
    description: "تعيين التصنيف الترويجي لمنتج (مثل offers / new / exclusive / clearance) لإظهاره في أقسام الصفحة الرئيسية.",
    argsHint: '{ "productId": 52, "tag": "offers" }',
    allow: ["safar", "nour", "rashed"],
    async execute(args) {
      const productId = Number(args?.productId);
      const tag = String(args?.tag || "").trim();
      const valid = ["bestsellers", "new", "offers", "exclusive", "discounts", "deals", "clearance", "featured"];
      if (!productId || !valid.includes(tag)) return { ok: false, message: `productId غير صالح أو tag خارج: ${valid.join("، ")}` };
      const r = await pool.query(
        `UPDATE products
           SET promotional_tags = ARRAY(SELECT DISTINCT unnest(COALESCE(promotional_tags, '{}'::text[]) || ARRAY[$1::text]))
         WHERE id=$2 RETURNING id, name, promotional_tags`,
        [tag, productId],
      );
      if (!r.rows[0]) return { ok: false, message: `المنتج #${productId} غير موجود` };
      return { ok: true, message: `تم تعيين تصنيف «${r.rows[0].name}» إلى ${tag}`, data: r.rows[0] };
    },
  },
  {
    name: "toggle_product_active",
    label: "تفعيل/إخفاء منتج",
    description: "تفعيل منتج أو إخفاؤه من المتجر (إيقاف بيع مؤقت أو إعادة تفعيل).",
    argsHint: '{ "productId": 52, "active": false }',
    allow: ["safar", "rashed"],
    async execute(args) {
      const productId = Number(args?.productId);
      const active = !!args?.active;
      if (!productId) return { ok: false, message: "productId غير صالح" };
      const r = await pool.query(`UPDATE products SET is_active=$1 WHERE id=$2 RETURNING id, name, is_active`, [active, productId]);
      if (!r.rows[0]) return { ok: false, message: `المنتج #${productId} غير موجود` };
      return { ok: true, message: `${active ? "تم تفعيل" : "تم إخفاء"} «${r.rows[0].name}»`, data: r.rows[0] };
    },
  },
];

const TOOLS_BY_NAME = new Map(AGENT_TOOLS.map((t) => [t.name, t]));

export function getToolsForAgent(agentName: string): AgentTool[] {
  return AGENT_TOOLS.filter((t) => t.allow.includes("*") || t.allow.includes(agentName));
}

/** هل يُسمح لهذا الوكيل باقتراح/تنفيذ هذه الأداة؟ (تطبيق صلاحيات الأدوار على الخادم) */
export function isToolAllowed(agentName: string, toolName: string): boolean {
  const tool = TOOLS_BY_NAME.get(toolName);
  if (!tool) return false;
  return tool.allow.includes("*") || tool.allow.includes(agentName);
}

/** تعليمات عربية تُلحَق بـ system prompt تشرح للوكيل كيف يقترح أداة */
export function buildToolInstructions(tools: AgentTool[]): string {
  if (!tools.length) return "";
  const list = tools
    .map((t) => `- "${t.name}" (${t.label}): ${t.description}\n  المعطيات: ${t.argsHint}`)
    .join("\n");
  return `

## الأدوات التنفيذية المتاحة لك
يمكنك *اقتراح* تنفيذ أحد الإجراءات التالية. لا تنفّذها بنفسك ولا تدّعِ أنك نفّذتها — فالمالك يجب أن يوافق أولاً.
${list}

إذا قرّرت اقتراح إجراء، أنهِ ردّك بكتلة JSON واحدة بهذا الشكل تماماً (وداخل علامات \`\`\`action):
\`\`\`action
{ "tool": "اسم_الأداة", "title": "عنوان مختصر للإجراء", "args": { ... }, "reason": "لماذا تقترحه" }
\`\`\`
اكتب شرحاً بشرياً موجزاً قبل الكتلة. لا تضع أكثر من كتلة action واحدة. إن لم يكن هناك إجراء، لا تضع كتلة إطلاقاً.`;
}

export interface ParsedProposal {
  tool: string;
  title: string;
  args: any;
  reason?: string;
}

/** استخراج اقتراح الأداة من رد الوكيل + الرد المنظّف بدون كتلة JSON */
export function parseToolProposal(reply: string): { proposal: ParsedProposal | null; cleanReply: string } {
  const fence = reply.match(/```action\s*([\s\S]*?)```/i);
  let raw = fence?.[1];
  if (!raw) {
    // محاولة احتياطية: أول كتلة JSON تحتوي "tool"
    const m = reply.match(/\{[\s\S]*?"tool"[\s\S]*?\}/);
    raw = m?.[0];
  }
  if (!raw) return { proposal: null, cleanReply: reply.trim() };
  try {
    const obj = JSON.parse(raw.trim());
    if (!obj?.tool || !TOOLS_BY_NAME.has(String(obj.tool))) {
      return { proposal: null, cleanReply: reply.trim() };
    }
    const cleanReply = reply
      .replace(/```action[\s\S]*?```/i, "")
      .replace(/\{[\s\S]*?"tool"[\s\S]*?\}/, "")
      .trim();
    return {
      proposal: {
        tool: String(obj.tool),
        title: String(obj.title || TOOLS_BY_NAME.get(String(obj.tool))!.label),
        args: obj.args || {},
        reason: obj.reason ? String(obj.reason) : undefined,
      },
      cleanReply: cleanReply || "اقترحتُ إجراءً — راجِع التفاصيل أدناه.",
    };
  } catch {
    return { proposal: null, cleanReply: reply.trim() };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// الخطوط الحمراء (Red Lines) — ضوابط صارمة تُطبَّق على الخادم قبل تنفيذ أي أداة.
// لا يمكن لأي إجراء (حتى الموافق عليه) تجاوزها إلا بتوجيه صريح من المالك (force).
// ═══════════════════════════════════════════════════════════════════════════
let _mmCfg: { value: MastermindConfig; at: number } | null = null;
const MM_CFG_TTL = 60_000;

/** تحميل إعدادات العقل المدبّر (مع كاش 60 ثانية) من جدول settings. */
export async function loadMastermindConfig(force = false): Promise<MastermindConfig> {
  if (!force && _mmCfg && Date.now() - _mmCfg.at < MM_CFG_TTL) return _mmCfg.value;
  let stored: any = null;
  try {
    const r = await pool.query(`SELECT value FROM settings WHERE key=$1 LIMIT 1`, [MASTERMIND_CONFIG_SETTINGS_KEY]);
    if (r.rows[0]?.value) {
      try {
        stored = typeof r.rows[0].value === "string" ? JSON.parse(r.rows[0].value) : r.rows[0].value;
      } catch {
        stored = null;
      }
    }
  } catch {
    // الجدول قد لا يكون موجوداً بعد — نرجع للافتراضي الآمن
  }
  const cfg = mergeMastermindConfig(stored);
  _mmCfg = { value: cfg, at: Date.now() };
  return cfg;
}

export function invalidateMastermindConfigCache() {
  _mmCfg = null;
}

const RED = "🚫 تجاوز خط أحمر";

function findBlockedWord(text: string, words: string[]): string | null {
  const t = (text || "").toLowerCase();
  for (const w of words) {
    const ww = String(w || "").trim().toLowerCase();
    if (ww && t.includes(ww)) return w;
  }
  return null;
}

/**
 * يفحص ما إذا كان تنفيذ الأداة بهذه المعطيات يتجاوز خطاً أحمر.
 * يُرجِع رسالة عربية بالمخالفة، أو null إن كان آمناً.
 */
export async function checkRedLines(toolName: string, args: any, cfg: MastermindConfig): Promise<string | null> {
  const rl = cfg.redLines;
  const productId = Number(args?.productId) || 0;

  // المنتجات المحميّة: تُمنع كل عمليات التعديل عليها عبر الوكلاء
  const productMutators = ["adjust_product_price", "toggle_product_active", "promote_product", "set_promo_tag"];
  if (productId && rl.protectedProductIds.includes(productId) && productMutators.includes(toolName)) {
    return `${RED}: المنتج #${productId} محميّ ولا يُسمح بأي تعديل عليه عبر الوكلاء.`;
  }

  if (toolName === "adjust_product_price") {
    const price = Number(args?.price);
    if (price > 0) {
      if (rl.minPriceYer > 0 && price < rl.minPriceYer) {
        return `${RED}: السعر ${price.toLocaleString()} ر.ي أقل من الحد الأدنى المسموح ${rl.minPriceYer.toLocaleString()} ر.ي.`;
      }
      if (productId) {
        try {
          const r = await pool.query(`SELECT price, original_price FROM products WHERE id=$1`, [productId]);
          const cur = Number(r.rows[0]?.price) || 0;
          const orig = Number(r.rows[0]?.original_price) || 0;
          if (cur > 0 && rl.maxPriceDecreasePercent < 100) {
            const floor = cur * (1 - rl.maxPriceDecreasePercent / 100);
            if (price < floor) {
              const dropPct = Math.round((1 - price / cur) * 100);
              return `${RED}: تخفيض السعر بنسبة ${dropPct}٪ يتجاوز الحد المسموح ${rl.maxPriceDecreasePercent}٪ (السعر الحالي ${cur.toLocaleString()} ر.ي).`;
            }
          }
          // الخصم الناتج مقابل السعر الأصلي يجب ألا يتجاوز السقف المسموح
          if (rl.maxDiscountPercent < 100) {
            const base = orig > 0 ? orig : cur;
            if (base > 0 && price < base) {
              const discPct = Math.round((1 - price / base) * 100);
              if (discPct > rl.maxDiscountPercent) {
                return `${RED}: الخصم الناتج ${discPct}٪ يتجاوز الحد الأقصى المسموح للخصم ${rl.maxDiscountPercent}٪.`;
              }
            }
          }
        } catch {}
      }
    }
  }

  if (toolName === "promote_product" && productId && rl.maxDiscountPercent < 100) {
    try {
      const r = await pool.query(`SELECT discount_percent FROM products WHERE id=$1`, [productId]);
      const disc = Number(r.rows[0]?.discount_percent) || 0;
      if (disc > rl.maxDiscountPercent) {
        return `${RED}: لا يمكن الترويج لمنتج خصمه الحالي ${disc}٪ يتجاوز الحد الأقصى المسموح للخصم ${rl.maxDiscountPercent}٪.`;
      }
    } catch {}
  }

  if (toolName === "toggle_product_active") {
    const active = !!args?.active;
    if (!active && !rl.allowProductDeactivation) {
      return `${RED}: إخفاء/إيقاف المنتجات عبر الوكلاء غير مسموح حالياً.`;
    }
  }

  // الكلمات الممنوعة في نصوص الإشعارات/الحملات
  if (rl.blockedWords.length && ["notify_customer", "broadcast_notification", "promote_product"].includes(toolName)) {
    const text = [args?.title, args?.message, args?.headline].filter(Boolean).join(" ");
    const hit = findBlockedWord(text, rl.blockedWords);
    if (hit) return `${RED}: النص يحتوي كلمة ممنوعة «${hit}».`;
  }

  // سقف الإشعارات الجماعية/الحملات اليومي
  if (["broadcast_notification", "promote_product"].includes(toolName)) {
    try {
      const r = await pool.query(
        `SELECT COUNT(*)::int AS n FROM ai_agent_actions
           WHERE status='executed'
             AND action_type IN ('tool:broadcast_notification','tool:promote_product')
             AND created_at >= date_trunc('day', NOW())`,
      );
      const sentToday = r.rows[0]?.n || 0;
      if (sentToday >= rl.maxBroadcastsPerDay) {
        return `${RED}: بلغت الحد الأقصى للإشعارات الجماعية اليوم (${rl.maxBroadcastsPerDay}). ارفع الحد من الإعدادات أو انتظر للغد.`;
      }
    } catch {}
  }

  return null;
}

/** تنفيذ أداة فعلياً (يُستدعى فقط بعد موافقة الأدمن) — مع تطبيق الخطوط الحمراء. */
export async function executeTool(
  toolName: string,
  args: any,
  opts: { skipRedLines?: boolean } = {},
): Promise<ToolExecResult> {
  const tool = TOOLS_BY_NAME.get(toolName);
  if (!tool) return { ok: false, message: `أداة غير معروفة: ${toolName}` };
  if (!opts.skipRedLines) {
    try {
      const cfg = await loadMastermindConfig();
      const violation = await checkRedLines(toolName, args || {}, cfg);
      if (violation) return { ok: false, message: violation };
    } catch (e: any) {
      console.warn("[Mastermind] redline check error:", e?.message);
    }
  }
  try {
    return await tool.execute(args || {});
  } catch (e: any) {
    return { ok: false, message: `فشل التنفيذ: ${e?.message || "خطأ غير معروف"}` };
  }
}
