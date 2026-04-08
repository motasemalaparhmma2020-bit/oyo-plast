import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileText, ShoppingBag, Truck, CreditCard, RefreshCw, Scale, MessageCircle } from "lucide-react";
import { Link } from "wouter";

export default function Terms() {
  const { data: settings } = useQuery<any>({
    queryKey: ["/api/home-settings"],
    queryFn: async () => {
      const res = await fetch("/api/home-settings", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const customContent = settings?.affiliateContent;
  const pageTitle = settings?.footerAffiliateText || "التسويق بالعمولة";

  return (
    <div className="min-h-screen bg-background pb-20" dir="rtl">
      <div className="bg-gradient-to-l from-primary to-primary/80 text-white py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 mb-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" data-testid="button-back-home">
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold" data-testid="text-terms-title">{pageTitle}</h1>
          </div>
          <p className="text-white/80">شروط وأحكام استخدام متجر أويو بلاست</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {customContent ? (
          <Card className="mb-6">
            <CardContent className="p-6">
              <div
                className="text-muted-foreground leading-relaxed whitespace-pre-wrap"
                data-testid="text-terms-custom-content"
              >
                {customContent}
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <Scale className="h-5 w-5" />
                  مقدمة
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none text-muted-foreground">
                <p>
                  مرحباً بكم في متجر أويو بلاست. باستخدامك لهذا الموقع وخدماتنا، فإنك توافق على الالتزام بهذه الشروط والأحكام. 
                  يرجى قراءتها بعناية قبل إجراء أي عملية شراء.
                </p>
                <p>رقم حجز الاسم التجاري: <strong>119688</strong> | الاسم: أويو بلاست بيع المواد البلاستيك</p>
                <p>المالك: <strong>معتصم محمد أحمد الأهدل</strong> | الجمهورية اليمنية</p>
              </CardContent>
            </Card>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <ShoppingBag className="h-5 w-5" />
                  الطلب والشراء
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none text-muted-foreground">
                <ul className="space-y-2 list-disc pr-4">
                  <li>جميع الأسعار المعروضة بالريال اليمني والريال السعودي قابلة للتغيير دون إشعار مسبق.</li>
                  <li>يجب التأكد من صحة بيانات الطلب والعنوان قبل تأكيد الطلب.</li>
                  <li>الحد الأدنى للطلب يختلف حسب المنتج والكمية المطلوبة.</li>
                  <li>نحتفظ بحق رفض أي طلب لأسباب مشروعة.</li>
                  <li>الأسعار المعروضة للكميات الكبيرة (الجملة) قد تختلف عن أسعار المفرد.</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <CreditCard className="h-5 w-5" />
                  طرق الدفع
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none text-muted-foreground">
                <ul className="space-y-2 list-disc pr-4">
                  <li><strong>الدفع عند الاستلام:</strong> متاح لجميع المحافظات اليمنية مع رسوم توصيل إضافية.</li>
                  <li><strong>التحويل البنكي:</strong> عبر بنك الكريمي أو بنك النجم مع دفع عربون 30% من قيمة الطلب.</li>
                  <li><strong>المحافظ الإلكترونية:</strong> جوالي، جيب، ون كاش، فلوسك.</li>
                  <li>يجب رفع صورة إشعار التحويل عند اختيار طريقة التحويل البنكي.</li>
                  <li>يتم تأكيد الطلب خلال 24 ساعة من استلام العربون.</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <Truck className="h-5 w-5" />
                  الشحن والتوصيل
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none text-muted-foreground">
                <ul className="space-y-2 list-disc pr-4">
                  <li>نوفر خدمة التوصيل لجميع المحافظات اليمنية الـ 18.</li>
                  <li>مدة التوصيل تتراوح بين 2-7 أيام عمل حسب موقع العميل.</li>
                  <li>رسوم الشحن تحسب حسب الوزن والمسافة وتظهر عند إتمام الطلب.</li>
                  <li>يتحمل العميل مسؤولية صحة عنوان التوصيل المقدم.</li>
                  <li>في حال عدم استلام الشحنة لأسباب تتعلق بالعميل، قد يتم فرض رسوم إعادة الشحن.</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <RefreshCw className="h-5 w-5" />
                  الاستبدال والاسترجاع
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none text-muted-foreground">
                <ul className="space-y-2 list-disc pr-4">
                  <li>يحق للعميل طلب الاستبدال أو الاسترجاع خلال 3 أيام من استلام الطلب.</li>
                  <li>يجب أن تكون المنتجات في حالتها الأصلية وغير مستخدمة.</li>
                  <li>لا يمكن استرجاع المنتجات المطبوعة أو المصممة حسب الطلب.</li>
                  <li>يتحمل العميل رسوم شحن الاسترجاع ما لم يكن هناك خطأ من طرفنا.</li>
                  <li>يتم استرداد المبلغ خلال 7-14 يوم عمل بنفس طريقة الدفع الأصلية.</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <FileText className="h-5 w-5" />
                  المنتجات والجودة
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none text-muted-foreground">
                <ul className="space-y-2 list-disc pr-4">
                  <li>نلتزم بتوفير منتجات عالية الجودة تطابق المواصفات المعروضة.</li>
                  <li>الصور المعروضة توضيحية وقد يختلف اللون الفعلي قليلاً حسب إعدادات الشاشة.</li>
                  <li>نضمن جودة منتجاتنا ونستبدل أي منتج معيب.</li>
                  <li>تخضع خدمات الطباعة والتصميم لمعايير الجودة الخاصة بنا.</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <MessageCircle className="h-5 w-5" />
                  التواصل والشكاوى
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none text-muted-foreground">
                <ul className="space-y-2 list-disc pr-4">
                  <li>للتواصل معنا: واتساب أو اتصال على الرقم +967774997589</li>
                  <li>نرد على الاستفسارات خلال 24 ساعة في أيام العمل.</li>
                  <li>يمكنك تقديم شكوى عبر واتساب وسيتم الرد عليها خلال 48 ساعة.</li>
                  <li>نسعى دائماً لحل أي مشكلة بما يرضي العميل.</li>
                </ul>
              </CardContent>
            </Card>

            {/* بيان الملكية الفكرية */}
            <Card className="mb-6 border-red-200 dark:border-red-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <Scale className="h-5 w-5" />
                  بيان حقوق الملكية الفكرية والحماية القانونية
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none text-muted-foreground space-y-3">
                <p className="font-medium text-foreground">
                  كافة المحتويات، العلامات التجارية (أويو بلاست)، والأنظمة البرمجية لهذا الموقع هي ملكية فكرية
                  مسجّلة باسم <strong>معتصم محمد أحمد الأهدل</strong> بموجب قانون حماية الحق الفكري اليمني،
                  ويمنع نسخها أو محاولة اختراقها تحت طائلة المسؤولية القانونية الكاملة.
                </p>
                <p>
                  يلتزم المتجر بحماية بيانات العملاء وفق المعايير التقنية والقانونية،
                  وتُعدّ أي محاولة وصول غير مشروع للبيانات جريمة إلكترونية يُلاحَق مرتكبها قضائياً.
                </p>
                <p className="text-xs text-muted-foreground">
                  آخر تحديث: ديسمبر 2025 | يسري وفق القانون التجاري اليمني رقم 32 لسنة 1991 وتعديلاته.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground text-sm">آخر تحديث: ديسمبر 2025</p>
                <p className="text-muted-foreground text-sm mt-2">
                  نحتفظ بحق تعديل هذه الشروط والأحكام في أي وقت. سيتم إشعار العملاء بأي تغييرات جوهرية.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
