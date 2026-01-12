import { useCart, useUpdateCartItem, useRemoveFromCart } from "@/hooks/use-cart";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Trash2, Plus, Minus, ArrowLeft, ShoppingBag, Loader2, UserPlus } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect, useMemo } from "react";
import type { Product } from "@shared/schema";

interface GuestCartItem {
  productId: number;
  quantity: number;
  selectedSize?: string;
  selectedColor?: string;
  customPrinting?: boolean;
  designNotes?: string;
  designFileUrl?: string;
}

function getGuestCart(): GuestCartItem[] {
  try {
    const saved = localStorage.getItem('guestCart');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function setGuestCart(cart: GuestCartItem[]): void {
  localStorage.setItem('guestCart', JSON.stringify(cart));
}

export default function Cart() {
  const { isAuthenticated } = useAuth();
  const { data: cartItems, isLoading } = useCart();
  const { mutate: updateItem } = useUpdateCartItem();
  const { mutate: removeItem } = useRemoveFromCart();
  
  const [guestCart, setGuestCartState] = useState<GuestCartItem[]>(() => getGuestCart());
  
  const [currency, setCurrency] = useState<'YER' | 'SAR'>(() => {
    return (localStorage.getItem('currency') as 'YER' | 'SAR') || 'YER';
  });

  // Fetch all products for guest cart
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: !isAuthenticated || guestCart.length > 0,
  });

  // Map guest cart items with product details
  const guestCartWithProducts = useMemo(() => {
    return guestCart.map(item => {
      const product = products.find(p => p.id === item.productId);
      return { ...item, product };
    }).filter(item => item.product);
  }, [guestCart, products]);

  // Sync guest cart with localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      setGuestCartState(getGuestCart());
    };
    window.addEventListener('storage', handleStorageChange);
    // Check periodically for changes
    const interval = setInterval(() => {
      const current = getGuestCart();
      if (JSON.stringify(current) !== JSON.stringify(guestCart)) {
        setGuestCartState(current);
      }
    }, 1000);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [guestCart]);

  useEffect(() => {
    const handleCurrencyChange = () => {
      setCurrency((localStorage.getItem('currency') as 'YER' | 'SAR') || 'YER');
    };
    window.addEventListener('currencyChange', handleCurrencyChange);
    return () => window.removeEventListener('currencyChange', handleCurrencyChange);
  }, []);

  const formatPrice = (price: number) => {
    return price.toLocaleString('ar-YE');
  };

  // Guest cart functions - use index for proper targeting with size/color variants
  const updateGuestQuantity = (index: number, delta: number) => {
    const updated = guestCart.map((item, i) => {
      if (i === index) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    });
    setGuestCart(updated);
    setGuestCartState(updated);
  };

  const removeGuestItem = (index: number) => {
    const updated = guestCart.filter((_, i) => i !== index);
    setGuestCart(updated);
    setGuestCartState(updated);
  };

  // Show guest cart if not authenticated
  if (!isAuthenticated) {
    const guestSubtotal = guestCartWithProducts.reduce((acc, item) => {
      if (!item.product) return acc;
      const price = currency === 'SAR' && item.product.priceSar 
        ? Number(item.product.priceSar) 
        : Number(item.product.price);
      return acc + (price * item.quantity);
    }, 0);

    if (guestCart.length === 0) {
      return (
        <div className="container mx-auto px-4 py-20 text-center max-w-md">
          <div className="bg-primary/5 p-8 rounded-full w-fit mx-auto mb-6">
            <ShoppingBag className="h-16 w-16 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-4">سلة التسوق فارغة</h1>
          <p className="text-muted-foreground mb-8 text-lg">
            لم تقم بإضافة أي منتجات للسلة بعد. تصفح منتجاتنا المميزة وابدأ التسوق!
          </p>
          <Link href="/products">
            <Button size="lg" className="rounded-full px-8 text-lg h-14" data-testid="button-browse-products">
              تصفح المنتجات
            </Button>
          </Link>
        </div>
      );
    }

    return (
      <div className="container mx-auto px-4 py-8 pb-20">
        <h1 className="text-3xl font-bold mb-8">سلة التسوق ({guestCart.length} منتجات)</h1>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {guestCartWithProducts.map((item, index) => (
              <div key={`${item.productId}-${item.selectedSize}-${item.selectedColor}-${index}`} className="bg-white dark:bg-card p-4 rounded-xl shadow-sm border flex flex-col sm:flex-row gap-4 items-center">
                <div className="w-24 h-24 bg-gray-50 dark:bg-muted rounded-lg overflow-hidden shrink-0">
                  <img 
                    src={item.product?.imageUrl || ''} 
                    alt={item.product?.name || ''} 
                    className="w-full h-full object-contain"
                  />
                </div>
                
                <div className="flex-grow text-center sm:text-right">
                  <h3 className="font-bold text-lg mb-1">{item.product?.name}</h3>
                  {(item.selectedSize || item.selectedColor) && (
                    <div className="flex flex-wrap gap-2 justify-center sm:justify-start mb-2">
                      {item.selectedSize && (
                        <span className="text-xs bg-muted px-2 py-1 rounded">الحجم: {item.selectedSize}</span>
                      )}
                      {item.selectedColor && (
                        <span className="text-xs bg-muted px-2 py-1 rounded flex items-center gap-1">
                          اللون: 
                          <span 
                            className="w-4 h-4 rounded-full border inline-block" 
                            style={{ backgroundColor: item.selectedColor }}
                          />
                        </span>
                      )}
                    </div>
                  )}
                  {item.customPrinting && (
                    <span className="text-xs bg-[#2196F3]/10 text-[#2196F3] px-2 py-1 rounded">طباعة مخصصة</span>
                  )}
                  <p className="text-primary font-bold mt-1">
                    {formatPrice(currency === 'SAR' && item.product?.priceSar 
                      ? Number(item.product.priceSar) 
                      : Number(item.product?.price || 0))} {currency === 'YER' ? 'ر.ي' : 'ر.س'}
                  </p>
                </div>

                <div className="flex items-center gap-3 bg-gray-50 dark:bg-muted p-1 rounded-lg border">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-md"
                    disabled={item.quantity <= 1}
                    onClick={() => updateGuestQuantity(index, -1)}
                    data-testid={`button-decrease-${item.productId}-${index}`}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center font-bold tabular-nums">{item.quantity}</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-md"
                    onClick={() => updateGuestQuantity(index, 1)}
                    data-testid={`button-increase-${item.productId}-${index}`}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>

                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                  onClick={() => removeGuestItem(index)}
                  data-testid={`button-remove-${item.productId}-${index}`}
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>
            ))}
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-card p-6 rounded-2xl shadow-lg border sticky top-24">
              <h2 className="text-xl font-bold mb-6">ملخص الطلب</h2>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-muted-foreground">
                  <span>المجموع</span>
                  <span className="font-bold text-foreground">{formatPrice(guestSubtotal)} {currency === 'YER' ? 'ر.ي' : 'ر.س'}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-xl font-bold text-primary">
                  <span>الإجمالي</span>
                  <span>{formatPrice(guestSubtotal)} {currency === 'YER' ? 'ر.ي' : 'ر.س'}</span>
                </div>
              </div>

              <Link href="/guest-checkout">
                <Button 
                  className="w-full h-14 text-lg font-bold rounded-xl shadow-lg shadow-primary/20"
                  data-testid="button-guest-checkout"
                >
                  إتمام الشراء كزائر
                  <ArrowLeft className="mr-2 h-5 w-5" />
                </Button>
              </Link>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white dark:bg-card px-2 text-muted-foreground">أو</span>
                </div>
              </div>

              <Link href="/auth">
                <Button 
                  variant="outline"
                  className="w-full h-12 font-bold gap-2"
                  data-testid="button-login-to-checkout"
                >
                  <UserPlus className="h-5 w-5" />
                  سجل دخولك للمزايا الإضافية
                </Button>
              </Link>
              
              <p className="text-xs text-center text-muted-foreground mt-4">
                سجل الدخول للحصول على نقاط الولاء وتتبع طلباتك
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated user cart
  const getItemPrice = (item: NonNullable<typeof cartItems>[0]) => {
    return currency === 'SAR' && item.product.priceSar 
      ? Number(item.product.priceSar) 
      : Number(item.product.price);
  };

  const subtotal = cartItems?.reduce((acc, item) => acc + (getItemPrice(item) * item.quantity), 0) || 0;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-20 flex justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!cartItems || cartItems.length === 0) {
    return (
      <div className="container mx-auto px-4 py-20 text-center max-w-md">
        <div className="bg-primary/5 p-8 rounded-full w-fit mx-auto mb-6">
          <ShoppingBag className="h-16 w-16 text-primary" />
        </div>
        <h1 className="text-3xl font-bold mb-4">سلة التسوق فارغة</h1>
        <p className="text-muted-foreground mb-8 text-lg">
          لم تقم بإضافة أي منتجات للسلة بعد. تصفح منتجاتنا المميزة وابدأ التسوق!
        </p>
        <Link href="/products">
          <Button size="lg" className="rounded-full px-8 text-lg h-14" data-testid="button-browse-products">
            تصفح المنتجات
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 pb-20">
      <h1 className="text-3xl font-bold mb-8">سلة التسوق ({cartItems.length} منتجات)</h1>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {cartItems.map((item) => (
            <div key={item.id} className="bg-white dark:bg-card p-4 rounded-xl shadow-sm border flex flex-col sm:flex-row gap-4 items-center">
              <div className="w-24 h-24 bg-gray-50 dark:bg-muted rounded-lg overflow-hidden shrink-0">
                <img 
                  src={item.product.imageUrl} 
                  alt={item.product.name} 
                  className="w-full h-full object-contain"
                />
              </div>
              
              <div className="flex-grow text-center sm:text-right">
                <h3 className="font-bold text-lg mb-1">{item.product.name}</h3>
                {(item.selectedSize || item.selectedColor) && (
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start mb-2">
                    {item.selectedSize && (
                      <span className="text-xs bg-muted px-2 py-1 rounded">الحجم: {item.selectedSize}</span>
                    )}
                    {item.selectedColor && (
                      <span className="text-xs bg-muted px-2 py-1 rounded flex items-center gap-1">
                        اللون: 
                        <span 
                          className="w-4 h-4 rounded-full border inline-block" 
                          style={{ backgroundColor: item.selectedColor }}
                        />
                      </span>
                    )}
                  </div>
                )}
                {item.customPrinting && (
                  <span className="text-xs bg-[#2196F3]/10 text-[#2196F3] px-2 py-1 rounded">طباعة مخصصة</span>
                )}
                <p className="text-primary font-bold mt-1">
                  {formatPrice(getItemPrice(item))} {currency === 'YER' ? 'ر.ي' : 'ر.س'}
                </p>
              </div>

              <div className="flex items-center gap-3 bg-gray-50 dark:bg-muted p-1 rounded-lg border">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 rounded-md"
                  disabled={item.quantity <= 1}
                  onClick={() => updateItem({ id: item.id, quantity: item.quantity - 1 })}
                  data-testid={`button-decrease-${item.id}`}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-8 text-center font-bold tabular-nums">{item.quantity}</span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 rounded-md"
                  onClick={() => updateItem({ id: item.id, quantity: item.quantity + 1 })}
                  data-testid={`button-increase-${item.id}`}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              <Button 
                variant="ghost" 
                size="icon" 
                className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                onClick={() => removeItem(item.id)}
                data-testid={`button-remove-${item.id}`}
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </div>
          ))}
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-card p-6 rounded-2xl shadow-lg border sticky top-24">
            <h2 className="text-xl font-bold mb-6">ملخص الطلب</h2>
            
            <div className="space-y-4 mb-6">
              <div className="flex justify-between text-muted-foreground">
                <span>المجموع</span>
                <span className="font-bold text-foreground">{formatPrice(subtotal)} {currency === 'YER' ? 'ر.ي' : 'ر.س'}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-xl font-bold text-primary">
                <span>الإجمالي</span>
                <span>{formatPrice(subtotal)} {currency === 'YER' ? 'ر.ي' : 'ر.س'}</span>
              </div>
            </div>

            <Link href="/checkout">
              <Button 
                className="w-full h-14 text-lg font-bold rounded-xl shadow-lg shadow-primary/20"
                data-testid="button-checkout"
              >
                إتمام الطلب
                <ArrowLeft className="mr-2 h-5 w-5" />
              </Button>
            </Link>
            
            <p className="text-xs text-center text-muted-foreground mt-4">
              سيتم تحديد طريقة الدفع في الخطوة التالية
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
