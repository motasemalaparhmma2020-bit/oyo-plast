import { useProducts, useCategories, useBestsellingProducts } from "@/hooks/use-products";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, Gift, Percent, Sparkles, ChevronLeft, ChevronRight, Truck, CreditCard, Clock, Tag, ShoppingCart } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { useQuery } from "@tanstack/react-query";

interface Banner {
  id: number;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  linkUrl: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface Offer {
  id: number;
  title: string;
  discountPercent: number;
  imageUrl: string | null;
  linkUrl: string | null;
  bgColor: string | null;
  isActive: boolean;
  sortOrder: number;
}

import fabricBagsImg from "@assets/generated_images/colorful_fabric_shopping_bags.png";
import weddingBagsImg from "@assets/generated_images/wedding_celebration_gift_bags.png";
import groceryBagsImg from "@assets/generated_images/grocery_store_plastic_bags.png";
import garbageBagsImg from "@assets/generated_images/black_garbage_trash_bags.png";
import foodContainersImg from "@assets/generated_images/food_takeaway_containers_packaging.png";

import catHangerBags from "@assets/generated_images/plastic_hanger_grocery_bags.png";
import catCommercialBags from "@assets/generated_images/commercial_advertising_bags.png";
import catWeddingBags from "@assets/generated_images/wedding_celebration_gift_bags.png";
import catFabricBags from "@assets/generated_images/colorful_fabric_tote_bags.png";
import catFoodContainers from "@assets/generated_images/food_takeaway_containers.png";
import catGarbageBags from "@assets/generated_images/black_garbage_trash_bags.png";
import catWelcomeBags from "@assets/generated_images/welcome_printed_bags_arabic.png";
import catSpiceBags from "@assets/generated_images/spice_packaging_clear_bags.png";
import catPrintingDesign from "@assets/generated_images/custom_bag_printing_design.png";

const CATEGORY_CIRCLES = [
  { id: 1, name: "أكياس علاقي", image: catHangerBags, link: "/products?category=1" },
  { id: 2, name: "أكياس دعاية تجاري", image: catCommercialBags, link: "/products" },
  { id: 3, name: "أكياس أعراس", image: catWeddingBags, link: "/products" },
  { id: 4, name: "أكياس قماشية", image: catFabricBags, link: "/products?category=6" },
  { id: 5, name: "سفر طعام", image: catFoodContainers, link: "/products?category=2" },
  { id: 6, name: "أكياس نفايات", image: catGarbageBags, link: "/products?category=3" },
  { id: 7, name: "أكياس أهلاً وسهلاً", image: catWelcomeBags, link: "/products" },
  { id: 8, name: "أكياس تغليف بهارات", image: catSpiceBags, link: "/products" },
  { id: 9, name: "طباعة وتصميم", image: catPrintingDesign, link: "/products?category=6" },
];

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

const bgColorClasses: Record<string, { bg: string; text: string }> = {
  blue: { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-600" },
  pink: { bg: "bg-pink-50 dark:bg-pink-900/20", text: "text-pink-600" },
  green: { bg: "bg-green-50 dark:bg-green-900/20", text: "text-green-600" },
  purple: { bg: "bg-purple-50 dark:bg-purple-900/20", text: "text-purple-600" },
  orange: { bg: "bg-orange-50 dark:bg-orange-900/20", text: "text-orange-600" },
};

export default function Home() {
  const { data: products, isLoading } = useProducts();
  const { data: bestselling, isLoading: isBestsellingLoading } = useBestsellingProducts(8);
  const { data: categories } = useCategories();
  const [currentSlide, setCurrentSlide] = useState(0);

  const { data: dynamicBanners } = useQuery<Banner[]>({
    queryKey: ['/api/banners', 'active'],
    queryFn: async () => {
      const res = await fetch('/api/banners?active=true');
      if (!res.ok) return [];
      return res.json();
    }
  });

  const { data: dynamicOffers } = useQuery<Offer[]>({
    queryKey: ['/api/offers', 'active'],
    queryFn: async () => {
      const res = await fetch('/api/offers?active=true');
      if (!res.ok) return [];
      return res.json();
    }
  });

  const bannerSlides = dynamicBanners && dynamicBanners.length > 0 
    ? dynamicBanners.map(b => ({
        id: b.id,
        image: b.imageUrl,
        title: b.title,
        subtitle: b.subtitle || "",
        categoryLink: b.linkUrl || "/products"
      }))
    : BANNER_SLIDES;

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

  return (
    <div className="flex flex-col pb-20 bg-gray-50 dark:bg-background">
      {/* Hero Banner Carousel */}
      <section className="relative">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {bannerSlides.map((slide) => (
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
          {bannerSlides.map((_, index) => (
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

      {/* Category Circles Grid - OYO PLAST Style */}
      <section className="py-6 px-3">
        <div className="flex items-center gap-2 mb-4">
          <div className="bg-[#2196F3] text-white px-3 py-1 rounded-full">
            <span className="text-sm font-bold">الأقسام</span>
          </div>
          <div className="flex-1 h-[1px] bg-gradient-to-l from-transparent to-[#2196F3]/30"></div>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-4 md:gap-6">
          {CATEGORY_CIRCLES.map((cat) => (
            <Link 
              key={cat.id} 
              href={cat.link}
              className="flex flex-col items-center gap-2 group"
              data-testid={`category-circle-${cat.id}`}
            >
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-3 border-[#2196F3]/20 shadow-lg group-hover:shadow-xl group-hover:border-[#2196F3] transition-all duration-300 bg-white p-1">
                <img 
                  src={cat.image} 
                  alt={cat.name}
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
              <span className="text-xs md:text-sm font-semibold text-foreground text-center leading-tight line-clamp-2 max-w-[80px] group-hover:text-[#2196F3] transition-colors">
                {cat.name}
              </span>
            </Link>
          ))}
        </div>
        
        {/* Add to Cart Button */}
        <div className="mt-6 text-center">
          <Link href="/cart">
            <Button size="lg" className="bg-[#2196F3] hover:bg-[#1976D2] text-white px-8 rounded-full shadow-lg gap-2">
              <ShoppingCart className="h-5 w-5" />
              إضافة إلى السلة
            </Button>
          </Link>
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
          {dynamicOffers && dynamicOffers.length > 0 ? (
            dynamicOffers.map((offer) => {
              const colors = bgColorClasses[offer.bgColor || 'blue'] || bgColorClasses.blue;
              return (
                <Link key={offer.id} href={offer.linkUrl || "/products"}>
                  <div className={`${colors.bg} rounded-xl p-4 relative overflow-hidden hover:scale-[1.02] transition-transform`} data-testid={`offer-${offer.id}`}>
                    <span className={`text-3xl font-extrabold ${colors.text}`}>{offer.discountPercent}%</span>
                    <p className="text-sm font-bold text-foreground mt-1">{offer.title}</p>
                  </div>
                </Link>
              );
            })
          ) : (
            <>
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
            </>
          )}
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
        
        {isBestsellingLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-72 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {bestselling?.map((product: any) => (
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
