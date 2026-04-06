/**
 * OTP Sender — نظام إرسال رموز التحقق متعدد القنوات
 *
 * القنوات المدعومة:
 *  1. SMS   → Android SMS Gateway (api.sms-gate.app) باستخدام SMS_USER / SMS_PASS
 *  2. WhatsApp → UltraMSG (api.ultramsg.com) باستخدام ULTRAMSG_INSTANCE_ID / ULTRAMSG_TOKEN
 *
 * منطق الاحتياط (Fallback):
 *  - إذا طُلب WhatsApp ولم تُهيَّأ UltraMSG → يحاول عبر SMS Gateway
 *  - إذا فشل SMS Gateway → يُعيد الخطأ الصريح
 */

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ─── تنسيق رقم الهاتف الدولي ─────────────────────────────────────
export function normalizePhone(raw: string): string | null {
  // إزالة كل ما عدا الأرقام
  let digits = raw.replace(/\D/g, "");

  // إصلاح تكرار كود الدولة (مثلاً 967967XXXXXXX أو 966966XXXXXXX)
  if (/^9679677[0-9]{8}$/.test(digits)) digits = digits.slice(3); // 967 مكررة
  else if (/^9679[0-9]{9}$/.test(digits)) digits = digits.slice(3); // 967 عامة مكررة
  else if (/^9669665[0-9]{8}$/.test(digits)) digits = digits.slice(3); // 966 مكررة
  else if (/^9665[0-9]{9}$/.test(digits) && digits.length === 16) digits = digits.slice(3); // 966 عامة مكررة

  // ─ يمني ─
  if (/^7[0-9]{8}$/.test(digits)) return `+967${digits}`;           // 7XXXXXXXX
  if (/^07[0-9]{8}$/.test(digits)) return `+967${digits.slice(1)}`; // 07XXXXXXXX
  if (/^9677[0-9]{8}$/.test(digits)) return `+${digits}`;           // 9677XXXXXXXX

  // ─ سعودي ─
  if (/^5[0-9]{8}$/.test(digits)) return `+966${digits}`;           // 5XXXXXXXX
  if (/^05[0-9]{8}$/.test(digits)) return `+966${digits.slice(1)}`; // 05XXXXXXXX
  if (/^9665[0-9]{8}$/.test(digits)) return `+${digits}`;           // 9665XXXXXXXX

  // ─ دولي عام (11-15 رقم يبدأ بكود دولة) ─
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

  // UltraMSG يقبل الرقم بدون +
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

// ─── Android SMS Gateway ──────────────────────────────────────────
async function sendViaSmsGateway(
  to: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const smsUser = process.env.SMS_USER;
  const smsPass = process.env.SMS_PASS;

  if (!smsUser || !smsPass) {
    return { success: false, error: "SMS_GATEWAY_NOT_CONFIGURED" };
  }

  const SMS_GATEWAY_URL = process.env.SMS_GATEWAY_URL || "https://api.sms-gate.app/3/messages";
  const credentials = Buffer.from(`${smsUser}:${smsPass}`).toString("base64");
  const payload = { message, phoneNumbers: [to] };

  console.log(
    `[OTP-SMS] Sending to ${to}, user=${smsUser.substring(0, 3)}***, url=${SMS_GATEWAY_URL}`
  );

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
    console.log(`[OTP-SMS] Gateway response ${res.status}: ${responseText}`);

    if (!res.ok) {
      const hint =
        res.status === 404
          ? "الجهاز غير متصل بالسحابة أو المسار غير صحيح"
          : res.status === 401 || res.status === 403
          ? "بيانات الدخول للبوابة خاطئة"
          : responseText;
      return {
        success: false,
        error: `SMS_GATEWAY_${res.status}: ${hint}`,
      };
    }

    return { success: true };
  } catch (err: any) {
    console.error(`[OTP-SMS] Fetch error:`, err.message);
    return { success: false, error: "تعذّر الاتصال ببوابة SMS" };
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
    // محاولة أولى: UltraMSG
    const waResult = await sendViaUltraMsg(to, messageText);
    if (waResult.success) {
      console.log(`[OTP] ✅ Sent via UltraMSG WhatsApp to ${to}`);
      return { success: true, usedChannel: "whatsapp" };
    }

    if (waResult.error !== "ULTRAMSG_NOT_CONFIGURED") {
      console.warn(`[OTP] UltraMSG failed: ${waResult.error} — trying SMS Gateway`);
    }

    // احتياط: SMS Gateway بالرسالة النصية للواتساب
    const smsResult = await sendViaSmsGateway(
      to,
      `اويو بلاست: رمز التحقق ${code}`
    );
    if (smsResult.success) {
      console.log(`[OTP] ✅ Sent via SMS Gateway (WA fallback) to ${to}`);
      return { success: true, usedChannel: "sms" };
    }

    console.error(`[OTP] ❌ All WhatsApp channels failed for ${to}`, {
      ultramsg: waResult.error,
      smsGateway: smsResult.error,
    });
    return {
      success: false,
      error: smsResult.error || waResult.error || "فشل الإرسال",
    };
  }

  // ─ قناة SMS ─
  const smsMsg = `اويو بلاست: رمز التحقق ${code}`;
  const smsResult = await sendViaSmsGateway(to, smsMsg);
  if (smsResult.success) {
    console.log(`[OTP] ✅ Sent via SMS Gateway to ${to}`);
    return { success: true, usedChannel: "sms" };
  }

  console.error(`[OTP] ❌ SMS Gateway failed for ${to}:`, smsResult.error);
  return { success: false, error: smsResult.error || "فشل إرسال الرمز" };
}
