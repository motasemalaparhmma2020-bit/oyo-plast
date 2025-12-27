import { useProducts, useCategories } from "@/hooks/use-products";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, Gift, Percent, Sparkles, ChevronLeft, ChevronRight, Truck, CreditCard, Clock, Tag } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";

import fabricBagsImg from "@assets/generated_images/colorful_fabric_shopping_bags.png";
import weddingBagsImg from "@assets/generated_images/wedding_celebration_gift_bags.png";
import groceryBagsImg from "@assets/generated_images/grocery_store_plastic_bags.png";
import garbageBagsImg from "@assets/generated_images/black_garbage_trash_bags.png";
import foodContainersImg from "@assets/generated_images/food_takeaway_containers_packaging.png";

const BANNER_SLIDES = [
  {
    id: 1,
    image: fabricBagsImg,
    title: "أكياس قماشية",
    subtitle: "صديقة للبيئة وقابلة لإعادة الاستخدام",
    categoryLink: "/products?category=6"
  },
  {
    id: 2,
    image: weddingBagsImg,
    title: "أكياس الأعراس والأفراح",
    subtitle: "تصاميم أنيقة للمناسبات الخاصة",
    categoryLink: "/products"
  },
  {
    id: 3,
    image: groceryBagsImg,
    title: "أكياس علاقي بقالة",
    subtitle: "أكياس عملية للمتاجر والسوبرماركت",
    categoryLink: "/products?category=1"
  },
  {
    id: 4,
    image: garbageBagsImg,
    title: "أكياس نفايات",
    subtitle: "أكياس قوية ومتينة للنظافة",
    categoryLink: "/products?category=3"
  },
  {
    id: 5,
    image: foodContainersImg,
    title: "سفر طعام",
    subtitle: "علب ومستلزمات تغليف الأطعمة",
    categoryLink: "/products?category=2"
  }
];

export default function Home() {
  const { data: products, isLoading } = useProducts();
  const { data: categories } = useCategories();
  const [currentSlide, setCurrentSlide] = useState(0);

  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: true,
    direction: 'rtl'
  });

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCurrentSlide(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    
    const autoplay = setInterval(() => {
      emblaApi.scrollNext();
    }, 4000);

    return () => {
      clearInterval(autoplay);
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onSelect]);

  const featuredProducts = products?.slice(0, 8);

  return (
    <div className="flex flex-col pb-20 bg-gray-50 dark:bg-background">
      {/* Hero Banner Carousel */}
      <section className="relative">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {BANNER_SLIDES.map((slide) => (
              <div key={slide.id} className="flex-[0_0_100%] min-w-0">
                <div className="relative aspect-[16/9] md:aspect-[21/9] overflow-hidden">
                  <img
                    src={slide.image}
                    alt={slide.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-l from-black/70 via-black/40 to-transparent">
                    <div className="absolute bottom-4 right-4 md:bottom-8 md:right-8 text-right">
                      <h2 className="text-2xl md:text-4xl font-bold text-white mb-1 md:mb-2">
                        {slide.title}
                      </h2>
                      <p className="text-sm md:text-lg text-white/90 mb-2 md:mb-4">
                        {slide.subtitle}
                      </p>
                      <Link href={slide.categoryLink}>
                        <Button className="bg-white text-black hover:bg-white/90 rounded-full px-4 py-2 text-sm font-bold gap-1" data-testid={`button-banner-${slide.id}`}>
                          تسوق الآن
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation Arrows */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full shadow-md z-10"
          onClick={scrollNext}
          data-testid="button-banner-next"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full shadow-md z-10"
          onClick={scrollPrev}
          data-testid="button-banner-prev"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>

        {/* Dots Indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {BANNER_SLIDES.map((_, index) => (
            <button
              key={index}
              className={`w-2 h-2 rounded-full transition-all ${
                currentSlide === index 
                  ? 'bg-white w-6' 
                  : 'bg-white/50 hover:bg-white/70'
              }`}
              onClick={() => emblaApi?.scrollTo(index)}
              data-testid={`button-dot-${index}`}
            />
          ))}
        </div>
      </section>

      {/* Small Promotional Banners - OYO PLAST Blue Theme */}
      <section className="px-3 py-3 grid grid-cols-2 gap-2">
        {/* Banner 1: Free Shipping + Cash on Delivery */}
        <div className="bg-gradient-to-l from-[#2196F3] to-[#1976D2] rounded-xl p-3 overflow-hidden relative shadow-md">
          <div className="animate-bounce-slow flex flex-col items-center text-white text-center">
            <div className="flex items-center gap-2 mb-1">
              <Truck className="h-5 w-5" />
              <span className="font-bold text-sm">شحن مجاني</span>
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              <span className="text-xs">الدفع عند الاستلام</span>
            </div>
          </div>
        </div>

        {/* Banner 2: Exclusive Discounts + On-time Delivery */}
        <div className="bg-gradient-to-l from-[#42A5F5] to-[#2196F3] rounded-xl p-3 overflow-hidden relative shadow-md">
          <div className="animate-bounce-slow flex flex-col items-center text-white text-center" style={{ animationDelay: '0.5s' }}>
            <div className="flex items-center gap-2 mb-1">
              <Tag className="h-5 w-5" />
              <span className="font-bold text-sm">خصومات حصرية</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="text-xs">التسليم في الموعد</span>
            </div>
          </div>
        </div>
      </section>

      {/* New Users Gift Section - OYO PLAST Blue Theme */}
      <section className="mx-3 mt-2 relative z-10">
        <div className="bg-gradient-to-l from-[#1976D2] to-[#2196F3] rounded-2xl p-3 shadow-lg">
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
                  <div className="bg-[#2196F3] text-white font-bold px-3 py-2 rounded-lg text-center">
                    <div className="text-lg">خصم</div>
                    <div className="text-2xl">15%</div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm">هدية للمستخدمين الجدد</p>
                    <p className="text-xs text-muted-foreground">لفترة محدودة</p>
                  </div>
                </div>
                <Button className="bg-[#2196F3] hover:bg-[#1976D2] text-white rounded-full px-4 text-sm" data-testid="button-promo-get-now">
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
