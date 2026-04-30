import { Product } from "@shared/schema";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAddToCart } from "@/hooks/use-cart";
import { useCompare } from "@/hooks/use-compare";
import { ShoppingCart, Loader2, Eye, Star, GitCompare, Check } from "lucide-react";
import { useState, useEffect } from "react";

interface ProductCardProps {
  product: Product;
  cardWidth?: number;
  imageHeight?: number;
  /** Override for banner mode: explicit px sizes */
  bannerNameFontSize?: number;
  bannerPriceFontSize?: number;
}

export function ProductCard({ product, cardWidth, imageHeight, bannerNameFontSize, bannerPriceFontSize }: ProductCardProps) {
  const { mutate: addToCart, isPending } = useAddToCart();
  const { addToCompare, removeFromCompare, isInCompare, isFull } = useCompare();
  const inCompare = isInCompare(product.id);
  const [currency, setCurrency] = useState<'YER' | 'SAR'>(() => {
    return (localStorage.getItem('currency') as 'YER' | 'SAR') || 'YER';
  });

  useEffect(() => {
    const handleCurrencyChange = () => {
      setCurrency((localStorage.getItem('currency') as 'YER' | 'SAR') || 'YER');
    };
    window.addEventListener('currencyChange', handleCurrencyChange);
    return () => window.removeEventListener('currencyChange', handleCurrencyChange);
  }, []);

  const formatPrice = (price: string | null | undefined) => {
    if (!price) return '0';
    return Number(price).toLocaleString('en-US');
  };

  // حساب الخصم الفعلي: effectiveDiscount من الباكند أو من bulkPricing
  const effectiveDiscount: number = (product as any).effectiveDiscount ?? 0;

  // السعر الأصلي (قبل الخصم)
  const originalPrice: string | null = (product as any).originalPrice ?? null;
  const originalPriceSar: string | null = (product as any).originalPriceSar ?? null;
  const showOriginalPrice = originalPrice && Number(originalPrice) > Number(product.price);
  const showOriginalPriceSar = originalPriceSar && product.priceSar && Number(originalPriceSar) > Number(product.priceSar);

  // لون بادج الخصم من CSS variable (يُطبَّق مباشرةً في الـ style)
  const discountBadgeBg = 'var(--discount-badge-bg, #ef4444)';

  return (
    <Card
      className="group overflow-hidden border-none shadow-md hover:shadow-2xl transition-all duration-300 bg-white dark:bg-gray-900 flex flex-col h-full"
      data-testid={`card-product-${product.id}`}
      style={{
        minWidth: cardWidth ? `${cardWidth}px` : 'var(--card-width, auto)',
        maxWidth: cardWidth ? `${cardWidth}px` : 'var(--card-width, none)',
        borderRadius: 'var(--card-border-radius, 16px)',
      }}
    >
      <Link href={`/product/${product.id}`}>
        <div
          className="product-card-img-bg relative overflow-hidden cursor-pointer flex items-center justify-center flex-shrink-0"
          style={{
            aspectRatio: '1 / 1',
            padding: 'var(--card-margin, 8px)',
            borderRadius: 'var(--card-border-radius, 16px) var(--card-border-radius, 16px) 0 0',
          }}
        >
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
            style={{ borderRadius: 'calc(var(--card-border-radius, 16px) - var(--card-margin, 8px))' }}
          />
          {product.stock <= 0 && (
            <div className="absolute inset-0 bg-white/70 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center">
              <Badge variant="destructive" className="text-xs px-3 py-1">نفذت الكمية</Badge>
            </div>
          )}

          {/* ── فقاعة الخصم — حجم أصغر وأقل تداخلاً مع الصورة ── */}
          {effectiveDiscount > 0 && (
            <div
              className="absolute top-1.5 right-1.5 text-white font-bold rounded-xl flex items-center justify-center shadow-sm px-1.5 py-0.5"
              style={{
                fontSize: '10px',
                lineHeight: 1,
                display: 'var(--discount-bubble-display, flex)',
                backgroundColor: discountBadgeBg || '#ef4444',
                minWidth: '28px',
              }}
              data-testid={`badge-discount-${product.id}`}
            >
              -{effectiveDiscount}%
            </div>
          )}

          <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="icon" variant="secondary" className="rounded-full h-8 w-8">
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Link>

      <CardContent
        className="flex-grow relative z-10 bg-white dark:bg-gray-900"
        style={{ padding: 'var(--card-padding-v, 8px) 8px' }}
      >
        <Link href={`/product/${product.id}`}>
          <h3
            className="font-extrabold mb-1 text-foreground line-clamp-2 leading-tight min-h-[2rem] cursor-pointer hover:text-primary transition-colors"
            style={{ fontSize: bannerNameFontSize ? `${bannerNameFontSize}px` : 'var(--card-name-font-size, 0.75rem)' }}
          >
            {product.name}
          </h3>
        </Link>

        {/* النجوم */}
        {product.rating && (
          <div className="flex items-center gap-1 mb-1">
            <div className="flex items-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-2 w-2 ${
                    star <= Math.floor(Number(product.rating))
                      ? 'text-yellow-400 fill-yellow-400'
                      : star - 0.5 <= Number(product.rating)
                        ? 'text-yellow-400 fill-yellow-400/50'
                        : 'text-gray-300'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">({product.reviewCount || 0})</span>
          </div>
        )}

        <div className="space-y-0.5">
          <div className="flex items-baseline gap-1 flex-wrap">
            <span
              className={`font-extrabold price-num ${
                (currency === 'YER' && showOriginalPrice) || (currency === 'SAR' && showOriginalPriceSar)
                  ? 'text-red-600 dark:text-red-500'
                  : 'text-gray-900 dark:text-white'
              }`}
              style={{ fontSize: bannerPriceFontSize ? `${bannerPriceFontSize}px` : 'var(--price-font-size, 16px)', fontFamily: 'var(--font-numbers)' }}
              data-testid={`price-${product.id}`}
              data-price="true"
            >
              {formatPrice(currency === 'SAR' ? product.priceSar : product.price)}
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              {currency === 'YER' ? 'ر.ي' : 'ر.س'}
            </span>
            {/* السعر الأصلي مشطوب */}
            {currency === 'YER' && showOriginalPrice && (
              <span className="text-xs line-through text-gray-400 price-num" data-price="true" data-testid={`original-price-${product.id}`} style={{ fontFamily: 'var(--font-numbers)' }}>
                {formatPrice(originalPrice)} ر.ي
              </span>
            )}
            {currency === 'SAR' && showOriginalPriceSar && (
              <span className="text-xs line-through text-gray-400 price-num" data-price="true" style={{ fontFamily: 'var(--font-numbers)' }}>
                {formatPrice(originalPriceSar)} ر.س
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {currency === 'YER' && product.priceSar && !showOriginalPriceSar && (
              <span className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs">
                {formatPrice(product.priceSar)} ر.س
              </span>
            )}
            {currency === 'SAR' && !showOriginalPrice && (
              <span className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs">
                {formatPrice(product.price)} ر.ي
              </span>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-2 pt-0 flex gap-1.5 relative z-10 bg-white dark:bg-gray-900">
        <Button
          className="flex-1 gap-1.5 font-bold shadow-md shadow-primary/20 text-xs rounded-lg"
          style={{ height: 'var(--qty-btn-height, 40px)' }}
          disabled={product.stock <= 0 || isPending}
          onClick={(e) => {
            e.preventDefault();
            addToCart({ productId: product.id, quantity: 1 });
          }}
          data-testid={`button-add-to-cart-${product.id}`}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShoppingCart className="h-4 w-4" />
          )}
          {product.stock <= 0 ? "غير متوفر" : "أضف للسلة"}
        </Button>
        <Button
          variant={inCompare ? "default" : "outline"}
          size="icon"
          className={`rounded-lg flex-shrink-0 ${inCompare ? "bg-green-600 hover:bg-green-700 border-green-600" : ""}`}
          style={{ height: 'var(--qty-btn-height, 40px)', width: 'var(--qty-btn-height, 40px)' }}
          onClick={(e) => {
            e.preventDefault();
            inCompare ? removeFromCompare(product.id) : addToCompare(product);
          }}
          disabled={!inCompare && isFull}
          title={inCompare ? "إزالة من المقارنة" : isFull ? "المقارنة ممتلئة (3 منتجات)" : "أضف للمقارنة"}
          data-testid={`button-compare-${product.id}`}
        >
          {inCompare ? <Check className="h-4 w-4" /> : <GitCompare className="h-4 w-4" />}
        </Button>
      </CardFooter>
    </Card>
  );
}
