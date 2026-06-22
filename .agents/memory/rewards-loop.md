---
name: Customer rewards loop
description: When/where loyalty points + referral payout fire, and how idempotency + retry are guaranteed.
---

# Customer rewards loop (OYO PLAST)

**Rewards fire at ORDER CONFIRMATION** (`PATCH /api/admin/orders/:id/confirm`), an owner decision — NOT at "delivered". Rewards = buyer loyalty points (1 pt / 1000 YER) + "rate your order" in-app prompt + referrer wallet payout. Welcome bonus (10 pts) fires on registration; 5 pts fire when a buyer rates an order.

**Single source of truth:** `server/lib/rewards.ts`. Never inline reward SQL in routes — call its helpers (`awardPurchasePoints`, `awardWelcomeBonus`, `awardReviewPoints`, `grantReferralRewardForOrder`). The legacy `awardOrderPoints` in routes.ts is now a thin delegate.

**Idempotency design (why double-pay can't happen):**
- Points: deduped in `points_transactions` by `(order_id, type)` when order-scoped, else `(user_id, type)` (e.g. one welcome per user). Wrapped in BEGIN + `pg_advisory_xact_lock(hashtext(key))` to close the check-then-insert race.
- Referral: relies on the `referrals` partial-unique indexes on `referred_user_id` and `referred_phone` + `INSERT ... ON CONFLICT DO NOTHING`; wallet is credited only when a new referral row is actually inserted. Plus a "first real order" guard (no other non-cancelled, confirmed/delivered order by same `user_id` OR phone-tail) and self-referral guard by id AND phone-tail (guest checkout with own code).

**Retry rule (non-obvious, caught in review):** the confirm handler does an atomic transition `UPDATE ... WHERE admin_confirmed IS DISTINCT FROM true AND status<>'cancelled' RETURNING`, then fires rewards in an unawaited IIFE *after* `res.json`. Because that IIFE can fail silently while `admin_confirmed` is already true, the "already confirmed" branch of a *repeat* confirm MUST also call the same idempotent reward firer (`fireConfirmRewards`) — so a re-click completes anything missed. The delivered-path handlers (status→delivered, supplier→delivered) also call the same idempotent helpers as a safety net for orders that skip confirm.

**Why:** owner manually confirms every order by phone, so confirm is the reliable "real order" signal; COD means create-time is too early (fake/abandoned orders would pay referrers).
