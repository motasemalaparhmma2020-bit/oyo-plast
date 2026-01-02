import { useAuth } from "@/hooks/use-auth";
import { useOrders } from "@/hooks/use-orders";
import { Button } from "@/components/ui/button";
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
        {/* Header */}
        <div className="bg-white dark:bg-card px-4 py-3 flex items-center justify-between border-b">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" data-testid="button-settings">
              <Settings className="h-5 w-5 text-gray-600" strokeWidth={1.5} />
            </Button>
            <Button variant="ghost" size="icon" data-testid="button-scan">
              <ScanLine className="h-5 w-5 text-gray-600" strokeWidth={1.5} />
            </Button>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>ملفي الشخصي</span>
            <User className="h-4 w-4" strokeWidth={1.5} />
          </div>
        </div>

        {/* Login Prompt */}
        <div className="bg-white dark:bg-card p-8 text-center mt-2">
          <div className="w-20 h-20 bg-gray-100 dark:bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="h-10 w-10 text-gray-400" strokeWidth={1.5} />
          </div>
          <h2 className="text-lg font-bold mb-2">مرحباً بك في أويو بلاست</h2>
          <p className="text-sm text-gray-500 mb-4">سجل دخولك للوصول إلى حسابك وتتبع طلباتك</p>
          <Link href="/auth">
            <Button className="rounded-full px-8 bg-primary" data-testid="button-login">
              تسجيل الدخول
            </Button>
          </Link>
        </div>

        {/* Quick Actions - Disabled State */}
        <div className="bg-white dark:bg-card px-4 py-6 mt-2 border-t border-b">
          <div className="grid grid-cols-4 gap-4 opacity-50">
            {[
              { icon: Ticket, label: "كوبونات" },
              { icon: Star, label: "نقاط" },
              { icon: Wallet, label: "محفظة" },
              { icon: Gift, label: "بطاقة هدية" },
            ].map((action, index) => (
              <div key={index} className="flex flex-col items-center gap-2">
                <action.icon className="h-7 w-7 text-gray-600" strokeWidth={1.5} />
                <span className="text-xs text-gray-600">{action.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Calculate order counts from database
  const pendingOrders = orders?.filter(o => o.status === 'pending').length || 0;
  const processingOrders = orders?.filter(o => o.status === 'processing').length || 0;
  const shippedOrders = orders?.filter(o => o.status === 'shipped').length || 0;
  const reviewOrders = orders?.filter(o => o.status === 'review').length || 0;
  const returnedOrders = orders?.filter(o => o.status === 'returned' || o.status === 'cancelled').length || 0;
  const totalOrders = orders?.length || 0;

  const quickActions = [
    { icon: Ticket, label: "كوبونات", value: "0", href: "/marketer/coupons" },
    { icon: Star, label: "نقاط", value: "0", href: "/account" },
    { icon: Wallet, label: "محفظة", value: null, href: "/account" },
    { icon: Gift, label: "بطاقة هدية", value: null, href: null },
  ];

  const orderStatuses = [
    { icon: CreditCard, label: "غير مدفوع", count: pendingOrders, status: "pending" },
    { icon: Package, label: "قيد التجهيز", count: processingOrders, status: "processing" },
    { icon: Truck, label: "تم الشحن", count: shippedOrders, status: "shipped" },
    { icon: MessageSquare, label: "تعليق", count: reviewOrders, status: "review" },
    { icon: RotateCcw, label: "المنتجات المسترجعة", count: returnedOrders, status: "returned" },
  ];

  const bottomActions = [
    { icon: Heart, label: "قائمة الأماني", count: 0, suffix: "منتج" },
    { icon: Users, label: "متابع", count: 0, suffix: "متابع" },
    { icon: History, label: "تاريخ", count: totalOrders, suffix: "منتج" },
  ];

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-background pb-20">
      {/* Header */}
      <div className="bg-white dark:bg-card px-4 py-3 flex items-center justify-between border-b">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" data-testid="button-settings">
            <Settings className="h-5 w-5 text-gray-600" strokeWidth={1.5} />
          </Button>
          <Button variant="ghost" size="icon" data-testid="button-scan">
            <ScanLine className="h-5 w-5 text-gray-600" strokeWidth={1.5} />
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>ملفي الشخصي</span>
          <User className="h-4 w-4" strokeWidth={1.5} />
        </div>
      </div>

      {/* Quick Actions - Top Bar */}
      <div className="bg-white dark:bg-card px-4 py-6 border-b">
        <div className="grid grid-cols-4 gap-4">
          {quickActions.map((action, index) => {
            const content = (
              <>
                <div className="relative">
                  <action.icon className="h-7 w-7 text-gray-700 dark:text-gray-300" strokeWidth={1.5} />
                </div>
                {action.value !== null && (
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{action.value}</span>
                )}
                <span className="text-xs text-gray-600 dark:text-gray-400">{action.label}</span>
              </>
            );
            
            return action.href ? (
              <Link key={index} href={action.href}>
                <div 
                  className="flex flex-col items-center gap-2 hover-elevate active-elevate-2 rounded-lg p-2 cursor-pointer"
                  data-testid={`quick-action-${action.label}`}
                >
                  {content}
                </div>
              </Link>
            ) : (
              <div 
                key={index} 
                className="flex flex-col items-center gap-2 rounded-lg p-2 opacity-50"
                data-testid={`quick-action-${action.label}`}
              >
                {content}
              </div>
            );
          })}
        </div>
      </div>

      {/* My Orders Section */}
      <div className="bg-white dark:bg-card mt-2">
        <div className="px-4 py-3 flex items-center justify-between border-b">
          <Link href="/orders" className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary transition-colors">
            <span>الاراء الكاملة</span>
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <h3 className="font-bold text-gray-800 dark:text-foreground">طلبي</h3>
        </div>
        
        <div className="px-2 py-4">
          <div className="grid grid-cols-5 gap-1">
            {orderStatuses.map((status, index) => (
              <button 
                key={index} 
                className="flex flex-col items-center gap-2 relative p-2 hover-elevate active-elevate-2 rounded-lg"
                data-testid={`order-status-${status.status}`}
              >
                <div className="relative">
                  <status.icon className="h-6 w-6 text-gray-700 dark:text-gray-300" strokeWidth={1.5} />
                  {status.count > 0 && (
                    <span className="absolute -top-2 -right-2 h-5 min-w-5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-medium px-1">
                      {status.count}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-gray-600 dark:text-gray-400 text-center leading-tight">{status.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Actions - Personal Lists */}
      <div className="bg-white dark:bg-card mt-2">
        <div className="grid grid-cols-3 divide-x divide-x-reverse divide-gray-200 dark:divide-border">
          {bottomActions.map((action, index) => (
            <button 
              key={index} 
              className="flex flex-col items-center justify-center py-4 hover-elevate active-elevate-2"
              data-testid={`bottom-action-${action.label}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <action.icon className="h-5 w-5 text-gray-700 dark:text-gray-300" strokeWidth={1.5} />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{action.label}</span>
                <ChevronLeft className="h-4 w-4 text-gray-400" />
              </div>
              <span className="text-xs text-gray-500">
                {action.count} {action.suffix}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* User Info Card */}
      <div className="bg-white dark:bg-card mt-2 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center border-2 border-primary/20">
              {user?.profileImageUrl ? (
                <img src={user.profileImageUrl} alt="Profile" className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className="text-xl font-bold text-primary">
                  {user?.firstName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "م"}
                </span>
              )}
            </div>
            <div>
              <h3 className="font-bold text-gray-800 dark:text-foreground">
                {user?.firstName && user?.lastName 
                  ? `${user.firstName} ${user.lastName}` 
                  : user?.firstName || user?.email?.split('@')[0] || "مستخدم"}
              </h3>
              <p className="text-xs text-gray-500">{user?.email || ""}</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => logout()}
            className="gap-2 text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
            خروج
          </Button>
        </div>
      </div>

      {/* Recent Orders Preview */}
      {orders && orders.length > 0 && (
        <div className="bg-white dark:bg-card mt-2 p-4">
          <div className="flex items-center justify-between mb-3">
            <Link href="/orders" className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary">
              <span>عرض الكل</span>
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <h3 className="font-bold text-gray-800 dark:text-foreground">آخر الطلبات</h3>
          </div>
          <div className="space-y-3">
            {orders.slice(0, 3).map((order) => (
              <div 
                key={order.id} 
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-muted rounded-lg hover-elevate"
                data-testid={`order-item-${order.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Package className="h-5 w-5 text-primary" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-gray-800 dark:text-foreground">طلب #{order.id}</p>
                    <p className="text-xs text-gray-500">
                      {order.status === 'pending' && 'غير مدفوع'}
                      {order.status === 'processing' && 'قيد التجهيز'}
                      {order.status === 'shipped' && 'تم الشحن'}
                      {order.status === 'completed' && 'مكتمل'}
                      {order.status === 'cancelled' && 'ملغي'}
                      {order.status === 'review' && 'تعليق'}
                      {order.status === 'returned' && 'مسترجع'}
                    </p>
                  </div>
                </div>
                <div className="text-left">
                  <span className="font-bold text-primary text-sm">
                    {Number(order.total).toLocaleString()}
                  </span>
                  <span className="text-xs text-gray-500 mr-1">ر.ي</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading State for Orders */}
      {isOrdersLoading && (
        <div className="bg-white dark:bg-card mt-2 p-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}
