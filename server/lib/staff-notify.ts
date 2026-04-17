/**
 * Staff notification helper.
 *
 * Creates rows in the `notifications` DB table (one per matching staff user)
 * AND fires off a Telegram message to the staff chat (if configured).
 *
 * Roles supported: order_manager, finance, owner, product_manager, delivery
 */

import { sendTelegramMessage } from "./telegram";

type StaffRole = "order_manager" | "finance" | "owner" | "product_manager" | "delivery";

export async function notifyStaff(opts: {
  roles: StaffRole[];
  title: string;
  message: string;
  type?: "order" | "payment" | "system";
  orderId?: number;
  telegramText?: string; // optional override; defaults to `${title}\n${message}`
}): Promise<void> {
  const { roles, title, message, type = "order", orderId, telegramText } = opts;

  // ─── 1. DB notifications (one per staff user) ───────────────
  try {
    const { pool } = await import("../db");
    const placeholders = roles.map((_, i) => `$${i + 1}`).join(",");
    const userRes = await pool.query(
      `SELECT id FROM users WHERE role IN (${placeholders})`,
      roles
    );
    if (userRes.rows.length > 0) {
      const values: any[] = [];
      const rowSql: string[] = [];
      let i = 1;
      for (const u of userRes.rows) {
        rowSql.push(`($${i++}, $${i++}, $${i++}, $${i++}, $${i++})`);
        values.push(u.id, title, message, type, orderId || null);
      }
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, order_id) VALUES ${rowSql.join(",")}`,
        values
      );
    }
  } catch (e: any) {
    console.error("notifyStaff DB error:", e.message);
  }

  // ─── 2. Telegram (single broadcast to staff chat) ───────────
  try {
    const tgText = telegramText || `<b>${title}</b>\n${message}`;
    await sendTelegramMessage(tgText);
  } catch (e: any) {
    console.error("notifyStaff Telegram error:", e.message);
  }
}
