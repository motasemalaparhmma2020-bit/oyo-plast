import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./replit_integrations/auth/replitAuth";
import { registerAuthRoutes } from "./replit_integrations/auth/routes";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

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

  // ─── Image Upload - Base64 (permanent, survives deploys) ────────────
  app.post("/api/admin/upload", requireAdmin, upload.single("image"), (req, res) => {
    if (!req.file) return res.status(400).json({ message: "لم يتم رفع صورة" });
    // Convert to base64 data URL - stored in DB, never deleted on redeploy
    const base64 = req.file.buffer.toString("base64");
    const imageUrl = `data:${req.file.mimetype};base64,${base64}`;
    res.json({ imageUrl });
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

  // دالة تعيين المورد تلقائياً بناءً على مدينة العميل
  async function autoAssignSupplier(orderId: number, city: string, orderTotal: number, currency: string, customerName: string, customerPhone: string) {
    try {
      const { pool: dbPool } = await import("./db");
      // ابحث عن مورد يغطي هذه المدينة (الأول نشاطاً)
      const res = await dbPool.query(
        `SELECT * FROM suppliers WHERE is_active=true AND $1=ANY(cities) ORDER BY id LIMIT 1`,
        [city]
      );
      if (!res.rows.length) return; // لا يوجد مورد يغطي هذه المدينة
      const supplier = res.rows[0];
      const commissionRate = Number(supplier.commission_rate || 10);
      const platformCommission = orderTotal * commissionRate / 100;
      const supplierAmount = orderTotal - platformCommission;

      await dbPool.query(
        `UPDATE orders SET supplier_id=$1, supplier_amount=$2, platform_commission=$3
         WHERE id=$4`,
        [supplier.id, supplierAmount.toFixed(2), platformCommission.toFixed(2), orderId]
      );
      // تحديث إجمالي مبيعات المورد
      await dbPool.query(
        `UPDATE suppliers SET total_sales=COALESCE(total_sales,0)+$1, balance_due=COALESCE(balance_due,0)+$2 WHERE id=$3`,
        [orderTotal, supplierAmount, supplier.id]
      );
      // إرسال إشعار واتساب
      await notifySupplier(supplier.id, orderId, { customerName, customerPhone, shippingCity: city, supplierAmount, currency });
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
      const { name, phone, email, cities, commissionRate, notes, isActive, pin } = req.body;
      const citiesArr = Array.isArray(cities) ? cities : (cities ? cities.split(",").map((c: string) => c.trim()) : []);
      const result = await dbPool.query(
        `UPDATE suppliers SET name=$1, phone=$2, email=$3, cities=$4, commission_rate=$5, notes=$6, is_active=$7, pin=COALESCE($8, pin)
         WHERE id=$9 RETURNING *`,
        [name, phone, email || null, citiesArr, commissionRate || 10, notes || null, isActive !== false, pin || null, id]
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

  // سجل دفعات مورد
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
    const cats = await storage.getCategories();
    res.json(cats);
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
    enable_smart_variants, smart_variants`;

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
      enableSmartVariants: r.enable_smart_variants ?? false,
      smartVariants: r.smart_variants ?? null,
    };
  }

  app.get("/api/products", async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
      const search = req.query.search as string | undefined;

      let query = `SELECT ${LITE_COLS} FROM products`;
      const params: any[] = [];
      const conditions: string[] = [];
      let idx = 1;

      if (categoryId !== undefined && !Number.isNaN(categoryId)) {
        conditions.push(`category_id = $${idx++}`);
        params.push(categoryId);
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
        `SELECT ${LITE_COLS} FROM products ORDER BY sold_count DESC NULLS LAST LIMIT $1`,
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
      const fields = [
        "name", "description", "price", "priceSar", "categoryId",
        "imageUrl", "imageUrls", "stock", "colors", "sizes",
        "allowDesignUpload", "printingPricePerUnit", "hasPrintingOptions",
        "baseBagPrice", "singleColorPrintPrice", "availableBagColors", "tags",
        "bulkPricing", "sizePricing", "showReviews", "enableVariantUI", "colorImages",
        "originalPrice", "originalPriceSar", "discountPercent", "promotionalTags",
        "enableSmartVariants", "smartVariants"
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
      await storage.deleteProduct(parseInt(req.params.id));
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
      ];
      // boolean fields
      const boolFields = [
        'showCategories', 'showOfferBanners',
        'detailShowRelated', 'detailShowReviews', 'showStickyCartBar',
        'detailShowThumbnails',
        'sadeemShowOldPrice', 'sadeemShowDiscountBadge',
        'sadeemShowRating', 'sadeemShowSoldCount',
        'sadeemShowShipping', 'sadeemShowReturns',
        'codEnabled',
      ];
      // text fields
      const textFields = ['imageMode', 'detailImageMode', 'discountBadgeBg'];

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
  app.post("/api/orders/create", async (req, res) => {
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

      const { customerName, customerEmail, customerPhone, shippingCity, shippingAddress, shippingOption, shippingCost, notes, total, items, paymentMethod = "cash_on_delivery" } = req.body;
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
        // تعيين المورد تلقائياً حسب مدينة العميل
        shippingCity ? autoAssignSupplier(order.id, shippingCity, Number(total), req.body.currency || "YER", customerName, customerPhone) : Promise.resolve(),
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
      const updateData: any = { status: req.body.status };
      if (req.body.trackingNumber !== undefined) updateData.trackingNumber = req.body.trackingNumber;
      const [order] = await dbInstance
        .update(ordersTable)
        .set(updateData)
        .where(eqFn(ordersTable.id, parseInt(req.params.id)))
        .returning();
      res.json(order);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث حالة الطلب", details: e.message });
    }
  });

  // ─── Admin Product Stock ─────────────────────────────────────────
  app.patch("/api/admin/products/:id/stock", requireAdmin, async (req, res) => {
    try {
      const product = await storage.updateProduct(parseInt(req.params.id), { stock: req.body.stock });
      res.json(product);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث المخزون", details: e.message });
    }
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
      const { db: dbI } = await import("./db");
      const { users: usersT } = await import("@shared/schema");
      const { eq: eqFn } = await import("drizzle-orm");
      // Set role to 'customer' to deactivate (not delete — keeps order history)
      await dbI.update(usersT).set({ role: "customer", accountType: "customer" }).where(eqFn(usersT.id, req.params.id));
      await dbI.execute(`UPDATE team_members SET is_active=false WHERE user_id=$1` as any, [req.params.id]);
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
}
