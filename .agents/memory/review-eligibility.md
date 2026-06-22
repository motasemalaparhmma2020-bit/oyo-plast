---
name: Product review eligibility
description: Who can write product reviews and how eligibility is determined (store-wide purchase, phone-matched, admin-moderated)
---

Any customer who has completed **at least one non-cancelled order** (ANY product) may read, comment, and rate **ANY** product. It is NOT per-product or delivery-gated.

**Why:** The owner explicitly relaxed the old "verified-delivered-buyer of THIS product" rule. In this COD business orders are created via guest checkout and confirmed manually, so a delivery-gated rule left every real customer ineligible. The safety net is **admin moderation**: reviews insert with `is_approved=false` and never appear publicly until the owner approves them in admin — so a too-permissive write gate cannot pollute public ratings.

**How to apply:**
- Server is the source of truth. Shared helper `userHasPurchased(dbPool, userId)` (server/routes.ts, just above the "Product Reviews" section) is used by POST `/api/products/:id/reviews`, GET `/api/products/:id/my-review`, AND POST `/api/upload/review`. Keep all three using the helper.
- The helper matches an order by `user_id` **OR by phone** — orders are guest checkouts (`user_id` NULL) carrying `customer_phone`, so phone-match is REQUIRED or nobody qualifies. Normalize both sides to the **last 9 digits of digits-only** (handles `+967` / leading `0` / spaces); guard the phone branch with `length >= 9` so empty phones never match empty.
- Eligibility predicate is currently `status <> 'cancelled'` (counts `pending`, since all real orders sit pending awaiting manual confirmation). If the owner ever wants stricter, tighten ONLY the helper SQL to `admin_confirmed = true OR status IN ('delivered','completed') OR delivery_status = 'delivered'` — orders table has `admin_confirmed`/`confirmed_at`/`confirmed_by`/`delivery_status` for this.
- Client `canReview` (from `/my-review`) is only a UI hint; never recompute from `/api/orders` (those rows have no `items` array — that was the original "reviews disabled" bug).
- **Known accepted tradeoff:** phone-match + the app's deliberate no-OTP phone auth means someone could register a prior customer's phone and inherit review-write rights. This is the same risk the no-OTP model already accepts app-wide (orders/wallet/etc.) and is mitigated by admin moderation; do not "fix" it in isolation without owner direction.

**Separate flow — do not confuse:** the RateOrder page (`/api/orders/:id/...` review endpoints ~3329/3397) still gates on a specific **delivered** order (`status delivered/completed` or `delivery_status='delivered'`). That is order-scoped rating, distinct from the store-wide product-review eligibility above.
