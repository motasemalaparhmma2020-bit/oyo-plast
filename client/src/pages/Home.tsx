import { useBestsellingProducts, useCategories } from "@/hooks/use-products";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Search, ShoppingBag } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

export default function Home() {
  const { data: bestselling, isLoading: isBestsellingLoading } = useBestsellingProducts(8);
  const { data: categories, isLoading: isCategoriesLoading } = useCategories();
  const [search, setSearch] = useState("");
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);

  const { data: banners = [] } = useQuery<any[]>({
    queryKey: ["/api/banners"],
    queryFn: async () => {
      const res = await fetch("/api/banners", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return data.filter((b: any) => b.isActive).sort((a: any, b: any) => a.sortOrder - b.sortOrder);
    },
  });

  // Auto-play carousel
  useEffect(() => {
    if (!autoPlay || banners.length === 0) return;
    const timer = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
    }, 5000); // Change banner every 5 seconds
    return () => clearInterval(timer);
  }, [autoPlay, banners.length]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      window.location.href = `/products?search=${encodeURIComponent(search)}`;
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

  return (
    <div className="flex flex-col pb-20 bg-white dark:bg-background min-h-screen">
      {/* Header with Logo and Search */}
      <header className="bg-gradient-to-l from-teal-500 to-teal-600 px-4 py-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center">
            <span className="text-teal-600 font-bold text-xl">O</span>
          </div>
          <div className="text-white text-right">
            <h1 className="text-xl font-bold">Oyo Plast</h1>
            <p className="text-xs text-white/80">حلول التغليف المتميزة</p>
          </div>
        </div>

        <form onSubmit={handleSearch}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              placeholder="ابحث عن المنتجات..."
              className="pr-4 pl-10 h-11 rounded-full bg-white border-0 text-right"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-home"
            />
          </div>
        </form>
      </header>

      {/* Category Icons Section - from DB */}
      <section className="py-6 px-4 bg-white">
        <h2 className="text-lg font-bold text-right mb-4">التصنيفات</h2>
        {isCategoriesLoading ? (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2 flex-shrink-0">
                <div className="w-16 h-16 rounded-full bg-gray-100 animate-pulse" />
                <div className="h-4 w-14 bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : categories && categories.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {categories.filter((c) => c.isActive).map((cat) => (
              <Link
                key={cat.id}
                href={`/products?category=${cat.id}`}
                className="flex flex-col items-center gap-2 flex-shrink-0"
                data-testid={`category-icon-${cat.id}`}
              >
                <div className="w-16 h-16 rounded-full bg-cyan-100 flex items-center justify-center overflow-hidden">
                  {cat.imageUrl ? (
                    <img
                      src={cat.imageUrl}
                      alt={cat.name}
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    <ShoppingBag className="h-7 w-7 text-teal-600" />
                  )}
                </div>
                <span className="text-xs font-medium text-gray-700 text-center max-w-[64px] truncate">
                  {cat.name}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-400 py-4">لا توجد أقسام حالياً</p>
        )}
      </section>

      {/* Banner Carousel Section */}
      <section className="px-4 mb-6">
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
                  <h3 className="text-white font-bold text-lg">{activeBanner?.title}</h3>
                  {activeBanner?.subtitle && (
                    <p className="text-white/80 text-sm">{activeBanner.subtitle}</p>
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
                        ? "bg-teal-600 h-2.5 w-6"
                        : "bg-gray-300 h-2 w-2 hover:bg-gray-400"
                    }`}
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
              >
                <ArrowLeft className="h-5 w-5 text-gray-700" />
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-l from-teal-500 to-teal-600 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-3 left-3">
              <span className="bg-orange-400 text-white text-xs font-bold px-3 py-1 rounded-full">
                عرض خاص
              </span>
            </div>
            <div className="text-white text-right mt-4">
              <h3 className="text-xl font-bold mb-2">طباعة مخصصة لعلامتك التجارية</h3>
              <p className="text-sm text-white/90 mb-4">خصم 20% على الطلبات الكبيرة</p>
              <Link href="/products">
                <Button
                  className="bg-white text-teal-600 hover:bg-white/90 rounded-full px-6 font-bold gap-2"
                  data-testid="button-special-offer"
                >
                  اطلب الآن
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* Best Selling Products */}
      <section className="px-4">
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
          <h2 className="text-lg font-bold">الأكثر مبيعاً</h2>
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
    </div>
  );
}
