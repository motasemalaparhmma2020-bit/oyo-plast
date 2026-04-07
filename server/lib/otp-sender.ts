/**
 * OTP Sender — نظام إرسال رموز التحقق
 *
 * القنوات المدعومة:
 *  1. SMS       → Twilio باستخدام TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER
 *  2. WhatsApp  → UltraMSG (api.ultramsg.com) باستخدام ULTRAMSG_INSTANCE_ID / ULTRAMSG_TOKEN
 *
 * منطق الاحتياط (Fallback):
 *  - إذا طُلب WhatsApp ولم تُهيَّأ UltraMSG → يحاول عبر Twilio SMS
 *  - إذا فشل Twilio SMS → يُعيد الخطأ الصريح
 */

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ─── تنسيق رقم الهاتف الدولي ─────────────────────────────────────
export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");

  if (/^9679677[0-9]{8}$/.test(digits)) digits = digits.slice(3);
  else if (/^9679[0-9]{9}$/.test(digits)) digits = digits.slice(3);
  else if (/^9669665[0-9]{8}$/.test(digits)) digits = digits.slice(3);
  else if (/^9665[0-9]{9}$/.test(digits) && digits.length === 16) digits = digits.slice(3);

  if (/^7[0-9]{8}$/.test(digits)) return `+967${digits}`;
  if (/^07[0-9]{8}$/.test(digits)) return `+967${digits.slice(1)}`;
  if (/^9677[0-9]{8}$/.test(digits)) return `+${digits}`;

  if (/^5[0-9]{8}$/.test(digits)) return `+966${digits}`;
  if (/^05[0-9]{8}$/.test(digits)) return `+966${digits.slice(1)}`;
  if (/^9665[0-9]{8}$/.test(digits)) return `+${digits}`;

  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;

  return null;
}

// ─── UltraMSG WhatsApp ────────────────────────────────────────────
async function sendViaUltraMsg(
  to: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const instanceId = process.env.ULTRAMSG_INSTANCE_ID;
  const token = process.env.ULTRAMSG_TOKEN;

  if (!instanceId || !token) {
    return { success: false, error: "ULTRAMSG_NOT_CONFIGURED" };
  }

  const phoneClean = to.replace(/^\+/, "");
  const url = `https://api.ultramsg.com/${instanceId}/messages/chat`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token, to: phoneClean, body: message }),
    });

    const data = await res.json();
    console.log(`[OTP-WA] UltraMSG response for ${to}:`, JSON.stringify(data));

    if (data.sent === "true" || data.sent === true) {
      return { success: true };
    }
    return {
      success: false,
      error: `UltraMSG: ${data.error || data.message || "فشل الإرسال"}`,
    };
  } catch (err: any) {
    console.error(`[OTP-WA] UltraMSG fetch error:`, err.message);
    return { success: false, error: "تعذّر الاتصال بـ UltraMSG" };
  }
}

// ─── Twilio SMS ───────────────────────────────────────────────────
async function sendViaTwilio(
  to: string,
  message: string
): Promise<{ success: boolean; error?: string; sid?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return { success: false, error: "TWILIO_NOT_CONFIGURED" };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  console.log(`[OTP-SMS] Twilio → sending to ${to} from ${fromNumber}`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({ To: to, From: fromNumber, Body: message }),
    });

    const data = await res.json();
    console.log(`[OTP-SMS] Twilio response ${res.status}:`, JSON.stringify(data));

    if (res.ok && data.sid) {
      return { success: true, sid: data.sid };
    }

    const errMsg =
      data.message || data.code
        ? `Twilio ${data.code}: ${data.message}`
        : `HTTP ${res.status}`;
    return { success: false, error: errMsg };
  } catch (err: any) {
    console.error(`[OTP-SMS] Twilio fetch error:`, err.message);
    return { success: false, error: "تعذّر الاتصال بـ Twilio" };
  }
}

// ─── الدالة الرئيسية ──────────────────────────────────────────────
export async function sendOTP(
  to: string,
  code: string,
  channel: "whatsapp" | "sms" = "sms"
): Promise<{ success: boolean; usedChannel?: string; error?: string }> {
  const messageText =
    channel === "whatsapp"
      ? `🔐 *أويو بلاست*\n\nرمز التحقق الخاص بك:\n\n*${code}*\n\nصالح 5 دقائق — لا تشاركه مع أحد.`
      : `متجر اويو بلاست: رمز التحقق ${code} (صالح 5 دقائق)`;

  // ─ قناة واتساب ─
  if (channel === "whatsapp") {
    const waResult = await sendViaUltraMsg(to, messageText);
    if (waResult.success) {
      console.log(`[OTP] ✅ Sent via UltraMSG WhatsApp to ${to}`);
      return { success: true, usedChannel: "whatsapp" };
    }

    if (waResult.error !== "ULTRAMSG_NOT_CONFIGURED") {
      console.warn(`[OTP] UltraMSG failed: ${waResult.error} — trying Twilio SMS`);
    }

    // احتياط: Twilio SMS
    const smsResult = await sendViaTwilio(to, `اويو بلاست: رمز التحقق ${code}`);
    if (smsResult.success) {
      console.log(`[OTP] ✅ Sent via Twilio SMS (WA fallback) to ${to}`);
      return { success: true, usedChannel: "sms" };
    }

    console.error(`[OTP] ❌ All channels failed for ${to}`, {
      ultramsg: waResult.error,
      twilio: smsResult.error,
    });
    return {
      success: false,
      error: smsResult.error || waResult.error || "فشل الإرسال",
    };
  }

  // ─ قناة SMS عبر Twilio ─
  const smsMsg = `اويو بلاست: رمز التحقق ${code}`;
  const smsResult = await sendViaTwilio(to, smsMsg);
  if (smsResult.success) {
    console.log(`[OTP] ✅ Sent via Twilio SMS to ${to}`);
    return { success: true, usedChannel: "sms" };
  }

  console.error(`[OTP] ❌ Twilio SMS failed for ${to}:`, smsResult.error);
  return { success: false, error: smsResult.error || "فشل إرسال الرمز" };
}
