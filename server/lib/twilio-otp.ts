/**
 * Twilio OTP Service — إرسال رموز التحقق عبر رسالة نصية SMS أو واتساب
 */
import twilio from "twilio";

// رقم واتساب sandbox الافتراضي من تويليو (يتطلب opt-in)
const TWILIO_SANDBOX_NUMBER = "+14155238886";

let _client: twilio.Twilio | null = null;

function getClient(): twilio.Twilio {
  if (_client) return _client;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error("TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not configured");
  }
  _client = twilio(accountSid, authToken);
  return _client;
}

/** توليد كود 6 أرقام */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * إرسال كود التحقق عبر SMS أو واتساب
 * إذا فشل واتساب يرجع fallback تلقائي لـ SMS
 * @param to رقم الهاتف بصيغة دولية مثل +967777XXXXXX
 * @param code كود 6 أرقام
 * @param channel قناة الإرسال: sms | whatsapp
 */
export async function sendOTP(
  to: string,
  code: string,
  channel: "whatsapp" | "sms" = "sms"
): Promise<{ success: boolean; usedChannel?: string; error?: string }> {
  const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;
  if (!whatsappNumber) {
    return { success: false, error: "TWILIO_WHATSAPP_NUMBER not configured" };
  }

  const isSandbox = whatsappNumber.replace(/\s/g, "") === TWILIO_SANDBOX_NUMBER;

  const message =
    `رمز التحقق - أويو بلاست\n` +
    `رمزك: ${code}\n` +
    `صالح 5 دقائق فقط. لا تشاركه.`;

  const client = getClient();

  // إذا طُلب واتساب لكن الرقم هو sandbox، انتقل مباشرة لـ SMS
  if (channel === "whatsapp" && isSandbox) {
    console.warn("[OTP] WhatsApp Sandbox detected → switching to SMS automatically");
    channel = "sms";
  }

  // محاولة الإرسال عبر القناة المطلوبة
  const trySend = async (ch: "whatsapp" | "sms"): Promise<void> => {
    if (ch === "whatsapp") {
      await client.messages.create({
        from: `whatsapp:${whatsappNumber}`,
        to: `whatsapp:${to}`,
        body: message,
      });
    } else {
      // SMS — نستخدم رقم TWILIO_PHONE_NUMBER إن وُجد وإلا رقم WhatsApp
      const smsFrom = process.env.TWILIO_PHONE_NUMBER || whatsappNumber;
      await client.messages.create({
        from: smsFrom,
        to,
        body: message,
      });
    }
  };

  try {
    await trySend(channel);
    console.log(`[OTP] Sent via ${channel} to ${to} — code: ${code}`);
    return { success: true, usedChannel: channel };
  } catch (err: any) {
    console.error(`[OTP] Send error via ${channel} to ${to}:`, err.message);

    // إذا فشل واتساب، حاول SMS تلقائياً
    if (channel === "whatsapp") {
      console.log(`[OTP] Falling back to SMS for ${to}...`);
      try {
        await trySend("sms");
        console.log(`[OTP] Fallback SMS sent to ${to} — code: ${code}`);
        return { success: true, usedChannel: "sms" };
      } catch (smsErr: any) {
        console.error(`[OTP] SMS fallback also failed for ${to}:`, smsErr.message);
        return { success: false, error: smsErr.message };
      }
    }

    return { success: false, error: err.message };
  }
}
