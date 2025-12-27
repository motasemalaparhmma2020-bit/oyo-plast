import type { Express } from "express";
import type { Server } from "http";
import { setupAuth } from "./replit_integrations/auth";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { orders } from "@shared/schema";
import { eq } from "drizzle-orm";

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
      currency = 'YER'
    } = req.body;

    // Validate payment method
    const validPaymentMethods = ['cash_on_delivery', 'karimi', 'najm'];
    if (!validPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({ message: "Invalid payment method" });
    }

    // Validate required fields for bank transfer
    if ((paymentMethod === 'karimi' || paymentMethod === 'najm') && !receiptImageUrl) {
      return res.status(400).json({ message: "Receipt image required for bank transfer" });
    }

    // Calculate total server-side based on currency
    const total = cartItems.reduce((sum, item) => {
      const price = currency === 'SAR' && item.product.priceSar 
        ? Number(item.product.priceSar) 
        : Number(item.product.price);
      return sum + (price * item.quantity);
    }, 0);

    // Calculate deposit (30% for bank transfers)
    const depositAmount = (paymentMethod === 'karimi' || paymentMethod === 'najm') 
      ? Math.ceil(total * 0.3).toString() 
      : null;

    // Determine status based on payment method
    const status = paymentMethod === 'cash_on_delivery' ? 'pending' : 'deposit_paid';

    const order = await storage.createOrder(userId, {
      total: total.toString(),
      currency,
      depositAmount,
      paymentMethod,
      receiptImageUrl,
      customerPhone,
      shippingCity,
      shippingAddress,
      notes,
      status
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
    res.status(201).json(order);
  });

  app.get(api.orders.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    const orders = await storage.getOrders(getUserId(req));
    res.json(orders);
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

  // Admin routes (protected)
  app.get("/api/admin/orders", requireAdmin, async (req, res) => {
    const allOrders = await storage.getAllOrders();
    res.json(allOrders);
  });

  app.patch("/api/admin/orders/:id/status", requireAdmin, async (req, res) => {
    const { status, trackingNumber } = req.body;
    const orderId = Number(req.params.id);
    
    const validStatuses = ['pending', 'deposit_paid', 'processing', 'shipped', 'delivered', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    
    try {
      const updated = await storage.updateOrderStatus(orderId, status, trackingNumber);
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
    const { rating, comment } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }
    
    try {
      const review = await storage.addReview({
        productId: Number(req.params.id),
        userId,
        rating,
        comment
      });
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
