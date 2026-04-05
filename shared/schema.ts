import { pgTable, text, serial, integer, boolean, timestamp, numeric, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
import { users } from "./models/auth";

export * from "./models/auth";

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  imageUrl: text("image_url").notNull(),
  iconUrl: text("icon_url"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true).notNull(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: numeric("price").notNull(), // Default currency price (YER)
  priceSar: numeric("price_sar"), // Price in SAR
  categoryId: integer("category_id").references(() => categories.id).notNull(),
  imageUrl: text("image_url").notNull(),
  imageUrls: text("image_urls").array(), // Multiple product images (gallery)
  stock: integer("stock").default(100).notNull(),
  colors: text("colors").array(), // For color customization
  sizes: text("sizes").array(), // For size customization (e.g., "صغير", "وسط", "كبير")
  allowDesignUpload: boolean("allow_design_upload").default(false).notNull(),
  bulkPricing: text("bulk_pricing"), // JSON string for quantity-based pricing
  sizePricing: text("size_pricing"), // JSON: [{ size: "8oz", price: "100", priceSar: "0.7", colors: ["#fff", "#000"], stock: 50 }]
  printingPricePerUnit: numeric("printing_price_per_unit"), // سعر الطباعة لكل وحدة
  rating: numeric("rating").default("5"), // Product rating (1-5) - default 5 stars
  reviewCount: integer("review_count").default(0), // Number of reviews
  soldCount: integer("sold_count").default(0), // Total units sold
  commissionHoldDays: integer("commission_hold_days").default(2), // Days to hold commission before release
  marketerCommissionRate: numeric("marketer_commission_rate"), // Override commission rate for this product
  // Printing calculator fields
  hasPrintingOptions: boolean("has_printing_options").default(false), // Enable printing calculator for this product
  baseBagPrice: numeric("base_bag_price"), // سعر الكيس الصافي (بدون طباعة)
  singleColorPrintPrice: numeric("single_color_print_price"), // سعر طباعة اللون الواحد
  availableBagColors: text("available_bag_colors").array(), // ألوان الأكياس المتاحة
  tags: text("tags").array(), // كلمات دلالية للبحث والتصنيف (مثل: كيس-قماشي, كرت-شخصي)
  // Reviews visibility
  showReviews: boolean("show_reviews").default(true).notNull(), // Show/hide reviews section
  // Printing section visibility
  showInPrinting: boolean("show_in_printing").default(false).notNull(), // Show in printing & design section
  // Variant UI (SHEIN-style) fields
  enableVariantUI: boolean("enable_variant_ui").default(false).notNull(), // Enable SHEIN-style variant product page for this product
  colorImages: text("color_images"), // JSON: [{ color: "أبيض", hex: "#FFFFFF", imageUrl: "...", imageUrls: [] }]
  // Smart Variants (الخيارات الذكية)
  enableSmartVariants: boolean("enable_smart_variants").default(false).notNull(),
  smartVariants: text("smart_variants"), // JSON: SmartVariantsData
  // ── حقول الخصم ──────────────────────────────────────────────────────────────
  originalPrice: numeric("original_price"),           // السعر الأصلي قبل الخصم (ر.ي)
  originalPriceSar: numeric("original_price_sar"),    // السعر الأصلي بالريال السعودي
  discountPercent: integer("discount_percent"),        // نسبة الخصم يدوياً (تتغلب على الحسابي)
  // ── التصنيفات الترويجية ─────────────────────────────────────────────────────
  promotionalTags: text("promotional_tags").array(),  // ['new','offers','exclusive','discounts','deals','clearance','featured']
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

export const cartItems = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(),
  selectedSize: text("selected_size"), // المقاس المختار
  selectedColor: text("selected_color"), // اللون المختار
  // Printing options
  selectedBagColor: text("selected_bag_color"), // لون الكيس المختار
  printColorCount: integer("print_color_count").default(0), // عدد ألوان الطباعة (0-3)
  printColor1: text("print_color_1"), // لون الطباعة الأول
  printColor2: text("print_color_2"), // لون الطباعة الثاني
  printColor3: text("print_color_3"), // لون الطباعة الثالث
  customPrinting: boolean("custom_printing").default(false), // طباعة مخصصة
  designNotes: text("design_notes"), // ملاحظات خاصة بالتصميم
  designFileUrl: text("design_file_url"), // رابط ملف التصميم المرفوع
  unitPrice: numeric("unit_price"), // السعر المحسوب للوحدة
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id), // Nullable for guest checkout
  status: text("status").notNull().default("pending"), // pending, deposit_paid, processing, shipped, delivered, completed, cancelled
  trackingNumber: text("tracking_number"), // For shipping tracking
  total: numeric("total").notNull(),
  currency: text("currency").default("YER").notNull(), // YER or SAR
  depositAmount: numeric("deposit_amount"), // Deposit amount paid
  paymentMethod: text("payment_method").default("cash_on_delivery"), // karimi, najm, cash_on_delivery, wallet
  receiptImageUrl: text("receipt_image_url"), // Receipt image for bank transfers
  customerName: text("customer_name"),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  shippingOption: text("shipping_option").default("normal"), // normal (3-5 days), fast (1-2 days)
  shippingCost: numeric("shipping_cost").default("0"),
  shippingCity: text("shipping_city"),
  shippingAddress: text("shipping_address"),
  gpsCoordinates: text("gps_coordinates"), // GPS coordinates for delivery location
  notes: text("notes"),
  // Coupon-related fields
  couponCode: text("coupon_code"), // Applied coupon code
  discountAmount: numeric("discount_amount"), // Discount amount applied
  subtotalBeforeDiscount: numeric("subtotal_before_discount"), // Original subtotal before discount
  // Marketer-related fields
  marketerId: varchar("marketer_id").references(() => users.id), // Who placed the order (if marketer)
  endCustomerContactId: integer("end_customer_contact_id"), // Reference to end customer if marketer order
  isMarketerOrder: boolean("is_marketer_order").default(false), // Whether this is a marketer order
  preferredDeliveryTime: text("preferred_delivery_time"), // Preferred delivery time slot
  createdAt: timestamp("created_at").defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id).notNull(),
  productId: integer("product_id").references(() => products.id), // nullable: product may be deleted but order history kept
  quantity: integer("quantity").notNull(),
  price: numeric("price").notNull(),
  selectedSize: text("selected_size"), // المقاس المختار
  selectedColor: text("selected_color"), // اللون المختار
  // Printing options (copied from cart at checkout)
  selectedBagColor: text("selected_bag_color"), // لون الكيس المختار
  printColorCount: integer("print_color_count").default(0), // عدد ألوان الطباعة
  printColor1: text("print_color_1"), // لون الطباعة الأول
  printColor2: text("print_color_2"), // لون الطباعة الثاني
  printColor3: text("print_color_3"), // لون الطباعة الثالث
  customPrinting: boolean("custom_printing").default(false), // طباعة مخصصة
  designNotes: text("design_notes"), // ملاحظات خاصة بالتصميم
  designFileUrl: text("design_file_url"), // رابط ملف التصميم المرفوع
});

// Product Reviews
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  rating: integer("rating").notNull(), // 1-5
  comment: text("comment"),
  imageUrl: text("image_url"), // Customer uploaded photo of the product
  createdAt: timestamp("created_at").defaultNow(),
});

// Wishlist/Favorites
export const userAddresses = pgTable("user_addresses", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(), // اسم العنوان (المنزل، المكتب، إلخ)
  city: text("city").notNull(),
  address: text("address").notNull(),
  phone: text("phone").notNull(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const wishlist = pgTable("wishlist", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Notifications
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").default("order").notNull(), // order, promo, system
  isRead: boolean("is_read").default(false).notNull(),
  orderId: integer("order_id").references(() => orders.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Customer Wallet
export const wallets = pgTable("wallets", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  balanceYer: numeric("balance_yer").default("0").notNull(), // Balance in Yemeni Rial
  balanceSar: numeric("balance_sar").default("0").notNull(), // Balance in Saudi Rial
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Wallet Transactions
export const walletTransactions = pgTable("wallet_transactions", {
  id: serial("id").primaryKey(),
  walletId: integer("wallet_id").references(() => wallets.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(), // deposit, withdrawal, purchase, refund
  amount: numeric("amount").notNull(),
  currency: text("currency").default("YER").notNull(), // YER or SAR
  description: text("description"),
  orderId: integer("order_id").references(() => orders.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Reward Points
export const rewardPoints = pgTable("reward_points", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  points: integer("points").default(0).notNull(),
  lifetimePoints: integer("lifetime_points").default(0).notNull(), // Total points ever earned
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Points Transactions
export const pointsTransactions = pgTable("points_transactions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(), // earned_purchase, earned_review, redeemed, expired
  points: integer("points").notNull(), // Positive for earning, negative for redeeming
  description: text("description"),
  orderId: integer("order_id").references(() => orders.id),
  reviewId: integer("review_id").references(() => reviews.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const productsRelations = relations(products, ({ one }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  product: one(products, {
    fields: [cartItems.productId],
    references: [products.id],
  }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
}));

export const ordersRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  product: one(products, {
    fields: [reviews.productId],
    references: [products.id],
  }),
}));

export const userAddressesRelations = relations(userAddresses, ({ one }) => ({
  user: one(users, {
    fields: [userAddresses.userId],
    references: [users.id],
  }),
}));

export const wishlistRelations = relations(wishlist, ({ one }) => ({
  product: one(products, {
    fields: [wishlist.productId],
    references: [products.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  order: one(orders, {
    fields: [notifications.orderId],
    references: [orders.id],
  }),
}));

export const walletsRelations = relations(wallets, ({ many }) => ({
  transactions: many(walletTransactions),
}));

export const walletTransactionsRelations = relations(walletTransactions, ({ one }) => ({
  wallet: one(wallets, {
    fields: [walletTransactions.walletId],
    references: [wallets.id],
  }),
  order: one(orders, {
    fields: [walletTransactions.orderId],
    references: [orders.id],
  }),
}));

export const pointsTransactionsRelations = relations(pointsTransactions, ({ one }) => ({
  order: one(orders, {
    fields: [pointsTransactions.orderId],
    references: [orders.id],
  }),
  review: one(reviews, {
    fields: [pointsTransactions.reviewId],
    references: [reviews.id],
  }),
}));

// Phone Verifications (OTP)
export const phoneVerifications = pgTable("phone_verifications", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull(),
  code: text("code").notNull(), // 6-digit OTP
  attempts: integer("attempts").default(0).notNull(),
  verified: boolean("verified").default(false).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Marketer Profiles (additional info for marketers)
export const marketerProfiles = pgTable("marketer_profiles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  tier: text("tier").default("bronze").notNull(), // bronze, silver, gold, platinum
  commissionRate: numeric("commission_rate").default("5").notNull(), // Default 5% commission
  totalEarnings: numeric("total_earnings").default("0").notNull(),
  pendingEarnings: numeric("pending_earnings").default("0").notNull(),
  isApproved: boolean("is_approved").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// End Customer Contacts (for marketer orders on behalf of others)
export const endCustomerContacts = pgTable("end_customer_contacts", {
  id: serial("id").primaryKey(),
  marketerId: varchar("marketer_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  address: text("address"),
  city: text("city"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Marketer Commissions (tracks commission for each order)
export const marketerCommissions = pgTable("marketer_commissions", {
  id: serial("id").primaryKey(),
  marketerId: varchar("marketer_id").references(() => users.id).notNull(),
  orderId: integer("order_id").references(() => orders.id).notNull(),
  grossAmount: numeric("gross_amount").notNull(), // Total order amount
  commissionAmount: numeric("commission_amount").notNull(), // Commission earned
  commissionRate: numeric("commission_rate").notNull(), // Rate at time of order
  currency: text("currency").default("YER").notNull(),
  status: text("status").default("pending").notNull(), // pending, held, released, cancelled
  holdUntil: timestamp("hold_until"), // When the hold period ends
  releasedAt: timestamp("released_at"), // When commission was released to wallet
  createdAt: timestamp("created_at").defaultNow(),
});

// Banners (Main slider)
export const banners = pgTable("banners", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  imageUrl: text("image_url").notNull(),
  linkUrl: text("link_url").default("/products"), // Deep link to category or page
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Special Offers
export const offers = pgTable("offers", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  discountPercent: integer("discount_percent").notNull(),
  imageUrl: text("image_url"),
  linkUrl: text("link_url").default("/products"), // Deep link
  bgColor: text("bg_color").default("blue"), // Color theme: blue, pink, green, purple, orange
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Navigation Settings
export const navigationSettings = pgTable("navigation_settings", {
  id: serial("id").primaryKey(),
  showPrintingSection: boolean("show_printing_section").default(true).notNull(),
  showSignupEntryPoint: boolean("show_signup_entry_point").default(true).notNull(),
  enableVariantProductPage: boolean("enable_variant_product_page").default(false).notNull(), // Master switch: SHEIN-style variant UI
  lockMobilePwaMode: boolean("lock_mobile_pwa_mode").default(true).notNull(),
  disablePinchZoom: boolean("disable_pinch_zoom").default(true).notNull(),
  disableHorizontalScroll: boolean("disable_horizontal_scroll").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Display Settings - تحكم كامل بأحجام عناصر الواجهة
export const displaySettings = pgTable("display_settings", {
  id: serial("id").primaryKey(),
  // إعدادات الأقسام
  categorySize: integer("category_size").default(72).notNull(),       // حجم صورة القسم (بكسل)
  categoriesPerRow: integer("categories_per_row").default(4).notNull(), // عدد الأقسام بالصف
  showCategories: boolean("show_categories").default(true).notNull(),
  // إعدادات المنتجات
  productCardWidth: integer("product_card_width").default(160).notNull(),  // عرض بطاقة المنتج
  productCardHeight: integer("product_card_height").default(200).notNull(), // ارتفاع صورة المنتج
  // إعدادات العروض
  offerBannerHeight: integer("offer_banner_height").default(72).notNull(), // ارتفاع بنر العروض
  showOfferBanners: boolean("show_offer_banners").default(true).notNull(),
  // إعدادات التصميم البصري الديناميكية
  productCardMargin: integer("product_card_margin").default(8).notNull(),        // الهوامش الجانبية (بكسل)
  productCardPaddingV: integer("product_card_padding_v").default(8).notNull(),   // الحشو العمودي بين العناصر
  priceFontSize: integer("price_font_size").default(16).notNull(),               // حجم خط السعر
  discountBubbleSize: integer("discount_bubble_size").default(28).notNull(),     // حجم فقاعة الخصم (0=مخفية)
  quantityButtonHeight: integer("quantity_button_height").default(40).notNull(), // ارتفاع الأزرار
  imageMode: text("image_mode").default("card").notNull(),                       // card | full-bleed
  // ── إعدادات صفحة المنتج (Product Detail Page) ──────────────────────────────
  detailImageHeight: integer("detail_image_height").default(380).notNull(),       // ارتفاع الصورة الرئيسية
  detailImageMode: text("detail_image_mode").default("contain").notNull(),        // contain | cover
  detailPriceFontSize: integer("detail_price_font_size").default(22).notNull(),   // حجم خط السعر في صفحة المنتج
  detailAddToCartHeight: integer("detail_add_to_cart_height").default(52).notNull(), // ارتفاع زر الإضافة للسلة
  detailShowRelated: boolean("detail_show_related").default(true).notNull(),      // إظهار المنتجات المشابهة
  detailShowReviews: boolean("detail_show_reviews").default(true).notNull(),      // إظهار قسم التقييمات
  detailThumbnailSize: integer("detail_thumbnail_size").default(64).notNull(),    // حجم الصور المصغرة
  // ── إعدادات الخصم ────────────────────────────────────────────────────────────
  discountBadgeBg: text("discount_badge_bg").default("#ef4444").notNull(),        // لون خلفية بادج الخصم
  showStickyCartBar: boolean("show_sticky_cart_bar").default(true).notNull(),     // إظهار شريط السلة الثابت
  // ── ضوابط التخطيط في صفحة المنتج ────────────────────────────────────────────
  detailPaddingV: integer("detail_padding_v").default(8).notNull(),               // الحشو العمودي بين العناصر (بكسل)
  detailMarginH: integer("detail_margin_h").default(16).notNull(),                // الهوامش الجانبية (بكسل)
  detailDiscountBubbleSize: integer("detail_discount_bubble_size").default(36).notNull(), // حجم فقاعة الخصم (بكسل، 0=مخفية)
  detailShowThumbnails: boolean("detail_show_thumbnails").default(true).notNull(), // إظهار الصور المصغرة
  // ── سديم الذكية — تحكم متقدم بصفحة المنتج ──────────────────────────────────
  sadeemShowOldPrice: boolean("sadeem_show_old_price").default(true).notNull(),         // السعر القديم المشطوب
  sadeemShowDiscountBadge: boolean("sadeem_show_discount_badge").default(true).notNull(), // بادج الخصم %
  sadeemShowRating: boolean("sadeem_show_rating").default(true).notNull(),               // تقييم النجوم
  sadeemShowSoldCount: boolean("sadeem_show_sold_count").default(true).notNull(),        // عدد الوحدات المباعة
  sadeemShowShipping: boolean("sadeem_show_shipping").default(true).notNull(),           // بطاقة معلومات الشحن
  sadeemShowReturns: boolean("sadeem_show_returns").default(true).notNull(),             // سياسة الإرجاع المجاني
  sadeemFreeShippingMin: integer("sadeem_free_shipping_min").default(0).notNull(),       // الحد الأدنى للشحن المجاني (0=دائماً مجاني)
  sadeemMarketerDiscount: integer("sadeem_marketer_discount").default(0).notNull(),      // خصم المسوقين الإضافي %
  // ── إعدادات البنرات والعروض (الأبعاد) ────────────────────────────────────
  sliderHeight: integer("slider_height").default(414).notNull(),                        // ارتفاع السلايدر الرئيسي (بكسل)
  offerBannerCols: integer("offer_banner_cols").default(2).notNull(),                   // عدد أعمدة العروض (1=عرض كامل، 2=نصف)
  // ── إعدادات الدفع والشحن ──────────────────────────────────────────────────
  shippingFee: integer("shipping_fee").default(0).notNull(),                            // رسوم الشحن الثابتة (0=مجاني)
  codEnabled: boolean("cod_enabled").default(true).notNull(),                           // تفعيل الدفع عند الاستلام
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── أقسام الصفحة الرئيسية الديناميكية ───────────────────────────────────────
export const homeSections = pgTable("home_sections", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  promotionalTag: text("promotional_tag").notNull().default("bestsellers"),
  // قيم مقبولة: bestsellers | new | offers | exclusive | discounts | deals | clearance | featured
  enabled: boolean("enabled").default(true).notNull(),
  priority: integer("priority").default(0).notNull(),
  itemCount: integer("item_count").default(6).notNull(),              // 4 | 6 | 8
  displayMode: text("display_mode").default("grid2").notNull(),       // grid2 | banner
  bannerHeight: integer("banner_height").default(180).notNull(),
  bannerItemWidth: integer("banner_item_width").default(160).notNull(),
  bannerPriceFontSize: integer("banner_price_font_size").default(14).notNull(),
  bannerNameFontSize: integer("banner_name_font_size").default(12).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Home Page Settings (Madeline Theme)
export const homePageSettings = pgTable("home_page_settings", {
  id: serial("id").primaryKey(),
  primaryColor: text("primary_color").default("#06B6D4").notNull(), // Oyo Plast blue
  accentColor: text("accent_color").default("#0891B2").notNull(),
  showHeader: boolean("show_header").default(true).notNull(),
  showBanners: boolean("show_banners").default(true).notNull(),
  showOffers: boolean("show_offers").default(true).notNull(),
  showCategories: boolean("show_categories").default(true).notNull(),
  footerPrivacyText: text("footer_privacy_text").default("سياسة الخصوصية").notNull(),
  footerAffiliateText: text("footer_affiliate_text").default("التسويق بالعمولة").notNull(),
  footerReturnsText: text("footer_returns_text").default("سياسة الاسترجاع").notNull(),
  footerBottomText: text("footer_bottom_text").default("أويو بلاست - مستلزمات التغليف").notNull(),
  signupEntryMode: text("signup_entry_mode").default("cart").notNull(),
  // Page content (editable from admin)
  privacyContent: text("privacy_content"),
  returnsContent: text("returns_content"),
  affiliateContent: text("affiliate_content"),
  // Login flow control
  loginFlow: text("login_flow").default("checkout").notNull(), // 'checkout' | 'cart' | 'none'
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Product Views (for AI recommendations)
export const productViews = pgTable("product_views", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id), // Nullable for guest tracking
  sessionId: text("session_id"), // For guest tracking
  productId: integer("product_id").references(() => products.id).notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  viewedAt: timestamp("viewed_at").defaultNow(),
});

// Marketer Coupons (discount codes)
export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // e.g., "AHMED5" for marketer Ahmed with 5% discount
  marketerId: varchar("marketer_id").references(() => users.id).notNull(), // Owner of the coupon
  discountPercent: integer("discount_percent").default(5).notNull(), // Customer discount (%)
  marketerCommissionPercent: integer("marketer_commission_percent").default(5).notNull(), // Marketer gets (%)
  usageCount: integer("usage_count").default(0).notNull(), // Times used
  maxUsage: integer("max_usage"), // Maximum uses (null = unlimited)
  isActive: boolean("is_active").default(true).notNull(),
  expiresAt: timestamp("expires_at"), // Expiration date (null = never)
  createdAt: timestamp("created_at").defaultNow(),
});

// Schemas
export const insertHomeSectionSchema = createInsertSchema(homeSections).omit({ id: true, createdAt: true });
export type InsertHomeSection = z.infer<typeof insertHomeSectionSchema>;
export type HomeSection = typeof homeSections.$inferSelect;

export const insertProductSchema = createInsertSchema(products).omit({ id: true });
export const insertBannerSchema = createInsertSchema(banners).omit({ id: true, createdAt: true });
export const insertOfferSchema = createInsertSchema(offers).omit({ id: true, createdAt: true });
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true });
export const insertNavigationSettingsSchema = createInsertSchema(navigationSettings).omit({ id: true, updatedAt: true });
export const insertHomePageSettingsSchema = createInsertSchema(homePageSettings).omit({ id: true, updatedAt: true });
export const insertCartItemSchema = createInsertSchema(cartItems).omit({ id: true });
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true });
export const insertOrderItemSchema = createInsertSchema(orderItems).omit({ id: true });
export const insertSettingSchema = createInsertSchema(settings).omit({ id: true });
export const insertReviewSchema = createInsertSchema(reviews).omit({ id: true, createdAt: true });
export const insertUserAddressSchema = createInsertSchema(userAddresses).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWishlistSchema = createInsertSchema(wishlist).omit({ id: true, createdAt: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export const insertWalletSchema = createInsertSchema(wallets).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWalletTransactionSchema = createInsertSchema(walletTransactions).omit({ id: true, createdAt: true });
export const insertRewardPointsSchema = createInsertSchema(rewardPoints).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPointsTransactionSchema = createInsertSchema(pointsTransactions).omit({ id: true, createdAt: true });
export const insertPhoneVerificationSchema = createInsertSchema(phoneVerifications).omit({ id: true, createdAt: true });
export const insertMarketerProfileSchema = createInsertSchema(marketerProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEndCustomerContactSchema = createInsertSchema(endCustomerContacts).omit({ id: true, createdAt: true });
export const insertMarketerCommissionSchema = createInsertSchema(marketerCommissions).omit({ id: true, createdAt: true });
export const insertCouponSchema = createInsertSchema(coupons).omit({ id: true, createdAt: true, usageCount: true });

// Types
export type Product = typeof products.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type CartItem = typeof cartItems.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Setting = typeof settings.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type WishlistItem = typeof wishlist.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Wallet = typeof wallets.$inferSelect;
export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type RewardPoints = typeof rewardPoints.$inferSelect;
export type PointsTransaction = typeof pointsTransactions.$inferSelect;
export type Banner = typeof banners.$inferSelect;
export type Offer = typeof offers.$inferSelect;
export type PhoneVerification = typeof phoneVerifications.$inferSelect;
export type MarketerProfile = typeof marketerProfiles.$inferSelect;
export type EndCustomerContact = typeof endCustomerContacts.$inferSelect;
export type MarketerCommission = typeof marketerCommissions.$inferSelect;
export type ProductView = typeof productViews.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
export type NavigationSettings = typeof navigationSettings.$inferSelect;
export type HomePageSettings = typeof homePageSettings.$inferSelect;
export type DisplaySettings = typeof displaySettings.$inferSelect;
export const insertDisplaySettingsSchema = createInsertSchema(displaySettings).omit({ id: true, updatedAt: true });
