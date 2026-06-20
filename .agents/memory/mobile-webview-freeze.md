---
name: Old Android WebView freeze (Galaxy Note 8 PWA)
description: Why admin UI "freezes" on the owner's old Android PWA WebView, and the low-risk mitigations that actually work.
---

The owner runs the app as an installed PWA on a Galaxy Note 8 (2017, weak CPU, old
Android WebView). Things that are smooth on desktop can hard-freeze there. Two recurring,
non-obvious causes:

## 1. Radix modal Dialog/Select scroll-lock + focus-trap
Opening a Radix **modal** `Dialog` (or `Select`) engages `react-remove-scroll`
(scroll-lock) + focus-trap + aria-hide, which scan/mutate the whole document on open.
On the old WebView this blocks the main thread long enough to feel like a freeze — even
when the dialog's own component code is clean and the data set is tiny.

**Mitigation (low-risk, no rewrite):** on the offending dialog set
`<Dialog modal={false}>` and add `onOpenAutoFocus={(e) => e.preventDefault()}` to its
`DialogContent`. This skips the expensive scroll-lock/focus-trap. The shadcn overlay
still renders and outside-tap still closes; the only tradeoff is weaker focus isolation
(acceptable for admin-only forms). If it still hangs, render the form inline (no Radix)
or move it to a dedicated lightweight route.

## 2. Hard-nav `<a href>` for internal routes
A plain `<a href="/admin/...">` triggers a full document reload: re-download the JS
bundle, rehydrate, re-auth, re-run every query. On a slow device/network this looks like
a multi-second freeze. **Always use wouter `<Link>`** for internal navigation so it stays
client-side.

**Why this matters here:** the admin page is one ~9.6k-line component with several
polling queries; a full reload of it is especially expensive on this device.
