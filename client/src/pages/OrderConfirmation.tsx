import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, Package, Truck, ArrowRight, Loader2 } from "lucide-react";

export default function OrderConfirmation() {
  const [_location, navigate] = useLocation();
  const [orderId, setOrderId] = useState<number | null>(null);

  // Extract order ID from URL
  useEffect(() => {
    const matches = window.location.pathname.match(/\/order-confirmation\/(\d+)/);
    if (matches) {
      setOrderId(parseInt(matches[1]));
    } else {
      navigate("/");
    }
  }, [navigate]);

  // Fetch order details
  const { data: order, isLoading } = useQuery({
    queryKey: [`/api/orders/${orderId}`],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${orderId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch order");
      return res.json();
    },
    enabled: !!orderId,
  });

  // Fetch order items
  const { data: orderItems = [] } = useQuery({
    queryKey: [`/api/orders/${orderId}/items`],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${orderId}/items`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch order items");
      return res.json();
    },
    enabled: !!orderId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen pb-20">
        <p className="text-red-600 mb-4">الطلب غير موجود</p>
        <Button onClick={() => navigate("/")} variant="outline">
          العودة للمتجر
        </Button>
      </div>
    );
  }

  const shippingDays =
    order.shippingOption === "fast" ? "1-2" : "3-5";

  return (
    <div className="flex flex-col pb-20 bg-white dark:bg-background min-h-screen">
      {/* Header */}
      <header className="sticky top-0 bg-gradient-to-l from-green-500 to-green-600 px-4 py-4 flex items-center gap-3 z-50">
        <button onClick={() => navigate("/")} className="text-white">
          <ArrowRight className="w-6 h-6" />
        </button>
        <h1 className="text-white font-bold text-lg flex-1 text-right">تأكيد الطلب</h1>
      </header>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-6">
        {/* Success Message */}
        <div className="text-center space-y-3 py-6" data-testid="section-success">
          <div className="flex justify-center">
            <CheckCircle className="w-16 h-16 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            تم استقبال طلبك بنجاح ✅
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            شكراً لاختيارك أويو بلاست
          </p>
        </div>

        {/* Order Number & Date */}
        <Card className="bg-gradient-to-br from-green-50 to-cyan-50 dark:from-green-900/20 dark:to-cyan-900/20 border-green-200 dark:border-green-800" data-testid="section-order-info">
          <CardContent className="pt-6 space-y-4 text-center">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">رقم الطلب</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400" data-testid="text-order-id">
                #{order.id}
              </p>
            </div>
            <Separator />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">تاريخ الطلب</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white" data-testid="text-order-date">
                {new Date(order.createdAt).toLocaleDateString("ar-YE", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Order Summary */}
        <Card data-testid="section-order-summary">
          <CardHeader>
            <CardTitle className="text-right flex items-center gap-2">
              <Package className="w-5 h-5 text-cyan-600" />
              ملخص الطلب
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {orderItems.map((item: any) => (
              <div
                key={item.id}
                className="flex justify-between items-start pb-3 border-b last:border-b-0"
                data-testid={`order-item-${item.id}`}
              >
                <div className="flex-1 text-right">
                  <p className="font-semibold">{item.productName}</p>
                  <p className="text-sm text-gray-500">الكمية: {item.quantity}</p>
                </div>
                <p className="font-bold ml-4" data-testid={`item-price-${item.id}`}>
                  {item.price} ر.ي
                </p>
              </div>
            ))}

            <Separator />

            <div className="space-y-2 text-right">
              <div className="flex justify-between">
                <span>الإجمالي:</span>
                <span className="font-bold text-lg" data-testid="text-total">
                  {order.total} ر.ي
                </span>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mt-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 text-right">
                طريقة الدفع
              </p>
              <p className="font-semibold text-gray-900 dark:text-white text-right" data-testid="text-payment-method">
                الدفع عند الاستلام (COD)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Shipping Information */}
        <Card data-testid="section-shipping-info">
          <CardHeader>
            <CardTitle className="text-right flex items-center gap-2">
              <Truck className="w-5 h-5 text-cyan-600" />
              معلومات الشحن
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 text-right">
                  عنوان التسليم
                </p>
                <p className="font-semibold text-gray-900 dark:text-white text-right" data-testid="text-shipping-address">
                  {order.shippingCity}، {order.shippingAddress}
                </p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 text-right">
                  المدة المتوقعة للتسليم
                </p>
                <p className="font-semibold text-blue-600 dark:text-blue-400 text-right" data-testid="text-delivery-days">
                  {shippingDays} أيام
                </p>
              </div>

              {order.notes && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 text-right">
                    ملاحظاتك
                  </p>
                  <p className="text-gray-900 dark:text-white text-right" data-testid="text-notes">
                    {order.notes}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Status Info */}
        <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800" data-testid="section-status-info">
          <CardContent className="pt-6 text-right">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              سيتم التواصل معك عبر الرقم <strong>{order.customerPhone}</strong> أو البريد الإلكتروني <strong>{order.customerEmail}</strong>
            </p>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-3" data-testid="section-actions">
          <Button
            onClick={() => navigate(`/track/${order.id}`)}
            className="w-full h-12 font-bold"
            data-testid="button-track-order"
          >
            تتبع الطلب
          </Button>

          <Button
            onClick={() => navigate("/")}
            variant="outline"
            className="w-full h-12 font-bold"
            data-testid="button-return-store"
          >
            العودة للمتجر
          </Button>
        </div>
      </div>
    </div>
  );
}
