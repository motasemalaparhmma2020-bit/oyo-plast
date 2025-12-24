import { useCart, useUpdateCartItem, useRemoveFromCart } from "@/hooks/use-cart";
import { useCreateOrder } from "@/hooks/use-orders";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Trash2, Plus, Minus, ArrowLeft, ShoppingBag, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function Cart() {
  const { data: cartItems, isLoading } = useCart();
  const { mutate: updateItem } = useUpdateCartItem();
  const { mutate: removeItem } = useRemoveFromCart();
  const { mutate: createOrder, isPending: isOrdering } = useCreateOrder();

  const subtotal = cartItems?.reduce((acc, item) => acc + (Number(item.product.price) * item.quantity), 0) || 0;
  const tax = subtotal * 0.15; // 15% VAT
  const total = subtotal + tax;

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
                  {Number(item.product.price).toFixed(2)} ريال
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
                <span>المجموع الفرعي</span>
                <span className="font-bold text-foreground">{subtotal.toFixed(2)} ريال</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>ضريبة القيمة المضافة (15%)</span>
                <span className="font-bold text-foreground">{tax.toFixed(2)} ريال</span>
              </div>
              <Separator />
              <div className="flex justify-between text-xl font-bold text-primary">
                <span>الإجمالي</span>
                <span>{total.toFixed(2)} ريال</span>
              </div>
            </div>

            <Button 
              className="w-full h-14 text-lg font-bold rounded-xl shadow-lg shadow-primary/20"
              onClick={() => createOrder()}
              disabled={isOrdering}
            >
              {isOrdering ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  جاري المعالجة...
                </>
              ) : (
                <>
                  إتمام الطلب
                  <ArrowLeft className="mr-2 h-5 w-5" />
                </>
              )}
            </Button>
            
            <p className="text-xs text-center text-muted-foreground mt-4">
              بالضغط على إتمام الطلب، فإنك توافق على شروط الاستخدام وسياسة الخصوصية
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
