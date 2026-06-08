import type { Express } from "express";

/**
 * نظام السيولة والأتمتة (معاينة) — نقاط نهاية للقراءة فقط (Read-Only).
 * إضافية بالكامل: لا تعدّل أي نقطة نهاية قائمة، ولا تكتب أي بيانات.
 * تربط المعاينة بقاعدة البيانات الحقيقية حيثما توفّرت (الطلبات/المبيعات/الموردين/المخزون)،
 * وتعرض المصادر المالية (بنوك/كاش/خزينة) ببيانات تمثيلية معلّمة (placeholder) لعدم وجود جداول لها بعد.
 */

const AR_STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: "جديد", tone: "new" },
  deposit_paid: { label: "مؤكد", tone: "confirmed" },
  processing: { label: "قيد المعالجة", tone: "processing" },
  shipped: { label: "قيد الشحن", tone: "shipping" },
  delivered: { label: "مسلّم", tone: "delivered" },
  completed: { label: "مكتمل", tone: "completed" },
  cancelled: { label: "ملغي", tone: "cancelled" },
};

function num(v: any): number {
  const n = parseFloat(String(v ?? "0"));
  return isNaN(n) ? 0 : n;
}

/**
 * إخفاء جزئي لاسم العميل لحماية الخصوصية في وضع المعاينة (نقطة نهاية عامة).
 * يُبقي الاسم الأول كاملاً ويختصر باقي الأجزاء لحرفها الأول. مثال: "محمد علي" → "محمد ع."
 */
function maskName(raw: any): string {
  const name = String(raw ?? "").trim();
  if (!name) return "عميل";
  const parts = name.split(/\s+/);
  const first = parts[0];
  if (parts.length === 1) return first;
  const rest = parts.slice(1).map((p) => (p[0] ? p[0] + "." : "")).join(" ");
  return `${first} ${rest}`.trim();
}

export function registerLiquidityPreviewRoutes(app: Express): void {
  app.get("/api/liquidity-preview", async (_req, res) => {
    const { pool } = await import("../db");

    const out: any = {
      generatedAt: new Date().toISOString(),
      // مصادر السيولة — بيانات تمثيلية (لا توجد جداول أرصدة بنوك/كاش بعد)
      isPlaceholderLiquidity: true,
      liquiditySources: [
        { id: "rajhi", name: "بنك الراجحي", kind: "bank", balance: 142500, icon: "bank-blue" },
        { id: "ahli", name: "بنك الأهلي", kind: "bank", balance: 88200, icon: "bank-green" },
        { id: "stcpay", name: "STC Pay", kind: "wallet", balance: 12400, icon: "wallet-purple" },
        { id: "cash", name: "الكاش", kind: "treasury", balance: 15400, icon: "cash-amber" },
        { id: "treasury", name: "خزينة المعرض", kind: "treasury", balance: 220000, icon: "cash-amber" },
      ],
    };

    // ─── الطلبات + إحصاءاتها ─────────────────────────────────────────────
    try {
      const ordersRes = await pool.query(
        `SELECT o.id, o.customer_name, o.shipping_city, o.total, o.currency,
                o.status, o.created_at,
                (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
           FROM orders o
          ORDER BY o.created_at DESC NULLS LAST
          LIMIT 60`
      );
      const list = ordersRes.rows.map((r: any) => {
        const meta = AR_STATUS[r.status] || { label: r.status || "—", tone: "new" };
        return {
          id: r.id,
          code: `ORD-${String(r.id).padStart(5, "0")}`,
          customerName: maskName(r.customer_name),
          city: r.shipping_city || "",
          total: num(r.total),
          currency: r.currency || "YER",
          status: r.status,
          statusLabel: meta.label,
          statusTone: meta.tone,
          itemCount: Number(r.item_count || 0),
          createdAt: r.created_at,
        };
      });

      const byStatus: Record<string, number> = {};
      for (const o of list) byStatus[o.status] = (byStatus[o.status] || 0) + 1;
      const delivered = (byStatus["delivered"] || 0) + (byStatus["completed"] || 0);
      const processing =
        (byStatus["processing"] || 0) + (byStatus["deposit_paid"] || 0) + (byStatus["shipped"] || 0);

      out.orders = {
        list,
        stats: { total: list.length, delivered, processing, byStatus },
      };
    } catch (e: any) {
      out.orders = { list: [], stats: { total: 0, delivered: 0, processing: 0, byStatus: {} }, error: true };
    }

    // ─── المبيعات (اليوم/أمس) + أفضل المنتجات ────────────────────────────
    try {
      const salesRes = await pool.query(
        `SELECT
            COALESCE(SUM(CASE WHEN created_at::date = CURRENT_DATE THEN total::numeric END), 0) AS today,
            COALESCE(SUM(CASE WHEN created_at::date = CURRENT_DATE - 1 THEN total::numeric END), 0) AS yesterday,
            COALESCE(SUM(total::numeric), 0) AS all_time
           FROM orders
          WHERE status <> 'cancelled'`
      );
      const topRes = await pool.query(
        `SELECT COALESCE(oi.product_name, p.name, 'منتج') AS name,
                SUM(oi.quantity) AS qty,
                SUM(oi.price::numeric * oi.quantity) AS total
           FROM order_items oi
           LEFT JOIN products p ON p.id = oi.product_id
          GROUP BY COALESCE(oi.product_name, p.name, 'منتج')
          ORDER BY qty DESC
          LIMIT 6`
      );
      out.sales = {
        today: num(salesRes.rows[0]?.today),
        yesterday: num(salesRes.rows[0]?.yesterday),
        allTime: num(salesRes.rows[0]?.all_time),
        topProducts: topRes.rows.map((r: any) => ({
          name: r.name,
          qty: Number(r.qty || 0),
          total: num(r.total),
        })),
      };
    } catch (e: any) {
      out.sales = { today: 0, yesterday: 0, allTime: 0, topProducts: [], error: true };
    }

    // ─── الموردون ────────────────────────────────────────────────────────
    try {
      const supRes = await pool.query(
        `SELECT name, total_sales, balance_due, total_paid
           FROM suppliers
          WHERE is_active = true
          ORDER BY total_sales::numeric DESC NULLS LAST
          LIMIT 20`
      );
      const list = supRes.rows.map((r: any) => ({
        name: r.name,
        totalSales: num(r.total_sales),
        balanceDue: num(r.balance_due),
        totalPaid: num(r.total_paid),
      }));
      out.suppliers = {
        count: list.length,
        totalDue: list.reduce((s: number, x: any) => s + x.balanceDue, 0),
        list,
      };
    } catch (e: any) {
      out.suppliers = { count: 0, totalDue: 0, list: [], error: true };
    }

    // ─── المخزون المنخفض ─────────────────────────────────────────────────
    try {
      const invRes = await pool.query(
        `SELECT name, stock, reorder_point
           FROM products
          WHERE is_active = true AND stock <= COALESCE(reorder_point, 10)
          ORDER BY stock ASC
          LIMIT 20`
      );
      out.inventory = {
        lowStockCount: invRes.rows.length,
        lowStock: invRes.rows.map((r: any) => ({
          name: r.name,
          stock: Number(r.stock || 0),
          reorderPoint: Number(r.reorder_point || 0),
        })),
      };
    } catch (e: any) {
      out.inventory = { lowStockCount: 0, lowStock: [], error: true };
    }

    // ─── العملاء المتأخرون عن السداد (ائتمان) — اشتقاق تقريبي من الطلبات غير المدفوعة ──
    try {
      const credRes = await pool.query(
        `SELECT customer_name, COUNT(*) AS orders_count, COALESCE(SUM(total::numeric),0) AS amount
           FROM orders
          WHERE payment_status = 'unpaid'
            AND status NOT IN ('cancelled', 'delivered', 'completed')
            AND created_at < CURRENT_DATE - 3
            AND customer_name IS NOT NULL
          GROUP BY customer_name
          ORDER BY amount DESC
          LIMIT 12`
      );
      out.credit = {
        lateCount: credRes.rows.length,
        lateCustomers: credRes.rows.map((r: any) => ({
          name: maskName(r.customer_name),
          ordersCount: Number(r.orders_count || 0),
          amount: num(r.amount),
        })),
      };
    } catch (e: any) {
      out.credit = { lateCount: 0, lateCustomers: [], error: true };
    }

    res.set("Cache-Control", "no-store");
    res.json(out);
  });
}
