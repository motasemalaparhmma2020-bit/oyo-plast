/**
 * OTP Sender — نظام إرسال رموز التحقق
 *
 * القنوات المدعومة (مرتبة حسب الأفضلية لعملاء اليمن):
 *  1. WhatsApp عبر Twilio  → TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM
 *  2. WhatsApp عبر UltraMSG → ULTRAMSG_INSTANCE_ID / ULTRAMSG_TOKEN
 *  3. SMS عبر Twilio        → TWILIO_FROM_NUMBER (يعمل دولياً، يحجبه مشغّلو اليمن غالباً)
 *
 * منطق الاحتياط:
 *  - قناة WhatsApp: Twilio WA → UltraMSG → Twilio SMS
 *  - قناة SMS:      Twilio SMS → Twilio WA → UltraMSG
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

// ─── Twilio WhatsApp ──────────────────────────────────────────────
async function sendViaTwilioWhatsApp(
  to: string,
  message: string
): Promise<{ success: boolean; error?: string; sid?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromRaw = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !fromRaw) {
    return { success: false, error: "TWILIO_WA_NOT_CONFIGURED" };
  }

  // قبول الصيغتين: "whatsapp:+14155238886" أو "+14155238886"
  const from = fromRaw.startsWith("whatsapp:") ? fromRaw : `whatsapp:${fromRaw}`;
  const toWA = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  console.log(`[OTP-WA] Twilio WhatsApp → sending to ${toWA} from ${from}`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({ To: toWA, From: from, Body: message }),
    });

    const data = await res.json();
    console.log(`[OTP-WA] Twilio WhatsApp response ${res.status}:`, JSON.stringify(data));

    if (res.ok && data.sid) {
      return { success: true, sid: data.sid };
    }

    const errMsg = data.message
      ? `Twilio WA ${data.code || res.status}: ${data.message}`
      : `HTTP ${res.status}`;
    return { success: false, error: errMsg };
  } catch (err: any) {
    console.error(`[OTP-WA] Twilio WhatsApp fetch error:`, err.message);
    return { success: false, error: "تعذّر الاتصال بـ Twilio WhatsApp" };
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

  const smsText = `اويو بلاست: رمز التحقق ${code} (صالح 5 دقائق)`;
  const errors: Record<string, string> = {};

  // ─ قناة واتساب: Twilio WA → UltraMSG → Twilio SMS ─
  if (channel === "whatsapp") {
    // 1. Twilio WhatsApp (الأفضل لليمن)
    const twWaRes = await sendViaTwilioWhatsApp(to, messageText);
    if (twWaRes.success) {
      console.log(`[OTP] ✅ Sent via Twilio WhatsApp to ${to}`);
      return { success: true, usedChannel: "whatsapp" };
    }
    if (twWaRes.error !== "TWILIO_WA_NOT_CONFIGURED") {
      console.warn(`[OTP] Twilio WhatsApp failed: ${twWaRes.error} — trying UltraMSG`);
      errors.twilioWa = twWaRes.error || "";
    }

    // 2. UltraMSG WhatsApp (احتياط)
    const umRes = await sendViaUltraMsg(to, messageText);
    if (umRes.success) {
      console.log(`[OTP] ✅ Sent via UltraMSG WhatsApp to ${to}`);
      return { success: true, usedChannel: "whatsapp" };
    }
    if (umRes.error !== "ULTRAMSG_NOT_CONFIGURED") {
      console.warn(`[OTP] UltraMSG failed: ${umRes.error} — trying Twilio SMS`);
      errors.ultramsg = umRes.error || "";
    }

    // 3. Twilio SMS (احتياط أخير)
    const smsRes = await sendViaTwilio(to, smsText);
    if (smsRes.success) {
      console.log(`[OTP] ✅ Sent via Twilio SMS (WA fallback) to ${to}`);
      return { success: true, usedChannel: "sms" };
    }
    errors.twilioSms = smsRes.error || "";

    console.error(`[OTP] ❌ All channels failed for ${to}`, errors);
    return {
      success: false,
      error: smsRes.error || umRes.error || twWaRes.error || "فشل إرسال الرمز",
    };
  }

  // ─ قناة SMS: Twilio SMS → Twilio WA → UltraMSG ─
  const smsRes = await sendViaTwilio(to, smsText);
  if (smsRes.success) {
    console.log(`[OTP] ✅ Sent via Twilio SMS to ${to}`);
    return { success: true, usedChannel: "sms" };
  }
  console.warn(`[OTP] Twilio SMS failed: ${smsRes.error} — trying Twilio WhatsApp`);
  errors.twilioSms = smsRes.error || "";

  const waText = `🔐 *أويو بلاست*\n\nرمز التحقق:\n\n*${code}*\n\nصالح 5 دقائق — لا تشاركه مع أحد.`;
  const twWaRes = await sendViaTwilioWhatsApp(to, waText);
  if (twWaRes.success) {
    console.log(`[OTP] ✅ Sent via Twilio WhatsApp (SMS fallback) to ${to}`);
    return { success: true, usedChannel: "whatsapp" };
  }
  if (twWaRes.error !== "TWILIO_WA_NOT_CONFIGURED") errors.twilioWa = twWaRes.error || "";

  const umRes = await sendViaUltraMsg(to, waText);
  if (umRes.success) {
    console.log(`[OTP] ✅ Sent via UltraMSG WhatsApp (SMS fallback) to ${to}`);
    return { success: true, usedChannel: "whatsapp" };
  }
  if (umRes.error !== "ULTRAMSG_NOT_CONFIGURED") errors.ultramsg = umRes.error || "";

  console.error(`[OTP] ❌ All channels failed for ${to}`, errors);
  return {
    success: false,
    error: smsRes.error || twWaRes.error || umRes.error || "فشل إرسال الرمز",
  };
}
