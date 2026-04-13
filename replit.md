# OYO PLAST - متجر أويو بلاست

## Overview
متجر إلكتروني متكامل لطباعة ومستلزمات البلاستيك في اليمن. مصمم بواجهة عربية RTL مستوحاة من SHEIN وsavvy.sa.

**الشعار الجديد**: أويو بلاست - لطباعة ومستلزمات البلاستيك

## Recent Changes (April 2026 — Latest)
- **أقسام الأدمن القابلة للطي**: مكوّن `CollapsibleSection` مع حفظ الحالة في localStorage — يطبّق على 6 أقسام في DisplaySettingsSection: إعدادات صفحة المنتج (أزرق)، الخطوط وتصميم الواجهة (بنفسجي)، تحكم البنرات والعروض (أزرق/سماوي)، سديم الذكية (بنفسجي/نيلي)، زر واتساب العائم (أخضر)، إعدادات الدفع والشحن (أخضر/زمرد) — مطوية افتراضياً عند الدخول، تتذكر الحالة بين الجلسات

## Recent Changes (April 2026 — Previous Latest)
- **بنرات قابلة للنقر**: بنر "شحن مجاني" → /products?filter=free-shipping | بنر "عروض سريعة" → /products?filter=flash-deals
- **hasFreeShipping**: حقل جديد في جدول products — toggle في فورم تعديل المنتج بالأدمن
- **فلتر المنتجات**: /api/products?filter=free-shipping|flash-deals — دعم مباشر في الـ API
- **ألوان البنرات**: `offerBannerShippingBg` و`offerBannerDealsBg` في display_settings — color picker في الأدمن
- **صفحة منتجات مُحسّنة**: header خاص لكل فلتر مع أيقونة وتلوين مناسب + زر رجوع
- **تحكم كامل من الأدمن**: الارتفاع + عدد الأعمدة + ألوان كل بنر + تفعيل/تعطيل

## Recent Changes (April 2026 — Previous)
- **التحويل البنكي**: إضافة `bank_accounts` table + API routes (CRUD admin + public GET)
- **حسابات بنك كريمي**: حساب ريال يمني (3002724617) + حساب ريال سعودي (3020971273) — باسم معتصم محمد أحمد الأهدل — مفعّلان
- **Checkout**: خيار "تحويل بنكي" بجانب المحافظ الإلكترونية — يعرض بيانات البنك + نسخ رقم الحساب + رفع إيصال
- **تذكيرات التقسيط**: POST /api/admin/installment-plans/:id/remind — يرسل واتساب تلقائياً
- **زر "إرسال تذكير"** في بطاقة كل خطة تقسيط في الأدمن
- **إدارة الأقسام الفرعية**: AdminSubcategories component في تاب الأقسام + API routes كاملة
- **إدارة الحسابات البنكية**: AdminBankAccounts component في تاب التقسيط والمدفوعات
- **PENDING — نقطة كريمي**: المستخدم سيُنشئ نقطة حاسب تبع كريمي للدفع المجاني — API integration لاحقاً

## Recent Changes (April 2026)
- **بوابة المورد** (`/supplier`): صفحة مستقلة للموردين - تسجيل دخول برقم الهاتف + PIN، عرض طلباتهم، تحديث حالة التوصيل (pending/picked_up/shipped/delivered/failed)
- **صفحة تتبع الطلب** (`/track`): صفحة عامة للعملاء - البحث برقم الطلب + رقم الهاتف، عرض تفاصيل الطلب مع خط زمني مرئي لمراحل الطلب
- **ربط المنتج بمورد**: في نموذج إضافة/تعديل المنتج، يمكن تعيين مورد محدد للمنتج (بدلاً من التعيين التلقائي حسب المدينة)
- **الرمز السري (PIN) للموردين**: حقل PIN في نموذج المورد في الإدارة، الرمز الافتراضي 1234
- **API جديدة**: `/api/track-order` (عام)، `/api/supplier/login`، `/api/supplier/me`، `/api/supplier/orders`، `/api/supplier/orders/:id/delivery`

## Recent Changes (January 2026)
- **نظام الطباعة المتقدم**: تسعير حسب المقاس مع ألوان مختلفة لكل مقاس
- **معرض صور المنتجات**: صور متعددة للمنتج مع carousel
- **الطباعة المخصصة**: رفع ملفات التصميم مع ملاحظات + حساب تكلفة الطباعة للوحدة
- **تحسين السلة**: عرض المقاس واللون والطباعة المخصصة في السلة
- **تحديث قاعدة البيانات**: حقول جديدة imageUrls, sizePricing, printingPricePerUnit للمنتجات

## Previous Changes (January 2025)
- **نظام التحقق عبر الواتساب (Ultramsg)**: إرسال OTP عبر WhatsApp للتسجيل مع بديل البريد الإلكتروني
- **نظام المسوقين/الموزعين**: اختيار نوع الحساب (عميل/مسوق) مع نظام عمولات
- **جداول جديدة**: ملفات المسوقين، العمولات، جهات اتصال العملاء، التحقق من الهاتف
- **نظام العضوية الشامل**: محفظة بالعملتين (YER/SAR) مع سجل المعاملات
- **نقاط الولاء**: 1 نقطة لكل 1000 ريال يمني أو 7 ريال سعودي، 5 نقاط للتقييم، 15 نقطة للتقييم بصورة
- **صفحة حسابي**: تبويبات (طلباتي، محفظتي، نقاطي) مع ملخص شامل
- **الشراء كزائر**: إمكانية الشراء بدون إنشاء حساب (Guest Checkout)
- **زر "تجربة كعميل"**: في لوحة التحكم لمعاينة الموقع كعميل
- تحديث الشعار والعلامة التجارية في جميع الصفحات
- تبسيط طرق الدفع إلى "الدفع عند الاستلام" فقط حتى يتم ربط محفظة جوالي
- إضافة صفحة تفاصيل المنتج مع التسعير الديناميكي
- إنشاء لوحة تحكم Admin محمية بكلمة مرور
- تحسين عرض الأسعار بالعملتين (YER/SAR)
- إضافة 18 مدينة يمنية للشحن
- **نظام التقييمات**: تقييم المنتجات بالنجوم مع التعليقات
- **تتبع الطلبات**: صفحة /orders مع مراحل التتبع المرئية
- **إدارة المخزون**: تعديل كميات المخزون من لوحة التحكم
- **تقارير المبيعات**: إحصائيات المبيعات وتوزيع الطلبات حسب الحالة
- **قسم طباعة وتصميم**: أكياس قماشية (مسطح، شيال، صندوقي) مع مقاسات وألوان متعددة
- **شاشة ترحيبية**: Splash screen بشعار أويو بلاست عند فتح التطبيق
- **نظام تسجيل العملاء**: صفحة /register مع بيانات العميل
- **إدارة المنتجات**: إضافة/تعديل/حذف المنتجات من لوحة التحكم Admin
- **تحديد الموقع GPS**: تحديد موقع العميل تلقائياً في صفحة الدفع

## نسبة الإنجاز: 90%

### ✅ ما تم إنجازه
1. نظام المستخدمين والتسجيل
2. عرض المنتجات والأقسام
3. سلة التسوق
4. صفحة الدفع (الدفع عند الاستلام)
5. تتبع الطلبات
6. لوحة التحكم Admin
7. نظام التقييمات
8. قائمة المفضلة
9. الإشعارات الداخلية
10. شاشة الترحيب
11. PWA (تثبيت كتطبيق)
12. صفحات قانونية
13. إدارة المنتجات (إضافة/تعديل/حذف)
14. تحديد الموقع GPS للتوصيل
15. **نظام المحفظة**: رصيد بالعملتين مع سجل المعاملات
16. **نقاط الولاء**: نظام مكافآت مع تتبع النقاط والمعاملات
17. **الشراء كزائر**: إمكانية الشراء بدون حساب
18. **صفحة حسابي الشاملة**: تبويبات للطلبات والمحفظة والنقاط

### ❌ ما يحتاج إنجاز
1. **ربط محفظة جوالي** - قيد الانتظار
2. **إشعارات WhatsApp/SMS** - يتم عبر بوابة SMSGate الحالية

## Key Features
- عرض مزدوج للأسعار (ريال يمني/سعودي) - 1 ريال سعودي = 140 ريال يمني
- تسعير ديناميكي حسب الكمية والمقاس
- **تسعير حسب المقاس**: أسعار مختلفة لكل مقاس مع ألوان متوفرة لكل مقاس
- **معرض صور**: صور متعددة للمنتج مع carousel قابل للتمرير
- **طباعة مخصصة**: رفع ملفات التصميم (PDF, PNG, AI, PSD) مع ملاحظات خاصة
- رفع ملفات التصميم
- **طريقة الدفع حالياً**: الدفع عند الاستلام لمندوب التوصيل
- لوحة تحكم لإدارة الطلبات
- نظام تقييم المنتجات (1-5 نجوم)
- تتبع الطلبات للعملاء
- إدارة المخزون
- تقارير وإحصائيات المبيعات

## Future Enhancements (Not Implemented)
- **ربط محفظة جوالي**: قيد الانتظار للاتفاق مع المحفظة
- **رقم صاحب المتجر للفواتير**: +967774997589

## Project Architecture

### Frontend (client/src/)
- **pages/**: الصفحات الرئيسية (Home, Products, ProductDetail, Cart, Checkout, Admin, Orders)
- **components/**: المكونات المشتركة (Navbar, BottomNav, ProductCard, SplashScreen)
- **hooks/**: React hooks للمنتجات، السلة، الطلبات

### Backend (server/)
- **routes.ts**: API endpoints
- **storage.ts**: Database operations
- **db.ts**: Drizzle database connection

### Shared (shared/)
- **schema.ts**: Database schema with Drizzle ORM
- **routes.ts**: API route definitions

## Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Session encryption key
- `ADMIN_PASSWORD`: Admin dashboard password (default: oyo2024admin)

### WhatsApp Verification (Ultramsg)
- `ULTRAMSG_INSTANCE_ID`: معرف حساب Ultramsg
- `ULTRAMSG_TOKEN`: رمز الوصول لـ Ultramsg

### Email Fallback (بديل مجاني)
- `SMTP_HOST`: خادم SMTP
- `SMTP_PORT`: منفذ SMTP (افتراضي: 587)
- `SMTP_USER`: اسم المستخدم
- `SMTP_PASS`: كلمة المرور

**ملاحظة**: إذا لم يتم إعداد Ultramsg أو SMTP، يعمل النظام في وضع التطوير ويعرض كود OTP في الاستجابة.

## Database Schema
- `users`: User authentication (Replit Auth) with accountType (customer/marketer)
- `categories`: Product categories with iconUrl, sortOrder, isActive fields
- `products`: Products with:
  - Dual pricing (price, priceSar)
  - Multiple images (imageUrls array)
  - Size-based pricing (sizePricing JSON: [{size, price, priceSar, colors[], stock}])
  - Printing price per unit (printingPricePerUnit)
  - Commission settings
- `cart_items`: Shopping cart with selectedSize, selectedColor, customPrinting, designNotes, designFileUrl
- `orders`: Orders with payment info and marketer fields
- `order_items`: Order line items with selectedSize, selectedColor, customPrinting, designNotes, designFileUrl
- `reviews`: تقييمات المنتجات
- `notifications`: إشعارات المستخدمين
- `favorites`: قائمة المفضلة
- `wallets`: محفظة المستخدم بالعملتين (YER/SAR)
- `wallet_transactions`: سجل معاملات المحفظة
- `reward_points`: نقاط الولاء للمستخدمين
- `points_transactions`: سجل معاملات النقاط
- `phone_verifications`: كودات OTP للتحقق من الجوال
- `marketer_profiles`: ملفات المسوقين ومعدلات العمولة
- `end_customer_contacts`: جهات اتصال عملاء المسوقين
- `marketer_commissions`: سجل عمولات المسوقين

## Admin Access
- URL: `/admin`
- Password: Set via ADMIN_PASSWORD environment variable (default: oyo2024admin)

## Owner Info
- الاسم: معتصم محمد احمد الاهدل
- رقم الجوال: 774997589
- السجل التجاري: 139688

## Development
```bash
npm run dev     # Start development server
npm run db:push # Push schema changes
```

## Backup and Recovery
- Keep a private git copy of the project at all times.
- Export or snapshot the database regularly.
- Save the admin password and environment variables in a secure place.
- If the site is deleted or broken, restore in this order:
  1. Reopen the saved project or git copy
  2. Restore the database backup
  3. Reapply environment variables
  4. Restart the app
- Keep a tagged backup before every major change.

## Security Notes
- Admin access is protected by a token-based check.
- Public users cannot access admin data without the admin token.
- No system is 100% hack-proof; use strong passwords and limit who knows them.
- Best protection: private backups, secret management, and regular updates.

## Design Guidelines
- Primary color: Sky blue (#2196F3)
- RTL Arabic layout
- Mobile-first responsive design
- Cairo Arabic font (خط كايرو)
- Commercial registration: 139688
- Logo: attached_assets/FB_IMG_1748731871206_1766877101101.jpg
