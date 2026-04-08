import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowRight, Package, Truck, CheckCircle2, Clock, XCircle,
  Loader2, MapPin, CreditCard, Phone, ShoppingBag, Search
} from "lucide-react";

type TrackOrder = {
  id: number;
  status: string;
  deliveryStatus: string | null;
  paymentStatus: string | null;
  customerName: string;
  shippingCity: string;
  shippingAddress: string;
  total: number | string;
  currency: string;
  shippingCost: number | string;
  shippingOption: string | null;
  paymentMethod: string | null;
  trackingNumber: string | null;
  createdAt: string;
  supplierName: string | null;
  items: any[];
};

const STATUS_STEPS = [
  { key: "pending",    label: "تم استلام الطلب",  icon: Package },
  { key: "confirmed",  label: "تأكيد الطلب",       icon: CheckCircle2 },
  { key: "preparing",  label: "جاري التجهيز",      icon: Clock },
  { key: "picked_up",  label: "مع المندوب",         icon: Truck },
  { key: "shipped",    label: "في الطريق إليك",    icon: Truck },
  { key: "delivered",  label: "تم التسليم",         icon: CheckCircle2 },
];

const DELIVERY_STATUS_MAP: Record<string, string> = {
  pending:    "قيد الانتظار",
  picked_up:  "استلمه المندوب",
  shipped:    "في الطريق",
  delivered:  "تم التسليم",
  failed:     "فشل التوصيل",
};

const ORDER_STATUS_MAP: Record<string, string> = {
  pending:    "قيد المراجعة",
  confirmed:  "مؤكد",
  preparing:  "جاري التجهيز",
  shipped:    "تم الشحن",
  delivered:  "تم التسليم",
  cancelled:  "ملغي",
};

function getStepIndex(status: string, deliveryStatus: string | null) {
  if (deliveryStatus === "delivered" || status === "delivered") return 5;
  if (deliveryStatus === "shipped") return 4;
  if (deliveryStatus === "picked_up") return 3;
  if (status === "preparing") return 2;
  if (status === "confirmed") return 1;
  return 0;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("ar-YE", {
      year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function SearchForm({ onResult }: { onResult: (o: TrackOrder) => void }) {
  const [orderId, setOrderId] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!orderId.trim() || !phone.trim()) {
      setError("يرجى إدخال رقم الطلب ورقم الهاتف");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/track-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: orderId.trim(), phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "حدث خطأ"); return; }
      onResult(data);
    } catch {
      setError("حدث خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex flex-col items-center justify-center px-4 pb-16" dir="rtl">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary rounded-full mb-4 shadow-lg">
            <Package className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">تتبع طلبك</h1>
          <p className="text-gray-500 mt-1 text-sm">أدخل رقم طلبك ورقم هاتفك لمعرفة حالة شحنتك</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardContent className="p-6">
            <form onSubmit={handleSearch} className="space-y-5">
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-1.5 block">رقم الطلب</Label>
                <Input
                  value={orderId}
                  onChange={e => setOrderId(e.target.value)}
                  placeholder="مثال: 1234"
                  inputMode="numeric"
                  data-testid="input-order-id"
                  className="text-right h-12 text-base"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-1.5 block">رقم الهاتف</Label>
                <Input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="الهاتف المستخدم عند الطلب"
                  inputMode="tel"
                  data-testid="input-phone"
                  className="text-right h-12 text-base"
                />
              </div>
              {error && (
                <p className="text-red-600 text-sm text-center bg-red-50 rounded-lg py-2 px-3" data-testid="text-tracking-error">{error}</p>
              )}
              <Button type="submit" className="w-full h-12 text-base font-bold" disabled={loading} data-testid="button-track">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Search className="h-5 w-5 ml-2" />تتبع الطلب</>}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-400 mt-6">
          رقم الطلب موجود في رسالة التأكيد التي وصلتك على الواتساب
        </p>
      </div>
    </div>
  );
}

function OrderResult({ order, onBack }: { order: TrackOrder; onBack: () => void }) {
  const [, navigate] = useLocation();
  const stepIndex = getStepIndex(order.status, order.deliveryStatus);
  const isCancelled = order.status === "cancelled";

  const currency = order.currency || "ر.ي";

  return (
    <div className="min-h-screen bg-gray-50 pb-20" dir="rtl">
      <header className="sticky top-0 z-40 bg-white border-b shadow-sm">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back-search">
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-bold text-base">تتبع الطلب #{order.id}</h1>
            <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
          </div>
          <div className="mr-auto">
            <Badge
              variant={isCancelled ? "destructive" : order.status === "delivered" ? "default" : "secondary"}
              data-testid="badge-order-status"
            >
              {ORDER_STATUS_MAP[order.status] || order.status}
            </Badge>
          </div>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 py-5 space-y-4">

        {/* شريط التقدم */}
        {isCancelled ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4 flex items-center gap-3">
              <XCircle className="h-8 w-8 text-red-500 flex-shrink-0" />
              <div>
                <p className="font-bold text-red-700">تم إلغاء الطلب</p>
                <p className="text-sm text-red-500">للاستفسار تواصل معنا</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardContent className="p-5">
              <h2 className="font-bold text-sm text-gray-500 mb-4">مراحل الطلب</h2>
              <div className="relative">
                {STATUS_STEPS.map((step, idx) => {
                  const done = idx <= stepIndex;
                  const current = idx === stepIndex;
                  const Icon = step.icon;
                  return (
                    <div key={step.key} className="flex items-start gap-3 mb-4 last:mb-0">
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shadow-sm
                          ${done ? (current ? "bg-primary ring-4 ring-primary/20" : "bg-green-500") : "bg-gray-100"}`}>
                          <Icon className={`h-4 w-4 ${done ? "text-white" : "text-gray-400"}`} />
                        </div>
                        {idx < STATUS_STEPS.length - 1 && (
                          <div className={`w-0.5 h-5 mt-1 ${done && idx < stepIndex ? "bg-green-400" : "bg-gray-200"}`} />
                        )}
                      </div>
                      <div className="pt-1.5">
                        <p className={`text-sm font-medium ${done ? (current ? "text-primary" : "text-green-700") : "text-gray-400"}`}>
                          {step.label}
                        </p>
                        {current && order.deliveryStatus && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {DELIVERY_STATUS_MAP[order.deliveryStatus] || ""}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* معلومات التوصيل */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 space-y-3">
            <h2 className="font-bold text-sm text-gray-500">معلومات التوصيل</h2>
            <div className="flex items-center gap-2.5">
              <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">{order.shippingCity}</p>
                <p className="text-xs text-gray-500">{order.shippingAddress}</p>
              </div>
            </div>
            {order.supplierName && (
              <div className="flex items-center gap-2.5">
                <Truck className="h-4 w-4 text-primary flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">الموزع المسؤول</p>
                  <p className="font-medium text-sm">{order.supplierName}</p>
                </div>
              </div>
            )}
            {order.trackingNumber && (
              <div className="flex items-center gap-2.5">
                <Package className="h-4 w-4 text-primary flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">رقم التتبع</p>
                  <p className="font-medium text-sm font-mono">{order.trackingNumber}</p>
                </div>
              </div>
            )}
            {order.paymentMethod && (
              <div className="flex items-center gap-2.5">
                <CreditCard className="h-4 w-4 text-primary flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">طريقة الدفع</p>
                  <p className="font-medium text-sm">{order.paymentMethod === "cod" ? "الدفع عند الاستلام" : order.paymentMethod}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* المنتجات */}
        {order.items && order.items.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <h2 className="font-bold text-sm text-gray-500 mb-3">المنتجات ({order.items.length})</h2>
              <div className="space-y-3">
                {order.items.map((item: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0" data-testid={`row-item-${i}`}>
                    {item.product_image && (
                      <img src={item.product_image} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.product_name || item.product_name_db}</p>
                      {item.selected_size && <p className="text-xs text-gray-500">المقاس: {item.selected_size}</p>}
                      {item.selected_color && <p className="text-xs text-gray-500">اللون: {item.selected_color}</p>}
                    </div>
                    <div className="text-left flex-shrink-0">
                      <p className="font-bold text-sm">{Number(item.price || 0).toLocaleString()} {currency}</p>
                      <p className="text-xs text-gray-500">× {item.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* الإجمالي */}
        <Card className="border-0 shadow-sm bg-primary/5">
          <CardContent className="p-5 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">المجموع الفرعي</span>
              <span className="font-medium">{(Number(order.total) - Number(order.shippingCost || 0)).toLocaleString()} {currency}</span>
            </div>
            {Number(order.shippingCost) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">الشحن</span>
                <span className="font-medium">{Number(order.shippingCost).toLocaleString()} {currency}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-2 border-t">
              <span>الإجمالي</span>
              <span className="text-primary">{Number(order.total).toLocaleString()} {currency}</span>
            </div>
          </CardContent>
        </Card>

        <Button variant="outline" className="w-full" onClick={() => navigate("/")} data-testid="button-go-home">
          <ShoppingBag className="h-4 w-4 ml-2" />
          العودة للمتجر
        </Button>
      </div>
    </div>
  );
}

export default function OrderTracking() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/track/:id");
  const [order, setOrder] = useState<TrackOrder | null>(null);
  const [searchMode, setSearchMode] = useState(!match);
  const [preloaded, setPreloaded] = useState(false);

  if (match && params?.id && !order && !searchMode && !preloaded) {
    setPreloaded(true);
  }

  if (order) {
    return <OrderResult order={order} onBack={() => { setOrder(null); setSearchMode(true); }} />;
  }

  return <SearchForm onResult={setOrder} />;
}
