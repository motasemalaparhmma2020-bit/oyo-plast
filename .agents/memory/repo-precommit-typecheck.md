---
name: Pre-existing tsc errors vs tsx runtime
description: This repo's `npm run check` (tsc) reports known pre-existing errors; runtime uses tsx and does not enforce them.
---

`npm run check` runs `tsc` in strict mode and surfaces a set of **pre-existing** type
errors that are NOT caused by your edits — common offenders: `ProductDetail.tsx`,
`Admin.tsx`, `OnboardingFlow.tsx`, `server/backup-service.ts`, `server/routes/studio-preview.ts`,
and a few `server/routes.ts` lines (downlevelIteration / regex-flag / arg-count).

**Why:** the dev workflow runs `tsx server/index.ts` (no `tsc` gate) and Vite does its own
transform, so the app runs fine despite these. They predate current work.

**How to apply:** after edits, run `npm run check` but **filter the output to the files you
touched** (e.g. `npm run check 2>&1 | rg -i "YourFile"`) to judge whether YOU introduced a
regression. Do not "fix" the unrelated pre-existing errors unless that is the task.
