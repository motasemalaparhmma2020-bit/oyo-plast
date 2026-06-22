---
name: authenticated user id resolution
description: how to get the current user's id in server routes — never req.user.id; it is always undefined in this app.
---

# Getting the authenticated user id in server routes

The id of the logged-in user is **never** at `req.user.id` in this app — that is always `undefined`. Every auth path (Replit OIDC, email, and phone no-OTP) calls `req.login({ claims: { sub: <userId> }, ... })`, so the id lives at `req.user.claims.sub`, or at `req.session.userId` for some session flows.

**The one correct pattern** (used by ~25 routes; copy it, do not improvise):
```ts
const userId = getUserId((req as any).user) || (req as any).session?.userId;
if (!userId) return res.status(401).json({ message: "غير مصرح" });
```
`getUserId(user)` just returns `user.claims?.sub`.

**Why:** a whole block of loyalty/points/wallet/account routes (`/api/points*`, `/api/loyalty/*`, `/api/wallet*`, `/api/account/summary`, `/api/my/coupons`) was written with `const user = (req as any).user; ... [user.id]`. Reads silently returned 0/empty (WHERE user_id = undefined → no rows, no error); writes 500'd on NOT NULL. The bug is invisible in tsc and easy to miss because the route still "works" returning zeros.

**How to apply:** when adding or reviewing any route that needs the current user, use the pattern above. `id` is a VARCHAR UUID (e.g. `9cb2ec9a-...`), so any table keyed by user must use a VARCHAR `user_id` (FK to `users.id`) — INTEGER will fail. The check-in tables (`daily_checkins`, `loyalty_events`) had INTEGER `user_id` and had to be migrated to VARCHAR.
