import { db } from "./db";
import {
  users, products, categories, cartItems, orders, orderItems, settings, reviews, wishlist, notifications,
  wallets, walletTransactions, rewardPoints, pointsTransactions, banners, offers, phoneVerifications,
  marketerProfiles, endCustomerContacts, marketerCommissions, coupons,
  type User, type Product, type Category, type CartItem, type Order, type OrderItem, type Setting, type Review, type WishlistItem, type Notification,
  type Wallet, type WalletTransaction, type RewardPoints, type PointsTransaction, type Banner, type Offer,
  type PhoneVerification, type MarketerProfile, type EndCustomerContact, type MarketerCommission, type Coupon
} from "@shared/schema";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";

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

  createOrder(userId: string | null, orderData: {
    total: string;
    currency?: string;
    depositAmount?: string | null;
    paymentMethod?: string | null;
    receiptImageUrl?: string | null;
    customerPhone?: string | null;
    shippingCity?: string | null;
    shippingAddress?: string | null;
    notes?: string | null;
    status?: string;
    couponCode?: string | null;
    discountAmount?: string | null;
    subtotalBeforeDiscount?: string | null;
  }): Promise<Order>;
  createOrderItem(orderItem: typeof orderItems.$inferInsert): Promise<OrderItem>;
  getOrderItems(orderId: number): Promise<(OrderItem & { productName: string })[]>;
  getOrders(userId: string): Promise<Order[]>;
  getAllOrders(): Promise<Order[]>;
  
  getSetting(key: string): Promise<Setting | undefined>;
  setSetting(key: string, value: string): Promise<Setting>;
  getAllSettings(): Promise<Setting[]>;
  
  // Reviews
  getProductReviews(productId: number): Promise<Review[]>;
  addReview(review: { productId: number; userId: string; rating: number; comment?: string; imageUrl?: string }): Promise<Review>;
  
  // Inventory
  updateProductStock(productId: number, stock: number): Promise<Product>;
  
  // Order tracking
  updateOrderStatus(orderId: number, status: string, trackingNumber?: string): Promise<Order>;
  
  // Analytics
  getSalesStats(): Promise<{ totalSales: number; totalOrders: number; averageOrderValue: number }>;
  getOrdersByDateRange(startDate: Date, endDate: Date): Promise<Order[]>;
  
  // Wishlist
  getWishlist(userId: string): Promise<(WishlistItem & { product: Product })[]>;
  addToWishlist(userId: string, productId: number): Promise<WishlistItem>;
  removeFromWishlist(userId: string, productId: number): Promise<void>;
  isInWishlist(userId: string, productId: number): Promise<boolean>;
  
  // Notifications
  getNotifications(userId: string): Promise<Notification[]>;
  createNotification(userId: string, title: string, message: string, type?: string, orderId?: number): Promise<Notification>;
  markNotificationRead(notificationId: number): Promise<void>;
  markAllNotificationsRead(userId: string): Promise<void>;
  getUnreadCount(userId: string): Promise<number>;
  
  // Bestselling products
  getBestsellingProducts(limit?: number): Promise<Product[]>;
  
  // Increment sold count for products in an order
  incrementSoldCount(orderId: number): Promise<void>;
  
  // Product management
  createProduct(product: Omit<Product, 'id'>): Promise<Product>;
  updateProduct(id: number, product: Partial<Product>): Promise<Product>;
  deleteProduct(id: number): Promise<void>;
  
  // Category management
  createCategory(category: Omit<Category, 'id'>): Promise<Category>;
  
  // Wallet
  getOrCreateWallet(userId: string): Promise<Wallet>;
  getWalletTransactions(userId: string): Promise<WalletTransaction[]>;
  addWalletBalance(userId: string, amount: string, currency: string, type: string, description?: string, orderId?: number): Promise<WalletTransaction>;
  useWalletBalance(userId: string, amount: string, currency: string, orderId?: number): Promise<WalletTransaction | null>;
  
  // Reward Points
  getOrCreateRewardPoints(userId: string): Promise<RewardPoints>;
  getPointsTransactions(userId: string): Promise<PointsTransaction[]>;
  addPoints(userId: string, points: number, type: string, description?: string, orderId?: number, reviewId?: number): Promise<PointsTransaction>;
  usePoints(userId: string, points: number, description?: string): Promise<PointsTransaction | null>;
  
  // Banners
  getBanners(activeOnly?: boolean): Promise<Banner[]>;
  createBanner(banner: Omit<Banner, 'id' | 'createdAt'>): Promise<Banner>;
  updateBanner(id: number, banner: Partial<Banner>): Promise<Banner>;
  deleteBanner(id: number): Promise<void>;
  
  // Offers
  getOffers(activeOnly?: boolean): Promise<Offer[]>;
  createOffer(offer: Omit<Offer, 'id' | 'createdAt'>): Promise<Offer>;
  updateOffer(id: number, offer: Partial<Offer>): Promise<Offer>;
  deleteOffer(id: number): Promise<void>;
  
  // Phone Verification (OTP)
  createPhoneVerification(phone: string, code: string, expiresAt: Date): Promise<PhoneVerification>;
  getPhoneVerification(phone: string): Promise<PhoneVerification | undefined>;
  markPhoneVerified(phone: string): Promise<void>;
  incrementVerificationAttempts(phone: string): Promise<void>;
  deletePhoneVerification(phone: string): Promise<void>;
  
  // Marketer Profiles
  getMarketerProfile(userId: string): Promise<MarketerProfile | undefined>;
  createMarketerProfile(profile: Omit<MarketerProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<MarketerProfile>;
  updateMarketerProfile(userId: string, profile: Partial<MarketerProfile>): Promise<MarketerProfile>;
  
  // End Customer Contacts (for marketer orders)
  getEndCustomerContacts(marketerId: string): Promise<EndCustomerContact[]>;
  createEndCustomerContact(contact: Omit<EndCustomerContact, 'id' | 'createdAt'>): Promise<EndCustomerContact>;
  
  // Marketer Commissions
  getMarketerCommissions(marketerId: string): Promise<MarketerCommission[]>;
  createMarketerCommission(commission: Omit<MarketerCommission, 'id' | 'createdAt'>): Promise<MarketerCommission>;
  releaseCommission(commissionId: number): Promise<MarketerCommission>;
  getPendingCommissions(): Promise<MarketerCommission[]>;
  
  // Coupons
  getCoupon(code: string): Promise<Coupon | undefined>;
  getMarketerCoupons(marketerId: string): Promise<Coupon[]>;
  createCoupon(coupon: Omit<Coupon, 'id' | 'createdAt' | 'usageCount'>): Promise<Coupon>;
  updateCoupon(id: number, coupon: Partial<Coupon>): Promise<Coupon>;
  incrementCouponUsage(code: string): Promise<void>;
  
  // User updates
  updateUserAccountType(userId: string, accountType: string): Promise<User>;
  updateUserProfile(userId: string, data: Partial<User>): Promise<User>;
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
      return { 
        id, 
        userId: "0", 
        productId: 0, 
        quantity: 0,
        selectedBagColor: null,
        printColorCount: null,
        printColor1: null,
        printColor2: null,
        printColor3: null,
        unitPrice: null
      }; 
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

  async createOrder(userId: string | null, orderData: {
    total: string;
    currency?: string;
    depositAmount?: string | null;
    paymentMethod?: string | null;
    receiptImageUrl?: string | null;
    customerPhone?: string | null;
    shippingCity?: string | null;
    shippingAddress?: string | null;
    notes?: string | null;
    status?: string;
    couponCode?: string | null;
    discountAmount?: string | null;
    subtotalBeforeDiscount?: string | null;
  }): Promise<Order> {
    const [order] = await db.insert(orders)
      .values({ 
        userId, 
        total: orderData.total,
        currency: orderData.currency || 'YER',
        depositAmount: orderData.depositAmount,
        paymentMethod: orderData.paymentMethod,
        receiptImageUrl: orderData.receiptImageUrl,
        customerPhone: orderData.customerPhone,
        shippingCity: orderData.shippingCity,
        shippingAddress: orderData.shippingAddress,
        notes: orderData.notes,
        status: orderData.status || 'pending',
        couponCode: orderData.couponCode,
        discountAmount: orderData.discountAmount,
        subtotalBeforeDiscount: orderData.subtotalBeforeDiscount
      })
      .returning();
    return order;
  }

  async getOrders(userId: string): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.userId, userId)).orderBy(orders.createdAt);
  }

  async getAllOrders(): Promise<Order[]> {
    return await db.select().from(orders).orderBy(orders.createdAt);
  }

  async createOrderItem(orderItem: typeof orderItems.$inferInsert): Promise<OrderItem> {
    const [item] = await db.insert(orderItems).values(orderItem).returning();
    return item;
  }

  async getOrderItems(orderId: number): Promise<(OrderItem & { productName: string })[]> {
    const items = await db.select({
      orderItem: orderItems,
      productName: products.name,
    })
    .from(orderItems)
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, orderId));
    
    return items.map(item => ({
      ...item.orderItem,
      productName: item.productName,
    }));
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
        imageUrl: "attached_assets/generated_images/high-quality_plastic_container_product_photography.png",
        stock: 500,
        bulkPricing: JSON.stringify([{ minQty: 10, price: "7000" }])
      },
      {
        name: "صحون بلاستيك شفافة - طقم 25 حبة",
        description: "صحون بلاستيكية شفافة قوية وأنيقة لتقديم الحلويات والفواكه.",
        price: "4500",
        priceSar: "30",
        categoryId: catId,
        imageUrl: "attached_assets/stock_images/clear_plastic_dispos_fe5138c3.jpg",
        stock: 1000
      },
      {
        name: "ملاعق بلاستيك مغلفة - كرتون 1000 ملعقة",
        description: "ملاعق بلاستيكية مغلفة فردياً لضمان النظافة والتعقيم.",
        price: "12000",
        priceSar: "80",
        categoryId: catId,
        imageUrl: "attached_assets/stock_images/individually_wrapped_a3e843cf.jpg",
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

  async seedPaperProducts(): Promise<void> {
    const paperCategory = await db.select().from(categories).where(eq(categories.slug, 'paper')).limit(1);
    if (paperCategory.length === 0) return;
    
    const catId = paperCategory[0].id;
    const paperProducts = [
      {
        name: "أكواب ورقية للقهوة - 8 أونصة 50 حبة",
        description: "أكواب ورقية فاخرة مع غطاء، مثالية للقهوة والشاي الساخن.",
        price: "2500",
        priceSar: "15",
        categoryId: catId,
        imageUrl: "attached_assets/generated_images/high-quality_paper_coffee_cup_product_photography.png",
        stock: 1000
      },
      {
        name: "أكياس ورقية بنية - ربطة 100 كيس",
        description: "أكياس كرافت ورقية قوية وصديقة للبيئة للتسوق والتغليف.",
        price: "3500",
        priceSar: "20",
        categoryId: catId,
        imageUrl: "attached_assets/stock_images/brown_kraft_paper_sh_1892aa34.jpg",
        stock: 500
      },
      {
        name: "علب برجر ورقية - 50 علبة",
        description: "علب ورقية عالية الجودة للبرجر، تحافظ على السخونة والقوام.",
        price: "4000",
        priceSar: "25",
        categoryId: catId,
        imageUrl: "attached_assets/stock_images/paper_burger_boxes_p_65591726.jpg",
        stock: 800
      }
    ];

    for (const p of paperProducts) {
      await db.insert(products).values(p);
    }
  }

  async seedCleaningProducts(): Promise<void> {
    const cleaningCategory = await db.select().from(categories).where(eq(categories.slug, 'cleaning')).limit(1);
    if (cleaningCategory.length === 0) return;
    
    const catId = cleaningCategory[0].id;
    const cleaningProducts = [
      {
        name: "منظف زجاج برائحة الليمون - 1 لتر",
        description: "سائل منظف للزجاج يمنحك لمعاناً مثالياً دون ترك أي أثر.",
        price: "1800",
        priceSar: "12",
        categoryId: catId,
        imageUrl: "attached_assets/generated_images/high-quality_cleaning_detergent_bottle_product_photography.png",
        stock: 450
      }
    ];

    for (const p of cleaningProducts) {
      await db.insert(products).values(p);
    }
  }

  async getSetting(key: string): Promise<Setting | undefined> {
    const [setting] = await db.select().from(settings).where(eq(settings.key, key));
    return setting;
  }

  async setSetting(key: string, value: string): Promise<Setting> {
    const existing = await this.getSetting(key);
    if (existing) {
      const [updated] = await db.update(settings)
        .set({ value })
        .where(eq(settings.key, key))
        .returning();
      return updated;
    }
    const [created] = await db.insert(settings).values({ key, value }).returning();
    return created;
  }

  async getAllSettings(): Promise<Setting[]> {
    return await db.select().from(settings);
  }

  // Reviews
  async getProductReviews(productId: number): Promise<Review[]> {
    return await db.select().from(reviews)
      .where(eq(reviews.productId, productId))
      .orderBy(desc(reviews.createdAt));
  }

  async addReview(review: { productId: number; userId: string; rating: number; comment?: string; imageUrl?: string }): Promise<Review> {
    const [newReview] = await db.insert(reviews).values({
      productId: review.productId,
      userId: review.userId,
      rating: review.rating,
      comment: review.comment || null,
      imageUrl: review.imageUrl || null,
    }).returning();
    
    // Update product rating average
    const productReviews = await this.getProductReviews(review.productId);
    const avgRating = productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length;
    await db.update(products)
      .set({ rating: avgRating.toFixed(1), reviewCount: productReviews.length })
      .where(eq(products.id, review.productId));
    
    return newReview;
  }

  // Inventory
  async updateProductStock(productId: number, stock: number): Promise<Product> {
    const [updated] = await db.update(products)
      .set({ stock })
      .where(eq(products.id, productId))
      .returning();
    return updated;
  }

  // Order tracking
  async updateOrderStatus(orderId: number, status: string, trackingNumber?: string): Promise<Order> {
    const updateData: { status: string; trackingNumber?: string } = { status };
    if (trackingNumber) {
      updateData.trackingNumber = trackingNumber;
    }
    const [updated] = await db.update(orders)
      .set(updateData)
      .where(eq(orders.id, orderId))
      .returning();
    return updated;
  }

  // Analytics
  async getSalesStats(): Promise<{ totalSales: number; totalOrders: number; averageOrderValue: number }> {
    const allOrders = await db.select().from(orders);
    const completedOrders = allOrders.filter(o => o.status !== 'cancelled');
    const totalSales = completedOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const totalOrders = completedOrders.length;
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
    return { totalSales, totalOrders, averageOrderValue };
  }

  async getOrdersByDateRange(startDate: Date, endDate: Date): Promise<Order[]> {
    return await db.select().from(orders)
      .where(
        and(
          sql`${orders.createdAt} >= ${startDate}`,
          sql`${orders.createdAt} <= ${endDate}`
        )
      )
      .orderBy(orders.createdAt);
  }

  // Wishlist
  async getWishlist(userId: string): Promise<(WishlistItem & { product: Product })[]> {
    const items = await db.select({
      wishlistItem: wishlist,
      product: products,
    })
    .from(wishlist)
    .innerJoin(products, eq(wishlist.productId, products.id))
    .where(eq(wishlist.userId, userId))
    .orderBy(desc(wishlist.createdAt));
    
    return items.map(item => ({ ...item.wishlistItem, product: item.product }));
  }

  async addToWishlist(userId: string, productId: number): Promise<WishlistItem> {
    const existing = await db.select()
      .from(wishlist)
      .where(and(eq(wishlist.userId, userId), eq(wishlist.productId, productId)));
    
    if (existing.length > 0) {
      return existing[0];
    }

    const [item] = await db.insert(wishlist)
      .values({ userId, productId })
      .returning();
    return item;
  }

  async removeFromWishlist(userId: string, productId: number): Promise<void> {
    await db.delete(wishlist)
      .where(and(eq(wishlist.userId, userId), eq(wishlist.productId, productId)));
  }

  async isInWishlist(userId: string, productId: number): Promise<boolean> {
    const [item] = await db.select()
      .from(wishlist)
      .where(and(eq(wishlist.userId, userId), eq(wishlist.productId, productId)));
    return !!item;
  }

  // Notifications
  async getNotifications(userId: string): Promise<Notification[]> {
    return await db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async createNotification(userId: string, title: string, message: string, type: string = 'order', orderId?: number): Promise<Notification> {
    const [notification] = await db.insert(notifications)
      .values({ userId, title, message, type, orderId })
      .returning();
    return notification;
  }

  async markNotificationRead(notificationId: number): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, notificationId));
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
  }

  async getUnreadCount(userId: string): Promise<number> {
    const result = await db.select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return result.length;
  }

  async getBestsellingProducts(limit: number = 8): Promise<Product[]> {
    // Get products ordered by total quantity sold
    const bestsellers = await db.select({
      productId: orderItems.productId,
      totalSold: sql<number>`SUM(${orderItems.quantity})`.as('total_sold')
    })
    .from(orderItems)
    .groupBy(orderItems.productId)
    .orderBy(sql`SUM(${orderItems.quantity}) DESC`)
    .limit(limit);

    if (bestsellers.length === 0) {
      // If no orders yet, return newest products
      return await db.select().from(products).limit(limit);
    }

    const productIds = bestsellers.map(b => b.productId);
    const bestProducts = await db.select()
      .from(products)
      .where(sql`${products.id} IN (${sql.join(productIds.map(id => sql`${id}`), sql`, `)})`);

    // Sort by sales order
    return bestProducts.sort((a, b) => {
      return productIds.indexOf(a.id) - productIds.indexOf(b.id);
    });
  }

  // Increment sold count for all products in an order
  async incrementSoldCount(orderId: number): Promise<void> {
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    
    for (const item of items) {
      await db.update(products)
        .set({ 
          soldCount: sql`COALESCE(${products.soldCount}, 0) + ${item.quantity}` 
        })
        .where(eq(products.id, item.productId));
    }
  }

  // Product management
  async createProduct(product: Omit<Product, 'id'>): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async updateProduct(id: number, product: Partial<Product>): Promise<Product> {
    const [updated] = await db.update(products)
      .set(product)
      .where(eq(products.id, id))
      .returning();
    return updated;
  }

  async deleteProduct(id: number): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  // Category management
  async createCategory(category: Omit<Category, 'id'>): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }
  
  // Wallet methods
  async getOrCreateWallet(userId: string): Promise<Wallet> {
    const [existingWallet] = await db.select().from(wallets).where(eq(wallets.userId, userId));
    if (existingWallet) {
      return existingWallet;
    }
    const [newWallet] = await db.insert(wallets).values({ userId }).returning();
    return newWallet;
  }
  
  async getWalletTransactions(userId: string): Promise<WalletTransaction[]> {
    return await db.select()
      .from(walletTransactions)
      .where(eq(walletTransactions.userId, userId))
      .orderBy(desc(walletTransactions.createdAt));
  }
  
  async addWalletBalance(
    userId: string, 
    amount: string, 
    currency: string, 
    type: string, 
    description?: string, 
    orderId?: number
  ): Promise<WalletTransaction> {
    const wallet = await this.getOrCreateWallet(userId);
    
    // Update wallet balance
    if (currency === 'SAR') {
      await db.update(wallets)
        .set({ 
          balanceSar: sql`COALESCE(${wallets.balanceSar}, '0')::numeric + ${amount}::numeric`,
          updatedAt: sql`NOW()`
        })
        .where(eq(wallets.id, wallet.id));
    } else {
      await db.update(wallets)
        .set({ 
          balanceYer: sql`COALESCE(${wallets.balanceYer}, '0')::numeric + ${amount}::numeric`,
          updatedAt: sql`NOW()`
        })
        .where(eq(wallets.id, wallet.id));
    }
    
    // Create transaction record
    const [transaction] = await db.insert(walletTransactions).values({
      walletId: wallet.id,
      userId,
      type,
      amount,
      currency,
      description,
      orderId
    }).returning();
    
    return transaction;
  }
  
  async useWalletBalance(
    userId: string, 
    amount: string, 
    currency: string, 
    orderId?: number
  ): Promise<WalletTransaction | null> {
    const wallet = await this.getOrCreateWallet(userId);
    const amountNum = parseFloat(amount);
    
    // Check if sufficient balance
    const currentBalance = currency === 'SAR' 
      ? parseFloat(wallet.balanceSar || '0') 
      : parseFloat(wallet.balanceYer || '0');
    
    if (currentBalance < amountNum) {
      return null; // Insufficient balance
    }
    
    // Deduct from wallet
    if (currency === 'SAR') {
      await db.update(wallets)
        .set({ 
          balanceSar: sql`COALESCE(${wallets.balanceSar}, '0')::numeric - ${amount}::numeric`,
          updatedAt: sql`NOW()`
        })
        .where(eq(wallets.id, wallet.id));
    } else {
      await db.update(wallets)
        .set({ 
          balanceYer: sql`COALESCE(${wallets.balanceYer}, '0')::numeric - ${amount}::numeric`,
          updatedAt: sql`NOW()`
        })
        .where(eq(wallets.id, wallet.id));
    }
    
    // Create transaction record
    const [transaction] = await db.insert(walletTransactions).values({
      walletId: wallet.id,
      userId,
      type: 'purchase',
      amount: `-${amount}`,
      currency,
      description: 'استخدام رصيد المحفظة للشراء',
      orderId
    }).returning();
    
    return transaction;
  }
  
  // Reward Points methods
  async getOrCreateRewardPoints(userId: string): Promise<RewardPoints> {
    const [existing] = await db.select().from(rewardPoints).where(eq(rewardPoints.userId, userId));
    if (existing) {
      return existing;
    }
    const [newPoints] = await db.insert(rewardPoints).values({ userId }).returning();
    return newPoints;
  }
  
  async getPointsTransactions(userId: string): Promise<PointsTransaction[]> {
    return await db.select()
      .from(pointsTransactions)
      .where(eq(pointsTransactions.userId, userId))
      .orderBy(desc(pointsTransactions.createdAt));
  }
  
  async addPoints(
    userId: string, 
    points: number, 
    type: string, 
    description?: string, 
    orderId?: number, 
    reviewId?: number
  ): Promise<PointsTransaction> {
    const userPoints = await this.getOrCreateRewardPoints(userId);
    
    // Update points balance
    await db.update(rewardPoints)
      .set({ 
        points: sql`${rewardPoints.points} + ${points}`,
        lifetimePoints: sql`${rewardPoints.lifetimePoints} + ${points}`,
        updatedAt: sql`NOW()`
      })
      .where(eq(rewardPoints.id, userPoints.id));
    
    // Create transaction record
    const [transaction] = await db.insert(pointsTransactions).values({
      userId,
      type,
      points,
      description,
      orderId,
      reviewId
    }).returning();
    
    return transaction;
  }
  
  async usePoints(userId: string, points: number, description?: string): Promise<PointsTransaction | null> {
    const userPoints = await this.getOrCreateRewardPoints(userId);
    
    if (userPoints.points < points) {
      return null; // Insufficient points
    }
    
    // Deduct points
    await db.update(rewardPoints)
      .set({ 
        points: sql`${rewardPoints.points} - ${points}`,
        updatedAt: sql`NOW()`
      })
      .where(eq(rewardPoints.id, userPoints.id));
    
    // Create transaction record
    const [transaction] = await db.insert(pointsTransactions).values({
      userId,
      type: 'redeemed',
      points: -points,
      description: description || 'استبدال نقاط'
    }).returning();
    
    return transaction;
  }
  
  // Banner methods
  async getBanners(activeOnly: boolean = false): Promise<Banner[]> {
    if (activeOnly) {
      return await db.select().from(banners)
        .where(eq(banners.isActive, true))
        .orderBy(banners.sortOrder);
    }
    return await db.select().from(banners).orderBy(banners.sortOrder);
  }
  
  async createBanner(banner: Omit<Banner, 'id' | 'createdAt'>): Promise<Banner> {
    const [newBanner] = await db.insert(banners).values(banner).returning();
    return newBanner;
  }
  
  async updateBanner(id: number, banner: Partial<Banner>): Promise<Banner> {
    const [updated] = await db.update(banners)
      .set(banner)
      .where(eq(banners.id, id))
      .returning();
    return updated;
  }
  
  async deleteBanner(id: number): Promise<void> {
    await db.delete(banners).where(eq(banners.id, id));
  }
  
  // Offer methods
  async getOffers(activeOnly: boolean = false): Promise<Offer[]> {
    if (activeOnly) {
      return await db.select().from(offers)
        .where(eq(offers.isActive, true))
        .orderBy(offers.sortOrder);
    }
    return await db.select().from(offers).orderBy(offers.sortOrder);
  }
  
  async createOffer(offer: Omit<Offer, 'id' | 'createdAt'>): Promise<Offer> {
    const [newOffer] = await db.insert(offers).values(offer).returning();
    return newOffer;
  }
  
  async updateOffer(id: number, offer: Partial<Offer>): Promise<Offer> {
    const [updated] = await db.update(offers)
      .set(offer)
      .where(eq(offers.id, id))
      .returning();
    return updated;
  }
  
  async deleteOffer(id: number): Promise<void> {
    await db.delete(offers).where(eq(offers.id, id));
  }
  
  // Phone Verification methods
  async createPhoneVerification(phone: string, code: string, expiresAt: Date): Promise<PhoneVerification> {
    // Delete any existing verification for this phone
    await db.delete(phoneVerifications).where(eq(phoneVerifications.phone, phone));
    
    const [verification] = await db.insert(phoneVerifications).values({
      phone,
      code,
      expiresAt,
      attempts: 0,
      verified: false
    }).returning();
    return verification;
  }
  
  async getPhoneVerification(phone: string): Promise<PhoneVerification | undefined> {
    const [verification] = await db.select()
      .from(phoneVerifications)
      .where(eq(phoneVerifications.phone, phone));
    return verification;
  }
  
  async markPhoneVerified(phone: string): Promise<void> {
    await db.update(phoneVerifications)
      .set({ verified: true })
      .where(eq(phoneVerifications.phone, phone));
  }
  
  async incrementVerificationAttempts(phone: string): Promise<void> {
    await db.update(phoneVerifications)
      .set({ attempts: sql`${phoneVerifications.attempts} + 1` })
      .where(eq(phoneVerifications.phone, phone));
  }
  
  async deletePhoneVerification(phone: string): Promise<void> {
    await db.delete(phoneVerifications).where(eq(phoneVerifications.phone, phone));
  }
  
  // Marketer Profile methods
  async getMarketerProfile(userId: string): Promise<MarketerProfile | undefined> {
    const [profile] = await db.select()
      .from(marketerProfiles)
      .where(eq(marketerProfiles.userId, userId));
    return profile;
  }
  
  async createMarketerProfile(profile: Omit<MarketerProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<MarketerProfile> {
    const [newProfile] = await db.insert(marketerProfiles)
      .values(profile)
      .returning();
    return newProfile;
  }
  
  async updateMarketerProfile(userId: string, profile: Partial<MarketerProfile>): Promise<MarketerProfile> {
    const [updated] = await db.update(marketerProfiles)
      .set({ ...profile, updatedAt: sql`NOW()` })
      .where(eq(marketerProfiles.userId, userId))
      .returning();
    return updated;
  }
  
  // End Customer Contact methods
  async getEndCustomerContacts(marketerId: string): Promise<EndCustomerContact[]> {
    return await db.select()
      .from(endCustomerContacts)
      .where(eq(endCustomerContacts.marketerId, marketerId))
      .orderBy(desc(endCustomerContacts.createdAt));
  }
  
  async createEndCustomerContact(contact: Omit<EndCustomerContact, 'id' | 'createdAt'>): Promise<EndCustomerContact> {
    const [newContact] = await db.insert(endCustomerContacts)
      .values(contact)
      .returning();
    return newContact;
  }
  
  // Marketer Commission methods
  async getMarketerCommissions(marketerId: string): Promise<MarketerCommission[]> {
    return await db.select()
      .from(marketerCommissions)
      .where(eq(marketerCommissions.marketerId, marketerId))
      .orderBy(desc(marketerCommissions.createdAt));
  }
  
  async createMarketerCommission(commission: Omit<MarketerCommission, 'id' | 'createdAt'>): Promise<MarketerCommission> {
    const [newCommission] = await db.insert(marketerCommissions)
      .values(commission)
      .returning();
    return newCommission;
  }
  
  async releaseCommission(commissionId: number): Promise<MarketerCommission> {
    const [updated] = await db.update(marketerCommissions)
      .set({ 
        status: 'released',
        releasedAt: sql`NOW()`
      })
      .where(eq(marketerCommissions.id, commissionId))
      .returning();
    return updated;
  }
  
  async getPendingCommissions(): Promise<MarketerCommission[]> {
    return await db.select()
      .from(marketerCommissions)
      .where(and(
        eq(marketerCommissions.status, 'held'),
        lte(marketerCommissions.holdUntil, sql`NOW()`)
      ));
  }
  
  // User update methods
  async updateUserAccountType(userId: string, accountType: string): Promise<User> {
    const [updated] = await db.update(users)
      .set({ accountType })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }
  
  async updateUserProfile(userId: string, data: Partial<User>): Promise<User> {
    const [updated] = await db.update(users)
      .set(data)
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }
  
  // Coupon methods
  async getCoupon(code: string): Promise<Coupon | undefined> {
    const [coupon] = await db.select()
      .from(coupons)
      .where(eq(coupons.code, code.toUpperCase()));
    return coupon;
  }
  
  async getMarketerCoupons(marketerId: string): Promise<Coupon[]> {
    return await db.select()
      .from(coupons)
      .where(eq(coupons.marketerId, marketerId))
      .orderBy(desc(coupons.createdAt));
  }
  
  async createCoupon(coupon: Omit<Coupon, 'id' | 'createdAt' | 'usageCount'>): Promise<Coupon> {
    const [newCoupon] = await db.insert(coupons)
      .values({ ...coupon, code: coupon.code.toUpperCase() })
      .returning();
    return newCoupon;
  }
  
  async updateCoupon(id: number, coupon: Partial<Coupon>): Promise<Coupon> {
    const [updated] = await db.update(coupons)
      .set(coupon)
      .where(eq(coupons.id, id))
      .returning();
    return updated;
  }
  
  async incrementCouponUsage(code: string): Promise<void> {
    await db.update(coupons)
      .set({ usageCount: sql`${coupons.usageCount} + 1` })
      .where(eq(coupons.code, code.toUpperCase()));
  }
}

export const storage = new DatabaseStorage();
