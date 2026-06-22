---
name: Product detail V1/V2 split & V2 data model
description: Which product-detail page is live, and how V2's variant data model differs from V1's smart variants.
---

# Product detail: V1 vs V2

`/products/:id` and `/product/:id` route through `ProductDetailRouter`, which picks between two pages:
- **`client/src/pages/ProductDetail.tsx` — V1, legacy.** Reference only. Uses `smartVariants` (types color/size/weight/image/bundle); per-variant admin `badge` field (`recommended`/`best_seller`/`new`/`offer`) drives labels like `⭐ موصى به` / `🔥 الأكثر`.
- **`client/src/pages/ProductDetailV2.tsx` — V2, ACTIVE.** Also mounted directly at `/product-v2/:id`. Edit V2 for live behavior; don't assume V1 == what users see.

**Why it matters:** V2 does NOT use `smartVariants`. It derives selectors from separate product columns: `availableColors`→bagColors, `printColorOptions`, `quantityTiers` ({qty,totalPrice,unitPrice}). There is **no per-tier/per-color admin badge field** in V2. So a "recommended/best-seller" highlight must be *derived* in code (e.g. lowest `unitPrice` = best value), not read from admin config.

**How to apply:** When asked to change the customer-facing product page, edit `ProductDetailV2.tsx`. For any "recommended"/badge/auto-select behavior on V2, derive it from the tier/color data; don't look for an admin badge field that exists only on V1 smart variants.
