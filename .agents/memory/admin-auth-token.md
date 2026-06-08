---
name: Admin auth token
description: How admin-protected API routes authenticate on this project (OYO PLAST) and the localStorage key pitfalls.
---

# Admin auth on OYO PLAST

`requireAdmin` (server/routes.ts) authenticates **only** via the `x-admin-token` request header. There is no cookie/session fallback for admin routes.

**Why this matters:**
- `apiRequest` from `@/lib/queryClient` sends `credentials: "include"` (cookies) but does NOT attach `x-admin-token`. Using `apiRequest` for any `/api/admin/*` mutation returns 401.
- The admin login stores the token in localStorage under key `admin_token` (loaded into the `adminToken` state var in Admin.tsx). Several files mistakenly read `localStorage.getItem("adminToken")` — that key is empty, so those calls silently 401.

**How to apply:** For any admin-protected call, use a raw `fetch` with `headers: { "x-admin-token": adminToken }`. When building a child component used inside Admin.tsx, pass the `adminToken` state down as a prop rather than reading localStorage.
