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

  // 8. موافقة/رفض على إجراء
  app.post("/api/ai/actions/:id/approve", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const approved = !!req.body?.approved;
      const notes = req.body?.notes ? String(req.body.notes).slice(0, 500) : null;
      const status = approved ? "approved" : "rejected";
      const r = await pool.query(
        `UPDATE ai_agent_actions
           SET status=$1, verified_by_ceo=true, verified_at=NOW(),
               description=COALESCE(description,'') || CASE WHEN $2::text IS NOT NULL THEN E'\n[مراجعة الأدمن]: ' || $2 ELSE '' END
         WHERE id=$3 RETURNING *`,
        [status, notes, id],
      );
      if (!r.rows[0]) return res.status(404).json({ error: "الإجراء غير موجود" });
      res.json(r.rows[0]);
    } catch (e: any) {
      res.status(500).json({ error: e?.message });
    }
  });
}
