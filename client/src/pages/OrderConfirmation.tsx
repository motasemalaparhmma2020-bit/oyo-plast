import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CheckCircle, Package, Truck, ArrowRight, Loader2, Phone, MapPin, CreditCard, Clock } from "lucide-react";
import { OrderItemCollapsibleMeta } from "@/components/OrderItemDetails";

export default function OrderConfirmation() {
  const [_location, navigate] = useLocation();
  const [orderId, setOrderId] = useState<number | null>(null);

  useEffect(() => {
    const matches = window.location.pathname.match(/\/order-confirmation\/(\d+)/);
    if (matches) setOrderId(parseInt(matches[1]));
    else navigate("/");
  }, [navigate]);

  const { data: order, isLoading } = useQuery({
    queryKey: [`/api/orders/${orderId}`],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${orderId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch order");
      return res.json();
    },
    enabled: !!orderId,
  });

  const { data: orderItems = [] } = useQuery({
    queryKey: [`/api/orders/${orderId}/items`],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${orderId}/items`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch order items");
      return res.json();
    },
    enabled: !!orderId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen pb-20 gap-4">
        <p className="text-red-500 font-bold">الطلب غير موجود</p>
        <Button onClick={() => navigate("/")} variant="outline">العودة للمتجر</Button>
      </div>
    );
  }

  const paymentLabel = order.paymentMethod === "cash_on_delivery" ? "الدفع عند الاستلام"
    : order.paymentMethod === "digital_wallet" ? "محفظة إلكترونية"
    : order.paymentMethod;

  return (
    <div className="min-h-screen bg-muted/20 dark:bg-background pb-28" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background border-b flex items-center justify-between px-4 py-3">
        <button onClick={() => navigate("/")} className="p-1 text-muted-foreground" data-testid="button-home">
          <ArrowRight className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-base">تأكيد الطلب</h1>
        <div className="w-7" />
      </div>

      {/* Success Banner */}
      <div className="bg-green-500 dark:bg-green-600 px-4 py-6 text-center text-white" data-testid="section-success">
        <div className="flex justify-center mb-3">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
            <CheckCircle className="w-9 h-9 text-white" />
          </div>
        </div>
        <h2 className="text-xl font-extrabold">تم استلام طلبك بنجاح ✅</h2>
        <p className="text-green-100 text-sm mt-1">شكراً لاختيارك أويو بلاست</p>
        <div className="mt-3 bg-white/20 rounded-xl py-2 px-4 inline-block">
          <p className="text-xs text-green-100">رقم الطلب</p>
          <p className="text-2xl font-black tracking-wide" data-testid="text-order-id">#{order.id}</p>
        </div>
      </div>

      <div className="space-y-1 mt-1">
        {/* بيانات التوصيل */}
        <div className="bg-background px-4 py-3 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Truck className="h-4 w-4 text-primary" />
            <p className="text-sm font-bold">معلومات التوصيل</p>
          </div>
          {order.shippingAddress && (
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">عنوان التوصيل</p>
                <p className="text-sm font-semibold" data-testid="text-shipping-address">
                  {order.shippingCity}، {order.shippingAddress}
                </p>
              </div>
            </div>
          )}
          {order.customerPhone && (
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">رقم التواصل</p>
                <p className="text-sm font-semibold" data-testid="text-customer-phone">{order.customerPhone}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-blue-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">وقت التوصيل المتوقع</p>
              <p className="text-sm font-bold text-blue-600" data-testid="text-delivery-days">
                خلال 3 - 5 أيام عمل
              </p>
            </div>
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* طريقة الدفع */}
        <div className="bg-background px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-4 w-4 text-primary" />
            <p className="text-sm font-bold">طريقة الدفع</p>
          </div>
          <div className="bg-muted/40 rounded-lg px-3 py-2">
            <p className="text-sm font-semibold" data-testid="text-payment-method">{paymentLabel}</p>
            {order.paymentMethod === "cash_on_delivery" && (
              <p className="text-xs text-muted-foreground mt-0.5">ادفع المبلغ كاملاً لمندوب التوصيل</p>
            )}
            {order.paymentMethod === "digital_wallet" && (
              <p className="text-xs text-orange-600 mt-0.5">⏳ بانتظار تأكيد التحويل من إدارة أويو بلاست</p>
            )}
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* ملخص الطلب */}
        <div className="bg-background" data-testid="section-order-summary">
          <div className="flex items-center gap-2 px-4 pt-3 mb-1">
            <Package className="h-4 w-4 text-primary" />
            <p className="text-sm font-bold">المنتجات</p>
          </div>
          <div className="grid grid-cols-4 bg-muted/50 px-4 py-2 text-xs font-bold text-muted-foreground">
            <span className="col-span-2">المنتج</span>
            <span className="text-center">السعر</span>
            <span className="text-left">الإجمالي</span>
          </div>
          {orderItems.map((item: any) => (
            <div
              key={item.id}
              className="px-4 py-2.5 text-xs border-t"
              data-testid={`order-item-${item.id}`}
            >
              <div className="grid grid-cols-4 items-start">
                <div className="col-span-2 pr-1">
                  <span className="font-medium leading-tight block">{item.productName}</span>
                  <OrderItemCollapsibleMeta item={item} />
                </div>
                <span className="text-center">{Number(item.price).toLocaleString("ar-YE")}</span>
                <span className="text-left font-bold text-primary">
                  {(Number(item.price) * item.quantity).toLocaleString("ar-YE")}
                  <span className="text-muted-foreground font-normal block text-[10px]">×{item.quantity}</span>
                </span>
              </div>
            </div>
          ))}

          {/* الإجمالي */}
          <div className="px-4 pt-3 pb-4 space-y-2 border-t mt-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">المجموع</span>
              <span className="font-semibold">{Number(order.subtotalBeforeDiscount || order.total).toLocaleString("ar-YE")} ر.ي</span>
            </div>
            {Number(order.discountAmount) > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>الخصم</span>
                <span className="font-bold">- {Number(order.discountAmount).toLocaleString("ar-YE")} ر.ي</span>
              </div>
            )}
            {Number(order.shippingCost) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">رسوم الشحن</span>
                <span className="font-semibold">{Number(order.shippingCost).toLocaleString("ar-YE")} ر.ي</span>
              </div>
            )}
            <div className="flex justify-between items-center bg-amber-400/90 rounded-xl px-3 py-2">
              <span className="font-extrabold text-amber-900 dark:text-amber-100">الإجمالي الكلي</span>
              <span className="font-extrabold text-lg text-amber-900 dark:text-amber-100" data-testid="text-total">
                {Number(order.total).toLocaleString("ar-YE")} ر.ي
              </span>
            </div>
          </div>
        </div>

        {order.notes && (
          <>
            <div className="h-px bg-border" />
            <div className="bg-background px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">ملاحظاتك</p>
              <p className="text-sm" data-testid="text-notes">{order.notes}</p>
            </div>
          </>
        )}
      </div>

      {/* أزرار الأسفل */}
      <div className="app-fixed-bar fixed bottom-0 left-0 right-0 z-50 bg-background border-t px-4 py-3 flex gap-3 shadow-lg" data-testid="section-actions">
        <Button
          className="flex-1 h-12 font-bold rounded-xl"
          onClick={() => navigate("/")}
          data-testid="button-return-store"
        >
          متابعة التسوق
        </Button>
        <Button
          variant="outline"
          className="flex-1 h-12 font-bold rounded-xl"
          onClick={() => navigate(`/track/${order.id}`)}
          data-testid="button-track-order"
        >
          تتبع الطلب
        </Button>
      </div>
    </div>
  );
}
