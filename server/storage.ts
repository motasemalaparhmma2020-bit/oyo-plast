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

  async getOrders(userId: string): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.userId, userId));
  }
}

export const storage = new DatabaseStorage();
