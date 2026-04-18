import { useCart, useUpdateCartItem, useRemoveFromCart } from "@/hooks/use-cart";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Trash2, Plus, Minus, ShoppingBag, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useEffect, useMemo, useState } from "react";
import type { Product } from "@shared/schema";
import {
  GuestCartItem,
  getGuestCart,
  setGuestCart,
} from "@/lib/cartUtils";
import { useDisplaySettings } from "@/hooks/use-display-settings";
import { OrderItemCompactMeta, OrderItemCollapsibleMeta, ColorDot } from "@/components/OrderItemDetails";
import type { ItemDisplayConfig } from "@/hooks/use-display-settings";

function formatPrice(n: number) {
  return n.toLocaleString("ar-YE");
}

/* ─── بطاقة العنصر — نمط SHEIN مع دعم الإعدادات ─── */
function CartRow({
  image, name, price, unit, quantity, description,
  selectedSize, selectedColor,
  selectedBagColor, printColor1, printColor2, printColor3, printColorCount,
  customPrinting, designNotes, designFileUrl,
  onIncrease, onDecrease, onRemove, testPrefix, cfg,
}: {
  image: string; name: string; price: number;
  unit: string; quantity: number;
  description?: string | null;
  selectedSize?: string | null; selectedColor?: string | null;
  selectedBagColor?: string | null;
  printColor1?: string | null; printColor2?: string | null; printColor3?: string | null;
  printColorCount?: number | null;
  customPrinting?: boolean | null;
  designNotes?: string | null; designFileUrl?: string | null;
  onIncrease: () => void; onDecrease: () => void; onRemove: () => void;
  testPrefix: string;
  cfg: ItemDisplayConfig;
}) {
  const total = price * quantity;
  const meta = {
    selectedColor, selectedSize, selectedBagColor,
    printColor1, printColor2, printColor3, printColorCount,
    customPrinting, designNotes, designFileUrl,
  };

  return (
    <div className="bg-white dark:bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
      <div className="flex gap-0">
        {/* صورة المنتج */}
        <div className="relative w-24 h-28 shrink-0 bg-muted">
          <img src={image} alt={name} className="h-full w-full object-cover" />
        </div>

        {/* تفاصيل المنتج */}
        <div className="flex-1 min-w-0 p-3 flex flex-col gap-1">
          {/* الاسم */}
          <p className="text-sm font-semibold leading-snug line-clamp-2 text-foreground">{name}</p>

          {/* وصف المنتج كسطر معلومات */}
          {description && (
            <p className="text-[11px] text-muted-foreground leading-snug line-clamp-1" data-testid={`text-description-${testPrefix}`}>
              {description}
            </p>
          )}

          {/* سطر اللون والمقاس — نمط شي إن — دائم الظهور */}
          {(selectedColor || selectedSize) && (
            <div
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5"
              data-testid={`text-variant-${testPrefix}`}
            >
              {selectedColor && (
                <span className="flex items-center gap-1">
                  <ColorDot color={selectedColor} size="xs" />
                  <span>{selectedColor}</span>
                </span>
              )}
              {selectedColor && selectedSize && <span className="text-gray-300">/</span>}
              {selectedSize && <span>{selectedSize}</span>}
              <span className="text-gray-300">›</span>
            </div>
          )}

          {/* بقية التفاصيل (طباعة/ملف/ملاحظات) حسب الإعدادات */}
          {cfg.mode === "collapsible"
            ? <OrderItemCollapsibleMeta item={meta} cfg={cfg} />
            : <OrderItemCompactMeta item={meta} cfg={cfg} />
          }

          {/* السعر والكمية */}
          <div className="flex items-center justify-between mt-auto pt-1">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-primary leading-none">
                {formatPrice(total)} {unit}
              </span>
              {quantity > 1 && (
                <span className="text-[10px] text-muted-foreground mt-0.5">
                  {formatPrice(price)} × {quantity}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                className="text-red-400 hover:text-red-600 transition-colors p-1"
                onClick={onRemove}
                data-testid={`button-remove-${testPrefix}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-1 bg-muted rounded-full px-1 py-0.5">
                <button
                  className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white transition-colors disabled:opacity-40"
                  disabled={quantity <= 1}
                  onClick={onDecrease}
                  data-testid={`button-decrease-${testPrefix}`}
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-6 text-center text-xs font-bold tabular-nums">{quantity}</span>
                <button
                  className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white transition-colors"
                  onClick={onIncrease}
                  data-testid={`button-increase-${testPrefix}`}
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
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
  const displaySettings = useDisplaySettings();
  const cartCfg = displaySettings.cart;

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

  const { data: homeSettings } = useQuery<any>({
    queryKey: ["/api/home-settings"],
    queryFn: async () => {
      const res = await fetch("/api/home-settings", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
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
      const unitPrice = item.unitPrice ? Number(item.unitPrice) : null;
      const base =
        currency === "SAR" && item.product.priceSar
          ? Number(item.product.priceSar)
          : Number(item.product.price);
      return acc + (unitPrice ?? base) * item.quantity;
    }, 0);
  } else {
    subtotal = guestCartWithProducts.reduce((acc, item) => {
      const base =
        currency === "SAR" && item.product?.priceSar
          ? Number(item.product.priceSar)
          : Number(item.product?.price || 0);
      return acc + base * item.quantity;
    }, 0);
  }

  const itemCount = isAuthenticated
    ? (cartItems?.length ?? 0)
    : guestCart.length;

  const checkoutHref = "/guest-checkout";

  return (
    <div className="max-w-lg mx-auto px-4 py-5 pb-28">
      {/* رأس الصفحة */}
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-muted-foreground">{itemCount} منتجات</span>
        <h1 className="text-lg font-bold">سلة التسوق</h1>
      </div>

      {/* قائمة المنتجات */}
      <div className="space-y-3 mb-5">
        {isAuthenticated && cartItems
          ? cartItems.map((item) => {
              const unitP = item.unitPrice ? Number(item.unitPrice) : null;
              const basePrice =
                currency === "SAR" && item.product.priceSar
                  ? Number(item.product.priceSar)
                  : Number(item.product.price);
              const displayPrice = unitP ?? basePrice;
              return (
                <CartRow
                  key={item.id}
                  image={item.product.imageUrl}
                  name={item.product.name}
                  price={displayPrice}
                  unit={unit}
                  quantity={item.quantity}
                  description={(item.product as any)?.description}
                  selectedSize={(() => {
                    if (item.selectedSize) return item.selectedSize;
                    const p: any = item.product;
                    if (p?.sizes?.[0]) return p.sizes[0];
                    try {
                      const sp = typeof p?.sizePricing === 'string' ? JSON.parse(p.sizePricing) : p?.sizePricing;
                      if (Array.isArray(sp) && sp[0]?.size) return sp[0].size;
                    } catch {}
                    return null;
                  })()}
                  selectedColor={item.selectedColor || (item.product as any)?.colors?.[0] || null}
                  selectedBagColor={item.selectedBagColor}
                  printColor1={item.printColor1}
                  printColor2={item.printColor2}
                  printColor3={item.printColor3}
                  printColorCount={item.printColorCount}
                  customPrinting={item.customPrinting}
                  designNotes={item.designNotes}
                  designFileUrl={item.designFileUrl}
                  onIncrease={() => updateItem({ id: item.id, quantity: item.quantity + 1 })}
                  onDecrease={() => updateItem({ id: item.id, quantity: item.quantity - 1 })}
                  onRemove={() => removeItem(item.id)}
                  testPrefix={String(item.id)}
                  cfg={cartCfg}
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
                  selectedBagColor={(item as any).selectedBagColor}
                  printColor1={(item as any).printColor1}
                  printColor2={(item as any).printColor2}
                  printColor3={(item as any).printColor3}
                  printColorCount={(item as any).printColorCount}
                  customPrinting={(item as any).customPrinting}
                  designNotes={(item as any).designNotes}
                  designFileUrl={(item as any).designFileUrl}
                  onIncrease={() => updateGuestQty(index, 1)}
                  onDecrease={() => updateGuestQty(index, -1)}
                  onRemove={() => removeGuestItem(index)}
                  testPrefix={`guest-${item.productId}-${index}`}
                  cfg={cartCfg}
                />
              );
            })}
      </div>

      {/* ملخص الطلب — ثابت في الأسفل */}
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

        <Link href={checkoutHref}>
          <Button
            className="w-full h-12 text-base font-bold rounded-xl bg-teal-500 hover:bg-teal-600 shadow-md"
            data-testid="button-checkout"
          >
            إتمام الطلب
          </Button>
        </Link>
      </div>
    </div>
  );
}
