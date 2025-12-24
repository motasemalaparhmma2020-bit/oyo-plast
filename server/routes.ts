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
    console.log("Seeding data...");
    // @ts-ignore
    await db.insert(schema.categories).values([
      { name: "Plastic Products", slug: "plastic", imageUrl: "https://images.unsplash.com/photo-1623366302587-bca291d2d398?w=800" },
      { name: "Paper Products", slug: "paper", imageUrl: "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=800" },
      { name: "Aluminum Foil", slug: "aluminum", imageUrl: "https://images.unsplash.com/photo-1626127117172-e56598c8c6f9?w=800" },
      { name: "Hygiene", slug: "hygiene", imageUrl: "https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=800" },
    ]);
    
    // Get seeded categories to link products
    const cats = await storage.getCategories();
    
    // @ts-ignore
    await db.insert(schema.products).values([
      { name: "Plastic Containers 500ml", description: "Durable plastic containers for hot and cold food", price: "25.00", categoryId: cats[0].id, imageUrl: "https://images.unsplash.com/photo-1595246140625-573b715d1128?w=800" },
      { name: "Paper Cups 8oz", description: "Double wall paper cups for coffee", price: "15.00", categoryId: cats[1].id, imageUrl: "https://images.unsplash.com/photo-1517080226388-34f783305416?w=800" },
      { name: "Aluminum Foil Roll 30cm", description: "Heavy duty aluminum foil for kitchen use", price: "45.00", categoryId: cats[2].id, imageUrl: "https://images.unsplash.com/photo-1605307528359-5f21272b2230?w=800" },
      { name: "Plastic Cutlery Set", description: "Spoons, forks and knives set", price: "12.00", categoryId: cats[0].id, imageUrl: "https://images.unsplash.com/photo-1585848773950-8b1d9c792942?w=800" },
    ]);
  }

  return httpServer;
}

import { db } from "./db";
import * as schema from "@shared/schema";
