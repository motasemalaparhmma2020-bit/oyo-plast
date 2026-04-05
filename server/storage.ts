import {
  users, products, categories, banners, offers, orders, orderItems, navigationSettings, homePageSettings, displaySettings,
  homeSections,
  type User,
  type Product,
  type Category,
  type Banner, type Offer,
  type Order,
  type NavigationSettings,
  type HomePageSettings,
  type DisplaySettings,
  type HomeSection,
  insertProductSchema, insertCategorySchema
} from "@shared/schema";
import { z } from "zod";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

type InsertUser = any;
type InsertProduct = z.infer<typeof insertProductSchema>;
type InsertCategory = z.infer<typeof insertCategorySchema>;

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: any): Promise<User>;

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

  getNavigationSettings(): Promise<NavigationSettings>;
  updateNavigationSettings(data: any): Promise<NavigationSettings>;
  getPrintingProducts(): Promise<Product[]>;

  getHomePageSettings(): Promise<HomePageSettings>;
  updateHomePageSettings(data: any): Promise<HomePageSettings>;

  getDisplaySettings(): Promise<DisplaySettings>;

  getHomeSections(): Promise<HomeSection[]>;
  createHomeSection(data: any): Promise<HomeSection>;
  updateHomeSection(id: number, data: any): Promise<HomeSection>;
  deleteHomeSection(id: number): Promise<void>;
  updateDisplaySettings(data: any): Promise<DisplaySettings>;

  getOrders(): Promise<Order[]>;
  getOrderStats(): Promise<{ totalSales: number; totalOrders: number; averageOrderValue: number }>;
  createOrder(data: any): Promise<Order>;

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
    const conditions = [];
    if (categoryId !== undefined && !Number.isNaN(categoryId)) {
      conditions.push(eq(products.categoryId, categoryId));
    }
    let rows = conditions.length > 0
      ? await db.select().from(products).where(conditions[0])
      : await db.select().from(products);

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((p) =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q) ||
        (Array.isArray(p.tags) ? p.tags : []).some((t) => String(t).toLowerCase().includes(q))
      );
    }

    return rows;
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

  async getNavigationSettings(): Promise<NavigationSettings> {
    const [settings] = await db.select().from(navigationSettings).limit(1);
    if (settings) return settings;
    const [created] = await db.insert(navigationSettings).values({
      showPrintingSection: true,
      showSignupEntryPoint: true,
      enableVariantProductPage: false,
      lockMobilePwaMode: true,
      disablePinchZoom: true,
      disableHorizontalScroll: true,
      updatedAt: new Date(),
    }).returning();
    return created;
  }

  async updateNavigationSettings(data: any): Promise<NavigationSettings> {
    const [settings] = await db.update(navigationSettings).set({ ...data, updatedAt: new Date() }).where(eq(navigationSettings.id, 1)).returning();
    return settings;
  }

  async getPrintingProducts(): Promise<Product[]> {
    return await db.select().from(products).where(eq(products.showInPrinting, true));
  }

  async getHomePageSettings(): Promise<HomePageSettings> {
    const [settings] = await db.select().from(homePageSettings).limit(1);
    if (settings) return settings;
    const [created] = await db.insert(homePageSettings).values({
      primaryColor: "#06B6D4",
      accentColor: "#0891B2",
      showHeader: true,
      showBanners: true,
      showOffers: true,
      showCategories: true,
      footerPrivacyText: "سياسة الخصوصية",
      footerAffiliateText: "التسويق بالعمولة",
      footerReturnsText: "سياسة الاسترجاع",
      footerBottomText: "أويو بلاست - مستلزمات التغليف",
      signupEntryMode: "cart",
      loginFlow: "checkout",
      updatedAt: new Date(),
    }).returning();
    return created;
  }

  async getDisplaySettings(): Promise<DisplaySettings> {
    const [settings] = await db.select().from(displaySettings).limit(1);
    return settings || {
      id: 1,
      categorySize: 72,
      categoriesPerRow: 4,
      showCategories: true,
      productCardWidth: 160,
      productCardHeight: 200,
      offerBannerHeight: 72,
      showOfferBanners: true,
      productCardMargin: 8,
      productCardPaddingV: 8,
      priceFontSize: 16,
      discountBubbleSize: 28,
      quantityButtonHeight: 40,
      imageMode: 'card',
      detailImageHeight: 380,
      detailImageMode: 'contain',
      detailPriceFontSize: 22,
      detailAddToCartHeight: 52,
      detailShowRelated: true,
      detailShowReviews: true,
      detailThumbnailSize: 64,
      discountBadgeBg: '#ef4444',
      showStickyCartBar: true,
      detailPaddingV: 8,
      detailMarginH: 16,
      detailDiscountBubbleSize: 36,
      detailShowThumbnails: true,
      updatedAt: new Date(),
    };
  }

  async updateDisplaySettings(data: any): Promise<DisplaySettings> {
    const existing = await db.select().from(displaySettings).limit(1);
    if (existing.length === 0) {
      const [created] = await db.insert(displaySettings).values({ ...data, updatedAt: new Date() }).returning();
      return created;
    }
    const existingId = existing[0].id;
    const [updated] = await db.update(displaySettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(displaySettings.id, existingId))
      .returning();
    return updated;
  }

  async updateHomePageSettings(data: any): Promise<HomePageSettings> {
    const [settings] = await db.update(homePageSettings).set({ ...data, updatedAt: new Date() }).where(eq(homePageSettings.id, 1)).returning();
    return settings;
  }

  async getHomeSections(): Promise<HomeSection[]> {
    return await db.select().from(homeSections).orderBy(homeSections.priority, homeSections.id);
  }

  async createHomeSection(data: any): Promise<HomeSection> {
    const [section] = await db.insert(homeSections).values(data).returning();
    return section;
  }

  async updateHomeSection(id: number, data: any): Promise<HomeSection> {
    const [section] = await db.update(homeSections).set(data).where(eq(homeSections.id, id)).returning();
    return section;
  }

  async deleteHomeSection(id: number): Promise<void> {
    await db.delete(homeSections).where(eq(homeSections.id, id));
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

  async createOrder(data: any): Promise<Order> {
    const [order] = await db.insert(orders).values({
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      shippingCity: data.shippingCity,
      shippingAddress: data.shippingAddress,
      shippingOption: data.shippingOption,
      shippingCost: data.shippingCost,
      notes: data.notes,
      total: data.total,
      paymentMethod: data.paymentMethod || "cash_on_delivery",
      status: "pending",
    }).returning();

    // Add order items — fetch price from DB if not provided (guest cart)
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        let price = item.price ?? item.unitPrice ?? null;

        // If price is missing, look it up from products table
        if (price === null || price === undefined) {
          const productId = item.productId ?? item.product?.id;
          if (productId) {
            const [prod] = await db
              .select({ price: products.price })
              .from(products)
              .where(eq(products.id, productId))
              .limit(1);
            price = prod?.price ?? "0";
          }
        }

        const productId = item.productId ?? item.product?.id;
        await db.insert(orderItems).values({
          orderId: order.id,
          productId: productId,
          quantity: item.quantity,
          price: String(price ?? "0"),
          selectedSize: item.selectedSize,
          selectedColor: item.selectedColor,
          customPrinting: item.customPrinting ?? false,
          designNotes: item.designNotes,
          designFileUrl: item.designFileUrl,
        });
      }
    }

    return order;
  }
}

export const storage = new DatabaseStorage();
