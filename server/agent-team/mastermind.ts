/**
 * العقل المدبّر (Mastermind) — طبقة تنسيق استراتيجية فوق فريق الوكلاء.
 *
 * راشد (المدير التنفيذي) يقرأ استراتيجية المالك + الخطوط الحمراء + حقائق المتجر
 * الفعلية، ثم يُصدر — في استدعاء واحد — خطة من اقتراحات عملية:
 *   • tool      : إجراء قابل للتنفيذ فوراً بعد موافقة المالك.
 *   • directive : توجيه مهمة لوكيل/قسم (يُشغَّل الوكيل مرة عند الموافقة).
 *   • advice    : توصية تحتاج قراراً بشرياً (لا تنفيذ آلي).
 *
 * لا ينفّذ أي شيء هنا — فقط يسجّل إجراءات معلّقة (pending) تنتظر موافقة المالك.
 */
import { pool } from "../db";
import { callAgentModel, getAgent, logAgentAction } from "./index";
import { AGENT_TOOLS, isToolAllowed, loadMastermindConfig } from "./tools";
import { buildPolicyPrompt, MASTERMIND_AGENT_NAME } from "@shared/mastermind-config";

export interface MastermindCreatedProposal {
  id: number;
  kind: "tool" | "directive" | "advice";
  title: string;
  reason: string;
  tool?: string;
  args?: any;
  targetAgent?: string;
}

export interface RunStrategyResult {
  runId: string;
  created: number;
  proposals: MastermindCreatedProposal[];
  narrative: string;
  skipped: string[];
}

// تهدئة + سقف يومي في الذاكرة (يكفي لعملية واحدة؛ يُعاد ضبطه عند إعادة التشغيل)
let _lastRunAt = 0;
const _dailyRuns = { day: "", count: 0 };

// ─── حقائق المتجر المضغوطة (تُحقن في تعليمات راشد) ─────────────────────────
async function buildStoreFacts(): Promise<string> {
  const parts: string[] = [];
  try {
    const top = await pool.query(
      `SELECT id, name, price, stock, sold_count, is_active, promotional_tags
       FROM products ORDER BY sold_count DESC NULLS LAST LIMIT 12`,
    );
    if (top.rows.length) {
      parts.push(
        `### أبرز المنتجات:\n${top.rows
          .map((p) => {
            const tags = Array.isArray(p.promotional_tags) ? p.promotional_tags.filter(Boolean) : [];
            return `- #${p.id} ${p.name} | سعر ${p.price} ر.ي | مخزون ${p.stock ?? "—"} | مبيعات ${p.sold_count || 0} | ${p.is_active === false ? "مخفي" : "نشط"}${tags.length ? ` | وسوم ${tags.join("، ")}` : ""}`;
          })
          .join("\n")}`,
      );
    }
  } catch {}
  try {
    const low = await pool.query(
      `SELECT id, name, stock FROM products
       WHERE is_active=true AND stock IS NOT NULL AND stock <= 5 ORDER BY stock ASC LIMIT 8`,
    );
    if (low.rows.length) {
      parts.push(`### مخزون منخفض (≤5):\n${low.rows.map((p) => `- #${p.id} ${p.name}: ${p.stock}`).join("\n")}`);
    }
  } catch {}
  try {
    const stale = await pool.query(
      `SELECT id, name FROM products WHERE is_active=true AND COALESCE(sold_count,0)=0 ORDER BY id DESC LIMIT 8`,
    );
    if (stale.rows.length) {
      parts.push(`### منتجات نشطة بلا مبيعات:\n${stale.rows.map((p) => `- #${p.id} ${p.name}`).join("\n")}`);
    }
  } catch {}
  try {
    const ord = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day')::int AS d1,
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 day')::int AS d7,
         COUNT(*) FILTER (WHERE status='pending')::int AS pend
       FROM orders`,
    );
    const o = ord.rows[0] || {};
    parts.push(`### الطلبات: اليوم ${o.d1 || 0} · آخر 7 أيام ${o.d7 || 0} · معلّقة ${o.pend || 0}`);
  } catch {}
  try {
    const u = await pool.query(
      `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 day')::int AS new7 FROM users`,
    );
    parts.push(`### العملاء: إجمالي ${u.rows[0]?.total || 0} · جدد (7 أيام) ${u.rows[0]?.new7 || 0}`);
  } catch {}
  try {
    const credit = await pool.query(
      `SELECT COUNT(*)::int AS n, COALESCE(SUM(current_balance),0)::numeric AS total FROM customer_credit WHERE current_balance > 0`,
    );
    if (Number(credit.rows[0]?.total || 0) > 0) {
      parts.push(`### مستحقات على العملاء: ${credit.rows[0].n} عميل بإجمالي ${Number(credit.rows[0].total).toLocaleString()} ر.ي`);
    }
  } catch {}
  return parts.join("\n\n") || "لا توجد بيانات كافية حالياً.";
}

// ─── استخراج JSON صارم من رد النموذج (قد يكون داخل ```json) ───────────────────
function extractJson(raw: string): any | null {
  let body = raw || "";
  const fence = body.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) body = fence[1];
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

// ─── تشغيل الاستراتيجية: استدعاء واحد لراشد → اقتراحات معلّقة ─────────────────
export async function runStrategy(opts: { extraInstruction?: string } = {}): Promise<RunStrategyResult> {
  const cfg = await loadMastermindConfig(true);
  if (!cfg.enabled) throw new Error("العقل المدبّر معطّل من الإعدادات.");

  // تهدئة (cooldown)
  const now = Date.now();
  const cdMs = (cfg.orchestration.cooldownMinutes || 0) * 60_000;
  if (cdMs > 0 && _lastRunAt > 0 && now - _lastRunAt < cdMs) {
    const waitMin = Math.ceil((cdMs - (now - _lastRunAt)) / 60_000);
    throw new Error(`فترة تهدئة — انتظر ~${waitMin} دقيقة قبل تشغيل خطة جديدة.`);
  }

  // سقف يومي
  const today = new Date().toISOString().slice(0, 10);
  if (_dailyRuns.day !== today) {
    _dailyRuns.day = today;
    _dailyRuns.count = 0;
  }
  if (_dailyRuns.count >= cfg.orchestration.dailyRunCap) {
    throw new Error(`بلغت الحد الأقصى لتشغيل الخطة اليوم (${cfg.orchestration.dailyRunCap}). حاول غداً.`);
  }

  const rashed = await getAgent(MASTERMIND_AGENT_NAME);
  if (!rashed) throw new Error("راشد (العقل المدبّر) غير موجود في قاعدة البيانات.");
  if (!rashed.is_active) throw new Error("راشد غير نشط حالياً — فعّله أولاً.");

  const facts = await buildStoreFacts();
  const policy = buildPolicyPrompt(cfg);
  const max = cfg.orchestration.maxProposalsPerRun;

  const toolCatalog = AGENT_TOOLS.map(
    (t) => `- ${t.name} (${t.label}): ${t.description}\n  المعطيات: ${t.argsHint}\n  المخوّلون: ${t.allow.join("، ")}`,
  ).join("\n");
  const deptList = cfg.departments
    .map(
      (d) =>
        `- ${d.label} (${d.id}): وكلاء [${d.agentNames.join("، ") || "—"}] · موظفون [${d.staffRoles.join("، ") || "—"}]`,
    )
    .join("\n");

  const systemPrompt = `${rashed.system_prompt}

أنت العقل المدبّر (CEO) لمتجر OYO PLAST. مهمتك الآن وضع خطة تنفيذية مبنية على استراتيجية المالك والحقائق الفعلية من قاعدة البيانات.
أصدر اقتراحات عملية فقط (لا إنشاء ولا حشو). كل اقتراح من أحد الأنواع:
  • "tool": إجراء قابل للتنفيذ فوراً — اختر أداة من القائمة وحدّد معطياتها الحقيقية من الحقائق (لا تخترع معرّفات منتجات).
  • "directive": توجيه مهمة لوكيل محدّد — اذكر اسمه في targetAgent.
  • "advice": توصية للمالك تحتاج قراراً بشرياً (بلا أداة).
التزم بالخطوط الحمراء حرفياً. لا تتجاوز ${max} اقتراحات، ورتّبها حسب الأولوية.

أعِد ردك بصيغة JSON صارمة فقط، دون أي نص خارج JSON، بهذا الشكل:
{"narrative":"سطر أو سطران ملخّص للخطة","proposals":[{"kind":"tool|directive|advice","tool":"اسم_الأداة","args":{},"targetAgent":"اسم_الوكيل","title":"عنوان مختصر","reason":"السبب بإيجاز"}]}`;

  const userMsg = `${policy ? policy + "\n\n" : ""}## الأقسام والفريق:
${deptList}

## الأدوات المتاحة (استخدم اسم الأداة كما هو):
${toolCatalog}

## حقائق المتجر الآن:
${facts}
${opts.extraInstruction ? `\n## توجيه إضافي من المالك:\n${opts.extraInstruction}` : ""}

أصدر خطتك الآن بصيغة JSON الصارمة المطلوبة فقط.`;

  // احجز التشغيل قبل الاستدعاء (يمنع التشغيل المتزامن المتكرر)
  _lastRunAt = now;
  _dailyRuns.count++;

  const runId = `mm_${now}`;
  const raw = await callAgentModel(rashed, systemPrompt, userMsg);
  const obj = extractJson(raw);
  const narrative = String(obj?.narrative || "").trim() || "(لم يقدّم راشد ملخّصاً)";
  const rawProposals: any[] = Array.isArray(obj?.proposals) ? obj.proposals.slice(0, max) : [];

  const created: MastermindCreatedProposal[] = [];
  const skipped: string[] = [];

  for (const p of rawProposals) {
    const kind = String(p?.kind || "advice");
    const title = String(p?.title || "اقتراح").slice(0, 200);
    const reason = String(p?.reason || "").slice(0, 600);

    if (kind === "tool") {
      const tool = String(p?.tool || "");
      if (!AGENT_TOOLS.some((t) => t.name === tool)) {
        skipped.push(`أداة غير معروفة: ${tool || "—"}`);
        continue;
      }
      if (!isToolAllowed(rashed.name, tool)) {
        skipped.push(`غير مخوّل لراشد: ${tool}`);
        continue;
      }
      const args = p?.args || {};
      const id = await logAgentAction({
        agentId: rashed.id,
        actionType: `tool:${tool}`,
        title,
        description: [reason, `المعطيات: ${JSON.stringify(args)}`].filter(Boolean).join("\n"),
        inputData: { tool, args, reason, runId, kind: "tool" },
        status: "pending",
      });
      created.push({ id, kind: "tool", tool, args, title, reason });
    } else if (kind === "directive") {
      const targetAgent = String(p?.targetAgent || "").trim();
      const instruction = `${title}. ${reason}`.trim();
      const id = await logAgentAction({
        agentId: rashed.id,
        actionType: "directive",
        title,
        description: [targetAgent ? `إلى: ${targetAgent}` : "", reason].filter(Boolean).join("\n"),
        inputData: { targetAgent, instruction, reason, runId, kind: "directive" },
        status: "pending",
      });
      created.push({ id, kind: "directive", targetAgent, title, reason });
    } else {
      const id = await logAgentAction({
        agentId: rashed.id,
        actionType: "mastermind_proposal",
        title,
        description: reason,
        inputData: { reason, runId, kind: "advice" },
        status: "pending",
      });
      created.push({ id, kind: "advice", title, reason });
    }
  }

  return { runId, created: created.length, proposals: created, narrative, skipped };
}
