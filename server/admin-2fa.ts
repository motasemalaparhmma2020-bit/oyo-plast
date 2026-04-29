// ══════════════════════════════════════════════════════════════════════
// 2FA للإدارة — رمز عبر واتساب بعد كلمة المرور
// ══════════════════════════════════════════════════════════════════════

import crypto from "crypto";

interface OtpSession {
  code: string;            // الرمز المُتوقع (6 أرقام)
  expiresAt: number;       // وقت الانتهاء (ms)
  attempts: number;        // عدد محاولات التحقق الفاشلة
  ip: string;              // IP الذي طلب الرمز
}

// تخزين الجلسات في الذاكرة (لا يحتاج DB لأنه قصير العمر)
const otpSessions = new Map<string, OtpSession>();

// تنظيف الجلسات المنتهية كل دقيقة
setInterval(() => {
  const now = Date.now();
  otpSessions.forEach((sess, id) => {
    if (sess.expiresAt < now) otpSessions.delete(id);
  });
}, 60 * 1000);

// ─── إنشاء جلسة OTP جديدة ──────────────────────────────────────────
export function createOtpSession(ip: string): { sessionId: string; code: string } {
  const sessionId = crypto.randomBytes(16).toString("hex");
  const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 أرقام
  otpSessions.set(sessionId, {
    code,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 دقائق
    attempts: 0,
    ip,
  });
  return { sessionId, code };
}

// ─── التحقق من رمز OTP ─────────────────────────────────────────────
// يُرجع: { ok: true } أو { ok: false, reason: "..." }
export function verifyOtp(sessionId: string, code: string, ip: string):
  { ok: true } | { ok: false; reason: string } {
  const sess = otpSessions.get(sessionId);
  if (!sess) return { ok: false, reason: "انتهت الجلسة، أعد إدخال كلمة المرور" };
  if (sess.expiresAt < Date.now()) {
    otpSessions.delete(sessionId);
    return { ok: false, reason: "انتهت صلاحية الرمز، أعد المحاولة" };
  }
  if (sess.ip !== ip) {
    otpSessions.delete(sessionId);
    return { ok: false, reason: "تغيّر مصدر الطلب، أعد المحاولة" };
  }
  if (sess.attempts >= 5) {
    otpSessions.delete(sessionId);
    return { ok: false, reason: "تجاوزت عدد المحاولات، أعد إدخال كلمة المرور" };
  }
  sess.attempts++;

  // مقارنة timing-safe
  const a = Buffer.from(code.padStart(6, "0"));
  const b = Buffer.from(sess.code);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: `رمز خاطئ، تبقّى ${5 - sess.attempts} محاولات` };
  }

  // نجح: احذف الجلسة (one-time use)
  otpSessions.delete(sessionId);
  return { ok: true };
}

// ─── إرسال الرمز عبر واتساب ────────────────────────────────────────
export async function sendOtpViaWhatsapp(code: string): Promise<{ sent: boolean; reason?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER || process.env.ADMIN_PHONE;

  if (!accountSid || !authToken || !fromNumber) {
    return { sent: false, reason: "Twilio غير معدّ" };
  }
  if (!adminPhone) {
    return { sent: false, reason: "رقم المدير غير معرّف (ADMIN_PHONE)" };
  }

  try {
    const twilio = (await import("twilio")).default;
    const client = twilio(accountSid, authToken);
    const to = adminPhone.startsWith("+") ? adminPhone : "+" + adminPhone;
    await client.messages.create({
      from: `whatsapp:${fromNumber}`,
      to:   `whatsapp:${to}`,
      body: `🔐 *رمز دخول لوحة التحكم — أويو بلاست*\n\nالرمز: *${code}*\n\nصالح لمدة 5 دقائق.\nإن لم تطلب الدخول، تجاهل هذه الرسالة وأبلغ المسؤول.`,
    });
    return { sent: true };
  } catch (e: any) {
    console.error("[2FA] WhatsApp send failed:", e?.message || e);
    return { sent: false, reason: e?.message || "فشل الإرسال" };
  }
}
