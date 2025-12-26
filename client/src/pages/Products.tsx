import { useProducts, useCategories } from "@/hooks/use-products";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Package, ChevronLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Products() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialCategory = searchParams.get("category") || "";
  
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [search, setSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showProducts, setShowProducts] = useState(!!initialCategory);

  const { data: products, isLoading } = useProducts(
    selectedCategory || undefined,
    searchTerm
  );
  
  const { data: categories } = useCategories();

  useEffect(() => {
    if (initialCategory) {
      setSelectedCategory(initialCategory);
      setShowProducts(true);
    }
  }, [initialCategory]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchTerm(search);
    setShowProducts(true);
  };

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setShowProducts(true);
  };

  const handleBackToCategories = () => {
    setSelectedCategory("");
    setShowProducts(false);
    setSearchTerm("");
  };

  if (showProducts) {
    return (
      <div className="pb-20 bg-gray-50 dark:bg-background min-h-screen">
        <div className="sticky top-0 z-40 bg-white dark:bg-card border-b px-4 py-3">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleBackToCategories}
              data-testid="button-back-categories"
            >
              <ChevronLeft className="h-5 w-5 rotate-180" />
            </Button>
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="ابحث عن منتج..." 
                  className="pr-9 h-10 rounded-full bg-gray-100 dark:bg-muted border-0"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  data-testid="input-search-products"
                />
              </div>
            </form>
          </div>
        </div>

        <div className="p-4">
          <h2 className="text-lg font-bold mb-4">
            {categories?.find(c => c.id === Number(selectedCategory))?.name || "جميع المنتجات"}
          </h2>
          
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-72 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : products && products.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Package className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-xl font-bold text-muted-foreground">لا توجد منتجات</h3>
              <p className="text-muted-foreground/60 mt-2">حاول تغيير خيارات البحث</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20 bg-white dark:bg-background min-h-screen">
      {/* Header with horizontal category tabs */}
      <div className="sticky top-0 z-40 bg-white dark:bg-card border-b">
        <div className="px-4 py-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="البحث" 
              className="pr-9 h-10 rounded-lg bg-gray-100 dark:bg-muted border-0"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(e)}
              data-testid="input-search-main"
            />
          </div>
        </div>
        
        <div className="flex overflow-x-auto px-2 pb-2 gap-1 scrollbar-hide">
          <Button 
            variant="ghost" 
            size="sm" 
            className="whitespace-nowrap font-bold text-primary border-b-2 border-primary rounded-none"
            data-testid="button-tab-all"
          >
            كل
          </Button>
          {categories?.slice(0, 6).map((cat) => (
            <Button 
              key={cat.id}
              variant="ghost" 
              size="sm" 
              className="whitespace-nowrap text-muted-foreground rounded-none"
              onClick={() => handleCategoryClick(String(cat.id))}
              data-testid={`button-tab-${cat.id}`}
            >
              {cat.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Main content with sidebar */}
      <div className="flex">
        {/* Right Sidebar - Category List */}
        <div className="w-28 md:w-36 border-l bg-gray-50 dark:bg-muted/30 min-h-[calc(100vh-120px)]">
          <ScrollArea className="h-[calc(100vh-180px)]">
            <div className="py-2">
              <button
                className="w-full text-right px-3 py-3 text-sm font-bold text-primary bg-pink-50 dark:bg-primary/10 border-r-2 border-primary"
                data-testid="sidebar-category-recommended"
              >
                لأجلكم فقط
              </button>
              <button
                className="w-full text-right px-3 py-3 text-sm text-muted-foreground hover:bg-gray-100 dark:hover:bg-muted"
                onClick={() => handleCategoryClick("")}
                data-testid="sidebar-category-new"
              >
                جديد في
              </button>
              <button
                className="w-full text-right px-3 py-3 text-sm text-muted-foreground hover:bg-gray-100 dark:hover:bg-muted"
                data-testid="sidebar-category-sale"
              >
                تخفيض الأسعار
              </button>
              {categories?.map((cat) => (
                <button
                  key={cat.id}
                  className="w-full text-right px-3 py-3 text-sm text-muted-foreground hover:bg-gray-100 dark:hover:bg-muted"
                  onClick={() => handleCategoryClick(String(cat.id))}
                  data-testid={`sidebar-category-${cat.id}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Main Content - Category Circles Grid */}
        <div className="flex-1 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold">مختارات من أجلك</h2>
          </div>

          {/* Category Circles Grid - 4 columns like SHEIN */}
          <div className="grid grid-cols-4 gap-3 md:gap-4">
            {categories?.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(String(cat.id))}
                className="flex flex-col items-center gap-2 group"
                data-testid={`category-grid-${cat.id}`}
              >
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-full overflow-hidden border border-gray-200 dark:border-gray-700 group-hover:border-primary transition-colors bg-white dark:bg-card shadow-sm">
                  <img 
                    src={cat.imageUrl || ''} 
                    alt={cat.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="text-[10px] md:text-xs text-center leading-tight line-clamp-2 text-foreground max-w-[60px] md:max-w-[72px]">
                  {cat.name}
                </span>
              </button>
            ))}
          </div>

          {/* Featured Products Section */}
          {products && products.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold">منتجات مميزة</h2>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-primary gap-1"
                  onClick={() => setShowProducts(true)}
                  data-testid="button-view-all-products"
                >
                  عرض الكل
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {products.slice(0, 6).map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
