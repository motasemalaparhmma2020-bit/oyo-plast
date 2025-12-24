import type { Express } from "express";
import type { Server } from "http";
import { setupAuth } from "./replit_integrations/auth";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

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

    const total = cartItems.reduce((sum, item) => sum + (Number(item.product.price) * item.quantity), 0);
    const order = await storage.createOrder(userId, total.toString());

    for (const item of cartItems) {
      await storage.createOrderItem({
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        price: item.product.price,
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


  // Seed Data
  if ((await storage.getCategories()).length === 0) {
    console.log("Seeding OYO PLAST data...");
    // @ts-ignore
    await db.insert(schema.categories).values([
      { name: "بلاستيكيات", slug: "plastics", imageUrl: "https://images.unsplash.com/photo-1623366302587-bca291d2d398?w=800" },
      { name: "ورقيات", slug: "paper", imageUrl: "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=800" },
      { name: "منظفات", slug: "cleaning", imageUrl: "https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=800" },
    ]);
    
    // Get seeded categories to link products
    const cats = await storage.getCategories();
    
    // @ts-ignore
    await db.insert(schema.products).values([
      { name: "علب بلاستيك 500مل", description: "علب بلاستيك عالية الجودة لحفظ المواد الغذائية", price: "1500", categoryId: cats[0].id, imageUrl: "https://images.unsplash.com/photo-1595246140625-573b715d1128?w=800" },
      { name: "علب بلاستيك شفافة 1لتر", description: "علب بلاستيك شفافة مع غطاء آمن", price: "2000", categoryId: cats[0].id, imageUrl: "https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=800" },
      { name: "أكياس بلاستيك قوية", description: "أكياس بلاستيك متعددة الاستخدام", price: "500", categoryId: cats[0].id, imageUrl: "https://images.unsplash.com/photo-1563861826100-9cb868fdbe1e?w=800" },
      { name: "صناديق بلاستيك للتخزين", description: "صناديق منظمة للتخزين المنزلي", price: "3500", categoryId: cats[0].id, imageUrl: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800" },
      { name: "ملاعق بلاستيك حزمة 100", description: "ملاعق بلاستيك عملية وخفيفة الوزن", price: "800", categoryId: cats[0].id, imageUrl: "https://images.unsplash.com/photo-1585848773950-8b1d9c792942?w=800" },
      
      { name: "أكواب ورقية 8 أونصة", description: "أكواب ورقية مزدوجة الجدار للمشروبات الساخنة", price: "1200", categoryId: cats[1].id, imageUrl: "https://images.unsplash.com/photo-1517080226388-34f783305416?w=800" },
      { name: "أطباق ورقية بيضاء", description: "أطباق ورقية قوية وآمنة للطعام", price: "1800", categoryId: cats[1].id, imageUrl: "https://images.unsplash.com/photo-1610707856921-e4e13ef14642?w=800" },
      { name: "أكياس ورقية مقاس كبير", description: "أكياس ورقية صديقة للبيئة", price: "2500", categoryId: cats[1].id, imageUrl: "https://images.unsplash.com/photo-1589985643542-5132ca15b229?w=800" },
      { name: "علب ورقية للطعام", description: "علب ورقية عازلة للحرارة للوجبات", price: "3000", categoryId: cats[1].id, imageUrl: "https://images.unsplash.com/photo-1638789469229-e7c6ad34e57e?w=800" },
      { name: "ورق تغليف ورقي", description: "ورق تغليف قوي وآمن للطعام", price: "1000", categoryId: cats[1].id, imageUrl: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800" },
      
      { name: "سائل تنظيف متعدد الأغراض", description: "منظف فعال وآمن للأسطح", price: "2000", categoryId: cats[2].id, imageUrl: "https://images.unsplash.com/photo-1584622181563-430f63602d4b?w=800" },
      { name: "مسحوق غسيل الصحون", description: "مسحوق فعال لتنظيف الأطباق", price: "1500", categoryId: cats[2].id, imageUrl: "https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=800" },
      { name: "معقم سطح الطاولة", description: "معقم آمن وفعال 500مل", price: "1800", categoryId: cats[2].id, imageUrl: "https://images.unsplash.com/photo-1583421668794-c5c89f992941?w=800" },
      { name: "مناديل تنظيف", description: "مناديل ورقية قوية وماصة", price: "1200", categoryId: cats[2].id, imageUrl: "https://images.unsplash.com/photo-1584308666744-24d5f69f8dd7?w=800" },
      { name: "فرشاة أرضية", description: "فرشاة تنظيف قوية مع مقبض", price: "2500", categoryId: cats[2].id, imageUrl: "https://images.unsplash.com/photo-1584622181563-430f63602d4b?w=800" },
    ]);
  }

  return httpServer;
}

import { db } from "./db";
import * as schema from "@shared/schema";
