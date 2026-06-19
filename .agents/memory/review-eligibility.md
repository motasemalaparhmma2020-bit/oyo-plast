---
name: Product review eligibility
description: Why product reviews are gated to verified buyers and how eligibility is determined
---

Product reviews are restricted to **verified buyers**: a logged-in user who has an order containing the product with `status IN ('delivered','completed')` OR `delivery_status='delivered'`.

**Why:** The store owner explicitly chose verified-purchase-only reviews to keep ratings trustworthy.

**How to apply:**
- Eligibility is computed server-side and exposed as `canReview` (GET `/api/products/:id/my-review`). Do NOT recompute it on the client from `/api/orders` — that endpoint returns raw order rows WITHOUT an `items` array, so any client-side "has a delivered order containing this product" check is always false (this was the original "reviews are disabled" bug).
- POST `/api/products/:id/reviews` is the authoritative enforcement (same SQL predicate); the GET `canReview` is only a UI hint.
- Guest checkouts (orders with `user_id` NULL) can never produce a reviewable record — the buyer must be logged in at checkout so the order links to their account. With current data all orders were guest + pending, so no review form appears until a logged-in customer has a delivered order.
- An order becomes eligible when admin sets status "تم التوصيل" (PATCH `/api/admin/orders/:id/status`) or the supplier portal sets `delivery_status='delivered'`.
