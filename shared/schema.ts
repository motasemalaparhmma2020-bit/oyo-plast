import { pgTable, text, serial, integer, boolean, timestamp, numeric, varchar, jsonb } from "drizzle-orm/pg-core";
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

export const subcategories = pgTable("subcategories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  imageUrl: text("image_url").notNull().default(""),
  categoryId: integer("category_id").references(() => categories.id).notNull(),
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
  subcategoryId: integer("subcategory_id").references(() => subcategories.id), // ربط اختياري بقسم فرعي
  isActive: boolean("is_active").default(true).notNull(), // إظهار/إخفاء المنتج من المتجر
  imageUrl: text("image_url").notNull(),
  imageUrls: text("image_urls").array(), // Multiple product images (gallery)
  stock: integer("stock").default(100).notNull(),
  reorderPoint: integer("reorder_point").default(10), // حد التنبيه للمخزون المنخفض
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
  // ── Feature toggles (May 19, 2026) — كل خيار يجب تفعيله يدوياً ───────────
  showLivePreview: boolean("show_live_preview").default(false).notNull(),       // معاينة الطباعة الحية (Canvas)
  enableVolumeOffers: boolean("enable_volume_offers").default(false).notNull(), // عروض الكميات (volume_offers)
  enableQuantityTiers: boolean("enable_quantity_tiers").default(false).notNull(), // اختر الكمية (quantity_tiers) — مفتاح مستقل
  enableStudioPreview: boolean("enable_studio_preview").default(false).notNull(), // معاينة الاستوديو AI (June 2026)
  // ── حقول الخصم ──────────────────────────────────────────────────────────────
  originalPrice: numeric("original_price"),           // السعر الأصلي قبل الخصم (ر.ي)
  originalPriceSar: numeric("original_price_sar"),    // السعر الأصلي بالريال السعودي
  discountPercent: integer("discount_percent"),        // نسبة الخصم يدوياً (تتغلب على الحسابي)
  // ── التصنيفات الترويجية ─────────────────────────────────────────────────────
  promotionalTags: text("promotional_tags").array(),  // ['new','offers','exclusive','discounts','deals','clearance','featured']
  hasFreeShipping: boolean("has_free_shipping").default(false), // شحن مجاني لهذا المنتج
  productType: text("product_type").default("ready").notNull(), // 'ready' (جاهز بدون طباعة) | 'customizable' (قابل للطباعة)
  // ── المورد المسؤول عن هذا المنتج ──────────────────────────────────────────
  supplierId: integer("supplier_id"),           // المورد الافتراضي لهذا المنتج
  productCommissionRate: numeric("product_commission_rate"), // عمولة خاصة تتغلب على العمولة العامة
  // ── الطباعة الاحترافية ──────────────────────────────────────────────────────
  printingCategoryId: integer("printing_category_id"), // FK → printingCategories (طباعة احترافية)
  // ── تسعير الطباعة (Override للقيم في printingCategories، Phase 4) ────────────
  printingDesignFeeOverride: numeric("printing_design_fee_override"),     // override لرسوم التصميم
  printingColorPriceOverride: numeric("printing_color_price_override"),   // override لسعر اللون الإضافي
  printingSidePriceOverride: numeric("printing_side_price_override"),     // override لسعر الوجه الإضافي
  // ── Phase 5: منطقة الطباعة للمعاينة الفورية ──────────────────────────────
  printArea: text("print_area"),  // JSON: {x, y, width, height} كنسب مئوية 0-100 على صورة المنتج
  // ── Phase 6: تغيير لون الكيس عبر Cloudinary (المستوى ج) ─────────────────
  baseImagePublicId: text("base_image_public_id"),  // Cloudinary public_id لصورة بيضاء قابلة للتلوين
  availableColors: text("available_colors"),         // JSON: [{id,name,code}]
  // ── مدة التصنيع بالأيام ─────────────────────────────────────────────────────
  manufacturingDays: integer("manufacturing_days").default(0).notNull(), // 0 = جاهز فوراً
  // ── Phase 7: ألوان الطباعة المخصصة لكل منتج ─────────────────────────────
  printColorOptions: text("print_color_options"),  // JSON: [{name:"أبيض", hex:"#FFFFFF"}, ...]
  // ── Phase 7: العروض المتدرجة (Tiered Pricing) ──────────────────────────
  quantityTiers: text("quantity_tiers"),  // JSON: [{qty:100, totalPrice:6000, unitPrice:60}, ...]
  // ── Phase 7: حجم نافذة المعاينة بالبكسل (يتحكم به الأدمن) ──────────────
  previewSize: integer("preview_size").default(150),  // قديم — يُحتفظ به للتوافق
  previewWidth: integer("preview_width").default(200),   // عرض نافذة المعاينة (مثل: 200px لكيس 30سم عرض)
  previewHeight: integer("preview_height").default(250), // ارتفاع نافذة المعاينة (مثل: 250px لكيس 40سم ارتفاع)
});

// ── فئات الطباعة الاحترافية (لوحات / كروت / أوصق / فواتير...) ───────────────
export const printingCategories = pgTable("printing_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // "لوحات إعلانية" / "كروت شخصية" / "أوصق"
  pricePerSqMeter: numeric("price_per_sq_meter"), // سعر المتر المربع
  pricePerSqCm: numeric("price_per_sq_cm"),       // سعر السنتيمتر المربع (للطباعة الصغيرة)
  finishOptions: text("finish_options").array(),   // ["فلكس ضد الماء","فلكس عادي","مسلف","ورق"]
  colorSeparationPrice: numeric("color_separation_price"), // تكلفة فرز الألوان
  minWidthCm: numeric("min_width_cm"),   // الحد الأدنى للعرض
  minHeightCm: numeric("min_height_cm"), // الحد الأدنى للارتفاع
  // ── تسعير الطباعة الفوري (Phase 4) ───────────────────────────────────────
  designFeePerMockup: numeric("design_fee_per_mockup").default("0"),   // رسوم التصميم لكل تصميم
  colorPricePerColor: numeric("color_price_per_color").default("0"),    // سعر اللون الإضافي
  pricePerSide: numeric("price_per_side").default("0"),                 // سعر الوجه الإضافي (وجه/وجهين)
  isActive: boolean("is_active").default(true).notNull(),
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
  // ── الطباعة الاحترافية (لوحات / كروت / أوصق) ──────────────────────────────
  printingCategoryId: integer("printing_category_id"), // FK → printingCategories
  printWidth: numeric("print_width"),       // عرض اللوحة بالسنتيمتر
  printHeight: numeric("print_height"),     // ارتفاع اللوحة بالسنتيمتر
  printFinish: text("print_finish"),        // نوع التشطيب المختار
  printColorSeparation: boolean("print_color_separation").default(false), // فرز الألوان
  printingUnitPrice: numeric("printing_unit_price"), // سعر الطباعة الاحترافية لهذا العنصر
  aiDesignFee: numeric("ai_design_fee").default("0"), // رسوم التصميم المضافة من الموظف الذكي
  // ── خيارات الطباعة الفورية (Phase 4) — JSON ────────────────────────────
  designOptions: text("design_options"),
  // ── المعاينة الفورية (preview fee) — معرّف المتغيّر المختار ──
  selectedPreview: text("selected_preview"),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id), // Nullable for guest checkout
  status: text("status").notNull().default("pending"), // pending, deposit_paid, processing, shipped, delivered, completed, cancelled
  assignedTo: varchar("assigned_to").references(() => users.id),
  deliveryStatus: text("delivery_status").default("pending"), // pending, picked_up, shipped, delivered, failed
  paymentStatus: text("payment_status").default("unpaid"), // unpaid, cod_collected, transferred, partial, refunded
  statusHistory: jsonb("status_history"),
  trackingNumber: text("tracking_number"), // For shipping tracking
  expectedShippingDate: text("expected_shipping_date"), // Promised shipping date sent to customer on confirm/approve
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
  localId: text("local_id"), // مُعرّف محلي للطلبات المُنشأة أوفلاين (idempotency يمنع التكرار عند المزامنة)
  // Marketer-related fields
  marketerId: varchar("marketer_id").references(() => users.id), // Who placed the order (if marketer)
  endCustomerContactId: integer("end_customer_contact_id"), // Reference to end customer if marketer order
  isMarketerOrder: boolean("is_marketer_order").default(false), // Whether this is a marketer order
  preferredDeliveryTime: text("preferred_delivery_time"), // Preferred delivery time slot
  // ─── حقول المورد ──────────────────────────────────────────────────
  supplierId: integer("supplier_id"),          // المورد المكلّف بهذا الطلب
  supplierAmount: numeric("supplier_amount"),  // المبلغ الذي يستحقه المورد بعد العمولة
  platformCommission: numeric("platform_commission"), // عمولة المنصة
  supplierPaid: boolean("supplier_paid").default(false), // هل تم دفع المورد؟
  supplierNotified: boolean("supplier_notified").default(false), // هل أُرسل له إشعار؟
  supplierToken: text("supplier_token"),               // رمز خاص لبوابة المورد (رابط بدون تسجيل دخول)
  supplierStatus: text("supplier_status").default("pending"), // pending|accepted|shipped|delivered|cancelled
  // ─── متابعة المورد (صحة مالية 1.0) ───────────────────────────────
  supplierAssignedAt: timestamp("supplier_assigned_at"),         // وقت تعيين المورد
  supplierResponseStatus: text("supplier_response_status").default("pending"), // pending|timed_out|accepted|rejected
  triedSupplierIds: integer("tried_supplier_ids").array(),      // الموردين المجرَّبين
  supplierReassignmentCount: integer("supplier_reassignment_count").default(0), // عدد مرات إعادة التعيين
  // ─── موقع العميل (GPS) للتعيين الذكي ─────────────────────────────
  customerLat: numeric("customer_lat"),                          // خط عرض العميل
  customerLng: numeric("customer_lng"),                          // خط طول العميل
  marketerTableId: integer("marketer_table_id"),       // ID المسوق المستقل الذي جاء عبر كوبونه
  marketerCommissionAmount: numeric("marketer_commission_amount"), // مبلغ عمولة المسوق
  marketerCommissionPaid: boolean("marketer_commission_paid").default(false),
  // ─── التأكيد الهاتفي اليدوي (وضع التشغيل المجاني — بديل OTP) ──────
  adminConfirmed: boolean("admin_confirmed").default(false),  // هل تواصل الأدمن مع العميل وأكد الطلب؟
  confirmedAt: timestamp("confirmed_at"),                     // وقت التأكيد
  confirmedBy: text("confirmed_by"),                          // اسم/معرّف من أكد الطلب
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── الموردون / الموزعون ──────────────────────────────────────────────────────
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(), // رقم واتساب للإشعارات
  email: text("email"),
  cities: text("cities").array().notNull().default([]), // المدن التي يغطيها
  commissionRate: numeric("commission_rate").default("10"), // نسبة عمولة المنصة %
  balanceDue: numeric("balance_due").default("0"),    // مستحق له
  totalPaid: numeric("total_paid").default("0"),      // إجمالي ما دُفع له
  totalSales: numeric("total_sales").default("0"),    // إجمالي مبيعاته
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  telegramChatId: text("telegram_chat_id"),                    // معرّف دردشة تلجرام للمورد
  telegramLinkCode: text("telegram_link_code"),                // كود ربط مؤقت /start <code>
  // 🆕 (مايو 2026 - المرحلة 1) نوع الجهة: distributor (يوصّل للعميل) | vendor (نشتري منه البضاعة) | both
  type: text("type").default("distributor").notNull(),
  // ─── صحة مالية 1.0 ─── ملاحقات التفاعل والموقع ─────────────────────
  responseTimeoutHours: integer("response_timeout_hours").default(24), // مهلة استجابة المورد بالساعات
  missedOrdersCount: integer("missed_orders_count").default(0),      // عدد الطلبات التي فات ملاحقته
  pin: text("pin").default("1234"),                                   // باسورد بوابة المورد
  lat: numeric("lat"),                                               // خط عرض المورد
  lng: numeric("lng"),                                               // خط طول المورد
  serviceRadiusKm: numeric("service_radius_km"),                     // نطاق الخدمة بالكم
  province: text("province"),                                          // المحافظة
  district: text("district"),                                          // المديرية/القرية
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── أوامر الشراء (Purchase Orders) — المرحلة 1, مايو 2026 ─────────────────
export const purchaseOrders = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  poNumber: text("po_number").notNull().unique(),                // PO-2026-001
  supplierId: integer("supplier_id").references(() => suppliers.id),
  supplierNameSnapshot: text("supplier_name_snapshot"),           // للأرشيف إن حُذف المورد
  status: text("status").default("draft").notNull(),              // draft | sent | partial | received | cancelled
  subtotal: numeric("subtotal").default("0").notNull(),
  shippingCost: numeric("shipping_cost").default("0").notNull(),
  total: numeric("total").default("0").notNull(),
  currency: text("currency").default("YER").notNull(),            // YER | SAR
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  receivedAt: timestamp("received_at"),
});

export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: serial("id").primaryKey(),
  purchaseOrderId: integer("purchase_order_id").references(() => purchaseOrders.id, { onDelete: "cascade" }).notNull(),
  productId: integer("product_id").references(() => products.id),
  productNameSnapshot: text("product_name_snapshot"),             // للأرشيف
  variantLabel: text("variant_label"),                            // اللون/الحجم — يطابق smartVariants.variants[].label
  quantityOrdered: integer("quantity_ordered").notNull(),
  quantityReceived: integer("quantity_received").default(0).notNull(),
  unitCost: numeric("unit_cost").notNull(),                       // تكلفة الشراء للوحدة (بعملة الأمر)
  lineTotal: numeric("line_total").notNull(),                     // quantityOrdered × unitCost
});

// سجل دفعات الموردين
export const supplierPayments = pgTable("supplier_payments", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id").references(() => suppliers.id).notNull(),
  amount: numeric("amount").notNull(),
  paymentMethod: text("payment_method"),
  notes: text("notes"),
  paidAt: timestamp("paid_at").defaultNow(),
});

// سجل توريدات الموردين (تسوية — المورد يرد مبلغًا للمنصة)
export const supplierRemittances = pgTable("supplier_remittances", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id").references(() => suppliers.id).notNull(),
  amount: numeric("amount").notNull(),
  currency: text("currency").default("YER").notNull(),
  method: text("method"),                                            // طريقة التسوية
  notes: text("notes"),
  orderIds: integer("order_ids").array(),                              // أرقام الطلبات المتعلقة
  recordedBy: text("recorded_by"),                                   // من سجل التسوية
  paidAt: timestamp("paid_at").defaultNow(),
});

export const teamMembers = pgTable("team_members", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  role: text("role").notNull(),
  title: text("title"),
  isActive: boolean("is_active").default(true).notNull(),
  permissions: jsonb("permissions"),
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
  // ── الطباعة الاحترافية ──────────────────────────────────────────────────────
  printingCategoryId: integer("printing_category_id"),
  printWidth: numeric("print_width"),
  printHeight: numeric("print_height"),
  printFinish: text("print_finish"),
  printColorSeparation: boolean("print_color_separation").default(false),
  printingUnitPrice: numeric("printing_unit_price"),
  productName: text("product_name"), // اسم المنتج وقت الطلب
  productImage: text("product_image"), // صورة المنتج وقت الطلب
  // ── COGS Snapshot (Phase 1 — May 2026) ────────────────────────────────────
  costPriceAtOrder: numeric("cost_price_at_order"), // تكلفة الشراء المرجعية وقت الطلب (للأرباح التاريخية الدقيقة)
  // ── Phase 4: خيارات الطباعة الفورية — JSON ───────────────────────────────
  designOptions: text("design_options"),
});

// Product Reviews
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  rating: integer("rating").notNull(), // 1-5
  comment: text("comment"),
  imageUrl: text("image_url"), // Customer uploaded photo of the product
  isApproved: boolean("is_approved").default(false).notNull(), // موافقة الأدمن قبل النشر
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
  type: text("type").default("order").notNull(), // order_created|order_status|new_message|commission|low_stock|payment_due|wallet_credit|delivery_assigned|promo|system|order|payment
  priority: text("priority").default("normal").notNull(), // low|normal|high
  actionUrl: text("action_url"), // optional deep link
  groupKey: text("group_key"), // for grouping similar notifications
  isRead: boolean("is_read").default(false).notNull(),
  orderId: integer("order_id").references(() => orders.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Notification Preferences (per user, per type)
export const notificationPreferences = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(), // matches notification.type
  inAppEnabled: boolean("in_app_enabled").default(true).notNull(),
  telegramEnabled: boolean("telegram_enabled").default(false).notNull(),
  mutedUntil: timestamp("muted_until"), // DND - mute all until this time
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  enableVariantProductPage: boolean("enable_variant_product_page").default(false).notNull(),
  lockMobilePwaMode: boolean("lock_mobile_pwa_mode").default(true).notNull(),
  disablePinchZoom: boolean("disable_pinch_zoom").default(true).notNull(),
  disableHorizontalScroll: boolean("disable_horizontal_scroll").default(true).notNull(),
  // ── إعدادات تسجيل الدخول ─────────────────────────────────────────
  enablePhoneLogin: boolean("enable_phone_login").default(true).notNull(),
  enableEmailLogin: boolean("enable_email_login").default(true).notNull(),
  loginShowOnTop: boolean("login_show_on_top").default(false).notNull(),
  loginShowOnCheckout: boolean("login_show_on_checkout").default(true).notNull(),
  loginShowOnAccount: boolean("login_show_on_account").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Display Settings - تحكم كامل بأحجام عناصر الواجهة
export const displaySettings = pgTable("display_settings", {
  id: serial("id").primaryKey(),
  // إعدادات الأقسام
  categorySize: integer("category_size").default(72).notNull(),       // حجم صورة القسم (بكسل)
  categoriesPerRow: integer("categories_per_row").default(4).notNull(), // عدد الأقسام بالصف
  showCategories: boolean("show_categories").default(true).notNull(),
  // إعدادات صفحة الأقسام الفرعية (CategoryPage)
  subcategoryCircleSize: integer("subcategory_circle_size").default(72).notNull(),    // حجم دائرة الفئة الفرعية
  subcategoryStripHeight: integer("subcategory_strip_height").default(110).notNull(), // ارتفاع شريط الدوائر
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
  detailSectionGap: integer("detail_section_gap").default(12).notNull(),          // المسافة بين أقسام صفحة المنتج (بكسل)
  detailTopPadding: integer("detail_top_padding").default(8).notNull(),           // المسافة من أعلى المحتوى (بكسل)
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
  offerBannerShippingBg: text("offer_banner_shipping_bg"),                              // لون/تدرج خلفية بنر الشحن المجاني
  offerBannerDealsBg: text("offer_banner_deals_bg"),                                    // لون/تدرج خلفية بنر العروض السريعة
  // ── إعدادات الدفع والشحن ──────────────────────────────────────────────────
  shippingFee: integer("shipping_fee").default(0).notNull(),                            // رسوم الشحن الثابتة (0=مجاني)
  codEnabled: boolean("cod_enabled").default(true).notNull(),                           // تفعيل الدفع عند الاستلام
  // ── تخطيط الأقسام الدائرية ──────────────────────────────────────────────────
  categoriesLayout: text("categories_layout").default("scroll").notNull(),      // scroll | grid
  categoriesRows: integer("categories_rows").default(2).notNull(),              // عدد الصفوف في وضع الشبكة
  categoriesShape: text("categories_shape").default("circle").notNull(),        // circle | rounded
  categoriesBorderRadius: integer("categories_border_radius").default(12).notNull(), // انحناء الزوايا (بكسل) — يُستخدم في وضع rounded
  // ── إعدادات التقسيط ────────────────────────────────────────────────────────
  creditOptionEnabled: boolean("credit_option_enabled").default(true).notNull(),       // تفعيل خيار الائتمان (الشراء بالأجل) في صفحة الدفع
  installmentEnabled: boolean("installment_enabled").default(true).notNull(),           // تفعيل نظام التقسيط
  installmentMinAmount: integer("installment_min_amount").default(50000).notNull(),     // الحد الأدنى للطلب لتفعيل التقسيط (ريال يمني)
  installmentPercentages: text("installment_percentages").default("30,40,50").notNull(), // النسب المتاحة للمقدّم (مفصولة بفواصل)
  // ── إعدادات أقسام الصفحة الرئيسية (لماذا / إحصائيات / أسئلة) ─────────────
  pdpLayout: text("pdp_layout"),                                                 // JSON — تخطيط صفحة المنتج
  showWhyUs: boolean("show_why_us").default(true).notNull(),
  whyUsSize: text("why_us_size").default("medium").notNull(),        // small | medium | large
  whyUsOnHome: boolean("why_us_on_home").default(true).notNull(),
  whyUsOnAccount: boolean("why_us_on_account").default(false).notNull(),
  showStats: boolean("show_stats").default(true).notNull(),
  statsSize: text("stats_size").default("medium").notNull(),
  statsOnHome: boolean("stats_on_home").default(true).notNull(),
  statsOnAccount: boolean("stats_on_account").default(false).notNull(),
  showFaq: boolean("show_faq").default(true).notNull(),
  faqSize: text("faq_size").default("medium").notNull(),
  faqOnHome: boolean("faq_on_home").default(true).notNull(),
  faqOnAccount: boolean("faq_on_account").default(false).notNull(),
  // ── إعدادات قسم الشركاء في صفحة حسابي ───────────────────────────────────
  partnersOnAccount: boolean("partners_on_account").default(true).notNull(), // إظهار/إخفاء قسم الشركاء كلياً
  partnersMinOrders: integer("partners_min_orders").default(3).notNull(),    // الحد الأدنى لعدد الطلبات لرؤية القسم
  // ── الخطوط وتصميم الواجهة ────────────────────────────────────────────────
  appFontArabic: text("app_font_arabic").default("cairo"),    // cairo|tajawal|almarai|ibm-plex-arabic|noto-kufi|rubik
  appFontNumbers: text("app_font_numbers").default("cairo"),  // cairo|roboto-condensed|barlow|inter|oswald
  // ── صفحة المنتج — نمط SHEIN وأزرار السلة ──────────────────────────────
  detailSheinLayout: boolean("detail_shein_layout").default(false), // نمط SHEIN: صورة من رأس الصفحة
  detailShowAddToCart: boolean("detail_show_add_to_cart").default(true), // إظهار زر "أضف للسلة"
  detailShowShopNow: boolean("detail_show_shop_now").default(true),      // إظهار زر "تسوق الآن"
  // ── بنر عروض اليوم (Flash Sale) ──────────────────────────────────────────────
  flashSaleEnabled: boolean("flash_sale_enabled").default(true),         // إظهار بنر عروض اليوم
  flashSaleBg: text("flash_sale_bg").default("linear-gradient(135deg, #ff4e00 0%, #ec9f05 100%)"), // خلفية البنر
  flashSaleTag: text("flash_sale_tag").default("flash"),                 // وسم المنتجات المرتبطة
  // ── شريط العروض الترويجية (SHEIN-style promo bar) ──────────────────────────
  promoBarEnabled: boolean("promo_bar_enabled").default(false),          // تفعيل الشريط
  promoBarText: text("promo_bar_text").default("خصم 15%: بدون حد أدنى للشراء"),  // نص الشريط
  promoBarColor: text("promo_bar_color").default("#ef4444"),             // لون الخلفية
  promoBarDetails: text("promo_bar_details").default(""),                // تفاصيل تظهر عند الضغط
  // ── سعر كوبون المسوقين ──────────────────────────────────────────────────────
  showMarketerCouponToAll: boolean("show_marketer_coupon_to_all").default(false), // إظهار سعر الكوبون لجميع العملاء
  // ── نمط رأس صفحة المنتج ────────────────────────────────────────────────────
  detailHideHeaderName: boolean("detail_hide_header_name").default(false),        // إخفاء اسم المنتج في الشريط العلوي
  // ── زر واتساب العائم (خدمة العملاء) ────────────────────────────────────────
  whatsappNumber: text("whatsapp_number").default(""),                            // رقم واتساب خدمة العملاء
  showWhatsappButton: boolean("show_whatsapp_button").default(false),             // إظهار زر واتساب العائم
  whatsappMessage: text("whatsapp_message").default("مرحباً، أحتاج مساعدة"), // الرسالة الافتراضية
  whatsappPages: text("whatsapp_pages").default("all"),                          // all أو قائمة مسارات مفصولة بفاصلة
  // ── الأزرار العائمة — التحكم الكامل ─────────────────────────────────────────
  showAiEmployee: boolean("show_ai_employee").default(true),                      // إظهار الموظف الذكي
  aiEmployeePages: text("ai_employee_pages").default("all"),                      // all أو قائمة مسارات
  showSupportRobot: boolean("show_support_robot").default(true),                  // إظهار روبوت الدعم
  supportRobotPages: text("support_robot_pages").default("all"),                  // all أو قائمة مسارات
  showCustomerChat: boolean("show_customer_chat").default(true),                  // إظهار قسم "تواصل مع المبيعات"
  // ── منتقي الألوان في صفحة المنتج (PDP) ─────────────────────────────────────
  pdpColorThumbnailW: integer("pdp_color_thumbnail_w").default(72).notNull(),   // عرض الصورة المصغرة للون (بكسل)
  pdpColorThumbnailH: integer("pdp_color_thumbnail_h").default(72).notNull(),   // ارتفاع الصورة المصغرة للون (بكسل)
  pdpColorLayout: text("pdp_color_layout").default("scroll").notNull(),          // scroll | grid2 | grid3
  pdpColorCollapsible: boolean("pdp_color_collapsible").default(false).notNull(), // قابل للطي
  // ── منتقي المقاس في صفحة المنتج (PDP) ──────────────────────────────────────
  pdpSizeLayout: text("pdp_size_layout").default("wrap").notNull(),              // wrap | row | vertical | grid2
  pdpSizeButtonW: integer("pdp_size_button_w").default(0).notNull(),             // 0 = auto، أو عدد بكسل
  pdpSizeButtonH: integer("pdp_size_button_h").default(56).notNull(),            // ارتفاع زر المقاس (بكسل)
  pdpSizeShowPrice: boolean("pdp_size_show_price").default(true).notNull(),      // إظهار السعر مع المقاس
  pdpSizeCollapsible: boolean("pdp_size_collapsible").default(false).notNull(),   // قابل للطي
  pdpSizeStyle: text("pdp_size_style").default("card").notNull(),                // card | pill | square | full
  // ── إعدادات عرض تفاصيل المنتج — السلة ──────────────────────────────────────
  cartShowColor: boolean("cart_show_color").default(true).notNull(),          // إظهار اللون في السلة
  cartShowSize: boolean("cart_show_size").default(true).notNull(),            // إظهار المقاس في السلة
  cartShowBagColor: boolean("cart_show_bag_color").default(true).notNull(),   // إظهار لون الكيس في السلة
  cartShowPrintColors: boolean("cart_show_print_colors").default(true).notNull(), // إظهار ألوان الطباعة في السلة
  cartShowDesignFile: boolean("cart_show_design_file").default(true).notNull(),   // إظهار مؤشر ملف التصميم
  cartShowDesignNotes: boolean("cart_show_design_notes").default(true).notNull(), // إظهار ملاحظات التصميم
  cartItemMode: text("cart_item_mode").default("compact").notNull(),           // compact | collapsible
  // ── إعدادات عرض تفاصيل المنتج — صفحة الدفع ─────────────────────────────────
  checkoutShowColor: boolean("checkout_show_color").default(true).notNull(),
  checkoutShowSize: boolean("checkout_show_size").default(true).notNull(),
  checkoutShowBagColor: boolean("checkout_show_bag_color").default(true).notNull(),
  checkoutShowPrintColors: boolean("checkout_show_print_colors").default(true).notNull(),
  checkoutShowDesignFile: boolean("checkout_show_design_file").default(true).notNull(),
  checkoutShowDesignNotes: boolean("checkout_show_design_notes").default(true).notNull(),
  checkoutItemMode: text("checkout_item_mode").default("compact").notNull(),   // compact | collapsible
  // ── إعدادات عرض تفاصيل المنتج — تأكيد الطلب ────────────────────────────────
  orderShowColor: boolean("order_show_color").default(true).notNull(),
  orderShowSize: boolean("order_show_size").default(true).notNull(),
  orderShowBagColor: boolean("order_show_bag_color").default(true).notNull(),
  orderShowPrintColors: boolean("order_show_print_colors").default(true).notNull(),
  orderShowDesignFile: boolean("order_show_design_file").default(true).notNull(),
  orderShowDesignNotes: boolean("order_show_design_notes").default(true).notNull(),
  orderItemMode: text("order_item_mode").default("collapsible").notNull(),     // compact | collapsible
  // ── حملات تسويقية (يونيو 2026) ──────────────────────────────────────────────
  freeShippingFirstOrder: boolean("free_shipping_first_order").default(false).notNull(),                 // أول توصيل مجاني للعملاء الجدد
  referralEnabled: boolean("referral_enabled").default(false).notNull(),                                 // تفعيل نظام الإحالة المزدوجة
  referralFriendDiscountPercent: integer("referral_friend_discount_percent").default(15).notNull(),      // خصم الصديق على أول طلب %
  referralRewardYer: integer("referral_reward_yer").default(1000).notNull(),                             // مكافأة المُحيل (ريال يمني)
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
  // ── إعدادات التسعير الذكي (التوصيات + حماية الكوبونات) ─────────────────────
  staleProductDays: integer("stale_product_days").default(60).notNull(),          // عدد الأيام لاعتبار المنتج راكداً
  staleDiscountPercent: integer("stale_discount_percent").default(10).notNull(),   // نسبة الخصم المقترحة للمنتج الراكد
  fastSellerThreshold: integer("fast_seller_threshold").default(20).notNull(),     // عدد المبيعات في آخر 30 يوم لاعتبار المنتج سريع البيع
  fastSellerUpliftPercent: integer("fast_seller_uplift_percent").default(5).notNull(), // نسبة الزيادة المقترحة للمنتج سريع البيع
  protectMarginOnCoupons: boolean("protect_margin_on_coupons").default(true).notNull(), // رفض الكوبونات التي تأكل الربح تحت الخط الأحمر
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

// ─── الإحالة المزدوجة بين العملاء (Customer-to-Customer Referral) ─────────────
export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerUserId: varchar("referrer_user_id").references(() => users.id).notNull(), // صاحب الكود (المُحيل)
  referredUserId: varchar("referred_user_id").references(() => users.id),           // الصديق المُحال (بعد تسجيله)
  referredPhone: text("referred_phone"),                                            // هاتف الصديق (لمنع التكرار)
  status: text("status").default("pending").notNull(),                              // pending | rewarded
  rewardAmountYer: numeric("reward_amount_yer").default("0").notNull(),             // مبلغ مكافأة المُحيل
  orderId: integer("order_id").references(() => orders.id),                         // أول طلب مؤهِّل للصديق
  createdAt: timestamp("created_at").defaultNow(),
});
export type Referral = typeof referrals.$inferSelect;

// ─── جداول منظومة المسوقين المستقلين ─────────────────────────────────────────

// طلبات الانضمام (العامة — قبل الموافقة)
export const marketerApplications = pgTable("marketer_applications", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  city: text("city").notNull(),
  channel: text("channel").notNull(), // whatsapp | tiktok | instagram | youtube | other
  channelHandle: text("channel_handle"),   // @username أو رابط
  audienceSize: text("audience_size"),     // small | medium | large
  message: text("message"),
  status: text("status").default("pending").notNull(), // pending | approved | rejected
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  processedAt: timestamp("processed_at"),
});

// حسابات المسوقين المعتمدين (مصادقة هاتف + PIN)
export const standaloneMarketers = pgTable("standalone_marketers", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id"),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  city: text("city"),
  channel: text("channel"),
  channelHandle: text("channel_handle"),
  pin: text("pin").notNull().default("1234"),
  token: text("token").unique(),           // جلسة المصادقة
  couponCode: text("coupon_code").unique(), // الكوبون الرئيسي
  commissionRate: numeric("commission_rate").default("5"), // عمولة المسوق %
  discountRate: numeric("discount_rate").default("5"),     // خصم العميل %
  walletBalance: numeric("wallet_balance").default("0"),
  totalEarnings: numeric("total_earnings").default("0"),
  totalOrders: integer("total_orders").default(0),
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  contractAcceptedAt: timestamp("contract_accepted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// طلبات تسجيل الموردين الجدد (التسجيل الذاتي)
export const supplierApplications = pgTable("supplier_applications", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  ownerName: text("owner_name").notNull(),
  phone: text("phone").notNull(),
  city: text("city").notNull(),
  address: text("address"),
  businessType: text("business_type"),       // إنتاج / تجارة / استيراد / متجر
  productCategories: text("product_categories").array(),
  message: text("message"),
  documentsUrls: text("documents_urls").array(),
  contractAcceptedAt: timestamp("contract_accepted_at"),
  status: text("status").default("pending").notNull(), // pending | approved | rejected
  rejectionReason: text("rejection_reason"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// طلبات سحب الأرباح
export const marketerWithdrawalRequests = pgTable("marketer_withdrawal_requests", {
  id: serial("id").primaryKey(),
  marketerId: integer("marketer_id").notNull(), // references standaloneMarketers.id
  amount: numeric("amount").notNull(),
  paymentMethod: text("payment_method").notNull(), // bank | jawal | kash | cash
  paymentDetails: text("payment_details"),         // رقم الحساب أو تفاصيل الدفع
  status: text("status").default("pending").notNull(), // pending | approved | paid | rejected
  adminNotes: text("admin_notes"),
  requestedAt: timestamp("requested_at").defaultNow(),
  processedAt: timestamp("processed_at"),
});

// ─── جداول نظام التقسيط ───────────────────────────────────────────────────────
export const installmentPlans = pgTable("installment_plans", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id).notNull(),
  customerId: varchar("customer_id").references(() => users.id),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  planType: text("plan_type").notNull(), // deposit_cod | supplier_guaranteed
  totalAmount: numeric("total_amount").notNull(),
  depositAmount: numeric("deposit_amount").notNull(), // المقدّم
  remainingAmount: numeric("remaining_amount").notNull(), // الباقي
  depositPaid: boolean("deposit_paid").default(false),
  depositPaidAt: timestamp("deposit_paid_at"),
  depositReceiptUrl: text("deposit_receipt_url"),
  remainingPaid: boolean("remaining_paid").default(false),
  remainingPaidAt: timestamp("remaining_paid_at"),
  // كفيل المورد
  guarantorSupplierId: integer("guarantor_supplier_id"),
  guarantorSupplierName: text("guarantor_supplier_name"),
  guarantorNotes: text("guarantor_notes"),
  status: text("status").default("pending"), // pending | deposit_paid | completed | cancelled
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── جداول العقود الرقمية ──────────────────────────────────────────────────────
// نصوص العقود (يحررها الأدمن)
export const contractTexts = pgTable("contract_texts", {
  id: serial("id").primaryKey(),
  contractType: text("contract_type").notNull().unique(), // supplier | employee | marketer | terms | privacy
  title: text("title").notNull(),
  body: text("body").notNull(), // نص العقد كامل
  version: text("version").default("1.0"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// سجل قبول العقود
export const contractAcceptances = pgTable("contract_acceptances", {
  id: serial("id").primaryKey(),
  contractType: text("contract_type").notNull(), // supplier | employee | marketer | terms
  contractVersion: text("contract_version").default("1.0"),
  partyId: text("party_id").notNull(),           // user.id أو supplier.id
  partyName: text("party_name"),
  partyRole: text("party_role"),                 // supplier | employee | marketer | customer
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  acceptedAt: timestamp("accepted_at").defaultNow(),
  notes: text("notes"),
});

// ─── إعدادات الموظف الذكي (Sales AI) ──────────────────────────────────────────
export const aiSalesSettings = pgTable("ai_sales_settings", {
  id: serial("id").primaryKey(),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  personalityPrompt: text("personality_prompt").notNull(),
  strictRules: text("strict_rules").notNull(),
  discountTier1Qty: integer("discount_tier_1_qty").default(49).notNull(),
  discountTier1Percent: integer("discount_tier_1_percent").default(0).notNull(),
  discountTier2Qty: integer("discount_tier_2_qty").default(99).notNull(),
  discountTier2Percent: integer("discount_tier_2_percent").default(5).notNull(),
  discountTier3Qty: integer("discount_tier_3_qty").default(499).notNull(),
  discountTier3Percent: integer("discount_tier_3_percent").default(15).notNull(),
  discountTier4Percent: integer("discount_tier_4_percent").default(25).notNull(),
  maxDiscountOverride: integer("max_discount_override").default(30).notNull(),
  manufacturingDaysDefault: integer("manufacturing_days_default").default(3).notNull(),
  shippingNormalDays: integer("shipping_normal_days").default(4).notNull(),
  shippingFastDays: integer("shipping_fast_days").default(2).notNull(),
  shippingNormalCost: numeric("shipping_normal_cost").default("1500").notNull(),
  shippingFastCost: numeric("shipping_fast_cost").default("3000").notNull(),
  freeShippingThreshold: numeric("free_shipping_threshold").default("0").notNull(),
  temperature: numeric("temperature").default("0.6").notNull(),
  maxProductsInContext: integer("max_products_in_context").default(60).notNull(),
  allowMockupGeneration: boolean("allow_mockup_generation").default(true).notNull(),
  designFeePerMockup: numeric("design_fee_per_mockup").default("300").notNull(),
  colorPricePerColor: numeric("color_price_per_color").default("20").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export type AiSalesSettings = typeof aiSalesSettings.$inferSelect;

// ─── إعدادات وكيل المعاينة الاستوديو (AI Studio Preview) ───────────────────────
export const studioPreviewSettings = pgTable("studio_preview_settings", {
  id: serial("id").primaryKey(),
  geminiModel: text("gemini_model").default("gemini-2.0-flash-exp-image-generation").notNull(),
  firstFreeEnabled: boolean("first_free_enabled").default(true).notNull(),
  previewFeePrice: numeric("preview_fee_price").default("100").notNull(),
  previewFeeCost: numeric("preview_fee_cost").default("0").notNull(),
  maxAlternatives: integer("max_alternatives").default(3).notNull(),
  quickPreviewEnabled: boolean("quick_preview_enabled").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export type StudioPreviewSettings = typeof studioPreviewSettings.$inferSelect;

// ─── سجلّات المعاينة الاستوديو (للمراجعة والتحليل) ─────────────────────────────
export const studioPreviewLogs = pgTable("studio_preview_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  productId: integer("product_id"),
  productName: text("product_name"),
  logoUrl: text("logo_url"),
  productImageUrl: text("product_image_url"),
  bagColor: text("bag_color"),
  printColor: text("print_color"),
  textContent: text("text_content"),
  businessType: text("business_type"),
  generatedImageUrl: text("generated_image_url"),
  alternatives: text("alternatives"), // JSON array of URLs
  isQuickPreview: boolean("is_quick_preview").default(false).notNull(),
  modelUsed: text("model_used"),
  generationTimeMs: integer("generation_time_ms"),
  status: text("status").default("success").notNull(), // success | failed | cached
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});
export type StudioPreviewLog = typeof studioPreviewLogs.$inferSelect;

// ─── سجل محادثات الموظف الذكي ─────────────────────────────────────────────────
export const aiConversations = pgTable("ai_conversations", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  productId: integer("product_id"),
  messages: text("messages").notNull(),
  orderId: integer("order_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── جدول النسخ الاحتياطية ────────────────────────────────────────────────────
export const backupLogs = pgTable("backup_logs", {
  id: serial("id").primaryKey(),
  triggeredBy: text("triggered_by").default("admin"),
  sizeBytes: integer("size_bytes"),
  tablesCount: integer("tables_count"),
  status: text("status").default("success"), // success | failed
  notes: text("notes"),
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
export const insertSubcategorySchema = createInsertSchema(subcategories).omit({ id: true });
export type InsertSubcategory = z.infer<typeof insertSubcategorySchema>;
export type Subcategory = typeof subcategories.$inferSelect;
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
export const insertMarketerApplicationSchema = createInsertSchema(marketerApplications).omit({ id: true, createdAt: true, processedAt: true, status: true });
export const insertSupplierApplicationSchema = createInsertSchema(supplierApplications).omit({ id: true, createdAt: true, processedAt: true, status: true });
export const insertStandaloneMarketerSchema = createInsertSchema(standaloneMarketers).omit({ id: true, createdAt: true, token: true });
export const insertMarketerWithdrawalSchema = createInsertSchema(marketerWithdrawalRequests).omit({ id: true, requestedAt: true, processedAt: true, status: true, adminNotes: true });
export const insertInstallmentPlanSchema = createInsertSchema(installmentPlans).omit({ id: true, createdAt: true });
export type InstallmentPlan = typeof installmentPlans.$inferSelect;

// ── Smart Pricing System ────────────────────────────────────────────────────

// التكاليف التشغيلية الشهرية (رواتب، إيجار، تسويق، لوجستيات...)
export const operationalCosts = pgTable("operational_costs", {
  id: serial("id").primaryKey(),
  month: varchar("month", { length: 7 }).notNull().unique(),   // "2025-04"
  salaries: numeric("salaries").default("0").notNull(),
  rent: numeric("rent").default("0").notNull(),
  marketing: numeric("marketing").default("0").notNull(),
  logistics: numeric("logistics").default("0").notNull(),
  other: numeric("other").default("0").notNull(),
  totalOrders: integer("total_orders").default(0).notNull(),   // عدد الطلبات في الشهر
  costPerOrder: numeric("cost_per_order").default("0"),        // يُحسب تلقائياً
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// تكاليف كل منتج مع خطوط الحماية المحسوبة
export const productCosts = pgTable("product_costs", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).notNull().unique(),
  purchasePrice: numeric("purchase_price").default("0").notNull(),     // تكلفة الشراء
  inlandShipping: numeric("inland_shipping").default("0").notNull(),   // شحن داخلي
  storageCost: numeric("storage_cost").default("0").notNull(),         // تكلفة تخزين
  operationalShare: numeric("operational_share").default("0"),         // حصة التشغيل (محسوبة)
  redLinePrice: numeric("red_line_price").default("0"),                // الحد الأحمر (محسوب)
  greenLinePrice: numeric("green_line_price").default("0"),            // الحد الأخضر (محسوب)
  suggestedPrice: numeric("suggested_price").default("0"),             // السعر المقترح (محسوب)
  targetMarginPercent: numeric("target_margin_percent").default("30"), // هامش الهدف %
  safetyMarginPercent: numeric("safety_margin_percent").default("15"), // هامش الأمان الأدنى %
  notes: text("notes"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Attendance (سجلات الحضور والانصراف) ──────────────────────────────────
export const attendance = pgTable("attendance", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  checkIn: timestamp("check_in").notNull(),
  checkOut: timestamp("check_out"),
  totalMinutes: integer("total_minutes"),
  date: text("date").notNull(), // YYYY-MM-DD
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Business Expenses (المصاريف التشغيلية) ────────────────────────────────
export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // salary / rent / marketing / maintenance / utilities / depreciation / other
  description: text("description").notNull(),
  amount: numeric("amount").notNull(),
  currency: text("currency").default("YER").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  isRecurring: boolean("is_recurring").default(false),
  recurringDay: integer("recurring_day"),
  addedBy: varchar("added_by").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Fixed Assets (الأصول الثابتة + الاهلاكات) ─────────────────────────────
export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  originalValue: numeric("original_value").notNull(),
  purchaseDate: text("purchase_date").notNull(), // YYYY-MM-DD
  usefulLifeMonths: integer("useful_life_months").notNull(),
  notes: text("notes"),
  addedBy: varchar("added_by").references(() => users.id),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Staff Rate Config (إعداد الأجور لكل دور) ──────────────────────────────
export const staffRateConfig = pgTable("staff_rate_config", {
  id: serial("id").primaryKey(),
  role: text("role").notNull().unique(),
  baseSalary: numeric("base_salary").default("0").notNull(),
  ratePerOrder: numeric("rate_per_order").default("0").notNull(),
  paymentModel: text("payment_model").default("fixed").notNull(), // fixed / per_order / hybrid
  overtimeRatePerHour: numeric("overtime_rate_per_hour").default("0").notNull(),
  workingDaysPerMonth: integer("working_days_per_month").default(26).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Payroll Periods (كشوف الرواتب الشهرية) ────────────────────────────────
export const payrollPeriods = pgTable("payroll_periods", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  period: text("period").notNull(), // YYYY-MM
  baseSalary: numeric("base_salary").default("0").notNull(),
  ordersCompleted: integer("orders_completed").default(0).notNull(),
  orderBonus: numeric("order_bonus").default("0").notNull(),
  attendanceDays: integer("attendance_days").default(0).notNull(),
  absenceDays: integer("absence_days").default(0).notNull(),
  deductions: numeric("deductions").default("0").notNull(),
  bonuses: numeric("bonuses").default("0").notNull(),
  totalPay: numeric("total_pay").notNull(),
  isPaid: boolean("is_paid").default(false).notNull(),
  paidAt: timestamp("paid_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAttendanceSchema = createInsertSchema(attendance).omit({ id: true, createdAt: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, createdAt: true });
export const insertAssetSchema = createInsertSchema(assets).omit({ id: true, createdAt: true });
export type AttendanceRecord = typeof attendance.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type StaffRateConfig = typeof staffRateConfig.$inferSelect;
export type PayrollPeriod = typeof payrollPeriods.$inferSelect;

export const insertOperationalCostSchema = createInsertSchema(operationalCosts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProductCostSchema = createInsertSchema(productCosts).omit({ id: true, updatedAt: true });
export type OperationalCost = typeof operationalCosts.$inferSelect;
export type ProductCost = typeof productCosts.$inferSelect;

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
export type Supplier = typeof suppliers.$inferSelect;
export type SupplierPayment = typeof supplierPayments.$inferSelect;
export type SupplierRemittance = typeof supplierRemittances.$inferSelect;
export const insertNotificationPreferenceSchema = createInsertSchema(notificationPreferences).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertNotificationPreference = z.infer<typeof insertNotificationPreferenceSchema>;
export type NotificationPreference = typeof notificationPreferences.$inferSelect;
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
export type MarketerApplication = typeof marketerApplications.$inferSelect;
export type SupplierApplication = typeof supplierApplications.$inferSelect;
export type InsertSupplierApplication = z.infer<typeof insertSupplierApplicationSchema>;
export type StandaloneMarketer = typeof standaloneMarketers.$inferSelect;
export type MarketerWithdrawalRequest = typeof marketerWithdrawalRequests.$inferSelect;
export type NavigationSettings = typeof navigationSettings.$inferSelect;
export type HomePageSettings = typeof homePageSettings.$inferSelect;
export type DisplaySettings = typeof displaySettings.$inferSelect;
export const insertDisplaySettingsSchema = createInsertSchema(displaySettings).omit({ id: true, updatedAt: true });

// ── فئات الطباعة الاحترافية ──────────────────────────────────────────────────
export type PrintingCategory = typeof printingCategories.$inferSelect;
export const insertPrintingCategorySchema = createInsertSchema(printingCategories).omit({ id: true });
export type InsertPrintingCategory = z.infer<typeof insertPrintingCategorySchema>;

// ═══════════════════════════════════════════════════════════════════════════
// نظام الرسائل الموحّد — محادثات (عملاء/موردين/داخلي) + رسائل فردية
// ═══════════════════════════════════════════════════════════════════════════

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),                                  // 'customer' | 'supplier' | 'internal'
  subject: text("subject"),                                      // عنوان اختياري
  // أطراف المحادثة (واحد منها فقط حسب النوع)
  customerPhone: text("customer_phone"),                         // للعملاء
  customerName: text("customer_name"),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  // ربط بطلب أو منتج (اختياري)
  relatedOrderId: integer("related_order_id"),
  relatedProductId: integer("related_product_id"),
  // حالة وعدّادات
  status: text("status").default("open").notNull(),              // 'open' | 'closed' | 'archived'
  unreadAdmin: integer("unread_admin").default(0).notNull(),
  unreadParticipant: integer("unread_participant").default(0).notNull(),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  lastMessagePreview: text("last_message_preview"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => conversations.id).notNull(),
  senderType: text("sender_type").notNull(),                     // 'admin' | 'customer' | 'supplier' | 'system' | 'bot'
  senderName: text("sender_name"),
  content: text("content").notNull(),
  attachments: jsonb("attachments"),                             // [{ url, name, type }]
  channel: text("channel").default("web").notNull(),             // 'web' | 'telegram' | 'sms'
  deliveryStatus: text("delivery_status").default("sent").notNull(), // 'sent' | 'delivered' | 'read' | 'failed'
  metadata: jsonb("metadata"),                                   // معرفات تلجرام مثلاً
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── الشراء الجماعي (اشتر مع صديق) ──────────────────────────────────────────
export const groupBuySessions = pgTable("group_buy_sessions", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id),
  productName: text("product_name").notNull(),
  productImage: text("product_image"),
  creatorId: varchar("creator_id").references(() => users.id),
  creatorName: text("creator_name").notNull(),
  creatorPhone: text("creator_phone"),
  targetCount: integer("target_count").notNull().default(5),
  currentCount: integer("current_count").notNull().default(1),
  discountPercent: integer("discount_percent").notNull().default(15),
  basePrice: numeric("base_price").notNull(),
  currency: text("currency").default("YER").notNull(),
  shareToken: text("share_token").notNull().unique(),
  status: text("status").default("open").notNull(), // open|filled|expired|cancelled
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const groupBuyParticipants = pgTable("group_buy_participants", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => groupBuySessions.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  name: text("name").notNull(),
  phone: text("phone"),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export type GroupBuySession = typeof groupBuySessions.$inferSelect;
export type GroupBuyParticipant = typeof groupBuyParticipants.$inferSelect;
export const insertGroupBuySessionSchema = createInsertSchema(groupBuySessions).omit({ id: true, createdAt: true, shareToken: true, currentCount: true });

export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export const insertConversationSchema = createInsertSchema(conversations).omit({ id: true, createdAt: true, lastMessageAt: true, unreadAdmin: true, unreadParticipant: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

// ─── جدول العقود الرقمية (مسوقين، موردين، موظفين) ──────────────────────────
export const digitalContracts = pgTable("digital_contracts", {
  id: serial("id").primaryKey(),
  contractType: text("contract_type").notNull(), // marketer | supplier | staff | other
  partyId: text("party_id").notNull(),           // ID المسوق/المورد/الموظف
  partyName: text("party_name").notNull(),
  partyPhone: text("party_phone"),
  contractTitle: text("contract_title").notNull(),
  contractText: text("contract_text").notNull(),
  status: text("status").default("pending").notNull(), // pending | accepted | rejected | expired
  acceptedAt: timestamp("accepted_at"),
  acceptedIp: text("accepted_ip"),
  adminSignedAt: timestamp("admin_signed_at"),
  adminNotes: text("admin_notes"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type DigitalContract = typeof digitalContracts.$inferSelect;
export const insertDigitalContractSchema = createInsertSchema(digitalContracts).omit({ id: true, createdAt: true, acceptedAt: true, adminSignedAt: true });

// ════════════════════════════════════════════════════════════════════════════════
// ═══ نظام الائتمان والفئات (المرحلة 1) ════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════════

// ── إعدادات الفئات الأربع — يتحكم بها الأدمن يدوياً من لوحة التحكم ──────────
export const customerCreditTiers = pgTable("customer_credit_tiers", {
  id: serial("id").primaryKey(),
  tierKey: text("tier_key").notNull().unique(),     // vip | silver | bronze | blocked
  tierNameAr: text("tier_name_ar").notNull(),       // VIP | فضي | برونزي | محظور
  tierIcon: text("tier_icon").default(""),          // emoji أو رمز
  tierColor: text("tier_color").default("#6b7280"), // لون البادج في الواجهة
  // ── الحدود المالية ──
  creditLimit: numeric("credit_limit").notNull().default("0"),                  // السقف الائتماني (ر.ي)
  paymentTermDays: integer("payment_term_days").notNull().default(0),           // مدة السداد بالأيام
  downPaymentPercent: numeric("down_payment_percent").notNull().default("100"), // % الدفعة المقدمة
  cashDiscountPercent: numeric("cash_discount_percent").notNull().default("0"), // % خصم الكاش
  // ── شروط الترقية والتخفيض ──
  minOrdersToReach: integer("min_orders_to_reach").default(0),     // أقل عدد طلبات للوصول
  minMonthsToReach: integer("min_months_to_reach").default(0),     // أقل عدد أشهر للوصول
  maxLateDaysAllowed: integer("max_late_days_allowed").default(0), // أقصى تأخير قبل التخفيض
  // ── العرض ──
  description: text("description"),       // وصف الفئة
  benefits: text("benefits").array(),     // قائمة المزايا (للعرض في "حسابي")
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── سجل ائتمان كل عميل ───────────────────────────────────────────────────────
export const customerCredit = pgTable("customer_credit", {
  id: serial("id").primaryKey(),
  customerId: varchar("customer_id").references(() => users.id).notNull().unique(),
  tier: text("tier").notNull().default("bronze"), // vip | silver | bronze | blocked
  // ── التجاوز اليدوي (تتحكم به أنت من الأدمن) ──
  manualOverride: boolean("manual_override").default(false).notNull(),
  creditLimitOverride: numeric("credit_limit_override"),     // سقف خاص يتجاوز الفئة
  discountOverride: numeric("discount_override"),            // خصم خاص دائم %
  paymentTermOverride: integer("payment_term_override"),     // مدة سداد خاصة بالأيام
  downPaymentOverride: numeric("down_payment_override"),     // دفعة مقدمة خاصة %
  // ── الرصيد المالي ──
  openingBalance: numeric("opening_balance").default("0").notNull(), // الرصيد الافتتاحي (ديون من النظام القديم)
  currentBalance: numeric("current_balance").default("0").notNull(), // إجمالي الديون الحالية
  // ── إحصائيات السلوك ──
  totalOrders: integer("total_orders").default(0).notNull(),
  totalPaidAmount: numeric("total_paid_amount").default("0").notNull(),
  onTimePayments: integer("on_time_payments").default(0).notNull(),
  latePayments: integer("late_payments").default(0).notNull(),
  maxLateDays: integer("max_late_days").default(0).notNull(),
  lastOrderAt: timestamp("last_order_at"),
  lastPaymentAt: timestamp("last_payment_at"),
  // ── التجميد ──
  isFrozen: boolean("is_frozen").default(false).notNull(),
  frozenUntil: timestamp("frozen_until"),
  frozenReason: text("frozen_reason"),
  // ── ملاحظات الأدمن ──
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── قواعد التسعير الخاصة لكل منتج (اختيارية — تتجاوز الافتراضي) ─────────────
export const productPricingRules = pgTable("product_pricing_rules", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).notNull().unique(),
  // ── حماية الربح ──
  minProfitAmount: numeric("min_profit_amount"),       // الحد الأدنى للربح بالريال
  maxDiscountPercent: numeric("max_discount_percent"), // أقصى خصم مسموح %
  // ── ضوابط الأجل ──
  creditEligible: boolean("credit_eligible").default(true).notNull(), // هل متاح أجل؟
  allowedTiers: text("allowed_tiers").array(),         // ['vip','silver'] - الفئات المسموح لها بالأجل
  // ── ملاحظة للزبون ──
  noteForCustomer: text("note_for_customer"),          // مثلاً "سعر ثابت — كاش فقط"
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── سجل الأحداث الأمنية (Rate limit, brute force, hijack attempts) ──────────
// مرجعي لجميع التنبيهات الحرجة + لوحة الأمان في لوحة التحكم
export const securityLogs = pgTable("security_logs", {
  id: serial("id").primaryKey(),
  eventType: varchar("event_type", { length: 100 }).notNull(),  // brute_force_attempt, rate_limit_admin, etc.
  ipAddress: varchar("ip_address", { length: 50 }).notNull(),
  path: varchar("path", { length: 500 }).notNull(),
  method: varchar("method", { length: 20 }).notNull(),
  userAgent: text("user_agent"),
  details: text("details"),
  severity: varchar("severity", { length: 20 }).notNull().default("info"),  // info | warning | critical
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── سجل تغيير فئة العميل (للتدقيق والتاريخ) ──────────────────────────────────
export const customerTierHistory = pgTable("customer_tier_history", {
  id: serial("id").primaryKey(),
  customerId: varchar("customer_id").references(() => users.id).notNull(),
  fromTier: text("from_tier"),
  toTier: text("to_tier").notNull(),
  reason: text("reason"),                // automatic | manual_admin | promotion | downgrade | freeze | unfreeze
  changedBy: text("changed_by"),         // admin user id أو 'system'
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Insert schemas + Types ──
export const insertCustomerCreditTierSchema = createInsertSchema(customerCreditTiers).omit({ id: true, updatedAt: true });
export type InsertCustomerCreditTier = z.infer<typeof insertCustomerCreditTierSchema>;
export type CustomerCreditTier = typeof customerCreditTiers.$inferSelect;

export const insertCustomerCreditSchema = createInsertSchema(customerCredit).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCustomerCredit = z.infer<typeof insertCustomerCreditSchema>;
export type CustomerCredit = typeof customerCredit.$inferSelect;

export const insertProductPricingRuleSchema = createInsertSchema(productPricingRules).omit({ id: true, updatedAt: true });
export type InsertProductPricingRule = z.infer<typeof insertProductPricingRuleSchema>;
export type ProductPricingRule = typeof productPricingRules.$inferSelect;

export const insertCustomerTierHistorySchema = createInsertSchema(customerTierHistory).omit({ id: true, createdAt: true });
export type InsertCustomerTierHistory = z.infer<typeof insertCustomerTierHistorySchema>;
export type CustomerTierHistory = typeof customerTierHistory.$inferSelect;

// ─── Purchase Orders (المرحلة 1, مايو 2026) ──────────────────────────────
export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders).omit({
  id: true, poNumber: true, createdAt: true, receivedAt: true,
});
export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;

export const insertPurchaseOrderItemSchema = createInsertSchema(purchaseOrderItems).omit({
  id: true, quantityReceived: true,
});
export type InsertPurchaseOrderItem = z.infer<typeof insertPurchaseOrderItemSchema>;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;

// ─── Volume Offers — العروض التحفيزية حسب الكمية (May 17, 2026) ──────────
// نموذج tiered volume pricing معتمد عالمياً (Vistaprint/CustomInk/Alibaba):
// سعر العرض شامل (يلغي smart variants + الطباعة + التصميم). يُطبَّق على
// السلة عندما تقع الكمية ضمن min/max للعرض. الشحن مدمج (مجاني أو رمزي).
export const productVolumeOffers = pgTable("product_volume_offers", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  minQuantity: integer("min_quantity").notNull(),
  maxQuantity: integer("max_quantity"), // null = لا حد أعلى
  offerPriceYer: numeric("offer_price_yer").notNull(), // السعر الشامل لكل قطعة
  originalPriceYer: numeric("original_price_yer"), // للـ Anchor (مشطوب) — اختياري
  displayLabel: text("display_label"),  // "عرض 100 كيس"
  badgeText: text("badge_text"),        // "الأكثر طلباً" / "أفضل قيمة"
  hasFreeShipping: boolean("has_free_shipping").default(false).notNull(),
  shippingFeeYer: numeric("shipping_fee_yer").default("0").notNull(),
  marketerCommissionPercent: numeric("marketer_commission_percent"), // null = استخدم عمولة المنتج
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertProductVolumeOfferSchema = createInsertSchema(productVolumeOffers).omit({ id: true, createdAt: true });
export type InsertProductVolumeOffer = z.infer<typeof insertProductVolumeOfferSchema>;
export type ProductVolumeOffer = typeof productVolumeOffers.$inferSelect;
