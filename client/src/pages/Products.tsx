import { useCategoriesAndProducts, useCategories } from "@/hooks/use-products";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Search, ShoppingBag, Package, Truck, Zap, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { useSEO } from "@/hooks/use-seo";
import { useSearch, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

// تحسين رابط الصورة: local /assets/ أو Cloudinary
function optimizeBannerUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("/assets/")) return `${url}?w=800`;
  if (url.includes("res.cloudinary.com") && url.includes("/upload/")) {
    return url.replace("/upload/", "/upload/w_800,h_320,c_fill,f_auto,q_auto/");
  }
  return url;
}

export default function Products() {
  const rawSearch = useSearch();
  const [, navigate] = useLocation();
  const searchParams = new URLSearchParams(rawSearch);
  const urlCategory = searchParams.get("category") || "";
  const urlSubcategory = searchParams.get("subcategory") || "";
  const urlSearch = searchParams.get("search") || "";
  const urlFilter = searchParams.get("filter") || "";

  const isFreeShipping = urlFilter === "free-shipping";
  const isFlashDeals = urlFilter === "flash-deals";
  const isBannerFilter = isFreeShipping || isFlashDeals;

  useSEO({
    title: isFreeShipping
      ? "منتجات شحن مجاني | أويو بلاست"
      : isFlashDeals
      ? "عروض سريعة | أويو بلاست"
      : "جميع المنتجات | أويو بلاست",
    description: "تصفّح مجموعتنا الكاملة من الأكياس ومستلزمات التغليف - أكياس بلاستيكية، قماشية، علاقي، وأكثر. أسعار الجملة والتجزئة.",
    keywords: "أكياس تغليف, أكياس بلاستيك, علاقي أكياس, أكياس قماشية, شراء أكياس اليمن",
    canonical: "https://oyoplast.com/products",
  });

  const [selectedCategory, setSelectedCategory] = useState<string>(urlCategory);
  const [search, setSearch] = useState(urlSearch);
  const [searchTerm, setSearchTerm] = useState(urlSearch);

  useEffect(() => {
    setSelectedCategory(urlCategory);
    setSearch(urlSearch);
    setSearchTerm(urlSearch);
  }, [urlCategory, urlSearch]);

  const { products, categories, isLoading } = useCategoriesAndProducts(
    selectedCategory || undefined,
    searchTerm,
    urlFilter || undefined,
    urlSubcategory || undefined
  );

  // جلب بيانات القسم الحالي (للبنر)
  const { data: allCategories = [] } = useCategories();
  const activeCategoryObj = (allCategories as any[]).find(
    (c: any) => c.slug === selectedCategory || c.slug === urlCategory
  );

  // جلب بيانات القسم الفرعي (للبنر)
  const { data: subcategoryObj } = useQuery<any>({
    queryKey: ["/api/subcategories/by-slug", urlSubcategory],
    queryFn: async () => {
      if (!urlSubcategory) return null;
      const res = await fetch(`/api/subcategories/by-slug/${encodeURIComponent(urlSubcategory)}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!urlSubcategory,
  });

  // البنر: قسم فرعي يُقدَّم على القسم الرئيسي
  const bannerItem = subcategoryObj || activeCategoryObj || null;
  const showImageBanner = !isBannerFilter && bannerItem?.imageUrl;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchTerm(search);
  };

  const handleCategoryClick = (categorySlug: string) => {
    setSelectedCategory(categorySlug);
    setSearchTerm("");
    setSearch("");
  };

  const productCount = products?.length || 0;

  return (
    <div className="pb-20 bg-white dark:bg-background min-h-screen">
      {/* ── Header البنر الخاص (شحن مجاني / عروض سريعة) ─────────── */}
      {isBannerFilter ? (
        <header className="sticky top-0 z-40 bg-white dark:bg-card border-b">
          <div
            className={`px-4 py-3 flex items-center gap-3 ${
              isFreeShipping
                ? "bg-green-50 dark:bg-green-900/20"
                : "bg-yellow-50 dark:bg-yellow-900/20"
            }`}
          >
            <button
              onClick={() => navigate("/products")}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400"
              data-testid="btn-back-products"
            >
              <ArrowRight className="h-5 w-5" />
            </button>
            <div
              className={`rounded-full p-2 ${
                isFreeShipping
                  ? "bg-green-100 dark:bg-green-900/40"
                  : "bg-yellow-100 dark:bg-yellow-900/40"
              }`}
            >
              {isFreeShipping ? (
                <Truck className={`h-5 w-5 text-green-600 dark:text-green-400`} />
              ) : (
                <Zap className={`h-5 w-5 text-yellow-600 dark:text-yellow-400`} />
              )}
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                {isFreeShipping ? "شحن مجاني" : "عروض سريعة"}
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isFreeShipping
                  ? "جميع المنتجات ذات الشحن المجاني"
                  : "أفضل العروض والخصومات"}
              </p>
            </div>
            <span className="mr-auto text-sm text-gray-400">{productCount} منتج</span>
          </div>
          {/* شريط البحث */}
          <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700">
            <form onSubmit={handleSearch}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="بحث في هذه المنتجات..."
                  className="pr-3 pl-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 border-0 text-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  data-testid="input-search-products"
                />
              </div>
            </form>
          </div>
        </header>
      ) : (
        /* ── Header العادي ─────────────────────────────────── */
        <header className="sticky top-0 z-40 bg-white dark:bg-card border-b px-4 py-3">
          <h1 className="text-xl font-bold text-center mb-3">التصنيفات</h1>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <Button
              variant={selectedCategory === "" ? "default" : "outline"}
              size="sm"
              className={`flex-shrink-0 rounded-full gap-1.5 px-4 ${
                selectedCategory === ""
                  ? "bg-teal-500 hover:bg-teal-600 text-white border-teal-500"
                  : "bg-white hover:bg-gray-50 text-gray-700 border-gray-200"
              }`}
              onClick={() => handleCategoryClick("")}
              data-testid="filter-all"
            >
              الكل
            </Button>

            {categories?.filter((c: any) => c?.isActive).map((category: any) => {
              const isActive = selectedCategory === String(category?.slug);
              return (
                <Button
                  key={category?.id}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  className={`flex-shrink-0 rounded-full gap-1.5 px-4 ${
                    isActive
                      ? "bg-teal-500 hover:bg-teal-600 text-white border-teal-500"
                      : "bg-white hover:bg-gray-50 text-gray-700 border-gray-200"
                  }`}
                  onClick={() => handleCategoryClick(String(category?.slug))}
                  data-testid={`filter-${category?.id}`}
                >
                  <ShoppingBag className="h-4 w-4" />
                  {category?.name}
                </Button>
              );
            })}
          </div>
        </header>
      )}

      {/* ── بنر صورة القسم / القسم الفرعي ─────────────────────────────── */}
      {showImageBanner && (
        <div className="w-full h-40 overflow-hidden relative">
          <img
            src={optimizeBannerUrl(bannerItem.imageUrl)}
            alt={bannerItem.name}
            className="w-full h-full object-cover"
            loading="eager"
            decoding="async"
            data-testid="banner-category-image"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/60" />
          <div className="absolute bottom-0 right-0 left-0 px-4 pb-3 flex items-end justify-between">
            <button
              onClick={() => window.history.back()}
              className="rounded-full bg-white/20 backdrop-blur-sm p-1.5 text-white hover:bg-white/30 transition"
              data-testid="banner-back-btn"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
            <h2 className="text-white font-black text-xl drop-shadow-md">{bannerItem.name}</h2>
          </div>
        </div>
      )}

      {!isBannerFilter && (
        <div className="px-4 py-3 flex justify-between items-center border-b border-gray-100">
          <form onSubmit={handleSearch} className="flex-1 ml-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="بحث..."
                className="pr-3 pl-9 h-9 rounded-full bg-gray-100 border-0 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search-products"
              />
            </div>
          </form>
          <span className="text-sm text-gray-500">{productCount} منتج</span>
        </div>
      )}

      <div className="p-3">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-64 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : products && products.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {products.map((product: any) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-bold text-gray-500">
              {isBannerFilter ? "لا توجد منتجات في هذا القسم حالياً" : "لا توجد منتجات"}
            </h3>
            <p className="text-gray-400 mt-2 text-sm">
              {isBannerFilter
                ? isFreeShipping
                  ? "لم يتم تحديد منتجات بشحن مجاني بعد"
                  : "لا توجد عروض نشطة حالياً"
                : "حاول تغيير خيارات البحث"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
