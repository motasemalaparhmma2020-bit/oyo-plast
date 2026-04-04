import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Lock, Eye, UserCheck, FileText, AlertCircle, ArrowRight, CreditCard, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Privacy() {
  const { data: settings } = useQuery<any>({
    queryKey: ["/api/home-settings"],
    queryFn: async () => {
      const res = await fetch("/api/home-settings", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const customContent = settings?.privacyContent;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background" dir="rtl">
      <div className="bg-gradient-to-l from-[#1976D2] to-[#2196F3] text-white py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-6">
            <Link href="/">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" data-testid="button-back-home">
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <span className="text-white/80">العودة للرئيسية</span>
          </div>
          <div className="text-center">
            <Shield className="h-16 w-16 mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-2" data-testid="text-privacy-title">سياسة الخصوصية</h1>
            <p className="text-lg opacity-90">حماية بياناتك أولويتنا</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {customContent ? (
          <Card className="mb-6">
            <CardContent className="p-6">
              <div
                className="text-muted-foreground leading-relaxed whitespace-pre-wrap"
                data-testid="text-privacy-custom-content"
              >
                {customContent}
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="mb-6">
              <CardContent className="p-6">
                <p className="text-muted-foreground leading-relaxed">
                  نحن في <strong className="text-primary">أويو بلاست</strong> نلتزم التزاماً تاماً بحماية خصوصية عملائنا وتأمين بياناتهم الشخصية. 
                  توضح هذه السياسة كيفية جمع واستخدام وحماية معلوماتك الشخصية عند استخدام موقعنا وخدماتنا.
                </p>
                <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong>رقم توثيق الاسم التجاري:</strong> 139688
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* أمان الدفع الإلكتروني */}
            <section className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-green-500/10 p-2 rounded-full">
                  <CreditCard className="h-5 w-5 text-green-600" />
                </div>
                <h2 className="text-xl font-bold">أمان المدفوعات الإلكترونية</h2>
              </div>
              <Card>
                <CardContent className="p-6">
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    نلتزم بأعلى معايير الأمان لحماية عمليات الدفع الإلكتروني عبر المحافظ الإلكترونية:
                  </p>
                  <ul className="space-y-3 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 mt-1">✓</span>
                      <span><strong>تشفير كامل:</strong> جميع عمليات الدفع عبر المحافظ الإلكترونية (جوالي، جيب، ون كاش، فلوسك، بنك الكريمي) مشفرة بالكامل</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 mt-1">✓</span>
                      <span><strong>عدم تخزين بيانات الدفع:</strong> لا نحتفظ بأي بيانات حساسة لحسابات المحافظ الإلكترونية</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 mt-1">✓</span>
                      <span><strong>التحقق الآمن:</strong> نستخدم نظام تحقق متعدد المراحل لحماية المعاملات</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 mt-1">✓</span>
                      <span><strong>حماية إشعارات التحويل:</strong> صور الإشعارات المرفوعة محمية ولا يمكن الوصول إليها من قبل أطراف ثالثة</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </section>

            {/* المحافظ الإلكترونية المعتمدة */}
            <section className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-[#2196F3]/10 p-2 rounded-full">
                  <Smartphone className="h-5 w-5 text-[#2196F3]" />
                </div>
                <h2 className="text-xl font-bold">المحافظ الإلكترونية المعتمدة</h2>
              </div>
              <Card>
                <CardContent className="p-6">
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    نتعامل حصرياً مع المحافظ الإلكترونية المرخصة والموثوقة في اليمن:
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {["جوالي", "جيب", "ون كاش", "فلوسك", "بنك الكريمي"].map((w) => (
                      <div key={w} className="text-center p-3 bg-muted/50 rounded-lg">
                        <span className="font-medium text-sm">{w}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </section>

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
                      {[
                        ["معلومات الحساب:", "الاسم، رقم الهاتف، البريد الإلكتروني"],
                        ["معلومات الشحن:", "العنوان، المدينة، المحافظة"],
                        ["معلومات الطلبات:", "تاريخ الطلبات، المنتجات المشتراة"],
                        ["معلومات النشاط التجاري:", "نوع النشاط (اختياري)"],
                      ].map(([k, v]) => (
                        <li key={k} className="flex items-start gap-2">
                          <span className="text-[#2196F3] mt-1">*</span>
                          <span><strong>{k}</strong> {v}</span>
                        </li>
                      ))}
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
                      {[
                        "معالجة وتنفيذ طلباتك",
                        "التواصل معك بخصوص طلباتك",
                        "تحسين خدماتنا ومنتجاتنا",
                        "إرسال إشعارات عن الطلبات والعروض (بموافقتك)",
                      ].map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <span className="text-[#2196F3] mt-1">*</span>
                          <span>{item}</span>
                        </li>
                      ))}
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
                      {["تشفير البيانات أثناء النقل", "تخزين آمن للمعلومات", "وصول محدود للموظفين المعتمدين فقط"].map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <span className="text-[#2196F3] mt-1">*</span>
                          <span>{item}</span>
                        </li>
                      ))}
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
                    <p className="text-muted-foreground leading-relaxed mb-4">لديك الحق في:</p>
                    <ul className="space-y-3 text-muted-foreground">
                      {[
                        "الوصول إلى معلوماتك الشخصية",
                        "تصحيح أي معلومات غير دقيقة",
                        "طلب حذف بياناتك",
                        "إلغاء الاشتراك من الإشعارات التسويقية",
                      ].map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <span className="text-[#2196F3] mt-1">*</span>
                          <span>{item}</span>
                        </li>
                      ))}
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
                      قد نقوم بتحديث هذه السياسة من وقت لآخر. سنعلمك بأي تغييرات جوهرية عبر إشعار على موقعنا أو عبر البريد الإلكتروني.
                    </p>
                    <p className="text-sm text-muted-foreground mt-4">آخر تحديث: ديسمبر 2024</p>
                  </CardContent>
                </Card>
              </section>
            </div>

            <div className="mt-8 text-center text-muted-foreground pb-20">
              <p>للاستفسارات حول سياسة الخصوصية، تواصل معنا عبر الرقم الرسمي:</p>
              <p className="font-semibold mt-2 text-lg text-primary" dir="ltr">+967 774 997 589</p>
              <p className="text-sm mt-4">رقم توثيق الاسم التجاري: <strong>139688</strong></p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
