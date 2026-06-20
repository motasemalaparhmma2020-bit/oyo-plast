---
name: Cloudinary fetch disabled — composite previews client-side
description: Why logo-on-product previews must be done with an HTML canvas, not the Cloudinary overlay endpoint
---

Cloudinary **fetch / remote-URL delivery is DISABLED on this account** — any
`https://res.cloudinary.com/<cloud>/image/fetch/...` URL returns HTTP 401. So
Cloudinary can only transform images that were *uploaded* to the account
(`/image/upload/<folder>/<id>`), not arbitrary remote/local URLs.

Product images here are NOT direct Cloudinary upload URLs — they are local
assets (`/products/*.png`) or lightweight proxy URLs (`/api/products/image/:id`).
Therefore the `/api/studio-preview/quick` Cloudinary-overlay path silently
returns the product image unchanged (no logo) for these products.

**Rule:** For an instant/free "place the logo on the product" preview, composite
client-side with an HTML `<canvas>` (draw product image, then draw the logo at
the `products.print_area` percentages, export `toDataURL`). This works for every
product regardless of where the image is hosted.

**Why:** Cloudinary fetch 401 + proxy/local product URLs make server overlay
unusable; the Gemini studio path (`/generate`) still works because the server
fetches the absolute URL itself, but it costs credits and is slow — not suitable
for a free "quick" preview.

**How to apply:** Logo dataURL is same-origin (no CORS). For cross-origin
product images set `img.crossOrigin = "anonymous"` (Cloudinary delivery sends
permissive CORS) and wrap `toDataURL` in try/catch for tainted-canvas safety.
Cap canvas size (~900px) and export JPEG to keep any persisted preview small;
do NOT persist the base64 composite into order/cart JSON — store only hosted
(studio/Cloudinary) URLs there.
