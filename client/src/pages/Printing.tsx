import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, Sparkles, Printer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
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

  const { data: products = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/printing-products"],
    queryFn: async () => {
      const res = await fetch("/api/printing-products", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
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

      {/* Divider with Products Section */}
      {(products.length > 0 || isLoading) && (
        <section className="px-4 pt-2 pb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">منتجات الطباعة الجاهزة</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-64 rounded-xl bg-gray-100 animate-pulse dark:bg-gray-800" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((product: any) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
