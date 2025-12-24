import { useAuth } from "@/hooks/use-auth";
import { useOrders } from "@/hooks/use-orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, Clock, CheckCircle, XCircle, User } from "lucide-react";
import { format } from "date-fns";

export default function Profile() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { data: orders, isLoading: isOrdersLoading } = useOrders();

  if (isAuthLoading || isOrdersLoading) {
    return (
      <div className="container mx-auto px-4 py-20 flex justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'completed':
        return <Badge className="bg-green-500 hover:bg-green-600 gap-1"><CheckCircle className="h-3 w-3" /> مكتمل</Badge>;
      case 'cancelled':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> ملغى</Badge>;
      default:
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> قيد المعالجة</Badge>;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 pb-20">
      <h1 className="text-3xl font-bold mb-8">الملف الشخصي</h1>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* User Info */}
        <div className="lg:col-span-1">
          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                معلوماتي
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center text-center p-4">
                <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <span className="text-3xl font-bold text-primary">
                    {user?.username?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <h2 className="text-xl font-bold">{user?.username}</h2>
                <p className="text-muted-foreground mt-1">عضو منذ {new Date().getFullYear()}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Orders History */}
        <div className="lg:col-span-2">
          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                طلباتي السابقة
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!orders || orders.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground bg-gray-50 rounded-xl border border-dashed">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>لا توجد طلبات سابقة</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div key={order.id} className="bg-white border rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-primary/50 transition-colors">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-bold text-lg">طلب #{order.id}</span>
                          {getStatusBadge(order.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {order.createdAt ? format(new Date(order.createdAt), 'yyyy-MM-dd HH:mm') : ''}
                        </p>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-lg text-primary">
                          {Number(order.total).toFixed(2)} ريال
                        </p>
                        <p className="text-xs text-muted-foreground">شامل الضريبة</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
