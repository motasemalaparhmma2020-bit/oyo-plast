import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import { hashPassword, verifyPassword } from "../../auth-utils";
import { z } from "zod";

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
