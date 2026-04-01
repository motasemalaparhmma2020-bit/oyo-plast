import { useBestsellingProducts, useCategories } from "@/hooks/use-products";
import { useHomeSettings } from "@/hooks/use-home-settings";
import { ProductCard } from "@/components/ProductCard";
import { BannerCarousel } from "@/components/BannerCarousel";
import { OfferBanners } from "@/components/OfferBanners";
import { CategoryCircles } from "@/components/CategoryCircles";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ShoppingBag, User, Palette, Grid } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useCart } from "@/hooks/use-cart";

export default function Home() {
  const { data: bestselling, isLoading: isBestsellingLoading } = useBestsellingProducts(8);
  const { data: categories } = useCategories();
  const { data: homeSettings } = useHomeSettings();
  const [_location, navigate] = useLocation();
  const { cart } = useCart();

  const { data: navSettings = { showPrintingSection: true } } = useQuery<any>({
    queryKey: ["/api/navigation-settings"],
    queryFn: async () => {
      const res = await fetch("/api/navigation-settings", { credentials: "include" });
      if (!res.ok) return { showPrintingSection: true };
      return res.json();
    },
  });

  const { data: displaySettings = {
    categorySize: 72,
    categoriesPerRow: 4,
    showCategories: true,
    productCardWidth: 160,
    productCardHeight: 200,
    offerBannerHeight: 72,
    showOfferBanners: true,
  } } = useQuery<any>({
    queryKey: ["/api/display-settings"],
    queryFn: async () => {
      const res = await fetch("/api/display-settings", { credentials: "include" });
      if (!res.ok) return {
        categorySize: 72,
        categoriesPerRow: 4,
        showCategories: true,
        productCardWidth: 160,
        productCardHeight: 200,
        offerBannerHeight: 72,
        showOfferBanners: true,
      };
      return res.json();
    },
  });

  const cartCount = cart?.reduce((sum, item) => sum + item.quantity, 0) || 0;

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

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 z-40">
        <div className="flex items-stretch justify-between h-20 w-full">
          {/* Shop */}
          <Link href="/products">
            <button
              className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-1"
              data-testid="nav-shop"
              style={{ color: primaryColor }}
            >
              <ShoppingBag className="h-6 w-6" style={{ color: primaryColor }} />
              <span className="text-xs font-bold text-right" style={{ color: primaryColor }}>
                متجر
              </span>
            </button>
          </Link>

          {/* Categories */}
          <Link href="/products">
            <button
              className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-1"
              data-testid="nav-categories"
            >
              <Grid className="h-6 w-6 text-gray-600 dark:text-gray-300" />
              <span className="text-xs text-gray-600 dark:text-gray-300 text-right">
                الفئات
              </span>
            </button>
          </Link>

          {/* Printing & Design */}
          {navSettings?.showPrintingSection !== false && (
            <Link href="/printing">
              <button
                className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-1"
                data-testid="nav-printing"
              >
                <Palette className="h-6 w-6 text-gray-600 dark:text-gray-300" />
                <span className="text-xs text-gray-600 dark:text-gray-300 text-right">
                  طباعة
                </span>
              </button>
            </Link>
          )}

          {/* Cart */}
          <Link href="/cart">
            <button
              className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative flex-1"
              data-testid="nav-cart"
            >
              <ShoppingBag className="h-6 w-6 text-gray-600 dark:text-gray-300" />
              {cartCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center"
                  data-testid="badge-cart-count"
                >
                  {cartCount}
                </span>
              )}
              <span className="text-xs text-gray-600 dark:text-gray-300 text-right">
                السلة
              </span>
            </button>
          </Link>

          {/* Profile */}
          <Link href="/profile">
            <button
              className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-1"
              data-testid="nav-profile"
            >
              <User className="h-6 w-6 text-gray-600 dark:text-gray-300" />
              <span className="text-xs text-gray-600 dark:text-gray-300 text-right">
                أنا
              </span>
            </button>
          </Link>
        </div>
      </nav>
    </div>
  );
}
