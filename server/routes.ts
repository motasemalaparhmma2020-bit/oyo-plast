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
// Use public/uploads for permanent storage (won't be deleted on redeploy)
const uploadsDir = path.resolve(rootDir, "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      const name = crypto.randomUUID() + ext;
      cb(null, name);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only images are allowed"));
  },
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

  // ─── Image Upload ─────────────────────────────────────────────────
  app.post("/api/admin/upload", requireAdmin, upload.single("image"), (req, res) => {
    if (!req.file) return res.status(400).json({ message: "لم يتم رفع صورة" });
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ imageUrl });
  });

  // ─── Design Upload (Public) ─────────────────────────────────────────
  app.post("/api/upload/design", upload.single("design"), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "لم يتم رفع ملف" });
    try {
      // File is saved to disk via diskStorage, URL points to it
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
  app.get("/api/products", async (req, res) => {
    const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
    const search = req.query.search as string | undefined;
    const products = await storage.getProducts(categoryId, search);
    res.json(products);
  });

  app.get("/api/products/bestselling", async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 8;
    const products = await storage.getProducts();
    const sorted = [...products].sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0));
    res.json(sorted.slice(0, limit));
  });

  app.get("/api/products/:id", async (req, res) => {
    const product = await storage.getProduct(parseInt(req.params.id));
    if (!product) return res.status(404).json({ message: "المنتج غير موجود" });
    res.json(product);
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
    const prods = await storage.getProducts();
    res.json(prods);
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
      });
      res.status(201).json(product);
    } catch (e: any) {
      res.status(500).json({ message: "فشل إنشاء المنتج", details: e.message });
    }
  });

  app.patch("/api/admin/products/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = req.body;
      const update: any = {};
      const fields = [
        "name", "description", "price", "priceSar", "categoryId",
        "imageUrl", "imageUrls", "stock", "colors", "sizes",
        "allowDesignUpload", "printingPricePerUnit", "hasPrintingOptions",
        "baseBagPrice", "singleColorPrintPrice", "availableBagColors", "tags",
        "bulkPricing", "sizePricing", "showReviews"
      ];
      for (const f of fields) {
        if (data[f] !== undefined) update[f] = data[f];
      }
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

  // ─── Admin Navigation Settings ────────────────────────────────────
  app.patch("/api/admin/navigation-settings", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.updateNavigationSettings({
        showPrintingSection: req.body.showPrintingSection ?? true,
      });
      res.json(settings);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث إعدادات التنقل", details: e.message });
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
      const settings = await storage.updateHomePageSettings({
        primaryColor: req.body.primaryColor,
        accentColor: req.body.accentColor,
        showHeader: req.body.showHeader ?? true,
        showBanners: req.body.showBanners ?? true,
        showOffers: req.body.showOffers ?? true,
        showCategories: req.body.showCategories ?? true,
      });
      res.json(settings);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث إعدادات الصفحة الرئيسية", details: e.message });
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
      if (!user || !user.id) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { db: dbInstance } = await import("./db");
      const { orders: ordersTable } = await import("@shared/schema");
      const { eq: eqFn } = await import("drizzle-orm");
      const { desc: descFn } = await import("drizzle-orm");

      const userOrders = await dbInstance
        .select()
        .from(ordersTable)
        .where(eqFn(ordersTable.userId, user.id))
        .orderBy(descFn(ordersTable.createdAt));

      res.json(userOrders);
    } catch (e: any) {
      res.status(500).json({ message: "Failed to fetch orders", details: e.message });
    }
  });

  // ─── Create Order (Public - for checkout) ────────────────────────
  app.post("/api/orders/create", async (req, res) => {
    try {
      const { customerName, customerEmail, customerPhone, shippingCity, shippingAddress, shippingOption, shippingCost, notes, total, items } = req.body;

      if (!customerName || !customerEmail || !customerPhone || !shippingCity || !shippingAddress || !items || items.length === 0) {
        return res.status(400).json({ message: "Missing required fields" });
      }

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
      });

      res.json(order);
    } catch (e: any) {
      res.status(500).json({ message: "Failed to create order", details: e.message });
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
      
      const { db: dbInstance } = await import("./db");
      const { cartItems: cartTable } = await import("@shared/schema");
      const { eq: eqFn } = await import("drizzle-orm");
      
      const items = await dbInstance.select().from(cartTable).where(eqFn(cartTable.userId, user.id));
      res.json(items);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب السلة", details: e.message });
    }
  });

  app.post("/api/cart", async (req, res) => {
    try {
      const user = (req as any).user;
      
      // For guests, just return success - cart is stored in localStorage
      if (!user) return res.status(201).json({ success: true, guest: true });
      
      const { db: dbInstance } = await import("./db");
      const { cartItems: cartTable } = await import("@shared/schema");
      const { eq: eqFn } = await import("drizzle-orm");
      
      const { productId, quantity, selectedSize, selectedColor, customPrinting, designNotes, designFileUrl } = req.body;
      
      // Check if item exists
      const existing = await dbInstance.select().from(cartTable)
        .where(eqFn(cartTable.userId, user.id));
      
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
          userId: user.id,
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
}
