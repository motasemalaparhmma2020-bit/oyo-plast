import type { Express } from "express";
import type { Server } from "http";
import { setupAuth } from "./replit_integrations/auth";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { orders } from "@shared/schema";
import { eq } from "drizzle-orm";
import multer from "multer";
import sharp from "sharp";
import path from "path";
import fs from "fs";

const uploadDir = path.join(process.cwd(), "public", "products");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images allowed'));
    }
  }
});

const designUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.ai', '.psd'];
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedMimeTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/postscript',
      'image/vnd.adobe.photoshop',
      'application/octet-stream'
    ];
    
    if (allowedExtensions.includes(ext) || file.mimetype.startsWith('image/') || allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Accepted: images, PDF, AI, PSD'));
    }
  }
});

const upload = imageUpload;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "oyo2024admin";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

  // Helper to get user ID
  const getUserId = (req: any) => req.user?.claims?.sub;

  // Products
  app.get(api.products.list.path, async (req, res) => {
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
    const products = await storage.getProducts(categoryId);
    res.json(products);
  });

  // Bestselling products (must be before :id route)
  app.get("/api/products/bestselling", async (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : 8;
    const products = await storage.getBestsellingProducts(limit);
    res.json(products);
  });

  app.get(api.products.get.path, async (req, res) => {
    const product = await storage.getProduct(Number(req.params.id));
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  });

  // Categories
  app.get(api.categories.list.path, async (req, res) => {
    const categories = await storage.getCategories();
    res.json(categories);
  });

  // Cart
  app.get(api.cart.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    const items = await storage.getCartItems(getUserId(req));
    res.json(items);
  });

  app.post(api.cart.add.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    const { productId, quantity } = req.body;
    const item = await storage.addToCart(getUserId(req), productId, quantity);
    res.status(201).json(item);
  });

  app.patch(api.cart.update.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    const { quantity } = req.body;
    const item = await storage.updateCartItem(Number(req.params.id), quantity);
    res.json(item);
  });

  app.delete(api.cart.delete.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    await storage.deleteCartItem(Number(req.params.id));
    res.status(204).send();
  });

  // Orders
  app.post(api.orders.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    const userId = getUserId(req);
    
    const cartItems = await storage.getCartItems(userId);
    if (cartItems.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    const { 
      paymentMethod, 
      receiptImageUrl, 
      customerPhone, 
      shippingCity, 
      shippingAddress, 
      notes,
      currency = 'YER',
      couponCode = null
    } = req.body;

    // Validate payment method - support all e-wallet options
    const validPaymentMethods = ['cash_on_delivery', 'jawali', 'jaib', 'onecash', 'cash_wallet', 'mahfazati', 'mobile_money', 'kuraimi_bank'];
    if (!validPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({ message: "Invalid payment method" });
    }

    // Calculate subtotal server-side based on currency
    const subtotal = cartItems.reduce((sum, item) => {
      const price = currency === 'SAR' && item.product.priceSar 
        ? Number(item.product.priceSar) 
        : Number(item.product.price);
      return sum + (price * item.quantity);
    }, 0);

    // Validate and apply coupon if provided
    let discountAmount = 0;
    let validatedCouponCode: string | null = null;
    
    if (couponCode) {
      const coupon = await storage.getCoupon(couponCode);
      if (coupon && coupon.isActive) {
        // Check expiration
        const isExpired = coupon.expiresAt && new Date(coupon.expiresAt) < new Date();
        // Check usage limit
        const isOverLimit = coupon.maxUsage && coupon.usageCount >= coupon.maxUsage;
        
        if (!isExpired && !isOverLimit) {
          discountAmount = Math.floor(subtotal * (coupon.discountPercent / 100));
          validatedCouponCode = coupon.code;
          // Increment coupon usage
          await storage.incrementCouponUsage(coupon.code);
        }
      }
    }

    const finalTotal = subtotal - discountAmount;

    // Calculate deposit (30% for e-wallet transfers)
    const requiresDeposit = paymentMethod !== 'cash_on_delivery';
    const depositAmount = requiresDeposit ? Math.ceil(finalTotal * 0.3).toString() : null;

    // Determine status based on payment method
    const status = paymentMethod === 'cash_on_delivery' ? 'pending' : 'deposit_paid';

    const order = await storage.createOrder(userId, {
      total: finalTotal.toString(),
      currency,
      depositAmount,
      paymentMethod,
      receiptImageUrl,
      customerPhone,
      shippingCity,
      shippingAddress,
      notes,
      status,
      couponCode: validatedCouponCode,
      discountAmount: discountAmount > 0 ? discountAmount.toString() : null,
      subtotalBeforeDiscount: discountAmount > 0 ? subtotal.toString() : null
    });

    for (const item of cartItems) {
      const itemPrice = currency === 'SAR' && item.product.priceSar 
        ? item.product.priceSar 
        : item.product.price;
      await storage.createOrderItem({
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        price: itemPrice,
      });
    }

    await storage.clearCart(userId);

    // Create notification for new order
    await storage.createNotification(
      userId,
      "تم استلام طلبك",
      `طلب جديد برقم #${order.id} بقيمة ${finalTotal} ${currency === 'SAR' ? 'ر.س' : 'ر.ي'}${discountAmount > 0 ? ` (خصم ${discountAmount})` : ''}`,
      "order",
      order.id
    );

    res.status(201).json(order);
  });

  app.get(api.orders.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    const orders = await storage.getOrders(getUserId(req));
    res.json(orders);
  });

  // =============== Guest Checkout - DISABLED ===============
  // Guest checkout has been disabled - authentication is now required
  app.post("/api/orders/guest", async (req, res) => {
    return res.status(401).json({ message: "يجب تسجيل الدخول لإتمام الشراء" });
  });

  // =============== Printing Orders Routes ===============
  app.post("/api/printing-orders", async (req, res) => {
    const { 
      categoryName,
      subcategoryName,
      size,
      color,
      quantity,
      designUrl,
      notes,
      currency = 'YER',
      totalPrice
    } = req.body;

    if (!subcategoryName || !size || !color) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const qty = Number(quantity);
    const finalPrice = Number(totalPrice);
    
    if (!Number.isInteger(qty) || qty < 1) {
      return res.status(400).json({ message: "Invalid quantity - must be a positive whole number" });
    }
    
    if (!Number.isFinite(finalPrice) || finalPrice <= 0) {
      return res.status(400).json({ message: "Invalid price" });
    }

    try {
      const userId = req.isAuthenticated() ? getUserId(req) : null;
      
      const orderNotes = `
طلب طباعة مخصصة
القسم: ${categoryName || 'غير محدد'}
الصنف: ${subcategoryName}
المقاس: ${size}
اللون: ${color}
الكمية: ${qty} قطعة
${designUrl ? `رابط التصميم: ${designUrl}` : 'لا يوجد تصميم مرفوع'}
${notes ? `ملاحظات: ${notes}` : ''}
      `.trim();

      const order = await storage.createOrder(userId, {
        total: finalPrice.toString(),
        currency,
        paymentMethod: 'cash_on_delivery',
        notes: orderNotes,
        status: 'pending'
      });

      res.status(201).json({ 
        success: true, 
        orderId: order.id,
        message: 'تم إرسال طلب الطباعة بنجاح. سنتواصل معك قريباً لتأكيد التفاصيل والسعر النهائي.'
      });
    } catch (error) {
      console.error('Printing order error:', error);
      res.status(500).json({ message: "Failed to create printing order" });
    }
  });

  // =============== Wallet Routes ===============
  app.get("/api/wallet", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    const wallet = await storage.getOrCreateWallet(getUserId(req));
    res.json(wallet);
  });

  app.get("/api/wallet/transactions", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    const transactions = await storage.getWalletTransactions(getUserId(req));
    res.json(transactions);
  });

  // =============== Reward Points Routes ===============
  app.get("/api/points", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    const points = await storage.getOrCreateRewardPoints(getUserId(req));
    res.json(points);
  });

  app.get("/api/points/transactions", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    const transactions = await storage.getPointsTransactions(getUserId(req));
    res.json(transactions);
  });

  // =============== My Account Summary ===============
  app.get("/api/account/summary", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    const userId = getUserId(req);
    
    try {
      const [wallet, points, orders] = await Promise.all([
        storage.getOrCreateWallet(userId),
        storage.getOrCreateRewardPoints(userId),
        storage.getOrders(userId)
      ]);
      
      res.json({
        wallet: {
          balanceYer: wallet.balanceYer,
          balanceSar: wallet.balanceSar
        },
        points: {
          current: points.points,
          lifetime: points.lifetimePoints
        },
        orders: {
          total: orders.length,
          pending: orders.filter(o => ['pending', 'processing'].includes(o.status)).length,
          completed: orders.filter(o => o.status === 'completed' || o.status === 'delivered').length
        }
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch account summary" });
    }
  });

  // Get order items with product names (user must own the order)
  app.get("/api/orders/:id/items", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    const orderId = Number(req.params.id);
    const userId = getUserId(req);
    
    try {
      // First verify the order belongs to this user
      const userOrders = await storage.getOrders(userId);
      const orderBelongsToUser = userOrders.some(order => order.id === orderId);
      
      if (!orderBelongsToUser) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const items = await storage.getOrderItems(orderId);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch order items" });
    }
  });

  // Admin authentication with session token
  const adminSessions = new Set<string>();
  
  app.post("/api/admin/login", async (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
      const token = `admin_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      adminSessions.add(token);
      res.json({ success: true, token });
    } else {
      res.status(401).json({ error: "Invalid password" });
    }
  });

  // Admin middleware
  const requireAdmin = (req: any, res: any, next: any) => {
    const token = req.headers['x-admin-token'];
    if (!token || !adminSessions.has(token)) {
      return res.status(401).json({ error: "Admin authentication required" });
    }
    next();
  };

  // Image upload endpoint with auto-resize and compression
  app.post("/api/admin/upload", requireAdmin, upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }

      const filename = `product_${Date.now()}_${Math.random().toString(36).substring(7)}.webp`;
      const filepath = path.join(uploadDir, filename);

      await sharp(req.file.buffer)
        .resize(800, 800, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({ quality: 85 })
        .toFile(filepath);

      const imageUrl = `/products/${filename}`;
      res.json({ success: true, imageUrl });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to process image" });
    }
  });

  // Public design file upload endpoint for printing orders
  app.post("/api/upload", designUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      // Sanitize and generate safe filename
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 10);
      const originalExt = path.extname(req.file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.ai', '.psd'];
      const safeExt = allowedExtensions.includes(originalExt) ? originalExt : '.bin';

      // Process image files
      if (req.file.mimetype.startsWith('image/')) {
        const filename = `design_${timestamp}_${randomId}.webp`;
        const filepath = path.join(uploadDir, filename);
        
        await sharp(req.file.buffer)
          .resize(1200, 1200, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .webp({ quality: 90 })
          .toFile(filepath);
          
        return res.json({ success: true, url: `/products/${filename}` });
      } else {
        // For non-image files (PDF, AI, PSD), save with sanitized name
        const filename = `design_${timestamp}_${randomId}${safeExt}`;
        const filepath = path.join(uploadDir, filename);
        fs.writeFileSync(filepath, req.file.buffer);
        return res.json({ success: true, url: `/products/${filename}` });
      }
    } catch (error) {
      console.error("Design upload error:", error);
      res.status(500).json({ error: "Failed to process file" });
    }
  });

  // Public review image upload endpoint (requires login)
  app.post("/api/upload/review", upload.single('image'), async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }

      const filename = `review_${Date.now()}_${Math.random().toString(36).substring(7)}.webp`;
      const filepath = path.join(uploadDir, filename);

      await sharp(req.file.buffer)
        .resize(600, 600, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({ quality: 80 })
        .toFile(filepath);

      const imageUrl = `/products/${filename}`;
      res.json({ success: true, imageUrl });
    } catch (error) {
      console.error("Review image upload error:", error);
      res.status(500).json({ error: "Failed to process image" });
    }
  });

  // Admin routes (protected)
  app.get("/api/admin/orders", requireAdmin, async (req, res) => {
    const allOrders = await storage.getAllOrders();
    res.json(allOrders);
  });

  // Admin get order items
  app.get("/api/admin/orders/:id/items", requireAdmin, async (req, res) => {
    const orderId = Number(req.params.id);
    try {
      const items = await storage.getOrderItems(orderId);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch order items" });
    }
  });

  app.patch("/api/admin/orders/:id/status", requireAdmin, async (req, res) => {
    const { status, trackingNumber } = req.body;
    const orderId = Number(req.params.id);
    
    const validStatuses = ['pending', 'deposit_paid', 'processing', 'shipped', 'delivered', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    
    try {
      // Get current order status to check if we need to increment sold count
      const currentOrder = await storage.getAllOrders().then(orders => orders.find(o => o.id === orderId));
      const wasNotDelivered = currentOrder && !['delivered', 'completed'].includes(currentOrder.status);
      const becomingDelivered = ['delivered', 'completed'].includes(status);
      
      const updated = await storage.updateOrderStatus(orderId, status, trackingNumber);
      
      // Increment sold count and award points when order is delivered/completed for the first time
      if (wasNotDelivered && becomingDelivered && currentOrder) {
        await storage.incrementSoldCount(orderId);
        
        // Award reward points: 1 point per 1000 YER or 1 point per 7 SAR
        const orderTotal = parseFloat(currentOrder.total || '0');
        let pointsToAward = 0;
        if (currentOrder.currency === 'SAR') {
          pointsToAward = Math.floor(orderTotal / 7);
        } else {
          pointsToAward = Math.floor(orderTotal / 1000);
        }
        
        if (pointsToAward > 0 && currentOrder.userId) {
          await storage.addPoints(
            currentOrder.userId, 
            pointsToAward, 
            'earned_purchase',
            `نقاط مكتسبة من طلب #${orderId}`,
            orderId
          );
          
          // Notify user about earned points
          await storage.createNotification(
            currentOrder.userId,
            "مبروك! حصلت على نقاط",
            `لقد حصلت على ${pointsToAward} نقطة من طلبك #${orderId}`,
            "promo"
          );
        }
      }
      
      // Create notification for status update
      const statusMessages: Record<string, string> = {
        'processing': 'جاري تجهيز طلبك',
        'shipped': 'تم شحن طلبك',
        'delivered': 'تم توصيل طلبك',
        'completed': 'تم إكمال طلبك بنجاح',
        'cancelled': 'تم إلغاء طلبك'
      };
      
      if (statusMessages[status] && updated.userId) {
        await storage.createNotification(
          updated.userId,
          statusMessages[status],
          trackingNumber 
            ? `طلب #${orderId}: ${statusMessages[status]}. رقم التتبع: ${trackingNumber}`
            : `طلب #${orderId}: ${statusMessages[status]}`,
          "order",
          orderId
        );
      }
      
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update order" });
    }
  });

  // Admin: Update product stock
  app.patch("/api/admin/products/:id/stock", requireAdmin, async (req, res) => {
    const { stock } = req.body;
    const productId = Number(req.params.id);
    
    try {
      const updated = await storage.updateProductStock(productId, stock);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update stock" });
    }
  });

  // Admin: Get sales statistics
  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getSalesStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Admin: Get orders by date range
  app.get("/api/admin/orders/range", requireAdmin, async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
      const orders = await storage.getOrdersByDateRange(
        new Date(startDate as string),
        new Date(endDate as string)
      );
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  // Admin: Product management
  app.get("/api/admin/products", requireAdmin, async (req, res) => {
    try {
      const allProducts = await storage.getProducts();
      res.json(allProducts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.post("/api/admin/products", requireAdmin, async (req, res) => {
    try {
      const { name, description, price, priceSar, categoryId, imageUrl, stock, colors, sizes, allowDesignUpload, bulkPricing } = req.body;
      
      if (!name || !description || !price || !categoryId || !imageUrl) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      const product = await storage.createProduct({
        name,
        description,
        price,
        priceSar: priceSar || null,
        categoryId,
        imageUrl,
        stock: stock || 100,
        colors: colors || null,
        sizes: sizes || null,
        allowDesignUpload: allowDesignUpload || false,
        bulkPricing: bulkPricing || null,
        rating: "5",
        reviewCount: 0,
        soldCount: 0,
        commissionHoldDays: 2,
        marketerCommissionRate: null,
        hasPrintingOptions: false,
        baseBagPrice: null,
        singleColorPrintPrice: null,
        availableBagColors: null
      });
      res.status(201).json(product);
    } catch (error) {
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.patch("/api/admin/products/:id", requireAdmin, async (req, res) => {
    try {
      const productId = Number(req.params.id);
      const updates = req.body;
      const product = await storage.updateProduct(productId, updates);
      res.json(product);
    } catch (error) {
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  app.delete("/api/admin/products/:id", requireAdmin, async (req, res) => {
    try {
      const productId = Number(req.params.id);
      await storage.deleteProduct(productId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  // Admin: Category management
  app.get("/api/admin/categories", requireAdmin, async (req, res) => {
    try {
      const allCategories = await storage.getCategories();
      res.json(allCategories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.post("/api/admin/categories", requireAdmin, async (req, res) => {
    try {
      const { name, slug, imageUrl } = req.body;
      
      if (!name || !slug || !imageUrl) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      const category = await storage.createCategory({ name, slug, imageUrl });
      res.status(201).json(category);
    } catch (error) {
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  // Admin: Banner management
  app.get("/api/banners", async (req, res) => {
    try {
      const activeOnly = req.query.active === 'true';
      const allBanners = await storage.getBanners(activeOnly);
      res.json(allBanners);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch banners" });
    }
  });

  app.get("/api/admin/banners", requireAdmin, async (req, res) => {
    try {
      const allBanners = await storage.getBanners();
      res.json(allBanners);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch banners" });
    }
  });

  app.post("/api/admin/banners", requireAdmin, async (req, res) => {
    try {
      const { title, subtitle, imageUrl, linkUrl, isActive, sortOrder } = req.body;
      
      if (!title || !imageUrl) {
        return res.status(400).json({ error: "Title and image are required" });
      }
      
      const banner = await storage.createBanner({
        title,
        subtitle: subtitle || null,
        imageUrl,
        linkUrl: linkUrl || '/products',
        isActive: isActive !== false,
        sortOrder: sortOrder || 0
      });
      res.status(201).json(banner);
    } catch (error) {
      res.status(500).json({ error: "Failed to create banner" });
    }
  });

  app.patch("/api/admin/banners/:id", requireAdmin, async (req, res) => {
    try {
      const bannerId = Number(req.params.id);
      const updates = req.body;
      const banner = await storage.updateBanner(bannerId, updates);
      res.json(banner);
    } catch (error) {
      res.status(500).json({ error: "Failed to update banner" });
    }
  });

  app.delete("/api/admin/banners/:id", requireAdmin, async (req, res) => {
    try {
      const bannerId = Number(req.params.id);
      await storage.deleteBanner(bannerId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete banner" });
    }
  });

  // Admin: Offers management
  app.get("/api/offers", async (req, res) => {
    try {
      const activeOnly = req.query.active === 'true';
      const allOffers = await storage.getOffers(activeOnly);
      res.json(allOffers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch offers" });
    }
  });

  app.get("/api/admin/offers", requireAdmin, async (req, res) => {
    try {
      const allOffers = await storage.getOffers();
      res.json(allOffers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch offers" });
    }
  });

  app.post("/api/admin/offers", requireAdmin, async (req, res) => {
    try {
      const { title, discountPercent, imageUrl, linkUrl, bgColor, isActive, sortOrder } = req.body;
      
      if (!title || discountPercent === undefined) {
        return res.status(400).json({ error: "Title and discount percent are required" });
      }
      
      const offer = await storage.createOffer({
        title,
        discountPercent: Number(discountPercent),
        imageUrl: imageUrl || null,
        linkUrl: linkUrl || '/products',
        bgColor: bgColor || 'blue',
        isActive: isActive !== false,
        sortOrder: sortOrder || 0
      });
      res.status(201).json(offer);
    } catch (error) {
      res.status(500).json({ error: "Failed to create offer" });
    }
  });

  app.patch("/api/admin/offers/:id", requireAdmin, async (req, res) => {
    try {
      const offerId = Number(req.params.id);
      const updates = req.body;
      if (updates.discountPercent !== undefined) {
        updates.discountPercent = Number(updates.discountPercent);
      }
      const offer = await storage.updateOffer(offerId, updates);
      res.json(offer);
    } catch (error) {
      res.status(500).json({ error: "Failed to update offer" });
    }
  });

  app.delete("/api/admin/offers/:id", requireAdmin, async (req, res) => {
    try {
      const offerId = Number(req.params.id);
      await storage.deleteOffer(offerId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete offer" });
    }
  });

  // Admin Settings
  app.get("/api/admin/settings", requireAdmin, async (req, res) => {
    const settings = await storage.getAllSettings();
    res.json(settings);
  });

  app.post("/api/admin/settings", requireAdmin, async (req, res) => {
    const { key, value } = req.body;
    if (!key || value === undefined) {
      return res.status(400).json({ error: "Key and value are required" });
    }
    const setting = await storage.setSetting(key, value);
    res.json(setting);
  });

  // Public settings (exchange rate)
  app.get("/api/settings/exchange-rate", async (req, res) => {
    const setting = await storage.getSetting("exchange_rate");
    res.json({ rate: setting?.value || "140" });
  });

  // Reviews
  app.get("/api/products/:id/reviews", async (req, res) => {
    const reviews = await storage.getProductReviews(Number(req.params.id));
    res.json(reviews);
  });

  app.post("/api/products/:id/reviews", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    const userId = getUserId(req);
    const { rating, comment, imageUrl } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }
    
    try {
      const review = await storage.addReview({
        productId: Number(req.params.id),
        userId,
        rating,
        comment,
        imageUrl
      });
      
      // Award points for review: 5 points for text review, 10 extra for photo
      let pointsForReview = 5;
      if (imageUrl) {
        pointsForReview += 10;
      }
      
      await storage.addPoints(
        userId,
        pointsForReview,
        'earned_review',
        imageUrl ? 'نقاط مكتسبة من تقييم مع صورة' : 'نقاط مكتسبة من تقييم',
        undefined,
        review.id
      );
      
      res.status(201).json(review);
    } catch (error) {
      res.status(500).json({ error: "Failed to add review" });
    }
  });

  // Order tracking (public for customer)
  app.get("/api/orders/:id/track", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    const userId = getUserId(req);
    const orderId = Number(req.params.id);
    
    try {
      const userOrders = await storage.getOrders(userId);
      const order = userOrders.find(o => o.id === orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch order" });
    }
  });

  // Update user profile
  app.patch("/api/user/profile", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    const userId = getUserId(req);
    
    const { 
      firstName, lastName, phone, 
      country, governorate, district, city, neighborhood, street, landmark,
      businessType, accountType 
    } = req.body;
    
    try {
      const updateData: any = {
        firstName,
        lastName,
        phone,
        country,
        governorate,
        district,
        city,
        neighborhood,
        street,
        landmark,
        businessType,
        updatedAt: new Date()
      };
      
      // Only update accountType if provided and valid
      if (accountType && ['customer', 'marketer'].includes(accountType)) {
        updateData.accountType = accountType;
      }
      
      await db.update(schema.users).set(updateData).where(eq(schema.users.id, userId));
      
      const updatedUser = await db.select().from(schema.users).where(eq(schema.users.id, userId));
      res.json(updatedUser[0]);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Update user account type
  app.post("/api/user/account-type", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    const userId = getUserId(req);
    const { accountType } = req.body;
    
    if (!['customer', 'marketer'].includes(accountType)) {
      return res.status(400).json({ error: "نوع الحساب غير صالح" });
    }
    
    try {
      const user = await storage.updateUserAccountType(userId, accountType);
      res.json(user);
    } catch (error) {
      console.error("Error updating account type:", error);
      res.status(500).json({ error: "فشل في تحديث نوع الحساب" });
    }
  });

  // Phone Verification - Send OTP
  app.post("/api/verify/send-otp", async (req, res) => {
    const { phone, email } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: "رقم الجوال مطلوب" });
    }
    
    try {
      // Import verification service
      const { generateOTP, sendVerificationCode, formatYemeniPhone } = await import("./services/verification");
      
      const code = generateOTP();
      const formattedPhone = formatYemeniPhone(phone);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      // Store verification in database
      await storage.createPhoneVerification(formattedPhone, code, expiresAt);
      
      // Send the code via WhatsApp or Email
      const result = await sendVerificationCode(formattedPhone, email);
      
      if (result.success) {
        const response: any = { 
          success: true, 
          method: result.method,
          message: result.method === 'whatsapp' 
            ? 'تم إرسال كود التحقق إلى الواتساب' 
            : result.method === 'email'
            ? 'تم إرسال كود التحقق إلى البريد الإلكتروني'
            : 'وضع التطوير: الكود معروض للاختبار'
        };
        
        // In demo mode, return the code for testing
        if (result.method === 'demo') {
          response.demoCode = code;
        }
        
        res.json(response);
      } else {
        res.status(500).json({ error: result.error || "فشل في إرسال كود التحقق" });
      }
    } catch (error) {
      console.error("Error sending OTP:", error);
      res.status(500).json({ error: "فشل في إرسال كود التحقق" });
    }
  });

  // Phone Verification - Verify OTP
  app.post("/api/verify/verify-otp", async (req, res) => {
    const { phone, code } = req.body;
    
    if (!phone || !code) {
      return res.status(400).json({ error: "رقم الجوال وكود التحقق مطلوبين" });
    }
    
    try {
      const { formatYemeniPhone, verifyOTPCode } = await import("./services/verification");
      
      const formattedPhone = formatYemeniPhone(phone);
      const verification = await storage.getPhoneVerification(formattedPhone);
      
      if (!verification) {
        return res.status(400).json({ error: "لم يتم إرسال كود تحقق لهذا الرقم" });
      }
      
      // Check attempts
      if (verification.attempts >= 5) {
        await storage.deletePhoneVerification(formattedPhone);
        return res.status(400).json({ error: "تجاوزت الحد الأقصى للمحاولات. أعد طلب كود جديد" });
      }
      
      const result = verifyOTPCode(code, verification.code, verification.expiresAt);
      
      if (!result.valid) {
        await storage.incrementVerificationAttempts(formattedPhone);
        return res.status(400).json({ error: result.error });
      }
      
      // Mark as verified
      await storage.markPhoneVerified(formattedPhone);
      
      res.json({ success: true, message: "تم التحقق بنجاح" });
    } catch (error) {
      console.error("Error verifying OTP:", error);
      res.status(500).json({ error: "فشل في التحقق" });
    }
  });

  // Check verification status
  app.get("/api/verify/status/:phone", async (req, res) => {
    try {
      const { formatYemeniPhone } = await import("./services/verification");
      const formattedPhone = formatYemeniPhone(req.params.phone);
      const verification = await storage.getPhoneVerification(formattedPhone);
      
      if (!verification) {
        return res.json({ verified: false, exists: false });
      }
      
      res.json({ 
        verified: verification.verified, 
        exists: true,
        expired: new Date() > verification.expiresAt
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في التحقق من الحالة" });
    }
  });

  // Marketer profile routes
  app.get("/api/marketer/profile", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    const userId = getUserId(req);
    
    try {
      const profile = await storage.getMarketerProfile(userId);
      res.json(profile || null);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب ملف المسوق" });
    }
  });

  app.post("/api/marketer/profile", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    const userId = getUserId(req);
    
    try {
      // Check if profile already exists
      const existing = await storage.getMarketerProfile(userId);
      if (existing) {
        return res.status(400).json({ error: "لديك ملف مسوق بالفعل" });
      }
      
      const profile = await storage.createMarketerProfile({
        userId,
        tier: 'bronze',
        commissionRate: '5',
        totalEarnings: '0',
        pendingEarnings: '0',
        isApproved: true
      });
      
      // Update user account type
      await storage.updateUserAccountType(userId, 'marketer');
      
      // Send welcome message if WhatsApp configured
      const user = await storage.getUser(userId);
      if (user?.phone) {
        const { sendMarketerWelcome } = await import("./services/verification");
        await sendMarketerWelcome(user.phone, user.fullName || user.firstName || 'مسوق');
      }
      
      res.status(201).json(profile);
    } catch (error) {
      console.error("Error creating marketer profile:", error);
      res.status(500).json({ error: "فشل في إنشاء ملف المسوق" });
    }
  });

  // Marketer commissions
  app.get("/api/marketer/commissions", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    const userId = getUserId(req);
    
    try {
      const commissions = await storage.getMarketerCommissions(userId);
      res.json(commissions);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب العمولات" });
    }
  });

  // End customer contacts (for marketer orders)
  app.get("/api/marketer/contacts", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    const userId = getUserId(req);
    
    try {
      const contacts = await storage.getEndCustomerContacts(userId);
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب جهات الاتصال" });
    }
  });

  app.post("/api/marketer/contacts", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    const userId = getUserId(req);
    const { name, phone, address, city, notes } = req.body;
    
    if (!name || !phone) {
      return res.status(400).json({ error: "الاسم ورقم الجوال مطلوبين" });
    }
    
    try {
      const contact = await storage.createEndCustomerContact({
        marketerId: userId,
        name,
        phone,
        address,
        city,
        notes
      });
      res.status(201).json(contact);
    } catch (error) {
      res.status(500).json({ error: "فشل في إضافة جهة الاتصال" });
    }
  });

  // Coupons
  app.get("/api/coupons/validate/:code", async (req, res) => {
    const code = req.params.code;
    
    if (!code) {
      return res.status(400).json({ valid: false, error: "كود الخصم مطلوب" });
    }
    
    try {
      const coupon = await storage.getCoupon(code);
      
      if (!coupon) {
        return res.json({ valid: false, error: "كود الخصم غير صحيح" });
      }
      
      if (!coupon.isActive) {
        return res.json({ valid: false, error: "كود الخصم غير نشط" });
      }
      
      if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
        return res.json({ valid: false, error: "كود الخصم منتهي الصلاحية" });
      }
      
      if (coupon.maxUsage && coupon.usageCount >= coupon.maxUsage) {
        return res.json({ valid: false, error: "تم استخدام الكود بالحد الأقصى" });
      }
      
      res.json({
        valid: true,
        coupon: {
          code: coupon.code,
          discountPercent: coupon.discountPercent,
          marketerCommissionPercent: coupon.marketerCommissionPercent
        }
      });
    } catch (error) {
      res.status(500).json({ valid: false, error: "حدث خطأ أثناء التحقق" });
    }
  });

  app.get("/api/marketer/coupons", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    const userId = getUserId(req);
    
    try {
      const marketerCoupons = await storage.getMarketerCoupons(userId);
      res.json(marketerCoupons);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب الكوبونات" });
    }
  });

  app.post("/api/marketer/coupons", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    const userId = getUserId(req);
    const { code, discountPercent = 5, marketerCommissionPercent = 5 } = req.body;
    
    if (!code || code.length < 3) {
      return res.status(400).json({ error: "كود الخصم يجب أن يكون 3 أحرف على الأقل" });
    }
    
    try {
      const existingCoupon = await storage.getCoupon(code);
      if (existingCoupon) {
        return res.status(400).json({ error: "هذا الكود مستخدم بالفعل" });
      }
      
      const coupon = await storage.createCoupon({
        code: code.toUpperCase(),
        marketerId: userId,
        discountPercent,
        marketerCommissionPercent,
        isActive: true,
        maxUsage: null,
        expiresAt: null
      });
      res.status(201).json(coupon);
    } catch (error) {
      res.status(500).json({ error: "فشل في إنشاء الكوبون" });
    }
  });

  // Wishlist
  app.get("/api/wishlist", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    const userId = getUserId(req);
    const items = await storage.getWishlist(userId);
    res.json(items);
  });

  app.post("/api/wishlist/:productId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    const userId = getUserId(req);
    const productId = Number(req.params.productId);
    const item = await storage.addToWishlist(userId, productId);
    res.status(201).json(item);
  });

  app.delete("/api/wishlist/:productId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    const userId = getUserId(req);
    const productId = Number(req.params.productId);
    await storage.removeFromWishlist(userId, productId);
    res.status(204).send();
  });

  app.get("/api/wishlist/:productId/check", async (req, res) => {
    if (!req.isAuthenticated()) return res.json({ isInWishlist: false });
    const userId = getUserId(req);
    const productId = Number(req.params.productId);
    const isInWishlist = await storage.isInWishlist(userId, productId);
    res.json({ isInWishlist });
  });

  // Notifications
  app.get("/api/notifications", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    const userId = getUserId(req);
    const notifications = await storage.getNotifications(userId);
    res.json(notifications);
  });

  app.get("/api/notifications/unread-count", async (req, res) => {
    if (!req.isAuthenticated()) return res.json({ count: 0 });
    const userId = getUserId(req);
    const count = await storage.getUnreadCount(userId);
    res.json({ count });
  });

  app.patch("/api/notifications/:id/read", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    await storage.markNotificationRead(Number(req.params.id));
    res.status(204).send();
  });

  app.patch("/api/notifications/read-all", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    const userId = getUserId(req);
    await storage.markAllNotificationsRead(userId);
    res.status(204).send();
  });

  // Seed Data
  if ((await storage.getCategories()).length === 0) {
    console.log("Seeding OYO PLAST data...");
    // @ts-ignore
    await db.insert(schema.categories).values([
      { name: "بلاستيكيات", slug: "plastics", imageUrl: "/assets/generated_images/circular_icon_for_plastic_packaging_category.png" },
      { name: "ورقيات", slug: "paper", imageUrl: "/assets/generated_images/circular_icon_for_paper_products_category.png" },
      { name: "منظفات", slug: "cleaning", imageUrl: "/assets/generated_images/circular_icon_for_cleaning_supplies_category.png" },
      { name: "أدوات مائدة", slug: "tableware", imageUrl: "/assets/generated_images/circular_icon_for_tableware_supplies_category.png" },
    ]);
    
    // Get seeded categories to link products
    const cats = await storage.getCategories();
    
    // @ts-ignore
    await db.insert(schema.products).values([
      // Plastics - category 1
      { name: "أكياس تسوق ملونة", description: "أكياس بلاستيك عالية الجودة بألوان متعددة للتسوق والتغليف", price: "800", priceSar: "8", categoryId: cats[0].id, imageUrl: "/assets/generated_images/colorful_plastic_shopping_bags.png", colors: ["أزرق", "وردي", "أصفر", "أخضر"], allowDesignUpload: true, bulkPricing: JSON.stringify([{qty: 10, discount: 10}, {qty: 50, discount: 20}]) },
      { name: "علب حفظ الطعام", description: "علب بلاستيك شفافة عالية الجودة لحفظ المواد الغذائية", price: "1500", priceSar: "15", categoryId: cats[0].id, imageUrl: "/assets/generated_images/plastic_food_containers_set.png", bulkPricing: JSON.stringify([{qty: 20, discount: 15}]) },
      { name: "أكياس قمامة سوداء", description: "أكياس قمامة قوية وثقيلة الواجب للاستخدام المنزلي والتجاري", price: "1200", priceSar: "12", categoryId: cats[0].id, imageUrl: "/assets/generated_images/garbage_bags_roll_black.png", bulkPricing: JSON.stringify([{qty: 10, discount: 10}]) },
      { name: "علب بلاستيك شفافة 1لتر", description: "علب بلاستيك شفافة مع غطاء آمن", price: "2000", priceSar: "20", categoryId: cats[0].id, imageUrl: "/assets/generated_images/high-quality_plastic_container_product_photography.png" },
      
      // Paper - category 2
      { name: "أكياس ورقية كرافت", description: "أكياس ورقية صديقة للبيئة بأحجام مختلفة للتسوق والتغليف", price: "1000", priceSar: "10", categoryId: cats[1].id, imageUrl: "/assets/generated_images/paper_bags_collection.png", colors: ["بني", "أبيض"], allowDesignUpload: true },
      { name: "أكواب ورقية 8 أونصة", description: "أكواب ورقية مزدوجة الجدار للمشروبات الساخنة", price: "1200", priceSar: "12", categoryId: cats[1].id, imageUrl: "/assets/generated_images/high-quality_paper_coffee_cup_product_photography.png" },
      { name: "أطباق ورقية بيضاء", description: "أطباق ورقية قوية وآمنة للطعام", price: "1800", priceSar: "18", categoryId: cats[1].id, imageUrl: "https://images.unsplash.com/photo-1610707856921-e4e13ef14642?w=800" },
      
      // Cleaning - category 3
      { name: "طقم منظفات متعددة", description: "مجموعة متكاملة من مواد التنظيف للمنزل والمكتب", price: "3500", priceSar: "35", categoryId: cats[2].id, imageUrl: "/assets/generated_images/cleaning_supplies_set.png" },
      { name: "سائل تنظيف متعدد الأغراض", description: "منظف فعال وآمن للأسطح", price: "2000", priceSar: "20", categoryId: cats[2].id, imageUrl: "/assets/generated_images/high-quality_cleaning_detergent_bottle_product_photography.png" },
      
      // Tableware - category 4
      { name: "أكواب وأدوات مائدة", description: "طقم أكواب بلاستيكية وأدوات مائدة للحفلات والمناسبات", price: "2500", priceSar: "25", categoryId: cats[3].id, imageUrl: "/assets/generated_images/disposable_cups_and_tableware.png", colors: ["شفاف", "أبيض", "ملون"] },
    ]);
  }

  return httpServer;
}

import { db } from "./db";
import * as schema from "@shared/schema";
