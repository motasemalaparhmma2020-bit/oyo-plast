import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import { hashPassword, verifyPassword } from "../../auth-utils";
import { z } from "zod";
import { pool } from "../../db";
import { generateOTP, sendOTP, normalizePhone } from "../../lib/otp-sender";

const registerSchema = z.object({
  email: z.string().email("البريد الإلكتروني غير صالح"),
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
  fullName: z.string().min(2, "الاسم مطلوب"),
  phone: z.string().optional(),
  accountType: z.enum(["customer", "marketer"]).default("customer"),
});

const loginSchema = z.object({
  email: z.string().email("البريد الإلكتروني غير صالح"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

// Register auth-specific routes
export function registerAuthRoutes(app: Express): void {
  // Get current authenticated user
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Email Registration
  app.post("/api/auth/register", async (req, res) => {
    try {
      const parseResult = registerSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "بيانات غير صالحة", 
          errors: parseResult.error.errors 
        });
      }

      const { email, password, fullName, phone, accountType } = parseResult.data;

      // Check if email already exists
      const existingUser = await authStorage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "البريد الإلكتروني مستخدم بالفعل" });
      }

      // Hash password and create user
      const passwordHash = hashPassword(password);
      const user = await authStorage.createEmailUser({
        email,
        passwordHash,
        fullName,
        phone,
        accountType,
      });

      // Log in the user automatically
      const sessionUser = {
        claims: { sub: user.id },
        expires_at: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 1 week
      };

      req.login(sessionUser, (err: any) => {
        if (err) {
          console.error("Login error after registration:", err);
          return res.status(500).json({ message: "فشل في تسجيل الدخول" });
        }
        res.status(201).json({ 
          message: "تم إنشاء الحساب بنجاح",
          user: { id: user.id, email: user.email, fullName: user.fullName }
        });
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "حدث خطأ أثناء إنشاء الحساب" });
    }
  });

  // Email Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const parseResult = loginSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "بيانات غير صالحة", 
          errors: parseResult.error.errors 
        });
      }

      const { email, password } = parseResult.data;

      // Find user by email
      const user = await authStorage.getUserByEmail(email);
      if (!user || !user.passwordHash) {
        return res.status(401).json({ message: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
      }

      // Verify password
      const isValid = verifyPassword(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ message: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
      }

      // Create session
      const sessionUser = {
        claims: { sub: user.id },
        expires_at: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 1 week
      };

      req.login(sessionUser, (err: any) => {
        if (err) {
          console.error("Login error:", err);
          return res.status(500).json({ message: "فشل في تسجيل الدخول" });
        }
        res.json({ 
          message: "تم تسجيل الدخول بنجاح",
          user: { id: user.id, email: user.email, fullName: user.fullName }
        });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "حدث خطأ أثناء تسجيل الدخول" });
    }
  });

  // Email Logout
  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "فشل في تسجيل الخروج" });
      }
      res.json({ message: "تم تسجيل الخروج بنجاح" });
    });
  });

  // ── OTP: إرسال رمز التحقق للهاتف ──────────────────────────────────
  app.post("/api/auth/send-otp", async (req, res) => {
    try {
      const { phone, channel = "whatsapp" } = req.body;

      if (!phone || phone.trim().length < 9) {
        return res.status(400).json({ message: "رقم الهاتف غير صالح" });
      }

      // تنسيق الرقم بصيغة دولية
      const normalizedPhone = normalizePhone(phone.trim());
      if (!normalizedPhone) {
        return res.status(400).json({ message: "رقم الهاتف غير صالح. استخدم الصيغة الدولية مثل: 967777XXXXXX+" });
      }

      // حد أقصى: 5 محاولات في 10 دقائق لنفس الرقم
      const client = await pool.connect();
      try {
        const rateLimitCheck = await client.query(
          `SELECT COUNT(*) FROM phone_verifications WHERE phone = $1 AND created_at > NOW() - INTERVAL '10 minutes'`,
          [normalizedPhone]
        );
        if (parseInt(rateLimitCheck.rows[0].count) >= 5) {
          return res.status(429).json({ message: "تجاوزت الحد المسموح. انتظر 10 دقائق وأعد المحاولة." });
        }

        const code = generateOTP();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 دقائق

        // حذف الرموز القديمة لهذا الرقم
        await client.query(`DELETE FROM phone_verifications WHERE phone = $1 AND verified = false`, [normalizedPhone]);

        // حفظ الرمز الجديد
        await client.query(
          `INSERT INTO phone_verifications (phone, code, attempts, verified, expires_at) VALUES ($1, $2, 0, false, $3)`,
          [normalizedPhone, code, expiresAt]
        );

        // إرسال الكود
        const result = await sendOTP(normalizedPhone, code, channel as "whatsapp" | "sms");

        if (!result.success) {
          console.error("[OTP] Send failed:", result.error);

          // في وضع التطوير، نعيد الكود في الاستجابة دائماً
          if (process.env.NODE_ENV !== "production") {
            console.log(`[OTP-DEV] Code for ${normalizedPhone}: ${code}`);
            return res.json({
              message: "تم إرسال الرمز (وضع التطوير)",
              devCode: code,
              phone: normalizedPhone,
            });
          }

          // في الإنتاج: رسالة خطأ واضحة
          const err = result.error || "";
          let userMessage = "تعذّر إرسال رمز التحقق. يرجى المحاولة مجدداً.";

          if (err.includes("TWILIO_NOT_CONFIGURED") || err.includes("NOT_CONFIGURED")) {
            userMessage = "خدمة الرسائل غير مفعّلة. تواصل مع الدعم.";
          } else if (err.includes("429") || err.toLowerCase().includes("exceeded") || err.toLowerCase().includes("daily messages limit")) {
            userMessage = "تجاوز المتجر الحد اليومي لرسائل التحقق. يرجى المحاولة غداً أو التواصل مع الدعم.";
          } else if (err.toLowerCase().includes("twilio") && (err.includes("401") || err.includes("403"))) {
            userMessage = "بيانات خدمة الرسائل غير صحيحة. تواصل مع الدعم.";
          } else if (err.toLowerCase().includes("twilio") || err.toLowerCase().includes("sms")) {
            userMessage = "تعذّر إرسال الرمز. جرّب واتساب بدلاً من SMS أو أعد المحاولة لاحقاً.";
          }

          return res.status(503).json({ message: userMessage });
        }

        const usedChannel = result.usedChannel || channel;
        res.json({
          message: `تم إرسال رمز التحقق إلى ${usedChannel === "whatsapp" ? "واتساب" : "رسالة نصية"}`,
          phone: normalizedPhone,
          channel: usedChannel,
        });
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error("[OTP] Send error:", err.message);
      res.status(500).json({ message: "حدث خطأ. أعد المحاولة." });
    }
  });

  // ── OTP: التحقق من الرمز وتسجيل الدخول ──────────────────────────
  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const { phone, code, fullName } = req.body;

      if (!phone || !code) {
        return res.status(400).json({ message: "الرقم والرمز مطلوبان" });
      }

      const normalizedPhone = normalizePhone(phone.trim());
      if (!normalizedPhone) {
        return res.status(400).json({ message: "رقم الهاتف غير صالح" });
      }

      const client = await pool.connect();
      try {
        // جلب آخر رمز غير منتهي الصلاحية
        const result = await client.query(
          `SELECT * FROM phone_verifications WHERE phone = $1 AND verified = false AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`,
          [normalizedPhone]
        );

        if (result.rows.length === 0) {
          return res.status(400).json({ message: "الرمز منتهي الصلاحية أو غير موجود. اطلب رمزاً جديداً." });
        }

        const verification = result.rows[0];

        // زيادة عداد المحاولات
        await client.query(`UPDATE phone_verifications SET attempts = attempts + 1 WHERE id = $1`, [verification.id]);

        // حد أقصى 5 محاولات خاطئة
        if (verification.attempts >= 5) {
          await client.query(`DELETE FROM phone_verifications WHERE id = $1`, [verification.id]);
          return res.status(400).json({ message: "تجاوزت عدد المحاولات المسموحة. اطلب رمزاً جديداً." });
        }

        if (verification.code !== code.trim()) {
          const remaining = 4 - verification.attempts;
          return res.status(400).json({ message: `الرمز غير صحيح. تبقى ${remaining} محاولات.` });
        }

        // الرمز صحيح — علّمه كمُتحقَّق
        await client.query(`UPDATE phone_verifications SET verified = true WHERE id = $1`, [verification.id]);

        // إيجاد أو إنشاء المستخدم
        let user = await authStorage.getUserByPhone(normalizedPhone);
        if (!user) {
          user = await authStorage.createPhoneUser({ phone: normalizedPhone, fullName: fullName?.trim() || undefined });
        } else if (fullName?.trim() && !user.fullName) {
          // تحديث الاسم إذا أُدخل لأول مرة
          await client.query(`UPDATE users SET full_name = $1 WHERE id = $2`, [fullName.trim(), user.id]);
          user = { ...user, fullName: fullName.trim() };
        }

        // تسجيل الدخول عبر الجلسة
        const sessionUser = {
          claims: { sub: user.id },
          expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // أسبوع
        };

        (req as any).login(sessionUser, (err: any) => {
          if (err) {
            console.error("[OTP] Session login error:", err);
            return res.status(500).json({ message: "فشل في تسجيل الدخول" });
          }
          res.json({
            message: "تم التحقق وتسجيل الدخول بنجاح",
            user: { id: user!.id, phone: user!.phone, fullName: user!.fullName },
            isNewUser: !user!.fullName,
          });
        });
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error("[OTP] Verify error:", err.message);
      res.status(500).json({ message: "حدث خطأ. أعد المحاولة." });
    }
  });

  // ── تحديث الاسم بعد التحقق من OTP (المستخدم مسجّل بالفعل) ──────────
  app.post("/api/auth/update-profile", async (req: any, res) => {
    if (!req.isAuthenticated() || !req.user?.claims?.sub) {
      return res.status(401).json({ message: "غير مصرح" });
    }
    try {
      const { fullName } = req.body;
      const userId = req.user.claims.sub;
      if (fullName && fullName.trim().length >= 2) {
        const client = await pool.connect();
        try {
          await client.query(`UPDATE users SET full_name = $1 WHERE id = $2`, [fullName.trim(), userId]);
        } finally {
          client.release();
        }
      }
      const user = await authStorage.getUser(userId);
      res.json({ message: "تم تحديث الملف الشخصي", user });
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({ message: "حدث خطأ أثناء تحديث البيانات" });
    }
  });

  // ── حفظ بيانات إكمال التسجيل (Onboarding) ─────────────────────────
  app.post("/api/auth/complete-onboarding", async (req: any, res) => {
    if (!req.isAuthenticated() || !req.user?.claims?.sub) {
      return res.status(401).json({ message: "غير مصرح" });
    }
    try {
      const userId = req.user.claims.sub;
      const {
        fullName, businessName, businessType,
        governorate, city, street,
        gpsLatitude, gpsLongitude,
      } = req.body || {};

      if (!fullName || String(fullName).trim().length < 2) {
        return res.status(400).json({ message: "اسم العميل مطلوب" });
      }
      if (!businessType) {
        return res.status(400).json({ message: "نوع النشاط مطلوب" });
      }
      if (!governorate || !city || !street) {
        return res.status(400).json({ message: "المحافظة والمدينة والشارع مطلوبة" });
      }

      const client = await pool.connect();
      try {
        await client.query(
          `UPDATE users SET
             full_name = $1,
             business_name = $2,
             business_type = $3,
             governorate = $4,
             city = $5,
             street = $6,
             gps_latitude = $7,
             gps_longitude = $8,
             onboarding_completed = 'true',
             updated_at = NOW()
           WHERE id = $9`,
          [
            String(fullName).trim(),
            businessName ? String(businessName).trim() : null,
            String(businessType).trim(),
            String(governorate).trim(),
            String(city).trim(),
            String(street).trim(),
            gpsLatitude != null ? String(gpsLatitude) : null,
            gpsLongitude != null ? String(gpsLongitude) : null,
            userId,
          ]
        );
      } finally {
        client.release();
      }
      const user = await authStorage.getUser(userId);
      res.json({ message: "اكتمل التسجيل بنجاح", user });
    } catch (error: any) {
      console.error("Onboarding error:", error?.message || error);
      res.status(500).json({ message: "حدث خطأ أثناء حفظ البيانات" });
    }
  });

  // Get current user (for email auth)
  app.get("/api/auth/me", async (req: any, res) => {
    if (!req.isAuthenticated() || !req.user?.claims?.sub) {
      return res.status(401).json({ message: "غير مصرح" });
    }
    
    try {
      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "المستخدم غير موجود" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "خطأ في جلب بيانات المستخدم" });
    }
  });
}
