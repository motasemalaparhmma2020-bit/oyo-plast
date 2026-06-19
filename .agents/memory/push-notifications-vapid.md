---
name: Push Notifications VAPID Native Implementation
description: Web Push with VAPID implemented using Node.js native crypto (no web-push package) — key architecture and known constraints.
---

## Rule
`web-push` npm package is NOT installed and cannot be installed (packager_install_tool broken, bash blocks npm install). Use native Node.js `crypto` for VAPID instead.

**How to apply:**
- VAPID key generation: `crypto.createECDH('prime256v1')` → `getPublicKey()` (65 bytes uncompressed) + `getPrivateKey()` (32 bytes)
- JWT signing (ES256): build JWK with d/x/y fields → `crypto.createPrivateKey({ key: jwk, format: 'jwk' })` → `createSign('SHA256')`
- DER → raw r‖s conversion: parse 02 LL [00?]r 02 LL [00?]s, strip 0x00 sign-extension prefix using `slice(len - 32)` if len > 32
- Push is payload-less (wake-up signal only). SW handler (sw.js lines 179-193) already shows default Arabic notification when `event.data` is null.
- Keys stored in `app_config` table (created in db.ts auto-migrate).
- Subscriptions in `push_subscriptions` table (user_id, endpoint UNIQUE, auth_key, p256dh_key).

**Why:**
- code_execution (`installLanguagePackages`) fails with CANCEL error in this environment.
- bash blocks `npm install` directly.
- Payload encryption (RFC 8291) requires web-push library. Payload-less push avoids that complexity while still waking up the client.

**Files:**
- `server/lib/push-sender.ts` — full native implementation
- `server/db.ts` — app_config + push_subscriptions migration
- `server/routes.ts` — /api/push/vapid-key, /api/push/subscribe (POST/DELETE)
- `client/src/hooks/use-push-notifications.ts` — client hook
- `server/lib/notifications.ts` — integrated (fire-and-forget on createNotification)
- `client/public/sw.js` — already had push+notificationclick handlers (lines 178-211)
