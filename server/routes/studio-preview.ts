/**
 * نقاط نهائية لـ وكيل المعاينة الاستوديو
 * AI Studio Preview API Routes
 */
import type { Express } from "express";
import {
  generateStudioPreview,
  generateQuickPreview,
  generateAlternatives,
  getPreviewLogs,
  getPreviewStats,
  getSettings,
  updateSettings,
} from "../studio-preview";

export function registerStudioPreviewRoutes(app: Express, requireAdmin: any) {
  // ─── حارس بسيط ضد الإفراط: حد لكل IP لحماية رصيد الذكاء الاصطناعي (في الذاكرة) ──
  const aiRateBuckets = new Map<string, number[]>();
  const AI_RATE_WINDOW_MS = 5 * 60 * 1000; // نافذة 5 دقائق
  const AI_RATE_MAX = 12; // أقصى عدد عمليات توليد لكل IP داخل النافذة
  function clientIp(req: any): string {
    // Express مضبوط على "trust proxy" => req.ip هو IP العميل الحقيقي عبر البروكسي الموثوق.
    // لا نقرأ x-forwarded-for يدوياً لأنه قابل للتزوير من العميل.
    return req.ip || req.socket?.remoteAddress || "unknown";
  }
  function aiRateLimited(req: any, cost = 1): { limited: boolean; retryAfter: number } {
    const ip = clientIp(req);
    const now = Date.now();
    const arr = (aiRateBuckets.get(ip) || []).filter((t) => now - t < AI_RATE_WINDOW_MS);
    if (arr.length + cost > AI_RATE_MAX) {
      aiRateBuckets.set(ip, arr);
      return { limited: true, retryAfter: Math.ceil((AI_RATE_WINDOW_MS - (now - arr[0])) / 1000) };
    }
    for (let i = 0; i < cost; i++) arr.push(now);
    aiRateBuckets.set(ip, arr);
    // كنس عرضي للمفاتيح القديمة حتى لا تنمو الذاكرة بلا حدود
    if (Math.random() < 0.02) {
      aiRateBuckets.forEach((v, k) => {
        const fresh = v.filter((t) => now - t < AI_RATE_WINDOW_MS);
        if (fresh.length === 0) aiRateBuckets.delete(k);
        else aiRateBuckets.set(k, fresh);
      });
    }
    return { limited: false, retryAfter: 0 };
  }
  function enforceAiRate(req: any, res: any, cost = 1): boolean {
    const rl = aiRateLimited(req, cost);
    if (rl.limited) {
      res.setHeader("Retry-After", String(rl.retryAfter));
      res.status(429).json({
        message: `لقد أنشأت عدداً كبيراً من المعاينات. حاول مجدداً بعد ${Math.ceil(rl.retryAfter / 60)} دقيقة.`,
        retryAfter: rl.retryAfter,
      });
      return false;
    }
    return true;
  }

  // ─── إنشاء معاينة استوديو (AI Studio) ──────────────────────────────────────
  app.post("/api/studio-preview/generate", async (req, res) => {
    if (!enforceAiRate(req, res)) return;
    try {
      const {
        productImageUrl,
        productImage,
        logoUrl,
        bagColor,
        printColor,
        textContent,
        businessType,
        productId,
        productName,
        altIndex,
      } = req.body || {};

      const finalProductImage = productImageUrl || productImage;
      if (!finalProductImage || !logoUrl) {
        return res.status(400).json({ message: "صورة المنتج والشعار مطلوبان" });
      }

      const userId = (req as any).user?.claims?.sub || (req as any).user?.id || null;
      const result = await generateStudioPreview({
        productImageUrl: finalProductImage,
        logoUrl,
        bagColor,
        printColor,
        textContent,
        businessType: businessType || "محل",
        userId,
        productId,
        productName,
        altIndex,
      });

      res.json({
        success: true,
        imageUrl: result.imageUrl,
        modelUsed: result.modelUsed,
        timeMs: result.timeMs,
        wasCached: result.wasCached,
        recommendation: result.recommendation,
      });
    } catch (e: any) {
      console.error("[Studio Preview] فشل التوليد:", e?.message);
      res.status(500).json({ message: "فشل توليد المعاينة", details: e?.message });
    }
  });

  // ─── معاينة سريعة مجانية عبر Cloudinary overlay ────────────────────────────────
  app.post("/api/studio-preview/quick", async (req, res) => {
    try {
      const { productImageUrl, productImage, logoUrl, bagColor, printColor, textContent } = req.body || {};
      const finalProductImage = productImageUrl || productImage;
      if (!finalProductImage || !logoUrl) {
        return res.status(400).json({ message: "صورة المنتج والشعار مطلوبان" });
      }
      const result = await generateQuickPreview({
        productImageUrl: finalProductImage,
        logoUrl,
        bagColor,
        printColor,
        textContent,
      });
      res.json({ success: true, imageUrl: result.url });
    } catch (e: any) {
      res.status(500).json({ message: "فشل المعاينة السريعة", details: e?.message });
    }
  });

  // ─── توليد 3 تصاميم بديلة ────────────────────────────────────────────────────────────────────────
  app.post("/api/studio-preview/alternatives", async (req, res) => {
    if (!enforceAiRate(req, res, 3)) return; // يولّد 3 صور => يستهلك 3 حصص
    try {
      const {
        productImageUrl,
        productImage,
        logoUrl,
        bagColor,
        printColor,
        textContent,
        businessType,
        productId,
        productName,
      } = req.body || {};
      const finalProductImage = productImageUrl || productImage;
      if (!finalProductImage || !logoUrl) {
        return res.status(400).json({ message: "صورة المنتج والشعار مطلوبان" });
      }
      const userId = (req as any).user?.claims?.sub || (req as any).user?.id || null;
      const result = await generateAlternatives({
        productImageUrl: finalProductImage,
        logoUrl,
        bagColor,
        printColor,
        textContent,
        businessType: businessType || "محل",
        userId,
        productId,
        productName,
      });
      const alternatives = result.urls.map((url: string, i: number) => ({
        imageUrl: url,
        modelUsed: result.models?.[i],
        timeMs: result.times?.[i],
      }));
      res.json({ success: true, alternatives });
    } catch (e: any) {
      res.status(500).json({ message: "فشل توليد التصاميم البديلة", details: e?.message });
    }
  });

  // ─── Admin: جلب السجلات ───────────────────────────────────────────────────────────────────────────────
  app.get("/api/admin/studio-preview/logs", requireAdmin, async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit || 50), 200);
      const offset = Math.max(Number(req.query.offset || 0), 0);
      const logs = await getPreviewLogs(limit, offset);
      res.json(logs);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب السجلات", details: e?.message });
    }
  });

  // ─── Admin: إحصائيات ────────────────────────────────────────────────────────────────────────────────────────────────
  app.get("/api/admin/studio-preview/stats", requireAdmin, async (_req, res) => {
    try {
      const stats = await getPreviewStats();
      res.json(stats);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب الإحصائيات", details: e?.message });
    }
  });

  // ─── Admin: الإعدادات ─────────────────────────────────────────────────────────────────────────────────────────────
  app.get("/api/admin/studio-preview/settings", requireAdmin, async (_req, res) => {
    try {
      const s = await getSettings();
      res.json(s);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب الإعدادات", details: e?.message });
    }
  });

  app.put("/api/admin/studio-preview/settings", requireAdmin, async (req, res) => {
    try {
      await updateSettings(req.body);
      const s = await getSettings();
      res.json(s);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث الإعدادات", details: e?.message });
    }
  });
}
