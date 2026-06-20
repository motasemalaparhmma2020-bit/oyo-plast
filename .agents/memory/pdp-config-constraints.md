---
name: New PDP config-driven layout constraints
description: Invariants for the admin-controlled "New PDP" (product detail page) feature — what must never break when editing it.
---

# New PDP (config-driven product page) — invariants

Config lives in `settings` table under key `pdp_layout_config` (JSON), schema/defaults/helpers in `shared/pdp-config.ts`. Admin edits it from `/admin/pdp-builder`; the page itself is `ProductDetailV2`, gated by `ProductDetailRouter` via the public decision endpoint.

- **Never leak the targeting list publicly.** `GET /api/pdp-layout/decision/:id` must return only `{version, sections, elements}` — never `scope` / `scope.productIds`. The whole point of "specific products" scope is that competitors can't see which products are in a trial.
- **Locked sections must always render.** `gallery` and `stickyCart` are `locked:true`. The sticky cart is the *only* add-to-cart control in V2; hiding it makes the product non-purchasable. Guarded in two places: admin disables the visibility toggle for locked sections, AND `mergePdpConfig` force-sets `visible:true` for locked sections (defends against stale stored configs). Keep both.
- **Kill-switch must be near-instant.** `ProductDetailRouter` uses `staleTime:0` so toggling the master switch reflects on next navigation. Server already caches the config ~15s; do not add a long client cache on top.
- **`mergePdpConfig` is forward-compatible.** It re-applies current default labels/locked flags, and preserves unknown stored sections (future experiments) instead of dropping them. Don't "simplify" it back to dropping unknowns.

**Why:** these were the exact gaps an architect review caught before rollout; each one is a silent footgun (privacy leak / unsellable product / slow kill-switch / data loss).
