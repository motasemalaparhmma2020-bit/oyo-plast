import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Megaphone, Store, TrendingUp, DollarSign, Users,
  Package, BarChart3, ShieldCheck, ArrowLeft, Handshake
} from "lucide-react";

export default function Partnership() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-emerald-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" dir="rtl">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#2196F3] via-[#1976D2] to-emerald-600 text-white">
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-5 backdrop-blur-sm">
            <Handshake className="w-9 h-9" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3" data-testid="text-partnership-title">
            كن شريكاً في نجاح أويو بلاست
          </h1>
          <p className="text-white/90 text-base md:text-lg max-w-2xl mx-auto">
            اختر طريقتك لزيادة دخلك معنا — مسوّق يربح من كل بيع، أو مورّد يعرض منتجاته على آلاف العملاء.
          </p>
        </div>
      </div>

      {/* Cards */}
      <div className="max-w-5xl mx-auto px-4 py-10 grid md:grid-cols-2 gap-6">
        {/* Marketer Card */}
        <div
          className="bg-white dark:bg-card rounded-2xl shadow-lg border-2 border-emerald-100 dark:border-emerald-900/50 p-6 flex flex-col"
          data-testid="card-partnership-marketer"
        >
          <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center mb-4 shadow-md">
            <Megaphone className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-2 text-emerald-700 dark:text-emerald-400">
            شريك تسويق
          </h2>
          <p className="text-muted-foreground text-sm mb-5">
            مثالي للأفراد وأصحاب الحسابات على التواصل الاجتماعي. اربح عمولة على كل عملية بيع تأتي من كوبونك.
          </p>

          <ul className="space-y-3 mb-6 flex-1">
            <li className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center shrink-0">
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="font-bold text-sm">عمولة نقدية حتى 5%</p>
                <p className="text-xs text-muted-foreground">على قيمة كل طلب يأتي عبر كوبونك</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="font-bold text-sm">خصم لمتابعيك</p>
                <p className="text-xs text-muted-foreground">امنح متابعيك خصم 5% لتشجيع الشراء</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="font-bold text-sm">لوحة تتبع لحظية</p>
                <p className="text-xs text-muted-foreground">شاهد أرباحك وطلباتك في الوقت الفعلي</p>
              </div>
            </li>
          </ul>

          <Link href="/join-marketer">
            <Button
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base gap-2"
              data-testid="button-apply-marketer"
            >
              ابدأ كمسوّق
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <p className="text-[11px] text-muted-foreground text-center mt-3">
            عملية اعتماد سريعة خلال 24-48 ساعة
          </p>
        </div>

        {/* Supplier Card */}
        <div
          className="bg-white dark:bg-card rounded-2xl shadow-lg border-2 border-sky-100 dark:border-sky-900/50 p-6 flex flex-col"
          data-testid="card-partnership-supplier"
        >
          <div className="w-14 h-14 bg-gradient-to-br from-[#2196F3] to-[#1976D2] rounded-xl flex items-center justify-center mb-4 shadow-md">
            <Store className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-2 text-sky-700 dark:text-sky-400">
            شريك مورّد
          </h2>
          <p className="text-muted-foreground text-sm mb-5">
            مثالي للشركات والمصانع والموزّعين. اعرض منتجاتك على آلاف العملاء عبر منصتنا.
          </p>

          <ul className="space-y-3 mb-6 flex-1">
            <li className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-950/50 flex items-center justify-center shrink-0">
                <Package className="w-4 h-4 text-sky-600" />
              </div>
              <div>
                <p className="font-bold text-sm">منصة عرض احترافية</p>
                <p className="text-xs text-muted-foreground">منتجاتك أمام آلاف العملاء يومياً</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-950/50 flex items-center justify-center shrink-0">
                <BarChart3 className="w-4 h-4 text-sky-600" />
              </div>
              <div>
                <p className="font-bold text-sm">لوحة مبيعات كاملة</p>
                <p className="text-xs text-muted-foreground">إدارة الطلبات، المخزون، والمالية</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-950/50 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-sky-600" />
              </div>
              <div>
                <p className="font-bold text-sm">تحصيل آمن ومضمون</p>
                <p className="text-xs text-muted-foreground">تسوية مالية منتظمة وشفافة</p>
              </div>
            </li>
          </ul>

          <Link href="/partnership/supplier/apply">
            <Button
              className="w-full h-12 bg-[#2196F3] hover:bg-[#1976D2] text-white font-bold text-base gap-2"
              data-testid="button-apply-supplier"
            >
              ابدأ كمورّد
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <p className="text-[11px] text-muted-foreground text-center mt-3">
            تتطلب وثائق رسمية - مراجعة خلال 24-72 ساعة
          </p>
        </div>
      </div>

      {/* FAQ tail */}
      <div className="max-w-3xl mx-auto px-4 pb-12 text-center">
        <p className="text-sm text-muted-foreground">
          هل تحتاج للمساعدة في الاختيار؟{" "}
          <a
            href="https://wa.me/967773111110?text=مرحباً، لدي استفسار بخصوص برامج الشراكة"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#2196F3] font-bold hover:underline"
            data-testid="link-partnership-whatsapp"
          >
            تواصل معنا على واتساب
          </a>
        </p>
      </div>
    </div>
  );
}
