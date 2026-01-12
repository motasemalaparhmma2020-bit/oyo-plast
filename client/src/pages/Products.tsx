import { useProducts, useCategories } from "@/hooks/use-products";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Search, Package, Coffee, ShoppingBag, Palette } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";

const QUICK_FILTERS = [
  { id: "", name: "الكل", icon: null },
  { id: "1", name: "أكواب", icon: Coffee },
  { id: "2", name: "علب", icon: Package },
  { id: "3", name: "أكياس", icon: ShoppingBag },
  { id: "6", name: "طباعة", icon: Palette },
];

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
  };

  const productCount = products?.length || 0;

  return (
    <div className="pb-20 bg-white dark:bg-background min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-card border-b px-4 py-3">
        <h1 className="text-xl font-bold text-center mb-3">التصنيفات</h1>
        
        {/* Quick Filter Buttons */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {QUICK_FILTERS.map((filter) => {
            const isActive = selectedCategory === filter.id;
            const IconComponent = filter.icon;
            return (
              <Button
                key={filter.id}
                variant={isActive ? "default" : "outline"}
                size="sm"
                className={`flex-shrink-0 rounded-full gap-1.5 px-4 ${
                  isActive 
                    ? "bg-teal-500 hover:bg-teal-600 text-white border-teal-500" 
                    : "bg-white hover:bg-gray-50 text-gray-700 border-gray-200"
                }`}
                onClick={() => handleCategoryClick(filter.id)}
                data-testid={`filter-${filter.id || 'all'}`}
              >
                {IconComponent && <IconComponent className="h-4 w-4" />}
                {filter.name}
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
          <div className="grid grid-cols-2 gap-3">
            {products.map((product) => (
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
