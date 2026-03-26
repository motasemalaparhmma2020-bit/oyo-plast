import { users, products, categories, type User, type InsertUser, type Product, type InsertProduct, type Category, type InsertCategory } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getProducts(): Promise<Product[]>;
  getCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  createProduct(product: InsertProduct): Promise<Product>;
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
    // تشغيل التعبئة التلقائية للأقسام عند بدء التشغيل
    this.seedCategories();
  }

  async seedCategories() {
    const existing = await this.getCategories();
    if (existing.length === 0) {
      const defaultCategories = [
        "اكياس دعاية اعراس",
        "أكياس دعاية تجاري",
        "اكياس قماشية",
        "اكياس علاقي",
        "اكياس تغليف مكسرات",
        "مستلزمات المطاعم"
      ];
      
      for (const name of defaultCategories) {
        await db.insert(categories).values({ name });
      }
      console.log("تم إضافة الأقسام الجديدة لمتجر أويو بلاست بنجاح");
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getProducts(): Promise<Product[]> {
    return await db.select().from(products);
  }

  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const [category] = await db.insert(categories).values(insertCategory).returning();
    return category;
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [product] = await db.insert(products).values(insertProduct).returning();
    return product;
  }
}

export const storage = new DatabaseStorage();

