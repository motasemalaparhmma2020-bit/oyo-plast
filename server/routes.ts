import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./replit_integrations/auth/replitAuth";
import { registerAuthRoutes } from "./replit_integrations/auth/routes";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import sharp from "sharp";
import { adminLimiter, orderLimiter, loginLimiter, logSecurityEvent, getSecurityLogs } from "./security";

// ─── معالجة الصورة بالضغط والتقليص ─────────────────────────────────────────
async function processImage(
  buffer: Buffer,
  mimetype: string,
  opts?: { maxWidth?: number; maxHeight?: number; quality?: number }
): Promise<{ buffer: Buffer; mimeOut: string }> {
  const maxW = opts?.maxWidth ?? 1200;
  const maxH = opts?.maxHeight ?? 1200;
  const quality = opts?.quality ?? 80;
  try {
    const processed = await sharp(buffer)
      .resize(maxW, maxH, { fit: "inside", withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
    return { buffer: processed, mimeOut: "image/webp" };
  } catch {
    // fallback: return original if sharp fails
    return { buffer, mimeOut: mimetype };
  }
}

async function getImageSettings(dbPool: any) {
  try {
    const r = await dbPool.query("SELECT img_max_width, img_max_height, img_quality, img_max_size_mb FROM display_settings LIMIT 1");
    if (r.rows.length) return r.rows[0];
  } catch {}
  return { img_max_width: 1200, img_max_height: 1200, img_quality: 80, img_max_size_mb: 5 };
}

const rootDir = process.cwd();

/** تختار الحقول المعروفة فقط من كائن المصدر — تمنع ثغرة prototype pollution */
function pickFields(src: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const keySet = new Set(keys);
  return Object.fromEntries(
    Object.entries(src).filter(([k, v]) => keySet.has(k) && v !== undefined)
  );
}

// يعرّف ما إذا كان الرابط هو رابط بروكسي خفيف (نتجاهله في الحفظ كي لا تُمحى الصورة الأصلية)
function isProxyImageUrl(url: unknown): boolean {
  if (typeof url !== "string") return false;
  // نقبل الرابط مع أو بدون باراميتر ?v= بحيث لا يُحفظ مكان الصورة الأصلية
  return /^\/api\/(products|categories|subcategories|banners|offers)\/image\//.test(url.split('?')[0]);
}

// بصمة قصيرة (8 حروف) من رابط/محتوى الصورة — تُستخدم كـ cache-buster:
// عند تغيير الصورة في القاعدة يتغير الـ hash، فيتغير URL تلقائياً ويتجاوز كاش المتصفح/CDN.
function imgVer(content: unknown): string {
  if (typeof content !== "string" || !content) return "0";
  return crypto.createHash("md5").update(content).digest("hex").slice(0, 8);
}

// يبني رابط بروكسي للصورة المخزنة كـ base64 مع cache-buster
function proxyImg(type: "products" | "categories" | "subcategories", id: number, raw: string, sub?: string | number): string {
  const base = sub !== undefined ? `/api/${type}/image/${id}/${sub}` : `/api/${type}/image/${id}`;
  return `${base}?v=${imgVer(raw)}`;
}

// Keep uploads dir for design files only (not product images)
const uploadsDir = path.resolve(rootDir, "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Memory storage: images stored as base64 in DB (permanent, survives deploys)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only images are allowed"));
  },
});

// Supplier upload: allows up to 10MB (sharp will compress it)
const supplierUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only images are allowed"));
  },
});

// Design upload still uses disk (for larger files)
const designUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      const name = crypto.randomUUID() + ext;
      cb(null, name);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
});

function getAdminToken(): string {
  const secret = process.env.ADMIN_PASSWORD || "oyo-default";
  return crypto.createHmac("sha256", secret).update("oyo-admin-v1").digest("hex");
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.headers["x-admin-token"] as string;
  if (!token || token !== getAdminToken()) {
    return res.status(401).json({ message: "غير مصرح" });
  }
  next();
}

function generateSlug(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\u0600-\u06FFa-zA-Z0-9-]/g, "")
    .toLowerCase() + "-" + Date.now();
}

/**
 * استخراج معرّف المستخدم من كائن req.user
 * يدعم: Replit OIDC (claims.sub) + Email auth (claims.sub)
 */
function getUserId(user: any): string | undefined {
  if (!user) return undefined;
  // Replit OIDC + Email auth both store userId in claims.sub
  return user.claims?.sub ?? undefined;
}

// ═══════════════════════════════════════════════════════════════════════════
// 💰 Pricing Helpers — السعر يُحسب من الخيارات الذكية + سعر صرف ديناميكي
// ═══════════════════════════════════════════════════════════════════════════

let _cachedExchangeRate = 140;
let _lastExchangeRateFetch = 0;

/**
 * يقرأ سعر صرف الريال السعودي مقابل اليمني من جدول settings (key='exchange_rate')
 * مع تخزين مؤقت لمدة 60 ثانية لتقليل ضغط DB.
 */
export async function getExchangeRate(): Promise<number> {
  const now = Date.now();
  if (now - _lastExchangeRateFetch < 60_000) return _cachedExchangeRate;
  try {
    const { pool: dbPool } = await import("./db");
    const r = await dbPool.query(
      `SELECT value FROM settings WHERE key = 'exchange_rate' LIMIT 1`
    );
    if (r.rows.length && r.rows[0].value) {
      const v = parseFloat(String(r.rows[0].value));
      if (!isNaN(v) && v > 0) _cachedExchangeRate = v;
    }
  } catch { /* keep last cached value */ }
  _lastExchangeRateFetch = now;
  return _cachedExchangeRate;
}
export function getExchangeRateCached(): number { return _cachedExchangeRate; }
/** يُبطل الكاش ليُعاد جلب سعر الصرف من DB في الاستدعاء التالي */
export function invalidateExchangeRateCache(): void { _lastExchangeRateFetch = 0; }

/**
 * يحسب السعر/الخصم الأساسي من أرخص خيار ذكي.
 * مدخل: smartVariants كـ JSON string أو object بشكل { activeTypes, variants }.
 * مخرج: { price, priceSar, originalPrice, originalPriceSar, discountPercent } أو null إن فشل.
 */
export function computeBaseFromSmartVariants(
  smartVariants: any,
  exchangeRate: number
): {
  price: string; priceSar: string;
  originalPrice: string | null; originalPriceSar: string | null;
  discountPercent: number | null;
  costPriceY: string | null; costPriceSar: string | null;
} | null {
  try {
    const data = typeof smartVariants === "string" ? JSON.parse(smartVariants) : smartVariants;
    if (!data || !Array.isArray(data.variants) || data.variants.length === 0) return null;
    // فلترة المتغيّرات ذات السعر الصالح فقط
    const priced = data.variants
      .map((v: any) => {
        const p = parseFloat(String(v.price ?? "0"));
        const disc = v.discount != null ? parseFloat(String(v.discount)) : 0;
        const cost = v.costPriceY != null ? parseFloat(String(v.costPriceY)) : NaN;
        return { ...v, _price: p, _discount: isNaN(disc) ? 0 : disc, _cost: cost };
      })
      .filter((v: any) => !isNaN(v._price) && v._price > 0);
    if (priced.length === 0) return null;
    // الأرخص يحدّد السعر الأساسي
    priced.sort((a: any, b: any) => a._price - b._price);
    const cheapest = priced[0];
    const finalPrice = cheapest._price;
    const rate = exchangeRate > 0 ? exchangeRate : 140;
    const priceSar = (finalPrice / rate).toFixed(2);

    // الخصم على الـ variant الأرخص → السعر الأصلي = السعر / (1 - discount/100)
    let originalPrice: string | null = null;
    let originalPriceSar: string | null = null;
    let discountPercent: number | null = null;
    if (cheapest._discount > 0 && cheapest._discount < 100) {
      const orig = finalPrice / (1 - cheapest._discount / 100);
      originalPrice = orig.toFixed(2);
      originalPriceSar = (orig / rate).toFixed(2);
      discountPercent = Math.round(cheapest._discount);
    }

    // 💰 تكلفة الـ variant الأرخص (إذا أدخلها الأدمن)
    let costPriceY: string | null = null;
    let costPriceSar: string | null = null;
    if (!isNaN(cheapest._cost) && cheapest._cost > 0) {
      costPriceY = String(cheapest._cost);
      costPriceSar = (cheapest._cost / rate).toFixed(2);
    }

    return {
      price: String(finalPrice),
      priceSar,
      originalPrice,
      originalPriceSar,
      discountPercent,
      costPriceY,
      costPriceSar,
    };
  } catch {
    return null;
  }
}

/**
 * يستخرج تكلفة الشراء (costPriceY) لـ variant معيّن من smartVariants بناءً على
 * المقاس/اللون/لون الكيس المختار، أو يرجع تكلفة أرخص variant كاحتياط.
 * يُستخدم في snapshot التكلفة وقت إنشاء الطلب.
 */
export function pickCostFromSmartVariants(
  smartVariants: any,
  selected: { selectedSize?: string | null; selectedColor?: string | null; selectedBagColor?: string | null }
): number | null {
  try {
    const data = typeof smartVariants === "string" ? JSON.parse(smartVariants) : smartVariants;
    if (!data || !Array.isArray(data.variants) || data.variants.length === 0) return null;

    const wanted = [selected.selectedSize, selected.selectedColor, selected.selectedBagColor]
      .filter(Boolean)
      .map(s => String(s).trim().toLowerCase());

    // محاولة المطابقة الدقيقة (label يطابق أي خيار مختار)
    if (wanted.length > 0) {
      for (const v of data.variants) {
        const lbl = String(v.label || "").trim().toLowerCase();
        if (lbl && wanted.includes(lbl)) {
          const c = parseFloat(String(v.costPriceY ?? ""));
          if (!isNaN(c) && c > 0) return c;
        }
      }
    }

    // احتياط: أرخص variant بسعر بيع موجب وله تكلفة
    const priced = data.variants
      .map((v: any) => ({
        price: parseFloat(String(v.price ?? "0")),
        cost: parseFloat(String(v.costPriceY ?? "")),
      }))
      .filter((v: any) => !isNaN(v.price) && v.price > 0 && !isNaN(v.cost) && v.cost > 0);
    if (priced.length === 0) return null;
    priced.sort((a: any, b: any) => a.price - b.price);
    return priced[0].cost;
  } catch {
    return null;
  }
}

/**
 * 🔒 الحساب الموثوق لسعر الوحدة على الخادم (يمنع تلاعب العميل بـ unitPrice).
 * يعتمد على: smart_variants، Phase 4 overrides، printing_categories.
 * يُرجع unitPrice (السعر/الوحدة) + lineTotal (السطر الكامل) + breakdown.
 */
export async function computeServerUnitPrice(
  pid: number,
  item: any
): Promise<{ unitPrice: number; lineTotal: number; breakdown: any }> {
  const { pool: _pool } = await import("./db");
  const r = await _pool.query(
    `SELECT p.price, p.smart_variants, p.printing_price_per_unit,
            p.printing_design_fee_override, p.printing_color_price_override, p.printing_side_price_override,
            p.printing_category_id,
            pc.design_fee_per_mockup, pc.color_price_per_color, pc.price_per_side
       FROM products p
       LEFT JOIN printing_categories pc ON pc.id = p.printing_category_id
      WHERE p.id = $1`,
    [pid]
  );
  if (!r.rows.length) throw new Error(`المنتج ${pid} غير موجود`);
  const row = r.rows[0];

  const qty = Math.max(1, Number(item.quantity) || 1);
  const selectedSize = item.selectedSize ?? null;
  const selectedColor = item.selectedColor ?? null;
  const selectedBagColor = item.selectedBagColor ?? null;

  // (0) ─── Volume Offer Override (May 17, 2026) ───────────────────────────
  // إن كانت الكمية تقع ضمن عرض مفعّل لهذا المنتج، نُطبّق سعر العرض
  // (السعر شامل: يُلغي smart variants + Phase 4 + الطباعة القديمة)
  try {
    const { findActiveOfferForQuantity } = await import("./routes/volume-offers");
    const offer = await findActiveOfferForQuantity(pid, qty);
    if (offer && offer.offerPriceYer != null && offer.offerPriceYer >= 0) {
      const lineTotal = offer.offerPriceYer * qty;
      return {
        unitPrice: Math.round(offer.offerPriceYer * 100) / 100,
        lineTotal: Math.round(lineTotal * 100) / 100,
        breakdown: {
          basePrice: offer.offerPriceYer,
          proPrintingPerUnit: 0, customPrintingPerUnit: 0,
          phase4Total: 0, designFee: 0, colorTotal: 0, sideTotal: 0,
          qty, appliedOfferId: offer.id, appliedOfferLabel: offer.displayLabel,
          freeShipping: offer.hasFreeShipping, offerShippingFee: offer.shippingFeeYer,
        },
      };
    }
  } catch (e: any) {
    console.warn("[computeLineTotal volume-offer]", e?.message);
  }

  // (0.5) ─── Phase 7: Quantity Tiers Override ────────────────────────────
  // إن وجدت quantity_tiers يُحدّدها الأدمن، نطبّق سعر الـ tier المطابق للكمية.
  // المنطق: أعلى tier qty ≤ qty المطلوب → يربح. مثلاً ١٠٠/٥٠٠/١٠٠٠ كيس + qty=600 → tier ٥٠٠
  try {
    const rawTiers = row.quantity_tiers;
    const tiers = rawTiers
      ? (typeof rawTiers === "string" ? JSON.parse(rawTiers) : rawTiers)
      : null;
    if (Array.isArray(tiers) && tiers.length > 0) {
      const valid = tiers
        .filter((t: any) => t && Number(t.qty) > 0 && Number(t.unitPrice) > 0)
        .map((t: any) => ({ qty: Number(t.qty), unitPrice: Number(t.unitPrice), totalPrice: Number(t.totalPrice) || 0 }))
        .sort((a, b) => a.qty - b.qty);
      // أعلى tier qty ≤ qty المطلوب
      let matched = null;
      for (const t of valid) {
        if (qty >= t.qty) matched = t;
      }
      // إن كانت الكمية أقل من أصغر tier، نطبّق أصغر tier (لا نعاقب العميل)
      if (!matched && valid.length > 0) matched = valid[0];
      if (matched) {
        const lineTotal = matched.unitPrice * qty;
        return {
          unitPrice: Math.round(matched.unitPrice * 100) / 100,
          lineTotal: Math.round(lineTotal * 100) / 100,
          breakdown: {
            basePrice: matched.unitPrice,
            proPrintingPerUnit: 0, customPrintingPerUnit: 0,
            phase4Total: 0, designFee: 0, colorTotal: 0, sideTotal: 0,
            qty, appliedTierQty: matched.qty,
          },
        };
      }
    }
  } catch (e: any) {
    console.warn("[computeLineTotal quantity-tiers]", e?.message);
  }

  // (1) السعر الأساسي من smart_variants (أرخص متغير مطابق للـ label أو أرخص بالعموم)
  let basePrice = parseFloat(String(row.price ?? "0")) || 0;
  try {
    const sv = typeof row.smart_variants === "string" ? JSON.parse(row.smart_variants) : row.smart_variants;
    if (sv && Array.isArray(sv.variants) && sv.variants.length > 0) {
      // ── دعم تسميات متعدّدة في selectedSize (مثل "بندل 2 | XL") ──
      // العميل يُمرر تسميات smart variants المختارة مفصولة بـ " | "
      // لكي يطابق الخادم كل tokens (bundle + size + weight معاً).
      const splitTokens = (s: any): string[] =>
        s ? String(s).split("|").map((t: string) => t.trim().toLowerCase()).filter(Boolean) : [];
      const wanted = [
        ...splitTokens(selectedSize),
        ...splitTokens(selectedColor),
        ...splitTokens(selectedBagColor),
      ];
      let matched: any = null;
      if (wanted.length > 0) {
        for (const v of sv.variants) {
          const lbl = String(v.label || "").trim().toLowerCase();
          const pr = parseFloat(String(v.price ?? "0"));
          if (lbl && wanted.includes(lbl) && !isNaN(pr) && pr > 0) {
            if (!matched || pr < matched._price) matched = { ...v, _price: pr };
          }
        }
      }
      if (matched) {
        basePrice = matched._price;
      } else {
        const priced = sv.variants
          .map((v: any) => parseFloat(String(v.price ?? "0")))
          .filter((p: number) => !isNaN(p) && p > 0);
        if (priced.length > 0) basePrice = Math.min(...priced);
      }
    }
  } catch { /* ignore */ }

  // (2) Phase 4 — الطباعة الفورية (designFee + extras)
  let phase4Total = 0;
  let designFee = 0, colorTotal = 0, sideTotal = 0;
  if (item.customPrinting && item.designOptions) {
    let opts: any = null;
    try {
      opts = typeof item.designOptions === "string" ? JSON.parse(item.designOptions) : item.designOptions;
    } catch { opts = null; }
    if (opts && typeof opts === "object") {
      const colors = Math.max(1, parseInt(String(opts.colors ?? 1)) || 1);
      const sides = Math.max(1, parseInt(String(opts.sides ?? 1)) || 1);
      const dFee = Number(row.printing_design_fee_override ?? row.design_fee_per_mockup ?? 0) || 0;
      const pColor = Number(row.printing_color_price_override ?? row.color_price_per_color ?? 0) || 0;
      // ── Phase 4 v2: printingPerBag = colors × sides × pColor ; total = printingPerBag × qty + designFee
      // كل لون وكل وجه مدفوع. (لم نعد نستخدم pricePerSide كحقل منفصل.)
      const printingPerBag = colors * sides * pColor;
      designFee = dFee;
      colorTotal = printingPerBag * qty;
      sideTotal = 0; // legacy field — مُدمج داخل colorTotal الآن
      phase4Total = designFee + colorTotal;
    }
  }

  // (3) طباعة قديمة (per-unit) — فقط إن لا يوجد Phase 4
  let customPrintingPerUnit = 0;
  if (item.customPrinting && phase4Total === 0) {
    customPrintingPerUnit = Number(row.printing_price_per_unit ?? 0) || 0;
  }

  // (4) الطباعة الاحترافية (per-unit) — تعتمد على عرض/طول، مقبول مع حدّ علوي للسلامة
  let proPrintingPerUnit = Number(item.printingUnitPrice ?? 0) || 0;
  if (proPrintingPerUnit < 0) proPrintingPerUnit = 0;
  if (proPrintingPerUnit > 100000) proPrintingPerUnit = 0; // sanity cap

  const lineTotal = (basePrice + proPrintingPerUnit + customPrintingPerUnit) * qty + phase4Total;
  const unitPrice = lineTotal / qty;

  return {
    unitPrice: Math.max(0, Math.round(unitPrice * 100) / 100),
    lineTotal: Math.max(0, Math.round(lineTotal * 100) / 100),
    breakdown: { basePrice, proPrintingPerUnit, customPrintingPerUnit, phase4Total, designFee, colorTotal, sideTotal, qty },
  };
}

/**
 * Task 3: تحديث sold_count على المنتجات تلقائياً عند تسليم الطلب.
 * - direction "inc": يُزيد sold_count لكل عنصر بمقدار quantity ويضع orders.sold_count_incremented = true
 * - direction "dec": يُنقص sold_count (لإلغاء طلب تم تسليمه) ويُعيد الـflag إلى false
 * - يحمي من العدّ المضاعف عبر الـflag على الطلب.
 */
export async function recalcSoldCountForOrder(
  orderId: number,
  direction: "inc" | "dec"
): Promise<void> {
  try {
    const { pool: dbPool } = await import("./db");
    const orderRes = await dbPool.query(
      `SELECT sold_count_incremented FROM orders WHERE id=$1`,
      [orderId]
    );
    if (!orderRes.rows.length) return;
    const incremented = orderRes.rows[0].sold_count_incremented === true;
    if (direction === "inc" && incremented) return; // already counted
    if (direction === "dec" && !incremented) return; // nothing to undo

    const items = await dbPool.query(
      `SELECT product_id, quantity FROM order_items WHERE order_id=$1 AND product_id IS NOT NULL`,
      [orderId]
    );
    const sign = direction === "inc" ? 1 : -1;
    for (const it of items.rows) {
      const qty = Number(it.quantity || 0);
      if (qty <= 0) continue;
      if (direction === "inc") {
        await dbPool.query(
          `UPDATE products SET sold_count = COALESCE(sold_count,0) + $1 WHERE id = $2`,
          [qty, it.product_id]
        );
      } else {
        await dbPool.query(
          `UPDATE products SET sold_count = GREATEST(0, COALESCE(sold_count,0) - $1) WHERE id = $2`,
          [qty, it.product_id]
        );
      }
    }
    await dbPool.query(
      `UPDATE orders SET sold_count_incremented = $1 WHERE id = $2`,
      [direction === "inc", orderId]
    );
  } catch (e) {
    console.warn(`[recalcSoldCountForOrder] failed for order ${orderId}:`, e instanceof Error ? e.message : e);
  }
}

/**
 * Task 3: إعادة حساب rating + review_count من التقييمات المعتمدة فقط.
 * يُستدعى عند إنشاء/حذف/الموافقة على تقييم.
 */
export async function recalcProductRating(productId: number): Promise<void> {
  try {
    const { pool: dbPool } = await import("./db");
    const stats = await dbPool.query(
      `SELECT COALESCE(AVG(rating)::numeric(3,1), 5) AS avg_rating, COUNT(*) AS total
       FROM reviews WHERE product_id = $1 AND is_approved = TRUE`,
      [productId]
    );
    const row = stats.rows[0] || { avg_rating: 5, total: 0 };
    await dbPool.query(
      `UPDATE products SET rating = $1, review_count = $2 WHERE id = $3`,
      [row.avg_rating || 5, row.total || 0, productId]
    );
  } catch (e) {
    console.warn(`[recalcProductRating] failed for product ${productId}:`, e instanceof Error ? e.message : e);
  }
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<void> {
  await setupAuth(app);
  registerAuthRoutes(app);

  // ─── نظام الرسائل الموحّد ──────────────────────────────────────
  const { registerMessagingRoutes } = await import("./routes/messages-routes");
  registerMessagingRoutes(app, requireAdmin);

  // ─── نظام الائتمان والفئات (المرحلة 1) ─────────────────────────
  const { registerCreditRoutes } = await import("./routes/credit-routes");
  registerCreditRoutes(app, requireAdmin);

  // أوامر الشراء (المرحلة 1, مايو 2026)
  const { registerPurchaseOrderRoutes } = await import("./routes/purchase-orders");
  registerPurchaseOrderRoutes(app, requireAdmin);

  // ─── المهمة 8: نظام وكلاء الذكاء الاصطناعي (AI Agent Team) ─────
  const { registerAIAgentRoutes } = await import("./routes/ai-agents");
  registerAIAgentRoutes(app, requireAdmin);

  // ─── العروض التحفيزية حسب الكمية (Volume Offers — May 17, 2026) ─────
  const { registerVolumeOfferRoutes } = await import("./routes/volume-offers");
  registerVolumeOfferRoutes(app, requireAdmin);

  // ─── Cron: مهلة استجابة المورد + إعادة التعيين التلقائي (كل ١٥ دقيقة) ─────
  try {
    const cron = await import("node-cron");
    cron.schedule("*/15 * * * *", async () => {
      try {
        const { pool: dbPool } = await import("./db");
        const expired = await dbPool.query(`
          SELECT o.id, o.supplier_id, o.shipping_city, o.total, o.currency,
                 o.customer_name, o.customer_phone, o.customer_lat, o.customer_lng,
                 o.tried_supplier_ids, o.supplier_reassignment_count, o.supplier_amount,
                 COALESCE(s.response_timeout_hours, 24) AS timeout_hours
          FROM orders o
          LEFT JOIN suppliers s ON o.supplier_id = s.id
          WHERE o.supplier_response_status = 'pending'
            AND o.supplier_id IS NOT NULL
            AND o.status NOT IN ('cancelled','delivered','shipped','pending_admin')
            AND o.supplier_assigned_at IS NOT NULL
            AND o.supplier_assigned_at + (COALESCE(s.response_timeout_hours, 24) || ' hours')::interval < NOW()
          LIMIT 50
        `);
        if (expired.rows.length === 0) return;
        console.log(`[supplier-timeout] فحص ${expired.rows.length} طلب متأخر`);

        for (const o of expired.rows) {
          try {
            // مطالبة ذرّية بالطلب (atomic claim) — يمنع المعالجة المزدوجة من cron + /run-now
            const tried = Array.from(new Set([...(o.tried_supplier_ids || []), o.supplier_id]));
            const claim = await dbPool.query(
              `UPDATE orders
                 SET supplier_id=NULL, supplier_amount=NULL, platform_commission=NULL,
                     supplier_token=NULL, supplier_notified=false,
                     supplier_status='timed_out', supplier_response_status='timed_out',
                     supplier_reassignment_count = COALESCE(supplier_reassignment_count,0)+1,
                     tried_supplier_ids = $2::int[]
               WHERE id=$1 AND supplier_response_status='pending' AND supplier_id=$3
               RETURNING id`,
              [o.id, tried, o.supplier_id]
            );
            if (claim.rowCount === 0) {
              // عامل آخر تكفّل بهذا الطلب — تخطّ
              continue;
            }
            // عداد "طلبات فات وقتها" + استرجاع الرصيد من المورد السابق (مرة واحدة فقط)
            await dbPool.query(
              `UPDATE suppliers
                 SET missed_orders_count = COALESCE(missed_orders_count,0)+1,
                     total_sales = GREATEST(0, COALESCE(total_sales,0) - $1),
                     balance_due = GREATEST(0, COALESCE(balance_due,0) - $2)
               WHERE id=$3`,
              [Number(o.total || 0), Number(o.supplier_amount || 0), o.supplier_id]
            );
            // محاولة إعادة التعيين لمورد بديل (مع استبعاد المُجرَّبين)
            const r = await autoAssignSupplier(
              o.id, o.shipping_city || "", Number(o.total), o.currency || "YER",
              o.customer_name || "—", o.customer_phone || "",
              o.customer_lat ? Number(o.customer_lat) : undefined,
              o.customer_lng ? Number(o.customer_lng) : undefined,
              tried
            );
            if (!r.ok) {
              // لا يوجد بديل → تدخل الأدمن
              await dbPool.query(`UPDATE orders SET status='pending_admin' WHERE id=$1`, [o.id]);
              try {
                const { notifyStaff } = await import("./lib/staff-notify");
                await notifyStaff({
                  roles: ["order_manager", "owner"],
                  type: "order",
                  orderId: o.id,
                  title: `⚠️ طلب يحتاج تدخلاً يدوياً #${o.id}`,
                  message: `انتهت مهلة المورد ولا يوجد بديل متاح في ${o.shipping_city || "—"}`,
                  telegramText: `⚠️ <b>طلب #${o.id}</b> يحتاج تدخل أدمن — لا يوجد مورد بديل`,
                });
              } catch {}
              console.log(`[supplier-timeout] طلب #${o.id} → pending_admin`);
            } else {
              try {
                const { notifyStaff } = await import("./lib/staff-notify");
                await notifyStaff({
                  roles: ["order_manager", "owner"],
                  type: "order",
                  orderId: o.id,
                  title: `🔄 إعادة تعيين تلقائي للطلب #${o.id}`,
                  message: `المورد السابق #${o.supplier_id} لم يستجب — نُقل إلى مورد بديل`,
                });
              } catch {}
              console.log(`[supplier-timeout] طلب #${o.id} أُعيد تعيينه للمورد #${r.supplierId}`);
            }
          } catch (innerE: any) {
            console.warn(`[supplier-timeout] فشل معالجة الطلب #${o.id}:`, innerE.message);
          }
        }
      } catch (e: any) {
        console.warn("[supplier-timeout cron] خطأ:", e?.message);
      }
    });
    console.log("[INFO] تم جدولة فحص مهلة الموردين (كل ١٥ دقيقة)");
  } catch (e) {
    console.warn("[WARN] تعذّر جدولة cron لمهلة الموردين");
  }

  // ─── Cron: تحرير عمولات المسوقين تلقائياً (كل ساعة) ────────────────────
  try {
    const cron = await import("node-cron");
    cron.schedule("0 * * * *", async () => {
      try {
        const { pool: dbPool } = await import("./db");
        const r = await dbPool.query(
          `UPDATE marketer_commissions
           SET status='released', released_at=NOW()
           WHERE status='held' AND hold_until IS NOT NULL AND hold_until <= NOW()
           RETURNING id, marketer_id, commission_amount`
        );
        if (r.rows.length > 0) {
          console.log(`[commission-release] ✅ حُرّرت ${r.rows.length} عمولة`);
        }
      } catch (e: any) {
        console.warn("[commission-release cron] خطأ:", e?.message);
      }
    });
    console.log("[INFO] تم جدولة تحرير عمولات المسوقين (كل ساعة)");
  } catch (e) {
    console.warn("[WARN] تعذّر جدولة cron لتحرير العمولات");
  }

  // تقرير راشد التلقائي يومياً الساعة 8:00 صباحاً (تقويم اليمن)
  try {
    const cron = await import("node-cron");
    cron.schedule("0 8 * * *", async () => {
      try {
        const { generateCEOReport, getAgent, setLastReport } = await import("./agent-team");
        const rashed = await getAgent("rashed");
        if (!rashed) return;
        const report = await generateCEOReport({ asAgent: rashed });
        setLastReport(report);
        console.log(`[CEO Daily Report] ✅ تم توليد تقرير راشد التلقائي لـ ${report.date}`);
      } catch (e: any) {
        console.warn("[CEO Daily Report] فشل التوليد التلقائي:", e?.message);
      }
    });
    console.log("[INFO] تم جدولة تقرير راشد اليومي (8:00 صباحاً)");
  } catch (e) {
    console.warn("[WARN] تعذّر جدولة cron للتقرير اليومي");
  }

  // ─── Google Search Console Verification ──────────────────────────
  app.get("/google2bec18c5e7a1da83.html", (_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.send("google-site-verification: google2bec18c5e7a1da83.html");
  });

  // ─── Digital Asset Links (لربط تطبيق جوجل بلاي بالموقع) ──────────────
  // يتم تحديث sha256_cert_fingerprints بعد الحصول على التوقيع من Google Play Console
  app.get("/.well-known/assetlinks.json", (_req, res) => {
    const { PLAY_SIGNING_SHA256 } = process.env;
    const fingerprint = PLAY_SIGNING_SHA256 || "60:0A:3B:CB:4D:B4:76:23:15:60:96:E8:42:45:8A:46:F6:3B:51:7C:36:95:0F:BA:52:13:99:EB:81:19:14:E9";
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.json([{
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.oyoplast.app",
        sha256_cert_fingerprints: [fingerprint]
      }
    }]);
  });

  // ─── Dynamic Sitemap ─────────────────────────────────────────────
  app.get("/sitemap.xml", async (_req, res) => {
    try {
      const products = await storage.getProducts();
      const today = new Date().toISOString().split("T")[0];
      const staticPages = [
        { url: "/", priority: "1.0", changefreq: "daily" },
        { url: "/products", priority: "0.9", changefreq: "daily" },
        { url: "/printing", priority: "0.8", changefreq: "weekly" },
        { url: "/printing-and-design", priority: "0.7", changefreq: "weekly" },
        { url: "/about", priority: "0.6", changefreq: "monthly" },
        { url: "/terms", priority: "0.4", changefreq: "monthly" },
        { url: "/privacy", priority: "0.4", changefreq: "monthly" },
        { url: "/returns", priority: "0.4", changefreq: "monthly" },
      ];
      const productEntries = products.map(p =>
        `  <url>\n    <loc>https://oyoplast.com/products/${p.id}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n    <lastmod>${today}</lastmod>\n  </url>`
      ).join("\n");
      const staticEntries = staticPages.map(p =>
        `  <url>\n    <loc>https://oyoplast.com${p.url}</loc>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n    <lastmod>${today}</lastmod>\n  </url>`
      ).join("\n");
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${staticEntries}\n${productEntries}\n</urlset>`;
      res.setHeader("Content-Type", "application/xml");
      res.send(xml);
    } catch (e) {
      res.status(500).send("Error generating sitemap");
    }
  });

  // ─── Admin Login ─────────────────────────────────────────────────
  app.post("/api/admin/login", loginLimiter, async (req, res) => {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword || password !== adminPassword) {
      return res.status(401).json({ message: "كلمة المرور غير صحيحة" });
    }

    // ── المصادقة الثنائية (2FA): أرسل رمز واتساب للمدير ──
    const { createOtpSession, sendOtpViaWhatsapp } = await import("./admin-2fa");
    const ip = req.ip || "unknown";
    const { sessionId, code } = createOtpSession(ip);
    const sendResult = await sendOtpViaWhatsapp(code);

    if (!sendResult.sent) {
      // Fallback: إن فشل واتساب (Twilio معطّل أو رقم غير معرّف)، اسمح بالدخول مباشرة
      // هذا يضمن عدم قفل المدير خارج النظام عند مشكلة بنية تحتية
      console.warn("[2FA] WhatsApp send failed, falling back to direct login:", sendResult.reason);
      return res.json({ token: getAdminToken(), warning2fa: sendResult.reason });
    }

    // نجح الإرسال: المدير يجب أن يكتب الرمز ليحصل على التوكن
    res.json({
      requiresOtp: true,
      sessionId,
      message: "تم إرسال رمز التحقق إلى واتساب المدير. صالح لمدة 5 دقائق.",
    });
  });

  // ── 2FA: التحقق من رمز OTP ────────────────────────────────────────
  app.post("/api/admin/verify-otp", loginLimiter, async (req, res) => {
    const { sessionId, code } = req.body;
    if (!sessionId || !code) {
      return res.status(400).json({ message: "الجلسة والرمز مطلوبان" });
    }
    const { verifyOtp } = await import("./admin-2fa");
    const ip = req.ip || "unknown";
    const result = verifyOtp(String(sessionId), String(code), ip);
    if (!result.ok) {
      return res.status(401).json({ message: result.reason });
    }
    res.json({ token: getAdminToken() });
  });

  // ─── Image Upload - Base64 with sharp compression ─────────────────
  app.post("/api/admin/upload", requireAdmin, upload.single("image"), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "لم يتم رفع صورة" });
    try {
      // ─── Cloudinary upload (if configured) ──────────────────────────
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;
      if (cloudName && apiKey && apiSecret) {
        const { v2: cloudinary } = await import("cloudinary");
        cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
        const uploadRes: any = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "oyo-plast/products", resource_type: "image",
              transformation: [{ quality: "auto:best", fetch_format: "auto", width: 900, crop: "limit" }] },
            (err: any, result: any) => err ? reject(err) : resolve(result)
          );
          stream.end(req.file!.buffer);
        });
        return res.json({ imageUrl: uploadRes.secure_url, publicId: uploadRes.public_id, provider: "cloudinary" });
      }
      // ─── Fallback: base64 ────────────────────────────────────────────
      const { pool: dbPool } = await import("./db");
      const settings = await getImageSettings(dbPool);
      const { buffer, mimeOut } = await processImage(req.file.buffer, req.file.mimetype, {
        maxWidth: settings.img_max_width,
        maxHeight: settings.img_max_height,
        quality: settings.img_quality,
      });
      const base64 = buffer.toString("base64");
      const imageUrl = `data:${mimeOut};base64,${base64}`;
      res.json({ imageUrl, provider: "base64" });
    } catch (e: any) {
      const base64 = req.file.buffer.toString("base64");
      res.json({ imageUrl: `data:${req.file.mimetype};base64,${base64}`, provider: "base64" });
    }
  });

  // ─── Public Design Upload (customer logos) → Cloudinary ──────────────
  // يستقبل data URL ويُرجع رابط Cloudinary آمناً. حد ٨ ميجا.
  // مفتوح بدون auth لأن الزوّار يحتاجون رفع شعار قبل إكمال الطلب.
  app.post("/api/upload/design", async (req, res) => {
    try {
      const { imageDataUrl } = req.body || {};
      if (!imageDataUrl || typeof imageDataUrl !== "string") {
        return res.status(400).json({ message: "imageDataUrl مطلوب" });
      }
      const match = imageDataUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
      if (!match) return res.status(400).json({ message: "صيغة data URL غير صالحة" });
      const approxBytes = Math.floor(match[1].length * 0.75);
      if (approxBytes > 8 * 1024 * 1024) {
        return res.status(413).json({ message: "الصورة كبيرة جداً (الحد ٨ ميجا)" });
      }
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;
      if (!cloudName || !apiKey || !apiSecret) {
        return res.status(503).json({ message: "خدمة التخزين غير مهيّأة" });
      }
      const { v2: cloudinary } = await import("cloudinary");
      cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
      const uploadRes: any = await cloudinary.uploader.upload(imageDataUrl, {
        folder: "oyo-plast/designs",
        resource_type: "image",
        transformation: [{ quality: "auto:good", fetch_format: "auto", width: 1200, crop: "limit" }],
      });
      return res.json({ url: uploadRes.secure_url, publicId: uploadRes.public_id });
    } catch (e: any) {
      console.error("[design upload]", e?.message);
      return res.status(500).json({ message: "فشل رفع التصميم", details: e?.message });
    }
  });

  // ─── Image Upload for Staff (product_manager / owner) ────────────────
  // ملاحظة: نُعرِّفها هنا قبل تعريف requireStaff لتفادي مشاكل الترتيب،
  // لذلك نستخدم middleware مدمج يتحقق من الدور.
  app.post("/api/staff/upload", upload.single("image"), async (req: any, res) => {
    if (!req.file) return res.status(400).json({ message: "لم يتم رفع صورة" });
    try {
      // التحقق من جلسة الموظف ودوره
      const user = (req as any).user;
      if (!user?.claims?.sub) return res.status(401).json({ message: "يجب تسجيل الدخول" });
      const { db: dbI } = await import("./db");
      const { users: usersT } = await import("@shared/schema");
      const { eq: eqFn } = await import("drizzle-orm");
      const [dbUser] = await dbI.select({ role: usersT.role }).from(usersT).where(eqFn(usersT.id, user.claims.sub));
      const allowed = ["product_manager", "owner"];
      if (!dbUser || !allowed.includes(dbUser.role || "")) {
        return res.status(403).json({ message: "غير مصرح برفع الصور" });
      }
      // رفع إلى Cloudinary إن توفّر
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;
      if (cloudName && apiKey && apiSecret) {
        const { v2: cloudinary } = await import("cloudinary");
        cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
        const uploadRes: any = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "oyo-plast/products", resource_type: "image",
              transformation: [{ quality: "auto:best", fetch_format: "auto", width: 900, crop: "limit" }] },
            (err: any, result: any) => err ? reject(err) : resolve(result)
          );
          stream.end(req.file!.buffer);
        });
        return res.json({ imageUrl: uploadRes.secure_url, publicId: uploadRes.public_id, provider: "cloudinary" });
      }
      // Fallback: base64
      const { pool: dbPool } = await import("./db");
      const settings = await getImageSettings(dbPool);
      const { buffer, mimeOut } = await processImage(req.file.buffer, req.file.mimetype, {
        maxWidth: settings.img_max_width,
        maxHeight: settings.img_max_height,
        quality: settings.img_quality,
      });
      const base64 = buffer.toString("base64");
      res.json({ imageUrl: `data:${mimeOut};base64,${base64}`, provider: "base64" });
    } catch (e: any) {
      try {
        const base64 = req.file!.buffer.toString("base64");
        res.json({ imageUrl: `data:${req.file!.mimetype};base64,${base64}`, provider: "base64" });
      } catch {
        res.status(500).json({ message: "فشل رفع الصورة" });
      }
    }
  });

  // ─── Image Upload for Supplier (with compression, up to 10MB) ────────
  app.post("/api/supplier/upload", supplierUpload.single("image"), requireSupplier, async (req: any, res) => {
    if (!req.file) return res.status(400).json({ message: "لم يتم رفع صورة" });
    try {
      // ─── Cloudinary upload (if configured) ──────────────────────────
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;
      if (cloudName && apiKey && apiSecret) {
        const { v2: cloudinary } = await import("cloudinary");
        cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
        const uploadRes: any = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "oyo-plast/supplier", resource_type: "image",
              transformation: [{ quality: "auto:best", fetch_format: "auto", width: 900, crop: "limit" }] },
            (err: any, result: any) => err ? reject(err) : resolve(result)
          );
          stream.end(req.file!.buffer);
        });
        return res.json({ imageUrl: uploadRes.secure_url, publicId: uploadRes.public_id, provider: "cloudinary" });
      }
      // ─── Fallback: base64 ────────────────────────────────────────────
      const { pool: dbPool } = await import("./db");
      const settings = await getImageSettings(dbPool);
      const { buffer, mimeOut } = await processImage(req.file.buffer, req.file.mimetype, {
        maxWidth: settings.img_max_width,
        maxHeight: settings.img_max_height,
        quality: settings.img_quality,
      });
      const base64 = buffer.toString("base64");
      const imageUrl = `data:${mimeOut};base64,${base64}`;
      res.json({ imageUrl, provider: "base64" });
    } catch {
      const base64 = req.file.buffer.toString("base64");
      res.json({ imageUrl: `data:${req.file.mimetype};base64,${base64}`, provider: "base64" });
    }
  });

  // ─── Design Upload (Public) — يرفع إلى Cloudinary للاستمرارية في الإنتاج ─
  app.post("/api/upload/design", designUpload.single("design"), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "لم يتم رفع ملف" });
    try {
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;

      if (cloudName && apiKey && apiSecret) {
        const fs = await import("fs/promises");
        const { v2: cloudinary } = await import("cloudinary");
        cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });

        const originalName = req.file.originalname || "design";
        const safeBase = originalName.replace(/\.[^/.]+$/, "").replace(/[^\w\u0600-\u06FF.-]+/g, "_").slice(0, 80);
        const publicId = `oyo_designs/${Date.now()}_${safeBase}`;

        const uploadRes: any = await cloudinary.uploader.upload(req.file.path, {
          public_id: publicId,
          resource_type: "auto",
          use_filename: true,
          unique_filename: false,
          overwrite: true,
        });

        await fs.unlink(req.file.path).catch(() => {});

        return res.json({
          designUrl: uploadRes.secure_url,
          downloadUrl: uploadRes.secure_url.replace("/upload/", "/upload/fl_attachment/"),
          provider: "cloudinary",
          fileName: originalName,
          bytes: uploadRes.bytes,
        });
      }

      // Fallback to local disk only when Cloudinary not configured
      const designUrl = `/uploads/${req.file.filename}`;
      res.json({ designUrl, provider: "local" });
    } catch (error: any) {
      console.error("[design-upload] error:", error?.message || error);
      res.status(500).json({ message: "فشل في معالجة الملف", details: error?.message });
    }
  });

  // ─── Visual Search (Camera) — Gemini Vision ───────────────────────
  // العميل يرفع صورة منتج، Gemini يحلّلها ويُخرج كلمات بحث عربية
  // حماية معدّل بسيطة بالذاكرة: 6 طلبات / IP / دقيقة (لمنع استنزاف Gemini)
  const visualSearchLimits = new Map<string, { count: number; reset: number }>();
  const VS_WINDOW_MS = 60_000;
  const VS_MAX = 6;
  app.post("/api/visual-search", upload.single("image"), async (req, res) => {
    // فحص معدّل بسيط بالـ IP
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
            || req.socket.remoteAddress
            || "unknown";
    const now = Date.now();
    const rec = visualSearchLimits.get(ip);
    if (rec && now < rec.reset) {
      if (rec.count >= VS_MAX) {
        return res.status(429).json({
          message: "حاولت كثيراً. يرجى الانتظار دقيقة قبل البحث بصورة جديدة",
        });
      }
      rec.count++;
    } else {
      visualSearchLimits.set(ip, { count: 1, reset: now + VS_WINDOW_MS });
    }
    // تنظيف دوري للسجلات المنتهية (كل 100 طلب)
    if (visualSearchLimits.size > 200) {
      for (const [k, v] of visualSearchLimits.entries()) {
        if (v.reset < now) visualSearchLimits.delete(k);
      }
    }

    if (!req.file) {
      return res.status(400).json({ message: "لم يتم رفع صورة" });
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ message: "خدمة البحث بالكاميرا غير متاحة حالياً" });
    }
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });

      // ضغط الصورة قوي (512px + q65) لتسريع الإرسال + تقليل وقت Gemini
      const sharp = (await import("sharp")).default;
      const compressed = await sharp(req.file.buffer)
        .resize(512, 512, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 65, mozjpeg: true })
        .toBuffer();
      const base64 = compressed.toString("base64");

      // prompt واضح ومحدد = استجابة دقيقة + يتعامل مع لقطات الشاشة
      const prompt = `أنت محلل صور لمتجر تغليف يمني (أكياس، شنط بلاستيك/قماش/ورق، علاقي، تغليف، طباعة، آلات إغلاق).
انظر إلى الصورة (حتى لو كانت لقطة شاشة من تطبيق آخر) وركّز على المنتج الرئيسي فيها.
أرجع وصفاً مختصراً جداً (2 إلى 4 كلمات عربية) يحدّد:
- نوع المنتج (كيس / شنطة / علاقي / لفافة / علبة / آلة …)
- المادة (بلاستيك / قماش / ورق / كرتون / نايلون …) إن أمكن
- اللون أو الميزة الأبرز إن أمكن
أرجع الكلمات فقط بدون جمل أو ترقيم أو شرح أو أكواد.
إن كانت الصورة لا تحتوي أي منتج تغليف على الإطلاق (مثل سيارة، شخص، طبيعة)، أرجع: غير_معروف
أمثلة: "كيس بلاستيك شفاف" — "شنطة قماش حمراء" — "علاقي بلاستيك" — "كيس مكسرات شفاف" — "آلة إغلاق أكياس"`;

      // ✅ نماذج Gemini الحديثة (يناير 2026): القديمة gemini-2.0-flash و gemini-1.5-flash-latest
      // لم تعد متاحة لمفاتيح API الجديدة. نستخدم 2.5-flash كأساس + flash-latest كاحتياط.
      // ⏱ timeout صارم لكل محاولة: 8 ثوانٍ، إجمالاً لا يتجاوز 16 ثانية
      let result: any;
      const models = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.0-flash-lite"];
      let lastError: any = null;
      const MODEL_TIMEOUT_MS = 8000;
      for (const model of models) {
        try {
          result = await Promise.race([
            ai.models.generateContent({
              model,
              contents: [{
                role: "user",
                parts: [
                  { text: prompt },
                  { inlineData: { mimeType: "image/jpeg", data: base64 } },
                ],
              }],
              // maxOutputTokens=500 لأن 2.5-flash يستهلك tokens أكثر (thinking mode داخلي)
              // thinkingConfig.thinkingBudget=0 يُعطّل التفكير الداخلي → أسرع وأقل استهلاكاً
              config: {
                temperature: 0.2,
                maxOutputTokens: 500,
                thinkingConfig: { thinkingBudget: 0 },
              },
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error(`Gemini ${model} timeout بعد ${MODEL_TIMEOUT_MS}ms`)), MODEL_TIMEOUT_MS)
            ),
          ]);
          break;
        } catch (e: any) {
          lastError = e;
          console.warn(`[visual-search] فشل ${model}: ${String(e?.message || e).slice(0, 120)}`);
        }
      }

      // إذا فشل كل النماذج (timeout أو خطأ شبكة) → نرجع الأعلى مبيعاً كـ fallback
      // بدل ما نترك المستخدم على شاشة بيضاء
      if (!result) {
        console.warn("[visual-search] جميع النماذج فشلت، أرجع top-sellers");
        const fallback = await searchProductsByArabicTokens("");
        return res.json({
          keywords: "اقتراحات",
          recognized: true,
          fallback: true,
          products: fallback,
          productsCount: fallback.length,
        });
      }

      const raw = (result.text || "").trim();
      const keywords = raw
        .replace(/[`"'.,!؟?،:;()\[\]{}]/g, "")
        .replace(/\s+/g, " ")
        .trim();

      // فحص "غير معروف" أو إجابات مقطوعة تبدأ بـ "غير" (Gemini أحياناً يقص الإجابة)
      const isUnknown =
        !keywords ||
        keywords.length < 3 ||
        /^غير[_\s]?(معروف)?$/u.test(keywords) ||
        keywords.includes("غير_معروف") ||
        keywords.includes("غير معروف");

      if (isUnknown) {
        // بدل ما نعرض شاشة فارغة، نُرجع الأعلى مبيعاً كـ "اقتراحات قد تعجبك"
        const suggestions = await searchProductsByArabicTokens("");
        return res.json({
          keywords: "اقتراحات",
          recognized: true,
          fallback: true,
          message: "لم نتعرّف على المنتج بدقة، إليك اقتراحات",
          products: suggestions,
          productsCount: suggestions.length,
        });
      }

      console.log(`[visual-search] ✅ keywords: "${keywords}"`);

      // ─── بحث ذكي token-based عربي يُرجع المنتجات في نفس الاستجابة ───
      // نوفّر round-trip كامل بدمج Gemini + بحث المنتجات في طلب واحد
      const matchedProducts = await searchProductsByArabicTokens(keywords);

      const payload = {
        keywords,
        recognized: true,
        products: matchedProducts,
        productsCount: matchedProducts.length,
      };
      // 📏 لوغ حجم الـ response — يجب أن يكون < 5KB (بدلاً من 5MB قبل الإصلاح)
      const sizeKb = (Buffer.byteLength(JSON.stringify(payload), "utf8") / 1024).toFixed(1);
      console.log(`[visual-search] 📦 response: ${matchedProducts.length} منتج، حجم ${sizeKb}KB`);
      res.json(payload);
    } catch (e: any) {
      console.error("[visual-search] خطأ:", e?.message);
      res.status(500).json({
        message: "تعذّر تحليل الصورة، حاول مرة أخرى",
        error: e?.message,
      });
    }
  });

  // ─── بحث عربي ذكي: token-based + تطبيع + fallback ─────────────────
  // يُرجع منتجات تطابق أي token (ليس كلها) + إذا 0 نتائج يرجع الأعلى مبيعاً
  async function searchProductsByArabicTokens(keywords: string): Promise<any[]> {
    // ملاحظة: keywords فارغة = نُريد top sellers (fallback path) — لا نرفض!
    try {
      // ⚡ نستخدم SQL خفيف: نجلب فقط الأعمدة الضرورية للـ scoring
      // (بدون image_url/image_urls الثقيلين — نحضرهما لاحقاً للـ 6 المختارة فقط)
      // هذا يُخفّض الذاكرة من ~140MB لكل بحث إلى ~50KB
      const { pool: dbPool } = await import("./db");
      const lite = await dbPool.query(`
        SELECT id, name, description, tags, price,
               original_price AS "originalPrice",
               discount_percent AS "discount",
               stock, sold_count AS "soldCount",
               category_id AS "categoryId",
               COALESCE(rating, 0) AS "rating"
        FROM products
        WHERE is_active IS NOT FALSE
        ORDER BY id
      `);
      const allProducts: any[] = lite.rows;

      // تطبيع نص عربي: إزالة الهمزات + حركات + "ال" التعريف + المسافات الزائدة
      const normalize = (s: string) => (s || "")
        .toLowerCase()
        .replace(/[\u064B-\u065F\u0670]/g, "")  // إزالة الحركات
        .replace(/[إأآا]/g, "ا")                // توحيد الألف
        .replace(/[ى]/g, "ي")                   // ى → ي
        .replace(/[ؤ]/g, "و")                   // ؤ → و
        .replace(/[ئ]/g, "ي")                   // ئ → ي
        .replace(/[ة]/g, "ه")                   // ة → ه
        .replace(/^ال|\sال/g, " ")              // إزالة "ال" التعريف
        .replace(/[^\w\u0600-\u06FF\s]/g, " ")  // إزالة الرموز
        .replace(/\s+/g, " ")
        .trim();

      // Stop words عربية لا تفيد البحث
      const STOP = new Set(["و","في","من","على","عن","الى","إلى","ال","هذا","هذه","ذلك","تلك"]);

      const tokens = normalize(keywords)
        .split(" ")
        .filter(t => t.length >= 2 && !STOP.has(t));

      // ⚡ نجلب image_url فقط للـ IDs المختارة (6 منتجات) → استعلام واحد خفيف
      const fetchImagesFor = async (ids: number[]): Promise<Map<number, string>> => {
        if (ids.length === 0) return new Map();
        const r = await dbPool.query(
          `SELECT id, image_url FROM products WHERE id = ANY($1::int[])`,
          [ids]
        );
        const map = new Map<number, string>();
        for (const row of r.rows) {
          const url = row.image_url || "";
          // base64 → رابط خفيف عبر proxyImg الموجود (يستخدم imgVer/MD5)
          map.set(row.id, typeof url === "string" && url.startsWith("data:")
            ? proxyImg("products", row.id, url)
            : url);
        }
        return map;
      };

      const finalize = async (list: any[]) => {
        // ✅ زيادة الحد من 6 إلى 40 لتجربة أشبه بـ AliExpress
        const top = list.slice(0, 40);
        const imgs = await fetchImagesFor(top.map(p => p.id));
        return top.map(p => ({
          id: p.id, name: p.name, image: imgs.get(p.id) || "", price: p.price,
          originalPrice: p.originalPrice ?? null, discount: p.discount ?? null, stock: p.stock,
          categoryId: p.categoryId ?? null,
          rating: Number(p.rating) || 0,
        }));
      };

      // إذا ما فيه keywords (fallback) → نرجع الأعلى مبيعاً
      if (tokens.length === 0) {
        const topSellers = [...allProducts].sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0));
        return await finalize(topSellers);
      }

      // نسجّل كل منتج بعدد tokens المتطابقة → نرتّب تنازلياً
      const scored = allProducts.map((p) => {
        const haystack = normalize([
          p.name,
          p.description,
          ...(Array.isArray(p.tags) ? p.tags : []),
        ].filter(Boolean).join(" "));

        let score = 0;
        for (const tok of tokens) {
          if (haystack.includes(tok)) score++;
        }
        return { product: p, score };
      });

      let matched = scored
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(x => x.product);

      // Fallback 1: إذا 0 نتائج، نُجرّب البحث في نفس الفئة (إن وُجدت كلمة "كيس" نرجع كل الأكياس)
      if (matched.length === 0) {
        const broadTokens = ["كيس","اكياس","شنطه","شنطة","علاقي","علاق","تغليف","ورق","بلاستيك","قماش"];
        const found = broadTokens.find(bt => normalize(keywords).includes(normalize(bt)));
        if (found) {
          matched = allProducts.filter((p) => {
            const h = normalize([p.name, p.description, ...(Array.isArray(p.tags) ? p.tags : [])].filter(Boolean).join(" "));
            return h.includes(normalize(found));
          });
        }
      }

      // Fallback 2: لا يزال 0 → نرجع الأعلى مبيعاً كاقتراحات
      if (matched.length === 0) {
        matched = [...allProducts].sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0));
      }

      // ✅ نجلب الصور فقط للـ 6 المختارة (لا 125 منتج!) ثم نُرجع response خفيف
      return await finalize(matched);
    } catch (e) {
      console.error("[visual-search] search err:", (e as any)?.message);
      return [];
    }
  }

  // ─── فك قفل الترحيل بالقوة (admin only) ─────────────────────────────
  // يستخدم في حالة استثنائية: عملية ترحيل سابقة انقطعت لكن القفل بقي عالقاً
  // (مثل crash لـ instance قديم في autoscale)
  // ── Phase 2 UX: تنبيه الأدمن لمنتج بدون عروض كميات (May 18, 2026) ──────
  // مفتوح للعملاء لأنه يُستدعى تلقائياً من ProductDetail عند فتح منتج بدون عروض،
  // لكنه يستخدم throttling داخلي قوي (مرة كل ساعة لكل productId) لمنع الـ spam.
  const lastNotifyByProduct = new Map<number, number>();
  const NOTIFY_THROTTLE_MS = 60 * 60 * 1000; // ساعة
  app.post("/api/admin/notify-missing-volume-offers", async (req, res) => {
    try {
      const { productId, productName } = req.body || {};
      const pid = Number(productId);
      if (!Number.isFinite(pid) || pid <= 0) return res.status(400).json({ error: "invalid productId" });
      const name = String(productName || "").trim().slice(0, 200);
      if (!name) return res.status(400).json({ error: "missing productName" });
      // throttle: تجاهل بصمت إذا أُرسل تنبيه لنفس المنتج خلال آخر ساعة
      const last = lastNotifyByProduct.get(pid) || 0;
      const now = Date.now();
      if (now - last < NOTIFY_THROTTLE_MS) {
        return res.json({ ok: true, throttled: true });
      }
      // تحقق أن المنتج موجود فعلاً وأنه بلا عروض (دفاع ضد التزييف)
      const { pool } = await import("./db");
      const { rows: prodRows } = await pool.query(`SELECT id, name FROM products WHERE id=$1 LIMIT 1`, [pid]);
      if (prodRows.length === 0) return res.status(404).json({ error: "product not found" });
      const { rows: offerRows } = await pool.query(
        `SELECT 1 FROM product_volume_offers WHERE product_id=$1 AND is_active=true LIMIT 1`,
        [pid]
      );
      if (offerRows.length > 0) return res.json({ ok: true, hasOffers: true });
      lastNotifyByProduct.set(pid, now);
      const { notifyStaff } = await import("./lib/staff-notify");
      await notifyStaff({
        roles: ["owner", "product_manager"],
        title: "⚠️ منتج بدون عروض كميات",
        message: `المنتج "${prodRows[0].name}" (#${pid}) لا يحوي عروض كميات. يُعرض للعميل بسعر القطعة الأصلية فقط. يُنصح بإضافة عروض كميات.`,
        type: "system",
      });
      res.json({ ok: true });
    } catch (e: any) {
      console.error("notify-missing-volume-offers error:", e.message);
      res.status(500).json({ error: "notify failed" });
    }
  });

  app.post("/api/admin/migrate-base64-images/force-unlock", requireAdmin, async (_req, res) => {
    const LOCK_KEY = 4242042042;
    const { pool: dbPool } = await import("./db");
    const client = await dbPool.connect();
    try {
      // pg_advisory_unlock عادي يفك فقط على نفس الـ session
      // لكن نُحاول أيضاً terminate أي session تحمل القفل
      const locks = await client.query(`
        SELECT pid FROM pg_locks
        WHERE locktype = 'advisory' AND objid = $1
      `, [LOCK_KEY]);
      let terminated = 0;
      for (const r of locks.rows) {
        try {
          await client.query(`SELECT pg_terminate_backend($1)`, [r.pid]);
          terminated++;
        } catch { /* ignore */ }
      }
      res.json({ success: true, terminatedSessions: terminated, message: `تم فك القفل وإنهاء ${terminated} session` });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message });
    } finally {
      client.release();
    }
  });

  // ─── ترحيل صور base64 من DB إلى Cloudinary (admin only) ─────────────
  // لتشغيلها مرة واحدة على بيئة النشر:
  //   curl -X POST https://YOUR-DOMAIN/api/admin/migrate-base64-images \
  //        -H "x-admin-token: YOUR_TOKEN"
  // ترسل الـ progress عبر Server-Sent Events ثم ملخصاً نهائياً.
  // آمن للتشغيل عدة مرات (idempotent: يتخطى الصور التي ليست base64).
  app.post("/api/admin/migrate-base64-images", requireAdmin, async (_req, res) => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      return res.status(503).json({ message: "Cloudinary غير مضبوط في environment" });
    }

    // SSE setup — منع الـ buffering من proxies (nginx, replit deploy)
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();
    const send = (event: string, data: any) => {
      try {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch { /* socket مغلق */ }
    };
    // heartbeat كل 15ث يمنع proxy من قطع الاتصال أثناء uploads البطيئة
    const heartbeat = setInterval(() => {
      try { res.write(`: ping\n\n`); } catch { /* مغلق */ }
    }, 15000);
    // detect client disconnect → نوقف العملية
    let aborted = false;
    const onClose = () => { aborted = true; };
    res.on("close", onClose);
    const cleanup = () => {
      clearInterval(heartbeat);
      res.off("close", onClose);
    };

    const { pool: dbPool } = await import("./db");
    // 🔒 PostgreSQL advisory lock — يجب أن يكون على نفس الاتصال (session-level)
    // وإلا الـ unlock قد يصل لـ connection آخر فيبقى القفل عالقاً للأبد!
    // لذا نأخذ client مخصص من الـ pool ونحرّره في finally
    const LOCK_KEY = 4242042042;
    const lockClient = await dbPool.connect();
    let gotLock = false;
    try {
      const lockResult = await lockClient.query(`SELECT pg_try_advisory_lock($1) AS got`, [LOCK_KEY]);
      gotLock = !!lockResult.rows[0]?.got;
    } catch (e: any) {
      send("error", { msg: "تعذّر فحص القفل: " + e?.message });
      lockClient.release();
      cleanup();
      return res.end();
    }
    if (!gotLock) {
      send("error", { msg: "ترحيل آخر قيد التشغيل، انتظر انتهاءه أو أعد التشغيل لاحقاً" });
      lockClient.release();
      cleanup();
      return res.end();
    }

    try {
      const cloudinary = (await import("cloudinary")).v2;
      cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });

      const stats = { products: 0, productImageUrls: 0, categories: 0, categoryIcons: 0, subcategories: 0, banners: 0, offers: 0, failed: 0 };

      const uploadDataUrl = async (dataUrl: string, folder: string): Promise<string | null> => {
        try {
          const r = await cloudinary.uploader.upload(dataUrl, {
            folder: `oyoplast/${folder}`,
            resource_type: "image",
            quality: "auto:good",
            fetch_format: "auto",
          });
          return r.secure_url;
        } catch (e: any) {
          send("warn", { msg: `فشل رفع: ${e?.message?.slice(0, 100)}` });
          return null;
        }
      };

      // ── Products: نجلب IDs فقط (استعلام خفيف جداً)، ثم نفحص كل واحد ─
      // ⚠️ تجنّبنا EXISTS على unnest(image_urls) لأنه يقرأ 142MB في scan واحد!
      // الحل: نجلب 5 chars فقط من image_url عبر LEFT() لفلترة سريعة
      send("phase", { name: "products", msg: "بدء معالجة المنتجات..." });
      const idsToProcess = await dbPool.query(`
        SELECT id, name FROM products
        WHERE LEFT(COALESCE(image_url, ''), 5) = 'data:'
           OR (image_urls IS NOT NULL AND array_length(image_urls, 1) > 0)
        ORDER BY id
      `);
      let pIdx = 0;
      const totalP = idsToProcess.rows.length;
      send("phase", { name: "products", msg: `وُجد ${totalP} منتج للفحص` });
      for (const idRow of idsToProcess.rows) {
        if (aborted) { send("warn", { msg: "تم إيقاف العملية من العميل" }); break; }
        pIdx++;
        // نقسم القراءة: image_url + image_urls كل واحد لوحده
        // (بدلاً من جلب كل شيء معاً = ضغط ذاكرة)
        const r = await dbPool.query(
          `SELECT image_url, image_urls FROM products WHERE id = $1`, [idRow.id]
        );
        if (!r.rows.length) continue;
        const row = r.rows[0];

        if (typeof row.image_url === "string" && row.image_url.startsWith("data:")) {
          const url = await uploadDataUrl(row.image_url, "products");
          if (url) {
            await dbPool.query(`UPDATE products SET image_url = $1 WHERE id = $2`, [url, idRow.id]);
            stats.products++;
            send("progress", { phase: "products", current: pIdx, total: totalP, item: idRow.name, action: "main" });
          } else stats.failed++;
        }
        if (Array.isArray(row.image_urls) && row.image_urls.length) {
          const next: string[] = [];
          let changed = false;
          for (const u of row.image_urls) {
            if (aborted) break;
            if (typeof u === "string" && u.startsWith("data:")) {
              changed = true;
              const url = await uploadDataUrl(u, "products");
              if (url) { next.push(url); stats.productImageUrls++; }
              else { next.push(u); stats.failed++; }
            } else next.push(u);
          }
          if (changed && !aborted) {
            await dbPool.query(`UPDATE products SET image_urls = $1 WHERE id = $2`, [next, idRow.id]);
            send("progress", { phase: "products", current: pIdx, total: totalP, item: idRow.name, action: "extras" });
          }
        }
      }

      // ── Categories ──────────────────────────────────────────────
      if (!aborted) {
        send("phase", { name: "categories", msg: "بدء معالجة الأقسام..." });
        const cats = await dbPool.query(`
          SELECT id, name, image_url, icon_url FROM categories
          WHERE image_url LIKE 'data:%' OR icon_url LIKE 'data:%' ORDER BY id
        `);
        for (const row of cats.rows) {
          if (aborted) break;
          if (typeof row.image_url === "string" && row.image_url.startsWith("data:")) {
            const url = await uploadDataUrl(row.image_url, "categories");
            if (url) { await dbPool.query(`UPDATE categories SET image_url = $1 WHERE id = $2`, [url, row.id]); stats.categories++; }
            else stats.failed++;
          }
          if (typeof row.icon_url === "string" && row.icon_url.startsWith("data:")) {
            const url = await uploadDataUrl(row.icon_url, "categories/icons");
            if (url) { await dbPool.query(`UPDATE categories SET icon_url = $1 WHERE id = $2`, [url, row.id]); stats.categoryIcons++; }
            else stats.failed++;
          }
        }
      }

      // ── Subcategories ───────────────────────────────────────────
      if (!aborted) {
        send("phase", { name: "subcategories", msg: "بدء معالجة الأقسام الفرعية..." });
        try {
          const subs = await dbPool.query(`
            SELECT id, name, image_url FROM subcategories
            WHERE image_url LIKE 'data:%' ORDER BY id
          `);
          for (const row of subs.rows) {
            if (aborted) break;
            const url = await uploadDataUrl(row.image_url, "subcategories");
            if (url) { await dbPool.query(`UPDATE subcategories SET image_url = $1 WHERE id = $2`, [url, row.id]); stats.subcategories++; }
            else stats.failed++;
          }
        } catch (e: any) { send("warn", { msg: "تخطّي subcategories: " + e?.message?.slice(0, 80) }); }
      }

      // ── Banners + Offers (إن وُجدت) ─────────────────────────────
      for (const tableName of ["banners", "offers"] as const) {
        if (aborted) break;
        send("phase", { name: tableName, msg: `بدء معالجة ${tableName}...` });
        try {
          const exists = await dbPool.query(`SELECT to_regclass($1) as t`, [`public.${tableName}`]);
          if (!exists.rows[0]?.t) continue;
          const items = await dbPool.query(`
            SELECT id, image_url FROM ${tableName}
            WHERE image_url LIKE 'data:%' ORDER BY id
          `);
          for (const row of items.rows) {
            if (aborted) break;
            const url = await uploadDataUrl(row.image_url, tableName);
            if (url) {
              await dbPool.query(`UPDATE ${tableName} SET image_url = $1 WHERE id = $2`, [url, row.id]);
              if (tableName === "banners") stats.banners++; else stats.offers++;
            } else stats.failed++;
          }
        } catch (e: any) { send("warn", { msg: `تخطّي ${tableName}: ${e?.message?.slice(0, 80)}` }); }
      }

      // ── ملخص نهائي ───────────────────────────────────────────────
      const dbSize = await dbPool.query(`SELECT pg_size_pretty(pg_total_relation_size('products')) AS sz`);
      send("done", {
        stats,
        aborted,
        hint: "شغّل: VACUUM FULL products; لاسترداد المساحة بعد التأكد",
        currentDbSize: dbSize.rows[0]?.sz,
      });
    } catch (e: any) {
      send("error", { msg: e?.message || "خطأ غير معروف" });
    } finally {
      // تحرير الـ advisory lock على نفس الاتصال (إجباري وإلا يبقى عالقاً)
      try { await lockClient.query(`SELECT pg_advisory_unlock($1)`, [LOCK_KEY]); } catch {}
      try { lockClient.release(); } catch {}
      cleanup();
      try { res.end(); } catch {}
    }
  });

  // ─── Invoice Settings ─────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  // 🔍 Diagnostics — فحص شامل لكل المنتجات (صور/Cloudinary/ألوان/عروض)
  // ═══════════════════════════════════════════════════════════════════════════
  app.get("/api/admin/diagnostics", requireAdmin, async (req, res) => {
    try {
      const { pool: p } = await import("./db");
      const rows = (await p.query(`
        SELECT id, name, image_url, image_urls, base_image_public_id, available_colors,
               print_color_options, quantity_tiers, smart_variants, product_type, is_active
        FROM products
        ORDER BY id ASC
      `)).rows;

      const cloudName = process.env.CLOUDINARY_CLOUD_NAME || null;
      const host = `${req.protocol}://${req.get("host")}`;

      // SSRF guard: allow only same-host (relative) + Cloudinary + the app's public host
      const allowedHosts = new Set<string>([
        "res.cloudinary.com",
        (req.get("host") || "").toLowerCase(),
        "oyoplast.com",
        "www.oyoplast.com",
      ]);
      const isPrivateHost = (h: string) =>
        /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|169\.254\.|::1|fc|fd|0\.)/i.test(h);
      const checkUrl = async (u: string | null): Promise<{ ok: boolean; status: number | string; finalUrl?: string }> => {
        if (!u) return { ok: false, status: "empty" };
        try {
          let full: string;
          if (u.startsWith("http")) {
            const parsed = new URL(u);
            const host = parsed.hostname.toLowerCase();
            if (!/^https?:$/.test(parsed.protocol)) return { ok: false, status: "scheme_blocked" };
            if (isPrivateHost(host)) return { ok: false, status: "host_blocked" };
            if (!allowedHosts.has(host)) return { ok: false, status: "host_not_allowed" };
            full = u;
          } else {
            full = `${host}${u.startsWith("/") ? "" : "/"}${u}`;
          }
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 4000);
          const r = await fetch(full, { method: "HEAD", signal: ctrl.signal, redirect: "follow" });
          clearTimeout(timer);
          return { ok: r.ok, status: r.status, finalUrl: r.url };
        } catch (e: any) {
          return { ok: false, status: e?.name === "AbortError" ? "timeout" : "error" };
        }
      };

      const safeJson = (s: any): any => {
        if (!s) return null;
        if (typeof s === "object") return s;
        try { return JSON.parse(s); } catch { return "__INVALID__"; }
      };

      const results = await Promise.all(rows.map(async (r: any) => {
        const main = await checkUrl(r.image_url);
        const gallery = Array.isArray(r.image_urls) ? r.image_urls : [];
        const galleryChecks = await Promise.all(gallery.slice(0, 5).map((u: string) => checkUrl(u)));

        const ac = safeJson(r.available_colors);
        const acValid = Array.isArray(ac) && ac.every((c: any) => c?.id && c?.name && c?.code);

        const pco = safeJson(r.print_color_options);
        const pcoValid = !pco || (Array.isArray(pco) && pco.every((c: any) => c?.name && c?.hex));

        const qt = safeJson(r.quantity_tiers);
        const qtValid = !qt || (Array.isArray(qt) && qt.every((t: any) => Number(t?.qty) > 0 && Number(t?.totalPrice) > 0));

        const sv = safeJson(r.smart_variants);
        const svValid = !sv || (sv && Array.isArray(sv.variants));

        const hasCloudinary = !!(r.base_image_public_id && cloudName);
        const cloudinaryPreview = hasCloudinary
          ? `https://res.cloudinary.com/${cloudName}/image/upload/w_200,h_200,c_fit/${r.base_image_public_id}`
          : null;

        const cloudinaryCheck = cloudinaryPreview ? await checkUrl(cloudinaryPreview) : null;

        return {
          id: r.id,
          name: r.name,
          isActive: r.is_active,
          productType: r.product_type,
          mainImage: {
            url: r.image_url,
            ok: main.ok,
            status: main.status,
          },
          gallery: {
            count: gallery.length,
            checked: galleryChecks.length,
            broken: galleryChecks.filter(c => !c.ok).length,
          },
          cloudinary: {
            publicId: r.base_image_public_id || null,
            hasCloudName: !!cloudName,
            previewUrl: cloudinaryPreview,
            ok: cloudinaryCheck?.ok ?? null,
            status: cloudinaryCheck?.status ?? null,
          },
          availableColors: {
            present: !!r.available_colors,
            valid: acValid,
            count: Array.isArray(ac) ? ac.length : 0,
            raw: ac === "__INVALID__" ? "INVALID_JSON" : null,
          },
          printColorOptions: {
            present: !!r.print_color_options,
            valid: pcoValid,
            count: Array.isArray(pco) ? pco.length : 0,
          },
          quantityTiers: {
            present: !!r.quantity_tiers,
            valid: qtValid,
            count: Array.isArray(qt) ? qt.length : 0,
            data: Array.isArray(qt) ? qt : null,
          },
          smartVariants: {
            present: !!r.smart_variants,
            valid: svValid,
            count: sv?.variants?.length ?? 0,
            activeTypes: sv?.activeTypes ?? [],
          },
        };
      }));

      const summary = {
        totalProducts: results.length,
        activeProducts: results.filter(r => r.isActive).length,
        brokenMainImages: results.filter(r => !r.mainImage.ok).length,
        withCloudinary: results.filter(r => r.cloudinary.publicId).length,
        cloudinaryBroken: results.filter(r => r.cloudinary.publicId && r.cloudinary.ok === false).length,
        withAvailableColors: results.filter(r => r.availableColors.present).length,
        invalidColorsJson: results.filter(r => r.availableColors.raw === "INVALID_JSON").length,
        withTiers: results.filter(r => r.quantityTiers.present).length,
        cloudName: cloudName || "(not set)",
      };

      res.json({ summary, products: results });
    } catch (e: any) {
      console.error("[diagnostics]", e);
      res.status(500).json({ message: e?.message || "خطأ في الفحص" });
    }
  });

  app.get("/api/admin/invoice-settings", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query("SELECT value FROM settings WHERE key='invoice_settings'");
      if (result.rows.length) {
        res.json(JSON.parse(result.rows[0].value));
      } else {
        res.json({});
      }
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب إعدادات الفاتورة" });
    }
  });

  app.put("/api/admin/invoice-settings", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const value = JSON.stringify(req.body);
      await dbPool.query(
        `INSERT INTO settings (key, value) VALUES ('invoice_settings', $1)
         ON CONFLICT (key) DO UPDATE SET value=$1`,
        [value]
      );
      res.json(req.body);
    } catch (e: any) {
      res.status(500).json({ message: "فشل حفظ إعدادات الفاتورة" });
    }
  });

  // Public invoice settings (for invoice rendering)
  app.get("/api/invoice-settings", async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query("SELECT value FROM settings WHERE key='invoice_settings'");
      if (result.rows.length) res.json(JSON.parse(result.rows[0].value));
      else res.json({});
    } catch { res.json({}); }
  });

  // ─── Suppliers (الموردون/الموزعون) ──────────────────────────────────────────

  // ─── إشعار العميل عبر واتساب عند تغيير حالة الطلب ────────────────────────────
  async function notifyCustomerStatus(customerPhone: string, orderId: number, newStatus: string, extra?: { trackingNumber?: string; expectedShippingDate?: string }) {
    try {
      const trackLink = `https://oyoplast.com/track`;
      const messages: Record<string, string> = {
        confirmed: `✅ *تم تأكيد طلبك!*\n━━━━━━━━━━━━━━━━━━━━━\n🆔 رقم الطلب: *#${orderId}*\n${extra?.expectedShippingDate ? `📅 موعد الشحن: ${extra.expectedShippingDate}\n` : ""}سنبدأ تجهيز طلبك قريباً.\n🔗 تتبع طلبك: ${trackLink}\n━━━━━━━━━━━━━━━━━━━━━\n_أويو بلاست 🛍️_`,
        preparing:  `⚙️ *جاري تجهيز طلبك!*\n━━━━━━━━━━━━━━━━━━━━━\n🆔 رقم الطلب: *#${orderId}*\nطلبك قيد التجهيز والتعبئة الآن.\n🔗 تتبع طلبك: ${trackLink}\n━━━━━━━━━━━━━━━━━━━━━\n_أويو بلاست 🛍️_`,
        shipped:    `🚚 *تم شحن طلبك!*\n━━━━━━━━━━━━━━━━━━━━━\n🆔 رقم الطلب: *#${orderId}*\n${extra?.trackingNumber ? `📦 رقم التتبع: ${extra.trackingNumber}\n` : ""}طلبك في الطريق إليك.\n🔗 تتبع طلبك: ${trackLink}\n━━━━━━━━━━━━━━━━━━━━━\n_أويو بلاست 🛍️_`,
        delivered:  `🎉 *تم تسليم طلبك بنجاح!*\n━━━━━━━━━━━━━━━━━━━━━\n🆔 رقم الطلب: *#${orderId}*\nنتمنى أن ينال طلبك إعجابك. شكراً لثقتك! 💙\n⭐ قيّم منتجاتك: https://oyoplast.com/orders\n━━━━━━━━━━━━━━━━━━━━━\n_أويو بلاست 🛍️_`,
        cancelled:  `❌ *تم إلغاء طلبك*\n━━━━━━━━━━━━━━━━━━━━━\n🆔 رقم الطلب: *#${orderId}*\nللاستفسار تواصل معنا.\n━━━━━━━━━━━━━━━━━━━━━\n_أويو بلاست 🛍️_`,
      };
      const msg = messages[newStatus];
      if (!msg) return;

      // إرسال عبر UltraMSG أولاً
      const ultraResult = await sendUltraMsg(customerPhone, msg);
      if (ultraResult.ok) { console.log(`[notifyCustomer] UltraMSG sent order=${orderId} status=${newStatus}`); return; }

      // احتياطي: Twilio WhatsApp
      const phone = customerPhone.replace(/\s+/g, "").replace(/^00/, "+");
      if (!phone.startsWith("+")) return;
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_FROM_NUMBER;
      if (!accountSid || !authToken || !fromNumber) return;
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: "POST",
        headers: { Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: `whatsapp:${phone}`, From: `whatsapp:${fromNumber.replace(/^whatsapp:/i, "")}`, Body: msg }),
      });
    } catch (e: any) {
      console.error("Customer notification error:", e.message);
    }
  }

  // تحويل رقم الهاتف إلى صيغة UltraMSG (967XXXXXXXX@c.us)
  function toUltraMsgPhone(raw: string): string {
    let p = (raw || "").replace(/\s+/g, "").replace(/^00/, "").replace(/^\+/, "");
    if (p.startsWith("7") && p.length === 9) p = "967" + p;
    if (!p.startsWith("967") && p.length === 9) p = "967" + p;
    return p + "@c.us";
  }

  async function sendUltraMsg(phone: string, msg: string): Promise<{ ok: boolean; error?: string; details?: any }> {
    const instanceId = process.env.ULTRAMSG_INSTANCE_ID;
    const token = process.env.ULTRAMSG_TOKEN;
    if (!instanceId || !token) return { ok: false, error: "UltraMSG غير مُعدَّد (ULTRAMSG_INSTANCE_ID / ULTRAMSG_TOKEN)" };
    const to = toUltraMsgPhone(phone);
    const r = await fetch(`https://api.ultramsg.com/${instanceId}/messages/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token, to, body: msg, priority: "1" }),
    });
    const body = await r.json().catch(() => ({}));
    console.log(`[UltraMSG] to=${to} status=${r.status}`, JSON.stringify(body));
    if (body?.sent === "true" || body?.id) return { ok: true, details: body };
    return { ok: false, error: body?.error || body?.message || `HTTP ${r.status}`, details: body };
  }

  async function notifySupplier(supplierId: number, orderId: number, orderData: any): Promise<{ ok: boolean; channel: string; error?: string; details?: any }> {
    const { pool: dbPool } = await import("./db");
    try {
      const sup = await dbPool.query("SELECT * FROM suppliers WHERE id=$1", [supplierId]);
      if (!sup.rows.length) return { ok: false, channel: "none", error: "المورد غير موجود" };
      const supplier = sup.rows[0];
      const rawPhone = (supplier.phone || "").replace(/\s+/g, "").replace(/^00/, "+");
      if (!rawPhone) return { ok: false, channel: "whatsapp", error: "رقم المورد فارغ" };

      // توليد رمز خاص لبوابة المورد وحفظه
      const supplierToken = crypto.randomBytes(20).toString("hex");
      await dbPool.query("UPDATE orders SET supplier_token=$1, supplier_status='pending' WHERE id=$2", [supplierToken, orderId]);

      // جلب تفاصيل المنتجات من الطلب
      const itemsRes = await dbPool.query("SELECT product_name, quantity, price FROM order_items WHERE order_id=$1 ORDER BY id ASC", [orderId]);
      const itemsLines = itemsRes.rows.map((it: any) =>
        `  • ${it.product_name} × ${it.quantity} — ${Number(it.price * it.quantity).toLocaleString()} ${orderData.currency || "ر.ي"}`
      ).join("\n");

      const portalUrl = `https://oyoplast.com/supplier/order/${supplierToken}`;
      const totalItems = itemsRes.rows.reduce((s: number, it: any) => s + Number(it.quantity), 0);

      const msg = `📦 *طلب جديد مُوكَّل إليك!*\n━━━━━━━━━━━━━━━━━━━━━\n🆔 رقم الطلب: *#${orderId}*\n👤 العميل: ${orderData.customerName || "—"}\n📱 الجوال: ${orderData.customerPhone || "—"}\n📍 المدينة: ${orderData.shippingCity || "—"}\n📦 عدد المنتجات: ${totalItems} وحدة\n${itemsLines ? itemsLines + "\n" : ""}💰 *المبلغ المستحق لك: ${Number(orderData.supplierAmount || 0).toLocaleString()} ${orderData.currency || "ر.ي"}*\n━━━━━━━━━━━━━━━━━━━━━\n🔗 *استعرض الطلب وأكّد استلامه:*\n${portalUrl}\n━━━━━━━━━━━━━━━━━━━━━\n_أويو بلاست_`;

      // المحاولة الأولى: UltraMSG (واتساب)
      const ultraResult = await sendUltraMsg(rawPhone, msg);
      if (ultraResult.ok) {
        await dbPool.query("UPDATE orders SET supplier_notified=true WHERE id=$1", [orderId]);
        return { ok: true, channel: "whatsapp", details: ultraResult.details };
      }
      console.warn(`[notifySupplier] UltraMSG failed: ${ultraResult.error} — trying Twilio SMS fallback`);

      // المحاولة الثانية: Twilio SMS احتياطي
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = (process.env.TWILIO_FROM_NUMBER || "").replace(/^whatsapp:/i, "");
      if (accountSid && authToken && fromNumber) {
        let phone = rawPhone.replace(/^\+/, "");
        if (phone.startsWith("7") && phone.length === 9) phone = "+967" + phone;
        else phone = "+" + phone;
        const smsMsg = `OYO PLAST - Talab #${orderId} | ${orderData.customerName || ""} | ${orderData.shippingCity || ""} | ${Number(orderData.supplierAmount || 0).toLocaleString()} ${orderData.currency || "YER"} | oyoplast.com`;
        const smsResp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
          method: "POST",
          headers: { Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ To: phone, From: fromNumber, Body: smsMsg }),
        });
        const smsBody = await smsResp.json().catch(() => ({}));
        if (smsResp.ok) {
          await dbPool.query("UPDATE orders SET supplier_notified=true WHERE id=$1", [orderId]);
          return { ok: true, channel: "sms", details: smsBody };
        }
      }

      return { ok: false, channel: "whatsapp", error: ultraResult.error || "فشل إرسال الإشعار" };
    } catch (e: any) {
      console.error("Supplier notification error:", e.message);
      return { ok: false, channel: "whatsapp", error: e.message || "خطأ غير معروف" };
    }
  }

  // ─── Haversine: احتساب المسافة بين نقطتين جغرافيتين (كيلومتر) ──────────
  function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // دالة تعيين المورد تلقائياً: GPS أولاً ثم المدينة ثم الأقرب عموماً
  async function autoAssignSupplier(
    orderId: number, city: string, orderTotal: number, currency: string,
    customerName: string, customerPhone: string,
    customerLat?: number, customerLng?: number,
    excludeIds: number[] = []
  ): Promise<{ ok: boolean; supplierId?: number }> {
    try {
      const { pool: dbPool } = await import("./db");
      let supplier: any = null;
      let distanceKm: number | null = null;
      const excl = excludeIds.length ? excludeIds : [0]; // postgres needs non-empty array

      // ── المرحلة ١: GPS-based — أقرب موزع ضمن نطاق خدمته ──────────────
      if (customerLat && customerLng) {
        const gpsRes = await dbPool.query(
          `SELECT * FROM suppliers WHERE is_active=true AND lat IS NOT NULL AND lng IS NOT NULL AND NOT(id = ANY($1::int[]))`,
          [excl]
        );
        const withDist = gpsRes.rows.map((s: any) => ({
          ...s,
          _dist: haversineKm(customerLat!, customerLng!, Number(s.lat), Number(s.lng))
        }))
          .filter((s: any) => s._dist <= (s.service_radius_km || 20))
          .sort((a: any, b: any) => a._dist - b._dist);

        if (withDist.length > 0) {
          supplier = withDist[0];
          distanceKm = withDist[0]._dist;
        }
      }

      // ── المرحلة ٢: مطابقة المدينة — fallback ──────────────────────────
      if (!supplier && city) {
        const cityRes = await dbPool.query(
          `SELECT * FROM suppliers WHERE is_active=true AND $1=ANY(cities) AND NOT(id = ANY($2::int[])) ORDER BY id LIMIT 1`,
          [city, excl]
        );
        if (cityRes.rows.length) supplier = cityRes.rows[0];
      }

      // ── المرحلة ٣: أقرب موزع متاح بصرف النظر عن المسافة ───────────────
      if (!supplier && customerLat && customerLng) {
        const allRes = await dbPool.query(
          `SELECT * FROM suppliers WHERE is_active=true AND lat IS NOT NULL AND lng IS NOT NULL AND NOT(id = ANY($1::int[]))`,
          [excl]
        );
        if (allRes.rows.length) {
          const sorted = allRes.rows.map((s: any) => ({
            ...s,
            _dist: haversineKm(customerLat!, customerLng!, Number(s.lat), Number(s.lng))
          })).sort((a: any, b: any) => a._dist - b._dist);
          supplier = sorted[0];
          distanceKm = sorted[0]._dist;
        }
      }

      if (!supplier) return { ok: false }; // لا يوجد أي موزع نشط متاح

      const commissionRate = Number(supplier.commission_rate || 10);
      const platformCommission = orderTotal * commissionRate / 100;
      const supplierAmount = orderTotal - platformCommission;

      await dbPool.query(
        `UPDATE orders SET supplier_id=$1, supplier_amount=$2, platform_commission=$3,
           supplier_assigned_at=NOW(), supplier_response_status='pending'
         WHERE id=$4`,
        [supplier.id, supplierAmount.toFixed(2), platformCommission.toFixed(2), orderId]
      );
      await dbPool.query(
        `UPDATE suppliers SET total_sales=COALESCE(total_sales,0)+$1, balance_due=COALESCE(balance_due,0)+$2 WHERE id=$3`,
        [orderTotal, supplierAmount, supplier.id]
      );
      await notifySupplier(supplier.id, orderId, {
        customerName, customerPhone, shippingCity: city, supplierAmount, currency,
        distanceKm: distanceKm ? distanceKm.toFixed(1) : null
      });
      return { ok: true, supplierId: supplier.id };
    } catch (e: any) {
      console.error("Auto-assign supplier error:", e.message);
      return { ok: false };
    }
  }

  // جلب قائمة الموردين
  app.get("/api/admin/suppliers", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        `SELECT s.*, 
          (SELECT COUNT(*) FROM orders WHERE supplier_id=s.id) as total_orders,
          (SELECT COUNT(*) FROM orders WHERE supplier_id=s.id AND supplier_paid=false AND status NOT IN ('cancelled')) as unpaid_orders
         FROM suppliers s ORDER BY s.created_at DESC`
      );
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب الموردين" });
    }
  });

  // إضافة مورد جديد
  app.post("/api/admin/suppliers", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { name, phone, email, cities, commissionRate, notes, pin, type } = req.body;
      if (!name || !phone) return res.status(400).json({ message: "الاسم والهاتف مطلوبان" });
      const citiesArr = Array.isArray(cities) ? cities : (cities ? cities.split(",").map((c: string) => c.trim()) : []);
      const safeType = ["distributor", "vendor", "both"].includes(type) ? type : "distributor";
      const result = await dbPool.query(
        `INSERT INTO suppliers (name, phone, email, cities, commission_rate, notes, pin, type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [name, phone, email || null, citiesArr, commissionRate || 10, notes || null, pin || "1234", safeType]
      );
      res.json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل إضافة المورد" });
    }
  });

  // تعديل مورد
  app.put("/api/admin/suppliers/:id", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const id = parseInt(req.params.id);
      const { name, phone, email, cities, commissionRate, notes, isActive, pin, lat, lng, serviceRadiusKm, province, district, type } = req.body;
      const citiesArr = Array.isArray(cities) ? cities : (cities ? cities.split(",").map((c: string) => c.trim()) : []);
      const safeType = ["distributor", "vendor", "both"].includes(type) ? type : null;
      const result = await dbPool.query(
        `UPDATE suppliers SET name=$1, phone=$2, email=$3, cities=$4, commission_rate=$5, notes=$6, is_active=$7, pin=COALESCE($8, pin),
         lat=COALESCE($9, lat), lng=COALESCE($10, lng), service_radius_km=COALESCE($11, service_radius_km),
         province=COALESCE($12, province), district=COALESCE($13, district), type=COALESCE($14, type)
         WHERE id=$15 RETURNING *`,
        [name, phone, email || null, citiesArr, commissionRate || 10, notes || null, isActive !== false, pin || null,
         lat != null ? lat : null, lng != null ? lng : null, serviceRadiusKm || null,
         province || null, district || null, safeType, id]
      );
      if (!result.rows.length) return res.status(404).json({ message: "المورد غير موجود" });
      res.json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تعديل المورد" });
    }
  });

  // حذف مورد
  app.delete("/api/admin/suppliers/:id", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const id = parseInt(req.params.id);
      await dbPool.query("UPDATE suppliers SET is_active=false WHERE id=$1", [id]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: "فشل حذف المورد" });
    }
  });

  // طلبات مورد معين
  app.get("/api/admin/suppliers/:id/orders", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const id = parseInt(req.params.id);
      const result = await dbPool.query(
        `SELECT * FROM orders WHERE supplier_id=$1 ORDER BY created_at DESC LIMIT 100`,
        [id]
      );
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب الطلبات" });
    }
  });

  // تسجيل دفعة للمورد
  app.post("/api/admin/suppliers/:id/pay", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const supplierId = parseInt(req.params.id);
      const { amount, notes, orderIds, paymentMethod } = req.body;
      if (!amount || Number(amount) <= 0) return res.status(400).json({ message: "المبلغ مطلوب" });
      
      // سجّل الدفعة
      await dbPool.query(
        `INSERT INTO supplier_payments (supplier_id, amount, payment_method, notes) VALUES ($1, $2, $3, $4)`,
        [supplierId, amount, paymentMethod || null, notes || null]
      );
      // حدّث رصيد المورد
      await dbPool.query(
        `UPDATE suppliers SET balance_due=GREATEST(0, COALESCE(balance_due,0)-$1), total_paid=COALESCE(total_paid,0)+$1 WHERE id=$2`,
        [amount, supplierId]
      );
      // إذا أُرسلت أرقام طلبات، علّم عليها كمدفوعة
      if (Array.isArray(orderIds) && orderIds.length > 0) {
        await dbPool.query(
          `UPDATE orders SET supplier_paid=true WHERE id=ANY($1) AND supplier_id=$2`,
          [orderIds, supplierId]
        );
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: "فشل تسجيل الدفعة" });
    }
  });

  // ─── تسوية المورد: المورد ورّد مبلغاً للمنصة (دفعة COD أو غيرها) ─────────
  // POST /api/admin/suppliers/:id/settle  body: { amount, currency?, method?, notes?, orderIds? }
  app.post("/api/admin/suppliers/:id/settle", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const supplierId = parseInt(req.params.id);
      const { amount, currency, method, notes, orderIds } = req.body || {};
      if (!amount || Number(amount) <= 0) return res.status(400).json({ message: "المبلغ مطلوب وأكبر من صفر" });

      const supRes = await dbPool.query("SELECT id, name FROM suppliers WHERE id=$1", [supplierId]);
      if (!supRes.rows.length) return res.status(404).json({ message: "المورد غير موجود" });

      const remRes = await dbPool.query(
        `INSERT INTO supplier_remittances (supplier_id, amount, currency, method, notes, recorded_by, order_ids)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [supplierId, Number(amount), currency || "YER", method || null, notes || null, "admin", Array.isArray(orderIds) ? orderIds : []]
      );
      await dbPool.query(
        `UPDATE suppliers SET balance_due=GREATEST(0, COALESCE(balance_due,0) - $1), total_paid=COALESCE(total_paid,0) + $1 WHERE id=$2`,
        [Number(amount), supplierId]
      );
      try {
        const { notifyStaff } = await import("./lib/staff-notify");
        await notifyStaff({
          roles: ["finance", "owner"],
          type: "order",
          title: `💰 توريد من مورد #${supplierId}`,
          message: `${supRes.rows[0].name} ورّد ${Number(amount).toLocaleString()} ${currency || "ر.ي"}${method ? " · " + method : ""}`,
        });
      } catch {}
      res.json({ success: true, remittance: remRes.rows[0] });
    } catch (e: any) {
      console.error("[settle] error:", e.message);
      res.status(500).json({ message: "فشل تسجيل التوريد" });
    }
  });

  // قائمة التوريدات لمورد
  app.get("/api/admin/suppliers/:id/remittances", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(
        "SELECT * FROM supplier_remittances WHERE supplier_id=$1 ORDER BY paid_at DESC LIMIT 100",
        [parseInt(req.params.id)]
      );
      res.json(r.rows);
    } catch {
      res.status(500).json({ message: "فشل الجلب" });
    }
  });

  // تحديث مهلة الاستجابة لكل مورد
  app.patch("/api/admin/suppliers/:id/timeout", requireAdmin, async (req, res) => {
    try {
      const hours = parseInt(req.body?.hours);
      if (!hours || hours < 1 || hours > 168) return res.status(400).json({ message: "المهلة يجب أن تكون بين 1 و 168 ساعة" });
      const { pool: dbPool } = await import("./db");
      await dbPool.query("UPDATE suppliers SET response_timeout_hours=$1 WHERE id=$2", [hours, parseInt(req.params.id)]);
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "فشل التحديث" });
    }
  });

  // تشغيل فحص مهلة الموردين يدوياً (للاختبار + للأدمن)
  app.post("/api/admin/supplier-timeout/run-now", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const expired = await dbPool.query(`
        SELECT o.id, o.supplier_id, o.shipping_city, o.total, o.currency,
               o.customer_name, o.customer_phone, o.customer_lat, o.customer_lng,
               o.tried_supplier_ids, o.supplier_amount
        FROM orders o
        LEFT JOIN suppliers s ON o.supplier_id = s.id
        WHERE o.supplier_response_status = 'pending'
          AND o.supplier_id IS NOT NULL
          AND o.status NOT IN ('cancelled','delivered','shipped','pending_admin')
          AND o.supplier_assigned_at IS NOT NULL
          AND o.supplier_assigned_at + (COALESCE(s.response_timeout_hours, 24) || ' hours')::interval < NOW()
        LIMIT 50
      `);
      const results: any[] = [];
      for (const o of expired.rows) {
        const tried = Array.from(new Set([...(o.tried_supplier_ids || []), o.supplier_id]));
        // مطالبة ذرّية (atomic claim)
        const claim = await dbPool.query(
          `UPDATE orders SET supplier_id=NULL, supplier_amount=NULL, platform_commission=NULL, supplier_token=NULL, supplier_notified=false,
             supplier_status='timed_out', supplier_response_status='timed_out',
             supplier_reassignment_count = COALESCE(supplier_reassignment_count,0)+1, tried_supplier_ids = $2::int[]
           WHERE id=$1 AND supplier_response_status='pending' AND supplier_id=$3 RETURNING id`,
          [o.id, tried, o.supplier_id]
        );
        if (claim.rowCount === 0) { results.push({ orderId: o.id, action: "skipped_already_processed" }); continue; }
        await dbPool.query(
          `UPDATE suppliers SET missed_orders_count = COALESCE(missed_orders_count,0)+1,
             total_sales=GREATEST(0, COALESCE(total_sales,0)-$1), balance_due=GREATEST(0, COALESCE(balance_due,0)-$2) WHERE id=$3`,
          [Number(o.total || 0), Number(o.supplier_amount || 0), o.supplier_id]
        );
        const r = await autoAssignSupplier(
          o.id, o.shipping_city || "", Number(o.total), o.currency || "YER",
          o.customer_name || "—", o.customer_phone || "",
          o.customer_lat ? Number(o.customer_lat) : undefined,
          o.customer_lng ? Number(o.customer_lng) : undefined,
          tried
        );
        if (!r.ok) {
          await dbPool.query(`UPDATE orders SET status='pending_admin' WHERE id=$1`, [o.id]);
          results.push({ orderId: o.id, action: "pending_admin" });
        } else {
          results.push({ orderId: o.id, action: "reassigned", newSupplierId: r.supplierId });
        }
      }
      res.json({ checked: expired.rows.length, results });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // قائمة الطلبات التي تحتاج تدخل أدمن
  app.get("/api/admin/orders/pending-admin", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(`
        SELECT o.id, o.customer_name, o.customer_phone, o.shipping_city, o.total, o.currency,
               o.created_at, o.status, o.supplier_reassignment_count, o.tried_supplier_ids
        FROM orders o
        WHERE o.status='pending_admin'
        ORDER BY o.created_at DESC LIMIT 200
      `);
      res.json(r.rows);
    } catch {
      res.status(500).json({ message: "فشل الجلب" });
    }
  });

  // ─── نقاط تفتيش مالية حرجة (صحة مالية 1.0) ─────────────────────────
  app.get("/api/admin/financial-alerts", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const alerts: any[] = [];

      // 1. موردون فاتت مهلتهم (طلبات متأخرة)
      const timedOut = await dbPool.query(`
        SELECT o.id, o.customer_name, o.shipping_city, o.total, o.currency,
               o.supplier_id, s.name AS supplier_name,
               o.supplier_assigned_at, o.supplier_reassignment_count
        FROM orders o
        LEFT JOIN suppliers s ON o.supplier_id = s.id
        WHERE o.supplier_response_status = 'timed_out'
          AND o.status NOT IN ('cancelled', 'delivered', 'completed')
        ORDER BY o.supplier_assigned_at DESC LIMIT 20
      `);
      for (const row of timedOut.rows) {
        alerts.push({
          id: `timeout-${row.id}`,
          type: "supplier_timeout",
          priority: "high",
          title: `⏰ انتهت مهلة المورد للطلب #${row.id}`,
          message: `${row.supplier_name || "مورد مشاوي"} في ${row.shipping_city || "—"} — ${Number(row.total || 0).toLocaleString()} ${row.currency || "ر.ي"}`,
          orderId: row.id,
          supplierId: row.supplier_id,
          createdAt: row.supplier_assigned_at,
        });
      }

      // 2. طلبات بدون مورد متاح (بانتظار الأدمن)
      const pendingAdmin = await dbPool.query(`
        SELECT o.id, o.customer_name, o.shipping_city, o.total, o.currency,
               o.created_at, o.supplier_reassignment_count
        FROM orders o
        WHERE o.status = 'pending_admin'
        ORDER BY o.created_at DESC LIMIT 20
      `);
      for (const row of pendingAdmin.rows) {
        alerts.push({
          id: `pending-admin-${row.id}`,
          type: "pending_admin",
          priority: "high",
          title: `⚠️ طلب #${row.id} يحتاج تدخل أدمن`,
          message: `${row.customer_name || "—"} في ${row.shipping_city || "—"} — ${Number(row.total || 0).toLocaleString()} ${row.currency || "ر.ي"}`,
          orderId: row.id,
          createdAt: row.created_at,
        });
      }

      // 3. عمولات مسوقين معلقة (لم تتحرر بعد المهلة)
      const heldCommissions = await dbPool.query(`
        SELECT mc.id, mc.marketer_id, mc.order_id, mc.commission_amount, mc.currency,
               mc.hold_until, mc.created_at,
               COALESCE(u.full_name, sm.name) AS marketer_name
        FROM marketer_commissions mc
        LEFT JOIN users u ON mc.marketer_id = u.id
        LEFT JOIN standalone_marketers sm ON sm.phone = mc.marketer_id
        WHERE mc.status = 'held' AND mc.hold_until <= NOW() + INTERVAL '24 hours'
        ORDER BY mc.hold_until ASC LIMIT 20
      `);
      for (const row of heldCommissions.rows) {
        alerts.push({
          id: `commission-${row.id}`,
          type: "commission_overdue",
          priority: "normal",
          title: `💰 عمولة مسوق معلقة #${row.id}`,
          message: `${row.marketer_name || "مسوق"} — ${Number(row.commission_amount || 0).toLocaleString()} ${row.currency || "ر.ي"} (طلب #${row.order_id})`,
          orderId: row.order_id,
          createdAt: row.hold_until,
        });
      }

      // 4. موردون برصيد مستحقة عالية
      const highBalance = await dbPool.query(`
        SELECT s.id, s.name, s.balance_due, s.total_sales, s.missed_orders_count,
               (SELECT COUNT(*) FROM orders WHERE supplier_id = s.id AND status NOT IN ('cancelled', 'delivered', 'completed')) AS active_orders
        FROM suppliers s
        WHERE s.balance_due > 50000
        ORDER BY s.balance_due DESC LIMIT 10
      `);
      for (const row of highBalance.rows) {
        alerts.push({
          id: `balance-${row.id}`,
          type: "supplier_high_balance",
          priority: row.balance_due > 200000 ? "high" : "normal",
          title: `💸 رصيد عالي للمورد ${row.name}`,
          message: `مستحق: ${Number(row.balance_due || 0).toLocaleString()} ر.ي · طلبات نشطة: ${row.active_orders || 0} · فائت: ${row.missed_orders_count || 0}`,
          supplierId: row.id,
          createdAt: new Date(),
        });
      }

      // 5. طلبات بدفع للموردين (مدفوعة)
      const unpaidSuppliers = await dbPool.query(`
        SELECT o.id, o.customer_name, o.supplier_id, s.name AS supplier_name,
               o.supplier_amount, o.currency, o.created_at
        FROM orders o
        LEFT JOIN suppliers s ON o.supplier_id = s.id
        WHERE o.supplier_paid = false
          AND o.status IN ('delivered', 'completed')
          AND o.supplier_id IS NOT NULL
        ORDER BY o.created_at ASC LIMIT 20
      `);
      for (const row of unpaidSuppliers.rows) {
        alerts.push({
          id: `unpaid-${row.id}`,
          type: "supplier_unpaid",
          priority: "normal",
          title: `🔴 طلب #${row.id} مدفوع للمورد`,
          message: `${row.supplier_name || "مورد"} — ${Number(row.supplier_amount || 0).toLocaleString()} ${row.currency || "ر.ي"}`,
          orderId: row.id,
          supplierId: row.supplier_id,
          createdAt: row.created_at,
        });
      }

      res.json({
        total: alerts.length,
        highPriority: alerts.filter((a: any) => a.priority === "high").length,
        alerts,
      });
    } catch (e: any) {
      console.error("[financial-alerts] error:", e.message);
      res.status(500).json({ message: "فشل الجلب" });
    }
  });

  // تعيين مورد يدوياً لطلب
  app.put("/api/admin/orders/:id/assign-supplier", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const orderId = parseInt(req.params.id);
      const { supplierId } = req.body;
      const orderRes = await dbPool.query("SELECT * FROM orders WHERE id=$1", [orderId]);
      if (!orderRes.rows.length) return res.status(404).json({ message: "الطلب غير موجود" });
      const order = orderRes.rows[0];
      const supRes = await dbPool.query("SELECT * FROM suppliers WHERE id=$1", [supplierId]);
      if (!supRes.rows.length) return res.status(404).json({ message: "المورد غير موجود" });
      const supplier = supRes.rows[0];
      const orderTotal = Number(order.total);
      const commRate = Number(supplier.commission_rate || 10);
      const platformCommission = orderTotal * commRate / 100;
      const supplierAmount = orderTotal - platformCommission;

      // إذا كان هناك مورد قديم، اطرح من رصيده
      if (order.supplier_id && order.supplier_id !== supplierId) {
        await dbPool.query(
          `UPDATE suppliers SET total_sales=GREATEST(0, COALESCE(total_sales,0)-$1), balance_due=GREATEST(0, COALESCE(balance_due,0)-$2) WHERE id=$3`,
          [orderTotal, Number(order.supplier_amount || 0), order.supplier_id]
        );
      }
      await dbPool.query(
        `UPDATE orders SET supplier_id=$1, supplier_amount=$2, platform_commission=$3, supplier_notified=false WHERE id=$4`,
        [supplierId, supplierAmount.toFixed(2), platformCommission.toFixed(2), orderId]
      );
      await dbPool.query(
        `UPDATE suppliers SET total_sales=COALESCE(total_sales,0)+$1, balance_due=COALESCE(balance_due,0)+$2 WHERE id=$3`,
        [orderTotal, supplierAmount, supplierId]
      );
      // إرسال إشعار
      const notifyResult = await notifySupplier(supplierId, orderId, { customerName: order.customer_name, customerPhone: order.customer_phone, shippingCity: order.shipping_city, supplierAmount, currency: order.currency });
      res.json({ success: true, supplierAmount, platformCommission, notify: notifyResult });
    } catch (e: any) {
      res.status(500).json({ message: "فشل تعيين المورد" });
    }
  });

  // إعادة إرسال إشعار واتساب للمورد
  app.post("/api/admin/orders/:id/notify-supplier", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const orderId = parseInt(req.params.id);
      const orderRes = await dbPool.query("SELECT * FROM orders WHERE id=$1", [orderId]);
      if (!orderRes.rows.length) return res.status(404).json({ message: "الطلب غير موجود" });
      const order = orderRes.rows[0];
      if (!order.supplier_id) return res.status(400).json({ message: "لا يوجد مورد مُعيَّن لهذا الطلب" });
      const notifyResult = await notifySupplier(order.supplier_id, orderId, { customerName: order.customer_name, customerPhone: order.customer_phone, shippingCity: order.shipping_city, supplierAmount: order.supplier_amount, currency: order.currency });
      if (!notifyResult.ok) return res.status(502).json({ message: notifyResult.error || "فشل إرسال الإشعار", notify: notifyResult });
      res.json({ success: true, notify: notifyResult });
    } catch (e: any) {
      res.status(500).json({ message: "فشل الإشعار" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  بوابة المورد — PUBLIC (بدون تسجيل دخول، مؤمّنة برمز)
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /api/supplier/order/:token — تفاصيل الطلب للمورد
  app.get("/api/supplier/order/:token", async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const token = req.params.token;
      if (!token || token.length < 16) return res.status(400).json({ message: "رمز غير صالح" });

      const orderRes = await dbPool.query(
        `SELECT o.*, s.name as supplier_name, s.phone as supplier_phone
         FROM orders o
         LEFT JOIN suppliers s ON o.supplier_id = s.id
         WHERE o.supplier_token = $1`,
        [token]
      );
      if (!orderRes.rows.length) return res.status(404).json({ message: "الطلب غير موجود أو الرابط منتهي الصلاحية" });
      const order = orderRes.rows[0];

      const itemsRes = await dbPool.query(
        `SELECT oi.*,
                COALESCE(NULLIF(oi.product_name,''), p.name)            AS product_name,
                COALESCE(NULLIF(oi.product_image,''), p.image_urls[1])  AS product_image
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = $1
         ORDER BY oi.id ASC`,
        [order.id]
      );
      res.json({ order, items: itemsRes.rows });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/supplier/order/:token/status — المورد يُحدّث حالة الطلب
  app.post("/api/supplier/order/:token/status", async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const token = req.params.token;
      const { status, note } = req.body as { status: string; note?: string };

      const ALLOWED = ["accepted", "shipped", "delivered", "cancelled"];
      if (!ALLOWED.includes(status)) return res.status(400).json({ message: "حالة غير صالحة" });

      const orderRes = await dbPool.query(
        `SELECT o.*, s.name as supplier_name FROM orders o LEFT JOIN suppliers s ON o.supplier_id=s.id WHERE o.supplier_token=$1`,
        [token]
      );
      if (!orderRes.rows.length) return res.status(404).json({ message: "الطلب غير موجود" });
      const order = orderRes.rows[0];

      // خريطة حالات المورد → حالة الطلب الرئيسية
      const statusMap: Record<string, string> = {
        accepted:  "processing",
        shipped:   "shipped",
        delivered: "delivered",
        cancelled: "cancelled",
      };
      const newOrderStatus = statusMap[status];

      // عند قبول/شحن/تسليم — نُسجّل أن المورد استجاب (يوقف عداد المهلة)
      const responseStatus = status === "cancelled" ? "rejected" : "accepted";
      await dbPool.query(
        `UPDATE orders SET supplier_status=$1, status=$2,
           supplier_response_status=$4,
           delivery_status=CASE WHEN $1='delivered' THEN 'delivered' WHEN $1='shipped' THEN 'shipped' ELSE delivery_status END
         WHERE supplier_token=$3`,
        [status, newOrderStatus, token, responseStatus]
      );

      // Task 3: تحديث sold_count عند تغيير الحالة من قِبل المورد
      if (status === "delivered") {
        await recalcSoldCountForOrder(order.id, "inc");
      } else if (status === "cancelled") {
        await recalcSoldCountForOrder(order.id, "dec");
      }

      // إشعار العميل تلقائياً عند الشحن والتسليم
      const customerNotifyMap: Record<string, string> = {
        shipped:   "shipped",
        delivered: "delivered",
        cancelled: "cancelled",
      };
      if (order.customer_phone && customerNotifyMap[status]) {
        await notifyCustomerStatus(order.customer_phone, order.id, customerNotifyMap[status]);
      }

      // إشعار الإدارة عند الإلغاء
      if (status === "cancelled") {
        const adminPhone = process.env.ADMIN_WHATSAPP_PHONE;
        if (adminPhone) {
          const cancelMsg = `⚠️ *المورد رفض طلباً!*\n🆔 رقم الطلب: *#${order.id}*\n🏪 المورد: ${order.supplier_name || "—"}\n📋 السبب: ${note || "لم يُحدَّد"}\nيرجى إعادة تعيين مورد آخر.`;
          await sendUltraMsg(adminPhone, cancelMsg);
        }
      }

      const arabicStatus: Record<string, string> = {
        accepted: "تم قبول الطلب",
        shipped: "تم الشحن",
        delivered: "تم التوصيل",
        cancelled: "تم الإلغاء",
      };
      res.json({ ok: true, message: arabicStatus[status] || status });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── لوحة أداء المورد
  app.get("/api/admin/suppliers/:id/performance", requireAdmin, async (req, res) => {
    try {
      const supplierId = parseInt(req.params.id);
      const { pool: dbPool } = await import("./db");
      const stats = await dbPool.query(`
        SELECT
          COUNT(*) as total_orders,
          COUNT(CASE WHEN status='delivered' THEN 1 END) as delivered_orders,
          COUNT(CASE WHEN status='cancelled' THEN 1 END) as cancelled_orders,
          COUNT(CASE WHEN status IN ('pending','confirmed','preparing','shipped') THEN 1 END) as active_orders,
          COALESCE(SUM(total::numeric), 0) as total_revenue,
          COALESCE(SUM(CASE WHEN status='delivered' THEN supplier_amount::numeric ELSE 0 END), 0) as total_paid,
          COALESCE(SUM(CASE WHEN status='delivered' THEN supplier_amount::numeric ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN supplier_paid=true THEN supplier_amount::numeric ELSE 0 END), 0) as pending_payment,
          0 as avg_delivery_days
        FROM orders WHERE supplier_id=$1
      `, [supplierId]);
      
      const monthly = await dbPool.query(`
        SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month,
               COUNT(*) as orders,
               SUM(total::numeric) as revenue
        FROM orders
        WHERE supplier_id=$1 AND created_at >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY DATE_TRUNC('month', created_at)
      `, [supplierId]);

      const topProducts = await dbPool.query(`
        SELECT oi.product_name, SUM(oi.quantity) as units, SUM(oi.price::numeric * oi.quantity) as revenue
        FROM order_items oi
        JOIN orders o ON oi.order_id=o.id
        WHERE o.supplier_id=$1
        GROUP BY oi.product_name
        ORDER BY revenue DESC LIMIT 5
      `, [supplierId]);

      const s = stats.rows[0];
      res.json({
        stats: {
          totalOrders: Number(s.total_orders),
          deliveredOrders: Number(s.delivered_orders),
          cancelledOrders: Number(s.cancelled_orders),
          activeOrders: Number(s.active_orders),
          totalRevenue: Number(s.total_revenue),
          totalPaid: Number(s.total_paid),
          pendingPayment: Number(s.pending_payment),
          avgDeliveryDays: s.avg_delivery_days ? Number(s.avg_delivery_days).toFixed(1) : null,
          deliveryRate: s.total_orders > 0 ? ((Number(s.delivered_orders) / Number(s.total_orders)) * 100).toFixed(1) : 0,
        },
        monthly: monthly.rows,
        topProducts: topProducts.rows,
      });
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب البيانات", details: e.message });
    }
  });

  app.get("/api/admin/suppliers/:id/payments", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        `SELECT * FROM supplier_payments WHERE supplier_id=$1 ORDER BY paid_at DESC`,
        [parseInt(req.params.id)]
      );
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب السجل" });
    }
  });

  // ─── Admin Stats ─────────────────────────────────────────────────
  app.get("/api/admin/stats", requireAdmin, async (_req, res) => {
    try {
      const stats = await storage.getOrderStats();
      res.json(stats);
    } catch (e) {
      res.status(500).json({ message: "فشل جلب الإحصائيات" });
    }
  });

  // ─── Category image (Base64 → HTTP image) ──────────────────────
  app.get("/api/categories/image/:id", async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) return res.status(400).send("Invalid ID");
      const result = await dbPool.query("SELECT image_url FROM categories WHERE id = $1", [id]);
      if (!result.rows.length) return res.status(404).send("Not found");
      const imageUrl = result.rows[0].image_url;
      if (!imageUrl) return res.status(404).send("No image");
      // حماية من الحلقة الدائرية: رفض إعادة التوجيه إلى أي /api/ (يخلق loop)
      if (imageUrl.startsWith("/api/")) return res.status(404).send("Circular image reference");
      if (!imageUrl.startsWith("data:")) return res.redirect(imageUrl);
      const matches = imageUrl.match(new RegExp("^data:([^;]+);base64,(.+)$", "s"));
      if (!matches) return res.status(400).send("Invalid image data");
      const mimeType = matches[1];
      const imageData = Buffer.from(matches[2], "base64");
      res.set("Content-Type", mimeType);
      res.set("Cache-Control", "public, max-age=604800");
      res.send(imageData);
    } catch (err: any) {
      res.status(500).send("Error");
    }
  });

  // ─── Categories (Public) ─────────────────────────────────────────
  app.get("/api/categories", async (_req, res) => {
    const { pool: dbPool } = await import("./db");
    const cats = await storage.getCategories();
    // إضافة عدد المنتجات لكل قسم
    const countResult = await dbPool.query(
      `SELECT category_id, COUNT(*) as count FROM products WHERE (product_status IS NULL OR product_status = 'approved') AND is_active IS NOT FALSE GROUP BY category_id`
    );
    const countMap: Record<number, number> = {};
    for (const row of countResult.rows) { countMap[row.category_id] = parseInt(row.count); }
    res.set("Cache-Control", "public, max-age=60, must-revalidate"); // كاش دقيقة + إعادة تحقق
    res.json(cats.filter((c: any) => c.isActive !== false).map((c: any) => ({
      ...c,
      // استبدال base64 بـ URL مستقل لتخفيف حجم الاستجابة + بصمة (cache-buster)
      imageUrl: c.imageUrl?.startsWith("data:") ? proxyImg("categories", c.id, c.imageUrl) : (c.imageUrl || null),
      productCount: countMap[c.id] || 0,
    })));
  });

  // ─── Subcategories (Public) ──────────────────────────────────────
  app.get("/api/subcategories", async (req, res) => {
    const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
    const subs = await storage.getSubcategories(categoryId);
    // الواجهة العامة تُخفي الأقسام الفرعية المُعطّلة، الأدمن يستخدم /api/admin/subcategories إن لزم
    const includeHidden = req.query.includeHidden === '1';
    const filtered = includeHidden ? subs : subs.filter((s: any) => s.isActive !== false);
    // ─── تخفيف الـ payload: استبدال صور base64 الضخمة بروابط بروكسي خفيفة + بصمة ──
    const lightweight = filtered.map((s: any) => ({
      ...s,
      imageUrl: s.imageUrl?.startsWith("data:") ? proxyImg("subcategories", s.id, s.imageUrl) : (s.imageUrl || null),
    }));
    res.set("Cache-Control", "public, max-age=60, must-revalidate"); // كاش دقيقة + إعادة تحقق
    res.json(lightweight);
  });

  // ─── Subcategory image proxy (يخدم الصور الكبيرة base64 من DB) ──
  app.get("/api/subcategories/image/:id", async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) return res.status(400).send("Invalid ID");
      const result = await dbPool.query("SELECT image_url FROM subcategories WHERE id = $1", [id]);
      if (!result.rows.length) return res.status(404).send("Not found");
      const imageUrl = result.rows[0].image_url;
      if (!imageUrl) return res.status(404).send("No image");
      // حماية من الحلقة الدائرية: رفض إعادة التوجيه إلى أي /api/ (يخلق loop)
      if (imageUrl.startsWith("/api/")) return res.status(404).send("Circular image reference");
      if (!imageUrl.startsWith("data:")) return res.redirect(imageUrl);
      const matches = imageUrl.match(new RegExp("^data:([^;]+);base64,(.+)$", "s"));
      if (!matches) return res.status(400).send("Invalid image data");
      res.set("Content-Type", matches[1]);
      res.set("Cache-Control", "public, max-age=604800");
      res.send(Buffer.from(matches[2], "base64"));
    } catch (err: any) {
      res.status(500).send("Error");
    }
  });

  app.get("/api/subcategories/by-slug/:slug", async (req, res) => {
    const sub = await storage.getSubcategoryBySlug(req.params.slug);
    if (!sub) return res.status(404).json({ message: "Not found" });
    res.json(sub);
  });

  // ─── Subcategories Admin CRUD ────────────────────────────────────
  app.post("/api/admin/subcategories", requireAdmin, async (req, res) => {
    try {
      const sub = await storage.createSubcategory(req.body);
      res.json(sub);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.patch("/api/admin/subcategories/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = { ...req.body };
      // ⚠️ تجاهل روابط البروكسي (مثل /api/subcategories/image/12) كي لا تطمس الصورة الأصلية
      if (typeof data.imageUrl === "string" && isProxyImageUrl(data.imageUrl)) {
        delete data.imageUrl;
      }
      const sub = await storage.updateSubcategory(id, data);
      res.json(sub);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.delete("/api/admin/subcategories/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteSubcategory(parseInt(req.params.id));
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // ─── Products (Public) ───────────────────────────────────────────
  // ─── Image serving (converts base64 DB data to real HTTP images) ──
  app.get("/api/products/image/:id", async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) return res.status(400).send("Invalid ID");
      const result = await dbPool.query("SELECT image_url FROM products WHERE id = $1", [id]);
      if (!result.rows.length) return res.status(404).send("Not found");
      const imageUrl = result.rows[0].image_url;
      if (!imageUrl) return res.status(404).send("No image");
      // حماية من الحلقة الدائرية: رفض إعادة التوجيه إلى أي /api/ (يخلق loop)
      if (imageUrl.startsWith("/api/")) return res.status(404).send("Circular image reference");
      if (!imageUrl.startsWith("data:")) return res.redirect(imageUrl);
      const matches = imageUrl.match(new RegExp("^data:([^;]+);base64,(.+)$", "s"));
      if (!matches) return res.status(400).send("Invalid image data");
      const mimeType = matches[1];
      const imageData = Buffer.from(matches[2], "base64");
      res.set("Content-Type", mimeType);
      res.set("Cache-Control", "public, max-age=604800");
      res.send(imageData);
    } catch (err: any) {
      res.status(500).send("Error");
    }
  });

  app.get("/api/products/image/:id/:imgIndex", async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const id = parseInt(req.params.id);
      const imgIndex = parseInt(req.params.imgIndex);
      if (Number.isNaN(id) || Number.isNaN(imgIndex)) return res.status(400).send("Invalid params");
      const result = await dbPool.query("SELECT image_urls FROM products WHERE id = $1", [id]);
      if (!result.rows.length) return res.status(404).send("Not found");
      const imageUrls = result.rows[0].image_urls;
      if (!imageUrls || !imageUrls[imgIndex]) return res.status(404).send("No image at index");
      const imageUrl = imageUrls[imgIndex];
      // حماية من الحلقة الدائرية: رفض إعادة التوجيه إلى أي /api/ (يخلق loop)
      if (typeof imageUrl === "string" && imageUrl.startsWith("/api/")) {
        return res.status(404).send("Circular image reference");
      }
      if (!imageUrl.startsWith("data:")) {
        // صورة خارجية (Cloudinary) — وجّه مباشرةً مع caching
        res.set("Cache-Control", "public, max-age=86400");
        return res.redirect(302, imageUrl);
      }
      const matches = imageUrl.match(new RegExp("^data:([^;]+);base64,(.+)$", "s"));
      if (!matches) return res.status(400).send("Invalid image data");
      const mimeType = matches[1];
      const imageData = Buffer.from(matches[2], "base64");
      res.set("Content-Type", mimeType);
      res.set("Cache-Control", "public, max-age=604800");
      res.send(imageData);
    } catch (err: any) {
      res.status(500).send("Error");
    }
  });

  const LITE_COLS = `id, name, description, price, price_sar, category_id, subcategory_id, is_active, image_url,
    stock, reorder_point, colors, sizes, allow_design_upload, bulk_pricing, size_pricing,
    printing_price_per_unit, rating, review_count, sold_count, commission_hold_days,
    marketer_commission_rate, has_printing_options, base_bag_price, single_color_print_price,
    available_bag_colors, tags, show_reviews, show_in_printing, enable_variant_ui, color_images,
    original_price, original_price_sar, discount_percent, promotional_tags,
    has_free_shipping, product_type, enable_smart_variants, smart_variants, printing_category_id,
    printing_design_fee_override, printing_color_price_override, printing_side_price_override,
    print_area, base_image_public_id, available_colors,
    print_color_options, quantity_tiers, preview_width, preview_height,
    show_live_preview, enable_volume_offers`;

  // عند أوّل تحميل، نُسخّن الكاش حتّى mapProductRow يستخدم السعر الصحيح
  getExchangeRate().catch(() => {});

  function mapProductRow(r: any, opts?: { includeCogs?: boolean }) {
    const rawImg: string = r.image_url || "";
    // حساب نسبة الخصم الفعلية
    let effectiveDiscount: number | null = null;
    if (r.discount_percent != null) {
      effectiveDiscount = Number(r.discount_percent);
    } else if (r.original_price != null && r.price != null) {
      const orig = Number(r.original_price);
      const curr = Number(r.price);
      if (orig > curr && orig > 0) {
        effectiveDiscount = Math.round(((orig - curr) / orig) * 100);
      }
    }
    // 💱 السعر السعودي ديناميكي — يُحسب من السعر اليمني وسعر الصرف الحالي
    const _rate = getExchangeRateCached();
    const _priceNum = parseFloat(String(r.price ?? "0"));
    const dynPriceSar = (_rate > 0 && !isNaN(_priceNum) && _priceNum > 0)
      ? (_priceNum / _rate).toFixed(2)
      : r.price_sar;
    let dynOriginalPriceSar: any = r.original_price_sar;
    if (r.original_price != null) {
      const _origNum = parseFloat(String(r.original_price));
      if (_rate > 0 && !isNaN(_origNum) && _origNum > 0) {
        dynOriginalPriceSar = (_origNum / _rate).toFixed(2);
      }
    }
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      price: r.price,
      priceSar: dynPriceSar,
      categoryId: r.category_id,
      subcategoryId: r.subcategory_id ?? null,
      isActive: r.is_active !== false,
      imageUrl: rawImg.startsWith("data:") ? proxyImg("products", r.id, rawImg) : (rawImg || null),
      imageUrls: [],
      stock: r.stock,
      reorderPoint: r.reorder_point ?? 10,
      colors: r.colors,
      sizes: r.sizes,
      allowDesignUpload: r.allow_design_upload,
      bulkPricing: r.bulk_pricing,
      sizePricing: r.size_pricing,
      printingPricePerUnit: r.printing_price_per_unit,
      rating: r.rating,
      reviewCount: r.review_count,
      soldCount: r.sold_count,
      commissionHoldDays: r.commission_hold_days,
      marketerCommissionRate: r.marketer_commission_rate,
      hasPrintingOptions: r.has_printing_options,
      baseBagPrice: r.base_bag_price,
      singleColorPrintPrice: r.single_color_print_price,
      availableBagColors: r.available_bag_colors,
      tags: r.tags,
      showReviews: r.show_reviews,
      showInPrinting: r.show_in_printing,
      printingCategoryId: r.printing_category_id ?? null,
      printingDesignFeeOverride: r.printing_design_fee_override ?? null,
      printingColorPriceOverride: r.printing_color_price_override ?? null,
      printingSidePriceOverride: r.printing_side_price_override ?? null,
      printArea: (() => {
        try { return r.print_area ? JSON.parse(r.print_area) : null; } catch { return null; }
      })(),
      // Phase 6
      baseImagePublicId: r.base_image_public_id ?? null,
      availableColors: (() => {
        try { return r.available_colors ? JSON.parse(r.available_colors) : null; } catch { return null; }
      })(),
      cloudinaryCloudName: r.base_image_public_id ? (process.env.CLOUDINARY_CLOUD_NAME || null) : null,
    enableVariantUI: r.enable_variant_ui ?? false,
    colorImages: r.color_images ?? null,
      // Phase 7: تخصيصات الأدمن لصفحة المنتج
      printColorOptions: (() => {
        try { return r.print_color_options ? JSON.parse(r.print_color_options) : null; } catch { return null; }
      })(),
      quantityTiers: (() => {
        try { return r.quantity_tiers ? JSON.parse(r.quantity_tiers) : null; } catch { return null; }
      })(),
      previewSize: r.preview_size ?? 150,
      previewWidth: r.preview_width ?? 200,
      previewHeight: r.preview_height ?? 250,
      originalPrice: r.original_price ?? null,
      originalPriceSar: dynOriginalPriceSar ?? null,
      discountPercent: r.discount_percent ?? null,
      effectiveDiscount,
      promotionalTags: r.promotional_tags ?? [],
      hasFreeShipping: r.has_free_shipping ?? false,
      productType: r.product_type ?? "ready",
      enableSmartVariants: r.enable_smart_variants ?? false,
      smartVariants: r.smart_variants ?? null,
      showLivePreview: r.show_live_preview ?? false,
      enableVolumeOffers: r.enable_volume_offers ?? false,
      // 💰 COGS — يُكشف فقط لمسارات الأدمن (opts.includeCogs=true). البيانات سرّية ولا تُرسل في الـ API العام.
      ...(opts?.includeCogs ? (() => {
        if (!r.smart_variants) return { costPriceY: null, costPriceSar: null, profitMarginY: null, profitPercent: null };
        const computed = computeBaseFromSmartVariants(r.smart_variants, _rate);
        if (!computed || !computed.costPriceY) return { costPriceY: null, costPriceSar: null, profitMarginY: null, profitPercent: null };
        const sellY = parseFloat(String(r.price ?? "0"));
        const costY = parseFloat(computed.costPriceY);
        const margin = !isNaN(sellY) && !isNaN(costY) ? sellY - costY : null;
        const percent = margin != null && sellY > 0 ? Math.round((margin / sellY) * 100) : null;
        return {
          costPriceY: computed.costPriceY,
          costPriceSar: computed.costPriceSar,
          profitMarginY: margin != null ? margin.toFixed(2) : null,
          profitPercent: percent,
        };
      })() : {}),
    };
  }

  app.get("/api/products", async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      let categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
      const categorySlug = req.query.category as string | undefined;
      const subcategorySlug = req.query.subcategory as string | undefined;
      const search = req.query.search as string | undefined;
      const filter = req.query.filter as string | undefined; // free-shipping | flash-deals

      // resolve slug → id if needed
      if ((!categoryId || Number.isNaN(categoryId)) && categorySlug) {
        const catRow = await dbPool.query(`SELECT id FROM categories WHERE slug = $1 LIMIT 1`, [categorySlug]);
        if (catRow.rows.length > 0) categoryId = catRow.rows[0].id;
      }

      let subcategoryId: number | undefined;
      if (subcategorySlug) {
        const subRow = await dbPool.query(`SELECT id FROM subcategories WHERE slug = $1 LIMIT 1`, [subcategorySlug]);
        if (subRow.rows.length > 0) subcategoryId = subRow.rows[0].id;
      }

      let query = `SELECT ${LITE_COLS} FROM products`;
      const params: any[] = [];
      const conditions: string[] = [];
      let idx = 1;

      // إخفاء منتجات الموردين غير المعتمدة من المتجر العام
      conditions.push(`(product_status IS NULL OR product_status = 'approved')`);
      // إخفاء المنتجات المُعطّلة من قبل الأدمن
      conditions.push(`is_active IS NOT FALSE`);

      // فلترة البنرات الخاصة
      if (filter === 'free-shipping') {
        conditions.push(`has_free_shipping = true`);
      } else if (filter === 'flash-deals') {
        conditions.push(`(original_price IS NOT NULL OR discount_percent IS NOT NULL)`);
      }

      if (categoryId !== undefined && !Number.isNaN(categoryId)) {
        conditions.push(`category_id = $${idx++}`);
        params.push(categoryId);
      }
      if (subcategoryId !== undefined) {
        conditions.push(`subcategory_id = $${idx++}`);
        params.push(subcategoryId);
      }
      if (conditions.length > 0) query += ` WHERE ${conditions.join(" AND ")}`;
      query += ` ORDER BY id DESC`;

      const result = await dbPool.query(query, params);
      let rows = result.rows.map((r: any) => mapProductRow(r));

      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        rows = rows.filter((p: any) =>
          (p.name || "").toLowerCase().includes(q) ||
          (p.description || "").toLowerCase().includes(q) ||
          (Array.isArray(p.tags) ? p.tags : []).some((t: any) => String(t).toLowerCase().includes(q))
        );
      }

      res.set("Cache-Control", "public, max-age=60"); // كاش دقيقة للمنتجات
      res.json(rows);
    } catch (error: any) {
      console.error("خطأ في جلب المنتجات:", error);
      res.status(500).json({ message: "فشل في جلب المنتجات", details: error.message });
    }
  });

  app.get("/api/products/bestselling", async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 8;
      const result = await dbPool.query(
        `SELECT ${LITE_COLS} FROM products WHERE (product_status IS NULL OR product_status = 'approved') AND is_active IS NOT FALSE ORDER BY sold_count DESC NULLS LAST LIMIT $1`,
        [limit]
      );
      res.json(result.rows.map((r: any) => mapProductRow(r)));
    } catch (error: any) {
      console.error("خطأ في جلب الأكثر مبيعاً:", error);
      res.status(500).json({ message: "فشل في جلب الأكثر مبيعاً", details: error.message });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) return res.status(404).json({ message: "المنتج غير موجود" });
      const result = await dbPool.query(
        `SELECT ${LITE_COLS}, image_urls FROM products WHERE id = $1`,
        [id]
      );
      if (!result.rows.length) return res.status(404).json({ message: "المنتج غير موجود" });
      const r = result.rows[0];
      // أعد الـ URLs الحقيقية مباشرةً — استخدم الـ proxy فقط للصور base64 + بصمة
      const rawUrls: string[] = Array.isArray(r.image_urls) ? r.image_urls : [];
      const imageUrls = rawUrls.map((url: string, i: number) =>
        url.startsWith("data:") ? proxyImg("products", id, url, i) : url
      );
      const product = {
        ...mapProductRow(r),
        imageUrls,
      };
      res.json(product);
    } catch (error: any) {
      console.error("خطأ في جلب المنتج:", error);
      res.status(500).json({ message: "فشل في جلب المنتج", details: error.message });
    }
  });

  // ─── Product Reviews ─────────────────────────────────────────────
  app.get("/api/products/:id/reviews", async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      if (Number.isNaN(productId)) return res.status(400).json({ message: "معرف غير صحيح" });
      const reviews = await storage.getProductReviews(productId);
      res.json(reviews);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب التقييمات" });
    }
  });

  app.post("/api/products/:id/reviews", async (req: any, res) => {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ message: "يجب تسجيل الدخول لإضافة تقييم" });
      }
      const productId = parseInt(req.params.id);
      if (Number.isNaN(productId)) return res.status(400).json({ message: "معرف غير صحيح" });
      const { rating, comment, imageUrl } = req.body;
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "التقييم يجب أن يكون بين 1 و 5" });
      }
      const userId = req.user?.id || req.session?.userId;
      if (!userId) return res.status(401).json({ message: "غير مصرح" });

      const { pool: dbPool } = await import("./db");

      // ── يجب أن يكون لدى المستخدم طلب delivered يحتوي هذا المنتج (Task 5) ─────
      const purchased = await dbPool.query(
        `SELECT 1 FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE oi.product_id = $1
           AND o.user_id = $2
           AND (o.status IN ('delivered', 'completed') OR o.delivery_status = 'delivered')
         LIMIT 1`,
        [productId, userId]
      );
      if (purchased.rows.length === 0) {
        return res.status(403).json({
          message: "يمكنك تقييم المنتج فقط بعد استلام طلب يحتوي هذا المنتج",
          notPurchased: true,
        });
      }

      try {
        const review = await storage.createReview({ productId, userId, rating: parseInt(rating), comment, imageUrl });
        res.status(201).json(review);
      } catch (insertErr: any) {
        // 23505 = duplicate key (UNIQUE INDEX على product_id, user_id)
        if (insertErr?.code === "23505") {
          return res.status(409).json({ message: "لقد قمت بتقييم هذا المنتج مسبقاً", alreadyReviewed: true });
        }
        throw insertErr;
      }
    } catch (e: any) {
      res.status(500).json({ message: "فشل إضافة التقييم" });
    }
  });

  // ── هل قيّم المستخدم هذا المنتج مسبقاً؟ ─────────────────────────────────
  app.get("/api/products/:id/my-review", async (req: any, res) => {
    try {
      const userId = req.user?.id || req.session?.userId;
      if (!userId) return res.json({ reviewed: false });
      const { pool: dbPool } = await import("./db");
      const productId = parseInt(req.params.id);
      const r = await dbPool.query(
        `SELECT id, rating, comment, is_approved FROM reviews WHERE product_id=$1 AND user_id=$2 LIMIT 1`,
        [productId, userId]
      );
      if (r.rows.length === 0) return res.json({ reviewed: false });
      const row = r.rows[0];
      res.json({ reviewed: true, rating: row.rating, comment: row.comment, isApproved: row.is_approved });
    } catch {
      res.json({ reviewed: false });
    }
  });

  app.post("/api/upload/review", upload.single("image"), async (req: any, res) => {
    // يتطلب مستخدم مسجل (Task 5 security fix)
    if (!req.isAuthenticated?.() || !(req.user?.id || req.session?.userId)) {
      return res.status(401).json({ message: "يجب تسجيل الدخول" });
    }
    if (!req.file) return res.status(400).json({ message: "لا يوجد ملف" });
    if (!req.file.mimetype?.startsWith("image/")) {
      return res.status(400).json({ message: "نوع ملف غير صالح" });
    }
    // ملاحظة: multer العام يقيّد الحجم بـ 5MB قبل الوصول إلى هنا
    try {
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;
      if (cloudName && apiKey && apiSecret) {
        const { v2: cloudinary } = await import("cloudinary");
        cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
        const uploadRes: any = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "oyo-plast/reviews", resource_type: "image" },
            (err: any, result: any) => err ? reject(err) : resolve(result)
          );
          stream.end(req.file!.buffer);
        });
        return res.json({ imageUrl: uploadRes.secure_url });
      }
      // fallback: base64
      const { pool: dbPool } = await import("./db");
      const settings = await getImageSettings(dbPool);
      const { buffer, mimeOut } = await processImage(req.file.buffer, req.file.mimetype, {
        maxWidth: Math.min(settings.img_max_width, 800),
        maxHeight: Math.min(settings.img_max_height, 800),
        quality: settings.img_quality,
      });
      res.json({ imageUrl: `data:${mimeOut};base64,${buffer.toString("base64")}` });
    } catch (e: any) {
      const base64 = req.file.buffer.toString("base64");
      res.json({ imageUrl: `data:${req.file.mimetype};base64,${base64}` });
    }
  });

  app.get("/api/admin/reviews", requireAdmin, async (_req, res) => {
    try {
      const reviews = await storage.getAllReviews();
      res.json(reviews);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب التقييمات" });
    }
  });

  // ─── Approve review ──────────────────────────────────────────────
  app.patch("/api/admin/reviews/:id/approve", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { approved } = req.body;
      const reviewId = parseInt(req.params.id);
      await dbPool.query(`UPDATE reviews SET is_approved=$1 WHERE id=$2`, [approved !== false, reviewId]);
      // Task 3: إعادة حساب التقييم من المعتمدة فقط
      const rev = await dbPool.query(`SELECT product_id FROM reviews WHERE id=$1`, [reviewId]);
      if (rev.rows[0]) await recalcProductRating(rev.rows[0].product_id);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث التقييم" });
    }
  });

  app.delete("/api/admin/reviews/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ message: "معرف غير صحيح" });
      await storage.deleteReview(id);
      res.json({ message: "تم حذف التقييم" });
    } catch (e: any) {
      res.status(500).json({ message: "فشل حذف التقييم" });
    }
  });

  // ─── Rate Order (Post-Delivery) ──────────────────────────────────
  // جلب منتجات الطلب القابلة للتقييم — يستثني المنتجات المُقيَّمة
  app.get("/api/orders/:id/rateable", async (req: any, res) => {
    try {
      if (!req.isAuthenticated?.()) return res.status(401).json({ message: "يجب تسجيل الدخول" });
      const userId = req.user?.id || req.session?.userId;
      if (!userId) return res.status(401).json({ message: "غير مصرح" });
      const orderId = parseInt(req.params.id);
      if (Number.isNaN(orderId)) return res.status(400).json({ message: "معرف غير صحيح" });

      const { pool: dbPool } = await import("./db");
      const ord = await dbPool.query(
        `SELECT id, user_id, status, delivery_status FROM orders WHERE id=$1 LIMIT 1`,
        [orderId]
      );
      if (ord.rows.length === 0) return res.status(404).json({ message: "الطلب غير موجود" });
      const order = ord.rows[0];
      if (String(order.user_id) !== String(userId)) {
        return res.status(403).json({ message: "ليس لديك صلاحية" });
      }
      const isDelivered = order.status === "delivered" || order.status === "completed" || order.delivery_status === "delivered";
      if (!isDelivered) {
        return res.status(400).json({ message: "لا يمكن التقييم قبل التوصيل", notDelivered: true });
      }

      const items = await dbPool.query(
        `SELECT oi.id, oi.product_id, COALESCE(oi.product_name, p.name) AS product_name,
                COALESCE(oi.product_image, p.image_url) AS product_image,
                p.image_url AS p_image_url,
                (SELECT r.id FROM reviews r WHERE r.product_id = oi.product_id AND r.user_id = $1 LIMIT 1) AS review_id,
                (SELECT r.rating FROM reviews r WHERE r.product_id = oi.product_id AND r.user_id = $1 LIMIT 1) AS review_rating
         FROM order_items oi
         LEFT JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = $2 AND oi.product_id IS NOT NULL`,
        [userId, orderId]
      );

      // إزالة التكرار (نفس المنتج مرتين في الطلب)
      const seen = new Set<number>();
      const products = items.rows.filter((r: any) => {
        if (seen.has(r.product_id)) return false;
        seen.add(r.product_id);
        return true;
      }).map((r: any) => {
        const rawImg = r.product_image || r.p_image_url || "";
        const image = typeof rawImg === "string" && rawImg.startsWith("data:")
          ? `/api/products/image/${r.product_id}/0`
          : rawImg;
        return {
          productId: r.product_id,
          productName: r.product_name || `منتج #${r.product_id}`,
          productImage: image,
          alreadyRated: !!r.review_id,
          previousRating: r.review_rating || null,
        };
      });

      res.json({ orderId, products });
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب المنتجات" });
    }
  });

  // تقديم تقييمات متعددة دفعة واحدة للطلب
  app.post("/api/orders/:id/rate", async (req: any, res) => {
    try {
      if (!req.isAuthenticated?.()) return res.status(401).json({ message: "يجب تسجيل الدخول" });
      const userId = req.user?.id || req.session?.userId;
      if (!userId) return res.status(401).json({ message: "غير مصرح" });
      const orderId = parseInt(req.params.id);
      if (Number.isNaN(orderId)) return res.status(400).json({ message: "معرف غير صحيح" });

      const { ratings } = req.body as { ratings: Array<{ productId: number; rating: number; comment?: string; imageUrl?: string }> };
      if (!Array.isArray(ratings) || ratings.length === 0) {
        return res.status(400).json({ message: "لا يوجد تقييمات للحفظ" });
      }

      const { pool: dbPool } = await import("./db");

      // التحقق من ملكية الطلب وحالة التوصيل
      const ord = await dbPool.query(
        `SELECT id, user_id, status, delivery_status FROM orders WHERE id=$1 LIMIT 1`,
        [orderId]
      );
      if (ord.rows.length === 0) return res.status(404).json({ message: "الطلب غير موجود" });
      const order = ord.rows[0];
      if (String(order.user_id) !== String(userId)) return res.status(403).json({ message: "ليس لديك صلاحية" });
      const isDelivered = order.status === "delivered" || order.status === "completed" || order.delivery_status === "delivered";
      if (!isDelivered) return res.status(400).json({ message: "لا يمكن التقييم قبل التوصيل" });

      // قائمة المنتجات التي يحق للمستخدم تقييمها (تنتمي فعلاً للطلب)
      const allowedRows = await dbPool.query(
        `SELECT DISTINCT product_id FROM order_items WHERE order_id=$1 AND product_id IS NOT NULL`,
        [orderId]
      );
      const allowedSet = new Set(allowedRows.rows.map((r: any) => Number(r.product_id)));

      const saved: number[] = [];
      const skipped: Array<{ productId: number; reason: string }> = [];

      for (const r of ratings) {
        const pid = Number(r.productId);
        const rt = Number(r.rating);
        if (!pid || !rt || rt < 1 || rt > 5) {
          skipped.push({ productId: pid, reason: "بيانات غير صالحة" });
          continue;
        }
        if (!allowedSet.has(pid)) {
          skipped.push({ productId: pid, reason: "ليس ضمن منتجات الطلب" });
          continue;
        }
        // منع التكرار
        const existing = await dbPool.query(
          `SELECT id FROM reviews WHERE product_id=$1 AND user_id=$2 LIMIT 1`,
          [pid, userId]
        );
        if (existing.rows.length > 0) {
          skipped.push({ productId: pid, reason: "تم التقييم مسبقاً" });
          continue;
        }
        try {
          await storage.createReview({
            productId: pid,
            userId,
            rating: rt,
            comment: r.comment || undefined,
            imageUrl: r.imageUrl || undefined,
          });
          saved.push(pid);
        } catch (insertErr: any) {
          if (insertErr?.code === "23505") {
            skipped.push({ productId: pid, reason: "تم التقييم مسبقاً" });
          } else {
            throw insertErr;
          }
        }
      }

      res.json({ ok: true, saved: saved.length, skipped });
    } catch (e: any) {
      res.status(500).json({ message: "فشل حفظ التقييمات" });
    }
  });

  // ─── Admin Categories ────────────────────────────────────────────
  app.get("/api/admin/categories", requireAdmin, async (_req, res) => {
    const cats = await storage.getCategories();
    // استبدال base64 بـ URL مستقل حتى في لوحة الأدمن + بصمة (cache-buster)
    res.json(cats.map((c: any) => ({
      ...c,
      imageUrl: c.imageUrl?.startsWith("data:") ? proxyImg("categories", c.id, c.imageUrl) : (c.imageUrl || null),
    })));
  });

  app.post("/api/admin/categories", requireAdmin, async (req, res) => {
    try {
      const { name, slug, imageUrl, iconUrl, sortOrder, isActive } = req.body;
      if (!name) return res.status(400).json({ message: "الاسم مطلوب" });
      const category = await storage.createCategory({
        name,
        slug: slug || generateSlug(name),
        imageUrl: imageUrl || "",
        iconUrl: iconUrl || null,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
      });
      res.status(201).json(category);
    } catch (e: any) {
      res.status(500).json({ message: "فشل إنشاء القسم", details: e.message });
    }
  });

  app.patch("/api/admin/categories/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, slug, imageUrl, iconUrl, sortOrder, isActive } = req.body;
      const update: any = {};
      if (name !== undefined) { update.name = name; if (!slug) update.slug = generateSlug(name); }
      if (slug !== undefined) update.slug = slug;
      // ⚠️ تجاهل أي رابط بروكسي خفيف (مثل /api/categories/image/12) كي لا يُحفظ مكان الصورة الأصلية
      if (imageUrl !== undefined && !isProxyImageUrl(imageUrl)) update.imageUrl = imageUrl;
      if (iconUrl !== undefined && !isProxyImageUrl(iconUrl)) update.iconUrl = iconUrl;
      if (sortOrder !== undefined) update.sortOrder = sortOrder;
      if (isActive !== undefined) update.isActive = isActive;
      const category = await storage.updateCategory(id, update);
      res.json(category);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث القسم", details: e.message });
    }
  });

  app.delete("/api/admin/categories/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteCategory(parseInt(req.params.id));
      res.json({ message: "تم الحذف بنجاح" });
    } catch (e: any) {
      res.status(500).json({ message: "فشل حذف القسم - قد يحتوي على منتجات", details: e.message });
    }
  });

  // ─── Admin Products ──────────────────────────────────────────────
  app.get("/api/admin/products", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        `SELECT ${LITE_COLS}, image_urls FROM products ORDER BY id DESC`
      );
      const rows = result.rows.map((r: any) => {
        const rawUrls: string[] = Array.isArray(r.image_urls) ? r.image_urls : [];
        return {
          ...mapProductRow(r, { includeCogs: true }),
          imageUrls: rawUrls.map((url: string, i: number) =>
            url.startsWith("data:") ? proxyImg("products", r.id, url, i) : url
          ),
        };
      });
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحميل المنتجات", details: e.message });
    }
  });

  app.post("/api/admin/products", requireAdmin, async (req, res) => {
    try {
      const data = req.body;
      if (!data.name || !data.categoryId || !data.imageUrl) {
        return res.status(400).json({ message: "البيانات المطلوبة: name, categoryId, imageUrl" });
      }
      // ─── الخيارات الذكية هي المصدر الوحيد للأسعار والخصم ───
      if (!data.enableSmartVariants || !data.smartVariants) {
        return res.status(422).json({
          message: "⛔ يجب تفعيل الخيارات الذكية (Smart Variants) وإضافة خيار واحد على الأقل بسعر (لون/مقاس/وزن/شدة).",
        });
      }
      // ─── حساب السعر الأساسي والخصم تلقائياً من أرخص خيار ذكي ───
      const computed = computeBaseFromSmartVariants(data.smartVariants, await getExchangeRate());
      if (!computed) {
        return res.status(422).json({
          message: "⛔ لم نتمكن من قراءة سعر صالح من الخيارات الذكية. تأكد من وجود متغيّر واحد على الأقل بسعر > 0.",
        });
      }
      data.price = computed.price;
      data.priceSar = computed.priceSar;
      data.originalPrice = computed.originalPrice;
      data.originalPriceSar = computed.originalPriceSar;
      data.discountPercent = computed.discountPercent;
      const product = await storage.createProduct({
        name: data.name,
        description: data.description || "",
        price: String(data.price),
        priceSar: data.priceSar ? String(data.priceSar) : null,
        categoryId: Number(data.categoryId),
        subcategoryId: data.subcategoryId ? Number(data.subcategoryId) : null,
        isActive: data.isActive !== false,
        imageUrl: data.imageUrl,
        imageUrls: data.imageUrls || null,
        stock: Number(data.stock ?? 100),
        colors: data.colors || null,
        sizes: data.sizes || null,
        allowDesignUpload: data.allowDesignUpload ?? false,
        bulkPricing: data.bulkPricing || null,
        sizePricing: data.sizePricing || null,
        printingPricePerUnit: data.printingPricePerUnit ? String(data.printingPricePerUnit) : null,
        hasPrintingOptions: data.hasPrintingOptions ?? false,
        baseBagPrice: data.baseBagPrice ? String(data.baseBagPrice) : null,
        singleColorPrintPrice: data.singleColorPrintPrice ? String(data.singleColorPrintPrice) : null,
        availableBagColors: data.availableBagColors || null,
        tags: data.tags || null,
        originalPrice: data.originalPrice ? String(data.originalPrice) : null,
        originalPriceSar: data.originalPriceSar ? String(data.originalPriceSar) : null,
        discountPercent: data.discountPercent ? Number(data.discountPercent) : null,
        promotionalTags: data.promotionalTags || null,
        // ── حقول الطباعة والتصميم ──────────────────────────────────────
        showInPrinting: data.showInPrinting ?? false,
        printingCategoryId: data.printingCategoryId ? Number(data.printingCategoryId) : null,
        // ── Phase 4: Override تسعير الطباعة ─────────────────────────────
        printingDesignFeeOverride: data.printingDesignFeeOverride !== "" && data.printingDesignFeeOverride != null ? String(data.printingDesignFeeOverride) : null,
        printingColorPriceOverride: data.printingColorPriceOverride !== "" && data.printingColorPriceOverride != null ? String(data.printingColorPriceOverride) : null,
        printingSidePriceOverride: data.printingSidePriceOverride !== "" && data.printingSidePriceOverride != null ? String(data.printingSidePriceOverride) : null,
        // Phase 5: منطقة الطباعة
        printArea: data.printArea && typeof data.printArea === "object" ? JSON.stringify(data.printArea) : (typeof data.printArea === "string" && data.printArea ? data.printArea : null),
        // Phase 6: ألوان ديناميكية
        baseImagePublicId: typeof data.baseImagePublicId === "string" && data.baseImagePublicId ? data.baseImagePublicId : null,
        availableColors: data.availableColors && typeof data.availableColors === "object" ? JSON.stringify(data.availableColors) : (typeof data.availableColors === "string" && data.availableColors ? data.availableColors : null),
        supplierId: data.supplierId ? Number(data.supplierId) : null,
        showReviews: data.showReviews ?? true,
        hasFreeShipping: data.hasFreeShipping ?? false,
        productType: (data.productType === "customizable" ? "customizable" : "ready"),
        // ── الخيارات الذكية (SHEIN-Style) ─────────────────────────────
        enableSmartVariants: data.enableSmartVariants ?? false,
        smartVariants: data.smartVariants || null,
        // ── Feature toggles (May 19, 2026) ─────────────────────────────
        showLivePreview: data.showLivePreview ?? false,
        enableVolumeOffers: data.enableVolumeOffers ?? false,
        enableVariantUI: data.enableVariantUI ?? false,
        colorImages: data.colorImages || null,
        // ── Phase 7: تخصيصات الأدمن ─────────────────────────────────────
        printColorOptions: data.printColorOptions ? (typeof data.printColorOptions === "string" ? data.printColorOptions : JSON.stringify(data.printColorOptions)) : null,
        quantityTiers: data.quantityTiers ? (typeof data.quantityTiers === "string" ? data.quantityTiers : JSON.stringify(data.quantityTiers)) : null,
        previewWidth: data.previewWidth ? Number(data.previewWidth) : 200,
        previewHeight: data.previewHeight ? Number(data.previewHeight) : 250,
      } as any);
      res.status(201).json(product);
    } catch (e: any) {
      res.status(500).json({ message: "فشل إنشاء المنتج", details: e.message });
    }
  });

  app.patch("/api/admin/products/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = req.body;

      // ─── إعادة حساب السعر/الخصم تلقائياً عند تحديث الخيارات الذكية ───
      if (data.smartVariants !== undefined && data.smartVariants !== null) {
        const computed = computeBaseFromSmartVariants(data.smartVariants, await getExchangeRate());
        if (!computed) {
          return res.status(422).json({
            message: "⛔ الخيارات الذكية يجب أن تحتوي على متغيّر واحد على الأقل بسعر > 0.",
          });
        }
        data.price = computed.price;
        data.priceSar = computed.priceSar;
        data.originalPrice = computed.originalPrice;
        data.originalPriceSar = computed.originalPriceSar;
        data.discountPercent = computed.discountPercent;
      }

      // ── Safety Net: رفض أي سعر أقل من الحد الأحمر ──────────────────
      if (data.price !== undefined) {
        const { pool: dbPool } = await import("./db");
        const costRow = await dbPool.query(
          `SELECT red_line_price FROM product_costs WHERE product_id=$1`, [id]
        );
        if (costRow.rows[0]) {
          const redLine = parseFloat(costRow.rows[0].red_line_price);
          const newPrice = parseFloat(String(data.price));
          if (redLine > 0 && newPrice < redLine) {
            return res.status(422).json({
              message: `⛔ السعر المدخل (${newPrice.toLocaleString()} ر.ي) أقل من الحد الأحمر (${redLine.toLocaleString()} ر.ي). لا يمكن الحفظ.`,
              redLine,
              enteredPrice: newPrice,
            });
          }
        }
      }
      // ─────────────────────────────────────────────────────────────────

      // ⚠️ السعر/السعر بالريال السعودي/السعر الأصلي/نسبة الخصم تُحسب server-side فقط من smartVariants.
      // نسمح فقط بمرور هذه الحقول إن كانت data.smartVariants موجوداً (أعيد حسابها أعلاه)،
      // وإلا نُسقطها لمنع تلاعب العميل.
      const allowPricingFields = data.smartVariants !== undefined && data.smartVariants !== null;
      const baseFields = [
        "name", "description", "categoryId", "subcategoryId", "isActive",
        "imageUrl", "imageUrls", "stock", "colors", "sizes",
        "allowDesignUpload", "printingPricePerUnit", "hasPrintingOptions",
        "baseBagPrice", "singleColorPrintPrice", "availableBagColors", "tags",
        "bulkPricing", "sizePricing", "showReviews", "showInPrinting",
        "printingCategoryId", "supplierId",
        "printingDesignFeeOverride", "printingColorPriceOverride", "printingSidePriceOverride",
        "printArea",
        "baseImagePublicId", "availableColors",
        "enableVariantUI", "colorImages",
        "promotionalTags",
        "hasFreeShipping", "productType", "enableSmartVariants", "smartVariants",
        // Feature toggles (May 19, 2026)
        "showLivePreview", "enableVolumeOffers",
        // Phase 7
        "printColorOptions", "quantityTiers", "previewWidth", "previewHeight",
      ];
      // Phase 7: تطبيع JSON objects → strings
      if (Object.prototype.hasOwnProperty.call(data, "printColorOptions")) {
        const v = data.printColorOptions;
        data.printColorOptions = v && typeof v === "object" ? JSON.stringify(v) : (typeof v === "string" && v ? v : null);
      }
      if (Object.prototype.hasOwnProperty.call(data, "quantityTiers")) {
        const v = data.quantityTiers;
        data.quantityTiers = v && typeof v === "object" ? JSON.stringify(v) : (typeof v === "string" && v ? v : null);
      }
      if (Object.prototype.hasOwnProperty.call(data, "previewWidth")) {
        data.previewWidth = data.previewWidth ? Number(data.previewWidth) : 200;
      }
      if (Object.prototype.hasOwnProperty.call(data, "previewHeight")) {
        data.previewHeight = data.previewHeight ? Number(data.previewHeight) : 250;
      }
      // Phase 5: تطبيع printArea (object → JSON string) لمطابقة سلوك POST
      if (Object.prototype.hasOwnProperty.call(data, "printArea")) {
        const pa = data.printArea;
        data.printArea = pa && typeof pa === "object" ? JSON.stringify(pa) : (typeof pa === "string" && pa ? pa : null);
      }
      // Phase 6: تطبيع availableColors
      if (Object.prototype.hasOwnProperty.call(data, "availableColors")) {
        const ac = data.availableColors;
        data.availableColors = ac && typeof ac === "object" ? JSON.stringify(ac) : (typeof ac === "string" && ac ? ac : null);
      }
      const fields = allowPricingFields
        ? [...baseFields, "price", "priceSar", "originalPrice", "originalPriceSar", "discountPercent"]
        : baseFields;
      const update = pickFields(data as Record<string, unknown>, fields);
      // ⚠️ تنظيف روابط البروكسي قبل الحفظ (لئلا تطمس الصور الأصلية)
      // قاعدة: الـ imageUrl الذي يبدأ بـ /api/products/image/ يعني "نفس الصورة القديمة" — نحلّه إلى الحقيقي.
      const { pool: dbPool2 } = await import("./db");
      const oldRow = (await dbPool2.query(
        `SELECT image_url, image_urls FROM products WHERE id = $1`, [id]
      )).rows[0] || {};
      const oldMain: string | null = oldRow.image_url || null;
      const oldGallery: string[] = Array.isArray(oldRow.image_urls) ? oldRow.image_urls : [];

      if (typeof update.imageUrl === "string" && isProxyImageUrl(update.imageUrl)) {
        // حلّ الـ proxy إلى الصورة الحقيقية إن وُجدت، وإلا تجاهل التحديث
        if (oldMain) update.imageUrl = oldMain; else delete update.imageUrl;
      }
      if (Array.isArray(update.imageUrls)) {
        const resolved = update.imageUrls.map((u: any, i: number) => {
          if (typeof u !== "string") return null;
          if (!isProxyImageUrl(u)) return u;
          // استخرج الفهرس من /api/products/image/:id/:index — متجاهلًا أي ?v=...
          const path = u.split("?")[0];
          const m = path.match(/\/api\/products\/image\/\d+(?:\/(\d+))?$/);
          const idx = m && m[1] != null ? parseInt(m[1]) : i;
          return oldGallery[idx] ?? oldMain ?? null;
        }).filter((x: any): x is string => typeof x === "string" && x.length > 0);
        update.imageUrls = resolved;
      }
      const product = await storage.updateProduct(id, update);
      res.json(product);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث المنتج", details: e.message });
    }
  });

  app.delete("/api/admin/products/:id", requireAdmin, async (req, res) => {
    try {
      const pid = parseInt(req.params.id);
      const { pool: dbPool } = await import("./db");
      // حذف آمن: نزيل أو نلغي كل المراجع قبل حذف المنتج
      await dbPool.query(`DELETE FROM cart_items WHERE product_id = $1`, [pid]);
      await dbPool.query(`UPDATE order_items SET product_id = NULL WHERE product_id = $1`, [pid]);
      await dbPool.query(`DELETE FROM reviews WHERE product_id = $1`, [pid]);
      await dbPool.query(`DELETE FROM wishlist WHERE product_id = $1`, [pid]);
      await dbPool.query(`DELETE FROM product_views WHERE product_id = $1`, [pid]);
      await dbPool.query(`DELETE FROM product_costs WHERE product_id = $1`, [pid]);
      await storage.deleteProduct(pid);
      res.json({ message: "تم الحذف بنجاح" });
    } catch (e: any) {
      res.status(500).json({ message: "فشل حذف المنتج", details: e.message });
    }
  });

  // ─── Home Sections (أقسام الصفحة الرئيسية) ───────────────────────
  app.get("/api/home-sections", async (_req, res) => {
    try {
      const sections = await storage.getHomeSections();
      res.json(sections);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب الأقسام", details: e.message });
    }
  });

  app.post("/api/admin/home-sections", requireAdmin, async (req, res) => {
    try {
      const section = await storage.createHomeSection(req.body);
      res.status(201).json(section);
    } catch (e: any) {
      res.status(500).json({ message: "فشل إنشاء القسم", details: e.message });
    }
  });

  app.patch("/api/admin/home-sections/:id", requireAdmin, async (req, res) => {
    try {
      // حذف الحقول التلقائية لمنع خطأ التحويل
      const { id: _id, createdAt: _createdAt, ...data } = req.body;
      const section = await storage.updateHomeSection(parseInt(req.params.id), data);
      res.json(section);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث القسم", details: e.message });
    }
  });

  app.delete("/api/admin/home-sections/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteHomeSection(parseInt(req.params.id));
      res.json({ message: "تم الحذف" });
    } catch (e: any) {
      res.status(500).json({ message: "فشل الحذف", details: e.message });
    }
  });

  // ─── Products by promotional tag ───────────────────────────────
  app.get("/api/products/by-tag/:tag", async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const tag = req.params.tag;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 8;
      let rows: any[];
      if (tag === "bestsellers") {
        const result = await dbPool.query(
          `SELECT ${LITE_COLS} FROM products ORDER BY sold_count DESC NULLS LAST LIMIT $1`, [limit]
        );
        rows = result.rows.map((r: any) => mapProductRow(r));
      } else if (tag === "new") {
        const result = await dbPool.query(
          `SELECT ${LITE_COLS} FROM products ORDER BY id DESC LIMIT $1`, [limit]
        );
        rows = result.rows.map((r: any) => mapProductRow(r));
      } else if (tag === "discounts") {
        const result = await dbPool.query(
          `SELECT ${LITE_COLS} FROM products WHERE original_price IS NOT NULL OR discount_percent IS NOT NULL ORDER BY id DESC LIMIT $1`, [limit]
        );
        rows = result.rows.map((r: any) => mapProductRow(r));
      } else {
        const result = await dbPool.query(
          `SELECT ${LITE_COLS} FROM products WHERE $1 = ANY(promotional_tags) ORDER BY id DESC LIMIT $2`,
          [tag, limit]
        );
        rows = result.rows.map((r: any) => mapProductRow(r));
      }
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب المنتجات", details: e.message });
    }
  });

  // ─── Admin Banners ───────────────────────────────────────────────
  app.get("/api/admin/banners", requireAdmin, async (_req, res) => {
    res.json(await storage.getBanners());
  });

  app.get("/api/banners", async (_req, res) => {
    const all = await storage.getBanners();
    res.json(all.filter(b => b.isActive));
  });

  app.post("/api/admin/banners", requireAdmin, async (req, res) => {
    try {
      const banner = await storage.createBanner(req.body);
      res.status(201).json(banner);
    } catch (e: any) {
      res.status(500).json({ message: "فشل إنشاء البنر", details: e.message });
    }
  });

  app.patch("/api/admin/banners/:id", requireAdmin, async (req, res) => {
    try {
      const banner = await storage.updateBanner(parseInt(req.params.id), req.body);
      res.json(banner);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث البنر", details: e.message });
    }
  });

  app.delete("/api/admin/banners/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteBanner(parseInt(req.params.id));
      res.json({ message: "تم الحذف" });
    } catch (e: any) {
      res.status(500).json({ message: "فشل حذف البنر", details: e.message });
    }
  });

  // ─── Admin Offers ────────────────────────────────────────────────
  app.get("/api/admin/offers", requireAdmin, async (_req, res) => {
    res.json(await storage.getOffers());
  });

  app.get("/api/offers", async (_req, res) => {
    const all = await storage.getOffers();
    res.json(all.filter(o => o.isActive));
  });

  app.post("/api/admin/offers", requireAdmin, async (req, res) => {
    try {
      const offer = await storage.createOffer(req.body);
      res.status(201).json(offer);
    } catch (e: any) {
      res.status(500).json({ message: "فشل إنشاء العرض", details: e.message });
    }
  });

  app.patch("/api/admin/offers/:id", requireAdmin, async (req, res) => {
    try {
      const offer = await storage.updateOffer(parseInt(req.params.id), req.body);
      res.json(offer);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث العرض", details: e.message });
    }
  });

  app.delete("/api/admin/offers/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteOffer(parseInt(req.params.id));
      res.json({ message: "تم الحذف" });
    } catch (e: any) {
      res.status(500).json({ message: "فشل حذف العرض", details: e.message });
    }
  });

  // ─── Navigation Settings (Public) ─────────────────────────────────
  app.get("/api/navigation-settings", async (_req, res) => {
    try {
      const settings = await storage.getNavigationSettings();
      res.json(settings);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب إعدادات التنقل" });
    }
  });

  // ─── Printing Products (Public) ───────────────────────────────────
  app.get("/api/printing-products", async (_req, res) => {
    try {
      const products = await storage.getPrintingProducts();
      // ─── تخفيف الـ payload: استبدل صور base64 بروابط خفيفة ─────
      const lightweight = products.map((p: any) => {
        const rawImg: string = p.imageUrl || "";
        const lightImageUrl = rawImg.startsWith("data:")
          ? proxyImg("products", p.id, rawImg)
          : (rawImg || null);
        const lightImageUrls = Array.isArray(p.imageUrls)
          ? p.imageUrls.map((url: string, i: number) =>
              typeof url === "string" && url.startsWith("data:")
                ? proxyImg("products", p.id, url, i)
                : url
            )
          : [];
        return { ...p, imageUrl: lightImageUrl, imageUrls: lightImageUrls };
      });
      res.set("Cache-Control", "public, max-age=60, must-revalidate");
      res.json(lightweight);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب منتجات الطباعة" });
    }
  });

  // ─── 🤖 موظف المبيعات الذكي (Gemini Sales Agent) ────────────────
  // ─── موظف الطباعة الذكي المتخصص ─────────────────────────────────────────────
  app.post("/api/ai/printing-chat", async (req, res) => {
    try {
      const { message, history, productType } = req.body || {};
      if (!message || typeof message !== "string" || message.trim().length === 0) {
        return res.status(400).json({ message: "الرسالة مطلوبة" });
      }
      if (message.length > 1200) {
        return res.status(400).json({ message: "الرسالة طويلة جداً" });
      }
      const { handlePrintingChat } = await import("./printing-ai");
      const result = await handlePrintingChat({
        message: message.trim(),
        history: Array.isArray(history) ? history.slice(-16) : [],
        productType: typeof productType === "string" ? productType : undefined,
      });
      res.json(result);
    } catch (e: any) {
      console.error("[/api/ai/printing-chat] خطأ:", e?.message);
      res.status(500).json({ reply: "عذراً، حصل خلل. حاول مرة أخرى.", error: e?.message });
    }
  });

  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { message, history, productId, uploadedLogoUrl, mockupsShownCount } = req.body || {};
      if (!message || typeof message !== "string" || message.trim().length === 0) {
        return res.status(400).json({ message: "الرسالة مطلوبة" });
      }
      if (message.length > 1000) {
        return res.status(400).json({ message: "الرسالة طويلة جداً (الحد الأقصى 1000 حرف)" });
      }
      const { handleSalesChat } = await import("./ai-agents");
      const userId = (req as any).user?.id || (req.session as any)?.userId || null;

      // ── جلب بيانات العميل إذا كان مسجّل الدخول ──────────────────
      let userProfile: { name?: string | null; phone?: string | null; city?: string | null; address?: string | null } | null = null;
      if (userId) {
        try {
          const { pool: dbPool } = await import("./db");
          const userRow = await dbPool.query(
            `SELECT name, phone, city, address FROM users WHERE id = $1`,
            [userId]
          );
          if (userRow.rows[0]) {
            const u = userRow.rows[0];
            userProfile = {
              name: u.name || null,
              phone: u.phone || null,
              city: u.city || null,
              address: u.address || null,
            };
          }
        } catch {}
      }

      const result = await handleSalesChat({
        history: Array.isArray(history) ? history.slice(-12) : [],
        message: message.trim(),
        productId: productId ? Number(productId) : undefined,
        userId,
        uploadedLogoUrl: typeof uploadedLogoUrl === "string" ? uploadedLogoUrl : null,
        userProfile,
        mockupsShownCount: typeof mockupsShownCount === "number" ? mockupsShownCount : 0,
      });
      res.json(result);
    } catch (e: any) {
      console.error("[/api/ai/chat] خطأ:", e?.message);
      res.status(500).json({ reply: "عذراً، حصل خلل تقني. حاول مرة أخرى.", error: e?.message });
    }
  });

  // ─── إعدادات الموظف الذكي (أدمن) ────────────────────────────────
  app.get("/api/admin/ai-settings", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(`SELECT * FROM ai_sales_settings WHERE id = 1`);
      res.json(r.rows[0] || {});
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/admin/ai-settings", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const b = req.body || {};
      await dbPool.query(`
        UPDATE ai_sales_settings SET
          is_enabled = COALESCE($1, is_enabled),
          personality_prompt = COALESCE($2, personality_prompt),
          strict_rules = COALESCE($3, strict_rules),
          discount_tier_1_qty = COALESCE($4, discount_tier_1_qty),
          discount_tier_1_percent = COALESCE($5, discount_tier_1_percent),
          discount_tier_2_qty = COALESCE($6, discount_tier_2_qty),
          discount_tier_2_percent = COALESCE($7, discount_tier_2_percent),
          discount_tier_3_qty = COALESCE($8, discount_tier_3_qty),
          discount_tier_3_percent = COALESCE($9, discount_tier_3_percent),
          discount_tier_4_percent = COALESCE($10, discount_tier_4_percent),
          max_discount_override = COALESCE($11, max_discount_override),
          manufacturing_days_default = COALESCE($12, manufacturing_days_default),
          shipping_normal_days = COALESCE($13, shipping_normal_days),
          shipping_fast_days = COALESCE($14, shipping_fast_days),
          shipping_normal_cost = COALESCE($15, shipping_normal_cost),
          shipping_fast_cost = COALESCE($16, shipping_fast_cost),
          free_shipping_threshold = COALESCE($17, free_shipping_threshold),
          temperature = COALESCE($18, temperature),
          max_products_in_context = COALESCE($19, max_products_in_context),
          allow_mockup_generation = COALESCE($20, allow_mockup_generation),
          updated_at = NOW()
        WHERE id = 1
      `, [
        b.isEnabled ?? null, b.personalityPrompt ?? null, b.strictRules ?? null,
        b.discountTier1Qty ?? null, b.discountTier1Percent ?? null,
        b.discountTier2Qty ?? null, b.discountTier2Percent ?? null,
        b.discountTier3Qty ?? null, b.discountTier3Percent ?? null,
        b.discountTier4Percent ?? null, b.maxDiscountOverride ?? null,
        b.manufacturingDaysDefault ?? null,
        b.shippingNormalDays ?? null, b.shippingFastDays ?? null,
        b.shippingNormalCost ?? null, b.shippingFastCost ?? null,
        b.freeShippingThreshold ?? null,
        b.temperature ?? null, b.maxProductsInContext ?? null,
        b.allowMockupGeneration ?? null,
      ]);
      const r = await dbPool.query(`SELECT * FROM ai_sales_settings WHERE id = 1`);
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // سجل محادثات الموظف الذكي (أدمن)
  app.get("/api/admin/ai-conversations", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(`
        SELECT id, user_id, product_id, order_id, created_at, messages
        FROM ai_conversations ORDER BY created_at DESC LIMIT 50
      `);
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── نموذج مبدئي (Mockup) — شعار العميل على صورة المنتج ─────────
  app.get("/api/ai/mockup/render", async (req, res) => {
    const esc = (s: string) => String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[c]);
    const isSafeUrl = (u: string) => /^https?:\/\//i.test(u) || u.startsWith("/");
    const product = String(req.query.product || "");
    const logo = String(req.query.logo || "");
    const name = String(req.query.name || "المنتج");
    if (!product || !logo || !isSafeUrl(product) || !isSafeUrl(logo)) {
      return res.status(400).send("invalid or missing image url");
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Security-Policy", "default-src 'none'; img-src * data:; style-src 'unsafe-inline'");
    res.send(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>نموذج مبدئي - ${esc(name)}</title>
<style>
body{margin:0;font-family:system-ui,Arial;background:#f5f5f5;display:flex;flex-direction:column;align-items:center;padding:20px;gap:12px;}
.stage{position:relative;width:min(90vw,500px);aspect-ratio:1/1;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.1);}
.stage img.bg{width:100%;height:100%;object-fit:cover;}
.stage img.logo{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);max-width:40%;max-height:40%;filter:drop-shadow(0 4px 8px rgba(0,0,0,.3));background:transparent;}
h1{font-size:18px;color:#222;margin:4px 0;}
.note{font-size:13px;color:#666;text-align:center;max-width:500px;}
</style></head><body>
<h1>نموذج مبدئي — ${esc(name)}</h1>
<div class="stage"><img class="bg" src="${esc(product)}"/><img class="logo" src="${esc(logo)}"/></div>
<p class="note">هذا نموذج تقريبي لعرض الشعار على المنتج. التصميم النهائي سيتم تجهيزه بعد تأكيد الطلب.</p>
</body></html>`);
  });

  // ── Phase 7: تحسين الشعار بالذكاء الاصطناعي ─────────────────────────
  // إزالة خلفية + تحسين تباين + توضيح حواف باستخدام sharp (server-side)
  // أقوى وأسرع من Canvas client-side
  app.post("/api/ai/enhance-logo", async (req, res) => {
    try {
      const { imageDataUrl } = req.body || {};
      if (!imageDataUrl || typeof imageDataUrl !== "string") {
        return res.status(400).json({ message: "imageDataUrl مطلوب" });
      }
      // استخراج base64 من data URL
      const match = imageDataUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
      if (!match) return res.status(400).json({ message: "صيغة data URL غير صالحة" });
      const inputBuffer = Buffer.from(match[1], "base64");
      if (inputBuffer.length > 8 * 1024 * 1024) {
        return res.status(413).json({ message: "الصورة كبيرة جداً (الحد ٨ ميجا)" });
      }

      const sharp = (await import("sharp")).default;

      // تحجيم إلى حد أقصى ٨٠٠ بكسل للأداء
      const resized = await sharp(inputBuffer)
        .resize(800, 800, { fit: "inside", withoutEnlargement: true })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const { data, info } = resized;
      const out = Buffer.from(data);

      // إزالة خلفية بيضاء (threshold أقوى من Canvas) + anti-aliasing zone
      for (let i = 0; i < out.length; i += 4) {
        const r = out[i], g = out[i + 1], b = out[i + 2];
        // خلفية بيضاء صريحة → شفافية كاملة
        if (r > 235 && g > 235 && b > 235) {
          out[i + 3] = 0;
        } else if (r > 210 && g > 210 && b > 210) {
          // منطقة انتقالية → شفافية متدرّجة (نعومة الحواف)
          const minRGB = Math.min(r, g, b);
          out[i + 3] = Math.max(0, Math.min(255, Math.round(((minRGB - 210) / 25) * 255)));
        }
      }

      // إعادة بناء الصورة + تطبيق normalize + sharpen
      const enhanced = await sharp(out, {
        raw: { width: info.width, height: info.height, channels: 4 },
      })
        .normalise()
        .sharpen({ sigma: 1.0 })
        .png({ compressionLevel: 8 })
        .toBuffer();

      const enhancedDataUrl = `data:image/png;base64,${enhanced.toString("base64")}`;
      res.json({ enhancedDataUrl, method: "sharp" });
    } catch (e: any) {
      console.error("[enhance-logo] error:", e?.message || e);
      res.status(500).json({ message: "فشل تحسين الصورة", details: e?.message });
    }
  });

  // رفع شعار العميل من المحادثة (Cloudinary)
  app.post("/api/ai/upload-logo", async (req, res) => {
    try {
      const { imageBase64 } = req.body || {};
      if (!imageBase64 || typeof imageBase64 !== "string") {
        return res.status(400).json({ message: "الصورة مطلوبة" });
      }
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;
      if (!cloudName || !apiKey || !apiSecret) {
        return res.status(500).json({ message: "خدمة رفع الصور غير مُعدّة" });
      }
      const timestamp = Math.floor(Date.now() / 1000);
      const folder = "oyoplast/ai-chat-logos";
      const crypto = await import("crypto");
      const signStr = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
      const signature = crypto.createHash("sha1").update(signStr).digest("hex");
      const form = new URLSearchParams();
      form.append("file", imageBase64);
      form.append("api_key", apiKey);
      form.append("timestamp", String(timestamp));
      form.append("folder", folder);
      form.append("signature", signature);
      const up = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: form,
      });
      const data: any = await up.json();
      if (!up.ok || !data.secure_url) {
        return res.status(500).json({ message: "فشل الرفع", details: data });
      }
      res.json({ url: data.secure_url });
    } catch (e: any) {
      console.error("[/api/ai/upload-logo]", e?.message);
      res.status(500).json({ message: e.message });
    }
  });

  // توليد رابط Mockup
  app.post("/api/ai/mockup", async (req, res) => {
    try {
      const { productId, logoUrl, selectedColor } = req.body || {};
      if (!productId || !logoUrl) return res.status(400).json({ message: "productId و logoUrl مطلوبان" });
      const { generateMockup } = await import("./ai-agents");
      const result = await generateMockup({ productId: Number(productId), logoUrl, selectedColor });
      if (!result) return res.status(404).json({ message: "المنتج غير موجود" });
      res.json(result);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── فئات الطباعة الاحترافية (Public + Admin) ─────────────────────
  app.get("/api/printing-categories", async (_req, res) => {
    try {
      const cats = await storage.getPrintingCategories();
      res.json(cats);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب فئات الطباعة" });
    }
  });

  app.post("/api/admin/printing-categories", requireAdmin, async (req, res) => {
    try {
      const cat = await storage.createPrintingCategory(req.body);
      res.json(cat);
    } catch (e: any) {
      res.status(500).json({ message: "فشل إنشاء فئة الطباعة" });
    }
  });

  app.patch("/api/admin/printing-categories/:id", requireAdmin, async (req, res) => {
    try {
      const cat = await storage.updatePrintingCategory(Number(req.params.id), req.body);
      res.json(cat);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث فئة الطباعة" });
    }
  });

  app.delete("/api/admin/printing-categories/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deletePrintingCategory(Number(req.params.id));
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: "فشل حذف فئة الطباعة" });
    }
  });

  // ─── Visitor Tracking (Public) ────────────────────────────────────
  app.post("/api/track-visit", async (req, res) => {
    try {
      const { sessionId } = req.body;
      if (!sessionId) return res.json({ ok: true });
      const { pool: dbPool } = await import("./db");
      const client = await dbPool.connect();
      try {
        await client.query(`
          INSERT INTO visitor_sessions (session_id, last_seen, page_views)
          VALUES ($1, NOW(), 1)
          ON CONFLICT (session_id) DO UPDATE
          SET last_seen = NOW(), page_views = visitor_sessions.page_views + 1
        `, [sessionId]);
      } finally { client.release(); }
      res.json({ ok: true });
    } catch { res.json({ ok: true }); }
  });

  // ─── Admin Stats ───────────────────────────────────────────────────
  app.get("/api/admin/stats", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const client = await dbPool.connect();
      try {
        const [usersRes, visitorsRes, activeRes] = await Promise.all([
          client.query(`SELECT COUNT(*) FROM users`),
          client.query(`SELECT COUNT(DISTINCT session_id) FROM visitor_sessions`),
          client.query(`SELECT COUNT(DISTINCT session_id) FROM visitor_sessions WHERE last_seen > NOW() - INTERVAL '5 minutes'`),
        ]);
        res.json({
          registeredUsers: parseInt(usersRes.rows[0].count),
          totalVisitors: parseInt(visitorsRes.rows[0].count),
          activeNow: parseInt(activeRes.rows[0].count),
        });
      } finally { client.release(); }
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب الإحصائيات", details: e.message });
    }
  });

  // ─── Home Page Settings (Madeline Theme) ──────────────────────────
  app.get("/api/home-settings", async (_req, res) => {
    try {
      const settings = await storage.getHomePageSettings();
      res.json(settings);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب إعدادات الصفحة الرئيسية" });
    }
  });

  app.patch("/api/admin/home-settings", requireAdmin, async (req, res) => {
    try {
      const body = req.body;
      const updateData: Record<string, any> = {
        showHeader: body.showHeader ?? true,
        showBanners: body.showBanners ?? true,
        showOffers: body.showOffers ?? true,
        showCategories: body.showCategories ?? true,
        footerPrivacyText: body.footerPrivacyText ?? "سياسة الخصوصية",
        footerAffiliateText: body.footerAffiliateText ?? "التسويق بالعمولة",
        footerReturnsText: body.footerReturnsText ?? "سياسة الاسترجاع",
        footerBottomText: body.footerBottomText ?? "أويو بلاست - مستلزمات التغليف",
        signupEntryMode: body.signupEntryMode ?? "cart",
        loginFlow: body.loginFlow ?? "checkout",
      };
      if (body.primaryColor !== undefined) updateData.primaryColor = body.primaryColor;
      if (body.accentColor !== undefined) updateData.accentColor = body.accentColor;
      if (body.privacyContent !== undefined) updateData.privacyContent = body.privacyContent;
      if (body.returnsContent !== undefined) updateData.returnsContent = body.returnsContent;
      if (body.affiliateContent !== undefined) updateData.affiliateContent = body.affiliateContent;
      const settings = await storage.updateHomePageSettings(updateData as any);
      res.json(settings);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث إعدادات الصفحة الرئيسية", details: e.message });
    }
  });

  // ─── Display Settings (Public) ───────────────────────────────────
  app.get("/api/display-settings", async (_req, res) => {
    try {
      const settings = await storage.getDisplaySettings();
      res.json(settings);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب إعدادات العرض" });
    }
  });

  app.patch("/api/admin/display-settings", requireAdmin, async (req, res) => {
    try {
      // حقول صحيحة معروفة — integer fields
      const intFields = [
        'categorySize', 'categoriesPerRow',
        'subcategoryCircleSize', 'subcategoryStripHeight',
        'productCardWidth', 'productCardHeight',
        'offerBannerHeight',
        'productCardMargin', 'productCardPaddingV', 'priceFontSize',
        'discountBubbleSize', 'quantityButtonHeight',
        'detailImageHeight', 'detailPriceFontSize',
        'detailAddToCartHeight', 'detailThumbnailSize',
        'detailPaddingV', 'detailMarginH', 'detailSectionGap', 'detailTopPadding', 'detailDiscountBubbleSize',
        'sadeemFreeShippingMin', 'sadeemMarketerDiscount',
        'shippingFee', 'sliderHeight', 'offerBannerCols',
        'installmentMinAmount', 'categoriesRows', 'categoriesBorderRadius',
        'drawerWidth',
        'partnersMinOrders',
      ];
      // boolean fields
      const boolFields = [
        'showCategories', 'showOfferBanners',
        'detailShowRelated', 'detailShowReviews', 'showStickyCartBar',
        'detailShowThumbnails',
        'sadeemShowOldPrice', 'sadeemShowDiscountBadge',
        'sadeemShowRating', 'sadeemShowSoldCount',
        'sadeemShowShipping', 'sadeemShowReturns',
        'codEnabled', 'installmentEnabled',
        // ── أقسام الصفحة الرئيسية ──
        'showWhyUs', 'whyUsOnHome', 'whyUsOnAccount',
        'showStats', 'statsOnHome', 'statsOnAccount',
        'showFaq', 'faqOnHome', 'faqOnAccount',
        'partnersOnAccount',
        // ── صفحة المنتج — نمط وأزرار ──
        'detailSheinLayout', 'detailShowAddToCart', 'detailShowShopNow',
        // ── إعدادات جديدة ──
        'promoBarEnabled', 'showMarketerCouponToAll', 'detailHideHeaderName',
        'flashSaleEnabled',
        // ── واتساب والأزرار العائمة ──
        'showWhatsappButton', 'showAiEmployee', 'showSupportRobot',
        // ── عرض تفاصيل المنتج — السلة ──
        'cartShowColor', 'cartShowSize', 'cartShowBagColor',
        'cartShowPrintColors', 'cartShowDesignFile', 'cartShowDesignNotes',
        // ── عرض تفاصيل المنتج — الدفع ──
        'checkoutShowColor', 'checkoutShowSize', 'checkoutShowBagColor',
        'checkoutShowPrintColors', 'checkoutShowDesignFile', 'checkoutShowDesignNotes',
        // ── عرض تفاصيل المنتج — تأكيد الطلب ──
        'orderShowColor', 'orderShowSize', 'orderShowBagColor',
        'orderShowPrintColors', 'orderShowDesignFile', 'orderShowDesignNotes',
      ];
      // text fields
      const textFields = [
        'imageMode', 'detailImageMode', 'discountBadgeBg',
        'whyUsSize', 'statsSize', 'faqSize',
        'installmentPercentages', 'categoriesLayout', 'categoriesShape',
        'drawerBgFrom', 'drawerBgTo',
        'offerBannerShippingBg', 'offerBannerDealsBg',
        'appFontArabic', 'appFontNumbers',
        // ── إعدادات جديدة ──
        'promoBarText', 'promoBarColor', 'promoBarDetails',
        'flashSaleBg', 'flashSaleTag',
        // ── واتساب والأزرار العائمة ──
        'whatsappNumber', 'whatsappMessage', 'whatsappPages',
        'aiEmployeePages', 'supportRobotPages',
        // ── وضع عرض عناصر السلة/الدفع/الطلب ──
        'cartItemMode', 'checkoutItemMode', 'orderItemMode',
        // ── منتقي الألوان والمقاس في صفحة المنتج ──
        'pdpColorLayout', 'pdpSizeLayout', 'pdpSizeStyle',
      ];
      // add new int fields
      intFields.push('pdpColorThumbnailW', 'pdpColorThumbnailH', 'pdpSizeButtonW', 'pdpSizeButtonH');
      // add new bool fields
      boolFields.push('pdpColorCollapsible', 'pdpSizeShowPrice', 'pdpSizeCollapsible');

      const body = req.body as Record<string, unknown>;
      const patch: Record<string, any> = {
        ...Object.fromEntries(
          Object.entries(pickFields(body, intFields)).map(([k, v]) => [k, parseInt(v as string)])
        ),
        ...pickFields(body, boolFields),
        ...pickFields(body, textFields),
      };

      const settings = await storage.updateDisplaySettings(patch);
      res.json(settings);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث إعدادات العرض", details: e.message });
    }
  });

  app.patch("/api/admin/navigation-settings", requireAdmin, async (req, res) => {
    try {
      const allowed = [
        "showPrintingSection", "showSignupEntryPoint", "enableVariantProductPage",
        "lockMobilePwaMode", "disablePinchZoom", "disableHorizontalScroll",
        "enablePhoneLogin", "enableEmailLogin",
        "loginShowOnTop", "loginShowOnCheckout", "loginShowOnAccount",
      ];
      const patch = pickFields(req.body as Record<string, unknown>, allowed);
      const settings = await storage.updateNavigationSettings(patch);
      res.json(settings);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث إعدادات التنقل", details: e.message });
    }
  });

  // ─── Admin Products - Update Printing Status ──────────────────────
  app.patch("/api/admin/products/:id/printing-status", requireAdmin, async (req, res) => {
    try {
      const product = await storage.updateProduct(parseInt(req.params.id), {
        showInPrinting: req.body.showInPrinting ?? false,
      });
      res.json(product);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث حالة الطباعة", details: e.message });
    }
  });

  // ─── Admin Products - Toggle Visibility ───────────────────────────
  app.patch("/api/admin/products/:id/visibility", requireAdmin, async (req, res) => {
    try {
      const product = await storage.updateProduct(parseInt(req.params.id), {
        isActive: req.body.isActive !== false,
      } as any);
      res.json(product);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث ظهور المنتج", details: e.message });
    }
  });

  // ─── Admin Categories - Toggle Visibility ─────────────────────────
  app.patch("/api/admin/categories/:id/visibility", requireAdmin, async (req, res) => {
    try {
      const cat = await storage.updateCategory(parseInt(req.params.id), {
        isActive: req.body.isActive !== false,
      } as any);
      res.json(cat);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث ظهور القسم", details: e.message });
    }
  });

  // ─── Get User Orders ────────────────────────
  app.get("/api/orders", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user || !getUserId(user)) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { db: dbInstance } = await import("./db");
      const { orders: ordersTable } = await import("@shared/schema");
      const { eq: eqFn } = await import("drizzle-orm");
      const { desc: descFn } = await import("drizzle-orm");

      const userOrders = await dbInstance
        .select()
        .from(ordersTable)
        .where(eqFn(ordersTable.userId, getUserId(user) as string))
        .orderBy(descFn(ordersTable.createdAt));

      res.json(userOrders);
    } catch (e: any) {
      res.status(500).json({ message: "Failed to fetch orders", details: e.message });
    }
  });

  // ─── Create Order (Public - for checkout) ────────────────────────
  app.post("/api/orders/create", orderLimiter, async (req, res) => {
    try {
      const { validateOrderCreation } = await import("./lib/errorHandler");
      const { logOrderCreation, logValidationError } = await import("./lib/logger");
      const { sendOrderConfirmation, sendAdminNotification } = await import("./lib/whatsapp");

      const validation = validateOrderCreation(req.body);
      if (!validation.valid) {
        Object.entries(validation.errors).forEach(([field, message]) => {
          logValidationError(field, message);
        });
        return res.status(400).json({ message: "بيانات الطلب غير مكتملة", errors: validation.errors });
      }

      const {
        customerName, customerEmail, customerPhone, shippingCity, shippingAddress,
        shippingOption, shippingCost, notes, items, paymentMethod = "cash_on_delivery",
        couponCode, discountAmount, subtotalBeforeDiscount,
        customerLat, customerLng, locationAccuracy, locationMethod,
      } = req.body;
      const user = (req as any).user;
      const userId = getUserId(user);

      // 🛡️ تقييد منطقة الخدمة — السماح فقط بمحافظتي ذمار وصنعاء + أمانة العاصمة
      // (الأسماء البديلة بالعربي/اللاتيني مدعومة، تجاهل الفراغات والتشكيل)
      const ALLOWED_SERVICE_CITIES = new Set([
        "ذمار", "صنعاء", "امانة العاصمة", "أمانة العاصمة",
        "dhamar", "sanaa", "sana'a", "sanaa city", "amanat al asimah", "amanah",
      ]);
      const normalizeCity = (v: any) => String(v || "")
        .trim()
        .toLowerCase()
        .replace(/[\u064B-\u065F\u0670]/g, "") // إزالة التشكيل
        .replace(/[إأآا]/g, "ا")
        .replace(/ة/g, "ه")
        .replace(/ى/g, "ي")
        .replace(/\s+/g, " ");
      const allowedNormalized = new Set(Array.from(ALLOWED_SERVICE_CITIES).map(normalizeCity));
      // مطابقة دقيقة فقط (token-aware) — لا نستخدم substring لتجنب تجاوز القيد بإضافة كلمات.
      // ندعم بادئة "محافظة "/"مدينة "/"امانة " بإسقاطها قبل المطابقة.
      const cityNormRaw = normalizeCity(shippingCity);
      const cityNorm = cityNormRaw.replace(/^(محافظه|محافظة|مدينه|مدينة|province|city of)\s+/i, "").trim();
      const cityAllowed = allowedNormalized.has(cityNorm) || allowedNormalized.has(cityNormRaw);
      if (!cityAllowed) {
        return res.status(400).json({
          message: "نأسف، خدمة التوصيل متوفرة حالياً في محافظتي ذمار وصنعاء فقط. سيتم التوسع قريباً.",
          code: "SERVICE_AREA_RESTRICTED",
        });
      }

      // 🔒 إعادة حساب أسعار العناصر والمجموع على الخادم (إصلاح أمني)
      // — يتجاهل item.price/unitPrice و total من العميل ويعتمد على DB حصراً.
      let serverSubtotal = 0;
      const appliedOffersInOrder: Array<{ offerId: number; lineTotal: number; freeShipping: boolean; offerShippingFee: number; marketerCommissionPercent: number | null }> = [];
      if (Array.isArray(items)) {
        for (const it of items) {
          const pid = Number(it.productId ?? (it as any).product_id ?? it.product?.id);
          if (!pid) {
            return res.status(400).json({ message: "بعض المنتجات في الطلب غير صالحة" });
          }
          try {
            const c = await computeServerUnitPrice(pid, it);
            it.price = String(c.unitPrice);
            it.unitPrice = c.unitPrice;
            serverSubtotal += c.lineTotal;
            // التقاط تفاصيل العرض المطبَّق (لاستخدامها في تجاوز الشحن لاحقاً)
            const bd: any = c.breakdown || {};
            if (bd.appliedOfferId) {
              // قراءة marketerCommissionPercent مباشرة من جدول العروض (مصدر الحقيقة)
              let offerMarketerPct: number | null = null;
              try {
                const { pool: pp } = await import("./db");
                const orow = await pp.query(
                  `SELECT marketer_commission_percent FROM product_volume_offers WHERE id=$1`,
                  [bd.appliedOfferId]
                );
                if (orow.rows.length && orow.rows[0].marketer_commission_percent != null) {
                  offerMarketerPct = Number(orow.rows[0].marketer_commission_percent);
                }
              } catch { /* keep null */ }
              appliedOffersInOrder.push({
                offerId: bd.appliedOfferId,
                lineTotal: c.lineTotal,
                freeShipping: !!bd.freeShipping,
                offerShippingFee: Number(bd.offerShippingFee) || 0,
                marketerCommissionPercent: offerMarketerPct,
              });
              // وسم العنصر بمعرّف العرض (للاستخدام في حساب العمولة لاحقاً)
              (it as any)._appliedOfferId = bd.appliedOfferId;
              (it as any)._appliedOfferMarketerPct = offerMarketerPct;
            }
          } catch (e: any) {
            return res.status(400).json({ message: `تعذّر التحقق من سعر المنتج ${pid}`, details: e.message });
          }
        }
      }
      // ─── الشحن: تجاوز عبر العروض إن وُجد ─────────────────────────────────────
      // قاعدة آمنة: لو كل عناصر الطلب تحت عروض، نُطبّق منطق العرض على الشحن.
      // - أي عرض = "شحن مجاني" → الشحن صفر.
      // - وإلا الشحن = أعلى رسوم شحن عرض (لتغطية أي رسوم رمزية أعلى).
      let safeShipping = Math.max(0, Number(shippingCost) || 0);
      if (appliedOffersInOrder.length > 0 && Array.isArray(items) && appliedOffersInOrder.length === items.length) {
        const anyFree = appliedOffersInOrder.some(o => o.freeShipping);
        if (anyFree) {
          safeShipping = 0;
        } else {
          const maxFee = Math.max(...appliedOffersInOrder.map(o => o.offerShippingFee));
          safeShipping = maxFee;
        }
      }
      const safeDiscount = Math.max(0, Number(discountAmount) || 0);
      const total = Math.max(0, Math.round((serverSubtotal - safeDiscount + safeShipping) * 100) / 100);
      const serverSubtotalRounded = Math.round(serverSubtotal * 100) / 100;

      // ─── حماية الأرباح من الكوبونات (Smart Pricing) ───────────────────────────
      if (couponCode && Array.isArray(items) && items.length > 0) {
        try {
          const { validateCouponAgainstCart } = await import("./smart-pricing");
          const { pool: pp } = await import("./db");

          // الحصول على نسبة الخصم والعمولة من الكوبون
          const code = String(couponCode).toUpperCase();
          const smR = await pp.query(
            `SELECT discount_rate AS discount_percent, commission_rate AS marketer_commission_percent
             FROM standalone_marketers WHERE coupon_code=$1 AND is_active=true`,
            [code]
          );
          const cR = smR.rows.length
            ? smR.rows[0]
            : (await pp.query(
                `SELECT discount_percent, marketer_commission_percent FROM coupons WHERE code=$1 AND is_active=true`,
                [code]
              )).rows[0];

          if (cR) {
            const cartItems = items
              .filter((i: any) => i.productId)
              .map((i: any) => ({
                productId: Number(i.productId),
                price: Number(i.price) || 0,
                quantity: Number(i.quantity) || 1,
              }));
            const result = await validateCouponAgainstCart(
              cartItems,
              Number(cR.discount_percent) || 0,
              Number(cR.marketer_commission_percent) || 0
            );
            if (!result.allowed) {
              return res.status(400).json({
                message: result.reason || "هذا الكوبون يأكل أرباح المتجر",
                couponBlocked: true,
                affectedProducts: result.affectedProducts,
              });
            }
          }
        } catch (couponCheckErr: any) {
          console.warn("[smart-pricing] coupon check failed (allowing order):", couponCheckErr.message);
          // فشل الفحص لا يمنع الطلب — نتعامل بسلاسة
        }
      }

      // ─── فحص + حجز ائتمان ذرّي قبل إنشاء الطلب (إن كان الدفع بالأجل) ──────────
      let creditPrecheck: any = null;
      let creditNoteAddon = "";
      let creditReserved = false;
      let creditChargeAmount = 0;
      if (paymentMethod === "credit") {
        if (!userId) {
          return res.status(401).json({ message: "يجب تسجيل الدخول للشراء بالأجل" });
        }
        const orderCurrency = (req.body as any).currency || "YER";
        const orderTotalNum = Number(total);
        const { precheckCreditPurchase, reserveCreditAtomic } =
          await import("./routes/credit-routes");

        // 1) فحص لتوليد رسالة واضحة + احتساب الخصم/المقدّم
        creditPrecheck = await precheckCreditPurchase(userId, orderTotalNum, orderCurrency);
        if (!creditPrecheck.allowed) {
          return res.status(400).json({
            message: creditPrecheck.reason || "تعذّر الشراء بالأجل",
            creditBlocked: true,
          });
        }

        // 2) المبلغ المخصوم من الائتمان (إجمالي - الدفعة المقدمة)
        creditChargeAmount = creditPrecheck.amountOnCredit ?? orderTotalNum;

        // 3) حجز ذرّي يمنع سباق الطلبات المتزامنة
        const reservation = await reserveCreditAtomic(userId, creditChargeAmount);
        if (!reservation.ok) {
          return res.status(409).json({
            message: reservation.reason || "تعذّر حجز الائتمان",
            creditBlocked: true,
          });
        }
        creditReserved = true;

        creditNoteAddon = `\n[شراء بالأجل: فئة ${creditPrecheck.info?.tierNameAr || ''} · مستحق بتاريخ ${creditPrecheck.dueDate} · مدة ${creditPrecheck.info?.paymentTermDays || 0} يوم${
          creditPrecheck.requiredDownPayment ? ` · دفعة مقدمة ${creditPrecheck.requiredDownPayment.toLocaleString()}` : ""
        } · المُحمَّل على الأجل ${creditChargeAmount.toLocaleString()}]`;
      }

      let order;
      try {
        order = await storage.createOrder({
          customerName,
          customerEmail,
          customerPhone,
          shippingCity,
          shippingAddress,
          shippingOption,
          shippingCost,
          notes: (notes || "") + creditNoteAddon,
          total,
          items,
          paymentMethod,
          couponCode: couponCode || null,
          discountAmount: safeDiscount > 0 ? safeDiscount : null,
          subtotalBeforeDiscount: safeDiscount > 0 ? serverSubtotalRounded : null,
          userId,
        });
      } catch (orderErr: any) {
        // فشل إنشاء الطلب → استرجاع الحجز الائتماني (compensating action)
        if (creditReserved && userId) {
          try {
            const { refundCreditReservation } = await import("./routes/credit-routes");
            await refundCreditReservation(userId, creditChargeAmount);
            console.log(`[CREDIT] Refunded ${creditChargeAmount} after order creation failed`);
          } catch (refundErr: any) {
            console.error("[CREDIT] CRITICAL: Failed to refund credit reservation:", refundErr.message);
          }
        }
        throw orderErr;
      }

      // حفظ إحداثيات GPS في الطلب
      if (customerLat != null && customerLng != null) {
        try {
          const { pool: gpsPool } = await import("./db");
          await gpsPool.query(
            `UPDATE orders SET customer_lat=$1, customer_lng=$2, location_accuracy=$3, location_method=$4 WHERE id=$5`,
            [customerLat, customerLng, locationAccuracy || null, locationMethod || "gps", order.id]
          );
        } catch { /* non-fatal */ }
      }

      // ربط عمولة المسوق المستقل تلقائياً إذا استُخدم كوبونه
      if (couponCode) {
        try {
          const { pool: mPool } = await import("./db");
          const smR = await mPool.query(
            `SELECT id, commission_rate FROM standalone_marketers WHERE coupon_code=$1 AND is_active=true`,
            [couponCode.toUpperCase()]
          );
          if (smR.rows.length) {
            const sm = smR.rows[0];
            const defaultPct = Number(sm.commission_rate) || 0;
            // عمولة بحسب العنصر — العرض المُطبَّق له أولوية على نسبة الكوبون
            let commission = 0;
            if (Array.isArray(items) && items.length > 0) {
              for (const it of items) {
                const qty = Number(it.quantity) || 1;
                const unit = Number(it.unitPrice ?? it.price) || 0;
                const line = unit * qty;
                const pct = (it as any)._appliedOfferMarketerPct != null
                  ? Number((it as any)._appliedOfferMarketerPct)
                  : defaultPct;
                commission += (line * pct) / 100;
              }
            } else {
              commission = (Number(total) * defaultPct) / 100;
            }
            await mPool.query(
              `UPDATE orders SET marketer_table_id=$1, marketer_commission_amount=$2 WHERE id=$3`,
              [sm.id, commission.toFixed(2), order.id]
            );
            // تحديث عداد الطلبات للمسوق
            await mPool.query(
              `UPDATE standalone_marketers SET total_orders=total_orders+1 WHERE id=$1`,
              [sm.id]
            );
          }
        } catch { /* non-fatal */ }
      }

      logOrderCreation(order.id, {
        customerName,
        customerPhone,
        total,
        paymentMethod,
        itemsCount: items.length,
      });

      await Promise.allSettled([
        sendOrderConfirmation(customerPhone, order.id, Number(total), "SAR"),
        sendAdminNotification(order.id, customerName, customerPhone, Number(total), items.length),
        // تعيين المورد تلقائياً: GPS أولاً ثم المدينة
        autoAssignSupplier(
          order.id, shippingCity || "", Number(total), req.body.currency || "YER",
          customerName, customerPhone,
          customerLat ? Number(customerLat) : undefined,
          customerLng ? Number(customerLng) : undefined
        ),
        // ── حماية فورية للطلب في سجل الأحداث (T4) ──────────────────────
        (async () => {
          try {
            const { logOrderEvent } = await import("./backup-service");
            await logOrderEvent(order.id, "created", {
              ...req.body,
              orderId: order.id,
              createdAt: new Date().toISOString(),
            });
          } catch { /* non-fatal */ }
        })(),
        // ── إشعار داخلي للموظفين (DB + Telegram) ─────────────────────
        (async () => {
          try {
            const { notifyStaff } = await import("./lib/staff-notify");
            await notifyStaff({
              roles: ["order_manager", "owner"],
              type: "order",
              orderId: order.id,
              title: `📦 طلب جديد #${order.id}`,
              message: `${customerName} · ${customerPhone} · ${shippingCity || "—"} · ${Number(total).toLocaleString()} ${req.body.currency || "ر.ي"}`,
              telegramText: `📦 <b>طلب جديد #${order.id}</b>\n👤 ${customerName}\n📱 ${customerPhone}\n📍 ${shippingCity || "—"}\n💰 ${Number(total).toLocaleString()} ${req.body.currency || "ر.ي"}\n🛒 ${items.length} منتج`,
            });
          } catch { /* non-fatal */ }
        })(),
        // ── مسح سلة المستخدم تلقائياً بعد إنشاء الطلب ──────────────────
        (async () => {
          try {
            if (userId) {
              const { pool: pp } = await import("./db");
              await pp.query(`DELETE FROM cart_items WHERE user_id = $1`, [userId]);
            }
          } catch { /* non-fatal */ }
        })(),
        // ── إشعار داخلي للعميل (in-app) ───────────────────────────────
        (async () => {
          try {
            if (userId) {
              const { notifyOrderCreated } = await import("./lib/notifications");
              await notifyOrderCreated(userId, order.id, Number(total), req.body.currency || "ر.ي");
            }
          } catch { /* non-fatal */ }
        })(),
      ]);

      res.json(order);
    } catch (e: any) {
      const userMessage = e.message?.includes("لم يعد متاحاً") || e.message?.includes("غير صالحة")
        ? e.message
        : "حدث خطأ أثناء إنشاء الطلب، يرجى المحاولة مرة أخرى";
      res.status(500).json({ message: userMessage, details: e.message });
    }
  });

  // ─── تتبع الطلب العام (العميل يدخل رقم الطلب + رقم الهاتف) ────────────────────
  app.post("/api/track-order", async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { orderId, phone } = req.body;
      if (!orderId || !phone) return res.status(400).json({ message: "رقم الطلب والهاتف مطلوبان" });
      const orderRes = await dbPool.query(
        `SELECT o.*, s.name as supplier_name, s.phone as supplier_phone
         FROM orders o
         LEFT JOIN suppliers s ON o.supplier_id = s.id
         WHERE o.id=$1`,
        [parseInt(orderId)]
      );
      if (!orderRes.rows.length) return res.status(404).json({ message: "الطلب غير موجود" });
      const order = orderRes.rows[0];
      // تحقق من الهاتف
      const cleanPhone = phone.replace(/\s+/g, "").replace(/^00/, "+");
      const cleanOrderPhone = (order.customer_phone || "").replace(/\s+/g, "").replace(/^00/, "+");
      if (cleanPhone !== cleanOrderPhone && !cleanOrderPhone.includes(phone.slice(-8))) {
        return res.status(403).json({ message: "رقم الهاتف غير مطابق" });
      }
      // جلب عناصر الطلب مع COALESCE للاسم والصورة
      const itemsRes = await dbPool.query(
        `SELECT oi.*,
                COALESCE(NULLIF(oi.product_name,''), p.name)            AS product_name,
                COALESCE(NULLIF(oi.product_image,''), p.image_urls[1])  AS product_image
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = $1
         ORDER BY oi.id`,
        [parseInt(orderId)]
      );
      const safeOrder = {
        id: order.id,
        status: order.status,
        deliveryStatus: order.delivery_status,
        paymentStatus: order.payment_status,
        customerName: order.customer_name,
        shippingCity: order.shipping_city,
        shippingAddress: order.shipping_address,
        total: order.total,
        currency: order.currency,
        shippingCost: order.shipping_cost,
        shippingOption: order.shipping_option,
        paymentMethod: order.payment_method,
        trackingNumber: order.tracking_number,
        createdAt: order.created_at,
        supplierName: order.supplier_name,
        items: itemsRes.rows,
      };
      res.json(safeOrder);
    } catch (e: any) {
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  // ─── رفع إيصال الدفع لطلب ────────────────────────────────────────────────
  app.post("/api/orders/:id/upload-receipt", upload.single("receipt"), async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const orderId = parseInt(req.params.id);
      if (!req.file) return res.status(400).json({ message: "لم يتم إرفاق صورة" });

      // ─── Kill-switch: إغلاق طارئ لاستقبال الإيصالات (للأدمن) ───
      try {
        const ks = await dbPool.query(`SELECT receipts_enabled FROM display_settings ORDER BY id LIMIT 1`);
        if (ks.rows.length && ks.rows[0].receipts_enabled === false) {
          return res.status(503).json({
            message: "نظام رفع الإيصالات متوقف مؤقتاً للصيانة. يرجى التواصل مع الإدارة.",
          });
        }
      } catch (ksErr: any) {
        // إذا فشل التحقق لأي سبب غير "عمود غير موجود" → نمنع الرفع احتياطاً (fail-safe)
        const msg = String(ksErr?.message || "");
        const isMissingColumn = /column.*receipts_enabled.*does not exist/i.test(msg)
          || /relation.*display_settings.*does not exist/i.test(msg);
        if (!isMissingColumn) {
          console.error("[receipt] kill-switch check failed unexpectedly:", msg);
          return res.status(503).json({ message: "نظام الإيصالات غير متوفر مؤقتاً. حاول لاحقاً." });
        }
      }

      // ─── Authorization: منع الاستيلاء على إيصال طلب آخر ───
      // - لا يُسمح برفع إيصال إلا مرة واحدة (إذا كان NULL)
      // - إذا كان للطلب user_id فيجب أن يتطابق مع الجلسة (للمسجّلين)
      try {
        const ownerCheck = await dbPool.query(
          `SELECT user_id, receipt_image_url FROM orders WHERE id=$1`, [orderId]
        );
        if (!ownerCheck.rows.length) {
          return res.status(404).json({ message: "الطلب غير موجود" });
        }
        const row = ownerCheck.rows[0];
        if (row.receipt_image_url) {
          return res.status(409).json({
            message: "تم رفع إيصال لهذا الطلب مسبقاً. للتعديل تواصل مع الإدارة.",
          });
        }
        const sessionUserId = (req as any)?.user?.claims?.sub || (req as any)?.session?.passport?.user?.claims?.sub || null;
        if (row.user_id && sessionUserId && String(row.user_id) !== String(sessionUserId)) {
          return res.status(403).json({ message: "غير مصرح" });
        }
      } catch { /* defensive */ }

      // ─── المبلغ المُدّعى دفعه (لكشف الاحتيال) ───
      const amountClaimedRaw = req.body?.amountClaimed;
      const amountClaimed = amountClaimedRaw !== undefined && amountClaimedRaw !== ""
        ? Number(amountClaimedRaw)
        : null;

      // ─── رفع الصورة إلى Cloudinary (بدل base64) ───
      let receiptUrl: string;
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;
      if (cloudName && apiKey && apiSecret) {
        try {
          const { v2: cloudinary } = await import("cloudinary");
          cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
          const uploadRes: any = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              {
                folder: "oyo_receipts",
                public_id: `receipt_${orderId}_${Date.now()}`,
                resource_type: "image",
                overwrite: true,
              },
              (err, result) => err ? reject(err) : resolve(result)
            );
            stream.end(req.file!.buffer);
          });
          receiptUrl = uploadRes.secure_url;
        } catch (uploadErr: any) {
          console.error("[receipt] Cloudinary upload failed, falling back to base64:", uploadErr?.message);
          const base64 = req.file.buffer.toString("base64");
          receiptUrl = `data:${req.file.mimetype};base64,${base64}`;
        }
      } else {
        // fallback إذا لم تُعدّ Cloudinary
        const base64 = req.file.buffer.toString("base64");
        receiptUrl = `data:${req.file.mimetype};base64,${base64}`;
      }

      await dbPool.query(
        `UPDATE orders
           SET receipt_image_url=$1,
               payment_status='pending_verification',
               amount_claimed = COALESCE($3, amount_claimed)
         WHERE id=$2`,
        [receiptUrl, orderId, amountClaimed]
      );

      // إشعار المشرف بواتساب عند رفع إيصال جديد
      try {
        const orderRow = await dbPool.query(
          `SELECT customer_name, customer_phone, total, payment_method FROM orders WHERE id=$1`,
          [orderId]
        );
        if (orderRow.rows.length) {
          const o = orderRow.rows[0];
          const methodLabel = o.payment_method === "bank_transfer" ? "تحويل بنكي" : "محفظة إلكترونية";
          const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER || process.env.TWILIO_FROM_NUMBER;
          const accountSid = process.env.TWILIO_ACCOUNT_SID;
          const authToken = process.env.TWILIO_AUTH_TOKEN;
          const fromNumber = process.env.TWILIO_FROM_NUMBER;
          if (adminPhone && accountSid && authToken && fromNumber) {
            const msg = `📥 إيصال دفع جديد!\n━━━━━━━━━━━━━━━━━━━━━\n🆔 طلب: #${orderId}\n👤 العميل: ${o.customer_name}\n📱 الجوال: ${o.customer_phone}\n💰 المبلغ: ${Number(o.total).toLocaleString()} ر.ي\n💳 طريقة الدفع: ${methodLabel}\n━━━━━━━━━━━━━━━━━━━━━\nراجع التحقق: https://oyoplast.com/admin`;
            await fetch(
              `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
              {
                method: "POST",
                headers: {
                  Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({ To: `whatsapp:${adminPhone}`, From: `whatsapp:${fromNumber}`, Body: msg }),
              }
            );
          }
        }
      } catch { /* non-fatal */ }

      // إشعار داخلي للمالي + الأدمن
      try {
        const o2 = await dbPool.query(
          `SELECT customer_name, customer_phone, total, payment_method FROM orders WHERE id=$1`,
          [orderId]
        );
        if (o2.rows.length) {
          const o = o2.rows[0];
          const { notifyStaff } = await import("./lib/staff-notify");
          await notifyStaff({
            roles: ["finance", "owner"],
            type: "payment",
            orderId,
            title: `📥 إيصال دفع جديد #${orderId}`,
            message: `${o.customer_name} · ${Number(o.total).toLocaleString()} ر.ي · ${o.payment_method === "bank_transfer" ? "تحويل بنكي" : "محفظة"}`,
            telegramText: `📥 <b>إيصال جديد بانتظار التحقق</b>\n🆔 طلب #${orderId}\n👤 ${o.customer_name}\n📱 ${o.customer_phone}\n💰 ${Number(o.total).toLocaleString()} ر.ي`,
          });
        }
      } catch { /* non-fatal */ }

      res.json({ message: "تم رفع الإيصال بنجاح", receiptUrl });
    } catch (e: any) {
      res.status(500).json({ message: "فشل رفع الإيصال", error: e.message });
    }
  });

  // ─── الأدمن: التحقق من إيصال الدفع ──────────────────────────────────────────
  // ─── Kill-switch: تشغيل/إيقاف استقبال الإيصالات (للأدمن فقط) ───
  app.get("/api/admin/receipts-enabled", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(`SELECT receipts_enabled FROM display_settings ORDER BY id LIMIT 1`);
      res.json({ enabled: r.rows[0]?.receipts_enabled !== false });
    } catch (e: any) {
      res.json({ enabled: true });
    }
  });

  app.put("/api/admin/receipts-enabled", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const enabled = req.body?.enabled !== false;
      await dbPool.query(`UPDATE display_settings SET receipts_enabled=$1 WHERE id = (SELECT id FROM display_settings ORDER BY id LIMIT 1)`, [enabled]);
      res.json({ success: true, enabled });
    } catch (e: any) {
      res.status(500).json({ message: "فشل" });
    }
  });

  app.get("/api/admin/payment-verifications", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(`
        SELECT id, customer_name, customer_phone, total, payment_method, payment_status,
               receipt_image_url, notes, created_at, shipping_city, amount_claimed
        FROM orders
        WHERE payment_method IN ('bank_transfer','digital_wallet','installment_deposit_cod')
          AND payment_status IN ('pending_verification','unpaid','partial')
          AND receipt_image_url IS NOT NULL
          AND status != 'cancelled'
        ORDER BY created_at DESC
      `);
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب الطلبات" });
    }
  });

  app.patch("/api/admin/payment-verifications/:id", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { action, note, expectedShippingDate } = req.body; // action: 'approve' | 'reject'
      const orderId = parseInt(req.params.id);

      // جلب بيانات الطلب قبل التحديث (لإرسال الإشعار)
      const orderRow = await dbPool.query(
        `SELECT user_id, customer_name, customer_phone, total, payment_method FROM orders WHERE id=$1`,
        [orderId]
      );
      const orderData = orderRow.rows[0];

      // إشعار داخلي للعميل عبر نظام Phase 1
      try {
        if (orderData?.user_id) {
          const { notifyOrderStatus } = await import("./lib/notifications");
          const label = action === "approve" ? "تم تأكيد الدفع ✅" : "تعذّر التحقق من الدفع ❌";
          await notifyOrderStatus(String(orderData.user_id), orderId, label);
        }
      } catch { /* non-fatal */ }

      if (action === "approve") {
        // ─── كشف ما إذا كان هذا اعتماد سداد مديونية (طلب مُسلَّم + amount_claimed > 0) ──
        const fullOrder = await dbPool.query(
          `SELECT id, user_id, status, total, currency,
                  COALESCE(deposit_amount,0)  AS deposit_amount,
                  COALESCE(discount_amount,0) AS discount_amount,
                  COALESCE(amount_claimed,0)  AS amount_claimed
             FROM orders WHERE id=$1`,
          [orderId]
        );
        const ord = fullOrder.rows[0];
        const isDebtPayment =
          ord &&
          ["delivered", "completed"].includes(ord.status) &&
          Number(ord.amount_claimed) > 0;

        if (isDebtPayment) {
          // اعتماد سداد دين: حدّث رصيد العميل + علِّم paid عند التغطية الكاملة
          const total = Number(ord.total);
          const paid =
            Number(ord.deposit_amount) +
            Number(ord.discount_amount) +
            Number(ord.amount_claimed);
          const fullyCovered = paid >= total - 0.5; // tolerance
          const newStatus = fullyCovered ? "paid" : "partial";

          const client = await dbPool.connect();
          try {
            await client.query("BEGIN");
            if (expectedShippingDate) {
              await client.query(
                `UPDATE orders SET payment_status=$2, expected_shipping_date=$3 WHERE id=$1`,
                [orderId, newStatus, expectedShippingDate]
              );
            } else {
              await client.query(
                `UPDATE orders SET payment_status=$2 WHERE id=$1`,
                [orderId, newStatus]
              );
            }
            // خفض رصيد العميل (إن وجد سجل ائتمان)
            if (ord.user_id) {
              const reduction =
                Number(ord.discount_amount) + Number(ord.amount_claimed);
              await client.query(
                `UPDATE customer_credit
                    SET current_balance = GREATEST(0, current_balance - $2),
                        total_paid_amount = COALESCE(total_paid_amount,0) + $2,
                        last_payment_at = NOW(),
                        updated_at = NOW()
                  WHERE customer_id = $1`,
                [ord.user_id, reduction]
              );
            }
            await client.query("COMMIT");
          } catch (txErr: any) {
            await client.query("ROLLBACK");
            console.error("[debt-approve] tx error:", txErr?.message);
            throw txErr;
          } finally {
            client.release();
          }
        } else if (expectedShippingDate) {
          await dbPool.query(
            `UPDATE orders SET payment_status='transferred', expected_shipping_date=$2 WHERE id=$1`,
            [orderId, expectedShippingDate]
          );
        } else {
          await dbPool.query(
            `UPDATE orders SET payment_status='transferred' WHERE id=$1`,
            [orderId]
          );
        }
      } else if (action === "reject") {
        await dbPool.query(
          `UPDATE orders SET payment_status='unpaid', receipt_image_url=NULL WHERE id=$1`,
          [orderId]
        );
      }
      if (note) {
        await dbPool.query(
          `UPDATE orders SET notes=COALESCE(notes,'')||$1 WHERE id=$2`,
          [`\n[ملاحظة الأدمن: ${note}]`, orderId]
        );
      }

      // إشعار العميل بواتساب عند قبول أو رفض الدفع
      if (orderData?.customer_phone) {
        try {
          const phone = orderData.customer_phone.replace(/\s+/g, "").replace(/^00/, "+");
          const accountSid = process.env.TWILIO_ACCOUNT_SID;
          const authToken = process.env.TWILIO_AUTH_TOKEN;
          const fromNumber = process.env.TWILIO_FROM_NUMBER;
          if (phone.startsWith("+") && accountSid && authToken && fromNumber) {
            const trackLink = `https://oyoplast.com/track`;
            let msg = "";
            if (action === "approve") {
              const shipLine = expectedShippingDate ? `📅 موعد الشحن المتوقع: ${expectedShippingDate}\n` : "";
              msg = `✅ تم التحقق من دفعك!\n━━━━━━━━━━━━━━━━━━━━━\n🆔 رقم الطلب: #${orderId}\n💰 المبلغ: ${Number(orderData.total).toLocaleString()} ر.ي\n${shipLine}تم استلام دفعك وتأكيده. سيتم تجهيز طلبك الآن.\n\n🔗 تتبع طلبك: ${trackLink}\n━━━━━━━━━━━━━━━━━━━━━\nأويو بلاست 🛍️`;
            } else if (action === "reject") {
              msg = `❌ تعذّر التحقق من دفعك\n━━━━━━━━━━━━━━━━━━━━━\n🆔 رقم الطلب: #${orderId}\n${note ? `📝 السبب: ${note}\n` : ""}يرجى إعادة رفع صورة الإيصال أو التواصل معنا.\n━━━━━━━━━━━━━━━━━━━━━\nأويو بلاست 🛍️`;
            }
            if (msg) {
              await fetch(
                `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
                {
                  method: "POST",
                  headers: {
                    Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
                    "Content-Type": "application/x-www-form-urlencoded",
                  },
                  body: new URLSearchParams({ To: `whatsapp:${phone}`, From: `whatsapp:${fromNumber}`, Body: msg }),
                }
              );
            }
          }
        } catch { /* non-fatal */ }
      }

      // إشعار داخلي للمالي والأدمن (مع تنبيه الصراف لسحب الحوالة)
      try {
        const { notifyStaff } = await import("./lib/staff-notify");
        if (action === "approve") {
          await notifyStaff({
            roles: ["finance", "owner"],
            type: "payment",
            orderId,
            title: `✅ قبول دفع الطلب #${orderId}`,
            message: `${orderData?.customer_name || ""} · ${Number(orderData?.total || 0).toLocaleString()} ر.ي${expectedShippingDate ? ` · شحن: ${expectedShippingDate}` : ""}`,
            telegramText: `✅ <b>قبول دفع الطلب #${orderId}</b>\n👤 ${orderData?.customer_name || ""}\n💰 ${Number(orderData?.total || 0).toLocaleString()} ر.ي${expectedShippingDate ? `\n📅 شحن: ${expectedShippingDate}` : ""}\n💵 جاهز للصراف لسحب الحوالة وإيداعها`,
          });
        } else if (action === "reject") {
          await notifyStaff({
            roles: ["finance", "owner"],
            type: "payment",
            orderId,
            title: `❌ رفض دفع الطلب #${orderId}`,
            message: `${orderData?.customer_name || ""}${note ? ` · ${note}` : ""}`,
            telegramText: `❌ <b>رفض دفع الطلب #${orderId}</b>\n👤 ${orderData?.customer_name || ""}${note ? `\n📝 ${note}` : ""}`,
          });
        }
      } catch { /* non-fatal */ }

      res.json({ message: "تم تحديث حالة الدفع" });
    } catch (e: any) {
      res.status(500).json({ message: "فشل التحديث" });
    }
  });

  // ─── Internal Notifications API (staff + customers) ─────────────────────────
  app.get("/api/notifications", async (req: any, res) => {
    try {
      const userId = getUserId(req.user) || req.session?.userId;
      if (!userId) return res.json([]);
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(
        `SELECT id, user_id as "userId", title, message, type,
                priority, action_url as "actionUrl", group_key as "groupKey",
                is_read as "isRead", order_id as "orderId", created_at as "createdAt"
         FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`,
        [userId]
      );
      res.json(r.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب الإشعارات" });
    }
  });

  app.get("/api/notifications/unread-count", async (req: any, res) => {
    try {
      const userId = getUserId(req.user) || req.session?.userId;
      if (!userId) return res.json({ count: 0 });
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(
        `SELECT COUNT(*)::int AS c FROM notifications WHERE user_id=$1 AND is_read=false`,
        [userId]
      );
      res.json({ count: r.rows[0]?.c || 0 });
    } catch {
      res.json({ count: 0 });
    }
  });

  app.patch("/api/notifications/:id/read", async (req: any, res) => {
    try {
      const userId = getUserId(req.user) || req.session?.userId;
      if (!userId) return res.status(401).json({ message: "غير مصرح" });
      const { pool: dbPool } = await import("./db");
      await dbPool.query(
        `UPDATE notifications SET is_read=true WHERE id=$1 AND user_id=$2`,
        [parseInt(req.params.id), userId]
      );
      res.json({ ok: true });
    } catch {
      res.status(500).json({ message: "فشل التحديث" });
    }
  });

  // ═════════════════════════════════════════════════════════════════════
  // 💰 مديونياتي — صفحة العميل (delivered + unpaid orders)
  // ═════════════════════════════════════════════════════════════════════
  app.get("/api/my-debts", async (req: any, res) => {
    try {
      const userId = getUserId(req.user) || req.session?.userId;
      if (!userId) return res.status(401).json({ message: "غير مصرح" });
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(`
        SELECT
          o.id, o.total, o.currency, o.status, o.payment_status,
          COALESCE(o.deposit_amount, 0) AS deposit_amount,
          COALESCE(o.discount_amount, 0) AS discount_amount,
          o.receipt_image_url, o.amount_claimed,
          o.shipping_city, o.created_at,
          ip.id AS plan_id,
          ip.remaining_amount AS plan_remaining,
          ip.remaining_paid AS plan_remaining_paid,
          ip.status AS plan_status,
          cc.tier,
          ct.payment_term_days,
          ct.cash_discount_percent
        FROM orders o
        LEFT JOIN installment_plans ip ON ip.order_id = o.id
        LEFT JOIN customer_credit cc ON cc.customer_id = o.user_id
        LEFT JOIN customer_credit_tiers ct ON ct.tier_key = cc.tier
        WHERE o.user_id = $1
          AND o.status IN ('delivered','completed')
          AND COALESCE(o.payment_status,'unpaid') NOT IN ('paid')
        ORDER BY o.created_at DESC
        LIMIT 100
      `, [userId]);

      const debts = result.rows
        .map((r: any) => {
          const total = Number(r.total || 0);
          const deposit = Number(r.deposit_amount || 0);
          const discount = Number(r.discount_amount || 0);
          const claimed = Number(r.amount_claimed || 0);
          // إذا فيه خطة تقسيط فُعّلت → استخدم remaining_amount منها
          const remaining = r.plan_id
            ? Number(r.plan_remaining || 0)
            : Math.max(0, total - deposit - discount - claimed);
          const dueDays = Number(r.payment_term_days || 30);
          const deliveredAt = new Date(r.created_at);
          const dueDate = new Date(deliveredAt.getTime() + dueDays * 24 * 3600 * 1000);
          return {
            orderId: r.id,
            total,
            deposit,
            discount,
            paid: deposit + discount + claimed,
            remaining,
            currency: r.currency || "YER",
            paymentStatus: r.payment_status || "unpaid",
            hasReceipt: !!r.receipt_image_url,
            shippingCity: r.shipping_city,
            createdAt: r.created_at,
            dueDate: dueDate.toISOString(),
            tier: r.tier,
            cashDiscountPercent: Number(r.cash_discount_percent || 1),
            planId: r.plan_id,
          };
        })
        .filter((d: any) => d.remaining > 0);

      res.json(debts);
    } catch (e: any) {
      console.error("[my-debts] error:", e?.message);
      res.status(500).json({ message: "فشل جلب المديونيات" });
    }
  });

  // 💳 رفع إيصال دفع مديونية + خصم اختياري للدفع المبكّر
  app.post("/api/my-debts/:orderId/pay", upload.single("receipt"), async (req: any, res) => {
    try {
      const userId = getUserId(req.user) || req.session?.userId;
      if (!userId) return res.status(401).json({ message: "غير مصرح" });
      const orderId = parseInt(req.params.orderId);
      if (!req.file) return res.status(400).json({ message: "يجب رفع صورة الإيصال" });
      const { pool: dbPool } = await import("./db");

      // التحقق من ملكية الطلب وأنه فعلاً عليه مديونية
      const own = await dbPool.query(
        `SELECT o.id, o.total, o.user_id, o.status, o.payment_status,
                COALESCE(o.deposit_amount,0) AS deposit_amount,
                COALESCE(o.discount_amount,0) AS discount_amount,
                COALESCE(o.amount_claimed,0) AS amount_claimed,
                o.customer_name, o.customer_phone
         FROM orders o WHERE o.id=$1`,
        [orderId]
      );
      if (!own.rows.length) return res.status(404).json({ message: "الطلب غير موجود" });
      const o = own.rows[0];
      if (String(o.user_id) !== String(userId)) return res.status(403).json({ message: "غير مصرح" });
      if (!["delivered", "completed"].includes(o.status)) {
        return res.status(400).json({ message: "هذا الطلب غير مؤهل للسداد بعد" });
      }
      // 🛡️ منع الرفع المزدوج (يحمي من تطبيق الخصم مرتين)
      if (o.payment_status === "pending_verification") {
        return res.status(409).json({ message: "لديك إيصال قيد التحقق لهذا الطلب. انتظر مراجعة الإدارة." });
      }
      if (o.payment_status === "paid") {
        return res.status(409).json({ message: "هذا الطلب مدفوع بالكامل." });
      }

      const applyEarlyDiscount = String(req.body?.applyEarlyDiscount || "false") === "true";
      const amountClaimedRaw = Number(req.body?.amountClaimed || 0);
      const paymentMethod = String(req.body?.paymentMethod || "bank_transfer");
      const transactionRef = String(req.body?.transactionRef || "");

      const total = Number(o.total);
      const currentRemaining = Math.max(0, total - Number(o.deposit_amount) - Number(o.discount_amount) - Number(o.amount_claimed));
      const earlyDiscount = applyEarlyDiscount ? Math.round(currentRemaining * 0.01) : 0;
      const expectedAmount = currentRemaining - earlyDiscount;

      // رفع الصورة إلى Cloudinary
      let receiptUrl = "";
      try {
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const apiKey = process.env.CLOUDINARY_API_KEY;
        const apiSecret = process.env.CLOUDINARY_API_SECRET;
        if (cloudName && apiKey && apiSecret) {
          const { v2: cloudinary } = await import("cloudinary");
          cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
          const uploadRes: any = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              { folder: "oyo_debt_receipts", public_id: `debt_${orderId}_${Date.now()}`, resource_type: "image" },
              (err, result) => err ? reject(err) : resolve(result)
            );
            stream.end(req.file!.buffer);
          });
          receiptUrl = uploadRes.secure_url;
        } else {
          const base64 = req.file.buffer.toString("base64");
          receiptUrl = `data:${req.file.mimetype};base64,${base64}`;
        }
      } catch (uploadErr: any) {
        console.error("[my-debts/pay] upload failed:", uploadErr?.message);
        return res.status(500).json({ message: "فشل رفع الإيصال، حاول مرة أخرى" });
      }

      // تحديث الطلب: pending_verification + تطبيق الخصم المبكّر إن وُجد
      await dbPool.query(
        `UPDATE orders
            SET receipt_image_url=$1,
                payment_status='pending_verification',
                amount_claimed = COALESCE(amount_claimed,0) + $2,
                discount_amount = COALESCE(discount_amount,0) + $3
          WHERE id=$4`,
        [receiptUrl, amountClaimedRaw || expectedAmount, earlyDiscount, orderId]
      );

      // إشعار الإدارة (in-app + WhatsApp)
      try {
        const { notifyStaff } = await import("./lib/staff-notify");
        await notifyStaff(["owner", "finance", "order_manager"], {
          title: "💰 إيصال سداد مديونية",
          message: `طلب #${orderId} | العميل: ${o.customer_name} | المبلغ المُدّعى: ${(amountClaimedRaw || expectedAmount).toLocaleString()} ر.ي${earlyDiscount > 0 ? ` (خصم مبكّر ${earlyDiscount.toLocaleString()})` : ""}${transactionRef ? ` | مرجع: ${transactionRef}` : ""}`,
          telegram: true,
        });
      } catch {}

      res.json({
        success: true,
        receiptUrl,
        amountPaid: amountClaimedRaw || expectedAmount,
        earlyDiscount,
        message: "تم استلام إيصال السداد، سيتم التحقق منه خلال ساعات قليلة",
      });
    } catch (e: any) {
      console.error("[my-debts/pay] error:", e?.message);
      res.status(500).json({ message: "فشل تسجيل الدفع" });
    }
  });

  app.patch("/api/notifications/read-all", async (req: any, res) => {
    try {
      const userId = getUserId(req.user) || req.session?.userId;
      if (!userId) return res.status(401).json({ message: "غير مصرح" });
      const { pool: dbPool } = await import("./db");
      await dbPool.query(
        `UPDATE notifications SET is_read=true WHERE user_id=$1 AND is_read=false`,
        [userId]
      );
      res.json({ ok: true });
    } catch {
      res.status(500).json({ message: "فشل التحديث" });
    }
  });

  // ─── Notification Preferences (per user) ────────────────────────────────────
  app.get("/api/notification-preferences", async (req: any, res) => {
    try {
      const userId = getUserId(req.user) || req.session?.userId;
      if (!userId) return res.status(401).json({ message: "غير مصرح" });
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(
        `SELECT type, in_app_enabled AS "inAppEnabled", telegram_enabled AS "telegramEnabled",
                muted_until AS "mutedUntil"
           FROM notification_preferences WHERE user_id=$1`,
        [userId]
      );
      res.json(r.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب الإعدادات" });
    }
  });

  app.put("/api/notification-preferences", async (req: any, res) => {
    try {
      const userId = getUserId(req.user) || req.session?.userId;
      if (!userId) return res.status(401).json({ message: "غير مصرح" });
      const { type, inAppEnabled, telegramEnabled, mutedUntil } = req.body || {};
      if (!type || typeof type !== "string") return res.status(400).json({ message: "النوع مطلوب" });
      const { pool: dbPool } = await import("./db");
      await dbPool.query(
        `INSERT INTO notification_preferences (user_id, type, in_app_enabled, telegram_enabled, muted_until, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (user_id, type) DO UPDATE
         SET in_app_enabled = EXCLUDED.in_app_enabled,
             telegram_enabled = EXCLUDED.telegram_enabled,
             muted_until = EXCLUDED.muted_until,
             updated_at = NOW()`,
        [
          userId,
          type,
          inAppEnabled !== false,
          telegramEnabled === true,
          mutedUntil ? new Date(mutedUntil) : null,
        ]
      );
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: "فشل حفظ الإعدادات", details: e.message });
    }
  });

  // Snooze all notifications for N hours (DND)
  app.post("/api/notification-preferences/snooze", async (req: any, res) => {
    try {
      const userId = getUserId(req.user) || req.session?.userId;
      if (!userId) return res.status(401).json({ message: "غير مصرح" });
      const hours = Math.max(1, Math.min(168, Number(req.body?.hours) || 24));
      const until = new Date(Date.now() + hours * 3600 * 1000);
      const { pool: dbPool } = await import("./db");
      const types = ["order_created","order_status","new_message","commission","low_stock","payment_due","wallet_credit","delivery_assigned","promo"];
      for (const t of types) {
        await dbPool.query(
          `INSERT INTO notification_preferences (user_id, type, muted_until, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (user_id, type) DO UPDATE
           SET muted_until = EXCLUDED.muted_until, updated_at = NOW()`,
          [userId, t, until]
        );
      }
      res.json({ ok: true, mutedUntil: until });
    } catch (e: any) {
      res.status(500).json({ message: "فشل الإيقاف المؤقت" });
    }
  });

  // ─── Admin: Broadcast promo notification ────────────────────────────────────
  app.post("/api/admin/notifications/broadcast", requireAdmin, async (req, res) => {
    try {
      const { title, message, actionUrl, mode, roles } = req.body || {};
      if (!title?.trim() || !message?.trim()) return res.status(400).json({ message: "العنوان والمحتوى مطلوبان" });
      if (!["opt_in", "bypass"].includes(mode)) return res.status(400).json({ message: "وضع غير صحيح (opt_in أو bypass)" });
      const { broadcastPromo } = await import("./lib/notifications");
      const r = await broadcastPromo({
        title: title.trim(),
        message: message.trim(),
        actionUrl: actionUrl?.trim() || undefined,
        mode,
        roles: Array.isArray(roles) ? roles : undefined,
      });
      res.json({ ok: true, recipients: r.recipients, mode });
    } catch (e: any) {
      res.status(500).json({ message: "فشل البث", details: e.message });
    }
  });

  // ─── بوابة المورد — تسجيل دخول ────────────────────────────────────────────────
  app.post("/api/supplier/login", loginLimiter, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { phone, pin } = req.body;
      if (!phone || !pin) return res.status(400).json({ message: "الهاتف والرمز مطلوبان" });
      const cleanPhone = phone.replace(/\s+/g, "");
      const result = await dbPool.query(
        `SELECT * FROM suppliers WHERE (phone=$1 OR phone=$2) AND is_active=true`,
        [cleanPhone, phone]
      );
      if (!result.rows.length) return res.status(404).json({ message: "لم يُعثر على هذا الرقم في نظام الموردين" });
      const supplier = result.rows[0];
      const supplierPin = supplier.pin || "1234";
      if (pin !== supplierPin) return res.status(401).json({ message: "الرمز السري غير صحيح" });
      // إنشاء توكن عشوائي قوي يخزّن في DB (لا يمكن تزويره)
      // ينتهي بعد 7 أيام، يُجدّد عند كل دخول
      const crypto = await import("crypto");
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 أيام
      await dbPool.query(
        "UPDATE suppliers SET token=$1, token_expires_at=$2 WHERE id=$3",
        [token, expiresAt, supplier.id]
      );
      res.json({ token, supplier: { id: supplier.id, name: supplier.name, phone: supplier.phone, cities: supplier.cities, commissionRate: supplier.commission_rate } });
    } catch (e: any) {
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  // ─── middleware تحقق من توكن المورد ────────────────────────────────────────────
  // يبحث عن المورد بالتوكن العشوائي المخزّن (مع مقارنة timing-safe) ويتحقق من انتهاء الصلاحية
  async function requireSupplier(req: Request, res: Response, next: NextFunction) {
    const token = req.headers["x-supplier-token"] as string;
    const supplierId = req.headers["x-supplier-id"] as string;
    if (!token || !supplierId) return res.status(401).json({ message: "غير مصرح" });
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        `SELECT * FROM suppliers
         WHERE id=$1 AND is_active=true AND token IS NOT NULL
           AND (token_expires_at IS NULL OR token_expires_at > NOW())`,
        [parseInt(supplierId)]
      );
      if (!result.rows.length) return res.status(401).json({ message: "انتهت الجلسة، أعد تسجيل الدخول" });
      const supplier = result.rows[0];
      // مقارنة timing-safe لمنع timing attacks
      const crypto = await import("crypto");
      const tokenBuf = Buffer.from(token, "utf8");
      const storedBuf = Buffer.from(supplier.token, "utf8");
      if (tokenBuf.length !== storedBuf.length || !crypto.timingSafeEqual(tokenBuf, storedBuf)) {
        return res.status(401).json({ message: "غير مصرح" });
      }
      (req as any).supplier = supplier;
      next();
    } catch {
      res.status(401).json({ message: "غير مصرح" });
    }
  }

  app.get("/api/supplier/me", requireSupplier, async (req, res) => {
    const supplier = (req as any).supplier;
    res.json({ id: supplier.id, name: supplier.name, phone: supplier.phone, cities: supplier.cities, commissionRate: supplier.commission_rate, balanceDue: supplier.balance_due, totalSales: supplier.total_sales });
  });

  // ─── كشف حساب المورد ─────────────────────────────────────────────────────
  app.get("/api/supplier/statement", requireSupplier, async (req, res) => {
    try {
      const supplier = (req as any).supplier;
      const { pool: dbPool } = await import("./db");

      const totals = await dbPool.query(`
        SELECT
          COALESCE(SUM(total::numeric),0) AS total_sales,
          COALESCE(SUM(CASE WHEN status='delivered' THEN supplier_amount::numeric ELSE 0 END),0) AS total_earned,
          COALESCE(SUM(CASE WHEN status='delivered' AND payment_method='cash_on_delivery' THEN total::numeric ELSE 0 END),0) AS total_collected_cod,
          COUNT(*) FILTER (WHERE status='delivered') AS delivered_count,
          COUNT(*) FILTER (WHERE status NOT IN ('cancelled','delivered')) AS active_count
        FROM orders WHERE supplier_id=$1
      `, [supplier.id]);

      const remTotals = await dbPool.query(
        `SELECT COALESCE(SUM(amount),0) AS total_remitted FROM supplier_remittances WHERE supplier_id=$1`,
        [supplier.id]
      );

      const recentOrders = await dbPool.query(`
        SELECT id, customer_name, shipping_city, total, currency, status, supplier_amount, payment_method, created_at
        FROM orders WHERE supplier_id=$1 ORDER BY created_at DESC LIMIT 30
      `, [supplier.id]);

      const recentRems = await dbPool.query(
        `SELECT id, amount, currency, method, notes, paid_at FROM supplier_remittances WHERE supplier_id=$1 ORDER BY paid_at DESC LIMIT 30`,
        [supplier.id]
      );

      res.json({
        supplier: { id: supplier.id, name: supplier.name },
        totals: {
          totalSales: Number(totals.rows[0].total_sales),
          totalEarned: Number(totals.rows[0].total_earned),
          totalCollectedCOD: Number(totals.rows[0].total_collected_cod),
          totalRemitted: Number(remTotals.rows[0].total_remitted),
          balanceDue: Number(supplier.balance_due || 0),
          deliveredCount: Number(totals.rows[0].delivered_count),
          activeCount: Number(totals.rows[0].active_count),
        },
        recentOrders: recentOrders.rows,
        recentRemittances: recentRems.rows,
      });
    } catch (e: any) {
      console.error("[statement] error:", e.message);
      res.status(500).json({ message: "فشل جلب كشف الحساب" });
    }
  });

  // ─── حماية خصوصية العميل: إخفاء الهاتف والعنوان التفصيلي قبل أن يستلم المورد الطلب ───
  // يظهر الاسم الأول + المدينة فقط حتى يضع المورد الطلب في "picked_up"
  // (Time-bound disclosure pattern — Amazon FBA style)
  function maskOrderForSupplier(order: any): any {
    if (!order) return order;
    const ds = order.delivery_status;
    const revealFull = ds === "picked_up" || ds === "shipped" || ds === "delivered" || ds === "failed";
    if (revealFull) return order;
    const name = (order.customer_name || "").trim();
    const parts = name.split(/\s+/);
    const maskedName = parts.length >= 2 ? `${parts[0]} ${parts[1][0]}.` : (parts[0] || "");
    return {
      ...order,
      customer_name: maskedName,
      customer_phone: null,        // مخفي حتى الالتزام بالتوصيل
      shipping_address: null,      // مخفي — تظهر المدينة فقط
      _masked: true,               // علامة للواجهة لإظهار رسالة "تظهر التفاصيل عند الاستلام"
    };
  }

  app.get("/api/supplier/orders", requireSupplier, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const supplier = (req as any).supplier;
      const result = await dbPool.query(
        `SELECT * FROM orders WHERE supplier_id=$1 AND status NOT IN ('cancelled') ORDER BY created_at DESC LIMIT 100`,
        [supplier.id]
      );
      res.json(result.rows.map(maskOrderForSupplier));
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب الطلبات" });
    }
  });

  // ─── بوابة المالية للمورد ──────────────────────────────────────────────────────
  app.get("/api/supplier/finance", requireSupplier, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const supplier = (req as any).supplier;
      const t = await dbPool.query(`
        SELECT
          COUNT(*) FILTER (WHERE delivery_status = 'delivered')::int AS delivered_count,
          COUNT(*) FILTER (WHERE status NOT IN ('cancelled')
                       AND (delivery_status IS NULL OR delivery_status NOT IN ('delivered','failed')))::int AS pending_count,
          COALESCE(SUM(supplier_amount) FILTER (WHERE delivery_status = 'delivered'), 0) AS earned_total,
          COALESCE(SUM(supplier_amount) FILTER (WHERE delivery_status = 'delivered' AND supplier_paid = false), 0) AS unpaid_total,
          COALESCE(SUM(total) FILTER (WHERE delivery_status = 'delivered'), 0) AS gross_sales,
          COALESCE(SUM(platform_commission) FILTER (WHERE delivery_status = 'delivered'), 0) AS commission_total,
          COALESCE(SUM(supplier_amount) FILTER (WHERE delivery_status = 'delivered'
                                            AND created_at >= date_trunc('month', NOW())), 0) AS this_month
        FROM orders WHERE supplier_id = $1
      `, [supplier.id]);
      res.json({
        ...t.rows[0],
        commissionRate: Number(supplier.commission_rate || 0),
        totalPaid: Number(supplier.total_paid || 0),
        balanceDue: Number(supplier.balance_due || 0),
      });
    } catch (e: any) {
      res.status(500).json({ message: "فشل" });
    }
  });

  // ─── بدء التجهيز (المورد يلتزم بالطلب) ─────────────────────────────────────────
  app.put("/api/supplier/orders/:id/start-preparing", requireSupplier, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const supplier = (req as any).supplier;
      const orderId = parseInt(req.params.id);
      const orderCheck = await dbPool.query(
        "SELECT id, user_id, status FROM orders WHERE id=$1 AND supplier_id=$2",
        [orderId, supplier.id]
      );
      if (!orderCheck.rows.length) return res.status(403).json({ message: "غير مصرح" });
      const order = orderCheck.rows[0];
      if (!["pending", "confirmed"].includes(order.status)) {
        return res.status(400).json({ message: "لا يمكن بدء تجهيز الطلب في حالته الحالية" });
      }
      await dbPool.query("UPDATE orders SET status='processing' WHERE id=$1", [orderId]);
      // إشعار العميل عبر نظام Phase 1
      if (order.user_id) {
        try {
          const { notifyOrderStatus } = await import("./lib/notifications");
          await notifyOrderStatus(String(order.user_id), orderId, "قيد التجهيز");
        } catch { /* non-fatal */ }
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: "فشل" });
    }
  });

  app.get("/api/supplier/orders/:id/items", requireSupplier, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const supplier = (req as any).supplier;
      const orderId = parseInt(req.params.id);
      const orderCheck = await dbPool.query(
        "SELECT id, delivery_status FROM orders WHERE id=$1 AND supplier_id=$2",
        [orderId, supplier.id]
      );
      if (!orderCheck.rows.length) return res.status(403).json({ message: "غير مصرح" });
      // ملاحظات التصميم وملفاته قد تحتوي على معلومات شخصية للعميل
      const ds = orderCheck.rows[0].delivery_status;
      const revealFull = ds === "picked_up" || ds === "shipped" || ds === "delivered" || ds === "failed";
      const result = await dbPool.query(
        `SELECT
           oi.id,
           oi.order_id          AS "orderId",
           oi.product_id        AS "productId",
           COALESCE(NULLIF(oi.product_name,''), p.name)            AS "productName",
           COALESCE(NULLIF(oi.product_image,''), p.image_urls[1])  AS "productImage",
           oi.quantity,
           oi.price,
           oi.selected_size     AS "selectedSize",
           oi.selected_color    AS "selectedColor",
           oi.selected_bag_color AS "selectedBagColor",
           oi.print_color_count AS "printColorCount",
           oi.print_color_1     AS "printColor1",
           oi.print_color_2     AS "printColor2",
           oi.print_color_3     AS "printColor3",
           oi.custom_printing   AS "customPrinting",
           oi.design_notes      AS "designNotes",
           oi.design_file_url   AS "designFileUrl"
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = $1
         ORDER BY oi.id`,
        [orderId]
      );
      // إخفاء ملاحظات/ملفات التصميم قبل الالتزام بالتوصيل (قد تكشف بيانات العميل)
      const rows = revealFull ? result.rows : result.rows.map((it: any) => ({
        ...it,
        designNotes: it.designNotes ? "🔒 يظهر عند الاستلام" : null,
        designFileUrl: null,
      }));
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل" });
    }
  });

  app.put("/api/supplier/orders/:id/delivery", requireSupplier, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const supplier = (req as any).supplier;
      const orderId = parseInt(req.params.id);
      const { deliveryStatus, notes } = req.body;
      const validStatuses = ["pending", "picked_up", "shipped", "delivered", "failed"];
      if (!validStatuses.includes(deliveryStatus)) return res.status(400).json({ message: "حالة غير صالحة" });
      const orderCheck = await dbPool.query("SELECT id FROM orders WHERE id=$1 AND supplier_id=$2", [orderId, supplier.id]);
      if (!orderCheck.rows.length) return res.status(403).json({ message: "غير مصرح" });
      let newStatus = deliveryStatus === "delivered" ? "delivered" : undefined;
      if (newStatus) {
        await dbPool.query(`UPDATE orders SET delivery_status=$1, status=$2 WHERE id=$3`, [deliveryStatus, newStatus, orderId]);
      } else {
        await dbPool.query(`UPDATE orders SET delivery_status=$1 WHERE id=$2`, [deliveryStatus, orderId]);
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: "فشل" });
    }
  });

  // تحديث PIN المورد (من لوحة الأدمن)
  app.put("/api/admin/suppliers/:id/pin", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { pin } = req.body;
      if (!pin || pin.length < 4) return res.status(400).json({ message: "الرمز يجب أن يكون 4 أرقام على الأقل" });
      await dbPool.query("UPDATE suppliers SET pin=$1 WHERE id=$2", [pin, parseInt(req.params.id)]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: "فشل" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // ─── منتجات المورد: إدارة من بوابة المورد ──────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════

  // جلب منتجات المورد الخاصة به
  app.get("/api/supplier/products", requireSupplier, async (req: any, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const supplier = req.supplier;
      const result = await dbPool.query(
        `SELECT p.*, c.name as category_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.submitted_by_supplier_id = $1
         ORDER BY p.id DESC`,
        [supplier.id]
      );
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب المنتجات" });
    }
  });

  // إضافة منتج جديد من المورد (يذهب للمراجعة)
  app.post("/api/supplier/products", requireSupplier, async (req: any, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const supplier = req.supplier;
      const { name, description, price, categoryId, imageUrl, stock, notes } = req.body;
      if (!name || !price) return res.status(400).json({ message: "الاسم والسعر مطلوبان" });

      // هل الموافقة التلقائية مفعّلة؟
      const settingsRes = await dbPool.query("SELECT supplier_product_auto_approve FROM display_settings LIMIT 1");
      const autoApprove = settingsRes.rows[0]?.supplier_product_auto_approve ?? false;
      const status = autoApprove ? "approved" : "pending";

      const result = await dbPool.query(
        `INSERT INTO products
          (name, description, price, category_id, image_url, stock,
           supplier_id, submitted_by_supplier_id, product_status, admin_notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9) RETURNING *`,
        [name, description || null, price, categoryId || null, imageUrl || null,
         stock || 0, supplier.id, status, notes || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل إضافة المنتج", details: e.message });
    }
  });

  // تعديل منتج من المورد (فقط إذا كان pending أو rejected)
  app.put("/api/supplier/products/:id", requireSupplier, async (req: any, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const supplier = req.supplier;
      const productId = parseInt(req.params.id);
      // التحقق من ملكية المورد للمنتج
      const check = await dbPool.query(
        "SELECT * FROM products WHERE id=$1 AND submitted_by_supplier_id=$2",
        [productId, supplier.id]
      );
      if (!check.rows.length) return res.status(403).json({ message: "غير مصرح" });
      const existing = check.rows[0];
      if (existing.product_status === "approved") {
        return res.status(400).json({ message: "لا يمكن تعديل منتج موافق عليه — تواصل مع الإدارة" });
      }
      const { name, description, price, categoryId, imageUrl, stock } = req.body;
      const result = await dbPool.query(
        `UPDATE products SET
           name=COALESCE($1, name),
           description=COALESCE($2, description),
           price=COALESCE($3, price),
           category_id=COALESCE($4, category_id),
           image_url=COALESCE($5, image_url),
           stock=COALESCE($6, stock),
           product_status='pending'
         WHERE id=$7 RETURNING *`,
        [name, description, price, categoryId, imageUrl, stock, productId]
      );
      res.json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل التعديل" });
    }
  });

  // حذف منتج معلق من المورد
  app.delete("/api/supplier/products/:id", requireSupplier, async (req: any, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const supplier = req.supplier;
      const productId = parseInt(req.params.id);
      const check = await dbPool.query(
        "SELECT product_status FROM products WHERE id=$1 AND submitted_by_supplier_id=$2",
        [productId, supplier.id]
      );
      if (!check.rows.length) return res.status(403).json({ message: "غير مصرح" });
      if (check.rows[0].product_status === "approved") {
        return res.status(400).json({ message: "لا يمكن حذف منتج موافق عليه" });
      }
      await dbPool.query("DELETE FROM products WHERE id=$1", [productId]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: "فشل الحذف" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // ─── موافقة الأدمن على منتجات الموردين ─────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════

  // جلب جميع منتجات الموردين المعلقة والمعتمدة والمرفوضة
  app.get("/api/admin/supplier-products", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const status = req.query.status as string | undefined;
      let query = `
        SELECT p.*, s.name as supplier_name, s.phone as supplier_phone,
               c.name as category_name
        FROM products p
        LEFT JOIN suppliers s ON p.submitted_by_supplier_id = s.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.submitted_by_supplier_id IS NOT NULL
      `;
      const params: any[] = [];
      if (status) {
        query += ` AND p.product_status = $1`;
        params.push(status);
      }
      query += ` ORDER BY p.id DESC`;
      const result = await dbPool.query(query, params);
      // 💰 إثراء كل صف بـ costPriceY/Sar محسوبة من smart_variants (لعرض هامش ربح المنصة)
      const rate = getExchangeRateCached();
      const enriched = result.rows.map((r: any) => {
        if (!r.smart_variants) return r;
        const computed = computeBaseFromSmartVariants(r.smart_variants, rate);
        if (!computed || !computed.costPriceY) return r;
        return { ...r, costPriceY: computed.costPriceY, costPriceSar: computed.costPriceSar };
      });
      res.json(enriched);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب المنتجات" });
    }
  });

  // موافقة الأدمن على منتج (مع تعديلات اختيارية)
  app.put("/api/admin/supplier-products/:id/approve", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const productId = parseInt(req.params.id);
      const { name, description, price, categoryId, imageUrl, stock, adminNotes } = req.body;
      const result = await dbPool.query(
        `UPDATE products SET
           product_status='approved',
           name=COALESCE($1, name),
           description=COALESCE($2, description),
           price=COALESCE($3, price),
           category_id=COALESCE($4, category_id),
           image_url=COALESCE($5, image_url),
           stock=COALESCE($6, stock),
           admin_notes=COALESCE($7, admin_notes)
         WHERE id=$8 AND submitted_by_supplier_id IS NOT NULL RETURNING *`,
        [name || null, description || null, price || null, categoryId || null,
         imageUrl || null, stock || null, adminNotes || null, productId]
      );
      if (!result.rows.length) return res.status(404).json({ message: "المنتج غير موجود" });
      res.json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل الموافقة" });
    }
  });

  // رفض منتج مع ملاحظة للمورد
  app.put("/api/admin/supplier-products/:id/reject", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const productId = parseInt(req.params.id);
      const { adminNotes } = req.body;
      const result = await dbPool.query(
        `UPDATE products SET product_status='rejected', admin_notes=$1
         WHERE id=$2 AND submitted_by_supplier_id IS NOT NULL RETURNING *`,
        [adminNotes || null, productId]
      );
      if (!result.rows.length) return res.status(404).json({ message: "المنتج غير موجود" });
      res.json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل الرفض" });
    }
  });

  // حذف منتج مورد من الأدمن
  app.delete("/api/admin/supplier-products/:id", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const productId = parseInt(req.params.id);
      await dbPool.query("DELETE FROM products WHERE id=$1 AND submitted_by_supplier_id IS NOT NULL", [productId]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: "فشل الحذف" });
    }
  });

  // إعدادات الصور وموافقة المنتجات
  app.get("/api/admin/image-settings", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(
        "SELECT img_max_width, img_max_height, img_quality, img_max_size_mb, supplier_product_auto_approve FROM display_settings LIMIT 1"
      );
      res.json(r.rows[0] ?? {});
    } catch (e: any) {
      res.status(500).json({ message: "فشل" });
    }
  });

  app.put("/api/admin/image-settings", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { imgMaxWidth, imgMaxHeight, imgQuality, imgMaxSizeMb, supplierProductAutoApprove } = req.body;
      await dbPool.query(
        `UPDATE display_settings SET
           img_max_width=$1, img_max_height=$2, img_quality=$3,
           img_max_size_mb=$4, supplier_product_auto_approve=$5`,
        [imgMaxWidth ?? 1200, imgMaxHeight ?? 1200, imgQuality ?? 80,
         imgMaxSizeMb ?? 5, supplierProductAutoApprove ?? false]
      );
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: "فشل" });
    }
  });

  // ─── PDP Layout (Product Detail Page) ────────────────────────────────────────
  const DEFAULT_PDP_LAYOUT = {
    sections: [
      { id: "images",      visible: true,  height: 420, thumbSize: 64, mode: "contain", showThumbs: true },
      { id: "price",       visible: true,  fontSize: 22 },
      { id: "title",       visible: true },
      { id: "rating",      visible: true },
      { id: "trust_badges",visible: true },
      { id: "variants",    visible: true },
      { id: "bulk",        visible: true },
      { id: "quantity",    visible: true },
      { id: "shipping",    visible: true },
      { id: "returns",     visible: true },
      { id: "installment", visible: true },
      { id: "printing",    visible: true },
      { id: "description", visible: true },
      { id: "reviews",     visible: true },
      { id: "related",     visible: true, count: 4 },
    ],
    stickyBar: { visible: true, cartHeight: 52 },
    margins: { h: 16, v: 8, gap: 12 },
  };

  app.get("/api/pdp-layout", async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query("SELECT pdp_layout FROM display_settings LIMIT 1");
      const raw = r.rows[0]?.pdp_layout;
      if (raw) {
        try { return res.json(JSON.parse(raw)); } catch {}
      }
      res.json(DEFAULT_PDP_LAYOUT);
    } catch {
      res.json(DEFAULT_PDP_LAYOUT);
    }
  });

  app.post("/api/admin/pdp-layout", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      await dbPool.query("UPDATE display_settings SET pdp_layout=$1", [JSON.stringify(req.body)]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: "فشل حفظ التخطيط" });
    }
  });

  // ─── Get Order Details (Public - for order confirmation) ────────────────────────
  app.get("/api/orders/:id", async (req, res) => {
    try {
      const { db: dbInstance } = await import("./db");
      const { orders: ordersTable } = await import("@shared/schema");
      const { eq: eqFn } = await import("drizzle-orm");
      
      const [order] = await dbInstance
        .select()
        .from(ordersTable)
        .where(eqFn(ordersTable.id, parseInt(req.params.id)));

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      res.json(order);
    } catch (e: any) {
      res.status(500).json({ message: "Failed to fetch order", details: e.message });
    }
  });

  // ─── Get Order Items (Public - for order confirmation) ────────────────────────
  app.get("/api/orders/:id/items", async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        `SELECT
           oi.id,
           oi.order_id AS "orderId",
           oi.product_id AS "productId",
           COALESCE(NULLIF(oi.product_name,''), p.name)            AS "productName",
           COALESCE(NULLIF(oi.product_image,''), p.image_urls[1])  AS "productImage",
           oi.quantity,
           oi.price,
           oi.selected_size        AS "selectedSize",
           oi.selected_color       AS "selectedColor",
           oi.selected_bag_color   AS "selectedBagColor",
           oi.print_color_count    AS "printColorCount",
           oi.print_color_1        AS "printColor1",
           oi.print_color_2        AS "printColor2",
           oi.print_color_3        AS "printColor3",
           oi.custom_printing      AS "customPrinting",
           oi.design_notes         AS "designNotes",
           oi.design_file_url      AS "designFileUrl"
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = $1
         ORDER BY oi.id`,
        [parseInt(req.params.id)]
      );
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "Failed to fetch order items", details: e.message });
    }
  });

  // ─── Admin Orders ────────────────────────────────────────────────
  app.get("/api/admin/orders", requireAdmin, async (_req, res) => {
    const allOrders = await storage.getOrders();
    res.json(allOrders);
  });

  // ─── Admin: Get Order Items (with full product details for invoice) ──────────
  app.get("/api/admin/orders/:id/items", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        `SELECT
           oi.id,
           oi.order_id AS "orderId",
           oi.product_id AS "productId",
           COALESCE(NULLIF(oi.product_name,''), p.name)            AS "productName",
           COALESCE(NULLIF(oi.product_image,''), p.image_urls[1])  AS "productImage",
           oi.quantity,
           oi.price,
           oi.selected_size        AS "selectedSize",
           oi.selected_color       AS "selectedColor",
           oi.selected_bag_color   AS "selectedBagColor",
           oi.print_color_count    AS "printColorCount",
           oi.print_color_1        AS "printColor1",
           oi.print_color_2        AS "printColor2",
           oi.print_color_3        AS "printColor3",
           oi.custom_printing      AS "customPrinting",
           oi.design_notes         AS "designNotes",
           oi.design_file_url      AS "designFileUrl"
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = $1
         ORDER BY oi.id`,
        [parseInt(req.params.id)]
      );
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "Failed to fetch admin order items", details: e.message });
    }
  });

  app.patch("/api/admin/orders/:id/status", requireAdmin, async (req, res) => {
    try {
      const { db: dbInstance } = await import("./db");
      const { orders: ordersTable } = await import("@shared/schema");
      const { eq: eqFn } = await import("drizzle-orm");
      const newStatus = req.body.status;
      const updateData: any = { status: newStatus };
      if (req.body.trackingNumber !== undefined) updateData.trackingNumber = req.body.trackingNumber;
      if (req.body.expectedShippingDate !== undefined) updateData.expectedShippingDate = req.body.expectedShippingDate;
      const [order] = await dbInstance
        .update(ordersTable)
        .set(updateData)
        .where(eqFn(ordersTable.id, parseInt(req.params.id)))
        .returning();
      res.json(order);
      // إشعار العميل بتغيير الحالة (لا ننتظر)
      if (order?.customerPhone && newStatus) {
        notifyCustomerStatus(order.customerPhone, order.id, newStatus, {
          trackingNumber: order.trackingNumber || undefined,
          expectedShippingDate: (order as any).expectedShippingDate || undefined,
        });
      }
      // إشعار داخلي in-app للعميل (إن كان مسجلاً) ──────────────────
      if (order?.userId && newStatus) {
        try {
          const statusMap: Record<string, string> = {
            pending: "طلبك قيد المراجعة",
            confirmed: "تم تأكيد طلبك ✅",
            processing: "طلبك قيد التجهيز",
            shipped: "تم شحن طلبك 🚚",
            out_for_delivery: "طلبك خرج للتوصيل",
            delivered: "تم توصيل طلبك بنجاح ✅",
            completed: "اكتمل طلبك. شكراً لتسوقك معنا",
            cancelled: "تم إلغاء طلبك",
          };
          const label = statusMap[newStatus] || `تحديث الحالة: ${newStatus}`;
          const { notifyOrderStatus, notifyOrderDelivered, createNotification } = await import("./lib/notifications");
          if (newStatus === "delivered") {
            await notifyOrderDelivered(String(order.userId), order.id);
            // 💰 إشعار "سدّد مديونيتك" — يفتح صفحة /my-debts مباشرة
            try {
              const { pool: dbPool2 } = await import("./db");
              const dbg = await dbPool2.query(
                `SELECT total, COALESCE(deposit_amount,0) AS deposit, COALESCE(discount_amount,0) AS disc, COALESCE(amount_claimed,0) AS claimed
                   FROM orders WHERE id=$1`,
                [order.id]
              );
              if (dbg.rows.length) {
                const r = dbg.rows[0];
                const remaining = Math.max(0, Number(r.total) - Number(r.deposit) - Number(r.disc) - Number(r.claimed));
                if (remaining > 0) {
                  await createNotification({
                    userId: String(order.userId),
                    type: "order_status",
                    priority: "high",
                    title: `💰 طلب #${order.id} — متبقي ${remaining.toLocaleString("ar-YE")} ر.ي`,
                    message: "ادفع اليوم واحصل على خصم 1% — اضغط لرفع إيصال الدفع",
                    actionUrl: `/my-debts`,
                    orderId: order.id,
                    groupKey: `debt_due:${order.id}`,
                  });
                }
              }
            } catch {}
          } else {
            await notifyOrderStatus(String(order.userId), order.id, label);
          }
        } catch { /* non-fatal */ }
      }
      // منح نقاط الولاء عند تسليم الطلب
      if (newStatus === "delivered" && order?.userId && order?.total) {
        await awardOrderPoints(Number(order.userId), order.id, Number(order.total));
      }
      // Task 3: تحديث sold_count تلقائياً
      if (order) {
        if (newStatus === "delivered" || newStatus === "completed") {
          await recalcSoldCountForOrder(order.id, "inc");
        } else if (newStatus === "cancelled" || newStatus === "refunded") {
          await recalcSoldCountForOrder(order.id, "dec");
        }
      }
      // ─── إنذار الأدمن عند الاسترداد/الإلغاء الكبير (≥ 50,000 ر.ي) ─────
      if (order && (newStatus === "refunded" || newStatus === "cancelled")) {
        try {
          const orderTotal = Number(order.total || 0);
          const isLarge = (order.currency === "SAR" ? orderTotal * 200 : orderTotal) >= 50000;
          if (isLarge) {
            const { notifyStaff } = await import("./lib/staff-notify");
            await notifyStaff({
              roles: ["finance", "owner"],
              type: "payment",
              orderId: order.id,
              title: `🚨 ${newStatus === "refunded" ? "استرداد" : "إلغاء"} كبير #${order.id}`,
              message: `${orderTotal.toLocaleString()} ${order.currency || "ر.ي"} — ${order.customerName || "—"}`,
              telegramText: `🚨 <b>${newStatus === "refunded" ? "استرداد" : "إلغاء"} كبير</b>\n🆔 طلب #${order.id}\n💰 ${orderTotal.toLocaleString()} ${order.currency || "ر.ي"}`,
            });
          }
        } catch {}
      }
      // تسجيل حدث الطلب فوراً (T4 — حماية لحظية)
      if (order) {
        try {
          const { logOrderEvent } = await import("./backup-service");
          const eventType = newStatus === "cancelled" ? "cancelled" : newStatus === "delivered" ? "delivered" : "updated";
          await logOrderEvent(order.id, eventType as any, order);
        } catch {}
      }
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث حالة الطلب", details: e.message });
    }
  });

  // تأكيد الطلب يدوياً بعد الاتصال الهاتفي بالعميل (وضع التشغيل المجاني — بديل OTP)
  app.patch("/api/admin/orders/:id/confirm", requireAdmin, async (req, res) => {
    try {
      const { db: dbInstance } = await import("./db");
      const { orders: ordersTable } = await import("@shared/schema");
      const { eq: eqFn } = await import("drizzle-orm");
      const confirmed = req.body?.confirmed !== false; // default true
      const updateData: any = {
        adminConfirmed: confirmed,
        confirmedAt: confirmed ? new Date() : null,
        confirmedBy: confirmed ? (req.body?.confirmedBy || "admin") : null,
      };
      const [order] = await dbInstance
        .update(ordersTable)
        .set(updateData)
        .where(eqFn(ordersTable.id, parseInt(req.params.id)))
        .returning();
      if (!order) return res.status(404).json({ message: "الطلب غير موجود" });
      res.json(order);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تأكيد الطلب", details: e.message });
    }
  });

  // عدد الطلبات غير المؤكدة منذ أكثر من ساعة (للإحصائية في لوحة الأدمن)
  app.get("/api/admin/orders/unconfirmed-count", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(`
        SELECT COUNT(*)::int AS count
        FROM orders
        WHERE COALESCE(admin_confirmed, false) = false
          AND status NOT IN ('cancelled', 'delivered', 'completed')
          AND created_at < NOW() - INTERVAL '1 hour'
      `);
      res.json({ count: result.rows[0]?.count || 0 });
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب العدد", details: e.message, count: 0 });
    }
  });

  // ─── التقارير المالية ────────────────────────────────────────────────────────────
  app.get("/api/admin/reports/financial", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");

      // إجمالي المبيعات وعمولة المنصة
      const totals = await dbPool.query(`
        SELECT
          COALESCE(SUM(total::numeric), 0) as total_revenue,
          COALESCE(SUM(CASE WHEN supplier_amount IS NOT NULL THEN supplier_amount::numeric ELSE 0 END), 0) as total_supplier,
          COUNT(*) as total_orders,
          COUNT(CASE WHEN status='delivered' THEN 1 END) as delivered_orders,
          COUNT(CASE WHEN status='cancelled' THEN 1 END) as cancelled_orders,
          COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as today_orders,
          COALESCE(SUM(CASE WHEN DATE(created_at) = CURRENT_DATE THEN total::numeric ELSE 0 END), 0) as today_revenue
        FROM orders WHERE status != 'cancelled'
      `);

      // آخر 30 يوم - مبيعات يومية
      const daily = await dbPool.query(`
        SELECT DATE(created_at) as day,
               SUM(total::numeric) as revenue,
               COUNT(*) as orders
        FROM orders
        WHERE status != 'cancelled' AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY day
      `);

      // آخر 12 شهر - مبيعات شهرية
      const monthly = await dbPool.query(`
        SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month,
               SUM(total::numeric) as revenue,
               COUNT(*) as orders
        FROM orders
        WHERE status != 'cancelled' AND created_at >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY DATE_TRUNC('month', created_at)
      `);

      // أفضل المنتجات مبيعاً
      const topProducts = await dbPool.query(`
        SELECT oi.product_name, oi.product_id,
               SUM(oi.price::numeric * oi.quantity) as revenue,
               SUM(oi.quantity) as units_sold
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status != 'cancelled'
        GROUP BY oi.product_name, oi.product_id
        ORDER BY revenue DESC
        LIMIT 10
      `);

      // أفضل المدن
      const topCities = await dbPool.query(`
        SELECT shipping_city as city,
               COUNT(*) as orders,
               SUM(total::numeric) as revenue
        FROM orders
        WHERE status != 'cancelled' AND shipping_city IS NOT NULL
        GROUP BY shipping_city
        ORDER BY orders DESC
        LIMIT 10
      `);

      // الشهر الحالي vs الشهر الماضي
      const comparison = await dbPool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE) THEN total::numeric END), 0) as this_month,
          COALESCE(SUM(CASE WHEN DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' THEN total::numeric END), 0) as last_month,
          COUNT(CASE WHEN DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as this_month_orders,
          COUNT(CASE WHEN DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' THEN 1 END) as last_month_orders
        FROM orders WHERE status != 'cancelled'
      `);

      const t = totals.rows[0];
      res.json({
        summary: {
          totalRevenue: Number(t.total_revenue),
          totalSupplierPaid: Number(t.total_supplier),
          platformCommission: Number(t.total_revenue) - Number(t.total_supplier),
          totalOrders: Number(t.total_orders),
          deliveredOrders: Number(t.delivered_orders),
          cancelledOrders: Number(t.cancelled_orders),
          todayOrders: Number(t.today_orders),
          todayRevenue: Number(t.today_revenue),
        },
        daily: daily.rows.map(r => ({ day: r.day, revenue: Number(r.revenue), orders: Number(r.orders) })),
        monthly: monthly.rows.map(r => ({ month: r.month, revenue: Number(r.revenue), orders: Number(r.orders) })),
        topProducts: topProducts.rows.map(r => ({ name: r.product_name, revenue: Number(r.revenue), units: Number(r.units_sold) })),
        topCities: topCities.rows.map(r => ({ city: r.city, orders: Number(r.orders), revenue: Number(r.revenue) })),
        comparison: comparison.rows[0],
      });
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب التقارير", details: e.message });
    }
  });

  // ─── نقاط الولاء (Loyalty Points) ────────────────────────────────────────────
  // قراءة نقاط المستخدم
  app.get("/api/points", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ message: "غير مصرح" });
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        "SELECT * FROM reward_points WHERE user_id=$1",
        [user.id]
      );
      if (!result.rows.length) {
        return res.json({ points: 0, lifetimePoints: 0 });
      }
      const row = result.rows[0];
      res.json({ points: row.points, lifetimePoints: row.lifetime_points });
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب النقاط" });
    }
  });

  // سجل معاملات النقاط
  app.get("/api/points/history", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ message: "غير مصرح" });
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        "SELECT * FROM points_transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50",
        [user.id]
      );
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب السجل" });
    }
  });

  // حساب تكلفة استرداد النقاط (100 نقطة = 1000 ر.ي)
  app.post("/api/points/redeem-estimate", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ message: "غير مصرح" });
      const { pointsToUse } = req.body;
      if (!pointsToUse || pointsToUse <= 0) return res.status(400).json({ message: "عدد النقاط غير صالح" });
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query("SELECT points FROM reward_points WHERE user_id=$1", [user.id]);
      const availablePoints = result.rows[0]?.points || 0;
      const actualPoints = Math.min(pointsToUse, availablePoints);
      const discountAmount = Math.floor(actualPoints / 100) * 1000; // 100 نقطة = 1000 ر.ي
      res.json({ pointsToUse: actualPoints, discountAmount, availablePoints });
    } catch (e: any) {
      res.status(500).json({ message: "فشل" });
    }
  });

  // منح النقاط عند اكتمال الطلب (تُستدعى داخلياً)
  async function awardOrderPoints(userId: number, orderId: number, orderTotal: number) {
    try {
      const { pool: dbPool } = await import("./db");
      const pointsEarned = Math.floor(orderTotal / 1000); // 1 نقطة لكل 1000 ر.ي
      if (pointsEarned <= 0) return;
      // تأكد من وجود سجل للمستخدم
      await dbPool.query(
        `INSERT INTO reward_points (user_id, points, lifetime_points)
         VALUES ($1, $2, $2)
         ON CONFLICT (user_id)
         DO UPDATE SET points = reward_points.points + $2, lifetime_points = reward_points.lifetime_points + $2`,
        [userId, pointsEarned]
      );
      // سجل المعاملة
      await dbPool.query(
        `INSERT INTO points_transactions (user_id, points, type, description, order_id) VALUES ($1, $2, $3, $4, $5)`,
        [userId, pointsEarned, "earn", `شراء - طلب #${orderId}`, orderId]
      );
    } catch (e: any) {
      console.error("Points award error:", e.message);
    }
  }

  // alias for /api/points/history (للتوافق مع النظام القديم)
  app.get("/api/points/transactions", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ message: "غير مصرح" });
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        "SELECT * FROM points_transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50",
        [user.id]
      );
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب السجل" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // محفظة العميل + ملخص الحساب (للوحات الجديدة /wallet /account)
  // ═══════════════════════════════════════════════════════════════════
  app.get("/api/wallet", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ message: "غير مصرح" });
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(
        `SELECT id, user_id as "userId", balance_yer as "balanceYer", balance_sar as "balanceSar",
                created_at as "createdAt", updated_at as "updatedAt"
         FROM wallets WHERE user_id=$1`,
        [user.id]
      );
      if (!r.rows.length) {
        try {
          const ins = await dbPool.query(
            `INSERT INTO wallets (user_id, balance_yer, balance_sar) VALUES ($1, '0', '0')
             ON CONFLICT (user_id) DO UPDATE SET updated_at=NOW()
             RETURNING id, user_id as "userId", balance_yer as "balanceYer", balance_sar as "balanceSar",
                       created_at as "createdAt", updated_at as "updatedAt"`,
            [user.id]
          );
          return res.json(ins.rows[0]);
        } catch (insertErr: any) {
          // FK error or race — return empty wallet representation gracefully
          console.warn("[/api/wallet] auto-create failed:", insertErr.message);
          return res.json({
            id: 0, userId: user.id, balanceYer: "0", balanceSar: "0",
            createdAt: null, updatedAt: null,
          });
        }
      }
      res.json(r.rows[0]);
    } catch (e: any) {
      console.error("[/api/wallet] error:", e.message, e.stack);
      res.status(500).json({ message: "فشل جلب المحفظة" });
    }
  });

  app.get("/api/wallet/transactions", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ message: "غير مصرح" });
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(
        `SELECT id, wallet_id as "walletId", user_id as "userId", type, amount, currency,
                description, order_id as "orderId", created_at as "createdAt"
         FROM wallet_transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`,
        [user.id]
      );
      res.json(r.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب الحركات" });
    }
  });

  app.get("/api/account/summary", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ message: "غير مصرح" });
      const { pool: dbPool } = await import("./db");
      const [wRes, pRes, oRes] = await Promise.all([
        dbPool.query(`SELECT balance_yer, balance_sar FROM wallets WHERE user_id=$1`, [user.id]),
        dbPool.query(`SELECT points, lifetime_points FROM reward_points WHERE user_id=$1`, [user.id]),
        dbPool.query(
          `SELECT
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status IN ('pending','deposit_paid'))::int AS pending,
             COUNT(*) FILTER (WHERE status IN ('delivered','completed'))::int AS completed
           FROM orders WHERE user_id=$1`,
          [user.id]
        ),
      ]);
      const w = wRes.rows[0] || { balance_yer: "0", balance_sar: "0" };
      const p = pRes.rows[0] || { points: 0, lifetime_points: 0 };
      const o = oRes.rows[0] || { total: 0, pending: 0, completed: 0 };
      res.json({
        wallet:  { balanceYer: String(w.balance_yer ?? "0"), balanceSar: String(w.balance_sar ?? "0") },
        points:  { current: Number(p.points ?? 0), lifetime: Number(p.lifetime_points ?? 0) },
        orders:  { total: Number(o.total ?? 0), pending: Number(o.pending ?? 0), completed: Number(o.completed ?? 0) },
      });
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب الملخص" });
    }
  });

  // ── Account Deletion Request (Google Play requirement) ──
  app.post("/api/account/delete-request", async (req, res) => {
    try {
      const { email, phone, reason } = req.body;
      const { pool: dbPool } = await import("./db");
      const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
      await dbPool.query(
        `INSERT INTO account_deletion_requests (email, phone, reason, request_type, status, ip_address)
         VALUES ($1, $2, $3, 'account', 'pending', $4)`,
        [email || null, phone || null, reason || null, ip]
      );
      res.json({ message: "تم إرسال طلب حذف الحساب. سنتواصل معك خلال 7 أيام عمل." });
    } catch (e: any) {
      console.error("[delete-request] error:", e?.message);
      res.status(500).json({ message: "فشل في إرسال الطلب" });
    }
  });

  // ── Data Deletion Request (Google Play requirement) ──
  app.post("/api/account/data-deletion-request", async (req, res) => {
    try {
      const { email, phone, dataTypes, reason } = req.body;
      const { pool: dbPool } = await import("./db");
      const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
      const dataTypesStr = Array.isArray(dataTypes) ? dataTypes.join(",") : String(dataTypes || "");
      await dbPool.query(
        `INSERT INTO account_deletion_requests (email, phone, data_types, reason, request_type, status, ip_address)
         VALUES ($1, $2, $3, $4, 'data', 'pending', $5)`,
        [email || null, phone || null, dataTypesStr, reason || null, ip]
      );
      res.json({ message: "تم إرسال طلب حذف البيانات. سنتواصل معك خلال 7 أيام عمل." });
    } catch (e: any) {
      console.error("[data-deletion-request] error:", e?.message);
      res.status(500).json({ message: "فشل في إرسال الطلب" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // كوبونات العميل (للصفحة /my-coupons) — تجميع من أوامر سابقة
  // ═══════════════════════════════════════════════════════════════════
  app.get("/api/my/coupons", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ message: "غير مصرح" });
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(
        `SELECT
           coupon_code AS code,
           COUNT(*)::int AS "usageCount",
           COALESCE(SUM(COALESCE(discount_amount, 0)), 0)::numeric AS "totalDiscount",
           MAX(created_at) AS "lastUsedAt"
         FROM orders
         WHERE user_id=$1 AND coupon_code IS NOT NULL AND coupon_code <> ''
         GROUP BY coupon_code
         ORDER BY MAX(created_at) DESC`,
        [user.id]
      );
      const rows = r.rows.map((row: any) => ({
        code: String(row.code),
        usageCount: Number(row.usageCount || 0),
        totalDiscount: Number(row.totalDiscount || 0),
        lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt).toISOString() : null,
      }));
      res.json(rows);
    } catch (e: any) {
      console.error("[/api/my/coupons] error:", e.message);
      res.status(500).json({ message: "فشل جلب الكوبونات" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // ملخص نقاط الولاء (للصفحة /loyalty)
  // ═══════════════════════════════════════════════════════════════════
  app.get("/api/loyalty/summary", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ message: "غير مصرح" });
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(
        `SELECT points, lifetime_points FROM reward_points WHERE user_id=$1`,
        [user.id]
      );
      const points = Number(r.rows[0]?.points ?? 0);
      const lifetime = Number(r.rows[0]?.lifetime_points ?? 0);
      // 100 نقطة = 1000 ر.ي (طبقاً للسياسة الحالية في /api/points/redeem-estimate)
      const redeemableValue = Math.floor(points / 100) * 1000;
      res.json({ points, lifetimePoints: lifetime, redeemableValue });
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب ملخص النقاط" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // تغيير كلمة المرور (للمستخدم الحالي من /settings)
  // ═══════════════════════════════════════════════════════════════════
  app.post("/api/me/change-password", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ message: "غير مصرح" });
      const { currentPassword, newPassword } = req.body || {};
      if (!newPassword || String(newPassword).length < 6) {
        return res.status(400).json({ message: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل" });
      }
      const { pool: dbPool } = await import("./db");
      const { hashPassword, verifyPassword } = await import("./auth-utils");
      const r = await dbPool.query(`SELECT password_hash FROM users WHERE id=$1`, [user.id]);
      const row = r.rows[0];
      if (!row) return res.status(404).json({ message: "المستخدم غير موجود" });
      if (row.password_hash) {
        if (!currentPassword) {
          return res.status(400).json({ message: "كلمة المرور الحالية مطلوبة" });
        }
        if (!verifyPassword(String(currentPassword), row.password_hash)) {
          return res.status(400).json({ message: "كلمة المرور الحالية غير صحيحة" });
        }
      }
      const newHash = hashPassword(String(newPassword));
      await dbPool.query(`UPDATE users SET password_hash=$1 WHERE id=$2`, [newHash, user.id]);
      res.json({ success: true, message: "تم تحديث كلمة المرور بنجاح" });
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث كلمة المرور" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // منظومة المسوقين المستقلين — تسجيل + لوحة + إدارة
  // ═══════════════════════════════════════════════════════════════════

  const MARKETER_CONTRACT_TEXT = `عقد شراكة تسويقية — أويو بلاست

الأطراف: شركة أويو بلاست (الطرف الأول) والمسوق (الطرف الثاني).

البنود:
1. يلتزم المسوق بالترويج لمنتجات أويو بلاست عبر قنواته الرسمية المسجلة فقط.
2. يحصل المسوق على عمولة محددة عن كل طلب مكتمل باستخدام كوبونه الخاص.
3. يُصرف الرصيد بناءً على طلب السحب بعد التحقق من اكتمال الطلبات.
4. يحق للشركة تعليق الحساب عند مخالفة سياسة الاستخدام أو الترويج المضلل.
5. يتعهد المسوق بعدم الإفصاح عن تفاصيل العمولة لأطراف ثالثة.
6. تُحسب العمولة على القيمة الإجمالية للطلب بعد خصم التوصيل.
7. هذا العقد ساري ويُجدَّد تلقائياً ما لم يُوقَف الحساب.

بالموافقة الرقمية، يُقرّ المسوق بقراءة هذه البنود والالتزام بها كاملاً.`;

  // ── middleware مصادقة المسوق ──────────────────────────────────────
  async function requireMarketer(req: Request, res: Response, next: NextFunction) {
    const { pool: dbPool } = await import("./db");
    const token = req.headers["x-marketer-token"] as string;
    if (!token) return res.status(401).json({ message: "يجب تسجيل الدخول" });
    const r = await dbPool.query("SELECT * FROM standalone_marketers WHERE token=$1 AND is_active=true", [token]);
    if (!r.rows.length) return res.status(401).json({ message: "جلسة منتهية أو غير صالحة" });
    (req as any).marketer = r.rows[0];
    next();
  }

  // ── 1. طلب الانضمام (عام، بدون مصادقة) ──────────────────────────
  app.post("/api/marketer/apply", async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { name, phone, city, channel, channelHandle, audienceSize, message } = req.body;
      if (!name || !phone || !city || !channel) return res.status(400).json({ message: "اسمك، هاتفك، مدينتك، والقناة مطلوبة" });
      // منع التكرار بالهاتف
      const dup = await dbPool.query("SELECT id FROM marketer_applications WHERE phone=$1 AND status='pending'", [phone]);
      if (dup.rows.length) return res.status(409).json({ message: "يوجد طلب مسبق بهذا الهاتف في قيد المراجعة" });
      const result = await dbPool.query(
        `INSERT INTO marketer_applications (name, phone, city, channel, channel_handle, audience_size, message)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [name, phone.trim(), city, channel, channelHandle || null, audienceSize || null, message || null]
      );
      res.json({ success: true, id: result.rows[0].id, message: "تم إرسال طلبك بنجاح! سيتواصل معك فريقنا خلال 24-48 ساعة" });
    } catch (e: any) {
      res.status(500).json({ message: "فشل إرسال الطلب" });
    }
  });

  // ── 2. تسجيل الدخول (هاتف + PIN) ─────────────────────────────────
  app.post("/api/marketer/login", loginLimiter, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const crypto = await import("crypto");
      const { phone, pin } = req.body;
      if (!phone || !pin) return res.status(400).json({ message: "الهاتف والرقم السري مطلوبان" });
      const r = await dbPool.query("SELECT * FROM standalone_marketers WHERE phone=$1 AND pin=$2 AND is_active=true", [phone.trim(), pin]);
      if (!r.rows.length) return res.status(401).json({ message: "رقم الهاتف أو الرقم السري غير صحيح" });
      const token = crypto.randomBytes(32).toString("hex");
      await dbPool.query("UPDATE standalone_marketers SET token=$1 WHERE id=$2", [token, r.rows[0].id]);
      const marketer = { ...r.rows[0], token };
      res.json({ token, marketer: { id: marketer.id, name: marketer.name, phone: marketer.phone, couponCode: marketer.coupon_code } });
    } catch (e: any) {
      res.status(500).json({ message: "فشل تسجيل الدخول" });
    }
  });

  // ── 3. بيانات المسوق الحالي ───────────────────────────────────────
  app.get("/api/marketer/me", requireMarketer, async (req, res) => {
    const m = (req as any).marketer;
    res.json({
      id: m.id, name: m.name, phone: m.phone, city: m.city,
      channel: m.channel, channelHandle: m.channel_handle,
      couponCode: m.coupon_code, commissionRate: m.commission_rate,
      discountRate: m.discount_rate, walletBalance: m.wallet_balance,
      totalEarnings: m.total_earnings, totalOrders: m.total_orders,
      isActive: m.is_active, contractAcceptedAt: m.contract_accepted_at,
      contractText: MARKETER_CONTRACT_TEXT,
    });
  });

  // ── حساب المسوق المرتبط بالمستخدم الحالي (بالهاتف) ──────────────
  app.get("/api/marketer/linked-account", async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const userId = (req as any).user?.claims?.sub;
      if (!userId) return res.json(null);
      const userRow = await dbPool.query("SELECT phone FROM users WHERE id=$1", [userId]);
      if (!userRow.rows.length || !userRow.rows[0].phone) return res.json(null);
      const phone = userRow.rows[0].phone;
      const r = await dbPool.query(
        `SELECT id, name, phone, coupon_code, commission_rate, discount_rate,
                wallet_balance, total_earnings, total_orders, is_active, contract_accepted_at
         FROM standalone_marketers WHERE phone=$1 AND is_active=true`,
        [phone]
      );
      if (!r.rows.length) return res.json(null);
      const m = r.rows[0];
      res.json({
        id: m.id, name: m.name, phone: m.phone,
        couponCode: m.coupon_code, commissionRate: m.commission_rate,
        discountRate: m.discount_rate, walletBalance: m.wallet_balance,
        totalEarnings: m.total_earnings, totalOrders: m.total_orders,
        contractAcceptedAt: m.contract_accepted_at,
      });
    } catch (e: any) {
      res.json(null);
    }
  });

  // ── قبول عقد المسوق ──────────────────────────────────────────────
  app.post("/api/marketer/accept-contract", requireMarketer, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const m = (req as any).marketer;
      const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
      await dbPool.query(
        "UPDATE standalone_marketers SET contract_accepted_at=NOW() WHERE id=$1",
        [m.id]
      );
      await dbPool.query(
        `INSERT INTO digital_contracts (contract_type, party_id, party_name, party_phone, contract_title, contract_text, status, accepted_at, accepted_ip)
         VALUES ('marketer', $1, $2, $3, 'عقد شراكة تسويقية', $4, 'accepted', NOW(), $5)
         ON CONFLICT DO NOTHING`,
        [String(m.id), m.name, m.phone, MARKETER_CONTRACT_TEXT, String(ip)]
      );
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: "فشل حفظ قبول العقد" });
    }
  });

  // ── 4. إحصائيات لوحة التحكم ──────────────────────────────────────
  app.get("/api/marketer/stats", requireMarketer, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const m = (req as any).marketer;
      // طلبات شهر الحالي
      const monthOrders = await dbPool.query(
        `SELECT COUNT(*) as cnt, COALESCE(SUM(marketer_commission_amount),0) as earned
         FROM orders WHERE marketer_table_id=$1 AND created_at >= date_trunc('month', NOW())`,
        [m.id]
      );
      // طلبات بانتظار الصرف (غير مدفوع)
      const pendingPay = await dbPool.query(
        `SELECT COALESCE(SUM(marketer_commission_amount),0) as pending
         FROM orders WHERE marketer_table_id=$1 AND marketer_commission_paid=false AND status IN ('delivered','completed')`,
        [m.id]
      );
      res.json({
        walletBalance: Number(m.wallet_balance),
        totalEarnings: Number(m.total_earnings),
        totalOrders: Number(m.total_orders),
        monthOrders: Number(monthOrders.rows[0].cnt),
        monthEarnings: Number(monthOrders.rows[0].earned),
        pendingPayout: Number(pendingPay.rows[0].pending),
        couponCode: m.coupon_code,
        commissionRate: Number(m.commission_rate),
        discountRate: Number(m.discount_rate),
      });
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب الإحصائيات" });
    }
  });

  // ── 5. طلبات المسوق (عبر كوبونه) ─────────────────────────────────
  app.get("/api/marketer/orders", requireMarketer, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const m = (req as any).marketer;
      const result = await dbPool.query(
        `SELECT id, customer_name, shipping_city, total, status, coupon_code,
                marketer_commission_amount, marketer_commission_paid, created_at
         FROM orders WHERE marketer_table_id=$1
         ORDER BY created_at DESC LIMIT 100`,
        [m.id]
      );
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب الطلبات" });
    }
  });

  // ── 6. كوبونات المسوق ─────────────────────────────────────────────
  app.get("/api/marketer/coupons", requireMarketer, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const m = (req as any).marketer;
      // الكوبون الرئيسي للمسوق
      const main = m.coupon_code ? [{
        id: 0,
        code: m.coupon_code,
        discountPercent: Number(m.discount_rate),
        commissionPercent: Number(m.commission_rate),
        isMain: true,
        usageCount: Number(m.total_orders),
        link: `https://oyoplast.com/m/${m.coupon_code}`,
      }] : [];
      res.json(main);
    } catch (e: any) {
      res.status(500).json({ message: "فشل" });
    }
  });

  // ── 7. طلبات السحب ────────────────────────────────────────────────
  app.get("/api/marketer/withdrawals", requireMarketer, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const m = (req as any).marketer;
      const result = await dbPool.query(
        "SELECT * FROM marketer_withdrawal_requests WHERE marketer_id=$1 ORDER BY requested_at DESC",
        [m.id]
      );
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل" });
    }
  });

  // ── 8. إنشاء طلب سحب ─────────────────────────────────────────────
  app.post("/api/marketer/withdrawals", requireMarketer, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const m = (req as any).marketer;
      const { amount, paymentMethod, paymentDetails } = req.body;
      if (!amount || Number(amount) <= 0) return res.status(400).json({ message: "المبلغ غير صالح" });
      if (Number(amount) > Number(m.wallet_balance)) return res.status(400).json({ message: "المبلغ أكبر من رصيدك" });
      if (!paymentMethod) return res.status(400).json({ message: "طريقة الدفع مطلوبة" });
      // تحقق من عدم وجود طلب معلق
      const pending = await dbPool.query("SELECT id FROM marketer_withdrawal_requests WHERE marketer_id=$1 AND status='pending'", [m.id]);
      if (pending.rows.length) return res.status(409).json({ message: "لديك طلب سحب في قيد المعالجة" });
      await dbPool.query(
        `INSERT INTO marketer_withdrawal_requests (marketer_id, amount, payment_method, payment_details)
         VALUES ($1,$2,$3,$4)`,
        [m.id, amount, paymentMethod, paymentDetails || null]
      );
      res.json({ success: true, message: "تم إرسال طلب السحب بنجاح" });
    } catch (e: any) {
      res.status(500).json({ message: "فشل إرسال طلب السحب" });
    }
  });

  // ── Admin: طلبات الانضمام ─────────────────────────────────────────
  app.get("/api/admin/marketer-applications", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query("SELECT * FROM marketer_applications ORDER BY created_at DESC");
      res.json(r.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل" });
    }
  });

  app.patch("/api/admin/marketer-applications/:id/status", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { status, pin, couponCode, commissionRate, discountRate, rejectionReason } = req.body;
      const id = parseInt(req.params.id);
      if (!["approved", "rejected"].includes(status)) return res.status(400).json({ message: "حالة غير صالحة" });

      const appRes = await dbPool.query("SELECT * FROM marketer_applications WHERE id=$1", [id]);
      if (!appRes.rows.length) return res.status(404).json({ message: "الطلب غير موجود" });
      const app_ = appRes.rows[0];

      if (status === "approved") {
        if (!couponCode || !pin) return res.status(400).json({ message: "كود الكوبون والرقم السري مطلوبان" });
        // تحقق من تفرد الكوبون والهاتف
        const dupPhone = await dbPool.query("SELECT id FROM standalone_marketers WHERE phone=$1", [app_.phone]);
        if (dupPhone.rows.length) return res.status(409).json({ message: "مسوق بهذا الهاتف موجود مسبقاً" });
        const dupCoupon = await dbPool.query("SELECT id FROM standalone_marketers WHERE coupon_code=$1", [couponCode.toUpperCase()]);
        if (dupCoupon.rows.length) return res.status(409).json({ message: "كود الكوبون مستخدم مسبقاً" });
        // إنشاء حساب المسوق
        await dbPool.query(
          `INSERT INTO standalone_marketers (application_id, name, phone, city, channel, channel_handle, pin, coupon_code, commission_rate, discount_rate)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [id, app_.name, app_.phone, app_.city, app_.channel, app_.channel_handle,
           pin, couponCode.toUpperCase(), commissionRate || 5, discountRate || 5]
        );
      }

      await dbPool.query(
        "UPDATE marketer_applications SET status=$1, rejection_reason=$2, processed_at=NOW() WHERE id=$3",
        [status, rejectionReason || null, id]
      );
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "فشل" });
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // ── Supplier Self-Signup (Partnership Portal, May 2026) ─────────
  // ─────────────────────────────────────────────────────────────────
  app.post("/api/partnership/supplier/apply", async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const {
        companyName, ownerName, phone, city, address,
        businessType, productCategories, message, documentsUrls,
        contractAccepted
      } = req.body || {};

      if (!companyName || !ownerName || !phone || !city)
        return res.status(400).json({ message: "اسم الشركة، اسم المالك، الهاتف، والمدينة مطلوبة" });
      if (!contractAccepted)
        return res.status(400).json({ message: "يجب الموافقة على عقد الشراكة" });

      const dup = await dbPool.query(
        "SELECT id FROM supplier_applications WHERE phone=$1 AND status='pending'",
        [phone.trim()]
      );
      if (dup.rows.length)
        return res.status(409).json({ message: "يوجد طلب مسبق بهذا الهاتف قيد المراجعة" });

      const result = await dbPool.query(
        `INSERT INTO supplier_applications
         (company_name, owner_name, phone, city, address, business_type, product_categories, message, documents_urls, contract_accepted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, NOW())
         RETURNING id`,
        [
          companyName.trim(), ownerName.trim(), phone.trim(), city.trim(),
          address || null, businessType || null,
          Array.isArray(productCategories) ? productCategories : null,
          message || null,
          Array.isArray(documentsUrls) ? documentsUrls : null,
        ]
      );
      res.json({
        success: true,
        id: result.rows[0].id,
        message: "تم إرسال طلبك بنجاح! سيتواصل معك فريقنا خلال 24-72 ساعة"
      });
    } catch (e: any) {
      console.error("[supplier-apply]", e);
      res.status(500).json({ message: "فشل إرسال الطلب" });
    }
  });

  app.get("/api/admin/supplier-applications", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(
        "SELECT * FROM supplier_applications ORDER BY created_at DESC"
      );
      res.json(r.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل" });
    }
  });

  app.patch("/api/admin/supplier-applications/:id/status", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { status, rejectionReason, commissionRate } = req.body || {};
      const id = parseInt(req.params.id);
      if (!["approved", "rejected"].includes(status))
        return res.status(400).json({ message: "حالة غير صالحة" });

      const appRes = await dbPool.query("SELECT * FROM supplier_applications WHERE id=$1", [id]);
      if (!appRes.rows.length) return res.status(404).json({ message: "الطلب غير موجود" });
      const app_ = appRes.rows[0];

      if (status === "approved") {
        const dup = await dbPool.query("SELECT id FROM suppliers WHERE phone=$1", [app_.phone]);
        if (!dup.rows.length) {
          await dbPool.query(
            `INSERT INTO suppliers (name, phone, cities, commission_rate, is_active, notes)
             VALUES ($1, $2, $3, $4, true, $5)`,
            [
              app_.company_name,
              app_.phone,
              [app_.city],
              commissionRate || 10,
              `مورد جديد - تم قبوله من الطلب #${id}. المالك: ${app_.owner_name}`
            ]
          );
        }
      }

      await dbPool.query(
        "UPDATE supplier_applications SET status=$1, rejection_reason=$2, processed_at=NOW() WHERE id=$3",
        [status, rejectionReason || null, id]
      );
      res.json({ success: true });
    } catch (e: any) {
      console.error("[supplier-app-update]", e);
      res.status(500).json({ message: e.message || "فشل" });
    }
  });

  // ── Admin: المسوقون ───────────────────────────────────────────────
  app.get("/api/admin/marketers", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(
        `SELECT m.*, 
                (SELECT COUNT(*) FROM orders o WHERE o.marketer_table_id=m.id) as actual_orders,
                (SELECT COALESCE(SUM(o.marketer_commission_amount),0) FROM orders o WHERE o.marketer_table_id=m.id AND o.marketer_commission_paid=false AND o.status IN ('delivered','completed')) as pending_payout
         FROM standalone_marketers m ORDER BY m.created_at DESC`
      );
      res.json(r.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل" });
    }
  });

  app.post("/api/admin/marketers", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { name, phone, city, channel, channelHandle, pin, couponCode, commissionRate, discountRate, notes } = req.body;
      if (!name || !phone || !pin || !couponCode) return res.status(400).json({ message: "الاسم، الهاتف، PIN، وكود الكوبون مطلوبة" });
      const r = await dbPool.query(
        `INSERT INTO standalone_marketers (name, phone, city, channel, channel_handle, pin, coupon_code, commission_rate, discount_rate, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [name, phone, city || null, channel || null, channelHandle || null,
         pin, couponCode.toUpperCase(), commissionRate || 5, discountRate || 5, notes || null]
      );
      res.json(r.rows[0]);
    } catch (e: any) {
      if (e.code === "23505") return res.status(409).json({ message: "الهاتف أو الكوبون مستخدم مسبقاً" });
      res.status(500).json({ message: "فشل" });
    }
  });

  app.patch("/api/admin/marketers/:id", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { name, phone, pin, couponCode, commissionRate, discountRate, isActive, notes, walletBalance } = req.body;
      const id = parseInt(req.params.id);
      await dbPool.query(
        `UPDATE standalone_marketers SET
           name=COALESCE($1,name), phone=COALESCE($2,phone), pin=COALESCE($3,pin),
           coupon_code=COALESCE($4,coupon_code), commission_rate=COALESCE($5,commission_rate),
           discount_rate=COALESCE($6,discount_rate), is_active=COALESCE($7,is_active),
           notes=COALESCE($8,notes), wallet_balance=COALESCE($9,wallet_balance)
         WHERE id=$10`,
        [name||null, phone||null, pin||null, couponCode?couponCode.toUpperCase():null,
         commissionRate||null, discountRate||null, isActive!=null?isActive:null,
         notes||null, walletBalance!=null?walletBalance:null, id]
      );
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: "فشل" });
    }
  });

  // ── Admin: طلبات السحب ────────────────────────────────────────────
  app.get("/api/admin/marketer-withdrawals", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(
        `SELECT w.*, m.name as marketer_name, m.phone as marketer_phone, m.wallet_balance
         FROM marketer_withdrawal_requests w
         JOIN standalone_marketers m ON w.marketer_id=m.id
         ORDER BY w.requested_at DESC`
      );
      res.json(r.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل" });
    }
  });

  app.patch("/api/admin/marketer-withdrawals/:id", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { status, adminNotes } = req.body;
      const id = parseInt(req.params.id);
      const wRes = await dbPool.query("SELECT * FROM marketer_withdrawal_requests WHERE id=$1", [id]);
      if (!wRes.rows.length) return res.status(404).json({ message: "الطلب غير موجود" });
      const w = wRes.rows[0];
      if (!["approved", "paid", "rejected"].includes(status)) return res.status(400).json({ message: "حالة غير صالحة" });
      // إذا دُفع → اخصم من المحفظة
      if (status === "paid" && w.status !== "paid") {
        await dbPool.query(
          "UPDATE standalone_marketers SET wallet_balance=GREATEST(0,wallet_balance-$1) WHERE id=$2",
          [w.amount, w.marketer_id]
        );
      }
      await dbPool.query(
        "UPDATE marketer_withdrawal_requests SET status=$1, admin_notes=$2, processed_at=NOW() WHERE id=$3",
        [status, adminNotes || null, id]
      );
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: "فشل" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // العقود الرقمية — إدارة + قبول
  // ═══════════════════════════════════════════════════════════════════

  app.get("/api/admin/digital-contracts", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { type } = req.query;
      const where = type ? "WHERE contract_type=$1" : "";
      const params = type ? [type] : [];
      const r = await dbPool.query(
        `SELECT * FROM digital_contracts ${where} ORDER BY created_at DESC`,
        params
      );
      res.json(r.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب العقود" });
    }
  });

  app.post("/api/admin/digital-contracts", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { contractType, partyId, partyName, partyPhone, contractTitle, contractText, expiresAt } = req.body;
      if (!contractType || !partyId || !partyName || !contractTitle || !contractText)
        return res.status(400).json({ message: "البيانات الأساسية مطلوبة" });
      const r = await dbPool.query(
        `INSERT INTO digital_contracts (contract_type, party_id, party_name, party_phone, contract_title, contract_text, status, admin_signed_at, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,'pending', NOW(), $7) RETURNING *`,
        [contractType, String(partyId), partyName, partyPhone || null, contractTitle, contractText, expiresAt || null]
      );
      res.json(r.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل إنشاء العقد" });
    }
  });

  app.patch("/api/admin/digital-contracts/:id", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { status, adminNotes } = req.body;
      const id = parseInt(req.params.id);
      await dbPool.query(
        "UPDATE digital_contracts SET status=COALESCE($1,status), admin_notes=COALESCE($2,admin_notes) WHERE id=$3",
        [status || null, adminNotes || null, id]
      );
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: "فشل التحديث" });
    }
  });

  // قبول العقد من صفحة الطرف المعني (رابط الكوبون)
  app.post("/api/digital-contracts/:id/accept", async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const id = parseInt(req.params.id);
      const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
      const r = await dbPool.query(
        "UPDATE digital_contracts SET status='accepted', accepted_at=NOW(), accepted_ip=$1 WHERE id=$2 AND status='pending' RETURNING *",
        [String(ip), id]
      );
      if (!r.rows.length) return res.status(404).json({ message: "العقد غير موجود أو مقبول مسبقاً" });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: "فشل" });
    }
  });

  app.get("/api/digital-contracts/:id", async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const id = parseInt(req.params.id);
      const r = await dbPool.query("SELECT * FROM digital_contracts WHERE id=$1", [id]);
      if (!r.rows.length) return res.status(404).json({ message: "العقد غير موجود" });
      res.json(r.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل" });
    }
  });

  // التحقق من كود الكوبون (للمسوقين وغيرهم)
  app.post("/api/coupons/validate", async (req, res) => {
    try {
      const { code } = req.body;
      if (!code) return res.status(400).json({ message: "الرجاء إدخال كود الكوبون" });
      const { pool: dbPool } = await import("./db");

      // أولاً: تحقق من كوبونات المسوقين المستقلين
      const smRes = await dbPool.query(
        `SELECT * FROM standalone_marketers WHERE coupon_code=$1 AND is_active=true`,
        [code.toUpperCase()]
      );
      if (smRes.rows.length) {
        const sm = smRes.rows[0];
        return res.json({
          code: sm.coupon_code,
          discountPercent: Number(sm.discount_rate),
          marketerCommission: Number(sm.commission_rate),
          marketerTableId: sm.id,
          type: "standalone_marketer",
        });
      }

      // ثانياً: كوبونات النظام القديم
      const result = await dbPool.query(
        `SELECT * FROM coupons WHERE code=$1 AND is_active=true AND (expires_at IS NULL OR expires_at > NOW())`,
        [code.toUpperCase()]
      );
      if (!result.rows.length) return res.status(404).json({ message: "الكوبون غير صالح أو منتهي" });
      const coupon = result.rows[0];
      if (coupon.max_usage && coupon.usage_count >= coupon.max_usage)
        return res.status(400).json({ message: "تم استخدام الكوبون بالحد الأقصى" });
      res.json({
        code: coupon.code,
        discountPercent: coupon.discount_percent,
        marketerCommission: coupon.marketer_commission_percent,
        marketerId: coupon.marketer_id,
        type: "coupon",
      });
    } catch (e: any) {
      res.status(500).json({ message: "فشل التحقق من الكوبون" });
    }
  });

  // Admin - إحصائيات نقاط الولاء
  app.get("/api/admin/points/stats", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const stats = await dbPool.query(`
        SELECT
          COUNT(DISTINCT user_id) as users_with_points,
          SUM(points) as total_active_points,
          SUM(lifetime_points) as total_earned_ever
        FROM reward_points
      `);
      const recent = await dbPool.query(`
        SELECT pt.*, u.name as user_name, u.phone as user_phone
        FROM points_transactions pt
        JOIN users u ON pt.user_id = u.id
        ORDER BY pt.created_at DESC LIMIT 20
      `);
      res.json({ stats: stats.rows[0], recent: recent.rows });
    } catch (e: any) {
      res.status(500).json({ message: "فشل" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // ─── نظام التقسيط ────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════

  // إنشاء خطة تقسيط جديدة (يُستدعى بعد إنشاء الطلب)
  app.post("/api/installment-plans", async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const {
        orderId, customerId, customerName, customerPhone,
        planType, totalAmount, depositAmount,
        guarantorSupplierName, guarantorSupplierPhone, guarantorNotes,
        depositReceiptUrl,
      } = req.body;

      if (!orderId || !customerName || !planType || !totalAmount || !depositAmount) {
        return res.status(400).json({ message: "بيانات ناقصة" });
      }

      const remaining = Number(totalAmount) - Number(depositAmount);

      const result = await dbPool.query(
        `INSERT INTO installment_plans
          (order_id, customer_id, customer_name, customer_phone, plan_type,
           total_amount, deposit_amount, remaining_amount,
           deposit_receipt_url,
           guarantor_supplier_name, guarantor_supplier_phone, guarantor_notes, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending')
         RETURNING *`,
        [
          orderId, customerId || null, customerName, customerPhone, planType,
          totalAmount, depositAmount, remaining,
          depositReceiptUrl || null,
          guarantorSupplierName || null,
          guarantorSupplierPhone || null,
          guarantorNotes || null,
        ]
      );

      // إشعار المشرف بالتقسيط الجديد عبر واتساب
      try {
        const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER || process.env.TWILIO_FROM_NUMBER;
        if (adminPhone) {
          const planLabel = planType === "deposit_cod" ? "مقدّم + باقي عند التسليم" : "كفيل المورد";
          await (async () => {
            const twilio = (await import("twilio")).default;
            const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
            await client.messages.create({
              from: `whatsapp:${process.env.TWILIO_FROM_NUMBER}`,
              to: `whatsapp:${adminPhone}`,
              body: `📋 طلب تقسيط جديد\nالطلب: #${orderId}\nالعميل: ${customerName} | ${customerPhone}\nالنوع: ${planLabel}\nالمقدّم: ${Number(depositAmount).toLocaleString()} ر.ي\nالباقي: ${remaining.toLocaleString()} ر.ي${guarantorSupplierName ? `\nالكفيل: ${guarantorSupplierName}` : ""}\nراجع اللوحة: https://oyoplast.com/admin`,
            });
          })();
        }
      } catch { /* non-fatal */ }

      res.json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل إنشاء خطة التقسيط", details: e.message });
    }
  });

  // قائمة خطط التقسيط (للإدارة)
  app.get("/api/admin/installment-plans", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { status } = req.query;
      let where = status ? `WHERE ip.status = $1` : "";
      const params = status ? [status] : [];

      const result = await dbPool.query(`
        SELECT ip.*,
               o.status as order_status, o.total as order_total,
               o.shipping_city, o.shipping_address,
               o.customer_phone as order_phone
        FROM installment_plans ip
        JOIN orders o ON ip.order_id = o.id
        ${where}
        ORDER BY ip.created_at DESC
        LIMIT 200
      `, params);

      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب خطط التقسيط" });
    }
  });

  // تفاصيل خطة واحدة
  app.get("/api/admin/installment-plans/:id", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        `SELECT ip.*, o.status as order_status, o.total as order_total,
                o.shipping_city, o.customer_phone as order_phone
         FROM installment_plans ip
         JOIN orders o ON ip.order_id = o.id
         WHERE ip.id = $1`,
        [parseInt(req.params.id)]
      );
      if (!result.rows.length) return res.status(404).json({ message: "الخطة غير موجودة" });
      res.json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل" });
    }
  });

  // تحديث حالة خطة التقسيط (مشرف)
  app.patch("/api/admin/installment-plans/:id", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const planId = parseInt(req.params.id);
      const { action, adminNotes } = req.body;

      // الإجراءات المتاحة: confirm_deposit | confirm_remaining | cancel | add_note
      let setClauses: string[] = [];
      let values: any[] = [];
      let idx = 1;

      // جلب بيانات الخطة لإرسال الإشعار لاحقاً
      const planRow = await dbPool.query(
        `SELECT * FROM installment_plans WHERE id=$1`,
        [planId]
      );
      const planData = planRow.rows[0];

      if (action === "confirm_deposit") {
        setClauses.push(`deposit_paid = true, deposit_paid_at = NOW(), status = 'deposit_paid'`);
        // تحديث الطلب بحالة deposit_paid
        const plan = await dbPool.query(`SELECT order_id FROM installment_plans WHERE id=$1`, [planId]);
        if (plan.rows[0]) {
          await dbPool.query(`UPDATE orders SET status='deposit_paid', payment_status='partial' WHERE id=$1`, [plan.rows[0].order_id]);
        }
        // إشعار العميل بواتساب
        try {
          if (planData?.customer_phone) {
            const phone = planData.customer_phone.replace(/\s+/g, "").replace(/^00/, "+");
            const accountSid = process.env.TWILIO_ACCOUNT_SID;
            const authToken = process.env.TWILIO_AUTH_TOKEN;
            const fromNumber = process.env.TWILIO_FROM_NUMBER;
            if (phone.startsWith("+") && accountSid && authToken && fromNumber) {
              const msg = `✅ تم تأكيد مقدّم التقسيط!\n━━━━━━━━━━━━━━━━━━━━━\n🆔 طلب: #${planData.order_id}\n💰 المقدّم: ${Number(planData.deposit_amount).toLocaleString()} ر.ي\n💳 الباقي عند التسليم: ${Number(planData.remaining_amount).toLocaleString()} ر.ي\nسيتم تجهيز طلبك الآن.\n━━━━━━━━━━━━━━━━━━━━━\nأويو بلاست 🛍️`;
              await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
                method: "POST",
                headers: { Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({ To: `whatsapp:${phone}`, From: `whatsapp:${fromNumber}`, Body: msg }),
              });
            }
          }
        } catch { /* non-fatal */ }
      } else if (action === "confirm_remaining") {
        setClauses.push(`remaining_paid = true, remaining_paid_at = NOW(), status = 'completed'`);
        const plan = await dbPool.query(`SELECT order_id FROM installment_plans WHERE id=$1`, [planId]);
        if (plan.rows[0]) {
          await dbPool.query(`UPDATE orders SET payment_status='cod_collected' WHERE id=$1`, [plan.rows[0].order_id]);
        }
        // إشعار العميل بواتساب
        try {
          if (planData?.customer_phone) {
            const phone = planData.customer_phone.replace(/\s+/g, "").replace(/^00/, "+");
            const accountSid = process.env.TWILIO_ACCOUNT_SID;
            const authToken = process.env.TWILIO_AUTH_TOKEN;
            const fromNumber = process.env.TWILIO_FROM_NUMBER;
            if (phone.startsWith("+") && accountSid && authToken && fromNumber) {
              const msg = `🎉 تم سداد التقسيط بالكامل!\n━━━━━━━━━━━━━━━━━━━━━\n🆔 طلب: #${planData.order_id}\nشكراً لثقتك بأويو بلاست! نتمنى أن ينال طلبك إعجابك 💙\n━━━━━━━━━━━━━━━━━━━━━\nأويو بلاست 🛍️`;
              await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
                method: "POST",
                headers: { Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({ To: `whatsapp:${phone}`, From: `whatsapp:${fromNumber}`, Body: msg }),
              });
            }
          }
        } catch { /* non-fatal */ }
      } else if (action === "cancel") {
        setClauses.push(`status = 'cancelled'`);
      }

      if (adminNotes !== undefined) {
        setClauses.push(`admin_notes = $${idx++}`);
        values.push(adminNotes);
      }

      if (!setClauses.length) return res.status(400).json({ message: "لا يوجد تحديث" });

      values.push(planId);
      const result = await dbPool.query(
        `UPDATE installment_plans SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
        values
      );

      res.json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث الخطة", details: e.message });
    }
  });

  // ─── إرسال تذكير واتساب لعميل التقسيط ───────────────────────────
  app.post("/api/admin/installment-plans/:id/remind", requireAdmin, async (req, res) => {
    try {
      const planId = parseInt(req.params.id);
      const { pool: dbPool } = await import("./db");
      const planRes = await dbPool.query(
        `SELECT ip.*, o.shipping_city FROM installment_plans ip LEFT JOIN orders o ON o.id=ip.order_id WHERE ip.id=$1`,
        [planId]
      );
      if (!planRes.rows[0]) return res.status(404).json({ message: "الخطة غير موجودة" });
      const p = planRes.rows[0];
      const remaining = Number(p.remaining_amount).toLocaleString("ar-YE");
      const deposit = Number(p.deposit_amount).toLocaleString("ar-YE");
      const status = p.deposit_paid ? `المقدّم مدفوع ✅ — الباقي: ${remaining} ر.ي` : `المقدّم المطلوب: ${deposit} ر.ي`;
      const msgBody = `📦 أويو بلاست — تذكير بخطة التقسيط\n\nالعزيز/ة ${p.customer_name},\nلديك دفعة مستحقة لطلب رقم #${p.order_id}\n${status}\n\nللاستفسار: wa.me/967774997589`;
      try {
        if (process.env.TWILIO_ACCOUNT_SID) {
          const twilio = (await import("twilio")).default;
          const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
          const phone = p.customer_phone.replace(/^0/, "967").replace(/^\+/, "");
          await client.messages.create({
            from: `whatsapp:${process.env.TWILIO_FROM_NUMBER}`,
            to: `whatsapp:+${phone}`,
            body: msgBody,
          });
        }
      } catch (twilioErr: any) {
        console.error("Twilio reminder error:", twilioErr.message);
        return res.status(500).json({ message: "فشل إرسال التذكير عبر واتساب", details: twilioErr.message });
      }
      await dbPool.query(
        `UPDATE installment_plans SET admin_notes = COALESCE(admin_notes,'') || $1 WHERE id=$2`,
        [`\n[تذكير أُرسل ${new Date().toLocaleDateString("ar-YE")}]`, planId]
      );
      res.json({ ok: true, message: "تم إرسال التذكير عبر واتساب" });
    } catch (e: any) {
      res.status(500).json({ message: "فشل إرسال التذكير", details: e.message });
    }
  });

  // إحصائيات التقسيط للإدارة
  app.get("/api/admin/installment-plans/stats/summary", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(`
        SELECT
          COUNT(*) as total_plans,
          COUNT(CASE WHEN status='pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status='deposit_paid' THEN 1 END) as deposit_paid,
          COUNT(CASE WHEN status='completed' THEN 1 END) as completed,
          COUNT(CASE WHEN status='cancelled' THEN 1 END) as cancelled,
          COALESCE(SUM(total_amount::numeric), 0) as total_value,
          COALESCE(SUM(deposit_amount::numeric), 0) as total_deposits,
          COALESCE(SUM(remaining_amount::numeric), 0) as total_remaining,
          COALESCE(SUM(CASE WHEN remaining_paid=false AND status NOT IN ('cancelled','completed') THEN remaining_amount::numeric ELSE 0 END), 0) as pending_collection
        FROM installment_plans
      `);
      res.json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل" });
    }
  });

  // قائمة الموردين النشطين (للاستخدام في اختيار كفيل - عام محدود)
  app.get("/api/public/suppliers-list", async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        `SELECT id, name, phone, cities FROM suppliers WHERE is_active=true ORDER BY name`
      );
      res.json(result.rows.map(r => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        cities: r.cities,
      })));
    } catch (e: any) {
      res.status(500).json({ message: "فشل" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // ─── نظام GPS وإيجاد أقرب موزع ──────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════

  // أقرب الموزعين من موقع العميل (public)
  app.get("/api/location/nearest-distributors", async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ message: "إحداثيات غير صالحة" });

      const suppRes = await dbPool.query(
        `SELECT id, name, phone, cities, province, district, lat, lng, service_radius_km
         FROM suppliers WHERE is_active=true AND lat IS NOT NULL AND lng IS NOT NULL`
      );
      const withDist = suppRes.rows.map((s: any) => ({
        id: s.id,
        name: s.name,
        cities: s.cities,
        province: s.province,
        district: s.district,
        serviceRadiusKm: s.service_radius_km,
        distanceKm: parseFloat(haversineKm(lat, lng, Number(s.lat), Number(s.lng)).toFixed(2)),
        withinRadius: haversineKm(lat, lng, Number(s.lat), Number(s.lng)) <= (s.service_radius_km || 20),
      })).sort((a, b) => a.distanceKm - b.distanceKm);

      res.json(withDist.slice(0, 10));
    } catch (e: any) {
      res.status(500).json({ message: "فشل البحث" });
    }
  });

  // ── إعدادات مناطق الخدمة (admin) ─────────────────────────────────────
  app.get("/api/admin/service-areas", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(`SELECT * FROM service_area_config ORDER BY city, name`);
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/admin/service-areas", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { name, city, district, centerLat, centerLng, radiusKm, notes } = req.body;
      if (!name || !city) return res.status(400).json({ message: "الاسم والمدينة مطلوبان" });
      const r = await dbPool.query(
        `INSERT INTO service_area_config (name, city, district, center_lat, center_lng, radius_km, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [name, city, district || null, centerLat || null, centerLng || null, radiusKm || 20, notes || null]
      );
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.put("/api/admin/service-areas/:id", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { name, city, district, centerLat, centerLng, radiusKm, notes } = req.body;
      const r = await dbPool.query(
        `UPDATE service_area_config SET name=COALESCE($1,name), city=COALESCE($2,city),
         district=COALESCE($3,district), center_lat=COALESCE($4,center_lat), center_lng=COALESCE($5,center_lng),
         radius_km=COALESCE($6,radius_km), notes=COALESCE($7,notes) WHERE id=$8 RETURNING *`,
        [name||null, city||null, district||null, centerLat!=null?centerLat:null, centerLng!=null?centerLng:null, radiusKm||null, notes||null, req.params.id]
      );
      if (!r.rows.length) return res.status(404).json({ message: "المنطقة غير موجودة" });
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/admin/service-areas/:id", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      await dbPool.query(`DELETE FROM service_area_config WHERE id=$1`, [req.params.id]);
      res.json({ message: "تم الحذف" });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── تحديث موقع الموزع من بوابة الموزع نفسه ───────────────────────────
  app.put("/api/supplier/location", requireSupplier, async (req: any, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { lat, lng, serviceRadiusKm, district, province } = req.body;
      if (!lat || !lng) return res.status(400).json({ message: "الإحداثيات مطلوبة" });
      const suppId = req.supplierId;
      await dbPool.query(
        `UPDATE suppliers SET lat=$1, lng=$2, service_radius_km=COALESCE($3, service_radius_km),
         district=COALESCE($4, district), province=COALESCE($5, province) WHERE id=$6`,
        [lat, lng, serviceRadiusKm || null, district || null, province || null, suppId]
      );
      res.json({ message: "تم تحديث الموقع" });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── إحصائيات طلبات حسب الموقع (admin - للخريطة) ─────────────────────
  app.get("/api/admin/orders-geo", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(`
        SELECT id, shipping_city, customer_lat, customer_lng, total, status, payment_status, location_method
        FROM orders
        WHERE customer_lat IS NOT NULL AND customer_lng IS NOT NULL
        ORDER BY created_at DESC LIMIT 500
      `);
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // إشعار المشرف عند رفع إيصال الدفع (بدون تقسيط)
  app.post("/api/orders/:id/notify-receipt", async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const { pool: dbPool } = await import("./db");
      const order = await dbPool.query(`SELECT * FROM orders WHERE id=$1`, [orderId]);
      if (!order.rows[0]) return res.status(404).json({ message: "طلب غير موجود" });
      const o = order.rows[0];
      // إشعار المشرف
      try {
        const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER;
        if (adminPhone && process.env.TWILIO_ACCOUNT_SID) {
          const twilio = (await import("twilio")).default;
          const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
          await client.messages.create({
            from: `whatsapp:${process.env.TWILIO_FROM_NUMBER}`,
            to: `whatsapp:${adminPhone}`,
            body: `💰 إيصال دفع جديد بانتظار المراجعة\nطلب: #${orderId}\nالعميل: ${o.customer_name} | ${o.customer_phone}\nالمبلغ: ${Number(o.total).toLocaleString()} ر.ي\nراجع: https://oyoplast.com/admin`,
          });
        }
      } catch { /* non-fatal */ }
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: "فشل" });
    }
  });

  // ══════════════════════════════════════════════════════════════════
  // ─── Smart Pricing System ─────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════

  // دالة مساعدة: حساب خطوط التسعير من تكاليف المنتج + التكلفة التشغيلية للوحدة
  async function calcPricingLines(
    purchasePrice: number,
    inlandShipping: number,
    storageCost: number,
    targetMarginPct: number,
    safetyMarginPct: number,
    operationalShareOverride?: number
  ) {
    const { pool: dbPool } = await import("./db");
    // اجلب أحدث تكلفة تشغيلية للوحدة
    let costPerOrder = operationalShareOverride ?? 0;
    if (operationalShareOverride === undefined) {
      const latest = await dbPool.query(
        `SELECT cost_per_order FROM operational_costs ORDER BY month DESC LIMIT 1`
      );
      costPerOrder = parseFloat(latest.rows[0]?.cost_per_order ?? "0");
    }
    const redLine = purchasePrice + inlandShipping + storageCost + costPerOrder;
    const greenLine = redLine * (1 + safetyMarginPct / 100);
    const suggestedPrice = greenLine * (1 + targetMarginPct / 100);
    return { costPerOrder, redLine, greenLine, suggestedPrice };
  }

  // GET /api/admin/operational-costs — قائمة التكاليف التشغيلية الشهرية
  app.get("/api/admin/operational-costs", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        `SELECT * FROM operational_costs ORDER BY month DESC`
      );
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب التكاليف", details: e.message });
    }
  });

  // POST /api/admin/operational-costs — حفظ تكاليف شهر (upsert)
  app.post("/api/admin/operational-costs", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { month, salaries = 0, rent = 0, marketing = 0, logistics = 0, other = 0, totalOrders = 1, notes } = req.body;
      if (!month || !/^\d{4}-\d{2}$/.test(month))
        return res.status(400).json({ message: "صيغة الشهر غير صحيحة (YYYY-MM)" });

      const totalCosts = Number(salaries) + Number(rent) + Number(marketing) + Number(logistics) + Number(other);
      const costPerOrder = totalOrders > 0 ? (totalCosts / Number(totalOrders)) : 0;

      const result = await dbPool.query(
        `INSERT INTO operational_costs (month, salaries, rent, marketing, logistics, other, total_orders, cost_per_order, notes, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
         ON CONFLICT (month) DO UPDATE SET
           salaries=$2, rent=$3, marketing=$4, logistics=$5, other=$6,
           total_orders=$7, cost_per_order=$8, notes=$9, updated_at=NOW()
         RETURNING *`,
        [month, salaries, rent, marketing, logistics, other, totalOrders, costPerOrder.toFixed(2), notes || null]
      );

      // إعادة حساب جميع تكاليف المنتجات عند تحديث أحدث شهر
      const latestMonth = await dbPool.query(`SELECT month FROM operational_costs ORDER BY month DESC LIMIT 1`);
      if (latestMonth.rows[0]?.month === month) {
        const allCosts = await dbPool.query(`SELECT * FROM product_costs`);
        for (const pc of allCosts.rows) {
          const { redLine, greenLine, suggestedPrice } = await calcPricingLines(
            parseFloat(pc.purchase_price), parseFloat(pc.inland_shipping), parseFloat(pc.storage_cost),
            parseFloat(pc.target_margin_percent), parseFloat(pc.safety_margin_percent), costPerOrder
          );
          await dbPool.query(
            `UPDATE product_costs SET operational_share=$1, red_line_price=$2, green_line_price=$3, suggested_price=$4, updated_at=NOW() WHERE id=$5`,
            [costPerOrder.toFixed(2), redLine.toFixed(2), greenLine.toFixed(2), suggestedPrice.toFixed(2), pc.id]
          );
        }
      }

      res.json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل حفظ التكاليف", details: e.message });
    }
  });

  // GET /api/admin/pricing/products — قائمة المنتجات مع بيانات التكلفة وحالة الهامش
  app.get("/api/admin/pricing/products", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(`
        SELECT
          p.id, p.name, p.price, p.price_sar,
          pc.id AS cost_id,
          pc.purchase_price, pc.inland_shipping, pc.storage_cost,
          pc.operational_share, pc.red_line_price, pc.green_line_price,
          pc.suggested_price, pc.target_margin_percent, pc.safety_margin_percent,
          pc.notes AS cost_notes, pc.updated_at AS cost_updated_at,
          CASE
            WHEN pc.id IS NULL THEN 'no_data'
            WHEN p.price::numeric < pc.red_line_price::numeric THEN 'danger'
            WHEN p.price::numeric < pc.green_line_price::numeric THEN 'warning'
            ELSE 'safe'
          END AS margin_status,
          CASE
            WHEN pc.red_line_price::numeric > 0
            THEN ROUND(((p.price::numeric - pc.red_line_price::numeric) / pc.red_line_price::numeric * 100)::numeric, 1)
            ELSE NULL
          END AS actual_margin_pct
        FROM products p
        LEFT JOIN product_costs pc ON pc.product_id = p.id
        ORDER BY
          CASE
            WHEN pc.id IS NULL THEN 0
            WHEN p.price::numeric < pc.red_line_price::numeric THEN 1
            WHEN p.price::numeric < pc.green_line_price::numeric THEN 2
            ELSE 3
          END,
          p.name
      `);
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب المنتجات", details: e.message });
    }
  });

  // POST /api/admin/pricing/product/:id/costs — تحديث تكاليف منتج وإعادة الحساب
  app.post("/api/admin/pricing/product/:id/costs", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const productId = parseInt(req.params.id);
      const {
        purchasePrice = 0, inlandShipping = 0, storageCost = 0,
        targetMarginPercent = 30, safetyMarginPercent = 15, notes
      } = req.body;

      const { costPerOrder, redLine, greenLine, suggestedPrice } = await calcPricingLines(
        Number(purchasePrice), Number(inlandShipping), Number(storageCost),
        Number(targetMarginPercent), Number(safetyMarginPercent)
      );

      // Check if a cost record already exists for this product
      const existing = await dbPool.query(
        `SELECT id FROM product_costs WHERE product_id = $1 LIMIT 1`,
        [productId]
      );

      let result;
      if (existing.rows.length > 0) {
        result = await dbPool.query(
          `UPDATE product_costs SET
             purchase_price=$2, inland_shipping=$3, storage_cost=$4, operational_share=$5,
             red_line_price=$6, green_line_price=$7, suggested_price=$8,
             target_margin_percent=$9, safety_margin_percent=$10, notes=$11, updated_at=NOW()
           WHERE id=$1 RETURNING *`,
          [existing.rows[0].id, purchasePrice, inlandShipping, storageCost,
           costPerOrder.toFixed(2), redLine.toFixed(2), greenLine.toFixed(2),
           suggestedPrice.toFixed(2), targetMarginPercent, safetyMarginPercent, notes || null]
        );
      } else {
        result = await dbPool.query(
          `INSERT INTO product_costs
             (product_id, purchase_price, inland_shipping, storage_cost, operational_share,
              red_line_price, green_line_price, suggested_price, target_margin_percent, safety_margin_percent, notes, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
           RETURNING *`,
          [productId, purchasePrice, inlandShipping, storageCost,
           costPerOrder.toFixed(2), redLine.toFixed(2), greenLine.toFixed(2),
           suggestedPrice.toFixed(2), targetMarginPercent, safetyMarginPercent, notes || null]
        );
      }
      res.json({ ...result.rows[0], redLine, greenLine, suggestedPrice });
    } catch (e: any) {
      res.status(500).json({ message: "فشل حفظ تكاليف المنتج", details: e.message });
    }
  });

  // GET /api/admin/pricing/report — تقرير الهوامش (المنتجات تحت خط الأمان)
  app.get("/api/admin/pricing/report", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(`
        SELECT
          p.id, p.name, p.price::numeric AS current_price,
          pc.red_line_price::numeric, pc.green_line_price::numeric, pc.suggested_price::numeric,
          pc.target_margin_percent::numeric, pc.safety_margin_percent::numeric,
          CASE
            WHEN p.price::numeric < pc.red_line_price::numeric THEN 'danger'
            WHEN p.price::numeric < pc.green_line_price::numeric THEN 'warning'
            ELSE 'safe'
          END AS margin_status,
          ROUND(((p.price::numeric - pc.red_line_price::numeric) / NULLIF(pc.red_line_price::numeric,0) * 100)::numeric, 1) AS actual_margin_pct,
          (pc.suggested_price::numeric - p.price::numeric) AS gap_to_suggested
        FROM products p
        INNER JOIN product_costs pc ON pc.product_id = p.id
        WHERE pc.red_line_price::numeric > 0
        ORDER BY actual_margin_pct ASC NULLS FIRST
      `);
      const summary = {
        total: result.rows.length,
        danger: result.rows.filter(r => r.margin_status === "danger").length,
        warning: result.rows.filter(r => r.margin_status === "warning").length,
        safe: result.rows.filter(r => r.margin_status === "safe").length,
      };
      res.json({ summary, products: result.rows });
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب التقرير", details: e.message });
    }
  });

  // GET /api/admin/pricing/recommendations — توصيات ذكية: راكد + سريع البيع
  app.get("/api/admin/pricing/recommendations", requireAdmin, async (req, res) => {
    try {
      const { getRecommendations } = await import("./smart-pricing");
      const limit = Math.min(Number(req.query.limit) || 30, 100);
      const data = await getRecommendations(limit);
      res.json(data);
    } catch (e: any) {
      console.error("recommendations error:", e);
      res.status(500).json({ message: "فشل جلب التوصيات", details: e.message });
    }
  });

  // POST /api/admin/pricing/check-price — تفقّد سعر قبل الحفظ
  app.post("/api/admin/pricing/check-price", requireAdmin, async (req, res) => {
    try {
      const { checkPrice } = await import("./smart-pricing");
      const productId = Number(req.body.productId);
      const newPrice = Number(req.body.newPrice);
      if (!productId || !Number.isFinite(newPrice)) {
        return res.status(400).json({ message: "productId و newPrice مطلوبان" });
      }
      const result = await checkPrice(productId, newPrice);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ message: "فشل الفحص", details: e.message });
    }
  });

  // POST /api/admin/pricing/apply-recommendation — تطبيق توصية ذكية
  app.post("/api/admin/pricing/apply-recommendation", requireAdmin, async (req, res) => {
    try {
      const { applyRecommendation } = await import("./smart-pricing");
      const productId = Number(req.body.productId);
      const newPrice = Number(req.body.newPrice);
      const setOriginalPrice = req.body.setOriginalPrice !== false;
      if (!productId || !Number.isFinite(newPrice)) {
        return res.status(400).json({ message: "productId و newPrice مطلوبان" });
      }
      const result = await applyRecommendation(productId, newPrice, setOriginalPrice);
      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ message: "فشل التطبيق", details: e.message });
    }
  });

  // GET /api/admin/pricing/settings — قراءة إعدادات التسعير الذكي
  app.get("/api/admin/pricing/settings", requireAdmin, async (_req, res) => {
    try {
      const { getPricingSettings } = await import("./smart-pricing");
      const settings = await getPricingSettings();
      res.json(settings);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب الإعدادات", details: e.message });
    }
  });

  // PATCH /api/admin/pricing/settings — تحديث إعدادات التسعير الذكي
  app.patch("/api/admin/pricing/settings", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const allowed: Record<string, string> = {
        staleProductDays: "stale_product_days",
        staleDiscountPercent: "stale_discount_percent",
        fastSellerThreshold: "fast_seller_threshold",
        fastSellerUpliftPercent: "fast_seller_uplift_percent",
        protectMarginOnCoupons: "protect_margin_on_coupons",
      };
      const updates: string[] = [];
      const values: any[] = [];
      let i = 1;
      for (const [key, col] of Object.entries(allowed)) {
        if (req.body[key] !== undefined) {
          let v = req.body[key];
          if (typeof v === "boolean") {
            updates.push(`${col} = $${i}`);
            values.push(v);
          } else {
            const n = Number(v);
            if (!Number.isFinite(n) || n < 0) continue;
            updates.push(`${col} = $${i}`);
            values.push(Math.round(n));
          }
          i++;
        }
      }
      if (updates.length === 0) {
        return res.status(400).json({ message: "لا توجد حقول للتحديث" });
      }
      await dbPool.query(
        `UPDATE display_settings SET ${updates.join(", ")} WHERE id = (SELECT id FROM display_settings ORDER BY id LIMIT 1)`,
        values
      );
      const { getPricingSettings } = await import("./smart-pricing");
      const settings = await getPricingSettings();
      res.json({ ok: true, settings });
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث الإعدادات", details: e.message });
    }
  });

  // ─── Admin Product Stock ─────────────────────────────────────────
  app.patch("/api/admin/products/:id/stock", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const id = parseInt(req.params.id);
      if (req.body.reorderPoint !== undefined) {
        await dbPool.query(`UPDATE products SET reorder_point=$1 WHERE id=$2`, [req.body.reorderPoint, id]);
      }
      if (req.body.stock !== undefined) {
        await storage.updateProduct(id, { stock: req.body.stock });
      }
      const r = await dbPool.query(`SELECT id, name, stock, reorder_point FROM products WHERE id=$1`, [id]);
      res.json(r.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث المخزون", details: e.message });
    }
  });

  // ─── Admin Payroll (accessible by admin token) ────────────────────
  app.get("/api/admin/payroll", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const period = (req.query.period as string) || new Date().toISOString().slice(0, 7);
      const staffRes = await dbPool.query(`
        SELECT u.id, u.full_name, u.email, u.role
        FROM users u WHERE u.role IN ('delivery','order_manager','product_manager','finance','owner')
          AND u.id IN (SELECT user_id FROM team_members WHERE is_active=true)
        ORDER BY u.role, u.full_name
      `);
      const ratesRes = await dbPool.query(`SELECT * FROM staff_rate_config`);
      const rates: Record<string, any> = {};
      ratesRes.rows.forEach((r: any) => { rates[r.role] = r; });

      const result = [];
      for (const staff of staffRes.rows) {
        const rate = rates[staff.role] || { base_salary: 0, rate_per_order: 0, payment_model: 'fixed', working_days_per_month: 26 };
        const attRes = await dbPool.query(
          `SELECT COUNT(DISTINCT date) as days FROM attendance WHERE user_id=$1 AND date LIKE $2 || '%' AND check_out IS NOT NULL`,
          [staff.id, period]
        );
        const attendanceDays = parseInt(attRes.rows[0]?.days || 0);
        const workingDays = Number(rate.working_days_per_month) || 26;
        const absenceDays = Math.max(0, workingDays - attendanceDays);
        const baseSalary = Number(rate.base_salary);
        const deductionPerDay = workingDays > 0 ? baseSalary / workingDays : 0;
        const deductions = rate.payment_model !== 'per_order' ? absenceDays * deductionPerDay : 0;
        let ordersCompleted = 0;
        if (staff.role === 'delivery') {
          const ordRes = await dbPool.query(
            `SELECT COUNT(*) as cnt FROM orders WHERE assigned_to=$1 AND status IN ('delivered','completed') AND DATE_TRUNC('month', updated_at) = DATE_TRUNC('month', ($2 || '-01')::date)`,
            [staff.id, period]
          );
          ordersCompleted = parseInt(ordRes.rows[0]?.cnt || 0);
        }
        const orderBonus = ordersCompleted * Number(rate.rate_per_order);
        const savedRes = await dbPool.query(`SELECT * FROM payroll_periods WHERE user_id=$1 AND period=$2`, [staff.id, period]);
        const saved = savedRes.rows[0];
        const bonuses = Number(saved?.bonuses || 0);
        let totalPay = 0;
        if (rate.payment_model === 'fixed') totalPay = baseSalary - deductions + bonuses;
        else if (rate.payment_model === 'per_order') totalPay = orderBonus + bonuses;
        else totalPay = (baseSalary - deductions) + orderBonus + bonuses;

        result.push({
          userId: staff.id, fullName: staff.full_name || staff.email, role: staff.role, period,
          baseSalary, ratePerOrder: Number(rate.rate_per_order), paymentModel: rate.payment_model,
          ordersCompleted, orderBonus, attendanceDays, absenceDays,
          deductions: Math.round(deductions), bonuses,
          totalPay: Math.max(0, Math.round(totalPay)),
          isPaid: saved?.is_paid || false, savedId: saved?.id || null, notes: saved?.notes || null,
        });
      }
      res.json(result);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/admin/payroll/save", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { userId, period, totalPay, bonuses, notes, isPaid, ...rest } = req.body;
      await dbPool.query(`
        INSERT INTO payroll_periods (user_id, period, base_salary, orders_completed, order_bonus,
          attendance_days, absence_days, deductions, bonuses, total_pay, is_paid, paid_at, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (user_id, period) DO UPDATE SET
          bonuses=EXCLUDED.bonuses, total_pay=EXCLUDED.total_pay,
          is_paid=EXCLUDED.is_paid, paid_at=EXCLUDED.paid_at, notes=EXCLUDED.notes
      `, [userId, period, rest.baseSalary||0, rest.ordersCompleted||0, rest.orderBonus||0,
          rest.attendanceDays||0, rest.absenceDays||0, rest.deductions||0,
          bonuses||0, totalPay, isPaid||false, isPaid ? new Date() : null, notes||null]);
      res.json({ message: "تم الحفظ" });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ════════════════════════════════════════════════════════════════
  // ─── العقود الرقمية Digital Contracts ──────────────────────────
  // ════════════════════════════════════════════════════════════════

  // جلب نص عقد معين (admin + عام)
  app.get("/api/contracts/:type", async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(`SELECT * FROM contract_texts WHERE contract_type=$1`, [req.params.type]);
      if (!r.rows[0]) return res.status(404).json({ message: "العقد غير موجود" });
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // حفظ / تحديث نص عقد (admin only)
  app.put("/api/admin/contracts/:type", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { title, body, version } = req.body;
      await dbPool.query(`
        INSERT INTO contract_texts (contract_type, title, body, version, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (contract_type) DO UPDATE SET title=EXCLUDED.title, body=EXCLUDED.body, version=EXCLUDED.version, updated_at=NOW()
      `, [req.params.type, title, body, version || "1.0"]);
      res.json({ message: "تم حفظ العقد" });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // جلب جميع سجلات القبول (admin)
  app.get("/api/admin/contracts/acceptances", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const type = req.query.type as string;
      const q = type
        ? `SELECT * FROM contract_acceptances WHERE contract_type=$1 ORDER BY accepted_at DESC`
        : `SELECT * FROM contract_acceptances ORDER BY accepted_at DESC`;
      const r = await dbPool.query(q, type ? [type] : []);
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // قبول عقد (موردون / موظفون / مسوّقون / عملاء)
  app.post("/api/contracts/accept", async (req: any, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { contractType, partyId, partyName, partyRole, contractVersion } = req.body;
      if (!contractType || !partyId) return res.status(400).json({ message: "بيانات ناقصة" });
      const ip = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
      const ua = req.headers["user-agent"] || "unknown";
      // تجنب التكرار لنفس الشخص ونفس النوع والإصدار
      const existing = await dbPool.query(
        `SELECT id FROM contract_acceptances WHERE contract_type=$1 AND party_id=$2 AND contract_version=$3`,
        [contractType, partyId, contractVersion || "1.0"]
      );
      if (existing.rows.length > 0) return res.json({ message: "تم التوثيق مسبقاً", alreadyAccepted: true });
      await dbPool.query(`
        INSERT INTO contract_acceptances (contract_type, contract_version, party_id, party_name, party_role, ip_address, user_agent)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [contractType, contractVersion || "1.0", String(partyId), partyName || null, partyRole || null, String(ip), String(ua)]);
      res.json({ message: "تم توثيق القبول بنجاح", accepted: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // فحص هل وقّع طرف معين؟
  app.get("/api/contracts/status", async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { type, partyId } = req.query;
      if (!type || !partyId) return res.status(400).json({ message: "بيانات ناقصة" });
      const r = await dbPool.query(
        `SELECT * FROM contract_acceptances WHERE contract_type=$1 AND party_id=$2 ORDER BY accepted_at DESC LIMIT 1`,
        [type, partyId]
      );
      res.json({ accepted: r.rows.length > 0, record: r.rows[0] || null });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // إحصاء الموقّعين وغير الموقّعين (admin dashboard)
  app.get("/api/admin/contracts/stats", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(`
        SELECT contract_type, COUNT(*) as total, MAX(accepted_at) as latest
        FROM contract_acceptances GROUP BY contract_type
      `);
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ════════════════════════════════════════════════════════════════
  // ─── النسخ الاحتياطية Backup System ────────────────────────────
  // ════════════════════════════════════════════════════════════════

  // تصدير النسخة الاحتياطية (admin only) — JSON كامل لكل الجداول
  app.get("/api/admin/backup/export", requireAdmin, async (_req, res) => {
    try {
      // نستخدم خدمة النسخ الجديدة لإنشاء النسخة وحفظها في DB
      const { createBackupSnapshot } = await import("./backup-service");
      const { pool: dbPool } = await import("./db");

      // جلب النسخة المحفوظة مؤخراً (أو إنشاء واحدة)
      await createBackupSnapshot("admin", "hourly");

      // جلب آخر نسخة لإرسالها
      const snap = await dbPool.query(
        `SELECT snapshot_json, created_at FROM backup_snapshots ORDER BY created_at DESC LIMIT 1`
      );
      if (!snap.rows[0]) throw new Error("لم يتم إنشاء النسخة");

      const json = snap.rows[0].snapshot_json;
      // تجميل JSON للقراءة
      const prettyJson = JSON.stringify(JSON.parse(json), null, 2);
      const filename = `oyoplast-backup-${new Date().toISOString().slice(0, 10)}.json`;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(prettyJson);
    } catch (e: any) {
      try {
        const { pool: dbPool } = await import("./db");
        await dbPool.query(
          `INSERT INTO backup_logs (triggered_by, status, notes) VALUES ('admin','failed',$1)`,
          [e.message]
        );
      } catch {}
      res.status(500).json({ message: "فشل تصدير النسخة الاحتياطية", details: e.message });
    }
  });

  // سجل النسخ السابقة
  app.get("/api/admin/backup/logs", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(`SELECT id, triggered_by, size_bytes, tables_count, total_rows, status, notes, created_at, retention_type FROM backup_logs ORDER BY created_at DESC LIMIT 100`);
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // نسخة احتياطية تلقائية فورية (يدوي أو من الـ cron)
  app.post("/api/admin/backup/run", requireAdmin, async (_req, res) => {
    try {
      const { createBackupSnapshot, getBackupStatus } = await import("./backup-service");
      const result = await createBackupSnapshot("admin", "hourly");
      const status = getBackupStatus();
      res.json({ ...result, ...status });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // حالة الـ Cron (T2)
  app.get("/api/admin/backup/status", requireAdmin, async (_req, res) => {
    try {
      const { getBackupStatus } = await import("./backup-service");
      const { pool: dbPool } = await import("./db");
      const status = getBackupStatus();
      const snapshotsRes = await dbPool.query(`
        SELECT retention_type, COUNT(*) as count FROM backup_snapshots GROUP BY retention_type
      `);
      const orderEventsRes = await dbPool.query(`SELECT COUNT(*) as count FROM order_events`);
      const settingsRes = await dbPool.query(`SELECT * FROM backup_settings WHERE id = 1`);
      res.json({
        ...status,
        snapshots: snapshotsRes.rows,
        orderEventsCount: parseInt(orderEventsRes.rows[0]?.count || "0"),
        settings: settingsRes.rows[0] || null,
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // قائمة النسخ المحفوظة في قاعدة البيانات (T3)
  app.get("/api/admin/backup/snapshots", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(`
        SELECT id, triggered_by, size_bytes, tables_count, total_rows, retention_type, created_at
        FROM backup_snapshots ORDER BY created_at DESC LIMIT 100
      `);
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // تحميل نسخة محفوظة من قاعدة البيانات (T3)
  app.get("/api/admin/backup/snapshots/:id/download", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(`SELECT * FROM backup_snapshots WHERE id = $1`, [req.params.id]);
      if (!r.rows[0]) return res.status(404).json({ message: "النسخة غير موجودة" });
      const snap = r.rows[0];
      const date = new Date(snap.created_at).toISOString().slice(0, 10);
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="oyoplast-backup-${date}-#${snap.id}.json"`);
      res.send(snap.snapshot_json);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // حذف نسخة محفوظة
  app.delete("/api/admin/backup/snapshots/:id", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      await dbPool.query(`DELETE FROM backup_snapshots WHERE id = $1`, [req.params.id]);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // إعدادات النسخ (T5 — تحديث سياسة الاحتفاظ)
  app.get("/api/admin/backup/settings", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(`SELECT * FROM backup_settings WHERE id = 1`);
      res.json(r.rows[0] || {});
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/admin/backup/settings", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { auto_backup_enabled, backup_interval_hours, webhook_url, retention_hourly, retention_daily, retention_monthly } = req.body;
      await dbPool.query(`
        UPDATE backup_settings SET
          auto_backup_enabled = COALESCE($1, auto_backup_enabled),
          backup_interval_hours = COALESCE($2, backup_interval_hours),
          webhook_url = COALESCE($3, webhook_url),
          retention_hourly = COALESCE($4, retention_hourly),
          retention_daily = COALESCE($5, retention_daily),
          retention_monthly = COALESCE($6, retention_monthly),
          updated_at = NOW()
        WHERE id = 1
      `, [auto_backup_enabled ?? null, backup_interval_hours ?? null, webhook_url ?? null,
          retention_hourly ?? null, retention_daily ?? null, retention_monthly ?? null]);

      // إعادة تشغيل الـ cron إذا تغير الإعداد
      if (auto_backup_enabled !== undefined) {
        const { startAutoCron, stopAutoCron } = await import("./backup-service");
        if (auto_backup_enabled) startAutoCron(); else stopAutoCron();
      }

      const r = await dbPool.query(`SELECT * FROM backup_settings WHERE id = 1`);
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // إحصاءات أحداث الطلبات (T4)
  app.get("/api/admin/backup/order-events", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(`
        SELECT id, order_id, event_type, created_at
        FROM order_events ORDER BY created_at DESC LIMIT 50
      `);
      const countRes = await dbPool.query(`SELECT COUNT(*) as total FROM order_events`);
      res.json({ events: r.rows, total: parseInt(countRes.rows[0]?.total || "0") });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── Admin Settings ──────────────────────────────────────────────
  app.get("/api/admin/settings", requireAdmin, async (_req, res) => {
    try {
      const { db: dbInstance } = await import("./db");
      const { settings } = await import("@shared/schema");
      const rows = await dbInstance.select().from(settings);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب الإعدادات", details: e.message });
    }
  });

  app.post("/api/admin/settings", requireAdmin, async (req, res) => {
    try {
      const { db: dbInstance } = await import("./db");
      const { settings } = await import("@shared/schema");
      const { key, value } = req.body;
      const [row] = await dbInstance
        .insert(settings)
        .values({ key, value })
        .onConflictDoUpdate({ target: settings.key, set: { value } })
        .returning();
      // 💱 عند تغيير سعر الصرف، أبطل الكاش حتى تنعكس الأسعار فوراً على كل المتجر
      if (key === "exchange_rate") {
        invalidateExchangeRateCache();
        getExchangeRate().catch(() => {});
      }
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ message: "فشل حفظ الإعداد", details: e.message });
    }
  });

  // ─── Cart (Protected) ─────────────────────────────────────────────────
  app.get("/api/cart", async (req, res) => {
    try {
      const user = (req as any).user;
      // Guests have no persistent cart in DB
      if (!user) return res.json([]);
      
      const { pool: dbPool } = await import("./db");
      const uid = getUserId(user);
      
      const result = await dbPool.query(
        `SELECT
           ci.id,
           ci.user_id          AS "userId",
           ci.product_id       AS "productId",
           ci.quantity,
           ci.selected_size    AS "selectedSize",
           ci.selected_color   AS "selectedColor",
           ci.selected_bag_color  AS "selectedBagColor",
           ci.print_color_count   AS "printColorCount",
           ci.print_color_1       AS "printColor1",
           ci.print_color_2       AS "printColor2",
           ci.print_color_3       AS "printColor3",
           ci.custom_printing     AS "customPrinting",
           ci.design_notes        AS "designNotes",
           ci.design_file_url     AS "designFileUrl",
           ci.unit_price          AS "unitPrice",
           ci.printing_category_id AS "printingCategoryId",
           ci.print_width         AS "printWidth",
           ci.print_height        AS "printHeight",
           ci.print_finish        AS "printFinish",
           ci.print_color_separation AS "printColorSeparation",
           ci.printing_unit_price AS "printingUnitPrice",
           ci.design_options      AS "designOptions",
           json_build_object(
             'id', p.id,
             'name', p.name,
             'price', p.price,
             'priceSar', p.price_sar,
             'imageUrl', CASE WHEN p.image_url LIKE 'data:%' THEN '/api/products/image/' || p.id || '?v=' || substr(md5(p.image_url), 1, 8) ELSE p.image_url END,
             'stock', p.stock,
             'categoryId', p.category_id,
             'sizes', p.sizes,
             'colors', p.colors,
             'sizePricing', p.size_pricing,
             'description', p.description
           ) AS product
         FROM cart_items ci
         LEFT JOIN products p ON p.id = ci.product_id
         WHERE ci.user_id = $1`,
        [uid]
      );
      // 💱 السعر السعودي ديناميكي على كل عناصر السلة
      const rate = getExchangeRateCached();
      const items = result.rows.map((row: any) => {
        if (row.product && row.product.price && rate > 0) {
          const yer = parseFloat(String(row.product.price));
          if (!isNaN(yer) && yer > 0) row.product.priceSar = (yer / rate).toFixed(2);
        }
        return row;
      });
      res.json(items);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب السلة", details: e.message });
    }
  });

  app.post("/api/cart", async (req, res) => {
    try {
      const user = (req as any).user;
      
      // For guests, just return success - cart is stored in localStorage
      if (!user) return res.status(201).json({ success: true, guest: true });
      
      const userId = getUserId(user);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      
      const { db: dbInstance } = await import("./db");
      const { cartItems: cartTable } = await import("@shared/schema");
      const { eq: eqFn } = await import("drizzle-orm");
      
      const {
        productId, quantity, selectedSize, selectedColor, customPrinting, designNotes, designFileUrl,
        // ── حقول طباعة الأكياس ──
        selectedBagColor, printColorCount, printColor1, printColor2, printColor3,
        // ── حقول الطباعة الاحترافية ──
        printingCategoryId, printWidth, printHeight, printFinish, printColorSeparation, printingUnitPrice,
        // ⚠️ unitPrice من العميل يُتجاهل — يُعاد حسابه على الخادم (إصلاح أمني)
        // ── رسوم التصميم من الموظف الذكي ──
        aiDesignFee,
        // ── Phase 4: خيارات الطباعة الفورية ──
        designOptions,
      } = req.body;

      // 🔒 إعادة حساب unitPrice على الخادم لمنع تلاعب العميل
      let serverUnitPrice: number | null = null;
      try {
        const computed = await computeServerUnitPrice(Number(productId), {
          quantity, selectedSize, selectedColor, selectedBagColor,
          customPrinting, designOptions, printingUnitPrice,
        });
        serverUnitPrice = computed.unitPrice;
      } catch (e: any) {
        return res.status(400).json({ message: "تعذّر التحقق من سعر المنتج", details: e.message });
      }

      // هل هذه طباعة مخصصة (لا نجمع الكميات مع عناصر أخرى)
      const hasPrinting = customPrinting || printColorCount > 0 || printingCategoryId || designOptions;
      
      // Check if item exists
      const existing = await dbInstance.select().from(cartTable)
        .where(eqFn(cartTable.userId, userId));
      
      const existingItem = existing.find(item =>
        item.productId === productId &&
        item.selectedSize === selectedSize &&
        item.selectedColor === selectedColor &&
        !item.customPrinting && !item.printColorCount && !item.printingCategoryId
      );
      
      if (existingItem && !hasPrinting) {
        // Update quantity — مع إعادة حساب unitPrice (لـ tier overlap)
        const newQty = existingItem.quantity + quantity;
        let mergedUnitPrice: number | null = serverUnitPrice;
        try {
          const recomputed = await computeServerUnitPrice(Number(productId), {
            quantity: newQty, selectedSize, selectedColor, selectedBagColor,
            customPrinting: existingItem.customPrinting, designOptions: existingItem.designOptions,
            printingUnitPrice: existingItem.printingUnitPrice,
          });
          mergedUnitPrice = recomputed.unitPrice;
        } catch { /* fallback to current serverUnitPrice */ }
        const [updated] = await dbInstance
          .update(cartTable)
          .set({ quantity: newQty, unitPrice: mergedUnitPrice != null ? String(mergedUnitPrice) : existingItem.unitPrice })
          .where(eqFn(cartTable.id, existingItem.id))
          .returning();
        return res.status(201).json(updated);
      }
      
      // Add new item
      const [newItem] = await dbInstance
        .insert(cartTable)
        .values({
          userId,
          productId,
          quantity,
          selectedSize: selectedSize || null,
          selectedColor: selectedColor || null,
          customPrinting: customPrinting || false,
          designNotes: designNotes || null,
          designFileUrl: designFileUrl || null,
          selectedBagColor: selectedBagColor || null,
          printColorCount: printColorCount || 0,
          printColor1: printColor1 || null,
          printColor2: printColor2 || null,
          printColor3: printColor3 || null,
          printingCategoryId: printingCategoryId || null,
          printWidth: printWidth || null,
          printHeight: printHeight || null,
          printFinish: printFinish || null,
          printColorSeparation: printColorSeparation || false,
          printingUnitPrice: printingUnitPrice || null,
          unitPrice: serverUnitPrice != null ? String(serverUnitPrice) : null,
          aiDesignFee: aiDesignFee || null,
          designOptions: designOptions
            ? (typeof designOptions === "string" ? designOptions : JSON.stringify(designOptions))
            : null,
        })
        .returning();
      
      res.status(201).json(newItem);
    } catch (e: any) {
      res.status(500).json({ message: "فشل إضافة للسلة", details: e.message });
    }
  });

  app.patch("/api/cart/:id", async (req, res) => {
    try {
      const user = (req as any).user;
      // Guests: just return success (handled by localStorage)
      if (!user) return res.json({ success: true, guest: true });
      
      const { db: dbInstance } = await import("./db");
      const { cartItems: cartTable } = await import("@shared/schema");
      const { eq: eqFn } = await import("drizzle-orm");
      
      const { quantity, designFileUrl } = req.body;
      const updateData: Record<string, any> = {};
      if (quantity !== undefined) updateData.quantity = quantity;
      if (designFileUrl !== undefined) updateData.designFileUrl = designFileUrl;

      // إعادة حساب unitPrice عند تغيير الكمية (لتحديث tier pricing)
      if (quantity !== undefined) {
        try {
          const cartId = parseInt(req.params.id);
          const existRows = await dbInstance.select().from(cartTable).where(eqFn(cartTable.id, cartId));
          const cur = existRows[0];
          if (cur) {
            const recomputed = await computeServerUnitPrice(Number(cur.productId), {
              quantity: Number(quantity), selectedSize: cur.selectedSize, selectedColor: cur.selectedColor,
              selectedBagColor: cur.selectedBagColor, customPrinting: cur.customPrinting,
              designOptions: cur.designOptions, printingUnitPrice: cur.printingUnitPrice,
            });
            updateData.unitPrice = String(recomputed.unitPrice);
          }
        } catch { /* keep old unitPrice on failure */ }
      }
      const [updated] = await dbInstance
        .update(cartTable)
        .set(updateData)
        .where(eqFn(cartTable.id, parseInt(req.params.id)))
        .returning();
      
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث السلة", details: e.message });
    }
  });

  app.delete("/api/cart/:id", async (req, res) => {
    try {
      const user = (req as any).user;
      // Guests: just return success (handled by localStorage)
      if (!user) return res.json({ message: "تم الحذف" });
      
      const { db: dbInstance } = await import("./db");
      const { cartItems: cartTable } = await import("@shared/schema");
      const { eq: eqFn } = await import("drizzle-orm");
      
      await dbInstance.delete(cartTable).where(eqFn(cartTable.id, parseInt(req.params.id)));
      res.json({ message: "تم الحذف" });
    } catch (e: any) {
      res.status(500).json({ message: "فشل حذف من السلة", details: e.message });
    }
  });

  // ─── User Profile & Addresses (Protected) ──────────────────────────────────
  app.get("/api/profile", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user || !getUserId(user)) return res.status(401).json({ message: "Not authenticated" });
      res.json({ user });
    } catch (e: any) {
      res.status(500).json({ message: "Failed to fetch profile", details: e.message });
    }
  });

  // ─── Wishlist (المفضلة) ─────────────────────────────────────────────────────
  app.get("/api/wishlist", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user || !getUserId(user)) return res.json([]);
      const userId = getUserId(user);
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(
        `SELECT w.id, w.product_id as "productId", w.created_at as "createdAt",
                p.name, p.image_url as "imageUrl", p.price, p.price_sar as "priceSar"
         FROM wishlist w
         JOIN products p ON p.id = w.product_id
         WHERE w.user_id = $1
         ORDER BY w.created_at DESC`,
        [userId]
      );
      res.json(r.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب المفضلة", details: e.message });
    }
  });

  app.post("/api/wishlist", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user || !getUserId(user)) return res.status(401).json({ message: "Not authenticated" });
      const userId = getUserId(user);
      const { productId } = req.body;
      if (!productId) return res.status(400).json({ message: "productId مطلوب" });
      const { pool: dbPool } = await import("./db");
      // تجنب التكرار
      const existing = await dbPool.query(
        `SELECT id FROM wishlist WHERE user_id=$1 AND product_id=$2`,
        [userId, productId]
      );
      if (existing.rows.length > 0) {
        return res.json({ id: existing.rows[0].id, productId, alreadyExists: true });
      }
      const r = await dbPool.query(
        `INSERT INTO wishlist (user_id, product_id) VALUES ($1, $2) RETURNING id`,
        [userId, productId]
      );
      res.status(201).json({ id: r.rows[0].id, productId });
    } catch (e: any) {
      res.status(500).json({ message: "فشل إضافة للمفضلة", details: e.message });
    }
  });

  app.delete("/api/wishlist/:productId", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user || !getUserId(user)) return res.status(401).json({ message: "Not authenticated" });
      const userId = getUserId(user);
      const { pool: dbPool } = await import("./db");
      await dbPool.query(
        `DELETE FROM wishlist WHERE user_id=$1 AND product_id=$2`,
        [userId, parseInt(req.params.productId)]
      );
      res.json({ message: "تم الإزالة" });
    } catch (e: any) {
      res.status(500).json({ message: "فشل إزالة من المفضلة", details: e.message });
    }
  });

  // ─── معلومات المسوق للمستخدم الحالي ────────────────────────────────────────
  app.get("/api/me/marketer-info", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user || !getUserId(user)) return res.json({ isMarketer: false });
      const { pool: dbPool } = await import("./db");
      // البحث بالهاتف المسجّل في حساب المستخدم
      const userPhone = (user as any).phone || (user as any).claims?.phone || null;
      if (!userPhone) return res.json({ isMarketer: false });
      const r = await dbPool.query(
        `SELECT m.id, m.name, m.phone, m.coupon_code as "couponCode",
                m.commission_rate as "commissionRate", m.discount_rate as "discountRate",
                m.wallet_balance as "walletBalance", m.total_earnings as "totalEarnings",
                m.total_orders as "totalOrders", m.is_active as "isActive",
                (SELECT COUNT(*) FROM orders o WHERE o.marketer_table_id=m.id AND o.marketer_commission_paid=false AND o.status IN ('delivered','completed')) as "pendingPayout"
         FROM standalone_marketers m
         WHERE m.phone=$1 AND m.is_active=true`,
        [userPhone.replace(/\D/g, "")]
      );
      if (!r.rows.length) return res.json({ isMarketer: false });
      res.json({ isMarketer: true, marketer: r.rows[0] });
    } catch (e: any) {
      res.json({ isMarketer: false });
    }
  });

  // ── معلومات المورد المرتبط بالحساب (بالهاتف) ─────────────────────────────
  app.get("/api/me/supplier-info", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user || !getUserId(user)) return res.json({ isSupplier: false });
      const { pool: dbPool } = await import("./db");
      const userPhone = (user as any).phone || (user as any).claims?.phone || null;
      if (!userPhone) return res.json({ isSupplier: false });
      const r = await dbPool.query(
        `SELECT id, name, phone, commission_rate as "commissionRate",
                balance_due as "balanceDue", total_paid as "totalPaid",
                total_sales as "totalSales", cities, is_active as "isActive",
                (SELECT COUNT(*) FROM orders o WHERE o.supplier_id=s.id) as "totalOrders"
         FROM suppliers s WHERE phone=$1 AND is_active=true`,
        [userPhone.replace(/\D/g, "")]
      );
      if (!r.rows.length) return res.json({ isSupplier: false });
      res.json({ isSupplier: true, supplier: r.rows[0] });
    } catch (e: any) {
      res.json({ isSupplier: false });
    }
  });

  // ── طلبات المسوق (جلسة عادية بالهاتف) ───────────────────────────────────
  app.get("/api/me/marketer/orders", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user || !getUserId(user)) return res.status(401).json({ message: "غير مصادق" });
      const { pool: dbPool } = await import("./db");
      const userPhone = (user as any).phone || (user as any).claims?.phone || null;
      if (!userPhone) return res.status(403).json({ message: "لا يوجد رقم هاتف مرتبط" });
      const mRes = await dbPool.query(
        "SELECT id FROM standalone_marketers WHERE phone=$1 AND is_active=true",
        [userPhone.replace(/\D/g, "")]
      );
      if (!mRes.rows.length) return res.status(403).json({ message: "لست مسوقاً نشطاً" });
      const marketerId = mRes.rows[0].id;
      const result = await dbPool.query(
        `SELECT id, customer_name, shipping_city, total, status, coupon_code,
                marketer_commission_amount as "commissionAmount",
                marketer_commission_paid as "commissionPaid", created_at as "createdAt"
         FROM orders WHERE marketer_table_id=$1 ORDER BY created_at DESC LIMIT 100`,
        [marketerId]
      );
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب الطلبات" });
    }
  });

  // ── محفظة المسوق (جلسة عادية بالهاتف) ───────────────────────────────────
  app.get("/api/me/marketer/wallet", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user || !getUserId(user)) return res.status(401).json({ message: "غير مصادق" });
      const { pool: dbPool } = await import("./db");
      const userPhone = (user as any).phone || (user as any).claims?.phone || null;
      if (!userPhone) return res.status(403).json({ message: "لا يوجد رقم هاتف" });
      const mRes = await dbPool.query(
        `SELECT id, wallet_balance as "walletBalance", total_earnings as "totalEarnings", total_orders as "totalOrders"
         FROM standalone_marketers WHERE phone=$1 AND is_active=true`,
        [userPhone.replace(/\D/g, "")]
      );
      if (!mRes.rows.length) return res.status(403).json({ message: "لست مسوقاً نشطاً" });
      const m = mRes.rows[0];
      const pendingRes = await dbPool.query(
        `SELECT COALESCE(SUM(marketer_commission_amount),0) as pending
         FROM orders WHERE marketer_table_id=$1 AND marketer_commission_paid=false AND status IN ('delivered','completed')`,
        [m.id]
      );
      const withdrawals = await dbPool.query(
        "SELECT id, amount, payment_method as \"paymentMethod\", status, requested_at as \"requestedAt\", admin_notes as \"adminNotes\" FROM marketer_withdrawal_requests WHERE marketer_id=$1 ORDER BY requested_at DESC LIMIT 20",
        [m.id]
      );
      res.json({
        walletBalance: Number(m.walletBalance),
        totalEarnings: Number(m.totalEarnings),
        totalOrders: Number(m.totalOrders),
        pendingPayout: Number(pendingRes.rows[0].pending),
        withdrawals: withdrawals.rows,
        marketerId: m.id,
      });
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب المحفظة" });
    }
  });

  // ── طلب سحب رصيد (جلسة عادية) ────────────────────────────────────────────
  app.post("/api/me/marketer/withdraw", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user || !getUserId(user)) return res.status(401).json({ message: "غير مصادق" });
      const { pool: dbPool } = await import("./db");
      const userPhone = (user as any).phone || (user as any).claims?.phone || null;
      if (!userPhone) return res.status(403).json({ message: "لا يوجد رقم هاتف" });
      const mRes = await dbPool.query(
        "SELECT id, wallet_balance FROM standalone_marketers WHERE phone=$1 AND is_active=true",
        [userPhone.replace(/\D/g, "")]
      );
      if (!mRes.rows.length) return res.status(403).json({ message: "لست مسوقاً" });
      const m = mRes.rows[0];
      const { amount, paymentMethod, paymentDetails } = req.body;
      if (!amount || Number(amount) <= 0) return res.status(400).json({ message: "المبلغ غير صالح" });
      if (Number(amount) > Number(m.wallet_balance)) return res.status(400).json({ message: "الرصيد غير كافٍ" });
      const pending = await dbPool.query(
        "SELECT id FROM marketer_withdrawal_requests WHERE marketer_id=$1 AND status='pending'", [m.id]
      );
      if (pending.rows.length) return res.status(409).json({ message: "يوجد طلب سحب معلّق بالفعل" });
      await dbPool.query(
        "INSERT INTO marketer_withdrawal_requests (marketer_id, amount, payment_method, payment_details) VALUES ($1,$2,$3,$4)",
        [m.id, Number(amount), paymentMethod || "bank", paymentDetails || null]
      );
      res.json({ success: true, message: "تم إرسال طلب السحب بنجاح" });
    } catch (e: any) {
      res.status(500).json({ message: "فشل إرسال طلب السحب" });
    }
  });

  app.get("/api/addresses", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user || !getUserId(user)) return res.status(401).json({ message: "Not authenticated" });

      const { db: dbInstance } = await import("./db");
      const { userAddresses: addressTable } = await import("@shared/schema");
      const { eq: eqFn } = await import("drizzle-orm");

      const addresses = await dbInstance
        .select()
        .from(addressTable)
        .where(eqFn(addressTable.userId, getUserId(user) as string));

      res.json(addresses);
    } catch (e: any) {
      res.status(500).json({ message: "Failed to fetch addresses", details: e.message });
    }
  });

  app.post("/api/addresses", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user || !getUserId(user)) return res.status(401).json({ message: "Not authenticated" });

      const { name, city, address, phone, isDefault } = req.body;
      if (!name || !city || !address || !phone) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // تنظيف الحقول النصية وتحديد طول معقول لمنع البيانات المسيئة
      const trim = (v: any, max: number) =>
        typeof v === "string" ? v.trim().slice(0, max) : "";
      const cleanName    = trim(name, 60);
      const cleanCity    = trim(city, 60);
      const cleanAddress = trim(address, 500);
      const cleanPhone   = trim(phone, 25);
      if (!cleanName || !cleanCity || !cleanAddress || !cleanPhone) {
        return res.status(400).json({ message: "Invalid field values" });
      }

      const { db: dbInstance } = await import("./db");
      const { userAddresses: addressTable } = await import("@shared/schema");
      const { eq: eqFn } = await import("drizzle-orm");

      const uid = getUserId(user) as string;
      if (isDefault) {
        await dbInstance.update(addressTable).set({ isDefault: false }).where(eqFn(addressTable.userId, uid));
      }

      const [newAddress] = await dbInstance
        .insert(addressTable)
        .values({
          userId: uid,
          name: cleanName,
          city: cleanCity,
          address: cleanAddress,
          phone: cleanPhone,
          isDefault: !!isDefault,
        })
        .returning();

      res.status(201).json(newAddress);
    } catch (e: any) {
      res.status(500).json({ message: "Failed to add address", details: e.message });
    }
  });

  app.post("/api/checkout/save-address", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user || !getUserId(user)) return res.status(401).json({ message: "Not authenticated" });

      const { name, city, address, phone, isDefault = true } = req.body;
      if (!name || !city || !address || !phone) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const { db: dbInstance } = await import("./db");
      const { userAddresses: addressTable } = await import("@shared/schema");
      const { eq: eqFn } = await import("drizzle-orm");

      const uid = getUserId(user) as string;
      if (isDefault) {
        await dbInstance.update(addressTable).set({ isDefault: false }).where(eqFn(addressTable.userId, uid));
      }

      const existing = await dbInstance
        .select()
        .from(addressTable)
        .where(eqFn(addressTable.userId, uid));

      const match = existing.find((row) =>
        row.phone === phone &&
        row.city === city &&
        row.address === address &&
        row.name === name
      );

      if (match) {
        const [updated] = await dbInstance
          .update(addressTable)
          .set({ isDefault: !!isDefault, updatedAt: new Date() })
          .where(eqFn(addressTable.id, match.id))
          .returning();
        return res.json(updated);
      }

      const [newAddress] = await dbInstance
        .insert(addressTable)
        .values({ userId: uid, name, city, address, phone, isDefault: !!isDefault })
        .returning();

      res.status(201).json(newAddress);
    } catch (e: any) {
      res.status(500).json({ message: "Failed to save checkout address", details: e.message });
    }
  });

  app.patch("/api/addresses/:id", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user || !getUserId(user)) return res.status(401).json({ message: "Not authenticated" });

      const { db: dbInstance } = await import("./db");
      const { userAddresses: addressTable } = await import("@shared/schema");
      const { eq: eqFn, and: andFn } = await import("drizzle-orm");

      const addressId = parseInt(req.params.id);
      if (isNaN(addressId)) return res.status(400).json({ message: "Invalid address id" });

      const uid = getUserId(user) as string;

      // التحقق من الملكية أولاً قبل أي تعديل
      const existing = await dbInstance
        .select()
        .from(addressTable)
        .where(andFn(eqFn(addressTable.id, addressId), eqFn(addressTable.userId, uid)))
        .limit(1);
      if (existing.length === 0) {
        return res.status(404).json({ message: "Address not found" });
      }

      const { name, city, address, phone, isDefault } = req.body;

      // تنظيف وقصر الحقول النصية لمنع البيانات المسيئة
      const sanitize = (v: any, max: number) =>
        typeof v === "string" ? v.trim().slice(0, max) : v;

      const updateSet: any = { updatedAt: new Date() };
      if (name !== undefined)    updateSet.name = sanitize(name, 60);
      if (city !== undefined)    updateSet.city = sanitize(city, 60);
      if (address !== undefined) updateSet.address = sanitize(address, 500);
      if (phone !== undefined)   updateSet.phone = sanitize(phone, 25);
      if (isDefault !== undefined) updateSet.isDefault = !!isDefault;

      if (isDefault) {
        await dbInstance.update(addressTable).set({ isDefault: false }).where(eqFn(addressTable.userId, uid));
      }

      const [updated] = await dbInstance
        .update(addressTable)
        .set(updateSet)
        .where(andFn(eqFn(addressTable.id, addressId), eqFn(addressTable.userId, uid)))
        .returning();

      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: "Failed to update address", details: e.message });
    }
  });

  app.delete("/api/addresses/:id", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user || !getUserId(user)) return res.status(401).json({ message: "Not authenticated" });

      const { db: dbInstance } = await import("./db");
      const { userAddresses: addressTable } = await import("@shared/schema");
      const { eq: eqFn, and: andFn } = await import("drizzle-orm");

      const addressId = parseInt(req.params.id);
      if (isNaN(addressId)) return res.status(400).json({ message: "Invalid address id" });

      const uid = getUserId(user) as string;

      // التحقق من الملكية ومعرفة هل هذا هو الافتراضي
      const existing = await dbInstance
        .select()
        .from(addressTable)
        .where(andFn(eqFn(addressTable.id, addressId), eqFn(addressTable.userId, uid)))
        .limit(1);
      if (existing.length === 0) {
        return res.status(404).json({ message: "Address not found" });
      }

      const deleted = await dbInstance
        .delete(addressTable)
        .where(andFn(eqFn(addressTable.id, addressId), eqFn(addressTable.userId, uid)))
        .returning();

      // إذا كان المحذوف هو العنوان الافتراضي، نُعيّن أقدم عنوان متبقٍ كعنوان افتراضي تلقائياً
      if (existing[0].isDefault) {
        const remaining = await dbInstance
          .select()
          .from(addressTable)
          .where(eqFn(addressTable.userId, uid))
          .orderBy(addressTable.id)
          .limit(1);
        if (remaining.length > 0) {
          await dbInstance
            .update(addressTable)
            .set({ isDefault: true, updatedAt: new Date() })
            .where(eqFn(addressTable.id, remaining[0].id));
        }
      }

      res.json({ success: true, deletedCount: deleted.length });
    } catch (e: any) {
      res.status(500).json({ message: "Failed to delete address", details: e.message });
    }
  });

  // ─── Logo & Splash Settings (Public read, Admin write) ──────────────────────
  app.get("/api/logo-settings", async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query("SELECT * FROM logo_settings ORDER BY id DESC LIMIT 1");
      if (result.rows.length === 0) {
        return res.json({
          logoUrl: null,
          splashBgUrl: null,
          splashBgColor: "#ffffff",
          splashText: "أويو بلاست",
          splashTextColor: "#2196F3",
          showSplash: true,
        });
      }
      const row = result.rows[0];
      res.json({
        id: row.id,
        logoUrl: row.logo_url,
        splashBgUrl: row.splash_bg_url,
        splashBgColor: row.splash_bg_color,
        splashText: row.splash_text,
        splashTextColor: row.splash_text_color,
        showSplash: row.show_splash,
      });
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب إعدادات الشعار", details: e.message });
    }
  });

  app.patch("/api/admin/logo-settings", requireAdmin, upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "splashBg", maxCount: 1 },
  ]), async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

      // Check existing record
      const existing = await dbPool.query("SELECT id FROM logo_settings ORDER BY id DESC LIMIT 1");

      let logoUrl: string | undefined;
      let splashBgUrl: string | undefined;

      if (files?.logo?.[0]) {
        logoUrl = `data:${files.logo[0].mimetype};base64,${files.logo[0].buffer.toString("base64")}`;
      } else if (req.body.logoUrl !== undefined) {
        logoUrl = req.body.logoUrl;
      }

      if (files?.splashBg?.[0]) {
        splashBgUrl = `data:${files.splashBg[0].mimetype};base64,${files.splashBg[0].buffer.toString("base64")}`;
      } else if (req.body.splashBgUrl !== undefined) {
        splashBgUrl = req.body.splashBgUrl;
      }

      const { splashBgColor, splashText, splashTextColor, showSplash } = req.body;

      let result;
      if (existing.rows.length > 0) {
        const id = existing.rows[0].id;
        const setClauses: string[] = [];
        const values: any[] = [];
        let idx = 1;

        if (logoUrl !== undefined) { setClauses.push(`logo_url = $${idx++}`); values.push(logoUrl); }
        if (splashBgUrl !== undefined) { setClauses.push(`splash_bg_url = $${idx++}`); values.push(splashBgUrl); }
        if (splashBgColor) { setClauses.push(`splash_bg_color = $${idx++}`); values.push(splashBgColor); }
        if (splashText !== undefined) { setClauses.push(`splash_text = $${idx++}`); values.push(splashText); }
        if (splashTextColor) { setClauses.push(`splash_text_color = $${idx++}`); values.push(splashTextColor); }
        if (showSplash !== undefined) { setClauses.push(`show_splash = $${idx++}`); values.push(showSplash === "true" || showSplash === true); }
        setClauses.push(`updated_at = NOW()`);

        if (setClauses.length > 1) {
          values.push(id);
          result = await dbPool.query(
            `UPDATE logo_settings SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
            values
          );
        } else {
          result = await dbPool.query("SELECT * FROM logo_settings WHERE id = $1", [id]);
        }
      } else {
        result = await dbPool.query(
          `INSERT INTO logo_settings (logo_url, splash_bg_url, splash_bg_color, splash_text, splash_text_color, show_splash)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [
            logoUrl || null,
            splashBgUrl || null,
            splashBgColor || "#ffffff",
            splashText || "أويو بلاست",
            splashTextColor || "#2196F3",
            showSplash !== undefined ? (showSplash === "true" || showSplash === true) : true,
          ]
        );
      }

      const row = result.rows[0];
      res.json({
        id: row.id,
        logoUrl: row.logo_url,
        splashBgUrl: row.splash_bg_url,
        splashBgColor: row.splash_bg_color,
        splashText: row.splash_text,
        splashTextColor: row.splash_text_color,
        showSplash: row.show_splash,
      });
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث إعدادات الشعار", details: e.message });
    }
  });

  // ─── Offline Sync: receive pending orders ──────────────────────
  app.post("/api/sync/orders", async (req, res) => {
    try {
      const { orders: pendingOrders } = req.body;
      if (!Array.isArray(pendingOrders) || pendingOrders.length === 0) {
        return res.json({ synced: 0 });
      }

      const results = [];
      const syncUserId = getUserId((req as any).user);
      for (const orderData of pendingOrders) {
        try {
          // اربط الطلب بالمستخدم الحالي إن كان مسجَّلاً (للأوفلاين sync)
          const order = await storage.createOrder({ ...orderData, userId: orderData.userId || syncUserId });
          results.push({ success: true, id: order.id, localId: orderData.localId });
        } catch (err: any) {
          results.push({ success: false, localId: orderData.localId, error: err.message });
        }
      }

      res.json({ synced: results.filter(r => r.success).length, results });
    } catch (e: any) {
      res.status(500).json({ message: "فشل مزامنة الطلبات", details: e.message });
    }
  });

  // ─── Image Dimensions (Public read, Admin write) ────────────────────
  app.get("/api/image-dimensions", async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        "SELECT id, image_type as imageType, width, height, description FROM image_dimensions ORDER BY id ASC"
      );
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب مقاسات الصور", details: e.message });
    }
  });

  app.patch("/api/admin/image-dimensions/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { width, height, description } = req.body;

      if (!width || !height || width <= 0 || height <= 0) {
        return res.status(400).json({ message: "المقاسات يجب أن تكون أكبر من صفر" });
      }

      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        "UPDATE image_dimensions SET width = $1, height = $2, description = $3, updated_at = NOW() WHERE id = $4 RETURNING id, image_type as imageType, width, height, description",
        [width, height, description || null, parseInt(id)]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "المقاس غير موجود" });
      }
      res.json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث المقاس", details: e.message });
    }
  });

  // ─── Digital Wallets (Public read, Admin write) ────────────────────
  // Public: only active wallets
  app.get("/api/digital-wallets", async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        `SELECT id, name, logo_url as "logoUrl", receiver_name as "receiverName", phone_number as "phoneNumber", purchase_code as "purchaseCode", is_active as "isActive", sort_order as "sortOrder", requires_proof as "requiresProof", instructions FROM digital_wallets WHERE is_active = true ORDER BY sort_order ASC, id ASC`
      );
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب المحافظ", details: e.message });
    }
  });

  // Admin: ALL wallets (including inactive) for management
  app.get("/api/admin/digital-wallets", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        `SELECT id, name, logo_url as "logoUrl", receiver_name as "receiverName", phone_number as "phoneNumber", purchase_code as "purchaseCode", is_active as "isActive", sort_order as "sortOrder", requires_proof as "requiresProof", instructions FROM digital_wallets ORDER BY sort_order ASC, id ASC`
      );
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب المحافظ", details: e.message });
    }
  });

  app.post("/api/admin/digital-wallets", requireAdmin, upload.single("logo"), async (req, res) => {
    try {
      const { name, receiverName, phoneNumber, purchaseCode, isActive, sortOrder, requiresProof, instructions } = req.body;
      if (!name || !receiverName || !phoneNumber) {
        return res.status(400).json({ message: "الاسم ورقم الحساب واسم المستلم مطلوبة" });
      }

      let logoUrl: string | null = null;
      if (req.file) {
        logoUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      }

      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        `INSERT INTO digital_wallets (name, logo_url, receiver_name, phone_number, purchase_code, is_active, sort_order, requires_proof, instructions)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, name, logo_url as "logoUrl", receiver_name as "receiverName", phone_number as "phoneNumber", purchase_code as "purchaseCode", is_active as "isActive", sort_order as "sortOrder", requires_proof as "requiresProof", instructions`,
        [name, logoUrl, receiverName, phoneNumber, purchaseCode || "", isActive !== "false", parseInt(sortOrder) || 0, requiresProof !== "false", instructions || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل إنشاء المحفظة", details: e.message });
    }
  });

  app.patch("/api/admin/digital-wallets/:id", requireAdmin, upload.single("logo"), async (req, res) => {
    try {
      const { id } = req.params;
      const { name, receiverName, phoneNumber, purchaseCode, isActive, sortOrder, requiresProof, instructions } = req.body;

      const { pool: dbPool } = await import("./db");
      const setClauses: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (name !== undefined) { setClauses.push(`name = $${idx++}`); values.push(name); }
      if (receiverName !== undefined) { setClauses.push(`receiver_name = $${idx++}`); values.push(receiverName); }
      if (phoneNumber !== undefined) { setClauses.push(`phone_number = $${idx++}`); values.push(phoneNumber); }
      if (purchaseCode !== undefined) { setClauses.push(`purchase_code = $${idx++}`); values.push(purchaseCode); }
      if (isActive !== undefined) { setClauses.push(`is_active = $${idx++}`); values.push(isActive !== "false" && isActive !== false); }
      if (sortOrder !== undefined) { setClauses.push(`sort_order = $${idx++}`); values.push(parseInt(sortOrder)); }
      if (requiresProof !== undefined) { setClauses.push(`requires_proof = $${idx++}`); values.push(requiresProof !== "false" && requiresProof !== false); }
      if (instructions !== undefined) { setClauses.push(`instructions = $${idx++}`); values.push(instructions || null); }
      if (req.file) {
        const logoUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
        setClauses.push(`logo_url = $${idx++}`);
        values.push(logoUrl);
      }
      setClauses.push(`updated_at = NOW()`);

      if (setClauses.length <= 1) {
        return res.status(400).json({ message: "لا توجد تحديثات" });
      }

      values.push(parseInt(id));
      const result = await dbPool.query(
        `UPDATE digital_wallets SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING id, name, logo_url as "logoUrl", receiver_name as "receiverName", phone_number as "phoneNumber", purchase_code as "purchaseCode", is_active as "isActive", sort_order as "sortOrder", requires_proof as "requiresProof", instructions`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "المحفظة غير موجودة" });
      }
      res.json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث المحفظة", details: e.message });
    }
  });

  app.delete("/api/admin/digital-wallets/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { pool: dbPool } = await import("./db");
      await dbPool.query("DELETE FROM digital_wallets WHERE id = $1", [parseInt(id)]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: "فشل حذف المحفظة", details: e.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════
  // ─── Bank Accounts (حسابات بنكية للتحويل) ─────────────────────────
  // ══════════════════════════════════════════════════════════════════

  app.get("/api/bank-accounts", async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        `SELECT id, bank_name as "bankName", account_name as "accountName", account_number as "accountNumber", iban, branch, logo_url as "logoUrl", instructions, is_active as "isActive", sort_order as "sortOrder" FROM bank_accounts WHERE is_active = true ORDER BY sort_order ASC, id ASC`
      );
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب الحسابات البنكية", details: e.message });
    }
  });

  app.get("/api/admin/bank-accounts", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        `SELECT id, bank_name as "bankName", account_name as "accountName", account_number as "accountNumber", iban, branch, logo_url as "logoUrl", instructions, is_active as "isActive", sort_order as "sortOrder" FROM bank_accounts ORDER BY sort_order ASC, id ASC`
      );
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب الحسابات البنكية", details: e.message });
    }
  });

  app.post("/api/admin/bank-accounts", requireAdmin, upload.single("logo"), async (req, res) => {
    try {
      const { bankName, accountName, accountNumber, iban, branch, instructions, isActive, sortOrder } = req.body;
      if (!bankName || !accountName || !accountNumber) {
        return res.status(400).json({ message: "اسم البنك واسم الحساب ورقم الحساب مطلوبة" });
      }
      let logoUrl = "";
      if (req.file) {
        logoUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      }
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        `INSERT INTO bank_accounts (bank_name, account_name, account_number, iban, branch, logo_url, instructions, is_active, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, bank_name as "bankName", account_name as "accountName", account_number as "accountNumber", iban, branch, logo_url as "logoUrl", instructions, is_active as "isActive", sort_order as "sortOrder"`,
        [bankName, accountName, accountNumber, iban || null, branch || null, logoUrl, instructions || null, isActive !== "false", parseInt(sortOrder) || 0]
      );
      res.status(201).json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل إضافة الحساب البنكي", details: e.message });
    }
  });

  app.patch("/api/admin/bank-accounts/:id", requireAdmin, upload.single("logo"), async (req, res) => {
    try {
      const { id } = req.params;
      const { bankName, accountName, accountNumber, iban, branch, instructions, isActive, sortOrder } = req.body;
      const { pool: dbPool } = await import("./db");
      const setClauses: string[] = [];
      const values: any[] = [];
      let idx = 1;
      if (bankName !== undefined) { setClauses.push(`bank_name = $${idx++}`); values.push(bankName); }
      if (accountName !== undefined) { setClauses.push(`account_name = $${idx++}`); values.push(accountName); }
      if (accountNumber !== undefined) { setClauses.push(`account_number = $${idx++}`); values.push(accountNumber); }
      if (iban !== undefined) { setClauses.push(`iban = $${idx++}`); values.push(iban || null); }
      if (branch !== undefined) { setClauses.push(`branch = $${idx++}`); values.push(branch || null); }
      if (instructions !== undefined) { setClauses.push(`instructions = $${idx++}`); values.push(instructions || null); }
      if (isActive !== undefined) { setClauses.push(`is_active = $${idx++}`); values.push(isActive !== "false" && isActive !== false); }
      if (sortOrder !== undefined) { setClauses.push(`sort_order = $${idx++}`); values.push(parseInt(sortOrder) || 0); }
      if (req.file) {
        setClauses.push(`logo_url = $${idx++}`);
        values.push(`data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`);
      }
      if (!setClauses.length) return res.status(400).json({ message: "لا توجد تحديثات" });
      values.push(parseInt(id));
      const result = await dbPool.query(
        `UPDATE bank_accounts SET ${setClauses.join(", ")} WHERE id = $${idx}
         RETURNING id, bank_name as "bankName", account_name as "accountName", account_number as "accountNumber", iban, branch, logo_url as "logoUrl", instructions, is_active as "isActive", sort_order as "sortOrder"`,
        values
      );
      if (!result.rows[0]) return res.status(404).json({ message: "الحساب غير موجود" });
      res.json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث الحساب البنكي", details: e.message });
    }
  });

  app.delete("/api/admin/bank-accounts/:id", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      await dbPool.query("DELETE FROM bank_accounts WHERE id = $1", [parseInt(req.params.id)]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: "فشل حذف الحساب البنكي", details: e.message });
    }
  });

  // ─── Products with Pagination support ───────────────────────────
  app.get("/api/products/paginated", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
      const search = req.query.search as string | undefined;
      const offset = (page - 1) * limit;

      const { pool: dbPool } = await import("./db");

      let countQuery = "SELECT COUNT(*) FROM products";
      let dataQuery = "SELECT * FROM products";
      const params: any[] = [];
      const conditions: string[] = [];
      let idx = 1;

      if (categoryId) {
        conditions.push(`category_id = $${idx++}`);
        params.push(categoryId);
      }
      if (search) {
        conditions.push(`(name ILIKE $${idx} OR description ILIKE $${idx})`);
        params.push(`%${search}%`);
        idx++;
      }

      if (conditions.length > 0) {
        const where = ` WHERE ${conditions.join(" AND ")}`;
        countQuery += where;
        dataQuery += where;
      }

      const countResult = await dbPool.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count);

      dataQuery += ` ORDER BY id DESC LIMIT $${idx} OFFSET $${idx + 1}`;
      params.push(limit, offset);

      const dataResult = await dbPool.query(dataQuery, params);

      res.json({
        products: dataResult.rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      });
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب المنتجات", details: e.message });
    }
  });

  // ── عرض رموز OTP النشطة (للإدارة يدوياً عند فشل البوابة) ────────
  app.get("/api/admin/active-otps", requireAdmin, async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(
        `SELECT phone, code, expires_at, created_at, attempts
         FROM phone_verifications
         WHERE verified = false AND expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 50`
      );
      res.json({ otps: result.rows });
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب الرموز", details: e.message });
    }
  });

  // ── سجلات الأمان ─────────────────────────────────────────────────
  app.get("/api/admin/security-logs", requireAdmin, getSecurityLogs);

  // ── تشخيص Twilio SMS ────────────────────────────────────────────
  app.post("/api/admin/test-sms", requireAdmin, async (req, res) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;
    const ultraInstance = process.env.ULTRAMSG_INSTANCE_ID;
    const ultraToken = process.env.ULTRAMSG_TOKEN;

    const configured = !!(accountSid && authToken && fromNumber);

    const report: any = {
      timestamp: new Date().toISOString(),
      config: {
        twilio: {
          configured,
          accountSid: accountSid ? accountSid.substring(0, 6) + "***" : "غير محدد",
          fromNumber: fromNumber || "غير محدد",
        },
        ultraMsg: {
          configured: !!(ultraInstance && ultraToken),
          instance: ultraInstance ? ultraInstance.substring(0, 4) + "***" : "غير محدد",
        },
      },
      tests: {} as any,
    };

    if (!configured) {
      report.tests.twilio = {
        ok: false,
        note: "TWILIO_ACCOUNT_SID أو TWILIO_AUTH_TOKEN أو TWILIO_FROM_NUMBER غير محددة في Secrets",
      };
      return res.json(report);
    }

    // اختبار إرسال فعلي عبر Twilio
    const testPhone: string = req.body?.testPhone || "+967700000000";
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    try {
      const twilioRes = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${credentials}`,
        },
        body: new URLSearchParams({
          To: testPhone,
          From: fromNumber!,
          Body: "اويو بلاست: اختبار Twilio — رسالة تجريبية",
        }),
        signal: AbortSignal.timeout(10000),
      });

      const data = await twilioRes.json();
      report.tests.twilio = {
        ok: twilioRes.ok && !!data.sid,
        status: twilioRes.status,
        sid: data.sid || null,
        diagnosis: twilioRes.ok && data.sid
          ? `✅ تم الإرسال بنجاح — SID: ${data.sid}`
          : `خطأ ${twilioRes.status}: ${data.message || data.code || "غير معروف"}`,
      };
    } catch (e: any) {
      report.tests.twilio = { ok: false, error: e.message };
    }

    res.json(report);
  });

  // ════════════════════════════════════════════════════════════════════
  // ─── STAFF MANAGEMENT (Admin Only) ───────────────────────────────
  // ════════════════════════════════════════════════════════════════════

  // ─── List all staff ───────────────────────────────────────────────
  app.get("/api/admin/staff", requireAdmin, async (_req, res) => {
    try {
      const { db: dbI } = await import("./db");
      const { users: usersT } = await import("@shared/schema");
      const { ne, and } = await import("drizzle-orm");
      const staff = await dbI.select({
        id: usersT.id,
        email: usersT.email,
        fullName: usersT.fullName,
        phone: usersT.phone,
        role: usersT.role,
        permissions: usersT.permissions,
        createdAt: usersT.createdAt,
      }).from(usersT)
        .where(and(
          ne(usersT.role, "customer"),
          ne(usersT.role, "marketer"),
        ));
      res.json(staff);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب قائمة الموظفين", error: e.message });
    }
  });

  // ─── Create staff account ─────────────────────────────────────────
  app.post("/api/admin/staff", requireAdmin, async (req, res) => {
    try {
      const { email, password, fullName, phone, role, title, permissions } = req.body;
      if (!email || !password || !role) {
        return res.status(400).json({ message: "البريد الإلكتروني وكلمة المرور والدور مطلوبة" });
      }
      const validRoles = ["product_manager", "order_manager", "delivery", "finance", "owner"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: "الدور غير صالح" });
      }
      const { hashPassword } = await import("./auth-utils");
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const existing = await authStorage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "البريد الإلكتروني مستخدم بالفعل" });
      }
      const passwordHash = hashPassword(password);
      const { db: dbI } = await import("./db");
      const { users: usersT } = await import("@shared/schema");
      const [user] = await dbI.insert(usersT).values({
        email,
        passwordHash,
        fullName: fullName || null,
        phone: phone || null,
        role,
        accountType: "staff",
        authProvider: "email",
        isEmailVerified: "true",
        permissions: permissions || null,
      }).returning();
      // Also insert into team_members
      const { pool: dbPool2 } = await import("./db");
      await dbPool2.query(
        `INSERT INTO team_members (user_id, role, title, is_active, permissions) VALUES ($1, $2, $3, true, $4)
         ON CONFLICT (user_id) DO UPDATE SET role=$2, title=$3, permissions=$4`,
        [user.id, role, title || null, permissions ? JSON.stringify(permissions) : null]
      );
      res.status(201).json({ id: user.id, email: user.email, fullName: user.fullName, role: user.role });
    } catch (e: any) {
      res.status(500).json({ message: "فشل إنشاء حساب الموظف", error: e.message });
    }
  });

  // ─── Update staff ─────────────────────────────────────────────────
  app.put("/api/admin/staff/:id", requireAdmin, async (req, res) => {
    try {
      const { db: dbI } = await import("./db");
      const { users: usersT } = await import("@shared/schema");
      const { eq: eqFn } = await import("drizzle-orm");
      const { fullName, phone, role, title, permissions, password, isActive } = req.body;
      const updates: Record<string, any> = {};
      if (fullName !== undefined) updates.fullName = fullName;
      if (phone !== undefined) updates.phone = phone;
      if (role !== undefined) updates.role = role;
      if (permissions !== undefined) updates.permissions = permissions;
      if (password) {
        const { hashPassword } = await import("./auth-utils");
        updates.passwordHash = hashPassword(password);
      }
      const [updated] = await dbI.update(usersT).set(updates).where(eqFn(usersT.id, req.params.id)).returning();
      if (!updated) return res.status(404).json({ message: "الموظف غير موجود" });
      // Update team_members table
      if (role !== undefined || title !== undefined || isActive !== undefined || permissions !== undefined) {
        const { pool: dbPool3 } = await import("./db");
        await dbPool3.query(
          `UPDATE team_members SET role=COALESCE($2,role), title=COALESCE($3,title), is_active=COALESCE($4,is_active), permissions=COALESCE($5,permissions) WHERE user_id=$1`,
          [req.params.id, role || null, title || null, isActive !== undefined ? isActive : null, permissions ? JSON.stringify(permissions) : null]
        );
      }
      res.json({ id: updated.id, email: updated.email, fullName: updated.fullName, role: updated.role });
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث بيانات الموظف", error: e.message });
    }
  });

  // ─── Delete / Deactivate staff ────────────────────────────────────
  app.delete("/api/admin/staff/:id", requireAdmin, async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const staffId = req.params.id;
      // Set role to 'customer' to deactivate (not delete — keeps order history)
      await dbPool.query(`UPDATE users SET role='customer', account_type='customer' WHERE id=$1`, [staffId]);
      await dbPool.query(`UPDATE team_members SET is_active=false WHERE user_id=$1`, [staffId]);
      res.json({ message: "تم إلغاء تفعيل الحساب" });
    } catch (e: any) {
      res.status(500).json({ message: "فشل حذف الموظف", error: e.message });
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // ─── STAFF PORTAL ROUTES (Authenticated Staff Users) ─────────────
  // ════════════════════════════════════════════════════════════════════

  // Middleware to check staff role
  function requireStaff(allowedRoles: string[]) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ message: "يجب تسجيل الدخول" });
      const userId = user.claims?.sub;
      if (!userId) return res.status(401).json({ message: "جلسة غير صالحة" });
      try {
        const { db: dbI } = await import("./db");
        const { users: usersT } = await import("@shared/schema");
        const { eq: eqFn } = await import("drizzle-orm");
        const [dbUser] = await dbI.select({ role: usersT.role, permissions: usersT.permissions }).from(usersT).where(eqFn(usersT.id, userId));
        if (!dbUser) return res.status(401).json({ message: "مستخدم غير موجود" });
        const staffRoles = ["product_manager", "order_manager", "delivery", "finance", "owner"];
        if (!staffRoles.includes(dbUser.role || "")) return res.status(403).json({ message: "غير مصرح لك بالدخول" });
        if (allowedRoles.length > 0 && !allowedRoles.includes(dbUser.role || "")) {
          return res.status(403).json({ message: "ليس لديك صلاحية لهذه العملية" });
        }
        (req as any).staffRole = dbUser.role;
        (req as any).staffPermissions = dbUser.permissions;
        next();
      } catch (e: any) {
        res.status(500).json({ message: "خطأ في التحقق من الصلاحيات" });
      }
    };
  }

  // ─── Staff: Get my info ────────────────────────────────────────────
  app.get("/api/staff/me", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ message: "يجب تسجيل الدخول" });
      const userId = user.claims?.sub;
      const { db: dbI } = await import("./db");
      const { users: usersT } = await import("@shared/schema");
      const { eq: eqFn } = await import("drizzle-orm");
      const [dbUser] = await dbI.select({
        id: usersT.id, email: usersT.email, fullName: usersT.fullName,
        phone: usersT.phone, role: usersT.role, permissions: usersT.permissions,
      }).from(usersT).where(eqFn(usersT.id, userId));
      if (!dbUser) return res.status(404).json({ message: "مستخدم غير موجود" });
      const staffRoles = ["product_manager", "order_manager", "delivery", "finance", "owner"];
      if (!staffRoles.includes(dbUser.role || "")) return res.status(403).json({ message: "غير مصرح" });
      res.json(dbUser);
    } catch (e: any) {
      res.status(500).json({ message: "خطأ في جلب البيانات" });
    }
  });

  // ─── Staff: Get orders (filtered by role) ─────────────────────────
  app.get("/api/staff/orders", requireStaff([]), async (req, res) => {
    try {
      const role = (req as any).staffRole;
      const userId = (req as any).user?.claims?.sub;
      const { pool: dbPool } = await import("./db");
      let query = "";
      let params: any[] = [];
      if (role === "delivery") {
        query = `SELECT o.*, 
          (SELECT json_agg(oi.*) FROM order_items oi WHERE oi.order_id = o.id) as items
          FROM orders o WHERE o.assigned_to=$1 ORDER BY o.created_at DESC LIMIT 200`;
        params = [userId];
      } else {
        query = `SELECT o.*,
          (SELECT json_agg(oi.*) FROM order_items oi WHERE oi.order_id = o.id) as items
          FROM orders o ORDER BY o.created_at DESC LIMIT 500`;
      }
      const result = await dbPool.query(query, params);
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب الطلبات", error: e.message });
    }
  });

  // ─── Staff: Update order status ───────────────────────────────────
  app.put("/api/staff/orders/:id/status", requireStaff(["order_manager", "delivery", "owner"]), async (req, res) => {
    try {
      const { status, note } = req.body;
      const userId = (req as any).user?.claims?.sub;
      const role = (req as any).staffRole;
      const validStatuses = ["pending", "processing", "shipped", "delivered", "completed", "cancelled"];
      if (!validStatuses.includes(status)) return res.status(400).json({ message: "حالة غير صالحة" });
      // Delivery staff can only update delivery statuses
      if (role === "delivery" && !["shipped", "delivered", "completed"].includes(status)) {
        return res.status(403).json({ message: "لا يمكنك تغيير الطلب إلى هذه الحالة" });
      }
      const { pool: dbPool } = await import("./db");
      // Get current order
      const current = await dbPool.query("SELECT status, status_history, assigned_to FROM orders WHERE id=$1", [req.params.id]);
      if (!current.rows.length) return res.status(404).json({ message: "الطلب غير موجود" });
      // Delivery staff can only update their own orders
      if (role === "delivery" && current.rows[0].assigned_to !== userId) {
        return res.status(403).json({ message: "هذا الطلب غير مخصص لك" });
      }
      const history = current.rows[0].status_history || [];
      history.push({ status, changedBy: userId, role, note: note || null, at: new Date().toISOString() });
      await dbPool.query(
        "UPDATE orders SET status=$1, status_history=$2 WHERE id=$3",
        [status, JSON.stringify(history), req.params.id]
      );
      res.json({ message: "تم تحديث حالة الطلب", status });
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث الحالة", error: e.message });
    }
  });

  // ─── Staff: Update payment status ─────────────────────────────────
  app.put("/api/staff/orders/:id/payment", requireStaff(["finance", "order_manager", "delivery", "owner"]), async (req, res) => {
    try {
      const { paymentStatus, note } = req.body;
      const validPayments = ["unpaid", "cod_collected", "transferred", "partial", "refunded"];
      if (!validPayments.includes(paymentStatus)) return res.status(400).json({ message: "حالة دفع غير صالحة" });
      const { pool: dbPool } = await import("./db");
      await dbPool.query("UPDATE orders SET payment_status=$1 WHERE id=$2", [paymentStatus, req.params.id]);
      res.json({ message: "تم تحديث حالة الدفع", paymentStatus });
    } catch (e: any) {
      res.status(500).json({ message: "فشل تحديث حالة الدفع", error: e.message });
    }
  });

  // ─── Staff: Assign order to delivery ──────────────────────────────
  app.put("/api/staff/orders/:id/assign", requireStaff(["order_manager", "owner"]), async (req, res) => {
    try {
      const { deliveryUserId } = req.body;
      const { pool: dbPool } = await import("./db");
      await dbPool.query("UPDATE orders SET assigned_to=$1 WHERE id=$2", [deliveryUserId || null, req.params.id]);
      res.json({ message: "تم تخصيص الطلب", deliveryUserId });
    } catch (e: any) {
      res.status(500).json({ message: "فشل تخصيص الطلب", error: e.message });
    }
  });

  // ─── Staff: Get delivery staff list (for assignment) ──────────────
  app.get("/api/staff/delivery-team", requireStaff(["order_manager", "owner"]), async (_req, res) => {
    try {
      const { db: dbI } = await import("./db");
      const { users: usersT } = await import("@shared/schema");
      const { eq: eqFn } = await import("drizzle-orm");
      const team = await dbI.select({ id: usersT.id, fullName: usersT.fullName, phone: usersT.phone }).from(usersT).where(eqFn(usersT.role, "delivery"));
      res.json(team);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب فريق التوصيل" });
    }
  });

  // ─── Staff: Products (product_manager) ────────────────────────────
  app.get("/api/staff/products", requireStaff(["product_manager", "owner"]), async (_req, res) => {
    try {
      const products = await storage.getProducts();
      // ─── تخفيف الـ payload: استبدل صور base64 الضخمة بروابط خفيفة ─────
      // (نفس النهج المستخدم في /api/products العام)
      const lightweight = products.map((p: any) => {
        const rawImg: string = p.imageUrl || "";
        const lightImageUrl = rawImg.startsWith("data:")
          ? proxyImg("products", p.id, rawImg)
          : (rawImg || null);
        const lightImageUrls = Array.isArray(p.imageUrls)
          ? p.imageUrls.map((url: string, i: number) =>
              typeof url === "string" && url.startsWith("data:")
                ? proxyImg("products", p.id, url, i)
                : url
            )
          : [];
        return { ...p, imageUrl: lightImageUrl, imageUrls: lightImageUrls };
      });
      res.json(lightweight);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب المنتجات" });
    }
  });

  // ─── جلب منتج واحد بكامل بياناته (للتعديل) ───────────────────────────
  // نُرجع البيانات الخام (بما فيها imageUrl/imageUrls الأصلية) حتى يقدر
  // الموظف يحفظ التعديلات دون أن نخرّب الصورة الأصلية.
  app.get("/api/staff/products/:id", requireStaff(["product_manager", "owner"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ message: "معرّف غير صحيح" });
      const product = await storage.getProduct(id);
      if (!product) return res.status(404).json({ message: "المنتج غير موجود" });
      res.json(product);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب المنتج" });
    }
  });

  // ─── Staff: Financial summary (finance) ───────────────────────────
  app.get("/api/staff/financial-summary", requireStaff(["finance", "owner"]), async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const result = await dbPool.query(`
        SELECT
          COUNT(*) as total_orders,
          SUM(CASE WHEN payment_status = 'cod_collected' OR payment_status = 'transferred' THEN total::numeric ELSE 0 END) as collected_amount,
          SUM(CASE WHEN payment_status = 'unpaid' AND status != 'cancelled' THEN total::numeric ELSE 0 END) as pending_amount,
          SUM(CASE WHEN status = 'cancelled' THEN total::numeric ELSE 0 END) as cancelled_amount,
          COUNT(CASE WHEN status = 'delivered' OR status = 'completed' THEN 1 END) as delivered_count,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_count,
          COUNT(CASE WHEN payment_status = 'cod_collected' THEN 1 END) as cod_collected_count,
          COUNT(CASE WHEN payment_status = 'unpaid' AND status != 'cancelled' THEN 1 END) as unpaid_count
        FROM orders
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `);
      res.json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب الملخص المالي" });
    }
  });

  // ─── Staff: Products Management (product_manager) ──────────────────────
  app.post("/api/staff/products", requireStaff(["product_manager", "owner"]), async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const {
        name, price, priceSar, categoryId, subcategoryId, stock, description,
        imageUrl, imageUrls, colors, sizes,
        originalPrice, originalPriceSar, discountPercent,
      } = req.body;
      if (!name || !price || !categoryId) return res.status(400).json({ message: "الاسم والسعر والفئة مطلوبة" });
      if (!imageUrl) return res.status(400).json({ message: "يرجى رفع صورة رئيسية للمنتج" });
      const r = await dbPool.query(
        `INSERT INTO products
          (name, price, price_sar, category_id, subcategory_id, stock, description,
           image_url, image_urls, colors, sizes,
           original_price, original_price_sar, discount_percent, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,true)
         RETURNING *`,
        [
          name, price, priceSar || null, categoryId,
          subcategoryId || null,
          stock || 0, description || null,
          imageUrl,
          Array.isArray(imageUrls) && imageUrls.length ? imageUrls : null,
          Array.isArray(colors) && colors.length ? colors : null,
          Array.isArray(sizes) && sizes.length ? sizes : null,
          originalPrice || null,
          originalPriceSar || null,
          discountPercent != null && discountPercent !== "" ? Number(discountPercent) : null,
        ]
      );
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.put("/api/staff/products/:id", requireStaff(["product_manager", "owner"]), async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const {
        name, price, priceSar, categoryId, subcategoryId, stock, description, isActive,
        imageUrl, imageUrls, colors, sizes,
        originalPrice, originalPriceSar, discountPercent,
      } = req.body;
      // الفرونت إند يرسل الحالة الكاملة للمنتج، فلا حاجة لـ COALESCE.
      // الحقول الأساسية تُحفظ القيمة القديمة فقط لو لم تُرسل (undefined).
      // الحقول الاختيارية (وصف، ألوان، مقاسات، صور إضافية، خصومات) يمكن مسحها بإرسال null/[].
      if (!imageUrl) return res.status(400).json({ message: "يرجى رفع صورة رئيسية للمنتج" });

      // ⚠️ روابط البروكسي تعني "نفس الصورة القديمة" — نحلّها إلى الصور الحقيقية من DB حتى لا تُطمس.
      const oldRow = (await dbPool.query(
        `SELECT image_url, image_urls FROM products WHERE id = $1`, [req.params.id]
      )).rows[0] || {};
      const oldMain: string | null = oldRow.image_url || null;
      const oldGallery: string[] = Array.isArray(oldRow.image_urls) ? oldRow.image_urls : [];

      const safeImageUrl = isProxyImageUrl(imageUrl) ? oldMain : imageUrl;
      let safeImageUrls: string[] | null = null;
      if (Array.isArray(imageUrls)) {
        const resolved = imageUrls.map((u: any, i: number) => {
          if (typeof u !== "string") return null;
          if (!isProxyImageUrl(u)) return u;
          const path = u.split("?")[0];
          const m = path.match(/\/api\/products\/image\/\d+(?:\/(\d+))?$/);
          const idx = m && m[1] != null ? parseInt(m[1]) : i;
          return oldGallery[idx] ?? oldMain ?? null;
        }).filter((x: any): x is string => typeof x === "string" && x.length > 0);
        safeImageUrls = resolved;
      }

      const r = await dbPool.query(
        `UPDATE products SET
           name = COALESCE($1, name),
           price = COALESCE($2, price),
           price_sar = $3,
           category_id = COALESCE($4, category_id),
           subcategory_id = $5,
           stock = COALESCE($6, stock),
           description = $7,
           image_url = COALESCE($8, image_url),
           image_urls = $9,
           colors = $10,
           sizes = $11,
           original_price = $12,
           original_price_sar = $13,
           discount_percent = $14,
           is_active = COALESCE($15, is_active)
         WHERE id = $16
         RETURNING *`,
        [
          name || null,
          price || null,
          priceSar || null,
          categoryId || null,
          subcategoryId || null,
          stock != null ? stock : null,
          description || null,
          safeImageUrl,
          safeImageUrls,
          Array.isArray(colors) ? colors : null,
          Array.isArray(sizes) ? sizes : null,
          originalPrice || null,
          originalPriceSar || null,
          discountPercent != null && discountPercent !== "" ? Number(discountPercent) : null,
          isActive != null ? isActive : null,
          req.params.id,
        ]
      );
      if (!r.rows.length) return res.status(404).json({ message: "المنتج غير موجود" });
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── Staff: Attendance (الحضور والانصراف) ───────────────────────────────
  app.post("/api/staff/attendance/checkin", requireStaff([]), async (req: any, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const userId = req.user.claims.sub;
      const today = new Date().toISOString().slice(0, 10);
      // تحقق من عدم وجود تسجيل حضور مفتوح اليوم
      const existing = await dbPool.query(
        `SELECT id FROM attendance WHERE user_id=$1 AND date=$2 AND check_out IS NULL`, [userId, today]
      );
      if (existing.rows.length) return res.status(400).json({ message: "أنت بالفعل مسجّل حضورك، سجّل انصرافك أولاً" });
      const r = await dbPool.query(
        `INSERT INTO attendance (user_id, check_in, date) VALUES ($1, NOW(), $2) RETURNING *`,
        [userId, today]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/staff/attendance/checkout", requireStaff([]), async (req: any, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const userId = req.user.claims.sub;
      const today = new Date().toISOString().slice(0, 10);
      const open = await dbPool.query(
        `SELECT * FROM attendance WHERE user_id=$1 AND date=$2 AND check_out IS NULL ORDER BY check_in DESC LIMIT 1`, [userId, today]
      );
      if (!open.rows.length) return res.status(400).json({ message: "لا يوجد تسجيل حضور مفتوح اليوم" });
      const rec = open.rows[0];
      const mins = Math.round((Date.now() - new Date(rec.check_in).getTime()) / 60000);
      const r = await dbPool.query(
        `UPDATE attendance SET check_out=NOW(), total_minutes=$1 WHERE id=$2 RETURNING *`,
        [mins, rec.id]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/staff/attendance/today", requireStaff([]), async (req: any, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const userId = req.user.claims.sub;
      const today = new Date().toISOString().slice(0, 10);
      const r = await dbPool.query(
        `SELECT * FROM attendance WHERE user_id=$1 AND date=$2 ORDER BY check_in DESC LIMIT 1`, [userId, today]
      );
      res.json(r.rows[0] || null);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/staff/attendance/history", requireStaff([]), async (req: any, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const userId = req.user.claims.sub;
      const r = await dbPool.query(
        `SELECT * FROM attendance WHERE user_id=$1 ORDER BY date DESC, check_in DESC LIMIT 30`, [userId]
      );
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/finance/attendance-summary", requireStaff(["finance", "owner", "order_manager"]), async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
      const r = await dbPool.query(`
        SELECT u.id, u.full_name, u.email, u.role,
          COUNT(DISTINCT a.date) as days_present,
          SUM(a.total_minutes) as total_minutes,
          MAX(CASE WHEN a.date = CURRENT_DATE::text AND a.check_out IS NULL THEN 1 ELSE 0 END) as is_checked_in_now,
          MAX(CASE WHEN a.date = CURRENT_DATE::text THEN a.check_in ELSE NULL END) as today_check_in
        FROM users u
        LEFT JOIN attendance a ON a.user_id = u.id AND a.date LIKE $1 || '%'
        WHERE u.role IN ('delivery','order_manager','product_manager','finance','owner')
          AND (u.account_type != 'customer' OR u.role != 'customer')
        GROUP BY u.id, u.full_name, u.email, u.role
        ORDER BY u.role, u.full_name
      `, [month]);
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // تعديل الحضور (مدير فقط)
  app.post("/api/finance/attendance/override", requireStaff(["finance", "owner"]), async (req: any, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { userId, date, checkIn, checkOut, notes } = req.body;
      if (!userId || !date || !checkIn) return res.status(400).json({ message: "بيانات ناقصة" });
      const mins = checkOut ? Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 60000) : null;
      await dbPool.query(`DELETE FROM attendance WHERE user_id=$1 AND date=$2`, [userId, date]);
      const r = await dbPool.query(
        `INSERT INTO attendance (user_id, check_in, check_out, total_minutes, date, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [userId, checkIn, checkOut||null, mins, date, notes||null]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── Finance: Expenses (المصاريف) ───────────────────────────────────────
  app.get("/api/finance/expenses", requireStaff(["finance", "owner"]), async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
      const r = await dbPool.query(
        `SELECT * FROM expenses WHERE date LIKE $1 || '%' ORDER BY date DESC, created_at DESC`, [month]
      );
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/finance/expenses", requireStaff(["finance", "owner"]), async (req: any, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { type, description, amount, currency, date, isRecurring, recurringDay, notes } = req.body;
      if (!type || !description || !amount || !date) return res.status(400).json({ message: "النوع والوصف والمبلغ والتاريخ مطلوبة" });
      const r = await dbPool.query(
        `INSERT INTO expenses (type, description, amount, currency, date, is_recurring, recurring_day, added_by, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [type, description, amount, currency||"YER", date, isRecurring||false, recurringDay||null, req.user.claims.sub, notes||null]
      );
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.put("/api/finance/expenses/:id", requireStaff(["finance", "owner"]), async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { type, description, amount, currency, date, notes } = req.body;
      const r = await dbPool.query(
        `UPDATE expenses SET type=COALESCE($1,type), description=COALESCE($2,description), amount=COALESCE($3,amount),
         currency=COALESCE($4,currency), date=COALESCE($5,date), notes=COALESCE($6,notes) WHERE id=$7 RETURNING *`,
        [type||null, description||null, amount||null, currency||null, date||null, notes||null, req.params.id]
      );
      if (!r.rows.length) return res.status(404).json({ message: "المصروف غير موجود" });
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/finance/expenses/:id", requireStaff(["finance", "owner"]), async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      await dbPool.query(`DELETE FROM expenses WHERE id=$1`, [req.params.id]);
      res.json({ message: "تم الحذف" });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── Finance: Assets / Depreciation (الأصول والاهلاكات) ────────────────
  app.get("/api/finance/assets", requireStaff(["finance", "owner"]), async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(`SELECT * FROM assets WHERE is_active=true ORDER BY created_at DESC`);
      // احتساب القيمة الحالية والاهلاك الشهري لكل أصل
      const enriched = r.rows.map((a: any) => {
        const monthlyDep = Number(a.original_value) / a.useful_life_months;
        const monthsElapsed = Math.floor(
          (Date.now() - new Date(a.purchase_date + "-01").getTime()) / (1000 * 60 * 60 * 24 * 30)
        );
        const currentValue = Math.max(0, Number(a.original_value) - monthlyDep * monthsElapsed);
        return { ...a, monthlyDepreciation: monthlyDep.toFixed(0), currentValue: currentValue.toFixed(0), monthsElapsed };
      });
      res.json(enriched);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/finance/assets", requireStaff(["finance", "owner"]), async (req: any, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { name, originalValue, purchaseDate, usefulLifeMonths, notes } = req.body;
      if (!name || !originalValue || !purchaseDate || !usefulLifeMonths) return res.status(400).json({ message: "بيانات ناقصة" });
      const r = await dbPool.query(
        `INSERT INTO assets (name, original_value, purchase_date, useful_life_months, notes, added_by)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [name, originalValue, purchaseDate, usefulLifeMonths, notes||null, req.user.claims.sub]
      );
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/finance/assets/:id", requireStaff(["finance", "owner"]), async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      await dbPool.query(`UPDATE assets SET is_active=false WHERE id=$1`, [req.params.id]);
      res.json({ message: "تم الحذف" });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── Finance: Staff Rates Config (إعداد الأجور) ────────────────────────
  app.get("/api/finance/staff-rates", requireStaff(["finance", "owner"]), async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(`SELECT * FROM staff_rate_config ORDER BY role`);
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.put("/api/finance/staff-rates/:role", requireStaff(["finance", "owner"]), async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { baseSalary, ratePerOrder, paymentModel, overtimeRatePerHour, workingDaysPerMonth } = req.body;
      await dbPool.query(
        `UPDATE staff_rate_config SET base_salary=COALESCE($1,base_salary), rate_per_order=COALESCE($2,rate_per_order),
         payment_model=COALESCE($3,payment_model), overtime_rate_per_hour=COALESCE($4,overtime_rate_per_hour),
         working_days_per_month=COALESCE($5,working_days_per_month), updated_at=NOW() WHERE role=$6`,
        [baseSalary??null, ratePerOrder??null, paymentModel||null, overtimeRatePerHour??null, workingDaysPerMonth??null, req.params.role]
      );
      res.json({ message: "تم التحديث" });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── Finance: Payroll Calculation (احتساب الرواتب) ─────────────────────
  app.get("/api/finance/payroll", requireStaff(["finance", "owner"]), async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const period = (req.query.period as string) || new Date().toISOString().slice(0, 7);

      // جلب كل الموظفين + إعدادات الأجور
      const staffRes = await dbPool.query(`
        SELECT u.id, u.full_name, u.email, u.role
        FROM users u WHERE u.role IN ('delivery','order_manager','product_manager','finance','owner')
          AND u.id IN (SELECT user_id FROM team_members WHERE is_active=true)
        ORDER BY u.role, u.full_name
      `);
      const ratesRes = await dbPool.query(`SELECT * FROM staff_rate_config`);
      const rates: Record<string, any> = {};
      ratesRes.rows.forEach((r: any) => { rates[r.role] = r; });

      const result = [];
      for (const staff of staffRes.rows) {
        const rate = rates[staff.role] || { base_salary: 0, rate_per_order: 0, payment_model: 'fixed', working_days_per_month: 26 };

        // احتساب الحضور
        const attRes = await dbPool.query(
          `SELECT COUNT(DISTINCT date) as days, SUM(total_minutes) as total_mins
           FROM attendance WHERE user_id=$1 AND date LIKE $2 || '%' AND check_out IS NOT NULL`,
          [staff.id, period]
        );
        const attendanceDays = parseInt(attRes.rows[0]?.days || 0);
        const totalHours = Math.round((attRes.rows[0]?.total_mins || 0) / 60);
        const workingDays = rate.working_days_per_month;
        const absenceDays = Math.max(0, workingDays - attendanceDays);

        // احتساب الطلبات المنجزة
        let ordersCompleted = 0;
        if (staff.role === 'delivery') {
          const ordRes = await dbPool.query(
            `SELECT COUNT(*) as cnt FROM orders WHERE assigned_to=$1 AND (status='delivered' OR status='completed')
             AND DATE_TRUNC('month', updated_at) = DATE_TRUNC('month', ($2 || '-01')::date)`,
            [staff.id, period]
          );
          ordersCompleted = parseInt(ordRes.rows[0]?.cnt || 0);
        } else if (staff.role === 'order_manager') {
          const ordRes = await dbPool.query(
            `SELECT COUNT(*) as cnt FROM orders WHERE (status='completed' OR status='delivered')
             AND DATE_TRUNC('month', updated_at) = DATE_TRUNC('month', ($1 || '-01')::date)`,
            [period]
          );
          ordersCompleted = parseInt(ordRes.rows[0]?.cnt || 0);
        }

        // حساب الراتب
        const baseSalary = Number(rate.base_salary);
        const orderBonus = ordersCompleted * Number(rate.rate_per_order);
        const deductionPerDay = workingDays > 0 ? baseSalary / workingDays : 0;
        const deductions = rate.payment_model !== 'per_order' ? absenceDays * deductionPerDay : 0;

        let totalPay = 0;
        if (rate.payment_model === 'fixed') totalPay = baseSalary - deductions;
        else if (rate.payment_model === 'per_order') totalPay = orderBonus;
        else totalPay = (baseSalary - deductions) + orderBonus; // hybrid

        // هل يوجد كشف راتب محفوظ؟
        const savedRes = await dbPool.query(
          `SELECT * FROM payroll_periods WHERE user_id=$1 AND period=$2`, [staff.id, period]
        );

        result.push({
          userId: staff.id,
          fullName: staff.full_name || staff.email,
          role: staff.role,
          period,
          baseSalary,
          ratePerOrder: Number(rate.rate_per_order),
          paymentModel: rate.payment_model,
          ordersCompleted,
          orderBonus,
          attendanceDays,
          absenceDays,
          totalHours,
          deductions: Math.round(deductions),
          bonuses: savedRes.rows[0]?.bonuses || 0,
          totalPay: Math.max(0, Math.round(totalPay + Number(savedRes.rows[0]?.bonuses || 0))),
          isPaid: savedRes.rows[0]?.is_paid || false,
          savedId: savedRes.rows[0]?.id || null,
          notes: savedRes.rows[0]?.notes || null,
        });
      }
      res.json(result);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/finance/payroll/save", requireStaff(["finance", "owner"]), async (req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const { userId, period, totalPay, bonuses, notes, isPaid, ...rest } = req.body;
      await dbPool.query(`
        INSERT INTO payroll_periods (user_id, period, base_salary, orders_completed, order_bonus,
          attendance_days, absence_days, deductions, bonuses, total_pay, is_paid, paid_at, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (user_id, period) DO UPDATE SET
          bonuses=EXCLUDED.bonuses, total_pay=EXCLUDED.total_pay,
          is_paid=EXCLUDED.is_paid, paid_at=EXCLUDED.paid_at, notes=EXCLUDED.notes
      `, [userId, period, rest.baseSalary||0, rest.ordersCompleted||0, rest.orderBonus||0,
          rest.attendanceDays||0, rest.absenceDays||0, rest.deductions||0,
          bonuses||0, totalPay, isPaid||false, isPaid ? new Date() : null, notes||null]);
      res.json({ message: "تم الحفظ" });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── Staff: Orders pending payment verification ─────────────────────────
  app.get("/api/staff/orders/pending-verification", requireStaff(["order_manager", "finance", "owner"]), async (_req, res) => {
    try {
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query(`
        SELECT o.*, array_agg(json_build_object('product_id',oi.product_id,'quantity',oi.quantity,'price',oi.price)) as items
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id = o.id
        WHERE o.payment_method IN ('bank_transfer','digital_wallet','installment_deposit_cod')
          AND o.payment_status = 'unpaid'
          AND o.status != 'cancelled'
        GROUP BY o.id
        ORDER BY o.created_at DESC
      `);
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── جدولة تذكيرات التقسيط التلقائية (كل 24 ساعة) ─────────────────────────
  async function runInstallmentReminders() {
    try {
      const { pool: dbPool } = await import("./db");
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_FROM_NUMBER;
      if (!accountSid || !authToken || !fromNumber) return;

      // خطط التقسيط المؤكدة (دفع المقدم) ولم يُسدَّد الباقي، ومر عليها 3 أيام على الأقل
      // يُرسل تذكير تلقائي واحد فقط (ما لم يُرسَل من قبل)
      const plans = await dbPool.query(`
        SELECT ip.id, ip.customer_name, ip.customer_phone,
               ip.remaining_amount, ip.order_id,
               o.shipping_city
        FROM installment_plans ip
        JOIN orders o ON o.id = ip.order_id
        WHERE ip.status = 'deposit_paid'
          AND ip.remaining_paid = false
          AND ip.created_at <= NOW() - INTERVAL '3 days'
          AND (ip.admin_notes IS NULL OR ip.admin_notes NOT LIKE '%[تذكير تلقائي%')
        LIMIT 20
      `);

      for (const plan of plans.rows) {
        try {
          const phone = (plan.customer_phone || "").replace(/\s+/g, "").replace(/^00/, "+");
          if (!phone.startsWith("+")) continue;

          const msg = `⏰ تذكير بدفع قسط التقسيط\n━━━━━━━━━━━━━━━━━━━━━\n🆔 طلب: #${plan.order_id}\n💰 المبلغ المتبقي: ${Number(plan.remaining_amount).toLocaleString()} ر.ي\nيرجى تسديد الباقي عند الاستلام أو التواصل معنا.\n━━━━━━━━━━━━━━━━━━━━━\nأويو بلاست 🛍️`;

          await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
            {
              method: "POST",
              headers: {
                Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({ To: `whatsapp:${phone}`, From: `whatsapp:${fromNumber}`, Body: msg }),
            }
          );

          // تسجيل التذكير في ملاحظات الأدمن
          await dbPool.query(
            `UPDATE installment_plans SET admin_notes = COALESCE(admin_notes,'') || $1 WHERE id = $2`,
            [`\n[تذكير تلقائي: ${new Date().toLocaleDateString("ar-YE")}]`, plan.id]
          );
        } catch { /* skip individual failures */ }
      }
    } catch (e: any) {
      console.error("Auto installment reminder error:", e.message);
    }
  }

  // تشغيل التذكيرات مرة كل 24 ساعة
  setInterval(runInstallmentReminders, 24 * 60 * 60 * 1000);
  // تشغيل أولي بعد 5 دقائق من بدء الخادم
  setTimeout(runInstallmentReminders, 5 * 60 * 1000);

  // ─── تذكير قبل 3 أيام من استحقاق مديونية العميل (يومياً) ──────────────────
  async function runDebtDueReminders() {
    try {
      const { pool: dbPool } = await import("./db");
      // طلبات مُسلَّمة + غير مسددة + باقي عليها 3 أيام (± 12 ساعة) لتاريخ الاستحقاق
      const rows = await dbPool.query(`
        SELECT o.id, o.user_id, o.customer_name, o.customer_phone, o.total,
               COALESCE(o.deposit_amount,0)  AS deposit,
               COALESCE(o.discount_amount,0) AS discount,
               COALESCE(o.amount_claimed,0)  AS claimed,
               o.created_at,
               COALESCE(ct.payment_term_days, 30) AS term_days,
               COALESCE(o.notes,'') AS notes
          FROM orders o
          LEFT JOIN customer_credit cc ON cc.customer_id = o.user_id
          LEFT JOIN customer_credit_tiers ct ON ct.tier_key = cc.tier
         WHERE o.status IN ('delivered','completed')
           AND COALESCE(o.payment_status,'unpaid') NOT IN ('paid','pending_verification')
           AND o.user_id IS NOT NULL
           AND COALESCE(o.notes,'') NOT LIKE '%[تذكير_استحقاق%'
         LIMIT 100
      `);

      const now = Date.now();
      for (const r of rows.rows) {
        try {
          const remaining =
            Number(r.total) - Number(r.deposit) - Number(r.discount) - Number(r.claimed);
          if (remaining <= 0) continue;
          const dueMs =
            new Date(r.created_at).getTime() +
            Number(r.term_days) * 24 * 3600 * 1000;
          const diffDays = (dueMs - now) / (24 * 3600 * 1000);
          // إرسال إذا كانت المدة المتبقية بين يومين ونصف وثلاثة ونصف
          if (diffDays < 2.5 || diffDays > 3.5) continue;

          // إشعار داخلي + actionUrl إلى /my-debts
          try {
            const { createNotification } = await import("./lib/notifications");
            await createNotification({
              userId: String(r.user_id),
              type: "payment_due",
              title: "⏰ تذكير: استحقاق سداد بعد 3 أيام",
              message: `الطلب #${r.id} — المبلغ المتبقي ${remaining.toLocaleString()} ر.ي. سدّد الآن واحصل على خصم 1% للسداد المبكّر.`,
              actionUrl: "/my-debts",
              priority: "high",
              groupKey: `debt-due-${r.id}`,
              orderId: r.id,
            });
          } catch {}

          // واتساب (إن توفّر)
          const accountSid = process.env.TWILIO_ACCOUNT_SID;
          const authToken = process.env.TWILIO_AUTH_TOKEN;
          const fromNumber = process.env.TWILIO_FROM_NUMBER;
          if (accountSid && authToken && fromNumber && r.customer_phone) {
            const phone = String(r.customer_phone).replace(/\s+/g, "").replace(/^00/, "+");
            if (phone.startsWith("+")) {
              const msg = `⏰ تذكير ودّي بسداد مديونية\n━━━━━━━━━━━━━━━━━━━━━\n🆔 الطلب: #${r.id}\n💰 المتبقي: ${remaining.toLocaleString()} ر.ي\n📅 الاستحقاق: بعد 3 أيام\n\n🎁 سدّد الآن واحصل على خصم 1% للسداد المبكّر.\n🔗 https://oyoplast.com/my-debts\n━━━━━━━━━━━━━━━━━━━━━\nأويو بلاست 🛍️`;
              await fetch(
                `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
                {
                  method: "POST",
                  headers: {
                    Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
                    "Content-Type": "application/x-www-form-urlencoded",
                  },
                  body: new URLSearchParams({ To: `whatsapp:${phone}`, From: `whatsapp:${fromNumber}`, Body: msg }),
                }
              );
            }
          }

          // تعليم الطلب أن التذكير أُرسل (لمنع التكرار)
          await dbPool.query(
            `UPDATE orders SET notes=COALESCE(notes,'')||$1 WHERE id=$2`,
            [`\n[تذكير_استحقاق: ${new Date().toISOString().slice(0,10)}]`, r.id]
          );
        } catch (innerErr: any) {
          console.error("[debt-reminder] item err:", innerErr?.message);
        }
      }
      if (rows.rows.length > 0) {
        console.log(`[debt-reminder] فحص ${rows.rows.length} طلب — تذكيرات الاستحقاق`);
      }
    } catch (e: any) {
      console.error("[debt-reminder] error:", e?.message);
    }
  }

  // جدولة cron يومية الساعة 8:00 صباحاً + تشغيل أولي تجريبي بعد 10 دقائق
  try {
    const cron = await import("node-cron");
    cron.schedule("0 8 * * *", async () => {
      console.log("[debt-reminder] cron تشغيل الساعة 8 صباحاً");
      await runDebtDueReminders();
    });
    console.log("[INFO] تم جدولة تذكير استحقاق المديونيات (8:00 صباحاً)");
  } catch (e: any) {
    console.error("[debt-reminder] cron schedule error:", e?.message);
    // fallback: كل 24 ساعة
    setInterval(runDebtDueReminders, 24 * 60 * 60 * 1000);
  }
  setTimeout(runDebtDueReminders, 10 * 60 * 1000);
}
