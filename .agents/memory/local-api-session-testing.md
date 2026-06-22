---
name: Local API session testing
description: How to exercise authenticated endpoints over local HTTP for integration tests (curl/fetch).
---

# Testing authenticated endpoints locally (OYO PLAST)

The express-session cookie is `secure`, so over plain `http://localhost:5000` the server emits **no Set-Cookie at all** — login "succeeds" (returns the welcome JSON) but no session is established, and every authed endpoint then 401s. This silently breaks any curl/fetch integration test.

**Fix:** send `X-Forwarded-Proto: https` on the login request AND every follow-up (trust-proxy is on, so the server treats the connection as secure and sets/accepts the cookie). Use a real cookie-jar file with curl (`-c`/`-b`); the session cookie is stored with an `#HttpOnly_` line prefix in the jar, so `grep -v '^#'` makes the jar look empty even when it works.

**Why curl over the code-execution fetch:** the sandbox fetch does not surface Set-Cookie (`getSetCookie()` returns nothing here), so cookie-based flows must run through bash curl, not the JS notebook.

**Other gotchas for this kind of test:**
- Sessions live in Postgres (connect-pg-simple), so they survive a workflow restart — restart the dev server to pick up route edits without losing your logged-in jar.
- The dev server does not always hot-reload route changes; if an endpoint still behaves like the old code, restart the workflow before concluding the fix is wrong.
- No-OTP phone login: POST `/api/auth/register-direct` with just `{phone}` re-logs an existing user without consuming the per-IP registration rate limit (the limit row is only inserted when a brand-new user is created).
- Admin endpoints need `x-admin-token` from `/api/admin/login`; pass the password via `jq -n --arg p "$ADMIN_PASSWORD"` so the secret never appears in argv/output.
- Cleanup after a test order touches many FKs to `users` — notably a separate `reward_points` balance table in addition to `points_transactions`. Query `information_schema` for FKs to `users` and delete children before the user row.
