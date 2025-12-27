import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Order, Product } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { 
  ShoppingBag, 
  Package, 
  Eye, 
  Loader2, 
  Lock, 
  CheckCircle, 
  Clock, 
  XCircle,
  TrendingUp,
  DollarSign,
  Users,
  Settings,
  Save,
  Plus,
  Pencil,
  Trash2,
  X,
  ImagePlus,
  Printer
} from "lucide-react";
import PrintableInvoice from "@/components/PrintableInvoice";

const statusMap: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "قيد الانتظار", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  deposit_paid: { label: "تم دفع العربون", color: "bg-blue-100 text-blue-800", icon: DollarSign },
  processing: { label: "قيد التجهيز", color: "bg-orange-100 text-orange-800", icon: Package },
  shipped: { label: "تم الشحن", color: "bg-indigo-100 text-indigo-800", icon: TrendingUp },
  delivered: { label: "تم التوصيل", color: "bg-teal-100 text-teal-800", icon: CheckCircle },
  completed: { label: "مكتمل", color: "bg-green-100 text-green-800", icon: CheckCircle },
  cancelled: { label: "ملغي", color: "bg-red-100 text-red-800", icon: XCircle },
};

interface Category {
  id: number;
  name: string;
  slug: string;
  imageUrl: string;
}

interface ProductFormData {
  name: string;
  description: string;
  price: string;
  priceSar: string;
  categoryId: number;
  imageUrl: string;
  stock: number;
  colors: string;
  sizes: string;
  allowDesignUpload: boolean;
}

const emptyProductForm: ProductFormData = {
  name: "",
  description: "",
  price: "",
  priceSar: "",
  categoryId: 0,
  imageUrl: "",
  stock: 100,
  colors: "",
  sizes: "",
  allowDesignUpload: false
};

interface OrderItemWithName {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  price: string;
  productName: string;
}

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItemWithName[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [exchangeRate, setExchangeRate] = useState("140");
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState<ProductFormData>(emptyProductForm);
  const { toast } = useToast();

  const handlePrintDeliveryInvoice = async (order: Order) => {
    if (!adminToken) return;
    setLoadingItems(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/items`, {
        headers: { 'x-admin-token': adminToken }
      });
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

  useEffect(() => {
    const savedToken = sessionStorage.getItem("admin_token");
    if (savedToken) {
      setAdminToken(savedToken);
      setIsAuthenticated(true);
    }
  }, []);

  const { data: adminSettings, refetch: refetchSettings } = useQuery({
    queryKey: ['/api/admin/settings'],
    enabled: isAuthenticated && !!adminToken,
    queryFn: async () => {
      const res = await fetch('/api/admin/settings', {
        headers: { 'x-admin-token': adminToken || '' }
      });
      if (!res.ok) throw new Error('Failed to fetch settings');
      return res.json();
    }
  });

  useEffect(() => {
    if (adminSettings) {
      const rateSetting = adminSettings.find((s: any) => s.key === 'exchange_rate');
      if (rateSetting) {
        setExchangeRate(rateSetting.value);
      }
    }
  }, [adminSettings]);

  const saveSettingsMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-token': adminToken || '' 
        },
        body: JSON.stringify({ key, value })
      });
      if (!res.ok) throw new Error('Failed to save settings');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings'] });
      toast({ title: "تم حفظ سعر الصرف بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ أثناء الحفظ", variant: "destructive" });
    }
  });

  const saveExchangeRate = () => {
    saveSettingsMutation.mutate({ key: 'exchange_rate', value: exchangeRate });
  };

  const { data: orders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ['/api/admin/orders'],
    enabled: isAuthenticated && !!adminToken,
    queryFn: async () => {
      const res = await fetch('/api/admin/orders', {
        headers: { 'x-admin-token': adminToken || '' }
      });
      if (!res.ok) throw new Error('Failed to fetch orders');
      return res.json();
    }
  });

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ['/api/products'],
    enabled: isAuthenticated,
  });

  const updateOrderStatus = useMutation({
    mutationFn: async ({ orderId, status, trackingNumber }: { orderId: number; status: string; trackingNumber?: string }) => {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-token': adminToken || '' 
        },
        body: JSON.stringify({ status, trackingNumber })
      });
      if (!res.ok) throw new Error('Failed to update order');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/orders'] });
      toast({ title: "تم تحديث حالة الطلب" });
    }
  });

  const updateProductStock = useMutation({
    mutationFn: async ({ productId, stock }: { productId: number; stock: number }) => {
      const res = await fetch(`/api/admin/products/${productId}/stock`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-token': adminToken || '' 
        },
        body: JSON.stringify({ stock })
      });
      if (!res.ok) throw new Error('Failed to update stock');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({ title: "تم تحديث المخزون" });
    }
  });

  const { data: salesStats } = useQuery<{ totalSales: number; totalOrders: number; averageOrderValue: number }>({
    queryKey: ['/api/admin/stats'],
    enabled: isAuthenticated && !!adminToken,
    queryFn: async () => {
      const res = await fetch('/api/admin/stats', {
        headers: { 'x-admin-token': adminToken || '' }
      });
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    }
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
    enabled: isAuthenticated,
  });

  const createProductMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-token': adminToken || '' 
        },
        body: JSON.stringify({
          ...data,
          colors: data.colors ? data.colors.split(',').map(c => c.trim()) : null,
          sizes: data.sizes ? data.sizes.split(',').map(s => s.trim()) : null
        })
      });
      if (!res.ok) throw new Error('Failed to create product');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({ title: "تم إضافة المنتج بنجاح" });
      setShowProductForm(false);
      setProductForm(emptyProductForm);
    },
    onError: () => {
      toast({ title: "حدث خطأ أثناء إضافة المنتج", variant: "destructive" });
    }
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ProductFormData> }) => {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-token': adminToken || '' 
        },
        body: JSON.stringify({
          ...data,
          colors: data.colors ? (data.colors as string).split(',').map(c => c.trim()) : null,
          sizes: data.sizes ? (data.sizes as string).split(',').map(s => s.trim()) : null
        })
      });
      if (!res.ok) throw new Error('Failed to update product');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({ title: "تم تحديث المنتج بنجاح" });
      setShowProductForm(false);
      setEditingProduct(null);
      setProductForm(emptyProductForm);
    },
    onError: () => {
      toast({ title: "حدث خطأ أثناء تحديث المنتج", variant: "destructive" });
    }
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': adminToken || '' }
      });
      if (!res.ok) throw new Error('Failed to delete product');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({ title: "تم حذف المنتج بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ أثناء حذف المنتج", variant: "destructive" });
    }
  });

  const openEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description,
      price: product.price,
      priceSar: product.priceSar || "",
      categoryId: product.categoryId,
      imageUrl: product.imageUrl,
      stock: product.stock,
      colors: product.colors ? product.colors.join(', ') : "",
      sizes: product.sizes ? product.sizes.join(', ') : "",
      allowDesignUpload: product.allowDesignUpload || false
    });
    setShowProductForm(true);
  };

  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      updateProductMutation.mutate({ id: editingProduct.id, data: productForm });
    } else {
      createProductMutation.mutate(productForm);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      
      if (response.ok) {
        const data = await response.json();
        setAdminToken(data.token);
        setIsAuthenticated(true);
        sessionStorage.setItem("admin_token", data.token);
        toast({ title: "مرحباً بك في لوحة التحكم" });
      } else {
        toast({ title: "كلمة المرور غير صحيحة", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "حدث خطأ في الاتصال", variant: "destructive" });
    }
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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">لوحة التحكم</CardTitle>
            <p className="text-muted-foreground">أدخل كلمة المرور للوصول</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="password">كلمة المرور</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور"
                  className="mt-1"
                  data-testid="input-admin-password"
                />
              </div>
              <Button type="submit" className="w-full" data-testid="button-admin-login">
                دخول
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalRevenue = orders?.reduce((sum, o) => sum + Number(o.total || 0), 0) || 0;
  const pendingOrders = orders?.filter(o => o.status === 'pending' || o.status === 'deposit_paid').length || 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-primary text-white p-6">
        <div className="container mx-auto">
          <h1 className="text-2xl font-bold">لوحة تحكم OYO PLAST</h1>
          <p className="text-primary-foreground/80">إدارة الطلبات والمنتجات</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-xl">
                <ShoppingBag className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الطلبات</p>
                <p className="text-2xl font-bold">{orders?.length || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-yellow-100 p-3 rounded-xl">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">طلبات معلقة</p>
                <p className="text-2xl font-bold">{pendingOrders}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-xl">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي المبيعات</p>
                <p className="text-2xl font-bold">{formatPrice(totalRevenue)} ر.ي</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-purple-100 p-3 rounded-xl">
                <Package className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">المنتجات</p>
                <p className="text-2xl font-bold">{products?.length || 0}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="orders" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="orders">الطلبات</TabsTrigger>
            <TabsTrigger value="manage-products">المنتجات</TabsTrigger>
            <TabsTrigger value="products">المخزون</TabsTrigger>
            <TabsTrigger value="reports">التقارير</TabsTrigger>
            <TabsTrigger value="settings">الإعدادات</TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>إدارة الطلبات</CardTitle>
              </CardHeader>
              <CardContent>
                {ordersLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : orders && orders.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">رقم الطلب</TableHead>
                          <TableHead className="text-right">العميل</TableHead>
                          <TableHead className="text-right">المدينة</TableHead>
                          <TableHead className="text-right">الإجمالي</TableHead>
                          <TableHead className="text-right">طريقة الدفع</TableHead>
                          <TableHead className="text-right">الحالة</TableHead>
                          <TableHead className="text-right">التاريخ</TableHead>
                          <TableHead className="text-right">إجراءات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((order) => {
                          const status = statusMap[order.status] || statusMap.pending;
                          const StatusIcon = status.icon;
                          return (
                            <TableRow key={order.id}>
                              <TableCell className="font-medium">#{order.id}</TableCell>
                              <TableCell>{order.customerPhone || '-'}</TableCell>
                              <TableCell>{order.shippingCity || '-'}</TableCell>
                              <TableCell className="font-bold">{formatPrice(order.total)} ر.ي</TableCell>
                              <TableCell>
                                {order.paymentMethod === 'karimi' && 'الكريمي'}
                                {order.paymentMethod === 'najm' && 'النجم'}
                                {order.paymentMethod === 'cash_on_delivery' && 'عند الاستلام'}
                                {!order.paymentMethod && '-'}
                              </TableCell>
                              <TableCell>
                                <Badge className={`${status.color} gap-1`}>
                                  <StatusIcon className="h-3 w-3" />
                                  {status.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">{formatDate(order.createdAt)}</TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    onClick={() => handlePrintDeliveryInvoice(order)}
                                    disabled={loadingItems}
                                    title="طباعة فاتورة التوصيل"
                                    data-testid={`button-admin-print-invoice-${order.id}`}
                                  >
                                    {loadingItems ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Printer className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button size="icon" variant="ghost" onClick={() => setSelectedOrder(order)}>
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-lg">
                                      <DialogHeader>
                                        <DialogTitle>تفاصيل الطلب #{order.id}</DialogTitle>
                                      </DialogHeader>
                                      <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                          <div>
                                            <p className="text-muted-foreground">الهاتف</p>
                                            <p className="font-medium">{order.customerPhone || '-'}</p>
                                          </div>
                                          <div>
                                            <p className="text-muted-foreground">المدينة</p>
                                            <p className="font-medium">{order.shippingCity || '-'}</p>
                                          </div>
                                          <div className="col-span-2">
                                            <p className="text-muted-foreground">العنوان</p>
                                            <p className="font-medium">{order.shippingAddress || '-'}</p>
                                          </div>
                                          {order.notes && (
                                            <div className="col-span-2">
                                              <p className="text-muted-foreground">ملاحظات</p>
                                              <p className="font-medium">{order.notes}</p>
                                            </div>
                                          )}
                                          <div>
                                            <p className="text-muted-foreground">الإجمالي</p>
                                            <p className="font-bold text-primary">{formatPrice(order.total)} ر.ي</p>
                                          </div>
                                          {order.depositAmount && (
                                            <div>
                                              <p className="text-muted-foreground">العربون</p>
                                              <p className="font-medium">{formatPrice(order.depositAmount)} ر.ي</p>
                                            </div>
                                          )}
                                        </div>

                                        {order.receiptImageUrl && (
                                          <div>
                                            <p className="text-muted-foreground mb-2">صورة الإشعار</p>
                                            <p className="text-sm bg-gray-100 p-2 rounded">{order.receiptImageUrl}</p>
                                          </div>
                                        )}

                                        <Separator />

                                        <div>
                                          <Label>تغيير الحالة</Label>
                                          <Select
                                            value={order.status}
                                            onValueChange={(value) => updateOrderStatus.mutate({ orderId: order.id, status: value })}
                                          >
                                            <SelectTrigger className="mt-1">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="pending">قيد الانتظار</SelectItem>
                                              <SelectItem value="deposit_paid">تم دفع العربون</SelectItem>
                                              <SelectItem value="processing">قيد التجهيز</SelectItem>
                                              <SelectItem value="shipped">تم الشحن</SelectItem>
                                              <SelectItem value="delivered">تم التوصيل</SelectItem>
                                              <SelectItem value="completed">مكتمل</SelectItem>
                                              <SelectItem value="cancelled">ملغي</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-10 text-muted-foreground">
                    <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>لا توجد طلبات بعد</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manage-products">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <CardTitle>إدارة المنتجات</CardTitle>
                <Button 
                  onClick={() => {
                    setEditingProduct(null);
                    setProductForm(emptyProductForm);
                    setShowProductForm(true);
                  }}
                  className="gap-2"
                  data-testid="button-add-product"
                >
                  <Plus className="h-4 w-4" />
                  إضافة منتج
                </Button>
              </CardHeader>
              <CardContent>
                {showProductForm && (
                  <div className="mb-6 p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-lg">
                        {editingProduct ? 'تعديل المنتج' : 'إضافة منتج جديد'}
                      </h3>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => {
                          setShowProductForm(false);
                          setEditingProduct(null);
                          setProductForm(emptyProductForm);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <form onSubmit={handleProductSubmit} className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="product-name">اسم المنتج *</Label>
                          <Input
                            id="product-name"
                            value={productForm.name}
                            onChange={(e) => setProductForm({...productForm, name: e.target.value})}
                            placeholder="مثال: أكياس بلاستيك شفافة"
                            required
                            data-testid="input-product-name"
                          />
                        </div>
                        <div>
                          <Label htmlFor="product-category">القسم *</Label>
                          <Select
                            value={productForm.categoryId.toString()}
                            onValueChange={(value) => setProductForm({...productForm, categoryId: parseInt(value)})}
                          >
                            <SelectTrigger data-testid="select-product-category">
                              <SelectValue placeholder="اختر القسم" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories?.map((cat) => (
                                <SelectItem key={cat.id} value={cat.id.toString()}>
                                  {cat.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="product-description">الوصف *</Label>
                        <Textarea
                          id="product-description"
                          value={productForm.description}
                          onChange={(e) => setProductForm({...productForm, description: e.target.value})}
                          placeholder="وصف تفصيلي للمنتج"
                          rows={3}
                          required
                          data-testid="input-product-description"
                        />
                      </div>

                      <div className="grid md:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="product-price">السعر بالريال اليمني *</Label>
                          <Input
                            id="product-price"
                            type="number"
                            value={productForm.price}
                            onChange={(e) => setProductForm({...productForm, price: e.target.value})}
                            placeholder="5000"
                            required
                            data-testid="input-product-price"
                          />
                        </div>
                        <div>
                          <Label htmlFor="product-price-sar">السعر بالريال السعودي</Label>
                          <Input
                            id="product-price-sar"
                            type="number"
                            value={productForm.priceSar}
                            onChange={(e) => setProductForm({...productForm, priceSar: e.target.value})}
                            placeholder="35"
                            data-testid="input-product-price-sar"
                          />
                        </div>
                        <div>
                          <Label htmlFor="product-stock">المخزون</Label>
                          <Input
                            id="product-stock"
                            type="number"
                            value={productForm.stock}
                            onChange={(e) => setProductForm({...productForm, stock: parseInt(e.target.value) || 0})}
                            placeholder="100"
                            data-testid="input-product-stock"
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="product-image">رابط الصورة *</Label>
                        <Input
                          id="product-image"
                          value={productForm.imageUrl}
                          onChange={(e) => setProductForm({...productForm, imageUrl: e.target.value})}
                          placeholder="https://example.com/image.jpg"
                          required
                          data-testid="input-product-image"
                        />
                        {productForm.imageUrl && (
                          <div className="mt-2 w-20 h-20 rounded-lg overflow-hidden border">
                            <img 
                              src={productForm.imageUrl} 
                              alt="معاينة" 
                              className="w-full h-full object-cover"
                              onError={(e) => (e.target as HTMLImageElement).src = '/placeholder.jpg'}
                            />
                          </div>
                        )}
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="product-colors">الألوان المتاحة (مفصولة بفاصلة)</Label>
                          <Input
                            id="product-colors"
                            value={productForm.colors}
                            onChange={(e) => setProductForm({...productForm, colors: e.target.value})}
                            placeholder="أبيض, أسود, أحمر"
                            data-testid="input-product-colors"
                          />
                        </div>
                        <div>
                          <Label htmlFor="product-sizes">المقاسات المتاحة (مفصولة بفاصلة)</Label>
                          <Input
                            id="product-sizes"
                            value={productForm.sizes}
                            onChange={(e) => setProductForm({...productForm, sizes: e.target.value})}
                            placeholder="صغير, وسط, كبير"
                            data-testid="input-product-sizes"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="product-design-upload"
                          checked={productForm.allowDesignUpload}
                          onChange={(e) => setProductForm({...productForm, allowDesignUpload: e.target.checked})}
                          className="rounded border-gray-300"
                          data-testid="checkbox-design-upload"
                        />
                        <Label htmlFor="product-design-upload">السماح برفع ملف التصميم</Label>
                      </div>

                      <div className="flex gap-2 pt-4">
                        <Button 
                          type="submit" 
                          disabled={createProductMutation.isPending || updateProductMutation.isPending}
                          className="gap-2"
                          data-testid="button-save-product"
                        >
                          {(createProductMutation.isPending || updateProductMutation.isPending) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          {editingProduct ? 'حفظ التعديلات' : 'إضافة المنتج'}
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline"
                          onClick={() => {
                            setShowProductForm(false);
                            setEditingProduct(null);
                            setProductForm(emptyProductForm);
                          }}
                        >
                          إلغاء
                        </Button>
                      </div>
                    </form>
                  </div>
                )}

                {productsLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : products && products.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">المنتج</TableHead>
                          <TableHead className="text-right">القسم</TableHead>
                          <TableHead className="text-right">السعر (ر.ي)</TableHead>
                          <TableHead className="text-right">المخزون</TableHead>
                          <TableHead className="text-right">إجراءات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.map((product) => (
                          <TableRow key={product.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain" />
                                </div>
                                <span className="font-medium">{product.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {categories?.find(c => c.id === product.categoryId)?.name || '-'}
                            </TableCell>
                            <TableCell>{formatPrice(product.price)}</TableCell>
                            <TableCell>
                              <Badge variant={product.stock > 10 ? "default" : product.stock > 0 ? "secondary" : "destructive"}>
                                {product.stock > 0 ? `${product.stock} قطعة` : 'نفذ'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button 
                                  size="icon" 
                                  variant="ghost"
                                  onClick={() => openEditProduct(product)}
                                  data-testid={`button-edit-product-${product.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="ghost"
                                  className="text-destructive"
                                  onClick={() => {
                                    if (confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
                                      deleteProductMutation.mutate(product.id);
                                    }
                                  }}
                                  data-testid={`button-delete-product-${product.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-10 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>لا توجد منتجات بعد</p>
                    <Button 
                      className="mt-4 gap-2"
                      onClick={() => setShowProductForm(true)}
                    >
                      <Plus className="h-4 w-4" />
                      إضافة أول منتج
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle>إدارة المخزون</CardTitle>
              </CardHeader>
              <CardContent>
                {productsLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : products && products.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">المنتج</TableHead>
                          <TableHead className="text-right">السعر (ر.ي)</TableHead>
                          <TableHead className="text-right">السعر (ر.س)</TableHead>
                          <TableHead className="text-right">المخزون</TableHead>
                          <TableHead className="text-right">تعديل المخزون</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.map((product) => (
                          <TableRow key={product.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain" />
                                </div>
                                <span className="font-medium">{product.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>{formatPrice(product.price)}</TableCell>
                            <TableCell>{formatPrice(product.priceSar)}</TableCell>
                            <TableCell>
                              <Badge variant={product.stock > 10 ? "default" : product.stock > 0 ? "secondary" : "destructive"}>
                                {product.stock > 0 ? `${product.stock} قطعة` : 'نفذ'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  min={0}
                                  defaultValue={product.stock}
                                  className="w-20"
                                  onBlur={(e) => {
                                    const newStock = parseInt(e.target.value);
                                    if (newStock !== product.stock) {
                                      updateProductStock.mutate({ productId: product.id, stock: newStock });
                                    }
                                  }}
                                  data-testid={`input-stock-${product.id}`}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-10 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>لا توجد منتجات بعد</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="p-6 text-center">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 text-green-600" />
                  <p className="text-sm text-muted-foreground mb-2">إجمالي المبيعات</p>
                  <p className="text-3xl font-bold text-green-600">
                    {formatPrice(salesStats?.totalSales || 0)} ر.ي
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-blue-600" />
                  <p className="text-sm text-muted-foreground mb-2">عدد الطلبات</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {salesStats?.totalOrders || 0}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 text-purple-600" />
                  <p className="text-sm text-muted-foreground mb-2">متوسط قيمة الطلب</p>
                  <p className="text-3xl font-bold text-purple-600">
                    {formatPrice(salesStats?.averageOrderValue || 0)} ر.ي
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>ملخص الطلبات حسب الحالة</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(statusMap).map(([key, value]) => {
                    const count = orders?.filter(o => o.status === key).length || 0;
                    const StatusIcon = value.icon;
                    return (
                      <div key={key} className={`p-4 rounded-lg ${value.color}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <StatusIcon className="h-5 w-5" />
                          <span className="font-medium">{value.label}</span>
                        </div>
                        <p className="text-2xl font-bold">{count}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  إعدادات المتجر
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-base font-semibold mb-2 block">سعر صرف الريال اليمني</Label>
                    <p className="text-sm text-muted-foreground mb-3">
                      قيمة الريال السعودي الواحد بالريال اليمني
                    </p>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 max-w-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">1 ر.س =</span>
                          <Input
                            type="number"
                            value={exchangeRate}
                            onChange={(e) => setExchangeRate(e.target.value)}
                            className="w-32 text-center font-bold"
                            data-testid="input-exchange-rate"
                          />
                          <span className="text-muted-foreground">ر.ي</span>
                        </div>
                      </div>
                      <Button 
                        onClick={saveExchangeRate} 
                        disabled={saveSettingsMutation.isPending}
                        className="gap-2"
                        data-testid="button-save-settings"
                      >
                        {saveSettingsMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        حفظ
                      </Button>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">معلومات البنوك</h4>
                    <div className="space-y-2 text-sm">
                      <p><strong>بنك الكريمي:</strong> حساب رقم 0010203040 باسم اويو بلاست</p>
                      <p><strong>بنك النجم:</strong> حساب رقم 9876543210 باسم اويو بلاست</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {selectedOrderForInvoice && (
        <PrintableInvoice
          order={selectedOrderForInvoice}
          orderItems={orderItems}
          isDeliveryInvoice={true}
          onClose={() => {
            setSelectedOrderForInvoice(null);
            setOrderItems([]);
          }}
        />
      )}
    </div>
  );
}
