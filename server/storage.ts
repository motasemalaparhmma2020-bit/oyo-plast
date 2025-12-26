import { db } from "./db";
import {
  users, products, categories, cartItems, orders, orderItems,
  type User, type InsertUser, type Product, type Category, type CartItem, type Order, type OrderItem
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>; // Not used by auth anymore but kept for compat
  // createUser(user: InsertUser): Promise<User>; // Handled by auth module

  getProducts(categoryId?: number): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  getCategories(): Promise<Category[]>;
  
  getCartItems(userId: string): Promise<(CartItem & { product: Product })[]>;
  addToCart(userId: string, productId: number, quantity: number): Promise<CartItem>;
  updateCartItem(id: number, quantity: number): Promise<CartItem>;
  deleteCartItem(id: number): Promise<void>;
  clearCart(userId: string): Promise<void>;

  createOrder(userId: string, total: string): Promise<Order>;
  createOrderItem(orderItem: typeof orderItems.$inferInsert): Promise<OrderItem>;
  getOrders(userId: string): Promise<Order[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  // Deprecated/Unused with Replit Auth but kept for interface
  async getUserByUsername(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getProducts(categoryId?: number): Promise<Product[]> {
    if (categoryId) {
      return await db.select().from(products).where(eq(products.categoryId, categoryId));
    }
    return await db.select().from(products);
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async getCartItems(userId: string): Promise<(CartItem & { product: Product })[]> {
    const items = await db.select({
      cartItem: cartItems,
      product: products,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.userId, userId));
    
    return items.map(item => ({ ...item.cartItem, product: item.product }));
  }

  async addToCart(userId: string, productId: number, quantity: number): Promise<CartItem> {
    // Check if item exists
    const [existing] = await db.select()
      .from(cartItems)
      .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)));

    if (existing) {
      const [updated] = await db.update(cartItems)
        .set({ quantity: existing.quantity + quantity })
        .where(eq(cartItems.id, existing.id))
        .returning();
      return updated;
    }

    const [item] = await db.insert(cartItems)
      .values({ userId, productId, quantity })
      .returning();
    return item;
  }

  async updateCartItem(id: number, quantity: number): Promise<CartItem> {
    if (quantity === 0) {
      await this.deleteCartItem(id);
      return { id, userId: "0", productId: 0, quantity: 0 }; 
    }
    const [item] = await db.update(cartItems)
      .set({ quantity })
      .where(eq(cartItems.id, id))
      .returning();
    return item;
  }

  async deleteCartItem(id: number): Promise<void> {
    await db.delete(cartItems).where(eq(cartItems.id, id));
  }

  async clearCart(userId: string): Promise<void> {
    await db.delete(cartItems).where(eq(cartItems.userId, userId));
  }

  async createOrder(userId: string, total: string): Promise<Order> {
    const [order] = await db.insert(orders)
      .values({ userId, total, status: 'completed' })
      .returning();
    return order;
  }

  async createOrderItem(orderItem: typeof orderItems.$inferInsert): Promise<OrderItem> {
    const [item] = await db.insert(orderItems).values(orderItem).returning();
    return item;
  }

  async seedPlasticProducts(): Promise<void> {
    const plasticCategory = await db.select().from(categories).where(eq(categories.slug, 'plastics')).limit(1);
    if (plasticCategory.length === 0) return;
    
    const catId = plasticCategory[0].id;
    const plasticProducts = [
      {
        name: "علب ميكرويف سوداء - طقم 50 حبة",
        description: "علب بلاستيكية سوداء عالية الجودة آمنة للاستخدام في الميكرويف، مثالية للمطاعم والوجبات السريعة.",
        price: "7500",
        priceSar: "50",
        categoryId: catId,
        imageUrl: "https://images.unsplash.com/photo-1621252178174-2795c6c66657?w=800&q=80",
        stock: 500,
        bulkPricing: JSON.stringify([{ minQty: 10, price: "7000" }])
      },
      {
        name: "صحون بلاستيك شفافة - مقاسات متنوعة",
        description: "صحون بلاستيكية شفافة قوية وأنيقة لتقديم الحلويات والفواكه.",
        price: "4500",
        priceSar: "30",
        categoryId: catId,
        imageUrl: "https://images.unsplash.com/photo-1591871937573-74dbba515c4c?w=800&q=80",
        stock: 1000
      },
      {
        name: "ملاعق بلاستيك مغلفة - كرتون 1000 ملعقة",
        description: "ملاعق بلاستيكية مغلفة فردياً لضمان النظافة والتعقيم.",
        price: "12000",
        priceSar: "80",
        categoryId: catId,
        imageUrl: "https://images.unsplash.com/photo-1581009137042-c552e485697a?w=800&q=80",
        stock: 200
      },
      {
        name: "أكواب عصير بلاستيك مع غطاء - 50 حبة",
        description: "أكواب بلاستيكية متينة للعصائر الباردة مع أغطية محكمة الإغلاق.",
        price: "3500",
        priceSar: "25",
        categoryId: catId,
        imageUrl: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&q=80",
        stock: 300
      },
      {
        name: "قفازات بلاستيك شفافة - ربطة 100 حبة",
        description: "قفازات استخدام لمرة واحدة، خفيفة ومناسبة للتعامل مع الأطعمة.",
        price: "1500",
        priceSar: "10",
        categoryId: catId,
        imageUrl: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&q=80",
        stock: 1000
      },
      {
        name: "مفارش سفرة بلاستيك - رول كبير",
        description: "مفارش طاولة بلاستيكية عملية وسهلة الاستخدام للمناسبات والمنزل.",
        price: "5500",
        priceSar: "35",
        categoryId: catId,
        imageUrl: "https://images.unsplash.com/photo-1605623081914-9964523c14f5?w=800&q=80",
        stock: 150
      }
    ];

    for (const p of plasticProducts) {
      await db.insert(products).values(p);
    }
  }
}

export const storage = new DatabaseStorage();
