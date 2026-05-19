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
        ADD COLUMN IF NOT EXISTS enable_volume_offers boolean NOT NULL DEFAULT false
    `);
  } catch (e) {
    console.warn("[migrate] feature-toggle columns:", (e as Error).message);
  }
})();
