import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/ProductCard";
import { useCategories } from "@/hooks/use-products";
import { useState, useMemo } from "react";

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: allCategories = [], isLoading: catLoading } = useCategories();

  // إعدادات العرض (للتحكم بحجم الدوائر والشريط من الأدمن)
  const { data: displaySettings } = useQuery<any>({
    queryKey: ["/api/display-settings"],
    staleTime: 60_000,
  });
  const circleSize = displaySettings?.subcategoryCircleSize ?? 72;
  const stripHeight = displaySettings?.subcategoryStripHeight ?? 110;

  const decodedSlug = (() => {
    try { return decodeURIComponent(slug || "").trim(); } catch { return (slug || "").trim(); }
  })();
  const cat = allCategories.find((c: any) =>
    c.slug === decodedSlug ||
    c.slug === slug ||
    (c.slug || "").trim() === decodedSlug ||
    String(c.id) === decodedSlug
  );

  const { data: subcategories = [] } = useQuery<any[]>({
    queryKey: ["/api/subcategories", cat?.id],
    queryFn: async () => {
      if (!cat?.id) return [];
      // إضافة timestamp لمنع التخزين المؤقت في المتصفح بعد رفع صور جديدة
      const res = await fetch(`/api/subcategories?categoryId=${cat.id}&_=${Date.now()}`, {
        cache: "no-store",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!cat?.id,
    staleTime: 5_000, // إعادة جلب سريعة لظهور التحديثات الإدارية
    refetchOnWindowFocus: true,
  });

  const activeSubcategories = subcategories.filter((s: any) => s.isActive);

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

  // الفئة الفرعية المختارة — افتراضياً أول فئة فرعية (أو null إذا لا توجد)
  const [selectedSubId, setSelectedSubId] = useState<number | null>(null);

  const filteredProducts = useMemo(() => {
    if (selectedSubId === null) return products;
    return products.filter((p: any) =>
      Number(p.subcategoryId) === Number(selectedSubId)
    );
  }, [products, selectedSubId]);

  const isPageLoading = catLoading || (!!cat?.id && prodLoading);

  return (
    <div className="pb-24 min-h-screen bg-white dark:bg-background" dir="rtl">
      {/* شريط الدوائر — مباشرة تحت Navbar بدون أي حشو */}
      {activeSubcategories.length > 0 && (
        <div
          className="w-full overflow-x-auto scrollbar-hide bg-white dark:bg-background border-b"
          style={{
            height: `${stripHeight}px`,
            WebkitOverflowScrolling: "touch",
          }}
          data-testid="subcategory-strip"
        >
          <div className="flex items-center gap-3 h-full px-3" style={{ minWidth: "max-content" }}>
            {activeSubcategories.map((sub: any) => {
              const isActive = Number(selectedSubId) === Number(sub.id);
              return (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSubId(isActive ? null : Number(sub.id))}
                  className="flex flex-col items-center gap-1.5 cursor-pointer group flex-shrink-0 bg-transparent border-0 p-0"
                  style={{ width: `${circleSize + 12}px` }}
                  data-testid={`subcategory-circle-${sub.id}`}
                >
                  <div
                    className={`rounded-full overflow-hidden shadow-md transition-all bg-gray-100 dark:bg-gray-800 ${
                      isActive
                        ? "ring-4 ring-primary scale-110 shadow-lg"
                        : "ring-2 ring-transparent group-hover:ring-primary/40 group-hover:scale-105"
                    }`}
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
                    style={{ fontSize: "11px", width: `${circleSize + 12}px` }}
                  >
                    {sub.name}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* المنتجات */}
      <div className="px-4 pt-3">
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
            <p className="text-gray-500 font-medium">لا توجد منتجات</p>
            {selectedSubId !== null && (
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
