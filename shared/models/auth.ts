import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  passwordHash: varchar("password_hash"), // كلمة المرور المشفرة (للتسجيل بالبريد الإلكتروني)
  authProvider: varchar("auth_provider").default("email"), // email أو replit
  isEmailVerified: varchar("is_email_verified").default("false"), // هل تم التحقق من البريد
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  fullName: varchar("full_name"), // الاسم الكامل
  profileImageUrl: varchar("profile_image_url"),
  phone: varchar("phone"), // رقم الجوال اليمني
  // Address fields
  country: varchar("country").default("اليمن"),
  governorate: varchar("governorate"), // المحافظة
  district: varchar("district"), // المديرية
  city: varchar("city"), // المدينة
  neighborhood: varchar("neighborhood"), // المنطقة أو الحي
  street: varchar("street"), // الشارع
  landmark: varchar("landmark"), // بجوار/أمام/بجانب
  businessType: varchar("business_type"), // نوع النشاط التجاري: مصنع، مطعم، محل تجاري، جهة حكومية، أخرى
  businessName: varchar("business_name"), // اسم المنشأة (مثلاً: مطعم الأصيل) — منفصل عن اسم العميل
  gpsLatitude: varchar("gps_latitude"), // خط العرض من GPS
  gpsLongitude: varchar("gps_longitude"), // خط الطول من GPS
  onboardingCompleted: varchar("onboarding_completed").default("false"), // هل أكمل العميل خطوات التسجيل التفصيلية
  accountType: varchar("account_type").default("customer"), // customer أو marketer
  role: varchar("role").default("customer"), // owner, product_manager, order_manager, delivery, finance, customer
  permissions: jsonb("permissions"),
  isPhoneVerified: varchar("is_phone_verified").default("false"),
  referralCode: varchar("referral_code"),       // كود الإحالة الخاص بالعميل (يُولَّد عند الطلب)
  referredByCode: varchar("referred_by_code"),  // الكود الذي أحال هذا العميل
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
