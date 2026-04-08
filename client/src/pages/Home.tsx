import { useCategories } from "@/hooks/use-products";
import { useHomeSettings } from "@/hooks/use-home-settings";
import { ProductCard } from "@/components/ProductCard";
import { BannerCarousel } from "@/components/BannerCarousel";
import { OfferBanners } from "@/components/OfferBanners";
import { CategoryCircles } from "@/components/CategoryCircles";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, Truck, ShieldCheck, BadgeDollarSign, Headphones, Package, Star, ChevronDown, ChevronUp, Users, MapPin, Award } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import useEmblaCarousel from "embla-carousel-react";
import { useEffect, useRef, useState } from "react";
import { useSEO } from "@/hooks/use-seo";

// ── قسم ديناميكي واحد ─────────────────────────────────────────────────────
function HomeSectionBlock({ section, displaySettings, primaryColor }: {
  section: any;
  displaySettings: any;
  primaryColor: string;
}) {
  const { data: products = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/products/by-tag', section.promotionalTag, section.itemCount],
    queryFn: async () => {
      const res = await fetch(`/api/products/by-tag/${section.promotionalTag}?limit=${section.itemCount}`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
  });

  const [emblaRef, emblaApi] = useEmblaCarousel(
    { direction: 'rtl', loop: true, align: 'start', dragFree: true }
  );

  // تمرير تلقائي كل 2.8 ثانية
  const autoScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!emblaApi || section.displayMode !== 'banner') return;
    autoScrollTimer.current = setInterval(() => {
      emblaApi.scrollNext();
    }, 2800);
    const stop = () => { if (autoScrollTimer.current) clearInterval(autoScrollTimer.current); };
    emblaApi.on('pointerDown', stop);
    return () => {
      if (autoScrollTimer.current) clearInterval(autoScrollTimer.current);
      emblaApi.off('pointerDown', stop);
    };
  }, [emblaApi, section.displayMode]);

  if (isLoading) {
    return (
      <section className="px-4 py-6">
        <div className="h-5 w-32 bg-gray-100 rounded animate-pulse mb-4 mr-auto" />
        <div className={section.displayMode === 'banner' ? "flex gap-3 overflow-hidden" : "grid grid-cols-2 gap-3"}>
          {[...Array(section.displayMode === 'banner' ? 4 : 4)].map((_, i) => (
            <div
              key={i}
              className="bg-gray-100 rounded-xl animate-pulse flex-shrink-0"
              style={{
                height: section.displayMode === 'banner' ? `${section.bannerHeight || 180}px` : `${displaySettings.productCardHeight || 200 + 80}px`,
                width: section.displayMode === 'banner' ? `${section.bannerItemWidth || 160}px` : undefined,
              }}
            />
          ))}
        </div>
      </section>
    );
  }

  if (!products.length) return null;

  return (
    <section className="py-6">
      {/* رأس القسم */}
      <div className="flex items-center justify-between mb-4 px-4">
        <Link href={`/products?tag=${section.promotionalTag}`}>
          <Button variant="ghost" size="sm" className="text-gray-500 gap-1" data-testid={`btn-view-all-${section.id}`}>
            عرض الكل
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h2
          className="text-lg font-bold"
          style={{ color: primaryColor }}
          data-testid={`heading-section-${section.id}`}
        >
          {section.title}
        </h2>
      </div>

      {/* شبكة 2×2 */}
      {section.displayMode === 'grid2' && (
        <div className="grid grid-cols-2 gap-3 px-4">
          {products.map((product: any) => (
            <ProductCard
              key={product.id}
              product={product}
              cardWidth={displaySettings.productCardWidth}
              imageHeight={displaySettings.productCardHeight}
            />
          ))}
        </div>
      )}

      {/* بنر أفقي متحرك */}
      {section.displayMode === 'banner' && (
        <div className="overflow-hidden" ref={emblaRef} dir="rtl">
          <div className="flex gap-3 px-4">
            {products.map((product: any) => (
              <div
                key={product.id}
                className="flex-shrink-0"
                style={{ width: `${section.bannerItemWidth || 160}px` }}
              >
                <ProductCard
                  product={product}
                  cardWidth={section.bannerItemWidth || 160}
                  imageHeight={section.bannerHeight || 180}
                  bannerNameFontSize={section.bannerNameFontSize}
                  bannerPriceFontSize={section.bannerPriceFontSize}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ── الصفحة الرئيسية ─────────────────────────────────────────────────────────
export default function Home() {
  useSEO({
    title: "أويو بلاست | مستلزمات التغليف والأكياس - اليمن والسعودية",
    description: "تسوّق أفضل مستلزمات التغليف والأكياس البلاستيكية والقماشية بأسعار الجملة. أويو بلاست - شريكك في التغليف الاحترافي في اليمن والسعودية.",
    keywords: "أويو بلاست, أكياس تغليف, أكياس بلاستيك, أكياس قماش, تغليف اليمن, مستلزمات تغليف",
    canonical: "https://oyoplast.com/",
  });
  const { data: categories } = useCategories();
  const { data: homeSettings } = useHomeSettings();

  const defaultDisplay = {
    categorySize: 72,
    categoriesPerRow: 4,
    showCategories: true,
    productCardWidth: 160,
    productCardHeight: 200,
    offerBannerHeight: 72,
    showOfferBanners: true,
  };

  const { data: displaySettings = defaultDisplay } = useQuery<any>({
    queryKey: ["/api/display-settings"],
    queryFn: async () => {
      const res = await fetch("/api/display-settings", { credentials: "include" });
      if (!res.ok) return defaultDisplay;
      return res.json();
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: banners = [] } = useQuery<any[]>({
    queryKey: ["/api/banners"],
    queryFn: async () => {
      const res = await fetch("/api/banners", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return data.filter((b: any) => b.isActive).sort((a: any, b: any) => a.sortOrder - b.sortOrder);
    },
  });

  const { data: homeSections = [] } = useQuery<any[]>({
    queryKey: ["/api/home-sections"],
    queryFn: async () => {
      const res = await fetch("/api/home-sections");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30_000,
  });

  const primaryColor = homeSettings?.primaryColor || "#06B6D4";

  // أقسام مُفعَّلة مرتبة بالأولوية
  const enabledSections = [...homeSections]
    .filter((s: any) => s.enabled)
    .sort((a: any, b: any) => a.priority - b.priority);

  // هل يوجد قسم "الأكثر مبيعاً" في الأقسام الديناميكية؟
  const hasBestsellerSection = enabledSections.some((s: any) => s.promotionalTag === 'bestsellers');

  return (
    <div className="flex flex-col pb-20 bg-white dark:bg-background min-h-screen">
      {/* Banner Carousel Section */}
      {homeSettings?.showBanners !== false && banners.length > 0 && (
        <BannerCarousel banners={banners} height={displaySettings.sliderHeight ?? 414} />
      )}

      {/* Offer Banners Section */}
      {displaySettings.showOfferBanners && (
        <OfferBanners
          height={displaySettings.offerBannerHeight}
          columns={displaySettings.offerBannerCols ?? 2}
        />
      )}

      {/* Category Circles Section */}
      {displaySettings.showCategories && (
        <CategoryCircles
          categories={categories || []}
          circleSize={displaySettings.categorySize}
          perRow={displaySettings.categoriesPerRow}
        />
      )}

      {/* ── الأقسام الديناميكية ── */}
      {enabledSections.map((section: any) => (
        <HomeSectionBlock
          key={section.id}
          section={section}
          displaySettings={displaySettings}
          primaryColor={primaryColor}
        />
      ))}

      {/* قسم الأكثر مبيعاً الافتراضي (يظهر فقط إن لم يكن هناك قسم ديناميكي له) */}
      {!hasBestsellerSection && (
        <BestsellerSection displaySettings={displaySettings} primaryColor={primaryColor} />
      )}

      {/* ── لماذا أويو بلاست؟ ── */}
      <WhyUsSection />

      {/* ── أرقامنا تتحدث ── */}
      <StatsSection />

      {/* ── الأسئلة الشائعة ── */}
      <FaqSection />
    </div>
  );
}

// ── قسم لماذا أويو بلاست؟ ───────────────────────────────────────────────────
function WhyUsSection() {
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

  return (
    <section className="px-4 py-10 bg-gray-50 dark:bg-gray-900/50" dir="rtl" data-testid="section-why-us">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">
          لماذا تختار أويو بلاست؟
        </h2>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          منصة متكاملة لمستلزمات التغليف — نربطك بأفضل الموردين في اليمن
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {features.map((f, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-border flex flex-col gap-2"
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
function StatsSection() {
  const stats = [
    { value: "+500", label: "منتج متنوع", icon: <Package className="h-6 w-6" /> },
    { value: "+20", label: "مورد موثوق", icon: <Award className="h-6 w-6" /> },
    { value: "+18", label: "محافظة يمنية", icon: <MapPin className="h-6 w-6" /> },
    { value: "+1000", label: "عميل راضٍ", icon: <Users className="h-6 w-6" /> },
  ];

  return (
    <section
      className="px-4 py-10 bg-gradient-to-l from-blue-600 to-blue-700 text-white"
      dir="rtl"
      data-testid="section-stats"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-black mb-1">أرقامنا تتحدث</h2>
        <p className="text-blue-100 text-sm">ثقة آلاف العملاء في اليمن</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {stats.map((s, i) => (
          <div
            key={i}
            className="bg-white/15 backdrop-blur rounded-2xl p-5 text-center flex flex-col items-center gap-2"
            data-testid={`stat-card-${i}`}
          >
            <div className="bg-white/20 rounded-xl p-2">{s.icon}</div>
            <p className="text-3xl font-black">{s.value}</p>
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

function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="px-4 py-10 bg-white dark:bg-background" dir="rtl" data-testid="section-faq">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">
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

// ── قسم الأكثر مبيعاً الافتراضي ─────────────────────────────────────────────
function BestsellerSection({ displaySettings, primaryColor }: { displaySettings: any; primaryColor: string }) {
  const { data: products = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/products/by-tag', 'bestsellers', 8],
    queryFn: async () => {
      const res = await fetch('/api/products/by-tag/bestsellers?limit=8');
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
  });

  return (
    <section className="px-4 py-8">
      <div className="flex items-center justify-between mb-4">
        <Link href="/products">
          <Button variant="ghost" size="sm" className="text-gray-500 gap-1" data-testid="button-view-all">
            عرض الكل
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h2 className="text-lg font-bold" style={{ color: primaryColor }} data-testid="heading-bestselling">
          الأكثر مبيعاً
        </h2>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-64 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {products.slice(0, 6).map((product: any) => (
            <ProductCard
              key={product.id}
              product={product}
              cardWidth={displaySettings.productCardWidth}
              imageHeight={displaySettings.productCardHeight}
            />
          ))}
        </div>
      )}
    </section>
  );
}
