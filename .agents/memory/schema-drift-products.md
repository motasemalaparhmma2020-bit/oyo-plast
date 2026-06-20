---
name: products schema drift (raw SQL vs schema.ts)
description: shared/schema.ts is stale vs the real Postgres DB; the live DB is the source of truth for column names.
---

# Products table drifts from shared/schema.ts

The app runs raw `pg` SQL against Postgres; `shared/schema.ts` (Drizzle) is **not** kept in sync and is stale in places. Trust the live DB column names, not schema.ts.

Known traps that bit twice:
- Products promo column is **`promotional_tags`** (Postgres `text[]` array), NOT `promotional_tag`. Writing/reading the singular name compiles (it's a runtime SQL string) but fails at query time; surrounding `try/catch {}` can swallow it silently, so a feature just "goes quiet" instead of erroring.
- `users` has **no** `is_active` column — staff are identified by `role NOT IN ('customer','marketer')`.

**Why:** SQL column names live in string literals, so TypeScript/tsc won't catch a wrong/stale name; the error only appears at runtime and is often swallowed.

**How to apply:** before writing any `products`/`users` SQL, confirm the column exists in the live DB (`\d products` or `information_schema.columns`) instead of copying names from schema.ts. Avoid bare `catch {}` around DB queries that hide schema-drift failures.
