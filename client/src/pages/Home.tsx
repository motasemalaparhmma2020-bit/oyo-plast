import { useBestsellingProducts, useCategories } from "@/hooks/use-products";
import { useHomeSettings } from "@/hooks/use-home-settings";
import { ProductCard } from "@/components/ProductCard";
import { BannerCarousel } from "@/components/BannerCarousel";
import { OfferBanners } from "@/components/OfferBanners";
import { CategoryCircles } from "@/components/CategoryCircles";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function Home() {
  const { data: bestselling, isLoading: isBestsellingLoading } = useBestsellingProducts(8);
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
    staleTime: 0,           // always re-fetch when tab becomes active
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

  const { data: offers = [] } = useQuery<any[]>({
    queryKey: ["/api/offers"],
    queryFn: async () => {
      const res = await fetch("/api/offers", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return data.filter((o: any) => o.isActive).sort((a: any, b: any) => a.sortOrder - b.sortOrder);
    },
  });

  const primaryColor = homeSettings?.primaryColor || "#06B6D4";

  return (
    <div className="flex flex-col pb-20 bg-white dark:bg-background min-h-screen">
      {/* Banner Carousel Section */}
      {homeSettings?.showBanners !== false && banners.length > 0 && (
        <BannerCarousel banners={banners} height={414} />
      )}

      {/* Offer Banners Section */}
      {displaySettings.showOfferBanners && (
        <OfferBanners height={displaySettings.offerBannerHeight} />
      )}

      {/* Category Circles Section */}
      {displaySettings.showCategories && (
        <CategoryCircles
          categories={categories || []}
          circleSize={displaySettings.categorySize}
          perRow={displaySettings.categoriesPerRow}
        />
      )}

      {/* Best Selling Products */}
      <section className="px-4 py-8">
        <div className="flex items-center justify-between mb-4">
          <Link href="/products">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-500 gap-1"
              data-testid="button-view-all"
            >
              عرض الكل
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h2
            className="text-lg font-bold"
            style={{ color: primaryColor }}
            data-testid="heading-bestselling"
          >
            الأكثر مبيعاً
          </h2>
        </div>

        {isBestsellingLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-64 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {bestselling?.slice(0, 6).map((product: any) => (
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

    </div>
  );
}
