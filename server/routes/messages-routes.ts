/**
 * مسارات نظام الرسائل — لوحة الإدارة + العميل + المورد + بوت تلجرام
 */
import type { Express } from "express";
import {
  listConversations, getConversation, getMessages, sendMessage,
  findOrCreateConversation, markAdminRead, setConversationStatus,
  getAdminUnreadTotal, generateSupplierLinkCode, findSupplierByLinkCode,
  setSupplierTelegramChatId,
} from "../lib/messaging";
import { db } from "../db";
import { suppliers, conversations as conversationsTable } from "@shared/schema";
import { eq } from "drizzle-orm";

export function registerMessagingRoutes(app: Express, requireAdmin: any) {

  // ─── لوحة الإدارة: قائمة المحادثات + التفاصيل ─────────────────────────────
  app.get("/api/admin/conversations", requireAdmin, async (req, res) => {
    try {
      const { type, status, search, supplierId, customerPhone } = req.query as any;
      const rows = await listConversations({
        type: type || undefined,
        status: status || undefined,
        supplierId: supplierId ? Number(supplierId) : undefined,
        customerPhone: customerPhone || undefined,
        search: search || undefined,
      });
      res.json(rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/admin/conversations/unread-total", requireAdmin, async (_req, res) => {
    try {
      const r = await getAdminUnreadTotal();
      res.json(r);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/admin/conversations/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const conv = await getConversation(id);
      if (!conv) return res.status(404).json({ message: "Not found" });
      const msgs = await getMessages(id);
      // علّم كمقروءة عند الفتح
      await markAdminRead(id);
      res.json({ conversation: conv, messages: msgs });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/admin/conversations", requireAdmin, async (req, res) => {
    try {
      const { type, customerPhone, customerName, supplierId, relatedOrderId, relatedProductId, subject, initialMessage } = req.body || {};
      if (!type || !["customer", "supplier", "internal"].includes(type)) {
        return res.status(400).json({ message: "نوع المحادثة غير صحيح" });
      }
      const conv = await findOrCreateConversation({ type, customerPhone, customerName, supplierId, relatedOrderId, relatedProductId, subject });
      if (initialMessage) {
        await sendMessage({ conversationId: conv.id, senderType: "admin", senderName: (req as any).user?.username || "إدارة", content: initialMessage });
      }
      res.json(conv);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // إرسال رسالة من الإدارة
  app.post("/api/admin/conversations/:id/messages", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { content, attachments } = req.body || {};
      if (!content?.trim()) return res.status(400).json({ message: "الرسالة فارغة" });
      const msg = await sendMessage({
        conversationId: id, senderType: "admin",
        senderName: (req as any).user?.username || "إدارة",
        content: content.trim(), attachments,
      });
      res.json(msg);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/admin/conversations/:id/status", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { status } = req.body || {};
      if (!["open", "closed", "archived"].includes(status)) return res.status(400).json({ message: "حالة غير صحيحة" });
      await setConversationStatus(id, status);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // توليد كود ربط تلجرام للمورد
  app.post("/api/admin/suppliers/:id/telegram-link", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const code = await generateSupplierLinkCode(id);
      const botUser = process.env.TELEGRAM_BOT_USERNAME;
      const url = botUser ? `https://t.me/${botUser.replace(/^@/, "")}?start=${code}` : null;
      res.json({ code, url, instructions: `أرسل للمورد هذا الرابط ليربط تلجرامه. أو يكتب في البوت: /start ${code}` });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/admin/suppliers/:id/telegram-link", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await db.update(suppliers).set({ telegramChatId: null, telegramLinkCode: null } as any).where(eq(suppliers.id, id));
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── عميل (بدون مصادقة — يُعرّف بالهاتف) ──────────────────────────────────
  app.post("/api/customer/conversations", async (req, res) => {
    try {
      const { customerPhone, customerName, relatedOrderId, relatedProductId, content } = req.body || {};
      if (!customerPhone || !content?.trim()) return res.status(400).json({ message: "الهاتف والرسالة مطلوبان" });
      const conv = await findOrCreateConversation({
        type: "customer", customerPhone, customerName,
        relatedOrderId: relatedOrderId ? Number(relatedOrderId) : undefined,
        relatedProductId: relatedProductId ? Number(relatedProductId) : undefined,
      });
      const msg = await sendMessage({
        conversationId: conv.id, senderType: "customer",
        senderName: customerName || customerPhone, content: content.trim(),
      });
      // إشعار للموظفين
      try {
        const { notifyStaff } = await import("../lib/staff-notify");
        await notifyStaff({
          type: "customer_message",
          title: "رسالة جديدة من عميل",
          body: `${customerName || customerPhone}: ${content.slice(0, 100)}`,
          telegramText: `💬 <b>رسالة جديدة من عميل</b>\n👤 ${customerName || customerPhone}\n${content.slice(0, 200)}`,
        } as any);
      } catch {}
      res.json({ conversation: conv, message: msg });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // العميل يجلب محادثاته (بهاتفه)
  app.get("/api/customer/conversations", async (req, res) => {
    try {
      const phone = req.query.phone as string;
      if (!phone) return res.status(400).json({ message: "phone مطلوب" });
      const rows = await listConversations({ type: "customer", customerPhone: phone });
      res.json(rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/customer/conversations/:id/messages", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const phone = req.query.phone as string;
      const conv = await getConversation(id);
      if (!conv) return res.status(404).json({ message: "Not found" });
      // تحقق بسيط: الهاتف يطابق
      if (conv.customerPhone !== phone) return res.status(403).json({ message: "غير مسموح" });
      const msgs = await getMessages(id);
      res.json(msgs);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── إعداد webhook تلجرام مع API الخاص بتلجرام ────────────────────────────
  // POST /api/admin/telegram/setup-webhook { url }
  app.post("/api/admin/telegram/setup-webhook", requireAdmin, async (req, res) => {
    try {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) return res.status(400).json({ message: "TELEGRAM_BOT_TOKEN غير مُعرَّف" });
      const baseUrl = (req.body?.url as string)?.replace(/\/$/, "") || `${req.protocol}://${req.get("host")}`;
      const webhookUrl = `${baseUrl}/api/telegram/webhook`;
      const secret = process.env.TELEGRAM_WEBHOOK_SECRET || undefined;
      const params: any = { url: webhookUrl, allowed_updates: ["message"] };
      if (secret) params.secret_token = secret;
      const r = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const json = await r.json();
      if (!json.ok) return res.status(500).json({ message: "فشل تسجيل webhook", details: json });
      res.json({ ok: true, webhookUrl, telegramResponse: json });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/admin/telegram/webhook-info", requireAdmin, async (_req, res) => {
    try {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) return res.status(400).json({ message: "TELEGRAM_BOT_TOKEN غير مُعرَّف" });
      const r = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
      res.json(await r.json());
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // قائمة الموردين مع حالة ربط تلجرام (للوحة الإدارة)
  app.get("/api/admin/suppliers/telegram-status", requireAdmin, async (_req, res) => {
    try {
      const rows = await db.select({
        id: suppliers.id, name: suppliers.name, phone: suppliers.phone,
        telegramChatId: suppliers.telegramChatId, telegramLinkCode: suppliers.telegramLinkCode,
      }).from(suppliers);
      res.json(rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── webhook تلجرام (يستقبل ردود الموردين) ────────────────────────────────
  app.post("/api/telegram/webhook", async (req, res) => {
    try {
      // التحقق من توكن السر (إن أُعدّ) — يحمي من تزوير الردود
      const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
      if (expectedSecret) {
        const got = req.header("X-Telegram-Bot-Api-Secret-Token");
        if (got !== expectedSecret) return res.status(401).json({ ok: false });
      }
      const update = req.body;
      const msg = update?.message;
      if (!msg) return res.json({ ok: true });
      const chatId = String(msg.chat?.id || "");
      const text = String(msg.text || "").trim();
      const senderName = msg.from?.first_name || msg.from?.username || "تلجرام";
      if (!chatId || !text) return res.json({ ok: true });

      // /start <code> — ربط مورد
      if (text.startsWith("/start ")) {
        const code = text.slice(7).trim();
        const sup = await findSupplierByLinkCode(code);
        if (sup) {
          await setSupplierTelegramChatId(sup.id, chatId);
          const { sendTelegramMessage } = await import("../lib/telegram");
          await sendTelegramMessage(`✅ تم ربط حسابك بنجاح يا ${sup.name}.\nستصلك جميع الإشعارات والرسائل هنا.\nأوامر متاحة:\n/orders — طلباتي\n/reply <رقم_المحادثة> <نص> — للرد على محادثة`, chatId);
        } else {
          const { sendTelegramMessage } = await import("../lib/telegram");
          await sendTelegramMessage("❌ كود غير صحيح أو منتهي. اطلب من الإدارة كوداً جديداً.", chatId);
        }
        return res.json({ ok: true });
      }

      // /reply <id> <text>
      if (text.startsWith("/reply ")) {
        const m = text.match(/^\/reply\s+(\d+)\s+([\s\S]+)$/);
        if (!m) {
          const { sendTelegramMessage } = await import("../lib/telegram");
          await sendTelegramMessage("صيغة خاطئة. مثال:\n/reply 12 جاهز للشحن", chatId);
          return res.json({ ok: true });
        }
        const convId = Number(m[1]); const content = m[2];
        const conv = await getConversation(convId);
        if (!conv) return res.json({ ok: true });
        // تحقق: المرسل هو نفس المورد
        const [sup] = await db.select().from(suppliers).where(eq(suppliers.telegramChatId, chatId));
        if (!sup || sup.id !== conv.supplierId) {
          const { sendTelegramMessage } = await import("../lib/telegram");
          await sendTelegramMessage("❌ ليست محادثتك.", chatId);
          return res.json({ ok: true });
        }
        await sendMessage({
          conversationId: convId, senderType: "supplier",
          senderName: sup.name, content, channel: "telegram",
          metadata: { telegram_message_id: msg.message_id },
          skipExternalDelivery: true,
        });
        const { sendTelegramMessage } = await import("../lib/telegram");
        await sendTelegramMessage("✅ تم إرسال ردك للإدارة.", chatId);
        return res.json({ ok: true });
      }

      // /orders — قائمة آخر محادثات المورد المربوطة بطلبات
      if (text === "/orders") {
        const [sup] = await db.select().from(suppliers).where(eq(suppliers.telegramChatId, chatId));
        const { sendTelegramMessage } = await import("../lib/telegram");
        if (!sup) { await sendTelegramMessage("❌ غير مربوط. استخدم /start <code>", chatId); return res.json({ ok: true }); }
        const convs = await listConversations({ type: "supplier", supplierId: sup.id, status: "open", limit: 10 });
        if (!convs.length) { await sendTelegramMessage("لا توجد محادثات مفتوحة.", chatId); return res.json({ ok: true }); }
        const list = convs.map(c => `• محادثة #${c.id}${c.relatedOrderId ? ` (طلب ${c.relatedOrderId})` : ""} — ${c.lastMessagePreview || "—"}`).join("\n");
        await sendTelegramMessage(`📋 <b>محادثاتك المفتوحة:</b>\n\n${list}\n\nللرد: /reply ${convs[0].id} رسالتك`, chatId);
        return res.json({ ok: true });
      }

      // رسالة حرة من مورد مربوط — نحفظها في آخر محادثة مفتوحة له
      const [sup] = await db.select().from(suppliers).where(eq(suppliers.telegramChatId, chatId));
      if (sup) {
        const convs = await listConversations({ type: "supplier", supplierId: sup.id, status: "open", limit: 1 });
        if (convs.length) {
          await sendMessage({
            conversationId: convs[0].id, senderType: "supplier",
            senderName: sup.name, content: text, channel: "telegram",
            skipExternalDelivery: true,
          });
          const { sendTelegramMessage } = await import("../lib/telegram");
          await sendTelegramMessage("✅ تم تسجيل رسالتك.", chatId);
        } else {
          const { sendTelegramMessage } = await import("../lib/telegram");
          await sendTelegramMessage("لا توجد محادثة مفتوحة. استخدم /reply <id> <نص>", chatId);
        }
      }
      res.json({ ok: true });
    } catch (e: any) {
      console.error("[telegram webhook]", e);
      res.json({ ok: true });
    }
  });
}
