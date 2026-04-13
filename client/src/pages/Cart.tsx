import { useCart, useUpdateCartItem, useRemoveFromCart } from "@/hooks/use-cart";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Trash2, Plus, Minus, ShoppingBag, Loader2, Printer, Paperclip, StickyNote } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useEffect, useMemo, useState } from "react";
import type { Product } from "@shared/schema";
import {
  GuestCartItem,
  getGuestCart,
  setGuestCart,
} from "@/lib/cartUtils";

/* ─── خريطة الألوان العربية ─── */
const colorMap: Record<string, string> = {
  أبيض: "#FFFFFF", أسود: "#000000", أحمر: "#EF4444",
  أزرق: "#3B82F6", أخضر: "#22C55E", أصفر: "#EAB308",
  برتقالي: "#F97316", وردي: "#EC4899", بنفسجي: "#8B5CF6",
  رمادي: "#6B7280", بني: "#92400E", ذهبي: "#D97706",
  فضي: "#9CA3AF", شفاف: "transparent", سماوي: "#06B6D4",
  زهري: "#F472B6", كحلي: "#1E3A8A", بيج: "#D4A574",
  أخضرك: "#16A34A",
};

function getColorCode(name: string): string {
  return colorMap[name?.trim()] ?? "#E5E7EB";
}

function formatPrice(n: number) {
  return n.toLocaleString("ar-YE");
}

/* ─── دائرة اللون ─── */
function ColorDot({ color }: { color: string }) {
  const isTransparent = color === "شفاف";
  return (
    <span
      className="inline-block w-3.5 h-3.5 rounded-full border border-gray-300 shadow-sm shrink-0"
      style={{
        backgroundColor: getColorCode(color),
        backgroundImage: isTransparent
          ? "linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%,#ccc),linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%,#ccc)"
          : "none",
        backgroundSize: "5px 5px",
        backgroundPosition: "0 0, 2.5px 2.5px",
      }}
    />
  );
}

/* ─── بطاقة العنصر — نمط SHEIN ─── */
function CartRow({
  image, name, price, originalPrice, unit, quantity,
  selectedSize, selectedColor,
  selectedBagColor, printColor1, printColor2, printColor3, printColorCount,
  customPrinting, designNotes, designFileUrl,
  onIncrease, onDecrease, onRemove, testPrefix,
}: {
  image: string; name: string; price: number; originalPrice?: number;
  unit: string; quantity: number;
  selectedSize?: string | null; selectedColor?: string | null;
  selectedBagColor?: string | null;
  printColor1?: string | null; printColor2?: string | null; printColor3?: string | null;
  printColorCount?: number | null;
  customPrinting?: boolean | null;
  designNotes?: string | null; designFileUrl?: string | null;
  onIncrease: () => void; onDecrease: () => void; onRemove: () => void;
  testPrefix: string;
}) {
  const total = price * quantity;
  const printColors = [printColor1, printColor2, printColor3].filter(Boolean) as string[];
  const hasPrinting = customPrinting && (printColors.length > 0 || selectedBagColor);
  const hasDesign = !!designFileUrl;
  const hasNotes = !!designNotes;

  return (
    <div className="bg-white dark:bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
      <div className="flex gap-0">
        {/* صورة المنتج */}
        <div className="relative w-24 h-28 shrink-0 bg-muted">
          <img src={image} alt={name} className="h-full w-full object-cover" />
        </div>

        {/* تفاصيل المنتج */}
        <div className="flex-1 min-w-0 p-3 flex flex-col gap-1.5">
          {/* الاسم */}
          <p className="text-sm font-semibold leading-snug line-clamp-2 text-foreground">{name}</p>

          {/* اللون والمقاس — نمط SHEIN */}
          {(selectedColor || selectedSize) && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {selectedColor && (
                <>
                  <ColorDot color={selectedColor} />
                  <span className="text-xs text-muted-foreground">{selectedColor}</span>
                </>
              )}
              {selectedColor && selectedSize && (
                <span className="text-xs text-muted-foreground">/</span>
              )}
              {selectedSize && (
                <span className="text-xs text-muted-foreground font-medium">{selectedSize}</span>
              )}
            </div>
          )}

          {/* معلومات الطباعة المخصصة */}
          {hasPrinting && (
            <div className="flex flex-col gap-1 bg-cyan-50 dark:bg-cyan-950/30 rounded-lg px-2 py-1.5 border border-cyan-200/60">
              {/* لون الكيس */}
              {selectedBagColor && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-cyan-700 font-medium">لون الكيس:</span>
                  <ColorDot color={selectedBagColor} />
                  <span className="text-[10px] text-cyan-700">{selectedBagColor}</span>
                </div>
              )}
              {/* ألوان الطباعة */}
              {printColors.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Printer className="w-3 h-3 text-cyan-600 shrink-0" />
                  <span className="text-[10px] text-cyan-700 font-medium">{printColors.length} ألوان:</span>
                  {printColors.map((c, i) => (
                    <div key={i} className="flex items-center gap-0.5">
                      <ColorDot color={c} />
                      <span className="text-[10px] text-cyan-700">{c}</span>
                      {i < printColors.length - 1 && <span className="text-[10px] text-cyan-400 mx-0.5">+</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ملف التصميم والملاحظات */}
          {(hasDesign || hasNotes) && (
            <div className="flex flex-col gap-0.5">
              {hasDesign && (
                <div className="flex items-center gap-1">
                  <Paperclip className="w-3 h-3 text-violet-500 shrink-0" />
                  <span className="text-[10px] text-violet-600 truncate max-w-[160px]">
                    {designFileUrl!.split("/").pop()}
                  </span>
                </div>
              )}
              {hasNotes && (
                <div className="flex items-center gap-1">
                  <StickyNote className="w-3 h-3 text-amber-500 shrink-0" />
                  <span className="text-[10px] text-amber-700 truncate max-w-[160px]">{designNotes}</span>
                </div>
              )}
            </div>
          )}

          {/* السعر والكمية في نفس السطر */}
          <div className="flex items-center justify-between mt-auto pt-1">
            {/* السعر */}
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

            {/* أزرار الكمية وحذف */}
            <div className="flex items-center gap-1.5">
              {/* حذف */}
              <button
                className="text-red-400 hover:text-red-600 transition-colors p-1"
                onClick={onRemove}
                data-testid={`button-remove-${testPrefix}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>

              {/* عداد الكمية */}
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
                  selectedSize={item.selectedSize}
                  selectedColor={item.selectedColor}
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
