import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ProductCard } from "@/components/ProductCard";
import { useSEO } from "@/hooks/use-seo";

export default function Printing() {
  useSEO({
    title: "خدمة الطباعة على الأكياس | أويو بلاست",
    description: "طباعة مخصصة على الأكياس والتغليف - شعارك أو تصميمك على أكياسك. خدمة طباعة احترافية في اليمن والسعودية من أويو بلاست.",
    keywords: "طباعة أكياس, طباعة مخصصة, أكياس مطبوعة, تصميم أكياس, أويو بلاست",
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
    <div className="flex flex-col pb-20 bg-white dark:bg-background min-h-screen">
      {/* Header */}
      <header className="bg-gradient-to-l from-teal-500 to-teal-600 px-4 py-4">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="text-white text-right flex-1">
            <h1 className="text-xl font-bold">طباعة وتصميم</h1>
            <p className="text-xs text-white/80">اختر منتجاً للطباعة المخصصة</p>
          </div>
        </div>
      </header>

      {/* Products Grid */}
      <section className="px-4 py-6">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-64 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {products.map((product: any) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-gray-500 mb-4">لا توجد منتجات متاحة للطباعة حالياً</p>
            <Link href="/products">
              <Button className="bg-teal-600 hover:bg-teal-700 gap-2">
                عودة للمتجر
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
