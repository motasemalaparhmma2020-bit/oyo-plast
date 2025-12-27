import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heart, Trash2, ShoppingCart, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Product, WishlistItem } from "@shared/schema";

export default function Wishlist() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: wishlistItems = [], isLoading } = useQuery<(WishlistItem & { product: Product })[]>({
    queryKey: ["/api/wishlist"],
    enabled: isAuthenticated,
  });

  const removeFromWishlist = useMutation({
    mutationFn: async (productId: number) => {
      await apiRequest("DELETE", `/api/wishlist/${productId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wishlist"] });
      toast({
        title: "تمت الإزالة",
        description: "تم إزالة المنتج من المفضلة",
      });
    },
  });

  const addToCart = useMutation({
    mutationFn: async (productId: number) => {
      await apiRequest("POST", "/api/cart", { productId, quantity: 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({
        title: "تمت الإضافة",
        description: "تم إضافة المنتج إلى السلة",
      });
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <Heart className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold mb-2">قائمة المفضلة</h2>
        <p className="text-muted-foreground mb-4">يرجى تسجيل الدخول لعرض المفضلة</p>
        <Link href="/auth">
          <Button className="bg-[#2196F3] hover:bg-[#1976D2]" data-testid="button-login-wishlist">
            تسجيل الدخول
          </Button>
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2196F3]"></div>
      </div>
    );
  }

  if (wishlistItems.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <Heart className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold mb-2">قائمة المفضلة فارغة</h2>
        <p className="text-muted-foreground mb-4">لم تقم بإضافة أي منتجات للمفضلة بعد</p>
        <Link href="/products">
          <Button className="bg-[#2196F3] hover:bg-[#1976D2]" data-testid="button-browse-products">
            تصفح المنتجات
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Heart className="h-6 w-6 text-[#2196F3]" />
          <h1 className="text-2xl font-bold">المفضلة</h1>
          <span className="text-muted-foreground">({wishlistItems.length} منتج)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {wishlistItems.map((item) => (
            <Card key={item.id} className="flex gap-4 p-4" data-testid={`wishlist-item-${item.productId}`}>
              <Link href={`/product/${item.productId}`}>
                <img
                  src={item.product.imageUrl}
                  alt={item.product.name}
                  className="w-24 h-24 object-cover rounded-lg"
                />
              </Link>
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <Link href={`/product/${item.productId}`}>
                    <h3 className="font-semibold hover:text-[#2196F3] transition-colors">
                      {item.product.name}
                    </h3>
                  </Link>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-lg font-bold text-[#2196F3]">
                      {Number(item.product.price).toLocaleString()} ر.ي
                    </span>
                    {item.product.priceSar && (
                      <span className="text-sm text-muted-foreground">
                        ({Number(item.product.priceSar).toLocaleString()} ر.س)
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-[#2196F3] hover:bg-[#1976D2]"
                    onClick={() => addToCart.mutate(item.productId)}
                    disabled={addToCart.isPending}
                    data-testid={`button-add-to-cart-${item.productId}`}
                  >
                    <ShoppingCart className="h-4 w-4 ml-1" />
                    أضف للسلة
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => removeFromWishlist.mutate(item.productId)}
                    disabled={removeFromWishlist.isPending}
                    data-testid={`button-remove-wishlist-${item.productId}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-6 text-center">
          <Link href="/products">
            <Button variant="outline" className="gap-2" data-testid="button-continue-shopping">
              <ArrowRight className="h-4 w-4" />
              متابعة التسوق
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
