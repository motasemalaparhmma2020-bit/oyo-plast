import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./replit_integrations/auth/replitAuth";
import { registerAuthRoutes } from "./replit_integrations/auth/routes";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import sharp from "sharp";
import { adminLimiter, orderLimiter, loginLimiter, logSecurityEvent, getSecurityLogs } from "./security";

// ─── معالجة الصورة بالضغط والتقليص ─────────────────────────────────────────
async function processImage(
  buffer: Buffer,
  mimetype: string,
  opts?: { maxWidth?: number; maxHeight?: number; quality?: number }
): Promise<{ buffer: Buffer; mimeOut: string }> {
  const maxW = opts?.maxWidth ?? 1200;
  const maxH = opts?.maxHeight ?? 1200;
  const quality = opts?.quality ?? 80;
  try {
    const processed = await sharp(buffer)
      .resize(maxW, maxH, { fit: "inside", withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
    return { buffer: processed, mimeOut: "image/webp" };
  } catch {
    // fallback: return original if sharp fails
    return { buffer, mimeOut: mimetype };
  }
}

async function getImageSettings(dbPool: any) {
  try {
    const r = await dbPool.query("SELECT img_max_width, img_max_height, img_quality, img_max_size_mb FROM display_settings LIMIT 1");
    if (r.rows.length) return r.rows[0];
  } catch {}
  return { img_max_width: 1200, img_max_height: 1200, img_quality: 80, img_max_size_mb: 5 };
}

const rootDir = process.cwd();

/** تختار الحقول المعروفة فقط من كائن المصدر — تمنع ثغرة prototype pollution */
function pickFields(src: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const keySet = new Set(keys);
  return Object.fromEntries(
    Object.entries(src).filter(([k, v]) => keySet.has(k) && v !== undefined)
  );
}

// Keep uploads dir for design files only (not product images)
const uploadsDir = path.resolve(rootDir, "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Memory storage: images stored as base64 in DB (permanent, survives deploys)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only images are allowed"));
  },
});

// Supplier upload: allows up to 10MB (sharp will compress it)
const supplierUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only images are allowed"));
  },
});

// Design upload still uses disk (for larger files)
const designUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      const name = crypto.randomUUID() + ext;
      cb(null, name);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
});

function getAdminToken(): string {
  const secret = process.env.ADMIN_PASSWORD || "oyo-default";
  return crypto.createHmac("sha256", secret).update("oyo-admin-v1").digest("hex");
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.headers["x-admin-token"] as string;
  if (!token || token !== getAdminToken()) {
    return res.status(401).json({ message: "غير مصرح" });
  }
  next();
}

function generateSlug(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\u0600-\u06FFa-zA-Z0-9-]/g, "")
    .toLowerCase() + "-" + Date.now();
}

/**
 * استخراج معرّف المستخدم من كائن req.user
 * يدعم: Replit OIDC (claims.sub) + Email auth (claims.sub)
 */
function getUserId(user: any): string | undefined {
  if (!user) return undefined;
  // Replit OIDC + Email auth both store userId in claims.sub
  return user.claims?.sub ?? undefined;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<void> {
  await setupAuth(app);
  registerAuthRoutes(app);

  // ─── Google Search Console Verification ──────────────────────────
  app.get("/google2bec18c5e7a1da83.html", (_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.send("google-site-verification: google2bec18c5e7a1da83.html");
  });

  // ─── Digital Asset Links (لربط تطبيق جوجل بلاي بالموقع) ──────────────
  // يتم تحديث sha256_cert_fingerprints بعد الحصول على التوقيع من Google Play Console
  app.get("/.well-known/assetlinks.json", (_req, res) => {
    const { PLAY_SIGNING_SHA256 } = process.env;
    const fingerprint = PLAY_SIGNING_SHA256 || "REPLACE_WITH_SHA256_FROM_GOOGLE_PLAY_CONSOLE";
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.json([{
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.oyoplast.app",
        sha256_cert_fingerprints: [fingerprint]
      }
    }]);
  });

  // ─── Dynamic Sitemap ─────────────────────────────────────────────
  app.get("/sitemap.xml", async (_req, res) => {
    try {
      const products = await storage.getProducts();
      const today = new Date().toISOString().split("T")[0];
      const staticPages = [
        { url: "/", priority: "1.0", changefreq: "daily" },
        { url: "/products", priority: "0.9", changefreq: "daily" },
        { url: "/printing", priority: "0.8", changefreq: "weekly" },
        { url: "/printing-and-design", priority: "0.7", changefreq: "weekly" },
        { url: "/about", priority: "0.6", changefreq: "monthly" },
        { url: "/terms", priority: "0.4", changefreq: "monthly" },
        { url: "/privacy", priority: "0.4", changefreq: "monthly" },
        { url: "/returns", priority: "0.4", changefreq: "monthly" },
      ];
      const productEntries = products.map(p =>
        `  <url>\n    <loc>https://oyoplast.com/products/${p.id}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n    <lastmod>${today}</lastmod>\n  </url>`
      ).join("\n");
      const staticEntries = staticPages.map(p =>
        `  <url>\n    <loc>https://oyoplast.com${p.url}</loc>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n    <lastmod>${today}</lastmod>\n  </url>`
      ).join("\n");
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${staticEntries}\n${productEntries}\n</urlset>`;
      res.setHeader("Content-Type", "application/xml");
      res.send(xml);
    } catch (e) {
      res.status(500).send("Error generating sitemap");
    }
  });

  // ─── Admin Login ─────────────────────────────────────────────────
  app.post("/api/admin/login", (req, res) => {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword || password !== adminPassword) {
      return res.status(401).json({ message: "كلمة المرور غير صحيحة" });
    }
    res.json({ token: getAdminToken() });
  });

  // ─── Image Upload - Base64 with sharp compression ─────────────────
  app.post("/api/admin/upload", requireAdmin, upload.single("image"), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "لم يتم رفع صورة" });
    try {
      // ─── Cloudinary upload (if configured) ──────────────────────────
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;
      if (cloudName && apiKey && apiSecret) {
        const { v2: cloudinary } = await import("cloudinary");
        cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
        const uploadRes: any = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "oyo-plast", resource_type: "image" },
            (err: any, result: any) => err ? reject(err) : resolve(result)
          );
          stream.end(req.file!.buffer);
        });
        return res.json({ imageUrl: uploadRes.secure_url, provider: "cloudinary" });
      }
      // ─── Fallback: base64 ────────────────────────────────────────────
      const { pool: dbPool } = await import("./db");
      const settings = await getImageSettings(dbPool);
      const { buffer, mimeOut } = await processImage(req.file.buffer, req.file.mimetype, {
        maxWidth: settings.img_max_width,
        maxHeight: settings.img_max_height,
        quality: settings.img_quality,
      });
      const base64 = buffer.toString("base64");
      const imageUrl = `data:${mimeOut};base64,${base64}`;
      res.json({ imageUrl, provider: "base64" });
    } catch (e: any) {
      const base64 = req.file.buffer.toString("base64");
      res.json({ imageUrl: `data:${req.file.mimetype};base64,${base64}`, provider: "base64" });
    }
  });

  // ─── Image Upload for Supplier (with compression, up to 10MB) ────────
  app.post("/api/supplier/upload", supplierUpload.single("image"), requireSupplier, async (req: any, res) => {
    if (!req.file) return res.status(400).json({ message: "لم يتم رفع صورة" });
    try {
      // ─── Cloudinary upload (if configured) ──────────────────────────
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;
      if (cloudName && apiKey && apiSecret) {
        const { v2: cloudinary } = await import("cloudinary");
        cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
        const uploadRes: any = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "oyo-plast/supplier", resource_type: "image" },
            (err: any, result: any) => err ? reject(err) : resolve(result)
          );
          stream.end(req.file!.buffer);
        });
        return res.json({ imageUrl: uploadRes.secure_url, provider: "cloudinary" });
      }
      // ─── Fallback: base64 ────────────────────────────────────────────
      const { pool: dbPool } = await import("./db");
      const settings = await getImageSettings(dbPool);
      const { buffer, mimeOut } = await processImage(req.file.buffer, req.file.mimetype, {
        maxWidth: settings.img_max_width,
        maxHeight: settings.img_max_height,
        quality: settings.img_quality,
      });
      const base64 = buffer.toString("base64");
      const imageUrl = `data:${mimeOut};base64,${base64}`;
      res.json({ imageUrl, provider: "base64" });
    } catch {
      const base64 = req.file.buffer.toString("base64");
      res.json({ imageUrl: `data:${req.file.mimetype};base64,${base64}`, provider: "base64" });
    }
  });

  // ─── Design Upload (Public) - still uses disk for large files ────────
  app.post("/api/upload/design", designUpload.single("design"), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "لم يتم رفع ملف" });
    try {
      const designUrl = `/uploads/${req.file.filename}`;
      res.json({ designUrl });
    } catch (error) {
      res.status(500).json({ message: "فشل في معالجة الملف" });
    }
  });

  // ─── Invoice Settings ─────────────────────────────────────────────
  app.get("/api/admin/invoice-settings", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query("SELECT value FROM settings WHERE key='invoice_settings'");
      if (result.rows.length) {
        res.json(JSON.parse(result.rows[0].value));
      } else {
        res.json({});
      }
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب إعدادات الفاتورة" });
    }
  });

  app.put("/api/admin/invoice-settings", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const value = JSON.stringify(req.body);
      await dbPool.query(
        `INSERT INTO settings (key, value) VALUES ('invoice_settings', $1)
         ON CONFLICT (key) DO UPDATE SET value=$1`,
        [value]
      );
      res.json(req.body);
    } catch (e: any) {
      res.status(500).json({ message: "فشل حفظ إعدادات الفاتورة" });
    }
  });

  // Public invoice settings (for invoice rendering)
  app.get("/api/invoice-settings", async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query("SELECT value FROM settings WHERE key='invoice_settings'");
      if (result.rows.length) res.json(JSON.parse(result.rows[0].value));
      else res.json({});
    } catch { res.json({}); }
  });

  // ─── Suppliers (الموردون/الموزعون) ──────────────────────────────────────────

  // دالة إشعار واتساب/SMS للمورد
  // ─── إشعار العميل عبر واتساب عند تغيير حالة الطلب ────────────────────────────
  async function notifyCustomerStatus(customerPhone: string, orderId: number, newStatus: string, extra?: { trackingNumber?: string }) {
    try {
      const phone = customerPhone.replace(/\s+/g, "").replace(/^00/, "+");
      if (!phone.startsWith("+")) return;

      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_FROM_NUMBER;
      if (!accountSid || !authToken || !fromNumber) return;

      const trackLink = `https://oyoplast.com/track`;

      const messages: Record<string, string> = {
        confirmed: `✅ تم تأكيد طلبك!\n━━━━━━━━━━━━━━━━━━━━━\n🆔 رقم الطلب: #${orderId}\nسنبدأ تجهيز طلبك قريباً.\n\n🔗 تتبع طلبك: ${trackLink}\n━━━━━━━━━━━━━━━━━━━━━\nأويو بلاست 🛍️`,
        preparing:  `⚙️ جاري تجهيز طلبك!\n━━━━━━━━━━━━━━━━━━━━━\n🆔 رقم الطلب: #${orderId}\nطلبك قيد التجهيز والتعبئة الآن.\n\n🔗 تتبع طلبك: ${trackLink}\n━━━━━━━━━━━━━━━━━━━━━\nأويو بلاست 🛍️`,
        shipped:    `🚚 تم شحن طلبك!\n━━━━━━━━━━━━━━━━━━━━━\n🆔 رقم الطلب: #${orderId}\n${extra?.trackingNumber ? `📦 رقم التتبع: ${extra.trackingNumber}\n` : ""}طلبك في الطريق إليك.\n\n🔗 تتبع طلبك: ${trackLink}\n━━━━━━━━━━━━━━━━━━━━━\nأويو بلاست 🛍️`,
        delivered:  `🎉 تم تسليم طلبك بنجاح!\n━━━━━━━━━━━━━━━━━━━━━\n🆔 رقم الطلب: #${orderId}\nنتمنى أن ينال طلبك إعجابك.\nشكراً لثقتك بأويو بلاست! 💙\n\n⭐ شاركنا رأيك وقيّم منتجاتك:\n🔗 https://oyoplast.replit.app/orders\n━━━━━━━━━━━━━━━━━━━━━\nأويو بلاست 🛍️`,
        cancelled:  `❌ تم إلغاء طلبك\n━━━━━━━━━━━━━━━━━━━━━\n🆔 رقم الطلب: #${orderId}\nللاستفسار تواصل معنا.\n━━━━━━━━━━━━━━━━━━━━━\nأويو بلاست 🛍️`,
      };

      const msg = messages[newStatus];
      if (!msg) return;

      await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: `whatsapp:${phone}`, From: `whatsapp:${fromNumber}`, Body: msg }),
        }
      );
    } catch (e: any) {
      console.error("Customer notification error:", e.message);
    }
  }

  async function notifySupplier(supplierId: number, orderId: number, orderData: any) {
    try {
      const { pool: dbPool } = await import("./db");
      const sup = await dbPool.query("SELECT * FROM suppliers WHERE id=$1", [supplierId]);
      if (!sup.rows.length) return;
      const supplier = sup.rows[0];
      const phone = supplier.phone.replace(/\s+/g, "").replace(/^00/, "+");

      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_FROM_NUMBER;
      if (!accountSid || !authToken || !fromNumber) return;

      const msg = `
📦 طلب جديد مُوكَّل إليك!
━━━━━━━━━━━━━━━━━━━━━
🆔 رقم الطلب: #${orderId}
👤 العميل: ${orderData.customerName || "—"}
📱 الجوال: ${orderData.customerPhone || "—"}
📍 المدينة: ${orderData.shippingCity || "—"}
💰 المبلغ المستحق لك: ${Number(orderData.supplierAmount || 0).toLocaleString()} ${orderData.currency || "ر.ي"}
━━━━━━━━━━━━━━━━━━━━━
أويو بلاست | oyoplast.com
      `.trim();

      await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: `whatsapp:${phone}`, From: `whatsapp:${fromNumber}`, Body: msg }),
        }
      );
      await dbPool.query("UPDATE orders SET supplier_notified=true WHERE id=$1", [orderId]);
    } catch (e: any) {
      console.error("Supplier notification error:", e.message);
    }
  }

  // ─── Haversine: احتساب المسافة بين نقطتين جغرافيتين (كيلومتر) ──────────
  function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // دالة تعيين المورد تلقائياً: GPS أولاً ثم المدينة ثم الأقرب عموماً
  async function autoAssignSupplier(
    orderId: number, city: string, orderTotal: number, currency: string,
    customerName: string, customerPhone: string,
    customerLat?: number, customerLng?: number
  ) {
    try {
      const { pool: dbPool } = await import("./db");
      let supplier: any = null;
      let distanceKm: number | null = null;

      // ── المرحلة ١: GPS-based — أقرب موزع ضمن نطاق خدمته ──────────────
      if (customerLat && customerLng) {
        const gpsRes = await dbPool.query(
          `SELECT * FROM suppliers WHERE is_active=true AND lat IS NOT NULL AND lng IS NOT NULL`
        );
        const withDist = gpsRes.rows.map((s: any) => ({
          ...s,
          _dist: haversineKm(customerLat!, customerLng!, Number(s.lat), Number(s.lng))
        }))
          .filter((s: any) => s._dist <= (s.service_radius_km || 20))
          .sort((a: any, b: any) => a._dist - b._dist);

        if (withDist.length > 0) {
          supplier = withDist[0];
          distanceKm = withDist[0]._dist;
        }
      }

      // ── المرحلة ٢: مطابقة المدينة — fallback ──────────────────────────
      if (!supplier && city) {
        const cityRes = await dbPool.query(
          `SELECT * FROM suppliers WHERE is_active=true AND $1=ANY(cities) ORDER BY id LIMIT 1`,
          [city]
        );
        if (cityRes.rows.length) supplier = cityRes.rows[0];
      }

      // ── المرحلة ٣: أقرب موزع متاح بصرف النظر عن المسافة ───────────────
      if (!supplier && customerLat && customerLng) {
        const allRes = await dbPool.query(
          `SELECT * FROM suppliers WHERE is_active=true AND lat IS NOT NULL AND lng IS NOT NULL`
        );
        if (allRes.rows.length) {
          const sorted = allRes.rows.map((s: any) => ({
            ...s,
            _dist: haversineKm(customerLat!, customerLng!, Number(s.lat), Number(s.lng))
          })).sort((a: any, b: any) => a._dist - b._dist);
          supplier = sorted[0];
          distanceKm = sorted[0]._dist;
        }
      }

      if (!supplier) return; // لا يوجد أي موزع نشط

      const commissionRate = Number(supplier.commission_rate || 10);
      const platformCommission = orderTotal * commissionRate / 100;
      const supplierAmount = orderTotal - platformCommission;

      await dbPool.query(
        `UPDATE orders SET supplier_id=$1, supplier_amount=$2, platform_commission=$3 WHERE id=$4`,
        [supplier.id, supplierAmount.toFixed(2), platformCommission.toFixed(2), orderId]
      );
      await dbPool.query(
        `UPDATE suppliers SET total_sales=COALESCE(total_sales,0)+$1, balance_due=COALESCE(balance_due,0)+$2 WHERE id=$3`,
        [orderTotal, supplierAmount, supplier.id]
      );
      await notifySupplier(supplier.id, orderId, {
        customerName, customerPhone, shippingCity: city, supplierAmount, currency,
        distanceKm: distanceKm ? distanceKm.toFixed(1) : null
      });
    } catch (e: any) {
      console.error("Auto-assign supplier error:", e.message);
    }
  }

  // جلب قائمة الموردين
  app.get("/api/admin/suppliers", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        `SELECT s.*, 
          (SELECT COUNT(*) FROM orders WHERE supplier_id=s.id) as total_orders,
          (SELECT COUNT(*) FROM orders WHERE supplier_id=s.id AND supplier_paid=false AND status NOT IN ('cancelled')) as unpaid_orders
         FROM suppliers s ORDER BY s.created_at DESC`
      );
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب الموردين" });
    }
  });

  // إضافة مورد جديد
  app.post("/api/admin/suppliers", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { name, phone, email, cities, commissionRate, notes, pin } = req.body;
      if (!name || !phone) return res.status(400).json({ message: "الاسم والهاتف مطلوبان" });
      const citiesArr = Array.isArray(cities) ? cities : (cities ? cities.split(",").map((c: string) => c.trim()) : []);
      const result = await dbPool.query(
        `INSERT INTO suppliers (name, phone, email, cities, commission_rate, notes, pin)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [name, phone, email || null, citiesArr, commissionRate || 10, notes || null, pin || "1234"]
      );
      res.json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل إضافة المورد" });
    }
  });

  // تعديل مورد
  app.put("/api/admin/suppliers/:id", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const id = parseInt(req.params.id);
      const { name, phone, email, cities, commissionRate, notes, isActive, pin, lat, lng, serviceRadiusKm, province, district } = req.body;
      const citiesArr = Array.isArray(cities) ? cities : (cities ? cities.split(",").map((c: string) => c.trim()) : []);
      const result = await dbPool.query(
        `UPDATE suppliers SET name=$1, phone=$2, email=$3, cities=$4, commission_rate=$5, notes=$6, is_active=$7, pin=COALESCE($8, pin),
         lat=COALESCE($9, lat), lng=COALESCE($10, lng), service_radius_km=COALESCE($11, service_radius_km),
         province=COALESCE($12, province), district=COALESCE($13, district)
         WHERE id=$14 RETURNING *`,
        [name, phone, email || null, citiesArr, commissionRate || 10, notes || null, isActive !== false, pin || null,
         lat != null ? lat : null, lng != null ? lng : null, serviceRadiusKm || null,
         province || null, district || null, id]
      );
      if (!result.rows.length) return res.status(404).json({ message: "المورد غير موجود" });
      res.json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تعديل المورد" });
    }
  });

  // حذف مورد
  app.delete("/api/admin/suppliers/:id", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const id = parseInt(req.params.id);
      await dbPool.query("UPDATE suppliers SET is_active=false WHERE id=$1", [id]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: "فشل حذف المورد" });
    }
  });

  // طلبات مورد معين
  app.get("/api/admin/suppliers/:id/orders", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const id = parseInt(req.params.id);
      const result = await dbPool.query(
        `SELECT * FROM orders WHERE supplier_id=$1 ORDER BY created_at DESC LIMIT 100`,
        [id]
      );
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب الطلبات" });
    }
  });

  // تسجيل دفعة للمورد
  app.post("/api/admin/suppliers/:id/pay", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const supplierId = parseInt(req.params.id);
      const { amount, notes, orderIds } = req.body;
      if (!amount || Number(amount) <= 0) return res.status(400).json({ message: "المبلغ مطلوب" });
      
      // سجّل الدفعة
      await dbPool.query(
        `INSERT INTO supplier_payments (supplier_id, amount, notes) VALUES ($1, $2, $3)`,
        [supplierId, amount, notes || null]
      );
      // حدّث رصيد المورد
      await dbPool.query(
        `UPDATE suppliers SET balance_due=GREATEST(0, COALESCE(balance_due,0)-$1), total_paid=COALESCE(total_paid,0)+$1 WHERE id=$2`,
        [amount, supplierId]
      );
      // إذا أُرسلت أرقام طلبات، علّم عليها كمدفوعة
      if (Array.isArray(orderIds) && orderIds.length > 0) {
        await dbPool.query(
          `UPDATE orders SET supplier_paid=true WHERE id=ANY($1) AND supplier_id=$2`,
          [orderIds, supplierId]
        );
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: "فشل تسجيل الدفعة" });
    }
  });

  // تعيين مورد يدوياً لطلب
  app.put("/api/admin/orders/:id/assign-supplier", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const orderId = parseInt(req.params.id);
      const { supplierId } = req.body;
      const orderRes = await dbPool.query("SELECT * FROM orders WHERE id=$1", [orderId]);
      if (!orderRes.rows.length) return res.status(404).json({ message: "الطلب غير موجود" });
      const order = orderRes.rows[0];
      const supRes = await dbPool.query("SELECT * FROM suppliers WHERE id=$1", [supplierId]);
      if (!supRes.rows.length) return res.status(404).json({ message: "المورد غير موجود" });
      const supplier = supRes.rows[0];
      const orderTotal = Number(order.total);
      const commRate = Number(supplier.commission_rate || 10);
      const platformCommission = orderTotal * commRate / 100;
      const supplierAmount = orderTotal - platformCommission;

      // إذا كان هناك مورد قديم، اطرح من رصيده
      if (order.supplier_id && order.supplier_id !== supplierId) {
        await dbPool.query(
          `UPDATE suppliers SET total_sales=GREATEST(0, COALESCE(total_sales,0)-$1), balance_due=GREATEST(0, COALESCE(balance_due,0)-$2) WHERE id=$3`,
          [orderTotal, Number(order.supplier_amount || 0), order.supplier_id]
        );
      }
      await dbPool.query(
        `UPDATE orders SET supplier_id=$1, supplier_amount=$2, platform_commission=$3, supplier_notified=false WHERE id=$4`,
        [supplierId, supplierAmount.toFixed(2), platformCommission.toFixed(2), orderId]
      );
      await dbPool.query(
        `UPDATE suppliers SET total_sales=COALESCE(total_sales,0)+$1, balance_due=COALESCE(balance_due,0)+$2 WHERE id=$3`,
        [orderTotal, supplierAmount, supplierId]
      );
      // إرسال إشعار
      await notifySupplier(supplierId, orderId, { customerName: order.customer_name, customerPhone: order.customer_phone, shippingCity: order.shipping_city, supplierAmount, currency: order.currency });
      res.json({ success: true, supplierAmount, platformCommission });
    } catch (e: any) {
      res.status(500).json({ message: "فشل تعيين المورد" });
    }
  });

  // إعادة إرسال إشعار واتساب للمورد
  app.post("/api/admin/orders/:id/notify-supplier", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const orderId = parseInt(req.params.id);
      const orderRes = await dbPool.query("SELECT * FROM orders WHERE id=$1", [orderId]);
      if (!orderRes.rows.length) return res.status(404).json({ message: "الطلب غير موجود" });
      const order = orderRes.rows[0];
      if (!order.supplier_id) return res.status(400).json({ message: "لا يوجد مورد مُعيَّن لهذا الطلب" });
      await notifySupplier(order.supplier_id, orderId, { customerName: order.customer_name, customerPhone: order.customer_phone, shippingCity: order.shipping_city, supplierAmount: order.supplier_amount, currency: order.currency });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: "فشل الإشعار" });
    }
  });

  // لوحة أداء المورد
  app.get("/api/admin/suppliers/:id/performance", requireAdmin, async (req, res) => {
    try {
      const supplierId = parseInt(req.params.id);
      const { pool: dbPool } = await import("./db");
      const stats = await dbPool.query(`
        SELECT
          COUNT(*) as total_orders,
          COUNT(CASE WHEN status='delivered' THEN 1 END) as delivered_orders,
          COUNT(CASE WHEN status='cancelled' THEN 1 END) as cancelled_orders,
          COUNT(CASE WHEN status IN ('pending','confirmed','preparing','shipped') THEN 1 END) as active_orders,
          COALESCE(SUM(total::numeric), 0) as total_revenue,
          COALESCE(SUM(CASE WHEN status='delivered' THEN supplier_amount::numeric ELSE 0 END), 0) as total_paid,
          COALESCE(SUM(CASE WHEN status='delivered' THEN supplier_amount::numeric ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN supplier_paid=true THEN supplier_amount::numeric ELSE 0 END), 0) as pending_payment,
          0 as avg_delivery_days
        FROM orders WHERE supplier_id=$1
      `, [supplierId]);
      
      const monthly = await dbPool.query(`
        SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month,
               COUNT(*) as orders,
               SUM(total::numeric) as revenue
        FROM orders
        WHERE supplier_id=$1 AND created_at >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY DATE_TRUNC('month', created_at)
      `, [supplierId]);

      const topProducts = await dbPool.query(`
        SELECT oi.product_name, SUM(oi.quantity) as units, SUM(oi.price::numeric * oi.quantity) as revenue
        FROM order_items oi
        JOIN orders o ON oi.order_id=o.id
        WHERE o.supplier_id=$1
        GROUP BY oi.product_name
        ORDER BY revenue DESC LIMIT 5
      `, [supplierId]);

      const s = stats.rows[0];
      res.json({
        stats: {
          totalOrders: Number(s.total_orders),
          deliveredOrders: Number(s.delivered_orders),
          cancelledOrders: Number(s.cancelled_orders),
          activeOrders: Number(s.active_orders),
          totalRevenue: Number(s.total_revenue),
          totalPaid: Number(s.total_paid),
          pendingPayment: Number(s.pending_payment),
          avgDeliveryDays: s.avg_delivery_days ? Number(s.avg_delivery_days).toFixed(1) : null,
          deliveryRate: s.total_orders > 0 ? ((Number(s.delivered_orders) / Number(s.total_orders)) * 100).toFixed(1) : 0,
        },
        monthly: monthly.rows,
        topProducts: topProducts.rows,
      });
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب البيانات", details: e.message });
    }
  });

  app.get("/api/admin/suppliers/:id/payments", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        `SELECT * FROM supplier_payments WHERE supplier_id=$1 ORDER BY paid_at DESC`,
        [parseInt(req.params.id)]
      );
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب السجل" });
    }
  });

  // ─── Admin Stats ─────────────────────────────────────────────────
  app.get("/api/admin/stats", requireAdmin, async (_req, res) => {
    try {
      const stats = await storage.getOrderStats();
      res.json(stats);
    } catch (e) {
      res.status(500).json({ message: "فشل جلب الإحصائيات" });
    }
  });

  // ─── Categories (Public) ─────────────────────────────────────────
  app.get("/api/categories", async (_req, res) => {
    const { pool: dbPool } = await import("./db");
    const cats = await storage.getCategories();
    // إضافة عدد المنتجات لكل قسم
    const countResult = await dbPool.query(
      `SELECT category_id, COUNT(*) as count FROM products WHERE (product_status IS NULL OR product_status = 'approved') GROUP BY category_id`
    );
    const countMap: Record<number, number> = {};
    for (const row of countResult.rows) { countMap[row.category_id] = parseInt(row.count); }
    res.json(cats.map((c: any) => ({ ...c, productCount: countMap[c.id] || 0 })));
  });

  // ─── Subcategories (Public) ──────────────────────────────────────
  app.get("/api/subcategories", async (req, res) => {
    const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
    const subs = await storage.getSubcategories(categoryId);
    res.json(subs);
  });

  app.get("/api/subcategories/by-slug/:slug", async (req, res) => {
    const sub = await storage.getSubcategoryBySlug(req.params.slug);
    if (!sub) return res.status(404).json({ message: "Not found" });
    res.json(sub);
  });

  // ─── Subcategories Admin CRUD ────────────────────────────────────
  app.post("/api/admin/subcategories", requireAdmin, async (req, res) => {
    try {
      const sub = await storage.createSubcategory(req.body);
      res.json(sub);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.patch("/api/admin/subcategories/:id", requireAdmin, async (req, res) => {
    try {
      const sub = await storage.updateSubcategory(parseInt(req.params.id), req.body);
      res.json(sub);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.delete("/api/admin/subcategories/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteSubcategory(parseInt(req.params.id));
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // ─── Products (Public) ───────────────────────────────────────────
  // ─── Image serving (converts base64 DB data to real HTTP images) ──
  app.get("/api/products/image/:id", async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) return res.status(400).send("Invalid ID");
      const result = await dbPool.query("SELECT image_url FROM products WHERE id = $1", [id]);
      if (!result.rows.length) return res.status(404).send("Not found");
      const imageUrl = result.rows[0].image_url;
      if (!imageUrl) return res.status(404).send("No image");
      if (!imageUrl.startsWith("data:")) return res.redirect(imageUrl);
      const matches = imageUrl.match(new RegExp("^data:([^;]+);base64,(.+)$", "s"));
      if (!matches) return res.status(400).send("Invalid image data");
      const mimeType = matches[1];
      const imageData = Buffer.from(matches[2], "base64");
      res.set("Content-Type", mimeType);
      res.set("Cache-Control", "public, max-age=604800");
      res.send(imageData);
    } catch (err: any) {
      res.status(500).send("Error");
    }
  });

  app.get("/api/products/image/:id/:imgIndex", async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const id = parseInt(req.params.id);
      const imgIndex = parseInt(req.params.imgIndex);
      if (Number.isNaN(id) || Number.isNaN(imgIndex)) return res.status(400).send("Invalid params");
      const result = await dbPool.query("SELECT image_urls FROM products WHERE id = $1", [id]);
      if (!result.rows.length) return res.status(404).send("Not found");
      const imageUrls = result.rows[0].image_urls;
      if (!imageUrls || !imageUrls[imgIndex]) return res.status(404).send("No image at index");
      const imageUrl = imageUrls[imgIndex];
      if (!imageUrl.startsWith("data:")) return res.redirect(imageUrl);
      const matches = imageUrl.match(new RegExp("^data:([^;]+);base64,(.+)$", "s"));
      if (!matches) return res.status(400).send("Invalid image data");
      const mimeType = matches[1];
      const imageData = Buffer.from(matches[2], "base64");
      res.set("Content-Type", mimeType);
      res.set("Cache-Control", "public, max-age=604800");
      res.send(imageData);
    } catch (err: any) {
      res.status(500).send("Error");
    }
  });

  const LITE_COLS = `id, name, description, price, price_sar, category_id, image_url,
    stock, colors, sizes, allow_design_upload, bulk_pricing, size_pricing,
    printing_price_per_unit, rating, review_count, sold_count, commission_hold_days,
    marketer_commission_rate, has_printing_options, base_bag_price, single_color_print_price,
    available_bag_colors, tags, show_reviews, show_in_printing, enable_variant_ui, color_images,
    original_price, original_price_sar, discount_percent, promotional_tags,
    has_free_shipping, enable_smart_variants, smart_variants`;

  function mapProductRow(r: any) {
    const rawImg: string = r.image_url || "";
    // حساب نسبة الخصم الفعلية
    let effectiveDiscount: number | null = null;
    if (r.discount_percent != null) {
      effectiveDiscount = Number(r.discount_percent);
    } else if (r.original_price != null && r.price != null) {
      const orig = Number(r.original_price);
      const curr = Number(r.price);
      if (orig > curr && orig > 0) {
        effectiveDiscount = Math.round(((orig - curr) / orig) * 100);
      }
    }
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      price: r.price,
      priceSar: r.price_sar,
      categoryId: r.category_id,
      imageUrl: rawImg.startsWith("data:") ? `/api/products/image/${r.id}` : (rawImg || null),
      imageUrls: [],
      stock: r.stock,
      colors: r.colors,
      sizes: r.sizes,
      allowDesignUpload: r.allow_design_upload,
      bulkPricing: r.bulk_pricing,
      sizePricing: r.size_pricing,
      printingPricePerUnit: r.printing_price_per_unit,
      rating: r.rating,
      reviewCount: r.review_count,
      soldCount: r.sold_count,
      commissionHoldDays: r.commission_hold_days,
      marketerCommissionRate: r.marketer_commission_rate,
      hasPrintingOptions: r.has_printing_options,
      baseBagPrice: r.base_bag_price,
      singleColorPrintPrice: r.single_color_print_price,
      availableBagColors: r.available_bag_colors,
      tags: r.tags,
      showReviews: r.show_reviews,
      showInPrinting: r.show_in_printing,
    enableVariantUI: r.enable_variant_ui ?? false,
    colorImages: r.color_images ?? null,
      originalPrice: r.original_price ?? null,
      originalPriceSar: r.original_price_sar ?? null,
      discountPercent: r.discount_percent ?? null,
      effectiveDiscount,
      promotionalTags: r.promotional_tags ?? [],
      hasFreeShipping: r.has_free_shipping ?? false,
      enableSmartVariants: r.enable_smart_variants ?? false,
      smartVariants: r.smart_variants ?? null,
    };
  }

  app.get("/api/products", async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      let categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
      const categorySlug = req.query.category as string | undefined;
      const subcategorySlug = req.query.subcategory as string | undefined;
      const search = req.query.search as string | undefined;
      const filter = req.query.filter as string | undefined; // free-shipping | flash-deals

      // resolve slug → id if needed
      if ((!categoryId || Number.isNaN(categoryId)) && categorySlug) {
        const catRow = await dbPool.query(`SELECT id FROM categories WHERE slug = $1 LIMIT 1`, [categorySlug]);
        if (catRow.rows.length > 0) categoryId = catRow.rows[0].id;
      }

      let subcategoryId: number | undefined;
      if (subcategorySlug) {
        const subRow = await dbPool.query(`SELECT id FROM subcategories WHERE slug = $1 LIMIT 1`, [subcategorySlug]);
        if (subRow.rows.length > 0) subcategoryId = subRow.rows[0].id;
      }

      let query = `SELECT ${LITE_COLS} FROM products`;
      const params: any[] = [];
      const conditions: string[] = [];
      let idx = 1;

      // إخفاء منتجات الموردين غير المعتمدة من المتجر العام
      conditions.push(`(product_status IS NULL OR product_status = 'approved')`);

      // فلترة البنرات الخاصة
      if (filter === 'free-shipping') {
        conditions.push(`has_free_shipping = true`);
      } else if (filter === 'flash-deals') {
        conditions.push(`(original_price IS NOT NULL OR discount_percent IS NOT NULL)`);
      }

      if (categoryId !== undefined && !Number.isNaN(categoryId)) {
        conditions.push(`category_id = $${idx++}`);
        params.push(categoryId);
      }
      if (subcategoryId !== undefined) {
        conditions.push(`subcategory_id = $${idx++}`);
        params.push(subcategoryId);
      }
      if (conditions.length > 0) query += ` WHERE ${conditions.join(" AND ")}`;
      query += ` ORDER BY id DESC`;

      const result = await dbPool.query(query, params);
      let rows = result.rows.map(mapProductRow);

      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        rows = rows.filter((p: any) =>
          (p.name || "").toLowerCase().includes(q) ||
          (p.description || "").toLowerCase().includes(q) ||
          (Array.isArray(p.tags) ? p.tags : []).some((t: any) => String(t).toLowerCase().includes(q))
        );
      }

      res.json(rows);
    } catch (error: any) {
      console.error("خطأ في جلب المنتجات:", error);
      res.status(500).json({ message: "فشل في جلب المنتجات", details: error.message });
    }
  });

  app.get("/api/products/bestselling", async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 8;
      const result = await dbPool.query(
        `SELECT ${LITE_COLS} FROM products WHERE (product_status IS NULL OR product_status = 'approved') ORDER BY sold_count DESC NULLS LAST LIMIT $1`,
        [limit]
      );
      res.json(result.rows.map(mapProductRow));
    } catch (error: any) {
      console.error("خطأ في جلب الأكثر مبيعاً:", error);
      res.status(500).json({ message: "فشل في جلب الأكثر مبيعاً", details: error.message });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) return res.status(404).json({ message: "المنتج غير موجود" });
      const result = await dbPool.query(
        `SELECT ${LITE_COLS}, cardinality(image_urls) as extra_count FROM products WHERE id = $1`,
        [id]
      );
      if (!result.rows.length) return res.status(404).json({ message: "المنتج غير موجود" });
      const r = result.rows[0];
      const extraCount = r.extra_count || 0;
      const product = {
        ...mapProductRow(r),
        imageUrls: Array.from({ length: extraCount }, (_: any, i: number) => `/api/products/image/${id}/${i}`),
      };
      res.json(product);
    } catch (error: any) {
      console.error("خطأ في جلب المنتج:", error);
      res.status(500).json({ message: "فشل في جلب المنتج", details: error.message });
    }
  });

  // ─── Product Reviews ─────────────────────────────────────────────
  app.get("/api/products/:id/reviews", async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      if (Number.isNaN(productId)) return res.status(400).json({ message: "معرف غير صحيح" });
      const reviews = await storage.getProductReviews(productId);
      res.json(reviews);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب التقييمات" });
    }
  });

  app.post("/api/products/:id/reviews", async (req: any, res) => {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ message: "يجب تسجيل الدخول لإضافة تقييم" });
      }
      const productId = parseInt(req.params.id);
      if (Number.isNaN(productId)) return res.status(400).json({ message: "معرف غير صحيح" });
      const { rating, comment, imageUrl } = req.body;
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "التقييم يجب أن يكون بين 1 و 5" });
      }
      const userId = req.user?.id || req.session?.userId;
      if (!userId) return res.status(401).json({ message: "غير مصرح" });
      const review = await storage.createReview({ productId, userId, rating: parseInt(rating), comment, imageUrl });
      res.status(201).json(review);
    } catch (e: any) {
      res.status(500).json({ message: "فشل إضافة التقييم" });
    }
  });

  app.post("/api/upload/review", upload.single("image"), async (req: any, res) => {
    if (!req.file) return res.status(400).json({ message: "لا يوجد ملف" });
    try {
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;
      if (cloudName && apiKey && apiSecret) {
        const { v2: cloudinary } = await import("cloudinary");
        cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
        const uploadRes: any = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "oyo-plast/reviews", resource_type: "image" },
            (err: any, result: any) => err ? reject(err) : resolve(result)
          );
          stream.end(req.file!.buffer);
        });
        return res.json({ imageUrl: uploadRes.secure_url });
      }
      // fallback: base64
      const { pool: dbPool } = await import("./db");
      const settings = await getImageSettings(dbPool);
      const { buffer, mimeOut } = await processImage(req.file.buffer, req.file.mimetype, {
        maxWidth: Math.min(settings.img_max_width, 800),
        maxHeight: Math.min(settings.img_max_height, 800),
        quality: settings.img_quality,
      });
      res.json({ imageUrl: `data:${mimeOut};base64,${buffer.toString("base64")}` });
    } catch (e: any) {
      const base64 = req.file.buffer.toString("base64");
      res.json({ imageUrl: `data:${req.file.mimetype};base64,${base64}` });
    }
  });

  app.get("/api/admin/reviews", requireAdmin, async (_req, res) => {
    try {
      const reviews = await storage.getAllReviews();
      res.json(reviews);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب التقييمات" });
    }
  });

  // ─── Approve review ──────────────────────────────────────────────
  app.patch("/api/admin/reviews/:id/approve", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { approved } = req.body;
      await dbPool.query(`UPDATE reviews SET is_approved=$1 WHERE id=$2`, [approved !== false, req.params.id]);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث التقييم" });
    }
  });

  app.delete("/api/admin/reviews/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ message: "معرف غير صحيح" });
      await storage.deleteReview(id);
      res.json({ message: "تم حذف التقييم" });
    } catch (e: any) {
      res.status(500).json({ message: "فشل حذف التقييم" });
    }
  });

  // ─── Admin Categories ────────────────────────────────────────────
  app.get("/api/admin/categories", requireAdmin, async (_req, res) => {
    const cats = await storage.getCategories();
    res.json(cats);
  });

  app.post("/api/admin/categories", requireAdmin, async (req, res) => {
    try {
      const { name, slug, imageUrl, iconUrl, sortOrder, isActive } = req.body;
      if (!name) return res.status(400).json({ message: "الاسم مطلوب" });
      const category = await storage.createCategory({
        name,
        slug: slug || generateSlug(name),
        imageUrl: imageUrl || "",
        iconUrl: iconUrl || null,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
      });
      res.status(201).json(category);
    } catch (e: any) {
      res.status(500).json({ message: "فشل إنشاء القسم", details: e.message });
    }
  });

  app.patch("/api/admin/categories/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, slug, imageUrl, iconUrl, sortOrder, isActive } = req.body;
      const update: any = {};
      if (name !== undefined) { update.name = name; if (!slug) update.slug = generateSlug(name); }
      if (slug !== undefined) update.slug = slug;
      if (imageUrl !== undefined) update.imageUrl = imageUrl;
      if (iconUrl !== undefined) update.iconUrl = iconUrl;
      if (sortOrder !== undefined) update.sortOrder = sortOrder;
      if (isActive !== undefined) update.isActive = isActive;
      const category = await storage.updateCategory(id, update);
      res.json(category);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث القسم", details: e.message });
    }
  });

  app.delete("/api/admin/categories/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteCategory(parseInt(req.params.id));
      res.json({ message: "تم الحذف بنجاح" });
    } catch (e: any) {
      res.status(500).json({ message: "فشل حذف القسم - قد يحتوي على منتجات", details: e.message });
    }
  });

  // ─── Admin Products ──────────────────────────────────────────────
  app.get("/api/admin/products", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        `SELECT ${LITE_COLS}, cardinality(image_urls) as extra_count FROM products ORDER BY id DESC`
      );
      const rows = result.rows.map((r: any) => ({
        ...mapProductRow(r),
        imageUrls: Array.from({ length: r.extra_count || 0 }, (_: any, i: number) => `/api/products/image/${r.id}/${i}`),
      }));
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحميل المنتجات", details: e.message });
    }
  });

  app.post("/api/admin/products", requireAdmin, async (req, res) => {
    try {
      const data = req.body;
      if (!data.name || !data.price || !data.categoryId || !data.imageUrl) {
        return res.status(400).json({ message: "البيانات المطلوبة: name, price, categoryId, imageUrl" });
      }
      const product = await storage.createProduct({
        name: data.name,
        description: data.description || "",
        price: String(data.price),
        priceSar: data.priceSar ? String(data.priceSar) : null,
        categoryId: Number(data.categoryId),
        imageUrl: data.imageUrl,
        imageUrls: data.imageUrls || null,
        stock: Number(data.stock ?? 100),
        colors: data.colors || null,
        sizes: data.sizes || null,
        allowDesignUpload: data.allowDesignUpload ?? false,
        bulkPricing: data.bulkPricing || null,
        sizePricing: data.sizePricing || null,
        printingPricePerUnit: data.printingPricePerUnit ? String(data.printingPricePerUnit) : null,
        hasPrintingOptions: data.hasPrintingOptions ?? false,
        baseBagPrice: data.baseBagPrice ? String(data.baseBagPrice) : null,
        singleColorPrintPrice: data.singleColorPrintPrice ? String(data.singleColorPrintPrice) : null,
        availableBagColors: data.availableBagColors || null,
        tags: data.tags || null,
        originalPrice: data.originalPrice ? String(data.originalPrice) : null,
        originalPriceSar: data.originalPriceSar ? String(data.originalPriceSar) : null,
        discountPercent: data.discountPercent ? Number(data.discountPercent) : null,
        promotionalTags: data.promotionalTags || null,
      } as any);
      res.status(201).json(product);
    } catch (e: any) {
      res.status(500).json({ message: "فشل إنشاء المنتج", details: e.message });
    }
  });

  app.patch("/api/admin/products/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = req.body;

      // ── Safety Net: رفض أي سعر أقل من الحد الأحمر ──────────────────
      if (data.price !== undefined) {
        const { pool: dbPool } = await import("./db");
        const costRow = await dbPool.query(
          `SELECT red_line_price FROM product_costs WHERE product_id=$1`, [id]
        );
        if (costRow.rows[0]) {
          const redLine = parseFloat(costRow.rows[0].red_line_price);
          const newPrice = parseFloat(String(data.price));
          if (redLine > 0 && newPrice < redLine) {
            return res.status(422).json({
              message: `⛔ السعر المدخل (${newPrice.toLocaleString()} ر.ي) أقل من الحد الأحمر (${redLine.toLocaleString()} ر.ي). لا يمكن الحفظ.`,
              redLine,
              enteredPrice: newPrice,
            });
          }
        }
      }
      // ─────────────────────────────────────────────────────────────────

      const fields = [
        "name", "description", "price", "priceSar", "categoryId",
        "imageUrl", "imageUrls", "stock", "colors", "sizes",
        "allowDesignUpload", "printingPricePerUnit", "hasPrintingOptions",
        "baseBagPrice", "singleColorPrintPrice", "availableBagColors", "tags",
        "bulkPricing", "sizePricing", "showReviews", "enableVariantUI", "colorImages",
        "originalPrice", "originalPriceSar", "discountPercent", "promotionalTags",
        "hasFreeShipping", "enableSmartVariants", "smartVariants"
      ];
      const update = pickFields(data as Record<string, unknown>, fields);
      const product = await storage.updateProduct(id, update);
      res.json(product);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث المنتج", details: e.message });
    }
  });

  app.delete("/api/admin/products/:id", requireAdmin, async (req, res) => {
    try {
      const pid = parseInt(req.params.id);
      const { pool: dbPool } = await import("./db");
      // حذف آمن: نزيل أو نلغي كل المراجع قبل حذف المنتج
      await dbPool.query(`DELETE FROM cart_items WHERE product_id = $1`, [pid]);
      await dbPool.query(`UPDATE order_items SET product_id = NULL WHERE product_id = $1`, [pid]);
      await dbPool.query(`DELETE FROM reviews WHERE product_id = $1`, [pid]);
      await dbPool.query(`DELETE FROM wishlist WHERE product_id = $1`, [pid]);
      await dbPool.query(`DELETE FROM product_views WHERE product_id = $1`, [pid]);
      await dbPool.query(`DELETE FROM product_costs WHERE product_id = $1`, [pid]);
      await storage.deleteProduct(pid);
      res.json({ message: "تم الحذف بنجاح" });
    } catch (e: any) {
      res.status(500).json({ message: "فشل حذف المنتج", details: e.message });
    }
  });

  // ─── Home Sections (أقسام الصفحة الرئيسية) ───────────────────────
  app.get("/api/home-sections", async (_req, res) => {
    try {
      const sections = await storage.getHomeSections();
      res.json(sections);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب الأقسام", details: e.message });
    }
  });

  app.post("/api/admin/home-sections", requireAdmin, async (req, res) => {
    try {
      const section = await storage.createHomeSection(req.body);
      res.status(201).json(section);
    } catch (e: any) {
      res.status(500).json({ message: "فشل إنشاء القسم", details: e.message });
    }
  });

  app.patch("/api/admin/home-sections/:id", requireAdmin, async (req, res) => {
    try {
      // حذف الحقول التلقائية لمنع خطأ التحويل
      const { id: _id, createdAt: _createdAt, ...data } = req.body;
      const section = await storage.updateHomeSection(parseInt(req.params.id), data);
      res.json(section);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث القسم", details: e.message });
    }
  });

  app.delete("/api/admin/home-sections/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteHomeSection(parseInt(req.params.id));
      res.json({ message: "تم الحذف" });
    } catch (e: any) {
      res.status(500).json({ message: "فشل الحذف", details: e.message });
    }
  });

  // ─── Products by promotional tag ───────────────────────────────
  app.get("/api/products/by-tag/:tag", async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const tag = req.params.tag;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 8;
      let rows: any[];
      if (tag === "bestsellers") {
        const result = await dbPool.query(
          `SELECT ${LITE_COLS} FROM products ORDER BY sold_count DESC NULLS LAST LIMIT $1`, [limit]
        );
        rows = result.rows.map(mapProductRow);
      } else if (tag === "new") {
        const result = await dbPool.query(
          `SELECT ${LITE_COLS} FROM products ORDER BY id DESC LIMIT $1`, [limit]
        );
        rows = result.rows.map(mapProductRow);
      } else if (tag === "discounts") {
        const result = await dbPool.query(
          `SELECT ${LITE_COLS} FROM products WHERE original_price IS NOT NULL OR discount_percent IS NOT NULL ORDER BY id DESC LIMIT $1`, [limit]
        );
        rows = result.rows.map(mapProductRow);
      } else {
        const result = await dbPool.query(
          `SELECT ${LITE_COLS} FROM products WHERE $1 = ANY(promotional_tags) ORDER BY id DESC LIMIT $2`,
          [tag, limit]
        );
        rows = result.rows.map(mapProductRow);
      }
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب المنتجات", details: e.message });
    }
  });

  // ─── Admin Banners ───────────────────────────────────────────────
  app.get("/api/admin/banners", requireAdmin, async (_req, res) => {
    res.json(await storage.getBanners());
  });

  app.get("/api/banners", async (_req, res) => {
    const all = await storage.getBanners();
    res.json(all.filter(b => b.isActive));
  });

  app.post("/api/admin/banners", requireAdmin, async (req, res) => {
    try {
      const banner = await storage.createBanner(req.body);
      res.status(201).json(banner);
    } catch (e: any) {
      res.status(500).json({ message: "فشل إنشاء البنر", details: e.message });
    }
  });

  app.patch("/api/admin/banners/:id", requireAdmin, async (req, res) => {
    try {
      const banner = await storage.updateBanner(parseInt(req.params.id), req.body);
      res.json(banner);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث البنر", details: e.message });
    }
  });

  app.delete("/api/admin/banners/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteBanner(parseInt(req.params.id));
      res.json({ message: "تم الحذف" });
    } catch (e: any) {
      res.status(500).json({ message: "فشل حذف البنر", details: e.message });
    }
  });

  // ─── Admin Offers ────────────────────────────────────────────────
  app.get("/api/admin/offers", requireAdmin, async (_req, res) => {
    res.json(await storage.getOffers());
  });

  app.get("/api/offers", async (_req, res) => {
    const all = await storage.getOffers();
    res.json(all.filter(o => o.isActive));
  });

  app.post("/api/admin/offers", requireAdmin, async (req, res) => {
    try {
      const offer = await storage.createOffer(req.body);
      res.status(201).json(offer);
    } catch (e: any) {
      res.status(500).json({ message: "فشل إنشاء العرض", details: e.message });
    }
  });

  app.patch("/api/admin/offers/:id", requireAdmin, async (req, res) => {
    try {
      const offer = await storage.updateOffer(parseInt(req.params.id), req.body);
      res.json(offer);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث العرض", details: e.message });
    }
  });

  app.delete("/api/admin/offers/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteOffer(parseInt(req.params.id));
      res.json({ message: "تم الحذف" });
    } catch (e: any) {
      res.status(500).json({ message: "فشل حذف العرض", details: e.message });
    }
  });

  // ─── Navigation Settings (Public) ─────────────────────────────────
  app.get("/api/navigation-settings", async (_req, res) => {
    try {
      const settings = await storage.getNavigationSettings();
      res.json(settings);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب إعدادات التنقل" });
    }
  });

  // ─── Printing Products (Public) ───────────────────────────────────
  app.get("/api/printing-products", async (_req, res) => {
    try {
      const products = await storage.getPrintingProducts();
      res.json(products);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب منتجات الطباعة" });
    }
  });

  // ─── Visitor Tracking (Public) ────────────────────────────────────
  app.post("/api/track-visit", async (req, res) => {
    try {
      const { sessionId } = req.body;
      if (!sessionId) return res.json({ ok: true });
      const { pool: dbPool } = await import("./db");
      const client = await dbPool.connect();
      try {
        await client.query(`
          INSERT INTO visitor_sessions (session_id, last_seen, page_views)
          VALUES ($1, NOW(), 1)
          ON CONFLICT (session_id) DO UPDATE
          SET last_seen = NOW(), page_views = visitor_sessions.page_views + 1
        `, [sessionId]);
      } finally { client.release(); }
      res.json({ ok: true });
    } catch { res.json({ ok: true }); }
  });

  // ─── Admin Stats ───────────────────────────────────────────────────
  app.get("/api/admin/stats", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const client = await dbPool.connect();
      try {
        const [usersRes, visitorsRes, activeRes] = await Promise.all([
          client.query(`SELECT COUNT(*) FROM users`),
          client.query(`SELECT COUNT(DISTINCT session_id) FROM visitor_sessions`),
          client.query(`SELECT COUNT(DISTINCT session_id) FROM visitor_sessions WHERE last_seen > NOW() - INTERVAL '5 minutes'`),
        ]);
        res.json({
          registeredUsers: parseInt(usersRes.rows[0].count),
          totalVisitors: parseInt(visitorsRes.rows[0].count),
          activeNow: parseInt(activeRes.rows[0].count),
        });
      } finally { client.release(); }
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب الإحصائيات", details: e.message });
    }
  });

  // ─── Home Page Settings (Madeline Theme) ──────────────────────────
  app.get("/api/home-settings", async (_req, res) => {
    try {
      const settings = await storage.getHomePageSettings();
      res.json(settings);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب إعدادات الصفحة الرئيسية" });
    }
  });

  app.patch("/api/admin/home-settings", requireAdmin, async (req, res) => {
    try {
      const body = req.body;
      const updateData: Record<string, any> = {
        showHeader: body.showHeader ?? true,
        showBanners: body.showBanners ?? true,
        showOffers: body.showOffers ?? true,
        showCategories: body.showCategories ?? true,
        footerPrivacyText: body.footerPrivacyText ?? "سياسة الخصوصية",
        footerAffiliateText: body.footerAffiliateText ?? "التسويق بالعمولة",
        footerReturnsText: body.footerReturnsText ?? "سياسة الاسترجاع",
        footerBottomText: body.footerBottomText ?? "أويو بلاست - مستلزمات التغليف",
        signupEntryMode: body.signupEntryMode ?? "cart",
        loginFlow: body.loginFlow ?? "checkout",
      };
      if (body.primaryColor !== undefined) updateData.primaryColor = body.primaryColor;
      if (body.accentColor !== undefined) updateData.accentColor = body.accentColor;
      if (body.privacyContent !== undefined) updateData.privacyContent = body.privacyContent;
      if (body.returnsContent !== undefined) updateData.returnsContent = body.returnsContent;
      if (body.affiliateContent !== undefined) updateData.affiliateContent = body.affiliateContent;
      const settings = await storage.updateHomePageSettings(updateData as any);
      res.json(settings);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث إعدادات الصفحة الرئيسية", details: e.message });
    }
  });

  // ─── Display Settings (Public) ───────────────────────────────────
  app.get("/api/display-settings", async (_req, res) => {
    try {
      const settings = await storage.getDisplaySettings();
      res.json(settings);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب إعدادات العرض" });
    }
  });

  app.patch("/api/admin/display-settings", requireAdmin, async (req, res) => {
    try {
      // حقول صحيحة معروفة — integer fields
      const intFields = [
        'categorySize', 'categoriesPerRow',
        'productCardWidth', 'productCardHeight',
        'offerBannerHeight',
        'productCardMargin', 'productCardPaddingV', 'priceFontSize',
        'discountBubbleSize', 'quantityButtonHeight',
        'detailImageHeight', 'detailPriceFontSize',
        'detailAddToCartHeight', 'detailThumbnailSize',
        'detailPaddingV', 'detailMarginH', 'detailSectionGap', 'detailTopPadding', 'detailDiscountBubbleSize',
        'sadeemFreeShippingMin', 'sadeemMarketerDiscount',
        'shippingFee', 'sliderHeight', 'offerBannerCols',
        'installmentMinAmount', 'categoriesRows', 'categoriesBorderRadius',
        'drawerWidth',
      ];
      // boolean fields
      const boolFields = [
        'showCategories', 'showOfferBanners',
        'detailShowRelated', 'detailShowReviews', 'showStickyCartBar',
        'detailShowThumbnails',
        'sadeemShowOldPrice', 'sadeemShowDiscountBadge',
        'sadeemShowRating', 'sadeemShowSoldCount',
        'sadeemShowShipping', 'sadeemShowReturns',
        'codEnabled', 'installmentEnabled',
        // ── أقسام الصفحة الرئيسية ──
        'showWhyUs', 'whyUsOnHome', 'whyUsOnAccount',
        'showStats', 'statsOnHome', 'statsOnAccount',
        'showFaq', 'faqOnHome', 'faqOnAccount',
        // ── صفحة المنتج — نمط وأزرار ──
        'detailSheinLayout', 'detailShowAddToCart', 'detailShowShopNow',
      ];
      // text fields
      const textFields = [
        'imageMode', 'detailImageMode', 'discountBadgeBg',
        'whyUsSize', 'statsSize', 'faqSize',
        'installmentPercentages', 'categoriesLayout', 'categoriesShape',
        'drawerBgFrom', 'drawerBgTo',
        'offerBannerShippingBg', 'offerBannerDealsBg',
        'appFontArabic', 'appFontNumbers',
      ];

      const body = req.body as Record<string, unknown>;
      const patch: Record<string, any> = {
        ...Object.fromEntries(
          Object.entries(pickFields(body, intFields)).map(([k, v]) => [k, parseInt(v as string)])
        ),
        ...pickFields(body, boolFields),
        ...pickFields(body, textFields),
      };

      const settings = await storage.updateDisplaySettings(patch);
      res.json(settings);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث إعدادات العرض", details: e.message });
    }
  });

  app.patch("/api/admin/navigation-settings", requireAdmin, async (req, res) => {
    try {
      const allowed = [
        "showPrintingSection", "showSignupEntryPoint", "enableVariantProductPage",
        "lockMobilePwaMode", "disablePinchZoom", "disableHorizontalScroll",
        "enablePhoneLogin", "enableEmailLogin",
        "loginShowOnTop", "loginShowOnCheckout", "loginShowOnAccount",
      ];
      const patch = pickFields(req.body as Record<string, unknown>, allowed);
      const settings = await storage.updateNavigationSettings(patch);
      res.json(settings);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث إعدادات التنقل", details: e.message });
    }
  });

  // ─── Admin Products - Update Printing Status ──────────────────────
  app.patch("/api/admin/products/:id/printing-status", requireAdmin, async (req, res) => {
    try {
      const product = await storage.updateProduct(parseInt(req.params.id), {
        showInPrinting: req.body.showInPrinting ?? false,
      });
      res.json(product);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث حالة الطباعة", details: e.message });
    }
  });

  // ─── Get User Orders ────────────────────────
  app.get("/api/orders", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user || !getUserId(user)) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { db: dbInstance } = await import("./db");
      const { orders: ordersTable } = await import("@shared/schema");
      const { eq: eqFn } = await import("drizzle-orm");
      const { desc: descFn } = await import("drizzle-orm");

      const userOrders = await dbInstance
        .select()
        .from(ordersTable)
        .where(eqFn(ordersTable.userId, getUserId(user) as string))
        .orderBy(descFn(ordersTable.createdAt));

      res.json(userOrders);
    } catch (e: any) {
      res.status(500).json({ message: "Failed to fetch orders", details: e.message });
    }
  });

  // ─── Create Order (Public - for checkout) ────────────────────────
  app.post("/api/orders/create", orderLimiter, async (req, res) => {
    try {
      const { validateOrderCreation } = await import("./lib/errorHandler");
      const { logOrderCreation, logValidationError } = await import("./lib/logger");
      const { sendOrderConfirmation, sendAdminNotification } = await import("./lib/whatsapp");

      const validation = validateOrderCreation(req.body);
      if (!validation.valid) {
        Object.entries(validation.errors).forEach(([field, message]) => {
          logValidationError(field, message);
        });
        return res.status(400).json({ message: "بيانات الطلب غير مكتملة", errors: validation.errors });
      }

      const {
        customerName, customerEmail, customerPhone, shippingCity, shippingAddress,
        shippingOption, shippingCost, notes, total, items, paymentMethod = "cash_on_delivery",
        customerLat, customerLng, locationAccuracy, locationMethod,
      } = req.body;
      const user = (req as any).user;

      const order = await storage.createOrder({
        customerName,
        customerEmail,
        customerPhone,
        shippingCity,
        shippingAddress,
        shippingOption,
        shippingCost,
        notes,
        total,
        items,
        paymentMethod,
        userId: getUserId(user),
      });

      // حفظ إحداثيات GPS في الطلب
      if (customerLat != null && customerLng != null) {
        try {
          const { pool: gpsPool } = await import("./db");
          await gpsPool.query(
            `UPDATE orders SET customer_lat=$1, customer_lng=$2, location_accuracy=$3, location_method=$4 WHERE id=$5`,
            [customerLat, customerLng, locationAccuracy || null, locationMethod || "gps", order.id]
          );
        } catch { /* non-fatal */ }
      }

      logOrderCreation(order.id, {
        customerName,
        customerPhone,
        total,
        paymentMethod,
        itemsCount: items.length,
      });

      await Promise.allSettled([
        sendOrderConfirmation(customerPhone, order.id, Number(total), "SAR"),
        sendAdminNotification(order.id, customerName, customerPhone, Number(total), items.length),
        // تعيين المورد تلقائياً: GPS أولاً ثم المدينة
        autoAssignSupplier(
          order.id, shippingCity || "", Number(total), req.body.currency || "YER",
          customerName, customerPhone,
          customerLat ? Number(customerLat) : undefined,
          customerLng ? Number(customerLng) : undefined
        ),
      ]);

      res.json(order);
    } catch (e: any) {
      const userMessage = e.message?.includes("لم يعد متاحاً") || e.message?.includes("غير صالحة")
        ? e.message
        : "حدث خطأ أثناء إنشاء الطلب، يرجى المحاولة مرة أخرى";
      res.status(500).json({ message: userMessage, details: e.message });
    }
  });

  // ─── تتبع الطلب العام (العميل يدخل رقم الطلب + رقم الهاتف) ────────────────────
  app.post("/api/track-order", async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { orderId, phone } = req.body;
      if (!orderId || !phone) return res.status(400).json({ message: "رقم الطلب والهاتف مطلوبان" });
      const orderRes = await dbPool.query(
        `SELECT o.*, s.name as supplier_name, s.phone as supplier_phone
         FROM orders o
         LEFT JOIN suppliers s ON o.supplier_id = s.id
         WHERE o.id=$1`,
        [parseInt(orderId)]
      );
      if (!orderRes.rows.length) return res.status(404).json({ message: "الطلب غير موجود" });
      const order = orderRes.rows[0];
      // تحقق من الهاتف
      const cleanPhone = phone.replace(/\s+/g, "").replace(/^00/, "+");
      const cleanOrderPhone = (order.customer_phone || "").replace(/\s+/g, "").replace(/^00/, "+");
      if (cleanPhone !== cleanOrderPhone && !cleanOrderPhone.includes(phone.slice(-8))) {
        return res.status(403).json({ message: "رقم الهاتف غير مطابق" });
      }
      // جلب عناصر الطلب
      const itemsRes = await dbPool.query(
        `SELECT oi.*, p.name as product_name_db FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id=$1`,
        [parseInt(orderId)]
      );
      const safeOrder = {
        id: order.id,
        status: order.status,
        deliveryStatus: order.delivery_status,
        paymentStatus: order.payment_status,
        customerName: order.customer_name,
        shippingCity: order.shipping_city,
        shippingAddress: order.shipping_address,
        total: order.total,
        currency: order.currency,
        shippingCost: order.shipping_cost,
        shippingOption: order.shipping_option,
        paymentMethod: order.payment_method,
        trackingNumber: order.tracking_number,
        createdAt: order.created_at,
        supplierName: order.supplier_name,
        items: itemsRes.rows,
      };
      res.json(safeOrder);
    } catch (e: any) {
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  // ─── رفع إيصال الدفع لطلب ────────────────────────────────────────────────
  app.post("/api/orders/:id/upload-receipt", upload.single("receipt"), async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const orderId = parseInt(req.params.id);
      if (!req.file) return res.status(400).json({ message: "لم يتم إرفاق صورة" });
      const base64 = req.file.buffer.toString("base64");
      const dataUrl = `data:${req.file.mimetype};base64,${base64}`;
      await dbPool.query(
        `UPDATE orders SET receipt_image_url=$1, payment_status='pending_verification' WHERE id=$2`,
        [dataUrl, orderId]
      );

      // إشعار المشرف بواتساب عند رفع إيصال جديد
      try {
        const orderRow = await dbPool.query(
          `SELECT customer_name, customer_phone, total, payment_method FROM orders WHERE id=$1`,
          [orderId]
        );
        if (orderRow.rows.length) {
          const o = orderRow.rows[0];
          const methodLabel = o.payment_method === "bank_transfer" ? "تحويل بنكي" : "محفظة إلكترونية";
          const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER || process.env.TWILIO_FROM_NUMBER;
          const accountSid = process.env.TWILIO_ACCOUNT_SID;
          const authToken = process.env.TWILIO_AUTH_TOKEN;
          const fromNumber = process.env.TWILIO_FROM_NUMBER;
          if (adminPhone && accountSid && authToken && fromNumber) {
            const msg = `📥 إيصال دفع جديد!\n━━━━━━━━━━━━━━━━━━━━━\n🆔 طلب: #${orderId}\n👤 العميل: ${o.customer_name}\n📱 الجوال: ${o.customer_phone}\n💰 المبلغ: ${Number(o.total).toLocaleString()} ر.ي\n💳 طريقة الدفع: ${methodLabel}\n━━━━━━━━━━━━━━━━━━━━━\nراجع التحقق: https://oyoplast.com/admin`;
            await fetch(
              `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
              {
                method: "POST",
                headers: {
                  Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({ To: `whatsapp:${adminPhone}`, From: `whatsapp:${fromNumber}`, Body: msg }),
              }
            );
          }
        }
      } catch { /* non-fatal */ }

      res.json({ message: "تم رفع الإيصال بنجاح", receiptUrl: dataUrl });
    } catch (e: any) {
      res.status(500).json({ message: "فشل رفع الإيصال", error: e.message });
    }
  });

  // ─── الأدمن: التحقق من إيصال الدفع ──────────────────────────────────────────
  app.get("/api/admin/payment-verifications", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(`
        SELECT id, customer_name, customer_phone, total, payment_method, payment_status,
               receipt_image_url, notes, created_at, shipping_city
        FROM orders
        WHERE payment_method IN ('bank_transfer','digital_wallet','installment_deposit_cod')
          AND payment_status IN ('pending_verification','unpaid','partial')
          AND receipt_image_url IS NOT NULL
          AND status != 'cancelled'
        ORDER BY created_at DESC
      `);
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب الطلبات" });
    }
  });

  app.patch("/api/admin/payment-verifications/:id", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { action, note } = req.body; // action: 'approve' | 'reject'
      const orderId = parseInt(req.params.id);

      // جلب بيانات الطلب قبل التحديث (لإرسال الإشعار)
      const orderRow = await dbPool.query(
        `SELECT customer_name, customer_phone, total, payment_method FROM orders WHERE id=$1`,
        [orderId]
      );
      const orderData = orderRow.rows[0];

      if (action === "approve") {
        await dbPool.query(
          `UPDATE orders SET payment_status='transferred' WHERE id=$1`,
          [orderId]
        );
      } else if (action === "reject") {
        await dbPool.query(
          `UPDATE orders SET payment_status='unpaid', receipt_image_url=NULL WHERE id=$1`,
          [orderId]
        );
      }
      if (note) {
        await dbPool.query(
          `UPDATE orders SET notes=COALESCE(notes,'')||$1 WHERE id=$2`,
          [`\n[ملاحظة الأدمن: ${note}]`, orderId]
        );
      }

      // إشعار العميل بواتساب عند قبول أو رفض الدفع
      if (orderData?.customer_phone) {
        try {
          const phone = orderData.customer_phone.replace(/\s+/g, "").replace(/^00/, "+");
          const accountSid = process.env.TWILIO_ACCOUNT_SID;
          const authToken = process.env.TWILIO_AUTH_TOKEN;
          const fromNumber = process.env.TWILIO_FROM_NUMBER;
          if (phone.startsWith("+") && accountSid && authToken && fromNumber) {
            const trackLink = `https://oyoplast.com/track`;
            let msg = "";
            if (action === "approve") {
              msg = `✅ تم التحقق من دفعك!\n━━━━━━━━━━━━━━━━━━━━━\n🆔 رقم الطلب: #${orderId}\n💰 المبلغ: ${Number(orderData.total).toLocaleString()} ر.ي\nتم استلام دفعك وتأكيده. سيتم تجهيز طلبك الآن.\n\n🔗 تتبع طلبك: ${trackLink}\n━━━━━━━━━━━━━━━━━━━━━\nأويو بلاست 🛍️`;
            } else if (action === "reject") {
              msg = `❌ تعذّر التحقق من دفعك\n━━━━━━━━━━━━━━━━━━━━━\n🆔 رقم الطلب: #${orderId}\n${note ? `📝 السبب: ${note}\n` : ""}يرجى إعادة رفع صورة الإيصال أو التواصل معنا.\n━━━━━━━━━━━━━━━━━━━━━\nأويو بلاست 🛍️`;
            }
            if (msg) {
              await fetch(
                `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
                {
                  method: "POST",
                  headers: {
                    Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
                    "Content-Type": "application/x-www-form-urlencoded",
                  },
                  body: new URLSearchParams({ To: `whatsapp:${phone}`, From: `whatsapp:${fromNumber}`, Body: msg }),
                }
              );
            }
          }
        } catch { /* non-fatal */ }
      }

      res.json({ message: "تم تحديث حالة الدفع" });
    } catch (e: any) {
      res.status(500).json({ message: "فشل التحديث" });
    }
  });

  // ─── بوابة المورد — تسجيل دخول ────────────────────────────────────────────────
  app.post("/api/supplier/login", async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { phone, pin } = req.body;
      if (!phone || !pin) return res.status(400).json({ message: "الهاتف والرمز مطلوبان" });
      const cleanPhone = phone.replace(/\s+/g, "");
      const result = await dbPool.query(
        `SELECT * FROM suppliers WHERE (phone=$1 OR phone=$2) AND is_active=true`,
        [cleanPhone, phone]
      );
      if (!result.rows.length) return res.status(404).json({ message: "لم يُعثر على هذا الرقم في نظام الموردين" });
      const supplier = result.rows[0];
      const supplierPin = supplier.pin || "1234";
      if (pin !== supplierPin) return res.status(401).json({ message: "الرمز السري غير صحيح" });
      // إنشاء token بسيط
      const crypto = await import("crypto");
      const token = crypto.createHmac("sha256", supplier.id + supplier.phone).update("supplier-v1").digest("hex");
      res.json({ token, supplier: { id: supplier.id, name: supplier.name, phone: supplier.phone, cities: supplier.cities, commissionRate: supplier.commission_rate } });
    } catch (e: any) {
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  // ─── middleware تحقق من توكن المورد ────────────────────────────────────────────
  async function requireSupplier(req: Request, res: Response, next: NextFunction) {
    const token = req.headers["x-supplier-token"] as string;
    const supplierId = req.headers["x-supplier-id"] as string;
    if (!token || !supplierId) return res.status(401).json({ message: "غير مصرح" });
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query("SELECT * FROM suppliers WHERE id=$1 AND is_active=true", [parseInt(supplierId)]);
      if (!result.rows.length) return res.status(401).json({ message: "غير مصرح" });
      const supplier = result.rows[0];
      const crypto = await import("crypto");
      const expectedToken = crypto.createHmac("sha256", supplier.id + supplier.phone).update("supplier-v1").digest("hex");
      if (token !== expectedToken) return res.status(401).json({ message: "غير مصرح" });
      (req as any).supplier = supplier;
      next();
    } catch {
      res.status(401).json({ message: "غير مصرح" });
    }
  }

  app.get("/api/supplier/me", requireSupplier, async (req, res) => {
    const supplier = (req as any).supplier;
    res.json({ id: supplier.id, name: supplier.name, phone: supplier.phone, cities: supplier.cities, commissionRate: supplier.commission_rate, balanceDue: supplier.balance_due, totalSales: supplier.total_sales });
  });

  app.get("/api/supplier/orders", requireSupplier, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const supplier = (req as any).supplier;
      const result = await dbPool.query(
        `SELECT * FROM orders WHERE supplier_id=$1 AND status NOT IN ('cancelled') ORDER BY created_at DESC LIMIT 100`,
        [supplier.id]
      );
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب الطلبات" });
    }
  });

  app.get("/api/supplier/orders/:id/items", requireSupplier, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const supplier = (req as any).supplier;
      const orderId = parseInt(req.params.id);
      // تحقق أن الطلب تابع لهذا المورد
      const orderCheck = await dbPool.query("SELECT id FROM orders WHERE id=$1 AND supplier_id=$2", [orderId, supplier.id]);
      if (!orderCheck.rows.length) return res.status(403).json({ message: "غير مصرح" });
      const items = await dbPool.query(
        `SELECT oi.*, p.name as product_name_db FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id=$1`,
        [orderId]
      );
      res.json(items.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل" });
    }
  });

  app.put("/api/supplier/orders/:id/delivery", requireSupplier, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const supplier = (req as any).supplier;
      const orderId = parseInt(req.params.id);
      const { deliveryStatus, notes } = req.body;
      const validStatuses = ["pending", "picked_up", "shipped", "delivered", "failed"];
      if (!validStatuses.includes(deliveryStatus)) return res.status(400).json({ message: "حالة غير صالحة" });
      const orderCheck = await dbPool.query("SELECT id FROM orders WHERE id=$1 AND supplier_id=$2", [orderId, supplier.id]);
      if (!orderCheck.rows.length) return res.status(403).json({ message: "غير مصرح" });
      let newStatus = deliveryStatus === "delivered" ? "delivered" : undefined;
      if (newStatus) {
        await dbPool.query(`UPDATE orders SET delivery_status=$1, status=$2 WHERE id=$3`, [deliveryStatus, newStatus, orderId]);
      } else {
        await dbPool.query(`UPDATE orders SET delivery_status=$1 WHERE id=$2`, [deliveryStatus, orderId]);
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: "فشل" });
    }
  });

  // تحديث PIN المورد (من لوحة الأدمن)
  app.put("/api/admin/suppliers/:id/pin", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { pin } = req.body;
      if (!pin || pin.length < 4) return res.status(400).json({ message: "الرمز يجب أن يكون 4 أرقام على الأقل" });
      await dbPool.query("UPDATE suppliers SET pin=$1 WHERE id=$2", [pin, parseInt(req.params.id)]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: "فشل" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // ─── منتجات المورد: إدارة من بوابة المورد ──────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════

  // جلب منتجات المورد الخاصة به
  app.get("/api/supplier/products", requireSupplier, async (req: any, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const supplier = req.supplier;
      const result = await dbPool.query(
        `SELECT p.*, c.name as category_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.submitted_by_supplier_id = $1
         ORDER BY p.id DESC`,
        [supplier.id]
      );
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب المنتجات" });
    }
  });

  // إضافة منتج جديد من المورد (يذهب للمراجعة)
  app.post("/api/supplier/products", requireSupplier, async (req: any, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const supplier = req.supplier;
      const { name, description, price, categoryId, imageUrl, stock, notes } = req.body;
      if (!name || !price) return res.status(400).json({ message: "الاسم والسعر مطلوبان" });

      // هل الموافقة التلقائية مفعّلة؟
      const settingsRes = await dbPool.query("SELECT supplier_product_auto_approve FROM display_settings LIMIT 1");
      const autoApprove = settingsRes.rows[0]?.supplier_product_auto_approve ?? false;
      const status = autoApprove ? "approved" : "pending";

      const result = await dbPool.query(
        `INSERT INTO products
          (name, description, price, category_id, image_url, stock,
           supplier_id, submitted_by_supplier_id, product_status, admin_notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9) RETURNING *`,
        [name, description || null, price, categoryId || null, imageUrl || null,
         stock || 0, supplier.id, status, notes || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل إضافة المنتج", details: e.message });
    }
  });

  // تعديل منتج من المورد (فقط إذا كان pending أو rejected)
  app.put("/api/supplier/products/:id", requireSupplier, async (req: any, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const supplier = req.supplier;
      const productId = parseInt(req.params.id);
      // التحقق من ملكية المورد للمنتج
      const check = await dbPool.query(
        "SELECT * FROM products WHERE id=$1 AND submitted_by_supplier_id=$2",
        [productId, supplier.id]
      );
      if (!check.rows.length) return res.status(403).json({ message: "غير مصرح" });
      const existing = check.rows[0];
      if (existing.product_status === "approved") {
        return res.status(400).json({ message: "لا يمكن تعديل منتج موافق عليه — تواصل مع الإدارة" });
      }
      const { name, description, price, categoryId, imageUrl, stock } = req.body;
      const result = await dbPool.query(
        `UPDATE products SET
           name=COALESCE($1, name),
           description=COALESCE($2, description),
           price=COALESCE($3, price),
           category_id=COALESCE($4, category_id),
           image_url=COALESCE($5, image_url),
           stock=COALESCE($6, stock),
           product_status='pending'
         WHERE id=$7 RETURNING *`,
        [name, description, price, categoryId, imageUrl, stock, productId]
      );
      res.json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل التعديل" });
    }
  });

  // حذف منتج معلق من المورد
  app.delete("/api/supplier/products/:id", requireSupplier, async (req: any, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const supplier = req.supplier;
      const productId = parseInt(req.params.id);
      const check = await dbPool.query(
        "SELECT product_status FROM products WHERE id=$1 AND submitted_by_supplier_id=$2",
        [productId, supplier.id]
      );
      if (!check.rows.length) return res.status(403).json({ message: "غير مصرح" });
      if (check.rows[0].product_status === "approved") {
        return res.status(400).json({ message: "لا يمكن حذف منتج موافق عليه" });
      }
      await dbPool.query("DELETE FROM products WHERE id=$1", [productId]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: "فشل الحذف" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // ─── موافقة الأدمن على منتجات الموردين ─────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════

  // جلب جميع منتجات الموردين المعلقة والمعتمدة والمرفوضة
  app.get("/api/admin/supplier-products", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const status = req.query.status as string | undefined;
      let query = `
        SELECT p.*, s.name as supplier_name, s.phone as supplier_phone,
               c.name as category_name
        FROM products p
        LEFT JOIN suppliers s ON p.submitted_by_supplier_id = s.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.submitted_by_supplier_id IS NOT NULL
      `;
      const params: any[] = [];
      if (status) {
        query += ` AND p.product_status = $1`;
        params.push(status);
      }
      query += ` ORDER BY p.id DESC`;
      const result = await dbPool.query(query, params);
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب المنتجات" });
    }
  });

  // موافقة الأدمن على منتج (مع تعديلات اختيارية)
  app.put("/api/admin/supplier-products/:id/approve", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const productId = parseInt(req.params.id);
      const { name, description, price, categoryId, imageUrl, stock, adminNotes } = req.body;
      const result = await dbPool.query(
        `UPDATE products SET
           product_status='approved',
           name=COALESCE($1, name),
           description=COALESCE($2, description),
           price=COALESCE($3, price),
           category_id=COALESCE($4, category_id),
           image_url=COALESCE($5, image_url),
           stock=COALESCE($6, stock),
           admin_notes=COALESCE($7, admin_notes)
         WHERE id=$8 AND submitted_by_supplier_id IS NOT NULL RETURNING *`,
        [name || null, description || null, price || null, categoryId || null,
         imageUrl || null, stock || null, adminNotes || null, productId]
      );
      if (!result.rows.length) return res.status(404).json({ message: "المنتج غير موجود" });
      res.json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل الموافقة" });
    }
  });

  // رفض منتج مع ملاحظة للمورد
  app.put("/api/admin/supplier-products/:id/reject", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const productId = parseInt(req.params.id);
      const { adminNotes } = req.body;
      const result = await dbPool.query(
        `UPDATE products SET product_status='rejected', admin_notes=$1
         WHERE id=$2 AND submitted_by_supplier_id IS NOT NULL RETURNING *`,
        [adminNotes || null, productId]
      );
      if (!result.rows.length) return res.status(404).json({ message: "المنتج غير موجود" });
      res.json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل الرفض" });
    }
  });

  // حذف منتج مورد من الأدمن
  app.delete("/api/admin/supplier-products/:id", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const productId = parseInt(req.params.id);
      await dbPool.query("DELETE FROM products WHERE id=$1 AND submitted_by_supplier_id IS NOT NULL", [productId]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: "فشل الحذف" });
    }
  });

  // إعدادات الصور وموافقة المنتجات
  app.get("/api/admin/image-settings", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(
        "SELECT img_max_width, img_max_height, img_quality, img_max_size_mb, supplier_product_auto_approve FROM display_settings LIMIT 1"
      );
      res.json(r.rows[0] ?? {});
    } catch (e: any) {
      res.status(500).json({ message: "فشل" });
    }
  });

  app.put("/api/admin/image-settings", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { imgMaxWidth, imgMaxHeight, imgQuality, imgMaxSizeMb, supplierProductAutoApprove } = req.body;
      await dbPool.query(
        `UPDATE display_settings SET
           img_max_width=$1, img_max_height=$2, img_quality=$3,
           img_max_size_mb=$4, supplier_product_auto_approve=$5`,
        [imgMaxWidth ?? 1200, imgMaxHeight ?? 1200, imgQuality ?? 80,
         imgMaxSizeMb ?? 5, supplierProductAutoApprove ?? false]
      );
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: "فشل" });
    }
  });

  // ─── PDP Layout (Product Detail Page) ────────────────────────────────────────
  const DEFAULT_PDP_LAYOUT = {
    sections: [
      { id: "images",      visible: true,  height: 420, thumbSize: 64, mode: "contain", showThumbs: true },
      { id: "price",       visible: true,  fontSize: 22 },
      { id: "title",       visible: true },
      { id: "rating",      visible: true },
      { id: "trust_badges",visible: true },
      { id: "variants",    visible: true },
      { id: "bulk",        visible: true },
      { id: "quantity",    visible: true },
      { id: "shipping",    visible: true },
      { id: "returns",     visible: true },
      { id: "installment", visible: true },
      { id: "printing",    visible: true },
      { id: "description", visible: true },
      { id: "reviews",     visible: true },
      { id: "related",     visible: true, count: 4 },
    ],
    stickyBar: { visible: true, cartHeight: 52 },
    margins: { h: 16, v: 8, gap: 12 },
  };

  app.get("/api/pdp-layout", async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query("SELECT pdp_layout FROM display_settings LIMIT 1");
      const raw = r.rows[0]?.pdp_layout;
      if (raw) {
        try { return res.json(JSON.parse(raw)); } catch {}
      }
      res.json(DEFAULT_PDP_LAYOUT);
    } catch {
      res.json(DEFAULT_PDP_LAYOUT);
    }
  });

  app.post("/api/admin/pdp-layout", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      await dbPool.query("UPDATE display_settings SET pdp_layout=$1", [JSON.stringify(req.body)]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: "فشل حفظ التخطيط" });
    }
  });

  // ─── Get Order Details (Public - for order confirmation) ────────────────────────
  app.get("/api/orders/:id", async (req, res) => {
    try {
      const { db: dbInstance } = await import("./db");
      const { orders: ordersTable } = await import("@shared/schema");
      const { eq: eqFn } = await import("drizzle-orm");
      
      const [order] = await dbInstance
        .select()
        .from(ordersTable)
        .where(eqFn(ordersTable.id, parseInt(req.params.id)));

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      res.json(order);
    } catch (e: any) {
      res.status(500).json({ message: "Failed to fetch order", details: e.message });
    }
  });

  // ─── Get Order Items (Public - for order confirmation) ────────────────────────
  app.get("/api/orders/:id/items", async (req, res) => {
    try {
      const { db: dbInstance } = await import("./db");
      const { orderItems: orderItemsTable, products: productsTable } = await import("@shared/schema");
      const { eq: eqFn } = await import("drizzle-orm");
      const { sql: sqlFn } = await import("drizzle-orm");

      const items = await dbInstance
        .select({
          id: orderItemsTable.id,
          productId: orderItemsTable.productId,
          productName: productsTable.name,
          quantity: orderItemsTable.quantity,
          price: orderItemsTable.price,
          selectedSize: orderItemsTable.selectedSize,
          selectedColor: orderItemsTable.selectedColor,
        })
        .from(orderItemsTable)
        .leftJoin(productsTable, eqFn(orderItemsTable.productId, productsTable.id))
        .where(eqFn(orderItemsTable.orderId, parseInt(req.params.id)));

      res.json(items);
    } catch (e: any) {
      res.status(500).json({ message: "Failed to fetch order items", details: e.message });
    }
  });

  // ─── Admin Orders ────────────────────────────────────────────────
  app.get("/api/admin/orders", requireAdmin, async (_req, res) => {
    const allOrders = await storage.getOrders();
    res.json(allOrders);
  });

  // ─── Admin: Get Order Items (with full product details for invoice) ──────────
  app.get("/api/admin/orders/:id/items", requireAdmin, async (req, res) => {
    try {
      const { db: dbInstance } = await import("./db");
      const { orderItems: orderItemsTable, products: productsTable } = await import("@shared/schema");
      const { eq: eqFn } = await import("drizzle-orm");

      const items = await dbInstance
        .select({
          id: orderItemsTable.id,
          productId: orderItemsTable.productId,
          productName: productsTable.name,
          quantity: orderItemsTable.quantity,
          price: orderItemsTable.price,
          selectedSize: orderItemsTable.selectedSize,
          selectedColor: orderItemsTable.selectedColor,
          customPrinting: orderItemsTable.customPrinting,
          designNotes: orderItemsTable.designNotes,
        })
        .from(orderItemsTable)
        .leftJoin(productsTable, eqFn(orderItemsTable.productId, productsTable.id))
        .where(eqFn(orderItemsTable.orderId, parseInt(req.params.id)));

      res.json(items);
    } catch (e: any) {
      res.status(500).json({ message: "Failed to fetch admin order items", details: e.message });
    }
  });

  app.patch("/api/admin/orders/:id/status", requireAdmin, async (req, res) => {
    try {
      const { db: dbInstance } = await import("./db");
      const { orders: ordersTable } = await import("@shared/schema");
      const { eq: eqFn } = await import("drizzle-orm");
      const newStatus = req.body.status;
      const updateData: any = { status: newStatus };
      if (req.body.trackingNumber !== undefined) updateData.trackingNumber = req.body.trackingNumber;
      const [order] = await dbInstance
        .update(ordersTable)
        .set(updateData)
        .where(eqFn(ordersTable.id, parseInt(req.params.id)))
        .returning();
      res.json(order);
      // إشعار العميل بتغيير الحالة (لا ننتظر)
      if (order?.customerPhone && newStatus) {
        notifyCustomerStatus(order.customerPhone, order.id, newStatus, { trackingNumber: order.trackingNumber || undefined });
      }
      // منح نقاط الولاء عند تسليم الطلب
      if (newStatus === "delivered" && order?.userId && order?.total) {
        await awardOrderPoints(Number(order.userId), order.id, Number(order.total));
      }
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث حالة الطلب", details: e.message });
    }
  });

  // ─── التقارير المالية ────────────────────────────────────────────────────────────
  app.get("/api/admin/reports/financial", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");

      // إجمالي المبيعات وعمولة المنصة
      const totals = await dbPool.query(`
        SELECT
          COALESCE(SUM(total::numeric), 0) as total_revenue,
          COALESCE(SUM(CASE WHEN supplier_amount IS NOT NULL THEN supplier_amount::numeric ELSE 0 END), 0) as total_supplier,
          COUNT(*) as total_orders,
          COUNT(CASE WHEN status='delivered' THEN 1 END) as delivered_orders,
          COUNT(CASE WHEN status='cancelled' THEN 1 END) as cancelled_orders,
          COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as today_orders,
          COALESCE(SUM(CASE WHEN DATE(created_at) = CURRENT_DATE THEN total::numeric ELSE 0 END), 0) as today_revenue
        FROM orders WHERE status != 'cancelled'
      `);

      // آخر 30 يوم - مبيعات يومية
      const daily = await dbPool.query(`
        SELECT DATE(created_at) as day,
               SUM(total::numeric) as revenue,
               COUNT(*) as orders
        FROM orders
        WHERE status != 'cancelled' AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY day
      `);

      // آخر 12 شهر - مبيعات شهرية
      const monthly = await dbPool.query(`
        SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month,
               SUM(total::numeric) as revenue,
               COUNT(*) as orders
        FROM orders
        WHERE status != 'cancelled' AND created_at >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY DATE_TRUNC('month', created_at)
      `);

      // أفضل المنتجات مبيعاً
      const topProducts = await dbPool.query(`
        SELECT oi.product_name, oi.product_id,
               SUM(oi.price::numeric * oi.quantity) as revenue,
               SUM(oi.quantity) as units_sold
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status != 'cancelled'
        GROUP BY oi.product_name, oi.product_id
        ORDER BY revenue DESC
        LIMIT 10
      `);

      // أفضل المدن
      const topCities = await dbPool.query(`
        SELECT shipping_city as city,
               COUNT(*) as orders,
               SUM(total::numeric) as revenue
        FROM orders
        WHERE status != 'cancelled' AND shipping_city IS NOT NULL
        GROUP BY shipping_city
        ORDER BY orders DESC
        LIMIT 10
      `);

      // الشهر الحالي vs الشهر الماضي
      const comparison = await dbPool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE) THEN total::numeric END), 0) as this_month,
          COALESCE(SUM(CASE WHEN DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' THEN total::numeric END), 0) as last_month,
          COUNT(CASE WHEN DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as this_month_orders,
          COUNT(CASE WHEN DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' THEN 1 END) as last_month_orders
        FROM orders WHERE status != 'cancelled'
      `);

      const t = totals.rows[0];
      res.json({
        summary: {
          totalRevenue: Number(t.total_revenue),
          totalSupplierPaid: Number(t.total_supplier),
          platformCommission: Number(t.total_revenue) - Number(t.total_supplier),
          totalOrders: Number(t.total_orders),
          deliveredOrders: Number(t.delivered_orders),
          cancelledOrders: Number(t.cancelled_orders),
          todayOrders: Number(t.today_orders),
          todayRevenue: Number(t.today_revenue),
        },
        daily: daily.rows.map(r => ({ day: r.day, revenue: Number(r.revenue), orders: Number(r.orders) })),
        monthly: monthly.rows.map(r => ({ month: r.month, revenue: Number(r.revenue), orders: Number(r.orders) })),
        topProducts: topProducts.rows.map(r => ({ name: r.product_name, revenue: Number(r.revenue), units: Number(r.units_sold) })),
        topCities: topCities.rows.map(r => ({ city: r.city, orders: Number(r.orders), revenue: Number(r.revenue) })),
        comparison: comparison.rows[0],
      });
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب التقارير", details: e.message });
    }
  });

  // ─── نقاط الولاء (Loyalty Points) ────────────────────────────────────────────
  // قراءة نقاط المستخدم
  app.get("/api/points", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ message: "غير مصرح" });
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        "SELECT * FROM reward_points WHERE user_id=$1",
        [user.id]
      );
      if (!result.rows.length) {
        return res.json({ points: 0, lifetimePoints: 0 });
      }
      const row = result.rows[0];
      res.json({ points: row.points, lifetimePoints: row.lifetime_points });
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب النقاط" });
    }
  });

  // سجل معاملات النقاط
  app.get("/api/points/history", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ message: "غير مصرح" });
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        "SELECT * FROM points_transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50",
        [user.id]
      );
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب السجل" });
    }
  });

  // حساب تكلفة استرداد النقاط (100 نقطة = 1000 ر.ي)
  app.post("/api/points/redeem-estimate", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ message: "غير مصرح" });
      const { pointsToUse } = req.body;
      if (!pointsToUse || pointsToUse <= 0) return res.status(400).json({ message: "عدد النقاط غير صالح" });
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query("SELECT points FROM reward_points WHERE user_id=$1", [user.id]);
      const availablePoints = result.rows[0]?.points || 0;
      const actualPoints = Math.min(pointsToUse, availablePoints);
      const discountAmount = Math.floor(actualPoints / 100) * 1000; // 100 نقطة = 1000 ر.ي
      res.json({ pointsToUse: actualPoints, discountAmount, availablePoints });
    } catch (e: any) {
      res.status(500).json({ message: "فشل" });
    }
  });

  // منح النقاط عند اكتمال الطلب (تُستدعى داخلياً)
  async function awardOrderPoints(userId: number, orderId: number, orderTotal: number) {
    try {
      const { pool: dbPool } = await import("./db");
      const pointsEarned = Math.floor(orderTotal / 1000); // 1 نقطة لكل 1000 ر.ي
      if (pointsEarned <= 0) return;
      // تأكد من وجود سجل للمستخدم
      await dbPool.query(
        `INSERT INTO reward_points (user_id, points, lifetime_points)
         VALUES ($1, $2, $2)
         ON CONFLICT (user_id)
         DO UPDATE SET points = reward_points.points + $2, lifetime_points = reward_points.lifetime_points + $2`,
        [userId, pointsEarned]
      );
      // سجل المعاملة
      await dbPool.query(
        `INSERT INTO points_transactions (user_id, points, type, description, order_id) VALUES ($1, $2, $3, $4, $5)`,
        [userId, pointsEarned, "earn", `شراء - طلب #${orderId}`, orderId]
      );
    } catch (e: any) {
      console.error("Points award error:", e.message);
    }
  }

  // alias for /api/points/history (للتوافق مع النظام القديم)
  app.get("/api/points/transactions", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ message: "غير مصرح" });
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        "SELECT * FROM points_transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50",
        [user.id]
      );
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب السجل" });
    }
  });

  // التحقق من كود الكوبون (للمسوقين وغيرهم)
  app.post("/api/coupons/validate", async (req, res) => {
    try {
      const { code } = req.body;
      if (!code) return res.status(400).json({ message: "الرجاء إدخال كود الكوبون" });
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        `SELECT * FROM coupons WHERE code=$1 AND is_active=true AND (expires_at IS NULL OR expires_at > NOW())`,
        [code.toUpperCase()]
      );
      if (!result.rows.length) return res.status(404).json({ message: "الكوبون غير صالح أو منتهي" });
      const coupon = result.rows[0];
      if (coupon.max_usage && coupon.usage_count >= coupon.max_usage)
        return res.status(400).json({ message: "تم استخدام الكوبون بالحد الأقصى" });
      res.json({
        code: coupon.code,
        discountPercent: coupon.discount_percent,
        marketerCommission: coupon.marketer_commission_percent,
        marketerId: coupon.marketer_id,
      });
    } catch (e: any) {
      res.status(500).json({ message: "فشل التحقق من الكوبون" });
    }
  });

  // Admin - إحصائيات نقاط الولاء
  app.get("/api/admin/points/stats", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const stats = await dbPool.query(`
        SELECT
          COUNT(DISTINCT user_id) as users_with_points,
          SUM(points) as total_active_points,
          SUM(lifetime_points) as total_earned_ever
        FROM reward_points
      `);
      const recent = await dbPool.query(`
        SELECT pt.*, u.name as user_name, u.phone as user_phone
        FROM points_transactions pt
        JOIN users u ON pt.user_id = u.id
        ORDER BY pt.created_at DESC LIMIT 20
      `);
      res.json({ stats: stats.rows[0], recent: recent.rows });
    } catch (e: any) {
      res.status(500).json({ message: "فشل" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // ─── نظام التقسيط ────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════

  // إنشاء خطة تقسيط جديدة (يُستدعى بعد إنشاء الطلب)
  app.post("/api/installment-plans", async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const {
        orderId, customerId, customerName, customerPhone,
        planType, totalAmount, depositAmount,
        guarantorSupplierName, guarantorSupplierPhone, guarantorNotes,
        depositReceiptUrl,
      } = req.body;

      if (!orderId || !customerName || !planType || !totalAmount || !depositAmount) {
        return res.status(400).json({ message: "بيانات ناقصة" });
      }

      const remaining = Number(totalAmount) - Number(depositAmount);

      const result = await dbPool.query(
        `INSERT INTO installment_plans
          (order_id, customer_id, customer_name, customer_phone, plan_type,
           total_amount, deposit_amount, remaining_amount,
           deposit_receipt_url,
           guarantor_supplier_name, guarantor_supplier_phone, guarantor_notes, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending')
         RETURNING *`,
        [
          orderId, customerId || null, customerName, customerPhone, planType,
          totalAmount, depositAmount, remaining,
          depositReceiptUrl || null,
          guarantorSupplierName || null,
          guarantorSupplierPhone || null,
          guarantorNotes || null,
        ]
      );

      // إشعار المشرف بالتقسيط الجديد عبر واتساب
      try {
        const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER || process.env.TWILIO_FROM_NUMBER;
        if (adminPhone) {
          const planLabel = planType === "deposit_cod" ? "مقدّم + باقي عند التسليم" : "كفيل المورد";
          await (async () => {
            const twilio = (await import("twilio")).default;
            const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
            await client.messages.create({
              from: `whatsapp:${process.env.TWILIO_FROM_NUMBER}`,
              to: `whatsapp:${adminPhone}`,
              body: `📋 طلب تقسيط جديد\nالطلب: #${orderId}\nالعميل: ${customerName} | ${customerPhone}\nالنوع: ${planLabel}\nالمقدّم: ${Number(depositAmount).toLocaleString()} ر.ي\nالباقي: ${remaining.toLocaleString()} ر.ي${guarantorSupplierName ? `\nالكفيل: ${guarantorSupplierName}` : ""}\nراجع اللوحة: https://oyoplast.com/admin`,
            });
          })();
        }
      } catch { /* non-fatal */ }

      res.json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل إنشاء خطة التقسيط", details: e.message });
    }
  });

  // قائمة خطط التقسيط (للإدارة)
  app.get("/api/admin/installment-plans", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { status } = req.query;
      let where = status ? `WHERE ip.status = $1` : "";
      const params = status ? [status] : [];

      const result = await dbPool.query(`
        SELECT ip.*,
               o.status as order_status, o.total as order_total,
               o.shipping_city, o.shipping_address,
               o.customer_phone as order_phone
        FROM installment_plans ip
        JOIN orders o ON ip.order_id = o.id
        ${where}
        ORDER BY ip.created_at DESC
        LIMIT 200
      `, params);

      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب خطط التقسيط" });
    }
  });

  // تفاصيل خطة واحدة
  app.get("/api/admin/installment-plans/:id", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        `SELECT ip.*, o.status as order_status, o.total as order_total,
                o.shipping_city, o.customer_phone as order_phone
         FROM installment_plans ip
         JOIN orders o ON ip.order_id = o.id
         WHERE ip.id = $1`,
        [parseInt(req.params.id)]
      );
      if (!result.rows.length) return res.status(404).json({ message: "الخطة غير موجودة" });
      res.json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل" });
    }
  });

  // تحديث حالة خطة التقسيط (مشرف)
  app.patch("/api/admin/installment-plans/:id", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const planId = parseInt(req.params.id);
      const { action, adminNotes } = req.body;

      // الإجراءات المتاحة: confirm_deposit | confirm_remaining | cancel | add_note
      let setClauses: string[] = [];
      let values: any[] = [];
      let idx = 1;

      // جلب بيانات الخطة لإرسال الإشعار لاحقاً
      const planRow = await dbPool.query(
        `SELECT * FROM installment_plans WHERE id=$1`,
        [planId]
      );
      const planData = planRow.rows[0];

      if (action === "confirm_deposit") {
        setClauses.push(`deposit_paid = true, deposit_paid_at = NOW(), status = 'deposit_paid'`);
        // تحديث الطلب بحالة deposit_paid
        const plan = await dbPool.query(`SELECT order_id FROM installment_plans WHERE id=$1`, [planId]);
        if (plan.rows[0]) {
          await dbPool.query(`UPDATE orders SET status='deposit_paid', payment_status='partial' WHERE id=$1`, [plan.rows[0].order_id]);
        }
        // إشعار العميل بواتساب
        try {
          if (planData?.customer_phone) {
            const phone = planData.customer_phone.replace(/\s+/g, "").replace(/^00/, "+");
            const accountSid = process.env.TWILIO_ACCOUNT_SID;
            const authToken = process.env.TWILIO_AUTH_TOKEN;
            const fromNumber = process.env.TWILIO_FROM_NUMBER;
            if (phone.startsWith("+") && accountSid && authToken && fromNumber) {
              const msg = `✅ تم تأكيد مقدّم التقسيط!\n━━━━━━━━━━━━━━━━━━━━━\n🆔 طلب: #${planData.order_id}\n💰 المقدّم: ${Number(planData.deposit_amount).toLocaleString()} ر.ي\n💳 الباقي عند التسليم: ${Number(planData.remaining_amount).toLocaleString()} ر.ي\nسيتم تجهيز طلبك الآن.\n━━━━━━━━━━━━━━━━━━━━━\nأويو بلاست 🛍️`;
              await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
                method: "POST",
                headers: { Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({ To: `whatsapp:${phone}`, From: `whatsapp:${fromNumber}`, Body: msg }),
              });
            }
          }
        } catch { /* non-fatal */ }
      } else if (action === "confirm_remaining") {
        setClauses.push(`remaining_paid = true, remaining_paid_at = NOW(), status = 'completed'`);
        const plan = await dbPool.query(`SELECT order_id FROM installment_plans WHERE id=$1`, [planId]);
        if (plan.rows[0]) {
          await dbPool.query(`UPDATE orders SET payment_status='cod_collected' WHERE id=$1`, [plan.rows[0].order_id]);
        }
        // إشعار العميل بواتساب
        try {
          if (planData?.customer_phone) {
            const phone = planData.customer_phone.replace(/\s+/g, "").replace(/^00/, "+");
            const accountSid = process.env.TWILIO_ACCOUNT_SID;
            const authToken = process.env.TWILIO_AUTH_TOKEN;
            const fromNumber = process.env.TWILIO_FROM_NUMBER;
            if (phone.startsWith("+") && accountSid && authToken && fromNumber) {
              const msg = `🎉 تم سداد التقسيط بالكامل!\n━━━━━━━━━━━━━━━━━━━━━\n🆔 طلب: #${planData.order_id}\nشكراً لثقتك بأويو بلاست! نتمنى أن ينال طلبك إعجابك 💙\n━━━━━━━━━━━━━━━━━━━━━\nأويو بلاست 🛍️`;
              await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
                method: "POST",
                headers: { Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({ To: `whatsapp:${phone}`, From: `whatsapp:${fromNumber}`, Body: msg }),
              });
            }
          }
        } catch { /* non-fatal */ }
      } else if (action === "cancel") {
        setClauses.push(`status = 'cancelled'`);
      }

      if (adminNotes !== undefined) {
        setClauses.push(`admin_notes = $${idx++}`);
        values.push(adminNotes);
      }

      if (!setClauses.length) return res.status(400).json({ message: "لا يوجد تحديث" });

      values.push(planId);
      const result = await dbPool.query(
        `UPDATE installment_plans SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
        values
      );

      res.json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث الخطة", details: e.message });
    }
  });

  // ─── إرسال تذكير واتساب لعميل التقسيط ───────────────────────────
  app.post("/api/admin/installment-plans/:id/remind", requireAdmin, async (req, res) => {
    try {
      const planId = parseInt(req.params.id);
      const { pool: dbPool } = await import("./db");
      const planRes = await dbPool.query(
        `SELECT ip.*, o.shipping_city FROM installment_plans ip LEFT JOIN orders o ON o.id=ip.order_id WHERE ip.id=$1`,
        [planId]
      );
      if (!planRes.rows[0]) return res.status(404).json({ message: "الخطة غير موجودة" });
      const p = planRes.rows[0];
      const remaining = Number(p.remaining_amount).toLocaleString("ar-YE");
      const deposit = Number(p.deposit_amount).toLocaleString("ar-YE");
      const status = p.deposit_paid ? `المقدّم مدفوع ✅ — الباقي: ${remaining} ر.ي` : `المقدّم المطلوب: ${deposit} ر.ي`;
      const msgBody = `📦 أويو بلاست — تذكير بخطة التقسيط\n\nالعزيز/ة ${p.customer_name},\nلديك دفعة مستحقة لطلب رقم #${p.order_id}\n${status}\n\nللاستفسار: wa.me/967774997589`;
      try {
        if (process.env.TWILIO_ACCOUNT_SID) {
          const twilio = (await import("twilio")).default;
          const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
          const phone = p.customer_phone.replace(/^0/, "967").replace(/^\+/, "");
          await client.messages.create({
            from: `whatsapp:${process.env.TWILIO_FROM_NUMBER}`,
            to: `whatsapp:+${phone}`,
            body: msgBody,
          });
        }
      } catch (twilioErr: any) {
        console.error("Twilio reminder error:", twilioErr.message);
        return res.status(500).json({ message: "فشل إرسال التذكير عبر واتساب", details: twilioErr.message });
      }
      await dbPool.query(
        `UPDATE installment_plans SET admin_notes = COALESCE(admin_notes,'') || $1 WHERE id=$2`,
        [`\n[تذكير أُرسل ${new Date().toLocaleDateString("ar-YE")}]`, planId]
      );
      res.json({ ok: true, message: "تم إرسال التذكير عبر واتساب" });
    } catch (e: any) {
      res.status(500).json({ message: "فشل إرسال التذكير", details: e.message });
    }
  });

  // إحصائيات التقسيط للإدارة
  app.get("/api/admin/installment-plans/stats/summary", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(`
        SELECT
          COUNT(*) as total_plans,
          COUNT(CASE WHEN status='pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status='deposit_paid' THEN 1 END) as deposit_paid,
          COUNT(CASE WHEN status='completed' THEN 1 END) as completed,
          COUNT(CASE WHEN status='cancelled' THEN 1 END) as cancelled,
          COALESCE(SUM(total_amount::numeric), 0) as total_value,
          COALESCE(SUM(deposit_amount::numeric), 0) as total_deposits,
          COALESCE(SUM(remaining_amount::numeric), 0) as total_remaining,
          COALESCE(SUM(CASE WHEN remaining_paid=false AND status NOT IN ('cancelled','completed') THEN remaining_amount::numeric ELSE 0 END), 0) as pending_collection
        FROM installment_plans
      `);
      res.json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل" });
    }
  });

  // قائمة الموردين النشطين (للاستخدام في اختيار كفيل - عام محدود)
  app.get("/api/public/suppliers-list", async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        `SELECT id, name, phone, cities FROM suppliers WHERE is_active=true ORDER BY name`
      );
      res.json(result.rows.map(r => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        cities: r.cities,
      })));
    } catch (e: any) {
      res.status(500).json({ message: "فشل" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // ─── نظام GPS وإيجاد أقرب موزع ──────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════

  // أقرب الموزعين من موقع العميل (public)
  app.get("/api/location/nearest-distributors", async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ message: "إحداثيات غير صالحة" });

      const suppRes = await dbPool.query(
        `SELECT id, name, phone, cities, province, district, lat, lng, service_radius_km
         FROM suppliers WHERE is_active=true AND lat IS NOT NULL AND lng IS NOT NULL`
      );
      const withDist = suppRes.rows.map((s: any) => ({
        id: s.id,
        name: s.name,
        cities: s.cities,
        province: s.province,
        district: s.district,
        serviceRadiusKm: s.service_radius_km,
        distanceKm: parseFloat(haversineKm(lat, lng, Number(s.lat), Number(s.lng)).toFixed(2)),
        withinRadius: haversineKm(lat, lng, Number(s.lat), Number(s.lng)) <= (s.service_radius_km || 20),
      })).sort((a, b) => a.distanceKm - b.distanceKm);

      res.json(withDist.slice(0, 10));
    } catch (e: any) {
      res.status(500).json({ message: "فشل البحث" });
    }
  });

  // ── إعدادات مناطق الخدمة (admin) ─────────────────────────────────────
  app.get("/api/admin/service-areas", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(`SELECT * FROM service_area_config ORDER BY city, name`);
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/admin/service-areas", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { name, city, district, centerLat, centerLng, radiusKm, notes } = req.body;
      if (!name || !city) return res.status(400).json({ message: "الاسم والمدينة مطلوبان" });
      const r = await dbPool.query(
        `INSERT INTO service_area_config (name, city, district, center_lat, center_lng, radius_km, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [name, city, district || null, centerLat || null, centerLng || null, radiusKm || 20, notes || null]
      );
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.put("/api/admin/service-areas/:id", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { name, city, district, centerLat, centerLng, radiusKm, notes } = req.body;
      const r = await dbPool.query(
        `UPDATE service_area_config SET name=COALESCE($1,name), city=COALESCE($2,city),
         district=COALESCE($3,district), center_lat=COALESCE($4,center_lat), center_lng=COALESCE($5,center_lng),
         radius_km=COALESCE($6,radius_km), notes=COALESCE($7,notes) WHERE id=$8 RETURNING *`,
        [name||null, city||null, district||null, centerLat!=null?centerLat:null, centerLng!=null?centerLng:null, radiusKm||null, notes||null, req.params.id]
      );
      if (!r.rows.length) return res.status(404).json({ message: "المنطقة غير موجودة" });
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/admin/service-areas/:id", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      await dbPool.query(`DELETE FROM service_area_config WHERE id=$1`, [req.params.id]);
      res.json({ message: "تم الحذف" });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── تحديث موقع الموزع من بوابة الموزع نفسه ───────────────────────────
  app.put("/api/supplier/location", requireSupplier, async (req: any, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { lat, lng, serviceRadiusKm, district, province } = req.body;
      if (!lat || !lng) return res.status(400).json({ message: "الإحداثيات مطلوبة" });
      const suppId = req.supplierId;
      await dbPool.query(
        `UPDATE suppliers SET lat=$1, lng=$2, service_radius_km=COALESCE($3, service_radius_km),
         district=COALESCE($4, district), province=COALESCE($5, province) WHERE id=$6`,
        [lat, lng, serviceRadiusKm || null, district || null, province || null, suppId]
      );
      res.json({ message: "تم تحديث الموقع" });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── إحصائيات طلبات حسب الموقع (admin - للخريطة) ─────────────────────
  app.get("/api/admin/orders-geo", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(`
        SELECT id, shipping_city, customer_lat, customer_lng, total, status, payment_status, location_method
        FROM orders
        WHERE customer_lat IS NOT NULL AND customer_lng IS NOT NULL
        ORDER BY created_at DESC LIMIT 500
      `);
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // إشعار المشرف عند رفع إيصال الدفع (بدون تقسيط)
  app.post("/api/orders/:id/notify-receipt", async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const { pool: dbPool } = await import("./db");
      const order = await dbPool.query(`SELECT * FROM orders WHERE id=$1`, [orderId]);
      if (!order.rows[0]) return res.status(404).json({ message: "طلب غير موجود" });
      const o = order.rows[0];
      // إشعار المشرف
      try {
        const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER;
        if (adminPhone && process.env.TWILIO_ACCOUNT_SID) {
          const twilio = (await import("twilio")).default;
          const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
          await client.messages.create({
            from: `whatsapp:${process.env.TWILIO_FROM_NUMBER}`,
            to: `whatsapp:${adminPhone}`,
            body: `💰 إيصال دفع جديد بانتظار المراجعة\nطلب: #${orderId}\nالعميل: ${o.customer_name} | ${o.customer_phone}\nالمبلغ: ${Number(o.total).toLocaleString()} ر.ي\nراجع: https://oyoplast.com/admin`,
          });
        }
      } catch { /* non-fatal */ }
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: "فشل" });
    }
  });

  // ══════════════════════════════════════════════════════════════════
  // ─── Smart Pricing System ─────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════

  // دالة مساعدة: حساب خطوط التسعير من تكاليف المنتج + التكلفة التشغيلية للوحدة
  async function calcPricingLines(
    purchasePrice: number,
    inlandShipping: number,
    storageCost: number,
    targetMarginPct: number,
    safetyMarginPct: number,
    operationalShareOverride?: number
  ) {
    const { pool: dbPool } = await import("./db");
    // اجلب أحدث تكلفة تشغيلية للوحدة
    let costPerOrder = operationalShareOverride ?? 0;
    if (operationalShareOverride === undefined) {
      const latest = await dbPool.query(
        `SELECT cost_per_order FROM operational_costs ORDER BY month DESC LIMIT 1`
      );
      costPerOrder = parseFloat(latest.rows[0]?.cost_per_order ?? "0");
    }
    const redLine = purchasePrice + inlandShipping + storageCost + costPerOrder;
    const greenLine = redLine * (1 + safetyMarginPct / 100);
    const suggestedPrice = greenLine * (1 + targetMarginPct / 100);
    return { costPerOrder, redLine, greenLine, suggestedPrice };
  }

  // GET /api/admin/operational-costs — قائمة التكاليف التشغيلية الشهرية
  app.get("/api/admin/operational-costs", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        `SELECT * FROM operational_costs ORDER BY month DESC`
      );
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب التكاليف", details: e.message });
    }
  });

  // POST /api/admin/operational-costs — حفظ تكاليف شهر (upsert)
  app.post("/api/admin/operational-costs", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { month, salaries = 0, rent = 0, marketing = 0, logistics = 0, other = 0, totalOrders = 1, notes } = req.body;
      if (!month || !/^\d{4}-\d{2}$/.test(month))
        return res.status(400).json({ message: "صيغة الشهر غير صحيحة (YYYY-MM)" });

      const totalCosts = Number(salaries) + Number(rent) + Number(marketing) + Number(logistics) + Number(other);
      const costPerOrder = totalOrders > 0 ? (totalCosts / Number(totalOrders)) : 0;

      const result = await dbPool.query(
        `INSERT INTO operational_costs (month, salaries, rent, marketing, logistics, other, total_orders, cost_per_order, notes, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
         ON CONFLICT (month) DO UPDATE SET
           salaries=$2, rent=$3, marketing=$4, logistics=$5, other=$6,
           total_orders=$7, cost_per_order=$8, notes=$9, updated_at=NOW()
         RETURNING *`,
        [month, salaries, rent, marketing, logistics, other, totalOrders, costPerOrder.toFixed(2), notes || null]
      );

      // إعادة حساب جميع تكاليف المنتجات عند تحديث أحدث شهر
      const latestMonth = await dbPool.query(`SELECT month FROM operational_costs ORDER BY month DESC LIMIT 1`);
      if (latestMonth.rows[0]?.month === month) {
        const allCosts = await dbPool.query(`SELECT * FROM product_costs`);
        for (const pc of allCosts.rows) {
          const { redLine, greenLine, suggestedPrice } = await calcPricingLines(
            parseFloat(pc.purchase_price), parseFloat(pc.inland_shipping), parseFloat(pc.storage_cost),
            parseFloat(pc.target_margin_percent), parseFloat(pc.safety_margin_percent), costPerOrder
          );
          await dbPool.query(
            `UPDATE product_costs SET operational_share=$1, red_line_price=$2, green_line_price=$3, suggested_price=$4, updated_at=NOW() WHERE id=$5`,
            [costPerOrder.toFixed(2), redLine.toFixed(2), greenLine.toFixed(2), suggestedPrice.toFixed(2), pc.id]
          );
        }
      }

      res.json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل حفظ التكاليف", details: e.message });
    }
  });

  // GET /api/admin/pricing/products — قائمة المنتجات مع بيانات التكلفة وحالة الهامش
  app.get("/api/admin/pricing/products", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(`
        SELECT
          p.id, p.name, p.price, p.price_sar,
          pc.id AS cost_id,
          pc.purchase_price, pc.inland_shipping, pc.storage_cost,
          pc.operational_share, pc.red_line_price, pc.green_line_price,
          pc.suggested_price, pc.target_margin_percent, pc.safety_margin_percent,
          pc.notes AS cost_notes, pc.updated_at AS cost_updated_at,
          CASE
            WHEN pc.id IS NULL THEN 'no_data'
            WHEN p.price::numeric < pc.red_line_price::numeric THEN 'danger'
            WHEN p.price::numeric < pc.green_line_price::numeric THEN 'warning'
            ELSE 'safe'
          END AS margin_status,
          CASE
            WHEN pc.red_line_price::numeric > 0
            THEN ROUND(((p.price::numeric - pc.red_line_price::numeric) / pc.red_line_price::numeric * 100)::numeric, 1)
            ELSE NULL
          END AS actual_margin_pct
        FROM products p
        LEFT JOIN product_costs pc ON pc.product_id = p.id
        ORDER BY
          CASE
            WHEN pc.id IS NULL THEN 0
            WHEN p.price::numeric < pc.red_line_price::numeric THEN 1
            WHEN p.price::numeric < pc.green_line_price::numeric THEN 2
            ELSE 3
          END,
          p.name
      `);
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب المنتجات", details: e.message });
    }
  });

  // POST /api/admin/pricing/product/:id/costs — تحديث تكاليف منتج وإعادة الحساب
  app.post("/api/admin/pricing/product/:id/costs", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const productId = parseInt(req.params.id);
      const {
        purchasePrice = 0, inlandShipping = 0, storageCost = 0,
        targetMarginPercent = 30, safetyMarginPercent = 15, notes
      } = req.body;

      const { costPerOrder, redLine, greenLine, suggestedPrice } = await calcPricingLines(
        Number(purchasePrice), Number(inlandShipping), Number(storageCost),
        Number(targetMarginPercent), Number(safetyMarginPercent)
      );

      // Check if a cost record already exists for this product
      const existing = await dbPool.query(
        `SELECT id FROM product_costs WHERE product_id = $1 LIMIT 1`,
        [productId]
      );

      let result;
      if (existing.rows.length > 0) {
        result = await dbPool.query(
          `UPDATE product_costs SET
             purchase_price=$2, inland_shipping=$3, storage_cost=$4, operational_share=$5,
             red_line_price=$6, green_line_price=$7, suggested_price=$8,
             target_margin_percent=$9, safety_margin_percent=$10, notes=$11, updated_at=NOW()
           WHERE id=$1 RETURNING *`,
          [existing.rows[0].id, purchasePrice, inlandShipping, storageCost,
           costPerOrder.toFixed(2), redLine.toFixed(2), greenLine.toFixed(2),
           suggestedPrice.toFixed(2), targetMarginPercent, safetyMarginPercent, notes || null]
        );
      } else {
        result = await dbPool.query(
          `INSERT INTO product_costs
             (product_id, purchase_price, inland_shipping, storage_cost, operational_share,
              red_line_price, green_line_price, suggested_price, target_margin_percent, safety_margin_percent, notes, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
           RETURNING *`,
          [productId, purchasePrice, inlandShipping, storageCost,
           costPerOrder.toFixed(2), redLine.toFixed(2), greenLine.toFixed(2),
           suggestedPrice.toFixed(2), targetMarginPercent, safetyMarginPercent, notes || null]
        );
      }
      res.json({ ...result.rows[0], redLine, greenLine, suggestedPrice });
    } catch (e: any) {
      res.status(500).json({ message: "فشل حفظ تكاليف المنتج", details: e.message });
    }
  });

  // GET /api/admin/pricing/report — تقرير الهوامش (المنتجات تحت خط الأمان)
  app.get("/api/admin/pricing/report", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(`
        SELECT
          p.id, p.name, p.price::numeric AS current_price,
          pc.red_line_price::numeric, pc.green_line_price::numeric, pc.suggested_price::numeric,
          pc.target_margin_percent::numeric, pc.safety_margin_percent::numeric,
          CASE
            WHEN p.price::numeric < pc.red_line_price::numeric THEN 'danger'
            WHEN p.price::numeric < pc.green_line_price::numeric THEN 'warning'
            ELSE 'safe'
          END AS margin_status,
          ROUND(((p.price::numeric - pc.red_line_price::numeric) / NULLIF(pc.red_line_price::numeric,0) * 100)::numeric, 1) AS actual_margin_pct,
          (pc.suggested_price::numeric - p.price::numeric) AS gap_to_suggested
        FROM products p
        INNER JOIN product_costs pc ON pc.product_id = p.id
        WHERE pc.red_line_price::numeric > 0
        ORDER BY actual_margin_pct ASC NULLS FIRST
      `);
      const summary = {
        total: result.rows.length,
        danger: result.rows.filter(r => r.margin_status === "danger").length,
        warning: result.rows.filter(r => r.margin_status === "warning").length,
        safe: result.rows.filter(r => r.margin_status === "safe").length,
      };
      res.json({ summary, products: result.rows });
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب التقرير", details: e.message });
    }
  });

  // ─── Admin Product Stock ─────────────────────────────────────────
  app.patch("/api/admin/products/:id/stock", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const id = parseInt(req.params.id);
      if (req.body.reorderPoint !== undefined) {
        await dbPool.query(`UPDATE products SET reorder_point=$1 WHERE id=$2`, [req.body.reorderPoint, id]);
      }
      if (req.body.stock !== undefined) {
        await storage.updateProduct(id, { stock: req.body.stock });
      }
      const r = await dbPool.query(`SELECT id, name, stock, reorder_point FROM products WHERE id=$1`, [id]);
      res.json(r.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث المخزون", details: e.message });
    }
  });

  // ─── Admin Payroll (accessible by admin token) ────────────────────
  app.get("/api/admin/payroll", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const period = (req.query.period as string) || new Date().toISOString().slice(0, 7);
      const staffRes = await dbPool.query(`
        SELECT u.id, u.full_name, u.email, u.role
        FROM users u WHERE u.role IN ('delivery','order_manager','product_manager','finance','owner')
          AND u.id IN (SELECT user_id FROM team_members WHERE is_active=true)
        ORDER BY u.role, u.full_name
      `);
      const ratesRes = await dbPool.query(`SELECT * FROM staff_rate_config`);
      const rates: Record<string, any> = {};
      ratesRes.rows.forEach((r: any) => { rates[r.role] = r; });

      const result = [];
      for (const staff of staffRes.rows) {
        const rate = rates[staff.role] || { base_salary: 0, rate_per_order: 0, payment_model: 'fixed', working_days_per_month: 26 };
        const attRes = await dbPool.query(
          `SELECT COUNT(DISTINCT date) as days FROM attendance WHERE user_id=$1 AND date LIKE $2 || '%' AND check_out IS NOT NULL`,
          [staff.id, period]
        );
        const attendanceDays = parseInt(attRes.rows[0]?.days || 0);
        const workingDays = Number(rate.working_days_per_month) || 26;
        const absenceDays = Math.max(0, workingDays - attendanceDays);
        const baseSalary = Number(rate.base_salary);
        const deductionPerDay = workingDays > 0 ? baseSalary / workingDays : 0;
        const deductions = rate.payment_model !== 'per_order' ? absenceDays * deductionPerDay : 0;
        let ordersCompleted = 0;
        if (staff.role === 'delivery') {
          const ordRes = await dbPool.query(
            `SELECT COUNT(*) as cnt FROM orders WHERE assigned_to=$1 AND status IN ('delivered','completed') AND DATE_TRUNC('month', updated_at) = DATE_TRUNC('month', ($2 || '-01')::date)`,
            [staff.id, period]
          );
          ordersCompleted = parseInt(ordRes.rows[0]?.cnt || 0);
        }
        const orderBonus = ordersCompleted * Number(rate.rate_per_order);
        const savedRes = await dbPool.query(`SELECT * FROM payroll_periods WHERE user_id=$1 AND period=$2`, [staff.id, period]);
        const saved = savedRes.rows[0];
        const bonuses = Number(saved?.bonuses || 0);
        let totalPay = 0;
        if (rate.payment_model === 'fixed') totalPay = baseSalary - deductions + bonuses;
        else if (rate.payment_model === 'per_order') totalPay = orderBonus + bonuses;
        else totalPay = (baseSalary - deductions) + orderBonus + bonuses;

        result.push({
          userId: staff.id, fullName: staff.full_name || staff.email, role: staff.role, period,
          baseSalary, ratePerOrder: Number(rate.rate_per_order), paymentModel: rate.payment_model,
          ordersCompleted, orderBonus, attendanceDays, absenceDays,
          deductions: Math.round(deductions), bonuses,
          totalPay: Math.max(0, Math.round(totalPay)),
          isPaid: saved?.is_paid || false, savedId: saved?.id || null, notes: saved?.notes || null,
        });
      }
      res.json(result);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/admin/payroll/save", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { userId, period, totalPay, bonuses, notes, isPaid, ...rest } = req.body;
      await dbPool.query(`
        INSERT INTO payroll_periods (user_id, period, base_salary, orders_completed, order_bonus,
          attendance_days, absence_days, deductions, bonuses, total_pay, is_paid, paid_at, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (user_id, period) DO UPDATE SET
          bonuses=EXCLUDED.bonuses, total_pay=EXCLUDED.total_pay,
          is_paid=EXCLUDED.is_paid, paid_at=EXCLUDED.paid_at, notes=EXCLUDED.notes
      `, [userId, period, rest.baseSalary||0, rest.ordersCompleted||0, rest.orderBonus||0,
          rest.attendanceDays||0, rest.absenceDays||0, rest.deductions||0,
          bonuses||0, totalPay, isPaid||false, isPaid ? new Date() : null, notes||null]);
      res.json({ message: "تم الحفظ" });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ════════════════════════════════════════════════════════════════
  // ─── العقود الرقمية Digital Contracts ──────────────────────────
  // ════════════════════════════════════════════════════════════════

  // جلب نص عقد معين (admin + عام)
  app.get("/api/contracts/:type", async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(`SELECT * FROM contract_texts WHERE contract_type=$1`, [req.params.type]);
      if (!r.rows[0]) return res.status(404).json({ message: "العقد غير موجود" });
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // حفظ / تحديث نص عقد (admin only)
  app.put("/api/admin/contracts/:type", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { title, body, version } = req.body;
      await dbPool.query(`
        INSERT INTO contract_texts (contract_type, title, body, version, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (contract_type) DO UPDATE SET title=EXCLUDED.title, body=EXCLUDED.body, version=EXCLUDED.version, updated_at=NOW()
      `, [req.params.type, title, body, version || "1.0"]);
      res.json({ message: "تم حفظ العقد" });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // جلب جميع سجلات القبول (admin)
  app.get("/api/admin/contracts/acceptances", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const type = req.query.type as string;
      const q = type
        ? `SELECT * FROM contract_acceptances WHERE contract_type=$1 ORDER BY accepted_at DESC`
        : `SELECT * FROM contract_acceptances ORDER BY accepted_at DESC`;
      const r = await dbPool.query(q, type ? [type] : []);
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // قبول عقد (موردون / موظفون / مسوّقون / عملاء)
  app.post("/api/contracts/accept", async (req: any, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { contractType, partyId, partyName, partyRole, contractVersion } = req.body;
      if (!contractType || !partyId) return res.status(400).json({ message: "بيانات ناقصة" });
      const ip = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
      const ua = req.headers["user-agent"] || "unknown";
      // تجنب التكرار لنفس الشخص ونفس النوع والإصدار
      const existing = await dbPool.query(
        `SELECT id FROM contract_acceptances WHERE contract_type=$1 AND party_id=$2 AND contract_version=$3`,
        [contractType, partyId, contractVersion || "1.0"]
      );
      if (existing.rows.length > 0) return res.json({ message: "تم التوثيق مسبقاً", alreadyAccepted: true });
      await dbPool.query(`
        INSERT INTO contract_acceptances (contract_type, contract_version, party_id, party_name, party_role, ip_address, user_agent)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [contractType, contractVersion || "1.0", String(partyId), partyName || null, partyRole || null, String(ip), String(ua)]);
      res.json({ message: "تم توثيق القبول بنجاح", accepted: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // فحص هل وقّع طرف معين؟
  app.get("/api/contracts/status", async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { type, partyId } = req.query;
      if (!type || !partyId) return res.status(400).json({ message: "بيانات ناقصة" });
      const r = await dbPool.query(
        `SELECT * FROM contract_acceptances WHERE contract_type=$1 AND party_id=$2 ORDER BY accepted_at DESC LIMIT 1`,
        [type, partyId]
      );
      res.json({ accepted: r.rows.length > 0, record: r.rows[0] || null });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // إحصاء الموقّعين وغير الموقّعين (admin dashboard)
  app.get("/api/admin/contracts/stats", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(`
        SELECT contract_type, COUNT(*) as total, MAX(accepted_at) as latest
        FROM contract_acceptances GROUP BY contract_type
      `);
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ════════════════════════════════════════════════════════════════
  // ─── النسخ الاحتياطية Backup System ────────────────────────────
  // ════════════════════════════════════════════════════════════════

  // تصدير النسخة الاحتياطية (admin only) — JSON كامل لكل الجداول
  app.get("/api/admin/backup/export", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const tables = [
        "users","products","categories","subcategories","orders","order_items",
        "reviews","suppliers","team_members","banners","offers","settings",
        "display_settings","navigation_settings","home_sections","home_page_settings",
        "reward_points","points_transactions","wallets","wallet_transactions",
        "notifications","user_addresses","wishlist","cart_items",
        "marketer_profiles","marketer_commissions","coupons","attendance",
        "payroll_periods","staff_rate_config","contract_texts","contract_acceptances",
        "installment_plans","supplier_payments"
      ];
      const backup: Record<string, any[]> = {};
      let totalRows = 0;
      for (const table of tables) {
        try {
          const r = await dbPool.query(`SELECT * FROM ${table}`);
          backup[table] = r.rows;
          totalRows += r.rows.length;
        } catch { backup[table] = []; }
      }
      const exportObj = {
        exportedAt: new Date().toISOString(),
        version: "OyoPlast-v1",
        tablesCount: tables.length,
        totalRows,
        data: backup,
      };
      const json = JSON.stringify(exportObj, null, 2);
      const sizeBytes = Buffer.byteLength(json, "utf8");
      // سجل في backup_logs
      await dbPool.query(`
        INSERT INTO backup_logs (triggered_by, size_bytes, tables_count, status)
        VALUES ('admin', $1, $2, 'success')
      `, [sizeBytes, tables.length]);
      const filename = `oyoplast-backup-${new Date().toISOString().slice(0,10)}.json`;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(json);
    } catch (e: any) {
      const { pool: dbPool } = await import("./db");
      await dbPool.query(`INSERT INTO backup_logs (triggered_by, status, notes) VALUES ('admin','failed',$1)`, [e.message]);
      res.status(500).json({ message: "فشل تصدير النسخة الاحتياطية", details: e.message });
    }
  });

  // سجل النسخ السابقة
  app.get("/api/admin/backup/logs", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(`SELECT * FROM backup_logs ORDER BY created_at DESC LIMIT 50`);
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── Admin Settings ──────────────────────────────────────────────
  app.get("/api/admin/settings", requireAdmin, async (_req, res) => {
    try {
      const { db: dbInstance } = await import("./db");
      const { settings } = await import("@shared/schema");
      const rows = await dbInstance.select().from(settings);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب الإعدادات", details: e.message });
    }
  });

  app.post("/api/admin/settings", requireAdmin, async (req, res) => {
    try {
      const { db: dbInstance } = await import("./db");
      const { settings } = await import("@shared/schema");
      const { key, value } = req.body;
      const [row] = await dbInstance
        .insert(settings)
        .values({ key, value })
        .onConflictDoUpdate({ target: settings.key, set: { value } })
        .returning();
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ message: "فشل حفظ الإعداد", details: e.message });
    }
  });

  // ─── Cart (Protected) ─────────────────────────────────────────────────
  app.get("/api/cart", async (req, res) => {
    try {
      const user = (req as any).user;
      // Guests have no persistent cart in DB
      if (!user) return res.json([]);
      
      const { pool: dbPool } = await import("./db");
      const uid = getUserId(user);
      
      const result = await dbPool.query(
        `SELECT
           ci.*,
           json_build_object(
             'id', p.id,
             'name', p.name,
             'price', p.price,
             'priceSar', p.price_sar,
             'imageUrl', CASE WHEN p.image_url LIKE 'data:%' THEN '/api/products/image/' || p.id ELSE p.image_url END,
             'stock', p.stock,
             'categoryId', p.category_id
           ) AS product
         FROM cart_items ci
         LEFT JOIN products p ON p.id = ci.product_id
         WHERE ci.user_id = $1`,
        [uid]
      );
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب السلة", details: e.message });
    }
  });

  app.post("/api/cart", async (req, res) => {
    try {
      const user = (req as any).user;
      
      // For guests, just return success - cart is stored in localStorage
      if (!user) return res.status(201).json({ success: true, guest: true });
      
      const userId = getUserId(user);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      
      const { db: dbInstance } = await import("./db");
      const { cartItems: cartTable } = await import("@shared/schema");
      const { eq: eqFn } = await import("drizzle-orm");
      
      const { productId, quantity, selectedSize, selectedColor, customPrinting, designNotes, designFileUrl } = req.body;
      
      // Check if item exists
      const existing = await dbInstance.select().from(cartTable)
        .where(eqFn(cartTable.userId, userId));
      
      const existingItem = existing.find(item =>
        item.productId === productId &&
        item.selectedSize === selectedSize &&
        item.selectedColor === selectedColor &&
        !item.customPrinting
      );
      
      if (existingItem && !customPrinting) {
        // Update quantity
        const [updated] = await dbInstance
          .update(cartTable)
          .set({ quantity: existingItem.quantity + quantity })
          .where(eqFn(cartTable.id, existingItem.id))
          .returning();
        return res.status(201).json(updated);
      }
      
      // Add new item
      const [newItem] = await dbInstance
        .insert(cartTable)
        .values({
          userId,
          productId,
          quantity,
          selectedSize: selectedSize || null,
          selectedColor: selectedColor || null,
          customPrinting: customPrinting || false,
          designNotes: designNotes || null,
          designFileUrl: designFileUrl || null,
        })
        .returning();
      
      res.status(201).json(newItem);
    } catch (e: any) {
      res.status(500).json({ message: "فشل إضافة للسلة", details: e.message });
    }
  });

  app.patch("/api/cart/:id", async (req, res) => {
    try {
      const user = (req as any).user;
      // Guests: just return success (handled by localStorage)
      if (!user) return res.json({ success: true, guest: true });
      
      const { db: dbInstance } = await import("./db");
      const { cartItems: cartTable } = await import("@shared/schema");
      const { eq: eqFn } = await import("drizzle-orm");
      
      const { quantity } = req.body;
      const [updated] = await dbInstance
        .update(cartTable)
        .set({ quantity })
        .where(eqFn(cartTable.id, parseInt(req.params.id)))
        .returning();
      
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث السلة", details: e.message });
    }
  });

  app.delete("/api/cart/:id", async (req, res) => {
    try {
      const user = (req as any).user;
      // Guests: just return success (handled by localStorage)
      if (!user) return res.json({ message: "تم الحذف" });
      
      const { db: dbInstance } = await import("./db");
      const { cartItems: cartTable } = await import("@shared/schema");
      const { eq: eqFn } = await import("drizzle-orm");
      
      await dbInstance.delete(cartTable).where(eqFn(cartTable.id, parseInt(req.params.id)));
      res.json({ message: "تم الحذف" });
    } catch (e: any) {
      res.status(500).json({ message: "فشل حذف من السلة", details: e.message });
    }
  });

  // ─── User Profile & Addresses (Protected) ──────────────────────────────────
  app.get("/api/profile", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user || !getUserId(user)) return res.status(401).json({ message: "Not authenticated" });
      
      res.json({ user });
    } catch (e: any) {
      res.status(500).json({ message: "Failed to fetch profile", details: e.message });
    }
  });

  app.get("/api/addresses", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user || !getUserId(user)) return res.status(401).json({ message: "Not authenticated" });

      const { db: dbInstance } = await import("./db");
      const { userAddresses: addressTable } = await import("@shared/schema");
      const { eq: eqFn } = await import("drizzle-orm");

      const addresses = await dbInstance
        .select()
        .from(addressTable)
        .where(eqFn(addressTable.userId, getUserId(user) as string));

      res.json(addresses);
    } catch (e: any) {
      res.status(500).json({ message: "Failed to fetch addresses", details: e.message });
    }
  });

  app.post("/api/addresses", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user || !getUserId(user)) return res.status(401).json({ message: "Not authenticated" });

      const { name, city, address, phone, isDefault } = req.body;
      if (!name || !city || !address || !phone) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const { db: dbInstance } = await import("./db");
      const { userAddresses: addressTable } = await import("@shared/schema");
      const { eq: eqFn } = await import("drizzle-orm");

      const uid = getUserId(user) as string;
      if (isDefault) {
        await dbInstance.update(addressTable).set({ isDefault: false }).where(eqFn(addressTable.userId, uid));
      }

      const [newAddress] = await dbInstance
        .insert(addressTable)
        .values({ userId: uid, name, city, address, phone, isDefault: isDefault || false })
        .returning();

      res.status(201).json(newAddress);
    } catch (e: any) {
      res.status(500).json({ message: "Failed to add address", details: e.message });
    }
  });

  app.post("/api/checkout/save-address", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user || !getUserId(user)) return res.status(401).json({ message: "Not authenticated" });

      const { name, city, address, phone, isDefault = true } = req.body;
      if (!name || !city || !address || !phone) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const { db: dbInstance } = await import("./db");
      const { userAddresses: addressTable } = await import("@shared/schema");
      const { eq: eqFn } = await import("drizzle-orm");

      const uid = getUserId(user) as string;
      if (isDefault) {
        await dbInstance.update(addressTable).set({ isDefault: false }).where(eqFn(addressTable.userId, uid));
      }

      const existing = await dbInstance
        .select()
        .from(addressTable)
        .where(eqFn(addressTable.userId, uid));

      const match = existing.find((row) =>
        row.phone === phone &&
        row.city === city &&
        row.address === address &&
        row.name === name
      );

      if (match) {
        const [updated] = await dbInstance
          .update(addressTable)
          .set({ isDefault: !!isDefault, updatedAt: new Date() })
          .where(eqFn(addressTable.id, match.id))
          .returning();
        return res.json(updated);
      }

      const [newAddress] = await dbInstance
        .insert(addressTable)
        .values({ userId: uid, name, city, address, phone, isDefault: !!isDefault })
        .returning();

      res.status(201).json(newAddress);
    } catch (e: any) {
      res.status(500).json({ message: "Failed to save checkout address", details: e.message });
    }
  });

  app.patch("/api/addresses/:id", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user || !getUserId(user)) return res.status(401).json({ message: "Not authenticated" });

      const { db: dbInstance } = await import("./db");
      const { userAddresses: addressTable } = await import("@shared/schema");
      const { eq: eqFn } = await import("drizzle-orm");

      const { name, city, address, phone, isDefault } = req.body;
      const uid = getUserId(user) as string;
      if (isDefault) {
        await dbInstance.update(addressTable).set({ isDefault: false }).where(eqFn(addressTable.userId, uid));
      }

      const [updated] = await dbInstance
        .update(addressTable)
        .set({ name, city, address, phone, isDefault: isDefault || false, updatedAt: new Date() })
        .where(eqFn(addressTable.id, parseInt(req.params.id)))
        .returning();

      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: "Failed to update address", details: e.message });
    }
  });

  app.delete("/api/addresses/:id", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user || !getUserId(user)) return res.status(401).json({ message: "Not authenticated" });

      const { db: dbInstance } = await import("./db");
      const { userAddresses: addressTable } = await import("@shared/schema");
      const { eq: eqFn } = await import("drizzle-orm");

      await dbInstance.delete(addressTable).where(eqFn(addressTable.id, parseInt(req.params.id)));

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: "Failed to delete address", details: e.message });
    }
  });

  // ─── Logo & Splash Settings (Public read, Admin write) ──────────────────────
  app.get("/api/logo-settings", async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query("SELECT * FROM logo_settings ORDER BY id DESC LIMIT 1");
      if (result.rows.length === 0) {
        return res.json({
          logoUrl: null,
          splashBgUrl: null,
          splashBgColor: "#ffffff",
          splashText: "أويو بلاست",
          splashTextColor: "#2196F3",
          showSplash: true,
        });
      }
      const row = result.rows[0];
      res.json({
        id: row.id,
        logoUrl: row.logo_url,
        splashBgUrl: row.splash_bg_url,
        splashBgColor: row.splash_bg_color,
        splashText: row.splash_text,
        splashTextColor: row.splash_text_color,
        showSplash: row.show_splash,
      });
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب إعدادات الشعار", details: e.message });
    }
  });

  app.patch("/api/admin/logo-settings", requireAdmin, upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "splashBg", maxCount: 1 },
  ]), async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

      // Check existing record
      const existing = await dbPool.query("SELECT id FROM logo_settings ORDER BY id DESC LIMIT 1");

      let logoUrl: string | undefined;
      let splashBgUrl: string | undefined;

      if (files?.logo?.[0]) {
        logoUrl = `data:${files.logo[0].mimetype};base64,${files.logo[0].buffer.toString("base64")}`;
      } else if (req.body.logoUrl !== undefined) {
        logoUrl = req.body.logoUrl;
      }

      if (files?.splashBg?.[0]) {
        splashBgUrl = `data:${files.splashBg[0].mimetype};base64,${files.splashBg[0].buffer.toString("base64")}`;
      } else if (req.body.splashBgUrl !== undefined) {
        splashBgUrl = req.body.splashBgUrl;
      }

      const { splashBgColor, splashText, splashTextColor, showSplash } = req.body;

      let result;
      if (existing.rows.length > 0) {
        const id = existing.rows[0].id;
        const setClauses: string[] = [];
        const values: any[] = [];
        let idx = 1;

        if (logoUrl !== undefined) { setClauses.push(`logo_url = $${idx++}`); values.push(logoUrl); }
        if (splashBgUrl !== undefined) { setClauses.push(`splash_bg_url = $${idx++}`); values.push(splashBgUrl); }
        if (splashBgColor) { setClauses.push(`splash_bg_color = $${idx++}`); values.push(splashBgColor); }
        if (splashText !== undefined) { setClauses.push(`splash_text = $${idx++}`); values.push(splashText); }
        if (splashTextColor) { setClauses.push(`splash_text_color = $${idx++}`); values.push(splashTextColor); }
        if (showSplash !== undefined) { setClauses.push(`show_splash = $${idx++}`); values.push(showSplash === "true" || showSplash === true); }
        setClauses.push(`updated_at = NOW()`);

        if (setClauses.length > 1) {
          values.push(id);
          result = await dbPool.query(
            `UPDATE logo_settings SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
            values
          );
        } else {
          result = await dbPool.query("SELECT * FROM logo_settings WHERE id = $1", [id]);
        }
      } else {
        result = await dbPool.query(
          `INSERT INTO logo_settings (logo_url, splash_bg_url, splash_bg_color, splash_text, splash_text_color, show_splash)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [
            logoUrl || null,
            splashBgUrl || null,
            splashBgColor || "#ffffff",
            splashText || "أويو بلاست",
            splashTextColor || "#2196F3",
            showSplash !== undefined ? (showSplash === "true" || showSplash === true) : true,
          ]
        );
      }

      const row = result.rows[0];
      res.json({
        id: row.id,
        logoUrl: row.logo_url,
        splashBgUrl: row.splash_bg_url,
        splashBgColor: row.splash_bg_color,
        splashText: row.splash_text,
        splashTextColor: row.splash_text_color,
        showSplash: row.show_splash,
      });
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث إعدادات الشعار", details: e.message });
    }
  });

  // ─── Offline Sync: receive pending orders ──────────────────────
  app.post("/api/sync/orders", async (req, res) => {
    try {
      const { orders: pendingOrders } = req.body;
      if (!Array.isArray(pendingOrders) || pendingOrders.length === 0) {
        return res.json({ synced: 0 });
      }

      const results = [];
      for (const orderData of pendingOrders) {
        try {
          const order = await storage.createOrder(orderData);
          results.push({ success: true, id: order.id, localId: orderData.localId });
        } catch (err: any) {
          results.push({ success: false, localId: orderData.localId, error: err.message });
        }
      }

      res.json({ synced: results.filter(r => r.success).length, results });
    } catch (e: any) {
      res.status(500).json({ message: "فشل مزامنة الطلبات", details: e.message });
    }
  });

  // ─── Image Dimensions (Public read, Admin write) ────────────────────
  app.get("/api/image-dimensions", async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        "SELECT id, image_type as imageType, width, height, description FROM image_dimensions ORDER BY id ASC"
      );
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب مقاسات الصور", details: e.message });
    }
  });

  app.patch("/api/admin/image-dimensions/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { width, height, description } = req.body;

      if (!width || !height || width <= 0 || height <= 0) {
        return res.status(400).json({ message: "المقاسات يجب أن تكون أكبر من صفر" });
      }

      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        "UPDATE image_dimensions SET width = $1, height = $2, description = $3, updated_at = NOW() WHERE id = $4 RETURNING id, image_type as imageType, width, height, description",
        [width, height, description || null, parseInt(id)]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "المقاس غير موجود" });
      }
      res.json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث المقاس", details: e.message });
    }
  });

  // ─── Digital Wallets (Public read, Admin write) ────────────────────
  // Public: only active wallets
  app.get("/api/digital-wallets", async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        `SELECT id, name, logo_url as "logoUrl", receiver_name as "receiverName", phone_number as "phoneNumber", purchase_code as "purchaseCode", is_active as "isActive", sort_order as "sortOrder", requires_proof as "requiresProof", instructions FROM digital_wallets WHERE is_active = true ORDER BY sort_order ASC, id ASC`
      );
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب المحافظ", details: e.message });
    }
  });

  // Admin: ALL wallets (including inactive) for management
  app.get("/api/admin/digital-wallets", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        `SELECT id, name, logo_url as "logoUrl", receiver_name as "receiverName", phone_number as "phoneNumber", purchase_code as "purchaseCode", is_active as "isActive", sort_order as "sortOrder", requires_proof as "requiresProof", instructions FROM digital_wallets ORDER BY sort_order ASC, id ASC`
      );
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب المحافظ", details: e.message });
    }
  });

  app.post("/api/admin/digital-wallets", requireAdmin, upload.single("logo"), async (req, res) => {
    try {
      const { name, receiverName, phoneNumber, purchaseCode, isActive, sortOrder, requiresProof, instructions } = req.body;
      if (!name || !receiverName || !phoneNumber) {
        return res.status(400).json({ message: "الاسم ورقم الحساب واسم المستلم مطلوبة" });
      }

      let logoUrl: string | null = null;
      if (req.file) {
        logoUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      }

      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        `INSERT INTO digital_wallets (name, logo_url, receiver_name, phone_number, purchase_code, is_active, sort_order, requires_proof, instructions)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, name, logo_url as "logoUrl", receiver_name as "receiverName", phone_number as "phoneNumber", purchase_code as "purchaseCode", is_active as "isActive", sort_order as "sortOrder", requires_proof as "requiresProof", instructions`,
        [name, logoUrl, receiverName, phoneNumber, purchaseCode || "", isActive !== "false", parseInt(sortOrder) || 0, requiresProof !== "false", instructions || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل إنشاء المحفظة", details: e.message });
    }
  });

  app.patch("/api/admin/digital-wallets/:id", requireAdmin, upload.single("logo"), async (req, res) => {
    try {
      const { id } = req.params;
      const { name, receiverName, phoneNumber, purchaseCode, isActive, sortOrder, requiresProof, instructions } = req.body;

      const { pool: dbPool } = await import("./db");
      const setClauses: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (name !== undefined) { setClauses.push(`name = $${idx++}`); values.push(name); }
      if (receiverName !== undefined) { setClauses.push(`receiver_name = $${idx++}`); values.push(receiverName); }
      if (phoneNumber !== undefined) { setClauses.push(`phone_number = $${idx++}`); values.push(phoneNumber); }
      if (purchaseCode !== undefined) { setClauses.push(`purchase_code = $${idx++}`); values.push(purchaseCode); }
      if (isActive !== undefined) { setClauses.push(`is_active = $${idx++}`); values.push(isActive !== "false" && isActive !== false); }
      if (sortOrder !== undefined) { setClauses.push(`sort_order = $${idx++}`); values.push(parseInt(sortOrder)); }
      if (requiresProof !== undefined) { setClauses.push(`requires_proof = $${idx++}`); values.push(requiresProof !== "false" && requiresProof !== false); }
      if (instructions !== undefined) { setClauses.push(`instructions = $${idx++}`); values.push(instructions || null); }
      if (req.file) {
        const logoUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
        setClauses.push(`logo_url = $${idx++}`);
        values.push(logoUrl);
      }
      setClauses.push(`updated_at = NOW()`);

      if (setClauses.length <= 1) {
        return res.status(400).json({ message: "لا توجد تحديثات" });
      }

      values.push(parseInt(id));
      const result = await dbPool.query(
        `UPDATE digital_wallets SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING id, name, logo_url as "logoUrl", receiver_name as "receiverName", phone_number as "phoneNumber", purchase_code as "purchaseCode", is_active as "isActive", sort_order as "sortOrder", requires_proof as "requiresProof", instructions`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "المحفظة غير موجودة" });
      }
      res.json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث المحفظة", details: e.message });
    }
  });

  app.delete("/api/admin/digital-wallets/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { pool: dbPool } = await import("./db");
      await dbPool.query("DELETE FROM digital_wallets WHERE id = $1", [parseInt(id)]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: "فشل حذف المحفظة", details: e.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════
  // ─── Bank Accounts (حسابات بنكية للتحويل) ─────────────────────────
  // ══════════════════════════════════════════════════════════════════

  app.get("/api/bank-accounts", async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        `SELECT id, bank_name as "bankName", account_name as "accountName", account_number as "accountNumber", iban, branch, logo_url as "logoUrl", instructions, is_active as "isActive", sort_order as "sortOrder" FROM bank_accounts WHERE is_active = true ORDER BY sort_order ASC, id ASC`
      );
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب الحسابات البنكية", details: e.message });
    }
  });

  app.get("/api/admin/bank-accounts", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        `SELECT id, bank_name as "bankName", account_name as "accountName", account_number as "accountNumber", iban, branch, logo_url as "logoUrl", instructions, is_active as "isActive", sort_order as "sortOrder" FROM bank_accounts ORDER BY sort_order ASC, id ASC`
      );
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب الحسابات البنكية", details: e.message });
    }
  });

  app.post("/api/admin/bank-accounts", requireAdmin, upload.single("logo"), async (req, res) => {
    try {
      const { bankName, accountName, accountNumber, iban, branch, instructions, isActive, sortOrder } = req.body;
      if (!bankName || !accountName || !accountNumber) {
        return res.status(400).json({ message: "اسم البنك واسم الحساب ورقم الحساب مطلوبة" });
      }
      let logoUrl = "";
      if (req.file) {
        logoUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      }
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        `INSERT INTO bank_accounts (bank_name, account_name, account_number, iban, branch, logo_url, instructions, is_active, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, bank_name as "bankName", account_name as "accountName", account_number as "accountNumber", iban, branch, logo_url as "logoUrl", instructions, is_active as "isActive", sort_order as "sortOrder"`,
        [bankName, accountName, accountNumber, iban || null, branch || null, logoUrl, instructions || null, isActive !== "false", parseInt(sortOrder) || 0]
      );
      res.status(201).json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل إضافة الحساب البنكي", details: e.message });
    }
  });

  app.patch("/api/admin/bank-accounts/:id", requireAdmin, upload.single("logo"), async (req, res) => {
    try {
      const { id } = req.params;
      const { bankName, accountName, accountNumber, iban, branch, instructions, isActive, sortOrder } = req.body;
      const { pool: dbPool } = await import("./db");
      const setClauses: string[] = [];
      const values: any[] = [];
      let idx = 1;
      if (bankName !== undefined) { setClauses.push(`bank_name = $${idx++}`); values.push(bankName); }
      if (accountName !== undefined) { setClauses.push(`account_name = $${idx++}`); values.push(accountName); }
      if (accountNumber !== undefined) { setClauses.push(`account_number = $${idx++}`); values.push(accountNumber); }
      if (iban !== undefined) { setClauses.push(`iban = $${idx++}`); values.push(iban || null); }
      if (branch !== undefined) { setClauses.push(`branch = $${idx++}`); values.push(branch || null); }
      if (instructions !== undefined) { setClauses.push(`instructions = $${idx++}`); values.push(instructions || null); }
      if (isActive !== undefined) { setClauses.push(`is_active = $${idx++}`); values.push(isActive !== "false" && isActive !== false); }
      if (sortOrder !== undefined) { setClauses.push(`sort_order = $${idx++}`); values.push(parseInt(sortOrder) || 0); }
      if (req.file) {
        setClauses.push(`logo_url = $${idx++}`);
        values.push(`data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`);
      }
      if (!setClauses.length) return res.status(400).json({ message: "لا توجد تحديثات" });
      values.push(parseInt(id));
      const result = await dbPool.query(
        `UPDATE bank_accounts SET ${setClauses.join(", ")} WHERE id = $${idx}
         RETURNING id, bank_name as "bankName", account_name as "accountName", account_number as "accountNumber", iban, branch, logo_url as "logoUrl", instructions, is_active as "isActive", sort_order as "sortOrder"`,
        values
      );
      if (!result.rows[0]) return res.status(404).json({ message: "الحساب غير موجود" });
      res.json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث الحساب البنكي", details: e.message });
    }
  });

  app.delete("/api/admin/bank-accounts/:id", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      await dbPool.query("DELETE FROM bank_accounts WHERE id = $1", [parseInt(req.params.id)]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: "فشل حذف الحساب البنكي", details: e.message });
    }
  });

  // ─── Products with Pagination support ───────────────────────────
  app.get("/api/products/paginated", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
      const search = req.query.search as string | undefined;
      const offset = (page - 1) * limit;

      const { pool: dbPool } = await import("./db");

      let countQuery = "SELECT COUNT(*) FROM products";
      let dataQuery = "SELECT * FROM products";
      const params: any[] = [];
      const conditions: string[] = [];
      let idx = 1;

      if (categoryId) {
        conditions.push(`category_id = $${idx++}`);
        params.push(categoryId);
      }
      if (search) {
        conditions.push(`(name ILIKE $${idx} OR description ILIKE $${idx})`);
        params.push(`%${search}%`);
        idx++;
      }

      if (conditions.length > 0) {
        const where = ` WHERE ${conditions.join(" AND ")}`;
        countQuery += where;
        dataQuery += where;
      }

      const countResult = await dbPool.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count);

      dataQuery += ` ORDER BY id DESC LIMIT $${idx} OFFSET $${idx + 1}`;
      params.push(limit, offset);

      const dataResult = await dbPool.query(dataQuery, params);

      res.json({
        products: dataResult.rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      });
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب المنتجات", details: e.message });
    }
  });

  // ── عرض رموز OTP النشطة (للإدارة يدوياً عند فشل البوابة) ────────
  app.get("/api/admin/active-otps", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        `SELECT phone, code, expires_at, created_at, attempts
         FROM phone_verifications
         WHERE verified = false AND expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 50`
      );
      res.json({ otps: result.rows });
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب الرموز", details: e.message });
    }
  });

  // ── سجلات الأمان ─────────────────────────────────────────────────
  app.get("/api/admin/security-logs", requireAdmin, getSecurityLogs);

  // ── تشخيص Twilio SMS ────────────────────────────────────────────
  app.post("/api/admin/test-sms", requireAdmin, async (req, res) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;
    const ultraInstance = process.env.ULTRAMSG_INSTANCE_ID;
    const ultraToken = process.env.ULTRAMSG_TOKEN;

    const configured = !!(accountSid && authToken && fromNumber);

    const report: any = {
      timestamp: new Date().toISOString(),
      config: {
        twilio: {
          configured,
          accountSid: accountSid ? accountSid.substring(0, 6) + "***" : "غير محدد",
          fromNumber: fromNumber || "غير محدد",
        },
        ultraMsg: {
          configured: !!(ultraInstance && ultraToken),
          instance: ultraInstance ? ultraInstance.substring(0, 4) + "***" : "غير محدد",
        },
      },
      tests: {} as any,
    };

    if (!configured) {
      report.tests.twilio = {
        ok: false,
        note: "TWILIO_ACCOUNT_SID أو TWILIO_AUTH_TOKEN أو TWILIO_FROM_NUMBER غير محددة في Secrets",
      };
      return res.json(report);
    }

    // اختبار إرسال فعلي عبر Twilio
    const testPhone: string = req.body?.testPhone || "+967700000000";
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    try {
      const twilioRes = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${credentials}`,
        },
        body: new URLSearchParams({
          To: testPhone,
          From: fromNumber!,
          Body: "اويو بلاست: اختبار Twilio — رسالة تجريبية",
        }),
        signal: AbortSignal.timeout(10000),
      });

      const data = await twilioRes.json();
      report.tests.twilio = {
        ok: twilioRes.ok && !!data.sid,
        status: twilioRes.status,
        sid: data.sid || null,
        diagnosis: twilioRes.ok && data.sid
          ? `✅ تم الإرسال بنجاح — SID: ${data.sid}`
          : `خطأ ${twilioRes.status}: ${data.message || data.code || "غير معروف"}`,
      };
    } catch (e: any) {
      report.tests.twilio = { ok: false, error: e.message };
    }

    res.json(report);
  });

  // ════════════════════════════════════════════════════════════════════
  // ─── STAFF MANAGEMENT (Admin Only) ───────────────────────────────
  // ════════════════════════════════════════════════════════════════════

  // ─── List all staff ───────────────────────────────────────────────
  app.get("/api/admin/staff", requireAdmin, async (_req, res) => {
    try {
      const { db: dbI } = await import("./db");
      const { users: usersT } = await import("@shared/schema");
      const { ne, and } = await import("drizzle-orm");
      const staff = await dbI.select({
        id: usersT.id,
        email: usersT.email,
        fullName: usersT.fullName,
        phone: usersT.phone,
        role: usersT.role,
        permissions: usersT.permissions,
        createdAt: usersT.createdAt,
      }).from(usersT)
        .where(and(
          ne(usersT.role, "customer"),
          ne(usersT.role, "marketer"),
        ));
      res.json(staff);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب قائمة الموظفين", error: e.message });
    }
  });

  // ─── Create staff account ─────────────────────────────────────────
  app.post("/api/admin/staff", requireAdmin, async (req, res) => {
    try {
      const { email, password, fullName, phone, role, title, permissions } = req.body;
      if (!email || !password || !role) {
        return res.status(400).json({ message: "البريد الإلكتروني وكلمة المرور والدور مطلوبة" });
      }
      const validRoles = ["product_manager", "order_manager", "delivery", "finance", "owner"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: "الدور غير صالح" });
      }
      const { hashPassword } = await import("./auth-utils");
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const existing = await authStorage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "البريد الإلكتروني مستخدم بالفعل" });
      }
      const passwordHash = hashPassword(password);
      const { db: dbI } = await import("./db");
      const { users: usersT } = await import("@shared/schema");
      const [user] = await dbI.insert(usersT).values({
        email,
        passwordHash,
        fullName: fullName || null,
        phone: phone || null,
        role,
        accountType: "staff",
        authProvider: "email",
        isEmailVerified: "true",
        permissions: permissions || null,
      }).returning();
      // Also insert into team_members
      const { pool: dbPool2 } = await import("./db");
      await dbPool2.query(
        `INSERT INTO team_members (user_id, role, title, is_active, permissions) VALUES ($1, $2, $3, true, $4)
         ON CONFLICT (user_id) DO UPDATE SET role=$2, title=$3, permissions=$4`,
        [user.id, role, title || null, permissions ? JSON.stringify(permissions) : null]
      );
      res.status(201).json({ id: user.id, email: user.email, fullName: user.fullName, role: user.role });
    } catch (e: any) {
      res.status(500).json({ message: "فشل إنشاء حساب الموظف", error: e.message });
    }
  });

  // ─── Update staff ─────────────────────────────────────────────────
  app.put("/api/admin/staff/:id", requireAdmin, async (req, res) => {
    try {
      const { db: dbI } = await import("./db");
      const { users: usersT } = await import("@shared/schema");
      const { eq: eqFn } = await import("drizzle-orm");
      const { fullName, phone, role, title, permissions, password, isActive } = req.body;
      const updates: Record<string, any> = {};
      if (fullName !== undefined) updates.fullName = fullName;
      if (phone !== undefined) updates.phone = phone;
      if (role !== undefined) updates.role = role;
      if (permissions !== undefined) updates.permissions = permissions;
      if (password) {
        const { hashPassword } = await import("./auth-utils");
        updates.passwordHash = hashPassword(password);
      }
      const [updated] = await dbI.update(usersT).set(updates).where(eqFn(usersT.id, req.params.id)).returning();
      if (!updated) return res.status(404).json({ message: "الموظف غير موجود" });
      // Update team_members table
      if (role !== undefined || title !== undefined || isActive !== undefined || permissions !== undefined) {
        const { pool: dbPool3 } = await import("./db");
        await dbPool3.query(
          `UPDATE team_members SET role=COALESCE($2,role), title=COALESCE($3,title), is_active=COALESCE($4,is_active), permissions=COALESCE($5,permissions) WHERE user_id=$1`,
          [req.params.id, role || null, title || null, isActive !== undefined ? isActive : null, permissions ? JSON.stringify(permissions) : null]
        );
      }
      res.json({ id: updated.id, email: updated.email, fullName: updated.fullName, role: updated.role });
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث بيانات الموظف", error: e.message });
    }
  });

  // ─── Delete / Deactivate staff ────────────────────────────────────
  app.delete("/api/admin/staff/:id", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const staffId = req.params.id;
      // Set role to 'customer' to deactivate (not delete — keeps order history)
      await dbPool.query(`UPDATE users SET role='customer', account_type='customer' WHERE id=$1`, [staffId]);
      await dbPool.query(`UPDATE team_members SET is_active=false WHERE user_id=$1`, [staffId]);
      res.json({ message: "تم إلغاء تفعيل الحساب" });
    } catch (e: any) {
      res.status(500).json({ message: "فشل حذف الموظف", error: e.message });
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // ─── STAFF PORTAL ROUTES (Authenticated Staff Users) ─────────────
  // ════════════════════════════════════════════════════════════════════

  // Middleware to check staff role
  function requireStaff(allowedRoles: string[]) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ message: "يجب تسجيل الدخول" });
      const userId = user.claims?.sub;
      if (!userId) return res.status(401).json({ message: "جلسة غير صالحة" });
      try {
        const { db: dbI } = await import("./db");
        const { users: usersT } = await import("@shared/schema");
        const { eq: eqFn } = await import("drizzle-orm");
        const [dbUser] = await dbI.select({ role: usersT.role, permissions: usersT.permissions }).from(usersT).where(eqFn(usersT.id, userId));
        if (!dbUser) return res.status(401).json({ message: "مستخدم غير موجود" });
        const staffRoles = ["product_manager", "order_manager", "delivery", "finance", "owner"];
        if (!staffRoles.includes(dbUser.role || "")) return res.status(403).json({ message: "غير مصرح لك بالدخول" });
        if (allowedRoles.length > 0 && !allowedRoles.includes(dbUser.role || "")) {
          return res.status(403).json({ message: "ليس لديك صلاحية لهذه العملية" });
        }
        (req as any).staffRole = dbUser.role;
        (req as any).staffPermissions = dbUser.permissions;
        next();
      } catch (e: any) {
        res.status(500).json({ message: "خطأ في التحقق من الصلاحيات" });
      }
    };
  }

  // ─── Staff: Get my info ────────────────────────────────────────────
  app.get("/api/staff/me", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ message: "يجب تسجيل الدخول" });
      const userId = user.claims?.sub;
      const { db: dbI } = await import("./db");
      const { users: usersT } = await import("@shared/schema");
      const { eq: eqFn } = await import("drizzle-orm");
      const [dbUser] = await dbI.select({
        id: usersT.id, email: usersT.email, fullName: usersT.fullName,
        phone: usersT.phone, role: usersT.role, permissions: usersT.permissions,
      }).from(usersT).where(eqFn(usersT.id, userId));
      if (!dbUser) return res.status(404).json({ message: "مستخدم غير موجود" });
      const staffRoles = ["product_manager", "order_manager", "delivery", "finance", "owner"];
      if (!staffRoles.includes(dbUser.role || "")) return res.status(403).json({ message: "غير مصرح" });
      res.json(dbUser);
    } catch (e: any) {
      res.status(500).json({ message: "خطأ في جلب البيانات" });
    }
  });

  // ─── Staff: Get orders (filtered by role) ─────────────────────────
  app.get("/api/staff/orders", requireStaff([]), async (req, res) => {
    try {
      const role = (req as any).staffRole;
      const userId = (req as any).user?.claims?.sub;
      const { pool: dbPool } = await import("./db");
      let query = "";
      let params: any[] = [];
      if (role === "delivery") {
        query = `SELECT o.*, 
          (SELECT json_agg(oi.*) FROM order_items oi WHERE oi.order_id = o.id) as items
          FROM orders o WHERE o.assigned_to=$1 ORDER BY o.created_at DESC LIMIT 200`;
        params = [userId];
      } else {
        query = `SELECT o.*,
          (SELECT json_agg(oi.*) FROM order_items oi WHERE oi.order_id = o.id) as items
          FROM orders o ORDER BY o.created_at DESC LIMIT 500`;
      }
      const result = await dbPool.query(query, params);
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب الطلبات", error: e.message });
    }
  });

  // ─── Staff: Update order status ───────────────────────────────────
  app.put("/api/staff/orders/:id/status", requireStaff(["order_manager", "delivery", "owner"]), async (req, res) => {
    try {
      const { status, note } = req.body;
      const userId = (req as any).user?.claims?.sub;
      const role = (req as any).staffRole;
      const validStatuses = ["pending", "processing", "shipped", "delivered", "completed", "cancelled"];
      if (!validStatuses.includes(status)) return res.status(400).json({ message: "حالة غير صالحة" });
      // Delivery staff can only update delivery statuses
      if (role === "delivery" && !["shipped", "delivered", "completed"].includes(status)) {
        return res.status(403).json({ message: "لا يمكنك تغيير الطلب إلى هذه الحالة" });
      }
      const { pool: dbPool } = await import("./db");
      // Get current order
      const current = await dbPool.query("SELECT status, status_history, assigned_to FROM orders WHERE id=$1", [req.params.id]);
      if (!current.rows.length) return res.status(404).json({ message: "الطلب غير موجود" });
      // Delivery staff can only update their own orders
      if (role === "delivery" && current.rows[0].assigned_to !== userId) {
        return res.status(403).json({ message: "هذا الطلب غير مخصص لك" });
      }
      const history = current.rows[0].status_history || [];
      history.push({ status, changedBy: userId, role, note: note || null, at: new Date().toISOString() });
      await dbPool.query(
        "UPDATE orders SET status=$1, status_history=$2 WHERE id=$3",
        [status, JSON.stringify(history), req.params.id]
      );
      res.json({ message: "تم تحديث حالة الطلب", status });
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث الحالة", error: e.message });
    }
  });

  // ─── Staff: Update payment status ─────────────────────────────────
  app.put("/api/staff/orders/:id/payment", requireStaff(["finance", "order_manager", "delivery", "owner"]), async (req, res) => {
    try {
      const { paymentStatus, note } = req.body;
      const validPayments = ["unpaid", "cod_collected", "transferred", "partial", "refunded"];
      if (!validPayments.includes(paymentStatus)) return res.status(400).json({ message: "حالة دفع غير صالحة" });
      const { pool: dbPool } = await import("./db");
      await dbPool.query("UPDATE orders SET payment_status=$1 WHERE id=$2", [paymentStatus, req.params.id]);
      res.json({ message: "تم تحديث حالة الدفع", paymentStatus });
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث حالة الدفع", error: e.message });
    }
  });

  // ─── Staff: Assign order to delivery ──────────────────────────────
  app.put("/api/staff/orders/:id/assign", requireStaff(["order_manager", "owner"]), async (req, res) => {
    try {
      const { deliveryUserId } = req.body;
      const { pool: dbPool } = await import("./db");
      await dbPool.query("UPDATE orders SET assigned_to=$1 WHERE id=$2", [deliveryUserId || null, req.params.id]);
      res.json({ message: "تم تخصيص الطلب", deliveryUserId });
    } catch (e: any) {
      res.status(500).json({ message: "فشل تخصيص الطلب", error: e.message });
    }
  });

  // ─── Staff: Get delivery staff list (for assignment) ──────────────
  app.get("/api/staff/delivery-team", requireStaff(["order_manager", "owner"]), async (_req, res) => {
    try {
      const { db: dbI } = await import("./db");
      const { users: usersT } = await import("@shared/schema");
      const { eq: eqFn } = await import("drizzle-orm");
      const team = await dbI.select({ id: usersT.id, fullName: usersT.fullName, phone: usersT.phone }).from(usersT).where(eqFn(usersT.role, "delivery"));
      res.json(team);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب فريق التوصيل" });
    }
  });

  // ─── Staff: Products (product_manager) ────────────────────────────
  app.get("/api/staff/products", requireStaff(["product_manager", "owner"]), async (_req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب المنتجات" });
    }
  });

  // ─── Staff: Financial summary (finance) ───────────────────────────
  app.get("/api/staff/financial-summary", requireStaff(["finance", "owner"]), async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(`
        SELECT
          COUNT(*) as total_orders,
          SUM(CASE WHEN payment_status = 'cod_collected' OR payment_status = 'transferred' THEN total::numeric ELSE 0 END) as collected_amount,
          SUM(CASE WHEN payment_status = 'unpaid' AND status != 'cancelled' THEN total::numeric ELSE 0 END) as pending_amount,
          SUM(CASE WHEN status = 'cancelled' THEN total::numeric ELSE 0 END) as cancelled_amount,
          COUNT(CASE WHEN status = 'delivered' OR status = 'completed' THEN 1 END) as delivered_count,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_count,
          COUNT(CASE WHEN payment_status = 'cod_collected' THEN 1 END) as cod_collected_count,
          COUNT(CASE WHEN payment_status = 'unpaid' AND status != 'cancelled' THEN 1 END) as unpaid_count
        FROM orders
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `);
      res.json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب الملخص المالي" });
    }
  });

  // ─── Staff: Products Management (product_manager) ──────────────────────
  app.post("/api/staff/products", requireStaff(["product_manager", "owner"]), async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { name, price, priceSar, categoryId, stock, description } = req.body;
      if (!name || !price || !categoryId) return res.status(400).json({ message: "الاسم والسعر والفئة مطلوبة" });
      const r = await dbPool.query(
        `INSERT INTO products (name, price, price_sar, category_id, stock, description, is_active) VALUES ($1,$2,$3,$4,$5,$6,true) RETURNING *`,
        [name, price, priceSar || null, categoryId, stock || 0, description || null]
      );
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.put("/api/staff/products/:id", requireStaff(["product_manager", "owner"]), async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { name, price, priceSar, stock, description, isActive } = req.body;
      const r = await dbPool.query(
        `UPDATE products SET name=COALESCE($1,name), price=COALESCE($2,price), price_sar=COALESCE($3,price_sar),
         stock=COALESCE($4,stock), description=COALESCE($5,description), is_active=COALESCE($6,is_active) WHERE id=$7 RETURNING *`,
        [name||null, price||null, priceSar||null, stock!=null?stock:null, description||null, isActive!=null?isActive:null, req.params.id]
      );
      if (!r.rows.length) return res.status(404).json({ message: "المنتج غير موجود" });
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── Staff: Attendance (الحضور والانصراف) ───────────────────────────────
  app.post("/api/staff/attendance/checkin", requireStaff([]), async (req: any, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const userId = req.user.claims.sub;
      const today = new Date().toISOString().slice(0, 10);
      // تحقق من عدم وجود تسجيل حضور مفتوح اليوم
      const existing = await dbPool.query(
        `SELECT id FROM attendance WHERE user_id=$1 AND date=$2 AND check_out IS NULL`, [userId, today]
      );
      if (existing.rows.length) return res.status(400).json({ message: "أنت بالفعل مسجّل حضورك، سجّل انصرافك أولاً" });
      const r = await dbPool.query(
        `INSERT INTO attendance (user_id, check_in, date) VALUES ($1, NOW(), $2) RETURNING *`,
        [userId, today]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/staff/attendance/checkout", requireStaff([]), async (req: any, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const userId = req.user.claims.sub;
      const today = new Date().toISOString().slice(0, 10);
      const open = await dbPool.query(
        `SELECT * FROM attendance WHERE user_id=$1 AND date=$2 AND check_out IS NULL ORDER BY check_in DESC LIMIT 1`, [userId, today]
      );
      if (!open.rows.length) return res.status(400).json({ message: "لا يوجد تسجيل حضور مفتوح اليوم" });
      const rec = open.rows[0];
      const mins = Math.round((Date.now() - new Date(rec.check_in).getTime()) / 60000);
      const r = await dbPool.query(
        `UPDATE attendance SET check_out=NOW(), total_minutes=$1 WHERE id=$2 RETURNING *`,
        [mins, rec.id]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/staff/attendance/today", requireStaff([]), async (req: any, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const userId = req.user.claims.sub;
      const today = new Date().toISOString().slice(0, 10);
      const r = await dbPool.query(
        `SELECT * FROM attendance WHERE user_id=$1 AND date=$2 ORDER BY check_in DESC LIMIT 1`, [userId, today]
      );
      res.json(r.rows[0] || null);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/staff/attendance/history", requireStaff([]), async (req: any, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const userId = req.user.claims.sub;
      const r = await dbPool.query(
        `SELECT * FROM attendance WHERE user_id=$1 ORDER BY date DESC, check_in DESC LIMIT 30`, [userId]
      );
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/finance/attendance-summary", requireStaff(["finance", "owner", "order_manager"]), async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
      const r = await dbPool.query(`
        SELECT u.id, u.full_name, u.email, u.role,
          COUNT(DISTINCT a.date) as days_present,
          SUM(a.total_minutes) as total_minutes,
          MAX(CASE WHEN a.date = CURRENT_DATE::text AND a.check_out IS NULL THEN 1 ELSE 0 END) as is_checked_in_now,
          MAX(CASE WHEN a.date = CURRENT_DATE::text THEN a.check_in ELSE NULL END) as today_check_in
        FROM users u
        LEFT JOIN attendance a ON a.user_id = u.id AND a.date LIKE $1 || '%'
        WHERE u.role IN ('delivery','order_manager','product_manager','finance','owner')
          AND (u.account_type != 'customer' OR u.role != 'customer')
        GROUP BY u.id, u.full_name, u.email, u.role
        ORDER BY u.role, u.full_name
      `, [month]);
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // تعديل الحضور (مدير فقط)
  app.post("/api/finance/attendance/override", requireStaff(["finance", "owner"]), async (req: any, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { userId, date, checkIn, checkOut, notes } = req.body;
      if (!userId || !date || !checkIn) return res.status(400).json({ message: "بيانات ناقصة" });
      const mins = checkOut ? Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 60000) : null;
      await dbPool.query(`DELETE FROM attendance WHERE user_id=$1 AND date=$2`, [userId, date]);
      const r = await dbPool.query(
        `INSERT INTO attendance (user_id, check_in, check_out, total_minutes, date, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [userId, checkIn, checkOut||null, mins, date, notes||null]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── Finance: Expenses (المصاريف) ───────────────────────────────────────
  app.get("/api/finance/expenses", requireStaff(["finance", "owner"]), async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
      const r = await dbPool.query(
        `SELECT * FROM expenses WHERE date LIKE $1 || '%' ORDER BY date DESC, created_at DESC`, [month]
      );
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/finance/expenses", requireStaff(["finance", "owner"]), async (req: any, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { type, description, amount, currency, date, isRecurring, recurringDay, notes } = req.body;
      if (!type || !description || !amount || !date) return res.status(400).json({ message: "النوع والوصف والمبلغ والتاريخ مطلوبة" });
      const r = await dbPool.query(
        `INSERT INTO expenses (type, description, amount, currency, date, is_recurring, recurring_day, added_by, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [type, description, amount, currency||"YER", date, isRecurring||false, recurringDay||null, req.user.claims.sub, notes||null]
      );
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.put("/api/finance/expenses/:id", requireStaff(["finance", "owner"]), async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { type, description, amount, currency, date, notes } = req.body;
      const r = await dbPool.query(
        `UPDATE expenses SET type=COALESCE($1,type), description=COALESCE($2,description), amount=COALESCE($3,amount),
         currency=COALESCE($4,currency), date=COALESCE($5,date), notes=COALESCE($6,notes) WHERE id=$7 RETURNING *`,
        [type||null, description||null, amount||null, currency||null, date||null, notes||null, req.params.id]
      );
      if (!r.rows.length) return res.status(404).json({ message: "المصروف غير موجود" });
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/finance/expenses/:id", requireStaff(["finance", "owner"]), async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      await dbPool.query(`DELETE FROM expenses WHERE id=$1`, [req.params.id]);
      res.json({ message: "تم الحذف" });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── Finance: Assets / Depreciation (الأصول والاهلاكات) ────────────────
  app.get("/api/finance/assets", requireStaff(["finance", "owner"]), async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(`SELECT * FROM assets WHERE is_active=true ORDER BY created_at DESC`);
      // احتساب القيمة الحالية والاهلاك الشهري لكل أصل
      const enriched = r.rows.map((a: any) => {
        const monthlyDep = Number(a.original_value) / a.useful_life_months;
        const monthsElapsed = Math.floor(
          (Date.now() - new Date(a.purchase_date + "-01").getTime()) / (1000 * 60 * 60 * 24 * 30)
        );
        const currentValue = Math.max(0, Number(a.original_value) - monthlyDep * monthsElapsed);
        return { ...a, monthlyDepreciation: monthlyDep.toFixed(0), currentValue: currentValue.toFixed(0), monthsElapsed };
      });
      res.json(enriched);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/finance/assets", requireStaff(["finance", "owner"]), async (req: any, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { name, originalValue, purchaseDate, usefulLifeMonths, notes } = req.body;
      if (!name || !originalValue || !purchaseDate || !usefulLifeMonths) return res.status(400).json({ message: "بيانات ناقصة" });
      const r = await dbPool.query(
        `INSERT INTO assets (name, original_value, purchase_date, useful_life_months, notes, added_by)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [name, originalValue, purchaseDate, usefulLifeMonths, notes||null, req.user.claims.sub]
      );
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/finance/assets/:id", requireStaff(["finance", "owner"]), async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      await dbPool.query(`UPDATE assets SET is_active=false WHERE id=$1`, [req.params.id]);
      res.json({ message: "تم الحذف" });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── Finance: Staff Rates Config (إعداد الأجور) ────────────────────────
  app.get("/api/finance/staff-rates", requireStaff(["finance", "owner"]), async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(`SELECT * FROM staff_rate_config ORDER BY role`);
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.put("/api/finance/staff-rates/:role", requireStaff(["finance", "owner"]), async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { baseSalary, ratePerOrder, paymentModel, overtimeRatePerHour, workingDaysPerMonth } = req.body;
      await dbPool.query(
        `UPDATE staff_rate_config SET base_salary=COALESCE($1,base_salary), rate_per_order=COALESCE($2,rate_per_order),
         payment_model=COALESCE($3,payment_model), overtime_rate_per_hour=COALESCE($4,overtime_rate_per_hour),
         working_days_per_month=COALESCE($5,working_days_per_month), updated_at=NOW() WHERE role=$6`,
        [baseSalary??null, ratePerOrder??null, paymentModel||null, overtimeRatePerHour??null, workingDaysPerMonth??null, req.params.role]
      );
      res.json({ message: "تم التحديث" });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── Finance: Payroll Calculation (احتساب الرواتب) ─────────────────────
  app.get("/api/finance/payroll", requireStaff(["finance", "owner"]), async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const period = (req.query.period as string) || new Date().toISOString().slice(0, 7);

      // جلب كل الموظفين + إعدادات الأجور
      const staffRes = await dbPool.query(`
        SELECT u.id, u.full_name, u.email, u.role
        FROM users u WHERE u.role IN ('delivery','order_manager','product_manager','finance','owner')
          AND u.id IN (SELECT user_id FROM team_members WHERE is_active=true)
        ORDER BY u.role, u.full_name
      `);
      const ratesRes = await dbPool.query(`SELECT * FROM staff_rate_config`);
      const rates: Record<string, any> = {};
      ratesRes.rows.forEach((r: any) => { rates[r.role] = r; });

      const result = [];
      for (const staff of staffRes.rows) {
        const rate = rates[staff.role] || { base_salary: 0, rate_per_order: 0, payment_model: 'fixed', working_days_per_month: 26 };

        // احتساب الحضور
        const attRes = await dbPool.query(
          `SELECT COUNT(DISTINCT date) as days, SUM(total_minutes) as total_mins
           FROM attendance WHERE user_id=$1 AND date LIKE $2 || '%' AND check_out IS NOT NULL`,
          [staff.id, period]
        );
        const attendanceDays = parseInt(attRes.rows[0]?.days || 0);
        const totalHours = Math.round((attRes.rows[0]?.total_mins || 0) / 60);
        const workingDays = rate.working_days_per_month;
        const absenceDays = Math.max(0, workingDays - attendanceDays);

        // احتساب الطلبات المنجزة
        let ordersCompleted = 0;
        if (staff.role === 'delivery') {
          const ordRes = await dbPool.query(
            `SELECT COUNT(*) as cnt FROM orders WHERE assigned_to=$1 AND (status='delivered' OR status='completed')
             AND DATE_TRUNC('month', updated_at) = DATE_TRUNC('month', ($2 || '-01')::date)`,
            [staff.id, period]
          );
          ordersCompleted = parseInt(ordRes.rows[0]?.cnt || 0);
        } else if (staff.role === 'order_manager') {
          const ordRes = await dbPool.query(
            `SELECT COUNT(*) as cnt FROM orders WHERE (status='completed' OR status='delivered')
             AND DATE_TRUNC('month', updated_at) = DATE_TRUNC('month', ($1 || '-01')::date)`,
            [period]
          );
          ordersCompleted = parseInt(ordRes.rows[0]?.cnt || 0);
        }

        // حساب الراتب
        const baseSalary = Number(rate.base_salary);
        const orderBonus = ordersCompleted * Number(rate.rate_per_order);
        const deductionPerDay = workingDays > 0 ? baseSalary / workingDays : 0;
        const deductions = rate.payment_model !== 'per_order' ? absenceDays * deductionPerDay : 0;

        let totalPay = 0;
        if (rate.payment_model === 'fixed') totalPay = baseSalary - deductions;
        else if (rate.payment_model === 'per_order') totalPay = orderBonus;
        else totalPay = (baseSalary - deductions) + orderBonus; // hybrid

        // هل يوجد كشف راتب محفوظ؟
        const savedRes = await dbPool.query(
          `SELECT * FROM payroll_periods WHERE user_id=$1 AND period=$2`, [staff.id, period]
        );

        result.push({
          userId: staff.id,
          fullName: staff.full_name || staff.email,
          role: staff.role,
          period,
          baseSalary,
          ratePerOrder: Number(rate.rate_per_order),
          paymentModel: rate.payment_model,
          ordersCompleted,
          orderBonus,
          attendanceDays,
          absenceDays,
          totalHours,
          deductions: Math.round(deductions),
          bonuses: savedRes.rows[0]?.bonuses || 0,
          totalPay: Math.max(0, Math.round(totalPay + Number(savedRes.rows[0]?.bonuses || 0))),
          isPaid: savedRes.rows[0]?.is_paid || false,
          savedId: savedRes.rows[0]?.id || null,
          notes: savedRes.rows[0]?.notes || null,
        });
      }
      res.json(result);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/finance/payroll/save", requireStaff(["finance", "owner"]), async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { userId, period, totalPay, bonuses, notes, isPaid, ...rest } = req.body;
      await dbPool.query(`
        INSERT INTO payroll_periods (user_id, period, base_salary, orders_completed, order_bonus,
          attendance_days, absence_days, deductions, bonuses, total_pay, is_paid, paid_at, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (user_id, period) DO UPDATE SET
          bonuses=EXCLUDED.bonuses, total_pay=EXCLUDED.total_pay,
          is_paid=EXCLUDED.is_paid, paid_at=EXCLUDED.paid_at, notes=EXCLUDED.notes
      `, [userId, period, rest.baseSalary||0, rest.ordersCompleted||0, rest.orderBonus||0,
          rest.attendanceDays||0, rest.absenceDays||0, rest.deductions||0,
          bonuses||0, totalPay, isPaid||false, isPaid ? new Date() : null, notes||null]);
      res.json({ message: "تم الحفظ" });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── Staff: Orders pending payment verification ─────────────────────────
  app.get("/api/staff/orders/pending-verification", requireStaff(["order_manager", "finance", "owner"]), async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(`
        SELECT o.*, array_agg(json_build_object('product_id',oi.product_id,'quantity',oi.quantity,'price',oi.price)) as items
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id = o.id
        WHERE o.payment_method IN ('bank_transfer','digital_wallet','installment_deposit_cod')
          AND o.payment_status = 'unpaid'
          AND o.status != 'cancelled'
        GROUP BY o.id
        ORDER BY o.created_at DESC
      `);
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── جدولة تذكيرات التقسيط التلقائية (كل 24 ساعة) ─────────────────────────
  async function runInstallmentReminders() {
    try {
      const { pool: dbPool } = await import("./db");
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_FROM_NUMBER;
      if (!accountSid || !authToken || !fromNumber) return;

      // خطط التقسيط المؤكدة (دفع المقدم) ولم يُسدَّد الباقي، ومر عليها 3 أيام على الأقل
      // يُرسل تذكير تلقائي واحد فقط (ما لم يُرسَل من قبل)
      const plans = await dbPool.query(`
        SELECT ip.id, ip.customer_name, ip.customer_phone,
               ip.remaining_amount, ip.order_id,
               o.shipping_city
        FROM installment_plans ip
        JOIN orders o ON o.id = ip.order_id
        WHERE ip.status = 'deposit_paid'
          AND ip.remaining_paid = false
          AND ip.created_at <= NOW() - INTERVAL '3 days'
          AND (ip.admin_notes IS NULL OR ip.admin_notes NOT LIKE '%[تذكير تلقائي%')
        LIMIT 20
      `);

      for (const plan of plans.rows) {
        try {
          const phone = (plan.customer_phone || "").replace(/\s+/g, "").replace(/^00/, "+");
          if (!phone.startsWith("+")) continue;

          const msg = `⏰ تذكير بدفع قسط التقسيط\n━━━━━━━━━━━━━━━━━━━━━\n🆔 طلب: #${plan.order_id}\n💰 المبلغ المتبقي: ${Number(plan.remaining_amount).toLocaleString()} ر.ي\nيرجى تسديد الباقي عند الاستلام أو التواصل معنا.\n━━━━━━━━━━━━━━━━━━━━━\nأويو بلاست 🛍️`;

          await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
            {
              method: "POST",
              headers: {
                Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({ To: `whatsapp:${phone}`, From: `whatsapp:${fromNumber}`, Body: msg }),
            }
          );

          // تسجيل التذكير في ملاحظات الأدمن
          await dbPool.query(
            `UPDATE installment_plans SET admin_notes = COALESCE(admin_notes,'') || $1 WHERE id = $2`,
            [`\n[تذكير تلقائي: ${new Date().toLocaleDateString("ar-YE")}]`, plan.id]
          );
        } catch { /* skip individual failures */ }
      }
    } catch (e: any) {
      console.error("Auto installment reminder error:", e.message);
    }
  }

  // تشغيل التذكيرات مرة كل 24 ساعة
  setInterval(runInstallmentReminders, 24 * 60 * 60 * 1000);
  // تشغيل أولي بعد 5 دقائق من بدء الخادم
  setTimeout(runInstallmentReminders, 5 * 60 * 1000);
}
