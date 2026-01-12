import { useBestsellingProducts } from "@/hooks/use-products";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { ArrowLeft, Search, Coffee, Package, ShoppingBag, Palette } from "lucide-react";
import { useState } from "react";

const CATEGORY_ICONS = [
  { id: 1, name: "أكواب", icon: Coffee, link: "/products?category=1", bgColor: "bg-cyan-100" },
  { id: 2, name: "علب", icon: Package, link: "/products?category=2", bgColor: "bg-cyan-100" },
  { id: 3, name: "أكياس", icon: ShoppingBag, link: "/products?category=3", bgColor: "bg-cyan-100" },
  { id: 4, name: "طباعة", icon: Palette, link: "/products?category=6", bgColor: "bg-cyan-100" },
];

export default function Home() {
  const { data: bestselling, isLoading: isBestsellingLoading } = useBestsellingProducts(8);
  const [search, setSearch] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      window.location.href = `/products?search=${encodeURIComponent(search)}`;
    }
  };

  return (
    <div className="flex flex-col pb-20 bg-white dark:bg-background min-h-screen">
      {/* Header with Logo and Search */}
      <header className="bg-gradient-to-l from-teal-500 to-teal-600 px-4 py-4">
        {/* Logo Section */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center">
            <span className="text-teal-600 font-bold text-xl">O</span>
          </div>
          <div className="text-white text-right">
            <h1 className="text-xl font-bold">Oyo Plast</h1>
            <p className="text-xs text-white/80">حلول التغليف المتميزة</p>
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input 
              placeholder="ابحث عن المنتجات..." 
              className="pr-4 pl-10 h-11 rounded-full bg-white border-0 text-right"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-home"
            />
          </div>
        </form>
      </header>

      {/* Category Icons Section */}
      <section className="py-6 px-4 bg-white">
        <h2 className="text-lg font-bold text-right mb-4">التصنيفات</h2>
        <div className="flex justify-around">
          {CATEGORY_ICONS.map((cat) => {
            const IconComponent = cat.icon;
            return (
              <Link 
                key={cat.id} 
                href={cat.link}
                className="flex flex-col items-center gap-2"
                data-testid={`category-icon-${cat.id}`}
              >
                <div className={`w-16 h-16 rounded-full ${cat.bgColor} flex items-center justify-center`}>
                  <IconComponent className="h-7 w-7 text-teal-600" />
                </div>
                <span className="text-sm font-medium text-gray-700">{cat.name}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Special Offer Banner */}
      <section className="px-4 mb-6">
        <div className="bg-gradient-to-l from-teal-500 to-teal-600 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-3 left-3">
            <span className="bg-orange-400 text-white text-xs font-bold px-3 py-1 rounded-full">
              عرض خاص
            </span>
          </div>
          <div className="text-white text-right mt-4">
            <h3 className="text-xl font-bold mb-2">طباعة مخصصة لعلامتك التجارية</h3>
            <p className="text-sm text-white/90 mb-4">خصم 20% على الطلبات الكبيرة</p>
            <Link href="/products?category=6">
              <Button className="bg-white text-teal-600 hover:bg-white/90 rounded-full px-6 font-bold gap-2" data-testid="button-special-offer">
                اطلب الآن
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Best Selling Products */}
      <section className="px-4">
        <div className="flex items-center justify-between mb-4">
          <Link href="/products">
            <Button variant="ghost" size="sm" className="text-gray-500 gap-1" data-testid="button-view-all">
              عرض الكل
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h2 className="text-lg font-bold">الأكثر مبيعاً</h2>
        </div>
        
        {isBestsellingLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-64 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {bestselling?.slice(0, 6).map((product: any) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
