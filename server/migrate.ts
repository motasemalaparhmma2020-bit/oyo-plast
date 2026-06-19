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

    // نوع المنتج: 'ready' (جاهز بدون طباعة) | 'customizable' (قابل للتخصيص)
    await client.query(`
      ALTER TABLE products
        ADD COLUMN IF NOT EXISTS product_type VARCHAR(50) NOT NULL DEFAULT 'ready';
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
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS enable_studio_preview BOOLEAN NOT NULL DEFAULT false;`);

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

    // ─── نظام GPS — أعمدة الموردين ──────────────────────────────────────
    await client.query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS lat NUMERIC;`);
    await client.query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS lng NUMERIC;`);
    await client.query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS service_radius_km INTEGER NOT NULL DEFAULT 20;`);
    await client.query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS province TEXT;`);
    await client.query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS district TEXT;`);

    // ─── نظام GPS — أعمدة الطلبات ────────────────────────────────────────
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_lat NUMERIC;`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_lng NUMERIC;`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS location_accuracy NUMERIC;`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS location_method TEXT DEFAULT 'manual';`);
    // التأكيد الهاتفي اليدوي (وضع التشغيل المجاني — بديل OTP)
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_confirmed BOOLEAN DEFAULT false;`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP;`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmed_by TEXT;`);

    // ─── جدول إعدادات مناطق الخدمة ──────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS service_area_config (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        city TEXT NOT NULL,
        district TEXT,
        center_lat NUMERIC,
        center_lng NUMERIC,
        radius_km INTEGER NOT NULL DEFAULT 20,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    // إدخال المناطق الافتراضية لليمن
    const defaultAreas = [
      { name: "صنعاء المركز", city: "صنعاء", district: null, lat: 15.3694, lng: 44.1910, radius: 15 },
      { name: "عدن", city: "عدن", district: null, lat: 12.7797, lng: 45.0095, radius: 20 },
      { name: "تعز", city: "تعز", district: null, lat: 13.5794, lng: 44.0210, radius: 20 },
      { name: "الحديدة", city: "الحديدة", district: null, lat: 14.7978, lng: 42.9539, radius: 25 },
      { name: "إب", city: "إب", district: null, lat: 13.9767, lng: 44.1786, radius: 20 },
    ];
    for (const a of defaultAreas) {
      await client.query(
        `INSERT INTO service_area_config (name, city, district, center_lat, center_lng, radius_km)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT DO NOTHING`,
        [a.name, a.city, a.district, a.lat, a.lng, a.radius]
      );
    }

    // ── أعمدة بيانات إكمال التسجيل (Onboarding) ─────────────────────
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS business_name varchar`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS gps_latitude varchar`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS gps_longitude varchar`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed varchar DEFAULT 'false'`);

    // ── ترحيل تلقائي: تحويل colors/sizes/sizePricing إلى smartVariants ──
    // يعمل مرة واحدة فقط لكل منتج (إذا كان smart_variants فارغ)
    try {
      const COLOR_HEX: Record<string, string> = {
        'أبيض': '#FFFFFF', 'أسود': '#000000', 'أحمر': '#EF4444', 'أزرق': '#3B82F6',
        'أخضر': '#22C55E', 'أصفر': '#FACC15', 'بيج': '#D4B896', 'سماوي': '#67E8F9',
        'مخطط': '#9CA3AF', 'ألوان': '#A78BFA', 'برتقالي': '#FB923C', 'بني': '#92400E',
        'رمادي': '#6B7280', 'وردي': '#EC4899', 'بنفسجي': '#A855F7', 'ذهبي': '#D4AF37',
      };
      const toMigrate = await client.query(`
        SELECT id, price, price_sar, colors, sizes, size_pricing
        FROM products
        WHERE (smart_variants IS NULL OR smart_variants = '' OR smart_variants = 'null')
          AND ( (colors IS NOT NULL AND array_length(colors,1) > 0)
                OR (sizes IS NOT NULL AND array_length(sizes,1) > 0)
                OR (size_pricing IS NOT NULL AND size_pricing <> '') )
      `);
      let migrated = 0;
      for (const p of toMigrate.rows) {
        const variants: any[] = [];
        const activeTypes: string[] = [];
        // sizes / sizePricing → variants type=size
        let sp: any[] = [];
        try { sp = p.size_pricing ? JSON.parse(p.size_pricing) : []; } catch {}
        if (Array.isArray(sp) && sp.length > 0) {
          activeTypes.push('size');
          sp.forEach((s: any, i: number) => {
            variants.push({
              id: `mig-size-${p.id}-${i}`, type: 'size',
              label: String(s.size ?? ''),
              price: String(s.price ?? p.price ?? ''),
              priceSar: String(s.priceSar ?? p.price_sar ?? ''),
              discount: '', hex: '', imageUrl: '',
            });
          });
        } else if (Array.isArray(p.sizes) && p.sizes.length > 0) {
          activeTypes.push('size');
          p.sizes.forEach((sz: string, i: number) => {
            variants.push({
              id: `mig-size-${p.id}-${i}`, type: 'size', label: String(sz),
              price: String(p.price ?? ''), priceSar: String(p.price_sar ?? ''),
              discount: '', hex: '', imageUrl: '',
            });
          });
        }
        // colors → variants type=color
        if (Array.isArray(p.colors) && p.colors.length > 0) {
          activeTypes.push('color');
          p.colors.forEach((c: string, i: number) => {
            variants.push({
              id: `mig-color-${p.id}-${i}`, type: 'color', label: String(c),
              price: '', priceSar: '', discount: '',
              hex: COLOR_HEX[c] || '#CCCCCC', imageUrl: '',
            });
          });
        }
        if (variants.length > 0) {
          const json = JSON.stringify({ activeTypes, variants });
          await client.query(
            `UPDATE products SET smart_variants = $1, enable_smart_variants = true WHERE id = $2`,
            [json, p.id]
          );
          migrated++;
        }
      }
      if (migrated > 0) {
        console.log(`[INFO] Migrated ${migrated} product(s) → smartVariants`);
      }
    } catch (e) {
      console.warn("[WARN] smartVariants migration:", e instanceof Error ? e.message : e);
    }

    // ─── إعادة حساب أسعار المنتجات من أرخص متغيّر ذكي (May 2026) ───
    // يضمن أن السعر الأساسي = أرخص خيار، ويُحدّث ر.س ديناميكياً من سعر الصرف.
    try {
      const rateRow = await client.query(`SELECT value FROM settings WHERE key = 'exchange_rate' LIMIT 1`);
      const rate = rateRow.rows[0]?.value ? parseFloat(String(rateRow.rows[0].value)) : 140;
      const safeRate = rate > 0 ? rate : 140;
      const allSV = await client.query(
        `SELECT id, smart_variants FROM products WHERE enable_smart_variants = true AND smart_variants IS NOT NULL AND smart_variants <> ''`
      );
      let recomputed = 0;
      for (const p of allSV.rows) {
        try {
          const sv = typeof p.smart_variants === 'string' ? JSON.parse(p.smart_variants) : p.smart_variants;
          if (!sv || !Array.isArray(sv.variants)) continue;
          const priced = sv.variants
            .map((v: any) => {
              const pr = parseFloat(String(v.price ?? '0'));
              const ds = v.discount != null ? parseFloat(String(v.discount)) : 0;
              return { _p: pr, _d: isNaN(ds) ? 0 : ds };
            })
            .filter((v: any) => !isNaN(v._p) && v._p > 0)
            .sort((a: any, b: any) => a._p - b._p);
          if (priced.length === 0) continue;
          const cheapest = priced[0];
          const newPrice = cheapest._p;
          const newPriceSar = (newPrice / safeRate).toFixed(2);
          let origPrice: string | null = null;
          let origSar: string | null = null;
          let disc: number | null = null;
          if (cheapest._d > 0 && cheapest._d < 100) {
            const orig = newPrice / (1 - cheapest._d / 100);
            origPrice = orig.toFixed(2);
            origSar = (orig / safeRate).toFixed(2);
            disc = Math.round(cheapest._d);
          }
          await client.query(
            `UPDATE products SET price=$1, price_sar=$2, original_price=$3, original_price_sar=$4, discount_percent=$5 WHERE id=$6`,
            [String(newPrice), newPriceSar, origPrice, origSar, disc, p.id]
          );
          recomputed++;
        } catch { /* skip invalid */ }
      }
      if (recomputed > 0) console.log(`[INFO] Recomputed prices for ${recomputed} product(s) from cheapest smart variant`);
    } catch (e) {
      console.warn("[WARN] price recompute migration:", e instanceof Error ? e.message : e);
    }

    // ─── Notifications: add new columns + preferences table (Phase 1, May 2026) ──
    try {
      await client.query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal'`);
      await client.query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url TEXT`);
      await client.query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS group_key TEXT`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_group ON notifications(user_id, group_key, created_at DESC) WHERE group_key IS NOT NULL`);

      await client.query(`
        CREATE TABLE IF NOT EXISTS notification_preferences (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR NOT NULL REFERENCES users(id),
          type TEXT NOT NULL,
          in_app_enabled BOOLEAN NOT NULL DEFAULT true,
          telegram_enabled BOOLEAN NOT NULL DEFAULT false,
          muted_until TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(user_id, type)
        );
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_notif_prefs_user ON notification_preferences(user_id)`);
    } catch (e) {
      console.warn("[WARN] notifications migration:", e instanceof Error ? e.message : e);
    }

    // ─── Payment Receipts hardening (May 2026) ───
    try {
      await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_claimed NUMERIC(12,2)`);
      await client.query(`ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS receipts_enabled BOOLEAN NOT NULL DEFAULT true`);
    } catch (e) {
      console.warn("[WARN] receipts migration:", e instanceof Error ? e.message : e);
    }

    // ─── Supplier Applications (Self-Service Signup, May 2026) ───
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS supplier_applications (
          id SERIAL PRIMARY KEY,
          company_name TEXT NOT NULL,
          owner_name TEXT NOT NULL,
          phone TEXT NOT NULL,
          city TEXT NOT NULL,
          address TEXT,
          business_type TEXT,
          product_categories TEXT[],
          message TEXT,
          documents_urls TEXT[],
          contract_accepted_at TIMESTAMP,
          status TEXT NOT NULL DEFAULT 'pending',
          rejection_reason TEXT,
          processed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_supplier_apps_status ON supplier_applications(status)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_supplier_apps_phone ON supplier_applications(phone)`);
    } catch (e) {
      console.warn("[WARN] supplier_applications migration:", e instanceof Error ? e.message : e);
    }

    // ─── COGS Snapshot column on order_items (Phase 1 — May 2026) ──────────
    // يحفظ تكلفة الشراء وقت إنشاء الطلب → تقارير ربحية تاريخية دقيقة حتى لو تغيّرت التكلفة لاحقاً
    try {
      await client.query(`
        ALTER TABLE order_items
          ADD COLUMN IF NOT EXISTS cost_price_at_order NUMERIC
      `);
    } catch (e) {
      console.warn("[WARN] order_items.cost_price_at_order migration:", e instanceof Error ? e.message : e);
    }

    // ─── Purchase Orders (المرحلة 1, مايو 2026) ──────────────────────────
    try {
      // 1) إضافة عمود type لـ suppliers (distributor | vendor | both)
      await client.query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'distributor'`);

      // 2) جدول أوامر الشراء
      await client.query(`
        CREATE TABLE IF NOT EXISTS purchase_orders (
          id SERIAL PRIMARY KEY,
          po_number TEXT NOT NULL UNIQUE,
          supplier_id INTEGER REFERENCES suppliers(id),
          supplier_name_snapshot TEXT,
          status TEXT NOT NULL DEFAULT 'draft',
          subtotal NUMERIC NOT NULL DEFAULT 0,
          shipping_cost NUMERIC NOT NULL DEFAULT 0,
          total NUMERIC NOT NULL DEFAULT 0,
          currency TEXT NOT NULL DEFAULT 'YER',
          notes TEXT,
          created_by VARCHAR REFERENCES users(id),
          created_at TIMESTAMP DEFAULT NOW(),
          received_at TIMESTAMP
        );
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id)`);

      // 3) جدول عناصر أمر الشراء
      await client.query(`
        CREATE TABLE IF NOT EXISTS purchase_order_items (
          id SERIAL PRIMARY KEY,
          purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
          product_id INTEGER REFERENCES products(id),
          product_name_snapshot TEXT,
          variant_label TEXT,
          quantity_ordered INTEGER NOT NULL,
          quantity_received INTEGER NOT NULL DEFAULT 0,
          unit_cost NUMERIC NOT NULL,
          line_total NUMERIC NOT NULL
        );
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_poi_po ON purchase_order_items(purchase_order_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_poi_product ON purchase_order_items(product_id)`);
    } catch (e) {
      console.warn("[WARN] purchase_orders migration:", e instanceof Error ? e.message : e);
    }

    // ─── Phase 4: تسعير الطباعة الفوري (Hybrid Override) ────────────────────
    try {
      await client.query(`ALTER TABLE printing_categories ADD COLUMN IF NOT EXISTS design_fee_per_mockup NUMERIC DEFAULT 0`);
      await client.query(`ALTER TABLE printing_categories ADD COLUMN IF NOT EXISTS color_price_per_color NUMERIC DEFAULT 0`);
      await client.query(`ALTER TABLE printing_categories ADD COLUMN IF NOT EXISTS price_per_side NUMERIC DEFAULT 0`);
      await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS printing_design_fee_override NUMERIC`);
      await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS printing_color_price_override NUMERIC`);
      await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS printing_side_price_override NUMERIC`);
      await client.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS design_options TEXT`);
      await client.query(`ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS design_options TEXT`);
      // Phase 5: منطقة الطباعة للمعاينة الفورية
      await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS print_area TEXT`);
      // Phase 6: تغيير لون الكيس عبر Cloudinary
      await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS base_image_public_id TEXT`);
      await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS available_colors TEXT`);
      // Task 2: سداد مستحقات الموردين — إضافة طريقة الدفع
      await client.query(`ALTER TABLE supplier_payments ADD COLUMN IF NOT EXISTS payment_method TEXT`);
      // Task 3: trigger sold_count عند التسليم — flag لمنع العد المضاعف
      await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS sold_count_incremented BOOLEAN DEFAULT FALSE`);
    } catch (e) {
      console.warn("[WARN] phase4/5/6 printing migration:", e instanceof Error ? e.message : e);
    }

    // ─── Task 8: نظام وكلاء الذكاء الاصطناعي (AI Agent Team) ────────────────
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS ai_agents (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL UNIQUE,
          display_name VARCHAR(100) NOT NULL,
          role VARCHAR(150) NOT NULL,
          model VARCHAR(80) NOT NULL,
          provider VARCHAR(30) NOT NULL,
          system_prompt TEXT NOT NULL,
          avatar_url TEXT,
          permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
          is_active BOOLEAN DEFAULT true,
          last_daily_report DATE,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS ai_agent_actions (
          id SERIAL PRIMARY KEY,
          agent_id INTEGER REFERENCES ai_agents(id) ON DELETE CASCADE,
          action_type VARCHAR(100) NOT NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          input_data JSONB,
          output_data JSONB,
          status VARCHAR(50) DEFAULT 'pending',
          verified_by_ceo BOOLEAN DEFAULT false,
          verified_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_aaa_agent ON ai_agent_actions(agent_id, created_at DESC)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_aaa_status ON ai_agent_actions(status)`);
      await client.query(`
        CREATE TABLE IF NOT EXISTS ai_agent_conversations (
          id SERIAL PRIMARY KEY,
          agent_id INTEGER REFERENCES ai_agents(id) ON DELETE CASCADE,
          user_id VARCHAR(100),
          user_name VARCHAR(150),
          message TEXT NOT NULL,
          reply TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_aic_agent ON ai_agent_conversations(agent_id, created_at DESC)`);

      // Seed default 9 agents (only if table empty)
      const cnt = await client.query(`SELECT COUNT(*)::int AS n FROM ai_agents`);
      if ((cnt.rows[0]?.n || 0) === 0) {
        const agents: Array<[string,string,string,string,string,string,string]> = [
          ["safar","سفر","مديرة التسعير الذكي","deepseek-chat","deepseek",
           "أنت سفر، مديرة التسعير الذكي في متجر OYO PLAST. مهمتك تحليل أسعار المنتجات واقتراح تخفيضات/زيادات بناءً على سلوك المبيعات والمخزون. اقترح فقط — لا تنفّذ. تواصل بالعربية باختصار وحرفية.",
           '{"can_chat":true,"requires_approval":true,"can_view_db":true,"db_scope":["products","order_items","orders"]}'],
          ["nour","نور","كاتبة المحتوى التسويقي","deepseek-chat","deepseek",
           "أنت نور، كاتبة محتوى تسويقي في OYO PLAST. تكتبين أوصاف منتجات قصيرة وجذابة بالعربية للطباعة على البلاستيك. النبرة ودودة احترافية. لا تخترعي حقائق.",
           '{"can_chat":true,"requires_approval":true,"can_view_db":false}'],
          ["layla","ليلى","مديرة العلاقات مع العملاء","gemini-2.5-flash","gemini",
           "أنت ليلى، مسؤولة خدمة العملاء في OYO PLAST. تجيبين العملاء بود واحترام بالعربية، تساعدينهم في الطلبات، وتُحوّلين المشاكل المعقّدة للأدمن. كوني مختصرة ومفيدة.",
           '{"can_chat":true,"requires_approval":false,"can_view_db":true,"db_scope":["orders","conversations","users","messages"]}'],
          ["huda","هدى","مديرة المتأخرات والائتمان","deepseek-chat","deepseek",
           "أنت هدى، مديرة المتأخرات في OYO PLAST. تتابعين العملاء الذين عليهم مستحقات، وتقترحين خطط سداد بأسلوب لبق. تتحدّثين بالعربية فقط.",
           '{"can_chat":true,"requires_approval":true,"can_view_db":true,"db_scope":["customer_credit","orders","users"]}'],
          ["majed","ماجد","مدير ملفات التصميم","gemini-2.5-flash-lite","gemini",
           "أنت ماجد، مدير ملفات التصميم في OYO PLAST. تتحقق من ملفات التصميم المرفوعة (PDF/PNG/AI/PSD)، الأبعاد، الألوان، الجودة. ترسل تحذيرات لو الملف غير مناسب للطباعة.",
           '{"can_chat":true,"requires_approval":false,"can_view_db":true,"db_scope":["order_items"]}'],
          ["rami","رامي","محلل سلوك العملاء","deepseek-chat","deepseek",
           "أنت رامي، محلل سلوك العملاء في OYO PLAST. تستخرج رؤى من بيانات الطلبات والتصفّح (المنتجات الأكثر مشاهدة، السلال المتروكة، الزبائن النشطون). تكتب بالعربية تقارير قصيرة عملية.",
           '{"can_chat":true,"requires_approval":false,"can_view_db":true,"db_scope":["orders","users","cart_items","products"]}'],
          ["omar","عمر","المصمم الإبداعي","gemini-2.5-flash","gemini",
           "أنت عمر، مصمم إبداعي في OYO PLAST. تقترح أفكار حملات، عروض، شعارات نصية، وألوان للبانرات. اعمل بحرية وبالعربية.",
           '{"can_chat":true,"requires_approval":true,"can_view_db":false}'],
          ["oyo","أوبو","مساعد متابعة الطلبات","gemini-2.5-flash-lite","gemini",
           "أنت أوبو، روبوت متابعة الطلبات في OYO PLAST. تخبر العميل بحالة طلبه بالعربية بشكل واضح وموجز. لا تختلق معلومات — اعتمد فقط على البيانات الفعلية.",
           '{"can_chat":true,"requires_approval":false,"can_view_db":true,"db_scope":["orders"]}'],
          ["rashed","راشد","المدير التنفيذي","deepseek-chat","deepseek",
           "أنت راشد، المدير التنفيذي لفريق الذكاء الاصطناعي في OYO PLAST. تتفقد عمل الوكلاء، تتحقق من إنجازاتهم بالاطلاع على قاعدة البيانات مباشرة، وتُصدر تقارير يومية للمالك. كن دقيقاً ومحايداً وموجزاً بالعربية.",
           '{"can_chat":true,"requires_approval":false,"can_view_db":true,"db_scope":["*"],"is_ceo":true}'],
        ];
        for (const [name,dn,role,model,provider,prompt,perms] of agents) {
          await client.query(
            `INSERT INTO ai_agents (name, display_name, role, model, provider, system_prompt, permissions, is_active)
             VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,true) ON CONFLICT (name) DO NOTHING`,
            [name, dn, role, model, provider, prompt, perms]
          );
        }
        console.log("[INFO] Seeded 9 AI agents (Task 8)");
      }
    } catch (e) {
      console.warn("[WARN] ai_agents migration:", e instanceof Error ? e.message : e);
    }

    // ─── Volume Offers — العروض التحفيزية حسب الكمية (May 17, 2026) ─────
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS product_volume_offers (
          id SERIAL PRIMARY KEY,
          product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          min_quantity INTEGER NOT NULL,
          max_quantity INTEGER,
          offer_price_yer NUMERIC NOT NULL,
          original_price_yer NUMERIC,
          display_label TEXT,
          badge_text TEXT,
          has_free_shipping BOOLEAN DEFAULT false NOT NULL,
          shipping_fee_yer NUMERIC DEFAULT 0 NOT NULL,
          marketer_commission_percent NUMERIC,
          is_active BOOLEAN DEFAULT true NOT NULL,
          sort_order INTEGER DEFAULT 0 NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_pvo_product_active ON product_volume_offers(product_id, is_active)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_pvo_range ON product_volume_offers(product_id, min_quantity, max_quantity) WHERE is_active = true`);
      console.log("[INFO] product_volume_offers table ready");
    } catch (e) {
      console.warn("[WARN] product_volume_offers migration:", e instanceof Error ? e.message : e);
    }

    // ─── UNIQUE phone — منع تكرار أرقام الهواتف على مستوى DB (May 17, 2026) ─────
    try {
      // إزالة التكرارات قبل إنشاء الـ INDEX (نُبقي أقدم سجل)
      await client.query(`
        DELETE FROM users
        WHERE id IN (
          SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY phone ORDER BY created_at NULLS LAST, id) AS rn
            FROM users
            WHERE phone IS NOT NULL AND phone <> ''
          ) t
          WHERE t.rn > 1
        )
      `);
      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique
        ON users(phone)
        WHERE phone IS NOT NULL AND phone <> ''
      `);
      console.log("[INFO] users.phone unique index ready");
    } catch (e) {
      console.warn("[WARN] users.phone unique index migration:", e instanceof Error ? e.message : e);
    }

    // ─── UNIQUE (product_id, user_id) على reviews — منع التقييم المكرر (Task 5) ─────
    try {
      await client.query(`
        DELETE FROM reviews
        WHERE id IN (
          SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY product_id, user_id ORDER BY created_at NULLS LAST, id) AS rn
            FROM reviews
          ) t
          WHERE t.rn > 1
        )
      `);
      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_product_user_unique
        ON reviews(product_id, user_id)
      `);
      console.log("[INFO] reviews(product_id, user_id) unique index ready");
    } catch (e) {
      console.warn("[WARN] reviews unique index migration:", e instanceof Error ? e.message : e);
    }

    // ─── Studio Preview Engine tables (AI Studio Preview Agent) ───
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS studio_preview_settings (
          id SERIAL PRIMARY KEY,
          gemini_model TEXT NOT NULL DEFAULT 'gemini-2.5-flash-image',
          first_free_enabled BOOLEAN NOT NULL DEFAULT true,
          preview_fee_price NUMERIC NOT NULL DEFAULT '100',
          preview_fee_cost NUMERIC NOT NULL DEFAULT '0',
          max_alternatives INTEGER NOT NULL DEFAULT 3,
          quick_preview_enabled BOOLEAN NOT NULL DEFAULT true,
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);
      await client.query(`
        INSERT INTO studio_preview_settings (id) VALUES (1)
        ON CONFLICT (id) DO NOTHING;
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS studio_preview_logs (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255),
          product_id INTEGER,
          product_name TEXT,
          logo_url TEXT,
          product_image_url TEXT,
          bag_color TEXT,
          print_color TEXT,
          text_content TEXT,
          business_type TEXT,
          generated_image_url TEXT,
          alternatives TEXT,
          is_quick_preview BOOLEAN NOT NULL DEFAULT false,
          model_used TEXT,
          generation_time_ms INTEGER,
          status TEXT NOT NULL DEFAULT 'success',
          error_message TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);
      console.log("[INFO] studio_preview tables ready");
    } catch (e) {
      console.warn("[WARN] studio_preview migration:", e instanceof Error ? e.message : e);
    }

    // ─── printing_ai_training ──────────────────────────────────────────────
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS printing_ai_training (
          id SERIAL PRIMARY KEY,
          type TEXT NOT NULL DEFAULT 'rule',
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          image_url TEXT,
          tags TEXT DEFAULT '',
          origin_market TEXT DEFAULT '',
          is_active BOOLEAN NOT NULL DEFAULT true,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);
      await client.query(`ALTER TABLE printing_ai_training ADD COLUMN IF NOT EXISTS tags TEXT DEFAULT ''`);
      await client.query(`ALTER TABLE printing_ai_training ADD COLUMN IF NOT EXISTS origin_market TEXT DEFAULT ''`);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_printing_ai_training_type
        ON printing_ai_training(type, is_active);
      `);
      console.log("[INFO] printing_ai_training table ready");
    } catch (e) {
      console.warn("[WARN] printing_ai_training migration:", e instanceof Error ? e.message : e);
    }

    console.log("[SUCCESS] Database migrations completed");
  } catch (error) {
    console.error("[WARN] Migration error (non-fatal):", error instanceof Error ? error.message : String(error));
  } finally {
    client.release();
  }
}
