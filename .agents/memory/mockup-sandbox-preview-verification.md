---
name: Mockup sandbox preview verification
description: How to verify a mockup-sandbox component renders, since the screenshot tool can't reach the sandbox.
---

# Verifying mockup-sandbox components

The `screenshot` tool's `app_preview` always targets the **main app** (port 5000).
A `/__mockup/...` path passed to it returns the main app's SPA shell/splash, NOT the
sandbox component — so you cannot screenshot a sandbox mockup that way.

**Why:** the `/__mockup/` preview proxy is wired at the canvas-host / Replit domain
level for iframe embedding, not inside the main Express/Vite server. The screenshot
tool hits the main app server, which has no `/__mockup/` route and serves index.html.

**How to verify instead:**
- `curl http://localhost:<sandbox-port>/__mockup/preview/{folder}/{Component}` → 200 confirms route resolves (but 200 is just the HTML shell).
- `npm --prefix artifacts/mockup-sandbox run typecheck` → catches type/import errors.
- Grep the sandbox workflow log for `error|fail` / `Failed to resolve import`.
- The live canvas iframe (via `presentArtifact`) is the real visual check — the canvas host renders it with HMR; updating the same file hot-reloads the existing iframe.

**Single-color print preview trick:** to tint a logo to one ink color via CSS mask
(`mask-image` + `background-color`), the logo PNG must have a **transparent**
background (alpha mask). A logo generated on a white background won't isolate —
run `remove_image_background_tool` first to get a cut-out, then mask it.
