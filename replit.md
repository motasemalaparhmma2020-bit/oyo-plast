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

### In-App Notifications (Phase 1 — May 2026)
- **Library:** `server/lib/notifications.ts` — `createNotification()` يحترم `notification_preferences`، dedup عبر `groupKey` (30 دقيقة)، اختياري Telegram forward.
- **Triggers:** `notifyOrderCreated` (POST `/api/orders/create`), `notifyOrderStatus` (PATCH `/api/admin/orders/:id/status` مع `statusMap` عربي), `notifyNewMessage` (POST `/api/admin/conversations/:id/messages`).
- **DB:** جدول `notifications` موسّع بـ `priority/action_url/group_key`، جدول جديد `notification_preferences (userId, type, in_app_enabled, telegram_enabled, muted_until)`. كلها additive migrations في `server/migrate.ts`.
- **Promo policy:** `promo` defaults to OFF (opt-in). `broadcastPromo(mode)` يدعم `opt_in` (موافقين فقط) أو `bypass` (الجميع — للحالات الحرجة).
- **APIs:** `GET/PUT /api/notification-preferences`, `POST /api/notification-preferences/snooze`, `POST /api/admin/notifications/broadcast`.
- **UI:** `NotificationBell.tsx` polling 30s + actionUrl navigation + أيقونات/ألوان لكل نوع. صفحة `client/src/pages/NotificationSettings.tsx` (`/notification-settings`) — toggles + DND. صفحة `AdminBroadcastNotifications.tsx` (`/admin/broadcast`) — زرّان أخضر/أحمر (موافقة/تجاوز) مع تأكيد قبل التجاوز.
- **Staff:** نظام `staff-notify.ts` (Telegram + DB) باقٍ كما هو — لم يُكسر.

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

### Unified Pricing (May 16, 2026)
- **Smart Variants هي المصدر الوحيد للأسعار والخصم.** الخادم يحسب `price/priceSar/originalPrice/originalPriceSar/discountPercent` تلقائياً من **أرخص خيار ذكي** في POST/PATCH `/api/admin/products` (يتجاهل أي قيم يرسلها العميل).
- **Helpers (`server/routes.ts` ~145-210):** `getExchangeRate()` يقرأ من `settings.exchange_rate` مع كاش 60 ثانية + `invalidateExchangeRateCache()` يُستدعى من POST `/api/admin/settings` عند تغيير سعر الصرف. `computeBaseFromSmartVariants(json, rate)` يُرجع أرخص سعر + خصم.
- **Dynamic SAR على القراءة:** `mapProductRow()` و GET `/api/cart` يُعيدان `priceSar = price / cachedRate` ديناميكياً — تغيير سعر الصرف في الأدمن ينعكس فوراً.
- **Admin form (`Admin.tsx`):** حقول السعر اليمني/السعودي الأساسية + originalPrice/originalPriceSar/discountPercent **مخفية** واستُبدلت بشريط معلومات أزرق. التصنيفات الترويجية + شحن مجاني + إظهار التقييمات تبقى.
- **ProductDetail.tsx:** الافتراضي عند فتح المنتج = **أرخص متغيّر من كل نوع** (بدلاً من الأول).
- **Migration (`server/migrate.ts` ~505-550):** ترحيل additive أعاد حساب أسعار جميع المنتجات الموجودة من أرخص خيار ذكي عند الإقلاع.

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

### Phase 4: تسعير الطباعة الفوري — Hybrid Override (May 17, 2026)
- **الفكرة:** السعر = `product.override ?? printingCategory.value ?? 0` لكل من 3 حقول: `designFee` (رسوم تصميم لكل mockup) + `colorPrice` (سعر لكل لون إضافي) + `sidePrice` (سعر لكل وجه إضافي).
- **الصيغة:** `extraColors = max(0, colors-1)`, `extraSides = max(0, sides-1)`, `totalPrintingCost = designFee + extraColors*colorPrice + extraSides*sidePrice`. أول لون وأول وجه مجاناً.
- **Schema (`shared/schema.ts`):**
  - `printing_categories`: أضيف `design_fee_per_mockup`, `color_price_per_color`, `price_per_side` (numeric, default 0).
  - `products`: أضيف `printing_design_fee_override`, `printing_color_price_override`, `printing_side_price_override` (numeric, nullable).
  - `cart_items` + `order_items`: أضيف `design_options` (TEXT, JSON يحوي `{colors, sides, designFee, colorTotal, sideTotal, totalPrintingCost}`).
- **Migration:** كل الأعمدة additive عبر `ALTER TABLE ADD COLUMN IF NOT EXISTS` في `server/migrate.ts`.
- **Backend (`server/routes.ts`):**
  - `LITE_COLS` + `mapProductRow`: يُعيد الـ 3 override fields.
  - POST/PATCH `/api/admin/products`: تقبل + تحفظ الـ overrides (PATCH allowlist موسّع).
  - POST `/api/cart`: تقبل + تحفظ `designOptions` JSON. `hasPrinting` check يتضمن `designOptions`.
  - GET `/api/cart`: تُعيد `ci.design_options AS "designOptions"` (مهم لـ Checkout).
  - `storage.createOrder`: تنقل `designOptions` من cart إلى order_items.
- **Frontend:**
  - `ProductDetail.tsx`: state `printingColors`/`printingSides` + `printingPricing` useMemo (override ?? category ?? 0) + `phase4PrintingBreakdown` مدمج في `totalPrice`. حاسبة UI تظهر فقط إذا `enableCustomPrinting` ON و `hasPhase4Pricing` (أحد الـ 3 أسعار > 0). `cartPayload` يرسل `designOptions` كـ JSON string.
  - `Admin.tsx`: قسم "🖨️ تسعير الطباعة الفوري (تجاوز)" في نموذج المنتج. ProductFormData type + empty form + create/update mutations + load-on-edit تشمل الـ 3 override fields.
  - `cartUtils.ts` + `use-cart.ts` (guest paths) + `App.tsx` (CartMerger): جميعها تنقل `designOptions` لضمان استمرارية الـ Phase 4 من ضيف → مسجّل → checkout → order.
- **Limitation:** لا يوجد server-side recompute لـ `unitPrice` بعد (يتبع النمط القائم في المشروع). موثّق كـ tech-debt للأمان.

### Purchase Orders — المرحلة 1 (May 17, 2026)
- **DB:** `suppliers.type` (distributor/vendor/both, default distributor) + جدولان جديدان `purchase_orders` (po_number auto PO-2026-NNN, supplier_id, status draft/sent/partial/received/cancelled, subtotal/shipping/total/currency, notes, created_by, created_at, received_at) و`purchase_order_items` (purchase_order_id, product_id, product_name_snapshot, variant_label, quantity_ordered/received, unit_cost, line_total). Migration additive في `server/migrate.ts`.
- **Routes:** `server/routes/purchase-orders.ts` — `GET /api/admin/vendors`, `GET/POST /api/admin/purchase-orders`, `GET/PATCH/DELETE /api/admin/purchase-orders/:id`, `POST /api/admin/purchase-orders/:id/receive`. كلها `requireAdmin`.
- **WAC على الاستلام:** يُطبَّق على `smartVariants.variants[i].costPriceY` للـ variant المطابق بالـ label. صيغة: `new_avg = (old_stock*old_avg + recv_qty*unit_cost)/(old_stock+recv_qty)`. يستخدم `BEGIN` + `FOR UPDATE OF poi, p` لمنع race على JSON.
- **حماية:** server-side over-receipt check (يرفض إذا recvQty > remaining). الحالات المسموح حذفها: draft + cancelled فقط.
- **Limitation MVP:** WAC يُحدَّث فقط للمنتجات التي تستخدم smart_variants ومع `variant_label` معطى. المنتجات بلا variants تحصل على زيادة مخزون فقط (التحذير يظهر في wacReport).
- **UI:** `/admin/purchase-orders` (`AdminPurchaseOrders.tsx`) — قائمة بفلتر حالة + dialog إنشاء (اختيار vendor من النوع vendor/both، عناصر مع variant selector ديناميكي حسب smart_variants، حساب فوري للإجمالي) + dialog تفاصيل + dialog استلام مع تقرير WAC قبل/بعد. رابط فتح من تبويب "المخزون" في `Admin.tsx`.

### Phase 5: المعاينة الفورية للطباعة (Live Print Preview — May 17, 2026)
- **الفكرة:** بعد رفع التصميم، يرى العميل صورة المنتج مع شعاره مرسوماً عليها بـ Canvas API الخام (بدون مكتبات)، ويمكنه سحب الشعار وتغيير حجمه بشريط.
- **Schema:** `products.print_area` TEXT (JSON `{x, y, width, height}` كنسب مئوية 0-100) في `shared/schema.ts` و migration additive في `server/migrate.ts`.
- **Backend (`server/routes.ts`):**
  - `LITE_COLS` + `mapProductRow`: يُعيد `printArea` (parse JSON آمن مع try/catch).
  - POST `/api/admin/products`: تطبيع object→JSON string قبل الحفظ.
  - PATCH `/api/admin/products/:id`: نفس التطبيع قبل `pickFields` لمطابقة سلوك POST، مع `printArea` في الـ allowlist.
- **Admin (`Admin.tsx`):** قسم بنفسجي "🎯 منطقة الطباعة على صورة المنتج" داخل قسم الطباعة الفورية — 4 inputs (x/y/w/h %) مع تحقق clamp 0-100 + زر مسح. ProductFormData type/emptyForm/create/update/load كلها تشمل `printArea`.
- **ProductDetail (`ProductDetail.tsx`):**
  - State: `logoPosition` + `previewImgAspect` + refs (`previewCanvasRef`, `previewContainerRef`, `dragStateRef`).
  - useEffect 1: تهيئة `logoPosition` من `product.printArea` أو الافتراضي `{25,25,50,50}` عند رفع التصميم؛ تنظيف عند إزالة الرفع.
  - useEffect 2: يرسم صورة المنتج بـ `drawImage(bg, 0, 0, W, H)` (تملأ كامل الـ canvas) ثم الشعار فوقها بنسب مئوية. `previewImgAspect` يُحدَّث من `bg.naturalWidth/Height` لتطابق حاوية الـ DOM نسبةَ الصورة → **لا letterboxing، إحداثيات السحب = إحداثيات الرسم تماماً**.
  - Pointer handlers (Down/Move/Up) مع `setPointerCapture` لسحب موضع الشعار + clamp ضمن 0-100 ناقص العرض/الطول.
  - شريط range (10-90%) لتغيير حجم الشعار + Reposition تلقائي إن خرج من الحدود.
  - `logoPosition` مدمج في `cartPayload.designOptions` (مع شروط Phase 4 الموجودة). ينتقل ضمن `design_options` JSON من cart → order_items.
- **UX:** Canvas 240×(240/aspect) مع إطار بنفسجي متقطع قابل للسحب. الحاوية `touchAction: none` لتمكين السحب باللمس.
- **Limitation:** Canvas API الخام (لا konva/fabric). دوران الشعار وطبقات متعددة محجوزة لـ Phase 3.

### Critical Fixes (May 17, 2026)
- **Checkout total miscalculation:** `Checkout.tsx` كان يحسب الإجمالي من `product.price` (أرخص متغيّر) بدل `item.unitPrice` المخزّن لكل عنصر سلة → 3 منتجات × 2,200 بدل 111,700. أُصلح في `subtotal` useMemo وفي render العناصر (مع SAR conversion ديناميكية عبر rate مشتق).
- **NotificationBell شفافة:** `PopoverContent` كان يفتقد bg صريح → أُضيف `bg-white dark:bg-gray-900 border shadow-2xl`.
- **"عرض الطلب" لا يصل للطلب:** سببان مكدّسان — (1) `storage.createOrder` لم يحفظ `userId` على الطلب رغم وجوده في schema، فـ GET `/api/orders` (WHERE user_id) يُرجع قائمة فارغة للعميل؛ (2) `actionUrl` كان `/orders` فقط. أُصلح: حفظ `userId` في `createOrder`، تغيير `actionUrl` إلى `/orders/${orderId}`، إضافة Route `/orders/:id` في `App.tsx`، ودعم `useRoute` + scrollIntoView + ring highlight في `Orders.tsx`.

### Task 8: فريق وكلاء الذكاء الاصطناعي (May 17, 2026)
- **DB (`server/migrate.ts` ~690):** 3 جداول جديدة `ai_agents` (id, name, display_name, role, model, provider, system_prompt, permissions JSONB, is_active, last_daily_report), `ai_agent_actions` (agent_id, action_type, title, input/output JSONB, status pending/approved/rejected, verified_by_ceo), `ai_agent_conversations` (agent_id, user_id, message, reply). Seed تلقائي لـ 9 وكلاء أول مرة فقط (`ON CONFLICT name DO NOTHING`).
- **الوكلاء التسعة:** سفر (تسعير - deepseek), نور (محتوى - deepseek), ليلى (خدمة عملاء - gemini), هدى (متأخرات - deepseek), ماجد (ملفات تصميم - gemini-lite), رامي (تحليل سلوك - deepseek), عمر (تصميم إبداعي - gemini), أوبو (متابعة طلبات - gemini-lite), **راشد (المدير التنفيذي - deepseek, `is_ceo:true, db_scope:["*"]`)**.
- **Module (`server/agent-team/index.ts`):** عميلَا DeepSeek (REST `https://api.deepseek.com/v1/chat/completions`) + Gemini (`@google/genai`). دالة `chatWithAgent(agent, message, userId, userName)` تبني context حسب `permissions.db_scope` ثم تستدعي المزود حسب `agent.provider`، وتسجّل المحادثة في `ai_agent_conversations`. دالة `generateCEOReport()` تجمع **حقائق فعلية من قاعدة البيانات** (طلبات/مستخدمين 24h، متأخرات) + إنجازات كل وكيل + تقرير سردي من راشد + توصيات. cache ساعة + `force` يتجاوز.
- **Routes (`server/routes/ai-agents.ts`):** 8 endpoints كلها `requireAdmin`: `GET /api/ai/agents`, `PATCH /api/ai/agents/:id`, `POST /api/ai/agents/:idOrName/chat`, `GET /api/ai/agents/:id/actions`, `GET /api/ai/agents/:id/conversations`, `POST /api/ai/agents/ceo/daily-report`, `GET /api/ai/agents/ceo/last-report`, `POST /api/ai/actions/:id/approve`. مُسجَّلة في `routes.ts` ~474.
- **Cron:** `node-cron` يستدعي `generateCEOReport()` يومياً 8 صباحاً.
- **UI (`client/src/pages/AdminAIAgents.tsx`):** صفحة `/admin/ai-agents` بثلاث تبويبات (شبكة الوكلاء مع شارة pending + أزرار chat/edit, الإجراءات المعلّقة مع approve/reject, تقرير راشد مع زر توليد فوري). كل الطلبات تستخدم `adminFetch`/`adminApiRequest` التي تحقن `x-admin-token` من localStorage تلقائياً. رابط فتح من تبويب "المخزون" في `Admin.tsx`.
- **Limitation:** DeepSeek يتطلب رصيداً مدفوعاً (حالياً 402 Insufficient Balance) — الوكلاء المعتمدون على Gemini يعملون فوراً (ليلى/ماجد/عمر/أوبو). راشد يعمل بالحقائق ولا يخترع.

### Task 9: توثيق صلاحيات الفريق (May 17, 2026)
- **الملف:** `docs/STAFF_PERMISSIONS.md` — مرجع موحّد بالعربية لكل ما يخصّ الموظفين.
- **يحتوي:** 5 أدوار (owner/product_manager/order_manager/finance/delivery) + جدول صلاحيات تفصيلي لكل دور (يستطيع/لا يستطيع) + endpoints محمية + خطوات إنشاء/تعطيل الموظف + middleware `requireStaff(allowedRoles[])` + سجل audit + أفضل الممارسات (least-privilege, password rotation, 2FA roadmap) + ملفات الكود المرجعية.
- **الهدف:** مرجع المالك عند توظيف أحد جديد، ومرجع المطوّر عند إضافة endpoint جديد.

## History
Detailed session-by-session changelog is in `docs/CHANGELOG.md` (Visual Search v1–v5.1, April 2026 hardening, Session April 30 UX polish, Session May 16 bundle variant + smart back button).
