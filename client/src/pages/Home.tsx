import { useProducts, useCategories } from "@/hooks/use-products";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, Package, Box, ShieldCheck, Truck, Sparkles, Percent, Star } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import premiumBags from "@assets/generated_images/premium_packaging_banner_wide.png";
import foodBags from "@assets/generated_images/wholesale_containers_banner_wide.png";
import ecoBags from "@assets/generated_images/eco-friendly_packaging_banner.png";
import containerOffer from "@assets/generated_images/plastic_containers_product_photo.png";
import bagOffer from "@assets/generated_images/paper_cups_product_photo.png";
import fabricBagsIcon from "@assets/generated_images/fabric_bags_category_icon.png";
import printingIcon from "@assets/generated_images/printing_design_category_icon.png";
import commercialBagsIcon from "@assets/generated_images/commercial_bags_category_icon.png";
import carrierBagsIcon from "@assets/generated_images/printed_carrier_bags_icon.png";
import hangingBagsIcon from "@assets/generated_images/hanging_bags_category_icon.png";
import garbageBagsIcon from "@assets/generated_images/garbage_food_bags_icon.png";
import packagingBoxesIcon from "@assets/generated_images/packaging_boxes_category_icon.png";
import spicesNutsIcon from "@assets/generated_images/spices_nuts_bags_icon.png";

export default function Home() {
  const { data: products, isLoading } = useProducts();
  const { data: categories } = useCategories();

  const categoryCircles = [
    { id: 5, name: "أكياس قماشية", icon: fabricBagsIcon, slug: "fabric-bags" },
    { id: 6, name: "طباعة وتصميم", icon: printingIcon, slug: "printing-design" },
    { id: 7, name: "أكياس دعاية", icon: commercialBagsIcon, slug: "commercial-bags" },
    { id: 8, name: "شيال مطبوع", icon: carrierBagsIcon, slug: "printed-carrier-bags" },
    { id: 9, name: "أكياس علاقي", icon: hangingBagsIcon, slug: "hanging-bags" },
    { id: 10, name: "نفايات وسفر", icon: garbageBagsIcon, slug: "garbage-food-bags" },
    { id: 11, name: "علب تغليف", icon: packagingBoxesIcon, slug: "packaging-boxes" },
    { id: 12, name: "بهارات ومكسرات", icon: spicesNutsIcon, slug: "spices-nuts-bags" },
  ];

  const offers = [
    {
      image: containerOffer,
      title: "خصم الجملة",
      discount: "15%",
      desc: "على جميع علب البلاستيك",
      bgColor: "bg-blue-50",
      textColor: "text-blue-600"
    },
    {
      image: bagOffer,
      title: "عروض الأكياس",
      discount: "10%",
      desc: "عند طلب أكثر من 10 شدات",
      bgColor: "bg-pink-50",
      textColor: "text-pink-600"
    }
  ];

  const carouselItems = [
    {
      image: premiumBags,
      title: "حلول التغليف الذكية",
      subtitle: "أكياس تسوق راقية لجميع احتياجاتك",
    },
    {
      image: foodBags,
      title: "حفظ أطول للطعام",
      subtitle: "أكياس حفظ الأطعمة بجودة عالية",
    },
    {
      image: ecoBags,
      title: "صديقة للبيئة",
      subtitle: "خيارات مستدامة وعصرية",
    },
  ];

  // Show only first 8 products for featured section
  const featuredProducts = products?.slice(0, 8);

  return (
    <div className="flex flex-col gap-8 pb-20">
      {/* Category Circles - SHEIN Style */}
      <section className="bg-white py-4 border-b">
        <div className="container mx-auto px-4">
          <div className="flex justify-around items-center gap-2 overflow-x-auto pb-2">
            {categoryCircles.map((cat) => (
              <Link 
                key={cat.id} 
                href={`/products?category=${cat.id}`}
                className="flex flex-col items-center gap-2 min-w-[72px]"
              >
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-2 border-primary/20 shadow-md hover:border-primary hover:scale-105 transition-all duration-300 bg-gradient-to-br from-blue-50 to-white p-1">
                  <img 
                    src={cat.icon} 
                    alt={cat.name}
                    className="w-full h-full object-cover rounded-full"
                  />
                </div>
                <span className="text-xs md:text-sm font-bold text-foreground text-center">{cat.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Image Carousel */}
      <section className="container mx-auto px-4 pt-4">
        <Carousel
          opts={{
            align: "start",
            loop: true,
          }}
          className="w-full relative group"
        >
          <CarouselContent>
            {carouselItems.map((item, index) => (
              <CarouselItem key={index}>
                <div className="relative aspect-[21/9] overflow-hidden rounded-2xl md:rounded-3xl border shadow-lg">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/30 flex flex-col justify-center px-8 md:px-16 text-right">
                    <h2 className="text-2xl md:text-5xl font-extrabold text-white mb-2 md:mb-4 drop-shadow-lg">
                      {item.title}
                    </h2>
                    <p className="text-lg md:text-2xl text-white/90 font-medium drop-shadow-md">
                      {item.subtitle}
                    </p>
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white border-none" />
          <CarouselNext className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white border-none" />
        </Carousel>
      </section>

      {/* Flash Offers - SHEIN Style */}
      <section className="container mx-auto px-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="bg-red-500 text-white px-3 py-1 rounded-full flex items-center gap-1">
            <Percent className="h-4 w-4" />
            <span className="text-sm font-bold">عروض خاصة</span>
          </div>
          <div className="flex-1 h-[1px] bg-gradient-to-l from-transparent to-red-200"></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {offers.map((offer, i) => (
            <Link key={i} href="/products">
              <div className={`${offer.bgColor} rounded-xl p-4 relative overflow-hidden hover:scale-[1.02] transition-transform`}>
                <div className="relative z-10">
                  <span className={`text-3xl md:text-4xl font-extrabold ${offer.textColor}`}>{offer.discount}</span>
                  <p className="text-sm md:text-base font-bold text-foreground mt-1">{offer.title}</p>
                  <p className="text-xs text-muted-foreground">{offer.desc}</p>
                </div>
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-20 h-20 opacity-20">
                  <img src={offer.image} alt="" className="w-full h-full object-contain" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Features Strip - Compact */}
      <section className="container mx-auto px-4">
        <div className="flex overflow-x-auto gap-4 pb-2 -mx-4 px-4">
          {[
            { icon: Box, title: "تشكيلة واسعة" },
            { icon: ShieldCheck, title: "جودة مضمونة" },
            { icon: Truck, title: "توصيل سريع" },
            { icon: Star, title: "أسعار منافسة" }
          ].map((feature, i) => (
            <div key={i} className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border shadow-sm whitespace-nowrap min-w-fit">
              <feature.icon className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold">{feature.title}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Trending Section Header */}
      <section className="container mx-auto px-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="bg-primary text-white px-3 py-1 rounded-full flex items-center gap-1">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-bold">الأكثر مبيعاً</span>
          </div>
          <div className="flex-1 h-[1px] bg-gradient-to-l from-transparent to-primary/30"></div>
          <Link href="/products">
            <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 gap-1">
              عرض الكل <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Featured Products Grid */}
      <section className="container mx-auto px-4">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-72 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {featuredProducts?.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
        
        <div className="mt-8 text-center">
          <Link href="/products">
            <Button size="lg" variant="outline" className="px-10 rounded-full border-2">
              تصفح جميع المنتجات
              <ArrowLeft className="mr-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
