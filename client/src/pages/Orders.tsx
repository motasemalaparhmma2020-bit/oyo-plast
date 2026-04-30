import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Order } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { 
  Package, 
  Clock, 
  CheckCircle, 
  XCircle, 
  TrendingUp,
  DollarSign,
  MapPin,
  Phone,
  Loader2,
  ShoppingBag,
  Printer
} from "lucide-react";
import PrintableInvoice from "@/components/PrintableInvoice";

const statusSteps = [
  { key: 'pending', label: 'قيد الانتظار', icon: Clock },
  { key: 'deposit_paid', label: 'تم دفع العربون', icon: DollarSign },
  { key: 'processing', label: 'قيد التجهيز', icon: Package },
  { key: 'shipped', label: 'تم الشحن', icon: TrendingUp },
  { key: 'delivered', label: 'تم التوصيل', icon: CheckCircle },
  { key: 'completed', label: 'مكتمل', icon: CheckCircle },
];

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  deposit_paid: 'bg-blue-100 text-blue-800',
  processing: 'bg-orange-100 text-orange-800',
  shipped: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-teal-100 text-teal-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const statusLabels: Record<string, string> = {
  pending: 'قيد الانتظار',
  deposit_paid: 'تم دفع العربون',
  processing: 'قيد التجهيز',
  shipped: 'تم الشحن',
  delivered: 'تم التوصيل',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};

function getStatusIndex(status: string): number {
  const index = statusSteps.findIndex(s => s.key === status);
  return index >= 0 ? index : -1;
}

interface OrderItemWithName {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  price: string;
  productName: string;
  selectedSize?: string | null;
  selectedColor?: string | null;
  customPrinting?: boolean;
  designNotes?: string | null;
}

export default function Orders() {
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItemWithName[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // فلتر الحالة من URL (?status=pending|processing|shipped|delivered|completed|cancelled|all)
  const initialStatus = (() => {
    if (typeof window === "undefined") return "all";
    const s = new URLSearchParams(window.location.search).get("status") || "all";
    return s;
  })();
  const [statusFilter, setStatusFilter] = useState(initialStatus);

  // مزامنة فلتر الحالة مع URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const current = url.searchParams.get("status") || "all";
    if (current !== statusFilter) {
      if (statusFilter === "all") url.searchParams.delete("status");
      else url.searchParams.set("status", statusFilter);
      window.history.replaceState({}, "", url.toString());
    }
  }, [statusFilter]);

  const { data: allOrders, isLoading } = useQuery<Order[]>({
    queryKey: ['/api/orders'],
  });

  // تصفية الطلبات حسب الحالة المحددة
  const orders = (() => {
    if (!allOrders) return undefined;
    if (statusFilter === "all") return allOrders;
    return allOrders.filter(o => o.status === statusFilter);
  })();

  // إحصاء عدد الطلبات لكل حالة (لعرضه في تبويبات الفلتر)
  const statusCounts = (allOrders || []).reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    acc.all = (acc.all || 0) + 1;
    return acc;
  }, {});

  const handlePrintInvoice = async (order: Order) => {
    setLoadingItems(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/items`);
      if (res.ok) {
        const items = await res.json();
        setOrderItems(items);
      }
    } catch (error) {
      console.error("Failed to fetch order items:", error);
    }
    setLoadingItems(false);
    setSelectedOrderForInvoice(order);
  };

  const formatPrice = (price: string | number | null) => {
    if (!price) return '0';
    return Number(price).toLocaleString('ar-YE');
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('ar-YE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <ShoppingBag className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-2xl font-bold mb-2">لا توجد طلبات</h2>
        <p className="text-muted-foreground mb-6">لم تقم بأي طلبات بعد</p>
        <Link href="/products">
          <Button>تصفح المنتجات</Button>
        </Link>
      </div>
    );
  }

  // تبويبات الفلتر مرتّبة بالحالات الأكثر استخداماً
  const filterTabs = [
    { key: "all", label: "الكل" },
    { key: "pending", label: "قيد الانتظار" },
    { key: "processing", label: "قيد التجهيز" },
    { key: "shipped", label: "تم الشحن" },
    { key: "delivered", label: "تم التوصيل" },
    { key: "completed", label: "مكتمل" },
    { key: "cancelled", label: "ملغي" },
  ];

  return (
    <div className="container mx-auto px-4 py-6 pb-24">
      <h1 className="text-2xl font-bold mb-4 dark:text-foreground">طلباتي</h1>

      {/* شريط الفلترة الأفقي القابل للتمرير */}
      <div className="mb-5 -mx-4 px-4 overflow-x-auto scrollbar-hide" data-testid="orders-filter-bar">
        <div className="flex gap-2 min-w-max pb-1">
          {filterTabs.map(tab => {
            const count = statusCounts[tab.key] || 0;
            const active = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-all border ${
                  active
                    ? "bg-[#1a3a4a] text-white border-[#1a3a4a] shadow-md"
                    : "bg-white dark:bg-card text-gray-700 dark:text-foreground border-gray-200 dark:border-border hover:border-gray-300"
                }`}
                data-testid={`filter-status-${tab.key}`}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className={`mr-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold ${
                      active
                        ? "bg-white/25 text-white"
                        : "bg-gray-100 dark:bg-muted text-gray-600 dark:text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-6">
        {orders.map((order) => {
          const currentStatusIndex = getStatusIndex(order.status);
          const isCancelled = order.status === 'cancelled';
          
          return (
            <Card key={order.id} data-testid={`card-order-${order.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <CardTitle className="text-lg">طلب #{order.id}</CardTitle>
                  <Badge className={statusColors[order.status]}>
                    {statusLabels[order.status] || order.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{formatDate(order.createdAt)}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isCancelled && order.status !== 'completed' && (
                  <div className="py-4">
                    <div className="flex items-center justify-between relative">
                      {statusSteps.map((step, index) => {
                        const StepIcon = step.icon;
                        const isActive = index <= currentStatusIndex;
                        const isCurrent = index === currentStatusIndex;
                        
                        return (
                          <div key={step.key} className="flex flex-col items-center relative z-10">
                            <div 
                              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                                isActive 
                                  ? 'bg-primary text-white' 
                                  : 'bg-gray-200 text-gray-500'
                              } ${isCurrent ? 'ring-4 ring-primary/30' : ''}`}
                            >
                              <StepIcon className="h-5 w-5" />
                            </div>
                            <span className={`text-xs mt-2 text-center max-w-16 ${isActive ? 'font-medium' : 'text-muted-foreground'}`}>
                              {step.label}
                            </span>
                          </div>
                        );
                      })}
                      <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 -z-0">
                        <div 
                          className="h-full bg-primary transition-all"
                          style={{ width: `${(currentStatusIndex / (statusSteps.length - 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {isCancelled && (
                  <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg">
                    <XCircle className="h-6 w-6 text-red-600" />
                    <span className="text-red-800 font-medium">تم إلغاء هذا الطلب</span>
                  </div>
                )}

                {order.status === 'completed' && (
                  <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                    <span className="text-green-800 font-medium">تم إكمال الطلب بنجاح</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{order.shippingCity || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span dir="ltr">{order.customerPhone || '-'}</span>
                  </div>
                </div>

                {order.trackingNumber && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <span className="font-medium">رقم التتبع: </span>
                      <span dir="ltr">{order.trackingNumber}</span>
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-muted-foreground">الإجمالي</span>
                  <span className="text-xl font-bold text-primary">
                    {formatPrice(order.total)} {order.currency === 'SAR' ? 'ر.س' : 'ر.ي'}
                  </span>
                </div>

                <Button 
                  variant="outline" 
                  className="w-full gap-2 mt-2"
                  onClick={() => handlePrintInvoice(order)}
                  disabled={loadingItems}
                  data-testid={`button-print-invoice-${order.id}`}
                >
                  {loadingItems ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Printer className="h-4 w-4" />
                  )}
                  طباعة الفاتورة
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedOrderForInvoice && (
        <PrintableInvoice
          order={selectedOrderForInvoice}
          orderItems={orderItems}
          onClose={() => {
            setSelectedOrderForInvoice(null);
            setOrderItems([]);
          }}
        />
      )}
    </div>
  );
}
