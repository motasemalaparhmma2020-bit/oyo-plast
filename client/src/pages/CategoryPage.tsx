import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/ProductCard";
import { useCategories } from "@/hooks/use-products";

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();

  // يستخدم نفس مفتاح كاش الصفحة الرئيسية — بيانات فورية بدون انتظار
  const { data: allCategories = [], isLoading: catLoading } = useCategories();

  // البحث عن القسم المطلوب — يدعم الـ slug العربي والمُشفَّر
  const decodedSlug = (() => { try { return decodeURIComponent(slug || ""); } catch { return slug || ""; } })();
  const cat = allCategories.find((c: any) => c.slug === decodedSlug || c.slug === slug);

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

  const circleSize = 72;
  const isPageLoading = catLoading || (!!cat?.id && prodLoading);

  return (
    <div className="pb-24 min-h-screen bg-white dark:bg-background" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white dark:bg-card border-b px-4 py-3 flex items-center gap-3">
        <Link href="/">
          <Button variant="ghost" size="icon" className="rounded-full h-9 w-9" data-testid="button-back">
            <ArrowRight className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-lg font-bold flex-1 text-center pr-9" data-testid="category-title">
          {catLoading ? (
            <span className="inline-block h-5 w-28 bg-gray-200 rounded animate-pulse" />
          ) : (cat?.name || "القسم")}
        </h1>
      </div>

      {/* صورة القسم */}
      {cat?.imageUrl && (
        <div className="w-full h-32 overflow-hidden relative">
          <img
            src={cat.imageUrl}
            alt={cat.name}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40" />
          <div className="absolute bottom-3 right-4">
            <h2 className="text-white font-black text-xl drop-shadow">{cat?.name}</h2>
          </div>
        </div>
      )}

      {/* الأقسام الفرعية */}
      {(subLoading || activeSubcategories.length > 0) && (
        <div className="px-4 pt-5 pb-3">
          <h3 className="text-base font-bold text-gray-800 dark:text-white mb-3 text-right">
            تصفّح حسب النوع
          </h3>
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
              {activeSubcategories.map((sub: any) => (
                <Link key={sub.id} href={`/products?subcategory=${sub.slug}`}>
                  <div
                    className="flex flex-col items-center gap-1.5 cursor-pointer group flex-shrink-0"
                    style={{ width: `${circleSize + 8}px` }}
                    data-testid={`subcategory-circle-${sub.id}`}
                  >
                    <div
                      className="rounded-full overflow-hidden shadow-md group-hover:shadow-lg transition-all group-hover:scale-105 bg-gray-100 dark:bg-gray-800 ring-2 ring-transparent group-hover:ring-primary/40"
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
                      className="text-center font-semibold text-gray-800 dark:text-white line-clamp-2 leading-tight"
                      style={{ fontSize: "11px", width: `${circleSize + 8}px` }}
                    >
                      {sub.name}
                    </p>
                  </div>
                </Link>
              ))}

              {/* عرض كل المنتجات */}
              <Link href={`/products?category=${slug}`}>
                <div
                  className="flex flex-col items-center gap-1.5 cursor-pointer group flex-shrink-0"
                  style={{ width: `${circleSize + 8}px` }}
                  data-testid="subcategory-view-all"
                >
                  <div
                    className="rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 group-hover:bg-gray-100 transition-all"
                    style={{ width: `${circleSize}px`, height: `${circleSize}px` }}
                  >
                    <span className="text-lg text-gray-400 group-hover:text-primary">الكل</span>
                  </div>
                  <p className="text-center font-semibold text-gray-500 text-xs">
                    عرض الكل
                  </p>
                </div>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* المنتجات */}
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between mb-3">
          <Link href={`/products?category=${slug}`}>
            <Button variant="ghost" size="sm" className="text-gray-500 text-xs gap-1">
              عرض الكل
            </Button>
          </Link>
          <h3 className="font-bold text-gray-800 dark:text-white" data-testid="heading-products">
            جميع المنتجات
          </h3>
        </div>

        {isPageLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {products.slice(0, 6).map((product: any) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : cat ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">لا توجد منتجات في هذا القسم</p>
            <Link href="/products">
              <Button variant="outline" className="mt-3" size="sm">تصفّح جميع المنتجات</Button>
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
