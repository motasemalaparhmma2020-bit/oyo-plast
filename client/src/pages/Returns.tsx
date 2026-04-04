import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, RefreshCw, CheckCircle, XCircle, Clock, Package, Phone } from "lucide-react";
import { Link } from "wouter";

export default function Returns() {
  const { data: settings } = useQuery<any>({
    queryKey: ["/api/home-settings"],
    queryFn: async () => {
      const res = await fetch("/api/home-settings", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const customContent = settings?.returnsContent;

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
        {customContent ? (
          <Card className="mb-6">
            <CardContent className="p-6">
              <div
                className="text-muted-foreground leading-relaxed whitespace-pre-wrap"
                data-testid="text-returns-custom-content"
              >
                {customContent}
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
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
                  {[
                    ["عيب في التصنيع:", "إذا وجد عيب صناعي واضح في المنتج"],
                    ["خطأ في الطلب:", "إذا تم توصيل منتج مختلف عما طلبته"],
                    ["تلف أثناء الشحن:", "إذا وصل المنتج تالفاً بسبب النقل"],
                    ["عدم مطابقة المواصفات:", "إذا لم يطابق المنتج الوصف المعروض"],
                  ].map(([k, v]) => (
                    <li key={k} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-1 shrink-0" />
                      <span><strong>{k}</strong> {v}</span>
                    </li>
                  ))}
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
                  {[
                    ["المنتجات المطبوعة حسب الطلب:", "لا يمكن استرجاع الأكياس أو المنتجات المطبوعة بتصميم خاص"],
                    ["سوء الاستخدام:", "إذا تضرر المنتج بسبب سوء الاستخدام أو التخزين"],
                    ["انتهاء المهلة:", "إذا مرت أكثر من 48 ساعة على استلام الطلب"],
                    ["فتح العبوة المغلقة:", "بعض المنتجات لا يمكن استرجاعها بعد فتح العبوة"],
                  ].map(([k, v]) => (
                    <li key={k} className="flex items-start gap-2">
                      <XCircle className="h-4 w-4 text-red-500 mt-1 shrink-0" />
                      <span><strong>{k}</strong> {v}</span>
                    </li>
                  ))}
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
                  {[
                    ["التواصل مع خدمة العملاء", "اتصل بنا عبر الواتساب: 774997589"],
                    ["إرسال تفاصيل الطلب", "أرسل رقم الطلب وصور واضحة للمنتج والمشكلة"],
                    ["انتظار المراجعة", "سنراجع طلبك خلال 24 ساعة ونرد عليك"],
                    ["الاستبدال أو الاسترداد", "سنقوم بالاستبدال أو رد المبلغ حسب الحالة"],
                  ].map(([title, desc], i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold shrink-0">{i + 1}</div>
                      <div>
                        <p className="font-medium">{title}</p>
                        <p className="text-sm text-muted-foreground">{desc}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            <Card className="border-primary/20 mb-6">
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
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <Phone className="h-4 w-4 text-primary" />
                  <span className="font-medium">واتساب:</span>
                  <a href="tel:+967774997589" className="text-primary font-bold" data-testid="link-whatsapp">+967 774 997 589</a>
                </div>
              </CardContent>
            </Card>

            <div className="mt-4 p-4 bg-muted/50 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">
                رقم توثيق الاسم التجاري: <strong>139688</strong>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
