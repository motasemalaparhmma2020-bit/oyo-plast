import { useCategoriesAndProducts } from "@/hooks/use-products";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Search, ShoppingBag, Package } from "lucide-react";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { useSEO } from "@/hooks/use-seo";
import { useSearch } from "wouter";

export default function Products() {
  useSEO({
    title: "جميع المنتجات | أويو بلاست",
    description: "تصفّح مجموعتنا الكاملة من الأكياس ومستلزمات التغليف - أكياس بلاستيكية، قماشية، علاقي، وأكثر. أسعار الجملة والتجزئة.",
    keywords: "أكياس تغليف, أكياس بلاستيك, علاقي أكياس, أكياس قماشية, شراء أكياس اليمن",
    canonical: "https://oyoplast.com/products",
  });

  const rawSearch = useSearch();
  const searchParams = new URLSearchParams(rawSearch);
  const urlCategory = searchParams.get("category") || "";
  const urlSearch = searchParams.get("search") || "";

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
    searchTerm
  );

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

      <div className="p-3">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-64 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : products && products.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {products.map((product: any) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-bold text-gray-500">لا توجد منتجات</h3>
            <p className="text-gray-400 mt-2 text-sm">حاول تغيير خيارات البحث</p>
          </div>
        )}
      </div>
    </div>
  );
}
