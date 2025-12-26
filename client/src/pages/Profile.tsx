import { useAuth } from "@/hooks/use-auth";
import { useOrders } from "@/hooks/use-orders";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { 
  Loader2, 
  Settings, 
  ScanLine, 
  Ticket, 
  Star, 
  Wallet, 
  Gift,
  CreditCard,
  Package,
  Truck,
  MessageSquare,
  RotateCcw,
  Heart,
  Users,
  History,
  ChevronLeft,
  User,
  LogOut
} from "lucide-react";

export default function Profile() {
  const { user, isLoading: isAuthLoading, logout, isAuthenticated } = useAuth();
  const { data: orders, isLoading: isOrdersLoading } = useOrders();

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex justify-center items-center pb-20">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-background pb-20">
        <div className="bg-white dark:bg-card p-6 text-center">
          <div className="w-20 h-20 bg-gray-100 dark:bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="h-10 w-10 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-bold mb-2">مرحباً بك</h2>
          <p className="text-sm text-muted-foreground mb-4">سجل دخولك للوصول إلى حسابك</p>
          <Link href="/auth">
            <Button className="rounded-full px-8" data-testid="button-login">
              تسجيل الدخول
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const pendingOrders = orders?.filter(o => o.status === 'pending').length || 0;
  const processingOrders = orders?.filter(o => o.status === 'processing').length || 0;
  const shippedOrders = orders?.filter(o => o.status === 'shipped').length || 0;
  const completedOrders = orders?.filter(o => o.status === 'completed').length || 0;

  const quickActions = [
    { icon: Ticket, label: "كوبونات", count: 0 },
    { icon: Star, label: "نقاط", count: 0 },
    { icon: Wallet, label: "محفظة", count: null },
    { icon: Gift, label: "بطاقة هدية", count: null },
  ];

  const orderStatuses = [
    { icon: CreditCard, label: "غير مدفوع", count: pendingOrders },
    { icon: Package, label: "قيد التجهيز", count: processingOrders },
    { icon: Truck, label: "تم الشحن", count: shippedOrders },
    { icon: MessageSquare, label: "تعليق", count: 0 },
    { icon: RotateCcw, label: "المنتجات المسترجعة", count: 0 },
  ];

  const bottomActions = [
    { icon: Heart, label: "قائمة الأماني", count: 0, suffix: "منتج" },
    { icon: Users, label: "متابع", count: 0, suffix: "متابع" },
    { icon: History, label: "تاريخ", count: orders?.length || 0, suffix: "منتج" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background pb-20">
      {/* Header */}
      <div className="bg-white dark:bg-card px-4 py-3 flex items-center justify-between border-b">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" data-testid="button-settings">
            <Settings className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" data-testid="button-scan">
            <ScanLine className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>ملفي الشخصي</span>
          <User className="h-4 w-4" />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-card px-4 py-6 border-b">
        <div className="grid grid-cols-4 gap-4">
          {quickActions.map((action, index) => (
            <button 
              key={index} 
              className="flex flex-col items-center gap-2"
              data-testid={`quick-action-${index}`}
            >
              <div className="relative">
                <action.icon className="h-7 w-7 text-foreground" strokeWidth={1.5} />
                {action.count !== null && action.count > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-5 min-w-5 flex items-center justify-center p-0 text-[10px]">
                    {action.count}
                  </Badge>
                )}
              </div>
              <span className="text-xs text-foreground">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* My Orders Section */}
      <div className="bg-white dark:bg-card mt-2 border-b">
        <div className="px-4 py-3 flex items-center justify-between border-b">
          <Link href="/orders" className="flex items-center gap-1 text-sm text-muted-foreground">
            <span>الاراء الكاملة</span>
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <h3 className="font-bold">طلبي</h3>
        </div>
        
        <div className="px-4 py-4">
          <div className="grid grid-cols-5 gap-2">
            {orderStatuses.map((status, index) => (
              <button 
                key={index} 
                className="flex flex-col items-center gap-2 relative"
                data-testid={`order-status-${index}`}
              >
                <div className="relative">
                  <status.icon className="h-6 w-6 text-foreground" strokeWidth={1.5} />
                  {status.count > 0 && (
                    <Badge className="absolute -top-2 -right-2 h-4 min-w-4 flex items-center justify-center p-0 text-[10px] bg-red-500">
                      {status.count}
                    </Badge>
                  )}
                </div>
                <span className="text-[10px] text-foreground text-center leading-tight">{status.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="bg-white dark:bg-card mt-2 border-b">
        <div className="grid grid-cols-3 divide-x divide-x-reverse">
          {bottomActions.map((action, index) => (
            <button 
              key={index} 
              className="flex items-center justify-center gap-2 py-4"
              data-testid={`bottom-action-${index}`}
            >
              <div className="flex items-center gap-1 text-sm">
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{action.label}</span>
                <action.icon className="h-4 w-4" />
              </div>
              <div className="text-xs text-muted-foreground">
                {action.count} {action.suffix}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* User Info & Logout */}
      <div className="bg-white dark:bg-card mt-2 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <span className="text-lg font-bold text-primary">
                {user?.firstName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "م"}
              </span>
            </div>
            <div>
              <h3 className="font-bold">{user?.firstName || user?.email?.split('@')[0] || "مستخدم"}</h3>
              <p className="text-xs text-muted-foreground">{user?.email || ""}</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => logout()}
            className="gap-2 text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
            خروج
          </Button>
        </div>
      </div>

      {/* Recent Orders */}
      {orders && orders.length > 0 && (
        <div className="bg-white dark:bg-card mt-2 p-4">
          <h3 className="font-bold mb-3">آخر الطلبات</h3>
          <div className="space-y-3">
            {orders.slice(0, 3).map((order) => (
              <div 
                key={order.id} 
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-muted rounded-lg"
                data-testid={`order-item-${order.id}`}
              >
                <div className="flex items-center gap-3">
                  <Package className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-bold text-sm">طلب #{order.id}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.status === 'pending' && 'في الانتظار'}
                      {order.status === 'processing' && 'قيد التجهيز'}
                      {order.status === 'shipped' && 'تم الشحن'}
                      {order.status === 'completed' && 'مكتمل'}
                      {order.status === 'cancelled' && 'ملغي'}
                    </p>
                  </div>
                </div>
                <span className="font-bold text-primary text-sm">
                  {Number(order.total).toLocaleString()} ر.ي
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
