---
name: Deriving client IP for rate limiting
description: How to get the real client IP for per-IP throttling in this Express app.
---

# Client IP for rate limiting

This app sets `app.set("trust proxy", 1)` (in `server/index.ts`). Because of that, **use `req.ip`** to get the real client IP behind Replit's proxy.

- Do **not** read `req.headers["x-forwarded-for"]` and take the first entry yourself — that header is client-spoofable, so a manual parse lets attackers bypass per-IP limits by forging it. Express already parses it safely given `trust proxy`.
- For expensive multi-output endpoints (e.g. the AI "alternatives" preview that generates 3 images), charge the limiter proportionally (cost N), not 1.

**Why:** AI preview endpoints spend paid credits (Gemini image gen); a spoofable limiter is no protection. Caught in an architect review of the studio-preview rate limiter.
