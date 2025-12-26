import { Product } from "@shared/schema";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAddToCart } from "@/hooks/use-cart";
import { ShoppingCart, Loader2 } from "lucide-react";

interface ProductCardProps {
  product: Product;
}

import { useState, useEffect } from "react";

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

  const displayPrice = currency === 'SAR' && product.priceSar 
    ? product.priceSar 
    : product.price;

  return (
    <Card className="group overflow-hidden border-none shadow-md hover:shadow-2xl transition-all duration-300 rounded-2xl bg-white flex flex-col h-full">
      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 p-3 md:p-4">
        {/* Unsplash image with fallback */}
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
      </div>
      
      <CardContent className="p-3 md:p-4 flex-grow">
        <h3 className="font-extrabold text-sm md:text-base mb-2 text-foreground line-clamp-2 leading-tight min-h-[2.5rem]">
          {product.name}
        </h3>
        <p className="text-xl md:text-2xl font-extrabold text-primary mb-1 font-display">
          {Number(displayPrice).toFixed(0)} <span className="text-xs md:text-sm font-normal text-muted-foreground">{currency === 'YER' ? 'ريال' : 'ر.س'}</span>
        </p>
      </CardContent>

      <CardFooter className="p-3 md:p-4 pt-0">
        <Button 
          className="w-full gap-2 font-extrabold shadow-md shadow-primary/20 text-sm md:text-base h-10 md:h-11 rounded-lg md:rounded-xl"
          disabled={product.stock <= 0 || isPending}
          onClick={() => addToCart({ productId: product.id, quantity: 1 })}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShoppingCart className="h-4 w-4" />
          )}
          {product.stock <= 0 ? "غير متوفر" : "أضف"}
        </Button>
      </CardFooter>
    </Card>
  );
}
