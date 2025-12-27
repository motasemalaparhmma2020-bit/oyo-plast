import { Card, CardContent } from "@/components/ui/card";
import { Package, Truck, CreditCard, Shield, Phone, MapPin, Clock, Award } from "lucide-react";
import oyoLogo from "@assets/FB_IMG_1748731871206_1766870523968.jpg";

export default function About() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      <div className="bg-gradient-to-l from-[#1976D2] to-[#2196F3] text-white py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <img
            src={oyoLogo}
            alt="OYO PLAST"
            className="w-24 h-24 mx-auto mb-4 rounded-2xl shadow-lg bg-white p-2"
          />
          <h1 className="text-3xl font-bold mb-2">أويو بلاست</h1>
          <p className="text-lg opacity-90">وجهتك الأولى لمستلزمات التغليف والبلاستيك في اليمن</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4 text-[#2196F3]">من نحن</h2>
          <Card>
            <CardContent className="p-6">
              <p className="text-lg leading-relaxed text-muted-foreground">
                أويو بلاست هي شركة يمنية رائدة متخصصة في توفير مستلزمات التغليف والبلاستيك بجودة عالية وأسعار منافسة. 
                نخدم المطاعم والمحلات التجارية والشركات في جميع أنحاء اليمن، ونسعى دائماً لتقديم أفضل الحلول 
                لاحتياجات التغليف المختلفة.
              </p>
              <p className="text-lg leading-relaxed text-muted-foreground mt-4">
                تأسست الشركة بهدف سد حاجة السوق اليمني من مواد التغليف عالية الجودة، ونفخر بتقديم 
                منتجات متنوعة تشمل الأكياس البلاستيكية، العلب، الأكواب الورقية، ومستلزمات التنظيف.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4 text-[#2196F3]">لماذا أويو بلاست؟</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 flex items-start gap-4">
                <div className="bg-[#2196F3]/10 p-3 rounded-full">
                  <Award className="h-6 w-6 text-[#2196F3]" />
                </div>
                <div>
                  <h3 className="font-bold mb-1">جودة عالية</h3>
                  <p className="text-sm text-muted-foreground">منتجات مستوردة بأعلى معايير الجودة</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-start gap-4">
                <div className="bg-[#2196F3]/10 p-3 rounded-full">
                  <CreditCard className="h-6 w-6 text-[#2196F3]" />
                </div>
                <div>
                  <h3 className="font-bold mb-1">أسعار تنافسية</h3>
                  <p className="text-sm text-muted-foreground">أفضل الأسعار مع خصومات على الكميات</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-start gap-4">
                <div className="bg-[#2196F3]/10 p-3 rounded-full">
                  <Truck className="h-6 w-6 text-[#2196F3]" />
                </div>
                <div>
                  <h3 className="font-bold mb-1">توصيل سريع</h3>
                  <p className="text-sm text-muted-foreground">نوصل لجميع المحافظات اليمنية</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-start gap-4">
                <div className="bg-[#2196F3]/10 p-3 rounded-full">
                  <Shield className="h-6 w-6 text-[#2196F3]" />
                </div>
                <div>
                  <h3 className="font-bold mb-1">ضمان الجودة</h3>
                  <p className="text-sm text-muted-foreground">استبدال المنتجات في حال وجود عيوب</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4 text-[#2196F3]">تواصل معنا</h2>
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="bg-[#2196F3]/10 p-3 rounded-full">
                  <Phone className="h-5 w-5 text-[#2196F3]" />
                </div>
                <div>
                  <p className="font-semibold">الهاتف</p>
                  <p className="text-muted-foreground" dir="ltr">+967 774 997 589</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="bg-[#2196F3]/10 p-3 rounded-full">
                  <MapPin className="h-5 w-5 text-[#2196F3]" />
                </div>
                <div>
                  <p className="font-semibold">العنوان</p>
                  <p className="text-muted-foreground">اليمن - الحديدة</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="bg-[#2196F3]/10 p-3 rounded-full">
                  <Clock className="h-5 w-5 text-[#2196F3]" />
                </div>
                <div>
                  <p className="font-semibold">ساعات العمل</p>
                  <p className="text-muted-foreground">السبت - الخميس: 8 صباحاً - 10 مساءً</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
