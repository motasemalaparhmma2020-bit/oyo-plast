/**
 * أدوات الوكلاء التنفيذية (Function-Calling مع موافقة بشرية)
 *
 * الفلسفة: الوكيل لا ينفّذ شيئاً مباشرة. هو فقط *يقترح* أداة عبر كتلة JSON،
 * فنُسجّلها كإجراء معلّق (ai_agent_actions.status='pending')، ثم ينفّذها
 * النظام فعلياً *فقط* بعد موافقة الأدمن في لوحة /admin/ai-agents.
 */
import { pool } from "../db";
import { createNotification, broadcastPromo } from "../lib/notifications";

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
      const r = await pool.query(`UPDATE products SET promotional_tag=$1 WHERE id=$2 RETURNING id, name, promotional_tag`, [tag, productId]);
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

/** تنفيذ أداة فعلياً (يُستدعى فقط بعد موافقة الأدمن) */
export async function executeTool(toolName: string, args: any): Promise<ToolExecResult> {
  const tool = TOOLS_BY_NAME.get(toolName);
  if (!tool) return { ok: false, message: `أداة غير معروفة: ${toolName}` };
  try {
    return await tool.execute(args || {});
  } catch (e: any) {
    return { ok: false, message: `فشل التنفيذ: ${e?.message || "خطأ غير معروف"}` };
  }
}
