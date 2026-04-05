/**
 * Twilio OTP Service — إرسال رموز التحقق عبر واتساب أو SMS
 */
import twilio from "twilio";

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
 * إرسال كود التحقق عبر واتساب (أولاً) أو SMS
 * @param to رقم الهاتف بصيغة دولية مثل +967777XXXXXX
 * @param code كود 6 أرقام
 * @param channel قناة الإرسال: whatsapp | sms
 */
export async function sendOTP(
  to: string,
  code: string,
  channel: "whatsapp" | "sms" = "whatsapp"
): Promise<{ success: boolean; error?: string }> {
  const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;
  if (!whatsappNumber) {
    return { success: false, error: "TWILIO_WHATSAPP_NUMBER not configured" };
  }

  const message =
    `🔐 أويو بلاست — رمز التحقق\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `رمزك السري: *${code}*\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `صالح لمدة 5 دقائق فقط\n` +
    `لا تشاركه مع أحد 🔒`;

  try {
    const client = getClient();

    if (channel === "whatsapp") {
      await client.messages.create({
        from: `whatsapp:${whatsappNumber}`,
        to: `whatsapp:${to}`,
        body: message,
      });
    } else {
      // SMS — يستخدم رقم تويليو الأساسي
      const smsNumber = process.env.TWILIO_PHONE_NUMBER || whatsappNumber;
      await client.messages.create({
        from: smsNumber,
        to,
        body: message,
      });
    }

    console.log(`[OTP] Sent via ${channel} to ${to} — code: ${code}`);
    return { success: true };
  } catch (err: any) {
    console.error(`[OTP] Send error via ${channel} to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}
