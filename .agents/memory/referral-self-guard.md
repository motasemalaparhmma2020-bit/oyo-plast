---
name: Referral self-referral guard
description: Why referral wallet rewards must be blocked by phone, not just account id
---

# Referral self-referral must be blocked by phone, not only account id

When crediting a referrer's wallet on a referred friend's first order, comparing
`referrerId !== userId` is NOT enough. A referrer can log out and check out as a
**guest** with their own `/r/:code`; then `userId` is null and the id check passes,
letting them credit their own wallet.

**Rule:** in the post-order referral reward block, also fetch the referrer's
`phone` and skip the reward when the order's `customer_phone` matches it
(normalize to digits, compare full or last-9 to absorb country-code variance).

**Why:** prevents guest-checkout self-referral wallet abuse — a real money leak.

**How to apply:** any change to the referral reward path in `server/routes.ts`
(order-create flow) must preserve both the account-id guard and the phone guard.
Wallet double-credit is separately protected by the `referrals` unique index +
`INSERT ... ON CONFLICT DO NOTHING RETURNING`, so reward issuance stays idempotent
even under concurrent first orders.
