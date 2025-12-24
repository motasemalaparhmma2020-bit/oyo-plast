import { useProducts, useCategories } from "@/hooks/use-products";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Loader2, Filter } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

export default function Products() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialCategory = searchParams.get("category") || "all";
  
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [search, setSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: products, isLoading } = useProducts(
    selectedCategory === "all" ? undefined : selectedCategory,
    searchTerm
  );
  
  const { data: categories } = useCategories();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchTerm(search);
  };

  return (
    <div className="container mx-auto px-4 py-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground">المنتجات</h1>
          <p className="text-muted-foreground mt-1">تصفح تشكيلتنا الواسعة من مستلزمات التغليف</p>
        </div>

        <form onSubmit={handleSearch} className="flex w-full md:w-auto gap-2">
          <div className="relative w-full md:w-80">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="ابحث عن منتج..." 
              className="pr-9 h-11 rounded-xl bg-white border-border/60 focus:border-primary"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button type="submit" size="icon" className="h-11 w-11 rounded-xl">
            <Search className="h-4 w-4" />
          </Button>
        </form>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-8">
        {/* Sidebar Filters */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border h-fit sticky top-24">
          <div className="flex items-center gap-2 mb-6 text-primary font-bold text-lg border-b pb-4">
            <Filter className="h-5 w-5" />
            التصنيفات
          </div>
          
          <div className="flex flex-col gap-2">
            <Button 
              variant={selectedCategory === "all" ? "default" : "ghost"}
              className={`justify-start text-lg h-12 rounded-xl ${selectedCategory === "all" ? "bg-primary text-white shadow-lg shadow-primary/20" : "hover:bg-gray-100"}`}
              onClick={() => setSelectedCategory("all")}
            >
              جميع المنتجات
            </Button>
            
            {categories?.map((category) => (
              <Button 
                key={category.id}
                variant={selectedCategory === String(category.id) ? "default" : "ghost"}
                className={`justify-start text-lg h-12 rounded-xl ${selectedCategory === String(category.id) ? "bg-primary text-white shadow-lg shadow-primary/20" : "hover:bg-gray-100"}`}
                onClick={() => setSelectedCategory(String(category.id))}
              >
                {category.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-80 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : products && products.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-gray-50 rounded-3xl border border-dashed">
              <Package className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-xl font-bold text-muted-foreground">لا توجد منتجات</h3>
              <p className="text-muted-foreground/60 mt-2">حاول تغيير خيارات البحث أو التصنيف</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
