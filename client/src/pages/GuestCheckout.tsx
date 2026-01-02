import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, Loader2, Banknote, MapPin, Trash2, Plus, Minus, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Product } from "@shared/schema";

const YEMENI_CITIES = [
  "صنعاء", "عدن", "تعز", "الحديدة", "إب", "ذمار", "المكلا", "سيئون",
  "البيضاء", "حجة", "صعدة", "لحج", "الضالع", "المحويت", "عمران", "شبوة", "أبين", "الجوف"
];

interface GuestCartItem {
  productId: number;
  quantity: number;
  product?: Product;
}

export default function GuestCheckout() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);
  
  const [guestCart, setGuestCart] = useState<GuestCartItem[]>(() => {
    const saved = localStorage.getItem('guestCart');
    return saved ? JSON.parse(saved) : [];
  });

  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    shippingCity: "",
    shippingAddress: "",
    gpsCoordinates: "",
    notes: ""
  });

  const [currency, setCurrency] = useState<'YER' | 'SAR'>(() => {
    return (localStorage.getItem('currency') as 'YER' | 'SAR') || 'YER';
  });

  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // Fetch products for cart items
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  // Map products to cart items
  const cartWithProducts = useMemo(() => {
    return guestCart.map(item => {
      const product = products.find(p => p.id === item.productId);
      return { ...item, product };
    }).filter(item => item.product);
  }, [guestCart, products]);

  // Save cart to localStorage
  useEffect(() => {
    localStorage.setItem('guestCart', JSON.stringify(guestCart));
  }, [guestCart]);

  const subtotal = useMemo(() => {
    return cartWithProducts.reduce((acc, item) => {
      if (!item.product) return acc;
      const price = currency === 'SAR' && item.product.priceSar 
        ? Number(item.product.priceSar) 
        : Number(item.product.price);
      return acc + (price * item.quantity);
    }, 0);
  }, [cartWithProducts, currency]);

  const formatPrice = (price: number) => {
    return price.toLocaleString('ar-YE');
  };

  const updateQuantity = (productId: number, delta: number) => {
    setGuestCart(prev => 
      prev.map(item => {
        if (item.productId === productId) {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const removeItem = (productId: number) => {
    setGuestCart(prev => prev.filter(item => item.productId !== productId));
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "غير متاح",
        description: "المتصفح لا يدعم تحديد الموقع",
        variant: "destructive"
      });
      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const coordinates = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        setFormData(prev => ({ ...prev, gpsCoordinates: coordinates }));
        toast({
          title: "تم تحديد الموقع",
          description: "تم الحصول على موقعك بنجاح"
        });
        setIsGettingLocation(false);
      },
      (error) => {
        toast({
          title: "خطأ",
          description: "فشل في تحديد الموقع. يرجى إدخال العنوان يدوياً.",
          variant: "destructive"
        });
        setIsGettingLocation(false);
      }
    );
  };

  const submitOrderMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/orders/guest", {
        items: guestCart.map(item => ({
          productId: item.productId,
          quantity: item.quantity
        })),
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        customerEmail: formData.customerEmail,
        shippingCity: formData.shippingCity,
        shippingAddress: formData.shippingAddress,
        gpsCoordinates: formData.gpsCoordinates,
        notes: formData.notes,
        currency
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      localStorage.removeItem('guestCart');
      setGuestCart([]);
      setOrderId(data.orderId);
      setOrderSuccess(true);
      toast({
        title: "تم إنشاء الطلب بنجاح",
        description: `رقم الطلب: #${data.orderId}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "فشل في إنشاء الطلب",
        description: error?.message || "حدث خطأ أثناء إنشاء الطلب",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customerPhone) {
      toast({ title: "خطأ", description: "رقم الهاتف مطلوب", variant: "destructive" });
      return;
    }
    if (!formData.shippingCity) {
      toast({ title: "خطأ", description: "المدينة مطلوبة", variant: "destructive" });
      return;
    }
    if (!formData.shippingAddress) {
      toast({ title: "خطأ", description: "العنوان مطلوب", variant: "destructive" });
      return;
    }

    submitOrderMutation.mutate();
  };

  if (orderSuccess) {
    return (
      <div className="container max-w-md mx-auto px-4 py-12 text-center">
        <div className="bg-green-500/10 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
          <CheckCircle className="h-10 w-10 text-green-500" />
        </div>
        <h1 className="text-2xl font-bold mb-4">تم استلام طلبك بنجاح!</h1>
        <p className="text-muted-foreground mb-2">رقم الطلب: <strong>#{orderId}</strong></p>
        <p className="text-muted-foreground mb-6">سيتم التواصل معك قريباً لتأكيد الطلب</p>
        <Link href="/">
          <Button className="w-full" data-testid="button-continue-shopping">
            العودة للتسوق
          </Button>
        </Link>
      </div>
    );
  }

  if (cartWithProducts.length === 0) {
    return (
      <div className="container max-w-md mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">سلة التسوق فارغة</h1>
        <p className="text-muted-foreground mb-6">لم تقم بإضافة أي منتجات بعد</p>
        <Link href="/">
          <Button data-testid="button-browse-products">تصفح المنتجات</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowRight className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">الشراء كزائر</h1>
      </div>

      {/* Cart Items */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">المنتجات ({cartWithProducts.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {cartWithProducts.map((item) => (
            <div key={item.productId} className="flex gap-3 pb-3 border-b last:border-0" data-testid={`cart-item-${item.productId}`}>
              <img 
                src={item.product?.imageUrl} 
                alt={item.product?.name} 
                className="w-16 h-16 object-cover rounded-lg"
              />
              <div className="flex-1">
                <p className="font-medium text-sm line-clamp-1">{item.product?.name}</p>
                <p className="text-primary font-bold">
                  {formatPrice(
                    currency === 'SAR' && item.product?.priceSar 
                      ? Number(item.product.priceSar) 
                      : Number(item.product?.price || 0)
                  )} {currency === 'SAR' ? 'ر.س' : 'ر.ي'}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-6 w-6"
                    onClick={() => updateQuantity(item.productId, -1)}
                    data-testid={`button-decrease-${item.productId}`}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-6 w-6"
                    onClick={() => updateQuantity(item.productId, 1)}
                    data-testid={`button-increase-${item.productId}`}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-destructive mr-auto"
                    onClick={() => removeItem(item.productId)}
                    data-testid={`button-remove-${item.productId}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          <Separator />
          <div className="flex justify-between font-bold text-lg">
            <span>الإجمالي</span>
            <span className="text-primary">{formatPrice(subtotal)} {currency === 'SAR' ? 'ر.س' : 'ر.ي'}</span>
          </div>
        </CardContent>
      </Card>

      {/* Guest Info Form */}
      <form onSubmit={handleSubmit}>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">معلومات التوصيل</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="customerName">الاسم (اختياري)</Label>
              <Input
                id="customerName"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                placeholder="أدخل اسمك"
                data-testid="input-customer-name"
              />
            </div>

            <div>
              <Label htmlFor="customerPhone">رقم الهاتف *</Label>
              <Input
                id="customerPhone"
                type="tel"
                value={formData.customerPhone}
                onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                placeholder="مثال: 777123456"
                required
                data-testid="input-customer-phone"
              />
            </div>

            <div>
              <Label htmlFor="customerEmail">البريد الإلكتروني (اختياري)</Label>
              <Input
                id="customerEmail"
                type="email"
                value={formData.customerEmail}
                onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                placeholder="example@email.com"
                data-testid="input-customer-email"
              />
            </div>

            <div>
              <Label htmlFor="shippingCity">المدينة *</Label>
              <Select
                value={formData.shippingCity}
                onValueChange={(value) => setFormData({ ...formData, shippingCity: value })}
              >
                <SelectTrigger data-testid="select-city">
                  <SelectValue placeholder="اختر المدينة" />
                </SelectTrigger>
                <SelectContent>
                  {YEMENI_CITIES.map((city) => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="shippingAddress">العنوان التفصيلي *</Label>
              <Textarea
                id="shippingAddress"
                value={formData.shippingAddress}
                onChange={(e) => setFormData({ ...formData, shippingAddress: e.target.value })}
                placeholder="المنطقة، الشارع، رقم المبنى..."
                required
                data-testid="input-shipping-address"
              />
            </div>

            <div>
              <Label>تحديد الموقع GPS (اختياري)</Label>
              <div className="flex gap-2">
                <Input
                  value={formData.gpsCoordinates}
                  onChange={(e) => setFormData({ ...formData, gpsCoordinates: e.target.value })}
                  placeholder="سيتم تعبئته تلقائياً"
                  className="flex-1"
                  data-testid="input-gps"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={getCurrentLocation}
                  disabled={isGettingLocation}
                  data-testid="button-get-location"
                >
                  {isGettingLocation ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MapPin className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="notes">ملاحظات (اختياري)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="أي ملاحظات إضافية..."
                data-testid="input-notes"
              />
            </div>
          </CardContent>
        </Card>

        {/* Payment Method */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              طريقة الدفع
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <Banknote className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="font-medium">الدفع عند الاستلام</p>
              <p className="text-sm text-muted-foreground">ادفع المبلغ كاملاً لمندوب التوصيل</p>
            </div>
          </CardContent>
        </Card>

        <Button 
          type="submit" 
          className="w-full h-14 text-lg font-bold"
          disabled={submitOrderMutation.isPending}
          data-testid="button-submit-order"
        >
          {submitOrderMutation.isPending ? (
            <Loader2 className="h-5 w-5 animate-spin ml-2" />
          ) : null}
          تأكيد الطلب - {formatPrice(subtotal)} {currency === 'SAR' ? 'ر.س' : 'ر.ي'}
        </Button>
      </form>

      <div className="mt-4 text-center">
        <Link href="/auth" className="text-primary underline text-sm" data-testid="link-login">
          لديك حساب؟ سجل دخولك للحصول على نقاط الولاء
        </Link>
      </div>
    </div>
  );
}
