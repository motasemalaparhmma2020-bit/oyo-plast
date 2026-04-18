/**
 * نظام الرسائل الموحّد — وحدة الوصول لقاعدة البيانات
 * يخدم 3 أنواع من المحادثات: عملاء، موردين، داخلي
 */
import { db } from "../db";
import { conversations, messages, suppliers, type Conversation, type Message, type InsertMessage } from "@shared/schema";
import { and, desc, eq, sql, or, isNull } from "drizzle-orm";

export type ConversationType = "customer" | "supplier" | "internal";
export type SenderType = "admin" | "customer" | "supplier" | "system" | "bot";
export type Channel = "web" | "telegram" | "sms";

export interface ListFilters {
  type?: ConversationType;
  status?: "open" | "closed" | "archived";
  supplierId?: number;
  customerPhone?: string;
  search?: string;
  limit?: number;
}

export async function listConversations(filters: ListFilters = {}): Promise<Conversation[]> {
  const conds: any[] = [];
  if (filters.type) conds.push(eq(conversations.type, filters.type));
  if (filters.status) conds.push(eq(conversations.status, filters.status));
  if (filters.supplierId) conds.push(eq(conversations.supplierId, filters.supplierId));
  if (filters.customerPhone) conds.push(eq(conversations.customerPhone, filters.customerPhone));
  if (filters.search) {
    conds.push(or(
      sql`${conversations.customerName} ILIKE ${'%' + filters.search + '%'}`,
      sql`${conversations.customerPhone} ILIKE ${'%' + filters.search + '%'}`,
      sql`${conversations.subject} ILIKE ${'%' + filters.search + '%'}`,
      sql`${conversations.lastMessagePreview} ILIKE ${'%' + filters.search + '%'}`,
    ));
  }
  const q = db.select().from(conversations);
  const rows = conds.length
    ? await q.where(and(...conds)).orderBy(desc(conversations.lastMessageAt)).limit(filters.limit || 100)
    : await q.orderBy(desc(conversations.lastMessageAt)).limit(filters.limit || 100);
  return rows;
}

export async function getConversation(id: number): Promise<Conversation | undefined> {
  const [row] = await db.select().from(conversations).where(eq(conversations.id, id));
  return row;
}

export async function getMessages(conversationId: number, limit = 200): Promise<Message[]> {
  return await db.select().from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt)
    .limit(limit);
}

/** إنشاء محادثة جديدة أو استرجاع المفتوحة الموجودة */
export async function findOrCreateConversation(params: {
  type: ConversationType;
  customerPhone?: string;
  customerName?: string;
  supplierId?: number;
  relatedOrderId?: number;
  relatedProductId?: number;
  subject?: string;
}): Promise<Conversation> {
  // ابحث عن محادثة مفتوحة بنفس الأطراف
  const conds: any[] = [eq(conversations.type, params.type), eq(conversations.status, "open")];
  if (params.type === "customer" && params.customerPhone) {
    conds.push(eq(conversations.customerPhone, params.customerPhone));
    if (params.relatedOrderId) conds.push(eq(conversations.relatedOrderId, params.relatedOrderId));
  }
  if (params.type === "supplier" && params.supplierId) {
    conds.push(eq(conversations.supplierId, params.supplierId));
    if (params.relatedOrderId) conds.push(eq(conversations.relatedOrderId, params.relatedOrderId));
  }
  const [existing] = await db.select().from(conversations).where(and(...conds)).orderBy(desc(conversations.lastMessageAt)).limit(1);
  if (existing) return existing;
  const [row] = await db.insert(conversations).values({
    type: params.type,
    subject: params.subject,
    customerPhone: params.customerPhone,
    customerName: params.customerName,
    supplierId: params.supplierId,
    relatedOrderId: params.relatedOrderId,
    relatedProductId: params.relatedProductId,
  }).returning();
  return row;
}

/** أرسل رسالة + حدّث المحادثة + ادفعها للقناة الخارجية إن وجدت */
export async function sendMessage(params: {
  conversationId: number;
  senderType: SenderType;
  senderName?: string;
  content: string;
  attachments?: any;
  channel?: Channel;
  metadata?: any;
  skipExternalDelivery?: boolean;
}): Promise<Message> {
  const channel = params.channel || "web";
  const [msg] = await db.insert(messages).values({
    conversationId: params.conversationId,
    senderType: params.senderType,
    senderName: params.senderName,
    content: params.content,
    attachments: params.attachments,
    channel,
    metadata: params.metadata,
  }).returning();

  const preview = params.content.slice(0, 120);
  const incrementAdmin = params.senderType !== "admin" && params.senderType !== "system" ? 1 : 0;
  const incrementParticipant = params.senderType === "admin" ? 1 : 0;

  await db.update(conversations).set({
    lastMessageAt: new Date(),
    lastMessagePreview: preview,
    unreadAdmin: sql`${conversations.unreadAdmin} + ${incrementAdmin}`,
    unreadParticipant: sql`${conversations.unreadParticipant} + ${incrementParticipant}`,
  }).where(eq(conversations.id, params.conversationId));

  // إيصال للقناة الخارجية (تلجرام للمورد، SMS للعميل)
  if (!params.skipExternalDelivery && params.senderType === "admin") {
    const conv = await getConversation(params.conversationId);
    if (conv) {
      try { await deliverToExternalChannel(conv, msg); }
      catch (e: any) { console.error("[messaging] external delivery failed:", e.message); }
    }
  }
  return msg;
}

/** إيصال الرسائل للقنوات الخارجية حسب نوع المحادثة */
async function deliverToExternalChannel(conv: Conversation, msg: Message): Promise<void> {
  if (conv.type === "supplier" && conv.supplierId) {
    const [sup] = await db.select().from(suppliers).where(eq(suppliers.id, conv.supplierId));
    if (sup?.telegramChatId) {
      const { sendTelegramMessage } = await import("./telegram");
      const orderTag = conv.relatedOrderId ? ` (طلب #${conv.relatedOrderId})` : "";
      const text = `💬 <b>رسالة من الإدارة${orderTag}</b>\n\n${msg.content}\n\nللرد: اكتب /reply ${conv.id} ثم رسالتك`;
      await sendTelegramMessage(text, sup.telegramChatId);
      await db.update(messages).set({ deliveryStatus: "delivered", channel: "telegram" }).where(eq(messages.id, msg.id));
    }
  }
  // واتساب للعميل (UltraMSG عبر whatsapp.ts)
  if (conv.type === "customer" && conv.customerPhone) {
    try {
      const { sendWhatsAppMessage } = await import("./whatsapp");
      const orderTag = conv.relatedOrderId ? ` (طلب #${conv.relatedOrderId})` : "";
      const r = await sendWhatsAppMessage(conv.customerPhone, `أويو بلاست${orderTag}:\n${msg.content}`, conv.relatedOrderId || undefined);
      if (r.success) await db.update(messages).set({ deliveryStatus: "delivered", channel: "sms" }).where(eq(messages.id, msg.id));
    } catch (e: any) {
      console.error("[messaging] WhatsApp delivery failed:", e.message);
    }
  }
}

/** صفّر عدّاد غير المقروء للإدارة */
export async function markAdminRead(conversationId: number): Promise<void> {
  await db.update(conversations).set({ unreadAdmin: 0 }).where(eq(conversations.id, conversationId));
}

export async function markParticipantRead(conversationId: number): Promise<void> {
  await db.update(conversations).set({ unreadParticipant: 0 }).where(eq(conversations.id, conversationId));
}

export async function setConversationStatus(id: number, status: "open" | "closed" | "archived"): Promise<void> {
  await db.update(conversations).set({ status }).where(eq(conversations.id, id));
}

/** إجمالي عدد الرسائل غير المقروءة عبر جميع المحادثات (لشارة لوحة الإدارة) */
export async function getAdminUnreadTotal(): Promise<{ total: number; byType: Record<string, number> }> {
  const rows = await db.select({
    type: conversations.type,
    total: sql<number>`SUM(${conversations.unreadAdmin})::int`,
  }).from(conversations).where(eq(conversations.status, "open")).groupBy(conversations.type);
  const byType: Record<string, number> = { customer: 0, supplier: 0, internal: 0 };
  let total = 0;
  for (const r of rows) {
    byType[r.type] = Number(r.total) || 0;
    total += byType[r.type];
  }
  return { total, byType };
}

/** ابحث عن مورد بكود الربط (للتلجرام /start <code>) */
export async function findSupplierByLinkCode(code: string) {
  const [sup] = await db.select().from(suppliers).where(eq(suppliers.telegramLinkCode, code));
  return sup;
}

export async function setSupplierTelegramChatId(supplierId: number, chatId: string): Promise<void> {
  await db.update(suppliers).set({ telegramChatId: chatId, telegramLinkCode: null }).where(eq(suppliers.id, supplierId));
}

export async function generateSupplierLinkCode(supplierId: number): Promise<string> {
  const code = Math.random().toString(36).slice(2, 10);
  await db.update(suppliers).set({ telegramLinkCode: code }).where(eq(suppliers.id, supplierId));
  return code;
}
