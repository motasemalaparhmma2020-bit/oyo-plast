import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/ProductCard";
import { useCategories } from "@/hooks/use-products";
import { useState, useMemo } from "react";

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: allCategories = [], isLoading: catLoading } = useCategories();

  const decodedSlug = (() => {
    try { return decodeURIComponent(slug || "").trim(); } catch { return (slug || "").trim(); }
  })();
  const cat = allCategories.find((c: any) =>
    c.slug === decodedSlug ||
    c.slug === slug ||
    (c.slug || "").trim() === decodedSlug ||
    String(c.id) === decodedSlug
  );

  const { data: subcategories = [], isLoading: subLoading } = useQuery<any[]>({
    queryKey: ["/api/subcategories", cat?.id],
    queryFn: async () => {
      if (!cat?.id) return [];
      const res = await fetch(`/api/subcategories?categoryId=${cat.id}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!cat?.id,
  });

  const activeSubcategories = subcategories.filter((s: any) => s.isActive);

  // كل منتجات الفئة الكبيرة (تُجلب مرة واحدة، وتُفلتر محلياً)
  const { data: products = [], isLoading: prodLoading } = useQuery<any[]>({
    queryKey: ["/api/products", "category", cat?.id],
    queryFn: async () => {
      if (!cat?.id) return [];
      const res = await fetch(`/api/products?categoryId=${cat.id}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!cat?.id,
  });

  // الفئة الفرعية المختارة — null = الكل
  const [selectedSubId, setSelectedSubId] = useState<number | null>(null);

  // فلترة محلية فورية بدون أي طلب شبكة
  const filteredProducts = useMemo(() => {
    if (selectedSubId === null) return products;
    return products.filter((p: any) =>
      Number(p.subcategoryId) === Number(selectedSubId)
    );
  }, [products, selectedSubId]);

  const selectedSub = activeSubcategories.find((s: any) => Number(s.id) === Number(selectedSubId));
  const circleSize = 72;
  const isPageLoading = catLoading || (!!cat?.id && prodLoading);

  return (
    <div className="pb-24 min-h-screen bg-white dark:bg-background" dir="rtl">
      {/* Header مع زر العودة فقط (لا تكرار للعنوان) */}
      <div className="sticky top-0 z-40 bg-white/95 dark:bg-card/95 backdrop-blur-md border-b px-4 py-3 flex items-center gap-3">
        <Link href="/">
          <Button variant="ghost" size="icon" className="rounded-full h-9 w-9" data-testid="button-back">
            <ArrowRight className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-base font-bold flex-1 text-center pr-9" data-testid="category-title">
          {catLoading ? (
            <span className="inline-block h-4 w-24 bg-gray-200 rounded animate-pulse" />
          ) : (cat?.name || "القسم")}
        </h1>
      </div>

      {/* بانر الفئة — مدمج، حواف دائرية، بدون نص مكرر */}
      {cat?.imageUrl && (
        <div className="px-3 pt-3">
          <div className="w-full h-28 sm:h-36 overflow-hidden relative rounded-2xl shadow-sm">
            <img
              src={cat.imageUrl.startsWith("/assets/") ? `${cat.imageUrl}?w=800` : cat.imageUrl}
              alt={cat.name}
              className="w-full h-full object-cover"
              style={{ objectPosition: "center 30%" }}
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      )}

      {/* الأقسام الفرعية — قابلة للتفاعل */}
      {(subLoading || activeSubcategories.length > 0) && (
        <div className="px-4 pt-5 pb-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-gray-800 dark:text-white text-right">
              تصفّح حسب النوع
            </h3>
            {selectedSub && (
              <button
                onClick={() => setSelectedSubId(null)}
                className="text-xs text-primary font-semibold hover:underline"
                data-testid="button-clear-filter"
              >
                إلغاء الفلتر
              </button>
            )}
          </div>

          {subLoading ? (
            <div className="flex gap-3 overflow-x-auto">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex-shrink-0 flex flex-col items-center gap-1">
                  <div className="w-16 h-16 rounded-full bg-gray-100 animate-pulse" />
                  <div className="w-12 h-2 bg-gray-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <div
              className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {/* دائرة "الكل" */}
              <button
                onClick={() => setSelectedSubId(null)}
                className="flex flex-col items-center gap-1.5 cursor-pointer group flex-shrink-0 bg-transparent border-0 p-0"
                style={{ width: `${circleSize + 8}px` }}
                data-testid="subcategory-circle-all"
              >
                <div
                  className={`rounded-full border-2 flex items-center justify-center transition-all ${
                    selectedSubId === null
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-dashed border-gray-300 bg-gray-50 group-hover:bg-gray-100 text-gray-400"
                  }`}
                  style={{ width: `${circleSize}px`, height: `${circleSize}px` }}
                >
                  <span className="text-base font-bold">الكل</span>
                </div>
                <p className={`text-center font-semibold text-[11px] ${
                  selectedSubId === null ? "text-primary" : "text-gray-500"
                }`}>
                  عرض الكل
                </p>
              </button>

              {/* الفئات الفرعية — تفاعلية في نفس الصفحة */}
              {activeSubcategories.map((sub: any) => {
                const isActive = Number(selectedSubId) === Number(sub.id);
                return (
                  <button
                    key={sub.id}
                    onClick={() => setSelectedSubId(Number(sub.id))}
                    className="flex flex-col items-center gap-1.5 cursor-pointer group flex-shrink-0 bg-transparent border-0 p-0"
                    style={{ width: `${circleSize + 8}px` }}
                    data-testid={`subcategory-circle-${sub.id}`}
                  >
                    <div
                      className={`rounded-full overflow-hidden shadow-md transition-all ${
                        isActive
                          ? "ring-4 ring-primary scale-110 shadow-lg"
                          : "ring-2 ring-transparent group-hover:ring-primary/40 group-hover:scale-105"
                      } bg-gray-100 dark:bg-gray-800`}
                      style={{ width: `${circleSize}px`, height: `${circleSize}px` }}
                    >
                      {sub.imageUrl ? (
                        <img
                          src={sub.imageUrl}
                          alt={sub.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                          <Package className="h-6 w-6 text-primary/60" />
                        </div>
                      )}
                    </div>
                    <p
                      className={`text-center font-semibold leading-tight line-clamp-2 ${
                        isActive ? "text-primary" : "text-gray-800 dark:text-white"
                      }`}
                      style={{ fontSize: "11px", width: `${circleSize + 8}px` }}
                    >
                      {sub.name}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* المنتجات — فلترة فورية حسب الدائرة المختارة */}
      <div className="px-4 pt-3">
        <div className="flex items-center justify-between mb-3">
          <Link href={`/products?category=${slug}${selectedSub ? `&subcategory=${selectedSub.slug}` : ""}`}>
            <Button variant="ghost" size="sm" className="text-gray-500 text-xs gap-1" data-testid="button-view-all">
              عرض الكل
            </Button>
          </Link>
          <h3 className="font-bold text-gray-800 dark:text-white" data-testid="heading-products">
            {selectedSub ? selectedSub.name : "جميع المنتجات"}
            <span className="mr-2 text-xs font-normal text-gray-500">
              ({filteredProducts.length})
            </span>
          </h3>
        </div>

        {isPageLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredProducts.map((product: any) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : cat ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">
              {selectedSub
                ? `لا توجد منتجات في ${selectedSub.name}`
                : "لا توجد منتجات في هذا القسم"}
            </p>
            {selectedSub && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setSelectedSubId(null)}
                data-testid="button-show-all-empty"
              >
                عرض جميع منتجات القسم
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
