/**
 * مسارات أوامر الشراء (Purchase Orders) — المرحلة 1, مايو 2026
 *
 * - GET    /api/admin/vendors                       قائمة الموردين (type=vendor|both)
 * - GET    /api/admin/purchase-orders               قائمة أوامر الشراء
 * - GET    /api/admin/purchase-orders/:id           تفاصيل أمر شراء + عناصره
 * - POST   /api/admin/purchase-orders               إنشاء أمر شراء جديد (مع عناصره)
 * - PATCH  /api/admin/purchase-orders/:id           تعديل (للحالة draft فقط)
 * - DELETE /api/admin/purchase-orders/:id           حذف (للحالة draft/cancelled فقط)
 * - POST   /api/admin/purchase-orders/:id/receive   استلام كامل/جزئي → تحديث المخزون + WAC
 */
import type { Express, Request, Response, NextFunction } from "express";
import { pool } from "../db";

type Admin = (req: Request, res: Response, next: NextFunction) => void;

// توليد رقم PO تلقائي (PO-2026-001)
async function generatePoNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const r = await pool.query(
    `SELECT COUNT(*)::int AS n FROM purchase_orders WHERE po_number LIKE $1`,
    [`PO-${year}-%`]
  );
  const next = (r.rows[0]?.n || 0) + 1;
  return `PO-${year}-${String(next).padStart(3, "0")}`;
}

export function registerPurchaseOrderRoutes(app: Express, requireAdmin: Admin) {
  // ─── قائمة الموردين (vendors) لاختيارهم في أمر الشراء ──────────────
  app.get("/api/admin/vendors", requireAdmin, async (_req, res) => {
    try {
      const r = await pool.query(
        `SELECT id, name, phone, email, type, is_active FROM suppliers
         WHERE is_active=true AND type IN ('vendor','both')
         ORDER BY name`
      );
      res.json(r.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب الموردين", details: e.message });
    }
  });

  // ─── قائمة أوامر الشراء ───────────────────────────────────────────────
  app.get("/api/admin/purchase-orders", requireAdmin, async (req, res) => {
    try {
      const { status } = req.query;
      const conds: string[] = [];
      const params: any[] = [];
      if (status && typeof status === "string" && status !== "all") {
        params.push(status);
        conds.push(`po.status = $${params.length}`);
      }
      const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
      const r = await pool.query(
        `SELECT po.*, s.name AS supplier_name, s.phone AS supplier_phone,
                (SELECT COUNT(*)::int FROM purchase_order_items WHERE purchase_order_id=po.id) AS items_count
         FROM purchase_orders po
         LEFT JOIN suppliers s ON s.id = po.supplier_id
         ${where}
         ORDER BY po.id DESC
         LIMIT 200`,
        params
      );
      res.json(r.rows);
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب أوامر الشراء", details: e.message });
    }
  });

  // ─── تفاصيل أمر شراء + عناصره ─────────────────────────────────────────
  app.get("/api/admin/purchase-orders/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "id غير صالح" });

      const poR = await pool.query(
        `SELECT po.*, s.name AS supplier_name, s.phone AS supplier_phone
         FROM purchase_orders po
         LEFT JOIN suppliers s ON s.id = po.supplier_id
         WHERE po.id = $1`,
        [id]
      );
      if (!poR.rows.length) return res.status(404).json({ message: "أمر الشراء غير موجود" });

      const itemsR = await pool.query(
        `SELECT poi.*, p.name AS product_name, p.image_url AS product_image_url, p.stock AS product_stock
         FROM purchase_order_items poi
         LEFT JOIN products p ON p.id = poi.product_id
         WHERE poi.purchase_order_id = $1
         ORDER BY poi.id`,
        [id]
      );
      res.json({ ...poR.rows[0], items: itemsR.rows });
    } catch (e: any) {
      res.status(500).json({ message: "فشل جلب أمر الشراء", details: e.message });
    }
  });

  // ─── إنشاء أمر شراء (مع عناصره) ───────────────────────────────────────
  app.post("/api/admin/purchase-orders", requireAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
      const {
        supplierId,
        supplierNameSnapshot,
        currency = "YER",
        shippingCost = 0,
        notes,
        items, // [{ productId, productNameSnapshot, variantLabel, quantityOrdered, unitCost }]
      } = req.body || {};

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "أضف منتجاً واحداً على الأقل" });
      }

      // حساب الإجماليات
      let subtotal = 0;
      const cleanItems = items.map((it: any) => {
        const qty = Math.max(1, Number(it.quantityOrdered) || 0);
        const cost = Math.max(0, Number(it.unitCost) || 0);
        const line = qty * cost;
        subtotal += line;
        return {
          productId: it.productId ? Number(it.productId) : null,
          productNameSnapshot: it.productNameSnapshot || null,
          variantLabel: it.variantLabel || null,
          quantityOrdered: qty,
          unitCost: cost,
          lineTotal: line,
        };
      });
      const total = subtotal + Number(shippingCost || 0);

      // معرف المنشئ
      const user = (req as any).user;
      const createdBy = user?.claims?.sub ?? user?.id ?? null;

      await client.query("BEGIN");
      const poNumber = await generatePoNumber();

      const poInsert = await client.query(
        `INSERT INTO purchase_orders
         (po_number, supplier_id, supplier_name_snapshot, status, subtotal, shipping_cost, total, currency, notes, created_by)
         VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [poNumber, supplierId || null, supplierNameSnapshot || null, subtotal, shippingCost, total, currency, notes || null, createdBy]
      );
      const po = poInsert.rows[0];

      for (const it of cleanItems) {
        await client.query(
          `INSERT INTO purchase_order_items
           (purchase_order_id, product_id, product_name_snapshot, variant_label, quantity_ordered, unit_cost, line_total)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [po.id, it.productId, it.productNameSnapshot, it.variantLabel, it.quantityOrdered, it.unitCost, it.lineTotal]
        );
      }

      await client.query("COMMIT");
      res.status(201).json(po);
    } catch (e: any) {
      await client.query("ROLLBACK").catch(() => {});
      res.status(500).json({ message: "فشل إنشاء أمر الشراء", details: e.message });
    } finally {
      client.release();
    }
  });

  // ─── تعديل أمر شراء (في حالة draft فقط) ───────────────────────────────
  app.patch("/api/admin/purchase-orders/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { status, notes, supplierId } = req.body || {};

      // إذا تغيير status فقط (sent/cancelled) من draft → السماح
      const cur = await pool.query(`SELECT status FROM purchase_orders WHERE id=$1`, [id]);
      if (!cur.rows.length) return res.status(404).json({ message: "غير موجود" });
      const curStatus = cur.rows[0].status;

      if (status && !["draft", "sent", "cancelled"].includes(status)) {
        return res.status(400).json({ message: "لتغيير الحالة لـ received استخدم /receive" });
      }
      if (curStatus === "received") {
        return res.status(400).json({ message: "لا يمكن تعديل أمر شراء مستلَم" });
      }
      // إصلاح Bug #3: منع state machine عكسي (sent/partial → draft)
      if (status === "draft" && curStatus !== "draft") {
        return res.status(400).json({ message: "لا يمكن إعادة أمر شراء إلى مسودة" });
      }
      // إصلاح Bug #3: منع إلغاء PO تم استلامها جزئياً (لتجنب stock وهمي + WAC غير قابل للعكس)
      if (status === "cancelled") {
        const partialCheck = await pool.query(
          `SELECT COALESCE(SUM(quantity_received), 0)::int AS received_total
           FROM purchase_order_items WHERE purchase_order_id=$1`,
          [id]
        );
        if ((partialCheck.rows[0]?.received_total || 0) > 0) {
          return res.status(400).json({
            message: "لا يمكن إلغاء أمر شراء استُلِم جزئياً. أنشئ مرتجع يدوي أو اتصل بالدعم."
          });
        }
      }

      const sets: string[] = [];
      const params: any[] = [];
      if (status !== undefined) { params.push(status); sets.push(`status=$${params.length}`); }
      if (notes !== undefined) { params.push(notes); sets.push(`notes=$${params.length}`); }
      if (supplierId !== undefined && curStatus === "draft") {
        params.push(supplierId);
        sets.push(`supplier_id=$${params.length}`);
      }
      if (!sets.length) return res.json({ ok: true, message: "لا تغيير" });

      params.push(id);
      const r = await pool.query(
        `UPDATE purchase_orders SET ${sets.join(", ")} WHERE id=$${params.length} RETURNING *`,
        params
      );
      res.json(r.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: "فشل التعديل", details: e.message });
    }
  });

  // ─── حذف أمر شراء (draft/cancelled فقط) ───────────────────────────────
  app.delete("/api/admin/purchase-orders/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const r = await pool.query(`SELECT status FROM purchase_orders WHERE id=$1`, [id]);
      if (!r.rows.length) return res.status(404).json({ message: "غير موجود" });
      if (!["draft", "cancelled"].includes(r.rows[0].status)) {
        return res.status(400).json({ message: "لا يمكن حذف أمر مستلَم أو مُرسَل" });
      }
      await pool.query(`DELETE FROM purchase_orders WHERE id=$1`, [id]);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: "فشل الحذف", details: e.message });
    }
  });

  // ─── استلام أمر شراء — تحديث المخزون + WAC ───────────────────────────
  // البديل المُبسَّط للـ MVP: يطبّق WAC على مستوى المنتج وعلى الـ variant المطابق إن وُجد.
  // الصيغة: new_cost = (old_stock × old_avg_cost + recv_qty × unit_cost) / (old_stock + recv_qty)
  app.post("/api/admin/purchase-orders/:id/receive", requireAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
      const id = Number(req.params.id);
      // receipts: [{ itemId, quantityReceived }]  — أو فارغ يعني "استلم الكل"
      const { receipts } = req.body || {};

      await client.query("BEGIN");
      const poR = await client.query(`SELECT * FROM purchase_orders WHERE id=$1 FOR UPDATE`, [id]);
      if (!poR.rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ message: "غير موجود" }); }
      const po = poR.rows[0];
      if (po.status === "received") {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "تم استلام هذا الأمر مسبقاً" });
      }
      if (po.status === "cancelled") {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "أمر ملغى — لا يمكن استلامه" });
      }

      // اقفل صفوف المنتجات المتأثرة لمنع race condition على JSON smart_variants
      const itemsR = await client.query(
        `SELECT poi.*, p.stock AS product_stock, p.enable_smart_variants, p.smart_variants
         FROM purchase_order_items poi
         LEFT JOIN products p ON p.id = poi.product_id
         WHERE poi.purchase_order_id = $1
         ORDER BY poi.id
         FOR UPDATE OF poi, p`,
        [id]
      );

      // map: itemId → recvQty
      const recvMap = new Map<number, number>();
      if (Array.isArray(receipts) && receipts.length) {
        for (const r of receipts) {
          recvMap.set(Number(r.itemId), Math.max(0, Number(r.quantityReceived) || 0));
        }
      }

      const wacReport: any[] = [];
      let allFull = true;
      let totalReceivedCost = 0; // إصلاح Bug #1: مجموع تكاليف الدفعة الحالية لتحديث balance_due

      for (const it of itemsR.rows) {
        const remaining = it.quantity_ordered - it.quantity_received;
        let recvQty = recvMap.has(it.id)
          ? recvMap.get(it.id)!
          : remaining; // افتراضياً: الباقي
        // حماية ضد الاستلام الزائد على المستوى الخادم
        if (recvQty > remaining) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            message: `الكمية المستلَمة (${recvQty}) تتجاوز المتبقي (${remaining}) للعنصر #${it.id}`,
          });
        }
        if (recvQty <= 0) continue;
        if (it.quantity_received + recvQty < it.quantity_ordered) allFull = false;
        if (!it.product_id) {
          // إصلاح Bug #1: حتى عنصر بدون منتج له تكلفة للمورد
          totalReceivedCost += recvQty * (Number(it.unit_cost) || 0);
          await client.query(
            `UPDATE purchase_order_items SET quantity_received = quantity_received + $1 WHERE id = $2`,
            [recvQty, it.id]
          );
          continue;
        }

        const unitCost = Number(it.unit_cost) || 0;
        const oldStock = Math.max(0, Number(it.product_stock) || 0);
        totalReceivedCost += recvQty * unitCost; // إصلاح Bug #1

        // ── (1) حدّث WAC على الـ variant إن وُجد، وإلا على المنتج ككل ──
        let oldAvgCost = 0;
        let newAvgCost = 0;
        let updatedVariantLabel: string | null = null;
        let wacWarning: string | null = null; // إصلاح Bug #4

        if (it.enable_smart_variants && it.smart_variants && it.variant_label) {
          let sv: any = null;
          try { sv = typeof it.smart_variants === "string" ? JSON.parse(it.smart_variants) : it.smart_variants; } catch {}
          if (sv && Array.isArray(sv.variants)) {
            const idx = sv.variants.findIndex((v: any) =>
              String(v.label || "").trim() === String(it.variant_label).trim()
            );
            if (idx >= 0) {
              const v = sv.variants[idx];
              oldAvgCost = parseFloat(String(v.costPriceY ?? "")) || 0;
              const denom = oldStock + recvQty;
              newAvgCost = denom > 0 ? (oldStock * oldAvgCost + recvQty * unitCost) / denom : unitCost;
              sv.variants[idx] = { ...v, costPriceY: String(Math.round(newAvgCost * 100) / 100) };
              updatedVariantLabel = v.label;
              await client.query(
                `UPDATE products SET smart_variants = $1 WHERE id = $2`,
                [JSON.stringify(sv), it.product_id]
              );
            } else {
              // إصلاح Bug #4: المتغيّر غير موجود — WAC لم يُحدَّث
              wacWarning = `المتغيّر "${it.variant_label}" غير موجود في المنتج — WAC لم يُحدَّث (المخزون فقط)`;
            }
          } else {
            wacWarning = "smart_variants غير صالح JSON — WAC لم يُحدَّث";
          }
        } else if (it.variant_label && !it.enable_smart_variants) {
          wacWarning = "المنتج لا يستخدم Smart Variants — variant_label تُجوهل";
        } else if (!it.variant_label && it.enable_smart_variants) {
          wacWarning = "المنتج يستخدم Smart Variants لكن لم يُحدَّد variant_label — WAC لم يُحدَّث";
        }

        // ── (2) زيادة المخزون على المنتج ──
        await client.query(
          `UPDATE products SET stock = COALESCE(stock,0) + $1 WHERE id = $2`,
          [recvQty, it.product_id]
        );

        // ── (3) تحديث quantity_received على العنصر ──
        await client.query(
          `UPDATE purchase_order_items SET quantity_received = quantity_received + $1 WHERE id = $2`,
          [recvQty, it.id]
        );

        wacReport.push({
          productId: it.product_id,
          productName: it.product_name_snapshot,
          variantLabel: updatedVariantLabel,
          oldStock,
          recvQty,
          oldAvgCost: Math.round(oldAvgCost * 100) / 100,
          unitCost,
          newAvgCost: updatedVariantLabel ? Math.round(newAvgCost * 100) / 100 : null,
          newStock: oldStock + recvQty,
          wacWarning, // إصلاح Bug #4: تحذير صريح في التقرير
        });
      }

      // ── (4) تحديث حالة أمر الشراء ──
      const newStatus = allFull ? "received" : "partial";
      await client.query(
        `UPDATE purchase_orders
         SET status=$1, received_at=CASE WHEN $1='received' THEN NOW() ELSE received_at END
         WHERE id=$2`,
        [newStatus, id]
      );

      // ── (5) إصلاح Bug #1: تحديث رصيد المورد (vendor balance_due) ──
      // نزيد balance_due بقيمة البضاعة المستلَمة في هذه الدفعة فقط
      // (الشحن لا يُضاف هنا — يُسوّى يدوياً عبر دفعة منفصلة عند الحاجة)
      if (po.supplier_id && totalReceivedCost > 0) {
        await client.query(
          `UPDATE suppliers SET balance_due = COALESCE(balance_due, 0) + $1 WHERE id = $2`,
          [totalReceivedCost.toFixed(2), po.supplier_id]
        );
      }

      await client.query("COMMIT");
      res.json({
        ok: true,
        status: newStatus,
        wacReport,
        vendorBalanceAdded: totalReceivedCost, // إصلاح Bug #1: للعرض في الواجهة
      });
    } catch (e: any) {
      await client.query("ROLLBACK").catch(() => {});
      res.status(500).json({ message: "فشل الاستلام", details: e.message });
    } finally {
      client.release();
    }
  });
}
