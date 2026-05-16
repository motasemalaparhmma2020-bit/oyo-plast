# OYO PLAST - متجر أويو بلاست

## Overview
OYO PLAST is a comprehensive e-commerce platform for plastic printing and supplies in Yemen, featuring an RTL Arabic interface inspired by SHEIN and savvy.sa.

**Vision:** To be the go-to platform for plastic printing and supplies in Yemen.

**Key Capabilities:**
- Customizable product printing (size, color, custom designs)
- Integrated marketer/affiliate program
- Comprehensive admin panel for store management
- Multi-currency display (YER/SAR, fixed 1 SAR = 140 YER)
- Guest checkout and loyalty programs

## User Preferences
- Iterative development. Ask before making major changes. Prefer detailed explanations.
- Do not make changes to the folder `Z` or to the file `Y`.
- Communicate in Arabic when the user is writing Arabic.

## System Architecture

### UI/UX
- RTL Arabic, mobile-first responsive (inspired by SHEIN / savvy.sa).
- Primary color Sky blue `#2196F3`. Cairo Arabic font.
- Collapsible sections in admin with localStorage persistence.
- Branding: "أويو بلاست - لطباعة ومستلزمات البلاستيك".

### Technical Stack
- **Frontend:** React + TypeScript in `client/src/` (`pages/`, `components/`, `hooks/`). Routing via wouter. State via TanStack Query.
- **Backend:** Node.js Express in `server/` (`routes.ts`, `storage.ts`, `db.ts`). Drizzle ORM.
- **Shared:** schema + API definitions in `shared/`.
- **DB:** PostgreSQL.

### Authentication (Active Mode)
- **Direct Registration (No-OTP Mode):** Users register with name + phone, logged in immediately. Endpoint: `POST /api/auth/register-direct`.
- **OTP code preserved** in codebase but hidden via `OTP_REQUIRED = false` in `client/src/pages/Auth.tsx`. Flip to `true` to re-enable.
- **Reason:** WhatsApp Cloud API (Meta) restricted; UltraMSG/Twilio production budget unavailable.
- **Anti-Spam:** 5 registrations per IP per hour (uses `phone_verifications` table).
- **Manual order verification:** Admin/staff contact each new customer to confirm orders before shipping.
- **Guest browsing:** Home/Products/Categories/Cart open without login. `/checkout`, `/orders`, `/wishlist`, `/notifications`, `/account`, `/marketer/coupons` require auth (`RequireAccountType`). Guest cart in localStorage merges into server cart on login (`CartMerger` in `App.tsx`).

### Admin Manual-Confirmation Tools
- Call/WhatsApp buttons on every order in admin (normalizes Yemen numbers to `https://wa.me/967...` with pre-filled Arabic message).
- "بانتظار التأكيد" badge until admin clicks confirm; replaced by "مؤكد".
- `PATCH /api/admin/orders/:id/confirm` updates `admin_confirmed`, `confirmed_at`, `confirmed_by` columns.
- Alert banner shows count of unconfirmed orders >1h old (`GET /api/admin/orders/unconfirmed-count`).
- DB migration in `server/migrate.ts` adds the three columns idempotently.

### Key Features
- **Product Management:** dynamic pricing, multiple images carousel, custom printing (PDF/PNG/AI/PSD uploads + design notes), `hasFreeShipping`.
- **Smart Variants** (`enableSmartVariants` per product): types = color/size/weight/image/bundle. Bundle type has `count` field and shows customer savings vs base price. Bundle has pricing priority right after `lastClickedType`, before weight/size.
- **Order Management:** tracking timeline, admin orders/inventory/sales tabs, automatic marketer commission.
- **Payment & Wallet:** YER/SAR wallet + transaction history, loyalty points, guest checkout, bank transfer with receipt upload, installment plan reminders via WhatsApp.
- **AI Printing Assistant ("أويو"):** Gemini-powered chat on `/printing`. Dynamic — reads `products WHERE show_in_printing=true` before every chat. 6-step order flow → structured WhatsApp summary. Optional initial design service (300 YER). Backend: `server/printing-ai.ts`, route `POST /api/ai/printing-chat`, component `client/src/components/PrintingAssistant.tsx`.
- **Floating Robot:** bottom-left button on all pages except `/printing`, `/admin`, `/staff`, `/supplier`, `/marketer/dashboard`. 4 quick actions → WhatsApp with pre-filled Arabic. `client/src/components/FloatingRobot.tsx`.
- **Visual Search by Camera:** camera button in `Navbar.tsx` → image compressed in browser → `POST /api/visual-search` → Gemini Vision + smart Arabic token matching → bottom-sheet results. SHEIN-style progress ring. ~1s end-to-end. Fallback to top sellers when image unrecognized.
- **Smart Back Button in Cart:** `App.tsx` Router tracks `lastSafePath` in sessionStorage (excludes cart/checkout/order-confirmation/orders). Cart back button navigates to that path via `setLocation()`.
- **Auto Cart Clear:** `POST /api/orders/create` deletes `cart_items WHERE user_id=$1` after successful order. `ProductDetail` clears quantity+selections on product change and after successful add-to-cart.
- **Marketer System:** standalone application/login/dashboard for earnings/orders/withdrawals + admin CRUD.
- **Supplier Portal:** `/supplier` for delivery status updates + product-to-supplier linking in admin.
- **Admin Panel:** password-protected; manages products/categories/orders/users/marketers/suppliers/display settings. Banners/fonts/payment/shipping configurable.
- **General:** shopping cart, wishlist, internal notifications, PWA, legal pages, dynamic `/sitemap.xml` from DB.

### Image Architecture
- All product/category/banner images served via lightweight proxy URLs (`/api/products/image/:id` with 7-day cache).
- Source of truth: Cloudinary CDN (after migration). Base64 data URLs no longer sent in any public list endpoint.
- Migration endpoint `POST /api/admin/migrate-base64-images` (admin-token protected, SSE progress) handles any remaining legacy base64 → Cloudinary.

## External Dependencies
- **Replit Auth** (user authentication)
- **UltraMSG** (WhatsApp API — OTP + order notifications)
- **SMTP** (email OTP fallback)
- **PostgreSQL** (Drizzle ORM)
- **Cloudinary** (image CDN)
- **Gemini API** (visual search + printing assistant)
- **Jawal Pay** (planned electronic payments)

## History
Detailed session-by-session changelog is in `docs/CHANGELOG.md` (Visual Search v1–v5.1, April 2026 hardening, Session April 30 UX polish, Session May 16 bundle variant + smart back button).
