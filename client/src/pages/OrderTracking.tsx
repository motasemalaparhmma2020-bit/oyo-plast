import { useMemo } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Loader2, Package, Truck, CheckCircle2 } from "lucide-react";

export default function OrderTracking() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/track/:id");
  const orderId = useMemo(() => (match ? Number(params?.id) : null), [match, params]);

  const { data: order, isLoading } = useQuery({
    queryKey: ["/api/orders", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const res = await fetch(`/api/orders/${orderId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch order");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-lg font-bold">الطلب غير موجود</p>
        <Button onClick={() => navigate("/")} variant="outline">
          العودة للرئيسية
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} data-testid="button-back-home">
            <ArrowRight className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">تتبع الطلب</h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              الطلب #{order.id}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>الحالة</span>
              <Badge>{order.status || "قيد المراجعة"}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>العميل</span>
              <span className="font-medium">{order.customerName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>الهاتف</span>
              <span className="font-medium">{order.customerPhone}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>الإجمالي</span>
              <span className="font-medium">{order.total} ر.ي</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              خطوات الطلب
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              "تم استلام الطلب",
              "قيد المراجعة",
              "جاري التجهيز",
              "تم الشحن",
              "تم التسليم",
            ].map((step, index) => (
              <div key={step} className="flex items-center gap-3">
                <CheckCircle2 className={`h-5 w-5 ${index <= 1 ? "text-green-600" : "text-muted-foreground"}`} />
                <span className={index <= 1 ? "font-medium" : "text-muted-foreground"}>{step}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}