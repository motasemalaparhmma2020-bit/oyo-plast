import { useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Gift, ArrowRight, Package } from "lucide-react";

function formatPrice(p: number | string) {
  return Number(p).toLocaleString("ar-YE");
}

export default function ReferralLanding() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/r/:code");
  const code = match ? params?.code?.toUpperCase() : null;

  const { data: coupon, isLoading: couponLoading } = useQuery<any>({
    queryKey: ["/api/coupons/validate", code],
    queryFn: async () => {
      if (!code) return null;
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!code,
    retry: false,
  });

  const { data: products = [], isLoading: productsLoading } = useQuery<any[]>({
    queryKey: ["/api/products"],
    staleTime: 300000,
  });

  // حفظ كود الإحالة تلقائياً ليُطبَّق عند الدفع
  useEffect(() => {
    if (code) localStorage.setItem("referralCode", code);
  }, [code]);

  const isLoading = couponLoading || productsLoading;
  const discount = coupon?.discountPercent || coupon?.discount_percent || 0;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary to-primary/80 text-white">
        <div className="max-w-2xl mx-auto px-4 py-10 text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-1.5 mb-4">
            <Gift className="h-4 w-4" />
            <span className="text-sm font-medium">دعوة من صديق</span>
          </div>

          {coupon && discount > 0 ? (
            <>
              <h1 className="text-3xl font-bold mb-2">خصم {discount}% على أول طلب لك</h1>
              <p className="text-white/80 text-sm mb-4">هدية ترحيب من صديقك في أويو بلاست</p>
              <div className="inline-flex items-center gap-2 bg-white text-primary rounded-xl px-6 py-3 shadow-lg">
                <Gift className="h-5 w-5" />
                <span className="text-xl font-black tracking-widest">{code}</span>
              </div>
              <p className="text-white/70 text-xs mt-3">الخصم محفوظ تلقائياً — سيُطبَّق عند الدفع</p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold mb-2">أويو بلاست</h1>
              <p className="text-white/80">تسوق الآن بأفضل الأسعار</p>
            </>
          )}

          <Button
            onClick={() => navigate("/products")}
            className="mt-6 bg-white text-primary hover:bg-white/90 font-bold px-8"
            size="lg"
            data-testid="button-shop-all"
          >
            تسوق الآن
            <ArrowRight className="h-4 w-4 mr-2" />
          </Button>
        </div>
      </div>

      {/* المنتجات */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold">المنتجات المتاحة</h2>
          {coupon && discount > 0 && (
            <Badge className="bg-green-100 text-green-700 border-green-200">
              وفّر {discount}% على أول طلب
            </Badge>
          )}
        </div>

        {products.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>لا توجد منتجات متاحة حالياً</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product: any) => {
              const price = Number(product.price);
              const discountedPrice = coupon && discount > 0
                ? Math.round(price * (1 - discount / 100))
                : price;

              return (
                <Card
                  key={product.id}
                  className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
                  onClick={() => navigate(`/products/${product.id}`)}
                  data-testid={`card-product-${product.id}`}
                >
                  <div className="aspect-square bg-gray-50 overflow-hidden">
                    {product.imageUrl || (product.imageUrls && product.imageUrls[0]) ? (
                      <img
                        src={product.imageUrl || product.imageUrls[0]}
                        alt={product.name}
                        className="w-full h-full object-cover hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-8 w-8 text-gray-300" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-3">
                    <p className="text-sm font-medium truncate mb-1">{product.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-primary text-sm">{formatPrice(discountedPrice)} ر.ي</span>
                      {coupon && discount > 0 && (
                        <span className="text-xs text-gray-400 line-through">{formatPrice(price)}</span>
                      )}
                    </div>
                    {coupon && discount > 0 && (
                      <Badge className="mt-1 text-xs bg-red-100 text-red-600 border-0">
                        خصم {discount}%
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div className="text-center py-8 text-gray-400 text-sm">
        <p>أويو بلاست — مستلزمات التغليف</p>
        <button onClick={() => navigate("/")} className="text-primary hover:underline mt-1">
          زيارة الموقع الرسمي
        </button>
      </div>
    </div>
  );
}
