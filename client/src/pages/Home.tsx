import { useBestsellingProducts, useCategories } from "@/hooks/use-products";
import { useHomeSettings } from "@/hooks/use-home-settings";
import { ProductCard } from "@/components/ProductCard";
import { MadelineHeader } from "@/components/MadelineHeader";
import { MadelineCategoriesGrid } from "@/components/MadelineCategoriesGrid";
import { MadelineOffers } from "@/components/MadelineOffers";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ArrowRight, ShoppingBag, User, Palette, Grid } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCart } from "@/hooks/use-cart";

export default function Home() {
  const { data: bestselling, isLoading: isBestsellingLoading } = useBestsellingProducts(8);
  const { data: categories, isLoading: isCategoriesLoading } = useCategories();
  const { data: homeSettings, isLoading: isHomeSettingsLoading } = useHomeSettings();
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [_location, navigate] = useLocation();
  const { cart } = useCart();

  const { data: navSettings } = useQuery<any>({
    queryKey: ["/api/navigation-settings"],
    queryFn: async () => {
      const res = await fetch("/api/navigation-settings", { credentials: "include" });
      if (!res.ok) return { showPrintingSection: true };
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

  // Auto-play carousel
  useEffect(() => {
    if (!autoPlay || banners.length === 0) return;
    const timer = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [autoPlay, banners.length]);

  const handleSearch = (query: string) => {
    if (query.trim()) {
      window.location.href = `/products?search=${encodeURIComponent(query)}`;
    }
  };

  const handlePrevBanner = () => {
    setAutoPlay(false);
    setCurrentBannerIndex((prev) => (prev - 1 + banners.length) % banners.length);
  };

  const handleNextBanner = () => {
    setAutoPlay(false);
    setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
  };

  const activeBanner = banners[currentBannerIndex];
  const primaryColor = homeSettings?.primaryColor || "#06B6D4";
  const accentColor = homeSettings?.accentColor || "#0891B2";

  return (
    <div className="flex flex-col pb-20 bg-white dark:bg-background min-h-screen">
      {/* Madeline Header */}
      {homeSettings?.showHeader !== false && (
        <MadelineHeader
          primaryColor={primaryColor}
          cartCount={cartCount}
          onSearch={handleSearch}
        />
      )}

      {/* Banner Carousel Section */}
      {homeSettings?.showBanners !== false && (
        <section className="px-4 py-6">
          {banners.length > 0 ? (
            <div className="space-y-3">
              <Link href={activeBanner?.linkUrl || "/products"}>
                <div className="relative rounded-2xl overflow-hidden h-40 bg-gray-200">
                  <img
                    src={activeBanner?.imageUrl}
                    alt={activeBanner?.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-4">
                    <h3
                      className="text-white font-bold text-lg"
                      data-testid="text-banner-title"
                    >
                      {activeBanner?.title}
                    </h3>
                    {activeBanner?.subtitle && (
                      <p
                        className="text-white/80 text-sm"
                        data-testid="text-banner-subtitle"
                      >
                        {activeBanner.subtitle}
                      </p>
                    )}
                  </div>
                </div>
              </Link>

              {/* Navigation Controls */}
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={handlePrevBanner}
                  onMouseEnter={() => setAutoPlay(false)}
                  onMouseLeave={() => setAutoPlay(true)}
                  className="flex-1 bg-white border border-gray-200 rounded-lg p-2 flex items-center justify-center hover:bg-gray-50 transition-colors"
                  aria-label="البنر السابق"
                  data-testid="button-banner-prev"
                >
                  <ArrowRight className="h-5 w-5 text-gray-700" />
                </button>

                {/* Dot Indicators */}
                <div className="flex gap-1.5 justify-center flex-1">
                  {banners.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setAutoPlay(false);
                        setCurrentBannerIndex(idx);
                      }}
                      className={`transition-all rounded-full ${
                        idx === currentBannerIndex
                          ? "h-2.5 w-6"
                          : "h-2 w-2 hover:opacity-75"
                      }`}
                      style={{
                        backgroundColor:
                          idx === currentBannerIndex ? primaryColor : "#d1d5db",
                      }}
                      aria-label={`البنر ${idx + 1}`}
                      data-testid={`banner-dot-${idx}`}
                    />
                  ))}
                </div>

                <button
                  onClick={handleNextBanner}
                  onMouseEnter={() => setAutoPlay(false)}
                  onMouseLeave={() => setAutoPlay(true)}
                  className="flex-1 bg-white border border-gray-200 rounded-lg p-2 flex items-center justify-center hover:bg-gray-50 transition-colors"
                  aria-label="البنر التالي"
                  data-testid="button-banner-next"
                >
                  <ArrowLeft className="h-5 w-5 text-gray-700" />
                </button>
              </div>
            </div>
          ) : null}
        </section>
      )}

      {/* Madeline Offers Section */}
      {homeSettings?.showOffers !== false && (
        <MadelineOffers
          offers={offers}
          accentColor={accentColor}
          isLoading={false}
        />
      )}

      {/* Madeline Categories Grid */}
      {homeSettings?.showCategories !== false && (
        <MadelineCategoriesGrid
          categories={categories || []}
          primaryColor={primaryColor}
          isLoading={isCategoriesLoading}
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
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* Bottom Navigation Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800"
      >
        <div className="flex items-center justify-around h-20">
          {/* Profile */}
          <Link href="/profile">
            <button
              className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              data-testid="nav-profile"
            >
              <User className="h-6 w-6 text-gray-600 dark:text-gray-300" />
              <span className="text-xs text-gray-600 dark:text-gray-300 text-right">
                أنا
              </span>
            </button>
          </Link>

          {/* Cart */}
          <Link href="/cart">
            <button
              className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative"
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
                حقيبة
              </span>
            </button>
          </Link>

          {/* Printing & Design */}
          {navSettings?.showPrintingSection && (
            <Link href="/printing">
              <button
                className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                data-testid="nav-printing"
              >
                <Palette className="h-6 w-6 text-gray-600 dark:text-gray-300" />
                <span className="text-xs text-gray-600 dark:text-gray-300 text-right">
                  طباعة
                </span>
              </button>
            </Link>
          )}

          {/* Categories */}
          <Link href="/products">
            <button
              className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              data-testid="nav-categories"
            >
              <Grid className="h-6 w-6 text-gray-600 dark:text-gray-300" />
              <span className="text-xs text-gray-600 dark:text-gray-300 text-right">
                فئات
              </span>
            </button>
          </Link>

          {/* Shop */}
          <Link href="/products">
            <button
              className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              data-testid="nav-shop"
              style={{ color: primaryColor }}
            >
              <ShoppingBag
                className="h-6 w-6"
                style={{ color: primaryColor }}
              />
              <span
                className="text-xs font-bold text-right"
                style={{ color: primaryColor }}
              >
                متجر
              </span>
            </button>
          </Link>
        </div>
      </nav>
    </div>
  );
}
