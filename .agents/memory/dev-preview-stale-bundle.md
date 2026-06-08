---
name: Dev preview serves stale bundle
description: Why app_preview screenshots can show old UI after edits in this repl
---

The dev preview can render a STALE bundle after code edits, so screenshots may not
reflect the latest code. Two compounding causes in this project:

- A PWA **service worker** is registered ("[PWA] Service Worker registered successfully")
  and caches the app shell / JS, so a reload can serve old assets.
- The Vite **HMR websocket** frequently fails in the preview
  (`ws://localhost:5000/vite-hmr ... 400` / `localhost:5173 ECONNREFUSED`), so hot
  updates don't apply and the page falls back to whatever the SW cached.

**Why:** wasted several screenshot cycles thinking a layout fix hadn't landed when the
code was actually correct — the browser was just serving a cached shell.

**How to apply:** Don't trust a single preview screenshot to confirm front-end changes
here. Verify behavior through channels the SW can't cache — `curl` the API for
server-side changes, run `tsc` for type correctness, and read the source logic — before
concluding a change "didn't work." A global splash overlay (sessionStorage
`oyo-splash-v2`, ~2.8s) also covers the page on every fresh preview load.
