import { pool as dbPool } from "./db";

export interface PricingSettings {
  staleProductDays: number;
  staleDiscountPercent: number;
  fastSellerThreshold: number;
  fastSellerUpliftPercent: number;
  protectMarginOnCoupons: boolean;
}

export async function getPricingSettings(): Promise<PricingSettings> {
  const r = await dbPool.query(
    `SELECT stale_product_days, stale_discount_percent, fast_seller_threshold,
            fast_seller_uplift_percent, protect_margin_on_coupons
     FROM display_settings ORDER BY id LIMIT 1`
  );
  const row = r.rows[0] || {};
  return {
    staleProductDays: Number(row.stale_product_days) || 60,
    staleDiscountPercent: Number(row.stale_discount_percent) || 10,
    fastSellerThreshold: Number(row.fast_seller_threshold) || 20,
    fastSellerUpliftPercent: Number(row.fast_seller_uplift_percent) || 5,
    protectMarginOnCoupons: row.protect_margin_on_coupons !== false,
  };
}

export interface StaleProduct {
  id: number;
  name: string;
  imageUrl: string;
  currentPrice: number;
  redLinePrice: number | null;
  greenLinePrice: number | null;
  daysSinceLastSale: number | null;
  totalSales30d: number;
  suggestedPrice: number;
  suggestedDiscount: number;
  marginAfter: number | null;
  isAllowed: boolean;
  reason?: string;
}

export interface FastSellerProduct {
  id: number;
  name: string;
  imageUrl: string;
  currentPrice: number;
  redLinePrice: number | null;
  greenLinePrice: number | null;
  totalSales30d: number;
  stock: number;
  suggestedPrice: number;
  suggestedUpliftPercent: number;
  marginBefore: number | null;
  marginAfter: number | null;
}

export interface Recommendations {
  stale: StaleProduct[];
  fastSellers: FastSellerProduct[];
  settings: PricingSettings;
}

export async function getRecommendations(limit = 30): Promise<Recommendations> {
  const settings = await getPricingSettings();

  const productsRes = await dbPool.query(`
    SELECT
      p.id, p.name, p.image_url, p.price::numeric AS current_price, p.stock,
      pc.red_line_price::numeric, pc.green_line_price::numeric,
      (
        SELECT COALESCE(SUM(oi.quantity), 0)::int
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE oi.product_id = p.id
          AND o.created_at >= NOW() - INTERVAL '30 days'
          AND o.status NOT IN ('cancelled')
      ) AS sales_30d,
      (
        SELECT EXTRACT(DAY FROM NOW() - MAX(o.created_at))::int
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE oi.product_id = p.id
          AND o.status NOT IN ('cancelled')
      ) AS days_since_last_sale
    FROM products p
    LEFT JOIN product_costs pc ON pc.product_id = p.id
    WHERE p.is_active = true
  `);

  const stale: StaleProduct[] = [];
  const fastSellers: FastSellerProduct[] = [];

  for (const row of productsRes.rows) {
    const currentPrice = Number(row.current_price);
    const redLine = row.red_line_price ? Number(row.red_line_price) : null;
    const greenLine = row.green_line_price ? Number(row.green_line_price) : null;
    const sales30d = Number(row.sales_30d) || 0;
    const daysSinceLastSale = row.days_since_last_sale != null ? Number(row.days_since_last_sale) : null;

    const isStale =
      sales30d === 0 &&
      (daysSinceLastSale === null || daysSinceLastSale >= settings.staleProductDays);

    if (isStale) {
      const discountedPrice = currentPrice * (1 - settings.staleDiscountPercent / 100);
      const marginAfter =
        redLine && redLine > 0
          ? Math.round(((discountedPrice - redLine) / redLine) * 1000) / 10
          : null;
      const isAllowed = redLine == null || discountedPrice >= redLine;

      stale.push({
        id: row.id,
        name: row.name,
        imageUrl: row.image_url,
        currentPrice,
        redLinePrice: redLine,
        greenLinePrice: greenLine,
        daysSinceLastSale,
        totalSales30d: sales30d,
        suggestedPrice: Math.round(discountedPrice),
        suggestedDiscount: settings.staleDiscountPercent,
        marginAfter,
        isAllowed,
        reason: !isAllowed ? "السعر المقترح أقل من خط التكلفة الأحمر" : undefined,
      });
    }

    const isFast = sales30d >= settings.fastSellerThreshold;
    if (isFast) {
      const upliftedPrice = currentPrice * (1 + settings.fastSellerUpliftPercent / 100);
      const marginBefore =
        redLine && redLine > 0
          ? Math.round(((currentPrice - redLine) / redLine) * 1000) / 10
          : null;
      const marginAfter =
        redLine && redLine > 0
          ? Math.round(((upliftedPrice - redLine) / redLine) * 1000) / 10
          : null;
      fastSellers.push({
        id: row.id,
        name: row.name,
        imageUrl: row.image_url,
        currentPrice,
        redLinePrice: redLine,
        greenLinePrice: greenLine,
        totalSales30d: sales30d,
        stock: Number(row.stock) || 0,
        suggestedPrice: Math.round(upliftedPrice),
        suggestedUpliftPercent: settings.fastSellerUpliftPercent,
        marginBefore,
        marginAfter,
      });
    }
  }

  stale.sort((a, b) => (b.daysSinceLastSale || 9999) - (a.daysSinceLastSale || 9999));
  fastSellers.sort((a, b) => b.totalSales30d - a.totalSales30d);

  return {
    stale: stale.slice(0, limit),
    fastSellers: fastSellers.slice(0, limit),
    settings,
  };
}

export interface PriceCheckResult {
  ok: boolean;
  status: "safe" | "warning" | "danger" | "no_data";
  marginPercent: number | null;
  redLine: number | null;
  greenLine: number | null;
  message: string;
}

export async function checkPrice(productId: number, newPrice: number): Promise<PriceCheckResult> {
  const r = await dbPool.query(
    `SELECT red_line_price::numeric AS red, green_line_price::numeric AS green
     FROM product_costs WHERE product_id = $1 LIMIT 1`,
    [productId]
  );
  if (!r.rows.length) {
    return {
      ok: true,
      status: "no_data",
      marginPercent: null,
      redLine: null,
      greenLine: null,
      message: "لا توجد بيانات تكلفة لهذا المنتج. يُنصح بإضافتها أولاً.",
    };
  }
  const red = Number(r.rows[0].red) || 0;
  const green = Number(r.rows[0].green) || 0;
  const margin = red > 0 ? Math.round(((newPrice - red) / red) * 1000) / 10 : null;

  if (red > 0 && newPrice < red) {
    return {
      ok: false,
      status: "danger",
      marginPercent: margin,
      redLine: red,
      greenLine: green,
      message: `السعر أقل من الخط الأحمر (${red.toLocaleString("ar-YE")} ر.ي). البيع بهذا السعر يعني خسارة!`,
    };
  }
  if (green > 0 && newPrice < green) {
    return {
      ok: true,
      status: "warning",
      marginPercent: margin,
      redLine: red,
      greenLine: green,
      message: `السعر تحت الخط الأخضر (${green.toLocaleString("ar-YE")} ر.ي). الربح أقل من الهدف.`,
    };
  }
  return {
    ok: true,
    status: "safe",
    marginPercent: margin,
    redLine: red,
    greenLine: green,
    message: "السعر آمن، الربح ضمن الهدف.",
  };
}

export interface CouponCheckResult {
  allowed: boolean;
  finalCustomerPrice: number;
  netProfit: number | null;
  marginPercent: number | null;
  warning?: string;
  reason?: string;
  affectedProducts: Array<{ id: number; name: string; reason: string }>;
}

export async function validateCouponAgainstCart(
  cartItems: Array<{ productId: number; price: number; quantity: number }>,
  discountPercent: number,
  marketerCommissionPercent: number
): Promise<CouponCheckResult> {
  const settings = await getPricingSettings();
  if (!settings.protectMarginOnCoupons) {
    return {
      allowed: true,
      finalCustomerPrice: 0,
      netProfit: null,
      marginPercent: null,
      affectedProducts: [],
    };
  }

  const productIds = Array.from(new Set(cartItems.map((c) => c.productId)));
  if (productIds.length === 0) {
    return {
      allowed: true,
      finalCustomerPrice: 0,
      netProfit: null,
      marginPercent: null,
      affectedProducts: [],
    };
  }

  const costsRes = await dbPool.query(
    `SELECT product_id, red_line_price::numeric AS red FROM product_costs WHERE product_id = ANY($1::int[])`,
    [productIds]
  );
  const costMap = new Map<number, number>();
  for (const c of costsRes.rows) {
    costMap.set(Number(c.product_id), Number(c.red) || 0);
  }

  const namesRes = await dbPool.query(
    `SELECT id, name FROM products WHERE id = ANY($1::int[])`,
    [productIds]
  );
  const nameMap = new Map<number, string>();
  for (const p of namesRes.rows) nameMap.set(Number(p.id), p.name);

  let totalCustomer = 0;
  let totalProfit = 0;
  const affected: Array<{ id: number; name: string; reason: string }> = [];

  for (const item of cartItems) {
    const red = costMap.get(item.productId);
    const customerPrice = item.price * (1 - discountPercent / 100);
    const marketerCut = item.price * (marketerCommissionPercent / 100);
    const netToStore = customerPrice - marketerCut;
    totalCustomer += customerPrice * item.quantity;

    if (red != null && red > 0) {
      totalProfit += (netToStore - red) * item.quantity;
      if (netToStore < red) {
        affected.push({
          id: item.productId,
          name: nameMap.get(item.productId) || `#${item.productId}`,
          reason: `السعر بعد الكوبون والعمولة (${Math.round(netToStore).toLocaleString("ar-YE")}) أقل من الحد الأحمر (${Math.round(red).toLocaleString("ar-YE")})`,
        });
      }
    }
  }

  if (affected.length > 0) {
    return {
      allowed: false,
      finalCustomerPrice: Math.round(totalCustomer),
      netProfit: Math.round(totalProfit),
      marginPercent: null,
      reason: `هذا الكوبون يؤدي لخسارة في ${affected.length} منتج. لحماية أرباح المتجر، تم رفض الكوبون.`,
      affectedProducts: affected,
    };
  }

  return {
    allowed: true,
    finalCustomerPrice: Math.round(totalCustomer),
    netProfit: Math.round(totalProfit),
    marginPercent: null,
    affectedProducts: [],
  };
}

export async function applyRecommendation(
  productId: number,
  newPrice: number,
  setOriginalPrice: boolean = true
): Promise<{ ok: boolean; product?: any; message: string }> {
  const cur = await dbPool.query(`SELECT id, price, original_price FROM products WHERE id=$1`, [productId]);
  if (!cur.rows.length) return { ok: false, message: "المنتج غير موجود" };
  const product = cur.rows[0];
  const currentPrice = Number(product.price);
  const newP = Math.max(0, Math.round(newPrice));

  let originalPriceUpdate = "";
  const params: any[] = [newP, productId];

  if (setOriginalPrice && newP < currentPrice && !product.original_price) {
    originalPriceUpdate = `, original_price = $3`;
    params.splice(2, 0, currentPrice);
  }

  const r = await dbPool.query(
    `UPDATE products SET price = $1${originalPriceUpdate}
     WHERE id = ${setOriginalPrice && newP < currentPrice && !product.original_price ? "$3" : "$2"}
     RETURNING id, name, price, original_price`,
    setOriginalPrice && newP < currentPrice && !product.original_price ? [newP, currentPrice, productId] : [newP, productId]
  );
  return {
    ok: true,
    product: r.rows[0],
    message: `تم تحديث سعر "${r.rows[0].name}" إلى ${newP.toLocaleString("ar-YE")} ر.ي`,
  };
}
