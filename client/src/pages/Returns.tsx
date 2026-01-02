import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, RefreshCw, AlertCircle, CheckCircle, XCircle, Clock, Package, Phone } from "lucide-react";
import { Link } from "wouter";

export default function Returns() {
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
            <h1 className="text-2xl font-bold" data-testid="text-returns-title">سياسة الاسترجاع والاستبدال</h1>
          </div>
          <p className="text-white/80">نلتزم برضاكم ونضمن حقوقكم</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="mb-6 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-primary/10 p-3 rounded-full">
                <RefreshCw className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-primary">أويو بلاست - ضمان الجودة</h2>
                <p className="text-muted-foreground">منصتكم الموثوقة لمستلزمات الطباعة والبلاستيك</p>
              </div>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              نحن في أويو بلاست نضع رضا عملائنا في المقام الأول. نلتزم بتقديم منتجات عالية الجودة، 
              وفي حال عدم مطابقة المنتج للمواصفات المتفق عليها، نضمن لكم حق الاسترجاع أو الاستبدال 
              وفقاً للشروط التالية.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <CheckCircle className="h-5 w-5" />
              حالات قبول الاسترجاع
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none text-muted-foreground">
            <ul className="space-y-3 list-none pr-0">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-1 shrink-0" />
                <span><strong>عيب في التصنيع:</strong> إذا وجد عيب صناعي واضح في المنتج</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-1 shrink-0" />
                <span><strong>خطأ في الطلب:</strong> إذا تم توصيل منتج مختلف عما طلبته</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-1 shrink-0" />
                <span><strong>تلف أثناء الشحن:</strong> إذا وصل المنتج تالفاً بسبب النقل</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-1 shrink-0" />
                <span><strong>عدم مطابقة المواصفات:</strong> إذا لم يطابق المنتج الوصف المعروض</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              حالات رفض الاسترجاع
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none text-muted-foreground">
            <ul className="space-y-3 list-none pr-0">
              <li className="flex items-start gap-2">
                <XCircle className="h-4 w-4 text-red-500 mt-1 shrink-0" />
                <span><strong>المنتجات المطبوعة حسب الطلب:</strong> لا يمكن استرجاع الأكياس أو المنتجات المطبوعة بتصميم خاص</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="h-4 w-4 text-red-500 mt-1 shrink-0" />
                <span><strong>سوء الاستخدام:</strong> إذا تضرر المنتج بسبب سوء الاستخدام أو التخزين</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="h-4 w-4 text-red-500 mt-1 shrink-0" />
                <span><strong>انتهاء المهلة:</strong> إذا مرت أكثر من 48 ساعة على استلام الطلب</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="h-4 w-4 text-red-500 mt-1 shrink-0" />
                <span><strong>فتح العبوة المغلقة:</strong> بعض المنتجات لا يمكن استرجاعها بعد فتح العبوة</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Clock className="h-5 w-5" />
              المدة الزمنية للاسترجاع
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="bg-primary/10 p-2 rounded-full">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-bold">48 ساعة</p>
                <p className="text-sm text-muted-foreground">المهلة القصوى للإبلاغ عن مشكلة بعد الاستلام</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              يجب التواصل معنا خلال 48 ساعة من استلام الطلب وإرسال صور واضحة توضح المشكلة.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Package className="h-5 w-5" />
              خطوات طلب الاسترجاع
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4 list-none pr-0">
              <li className="flex items-start gap-3">
                <div className="bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold shrink-0">1</div>
                <div>
                  <p className="font-medium">التواصل مع خدمة العملاء</p>
                  <p className="text-sm text-muted-foreground">اتصل بنا عبر الواتساب: 774997589</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold shrink-0">2</div>
                <div>
                  <p className="font-medium">إرسال تفاصيل الطلب</p>
                  <p className="text-sm text-muted-foreground">أرسل رقم الطلب وصور واضحة للمنتج والمشكلة</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold shrink-0">3</div>
                <div>
                  <p className="font-medium">انتظار المراجعة</p>
                  <p className="text-sm text-muted-foreground">سنراجع طلبك خلال 24 ساعة ونرد عليك</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold shrink-0">4</div>
                <div>
                  <p className="font-medium">الاستبدال أو الاسترداد</p>
                  <p className="text-sm text-muted-foreground">سنقوم بالاستبدال أو رد المبلغ حسب الحالة</p>
                </div>
              </li>
            </ol>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-full">
                <Phone className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-bold">للتواصل والاستفسار</h3>
                <p className="text-muted-foreground">نحن هنا لمساعدتك</p>
              </div>
            </div>
            <div className="grid gap-3">
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <Phone className="h-4 w-4 text-primary" />
                <span className="font-medium">واتساب:</span>
                <a href="tel:+967774997589" className="text-primary font-bold" data-testid="link-whatsapp">+967 774 997 589</a>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 p-4 bg-muted/50 rounded-lg text-center">
          <p className="text-sm text-muted-foreground">
            رقم توثيق الاسم التجاري: <strong>139688</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
