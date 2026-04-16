import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ProductCard } from "@/components/ProductCard";
import { useSEO } from "@/hooks/use-seo";

export default function Printing() {
  useSEO({
    title: "طباعة وتصميم | أويو بلاست",
    description: "منتجات الطباعة والتصميم المختارة من الإدارة وتظهر تلقائياً في هذه الصفحة.",
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
    <div className="flex min-h-screen flex-col bg-white pb-20 dark:bg-background" dir="rtl">
      <header className="bg-gradient-to-l from-teal-500 to-cyan-600 px-4 py-5 text-white">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" data-testid="button-back-home">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1 text-right">
            <h1 className="text-xl font-bold">طباعة وتصميم</h1>
            <p className="text-xs text-white/80">تظهر هنا المنتجات المختارة من الإدارة تلقائياً</p>
          </div>
        </div>
      </header>

      <section className="px-4 py-2">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 rounded-xl bg-gray-100 animate-pulse dark:bg-gray-800" />
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product: any) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-300 px-6 py-16 text-center dark:border-gray-700">
            <p className="mb-3 text-sm text-gray-500">لا توجد منتجات مفعلة للطباعة حالياً</p>
            <Link href="/products">
              <Button className="gap-2 bg-teal-600 hover:bg-teal-700" data-testid="button-browse-products">
                <ArrowLeft className="h-4 w-4" />
                العودة للمتجر
              </Button>
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
