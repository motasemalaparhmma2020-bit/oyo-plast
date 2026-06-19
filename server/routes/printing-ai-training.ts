/**
 * لوحة تدريب وكيل الطباعة المتخصص — API Routes
 * Admin-protected CRUD + Cloudinary image upload + context builder
 */
import type { Express } from "express";
import { pool } from "../db";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export type TrainingType = "system_instruction" | "reference_item" | "rule" | "faq" | "preference";

export const TRAINING_TYPE_LABELS: Record<TrainingType, string> = {
  system_instruction: "تعليمات النظام",
  reference_item: "مثال مرجعي",
  rule: "قاعدة",
  faq: "سؤال وجواب",
  preference: "تفضيل",
};

// ─── بناء سياق التدريب (يُستخدم في system prompt) ──────────────────────────
export async function buildTrainingContext(): Promise<string> {
  try {
    const r = await pool.query(
      `SELECT type, title, content, image_url
       FROM printing_ai_training
       WHERE is_active = true
       ORDER BY type, sort_order ASC, id ASC`
    );
    if (!r.rows.length) return "";

    const grouped: Record<string, typeof r.rows> = {};
    for (const row of r.rows) {
      if (!grouped[row.type]) grouped[row.type] = [];
      grouped[row.type].push(row);
    }

    const parts: string[] = [];

    if (grouped["system_instruction"]?.length) {
      parts.push(`## تعليمات خاصة من المدير:\n${grouped["system_instruction"].map(i => `- **${i.title}**: ${i.content}`).join("\n")}`);
    }
    if (grouped["rule"]?.length) {
      parts.push(`## قواعد يجب اتباعها:\n${grouped["rule"].map(i => `- ${i.title}: ${i.content}`).join("\n")}`);
    }
    if (grouped["preference"]?.length) {
      parts.push(`## تفضيلات العملاء الشائعة:\n${grouped["preference"].map(i => `- ${i.title}: ${i.content}`).join("\n")}`);
    }
    if (grouped["faq"]?.length) {
      parts.push(`## أسئلة وأجوبة شائعة:\n${grouped["faq"].map(i => `س: ${i.title}\nج: ${i.content}`).join("\n\n")}`);
    }
    if (grouped["reference_item"]?.length) {
      parts.push(`## أمثلة مرجعية ناجحة:\n${grouped["reference_item"].map(i => `- ${i.title}: ${i.content}${i.image_url ? ` [صورة مرجعية]` : ""}`).join("\n")}`);
    }

    return parts.length ? `\n\n## معلومات إضافية من تدريب الوكيل:\n${parts.join("\n\n")}` : "";
  } catch (e: any) {
    console.warn("[PrintingAI Training] buildTrainingContext error:", e?.message);
    return "";
  }
}

export function registerPrintingAITrainingRoutes(app: Express, requireAdmin: any) {
  // ─── GET all training items ──────────────────────────────────────────────
  app.get("/api/admin/printing-ai/training", requireAdmin, async (req, res) => {
    try {
      const type = req.query.type as string | undefined;
      const query = type
        ? `SELECT * FROM printing_ai_training WHERE type = $1 ORDER BY sort_order ASC, id ASC`
        : `SELECT * FROM printing_ai_training ORDER BY type ASC, sort_order ASC, id ASC`;
      const r = await pool.query(query, type ? [type] : []);
      res.json({ items: r.rows, total: r.rows.length });
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب بيانات التدريب", error: e?.message });
    }
  });

  // ─── GET stats ───────────────────────────────────────────────────────────
  app.get("/api/admin/printing-ai/training/stats", requireAdmin, async (req, res) => {
    try {
      const r = await pool.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE is_active = true)::int AS active,
          COUNT(*) FILTER (WHERE type = 'system_instruction')::int AS system_instructions,
          COUNT(*) FILTER (WHERE type = 'rule')::int AS rules,
          COUNT(*) FILTER (WHERE type = 'faq')::int AS faqs,
          COUNT(*) FILTER (WHERE type = 'reference_item')::int AS reference_items,
          COUNT(*) FILTER (WHERE type = 'preference')::int AS preferences
        FROM printing_ai_training
      `);
      res.json(r.rows[0] || {});
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب الإحصائيات", error: e?.message });
    }
  });

  // ─── GET context preview (what gets injected into system prompt) ─────────
  app.get("/api/admin/printing-ai/training/context-preview", requireAdmin, async (req, res) => {
    try {
      const context = await buildTrainingContext();
      res.json({ context, charCount: context.length });
    } catch (e: any) {
      res.status(500).json({ message: "فشل بناء السياق", error: e?.message });
    }
  });

  // ─── POST create training item ───────────────────────────────────────────
  app.post("/api/admin/printing-ai/training", requireAdmin, async (req, res) => {
    try {
      const { type, title, content, image_url, is_active, sort_order } = req.body || {};
      if (!type || !title || !content) {
        return res.status(400).json({ message: "النوع والعنوان والمحتوى مطلوبة" });
      }
      const r = await pool.query(
        `INSERT INTO printing_ai_training (type, title, content, image_url, is_active, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [type, title.trim(), content.trim(), image_url || null, is_active !== false, Number(sort_order ?? 0)]
      );
      res.json({ success: true, item: r.rows[0] });
    } catch (e: any) {
      res.status(500).json({ message: "فشل إنشاء عنصر التدريب", error: e?.message });
    }
  });

  // ─── PATCH update training item ──────────────────────────────────────────
  app.patch("/api/admin/printing-ai/training/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { type, title, content, image_url, is_active, sort_order } = req.body || {};
      const r = await pool.query(
        `UPDATE printing_ai_training
         SET type = COALESCE($1, type),
             title = COALESCE($2, title),
             content = COALESCE($3, content),
             image_url = $4,
             is_active = COALESCE($5, is_active),
             sort_order = COALESCE($6, sort_order),
             updated_at = NOW()
         WHERE id = $7 RETURNING *`,
        [type || null, title?.trim() || null, content?.trim() || null,
         image_url !== undefined ? (image_url || null) : undefined,
         is_active !== undefined ? is_active : null,
         sort_order !== undefined ? Number(sort_order) : null, id]
      );
      if (!r.rows.length) return res.status(404).json({ message: "العنصر غير موجود" });
      res.json({ success: true, item: r.rows[0] });
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث عنصر التدريب", error: e?.message });
    }
  });

  // ─── DELETE training item ─────────────────────────────────────────────────
  app.delete("/api/admin/printing-ai/training/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await pool.query(`DELETE FROM printing_ai_training WHERE id = $1`, [id]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: "فشل حذف عنصر التدريب", error: e?.message });
    }
  });

  // ─── POST upload reference image to Cloudinary ───────────────────────────
  app.post("/api/admin/printing-ai/training/upload-image", requireAdmin, upload.single("image"), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "لم يتم رفع صورة" });
    try {
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;
      if (cloudName && apiKey && apiSecret) {
        const { v2: cloudinary } = await import("cloudinary");
        cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
        const uploadRes: any = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "oyo-plast/printing-training", resource_type: "image",
              transformation: [{ quality: "auto:good", fetch_format: "auto", width: 800, crop: "limit" }] },
            (err: any, result: any) => err ? reject(err) : resolve(result)
          );
          stream.end(req.file!.buffer);
        });
        return res.json({ imageUrl: uploadRes.secure_url, publicId: uploadRes.public_id });
      }
      // Fallback base64
      const base64 = req.file.buffer.toString("base64");
      res.json({ imageUrl: `data:${req.file.mimetype};base64,${base64}` });
    } catch (e: any) {
      res.status(500).json({ message: "فشل رفع الصورة", error: e?.message });
    }
  });

  // ─── POST test agent with current training ──────────────────────────────
  app.post("/api/admin/printing-ai/training/test", requireAdmin, async (req, res) => {
    try {
      const { message } = req.body || {};
      if (!message) return res.status(400).json({ message: "الرسالة مطلوبة" });
      const { handlePrintingChat } = await import("../printing-ai");
      const result = await handlePrintingChat({ message, history: [] });
      res.json({ reply: result.reply, action: result.action });
    } catch (e: any) {
      res.status(500).json({ message: "فشل اختبار الوكيل", error: e?.message });
    }
  });

  // ─── POST bulk reorder (sort_order update) ────────────────────────────────
  app.post("/api/admin/printing-ai/training/reorder", requireAdmin, async (req, res) => {
    try {
      const { ids } = req.body || {};
      if (!Array.isArray(ids)) return res.status(400).json({ message: "ids مطلوب" });
      for (let i = 0; i < ids.length; i++) {
        await pool.query(`UPDATE printing_ai_training SET sort_order = $1 WHERE id = $2`, [i, ids[i]]);
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: "فشل إعادة الترتيب", error: e?.message });
    }
  });
}
