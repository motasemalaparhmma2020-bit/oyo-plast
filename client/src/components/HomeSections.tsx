import { useState } from "react";
import { Truck, ShieldCheck, BadgeDollarSign, Headphones, Package, Star, ChevronDown, ChevronUp, Users, MapPin, Award } from "lucide-react";

export type SectionSize = "small" | "medium" | "large";

export const sectionPy: Record<SectionSize, string> = {
  small: "py-6",
  medium: "py-10",
  large: "py-16",
};
export const sectionGap: Record<SectionSize, string> = {
  small: "gap-2",
  medium: "gap-3",
  large: "gap-4",
};
export const cardPad: Record<SectionSize, string> = {
  small: "p-3",
  medium: "p-4",
  large: "p-5",
};
export const titleSize: Record<SectionSize, string> = {
  small: "text-lg",
  medium: "text-2xl",
  large: "text-3xl",
};

// ── قسم لماذا أويو بلاست؟ ───────────────────────────────────────────────────
export function WhyUsSection({ size = "medium" }: { size?: SectionSize }) {
  const features = [
    {
      icon: <BadgeDollarSign className="h-7 w-7" />,
      title: "أسعار الجملة",
      desc: "أفضل أسعار مستلزمات التغليف في اليمن مباشرةً من الموردين",
      color: "from-green-400 to-emerald-500",
    },
    {
      icon: <ShieldCheck className="h-7 w-7" />,
      title: "جودة مضمونة",
      desc: "كل منتج مفحوص ومعتمد من موردين موثوقين",
      color: "from-blue-400 to-blue-600",
    },
    {
      icon: <Truck className="h-7 w-7" />,
      title: "توصيل لكل اليمن",
      desc: "نوصّل طلبك لجميع المحافظات اليمنية",
      color: "from-orange-400 to-orange-500",
    },
    {
      icon: <Package className="h-7 w-7" />,
      title: "تنوع المنتجات",
      desc: "أكياس، علب، رولات، طباعة مخصصة، وأكثر من 500 منتج",
      color: "from-purple-400 to-purple-600",
    },
    {
      icon: <Headphones className="h-7 w-7" />,
      title: "دعم على واتساب",
      desc: "فريق خدمة العملاء متاح للرد على استفساراتك",
      color: "from-teal-400 to-teal-500",
    },
    {
      icon: <Award className="h-7 w-7" />,
      title: "نقاط الولاء",
      desc: "اكسب نقاطاً مع كل طلب واستبدلها بخصومات مجانية",
      color: "from-yellow-400 to-yellow-500",
    },
  ];

  const py = sectionPy[size];
  const gap = sectionGap[size];
  const pad = cardPad[size];
  const hSize = titleSize[size];

  return (
    <section className={`px-4 ${py} bg-gray-50 dark:bg-gray-900/50`} dir="rtl" data-testid="section-why-us">
      <div className="text-center mb-8">
        <h2 className={`${hSize} font-black text-gray-900 dark:text-white mb-2`}>
          لماذا تختار أويو بلاست؟
        </h2>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          منصة متكاملة لمستلزمات التغليف — نربطك بأفضل الموردين في اليمن
        </p>
      </div>

      <div className={`grid grid-cols-2 ${gap}`}>
        {features.map((f, i) => (
          <div
            key={i}
            className={`bg-white dark:bg-gray-800 rounded-2xl ${pad} shadow-sm border border-border flex flex-col gap-2`}
            data-testid={`why-us-card-${i}`}
          >
            <div className={`bg-gradient-to-br ${f.color} text-white rounded-xl p-2.5 w-fit`}>
              {f.icon}
            </div>
            <p className="font-bold text-sm text-gray-900 dark:text-white leading-snug">{f.title}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── قسم الأرقام ──────────────────────────────────────────────────────────────
export function StatsSection({ size = "medium" }: { size?: SectionSize }) {
  const py = sectionPy[size];
  const hSize = titleSize[size];
  const statNumSize: Record<SectionSize, string> = { small: "text-2xl", medium: "text-3xl", large: "text-4xl" };

  const stats = [
    { value: "+500", label: "منتج متنوع", icon: <Package className="h-6 w-6" /> },
    { value: "+20", label: "مورد موثوق", icon: <Award className="h-6 w-6" /> },
    { value: "+18", label: "محافظة يمنية", icon: <MapPin className="h-6 w-6" /> },
    { value: "+1000", label: "عميل راضٍ", icon: <Users className="h-6 w-6" /> },
  ];

  return (
    <section
      className={`px-4 ${py} bg-gradient-to-l from-blue-600 to-blue-700 text-white`}
      dir="rtl"
      data-testid="section-stats"
    >
      <div className="text-center mb-8">
        <h2 className={`${hSize} font-black mb-1`}>أرقامنا تتحدث</h2>
        <p className="text-blue-100 text-sm">ثقة آلاف العملاء في اليمن</p>
      </div>
      <div className={`grid grid-cols-2 ${sectionGap[size]}`}>
        {stats.map((s, i) => (
          <div
            key={i}
            className={`bg-white/15 backdrop-blur rounded-2xl ${cardPad[size]} text-center flex flex-col items-center gap-2`}
            data-testid={`stat-card-${i}`}
          >
            <div className="bg-white/20 rounded-xl p-2">{s.icon}</div>
            <p className={`${statNumSize[size]} font-black`}>{s.value}</p>
            <p className="text-blue-100 text-xs font-medium">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── قسم الأسئلة الشائعة ──────────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: "كيف أطلب من أويو بلاست؟",
    a: "سجّل حساباً، تصفّح المنتجات، أضف ما تريده للسلة، ثم أكمل الطلب. سيتواصل معك فريقنا لتأكيد الطلب والتوصيل.",
  },
  {
    q: "هل تبيعون بالجملة للتجار؟",
    a: "نعم، نتخصص في بيع الجملة للتجار وأصحاب المحلات والمصانع. كلما زادت الكمية كلما انخفض السعر.",
  },
  {
    q: "هل يمكن الطباعة على المنتجات؟",
    a: "نعم، كثير من منتجاتنا تدعم الطباعة المخصصة بشعارك واسم نشاطك. ارفع تصميمك عند الطلب.",
  },
  {
    q: "كيف يتم التوصيل؟",
    a: "نوصّل لجميع محافظات اليمن عبر شركات الشحن المعتمدة. مدة التوصيل من 2-5 أيام حسب المحافظة.",
  },
  {
    q: "هل يمكن الدفع عند الاستلام؟",
    a: "نعم، الدفع نقداً عند التسليم متاح في جميع المناطق. كما يمكن الدفع بالتحويل البنكي.",
  },
  {
    q: "هل هناك نظام تقسيط للطلبات الكبيرة؟",
    a: "نعم، الطلبات التي تتجاوز 50,000 ريال يمني مؤهلة لنظام التقسيط. تواصل معنا لمعرفة التفاصيل.",
  },
  {
    q: "كيف أتواصل مع خدمة العملاء؟",
    a: "عبر واتساب مباشرةً، أو من خلال قسم الطلبات في حسابك. فريقنا يرد خلال ساعات العمل.",
  },
  {
    q: "هل يمكن إرجاع المنتجات؟",
    a: "نعم، نقبل الإرجاع والاستبدال خلال 3 أيام من الاستلام في حال وجود عيب مصنعي أو خطأ في الطلب.",
  },
];

export function FaqSection({ size = "medium" }: { size?: SectionSize }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const py = sectionPy[size];
  const hSize = titleSize[size];

  return (
    <section className={`px-4 ${py} bg-white dark:bg-background`} dir="rtl" data-testid="section-faq">
      <div className="text-center mb-8">
        <h2 className={`${hSize} font-black text-gray-900 dark:text-white mb-2`}>
          الأسئلة الشائعة
        </h2>
        <p className="text-sm text-muted-foreground">
          كل ما تريد معرفته عن أويو بلاست
        </p>
      </div>

      <div className="space-y-2 max-w-2xl mx-auto">
        {FAQ_ITEMS.map((item, i) => (
          <div
            key={i}
            className="border border-border rounded-2xl overflow-hidden"
            data-testid={`faq-item-${i}`}
          >
            <button
              className="w-full flex items-center justify-between px-4 py-4 text-right bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              data-testid={`faq-toggle-${i}`}
            >
              <span className="font-bold text-sm text-gray-900 dark:text-white flex-1 text-right">
                {item.q}
              </span>
              <div className="mr-3 flex-shrink-0 text-primary">
                {openIndex === i
                  ? <ChevronUp className="h-4 w-4" />
                  : <ChevronDown className="h-4 w-4" />
                }
              </div>
            </button>
            {openIndex === i && (
              <div className="px-4 pb-4 bg-blue-50/50 dark:bg-gray-800/50 border-t border-border">
                <p className="text-sm text-muted-foreground leading-relaxed pt-3">
                  {item.a}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="text-center mt-8">
        <p className="text-sm text-muted-foreground mb-3">لم تجد إجابة لسؤالك؟</p>
        <a
          href="https://wa.me/967774997589"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-2xl transition-colors text-sm"
          data-testid="btn-whatsapp-faq"
        >
          <Star className="h-4 w-4" />
          تواصل عبر واتساب
        </a>
      </div>
    </section>
  );
}
