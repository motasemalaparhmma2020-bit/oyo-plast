import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  ShoppingBag, Wallet, Award, ChevronLeft, Package, Clock, 
  CheckCircle2, Truck, XCircle, Loader2, Eye, ArrowUpRight, ArrowDownLeft
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Order, Wallet as WalletType, WalletTransaction, RewardPoints, PointsTransaction } from "@shared/schema";

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
  pending: { label: "قيد الانتظار", icon: Clock, color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" },
  deposit_paid: { label: "تم دفع العربون", icon: Wallet, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  processing: { label: "جاري التجهيز", icon: Package, color: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  shipped: { label: "تم الشحن", icon: Truck, color: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
  delivered: { label: "تم التوصيل", icon: CheckCircle2, color: "bg-green-500/10 text-green-600 dark:text-green-400" },
  completed: { label: "مكتمل", icon: CheckCircle2, color: "bg-green-500/10 text-green-600 dark:text-green-400" },
  cancelled: { label: "ملغي", icon: XCircle, color: "bg-red-500/10 text-red-600 dark:text-red-400" },
};

export default function MyAccount() {
  const [activeTab, setActiveTab] = useState("orders");

  const { data: accountSummary, isLoading: summaryLoading } = useQuery<{
    wallet: { balanceYer: string; balanceSar: string };
    points: { current: number; lifetime: number };
    orders: { total: number; pending: number; completed: number };
  }>({
    queryKey: ["/api/account/summary"],
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
              return (
                <Card key={order.id} data-testid={`order-card-${order.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">طلب #{order.id}</span>
                        <Badge className={status.color}>
                          <StatusIcon className="h-3 w-3 ml-1" />
                          {status.label}
                        </Badge>
                      </div>
                      <Link href={`/orders`}>
                        <Button variant="ghost" size="sm" className="gap-1" data-testid={`button-view-order-${order.id}`}>
                          <Eye className="h-4 w-4" />
                          عرض
                        </Button>
                      </Link>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{formatDate(order.createdAt)}</span>
                      <span className="font-medium text-foreground">
                        {formatCurrency(order.total, order.currency)}
                      </span>
                    </div>
                    {order.trackingNumber && (
                      <p className="text-xs text-muted-foreground mt-2">
                        رقم التتبع: {order.trackingNumber}
                      </p>
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
    </div>
  );
}
