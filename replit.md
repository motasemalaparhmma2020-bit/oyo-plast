# OYO PLAST - متجر أويو بلاست

## Overview
متجر إلكتروني متكامل لطباعة ومستلزمات البلاستيك في اليمن. مصمم بواجهة عربية RTL مستوحاة من SHEIN وsavvy.sa.

**الشعار الجديد**: أويو بلاست - لطباعة ومستلزمات البلاستيك

## Recent Changes (December 2024)
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

## نسبة الإنجاز: 85%

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

### ❌ ما يحتاج إنجاز
1. **إرسال الفواتير عبر WhatsApp** - يتطلب Twilio (مدفوع)
2. **ربط محفظة جوالي** - قيد الانتظار
3. **إشعارات SMS للعملاء** - يتطلب Twilio

## Key Features
- عرض مزدوج للأسعار (ريال يمني/سعودي) - 1 ريال سعودي = 140 ريال يمني
- تسعير ديناميكي حسب الكمية
- رفع ملفات التصميم
- **طريقة الدفع حالياً**: الدفع عند الاستلام لمندوب التوصيل
- لوحة تحكم لإدارة الطلبات
- نظام تقييم المنتجات (1-5 نجوم)
- تتبع الطلبات للعملاء
- إدارة المخزون
- تقارير وإحصائيات المبيعات

## Future Enhancements (Not Implemented)
- **إشعارات WhatsApp/SMS**: يتطلب ربط Twilio (مدفوع)
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

## Database Schema
- `users`: User authentication (Replit Auth)
- `categories`: Product categories
- `products`: Products with dual pricing
- `cart_items`: Shopping cart
- `orders`: Orders with payment info
- `order_items`: Order line items
- `reviews`: تقييمات المنتجات
- `notifications`: إشعارات المستخدمين
- `favorites`: قائمة المفضلة

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

## Design Guidelines
- Primary color: Sky blue (#2196F3)
- RTL Arabic layout
- Mobile-first responsive design
- Cairo Arabic font (خط كايرو)
- Commercial registration: 139688
- Logo: attached_assets/FB_IMG_1748731871206_1766877101101.jpg
