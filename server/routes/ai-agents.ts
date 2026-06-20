/**
 * Task 8 — مسارات API لنظام وكلاء الذكاء الاصطناعي
 *
 *  GET    /api/ai/agents                          قائمة الوكلاء
 *  PATCH  /api/ai/agents/:id                      تعديل وكيل (admin)
 *  POST   /api/ai/agents/:idOrName/chat           محادثة مع وكيل
 *  GET    /api/ai/agents/:id/actions              سجل الإجراءات
 *  GET    /api/ai/agents/:id/conversations        سجل المحادثات
 *  POST   /api/ai/agents/ceo/daily-report         طلب تقرير فوري من راشد
 *  GET    /api/ai/agents/ceo/last-report          آخر تقرير محفوظ
 *  POST   /api/ai/actions/:id/approve             موافقة/رفض على إجراء
 */
import type { Express, Request, Response, NextFunction } from "express";
import { pool } from "../db";
import { chatWithAgent, generateCEOReport, getAgent, getLastReport, setLastReport, logAgentAction } from "../agent-team";
import { executeTool, isToolAllowed, loadMastermindConfig, invalidateMastermindConfigCache } from "../agent-team/tools";
import { runStrategy } from "../agent-team/mastermind";
import {
  mastermindConfigSchema,
  mergeMastermindConfig,
  MASTERMIND_CONFIG_SETTINGS_KEY,
} from "@shared/mastermind-config";

type Admin = (req: Request, res: Response, next: NextFunction) => void;

export function registerAIAgentRoutes(app: Express, requireAdmin: Admin) {
  // 1. قائمة الوكلاء (Admin only)
  app.get("/api/ai/agents", requireAdmin, async (_req, res) => {
    try {
      const r = await pool.query(`
        SELECT a.id, a.name, a.display_name, a.role, a.model, a.provider, a.avatar_url,
               a.permissions, a.is_active, a.last_daily_report,
               (SELECT COUNT(*)::int FROM ai_agent_actions WHERE agent_id=a.id AND created_at >= NOW() - INTERVAL '1 day') AS actions_24h,
               (SELECT COUNT(*)::int FROM ai_agent_actions WHERE agent_id=a.id AND status='pending') AS pending_actions,
               (SELECT COUNT(*)::int FROM ai_agent_conversations WHERE agent_id=a.id AND created_at >= NOW() - INTERVAL '1 day') AS conversations_24h
        FROM ai_agents a ORDER BY a.id
      `);
      res.json(r.rows);
    } catch (e: any) {
      res.status(500).json({ error: e?.message });
    }
  });

  // 2. تعديل وكيل
  app.patch("/api/ai/agents/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const allowed = ["display_name", "role", "model", "provider", "system_prompt", "avatar_url", "is_active", "permissions"];
      const sets: string[] = [];
      const vals: any[] = [];
      let i = 1;
      for (const k of allowed) {
        if (req.body[k] !== undefined) {
          if (k === "permissions" && typeof req.body[k] === "object") {
            sets.push(`${k}=$${i++}::jsonb`);
            vals.push(JSON.stringify(req.body[k]));
          } else {
            sets.push(`${k}=$${i++}`);
            vals.push(req.body[k]);
          }
        }
      }
      if (!sets.length) return res.status(400).json({ error: "لا توجد حقول للتحديث" });
      sets.push(`updated_at=NOW()`);
      vals.push(id);
      const r = await pool.query(`UPDATE ai_agents SET ${sets.join(", ")} WHERE id=$${i} RETURNING *`, vals);
      res.json(r.rows[0]);
    } catch (e: any) {
      res.status(500).json({ error: e?.message });
    }
  });

  // 3. محادثة مع وكيل (admin only — يمكن لاحقاً فتحها للعملاء على وكلاء محددين)
  app.post("/api/ai/agents/:idOrName/chat", requireAdmin, async (req, res) => {
    try {
      const { idOrName } = req.params;
      const message = String(req.body?.message || "").trim();
      if (!message) return res.status(400).json({ error: "الرسالة فارغة" });
      const agent = await getAgent(idOrName);
      if (!agent) return res.status(404).json({ error: "الوكيل غير موجود" });
      const userName = (req as any).session?.user?.firstName || (req as any).session?.user?.email || "أدمن";
      const r = await chatWithAgent(agent, message, { userId: "admin", userName });
      res.json(r);
    } catch (e: any) {
      res.status(500).json({ error: e?.message });
    }
  });

  // 4. سجل إجراءات وكيل
  app.get("/api/ai/agents/:id/actions", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const limit = Math.min(100, Number(req.query.limit) || 30);
      const r = await pool.query(
        `SELECT * FROM ai_agent_actions WHERE agent_id=$1 ORDER BY created_at DESC LIMIT $2`,
        [id, limit],
      );
      res.json(r.rows);
    } catch (e: any) {
      res.status(500).json({ error: e?.message });
    }
  });

  // 5. سجل محادثات وكيل
  app.get("/api/ai/agents/:id/conversations", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const limit = Math.min(200, Number(req.query.limit) || 50);
      const r = await pool.query(
        `SELECT * FROM ai_agent_conversations WHERE agent_id=$1 ORDER BY created_at DESC LIMIT $2`,
        [id, limit],
      );
      res.json(r.rows);
    } catch (e: any) {
      res.status(500).json({ error: e?.message });
    }
  });

  // 6. طلب تقرير فوري من راشد
  app.post("/api/ai/agents/ceo/daily-report", requireAdmin, async (req, res) => {
    try {
      const force = !!req.body?.force;
      const rashed = await getAgent("rashed");
      if (!rashed) return res.status(404).json({ error: "راشد غير موجود في قاعدة البيانات" });
      if (!force) {
        const last = getLastReport();
        if (last) {
          const ageMs = Date.now() - new Date(last.generated_at).getTime();
          if (ageMs < 60 * 60 * 1000) return res.json({ ...last, cached: true });
        }
      }
      const report = await generateCEOReport({ asAgent: rashed });
      setLastReport(report);
      // سجّل كـ action للتتبع
      try {
        await logAgentAction({
          agentId: rashed.id,
          actionType: "daily_report",
          title: `تقرير المدير التنفيذي — ${report.date}`,
          description: report.narrative.slice(0, 500),
          outputData: { summary: report.summary, db_facts: report.db_facts },
          status: "executed",
        });
      } catch {}
      res.json(report);
    } catch (e: any) {
      res.status(500).json({ error: e?.message });
    }
  });

  // 7. آخر تقرير محفوظ
  app.get("/api/ai/agents/ceo/last-report", requireAdmin, (_req, res) => {
    const r = getLastReport();
    if (!r) return res.status(404).json({ error: "لا يوجد تقرير سابق — استخدم زر 'طلب تقرير فوري' لأول مرة" });
    res.json(r);
  });

  // 8. موافقة/رفض على إجراء — عند الموافقة تُنفَّذ الأداة فعلياً
  app.post("/api/ai/actions/:id/approve", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const approved = !!req.body?.approved;
      const notes = req.body?.notes ? String(req.body.notes).slice(0, 500) : null;

      // اجلب الإجراء + اسم الوكيل المقترِح (للتحقق من الصلاحيات)
      const cur = await pool.query(
        `SELECT a.*, ag.name AS agent_name FROM ai_agent_actions a
           LEFT JOIN ai_agents ag ON ag.id = a.agent_id WHERE a.id=$1`,
        [id],
      );
      const action = cur.rows[0];
      if (!action) return res.status(404).json({ error: "الإجراء غير موجود" });
      if (action.status !== "pending") {
        return res.status(409).json({ error: "تمت معالجة هذا الإجراء مسبقاً", status: action.status });
      }

      if (!approved) {
        // رفض ذرّي: ينجح فقط إن كان لا يزال معلّقاً (يمنع الرفض المكرر)
        const r = await pool.query(
          `UPDATE ai_agent_actions
             SET status='rejected', verified_by_ceo=true, verified_at=NOW(),
                 description=COALESCE(description,'') || CASE WHEN $1::text IS NOT NULL THEN E'\n[مراجعة الأدمن]: ' || $1 ELSE '' END
           WHERE id=$2 AND status='pending' RETURNING *`,
          [notes, id],
        );
        if (!r.rows[0]) return res.status(409).json({ error: "تمت معالجة هذا الإجراء مسبقاً" });
        return res.json(r.rows[0]);
      }

      // موافقة ذرّية: نطالب بالإجراء بنقله من 'pending' إلى 'processing' مرة واحدة فقط
      // (يمنع التنفيذ المزدوج عند الضغط المتكرر أو الطلبات المتزامنة)
      const claim = await pool.query(
        `UPDATE ai_agent_actions
           SET status='processing', verified_by_ceo=true, verified_at=NOW()
         WHERE id=$1 AND status='pending' RETURNING *`,
        [id],
      );
      if (!claim.rows[0]) return res.status(409).json({ error: "تمت معالجة هذا الإجراء مسبقاً" });

      // force=true: تجاوز صريح من المالك للخطوط الحمراء عند تنفيذ الأداة
      const force = !!req.body?.force;

      // نفّذ الإجراء حسب نوعه — directive (توجيه وكيل) أو tool (أداة)
      const isDirective = action.action_type === "directive";
      const toolName: string | undefined = isDirective
        ? undefined
        : action.input_data?.tool ||
          (typeof action.action_type === "string" && action.action_type.startsWith("tool:")
            ? action.action_type.slice(5)
            : undefined);

      let execResult: { ok: boolean; message: string; data?: any } | null = null;
      let finalStatus = "approved";

      if (isDirective) {
        // توجيه: شغّل الوكيل المستهدف مرّة واحدة بالتعليمات المرفقة
        const targetName = String(action.input_data?.targetAgent || "").trim();
        const instruction = String(action.input_data?.instruction || action.title || "").trim();
        if (!targetName) {
          execResult = { ok: false, message: "التوجيه لا يحدّد وكيلاً مستهدفاً" };
          finalStatus = "failed";
        } else {
          const target = await getAgent(targetName);
          if (!target) {
            execResult = { ok: false, message: `الوكيل المستهدف «${targetName}» غير موجود` };
            finalStatus = "failed";
          } else if (!target.is_active) {
            execResult = { ok: false, message: `الوكيل «${targetName}» غير نشط` };
            finalStatus = "failed";
          } else {
            const r2 = await chatWithAgent(target, instruction, {
              userId: "rashed",
              userName: "العقل المدبّر",
              allowTools: true,
            });
            execResult = r2.error
              ? { ok: false, message: r2.reply }
              : { ok: true, message: r2.reply.slice(0, 600), data: { subActionId: r2.actionId } };
            finalStatus = execResult.ok ? "executed" : "failed";
          }
        }
      } else if (toolName) {
        // أداة: أعِد التحقق من صلاحية الوكيل على الخادم ثم نفّذ (مع/بدون تجاوز الخطوط الحمراء)
        if (!isToolAllowed(action.agent_name, toolName)) {
          execResult = { ok: false, message: `الوكيل «${action.agent_name || "?"}» غير مخوّل لاستخدام الأداة ${toolName}` };
          finalStatus = "failed";
        } else {
          execResult = await executeTool(toolName, action.input_data?.args || {}, { skipRedLines: force });
          finalStatus = execResult.ok ? "executed" : "failed";
        }
      }

      const noteLine = [
        notes ? `[مراجعة الأدمن]: ${notes}` : null,
        force && toolName ? `[تجاوز صريح]: وافق المالك على تنفيذ ${toolName} مع تجاوز الخطوط الحمراء (force).` : null,
        execResult ? `[التنفيذ]: ${execResult.ok ? "✅" : "❌"} ${execResult.message}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const r = await pool.query(
        `UPDATE ai_agent_actions
           SET status=$1, verified_by_ceo=true, verified_at=NOW(),
               output_data=$2::jsonb,
               description=COALESCE(description,'') || CASE WHEN $3::text <> '' THEN E'\n' || $3 ELSE '' END
         WHERE id=$4 RETURNING *`,
        [finalStatus, execResult ? JSON.stringify(execResult) : null, noteLine, id],
      );
      res.json({ ...r.rows[0], execResult });
    } catch (e: any) {
      res.status(500).json({ error: e?.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // العقل المدبّر (Mastermind) — إعدادات + تشغيل استراتيجية + لوحة الفريق
  // ═══════════════════════════════════════════════════════════════════════

  // 9. جلب إعدادات العقل المدبّر (مدموجة مع الافتراضي)
  app.get("/api/ai/mastermind/config", requireAdmin, async (_req, res) => {
    try {
      res.json(await loadMastermindConfig(true));
    } catch (e: any) {
      res.status(500).json({ error: e?.message });
    }
  });

  // 10. حفظ إعدادات العقل المدبّر (تحقق Zod ثم upsert + إبطال الكاش)
  app.put("/api/ai/mastermind/config", requireAdmin, async (req, res) => {
    try {
      const merged = mergeMastermindConfig(req.body);
      const parsed = mastermindConfigSchema.parse(merged);
      const value = JSON.stringify(parsed);
      await pool.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value=$2`,
        [MASTERMIND_CONFIG_SETTINGS_KEY, value],
      );
      invalidateMastermindConfigCache();
      res.json(parsed);
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ error: "إعداد غير صالح", details: e.errors });
      res.status(500).json({ error: e?.message });
    }
  });

  // 11. تشغيل الاستراتيجية — راشد يُصدر اقتراحات معلّقة (لا تنفيذ)
  app.post("/api/ai/mastermind/run-strategy", requireAdmin, async (req, res) => {
    try {
      const extraInstruction = req.body?.instruction ? String(req.body.instruction).slice(0, 1000) : undefined;
      const result = await runStrategy({ extraInstruction });
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e?.message || "تعذّر تشغيل الاستراتيجية" });
    }
  });

  // 12. لوحة الفريق الموحّدة — وكلاء AI + موظفون بشر + أقسام + إجراءات معلّقة
  app.get("/api/ai/mastermind/team", requireAdmin, async (_req, res) => {
    try {
      const cfg = await loadMastermindConfig(true);

      const agentsR = await pool.query(`
        SELECT a.id, a.name, a.display_name, a.role, a.model, a.provider, a.avatar_url, a.is_active,
               (SELECT COUNT(*)::int FROM ai_agent_actions WHERE agent_id=a.id AND status='pending') AS pending_actions,
               (SELECT COUNT(*)::int FROM ai_agent_actions WHERE agent_id=a.id AND created_at >= NOW() - INTERVAL '1 day') AS actions_24h
        FROM ai_agents a ORDER BY a.id
      `);

      let staff: any[] = [];
      try {
        const staffR = await pool.query(
          `SELECT id, full_name, phone, role
           FROM users
           WHERE role IS NOT NULL AND role NOT IN ('customer','marketer')
           ORDER BY role`,
        );
        staff = staffR.rows;
      } catch {
        staff = [];
      }

      const pendingR = await pool.query(`
        SELECT a.id, a.agent_id, ag.name AS agent_name, ag.display_name AS agent_display_name,
               a.action_type, a.title, a.description, a.input_data, a.created_at
        FROM ai_agent_actions a
        LEFT JOIN ai_agents ag ON ag.id = a.agent_id
        WHERE a.status='pending'
        ORDER BY a.created_at DESC LIMIT 100
      `);

      res.json({
        enabled: cfg.enabled,
        departments: cfg.departments,
        agents: agentsR.rows,
        staff,
        pending: pendingR.rows,
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message });
    }
  });
}
