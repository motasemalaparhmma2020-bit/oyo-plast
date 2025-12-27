import { Card, CardContent } from "@/components/ui/card";
import { Shield, Lock, Eye, UserCheck, FileText, AlertCircle } from "lucide-react";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      <div className="bg-gradient-to-l from-[#1976D2] to-[#2196F3] text-white py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Shield className="h-16 w-16 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">سياسة الخصوصية</h1>
          <p className="text-lg opacity-90">حماية بياناتك أولويتنا</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card className="mb-6">
          <CardContent className="p-6">
            <p className="text-muted-foreground leading-relaxed">
              نحن في أويو بلاست نلتزم بحماية خصوصية عملائنا. توضح هذه السياسة كيفية جمع واستخدام 
              وحماية معلوماتك الشخصية عند استخدام موقعنا وخدماتنا.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-[#2196F3]/10 p-2 rounded-full">
                <FileText className="h-5 w-5 text-[#2196F3]" />
              </div>
              <h2 className="text-xl font-bold">المعلومات التي نجمعها</h2>
            </div>
            <Card>
              <CardContent className="p-6">
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-[#2196F3] mt-1">*</span>
                    <span><strong>معلومات الحساب:</strong> الاسم، رقم الهاتف، البريد الإلكتروني</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#2196F3] mt-1">*</span>
                    <span><strong>معلومات الشحن:</strong> العنوان، المدينة، المحافظة</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#2196F3] mt-1">*</span>
                    <span><strong>معلومات الطلبات:</strong> تاريخ الطلبات، المنتجات المشتراة</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#2196F3] mt-1">*</span>
                    <span><strong>معلومات النشاط التجاري:</strong> نوع النشاط (اختياري)</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-[#2196F3]/10 p-2 rounded-full">
                <Eye className="h-5 w-5 text-[#2196F3]" />
              </div>
              <h2 className="text-xl font-bold">كيف نستخدم معلوماتك</h2>
            </div>
            <Card>
              <CardContent className="p-6">
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-[#2196F3] mt-1">*</span>
                    <span>معالجة وتنفيذ طلباتك</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#2196F3] mt-1">*</span>
                    <span>التواصل معك بخصوص طلباتك</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#2196F3] mt-1">*</span>
                    <span>تحسين خدماتنا ومنتجاتنا</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#2196F3] mt-1">*</span>
                    <span>إرسال إشعارات عن الطلبات والعروض (بموافقتك)</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-[#2196F3]/10 p-2 rounded-full">
                <Lock className="h-5 w-5 text-[#2196F3]" />
              </div>
              <h2 className="text-xl font-bold">حماية معلوماتك</h2>
            </div>
            <Card>
              <CardContent className="p-6">
                <p className="text-muted-foreground leading-relaxed mb-4">
                  نتخذ إجراءات أمنية مناسبة لحماية معلوماتك من الوصول غير المصرح به أو التعديل أو الإفصاح أو الإتلاف.
                </p>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-[#2196F3] mt-1">*</span>
                    <span>تشفير البيانات أثناء النقل</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#2196F3] mt-1">*</span>
                    <span>تخزين آمن للمعلومات</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#2196F3] mt-1">*</span>
                    <span>وصول محدود للموظفين المعتمدين فقط</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-[#2196F3]/10 p-2 rounded-full">
                <UserCheck className="h-5 w-5 text-[#2196F3]" />
              </div>
              <h2 className="text-xl font-bold">حقوقك</h2>
            </div>
            <Card>
              <CardContent className="p-6">
                <p className="text-muted-foreground leading-relaxed mb-4">
                  لديك الحق في:
                </p>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-[#2196F3] mt-1">*</span>
                    <span>الوصول إلى معلوماتك الشخصية</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#2196F3] mt-1">*</span>
                    <span>تصحيح أي معلومات غير دقيقة</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#2196F3] mt-1">*</span>
                    <span>طلب حذف بياناتك</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#2196F3] mt-1">*</span>
                    <span>إلغاء الاشتراك من الإشعارات التسويقية</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-[#2196F3]/10 p-2 rounded-full">
                <AlertCircle className="h-5 w-5 text-[#2196F3]" />
              </div>
              <h2 className="text-xl font-bold">تحديثات السياسة</h2>
            </div>
            <Card>
              <CardContent className="p-6">
                <p className="text-muted-foreground leading-relaxed">
                  قد نقوم بتحديث هذه السياسة من وقت لآخر. سنعلمك بأي تغييرات جوهرية عبر إشعار 
                  على موقعنا أو عبر البريد الإلكتروني.
                </p>
                <p className="text-sm text-muted-foreground mt-4">
                  آخر تحديث: ديسمبر 2024
                </p>
              </CardContent>
            </Card>
          </section>
        </div>

        <div className="mt-8 text-center text-muted-foreground">
          <p>للاستفسارات حول سياسة الخصوصية، تواصل معنا:</p>
          <p className="font-semibold mt-2" dir="ltr">+967 774 997 589</p>
        </div>
      </div>
    </div>
  );
}
