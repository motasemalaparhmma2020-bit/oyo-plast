# OYO PLAST - متجر أويو بلاست

## Overview
متجر إلكتروني متكامل لمستلزمات التغليف والبلاستيك في اليمن. مصمم بواجهة عربية RTL مستوحاة من SHEIN وsavvy.sa.

## Recent Changes (December 2024)
- إضافة صفحة تفاصيل المنتج مع التسعير الديناميكي
- إضافة نظام الدفع (عربون عبر الكريمي/النجم + رفع إشعار)
- إنشاء لوحة تحكم Admin محمية بكلمة مرور
- تحسين عرض الأسعار بالعملتين (YER/SAR)
- إضافة 18 مدينة يمنية للشحن
- **نظام التقييمات**: تقييم المنتجات بالنجوم مع التعليقات
- **تتبع الطلبات**: صفحة /orders مع مراحل التتبع المرئية
- **إدارة المخزون**: تعديل كميات المخزون من لوحة التحكم
- **تقارير المبيعات**: إحصائيات المبيعات وتوزيع الطلبات حسب الحالة

## Key Features
- عرض مزدوج للأسعار (ريال يمني/سعودي)
- تسعير ديناميكي حسب الكمية
- رفع ملفات التصميم
- 3 طرق دفع: عند الاستلام، تحويل الكريمي، تحويل النجم
- لوحة تحكم لإدارة الطلبات
- نظام تقييم المنتجات (1-5 نجوم)
- تتبع الطلبات للعملاء
- إدارة المخزون
- تقارير وإحصائيات المبيعات

## Future Enhancements (Not Implemented)
- **إشعارات WhatsApp/SMS**: يتطلب ربط Twilio - المستخدم رفض إعداد الربط حالياً. لإضافتها مستقبلاً: 
  1. إعداد Twilio connector من Replit integrations
  2. أو تقديم TWILIO_ACCOUNT_SID و TWILIO_AUTH_TOKEN كـ secrets

## Project Architecture

### Frontend (client/src/)
- **pages/**: الصفحات الرئيسية (Home, Products, ProductDetail, Cart, Checkout, Admin)
- **components/**: المكونات المشتركة (Navbar, BottomNav, ProductCard)
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

## Admin Access
- URL: `/admin`
- Password: Set via ADMIN_PASSWORD environment variable

## Development
```bash
npm run dev     # Start development server
npm run db:push # Push schema changes
```

## Design Guidelines
- Primary color: Sky blue (#0A7CFF)
- RTL Arabic layout
- Mobile-first responsive design
- IBM Plex Sans Arabic font
