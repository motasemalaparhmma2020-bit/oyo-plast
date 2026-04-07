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
      ]);

      res.json(order);
    } catch (e: any) {
      const userMessage = e.message?.includes("لم يعد متاحاً") || e.message?.includes("غير صالحة")
        ? e.message
        : "حدث خطأ أثناء إنشاء الطلب، يرجى المحاولة مرة أخرى";
      res.status(500).json({ message: userMessage, details: e.message });
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

  // ── تشخيص بوابة SMS ────────────────────────────────────────────
  app.post("/api/admin/test-sms", requireAdmin, async (req, res) => {
    const smsUser = process.env.SMS_USER;
    const smsPass = process.env.SMS_PASS;
    const ultraInstance = process.env.ULTRAMSG_INSTANCE_ID;
    const ultraToken = process.env.ULTRAMSG_TOKEN;

    const report: any = {
      timestamp: new Date().toISOString(),
      config: {
        smsGateway: {
          configured: !!(smsUser && smsPass),
          user: smsUser ? smsUser.substring(0, 4) + "***" : "غير محدد",
          url: "https://api.sms-gate.app/3/messages",
        },
        ultraMsg: {
          configured: !!(ultraInstance && ultraToken),
          instance: ultraInstance ? ultraInstance.substring(0, 4) + "***" : "غير محدد",
        },
      },
      tests: {} as any,
    };

    // اختبار الاتصال بالخادم
    try {
      const healthRes = await fetch("https://api.sms-gate.app/", { signal: AbortSignal.timeout(6000) });
      report.tests.serverReachable = {
        ok: true,
        status: healthRes.status,
        note: "الخادم يستجيب",
      };
    } catch (e: any) {
      report.tests.serverReachable = { ok: false, error: e.message };
    }

    // اختبار المصادقة على SMS Gateway
    if (smsUser && smsPass) {
      const creds = Buffer.from(`${smsUser}:${smsPass}`).toString("base64");
      const testPhone = req.body?.testPhone || "+967700000000";
      try {
        const smsRes = await fetch("https://api.sms-gate.app/3/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${creds}`,
          },
          body: JSON.stringify({
            message: "اويو بلاست: اختبار بوابة SMS",
            phoneNumbers: [testPhone],
          }),
          signal: AbortSignal.timeout(8000),
        });
        const body = await smsRes.text();
        report.tests.smsGateway = {
          ok: smsRes.ok,
          status: smsRes.status,
          response: body.substring(0, 200),
          diagnosis:
            smsRes.status === 404
              ? "الجهاز غير مسجّل في السحابة أو البيانات خاطئة"
              : smsRes.status === 401
              ? "كلمة المرور أو اسم المستخدم خاطئ"
              : smsRes.status === 200 || smsRes.status === 201
              ? "✅ يعمل بنجاح"
              : `خطأ ${smsRes.status}`,
        };
      } catch (e: any) {
        report.tests.smsGateway = { ok: false, error: e.message };
      }
    } else {
      report.tests.smsGateway = { ok: false, note: "SMS_USER أو SMS_PASS غير محددَين" };
    }

    res.json(report);
  });
}
