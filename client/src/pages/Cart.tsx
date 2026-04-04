import { useCart, useUpdateCartItem, useRemoveFromCart } from "@/hooks/use-cart";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Trash2, Plus, Minus, ShoppingBag, Loader2, LogIn } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useEffect, useMemo, useState } from "react";
import type { Product } from "@shared/schema";
import {
  GuestCartItem,
  getGuestCart,
  setGuestCart,
} from "@/lib/cartUtils";

const colorMap: Record<string, string> = {
  أبيض: "#FFFFFF",
  أسود: "#000000",
  أحمر: "#EF4444",
  أزرق: "#3B82F6",
  أخضر: "#22C55E",
  أصفر: "#EAB308",
  برتقالي: "#F97316",
  وردي: "#EC4899",
  بنفسجي: "#8B5CF6",
  رمادي: "#6B7280",
  بني: "#92400E",
  ذهبي: "#D97706",
  فضي: "#9CA3AF",
  شفاف: "transparent",
  سماوي: "#06B6D4",
  زهري: "#F472B6",
  كحلي: "#1E3A8A",
  بيج: "#D4A574",
};

function getColorCode(name: string): string {
  return colorMap[name.trim()] ?? name.trim();
}

function formatPrice(n: number) {
  return n.toLocaleString("ar-YE");
}

/* ─── بطاقة منتج مدمجة ─── */
function CartRow({
  image,
  name,
  price,
  unit,
  quantity,
  selectedSize,
  selectedColor,
  onIncrease,
  onDecrease,
  onRemove,
  testPrefix,
}: {
  image: string;
  name: string;
  price: number;
  unit: string;
  quantity: number;
  selectedSize?: string | null;
  selectedColor?: string | null;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
  testPrefix: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-white dark:bg-card rounded-xl border shadow-sm p-3">
      {/* صورة المنتج */}
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        <img src={image} alt={name} className="h-full w-full object-contain" />
      </div>

      {/* الاسم والتفاصيل */}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm leading-tight truncate">{name}</p>
        {(selectedSize || selectedColor) && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {selectedSize && (
              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                {selectedSize}
              </span>
            )}
            {selectedColor && (
              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground flex items-center gap-1">
                <span
                  className="w-3 h-3 rounded-full border inline-block shrink-0"
                  style={{
                    backgroundColor: getColorCode(selectedColor),
                    backgroundImage:
                      selectedColor === "شفاف"
                        ? "linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%,#ccc),linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%,#ccc)"
                        : "none",
                    backgroundSize: "6px 6px",
                    backgroundPosition: "0 0,3px 3px",
                  }}
                />
                {selectedColor}
              </span>
            )}
          </div>
        )}
        {/* السعر */}
        <p className="text-primary font-bold text-sm mt-1">
          {formatPrice(price * quantity)} {unit}
        </p>
      </div>

      {/* التحكم في الكمية */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-md"
          disabled={quantity <= 1}
          onClick={onDecrease}
          data-testid={`button-decrease-${testPrefix}`}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <span className="w-6 text-center text-sm font-bold tabular-nums">{quantity}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-md"
          onClick={onIncrease}
          data-testid={`button-increase-${testPrefix}`}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {/* حذف */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
        onClick={onRemove}
        data-testid={`button-remove-${testPrefix}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

/* ─── الصفحة الرئيسية ─── */
export default function Cart() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: cartItems, isLoading: cartLoading } = useCart();
  const { mutate: updateItem } = useUpdateCartItem();
  const { mutate: removeItem } = useRemoveFromCart();
  const queryClient = useQueryClient();

  const [currency, setCurrency] = useState<"YER" | "SAR">(
    () => (localStorage.getItem("currency") as "YER" | "SAR") || "YER"
  );

  useEffect(() => {
    const handle = () =>
      setCurrency((localStorage.getItem("currency") as "YER" | "SAR") || "YER");
    window.addEventListener("currencyChange", handle);
    return () => window.removeEventListener("currencyChange", handle);
  }, []);

  const unit = currency === "YER" ? "ر.ي" : "ر.س";

  /* ─── سلة الزائر ─── */
  const guestCart: GuestCartItem[] = !isAuthenticated
    ? ((cartItems as GuestCartItem[]) || getGuestCart())
    : [];

  const { data: allProducts = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: !isAuthenticated,
  });

  const guestCartWithProducts = useMemo(
    () =>
      guestCart
        .map((item) => ({ ...item, product: allProducts.find((p) => p.id === item.productId) }))
        .filter((i) => i.product),
    [guestCart, allProducts]
  );

  const updateGuestQty = (index: number, delta: number) => {
    const current = getGuestCart();
    const updated = current.map((item, i) =>
      i === index ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
    );
    setGuestCart(updated);
    queryClient.setQueryData(["guestCart"], updated);
  };

  const removeGuestItem = (index: number) => {
    const current = getGuestCart();
    const updated = current.filter((_, i) => i !== index);
    setGuestCart(updated);
    queryClient.setQueryData(["guestCart"], updated);
  };

  /* ─── حالة التحميل ─── */
  if (authLoading || cartLoading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  /* ─── سلة فارغة ─── */
  const isEmpty = isAuthenticated
    ? !cartItems || cartItems.length === 0
    : guestCart.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="bg-primary/5 p-6 rounded-full mb-5">
          <ShoppingBag className="h-14 w-14 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-3">سلة التسوق فارغة</h1>
        <p className="text-muted-foreground mb-6 text-sm max-w-xs">
          لم تقم بإضافة أي منتجات بعد. تصفح منتجاتنا وابدأ التسوق!
        </p>
        <Link href="/products">
          <Button
            size="lg"
            className="rounded-full px-8"
            data-testid="button-browse-products"
          >
            تصفح المنتجات
          </Button>
        </Link>
      </div>
    );
  }

  /* ─── حساب الإجمالي ─── */
  let subtotal = 0;
  if (isAuthenticated && cartItems) {
    subtotal = cartItems.reduce((acc, item) => {
      const price =
        currency === "SAR" && item.product.priceSar
          ? Number(item.product.priceSar)
          : Number(item.product.price);
      return acc + price * item.quantity;
    }, 0);
  } else {
    subtotal = guestCartWithProducts.reduce((acc, item) => {
      const price =
        currency === "SAR" && item.product?.priceSar
          ? Number(item.product.priceSar)
          : Number(item.product?.price || 0);
      return acc + price * item.quantity;
    }, 0);
  }

  const itemCount = isAuthenticated
    ? (cartItems?.length ?? 0)
    : guestCart.length;

  const { data: homeSettings } = useQuery<any>({
    queryKey: ["/api/home-settings"],
    queryFn: async () => {
      const res = await fetch("/api/home-settings", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  /* ─── وجهة زر "إتمام الطلب" بناءً على إعداد loginFlow ─── */
  const loginFlow: string = homeSettings?.loginFlow || "checkout";
  let checkoutHref: string;
  if (isAuthenticated) {
    checkoutHref = "/checkout";
  } else if (loginFlow === "none") {
    checkoutHref = "/guest-checkout";
  } else {
    // "checkout" or "cart" → send unauthenticated users to login
    checkoutHref = "/auth";
  }
  const checkoutLabel = isAuthenticated ? "إتمام الطلب" : (loginFlow === "none" ? "إتمام الطلب" : "تسجيل الدخول لإتمام الطلب");

  return (
    <div className="max-w-lg mx-auto px-4 py-5 pb-24">
      {/* رأس الصفحة */}
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-muted-foreground">{itemCount} منتجات</span>
        <h1 className="text-lg font-bold">سلة التسوق</h1>
      </div>

      {/* قائمة المنتجات */}
      <div className="space-y-3 mb-5">
        {isAuthenticated && cartItems
          ? cartItems.map((item) => {
              const price =
                currency === "SAR" && item.product.priceSar
                  ? Number(item.product.priceSar)
                  : Number(item.product.price);
              return (
                <CartRow
                  key={item.id}
                  image={item.product.imageUrl}
                  name={item.product.name}
                  price={price}
                  unit={unit}
                  quantity={item.quantity}
                  selectedSize={item.selectedSize}
                  selectedColor={item.selectedColor}
                  onIncrease={() => updateItem({ id: item.id, quantity: item.quantity + 1 })}
                  onDecrease={() => updateItem({ id: item.id, quantity: item.quantity - 1 })}
                  onRemove={() => removeItem(item.id)}
                  testPrefix={String(item.id)}
                />
              );
            })
          : guestCartWithProducts.map((item, index) => {
              const price =
                currency === "SAR" && item.product?.priceSar
                  ? Number(item.product.priceSar)
                  : Number(item.product?.price || 0);
              return (
                <CartRow
                  key={`${item.productId}-${item.selectedSize}-${index}`}
                  image={item.product?.imageUrl || ""}
                  name={item.product?.name || ""}
                  price={price}
                  unit={unit}
                  quantity={item.quantity}
                  selectedSize={item.selectedSize}
                  selectedColor={item.selectedColor}
                  onIncrease={() => updateGuestQty(index, 1)}
                  onDecrease={() => updateGuestQty(index, -1)}
                  onRemove={() => removeGuestItem(index)}
                  testPrefix={`guest-${item.productId}-${index}`}
                />
              );
            })}
      </div>

      {/* ملخص الطلب والزر */}
      <div className="bg-white dark:bg-card rounded-2xl border shadow-md p-5">
        <h2 className="text-base font-bold mb-4 text-right">ملخص الطلب</h2>

        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="font-medium">
              {formatPrice(subtotal)} {unit}
            </span>
            <span className="text-muted-foreground">المجموع الفرعي</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="font-medium text-green-600">مجاني</span>
            <span className="text-muted-foreground">الشحن</span>
          </div>
          <Separator />
          <div className="flex justify-between text-base font-bold">
            <span className="text-teal-600">
              {formatPrice(subtotal)} {unit}
            </span>
            <span>الإجمالي</span>
          </div>
        </div>

        {/* زر إتمام الطلب — يتوجه للدفع إن مسجل، للتسجيل إن لم يكن */}
        <Link href={checkoutHref}>
          <Button
            className="w-full h-12 text-base font-bold rounded-xl bg-teal-500 hover:bg-teal-600 shadow-md"
            data-testid="button-checkout"
          >
            {checkoutLabel}
            <LogIn className="mr-2 h-4 w-4" />
          </Button>
        </Link>

        {/* تلميح للزائر فقط */}
        {!isAuthenticated && (
          <p className="text-xs text-center text-muted-foreground mt-3">
            سجّل الدخول للحصول على نقاط الولاء وتتبع طلباتك
          </p>
        )}
      </div>
    </div>
  );
}
