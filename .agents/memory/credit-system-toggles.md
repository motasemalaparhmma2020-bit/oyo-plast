---
name: Credit system toggles
description: Two confusingly-similar admin switches control buy-on-credit; which one gates what.
---

# Two separate credit toggles

There are TWO different admin switches for the buy-on-credit ("الشراء بالأجل") feature. They are easy to confuse and caused a bug where disabling one had no effect.

- `credit_system_enabled` — the MASTER kill-switch ("تفعيل نظام الائتمان كاملاً"). Stored as a key/value row in the `settings` table (value `"true"`/`"false"`), edited in `AdminCreditTiers.tsx`. Semantics: enabled ONLY when value === `"true"`; missing row / any other value / DB error = disabled (fail-closed, "cash only for everyone").
- `credit_option_enabled` — a per-display toggle ("إظهار خيار الشراء بالأجل في صفحة الدفع"). A boolean COLUMN on the settings record, edited in `Admin.tsx`.

**Rule:** the master `credit_system_enabled` must gate every credit surface: checkout visibility (`Checkout.tsx` `creditEnabled`), the authoritative server `precheckCreditPurchase` (which guards `POST /api/orders/create`), and the `GET /api/my/credit` `system_enabled` flag the client reads.

**Why:** the master switch was originally wired to NOTHING — checkout only read `credit_option_enabled`, so admins toggling the master "off" still saw the credit option. Server-side enforcement in `precheckCreditPurchase` is the real control (UI hiding alone is bypassable).

**How to apply:** when touching credit display or order acceptance, check the master toggle, not just `credit_option_enabled`. The `AdminCreditTiers` settings card uses one Save button, but the master switch now persists immediately on toggle (its own PUT) so admins don't mistake an unsaved flip for a saved one.
