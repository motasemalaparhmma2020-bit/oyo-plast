import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, Sparkles, Printer, RefreshCw, PackageSearch } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { ProductCard } from "@/components/ProductCard";
import { useSEO } from "@/hooks/use-seo";
import { PrintingAssistant } from "@/components/PrintingAssistant";

export default function Printing() {
  useSEO({
    title: "طباعة وتصميم | أويو بلاست",
    description: "موظف ذكي متخصص يساعدك على طلب منتجات الطباعة المخصصة — أكياس، كروت، فواتير، ملصقات وأكثر.",
    keywords: "طباعة أكياس, طباعة مخصصة, أكياس مطبوعة, تصميم أكياس, كروت شخصية, أويو بلاست",
    canonical: "https://oyoplast.com/printing",
  });

  const {
    data: products = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<any[]>({
    queryKey: ["/api/printing-products"],
    staleTime: 0,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 pb-24 dark:bg-background" dir="rtl">
      {/* Header */}
      <header className="bg-gradient-to-l from-teal-500 to-cyan-600 px-4 py-5 text-white">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" data-testid="button-back-home">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1 text-right">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Printer className="h-5 w-5" />
              طباعة وتصميم مخصصة
            </h1>
            <p className="text-xs text-white/80 mt-0.5">اطلب تصميمك مع موظفنا الذكي — أويو</p>
          </div>
        </div>
      </header>

      {/* AI Assistant Section */}
      <section className="px-4 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-teal-500" />
          <h2 className="text-sm font-semibold text-gray-700">موظف الطباعة الذكي</h2>
          <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">يعمل بالذكاء الاصطناعي</span>
        </div>
        <PrintingAssistant />
      </section>

      {/* منتجات الطباعة */}
      <section className="px-4 pt-2 pb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-px flex-1 bg-gray-200 dark:bg-border" />
          <span className="text-xs text-gray-400 font-medium">منتجات الطباعة الجاهزة</span>
          <div className="h-px flex-1 bg-gray-200 dark:bg-border" />
        </div>

        {/* جاري التحميل */}
        {isLoading && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-64 rounded-xl bg-gray-100 animate-pulse dark:bg-gray-800" />
            ))}
          </div>
        )}

        {/* خطأ في التحميل */}
        {isError && !isLoading && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <PackageSearch className="h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-400">تعذّر تحميل المنتجات</p>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
              data-testid="btn-retry-printing-products"
            >
              <RefreshCw className="h-3.5 w-3.5" /> إعادة المحاولة
            </button>
          </div>
        )}

        {/* المنتجات */}
        {!isLoading && !isError && products.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product: any) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {/* فارغة — لا منتجات */}
        {!isLoading && !isError && products.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <PackageSearch className="h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-400">لا توجد منتجات طباعة متاحة حالياً</p>
            <p className="text-xs text-gray-300">استخدم الموظف الذكي أعلاه للطلب المباشر</p>
          </div>
        )}
      </section>
    </div>
  );
}
