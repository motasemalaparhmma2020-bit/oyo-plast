/**
 * SMS Gateway OTP Service — إرسال رموز التحقق عبر Android SMS Gateway
 * يستخدم api.sms-gate.app (Cloud Server)
 */

const SMS_GATEWAY_URL = "https://api.sms-gate.app/3/messages";

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

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

  const normalizedTo = to.startsWith("+") ? to : `+${to}`;
  const messageText = `متجر اويو بلاست: رمز التحقق الخاص بك هو ${code}`;
  const credentials = Buffer.from(`${smsUser}:${smsPass}`).toString("base64");
  const payload = { message: messageText, phoneNumbers: [normalizedTo] };

  console.log(`[OTP] Sending to ${normalizedTo}, user=${smsUser.substring(0, 3)}***, url=${SMS_GATEWAY_URL}`);

  try {
    const res = await fetch(SMS_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await res.text();
    console.log(`[OTP] SMS Gateway response ${res.status}: ${responseText}`);

    if (!res.ok) {
      if (res.status === 404) {
        return {
          success: false,
          error: `فشل الإرسال (404) — ${responseText || "بوابة الرسائل غير متاحة"}`,
        };
      }
      if (res.status === 401 || res.status === 403) {
        return {
          success: false,
          error: `فشل الإرسال (${res.status}) — بيانات الدخول غير صحيحة`,
        };
      }
      return { success: false, error: `فشل الإرسال (${res.status}) — ${responseText}` };
    }

    let parsedId = "";
    try {
      const parsed = JSON.parse(responseText);
      parsedId = parsed?.id || "";
    } catch {}

    console.log(`[OTP] Sent via SMS Gateway to ${normalizedTo} — code: ${code} — msgId: ${parsedId}`);
    return { success: true, usedChannel: "sms" };
  } catch (err: any) {
    console.error(`[OTP] SMS Gateway fetch error for ${normalizedTo}:`, err.message);
    return { success: false, error: "تعذّر الاتصال بخدمة الرسائل" };
  }
}