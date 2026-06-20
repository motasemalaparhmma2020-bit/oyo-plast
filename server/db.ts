import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure connection pool with timeouts to prevent hanging during deployment
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Connection pool settings
  max: 20, // max connections in pool
  idleTimeoutMillis: 30000, // 30 seconds idle timeout
  connectionTimeoutMillis: 10000, // 10 second connection timeout
  // Enable keep-alive to detect stale connections
  application_name: 'oyoplast-app',
});

// Log pool errors without blocking
pool.on('error', (err) => {
  console.warn("Unexpected error on idle client:", err);
});

export const db = drizzle(pool, { schema });

// ── Auto-migrate: ensure feature-toggle columns exist (May 19, 2026) ──
(async () => {
  try {
    await pool.query(`
      ALTER TABLE products
        ADD COLUMN IF NOT EXISTS show_live_preview boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS enable_volume_offers boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS enable_quantity_tiers boolean NOT NULL DEFAULT false
    `);
  } catch (e) {
    console.warn("[migrate] feature-toggle columns:", (e as Error).message);
  }

  // ── Auto-migrate: credit option toggle on display settings (June 2026) ──
  try {
    await pool.query(`
      ALTER TABLE display_settings
        ADD COLUMN IF NOT EXISTS credit_option_enabled boolean NOT NULL DEFAULT true
    `);
  } catch (e) {
    console.warn("[migrate] credit_option_enabled column:", (e as Error).message);
  }

  // ── Auto-migrate: account deletion requests table (June 2026) ──
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS account_deletion_requests (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255),
        phone VARCHAR(50),
        data_types TEXT,
        reason TEXT,
        request_type VARCHAR(20) NOT NULL DEFAULT 'account',
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        ip_address VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch (e) {
    console.warn("[migrate] account_deletion_requests:", (e as Error).message);
  }

  // ── Auto-migrate: صحة مالية 1.0 ──
  // أعمدة حقول المورد في الطلبات
  try {
    await pool.query(`
      ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS supplier_assigned_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS supplier_response_status VARCHAR(20) NOT NULL DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS tried_supplier_ids INTEGER[],
        ADD COLUMN IF NOT EXISTS supplier_reassignment_count INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS customer_lat NUMERIC,
        ADD COLUMN IF NOT EXISTS customer_lng NUMERIC
    `);
  } catch (e) {
    console.warn("[migrate] orders supplier columns:", (e as Error).message);
  }

  // ── Auto-migrate: مُعرّف الطلب المحلي (idempotency للطلبات الأوفلاين) ──
  // فهرس فريد جزئي يمنع إنشاء نسخة مكررة لنفس الطلب عند مزامنته من وضع عدم الاتصال.
  try {
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS local_id TEXT`);
    await pool.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS orders_local_id_unique ON orders (local_id) WHERE local_id IS NOT NULL`,
    );
  } catch (e) {
    console.warn("[migrate] orders local_id:", (e as Error).message);
  }

  // أعمدة حقول التفاعل في الموردين
  try {
    await pool.query(`
      ALTER TABLE suppliers
        ADD COLUMN IF NOT EXISTS response_timeout_hours INTEGER DEFAULT 24,
        ADD COLUMN IF NOT EXISTS missed_orders_count INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS pin TEXT DEFAULT '1234',
        ADD COLUMN IF NOT EXISTS lat NUMERIC,
        ADD COLUMN IF NOT EXISTS lng NUMERIC,
        ADD COLUMN IF NOT EXISTS service_radius_km NUMERIC,
        ADD COLUMN IF NOT EXISTS province TEXT,
        ADD COLUMN IF NOT EXISTS district TEXT
    `);
  } catch (e) {
    console.warn("[migrate] suppliers interaction columns:", (e as Error).message);
  }

  // جدول توريدات الموردين
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS supplier_remittances (
        id SERIAL PRIMARY KEY,
        supplier_id INTEGER REFERENCES suppliers(id) NOT NULL,
        amount NUMERIC NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'YER',
        method TEXT,
        notes TEXT,
        order_ids INTEGER[],
        recorded_by TEXT,
        paid_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch (e) {
    console.warn("[migrate] supplier_remittances:", (e as Error).message);
  }

  // ── Auto-migrate: عمود enable_studio_preview في جدول المنتجات (June 2026) ──
  try {
    await pool.query(`
      ALTER TABLE products
        ADD COLUMN IF NOT EXISTS enable_studio_preview boolean NOT NULL DEFAULT false
    `);
  } catch (e) {
    console.warn("[migrate] enable_studio_preview column:", (e as Error).message);
  }

  // ── Auto-migrate: جداول وكيل معاينة الاستوديو AI (June 2026) ──
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS studio_preview_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        gemini_model VARCHAR(100) NOT NULL DEFAULT 'gemini-2.0-flash-exp-image-generation',
        first_free_enabled BOOLEAN NOT NULL DEFAULT true,
        preview_fee_price NUMERIC NOT NULL DEFAULT 100,
        preview_fee_cost NUMERIC NOT NULL DEFAULT 0,
        max_alternatives INTEGER NOT NULL DEFAULT 3,
        quick_preview_enabled BOOLEAN NOT NULL DEFAULT true,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      INSERT INTO studio_preview_settings (id) VALUES (1)
      ON CONFLICT (id) DO NOTHING
    `);
  } catch (e) {
    console.warn("[migrate] studio_preview_settings:", (e as Error).message);
  }

  // ── Auto-migrate: selected_preview column in cart_items ──
  try {
    await pool.query(`
      ALTER TABLE cart_items
        ADD COLUMN IF NOT EXISTS selected_preview TEXT
    `);
  } catch (e) {
    console.warn("[migrate] cart_items.selected_preview:", (e as Error).message);
  }

  // ── Auto-migrate: app_config + push_subscriptions (June 2026) ──
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_config (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id          SERIAL PRIMARY KEY,
        user_id     TEXT NOT NULL,
        endpoint    TEXT NOT NULL UNIQUE,
        auth_key    TEXT NOT NULL,
        p256dh_key  TEXT NOT NULL,
        created_at  TIMESTAMP DEFAULT NOW(),
        updated_at  TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions (user_id);
    `);
  } catch (e) {
    console.warn("[migrate] app_config/push_subscriptions:", (e as Error).message);
  }

  // ── Auto-migrate: home_page_settings missing columns (June 2026) ──
  try {
    await pool.query(`
      ALTER TABLE home_page_settings
        ADD COLUMN IF NOT EXISTS stale_product_days INTEGER NOT NULL DEFAULT 60,
        ADD COLUMN IF NOT EXISTS stale_discount_percent INTEGER NOT NULL DEFAULT 10,
        ADD COLUMN IF NOT EXISTS fast_seller_threshold INTEGER NOT NULL DEFAULT 20,
        ADD COLUMN IF NOT EXISTS fast_seller_uplift_percent INTEGER NOT NULL DEFAULT 5,
        ADD COLUMN IF NOT EXISTS protect_margin_on_coupons BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS privacy_content TEXT,
        ADD COLUMN IF NOT EXISTS returns_content TEXT,
        ADD COLUMN IF NOT EXISTS affiliate_content TEXT
    `);
  } catch (e) {
    console.warn("[migrate] home_page_settings extra cols:", (e as Error).message);
  }

  // ── Auto-migrate: suppliers token columns ──
  try {
    await pool.query(`
      ALTER TABLE suppliers
        ADD COLUMN IF NOT EXISTS token TEXT,
        ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP
    `);
  } catch (e) {
    console.warn("[migrate] suppliers token cols:", (e as Error).message);
  }

  // ── Auto-migrate: standalone_marketers token + channel_handle ──
  try {
    await pool.query(`
      ALTER TABLE standalone_marketers
        ADD COLUMN IF NOT EXISTS token TEXT,
        ADD COLUMN IF NOT EXISTS channel_handle TEXT,
        ADD COLUMN IF NOT EXISTS notes TEXT,
        ADD COLUMN IF NOT EXISTS contract_accepted_at TIMESTAMP
    `);
  } catch (e) {
    console.warn("[migrate] standalone_marketers extra cols:", (e as Error).message);
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS studio_preview_logs (
        id SERIAL PRIMARY KEY,
        user_id TEXT,
        product_id INTEGER,
        product_name TEXT,
        logo_url TEXT,
        product_image_url TEXT,
        bag_color VARCHAR(30),
        print_color VARCHAR(30),
        text_content TEXT,
        business_type VARCHAR(100),
        generated_image_url TEXT,
        alternatives TEXT,
        is_quick_preview BOOLEAN NOT NULL DEFAULT false,
        model_used VARCHAR(100),
        generation_time_ms INTEGER,
        status VARCHAR(20) NOT NULL DEFAULT 'success',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch (e) {
    console.warn("[migrate] studio_preview_logs:", (e as Error).message);
  }
})();
