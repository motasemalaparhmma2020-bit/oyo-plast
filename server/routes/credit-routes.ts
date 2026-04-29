/**
 * مسارات نظام الائتمان والفئات (المرحلة 1)
 * - إدارة الفئات الأربع (VIP / فضي / برونزي / محظور)
 * - إعدادات النظام (صندوق الاحتياطي، يوم التسوية، التجميد...)
 * - إدارة ائتمان كل عميل (تجاوز يدوي، رصيد افتتاحي، تجميد)
 * - قواعد التسعير لكل منتج
 * - شاشة "حسابي المالي" للعميل
 */
import type { Express, Request, Response, NextFunction } from "express";
import { pool } from "../db";

// ──────────────────────────────────────────────────────────────────────────────
// مفاتيح الإعدادات في جدول settings
// ──────────────────────────────────────────────────────────────────────────────
const CREDIT_SETTING_KEYS = [
  "credit_system_enabled",
  "credit_reserve_fund_percent",
  "credit_settlement_day",
  "credit_auto_freeze_days",
  "credit_auto_downgrade_days",
  "credit_auto_freeze_enabled",
  "credit_show_account_to_all",
];

// ──────────────────────────────────────────────────────────────────────────────
// مساعد: استخراج userId من جلسة Replit أو Email auth
// ──────────────────────────────────────────────────────────────────────────────
function getUserIdFromReq(req: any): string | undefined {
  const user = (req as any).user;
  return user?.claims?.sub ?? undefined;
}

export function registerCreditRoutes(
  app: Express,
  requireAdmin: (req: Request, res: Response, next: NextFunction) => void,
) {
  // ════════════════════════════════════════════════════════════════════════════
  // إدارة الفئات (لوحة الأدمن)
  // ════════════════════════════════════════════════════════════════════════════

  // قائمة جميع الفئات
  app.get("/api/admin/credit/tiers", requireAdmin, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT * FROM customer_credit_tiers ORDER BY sort_order ASC, id ASC`,
      );
      console.log(`[CREDIT] GET /tiers → returning ${r.rows.length} tiers (UA: ${req.headers['user-agent']?.substring(0, 50)})`);
      res.json(r.rows);
    } catch (e: any) {
      console.error("[CREDIT] GET /tiers error:", e);
      res.status(500).json({ message: e.message });
    }
  });

  // تعديل فئة
  app.put("/api/admin/credit/tiers/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "معرّف غير صالح" });

      const allowed = [
        "tier_name_ar",
        "tier_icon",
        "tier_color",
        "credit_limit",
        "payment_term_days",
        "down_payment_percent",
        "cash_discount_percent",
        "min_orders_to_reach",
        "min_months_to_reach",
        "max_late_days_allowed",
        "description",
        "benefits",
        "is_active",
        "sort_order",
      ];
      const updates: string[] = [];
      const values: any[] = [];
      let i = 1;
      for (const key of allowed) {
        const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        if (req.body[camel] !== undefined) {
          updates.push(`${key} = $${i++}`);
          values.push(req.body[camel]);
        } else if (req.body[key] !== undefined) {
          updates.push(`${key} = $${i++}`);
          values.push(req.body[key]);
        }
      }
      if (updates.length === 0) return res.status(400).json({ message: "لا يوجد تحديثات" });

      updates.push(`updated_at = NOW()`);
      values.push(id);
      const sql = `UPDATE customer_credit_tiers SET ${updates.join(", ")} WHERE id = $${i} RETURNING *`;
      const r = await pool.query(sql, values);
      if (r.rows.length === 0) return res.status(404).json({ message: "الفئة غير موجودة" });
      res.json(r.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // إعدادات النظام العامة
  // ════════════════════════════════════════════════════════════════════════════

  // قراءة كل إعدادات الائتمان
  app.get("/api/admin/credit/settings", requireAdmin, async (_req, res) => {
    try {
      const r = await pool.query(
        `SELECT key, value FROM settings WHERE key = ANY($1)`,
        [CREDIT_SETTING_KEYS],
      );
      const obj: Record<string, string> = {};
      for (const k of CREDIT_SETTING_KEYS) obj[k] = "";
      r.rows.forEach((row) => (obj[row.key] = row.value));
      res.json(obj);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // تحديث إعدادات الائتمان (دفعة واحدة)
  app.put("/api/admin/credit/settings", requireAdmin, async (req, res) => {
    try {
      const updates = req.body as Record<string, any>;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const key of Object.keys(updates)) {
          if (!CREDIT_SETTING_KEYS.includes(key)) continue;
          const value = String(updates[key] ?? "");
          await client.query(
            `INSERT INTO settings (key, value) VALUES ($1, $2)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
            [key, value],
          );
        }
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // إدارة ائتمان العملاء
  // ════════════════════════════════════════════════════════════════════════════

  // قائمة العملاء مع معلومات الائتمان (مع البحث والتصفية)
  app.get("/api/admin/credit/customers", requireAdmin, async (req, res) => {
    try {
      const { tier, frozen, hasDebt, search, limit = "100" } = req.query as any;
      const wheres: string[] = ["1=1"];
      const vals: any[] = [];
      let i = 1;

      if (tier) {
        wheres.push(`COALESCE(cc.tier, 'bronze') = $${i++}`);
        vals.push(tier);
      }
      if (frozen === "true") {
        wheres.push(`COALESCE(cc.is_frozen, false) = true`);
      }
      if (hasDebt === "true") {
        wheres.push(`COALESCE(cc.current_balance::numeric, 0) > 0`);
      }
      if (search) {
        wheres.push(
          `(u.full_name ILIKE $${i} OR u.phone ILIKE $${i} OR u.email ILIKE $${i})`,
        );
        vals.push(`%${search}%`);
        i++;
      }

      vals.push(Number(limit));
      const sql = `
        SELECT
          u.id, u.full_name, u.phone, u.email, u.created_at as user_created_at,
          cc.id as credit_id,
          COALESCE(cc.tier, 'bronze') as tier,
          COALESCE(cc.manual_override, false) as manual_override,
          cc.credit_limit_override,
          cc.discount_override,
          cc.payment_term_override,
          cc.down_payment_override,
          COALESCE(cc.opening_balance, '0') as opening_balance,
          COALESCE(cc.current_balance, '0') as current_balance,
          COALESCE(cc.total_orders, 0) as total_orders,
          COALESCE(cc.total_paid_amount, '0') as total_paid_amount,
          COALESCE(cc.on_time_payments, 0) as on_time_payments,
          COALESCE(cc.late_payments, 0) as late_payments,
          cc.last_order_at, cc.last_payment_at,
          COALESCE(cc.is_frozen, false) as is_frozen,
          cc.frozen_until, cc.frozen_reason,
          cc.admin_notes
        FROM users u
        LEFT JOIN customer_credit cc ON cc.customer_id = u.id
        WHERE ${wheres.join(" AND ")}
        ORDER BY COALESCE(cc.current_balance::numeric, 0) DESC, u.created_at DESC
        LIMIT $${i}
      `;
      const r = await pool.query(sql, vals);
      res.json(r.rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // قراءة بطاقة عميل واحد
  app.get("/api/admin/credit/customers/:userId", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const r = await pool.query(
        `SELECT u.id, u.full_name, u.phone, u.email,
                cc.*,
                t.tier_name_ar, t.tier_icon, t.tier_color,
                t.credit_limit as tier_credit_limit,
                t.payment_term_days as tier_payment_term_days,
                t.down_payment_percent as tier_down_payment_percent,
                t.cash_discount_percent as tier_cash_discount_percent
         FROM users u
         LEFT JOIN customer_credit cc ON cc.customer_id = u.id
         LEFT JOIN customer_credit_tiers t ON t.tier_key = COALESCE(cc.tier, 'bronze')
         WHERE u.id = $1`,
        [userId],
      );
      if (r.rows.length === 0) return res.status(404).json({ message: "العميل غير موجود" });
      res.json(r.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // إنشاء/تحديث ائتمان عميل (upsert)
  app.put("/api/admin/credit/customers/:userId", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const {
        tier,
        manualOverride,
        creditLimitOverride,
        discountOverride,
        paymentTermOverride,
        downPaymentOverride,
        openingBalance,
        adminNotes,
      } = req.body;

      const userCheck = await pool.query("SELECT id FROM users WHERE id = $1", [userId]);
      if (userCheck.rows.length === 0)
        return res.status(404).json({ message: "العميل غير موجود" });

      const existing = await pool.query(
        "SELECT id, tier FROM customer_credit WHERE customer_id = $1",
        [userId],
      );

      let result;
      if (existing.rows.length === 0) {
        result = await pool.query(
          `INSERT INTO customer_credit
            (customer_id, tier, manual_override, credit_limit_override, discount_override,
             payment_term_override, down_payment_override, opening_balance, current_balance, admin_notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9)
           RETURNING *`,
          [
            userId,
            tier ?? "bronze",
            manualOverride ?? false,
            creditLimitOverride ?? null,
            discountOverride ?? null,
            paymentTermOverride ?? null,
            downPaymentOverride ?? null,
            openingBalance ?? "0",
            adminNotes ?? null,
          ],
        );
      } else {
        result = await pool.query(
          `UPDATE customer_credit SET
            tier = COALESCE($2, tier),
            manual_override = COALESCE($3, manual_override),
            credit_limit_override = $4,
            discount_override = $5,
            payment_term_override = $6,
            down_payment_override = $7,
            opening_balance = COALESCE($8, opening_balance),
            admin_notes = COALESCE($9, admin_notes),
            updated_at = NOW()
           WHERE customer_id = $1
           RETURNING *`,
          [
            userId,
            tier ?? null,
            manualOverride ?? null,
            creditLimitOverride ?? null,
            discountOverride ?? null,
            paymentTermOverride ?? null,
            downPaymentOverride ?? null,
            openingBalance ?? null,
            adminNotes ?? null,
          ],
        );
      }

      // سجّل تغيير الفئة إن تغيرت
      const oldTier = existing.rows[0]?.tier;
      const newTier = result.rows[0].tier;
      if (oldTier !== newTier) {
        await pool.query(
          `INSERT INTO customer_tier_history (customer_id, from_tier, to_tier, reason, changed_by, notes)
           VALUES ($1, $2, $3, 'manual_admin', 'admin', $4)`,
          [userId, oldTier ?? null, newTier, adminNotes ?? "تعديل يدوي من لوحة الإدارة"],
        );
      }

      res.json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // تجميد عميل
  app.post("/api/admin/credit/customers/:userId/freeze", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { reason, untilDate } = req.body;
      await pool.query(
        `INSERT INTO customer_credit (customer_id, is_frozen, frozen_until, frozen_reason)
         VALUES ($1, true, $2, $3)
         ON CONFLICT (customer_id) DO UPDATE SET
           is_frozen = true,
           frozen_until = EXCLUDED.frozen_until,
           frozen_reason = EXCLUDED.frozen_reason,
           updated_at = NOW()`,
        [userId, untilDate || null, reason || "تجميد يدوي من الإدارة"],
      );
      await pool.query(
        `INSERT INTO customer_tier_history (customer_id, from_tier, to_tier, reason, changed_by, notes)
         VALUES ($1, NULL, 'frozen', 'freeze', 'admin', $2)`,
        [userId, reason || "تجميد يدوي"],
      );
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // فك التجميد
  app.post("/api/admin/credit/customers/:userId/unfreeze", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      await pool.query(
        `UPDATE customer_credit SET
           is_frozen = false, frozen_until = NULL, frozen_reason = NULL, updated_at = NOW()
         WHERE customer_id = $1`,
        [userId],
      );
      await pool.query(
        `INSERT INTO customer_tier_history (customer_id, from_tier, to_tier, reason, changed_by)
         VALUES ($1, 'frozen', 'unfrozen', 'unfreeze', 'admin')`,
        [userId],
      );
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // سجل تغيير الفئة لعميل
  app.get("/api/admin/credit/customers/:userId/history", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const r = await pool.query(
        `SELECT * FROM customer_tier_history WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [userId],
      );
      res.json(r.rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // قواعد التسعير لكل منتج
  // ════════════════════════════════════════════════════════════════════════════

  // كل القواعد
  app.get("/api/admin/credit/product-rules", requireAdmin, async (_req, res) => {
    try {
      const r = await pool.query(
        `SELECT pr.*, p.name as product_name, p.price as product_price
         FROM product_pricing_rules pr
         JOIN products p ON p.id = pr.product_id
         ORDER BY pr.updated_at DESC`,
      );
      res.json(r.rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // قاعدة منتج محدد
  app.get("/api/admin/credit/product-rules/:productId", requireAdmin, async (req, res) => {
    try {
      const productId = Number(req.params.productId);
      const r = await pool.query(
        `SELECT * FROM product_pricing_rules WHERE product_id = $1`,
        [productId],
      );
      res.json(r.rows[0] ?? null);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // upsert قاعدة منتج
  app.put("/api/admin/credit/product-rules/:productId", requireAdmin, async (req, res) => {
    try {
      const productId = Number(req.params.productId);
      const {
        minProfitAmount,
        maxDiscountPercent,
        creditEligible,
        allowedTiers,
        noteForCustomer,
      } = req.body;

      const r = await pool.query(
        `INSERT INTO product_pricing_rules
          (product_id, min_profit_amount, max_discount_percent, credit_eligible, allowed_tiers, note_for_customer)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (product_id) DO UPDATE SET
           min_profit_amount = EXCLUDED.min_profit_amount,
           max_discount_percent = EXCLUDED.max_discount_percent,
           credit_eligible = EXCLUDED.credit_eligible,
           allowed_tiers = EXCLUDED.allowed_tiers,
           note_for_customer = EXCLUDED.note_for_customer,
           updated_at = NOW()
         RETURNING *`,
        [
          productId,
          minProfitAmount ?? null,
          maxDiscountPercent ?? null,
          creditEligible ?? true,
          allowedTiers ?? null,
          noteForCustomer ?? null,
        ],
      );
      res.json(r.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // شاشة "حسابي المالي" — للعميل المسجّل
  // ════════════════════════════════════════════════════════════════════════════

  app.get("/api/my/credit", async (req, res) => {
    try {
      const userId = getUserIdFromReq(req);
      if (!userId) return res.status(401).json({ message: "يجب تسجيل الدخول" });

      // جلب بيانات الائتمان + معلومات الفئة
      const r = await pool.query(
        `SELECT
           cc.*,
           t.tier_name_ar, t.tier_icon, t.tier_color,
           t.credit_limit as tier_credit_limit,
           t.payment_term_days as tier_payment_term_days,
           t.down_payment_percent as tier_down_payment_percent,
           t.cash_discount_percent as tier_cash_discount_percent,
           t.benefits as tier_benefits,
           t.description as tier_description
         FROM customer_credit cc
         RIGHT JOIN customer_credit_tiers t ON t.tier_key = COALESCE(cc.tier, 'bronze')
         WHERE cc.customer_id = $1 OR (cc.customer_id IS NULL AND t.tier_key = 'bronze')
         LIMIT 1`,
        [userId],
      );

      // إن لم يوجد سجل ائتمان، أرجع بيانات افتراضية (فئة برونزي)
      let row = r.rows[0];
      if (!row || !row.customer_id) {
        const defaults = await pool.query(
          `SELECT 'bronze' as tier, tier_name_ar, tier_icon, tier_color,
                  credit_limit as tier_credit_limit,
                  payment_term_days as tier_payment_term_days,
                  down_payment_percent as tier_down_payment_percent,
                  cash_discount_percent as tier_cash_discount_percent,
                  benefits as tier_benefits,
                  description as tier_description,
                  '0' as opening_balance, '0' as current_balance,
                  0 as total_orders, '0' as total_paid_amount,
                  0 as on_time_payments, 0 as late_payments,
                  false as is_frozen, false as manual_override
           FROM customer_credit_tiers WHERE tier_key = 'bronze' LIMIT 1`,
        );
        row = defaults.rows[0];
      }

      // حساب السقف الفعلي (مع الأخذ بالاعتبار التجاوز اليدوي)
      const effectiveLimit = row.manual_override && row.credit_limit_override
        ? row.credit_limit_override
        : row.tier_credit_limit;

      const effectiveDiscount = row.manual_override && row.discount_override !== null
        ? row.discount_override
        : row.tier_cash_discount_percent;

      const currentBalance = Number(row.current_balance ?? 0);
      const available = Math.max(0, Number(effectiveLimit) - currentBalance);

      res.json({
        ...row,
        effective_credit_limit: effectiveLimit,
        effective_cash_discount: effectiveDiscount,
        available_credit: available.toString(),
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });
}
