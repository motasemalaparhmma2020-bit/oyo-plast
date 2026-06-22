---
name: Customer rewards loop
description: When/where loyalty points + referral payout fire, and how idempotency + retry are guaranteed.
---

# Customer rewards loop (OYO PLAST)

**Rewards fire at ORDER CONFIRMATION** (admin confirm endpoint), an owner decision — NOT at "delivered" and NOT at order create. Rewards = buyer loyalty points (1 pt / 1000 YER) + an in-app "rate your order" prompt + referrer wallet payout. Welcome bonus (10 pts) fires on registration; 5 pts fire when a buyer rates an order.

**Why confirm, not create or delivered:** owner manually confirms every order by phone, so confirm is the reliable "real order" signal. COD means create-time is too early — fake/abandoned orders would pay referrers.

**Single source of truth:** all reward grants live in one rewards lib. Never inline reward SQL in routes — call the lib helpers. Idempotency is the core invariant:
- Points dedupe on `(order_id, type)` when order-scoped, else `(user_id, type)` (one welcome per user), inside a transaction + advisory lock to close the check-then-insert race.
- Referral payout relies on the `referrals` partial-unique indexes (`referred_user_id`, `referred_phone`) + ON CONFLICT DO NOTHING; wallet is credited only when a new referral row actually inserts. Plus a "first real order" guard (no other non-cancelled confirmed/delivered order by same user_id OR phone-tail) and self-referral guard by id AND phone-tail (covers guest checkout with own code).

**Retry rule (non-obvious, caught in review):** the confirm handler does an atomic transition (update only when not-yet-confirmed and not cancelled), then fires rewards in an unawaited background task AFTER responding. That background task can fail silently while the order is already marked confirmed — so the "already confirmed" branch of a *repeat* confirm MUST re-run the same idempotent reward firer, letting a re-click complete anything missed. The delivered-path handlers also call the same idempotent helpers as a safety net for orders that skip confirm.

**Rating flow gotcha:** the rate/rateable endpoints must resolve the user via the shared `getUserId(req.user) || req.session.userId` pattern — `req.user.id` is always undefined here (auth stores `claims.sub`). A reward notification linking to the rate page is useless if those endpoints 401/403 authenticated users. Rating gating also accepts `admin_confirmed`, not just delivered/completed.
