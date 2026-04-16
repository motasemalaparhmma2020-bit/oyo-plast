import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, BadgeCheck, Palette, Sparkles } from "lucide-react";
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

      <section className="grid gap-3 px-4 py-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4 dark:border-teal-900/40 dark:bg-teal-950/20">
          <div className="mb-2 flex items-center gap-2 text-teal-700 dark:text-teal-300">
            <Palette className="h-4 w-4" />
            <span className="text-sm font-semibold">منتجات مختارة</span>
          </div>
          <p className="text-2xl font-bold text-teal-700 dark:text-teal-300" data-testid="text-printing-products-count">{products.length}</p>
          <p className="mt-1 text-xs text-teal-700/70 dark:text-teal-300/70">من لوحة الإدارة</p>
        </div>
        <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4 dark:border-cyan-900/40 dark:bg-cyan-950/20">
          <div className="mb-2 flex items-center gap-2 text-cyan-700 dark:text-cyan-300">
            <BadgeCheck className="h-4 w-4" />
            <span className="text-sm font-semibold">عرض تلقائي</span>
          </div>
          <p className="text-sm text-cyan-700/80 dark:text-cyan-300/80">أي منتج تُفعّله الإدارة يظهر هنا فوراً</p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="mb-2 flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-semibold">طباعة وتصميم</span>
          </div>
          <p className="text-sm text-amber-700/80 dark:text-amber-300/80">اختر المنتج ثم انتقل لصفحة التفاصيل للتخصيص</p>
        </div>
      </section>

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
