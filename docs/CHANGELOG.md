# OYO PLAST — Changelog

> ملف أرشيف للتغييرات التاريخية. للحالة الراهنة انظر `replit.md`.

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
