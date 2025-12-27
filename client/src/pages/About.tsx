import { Card, CardContent } from "@/components/ui/card";
import { Package, Truck, CreditCard, Shield, Phone, MapPin, Clock, Award, FileText, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import oyoLogo from "@assets/FB_IMG_1748731871206_1766870523968.jpg";

export default function About() {
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
            <img
              src={oyoLogo}
              alt="OYO PLAST"
              className="w-24 h-24 mx-auto mb-4 rounded-2xl shadow-lg bg-white p-2"
              data-testid="img-oyo-logo"
            />
            <h1 className="text-3xl font-bold mb-2" data-testid="text-about-title">أويو بلاست</h1>
            <p className="text-lg opacity-90">وجهتك الأولى لمستلزمات التغليف والبلاستيك في اليمن</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* البيانات الرسمية */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-8 flex items-center justify-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <span className="font-medium">رقم توثيق الاسم التجاري:</span>
            <span className="font-bold text-primary text-lg">139688</span>
          </div>
        </div>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4 text-[#2196F3]">من نحن</h2>
          <Card>
            <CardContent className="p-6">
              <p className="text-lg leading-relaxed text-muted-foreground">
                <strong className="text-primary">أويو بلاست</strong> هي شركة يمنية رائدة متخصصة في توفير حلول التغليف والبلاستيك 
                بجودة عالية وأسعار منافسة. نخدم المطاعم والمحلات التجارية والشركات والأفراد في جميع أنحاء اليمن، 
                ونسعى دائماً لتقديم أفضل الحلول لاحتياجات التغليف المختلفة.
              </p>
              <p className="text-lg leading-relaxed text-muted-foreground mt-4">
                تأسست الشركة بهدف سد حاجة السوق اليمني من مواد التغليف عالية الجودة، ونفخر بتقديم 
                منتجات متنوعة تشمل الأكياس البلاستيكية، الأكياس القماشية، أكياس الدعاية، العلب، 
                الأكواب الورقية، ومستلزمات التغليف الاحترافية.
              </p>
              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>رقم توثيق الاسم التجاري:</strong> 139688
                </p>
              </div>
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
