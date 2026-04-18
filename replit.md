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
    - Guides users through: product type → background color → size → quantity → print colors → design notes.
    - Supports 10 product types: cloth bags, nut bags, invoices, business cards, stickers, sign boards, pens/notebooks, t-shirts, mugs, medals.
    - Suggests Arabic-localized color combinations based on business type.
    - Offers "initial design service" (300 YER) with WhatsApp redirect including spec summary.
    - Backend: `server/printing-ai.ts` with multi-model fallback (gemini-2.5-flash → 1.5-flash → 2.0-flash).
    - Route: POST `/api/ai/printing-chat`
    - Component: `client/src/components/PrintingAssistant.tsx`
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