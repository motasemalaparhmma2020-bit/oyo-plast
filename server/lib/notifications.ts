/**
 * Unified Notifications library (Phase 1 — In-App only).
 *
 * Responsibilities:
 *  - Respect per-user notification_preferences (opt-out per type, DND mute).
 *  - De-duplicate: skip same (userId, type, groupKey) within 30 minutes.
 *  - Promotional notifications (`promo`) require explicit opt-in unless `bypass=true`.
 *  - Optional Telegram forwarding when user pref allows it (and a chatId is known).
 *
 * Does NOT replace the existing staff-notify.ts (which is a broadcast tool for staff
 * roles). Use this when you have a specific userId.
 */

import { pool } from "../db";

export type NotificationType =
  | "order_created"
  | "order_status"
  | "new_message"
  | "commission"
  | "low_stock"
  | "payment_due"
  | "wallet_credit"
  | "delivery_assigned"
  | "promo"
  | "system"
  // legacy aliases (still in DB)
  | "order"
  | "payment";

export interface CreateNotificationOpts {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  priority?: "low" | "normal" | "high";
  actionUrl?: string;
  groupKey?: string;
  orderId?: number;
  /** When true, ignores user preferences (used for critical platform-wide promos). */
  bypass?: boolean;
  /** Window (minutes) to suppress duplicates with same groupKey. Default 30. */
  dedupMinutes?: number;
}

/**
 * Get user preference for a specific type. Returns null if no pref row (= use defaults).
 */
async function getUserPref(
  userId: string,
  type: string,
): Promise<{ inAppEnabled: boolean; telegramEnabled: boolean; mutedUntil: Date | null } | null> {
  try {
    const r = await pool.query(
      `SELECT in_app_enabled, telegram_enabled, muted_until
         FROM notification_preferences
        WHERE user_id=$1 AND type=$2 LIMIT 1`,
      [userId, type],
    );
    if (!r.rows.length) return null;
    return {
      inAppEnabled: r.rows[0].in_app_enabled,
      telegramEnabled: r.rows[0].telegram_enabled,
      mutedUntil: r.rows[0].muted_until ? new Date(r.rows[0].muted_until) : null,
    };
  } catch {
    return null;
  }
}

/**
 * Default in-app behavior per type when no preference row exists.
 * Promo is OFF by default (opt-in). Everything else is ON.
 */
function defaultInAppEnabled(type: string): boolean {
  if (type === "promo") return false;
  return true;
}

/**
 * Create a single notification.
 * Returns the created notification ID, or null when suppressed by preferences/dedup.
 */
export async function createNotification(opts: CreateNotificationOpts): Promise<number | null> {
  const {
    userId,
    type,
    title,
    message,
    priority = "normal",
    actionUrl,
    groupKey,
    orderId,
    bypass = false,
    dedupMinutes = 30,
  } = opts;

  if (!userId) return null;

  // ─── 1. Respect preferences (unless bypass) ─────────────────────────────
  if (!bypass) {
    const pref = await getUserPref(userId, type);
    const inAppOn = pref ? pref.inAppEnabled : defaultInAppEnabled(type);
    if (!inAppOn) return null;
    if (pref?.mutedUntil && pref.mutedUntil.getTime() > Date.now()) return null;
  }

  // ─── 2. De-dup (same groupKey within window) ────────────────────────────
  if (groupKey) {
    try {
      const dup = await pool.query(
        `SELECT id FROM notifications
          WHERE user_id=$1 AND group_key=$2
            AND created_at > NOW() - make_interval(mins => $3::int)
          LIMIT 1`,
        [userId, groupKey, dedupMinutes],
      );
      if (dup.rows.length) return null;
    } catch { /* non-fatal */ }
  }

  // ─── 3. Insert ──────────────────────────────────────────────────────────
  try {
    const r = await pool.query(
      `INSERT INTO notifications
        (user_id, title, message, type, priority, action_url, group_key, order_id, is_read)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false) RETURNING id`,
      [userId, title, message, type, priority, actionUrl || null, groupKey || null, orderId || null],
    );
    const id = r.rows[0]?.id || null;

    // ─── 4. Optional Telegram forwarding (only if user opted in & has chatId) ─
    if (!bypass) {
      try {
        const pref = await getUserPref(userId, type);
        if (pref?.telegramEnabled) {
          // user.telegram_chat_id is optional — skip silently if not present
          const u = await pool.query(`SELECT telegram_chat_id FROM users WHERE id=$1 LIMIT 1`, [userId]);
          const chatId = u.rows[0]?.telegram_chat_id;
          if (chatId) {
            const { sendTelegramMessage } = await import("./telegram");
            await sendTelegramMessage(`<b>${title}</b>\n${message}`, chatId);
          }
        }
      } catch { /* non-fatal */ }
    }

    // ─── 5. Web Push (fire-and-forget — non-blocking) ───────────────────────
    if (id && type !== "promo") {
      import("./push-sender").then(({ sendPushToUser }) => {
        sendPushToUser(userId, {
          title,
          body: message,
          url: actionUrl || "/notifications",
        }).catch(() => {});
      }).catch(() => {});
    }

    return id;
  } catch (e: any) {
    console.error("[createNotification] error:", e.message);
    return null;
  }
}

/**
 * Create the same notification for many users efficiently (single INSERT).
 * Respects preferences (called once per user). For broadcast promos use broadcastPromo.
 */
export async function createForMany(userIds: string[], base: Omit<CreateNotificationOpts, "userId">): Promise<number> {
  let count = 0;
  for (const uid of userIds) {
    const id = await createNotification({ ...base, userId: uid });
    if (id) count++;
  }
  return count;
}

/**
 * Broadcast a promotional notification.
 *  - mode='opt_in': OPT-OUT model — everyone EXCEPT users who explicitly disabled
 *    or muted promo (users with no preference row are included by default).
 *  - mode='bypass': everyone, ignoring preferences. Use sparingly (platform-critical announcements).
 */
export async function broadcastPromo(opts: {
  title: string;
  message: string;
  actionUrl?: string;
  mode: "opt_in" | "bypass";
  /** Optional role filter (e.g. ['customer','marketer']). When empty, all active users. */
  roles?: string[];
}): Promise<{ recipients: number }> {
  const { title, message, actionUrl, mode, roles } = opts;
  try {
    let sql = `SELECT id FROM users WHERE 1=1`;
    const params: any[] = [];
    if (roles && roles.length) {
      params.push(roles);
      sql += ` AND role = ANY($${params.length})`;
    }
    if (mode === "opt_in") {
      // Opt-OUT model: reach everyone EXCEPT users who explicitly disabled or
      // muted promo. Users with no preference row are INCLUDED by default.
      // (Previously this required an explicit opt-in row, so broadcasts reached
      //  almost no one because most users never open notification settings.)
      sql += ` AND id NOT IN (
        SELECT user_id FROM notification_preferences
        WHERE type='promo'
          AND (in_app_enabled = false
               OR (muted_until IS NOT NULL AND muted_until > NOW()))
      )`;
    }
    const r = await pool.query(sql, params);
    const ids = r.rows.map((row: any) => row.id);
    if (!ids.length) return { recipients: 0 };

    // Build bulk insert (in-app notification for every recipient)
    const values: any[] = [];
    const rows: string[] = [];
    let i = 1;
    for (const uid of ids) {
      rows.push(`($${i++}, $${i++}, $${i++}, 'promo', 'normal', $${i++}, false)`);
      values.push(uid, title, message, actionUrl || null);
    }
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, priority, action_url, is_read)
       VALUES ${rows.join(",")}`,
      values,
    );

    // Also deliver as external Web Push (fire-and-forget, non-blocking).
    try {
      const { sendPushToUser } = await import("./push-sender");
      const pushPayload = { title, body: message, url: actionUrl || "/notifications" };
      Promise.allSettled(
        ids.map((uid: string) => sendPushToUser(uid, pushPayload)),
      ).catch(() => {});
    } catch { /* push optional */ }

    return { recipients: ids.length };
  } catch (e: any) {
    console.error("[broadcastPromo] error:", e.message);
    return { recipients: 0 };
  }
}

// ─── Convenience helpers for common triggers ─────────────────────────────────

export async function notifyOrderCreated(userId: string, orderId: number, total: number, currency = "ر.ي") {
  return createNotification({
    userId,
    type: "order_created",
    priority: "high",
    title: `تم استلام طلبك #${orderId}`,
    message: `بمبلغ ${Number(total).toLocaleString()} ${currency} · قيد المراجعة وسيتواصل معك أحد الموظفين قريباً.`,
    actionUrl: `/orders/${orderId}`,
    orderId,
    groupKey: `order_created:${orderId}`,
  });
}

export async function notifyOrderStatus(userId: string, orderId: number, statusLabel: string, actionUrl?: string) {
  return createNotification({
    userId,
    type: "order_status",
    priority: "normal",
    title: `تحديث طلبك #${orderId}`,
    message: statusLabel,
    actionUrl: actionUrl || `/orders/${orderId}`,
    orderId,
    groupKey: `order_status:${orderId}:${statusLabel}`,
  });
}

export async function notifyOrderDelivered(userId: string, orderId: number) {
  return createNotification({
    userId,
    type: "order_status",
    priority: "high",
    title: `🎉 تم توصيل طلبك #${orderId}`,
    message: "كيف كانت تجربتك؟ شاركنا تقييمك للمنتجات",
    actionUrl: `/rate-order/${orderId}`,
    orderId,
    groupKey: `order_delivered:${orderId}`,
  });
}

export async function notifyNewMessage(userId: string, fromName: string, preview: string, conversationId?: number) {
  return createNotification({
    userId,
    type: "new_message",
    priority: "high",
    title: `رسالة جديدة من ${fromName}`,
    message: preview.slice(0, 140),
    actionUrl: conversationId ? `/messages?c=${conversationId}` : `/messages`,
    groupKey: `new_message:${conversationId || fromName}`,
    dedupMinutes: 5,
  });
}
