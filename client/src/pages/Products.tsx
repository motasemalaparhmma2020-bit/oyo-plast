import { useProducts, useCategories } from "@/hooks/use-products";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Search, ShoppingBag, Package, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { usePaginatedProducts } from "@/hooks/use-paginated-products";

export default function Products() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialCategory = searchParams.get("category") || "";
  const initialSearch = searchParams.get("search") || "";
  
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [search, setSearch] = useState(initialSearch);
  const [searchTerm, setSearchTerm] = useState(initialSearch);

  const { data: products, isLoading } = useProducts(
    selectedCategory || undefined,
    searchTerm
  );
  
  const { data: categories } = useCategories();
  
  // Pagination hook
  const {
    items: paginatedProducts,
    totalPages,
    currentPage,
    totalItems,
    nextPage,
    prevPage,
    goToPage,
  } = usePaginatedProducts(products);

  useEffect(() => {
    if (initialCategory) {
      setSelectedCategory(initialCategory);
    }
    if (initialSearch) {
      setSearch(initialSearch);
      setSearchTerm(initialSearch);
    }
  }, [initialCategory, initialSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchTerm(search);
  };

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setSearchTerm("");
    setSearch("");
    // Reset to first page when filtering
    goToPage(1);
  };

  const productCount = products?.length || 0;

  return (
    <div className="pb-20 bg-white dark:bg-background min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-card border-b px-4 py-3">
        <h1 className="text-xl font-bold text-center mb-3">التصنيفات</h1>
        
        {/* Dynamic Filter Buttons from Database */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {/* All Button */}
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

          {/* Dynamic Categories from Database */}
          {categories?.filter(c => c?.isActive).map((category) => {
            const isActive = selectedCategory === String(category?.id);
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
                onClick={() => handleCategoryClick(String(category?.id))}
                data-testid={`filter-${category?.id}`}
              >
                <ShoppingBag className="h-4 w-4" />
                {category?.name}
              </Button>
            );
          })}
        </div>
      </header>

      {/* Product Count */}
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

      {/* Products Grid */}
      <div className="p-3">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-64 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : products && products.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {paginatedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-900 rounded-xl sticky bottom-20">
                <Button
                  onClick={prevPage}
                  disabled={currentPage === 1}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <ChevronRight className="h-4 w-4" />
                  السابق
                </Button>

                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      onClick={() => goToPage(page)}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      className="w-8 h-8 p-0"
                    >
                      {page}
                    </Button>
                  ))}
                </div>

                <Button
                  onClick={nextPage}
                  disabled={currentPage === totalPages}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  التالي
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Pagination Info */}
            <div className="text-center text-sm text-gray-500 mt-4">
              عرض {(currentPage - 1) * 12 + 1}-{Math.min(currentPage * 12, totalItems)} من {totalItems} منتج
            </div>
          </>
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
