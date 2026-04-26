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