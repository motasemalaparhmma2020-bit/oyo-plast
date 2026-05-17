/**
 * Task 8 — نظام وكلاء الذكاء الاصطناعي (AI Agent Team)
 *
 * 9 وكلاء + مدير تنفيذي (راشد) يتفقد قاعدة البيانات للتحقق من الإنجازات.
 * - DeepSeek: راشد، سفر، نور، هدى، رامي  (DEEPSEEK_API_KEY)
 * - Gemini : ليلى، ماجد، عمر، أوبو       (GEMINI_API_KEY)
 */
import { GoogleGenAI } from "@google/genai";
import { pool } from "../db";

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const gemini = GEMINI_KEY ? new GoogleGenAI({ apiKey: GEMINI_KEY }) : null;

if (!DEEPSEEK_KEY) console.warn("[AgentTeam] ⚠️ DEEPSEEK_API_KEY غير مضبوط — وكلاء DeepSeek معطّلون");
if (!GEMINI_KEY) console.warn("[AgentTeam] ⚠️ GEMINI_API_KEY غير مضبوط — وكلاء Gemini معطّلون");

// ─── أنواع ────────────────────────────────────────────────────────────────────
export interface AgentRow {
  id: number;
  name: string;
  display_name: string;
  role: string;
  model: string;
  provider: string;
  system_prompt: string;
  avatar_url: string | null;
  permissions: any;
  is_active: boolean;
  last_daily_report: string | null;
}

export interface ChatResult {
  reply: string;
  actionId?: number;
  error?: string;
}

// ─── DeepSeek client (OpenAI-compatible) ────────────────────────────────────
async function deepseekChat(
  model: string,
  systemPrompt: string,
  userMessage: string,
  contextBlock?: string,
): Promise<string> {
  if (!DEEPSEEK_KEY) throw new Error("DEEPSEEK_API_KEY غير مضبوط");
  const fullUser = contextBlock ? `${contextBlock}\n\n---\n\nرسالة المستخدم:\n${userMessage}` : userMessage;
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: fullUser },
      ],
      temperature: 0.6,
      max_tokens: 1200,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`DeepSeek error ${res.status}: ${t.slice(0, 300)}`);
  }
  const data: any = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "(لا يوجد رد)";
}

// ─── Gemini wrapper ─────────────────────────────────────────────────────────
async function geminiChat(
  model: string,
  systemPrompt: string,
  userMessage: string,
  contextBlock?: string,
): Promise<string> {
  if (!gemini) throw new Error("GEMINI_API_KEY غير مضبوط");
  const fullPrompt = contextBlock
    ? `${systemPrompt}\n\n## السياق:\n${contextBlock}\n\n## رسالة المستخدم:\n${userMessage}`
    : `${systemPrompt}\n\n## رسالة المستخدم:\n${userMessage}`;
  const result: any = await (gemini as any).models.generateContent({
    model,
    contents: fullPrompt,
  });
  const text = (typeof result?.text === "function" ? result.text() : result?.text) || result?.response?.text?.() || "";
  return String(text).trim() || "(لا يوجد رد)";
}

// ─── جلب سياق ديناميكي من قاعدة البيانات حسب صلاحيات الوكيل ────────────────
async function buildAgentContext(agent: AgentRow): Promise<string> {
  const scope: string[] = agent.permissions?.db_scope || [];
  if (!agent.permissions?.can_view_db || scope.length === 0) return "";
  const parts: string[] = [];

  try {
    if (scope.includes("*") || scope.includes("products")) {
      const r = await pool.query(
        `SELECT id, name, price, stock, sold_count FROM products WHERE is_active=true ORDER BY sold_count DESC NULLS LAST LIMIT 10`,
      );
      parts.push(`## أعلى 10 منتجات:\n${r.rows.map((p) => `- #${p.id} ${p.name} — سعر ${p.price} ر.ي، مخزون ${p.stock}، مبيعات ${p.sold_count || 0}`).join("\n")}`);
    }
    if (scope.includes("*") || scope.includes("orders")) {
      const r = await pool.query(
        `SELECT id, status, total_amount, created_at FROM orders ORDER BY created_at DESC LIMIT 10`,
      );
      parts.push(`## آخر 10 طلبات:\n${r.rows.map((o) => `- #${o.id} ${o.status} — ${o.total_amount} ر.ي (${new Date(o.created_at).toLocaleDateString("ar-YE")})`).join("\n")}`);
    }
    if (scope.includes("*") || scope.includes("users")) {
      const r = await pool.query(`SELECT COUNT(*)::int AS n FROM users`);
      parts.push(`## إجمالي المستخدمين: ${r.rows[0]?.n || 0}`);
    }
    if (scope.includes("*") || scope.includes("cart_items")) {
      const r = await pool.query(`SELECT COUNT(*)::int AS n FROM cart_items`);
      parts.push(`## عناصر في السلال حالياً: ${r.rows[0]?.n || 0}`);
    }
    if (scope.includes("*") || scope.includes("customer_credit")) {
      try {
        const r = await pool.query(
          `SELECT COUNT(*)::int AS n, COALESCE(SUM(current_balance),0)::numeric AS total FROM customer_credit WHERE current_balance > 0`,
        );
        parts.push(`## عملاء عليهم مستحقات: ${r.rows[0]?.n || 0} — إجمالي ${r.rows[0]?.total || 0} ر.ي`);
      } catch {}
    }
    if (scope.includes("*") || scope.includes("messages")) {
      try {
        const r = await pool.query(
          `SELECT COUNT(*)::int AS n FROM messages WHERE created_at >= NOW() - INTERVAL '1 day'`,
        );
        parts.push(`## رسائل آخر 24 ساعة: ${r.rows[0]?.n || 0}`);
      } catch {}
    }
  } catch (e: any) {
    console.warn("[AgentTeam] buildContext error:", e?.message);
  }
  return parts.join("\n\n");
}

// ─── الواجهة الرئيسية: محادثة مع وكيل ─────────────────────────────────────
export async function chatWithAgent(
  agent: AgentRow,
  message: string,
  opts: { userId?: string; userName?: string; logConversation?: boolean } = {},
): Promise<ChatResult> {
  if (!agent.is_active) return { reply: "هذا الوكيل غير نشط حالياً.", error: "inactive" };
  try {
    const ctx = await buildAgentContext(agent);
    let reply: string;
    if (agent.provider === "deepseek") {
      reply = await deepseekChat(agent.model, agent.system_prompt, message, ctx);
    } else if (agent.provider === "gemini") {
      reply = await geminiChat(agent.model, agent.system_prompt, message, ctx);
    } else {
      return { reply: "مزوّد غير مدعوم.", error: "bad_provider" };
    }

    // سجّل المحادثة
    if (opts.logConversation !== false) {
      try {
        await pool.query(
          `INSERT INTO ai_agent_conversations (agent_id, user_id, user_name, message, reply) VALUES ($1,$2,$3,$4,$5)`,
          [agent.id, opts.userId || null, opts.userName || null, message, reply],
        );
      } catch (e) {
        console.warn("[AgentTeam] log conversation failed:", (e as any)?.message);
      }
    }
    return { reply };
  } catch (e: any) {
    console.error(`[AgentTeam] chat failed (${agent.name}):`, e?.message);
    return { reply: `تعذّر الاتصال بالوكيل: ${e?.message || "خطأ غير معروف"}`, error: "api_error" };
  }
}

// ─── تسجيل إجراء (action) لوكيل ─────────────────────────────────────────────
export async function logAgentAction(p: {
  agentId: number;
  actionType: string;
  title: string;
  description?: string;
  inputData?: any;
  outputData?: any;
  status?: string;
}): Promise<number> {
  const r = await pool.query(
    `INSERT INTO ai_agent_actions (agent_id, action_type, title, description, input_data, output_data, status)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7) RETURNING id`,
    [
      p.agentId,
      p.actionType,
      p.title,
      p.description || null,
      p.inputData ? JSON.stringify(p.inputData) : null,
      p.outputData ? JSON.stringify(p.outputData) : null,
      p.status || "pending",
    ],
  );
  return r.rows[0].id;
}

// ─── المدير التنفيذي (راشد): جمع التقارير والتحقق ─────────────────────────
export interface CEODailyReport {
  date: string;
  summary: {
    total_actions: number;
    approved_actions: number;
    pending_actions: number;
    rejected_actions: number;
    total_conversations_24h: number;
  };
  agents_report: Array<{
    agent_id: number;
    agent_name: string;
    display_name: string;
    role: string;
    is_active: boolean;
    actions_24h: number;
    conversations_24h: number;
    achievements: Array<{ id: number; action: string; status: string; verified: boolean; created_at: string }>;
    pending_tasks_count: number;
    performance_score: number;
    self_report?: string;
  }>;
  db_facts: {
    new_orders_24h: number;
    delivered_orders_24h: number;
    new_users_24h: number;
    pending_credit_total: number;
  };
  recommendations: string[];
  narrative: string; // ملخّص نصّي من راشد
  generated_at: string;
}

export async function generateCEOReport(opts: { force?: boolean; asAgent: AgentRow } = {} as any): Promise<CEODailyReport> {
  const today = new Date().toISOString().slice(0, 10);

  // 1. حقائق قاعدة البيانات (مستقلة عن ادعاءات الوكلاء)
  const [newOrdersR, delivR, newUsersR, creditR, convR, actionsR] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS n FROM orders WHERE created_at >= NOW() - INTERVAL '1 day'`),
    pool.query(`SELECT COUNT(*)::int AS n FROM orders WHERE status='delivered' AND updated_at >= NOW() - INTERVAL '1 day'`).catch(() => ({ rows: [{ n: 0 }] }) as any),
    pool.query(`SELECT COUNT(*)::int AS n FROM users WHERE created_at >= NOW() - INTERVAL '1 day'`).catch(() => ({ rows: [{ n: 0 }] }) as any),
    pool.query(`SELECT COALESCE(SUM(current_balance),0)::numeric AS total FROM customer_credit WHERE current_balance > 0`).catch(() => ({ rows: [{ total: 0 }] }) as any),
    pool.query(`SELECT COUNT(*)::int AS n FROM ai_agent_conversations WHERE created_at >= NOW() - INTERVAL '1 day'`),
    pool.query(`SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status='approved')::int AS approved,
        COUNT(*) FILTER (WHERE status='pending')::int AS pending,
        COUNT(*) FILTER (WHERE status='rejected')::int AS rejected
       FROM ai_agent_actions WHERE created_at >= NOW() - INTERVAL '1 day'`),
  ]);

  // 2. تقرير لكل وكيل
  const agentsR = await pool.query(`SELECT * FROM ai_agents WHERE is_active=true ORDER BY id`);
  const agents_report: CEODailyReport["agents_report"] = [];
  for (const a of agentsR.rows as AgentRow[]) {
    if (a.name === "rashed") continue; // راشد لا يقيّم نفسه
    const [actR, convsR] = await Promise.all([
      pool.query(
        `SELECT id, action_type, title, status, verified_by_ceo, created_at FROM ai_agent_actions
         WHERE agent_id=$1 AND created_at >= NOW() - INTERVAL '1 day' ORDER BY created_at DESC LIMIT 20`,
        [a.id],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS n FROM ai_agent_conversations WHERE agent_id=$1 AND created_at >= NOW() - INTERVAL '1 day'`,
        [a.id],
      ),
    ]);
    const actions = actR.rows;
    const approved = actions.filter((x: any) => x.status === "approved").length;
    const rejected = actions.filter((x: any) => x.status === "rejected").length;
    const totalRated = approved + rejected;
    const performance_score = totalRated > 0 ? Math.round((approved / totalRated) * 100) : actions.length > 0 ? 70 : 50;
    const pending_tasks_count = actions.filter((x: any) => x.status === "pending").length;

    // طلب تقرير ذاتي من الوكيل (اختياري — يفشل بهدوء)
    let self_report: string | undefined;
    try {
      const r = await chatWithAgent(a, "قدّم تقريراً موجزاً جداً (3 أسطر كحد أقصى) عن أهم ما أنجزته خلال آخر 24 ساعة.", {
        userId: "ceo",
        userName: "راشد",
        logConversation: false,
      });
      if (!r.error) self_report = r.reply;
    } catch {}

    agents_report.push({
      agent_id: a.id,
      agent_name: a.name,
      display_name: a.display_name,
      role: a.role,
      is_active: a.is_active,
      actions_24h: actions.length,
      conversations_24h: convsR.rows[0]?.n || 0,
      achievements: actions.slice(0, 5).map((x: any) => ({
        id: x.id,
        action: `${x.action_type}: ${x.title}`,
        status: x.status,
        verified: !!x.verified_by_ceo,
        created_at: x.created_at,
      })),
      pending_tasks_count,
      performance_score,
      self_report,
    });
  }

  // 3. توصيات تلقائية مبنية على الحقائق
  const recommendations: string[] = [];
  for (const ar of agents_report) {
    if (ar.pending_tasks_count >= 3) recommendations.push(`${ar.display_name} لديها ${ar.pending_tasks_count} اقتراحات تنتظر موافقتك.`);
    if (ar.actions_24h === 0 && ar.conversations_24h === 0) recommendations.push(`${ar.display_name} لم تُسجّل أي نشاط في آخر 24 ساعة — تحقق من حالتها.`);
    if (ar.performance_score < 40) recommendations.push(`أداء ${ar.display_name} منخفض (${ar.performance_score}%) — راجع نوع المهام.`);
  }
  if (Number(creditR.rows[0]?.total || 0) > 0) {
    recommendations.push(`إجمالي المستحقات على العملاء: ${Number(creditR.rows[0].total).toLocaleString("ar-YE")} ر.ي — أرسل هدى لمتابعتهم.`);
  }

  // 4. ملخّص نصّي من راشد نفسه (DeepSeek)
  const factsSummary = `الحقائق:
- طلبات جديدة (24س): ${newOrdersR.rows[0].n}
- طلبات مُسلّمة: ${delivR.rows[0].n}
- مستخدمون جدد: ${newUsersR.rows[0].n}
- مستحقات إجمالية: ${Number(creditR.rows[0]?.total || 0).toLocaleString("ar-YE")} ر.ي
- محادثات وكلاء (24س): ${convR.rows[0].n}
- إجراءات وكلاء: ${actionsR.rows[0].total} (موافق عليه ${actionsR.rows[0].approved}، معلّق ${actionsR.rows[0].pending}، مرفوض ${actionsR.rows[0].rejected})

أداء الوكلاء:
${agents_report.map((a) => `- ${a.display_name}: ${a.actions_24h} إجراء، ${a.conversations_24h} محادثة، أداء ${a.performance_score}%`).join("\n")}`;

  let narrative = "";
  try {
    narrative = await deepseekChat(
      opts.asAgent.model,
      opts.asAgent.system_prompt,
      `بناءً على هذه الحقائق من قاعدة البيانات (التي تفقّدتَها بنفسك)، اكتب ملخّصاً تنفيذياً موجزاً (5 أسطر كحد أقصى) للمالك، يذكر أبرز ما حدث وأهم تحذير.\n\n${factsSummary}`,
    );
  } catch (e: any) {
    narrative = `تعذّر توليد الملخّص النصّي: ${e?.message}. الحقائق الخام:\n\n${factsSummary}`;
  }

  // حدّث last_daily_report
  try {
    await pool.query(`UPDATE ai_agents SET last_daily_report=$1 WHERE id=$2`, [today, opts.asAgent.id]);
  } catch {}

  return {
    date: today,
    summary: {
      total_actions: actionsR.rows[0].total,
      approved_actions: actionsR.rows[0].approved,
      pending_actions: actionsR.rows[0].pending,
      rejected_actions: actionsR.rows[0].rejected,
      total_conversations_24h: convR.rows[0].n,
    },
    agents_report,
    db_facts: {
      new_orders_24h: newOrdersR.rows[0].n,
      delivered_orders_24h: delivR.rows[0].n,
      new_users_24h: newUsersR.rows[0].n,
      pending_credit_total: Number(creditR.rows[0]?.total || 0),
    },
    recommendations,
    narrative,
    generated_at: new Date().toISOString(),
  };
}

// ─── تخزين آخر تقرير في الذاكرة + قاعدة البيانات ────────────────────────────
let lastReport: CEODailyReport | null = null;
export function getLastReport() {
  return lastReport;
}
export function setLastReport(r: CEODailyReport) {
  lastReport = r;
}

// ─── جلب وكيل بالاسم ──────────────────────────────────────────────────────
export async function getAgent(idOrName: string | number): Promise<AgentRow | null> {
  const isNum = typeof idOrName === "number" || /^\d+$/.test(String(idOrName));
  const r = await pool.query(
    isNum
      ? `SELECT * FROM ai_agents WHERE id=$1 LIMIT 1`
      : `SELECT * FROM ai_agents WHERE name=$1 LIMIT 1`,
    [idOrName],
  );
  return r.rows[0] || null;
}
