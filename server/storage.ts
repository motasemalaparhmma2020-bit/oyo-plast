import {
  users, products, categories, banners, offers, orders, orderItems,
  type User, type InsertUser,
  type Product, type InsertProduct,
  type Category, type InsertCategory,
  type Banner, type Offer,
  type Order
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getProducts(categoryId?: number, search?: string): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, data: Partial<InsertProduct>): Promise<Product>;
  deleteProduct(id: number): Promise<void>;

  getCategories(): Promise<Category[]>;
  getCategory(id: number): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, data: Partial<InsertCategory>): Promise<Category>;
  deleteCategory(id: number): Promise<void>;

  getBanners(): Promise<Banner[]>;
  createBanner(data: any): Promise<Banner>;
  updateBanner(id: number, data: any): Promise<Banner>;
  deleteBanner(id: number): Promise<void>;

  getOffers(): Promise<Offer[]>;
  createOffer(data: any): Promise<Offer>;
  updateOffer(id: number, data: any): Promise<Offer>;
  deleteOffer(id: number): Promise<void>;

  getOrders(): Promise<Order[]>;
  getOrderStats(): Promise<{ totalSales: number; totalOrders: number; averageOrderValue: number }>;

  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser as any).returning();
    return user;
  }

  async getProducts(categoryId?: number, search?: string): Promise<Product[]> {
    let query = db.select().from(products);
    const conditions = [];
    if (categoryId) {
      conditions.push(eq(products.categoryId, categoryId));
    }
    if (conditions.length > 0) {
      return await db.select().from(products).where(conditions[0]);
    }
    return await db.select().from(products);
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [product] = await db.insert(products).values(insertProduct).returning();
    return product;
  }

  async updateProduct(id: number, data: Partial<InsertProduct>): Promise<Product> {
    const [product] = await db.update(products).set(data as any).where(eq(products.id, id)).returning();
    return product;
  }

  async deleteProduct(id: number): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(categories.sortOrder, categories.id);
  }

  async getCategory(id: number): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category;
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const [category] = await db.insert(categories).values(insertCategory).returning();
    return category;
  }

  async updateCategory(id: number, data: Partial<InsertCategory>): Promise<Category> {
    const [category] = await db.update(categories).set(data as any).where(eq(categories.id, id)).returning();
    return category;
  }

  async deleteCategory(id: number): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  async getBanners(): Promise<Banner[]> {
    return await db.select().from(banners).orderBy(banners.sortOrder, banners.id);
  }

  async createBanner(data: any): Promise<Banner> {
    const [banner] = await db.insert(banners).values(data).returning();
    return banner;
  }

  async updateBanner(id: number, data: any): Promise<Banner> {
    const [banner] = await db.update(banners).set(data).where(eq(banners.id, id)).returning();
    return banner;
  }

  async deleteBanner(id: number): Promise<void> {
    await db.delete(banners).where(eq(banners.id, id));
  }

  async getOffers(): Promise<Offer[]> {
    return await db.select().from(offers).orderBy(offers.sortOrder, offers.id);
  }

  async createOffer(data: any): Promise<Offer> {
    const [offer] = await db.insert(offers).values(data).returning();
    return offer;
  }

  async updateOffer(id: number, data: any): Promise<Offer> {
    const [offer] = await db.update(offers).set(data).where(eq(offers.id, id)).returning();
    return offer;
  }

  async deleteOffer(id: number): Promise<void> {
    await db.delete(offers).where(eq(offers.id, id));
  }

  async getOrders(): Promise<Order[]> {
    return await db.select().from(orders).orderBy(desc(orders.createdAt));
  }

  async getOrderStats(): Promise<{ totalSales: number; totalOrders: number; averageOrderValue: number }> {
    const result = await db.select({
      totalSales: sql<number>`COALESCE(SUM(${orders.total}::numeric), 0)`,
      totalOrders: sql<number>`COUNT(*)`,
    }).from(orders);

    const { totalSales, totalOrders } = result[0];
    return {
      totalSales: Number(totalSales),
      totalOrders: Number(totalOrders),
      averageOrderValue: totalOrders > 0 ? Number(totalSales) / Number(totalOrders) : 0,
    };
  }
}

export const storage = new DatabaseStorage();
