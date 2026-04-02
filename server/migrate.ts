import { pool } from "./db";

/**
 * Runs lightweight runtime migrations using raw SQL.
 * Only adds missing tables/columns — never destructive.
 * This runs at application startup instead of build time.
 */
export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log("[INFO] Running database migrations...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS display_settings (
        id SERIAL PRIMARY KEY,
        category_size INTEGER NOT NULL DEFAULT 72,
        categories_per_row INTEGER NOT NULL DEFAULT 4,
        show_categories BOOLEAN NOT NULL DEFAULT true,
        product_card_width INTEGER NOT NULL DEFAULT 160,
        product_card_height INTEGER NOT NULL DEFAULT 200,
        offer_banner_height INTEGER NOT NULL DEFAULT 72,
        show_offer_banners BOOLEAN NOT NULL DEFAULT true,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS navigation_settings (
        id SERIAL PRIMARY KEY,
        show_printing_section BOOLEAN NOT NULL DEFAULT true,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS home_page_settings (
        id SERIAL PRIMARY KEY,
        primary_color VARCHAR(7) NOT NULL DEFAULT '#06B6D4',
        accent_color VARCHAR(7) NOT NULL DEFAULT '#0891B2',
        show_header BOOLEAN NOT NULL DEFAULT true,
        show_banners BOOLEAN NOT NULL DEFAULT true,
        show_offers BOOLEAN NOT NULL DEFAULT true,
        show_categories BOOLEAN NOT NULL DEFAULT true,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Logo & App settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS logo_settings (
        id SERIAL PRIMARY KEY,
        logo_url TEXT,
        splash_bg_url TEXT,
        splash_bg_color VARCHAR(7) DEFAULT '#ffffff',
        splash_text TEXT DEFAULT 'أويو بلاست',
        splash_text_color VARCHAR(7) DEFAULT '#2196F3',
        show_splash BOOLEAN DEFAULT true,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Pending offline orders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS pending_sync_orders (
        id SERIAL PRIMARY KEY,
        guest_id TEXT NOT NULL,
        order_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        synced_at TIMESTAMP
      );
    `);

    // Digital wallets table
    await client.query(`
      CREATE TABLE IF NOT EXISTS digital_wallets (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        logo_url TEXT,
        receiver_name TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        purchase_code TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Image dimensions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS image_dimensions (
        id SERIAL PRIMARY KEY,
        image_type TEXT NOT NULL UNIQUE,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        description TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Insert default dimensions if not exist
    await client.query(`
      INSERT INTO image_dimensions (image_type, width, height, description)
      VALUES 
        ('product', 300, 400, 'Product page images'),
        ('banner', 1200, 414, 'Homepage banner images'),
        ('category', 200, 200, 'Category thumbnail images'),
        ('offer', 600, 72, 'Offer/promotion images'),
        ('logo', 512, 512, 'Logo/splash images')
      ON CONFLICT (image_type) DO NOTHING;
    `);

    console.log("[SUCCESS] Database migrations completed");
  } catch (error) {
    console.error("[WARN] Migration error (non-fatal):", error instanceof Error ? error.message : String(error));
  } finally {
    client.release();
  }
}
