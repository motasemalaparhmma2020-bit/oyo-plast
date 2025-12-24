import { useProducts, useCategories } from "@/hooks/use-products";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Package, Box, ShieldCheck, Truck } from "lucide-react";

export default function Home() {
  const { data: products, isLoading } = useProducts();
  const { data: categories } = useCategories();

  // Show only first 8 products for featured section
  const featuredProducts = products?.slice(0, 8);

  return (
    <div className="flex flex-col gap-12 pb-20">
      {/* Welcome Banner */}
      <section className="relative overflow-hidden bg-gradient-to-r from-primary via-blue-500 to-primary py-8 lg:py-10">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h2 className="text-3xl lg:text-4xl font-extrabold text-white drop-shadow-lg">
              أويو بلاست - حلول التغليف المتكاملة في اليمن
            </h2>
            <p className="text-white/90 text-lg mt-2 font-medium drop-shadow-md">
              خدمة متوفرة فقط في الجمهورية اليمنية
            </p>
          </div>
        </div>
      </section>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-primary/5 py-20 lg:py-32">
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-right space-y-6">
              <h1 className="text-4xl lg:text-6xl font-extrabold text-foreground leading-tight tracking-tight">
                أفضل حلول التغليف <br />
                <span className="text-primary">لمشروعك التجاري</span>
              </h1>
              <p className="text-lg lg:text-xl text-muted-foreground max-w-xl">
                نوفر لك جميع مستلزمات التغليف البلاستيكية والورقية ومواد النظافة بأفضل الأسعار وبجودة عالية.
              </p>
              <div className="flex flex-wrap gap-4 pt-4">
                <Link href="/products">
                  <Button size="lg" className="text-lg px-8 h-14 rounded-full shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
                    تسوق الآن
                    <ArrowLeft className="mr-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/about">
                  <Button size="lg" variant="outline" className="text-lg px-8 h-14 rounded-full border-2">
                    اعرف المزيد
                  </Button>
                </Link>
              </div>
            </div>
            
            <div className="relative hidden lg:block">
              <div className="absolute -inset-4 bg-gradient-to-tr from-primary/20 to-accent/20 rounded-full blur-3xl opacity-50"></div>
              {/* Unsplash image for Hero - Packaging boxes */}
              <img 
                src="https://images.unsplash.com/photo-1605623081914-9964523c14f5?w=800&auto=format&fit=crop&q=80"
                alt="Packaging Boxes"
                className="relative rounded-3xl shadow-2xl rotate-[-2deg] hover:rotate-0 transition-transform duration-500 border-4 border-white"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4">
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: Box, title: "تشكيلة واسعة", desc: "أكثر من 1000 منتج متنوع يناسب جميع الاحتياجات" },
            { icon: ShieldCheck, title: "جودة مضمونة", desc: "منتجات عالية الجودة من أفضل المصانع المحلية والعالمية" },
            { icon: Truck, title: "توصيل سريع", desc: "شحن سريع وآمن لجميع مناطق المملكة" }
          ].map((feature, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border hover:shadow-md transition-shadow flex items-start gap-4">
              <div className="bg-primary/10 p-3 rounded-xl text-primary">
                <feature.icon className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories Section */}
      <section className="container mx-auto px-4">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-3xl font-bold text-foreground">الأقسام الرئيسية</h2>
            <p className="text-muted-foreground mt-2">تصفح المنتجات حسب التصنيف</p>
          </div>
          <Link href="/products">
            <Button variant="ghost" className="text-primary hover:text-primary/80 gap-2">
              عرض الكل <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
          {categories?.map((category) => (
            <Link key={category.id} href={`/products?category=${category.id}`}>
              <div className="group cursor-pointer">
                <div className="aspect-[4/3] rounded-2xl overflow-hidden mb-4 border bg-gray-50 relative">
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors z-10" />
                  <img 
                    src={category.imageUrl} 
                    alt={category.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                </div>
                <h3 className="text-center font-bold text-lg group-hover:text-primary transition-colors">
                  {category.name}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Products */}
      <section className="container mx-auto px-4">
        <div className="flex justify-between items-end mb-10">
          <div>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground">أحدث المنتجات</h2>
            <p className="text-muted-foreground mt-2 font-medium">اختر من أفضل تشكيلتنا المتنوعة</p>
          </div>
          <Link href="/products">
            <Button variant="ghost" className="text-primary hover:text-primary/80 font-bold text-base gap-2 hidden md:flex">
              عرض الكل <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
        </div>
        
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-80 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
            {featuredProducts?.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
        
        <div className="mt-12 text-center">
          <Link href="/products">
            <Button size="lg" variant="outline" className="px-12 rounded-full border-2 text-lg h-12">
              تصفح جميع المنتجات
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
