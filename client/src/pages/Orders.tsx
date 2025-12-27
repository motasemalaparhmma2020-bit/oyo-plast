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
  ShoppingBag
} from "lucide-react";

const statusSteps = [
  { key: 'pending', label: 'قيد الانتظار', icon: Clock },
  { key: 'deposit_paid', label: 'تم دفع العربون', icon: DollarSign },
  { key: 'processing', label: 'قيد التجهيز', icon: Package },
  { key: 'shipped', label: 'تم الشحن', icon: TrendingUp },
  { key: 'delivered', label: 'تم التوصيل', icon: CheckCircle },
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

export default function Orders() {
  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ['/api/orders'],
  });

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

  return (
    <div className="container mx-auto px-4 py-6 pb-24">
      <h1 className="text-2xl font-bold mb-6">طلباتي</h1>
      
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
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
