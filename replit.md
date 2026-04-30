# OYO PLAST - متجر أويو بلاست

## Overview
OYO PLAST is a comprehensive e-commerce platform for plastic printing and supplies in Yemen, featuring an RTL Arabic interface inspired by SHEIN and savvy.sa. The project aims to be the leading online store in its niche, offering a wide range of customizable plastic products, a robust marketer system, and a seamless shopping experience for customers.

**Vision:** To be the go-to platform for plastic printing and supplies in Yemen, empowering businesses and individuals with high-quality, customizable products and efficient delivery.

**Key Capabilities:**
- Customizable product printing (size, color, custom designs)
- Integrated marketer/affiliate program
- Comprehensive admin panel for store management
- Multi-currency display (YER/SAR)
- Guest checkout and loyalty programs

## User Preferences
I want iterative development. Ask before making major changes. I prefer detailed explanations. Do not make changes to the folder `Z`. Do not make changes to the file `Y`.

## Recent Changes (April 2026 — pre-launch hardening)
- **Visual Search by Camera** (April 29, 2026). New endpoint `POST /api/visual-search` in `server/routes.ts` accepts an image upload, compresses it via `sharp` (800px max, JPEG q80), then sends it to Gemini Vision (`gemini-2.5-flash` with fallback to 2.0/1.5-flash) with an Arabic prompt tuned for packaging products. Returns `{ keywords, recognized }` where keywords are 2-4 Arabic search terms or `recognized: false` if the image isn't a packaging product. Frontend: camera button (📷) added inside `SearchBar` in `client/src/components/Navbar.tsx` next to the search input. Hidden `<input type="file" accept="image/*" capture="environment">` triggers the rear camera on mobile. Loading state with spinner during Gemini call. On success, navigates to `/products?search=<keywords>` reusing the existing search system. Cost: ~$0.0002/image via Gemini.
- **OTP channel default → WhatsApp** (`client/src/pages/Auth.tsx`). Twilio US trial number cannot deliver SMS to Yemen carriers; UltraMSG WhatsApp is the only working path.
- **Auto-fallback to WhatsApp on SMS failure** (`server/lib/otp-sender.ts`).
- **Lightweight payload** for `/api/printing-products` (matches existing `/api/products` pattern). Solves the slow/empty printing section.
- **Saved-image protection**: PATCH endpoints for products/categories/staff-products now ignore lightweight proxy URLs (`/api/categories/image/:id`, `/api/products/image/:id`) to prevent overwriting real images when admin saves without uploading. Helper: `isProxyImageUrl()` in `server/routes.ts`.
- **Cloudinary migration script**: `scripts/migrate-base64-to-cloudinary.ts` (run with `npx tsx scripts/migrate-base64-to-cloudinary.ts --dry` first, then without `--dry`). Migrates `products.image_url` + `image_urls`, `categories.image_url` + `icon_url`, `banners.image_url`, `offers.image_url`.
- **Subcategories speed fix** (3-5 second delay → instant): `/api/subcategories` now returns lightweight proxy URLs instead of base64. New endpoint `/api/subcategories/image/:id` serves the full image. CategoryPage.tsx removed cache-busting (`_=Date.now()`, `cache: "no-store"`), set `staleTime: 5min`, and shows a skeleton while loading. Admin PATCH for subcategories now protects against proxy URL overwrites. Migration script extended to cover `subcategories.image_url`.
- **Pending**: Need `ULTRAMSG_INSTANCE_ID` and `ULTRAMSG_TOKEN` secrets to activate WhatsApp OTP in production. ✅ Already configured.

## System Architecture

### UI/UX Decisions
- **Layout:** RTL Arabic, mobile-first responsive design.
- **Inspiration:** SHEIN and savvy.sa for a modern e-commerce feel.
- **Color Scheme:** Primary color is Sky blue (#2196F3).
- **Typography:** Cairo Arabic font.
- **Components:** Collapsible sections in admin panel with state persistence using localStorage.
- **Branding:** New logo "أويو بلاست - لطباعة ومستلزمات البلاستيك".

### Technical Implementations
- **Frontend:** React-based application located in `client/src/`. Uses `pages/` for main views, `components/` for reusable UI elements, and `hooks/` for logic.
- **Backend:** Node.js server in `server/`. Handles API endpoints (`routes.ts`), database operations (`storage.ts`), and Drizzle database connection (`db.ts`).
- **Shared:** Common schema and API route definitions in `shared/`.
- **Authentication:**
    - User authentication via Replit Auth with account types (customer/marketer).
    - OTP verification via WhatsApp (Ultramsg) with email fallback.
    - Token-based access for admin.
    - Dedicated login for suppliers and marketers with phone + PIN.
- **Product Management:**
    - Dynamic pricing based on quantity, size, and custom printing options.
    - Multiple images per product with carousel.
    - Custom printing: file uploads (PDF, PNG, AI, PSD) and design notes.
    - `hasFreeShipping` field for products, controllable via admin.
- **Order Management:**
    - Visible tracking timeline for customers.
    - Admin panel for managing orders, inventory, and sales reports.
    - Automatic commission calculation for marketer orders.
- **Payment & Wallet System:**
    - Multi-currency wallet (YER/SAR) with transaction history.
    - Loyalty points system (rewards for purchases, reviews).
    - Guest checkout option.
    - Bank transfer option with account details display and receipt upload.
    - Installment plan reminders via WhatsApp.
- **AI Printing Assistant ("أويو"):**
    - Specialized Gemini-powered chat assistant embedded in /printing page.
    - **DYNAMIC**: Reads products directly from database (WHERE show_in_printing=true) before every chat — automatically knows new products, prices, colors instantly.
    - System prompt built at runtime: live DB products + static knowledge (printing types, delivery times, color guide, design description guide).
    - 6-step guided order flow: product type → size → color → quantity → print type → design → contact info → structured WhatsApp summary.
    - Structured WhatsApp order summary (📦 format) auto-detected by frontend and sent to WhatsApp.
    - Offers optional "initial design service" (300 YER, deducted from final order).
    - Backend: `server/printing-ai.ts` with `fetchPrintingProducts()` DB query + 4-model Gemini fallback.
    - Route: POST `/api/ai/printing-chat`
    - Component: `client/src/components/PrintingAssistant.tsx` (fetches WhatsApp number from display-settings).
- **Floating Robot (FloatingRobot):**
    - Simple animated robot button at bottom-left on all pages EXCEPT /printing, /admin, /staff, /supplier, /marketer/dashboard.
    - Opens 4 quick action buttons: file complaint, suggestion, contact support, browse printing.
    - All links redirect to WhatsApp with pre-filled Arabic messages.
    - Component: `client/src/components/FloatingRobot.tsx`
- **Marketer System:**
    - Standalone marketer application, login, dashboard for earnings, orders, and withdrawals.
    - Dedicated APIs for marketer operations (apply, login, stats, orders, coupons, withdrawals).
    - Admin CRUD for marketer applications, marketers, and withdrawal requests.
- **Supplier Portal:**
    - Separate portal (`/supplier`) for suppliers to view and update delivery status of their orders.
    - Product-to-supplier linking in admin.
- **Admin Panel:** Protected by password, comprehensive management of products, categories, orders, users, marketers, suppliers, and display settings. Features collapsible sections and settings for banners, fonts, payment, and shipping.
- **General Features:** Shopping cart, wish list, internal notifications, PWA support, legal pages.

### Feature Specifications
- **Dual Price Display:** YER/SAR with a fixed exchange rate (1 SAR = 140 YER).
- **Product Filters:** API support for filters like `free-shipping` and `flash-deals`.
- **Offer Banners:** Configurable from admin (height, columns, colors, activation).

## External Dependencies
- **Replit Auth:** For user authentication.
- **Ultramsg:** WhatsApp API for OTP verification.
- **SMTP (Email Service):** For email OTP fallback.
- **PostgreSQL:** Database managed via Drizzle ORM.
- **Jawal Pay (محفظة جوالي):** Planned integration for electronic payments (pending).
- **SMSGate:** For WhatsApp/SMS notifications (current implementation).

## Authentication Mode (April 2026)
- **Direct Registration (No-OTP Mode):** Active. Users register with name + phone in a single screen and are logged in immediately without any verification code. Endpoint: `POST /api/auth/register-direct`.
- **OTP Code Preserved:** All OTP code (send-otp, verify-otp endpoints, channel selector UI, OTP step UI) remains intact in the codebase but hidden from users via `OTP_REQUIRED = false` constant in `client/src/pages/Auth.tsx`. To re-enable OTP, change the constant to `true`.
- **Reason:** WhatsApp Cloud API (Meta) is restricted on the user's account due to a $125 unpaid Facebook ads debt. Twilio production WhatsApp is too expensive for early-stage budget. UltraMSG ($150/10K) and Yemeni provider (21,000 YER) also out of budget. The free WhatsApp sandbox cannot be used by real customers.
- **Anti-Spam:** `/api/auth/register-direct` enforces 5 registrations per IP per hour using the existing `phone_verifications` table.
- **Manual Order Verification:** Admin/staff manually contact each new customer to confirm orders before shipping (replaces OTP fraud prevention).
- **Guest Browsing:** Already in place. Public pages (Home, Products, Categories, Cart) work without login. Only `/checkout`, `/orders`, `/wishlist`, `/notifications`, `/account`, and `/marketer/coupons` require authentication via `RequireAccountType` guard. Guest cart persists in localStorage and merges into server cart on login (handled by `CartMerger` in `client/src/App.tsx`).

## Admin Manual-Confirmation Tools (April 2026)
Added to `client/src/pages/Admin.tsx` orders tab to support the no-OTP workflow:
- **Call/WhatsApp buttons** next to every order (`button-call-customer-{id}`, `button-whatsapp-customer-{id}`). WhatsApp link normalizes Yemen numbers (7xxxxxxxx, 07xxxxxxxx, +967, 00967) to international `https://wa.me/967...` format and includes a pre-filled Arabic confirmation message.
- **"بانتظار التأكيد" badge** shown on any order where `adminConfirmed=false` AND status is not in (cancelled/delivered/completed). Replaced by **"مؤكد" badge** after admin clicks the confirm button.
- **Confirm button** (`button-confirm-order-{id}`) calls `PATCH /api/admin/orders/:id/confirm` and updates the new `admin_confirmed`, `confirmed_at`, `confirmed_by` columns on the orders table.
- **Alert banner** (`alert-unconfirmed-orders`) at top of orders tab shows count of orders awaiting confirmation for >1 hour. Backed by `GET /api/admin/orders/unconfirmed-count` which polls every 60 seconds.
- DB migration in `server/migrate.ts` adds the three new order columns idempotently (`IF NOT EXISTS`).
## Session April 30, 2026 — UX Polish & Addresses Page
- **Visual Search (SHEIN-style):** New `VisualSearchOverlay.tsx` with animated scanner line (top→bottom CSS keyframes), corner brackets, bottom-sheet drawer (32vh image / 68vh results). Gemini 2.0 Flash + 512px/q65 client compression dropped end-to-end latency from 8–12s to ~1.5s. Direct `/product/:id` navigation from result tiles. `Navbar.tsx` fetches `/api/products` in parallel using a single `AbortController`.
- **AI Sales Chat (`SalesChat.tsx`):** Default mode changed from `compact` to `bubble` so the widget starts as a small floating bubble and is no longer a permanent strip on the page.
- **My Account (`MyAccount.tsx`):** Reads `?tab=orders|wallet|points` from URL on mount and syncs back to URL via `history.replaceState` on tab change — enables direct deep links from Profile cards.
- **Orders Filter Bar (`Orders.tsx`):** Horizontal scrollable filter pills (الكل / قيد الانتظار / قيد التجهيز / تم الشحن / تم التوصيل / مكتمل / ملغي) with per-status counts. Reads `?status=` from URL. `statusSteps` extended to include `completed` so the progress bar renders for completed orders too.
- **ProductCard Dark Mode (`ProductCard.tsx` + `index.css`):** Replaced the inline `style.background` (which was overriding `dark:` classes) with a `.product-card-img-bg` class that respects both light and dark themes via `var(--card-img-bg)` / `var(--card-img-bg-dark)` while preserving admin theme customization.
- **Addresses CRUD (`/addresses`, new):** Full CRUD page (`client/src/pages/Addresses.tsx`) backed by existing `/api/addresses` endpoints. Lists user addresses, set-default, edit/delete, dialog with 22 Yemeni governorates dropdown. Registered in `App.tsx` as a `RequireAccountType`-protected route. Already linked from `Profile.tsx`.
- **Security hardening (`server/routes.ts`):** Critical IDOR fix on `PATCH /api/addresses/:id` and `DELETE /api/addresses/:id` — both now require `userId === currentUser` ownership check before any read/write (previously any authenticated user could modify/delete any address by ID guessing). Added field length sanitization (name 60, city 60, address 500, phone 25). On default-address deletion, the oldest remaining address is auto-promoted to default to keep checkout functional.

## Visual Search v2 — SHEIN-Style Progress Ring (April 30, 2026)
Major upgrade to the visual search UX after user reported missing results:

- **Single-request architecture:** `/api/visual-search` now returns both `keywords` and matched `products` in a single response (saves a full round-trip). Total observed latency: **~1.7s** end-to-end with real Gemini call (down from previous 2-step flow).
- **Smart Arabic token search (`searchProductsByArabicTokens` in `server/routes.ts`):** Tokenizes the Gemini keywords, normalizes Arabic (strips diacritics + unifies ا/إ/أ/آ, ى→ي, ؤ→و, ئ→ي, ة→ه, removes "ال" prefix, removes punctuation), filters stop-words, and scores every product by how many tokens match name/description/tags. Sorted by score, top 30. Two-tier fallback:
  1. If 0 matches → search for any of {كيس, شنطة, علاقي, تغليف, ورق, بلاستيك, قماش} present in the keywords.
  2. If still 0 → return top sellers as suggestions so the user always sees something.
- **Better Gemini prompt + tokens:** Increased `maxOutputTokens` from 25 → 80 (Arabic chars consume more tokens than Latin so 25 was truncating to a single letter). Improved prompt with explicit examples ("كيس بلاستيك شفاف", "شنطة قماش حمراء", "علاقي بلاستيك"). Better unknown detection: regex `/^غير[_\s]?(معروف)?$/u` catches truncated rejections.
- **SHEIN-style progress ring (`VisualSearchOverlay.tsx`):** Large centered SVG circle (radius 54, white stroke) with bold percentage in the middle (0% → 100%). Logarithmic curve via `requestAnimationFrame` reaches 50% at 1s, 80% at 2s, caps at 92% until real response arrives — then jumps to 100% and reveals the results drawer 350ms later. Includes "تستغرق هذه الميزة بضع ثوانٍ تقريباً" caption + secondary "إلغاء" pill exactly like SHEIN.
- **Scanner line preserved:** Cyan top→bottom scan line + corner brackets remain on the image background underneath the progress ring.
- **`Navbar.tsx`:** Removed the secondary `/api/products?search=` fetch (no longer needed). The overlay receives products directly from the visual-search response.

## Visual Search v3 — Critical Fix (April 30, 2026)
**سبب المشكلة الحقيقي**: نماذج Gemini القديمة (`gemini-2.0-flash`, `gemini-1.5-flash-latest`) **لم تعد متاحة لمفاتيح API الجديدة** (تُرجع 404). هذا جعل كل طلبات visual-search تفشل صامتة، وكان الـ overlay يبقى عالقاً عند 92% للأبد.

### الإصلاحات:
1. **تحديث أسماء النماذج** في `server/routes.ts`:
   - استبدال القديمة بـ `gemini-2.5-flash` (أساسي) + `gemini-flash-latest` (احتياط) + `gemini-2.0-flash-lite` (آخر ملاذ)
2. **تعطيل thinking mode الداخلي** عبر `thinkingConfig: { thinkingBudget: 0 }` — يوفر tokens ويُسرّع الرد بشكل كبير
3. **رفع `maxOutputTokens` من 80 → 500** لأن 2.5-flash يستهلك tokens داخلية أكثر (يقطع النص العربي بدون هذا)
4. **Timeout صارم على Gemini** (8 ثوانٍ لكل نموذج، إجمالي 16 ثانية كحد أقصى) باستخدام `Promise.race`
5. **Fallback شامل لكل حالة فشل** — عند timeout أو "غير معروف" أو خطأ شبكة، نرجع `recognized: true, fallback: true` مع الأعلى مبيعاً (لا توجد شاشة فارغة على الإطلاق)
6. **Frontend timeout (15 ثانية)** في `Navbar.handleImageSelected` عبر `AbortController` + `setTimeout` — يُغلق overlay ويُظهر toast بدل البقاء عالقاً
7. **Toast لطيف** "اقتراحات قد تعجبك" عند fallback ليفهم المستخدم أن النتائج اقتراحات وليست تطابقاً دقيقاً

### الأداء النهائي:
- لقطة شاشة منتج معقدة → "كيس بلاستيك شفاف" + 2 منتج في **1.1ث**
- صورة كيس مباشرة → "كيس بلاستيك أحمر مطبوع" + 7 منتجات في **0.8ث**
- صورة سيارة → fallback إلى الأعلى مبيعاً (9 منتجات) في **2.6ث**
