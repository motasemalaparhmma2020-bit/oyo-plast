import { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth.js";
import { storage } from "./storage";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, sql } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
      // if (!req.isAuthenticated()) return res.sendStatus(401);
  

      // if (!req.user?.isAdmin) return res.sendStatus(403);
  
  app.get("/api/categories", async (_req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (e) {
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // مسار جلب المنتجات
  app.get("/api/products", async (_req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (e) {
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}


  
