import { useProducts, useCategories } from "@/hooks/use-products";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, Gift, Percent, Sparkles, ChevronLeft } from "lucide-react";
import heroBanner from "@assets/generated_images/arabic_packaging_store_hero_banner.png";

export default function Home() {
  const { data: products, isLoading } = useProducts();
  const { data: categories } = useCategories();

  const featuredProducts = products?.slice(0, 8);

  return (
    <div className="flex flex-col pb-20 bg-gray-50 dark:bg-background">
      {/* Hero Banner - SHEIN Style */}
      <section className="relative">
        <div className="relative aspect-[16/9] md:aspect-[21/9] overflow-hidden">
          <img
            src={heroBanner}
            alt="اويو بلاست"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-black/60 via-black/30 to-transparent">
            <div className="absolute bottom-4 right-4 md:bottom-8 md:right-8 text-right">
              <h2 className="text-2xl md:text-4xl font-bold text-white mb-1 md:mb-2">
                لحظات جميلة
              </h2>
              <p className="text-sm md:text-lg text-white/90 mb-2 md:mb-4">
                تصاميم ناعمة، أناقة خالدة
              </p>
              <Link href="/products">
                <Button className="bg-white text-black hover:bg-white/90 rounded-full px-4 py-2 text-sm font-bold gap-1" data-testid="button-hero-shop-now">
                  تسوق الآن
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* New Users Gift Section - SHEIN Style */}
      <section className="mx-3 -mt-4 relative z-10">
        <div className="bg-gradient-to-l from-pink-400 to-pink-500 rounded-2xl p-3 shadow-lg">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 text-white">
              <Gift className="h-4 w-4" />
              <span className="text-xs">شحن مجاني</span>
              <span className="text-xs">التسليم في الموعد</span>
            </div>
            <div className="text-white font-bold text-sm flex items-center gap-1">
              <Sparkles className="h-4 w-4" />
              هدايا للمستخدمين الجدد
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-3 flex items-center justify-between">
            <Link href="/products" className="w-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-yellow-400 text-black font-bold px-3 py-2 rounded-lg text-center">
                    <div className="text-lg">خصم</div>
                    <div className="text-2xl">15%</div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm">هدية للمستخدمين الجدد</p>
                    <p className="text-xs text-muted-foreground">لفترة محدودة</p>
                  </div>
                </div>
                <Button className="bg-green-500 hover:bg-green-600 text-white rounded-full px-4 text-sm" data-testid="button-promo-get-now">
                  احصل عليها الآن
                </Button>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Category Circles Grid - SHEIN Style */}
      <section className="py-6 px-3">
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 md:gap-4">
          {categories?.map((cat) => (
            <Link 
              key={cat.id} 
              href={`/products?category=${cat.id}`}
              className="flex flex-col items-center gap-2"
              data-testid={`category-circle-${cat.id}`}
            >
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-2 border-gray-100 shadow-sm hover:shadow-md hover:border-primary/50 transition-all duration-300 bg-white">
                <img 
                  src={cat.imageUrl || ''} 
                  alt={cat.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-[10px] md:text-xs font-medium text-foreground text-center leading-tight line-clamp-2 max-w-[72px]">
                {cat.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Special Offers Section */}
      <section className="px-3 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="bg-red-500 text-white px-3 py-1 rounded-full flex items-center gap-1">
            <Percent className="h-4 w-4" />
            <span className="text-sm font-bold">عروض خاصة</span>
          </div>
          <div className="flex-1 h-[1px] bg-gradient-to-l from-transparent to-red-200"></div>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <Link href="/products">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 relative overflow-hidden hover:scale-[1.02] transition-transform">
              <span className="text-3xl font-extrabold text-blue-600">15%</span>
              <p className="text-sm font-bold text-foreground mt-1">خصم الجملة</p>
              <p className="text-xs text-muted-foreground">على جميع علب البلاستيك</p>
            </div>
          </Link>
          <Link href="/products">
            <div className="bg-pink-50 dark:bg-pink-900/20 rounded-xl p-4 relative overflow-hidden hover:scale-[1.02] transition-transform">
              <span className="text-3xl font-extrabold text-pink-600">10%</span>
              <p className="text-sm font-bold text-foreground mt-1">عروض الأكياس</p>
              <p className="text-xs text-muted-foreground">عند طلب أكثر من 10 شدات</p>
            </div>
          </Link>
        </div>
      </section>

      {/* Featured Products */}
      <section className="px-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="bg-primary text-white px-3 py-1 rounded-full flex items-center gap-1">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-bold">الأكثر مبيعاً</span>
            </div>
          </div>
          <Link href="/products">
            <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 gap-1">
              عرض الكل <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-72 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {featuredProducts?.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
        
        <div className="mt-6 text-center">
          <Link href="/products">
            <Button size="lg" variant="outline" className="px-8 rounded-full border-2">
              تصفح جميع المنتجات
              <ArrowLeft className="mr-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
