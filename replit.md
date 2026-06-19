# OYO PLAST - متجر أويو بلاست

## Overview
OYO PLAST is a comprehensive RTL Arabic e-commerce platform for plastic printing and supplies in Yemen, inspired by SHEIN and savvy.sa.

**Key Capabilities:**
- Customizable product printing (size, color, custom designs + live logo preview)
- Integrated marketer/affiliate program + supplier portal
- Comprehensive admin panel
- Multi-currency display (YER/SAR, dynamic via `settings.exchange_rate`)
- Guest checkout, loyalty, in-app notifications
- AI assistant + 9-agent AI team with CEO daily reports

## User Preferences
- Iterative development. Ask before making major changes. Prefer detailed explanations.
- Do not make changes to the folder `Z` or to the file `Y`.
- Communicate in Arabic when the user is writing Arabic.
- **Device:** User works from a Galaxy Note 8 (small mobile screen, ~411px). Always design mobile-first for small screens.
- **No Replit Canvas:** The Replit Canvas board / mockup-sandbox does NOT open on the user's device. NEVER deliver previews via Canvas. Instead, provide an interactive preview as a real in-app route (e.g. `/product-preview-mockup`) reachable from the normal app URL on their phone.
- Avoid wide markdown tables in replies (they render poorly on the small screen) — use vertical bullet lists.

## System Architecture

### UI/UX
- RTL Arabic, mobile-first responsive (SHEIN / savvy.sa style).
- Primary color Sky blue `#2196F3`. Cairo Arabic font.
- Collapsible admin sections with localStorage persistence.

### Technical Stack
- **Frontend:** React + TypeScript in `client/src/` (`pages/`, `components/`, `hooks/`). wouter routing. TanStack Query.
- **Backend:** Node.js Express in `server/` (`routes.ts`, `storage.ts`, `db.ts`). Drizzle ORM.
- **Shared:** schema + API in `shared/`.
- **DB:** PostgreSQL.

### Authentication
- **Direct Registration (No-OTP):** `POST /api/auth/register-direct`. OTP code preserved but hidden via `OTP_REQUIRED = false` in `Auth.tsx`.
- **Anti-Spam:** 5 registrations per IP per hour (`phone_verifications` table).
- **Manual order verification:** Admin contacts each customer via Call/WhatsApp buttons in admin orders. "بانتظار التأكيد" badge until `PATCH /api/admin/orders/:id/confirm`.
- **Guest browsing:** Home/Products/Categories/Cart open. Checkout/orders/wishlist/notifications/account/marketer require auth (`RequireAccountType`). Guest cart in localStorage merges via `CartMerger` in `App.tsx`.
- **Admin:** `POST /api/admin/login` checks `process.env.ADMIN_PASSWORD`. HMAC token via `x-admin-token`. ⚠️ Replit **Configurations** values override **Secrets** with same name.

### Feature Toggles (Phase A — May 19, 2026)
- كل ميزة في صفحة المنتج لا تظهر إلا بعد تفعيلها يدوياً في الأدمن. لا fallbacks ضمنية.
- **`enableSmartVariants`**: تشغيل/إيقاف الخيارات الذكية. القفل أحادي الاتجاه أُزيل — PATCH يقبل `false`.
- **`hasPrintingOptions`**: حاسبة الطباعة الذكية (تصميم + ألوان + وجوه) — مخفية إن كانت `false`.
- **`allowDesignUpload`**: رفع تصميم للعميل (PDF/PNG/AI/PSD).
- **`showLivePreview`** (جديد): معاينة الطباعة الحية على Canvas. تتطلب `allowDesignUpload` معاً.
- **`enableVolumeOffers`** (جديد): جدول أسعار الكميات. الـuseQuery معطّل عند false (لا طلبات zombie).
- DB: عمودان جديدان `show_live_preview` و `enable_volume_offers` (auto-migrate في `server/db.ts`). افتراضي false.
- Admin UI: قسم "مفاتيح الميزات المتقدمة" بأعلى نموذج المنتج يجمع المفاتيح الأربعة الرئيسية.
- صورة المنتج تُرفع تلقائياً لـCloudinary عبر `/api/admin/upload` (مستخدم سابقاً في حقل الصور الـ 5).

### Pricing (Unified — Smart Variants as Source of Truth)
- Server computes `price/priceSar/originalPrice/discountPercent` automatically from **cheapest smart variant** in POST/PATCH `/api/admin/products`. Client-sent prices are ignored.
- **Helpers** (`server/routes.ts` ~145-210): `getExchangeRate()` reads `settings.exchange_rate` (60s cache) + `invalidateExchangeRateCache()` on settings update. `computeBaseFromSmartVariants(json, rate)`.
- **Dynamic SAR on read:** `mapProductRow()` + GET `/api/cart` recompute `priceSar = price / cachedRate` — rate change reflects instantly.
- **Admin form:** base price/SAR/originalPrice fields hidden, replaced by info banner. Promo categories + free shipping + show ratings remain editable.
- **ProductDetail:** default selection on open = cheapest variant per type.

### Notifications (In-App, Phase 1)
- `server/lib/notifications.ts` — `createNotification()` respects `notification_preferences`, dedup via `groupKey` (30 min), optional Telegram forward.
- **Triggers:** `notifyOrderCreated`, `notifyOrderStatus` (Arabic statusMap), `notifyNewMessage`.
- **DB:** `notifications` (priority/action_url/group_key) + `notification_preferences` (userId, type, in_app_enabled, telegram_enabled, muted_until).
- **Promo policy:** `promo` defaults OFF (opt-in). `broadcastPromo(mode)` supports `opt_in` / `bypass`.
- **APIs:** `GET/PUT /api/notification-preferences`, `POST /api/notification-preferences/snooze`, `POST /api/admin/notifications/broadcast`.
- **UI:** `NotificationBell` (polling 30s + actionUrl + per-type icons/colors), `/notification-settings`, `/admin/broadcast` (two confirm buttons).
- Staff `staff-notify.ts` Telegram+DB system intact.

### Image Architecture
- All product/category/banner images via lightweight proxy URLs (`/api/products/image/:id`, 7-day cache).
- Source of truth: Cloudinary CDN. Base64 not sent in public list endpoints.
- Migration endpoint `POST /api/admin/migrate-base64-images` (admin-token + SSE progress) for legacy data.

### Key Features
- **Product Management:** dynamic pricing, multi-image carousel, custom printing (PDF/PNG/AI/PSD uploads + design notes), `hasFreeShipping`.
- **Smart Variants** (`enableSmartVariants`): types = color/size/weight/image/bundle (🎁 with `count` + savings). Bundle pricing priority after `lastClickedType`, before weight/size.
- **Order Management:** tracking timeline, admin orders/inventory/sales tabs, marketer commission auto.
- **Payment & Wallet:** YER/SAR wallet + history, loyalty points, guest checkout, bank transfer with receipt upload, installment reminders via WhatsApp.
- **AI Printing Assistant ("أويو"):** Gemini chat on `/printing`. Dynamic — reads `products WHERE show_in_printing=true`. 6-step order flow → WhatsApp summary. Optional 300 YER design service. Files: `server/printing-ai.ts`, `POST /api/ai/printing-chat`, `PrintingAssistant.tsx`.
- **AI Agent Team (9 agents):** `/admin/ai-agents` — Safar/Nour/Huda/Rami/Rashed (DeepSeek), Layla/Omar (Gemini), Majed/Obo (Gemini-lite). Rashed is CEO — daily reports via cron 8am + on-demand. Files: `server/agent-team/`, `server/routes/ai-agents.ts`, `AdminAIAgents.tsx`. DeepSeek requires paid balance.
- **Floating Robot:** bottom-left WhatsApp shortcut on most pages (excludes `/printing`, `/admin`, `/staff`, `/supplier`, `/marketer/dashboard`). 4 quick actions.
- **Visual Search by Camera:** Navbar camera → browser-compressed → `POST /api/visual-search` → Gemini Vision + Arabic token matching → SHEIN-style overlay. Returns 40 products with `rating` + `categoryId`. Overlay has sort chips (relevance/price ↑↓/rating) + 4+ stars filter. Empty state offers "إزالة الفلاتر" when filters cut results to 0. Files: `Navbar.tsx` (handler), `VisualSearchOverlay.tsx` (UI), `server/routes.ts` (`searchProductsByArabicTokens`).
- **Related Products — Infinite Scroll:** `ProductDetail.tsx` — full list (same category first, then fillers), grid layout (2/3/4 cols responsive), starts at 12 and loads +12 via `IntersectionObserver` on sentinel.
- **Smart Back Button in Cart:** Router tracks `lastSafePath` in sessionStorage. Cart back navigates via `setLocation()`.
- **Auto Cart Clear:** `POST /api/orders/create` deletes user's `cart_items`. `ProductDetail` clears state on product change + after add-to-cart.
- **Phase 4 — Printing Pricing (Hybrid Override):** `product.override ?? printingCategory.value ?? 0` for `designFee` + `colorPrice` (per extra color) + `sidePrice` (per extra side). First color/side free. `cart_items.design_options` JSON carried through to `order_items`. Admin form section + ProductDetail calculator (visible only if any > 0). See `docs/CHANGELOG.md`.
- **Phase 5 — Live Print Preview:** Canvas API draws logo over product image. `products.print_area` JSON (`{x,y,width,height}` 0-100%). Pointer-drag + size slider. Default position from admin or `{25,25,50,50}`. Carried via `design_options`. See `docs/CHANGELOG.md`.
- **Marketer System:** standalone application/login/dashboard for earnings/orders/withdrawals + admin CRUD.
- **Supplier Portal:** `/supplier` for delivery status updates + product-to-supplier linking in admin.
- **Purchase Orders (Phase 1):** `/admin/purchase-orders` — vendor selection, line items with variant selector, status flow (draft→sent→partial→received), WAC update on receipt for `smartVariants.variants[i].costPriceY`. Race-safe via `BEGIN`+`FOR UPDATE`. See `docs/CHANGELOG.md`.
- **Admin Panel:** password-protected; manages products/categories/orders/users/marketers/suppliers/display/banners/fonts/payment/shipping.
- **General:** shopping cart, wishlist, internal notifications, PWA, legal pages, dynamic `/sitemap.xml` from DB.

### Staff & Permissions
- 5 roles (owner/product_manager/order_manager/finance/delivery). Middleware `requireStaff(allowedRoles[])`. Audit log. Full reference in **`docs/STAFF_PERMISSIONS.md`**.

## External Dependencies
- **Replit Auth** (user authentication)
- **UltraMSG / Twilio** (WhatsApp/SMS — OTP + order notifications, currently restricted)
- **PostgreSQL** (Drizzle ORM)
- **Cloudinary** (image CDN)
- **Gemini API** (visual search + printing assistant + Gemini-based agents)
- **DeepSeek API** (5 of 9 AI agents — requires paid balance)
- **Jawal Pay** (planned electronic payments)

## History
Detailed session-by-session changelog in **`docs/CHANGELOG.md`** (latest: May 17 — Phase 4/5 + Purchase Orders + AI Team + Visual Search v6 + Critical Fixes).
