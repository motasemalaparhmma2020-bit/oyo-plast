import { Product } from "@shared/schema";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAddToCart } from "@/hooks/use-cart";
import { ShoppingCart, Loader2, Eye } from "lucide-react";
import { useState, useEffect } from "react";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { mutate: addToCart, isPending } = useAddToCart();
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
    return Number(price).toLocaleString('ar-YE');
  };

  return (
    <Card className="group overflow-hidden border-none shadow-md hover:shadow-2xl transition-all duration-300 rounded-2xl bg-white flex flex-col h-full" data-testid={`card-product-${product.id}`}>
      <Link href={`/product/${product.id}`}>
        <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 p-3 md:p-4 cursor-pointer">
          <img 
            src={product.imageUrl} 
            alt={product.name}
            className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
          />
          {product.stock <= 0 && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center">
              <Badge variant="destructive" className="text-xs md:text-sm px-3 py-1">نفذت الكمية</Badge>
            </div>
          )}
          <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="icon" variant="secondary" className="rounded-full h-8 w-8">
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Link>
      
      <CardContent className="p-3 md:p-4 flex-grow">
        <Link href={`/product/${product.id}`}>
          <h3 className="font-extrabold text-sm md:text-base mb-3 text-foreground line-clamp-2 leading-tight min-h-[2.5rem] cursor-pointer hover:text-primary transition-colors">
            {product.name}
          </h3>
        </Link>
        
        <div className="space-y-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-xl md:text-2xl font-extrabold text-primary">
              {formatPrice(currency === 'SAR' ? product.priceSar : product.price)}
            </span>
            <span className="text-xs md:text-sm font-medium text-muted-foreground">
              {currency === 'YER' ? 'ر.ي' : 'ر.س'}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {currency === 'YER' && product.priceSar && (
              <span className="bg-gray-100 px-2 py-0.5 rounded-full">
                {formatPrice(product.priceSar)} ر.س
              </span>
            )}
            {currency === 'SAR' && (
              <span className="bg-gray-100 px-2 py-0.5 rounded-full">
                {formatPrice(product.price)} ر.ي
              </span>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-3 md:p-4 pt-0">
        <Button 
          className="w-full gap-2 font-extrabold shadow-md shadow-primary/20 text-sm md:text-base h-10 md:h-11 rounded-lg md:rounded-xl"
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
      </CardFooter>
    </Card>
  );
}
