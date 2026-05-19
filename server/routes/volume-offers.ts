import type { Express, RequestHandler } from "express";
import { pool } from "../db";

type Row = Record<string, any>;

function mapRow(r: Row) {
  return {
    id: r.id,
    productId: r.product_id,
    minQuantity: r.min_quantity,
    maxQuantity: r.max_quantity,
    offerPriceYer: r.offer_price_yer == null ? null : Number(r.offer_price_yer),
    originalPriceYer: r.original_price_yer == null ? null : Number(r.original_price_yer),
    displayLabel: r.display_label,
    badgeText: r.badge_text,
    hasFreeShipping: !!r.has_free_shipping,
    shippingFeeYer: Number(r.shipping_fee_yer ?? 0),
    marketerCommissionPercent: r.marketer_commission_percent == null ? null : Number(r.marketer_commission_percent),
    isActive: !!r.is_active,
    sortOrder: r.sort_order ?? 0,
    createdAt: r.created_at,
  };
}

/**
 * يُرجع أنسب عرض كمية مفعّل لمنتج معيّن وكمية معيّنة، أو null إن لم يوجد.
 * الأقل سعراً أولاً عند تطابق أكثر من عرض.
 */
export async function findActiveOfferForQuantity(productId: number, qty: number) {
  if (!productId || !qty || qty < 1) return null;
  // ── Phase A: العروض لا تُطبَّق إلا إذا فعّل الأدمن enable_volume_offers ──
  const gate = await pool.query(
    `SELECT enable_volume_offers FROM products WHERE id = $1`, [productId]
  );
  if (!gate.rows.length || gate.rows[0].enable_volume_offers !== true) return null;
  const r = await pool.query(`
    SELECT * FROM product_volume_offers
    WHERE product_id = $1
      AND is_active = true
      AND min_quantity <= $2
      AND (max_quantity IS NULL OR max_quantity >= $2)
    ORDER BY offer_price_yer ASC
    LIMIT 1
  `, [productId, qty]);
  return r.rows.length > 0 ? mapRow(r.rows[0]) : null;
}

export function registerVolumeOfferRoutes(app: Express, requireAdmin: RequestHandler) {
  app.get("/api/products/:id/volume-offers", async (req, res) => {
    try {
      const pid = parseInt(req.params.id);
      if (!pid) return res.status(400).json({ message: "Invalid product id" });
      // ── Phase A: لا نُرجع عروضاً إن لم يُفعّل الأدمن enable_volume_offers ──
      const gate = await pool.query(
        `SELECT enable_volume_offers FROM products WHERE id = $1`, [pid]
      );
      if (!gate.rows.length || gate.rows[0].enable_volume_offers !== true) {
        return res.json([]);
      }
      const r = await pool.query(`
        SELECT * FROM product_volume_offers
        WHERE product_id = $1 AND is_active = true
        ORDER BY min_quantity ASC, sort_order ASC
      `, [pid]);
      res.json(r.rows.map(mapRow));
    } catch (e: any) {
      console.error("[volume-offers public]", e?.message);
      res.status(500).json({ message: "خطأ في جلب العروض" });
    }
  });

  app.get("/api/admin/volume-offers", requireAdmin, async (req, res) => {
    try {
      const pid = parseInt(String(req.query.productId || ""));
      if (!pid) return res.status(400).json({ message: "productId required" });
      const r = await pool.query(`
        SELECT * FROM product_volume_offers
        WHERE product_id = $1
        ORDER BY min_quantity ASC, sort_order ASC
      `, [pid]);
      res.json(r.rows.map(mapRow));
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "خطأ" });
    }
  });

  app.post("/api/admin/volume-offers", requireAdmin, async (req, res) => {
    try {
      const b = req.body || {};
      const productId = parseInt(String(b.productId));
      const minQuantity = parseInt(String(b.minQuantity));
      const offerPriceYer = Number(b.offerPriceYer);
      if (!productId || !minQuantity || minQuantity < 1) {
        return res.status(400).json({ message: "productId + minQuantity ≥ 1 مطلوب" });
      }
      if (!Number.isFinite(offerPriceYer) || offerPriceYer < 0) {
        return res.status(400).json({ message: "offerPriceYer غير صالح" });
      }
      const maxQuantity = b.maxQuantity == null || b.maxQuantity === "" ? null : parseInt(String(b.maxQuantity));
      if (maxQuantity != null && maxQuantity < minQuantity) {
        return res.status(400).json({ message: "maxQuantity يجب أن يكون ≥ minQuantity" });
      }
      const r = await pool.query(`
        INSERT INTO product_volume_offers
          (product_id, min_quantity, max_quantity, offer_price_yer, original_price_yer,
           display_label, badge_text, has_free_shipping, shipping_fee_yer,
           marketer_commission_percent, is_active, sort_order)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING *
      `, [
        productId, minQuantity, maxQuantity, offerPriceYer,
        b.originalPriceYer == null || b.originalPriceYer === "" ? null : Number(b.originalPriceYer),
        b.displayLabel || null, b.badgeText || null,
        !!b.hasFreeShipping, Number(b.shippingFeeYer ?? 0),
        b.marketerCommissionPercent == null || b.marketerCommissionPercent === "" ? null : Number(b.marketerCommissionPercent),
        b.isActive !== false, parseInt(String(b.sortOrder ?? 0)) || 0,
      ]);
      res.status(201).json(r.rows.length > 0 ? mapRow(r.rows[0]) : null);
    } catch (e: any) {
      console.error("[volume-offers POST]", e?.message);
      res.status(500).json({ message: e?.message || "خطأ" });
    }
  });

  app.patch("/api/admin/volume-offers/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const b = req.body || {};
      const fields: string[] = []; const values: any[] = []; let i = 1;
      const add = (col: string, val: any) => { fields.push(`${col} = $${i++}`); values.push(val); };

      if (b.minQuantity !== undefined) add("min_quantity", parseInt(String(b.minQuantity)));
      if (b.maxQuantity !== undefined) add("max_quantity", b.maxQuantity === "" || b.maxQuantity == null ? null : parseInt(String(b.maxQuantity)));
      if (b.offerPriceYer !== undefined) add("offer_price_yer", Number(b.offerPriceYer));
      if (b.originalPriceYer !== undefined) add("original_price_yer", b.originalPriceYer === "" || b.originalPriceYer == null ? null : Number(b.originalPriceYer));
      if (b.displayLabel !== undefined) add("display_label", b.displayLabel || null);
      if (b.badgeText !== undefined) add("badge_text", b.badgeText || null);
      if (b.hasFreeShipping !== undefined) add("has_free_shipping", !!b.hasFreeShipping);
      if (b.shippingFeeYer !== undefined) add("shipping_fee_yer", Number(b.shippingFeeYer ?? 0));
      if (b.marketerCommissionPercent !== undefined) add("marketer_commission_percent", b.marketerCommissionPercent === "" || b.marketerCommissionPercent == null ? null : Number(b.marketerCommissionPercent));
      if (b.isActive !== undefined) add("is_active", !!b.isActive);
      if (b.sortOrder !== undefined) add("sort_order", parseInt(String(b.sortOrder)) || 0);

      if (fields.length === 0) return res.status(400).json({ message: "لا حقول للتعديل" });
      values.push(id);
      const r = await pool.query(`UPDATE product_volume_offers SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`, values);
      if (r.rows.length === 0) return res.status(404).json({ message: "غير موجود" });
      res.json(mapRow(r.rows[0]));
    } catch (e: any) {
      console.error("[volume-offers PATCH]", e?.message);
      res.status(500).json({ message: e?.message || "خطأ" });
    }
  });

  app.delete("/api/admin/volume-offers/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await pool.query(`DELETE FROM product_volume_offers WHERE id = $1`, [id]);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "خطأ" });
    }
  });
}
