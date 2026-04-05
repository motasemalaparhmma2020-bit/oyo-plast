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

    // Variant UI columns for products (SHEIN-style feature flags)
    await client.query(`
      ALTER TABLE products
        ADD COLUMN IF NOT EXISTS enable_variant_ui BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS color_images TEXT;
    `);

    // Master switch for variant product page in navigation_settings
    await client.query(`
      ALTER TABLE navigation_settings
        ADD COLUMN IF NOT EXISTS enable_variant_product_page BOOLEAN NOT NULL DEFAULT false;
    `);
    await client.query(`
      ALTER TABLE navigation_settings
        ADD COLUMN IF NOT EXISTS lock_mobile_pwa_mode BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS disable_pinch_zoom BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS disable_horizontal_scroll BOOLEAN NOT NULL DEFAULT true;
    `);

    // Extra columns for navigation settings
    await client.query(`
      ALTER TABLE navigation_settings
        ADD COLUMN IF NOT EXISTS show_signup_entry_point BOOLEAN NOT NULL DEFAULT true;
    `);

    // Footer content & login flow columns for home_page_settings
    await client.query(`
      ALTER TABLE home_page_settings
        ADD COLUMN IF NOT EXISTS footer_privacy_text TEXT NOT NULL DEFAULT 'سياسة الخصوصية',
        ADD COLUMN IF NOT EXISTS footer_affiliate_text TEXT NOT NULL DEFAULT 'التسويق بالعمولة',
        ADD COLUMN IF NOT EXISTS footer_returns_text TEXT NOT NULL DEFAULT 'سياسة الاسترجاع',
        ADD COLUMN IF NOT EXISTS footer_bottom_text TEXT NOT NULL DEFAULT 'أويو بلاست - مستلزمات التغليف',
        ADD COLUMN IF NOT EXISTS signup_entry_mode TEXT NOT NULL DEFAULT 'cart',
        ADD COLUMN IF NOT EXISTS privacy_content TEXT,
        ADD COLUMN IF NOT EXISTS returns_content TEXT,
        ADD COLUMN IF NOT EXISTS affiliate_content TEXT,
        ADD COLUMN IF NOT EXISTS login_flow TEXT NOT NULL DEFAULT 'checkout';
    `);

    // ─── إضافة أعمدة التصميم البصري الديناميكي ─────────────────────
    await client.query(`ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS product_card_margin INTEGER NOT NULL DEFAULT 8;`);
    await client.query(`ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS product_card_padding_v INTEGER NOT NULL DEFAULT 8;`);
    await client.query(`ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS price_font_size INTEGER NOT NULL DEFAULT 16;`);
    await client.query(`ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS discount_bubble_size INTEGER NOT NULL DEFAULT 28;`);
    await client.query(`ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS quantity_button_height INTEGER NOT NULL DEFAULT 40;`);
    await client.query(`ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS image_mode TEXT NOT NULL DEFAULT 'card';`);

    // ─── إعدادات صفحة المنتج (Product Detail Page) ─────────────────
    await client.query(`ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS detail_image_height INTEGER NOT NULL DEFAULT 380;`);
    await client.query(`ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS detail_image_mode TEXT NOT NULL DEFAULT 'contain';`);
    await client.query(`ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS detail_price_font_size INTEGER NOT NULL DEFAULT 22;`);
    await client.query(`ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS detail_add_to_cart_height INTEGER NOT NULL DEFAULT 52;`);
    await client.query(`ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS detail_show_related BOOLEAN NOT NULL DEFAULT true;`);
    await client.query(`ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS detail_show_reviews BOOLEAN NOT NULL DEFAULT true;`);
    await client.query(`ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS detail_thumbnail_size INTEGER NOT NULL DEFAULT 64;`);

    // ─── جدول أقسام الصفحة الرئيسية الديناميكية ──────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS home_sections (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        promotional_tag TEXT NOT NULL DEFAULT 'bestsellers',
        enabled BOOLEAN NOT NULL DEFAULT true,
        priority INTEGER NOT NULL DEFAULT 0,
        item_count INTEGER NOT NULL DEFAULT 6,
        display_mode TEXT NOT NULL DEFAULT 'grid2',
        banner_height INTEGER NOT NULL DEFAULT 180,
        banner_item_width INTEGER NOT NULL DEFAULT 160,
        banner_price_font_size INTEGER NOT NULL DEFAULT 14,
        banner_name_font_size INTEGER NOT NULL DEFAULT 12,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // ─── حقول الخصم والتصنيفات الترويجية للمنتجات ──────────────────
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS original_price NUMERIC;`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS original_price_sar NUMERIC;`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_percent INTEGER;`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS promotional_tags TEXT[];`);

    // ─── إعدادات الخصم في display_settings ──────────────────────────
    await client.query(`ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS discount_badge_bg TEXT NOT NULL DEFAULT '#ef4444';`);
    await client.query(`ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS show_sticky_cart_bar BOOLEAN NOT NULL DEFAULT true;`);
    await client.query(`ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS detail_padding_v INTEGER NOT NULL DEFAULT 8;`);
    await client.query(`ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS detail_margin_h INTEGER NOT NULL DEFAULT 16;`);
    await client.query(`ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS detail_discount_bubble_size INTEGER NOT NULL DEFAULT 36;`);
    await client.query(`ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS detail_show_thumbnails BOOLEAN NOT NULL DEFAULT true;`);

    // ─── الخيارات الذكية للمنتج ─────────────────────────────────────
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS enable_smart_variants BOOLEAN NOT NULL DEFAULT false;`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS smart_variants TEXT;`);

    // ─── إدخال صف افتراضي إذا كان الجدول فارغاً ──────────────────
    await client.query(`
      INSERT INTO display_settings (
        category_size, categories_per_row, show_categories,
        product_card_width, product_card_height,
        offer_banner_height, show_offer_banners,
        product_card_margin, product_card_padding_v,
        price_font_size, discount_bubble_size,
        quantity_button_height, image_mode
      )
      SELECT 72, 4, true, 160, 200, 72, true, 8, 8, 16, 28, 40, 'card'
      WHERE NOT EXISTS (SELECT 1 FROM display_settings LIMIT 1);
    `);

    console.log("[SUCCESS] Database migrations completed");
  } catch (error) {
    console.error("[WARN] Migration error (non-fatal):", error instanceof Error ? error.message : String(error));
  } finally {
    client.release();
  }
}
