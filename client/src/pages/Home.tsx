import { useCategories } from "@/hooks/use-products";
import { useHomeSettings } from "@/hooks/use-home-settings";
import { ProductCard } from "@/components/ProductCard";
import { BannerCarousel } from "@/components/BannerCarousel";
import { OfferBanners } from "@/components/OfferBanners";
import { CategoryCircles } from "@/components/CategoryCircles";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import useEmblaCarousel from "embla-carousel-react";
import { useEffect, useRef } from "react";

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
    </div>
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
