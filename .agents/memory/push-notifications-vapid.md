---
name: Push Notifications VAPID (web-push)
description: Web Push uses the web-push library for encrypted payloads; the CJS dynamic-import interop gotcha that breaks it in production only.
---

## Rule
The `web-push` npm package IS installed and is the source of truth for Web Push:
it generates VAPID keys and sends RFC 8291 encrypted payloads. Native Node `crypto`
remains only as a *fallback* for key generation if the import fails. Do NOT "restore"
a native-only/payload-less implementation — that belief is obsolete.

## Critical interop gotcha (the non-obvious part)
`web-push` is CommonJS. `await import("web-push")` does NOT reliably expose the named
functions (`setVapidDetails`, `generateVAPIDKeys`, `sendNotification`) on the namespace
object once the server is **bundled** (esbuild). The real exports land on `.default`.

**Symptom:** works in dev (`tsx`) but throws `setVapidDetails is not a function`
**in production only** (bundled server) → broadcast/push silently fails.

**How to apply:** always normalize the import before use:
```ts
const wp: any = await import("web-push");
const webpush = wp.default ?? wp;
```
**Why:** `require()` puts the functions on the root, but the bundled dynamic-import
namespace puts `module.exports` under `.default` and does not hoist the names.
`wp.default ?? wp` covers both dev and bundled paths.

## Storage / wiring (stable facts)
- VAPID keys cached in `app_config` table; subscriptions in `push_subscriptions`.
- `server/lib/push-sender.ts` — getOrCreateVapidKeys / sendWebPush / sendPushToUser.
- `server/lib/notifications.ts` `broadcastPromo` calls `sendPushToUser` fire-and-forget
  (non-blocking) alongside the in-app `notifications` bulk insert.
- `client/public/sw.js` already has push + notificationclick handlers.
