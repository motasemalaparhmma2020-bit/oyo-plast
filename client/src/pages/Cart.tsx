import { useCart, useUpdateCartItem, useRemoveFromCart } from "@/hooks/use-cart";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Trash2, Plus, Minus, ArrowLeft, ShoppingBag, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect } from "react";

export default function Cart() {
  const { data: cartItems, isLoading } = useCart();
  const { mutate: updateItem } = useUpdateCartItem();
  const { mutate: removeItem } = useRemoveFromCart();
  
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

  const formatPrice = (price: number) => {
    return price.toLocaleString('ar-YE');
  };

  const getItemPrice = (item: typeof cartItems[0]) => {
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
          <Button size="lg" className="rounded-full px-8 text-lg h-14">
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
        {/* Cart Items List */}
        <div className="lg:col-span-2 space-y-4">
          {cartItems.map((item) => (
            <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border flex flex-col sm:flex-row gap-4 items-center">
              <div className="w-24 h-24 bg-gray-50 rounded-lg overflow-hidden shrink-0">
                <img 
                  src={item.product.imageUrl} 
                  alt={item.product.name} 
                  className="w-full h-full object-contain"
                />
              </div>
              
              <div className="flex-grow text-center sm:text-right">
                <h3 className="font-bold text-lg mb-1">{item.product.name}</h3>
                <p className="text-primary font-bold">
                  {formatPrice(getItemPrice(item))} {currency === 'YER' ? 'ر.ي' : 'ر.س'}
                </p>
              </div>

              <div className="flex items-center gap-3 bg-gray-50 p-1 rounded-lg border">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 hover:bg-white rounded-md"
                  disabled={item.quantity <= 1}
                  onClick={() => updateItem({ id: item.id, quantity: item.quantity - 1 })}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-8 text-center font-bold tabular-nums">{item.quantity}</span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 hover:bg-white rounded-md"
                  onClick={() => updateItem({ id: item.id, quantity: item.quantity + 1 })}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              <Button 
                variant="ghost" 
                size="icon" 
                className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                onClick={() => removeItem(item.id)}
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </div>
          ))}
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-2xl shadow-lg border sticky top-24">
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
