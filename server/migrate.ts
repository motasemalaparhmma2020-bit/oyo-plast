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
    await client.query(`ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS detail_section_gap INTEGER NOT NULL DEFAULT 12;`);
    await client.query(`ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS detail_top_padding INTEGER NOT NULL DEFAULT 8;`);
    await client.query(`ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS detail_discount_bubble_size INTEGER NOT NULL DEFAULT 36;`);
    await client.query(`ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS detail_show_thumbnails BOOLEAN NOT NULL DEFAULT true;`);

    // ─── الخيارات الذكية للمنتج ─────────────────────────────────────
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS enable_smart_variants BOOLEAN NOT NULL DEFAULT false;`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS smart_variants TEXT;`);

    // ─── سديم الذكية ─────────────────────────────────────────────────
    await client.query(`ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS sadeem_show_old_price BOOLEAN NOT NULL DEFAULT true;`);
    await client.query(`ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS sadeem_show_discount_badge BOOLEAN NOT NULL DEFAULT true;`);
    await client.query(`ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS sadeem_show_rating BOOLEAN NOT NULL DEFAULT true;`);
    await client.query(`ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS sadeem_show_sold_count BOOLEAN NOT NULL DEFAULT true;`);
    await client.query(`ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS sadeem_show_shipping BOOLEAN NOT NULL DEFAULT true;`);
    await client.query(`ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS sadeem_show_returns BOOLEAN NOT NULL DEFAULT true;`);
    await client.query(`ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS sadeem_free_shipping_min INTEGER NOT NULL DEFAULT 0;`);
    await client.query(`ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS sadeem_marketer_discount INTEGER NOT NULL DEFAULT 0;`);

    // ─── إعدادات الدفع والشحن ────────────────────────────────────────
    await client.query(`ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS shipping_fee INTEGER NOT NULL DEFAULT 0;`);
    await client.query(`ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS cod_enabled BOOLEAN NOT NULL DEFAULT true;`);

    // ─── تحكم أبعاد البنرات والعروض ──────────────────────────────────
    await client.query(`ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS slider_height INTEGER NOT NULL DEFAULT 414;`);
    await client.query(`ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS offer_banner_cols INTEGER NOT NULL DEFAULT 2;`);

    // ─── جدول رموز التحقق بالهاتف (OTP) ─────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS phone_verifications (
        id SERIAL PRIMARY KEY,
        phone TEXT NOT NULL,
        code TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        verified BOOLEAN NOT NULL DEFAULT false,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone ON phone_verifications(phone);`);

    // ─── تحسينات جدول المحافظ الرقمية ───────────────────────────────
    await client.query(`ALTER TABLE digital_wallets ADD COLUMN IF NOT EXISTS requires_proof BOOLEAN NOT NULL DEFAULT true;`);
    await client.query(`ALTER TABLE digital_wallets ADD COLUMN IF NOT EXISTS instructions TEXT;`);

    // ─── Seed المحافظ الأربعة إذا لم تكن موجودة ──────────────────
    const walletCountRes = await client.query('SELECT COUNT(*) FROM digital_wallets');
    if (parseInt(walletCountRes.rows[0].count) === 0) {
      const jawaliSvg = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#E53935" rx="14"/><text x="50" y="42" font-family="Arial" font-size="20" font-weight="bold" text-anchor="middle" fill="white">جوالي</text></svg>').toString('base64')}`;
      const jeebSvg = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#2E7D32" rx="14"/><text x="50" y="58" font-family="Arial" font-size="26" font-weight="bold" text-anchor="middle" fill="white">جيب</text></svg>').toString('base64')}`;
      const oneCashSvg = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#1565C0" rx="14"/><text x="50" y="42" font-family="Arial" font-size="14" font-weight="bold" text-anchor="middle" fill="white">ون كاش</text></svg>').toString('base64')}`;
      const karamiSvg = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#00695C" rx="14"/><text x="50" y="36" font-family="Arial" font-size="12" font-weight="bold" text-anchor="middle" fill="white">بنك</text><text x="50" y="58" font-family="Arial" font-size="12" font-weight="bold" text-anchor="middle" fill="white">الكريمي</text></svg>').toString('base64')}`;

      const seedWallets = [
        { name: 'محفظة جوالي', logo: jawaliSvg, order: 1 },
        { name: 'محفظة جيب', logo: jeebSvg, order: 2 },
        { name: 'ون كاش', logo: oneCashSvg, order: 3 },
        { name: 'بنك الكريمي', logo: karamiSvg, order: 4 },
      ];
      for (const w of seedWallets) {
        await client.query(
          `INSERT INTO digital_wallets (name, logo_url, receiver_name, phone_number, purchase_code, is_active, sort_order, requires_proof, instructions)
           VALUES ($1, $2, 'معتصم محمد احمد الاهدل', '774997589', '', true, $3, true, 'حوّل المبلغ ثم أرسل صورة الإيصال')`,
          [w.name, w.logo, w.order]
        );
      }
    }

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

    // ─── إعدادات تسجيل الدخول ────────────────────────────────────────
    await client.query(`ALTER TABLE navigation_settings ADD COLUMN IF NOT EXISTS enable_phone_login BOOLEAN NOT NULL DEFAULT true;`);
    await client.query(`ALTER TABLE navigation_settings ADD COLUMN IF NOT EXISTS enable_email_login BOOLEAN NOT NULL DEFAULT true;`);
    await client.query(`ALTER TABLE navigation_settings ADD COLUMN IF NOT EXISTS login_show_on_top BOOLEAN NOT NULL DEFAULT false;`);
    await client.query(`ALTER TABLE navigation_settings ADD COLUMN IF NOT EXISTS login_show_on_checkout BOOLEAN NOT NULL DEFAULT true;`);
    await client.query(`ALTER TABLE navigation_settings ADD COLUMN IF NOT EXISTS login_show_on_account BOOLEAN NOT NULL DEFAULT true;`);

    // ─── جدول تتبع الزوار والجلسات ───────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS visitor_sessions (
        id SERIAL PRIMARY KEY,
        session_id TEXT NOT NULL UNIQUE,
        user_id TEXT,
        first_seen TIMESTAMP NOT NULL DEFAULT NOW(),
        last_seen TIMESTAMP NOT NULL DEFAULT NOW(),
        page_views INTEGER NOT NULL DEFAULT 1
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_visitor_sessions_last_seen ON visitor_sessions(last_seen);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_visitor_sessions_session ON visitor_sessions(session_id);`);

    // ─── نظام الحضور والانصراف ─────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR NOT NULL REFERENCES users(id),
        check_in TIMESTAMP NOT NULL,
        check_out TIMESTAMP,
        total_minutes INTEGER,
        date TEXT NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, date);`);

    // ─── المصاريف التشغيلية ──────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        amount NUMERIC NOT NULL,
        currency TEXT DEFAULT 'YER' NOT NULL,
        date TEXT NOT NULL,
        is_recurring BOOLEAN DEFAULT false,
        recurring_day INTEGER,
        added_by VARCHAR REFERENCES users(id),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);`);

    // ─── الأصول الثابتة والاهلاكات ──────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS assets (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        original_value NUMERIC NOT NULL,
        purchase_date TEXT NOT NULL,
        useful_life_months INTEGER NOT NULL,
        notes TEXT,
        added_by VARCHAR REFERENCES users(id),
        is_active BOOLEAN DEFAULT true NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // ─── إعداد الأجور لكل دور ────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_rate_config (
        id SERIAL PRIMARY KEY,
        role TEXT NOT NULL UNIQUE,
        base_salary NUMERIC DEFAULT 0 NOT NULL,
        rate_per_order NUMERIC DEFAULT 0 NOT NULL,
        payment_model TEXT DEFAULT 'fixed' NOT NULL,
        overtime_rate_per_hour NUMERIC DEFAULT 0 NOT NULL,
        working_days_per_month INTEGER DEFAULT 26 NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    // Seed default rates for all roles
    const defaultRoles = [
      { role: 'delivery', base: 0, rate: 500, model: 'per_order' },
      { role: 'order_manager', base: 80000, rate: 200, model: 'hybrid' },
      { role: 'product_manager', base: 100000, rate: 0, model: 'fixed' },
      { role: 'finance', base: 120000, rate: 0, model: 'fixed' },
      { role: 'owner', base: 0, rate: 0, model: 'fixed' },
    ];
    for (const r of defaultRoles) {
      await client.query(
        `INSERT INTO staff_rate_config (role, base_salary, rate_per_order, payment_model)
         VALUES ($1, $2, $3, $4) ON CONFLICT (role) DO NOTHING`,
        [r.role, r.base, r.rate, r.model]
      );
    }

    // ─── كشوف الرواتب الشهرية ────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS payroll_periods (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR NOT NULL REFERENCES users(id),
        period TEXT NOT NULL,
        base_salary NUMERIC DEFAULT 0 NOT NULL,
        orders_completed INTEGER DEFAULT 0 NOT NULL,
        order_bonus NUMERIC DEFAULT 0 NOT NULL,
        attendance_days INTEGER DEFAULT 0 NOT NULL,
        absence_days INTEGER DEFAULT 0 NOT NULL,
        deductions NUMERIC DEFAULT 0 NOT NULL,
        bonuses NUMERIC DEFAULT 0 NOT NULL,
        total_pay NUMERIC NOT NULL,
        is_paid BOOLEAN DEFAULT false NOT NULL,
        paid_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_user_period ON payroll_periods(user_id, period);`);

    console.log("[SUCCESS] Database migrations completed");
  } catch (error) {
    console.error("[WARN] Migration error (non-fatal):", error instanceof Error ? error.message : String(error));
  } finally {
    client.release();
  }
}
