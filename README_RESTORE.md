# أويو بلاست (OYO Plast) — دليل الاستعادة الكامل

## المعلومات الأساسية
- اسم المتجر: أويو بلاست - مستلزمات التغليف والأكياس
- الدومين: https://oyoplast.com
- البريد الإلكتروني المرتبط: حساب Replit الخاص بك

## محتويات النسخة الاحتياطية
```
client/          ← واجهة المتجر (React + TypeScript)
server/          ← الخادم الخلفي (Node.js + Express)
shared/          ← قاعدة البيانات والأنواع المشتركة
public/          ← الملفات العامة (sitemap, icons, uploads)
package.json     ← المكتبات المطلوبة
drizzle.config.ts ← إعدادات قاعدة البيانات
vite.config.ts   ← إعدادات Vite
tailwind.config.ts ← إعدادات التصميم
oyoplast_db_backup.sql ← قاعدة البيانات كاملة (منتجات، فئات، إعدادات)
```

## المتغيرات البيئية المطلوبة (Secrets)
```
DATABASE_URL=          ← رابط قاعدة PostgreSQL
ADMIN_PASSWORD=        ← كلمة مرور لوحة الأدمن
TWILIO_ACCOUNT_SID=    ← حساب Twilio للرسائل
TWILIO_AUTH_TOKEN=     ← مفتاح Twilio
TWILIO_FROM_NUMBER=    ← رقم Twilio (+17405363157)
SESSION_SECRET=        ← مفتاح الجلسات
```

## طريقة الاستعادة على Replit
1. أنشئ Repl جديد من نوع Node.js
2. ارفع جميع الملفات
3. أضف المتغيرات البيئية في قسم Secrets
4. شغّل: npm install
5. استعد قاعدة البيانات: psql $DATABASE_URL < oyoplast_db_backup.sql
6. شغّل: npm run db:push
7. شغّل: npm run dev

## التقنيات المستخدمة
- Frontend: React 18 + TypeScript + Tailwind CSS + shadcn/ui
- Backend: Node.js + Express
- Database: PostgreSQL + Drizzle ORM
- Auth: OTP عبر Twilio SMS
- Hosting: Replit Autoscale

## المنتجات الحالية (9 منتجات)
- أكياس قماش مسطح، شيال، صندوقي
- علاقي رقم 8, 9, 10.5, 11, 12
- أكياس قماشية شيال

## تاريخ النسخة الاحتياطية: 2026-04-07
