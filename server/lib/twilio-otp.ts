/**
 * SMS Gateway OTP Service — إرسال رموز التحقق عبر Android SMS Gateway
 * يستخدم api.sms-gate.app (Cloud Server) بدلاً من Twilio
 */

const SMS_GATEWAY_URL = "https://api.sms-gate.app/3/messages";

/** توليد كود 6 أرقام */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * إرسال كود التحقق عبر Android SMS Gateway
 * @param to رقم الهاتف بصيغة دولية مثل +967777XXXXXX
 * @param code كود 6 أرقام
 * @param channel قناة الإرسال (sms فقط — whatsapp غير مدعوم في هذه الخدمة)
 */
export async function sendOTP(
  to: string,
  code: string,
  channel: "whatsapp" | "sms" = "sms"
): Promise<{ success: boolean; usedChannel?: string; error?: string }> {
  const smsUser = process.env.SMS_USER;
  const smsPass = process.env.SMS_PASS;

  if (!smsUser || !smsPass) {
    console.error("[OTP] SMS_USER or SMS_PASS not configured");
    return { success: false, error: "خدمة الرسائل غير مُهيّأة" };
  }

  // تأكد من أن الرقم بصيغة دولية (يبدأ بـ +)
  const normalizedTo = to.startsWith("+") ? to : `+${to}`;

  const messageText = `متجر اويو بلاست: رمز التحقق الخاص بك هو ${code}`;

  const credentials = Buffer.from(`${smsUser}:${smsPass}`).toString("base64");

  try {
    const res = await fetch(SMS_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${credentials}`,
      },
      body: JSON.stringify({
        message: messageText,
        phoneNumbers: [normalizedTo],
      }),
    });

    const responseText = await res.text();

    if (!res.ok) {
      console.error(`[OTP] SMS Gateway error ${res.status}: ${responseText}`);
      return { success: false, error: `فشل الإرسال (${res.status})` };
    }

    console.log(`[OTP] Sent via SMS Gateway to ${normalizedTo} — code: ${code}`);
    return { success: true, usedChannel: "sms" };
  } catch (err: any) {
    console.error(`[OTP] SMS Gateway fetch error for ${normalizedTo}:`, err.message);
    return { success: false, error: "تعذّر الاتصال بخدمة الرسائل" };
  }
}
