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
})();
