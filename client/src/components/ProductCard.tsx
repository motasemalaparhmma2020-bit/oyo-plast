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

export function ProductCard({ product }: ProductCardProps) {
  const { mutate: addToCart, isPending } = useAddToCart();

  return (
    <Card className="group overflow-hidden border-none shadow-sm hover:shadow-xl transition-all duration-300 rounded-xl bg-white flex flex-col h-full">
      <div className="relative aspect-square overflow-hidden bg-gray-50 p-4">
        {/* Unsplash image with fallback */}
        <img 
          src={product.imageUrl} 
          alt={product.name}
          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
        />
        {product.stock <= 0 && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center">
            <Badge variant="destructive" className="text-sm px-3 py-1">نفذت الكمية</Badge>
          </div>
        )}
      </div>
      
      <CardContent className="p-4 flex-grow">
        <h3 className="font-bold text-lg mb-2 text-foreground line-clamp-2 leading-tight min-h-[3rem]">
          {product.name}
        </h3>
        <p className="text-2xl font-bold text-primary mb-1 font-display">
          {Number(product.price).toFixed(2)} <span className="text-sm font-normal text-muted-foreground">ريال</span>
        </p>
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <Button 
          className="w-full gap-2 font-bold shadow-md shadow-primary/10"
          disabled={product.stock <= 0 || isPending}
          onClick={() => addToCart({ productId: product.id, quantity: 1 })}
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
