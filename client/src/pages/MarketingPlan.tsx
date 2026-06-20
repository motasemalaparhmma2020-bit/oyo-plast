import { useEffect, useState } from "react";
import {
  Rocket, Target, Gift, Megaphone, Calendar, Wallet, Film,
  Share2, BarChart3, AlertTriangle, Star, Lightbulb, Printer, ListChecks,
  MessageCircle, Copy, Check,
} from "lucide-react";

const whatsappTexts: { label: string; text: string }[] = [
  {
    label: "أول توصيل مجاني (للعملاء الجدد)",
    text:
      "مرحباً 👋 من أويو بلاست!\n" +
      "عرض خاص لأول طلب لك: 🚚 توصيل *مجاني* بدون حد أدنى.\n" +
      "اطبع شعارك أو صمّم منتجك وشاهد المعاينة الحية قبل الطباعة.\n" +
      "اطلب الآن: ",
  },
  {
    label: "ادعُ صديقاً (إحالة)",
    text:
      "🎁 وفّر على أول طلب لك من أويو بلاست!\n" +
      "استخدم رابط دعوة صديقك واحصل على خصم فوري.\n" +
      "وكل صديق تدعوه = رصيد يُضاف إلى محفظتك تلقائياً.\n" +
      "ابدأ من هنا: ",
  },
  {
    label: "عرض ترويجي عام",
    text:
      "🔥 عروض أويو بلاست هذا الأسبوع!\n" +
      "خصومات على مستلزمات التغليف والطباعة المخصصة.\n" +
      "اطبع اسمك وشعارك بأفضل الأسعار في اليمن.\n" +
      "تصفّح المتجر: ",
  },
  {
    label: "تذكير بسلة متروكة",
    text:
      "مرحباً 👋 لاحظنا أنك تركت منتجات في سلتك بأويو بلاست.\n" +
      "منتجاتك ما زالت محجوزة لك ✅\n" +
      "أكمل طلبك الآن قبل نفاد الكمية: ",
  },
];

/**
 * صفحة داخلية خاصة بمالك المتجر: خطة تسويقية شاملة لأويو بلاست.
 * تُفتح من رابط التطبيق مباشرة على الجوال: /marketing-plan
 * فيها زر "حفظ كـ PDF / طباعة" للحفظ دون اتصال.
 */

type Idea = {
  n: number; title: string; origin: string; why: string; how: string;
  example: string; feature: string;
};

const ideas: Idea[] = [
  {
    n: 1, title: "اشترِ مع صديق ووفّر", origin: "Pinduoduo / Temu — الصين",
    why: "العميل نفسه يجلب أصدقاءه ليحصل على السعر الأقل، فينتشر مجاناً.",
    how: "فعّل عروض الكميات/الباقات. القاعدة: إذا طلب 3 أشخاص نفس المنتج خلال 24 ساعة يحصل الجميع على خصم 20%.",
    example: "«وحدك 1000 ريال… مع صديقين 750 فقط! كوّن فريقك الآن».",
    feature: "عروض الكميات + الباقات (جاهزة)",
  },
  {
    n: 2, title: "جيش المؤثرين الصغار + فيديو الطلبية", origin: "SHEIN — الصين/عالمي",
    why: "50 مؤثراً صغيراً أرخص وأصدق من نجم واحد كبير.",
    how: "استخدم نظام المسوّقين. جنّد 20–40 صانع محتوى يمني صغير (5–50 ألف متابع)، أعطه عمولة + عينة مجانية واطلب فيديو «طلبت من أويو».",
    example: "مؤثرة تفتح كيساً مطبوعاً باسمها وتقول: «شوفوا شغلهم!».",
    feature: "نظام المسوّقين/العمولة (جاهز)",
  },
  {
    n: 3, title: "ادعُ صديقاً: له هدية ولك هدية", origin: "Dropbox — أمريكا",
    why: "مكافأة للطرفين = انتشار متسلسل وأرخص عميل ممكن.",
    how: "رابط الإحالة + نقاط الولاء. صديقك يحصل على خصم 15% على أول طلب، وأنت تكسب رصيداً عند أول شراء له.",
    example: "«شارك رابطك… كل صديق يطلب = رصيد في محفظتك».",
    feature: "الإحالة + نقاط الولاء (جاهز) — العمود الفقري",
  },
  {
    n: 4, title: "فيديو إطلاق جريء وطريف", origin: "Dollar Shave Club — أمريكا",
    why: "فيديو واحد مضحك صنع شركة كاملة.",
    how: "فيديو 40 ثانية: صاحب محل محتار بأكياس بلا هوية ← يكتشف أويو ← يطبع شعاره ← زبائنه ينبهرون. نبرة محلية طريفة.",
    example: "خطّاف أول 3 ثوانٍ: «محلك بدون اسم؟ زبونك بينساك!».",
    feature: "المعاينة الحية للطباعة (سلاحك الفريد)",
  },
  {
    n: 5, title: "تحدي «صمّمها على أويو» (UGC)", origin: "Apple «Shot on iPhone» — أمريكا",
    why: "المحتوى من المستخدمين مجاني ومُقنع أكثر من أي إعلان.",
    how: "العميل يصمّم منتجه بالمعاينة الحية، يلتقط صورة الشاشة وينشرها. أجمل تصميم يفوز بطلب مجاني.",
    example: "«صمّم كيسك وانشره مع #اطبعها_مع_أويو، وأحلى تصميم يكسب طلب مجاني».",
    feature: "المعاينة الحية (تصنع محتوى مجاني لك)",
  },
  {
    n: 6, title: "تحدي هاشتاق على تيك توك", origin: "حملات TikTok — الصين/عالمي",
    why: "قالب + صوت ثابت يجعل آلافاً يقلّدون مجاناً.",
    how: "هاشتاق #اطبعها_مع_أويو + مقطع ثابت «قبل/بعد» + جائزة أسبوعية للأفضل.",
    example: "انتقال سريع: منتج فارغ ← ثانية ← منتج مطبوع لامع.",
    feature: "تيك توك + المعاينة الحية",
  },
  {
    n: 7, title: "عرض الومضة (ندرة + عجلة)", origin: "Xiaomi — الصين",
    why: "كمية محدودة + عداد تنازلي = اندفاع شراء فوري.",
    how: "كل خميس «ومضة أويو»: كمية محدودة، عدّاد تنازلي، سعر صادم لمنتج واحد.",
    example: "«50 قطعة فقط… العدّاد يعمل، لا تتأخر».",
    feature: "عروض الومضة (Flash) — جاهزة",
  },
  {
    n: 8, title: "الكيس المحظوظ (مفاجأة)", origin: "Fukubukuro — اليابان",
    why: "المفاجأة + قيمة أعلى من السعر = إثارة ومشاركة وتصريف مخزون.",
    how: "باقة مفاجأة بسعر ثابت منخفض، محتواها مفاجأة بقيمة أكبر من السعر.",
    example: "«الكيس المحظوظ بـ X ريال… بداخله مفاجآت بقيمة أكبر!».",
    feature: "الباقات (جاهزة)",
  },
  {
    n: 9, title: "ولاء بالنقاط المرئية", origin: "بطاقات T-Point / LINE — اليابان",
    why: "رؤية التقدّم تدفع العميل لإكمال الشراء ليصل للهدية.",
    how: "أظهر شريط تقدّم: «باقي 200 نقطة وتوصلك هديتك». الناس تكمل لترى الشريط يمتلئ.",
    example: "«نقاطك: 800 / 1000 — اطلب مرة وتكسب هديتك».",
    feature: "نقاط الولاء + المحفظة (جاهز)",
  },
  {
    n: 10, title: "دخول يومي + عجلة حظ", origin: "Grab / Gojek / Shopee — جنوب شرق آسيا",
    why: "مكافأة يومية تصنع عادة فتح التطبيق كل يوم.",
    how: "نقاط عند الدخول اليومي + «اسحب العجلة» لكوبون عشوائي.",
    example: "«ادخل كل يوم واكسب نقاط… جرّب حظك في العجلة!».",
    feature: "النقاط + الكوبونات (جاهز)",
  },
  {
    n: 11, title: "يوم تخفيضات ضخم بعلامة خاصة", origin: "11.11 علي بابا / 9.9 Shopee",
    why: "حدث واحد كبير بعدّ تنازلي يصنع ترقّباً وضجة.",
    how: "اصنع «يوم أويو» شهرياً واحداً فقط. سخّن له قبله بأسبوع عبر شريط العروض + الإشعارات + Web Push.",
    example: "«استعدوا… يوم أويو بعد 5 أيام، أقوى عروض السنة».",
    feature: "شريط العروض + الإشعارات + Web Push (جاهز)",
  },
  {
    n: 12, title: "أول طلب توصيل مجاني للجدد", origin: "نون / طلبات / كريم — الشرق الأوسط",
    why: "أقوى محفّز لكسر حاجز التجربة الأولى.",
    how: "فعّل الشحن المجاني + كوبون للعملاء الجدد والزوار على أول طلب فقط.",
    example: "«جرّبنا بأمان: أول توصيل علينا، وادفع عند الاستلام».",
    feature: "الشحن المجاني + الكوبونات (جاهز)",
  },
  {
    n: 13, title: "مندوبون محليون + سيل ضخم", origin: "Jumia / J-Force — أفريقيا",
    why: "مندوب في كل مدينة يصل لمحلات منطقته أفضل من أي إعلان.",
    how: "حوّل المسوّقين إلى مندوبين محليين (تعز/صنعاء/عدن/الحديدة)، كل واحد يخدم منطقته بعمولة.",
    example: "«كن مندوب أويو في مدينتك واكسب عمولة على كل طلب».",
    feature: "نظام المسوّقين (جاهز)",
  },
  {
    n: 14, title: "تجارة عبر واتساب + ثقة الدفع عند الاستلام", origin: "أفريقيا / الشرق الأوسط",
    why: "في اليمن الثقة أهم من الخصم؛ قابل العميل حيث هو.",
    how: "كتالوج واتساب + رد سريع + نشر صور التسليم والتقييمات لبناء الثقة.",
    example: "«اطلب عبر واتساب، وادفع عند وصول الطلب لبابك».",
    feature: "واتساب + الدفع عند الاستلام (جاهز)",
  },
  {
    n: 15, title: "عيّنة مجانية لأصحاب المحلات (B2B)", origin: "فكرة خاصة بمنتجك",
    why: "حين يرى زبائن المحل الكيس الأنيق، يطلب صاحبه بالجملة ويصير عميلاً متكرراً.",
    how: "اطبع كيساً واحداً بشعار محل صغير مجاناً كنموذج، ثم اعرض عليه الطلب بالجملة.",
    example: "«نطبع لك نموذجاً مجاناً… جرّب وشوف رأي زبائنك».",
    feature: "الطباعة المخصّصة (جوهر منتجك) — أعلى ربح متكرر",
  },
];

const offerRules = [
  { tag: "مجانية", color: "bg-green-100 text-green-800", text: "للجذب الأول فقط (أول توصيل / تصميم شعار مجاني). لا تجعلها دائمة." },
  { tag: "خصم %", color: "bg-amber-100 text-amber-800", text: "للعجلة والمناسبات (الومضة، يوم أويو). لا تُدمنه — الخصم الدائم يقتل قيمتك." },
  { tag: "باقة/كمية", color: "bg-blue-100 text-blue-800", text: "لرفع قيمة الطلب ولأصحاب المشاريع. «اطبع 100 واحصل على 20 مجاناً»." },
  { tag: "مكافأة (نقاط)", color: "bg-purple-100 text-purple-800", text: "للاحتفاظ — أفضل من الخصم لأنها تُرجع العميل بدل أن تخسر هامشك." },
  { tag: "سعر كامل", color: "bg-gray-200 text-gray-800", text: "للمنتجات المطلوبة وللعميل المتكرر الراضي — اربح هامشك الكامل." },
];

const phases = [
  {
    name: "أسبوع 0 — التحضير (بدون إعلان)",
    items: [
      "جهّز بنك محتوى: 10 فيديوهات قصيرة + 15 صورة/بنر + نصوص جاهزة.",
      "جنّد 20–40 مسوّقاً/مؤثراً صغيراً واصنع روابط إحالتهم.",
      "فعّل: الشحن المجاني لأول طلب، كوبون الجدد، نقاط الإحالة، شريط العروض.",
    ],
  },
  {
    name: "المرحلة 1 — الإطلاق والوعي (أسابيع 1–3)",
    items: [
      "أطلق فيديو الإطلاق + عرض «أول توصيل مجاني» + الإحالة المزدوجة.",
      "إعلان مدفوع خفيف على فيسبوك/تيك توك لتسخين الجمهور.",
      "الهدف: أول 50–100 عميل + بناء قائمة واتساب.",
    ],
  },
  {
    name: "المرحلة 2 — النمو والانتشار (أسابيع 4–8)",
    items: [
      "أشعل تحدي تيك توك + تحدي «صمّمها على أويو» + الشراء الجماعي + فيديوهات المؤثرين.",
      "نقطة الذروة: «يوم أويو» في الأسبوع 6 أو 7 مع عدّ تنازلي وإشعارات.",
      "ابدأ عيّنات B2B للمحلات.",
    ],
  },
  {
    name: "المرحلة 3 — الاحتفاظ والمضاعفة (أسابيع 9–12)",
    items: [
      "ادفع الولاء + استرجاع العملاء الخاملين عبر Web Push والبث.",
      "وسّع المسوّقين الأنجح، وكرّر الومضة أسبوعياً.",
      "الأسبوع 12: راجع الأرقام، أوقف ما لم ينجح، ضاعف ما نجح.",
    ],
  },
];

const budgets = [
  {
    name: "أ — عضلي (شبه مجاني)",
    amount: "≈ 150–300 ﷼ سعودي / شهر",
    note: "يعتمد على المجهود — مناسب لبداية حذرة، يوصلك لـ100 عميل ببطء.",
    split: ["60% عمولات مسوّقين/إحالة", "25% عينات مجانية للمحلات", "15% تعزيز منشورات بسيط"],
  },
  {
    name: "ب — اقتصادي متوازن (موصى به)",
    amount: "≈ 600–1000 ﷼ سعودي / شهر",
    note: "يوصلك لـ300–500 عميل في 3 أشهر بثقة.",
    split: [
      "35% إعلانات فيسبوك/تيك توك", "30% عمولات مسوّقين + مؤثرين صغار",
      "20% دعم العروض (شحن/خصومات)", "10% عينات B2B", "5% أدوات/تصميم",
    ],
  },
  {
    name: "ج — نمو سريع",
    amount: "≈ 1500–2500 ﷼ سعودي / شهر",
    note: "نفس توزيع (ب) مع مضاعفة المؤثرين والإعلان ودعم «يوم أويو» — يتجاوز 500 عميل.",
    split: ["مضاعفة الإعلان", "مضاعفة المؤثرين", "دعم أكبر ليوم أويو"],
  },
];

const videoSteps = [
  "0–3 ث (الخطّاف): مشهد/سؤال صادم. «محلك بدون هوية؟ شوف الفرق».",
  "3–10 ث (المشكلة): كيس عادي ممل بلا اسم.",
  "10–25 ث (الحل): تصميم الشعار + المعاينة الحية على الشاشة — أبرز ميزتك!",
  "25–35 ث (الإثبات): المنتج النهائي + رد فعل/تقييم عميل.",
  "35–40 ث (الدعوة + العرض): «حمّل أويو، أول توصيل مجاني — الرابط بالوصف».",
];

const toc = [
  { id: "strengths", label: "أسلحتك الجاهزة", icon: Rocket },
  { id: "market", label: "قواعد السوق اليمني", icon: Target },
  { id: "offer", label: "صيغة العرض الذي لا يُرفض", icon: Gift },
  { id: "ideas", label: "15 فكرة حملة عالمية", icon: Megaphone },
  { id: "offers", label: "متى خصم / مجانية / باقة؟", icon: ListChecks },
  { id: "timeline", label: "الخطة الزمنية 3 أشهر", icon: Calendar },
  { id: "budget", label: "الميزانية", icon: Wallet },
  { id: "content", label: "المحتوى: فيديو/نص/صور", icon: Film },
  { id: "channels", label: "القنوات", icon: Share2 },
  { id: "kpis", label: "مؤشرات النجاح", icon: BarChart3 },
  { id: "mistakes", label: "أخطاء احذرها", icon: AlertTriangle },
  { id: "recommendation", label: "توصيتي لك", icon: Lightbulb },
];

function SectionTitle({ icon: Icon, children, id }: { icon: any; children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="scroll-mt-20 flex items-center gap-2 text-lg font-extrabold text-[#1565C0] mt-8 mb-3 pb-2 border-b-2 border-[#2196F3]/30">
      <Icon className="w-5 h-5 text-[#2196F3] shrink-0" />
      <span>{children}</span>
    </h2>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-3 ${className}`}>{children}</div>;
}

function Bul({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2 leading-relaxed text-[15px] text-gray-700 mb-1.5">
      <span className="text-[#2196F3] mt-1.5 shrink-0">•</span>
      <span>{children}</span>
    </li>
  );
}

export default function MarketingPlan() {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => {
    document.title = "خطة التسويق الشاملة — أويو بلاست";
  }, []);

  function copyText(text: string, idx: number) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1800);
    });
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 print:bg-white" data-testid="page-marketing-plan">
      {/* Hero */}
      <header className="bg-gradient-to-l from-[#2196F3] to-[#1565C0] text-white px-4 pt-8 pb-6 print:bg-white print:text-black">
        <p className="text-xs opacity-90 mb-1">وثيقة خاصة بمالك المتجر</p>
        <h1 className="text-2xl font-extrabold leading-snug" data-testid="text-plan-title">
          خطة التسويق الشاملة لأويو بلاست
        </h1>
        <p className="text-sm opacity-95 mt-2 leading-relaxed">
          هدف: 100–500 عميل خلال 3 أشهر — من نماذج عالمية صنعت ضجة (الصين، أمريكا، اليابان،
          جنوب شرق آسيا، الشرق الأوسط، أفريقيا)، مُكيّفة على ميزات تطبيقك.
        </p>
        <button
          onClick={() => window.print()}
          data-testid="button-print-plan"
          className="mt-4 inline-flex items-center gap-2 bg-white text-[#1565C0] font-bold text-sm px-4 py-2 rounded-full shadow print:hidden"
        >
          <Printer className="w-4 h-4" />
          حفظ كـ PDF / طباعة
        </button>
      </header>

      <div className="px-4 pb-24 max-w-2xl mx-auto">
        {/* TOC */}
        <Card className="mt-4 print:hidden">
          <p className="font-bold text-gray-800 mb-2 text-sm">محتويات الخطة (اضغط للانتقال)</p>
          <div className="grid grid-cols-1 gap-1">
            {toc.map((t) => (
              <a
                key={t.id}
                href={`#${t.id}`}
                data-testid={`link-toc-${t.id}`}
                className="flex items-center gap-2 text-[15px] text-[#1565C0] py-1.5 active:opacity-60"
              >
                <t.icon className="w-4 h-4 shrink-0" />
                <span>{t.label}</span>
              </a>
            ))}
          </div>
        </Card>

        {/* 1 - Strengths */}
        <SectionTitle icon={Rocket} id="strengths">أولاً: أسلحتك التسويقية الجاهزة داخل التطبيق</SectionTitle>
        <Card>
          <p className="text-[15px] text-gray-700 mb-2 leading-relaxed">
            نصف أدوات الحملة موجودة في تطبيقك بالفعل. سنبني الحملة فوقها — لا تبدأ بالإعلان المدفوع،
            بل بالعرض القوي + المسوّقين + واتساب، ثم الإعلان كمسرّع.
          </p>
          <ul>
            <Bul><b>المعاينة الحية للطباعة:</b> «لحظة الواو» القابلة للمشاركة — أقوى سلاح فيروسي عندك.</Bul>
            <Bul><b>نظام المسوّقين/العمولة:</b> محرك نمو جاهز (مثل مندوبي Jumia).</Bul>
            <Bul><b>نقاط الولاء + المحفظة:</b> للاحتفاظ بالعميل وإرجاعه.</Bul>
            <Bul><b>البحث بالكاميرا:</b> ميزة مبهرة تصنع فضولاً في الفيديوهات.</Bul>
            <Bul><b>الومضة + شريط العروض + الباقات + عروض الكميات + الشحن المجاني:</b> آليات عروض جاهزة فوراً.</Bul>
            <Bul><b>الإشعارات + Web Push + البث التسويقي:</b> لإعادة جذب العميل مجاناً.</Bul>
            <Bul><b>واتساب + الدفع عند الاستلام + الطلب كزائر:</b> أقل احتكاك وأعلى ثقة في اليمن.</Bul>
            <Bul><b>مساعد «أويو» الذكي:</b> يصلح أن يكون «شخصية/تميمة» للعلامة.</Bul>
          </ul>
        </Card>

        {/* 2 - Market */}
        <SectionTitle icon={Target} id="market">ثانياً: قواعد السوق اليمني (لا تكسرها)</SectionTitle>
        <Card>
          <ul>
            <Bul><b>الثقة قبل كل شيء:</b> ركّز على الدفع عند الاستلام وأظهر إثباتات (صور تسليم، تقييمات).</Bul>
            <Bul><b>واتساب وفيسبوك هما الملك،</b> وتيك توك صاعد للشباب، وإنستغرام للمدن.</Bul>
            <Bul><b>الكهرباء/النت متقطعان:</b> اجعل المحتوى خفيفاً والرسائل قصيرة.</Bul>
            <Bul><b>الكلمة المنطوقة والمجتمع المحلي</b> أقوى من أي إعلان.</Bul>
            <Bul><b>جمهورك مزدوج:</b> أفراد (مناسبات/هدايا) + الأهم: أصحاب المشاريع الصغيرة (مطاعم/عطور/ملابس) — طلبات متكررة = أرباح ثابتة.</Bul>
          </ul>
        </Card>

        {/* 3 - Offer formula */}
        <SectionTitle icon={Gift} id="offer">ثالثاً: صيغة «العرض الذي لا يُرفض»</SectionTitle>
        <Card>
          <p className="text-[15px] text-gray-700 mb-2 leading-relaxed">
            أي عرض ناجح = جمع هذه العناصر معاً (مدرسة Alex Hormozi الأمريكية):
          </p>
          <ul>
            <Bul><b>قيمة واضحة:</b> ليس «خصم 10%» بل «صمّم وجرّب شعارك مجاناً + أول توصيل مجاني».</Bul>
            <Bul><b>ندرة:</b> «أول 50 عميل فقط» أو «50 قطعة فقط».</Bul>
            <Bul><b>عجلة:</b> «ينتهي الخميس 9 مساءً».</Bul>
            <Bul><b>ضمان يزيل الخوف:</b> «ادفع عند الاستلام، وإن لم تعجبك الطباعة نعيدها مجاناً».</Bul>
            <Bul><b>مكافآت:</b> «هدية: نقاط ولاء + تصميم شعار مجاني».</Bul>
          </ul>
          <p className="text-[13px] text-gray-500 mt-2">كلما كدّست أكثر، صار العرض غير قابل للرفض. كل الأفكار التالية مبنية على هذه الصيغة.</p>
        </Card>

        {/* 4 - 15 ideas */}
        <SectionTitle icon={Megaphone} id="ideas">رابعاً: 15 فكرة حملة من نماذج عالمية أحدثت ضجة</SectionTitle>
        {ideas.map((idea) => (
          <Card key={idea.n} className="!mb-3">
            <div className="flex items-start gap-2 mb-2">
              <span className="shrink-0 w-7 h-7 rounded-full bg-[#2196F3] text-white text-sm font-bold flex items-center justify-center">{idea.n}</span>
              <div>
                <p className="font-extrabold text-gray-900 leading-snug">{idea.title}</p>
                <p className="text-xs text-[#1565C0] font-medium mt-0.5">المصدر: {idea.origin}</p>
              </div>
            </div>
            <ul>
              <Bul><b>لماذا انتشرت:</b> {idea.why}</Bul>
              <Bul><b>كيف نطبّقها عندك:</b> {idea.how}</Bul>
              <Bul><b>مثال نص:</b> {idea.example}</Bul>
            </ul>
            <div className="mt-2 inline-flex items-center gap-1 bg-blue-50 text-[#1565C0] text-xs font-medium px-2.5 py-1 rounded-full">
              <Star className="w-3 h-3" /> {idea.feature}
            </div>
          </Card>
        ))}
        <Card>
          <p className="text-[15px] text-gray-700 leading-relaxed">
            <b>فكرة إضافية — تميمة «أويو»:</b> اجعل مساعدك الذكي شخصية مرحة تظهر في كل البنرات
            والفيديوهات لتثبيت العلامة في الذاكرة (مثل بطة Duolingo).
          </p>
        </Card>

        {/* 5 - Offer rules */}
        <SectionTitle icon={ListChecks} id="offers">خامساً: متى تقدّم خصماً؟ متى مجانية؟ متى باقة؟</SectionTitle>
        {offerRules.map((r) => (
          <Card key={r.tag} className="!mb-2">
            <div className="flex items-start gap-2">
              <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${r.color}`}>{r.tag}</span>
              <p className="text-[15px] text-gray-700 leading-relaxed">{r.text}</p>
            </div>
          </Card>
        ))}
        <Card className="bg-amber-50 border-amber-200">
          <p className="text-[15px] text-amber-900 leading-relaxed">
            <b>قاعدة الهامش:</b> لا تقدّم أي عرض يخسرك المال على المدى الطويل. العرض يجذب، والولاء يربح.
          </p>
        </Card>

        {/* 6 - Timeline */}
        <SectionTitle icon={Calendar} id="timeline">سادساً: الخطة الزمنية لـ 3 أشهر</SectionTitle>
        {phases.map((p, i) => (
          <Card key={i}>
            <p className="font-extrabold text-[#1565C0] mb-2">{p.name}</p>
            <ul>{p.items.map((it, j) => <Bul key={j}>{it}</Bul>)}</ul>
          </Card>
        ))}
        <Card className="bg-blue-50 border-blue-200">
          <p className="font-bold text-[#1565C0] mb-1">متى توقف عرضاً؟</p>
          <ul>
            <Bul>حين يتعب (تقل نتائجه رغم استمراره) ← غيّره.</Bul>
            <Bul>حين يأكل هامشك أكثر مما يجلب.</Bul>
            <Bul>أبقِ الإحالة دائمة (مربحة دوماً)، واجعل الخصومات نبضات لا دائمة.</Bul>
          </ul>
        </Card>

        {/* 7 - Budget */}
        <SectionTitle icon={Wallet} id="budget">سابعاً: الميزانية (3 مستويات — عدّلها حسب سعر الصرف)</SectionTitle>
        {budgets.map((b) => (
          <Card key={b.name}>
            <p className="font-extrabold text-gray-900">{b.name}</p>
            <p className="text-[#1565C0] font-bold text-sm my-1">{b.amount}</p>
            <p className="text-[14px] text-gray-600 mb-2 leading-relaxed">{b.note}</p>
            <ul>{b.split.map((s, j) => <Bul key={j}>{s}</Bul>)}</ul>
          </Card>
        ))}
        <Card>
          <p className="text-[15px] text-gray-700 leading-relaxed">
            <b>تكلفة العميل (CAC):</b> عبر الإحالة/الأرض منخفضة جداً (ركّز هنا)، وعبر الإعلان المدفوع
            أعلى — استخدمه كمسرّع لا كأساس.
          </p>
        </Card>

        {/* 8 - Content */}
        <SectionTitle icon={Film} id="content">ثامناً: المحتوى — شكل الفيديو والنص والصور والبنرات</SectionTitle>
        <Card>
          <p className="font-bold text-gray-900 mb-2">الفيديو القصير — هيكل ثانية بثانية</p>
          <ul>{videoSteps.map((s, i) => <Bul key={i}>{s}</Bul>)}</ul>
          <p className="text-[13px] text-gray-500 mt-2">عمودي 9:16، نص كبير على الشاشة (الكثير يشاهد بصامت)، وأول 3 ثوانٍ هي كل شيء.</p>
        </Card>
        <Card>
          <p className="font-bold text-gray-900 mb-2">النصوص (الكتابة الإعلانية)</p>
          <ul>
            <Bul><b>PAS</b> (مشكلة–تهييج–حل): «أكياسك بلا اسم؟ زبونك ينساك. مع أويو اطبع شعارك ويتذكرك الكل».</Bul>
            <Bul><b>AIDA</b> (انتباه–اهتمام–رغبة–فعل): عنوان قوي ← فائدة ← عرض ← زر واضح.</Bul>
            <Bul>قصيرة، بالعامية اليمنية المحببة، وبجملة فعل واحدة في النهاية.</Bul>
          </ul>
        </Card>
        <Card>
          <p className="font-bold text-gray-900 mb-2">الصور والبنرات (الهوية البصرية)</p>
          <ul>
            <Bul>اللون الأساسي الأزرق السماوي <span className="font-mono">#2196F3</span>، وخط Cairo، واتجاه يمين-لليسار.</Bul>
            <Bul>صورة واحدة = فكرة واحدة + جملة كبيرة واحدة + شعارك.</Bul>
            <Bul>أظهر دائماً «قبل/بعد» — أقوى صورة في مجال الطباعة.</Bul>
            <Bul>المقاسات: مربع 1:1 (فيسبوك/إنستغرام)، عمودي 9:16 (ستوري/تيك توك)، أفقي للبنر داخل التطبيق.</Bul>
          </ul>
        </Card>
        <Card>
          <p className="font-bold text-gray-900 mb-2">البنرات داخل التطبيق (جاهزة عندك)</p>
          <ul>
            <Bul><b>شريط العروض أعلى الصفحة:</b> «أول توصيل مجاني للعملاء الجدد».</Bul>
            <Bul><b>بنر الومضة:</b> عدّ تنازلي + كمية محدودة.</Bul>
            <Bul><b>بنر «يوم أويو»:</b> قبل الحدث بأسبوع.</Bul>
            <Bul><b>إشعار/Web Push:</b> قبل انتهاء العرض بساعات («باقي 3 ساعات!»).</Bul>
          </ul>
        </Card>

        {/* 9 - Channels */}
        <SectionTitle icon={Share2} id="channels">تاسعاً: القنوات وترتيب الأولوية</SectionTitle>
        <Card>
          <ul>
            <Bul><b>واتساب (الأول):</b> قائمة بث، رد سريع، صور تسليم وتقييمات — هنا تُبنى الثقة.</Bul>
            <Bul><b>فيسبوك:</b> أوسع جمهور في اليمن — منشورات + إعلانات مستهدفة بالمدن.</Bul>
            <Bul><b>تيك توك:</b> للانتشار الفيروسي والجمهور الشاب.</Bul>
            <Bul><b>إنستغرام:</b> للمدن والمظهر الأنيق للمنتجات.</Bul>
            <Bul><b>الأرض الواقعية:</b> مندوبون + عينات للمحلات — ذهب في اليمن.</Bul>
          </ul>
        </Card>

        {/* 10 - KPIs */}
        <SectionTitle icon={BarChart3} id="kpis">عاشراً: مؤشرات النجاح (راقبها أسبوعياً)</SectionTitle>
        <Card>
          <ul>
            <Bul>عدد التحميلات والتسجيلات الجديدة.</Bul>
            <Bul>عدد أول الطلبات (أهم رقم).</Bul>
            <Bul>نسبة الإحالة (كم عميل جلب عميلاً).</Bul>
            <Bul>تكلفة العميل (CAC) والعائد على الإعلان (ROAS).</Bul>
            <Bul>نسبة العودة للشراء (الاحتفاظ).</Bul>
            <Bul>لا تحكم على قناة قبل أسبوعين من التجربة.</Bul>
          </ul>
        </Card>

        {/* 11 - Mistakes */}
        <SectionTitle icon={AlertTriangle} id="mistakes">أخطاء احذرها</SectionTitle>
        <Card className="bg-red-50 border-red-200">
          <ul>
            <Bul>لا تبدأ بإعلان مدفوع ضخم قبل تجربة عرضك على عيّنة صغيرة.</Bul>
            <Bul>لا تجعل الخصم دائماً (يقتل القيمة والربح).</Bul>
            <Bul>لا تشتّت جهدك على 5 قنوات بضعف — أتقن واتساب + قناة واحدة أولاً.</Bul>
            <Bul>لا تهمل خدمة ما بعد البيع — العميل الراضي أرخص تسويق.</Bul>
            <Bul>لا توقف الإحالة أبداً.</Bul>
          </ul>
        </Card>

        {/* 12 - Recommendation */}
        <SectionTitle icon={Lightbulb} id="recommendation">توصيتي الشخصية لك</SectionTitle>
        <Card className="bg-gradient-to-l from-blue-50 to-white border-blue-200">
          <p className="text-[15px] text-gray-800 mb-2 leading-relaxed">
            لو كان القرار لي، أبدأ بهذه الثلاثة فقط في الشهر الأول وأترك الباقي للتوسّع:
          </p>
          <ul>
            <Bul><b>عرض «أول توصيل مجاني + تصميم/معاينة شعار مجاني» للجدد</b> — لكسر حاجز التجربة.</Bul>
            <Bul><b>الإحالة المزدوجة (هدية لك وله)</b> — أرخص نمو وأكثره استدامة.</Bul>
            <Bul><b>عينات B2B + مسوّقون محليون</b> — لأرباح متكررة طويلة المدى (يميّز منتجك تحديداً).</Bul>
          </ul>
          <p className="text-[15px] text-gray-800 mt-3 leading-relaxed">
            ثم الشهر الثاني: أشعل تيك توك و«يوم أويو». الشهر الثالث: ركّز على الولاء والاسترجاع.
          </p>
          <p className="text-[15px] text-[#1565C0] font-bold mt-3 leading-relaxed">
            نصيحتي الأخيرة: ميزتك الفريدة هي المعاينة الحية للطباعة — اجعلها بطلة كل فيديو وصورة.
            لا أحد في اليمن يسوّق «شوف شعارك قبل ما تطبعه». هذه قصتك.
          </p>
        </Card>

        {/* رسائل واتساب جاهزة */}
        <SectionTitle icon={MessageCircle} id="whatsapp-texts">رسائل واتساب جاهزة (انسخ وأرسل)</SectionTitle>
        <Card className="print:hidden">
          <p className="text-[15px] text-gray-700 mb-3 leading-relaxed">
            رسائل مكتوبة مسبقاً لحملاتك. اضغط "نسخ" ثم الصقها في واتساب وأضِف رابط متجرك في النهاية.
          </p>
          <div className="space-y-3">
            {whatsappTexts.map((w, idx) => (
              <div key={idx} className="rounded-lg border border-gray-200 p-3 bg-gray-50" data-testid={`whatsapp-text-${idx}`}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-bold text-sm text-[#1565C0]">{w.label}</span>
                  <button
                    onClick={() => copyText(w.text, idx)}
                    className="shrink-0 inline-flex items-center gap-1 bg-[#2196F3] text-white text-xs font-bold px-3 py-1.5 rounded-full active:opacity-70"
                    data-testid={`button-copy-whatsapp-${idx}`}
                  >
                    {copiedIdx === idx ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedIdx === idx ? "تم النسخ" : "نسخ"}
                  </button>
                </div>
                <p className="text-[14px] text-gray-700 leading-relaxed whitespace-pre-line">{w.text}</p>
              </div>
            ))}
          </div>
        </Card>

        <p className="text-center text-xs text-gray-400 mt-6">
          خطة خاصة بأويو بلاست — يمكنك حفظها كـ PDF من زر الطباعة بالأعلى.
        </p>
      </div>
    </div>
  );
}
