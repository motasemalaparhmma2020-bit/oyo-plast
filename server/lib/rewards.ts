/**
 * Unified rewards helpers — the customer rewards loop.
 *
 * Single source of truth for loyalty points + customer-to-customer referral payouts.
 * Every grant is idempotent and race-safe (transaction + advisory lock), so the same
 * reward is never paid twice even if the trigger fires from multiple lifecycle points
 * (order confirmation AND a later "delivered" transition).
 *
 * All user IDs are VARCHAR (UUID) — always pass them as strings, never Number().
 */

import { pool } from "../db";

function normPhone(v: any): string {
  return String(v || "").replace(/\D/g, "");
}

/**
 * Award loyalty points exactly once.
 *
 * Dedup scope:
 *  - when `orderId` is provided → unique on (order_id, type)
 *  - otherwise → unique on (user_id, type)  [e.g. one welcome bonus per user]
 *
 * Returns true if points were granted, false if skipped (already granted / invalid).
 */
export async function awardPointsOnce(opts: {
  userId: string;
  points: number;
  type: string;
  description: string;
  orderId?: number | null;
  reviewId?: number | null;
}): Promise<boolean> {
  const userId = String(opts.userId || "");
  const points = Math.floor(Number(opts.points) || 0);
  const type = opts.type;
  const description = opts.description;
  const orderId = opts.orderId ?? null;
  const reviewId = opts.reviewId ?? null;
  if (!userId || points <= 0 || !type) return false;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Serialize concurrent grants for the same scope to close the check-then-insert race.
    const lockKey = `pts:${type}:${orderId != null ? "o" + orderId : "u" + userId}`;
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [lockKey]);

    const exists = orderId != null
      ? await client.query(
          `SELECT 1 FROM points_transactions WHERE order_id=$1 AND type=$2 LIMIT 1`,
          [orderId, type],
        )
      : await client.query(
          `SELECT 1 FROM points_transactions WHERE user_id=$1 AND type=$2 LIMIT 1`,
          [userId, type],
        );
    if (exists.rows.length) {
      await client.query("COMMIT");
      return false;
    }

    await client.query(
      `INSERT INTO reward_points (user_id, points, lifetime_points)
       VALUES ($1, $2, $2)
       ON CONFLICT (user_id)
       DO UPDATE SET points = reward_points.points + $2,
                     lifetime_points = reward_points.lifetime_points + $2,
                     updated_at = NOW()`,
      [userId, points],
    );
    await client.query(
      `INSERT INTO points_transactions (user_id, points, type, description, order_id, review_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, points, type, description, orderId, reviewId],
    );
    await client.query("COMMIT");
    return true;
  } catch (e: any) {
    try { await client.query("ROLLBACK"); } catch {}
    console.error("[awardPointsOnce] failed:", e?.message);
    return false;
  } finally {
    client.release();
  }
}

/** 10-point welcome bonus, once per user. */
export async function awardWelcomeBonus(userId: string, points = 10): Promise<boolean> {
  return awardPointsOnce({ userId, points, type: "welcome", description: "هدية ترحيب بالتسجيل 🎁" });
}

/** Purchase points: 1 point per 1,000 YER, once per order. */
export async function awardPurchasePoints(userId: string, orderId: number, orderTotal: number): Promise<boolean> {
  const points = Math.floor(Number(orderTotal) / 1000);
  if (points <= 0) return false;
  return awardPointsOnce({ userId, points, type: "earn", description: `شراء - طلب #${orderId}`, orderId });
}

/** 5 bonus points for rating an order, once per order. */
export async function awardReviewPoints(userId: string, orderId: number, points = 5): Promise<boolean> {
  return awardPointsOnce({ userId, points, type: "review", description: `تقييم منتجات الطلب #${orderId}`, orderId });
}

/**
 * Pay the referrer their reward for a referred friend's first *real* (confirmed/delivered)
 * order. Safe to call multiple times for the same order — the referrals unique indexes
 * (referred_user_id / referred_phone) + ON CONFLICT DO NOTHING guarantee one payout per
 * referred person, and the wallet is credited only when a new referral row is inserted.
 */
export async function grantReferralRewardForOrder(orderId: number): Promise<void> {
  try {
    const ordRes = await pool.query(
      `SELECT id, user_id, customer_phone, coupon_code, status FROM orders WHERE id=$1 LIMIT 1`,
      [orderId],
    );
    if (!ordRes.rows.length) return;
    const order = ordRes.rows[0];
    if (order.status === "cancelled") return;

    const couponCode = order.coupon_code;
    if (!couponCode) return;
    const userId: string | null = order.user_id || null;
    const customerPhone: string | null = order.customer_phone || null;
    if (!userId && !customerPhone) return; // cannot attribute the buyer

    const cfg = (await pool.query(
      `SELECT referral_enabled, referral_reward_yer FROM display_settings LIMIT 1`,
    )).rows[0] || {};
    const refEnabled = cfg.referral_enabled === true;
    const rewardYer = Number(cfg.referral_reward_yer) || 0;
    if (!refEnabled || rewardYer <= 0) return;

    const owner = await pool.query(
      `SELECT id, phone FROM users WHERE referral_code=$1`,
      [String(couponCode).toUpperCase()],
    );
    const referrerId: string | undefined = owner.rows[0]?.id;
    if (!referrerId) return; // not a customer referral code (e.g. a marketer coupon)

    // Block self-referral by id and by phone tail (covers guest checkout with own code).
    const refPhoneN = normPhone(owner.rows[0]?.phone);
    const buyerPhoneN = normPhone(customerPhone);
    const phoneSelfReferral = !!refPhoneN && !!buyerPhoneN && (
      refPhoneN === buyerPhoneN ||
      (refPhoneN.length >= 9 && buyerPhoneN.length >= 9 && refPhoneN.slice(-9) === buyerPhoneN.slice(-9))
    );
    if (referrerId === userId || phoneSelfReferral) return;

    // Friend must be on their FIRST real order: no other non-cancelled, confirmed/delivered
    // order by the same buyer (matched by user_id OR normalized phone tail).
    const buyerTail = buyerPhoneN.length >= 9 ? buyerPhoneN.slice(-9) : null;
    const prior = await pool.query(
      `SELECT 1 FROM orders
        WHERE id <> $1
          AND status <> 'cancelled'
          AND (admin_confirmed = true OR status IN ('delivered','completed') OR delivery_status = 'delivered')
          AND (
                ($2::varchar IS NOT NULL AND user_id = $2)
             OR ($3::text IS NOT NULL AND regexp_replace(COALESCE(customer_phone,''), '\\D', '', 'g') LIKE '%' || $3)
          )
        LIMIT 1`,
      [orderId, userId, buyerTail],
    );
    if (prior.rows.length) return; // not the friend's first real order

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const ins = await client.query(
        `INSERT INTO referrals (referrer_user_id, referred_user_id, referred_phone, status, reward_amount_yer, order_id)
         VALUES ($1, $2, $3, 'rewarded', $4, $5)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [referrerId, userId || null, customerPhone ? String(customerPhone) : null, rewardYer.toFixed(2), orderId],
      );
      if (ins.rows.length) {
        const w = await client.query(`SELECT id FROM wallets WHERE user_id=$1 FOR UPDATE`, [referrerId]);
        let walletId: number;
        if (w.rows.length) {
          walletId = w.rows[0].id;
          await client.query(
            `UPDATE wallets SET balance_yer = balance_yer + $1, updated_at = NOW() WHERE id=$2`,
            [rewardYer, walletId],
          );
        } else {
          walletId = (await client.query(
            `INSERT INTO wallets (user_id, balance_yer) VALUES ($1, $2) RETURNING id`,
            [referrerId, rewardYer],
          )).rows[0].id;
        }
        await client.query(
          `INSERT INTO wallet_transactions (wallet_id, user_id, type, amount, currency, description, order_id)
           VALUES ($1, $2, 'deposit', $3, 'YER', $4, $5)`,
          [walletId, referrerId, rewardYer, `مكافأة إحالة صديق (طلب #${orderId})`, orderId],
        );
        // Tell the referrer their reward landed (idempotent via groupKey).
        try {
          const { createNotification } = await import("./notifications");
          await createNotification({
            userId: String(referrerId),
            type: "wallet_credit",
            priority: "high",
            title: `🎁 مكافأة إحالة ${rewardYer.toLocaleString("ar-YE")} ر.ي`,
            message: "صديقك أكمل أول طلب — أُضيفت المكافأة إلى محفظتك",
            actionUrl: "/wallet",
            orderId,
            groupKey: `referral_reward:${orderId}`,
            dedupMinutes: 60 * 24 * 3650,
          });
        } catch { /* non-fatal */ }
      }
      await client.query("COMMIT");
    } catch (txErr) {
      try { await client.query("ROLLBACK"); } catch {}
      throw txErr;
    } finally {
      client.release();
    }
  } catch (e: any) {
    console.warn("[grantReferralRewardForOrder] failed:", e?.message);
  }
}
