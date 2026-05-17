# OYO PLAST — Changelog

> ملف أرشيف للتغييرات التاريخية. للحالة الراهنة انظر `replit.md`.

---

## Session May 17, 2026 — جلسة كبيرة (Phase 4/5 + Purchase Orders + AI Team + Visual Search v6)

### Phase 4: تسعير الطباعة الفوري — Hybrid Override
- **الفكرة:** السعر = `product.override ?? printingCategory.value ?? 0` لكل من 3 حقول: `designFee` (رسوم تصميم لكل mockup) + `colorPrice` (سعر لكل لون إضافي) + `sidePrice` (سعر لكل وجه إضافي).
- **الصيغة:** `extraColors = max(0, colors-1)`, `extraSides = max(0, sides-1)`, `totalPrintingCost = designFee + extraColors*colorPrice + extraSides*sidePrice`. أول لون وأول وجه مجاناً.
- **Schema:** `printing_categories` (design_fee_per_mockup, color_price_per_color, price_per_side) + `products` (3 override fields nullable) + `cart_items`/`order_items.design_options` (TEXT JSON).
- **Backend:** `LITE_COLS`+`mapProductRow` يُعيدان الـ overrides. POST/PATCH `/api/admin/products` تحفظ. POST/GET `/api/cart` تنقل `designOptions`. `storage.createOrder` ينقلها لـ order_items.
- **Frontend:** `ProductDetail.tsx` state `printingColors`/`printingSides` + `printingPricing` useMemo. حاسبة UI تظهر فقط إذا أحد الـ3 أسعار > 0. `Admin.tsx` قسم "🖨️ تسعير الطباعة الفوري". `cartUtils.ts` + `use-cart.ts` + `App.tsx` (CartMerger) ينقلان `designOptions`.
- **Limitation:** لا يوجد server-side recompute لـ `unitPrice` بعد — tech-debt موثّق.

### Phase 5: المعاينة الفورية للطباعة (Live Print Preview)
- **الفكرة:** بعد رفع التصميم، يرى العميل صورة المنتج مع شعاره مرسوماً عليها بـ Canvas API الخام، ويمكنه سحب الشعار وتغيير حجمه.
- **Schema:** `products.print_area` TEXT (JSON `{x,y,width,height}` كنسب 0-100).
- **Backend:** `LITE_COLS`+`mapProductRow` parse JSON آمن. POST/PATCH `/api/admin/products` تطبيع object→JSON string قبل الحفظ، مع `printArea` في PATCH allowlist.
- **Admin:** قسم بنفسجي "🎯 منطقة الطباعة على صورة المنتج" — 4 inputs مع clamp 0-100 + زر مسح.
- **ProductDetail:** state `logoPosition` + refs (canvas/container/dragState). useEffect 1 يهيّئ من `printArea` أو الافتراضي. useEffect 2 يرسم خلفية + شعار بنسب — `previewImgAspect` يطابق نسبة الصورة فلا letterboxing. Pointer handlers مع `setPointerCapture` + clamp. شريط range 10-90%. `logoPosition` مدمج في `cartPayload.designOptions`.
- **Limitation:** Canvas API الخام فقط. دوران الشعار وطبقات متعددة محجوزة لـ Phase 3.

### Purchase Orders — المرحلة 1
- **DB:** `suppliers.type` (distributor/vendor/both) + جدولان جديدان `purchase_orders` (po_number `PO-2026-NNN`, supplier_id, status draft/sent/partial/received/cancelled, subtotal/shipping/total/currency) و`purchase_order_items` (product_id, variant_label, quantity_ordered/received, unit_cost, line_total).
- **Routes:** `server/routes/purchase-orders.ts` — 6 endpoints `requireAdmin`.
- **WAC على الاستلام:** يُطبَّق على `smartVariants.variants[i].costPriceY` للـ variant المطابق بالـ label. صيغة: `new_avg = (old_stock*old_avg + recv_qty*unit_cost)/(old_stock+recv_qty)`. `BEGIN`+`FOR UPDATE OF poi,p` لمنع race على JSON.
- **حماية:** server-side over-receipt check. حذف مسموح فقط لـ draft + cancelled.
- **Limitation:** WAC يُحدَّث فقط مع smart_variants + variant_label معطى.
- **UI:** `/admin/purchase-orders` — قائمة + dialog إنشاء + dialog تفاصيل + dialog استلام مع تقرير WAC قبل/بعد.

### Task 8: فريق وكلاء الذكاء الاصطناعي (9 وكلاء)
- **DB:** `ai_agents`, `ai_agent_actions`, `ai_agent_conversations`. Seed تلقائي 9 وكلاء (`ON CONFLICT name DO NOTHING`).
- **الوكلاء:** سفر/نور/هدى/رامي/راشد (DeepSeek), ليلى/عمر (Gemini), ماجد/أوبو (Gemini-lite). راشد CEO يحلّل ويوصي بحقائق DB فعلية.
- **Module:** `server/agent-team/index.ts` — `chatWithAgent()` يبني context حسب `permissions.db_scope` ثم يستدعي المزود. `generateCEOReport()` يجمع حقائق + إنجازات + تقرير سردي + توصيات. cache ساعة + `force` يتجاوز.
- **Routes:** `server/routes/ai-agents.ts` — 8 endpoints `requireAdmin`. مُسجَّلة في `routes.ts`.
- **Cron:** `node-cron` يستدعي `generateCEOReport()` يومياً 8 صباحاً.
- **UI:** `/admin/ai-agents` — 3 تبويبات (الوكلاء + الإجراءات المعلّقة + تقرير راشد). كل الطلبات `adminFetch`/`adminApiRequest`.
- **Bug fix (May 17 لاحقاً):** `total_amount → total` في تقرير راشد.
- **Limitation:** DeepSeek يتطلب رصيداً مدفوعاً (احياناً 402 Insufficient Balance) — وكلاء Gemini يعملون فوراً.

### Task 9: توثيق صلاحيات الفريق
- `docs/STAFF_PERMISSIONS.md` — مرجع موحّد بالعربية. 5 أدوار (owner/product_manager/order_manager/finance/delivery) + جدول صلاحيات + endpoints محمية + خطوات إنشاء/تعطيل + middleware `requireStaff(roles[])` + سجل audit + best practices.

### Visual Search v6 — شبكة موسّعة + فلاتر/ترتيب
- **الخادم:** `searchProductsByArabicTokens` يُرجع الآن **40 منتجاً** (بدل 6) + `categoryId` + `rating` لكل عنصر.
- **Overlay:** شريط فلاتر chips (أفضل تطابق / السعر ↑ / السعر ↓ / الأعلى تقييماً) + فلتر "4+ نجوم". عدّاد "X من Y" بعد الفلترة. عرض النجوم على كل بطاقة. حالة فارغة ذكية: "لا نتائج بهذا الفلتر" مع زر "إزالة الفلاتر" بدل "إغلاق".
- **Navbar:** mapping يمرّر `categoryId`+`rating`.

### منتجات مشابهة — Infinite Scroll
- `ProductDetail.tsx` `relatedProducts` يُرجع الآن **كامل** المنتجات المطابقة (نفس التصنيف أولاً، ثم باقي المنتجات لتعبئة العدد).
- `relatedShown` state يبدأ بـ 12 ويزيد +12 عبر `IntersectionObserver` (rootMargin 300px) على sentinel سفلي.
- التحويل من carousel أفقي إلى **شبكة** (2/3/4 أعمدة حسب حجم الشاشة) — أشبه بـ AliExpress/Amazon.

### Critical Fixes
- **Checkout total miscalculation:** `Checkout.tsx` كان يحسب الإجمالي من `product.price` بدل `item.unitPrice` المخزّن → إصلاح في `subtotal` useMemo + render العناصر.
- **NotificationBell شفافة:** `PopoverContent` كان يفتقد bg صريح → `bg-white dark:bg-gray-900 border shadow-2xl`.
- **"عرض الطلب" لا يصل للطلب:** سببان — (1) `storage.createOrder` لم يحفظ `userId` → GET `/api/orders` يُرجع قائمة فارغة، (2) `actionUrl=/orders` فقط. أُصلح: حفظ userId + `/orders/${orderId}` + Route `/orders/:id` + scrollIntoView + ring highlight.
- **ADMIN_PASSWORD:** الخادم يقرأ من Replit Configurations (يتجاوز Secrets). إعادة تشغيل مطلوبة بعد تغيير القيمة.

---

## Session May 16, 2026 — UX & Bundle Variant
خمس مهام مُنفّذة بترتيب:

1. **تصفير الكمية والسلة بعد العملية**
   - `ProductDetail.tsx`: `useEffect` على `numericId` يصفّر الكمية + كل الخيارات (مقاس/لون/خيارات ذكية/طباعة/تصميم) عند الانتقال لمنتج آخر.
   - `handleAddToCart` مع `onSuccess` يُصفّر الكمية و `selectedSmartVariant` و `lastClickedType` بعد كل إضافة ناجحة.
   - `server/routes.ts` `/api/orders/create`: مسح تلقائي `DELETE FROM cart_items WHERE user_id=$1` بعد إنشاء الطلب (non-fatal).

2. **زر العودة الذكي في `Cart.tsx`**: يستخدم `sessionStorage.lastSafePath` (يتتبعها Router في `App.tsx` لكل تغيير location عدا cart/checkout/order-confirmation/orders). يضمن الرجوع لصفحة المنتج وليس صفحات ما بعد الشراء.

3. **تنبيه في Admin** أعلى قسم الخيارات الذكية يوضّح أن أسعار الخيارات الذكية تتجاوز السعر الأساسي، ويُشجّع على إدخال السعر الكامل لكل خيار لتجنب التداخل.

4. **نوع جديد "شدة" (bundle)** ضمن الخيارات الذكية:
   - `SmartVariantType` إضافة `"bundle"` (🎁) + حقل `count?: number`.
   - UI Admin: حقل عدد القطع في الشدّة + حساب تلقائي للتوفير (`price_base × count` vs `bundle_price`).
   - أولوية تسعير: bundle مباشرة بعد `lastClickedType` وقبل weight/size.
   - cartPayload: `unitPrice = totalPrice/quantity` يلتقط تسعير الشدّة تلقائياً.

5. **SEO**: حُذف `public/sitemap.xml` القديم الثابت ليعمل endpoint `/sitemap.xml` الديناميكي من DB.

**Files touched:** `client/src/pages/ProductDetail.tsx`, `client/src/pages/Admin.tsx`, `client/src/pages/Cart.tsx`, `client/src/App.tsx`, `server/routes.ts`.

---

## Session April 30, 2026 — UX Polish & Addresses Page
- **Visual Search (SHEIN-style):** New `VisualSearchOverlay.tsx` with animated scanner line (top→bottom CSS keyframes), corner brackets, bottom-sheet drawer (32vh image / 68vh results). Gemini 2.0 Flash + 512px/q65 client compression dropped end-to-end latency from 8–12s to ~1.5s. Direct `/product/:id` navigation from result tiles. `Navbar.tsx` fetches `/api/products` in parallel using a single `AbortController`.
- **AI Sales Chat (`SalesChat.tsx`):** Default mode changed from `compact` to `bubble` so the widget starts as a small floating bubble.
- **My Account (`MyAccount.tsx`):** Reads `?tab=orders|wallet|points` from URL on mount and syncs back to URL — enables deep links from Profile cards.
- **Orders Filter Bar (`Orders.tsx`):** Horizontal scrollable filter pills with per-status counts. `statusSteps` extended to include `completed`.
- **ProductCard Dark Mode (`ProductCard.tsx` + `index.css`):** Replaced inline `style.background` with `.product-card-img-bg` class respecting `var(--card-img-bg)` / `var(--card-img-bg-dark)`.
- **Addresses CRUD (`/addresses`, new):** Full CRUD page backed by existing `/api/addresses` endpoints. 22 Yemeni governorates dropdown.
- **Security hardening (`server/routes.ts`):** Critical IDOR fix on `PATCH/DELETE /api/addresses/:id` — ownership check now enforced. Field length sanitization. On default-address deletion, oldest remaining address auto-promoted.

---

## Visual Search v2 — SHEIN-Style Progress Ring (April 30, 2026)
- **Single-request architecture:** `/api/visual-search` returns both `keywords` and matched `products` in one response. Latency: ~1.7s.
- **Smart Arabic token search (`searchProductsByArabicTokens`):** Tokenizes Gemini keywords, normalizes Arabic (diacritics + ا/إ/أ/آ unification, ى→ي, ؤ→و, ئ→ي, ة→ه, "ال" prefix removal, punctuation), filters stop-words, scores products by token matches. Two-tier fallback (generic terms → top sellers).
- **Better Gemini prompt + tokens:** `maxOutputTokens` 25→80. Explicit Arabic examples in prompt. Improved unknown detection regex.
- **SHEIN-style progress ring (`VisualSearchOverlay.tsx`):** SVG circle with logarithmic % curve (50% at 1s, 80% at 2s, caps 92% until response, then 100%).
- **Scanner line preserved** + corner brackets remain under progress ring.

## Visual Search v3 — Critical Fix (April 30, 2026)
**سبب جذري**: نماذج Gemini القديمة (`gemini-2.0-flash`, `gemini-1.5-flash-latest`) **لم تعد متاحة لمفاتيح API الجديدة** (404). كل visual-search كان يفشل صامتاً.

### الإصلاحات:
1. تحديث النماذج: `gemini-2.5-flash` + `gemini-flash-latest` + `gemini-2.0-flash-lite` كاحتياط.
2. تعطيل thinking mode عبر `thinkingConfig: { thinkingBudget: 0 }`.
3. `maxOutputTokens` 80→500 (2.5-flash يستهلك tokens داخلية أكثر).
4. Timeout صارم 8 ثوانٍ/نموذج عبر `Promise.race` (إجمالي ≤16s).
5. Fallback شامل للأعلى مبيعاً عند أي فشل.
6. Frontend timeout (15s ثم رُفع لـ45s في v4) عبر `AbortController`.
7. Toast "اقتراحات قد تعجبك" عند fallback.

### الأداء:
- لقطة شاشة معقدة → 2 منتج في 1.1ث
- صورة كيس مباشرة → 7 منتجات في 0.8ث
- صورة سيارة → fallback 9 منتجات في 2.6ث

## Visual Search v4 — Browser-side Compression (April 30, 2026)
**سبب**: على 4G يمنية، صورة 3-5MB ترفعها 30-50 ثانية. الـ frontend timeout يُلغي قبل وصول السيرفر.

### الإصلاحات في `Navbar.tsx`:
1. **`compressImageInBrowser()`** عبر Canvas API: 800px max + JPEG q0.82 → 5MB→120KB (أسرع 30-50×).
2. Timeout 15s→45s.
3. حد الصورة 5MB→20MB (الضغط في المتصفح).
4. رسائل toast أوضح.
5. منع toast الزائف عند الإلغاء اليدوي.
6. Fallback آمن عند فشل الضغط.

## Visual Search v5 — حل المشكلة الجذرية: حجم Response (April 30, 2026)

### المشكلة من production logs
- العداد يصل 92% ثم يتجمد، ثم "Unexpected end of JSON input".
- السبب الحقيقي: الـ backend يُرسل **5MB+ JSON** بصور base64 inline → 30 ثانية → proxy يقطع → JSON ناقص.

### الإصلاحات في `server/routes.ts`
1. `searchProductsByArabicTokens` + helper `lightImage()` يحوّل `data:` إلى `/api/products/image/{id}?v=hash`.
2. عدد المنتجات 30→6.
3. لوغ حجم الـ response.

**النتيجة:** 5,000+ KB في 30,000ms (يفشل) → **1.1KB في 1,077ms** (نجاح). تحسّن **4,500× أصغر و 28× أسرع**.

### الإصلاحات في `Navbar.tsx`
- Parsing دفاعي (text أولاً ثم try/catch JSON) يمنع "Unexpected end of JSON input".

### Endpoint جديد: `/api/admin/migrate-base64-images`
- محمي بـ `requireAdmin` (`x-admin-token`).
- يرحّل كل صورة `data:image/...` من DB إلى Cloudinary.
- يغطّي: products, categories, subcategories, banners, offers.
- يبث SSE للـ progress (heartbeat كل 15s).
- Idempotent + `WHERE image_url LIKE 'data:%'` يتخطى المُرحّل.
- للتشغيل: `curl -N -X POST https://YOUR-DOMAIN/api/admin/migrate-base64-images -H "x-admin-token: YOUR_ADMIN_TOKEN"`
- بعد الانتهاء: `VACUUM FULL products;` لاسترداد ~140MB.

### فوائد Cloudinary (production)
- DB: 325MB → ~10MB (98% تخفيف)
- CDN عالمي يخدم اليمن مباشرة
- Auto WebP/AVIF + auto quality

## Visual Search v5.1 — تحسينات ما بعد code review (April 30, 2026)
1. **`lightImage` hash ضعيف** → استبدال بـ `proxyImg("products", id, url)` يستخدم `imgVer()` (MD5 حقيقي).
2. **`clearTimeout` بعد `await res.text()`** بدلاً من قبله لحماية قراءة الـ body.
3. **`searchProductsByArabicTokens` كان يحمّل 140MB/بحث** → SQL خفيف بأعمدة scoring فقط (id, name, description, tags, price, stock, soldCount)، ثم جلب صور الـ 6 المختارة فقط. النتيجة: 140MB → 50KB (2800×).
4. **Migration endpoint: advisory lock مكسور** → `dbPool.connect()` للحصول على dedicated client، lock+unlock+release في `finally`.
5. **Migration endpoint: تحسينات SSE وأمان**: heartbeat 15s، `X-Accel-Buffering: no`، `res.on('close')` flag، batches من IDs، `WHERE image_url LIKE 'data:%'`.

### الأرقام النهائية
| المقياس | قبل v5 | بعد v5 | بعد v5.1 |
|---|---|---|---|
| الوقت | 30,000ms+ (يفشل) | 1,077ms | ~990ms |
| حجم Response | 5,000KB+ | 1.1KB | 1.1KB |
| ذاكرة السيرفر/بحث | ~140MB | ~140MB | ~50KB |

---

## Recent Changes (April 2026 — pre-launch hardening)
- **Visual Search by Camera** (April 29, 2026): endpoint `POST /api/visual-search`، رفع صورة، ضغط بـ `sharp` (800px max, JPEG q80)، Gemini Vision بـ prompt عربي للتغليف. Returns `{ keywords, recognized }`. Frontend: camera button (📷) في `Navbar.tsx`، hidden file input بـ `capture="environment"`.
- **OTP channel default → WhatsApp** (`Auth.tsx`): Twilio US trial لا يصل لليمن. UltraMSG هو الطريق الوحيد.
- **Auto-fallback to WhatsApp on SMS failure** (`server/lib/otp-sender.ts`).
- **Lightweight payload** لـ `/api/printing-products`.
- **Saved-image protection**: PATCH endpoints يتجاهلون proxy URLs لمنع overwrite. Helper: `isProxyImageUrl()`.
- **Cloudinary migration script**: `scripts/migrate-base64-to-cloudinary.ts`.
- **Subcategories speed fix** (3-5s → instant): proxy URLs + endpoint جديد `/api/subcategories/image/:id`.
- **UltraMSG WhatsApp OTP**: secrets موجودة ✅.
