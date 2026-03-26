import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";

export async function registerRoutes(httpServer: Server, app: Express): Promise<void> {
  setupAuth(app);

  // جلب الأقسام
  app.get("/api/categories", async (_req, res) => {
    const categories = await storage.getCategories();
    res.json(categories);
  });

  // جلب المنتجات
  app.get("/api/products", async (_req, res) => {
    const products = await storage.getProducts();
    res.json(products);
  });

  // إضافة قسم جديد
  app.post("/api/categories", async (req, res) => {
    const category = await storage.createCategory(req.body);
    res.json(category);
  });

  // إضافة منتج جديد
  app.post("/api/products", async (req, res) => {
    const product = await storage.createProduct(req.body);
    res.json(product);
  });
}
