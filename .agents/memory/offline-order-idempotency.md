---
name: Offline order idempotency
description: How offline checkout orders avoid duplicates when queued and auto-synced; invariants the sync endpoint must keep.
---

# Offline order idempotency (OYO PLAST)

Offline checkout queues an order locally (IndexedDB via `savePendingOrder`) and a
background hook auto-posts it to `POST /api/sync/orders` on reconnect. The danger:
a normal `fetch` to `/api/orders/create` can THROW after the server already
created the order (connection dropped on the response), so the client queues a
"failed" order that actually succeeded → duplicate on sync.

## The rule (do not break)
- Checkout generates ONE idempotency key (`localId`) and sends it on BOTH the
  online `/api/orders/create` payload AND the offline `savePendingOrder` record.
  They MUST share the same key, or dedup cannot work.
- `orders.local_id` is persisted and protected by a PARTIAL UNIQUE INDEX
  (`WHERE local_id IS NOT NULL`) so normal orders (null key) are unaffected.
- `storage.createOrder` dedups: pre-check selects an existing order by `localId`
  and returns it; as a race fallback it catches unique-violation (PG `23505`)
  and re-selects. Both paths return the existing order instead of inserting.

**Why:** without the shared key + unique index, a lost response on a
successful create silently duplicates the order on the next sync.

## Sync endpoint invariants
- `/api/sync/orders` MUST ignore any client-supplied `userId` and bind to the
  session user only (`syncUserId || null`) — guest checkout makes null valid.
  Trusting client `userId` was an IDOR (attribute orders to other users).
- Sync is COD-only on the server too (reject non-`cash_on_delivery`), matching
  the checkout UI gate (`!receiptFile && !installmentType && !isWalletPayment && !isBankTransfer`).
- Known tradeoff: sync trusts the client `total` for COD orders (it bypasses the
  full `/api/orders/create` repricing pipeline). Acceptable only because offline
  is COD-only and orders are manually verified before fulfillment. If you ever
  allow non-COD offline orders, you must share the repricing logic first.

## Service worker
- `sw.js` navigation handler (`request.mode === "navigate"`) is network-first,
  then falls back to cached `/` (SPA app shell) BEFORE `offline.html`, so the app
  boots offline and uses IndexedDB data. Bump `CACHE_VERSION` on SW changes.
