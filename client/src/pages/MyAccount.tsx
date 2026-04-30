import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { WhyUsSection, StatsSection, FaqSection } from "@/components/HomeSections";
import { Link } from "wouter";
import { 
  ShoppingBag, Wallet, Award, ChevronLeft, Package, Clock, 
  CheckCircle2, Truck, XCircle, Loader2, Eye, ArrowUpRight, ArrowDownLeft,
  UserPlus, LogIn, ChevronDown, ChevronUp, Megaphone, TrendingUp, Tag, ExternalLink,
  CreditCard
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import type { Order, Wallet as WalletType, WalletTransaction, RewardPoints, PointsTransaction } from "@shared/schema";
import oyoLogo from "@assets/FB_IMG_1748731871206_1766877101101.jpg";

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
  pending: { label: "قيد الانتظار", icon: Clock, color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" },
  deposit_paid: { label: "تم دفع العربون", icon: Wallet, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  processing: { label: "جاري التجهيز", icon: Package, color: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  shipped: { label: "تم الشحن", icon: Truck, color: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
  delivered: { label: "تم التوصيل", icon: CheckCircle2, color: "bg-green-500/10 text-green-600 dark:text-green-400" },
  completed: { label: "مكتمل", icon: CheckCircle2, color: "bg-green-500/10 text-green-600 dark:text-green-400" },
  cancelled: { label: "ملغي", icon: XCircle, color: "bg-red-500/10 text-red-600 dark:text-red-400" },
};

const COLOR_MAP: Record<string, string> = {
  أبيض: "#FFFFFF", أسود: "#000000", أحمر: "#EF4444", أزرق: "#3B82F6",
  أخضر: "#22C55E", أصفر: "#EAB308", برتقالي: "#F97316", وردي: "#EC4899",
  بنفسجي: "#8B5CF6", رمادي: "#6B7280", بني: "#92400E", ذهبي: "#D97706",
  فضي: "#9CA3AF", شفاف: "transparent", سماوي: "#06B6D4", زهري: "#F472B6",
  كحلي: "#1E3A8A", بيج: "#D4A574",
};
function getColorHex(c: string | null | undefined) {
  if (!c) return "transparent";
  if (c.startsWith("#")) return c;
  return COLOR_MAP[c] || "#888888";
}

function CreditAccountCard() {
  const { isAuthenticated } = useAuth();
  const { data: credit } = useQuery<any>({
    queryKey: ["/api/my/credit"],
    enabled: isAuthenticated,
    retry: false,
    staleTime: 30_000,
  });
  if (!credit || Number(credit?.effective_credit_limit ?? 0) <= 0) return null;

  const tierName = credit.tier_name_ar || "برونزي";
  const tierIcon = credit.tier_icon || "🥉";
  const tierColor = credit.tier_color || "#cd7f32";
  const limit = Number(credit.effective_credit_limit ?? 0);
  const balance = Number(credit.current_balance ?? 0);
  const available = Number(credit.available_credit ?? 0);
  const isFrozen = credit.is_frozen === true;

  return (
    <Link href="/account/credit">
      <Card
        className="mb-6 border-2 cursor-pointer hover-elevate transition-all"
        style={{ borderColor: tierColor }}
        data-testid="card-credit-summary"
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center text-2xl"
                style={{ background: `${tierColor}25` }}
              >
                {tierIcon}
              </div>
              <div>
                <p className="font-bold text-sm flex items-center gap-1">
                  حسابي المالي
                  {isFrozen && <Badge className="bg-cyan-100 text-cyan-700 text-[10px] px-1.5">مجمَّد</Badge>}
                </p>
                <p className="text-xs" style={{ color: tierColor }}>
                  فئة {tierName}
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="gap-1" data-testid="button-go-credit">
              التفاصيل
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-2 text-center border border-green-100 dark:border-green-900">
              <p className="text-[10px] text-green-700 dark:text-green-400">المتاح</p>
              <p className="text-xs font-bold text-green-700 dark:text-green-300">
                {available.toLocaleString()}
              </p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2 text-center border border-amber-100 dark:border-amber-900">
              <p className="text-[10px] text-amber-700 dark:text-amber-400">المستحق</p>
              <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                {balance.toLocaleString()}
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-2 text-center border border-blue-100 dark:border-blue-900">
              <p className="text-[10px] text-blue-700 dark:text-blue-400">السقف</p>
              <p className="text-xs font-bold text-blue-700 dark:text-blue-300">
                {limit.toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function OrderItemsRow({ orderId }: { orderId: number }) {
  const { data: items = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/orders", orderId, "items"],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${orderId}/items`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
  });
  if (isLoading) return <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  if (!items.length) return <p className="text-xs text-center text-muted-foreground py-2">لا توجد تفاصيل</p>;
  return (
    <div className="mt-3 border-t pt-3 space-y-2">
      <p className="text-xs font-bold text-muted-foreground flex items-center gap-1">
        <Package className="h-3.5 w-3.5" /> المنتجات
      </p>
      {items.map((item: any) => (
        <div key={item.id} className="flex items-center gap-2 bg-muted/30 rounded-lg p-2">
          {item.productId && (
            <img
              src={`/api/products/image/${item.productId}`}
              alt=""
              className="w-9 h-9 rounded-md object-cover border shrink-0"
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">
              {(item.productName && item.productName !== "null") ? item.productName : item.productId ? `منتج #${item.productId}` : "منتج محذوف"}
            </p>
            <div className="flex flex-wrap items-center gap-1 mt-0.5">
              {item.selectedSize && (
                <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">📐 {item.selectedSize}</span>
              )}
              {item.selectedColor && (
                <span className="flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-1.5 py-0.5 rounded-full">
                  <span className="w-2.5 h-2.5 rounded-full border border-gray-300 shrink-0" style={{ backgroundColor: getColorHex(item.selectedColor) }} />
                  {!item.selectedColor.startsWith("#") && item.selectedColor}
                </span>
              )}
            </div>
          </div>
          <div className="text-left shrink-0">
            <p className="text-xs font-bold">×{item.quantity}</p>
            <p className="text-xs text-muted-foreground">{(Number(item.price) * item.quantity).toLocaleString()} ر.ي</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MyAccount() {
  const { isAuthenticated } = useAuth();
  // قراءة التبويب من URL (?tab=wallet|orders|points)
  const initialTab = (() => {
    if (typeof window === "undefined") return "orders";
    const t = new URLSearchParams(window.location.search).get("tab");
    return t === "wallet" || t === "points" || t === "orders" ? t : "orders";
  })();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);

  // مزامنة التبويب مع URL عند التغيير (دون إعادة تحميل)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("tab") !== activeTab) {
      url.searchParams.set("tab", activeTab);
      window.history.replaceState({}, "", url.toString());
    }
  }, [activeTab]);

  const { data: marketerAccount } = useQuery<any>({
    queryKey: ["/api/marketer/linked-account"],
    enabled: isAuthenticated,
    retry: false,
  });

  const { data: accountSummary, isLoading: summaryLoading } = useQuery<{
    wallet: { balanceYer: string; balanceSar: string };
    points: { current: number; lifetime: number };
    orders: { total: number; pending: number; completed: number };
  }>({
    queryKey: ["/api/account/summary"],
  });

  const { data: displaySettings } = useQuery<any>({
    queryKey: ["/api/display-settings"],
    staleTime: 60_000,
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const { data: wallet, isLoading: walletLoading } = useQuery<WalletType>({
    queryKey: ["/api/wallet"],
  });

  const { data: walletTransactions = [], isLoading: walletTxLoading } = useQuery<WalletTransaction[]>({
    queryKey: ["/api/wallet/transactions"],
  });

  const { data: points, isLoading: pointsLoading } = useQuery<RewardPoints>({
    queryKey: ["/api/points"],
  });

  const { data: pointsTransactions = [], isLoading: pointsTxLoading } = useQuery<PointsTransaction[]>({
    queryKey: ["/api/points/transactions"],
  });

  const formatCurrency = (amount: string | number, currency: string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `${num.toLocaleString('ar-YE')} ${currency === 'SAR' ? 'ر.س' : 'ر.ي'}`;
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('ar-YE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Guest view - show login/register prompt
  if (!isAuthenticated) {
    return (
      <div className="container max-w-md mx-auto px-4 py-12 pb-24">
        <div className="text-center mb-8">
          <div className="mx-auto w-24 h-24 mb-4">
            <img src={oyoLogo} alt="OYO PLAST" className="w-full h-full object-contain rounded-2xl shadow-lg" />
          </div>
          <h1 className="text-3xl font-bold mb-2">حسابي</h1>
          <p className="text-muted-foreground">سجل دخولك للوصول لحسابك</p>
        </div>

        <Card className="border-none shadow-xl">
          <CardContent className="pt-6 space-y-4">
            <div className="text-center mb-4">
              <p className="text-muted-foreground">
                سجل دخولك أو أنشئ حساب جديد للوصول إلى:
              </p>
            </div>

            <div className="grid gap-3 mb-6">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5">
                <ShoppingBag className="h-5 w-5 text-primary" />
                <span>تتبع طلباتك ومشترياتك</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/5">
                <Wallet className="h-5 w-5 text-green-500" />
                <span>محفظتك الإلكترونية</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-500/5">
                <Award className="h-5 w-5 text-yellow-500" />
                <span>نقاط الولاء والمكافآت</span>
              </div>
            </div>

            <Link href="/auth">
              <Button 
                className="w-full h-12 text-lg font-bold shadow-lg bg-[#2196F3] hover:bg-[#1976D2]"
                data-testid="button-login"
              >
                <LogIn className="h-5 w-5 ml-2" />
                تسجيل الدخول
              </Button>
            </Link>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">أو</span>
              </div>
            </div>

            <Link href="/register">
              <Button 
                variant="outline"
                className="w-full h-12 text-lg font-bold border-2 border-[#2196F3] text-[#2196F3]"
                data-testid="button-register"
              >
                <UserPlus className="h-5 w-5 ml-2" />
                إنشاء حساب جديد
              </Button>
            </Link>

            <Link href="/guest-checkout">
              <Button 
                variant="ghost"
                className="w-full h-10 text-sm text-muted-foreground"
                data-testid="button-guest-checkout"
              >
                <ShoppingBag className="h-4 w-4 ml-2" />
                أكمل الشراء كزائر
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (summaryLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/">
          <Button variant="ghost" size="icon" data-testid="button-back-home">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">حسابي</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card 
          className={`cursor-pointer transition-all ${activeTab === 'orders' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setActiveTab('orders')}
          data-testid="card-orders-summary"
        >
          <CardContent className="p-4 text-center">
            <ShoppingBag className="h-6 w-6 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">{accountSummary?.orders.total || 0}</p>
            <p className="text-xs text-muted-foreground">طلباتي</p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all ${activeTab === 'wallet' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setActiveTab('wallet')}
          data-testid="card-wallet-summary"
        >
          <CardContent className="p-4 text-center">
            <Wallet className="h-6 w-6 mx-auto mb-2 text-green-500" />
            <p className="text-lg font-bold">{parseFloat(accountSummary?.wallet.balanceYer || '0').toLocaleString('ar-YE')}</p>
            <p className="text-xs text-muted-foreground">محفظتي (ر.ي)</p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all ${activeTab === 'points' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setActiveTab('points')}
          data-testid="card-points-summary"
        >
          <CardContent className="p-4 text-center">
            <Award className="h-6 w-6 mx-auto mb-2 text-yellow-500" />
            <p className="text-2xl font-bold">{accountSummary?.points.current || 0}</p>
            <p className="text-xs text-muted-foreground">نقاطي</p>
          </CardContent>
        </Card>
      </div>

      {/* بطاقة "حسابي المالي" — الشراء بالأجل والائتمان */}
      <CreditAccountCard />

      {/* بطاقة حساب المسوق — تظهر إذا كان المستخدم مسوقاً مرتبطاً */}
      {marketerAccount && (
        <Card className="mb-6 border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 dark:border-emerald-800" data-testid="card-marketer-account">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center">
                  <Megaphone className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-emerald-800 dark:text-emerald-300 text-sm">حسابي التسويقي</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">مسوّق معتمد</p>
                </div>
              </div>
              <Link href="/marketer/dashboard">
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1" data-testid="button-go-marketer-dashboard">
                  لوحة التحكم
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white dark:bg-card rounded-lg p-2 text-center border border-emerald-100 dark:border-emerald-800">
                <Tag className="h-4 w-4 mx-auto mb-1 text-emerald-600" />
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{marketerAccount.couponCode}</p>
                <p className="text-[10px] text-muted-foreground">كوبونك</p>
              </div>
              <div className="bg-white dark:bg-card rounded-lg p-2 text-center border border-emerald-100 dark:border-emerald-800">
                <Wallet className="h-4 w-4 mx-auto mb-1 text-emerald-600" />
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{parseFloat(marketerAccount.walletBalance || '0').toLocaleString()} ر.ي</p>
                <p className="text-[10px] text-muted-foreground">رصيدك</p>
              </div>
              <div className="bg-white dark:bg-card rounded-lg p-2 text-center border border-emerald-100 dark:border-emerald-800">
                <TrendingUp className="h-4 w-4 mx-auto mb-1 text-emerald-600" />
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{marketerAccount.totalOrders || 0}</p>
                <p className="text-[10px] text-muted-foreground">طلباتك</p>
              </div>
            </div>
            {!marketerAccount.contractAcceptedAt && (
              <div className="mt-3 flex items-center gap-2 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-2">
                <span className="text-yellow-600 text-lg">⚠️</span>
                <div className="flex-1">
                  <p className="text-xs font-bold text-yellow-800 dark:text-yellow-300">لم تقبل عقد الشراكة بعد</p>
                  <p className="text-[10px] text-yellow-600">سجّل دخولك للوحة المسوّق لقبول العقد</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabs Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="orders" data-testid="tab-orders">طلباتي</TabsTrigger>
          <TabsTrigger value="wallet" data-testid="tab-wallet">محفظتي</TabsTrigger>
          <TabsTrigger value="points" data-testid="tab-points">نقاطي</TabsTrigger>
        </TabsList>

        {/* Orders Tab */}
        <TabsContent value="orders" className="space-y-4">
          {ordersLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : orders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">لا توجد طلبات بعد</p>
                <Link href="/">
                  <Button data-testid="button-start-shopping">ابدأ التسوق</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            orders.map((order) => {
              const status = statusConfig[order.status] || statusConfig.pending;
              const StatusIcon = status.icon;
              const isExpanded = expandedOrder === order.id;
              return (
                <Card key={order.id} data-testid={`order-card-${order.id}`} className="overflow-hidden">
                  <CardContent className="p-0">
                    {/* رأس الطلب */}
                    <button
                      type="button"
                      className="w-full text-right p-4 hover:bg-muted/30 transition-colors"
                      onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                      data-testid={`button-expand-order-${order.id}`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base">طلب #{order.id}</span>
                          <Badge className={status.color}>
                            <StatusIcon className="h-3 w-3 ml-1" />
                            {status.label}
                          </Badge>
                        </div>
                        {isExpanded
                          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        }
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">{formatDate(order.createdAt)}</span>
                        <span className="font-bold text-primary text-base">
                          {formatCurrency(order.total, order.currency)}
                        </span>
                      </div>
                      {order.trackingNumber && (
                        <p className="text-xs text-muted-foreground mt-1 text-right">
                          📦 رقم التتبع: {order.trackingNumber}
                        </p>
                      )}
                    </button>

                    {/* تفاصيل المنتجات عند التوسع */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t bg-muted/10">
                        <OrderItemsRow orderId={order.id} />
                        <div className="mt-3 flex gap-2">
                          <Link href="/orders" className="flex-1">
                            <Button variant="outline" size="sm" className="w-full gap-1" data-testid={`button-view-order-${order.id}`}>
                              <Eye className="h-3.5 w-3.5" />
                              عرض الطلب كاملاً
                            </Button>
                          </Link>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* Wallet Tab */}
        <TabsContent value="wallet" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Wallet className="h-5 w-5 text-green-500" />
                رصيد المحفظة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {parseFloat(wallet?.balanceYer || '0').toLocaleString('ar-YE')}
                  </p>
                  <p className="text-sm text-muted-foreground">ريال يمني</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {parseFloat(wallet?.balanceSar || '0').toLocaleString('ar-YE')}
                  </p>
                  <p className="text-sm text-muted-foreground">ريال سعودي</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-4">
                يمكنك استخدام رصيد المحفظة للشراء من المتجر
              </p>
            </CardContent>
          </Card>

          {/* Wallet Transactions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">سجل المعاملات</CardTitle>
            </CardHeader>
            <CardContent>
              {walletTxLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : walletTransactions.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  لا توجد معاملات بعد
                </p>
              ) : (
                <div className="space-y-3">
                  {walletTransactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between py-2 border-b last:border-0" data-testid={`wallet-tx-${tx.id}`}>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${parseFloat(tx.amount) > 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                          {parseFloat(tx.amount) > 0 ? (
                            <ArrowDownLeft className="h-4 w-4 text-green-500" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{tx.description || tx.type}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(tx.createdAt)}</p>
                        </div>
                      </div>
                      <span className={`font-bold ${parseFloat(tx.amount) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {parseFloat(tx.amount) > 0 ? '+' : ''}{parseFloat(tx.amount).toLocaleString('ar-YE')} {tx.currency === 'SAR' ? 'ر.س' : 'ر.ي'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Points Tab */}
        <TabsContent value="points" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Award className="h-5 w-5 text-yellow-500" />
                نقاط الولاء
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-yellow-500/10 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                    {points?.points || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">نقاط متاحة</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold">
                    {points?.lifetimePoints || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">إجمالي النقاط المكتسبة</p>
                </div>
              </div>
              <Separator className="my-4" />
              <div className="space-y-2 text-sm">
                <p className="font-medium">كيف تكسب النقاط؟</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    1 نقطة لكل 1000 ر.ي من المشتريات
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    5 نقاط عند كتابة تقييم
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    15 نقطة عند إضافة صورة مع التقييم
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Points Transactions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">سجل النقاط</CardTitle>
            </CardHeader>
            <CardContent>
              {pointsTxLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : pointsTransactions.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  لا توجد نقاط مكتسبة بعد. ابدأ التسوق لكسب النقاط!
                </p>
              ) : (
                <div className="space-y-3">
                  {pointsTransactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between py-2 border-b last:border-0" data-testid={`points-tx-${tx.id}`}>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${tx.points > 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                          <Award className={`h-4 w-4 ${tx.points > 0 ? 'text-green-500' : 'text-red-500'}`} />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{tx.description || tx.type}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(tx.createdAt)}</p>
                        </div>
                      </div>
                      <span className={`font-bold ${tx.points > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.points > 0 ? '+' : ''}{tx.points} نقطة
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── أقسام مفعّلة لصفحة حسابي ── */}
      {displaySettings?.showWhyUs && displaySettings?.whyUsOnAccount && (
        <WhyUsSection size={displaySettings.whyUsSize ?? "medium"} />
      )}
      {displaySettings?.showStats && displaySettings?.statsOnAccount && (
        <StatsSection size={displaySettings.statsSize ?? "medium"} />
      )}
      {displaySettings?.showFaq && displaySettings?.faqOnAccount && (
        <FaqSection size={displaySettings.faqSize ?? "medium"} />
      )}
    </div>
  );
}
