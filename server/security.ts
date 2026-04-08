import rateLimit from "express-rate-limit";
import { Request, Response, NextFunction } from "express";
import { pool } from "./db";
import xss from "xss";

// ══════════════════════════════════════════════════════════════════════
// نظام الأمان المتكامل — أويو بلاست
// طبقات: Rate Limiting + XSS + سجل هجمات + إشعار WhatsApp
// ══════════════════════════════════════════════════════════════════════

// ─── تسجيل الأحداث الأمنية في DB ────────────────────────────────────
export async function logSecurityEvent(
  eventType: string,
  ip: string,
  path: string,
  method: string,
  details: string,
  severity: "info" | "warning" | "critical" = "info",
  userAgent?: string
) {
  try {
    await pool.query(
      `INSERT INTO security_logs (event_type, ip_address, path, method, user_agent, details, severity)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [eventType, ip, path, method, userAgent || null, details, severity]
    );

    // إشعار WhatsApp عند الأحداث الحرجة فقط
    if (severity === "critical") {
      await sendSecurityAlert(eventType, ip, path, details);
    }
  } catch (e) {
    console.error("[SECURITY] Failed to log event:", e);
  }
}

// ─── إشعار WhatsApp للمدير ──────────────────────────────────────────
async function sendSecurityAlert(
  eventType: string,
  ip: string,
  path: string,
  details: string
) {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken  = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;
    const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER || process.env.ADMIN_PHONE;

    if (!accountSid || !authToken || !fromNumber || !adminPhone) return;

    const twilio = (await import("twilio")).default;
    const client = twilio(accountSid, authToken);
    await client.messages.create({
      from: `whatsapp:${fromNumber}`,
      to:   `whatsapp:${adminPhone.startsWith("+") ? adminPhone : "+" + adminPhone}`,
      body: `🚨 *تنبيه أمني — أويو بلاست*\n\n🔴 *نوع الحدث:* ${eventType}\n🌐 *IP:* ${ip}\n📍 *المسار:* ${path}\n📋 *التفاصيل:* ${details}\n⏰ *الوقت:* ${new Date().toLocaleString("ar-YE")}`,
    });
  } catch (e) {
    console.error("[SECURITY] WhatsApp alert failed:", e);
  }
}

// ─── Rate Limiting ──────────────────────────────────────────────────

// تتبع محاولات تسجيل الدخول الفاشلة لكل IP
const failedLoginAttempts = new Map<string, { count: number; firstAttempt: number }>();

// General: 200 طلب / دقيقة للعامة
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "كثير من الطلبات، حاول بعد دقيقة." },
  skip: (req) => req.path === "/health",
  handler: async (req, res, next, options) => {
    const ip = req.ip || "unknown";
    await logSecurityEvent("rate_limit_general", ip, req.path, req.method,
      `تجاوز الحد العام: ${options.max} طلب/دقيقة`, "warning", req.get("user-agent"));
    res.status(429).json(options.message);
  },
});

// مسارات الإدارة: 50 طلب / دقيقة
export const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "كثير من طلبات الإدارة، حاول بعد دقيقة." },
  handler: async (req, res, next, options) => {
    const ip = req.ip || "unknown";
    await logSecurityEvent("rate_limit_admin", ip, req.path, req.method,
      `تجاوز حد مسارات الإدارة`, "critical", req.get("user-agent"));
    res.status(429).json(options.message);
  },
});

// تسجيل الدخول: 5 محاولات / 15 دقيقة
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "تم تجاوز عدد محاولات الدخول، انتظر 15 دقيقة." },
  handler: async (req, res, next, options) => {
    const ip = req.ip || "unknown";
    await logSecurityEvent("brute_force_attempt", ip, req.path, req.method,
      `محاولات دخول متكررة: ${options.max} محاولة / 15 دقيقة`, "critical", req.get("user-agent"));
    res.status(429).json(options.message);
  },
});

// إنشاء الطلبات: 30 طلب / ساعة لكل IP (يمنع الطلبات الوهمية)
export const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "كثير من الطلبات من هذا العنوان، حاول بعد ساعة." },
  handler: async (req, res, next, options) => {
    const ip = req.ip || "unknown";
    await logSecurityEvent("order_spam", ip, req.path, req.method,
      `إغراق بالطلبات: أكثر من ${options.max} طلب/ساعة`, "critical", req.get("user-agent"));
    res.status(429).json(options.message);
  },
});

// ─── XSS Sanitization Middleware ────────────────────────────────────
export function sanitizeInputs(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === "object") {
    req.body = deepSanitize(req.body);
  }
  if (req.query && typeof req.query === "object") {
    for (const key of Object.keys(req.query)) {
      if (typeof req.query[key] === "string") {
        req.query[key] = xss(req.query[key] as string);
      }
    }
  }
  next();
}

function deepSanitize(obj: any): any {
  if (typeof obj === "string") return xss(obj);
  if (Array.isArray(obj)) return obj.map(deepSanitize);
  if (obj !== null && typeof obj === "object") {
    const sanitized: any = {};
    for (const [k, v] of Object.entries(obj)) {
      // لا تُنظّف الحقول الرقمية والبوليانية
      sanitized[k] = typeof v === "string" ? xss(v) : deepSanitize(v);
    }
    return sanitized;
  }
  return obj;
}

// ─── مسار: جلب سجلات الأمان ─────────────────────────────────────────
export async function getSecurityLogs(req: Request, res: Response) {
  try {
    const limit  = Math.min(parseInt(String(req.query.limit  || "100")), 500);
    const severity = req.query.severity as string | undefined;
    const params: any[] = [limit];
    const where = severity ? `WHERE severity=$2` : "";
    if (severity) params.push(severity);

    const result = await pool.query(
      `SELECT * FROM security_logs ${where} ORDER BY created_at DESC LIMIT $1`,
      params
    );

    const summary = await pool.query(
      `SELECT severity, COUNT(*) as count FROM security_logs
       WHERE created_at > NOW() - INTERVAL '24 hours'
       GROUP BY severity`
    );

    res.json({ logs: result.rows, summary: summary.rows });
  } catch (e: any) {
    res.status(500).json({ message: "فشل جلب السجلات", details: e.message });
  }
}
