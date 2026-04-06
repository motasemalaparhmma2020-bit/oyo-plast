import { logEvent, logNotificationAttempt } from "./logger";

interface WhatsAppMessage {
  to: string;
  message: string;
  orderId?: number;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Store failed messages for retry (max 48 hours)
interface FailedMessage extends WhatsAppMessage {
  timestamp: number;
  attempts: number;
  maxAttempts: number;
}

const failedMessages: FailedMessage[] = [];
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MESSAGE_EXPIRY_MS = 48 * 60 * 60 * 1000; // 48 hours

export async function sendWhatsAppMessage(
  to: string,
  message: string,
  orderId?: number
): Promise<SendResult> {
  const error = "WhatsApp notifications are disabled";
  logNotificationAttempt(orderId || 0, "whatsapp", to, "failed");
  return { success: false, error };
}

/**
 * Send order confirmation to customer
 */
export async function sendOrderConfirmation(
  customerPhone: string,
  orderId: number,
  orderTotal: number,
  currency: string
): Promise<SendResult> {
  const message = `
🎉 تم استقبال طلبك برقم: #${orderId}
━━━━━━━━━━━━━━━━━━━━━
💰 الإجمالي: ${orderTotal.toLocaleString()} ${currency}
📍 سيتم التواصل معك للتأكيد

👇 تتبع طلبك:
https://oyoplast.com/order-tracking/${orderId}
━━━━━━━━━━━━━━━━━━━━━
شكراً لتسوقك معنا! 🛍️
  `.trim();

  return sendWhatsAppMessage(customerPhone, message, orderId);
}

/**
 * Send admin notification
 */
export async function sendAdminNotification(
  orderId: number,
  customerName: string,
  customerPhone: string,
  orderTotal: number,
  itemsCount: number
): Promise<SendResult> {
  const adminPhone = process.env.ADMIN_PHONE;

  if (!adminPhone) {
    logEvent(
      "Admin phone not configured",
      "warn",
      { orderId },
      undefined
    );
    return { success: false, error: "Admin phone not configured" };
  }

  const message = `
📦 طلب جديد!
━━━━━━━━━━━━━━━━━━━━━
🆔 الطلب: #${orderId}
👤 العميل: ${customerName}
📱 الهاتف: ${customerPhone}
📊 عدد المنتجات: ${itemsCount}
💰 الإجمالي: ${orderTotal}
⏰ الوقت: ${new Date().toLocaleString("ar-YE")}
━━━━━━━━━━━━━━━━━━━━━
  `.trim();

  return sendWhatsAppMessage(adminPhone, message, orderId);
}

/**
 * Send payment reminder
 */
export async function sendPaymentReminder(
  customerPhone: string,
  orderId: number,
  amount: number
): Promise<SendResult> {
  const message = `
⏰ تذكير بالدفع
━━━━━━━━━━━━━━━━━━━━━
الطلب رقم: #${orderId}
المبلغ المتبقي: ${amount}
⏱️ الموعد النهائي: 48 ساعة

👇 تفاصيل التحويل:
https://oyoplast.com/order/${orderId}
━━━━━━━━━━━━━━━━━━━━━
  `.trim();

  return sendWhatsAppMessage(customerPhone, message, orderId);
}

/**
 * Send shipment notification
 */
export async function sendShipmentNotification(
  customerPhone: string,
  orderId: number,
  trackingNumber: string
): Promise<SendResult> {
  const message = `
🚚 تم شحن طلبك!
━━━━━━━━━━━━━━━━━━━━━
الطلب رقم: #${orderId}
رقم التتبع: ${trackingNumber}

👇 تتبع الشحنة:
https://oyoplast.com/order-tracking/${orderId}
━━━━━━━━━━━━━━━━━━━━━
  `.trim();

  return sendWhatsAppMessage(customerPhone, message, orderId);
}

// ─── Retry Logic ───────────────────────────────────────────

/**
 * Add message to failed queue for retry
 */
function addFailedMessage(
  msg: WhatsAppMessage,
  orderId?: number
): void {
  const failed: FailedMessage = {
    ...msg,
    timestamp: Date.now(),
    attempts: 0,
    maxAttempts: MAX_RETRY_ATTEMPTS,
  };

  failedMessages.push(failed);

  logEvent(
    "Message queued for retry",
    "warn",
    {
      to: msg.to,
      queue_size: failedMessages.length,
    },
    orderId
  );
}

/**
 * Retry failed messages
 * Call this periodically (e.g., every 5 minutes)
 */
export async function retryFailedMessages(): Promise<void> {
  const now = Date.now();
  const stillValid = failedMessages.filter(
    (msg) => now - msg.timestamp < MESSAGE_EXPIRY_MS
  );

  // Remove expired messages
  if (stillValid.length < failedMessages.length) {
    const removed = failedMessages.length - stillValid.length;
    logEvent(`Cleaned up ${removed} expired messages`, "info", {}, undefined);
    failedMessages.length = 0;
    failedMessages.push(...stillValid);
  }

  // Retry each message
  for (let i = failedMessages.length - 1; i >= 0; i--) {
    const msg = failedMessages[i];

    if (msg.attempts < msg.maxAttempts) {
      msg.attempts++;

      logEvent(
        "Retrying failed message",
        "info",
        {
          to: msg.to,
          attempt: msg.attempts,
          maxAttempts: msg.maxAttempts,
        },
        msg.orderId
      );

      const result = await sendWhatsAppMessage(
        msg.to,
        msg.message,
        msg.orderId
      );

      if (result.success) {
        // Remove from queue on success
        failedMessages.splice(i, 1);
      }
    } else {
      // Max retries reached, remove from queue
      logEvent(
        "Max retries reached for message",
        "error",
        { to: msg.to },
        msg.orderId
      );
      failedMessages.splice(i, 1);
    }
  }
}

/**
 * Get retry queue status
 */
export function getRetryQueueStatus(): {
  pending: number;
  avgAge: number;
  oldestAge: number;
} {
  if (failedMessages.length === 0) {
    return { pending: 0, avgAge: 0, oldestAge: 0 };
  }

  const now = Date.now();
  const ages = failedMessages.map((msg) => now - msg.timestamp);

  return {
    pending: failedMessages.length,
    avgAge: Math.round(ages.reduce((a, b) => a + b, 0) / ages.length),
    oldestAge: Math.max(...ages),
  };
}

/**
 * Clear retry queue (testing only)
 */
export function clearRetryQueue(): void {
  failedMessages.length = 0;
  logEvent("Retry queue cleared", "warn", {}, undefined);
}

// ─── Scheduled Retry ───────────────────────────────────────────

// Start retry process on app boot
if (process.env.NODE_ENV === "production") {
  setInterval(retryFailedMessages, RETRY_INTERVAL_MS);
  logEvent("WhatsApp retry scheduler started", "info", {}, undefined);
}
