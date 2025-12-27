import { useCart } from "@/hooks/use-cart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { ArrowRight, Upload, Check, Loader2, Banknote, Building2, CreditCard, Wallet, Smartphone } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const YEMENI_CITIES = [
  "صنعاء",
  "عدن",
  "تعز",
  "الحديدة",
  "إب",
  "ذمار",
  "المكلا",
  "سيئون",
  "البيضاء",
  "حجة",
  "صعدة",
  "لحج",
  "الضالع",
  "المحويت",
  "عمران",
  "شبوة",
  "أبين",
  "الجوف"
];

const PAYMENT_METHODS = [
  {
    id: "cash_on_delivery",
    name: "الدفع عند الاستلام",
    description: "ادفع المبلغ كاملاً عند استلام الطلب",
    icon: Banknote,
    requiresDeposit: false
  },
  {
    id: "karimi",
    name: "تحويل بنك الكريمي",
    description: "حول عربون 30% ثم الباقي عند الاستلام",
    icon: Building2,
    requiresDeposit: true,
    accountInfo: "الاسم: معتصم محمد احمد الاهدل | حساب الريال اليمني: 3002724617 | حساب الريال السعودي: 3020971273"
  },
  {
    id: "jawali",
    name: "محفظة جوالي",
    description: "حول عربون 30% عبر جوالي",
    icon: Wallet,
    requiresDeposit: true,
    accountInfo: "الاسم: معتصم محمد احمد الاهدل | رقم الجوال: 774997589"
  },
  {
    id: "onecash",
    name: "محفظة ون كاش",
    description: "حول عربون 30% عبر ون كاش",
    icon: Smartphone,
    requiresDeposit: true,
    accountInfo: "الاسم: معتصم محمد احمد الاهدل | رقم الجوال: 774997589"
  },
  {
    id: "jeeb",
    name: "محفظة جيب",
    description: "حول عربون 30% عبر جيب",
    icon: Wallet,
    requiresDeposit: true,
    accountInfo: "الاسم: معتصم محمد احمد الاهدل | رقم الجوال: 774997589"
  },
  {
    id: "mobilemoney",
    name: "موبايل موني",
    description: "حول عربون 30% عبر موبايل موني",
    icon: Smartphone,
    requiresDeposit: true,
    accountInfo: "الاسم: معتصم محمد احمد الاهدل | رقم الجوال: 774997589"
  }
];

export default function Checkout() {
  const { data: cartItems, isLoading } = useCart();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    customerPhone: "",
    shippingCity: "",
    shippingAddress: "",
    paymentMethod: "cash_on_delivery",
    notes: ""
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [currency, setCurrency] = useState<'YER' | 'SAR'>(() => {
    return (localStorage.getItem('currency') as 'YER' | 'SAR') || 'YER';
  });

  useEffect(() => {
    const handleCurrencyChange = () => {
      setCurrency((localStorage.getItem('currency') as 'YER' | 'SAR') || 'YER');
    };
    window.addEventListener('currencyChange', handleCurrencyChange);
    return () => window.removeEventListener('currencyChange', handleCurrencyChange);
  }, []);

  const subtotal = useMemo(() => {
    return cartItems?.reduce((acc, item) => {
      const price = currency === 'SAR' && item.product.priceSar 
        ? Number(item.product.priceSar) 
        : Number(item.product.price);
      return acc + (price * item.quantity);
    }, 0) || 0;
  }, [cartItems, currency]);

  const depositAmount = useMemo(() => {
    return Math.ceil(subtotal * 0.3);
  }, [subtotal]);

  const selectedPayment = PAYMENT_METHODS.find(p => p.id === formData.paymentMethod);

  const formatPrice = (price: number) => {
    return price.toLocaleString('ar-YE');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptFile(file);
      toast({
        title: "تم رفع الإشعار",
        description: "تم رفع صورة إشعار التحويل بنجاح",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customerPhone || !formData.shippingCity || !formData.shippingAddress) {
      toast({
        title: "خطأ",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive"
      });
      return;
    }

    if (selectedPayment?.requiresDeposit && !receiptFile) {
      toast({
        title: "خطأ",
        description: "يرجى رفع صورة إشعار التحويل",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const orderData = {
        ...formData,
        total: subtotal.toString(),
        depositAmount: selectedPayment?.requiresDeposit ? depositAmount.toString() : null,
        receiptImageUrl: receiptFile ? receiptFile.name : null
      };

      await apiRequest('POST', '/api/orders', orderData);

      await queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
      
      toast({
        title: "تم إنشاء الطلب بنجاح",
        description: "سيتم التواصل معك قريباً لتأكيد الطلب",
      });
      
      setLocation('/profile');
    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء إنشاء الطلب",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-20 flex justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!cartItems || cartItems.length === 0) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold mb-4">السلة فارغة</h2>
        <Link href="/products">
          <Button>تصفح المنتجات</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 pb-24">
      <Link href="/cart">
        <Button variant="ghost" className="mb-4 gap-2" data-testid="button-back">
          <ArrowRight className="h-4 w-4" />
          العودة للسلة
        </Button>
      </Link>

      <h1 className="text-2xl md:text-3xl font-extrabold mb-6">إتمام الطلب</h1>

      <form onSubmit={handleSubmit}>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>معلومات التوصيل</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="phone">رقم الهاتف *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="مثال: 777123456"
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
                    className="mt-1"
                    data-testid="input-phone"
                  />
                </div>
                
                <div>
                  <Label htmlFor="city">المدينة *</Label>
                  <Select
                    value={formData.shippingCity}
                    onValueChange={(value) => setFormData({...formData, shippingCity: value})}
                  >
                    <SelectTrigger className="mt-1" data-testid="select-city">
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
                  <Label htmlFor="address">العنوان التفصيلي *</Label>
                  <Textarea
                    id="address"
                    placeholder="الحي، الشارع، رقم المبنى، علامة مميزة..."
                    value={formData.shippingAddress}
                    onChange={(e) => setFormData({...formData, shippingAddress: e.target.value})}
                    className="mt-1"
                    data-testid="input-address"
                  />
                </div>

                <div>
                  <Label htmlFor="notes">ملاحظات إضافية</Label>
                  <Textarea
                    id="notes"
                    placeholder="أي ملاحظات خاصة بالطلب..."
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    className="mt-1"
                    data-testid="input-notes"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>طريقة الدفع</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={formData.paymentMethod}
                  onValueChange={(value) => setFormData({...formData, paymentMethod: value})}
                  className="space-y-3"
                >
                  {PAYMENT_METHODS.map((method) => (
                    <div
                      key={method.id}
                      className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        formData.paymentMethod === method.id 
                          ? 'border-primary bg-primary/5' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setFormData({...formData, paymentMethod: method.id})}
                    >
                      <RadioGroupItem value={method.id} id={method.id} className="mt-1" />
                      <div className="flex-grow">
                        <div className="flex items-center gap-2 mb-1">
                          <method.icon className="h-5 w-5 text-primary" />
                          <Label htmlFor={method.id} className="font-bold cursor-pointer">
                            {method.name}
                          </Label>
                          {method.requiresDeposit && (
                            <Badge variant="secondary" className="text-xs">عربون 30%</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{method.description}</p>
                        {method.accountInfo && formData.paymentMethod === method.id && (
                          <div className="mt-3 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                            <p className="text-sm font-medium">{method.accountInfo}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </RadioGroup>

                {selectedPayment?.requiresDeposit && (
                  <div className="mt-6">
                    <Label className="text-base font-semibold mb-3 block">
                      رفع صورة إشعار التحويل *
                    </Label>
                    <div 
                      className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                        data-testid="input-receipt"
                      />
                      {receiptFile ? (
                        <div className="flex items-center justify-center gap-2 text-primary">
                          <Check className="h-5 w-5" />
                          <span className="font-medium">{receiptFile.name}</span>
                        </div>
                      ) : (
                        <div className="text-muted-foreground">
                          <Upload className="h-8 w-8 mx-auto mb-2" />
                          <p>اضغط لرفع صورة الإشعار</p>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      قيمة العربون المطلوب: <span className="font-bold text-primary">{formatPrice(depositAmount)} {currency === 'YER' ? 'ر.ي' : 'ر.س'}</span>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>ملخص الطلب</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex gap-3">
                      <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                        <img 
                          src={item.product.imageUrl} 
                          alt={item.product.name}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="flex-grow">
                        <p className="font-medium text-sm line-clamp-1">{item.product.name}</p>
                        <p className="text-xs text-muted-foreground">الكمية: {item.quantity}</p>
                        <p className="text-sm font-bold text-primary">
                          {formatPrice(
                            (currency === 'SAR' && item.product.priceSar 
                              ? Number(item.product.priceSar) 
                              : Number(item.product.price)) * item.quantity
                          )} {currency === 'YER' ? 'ر.ي' : 'ر.س'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">المجموع</span>
                    <span className="font-bold">{formatPrice(subtotal)} {currency === 'YER' ? 'ر.ي' : 'ر.س'}</span>
                  </div>
                  {selectedPayment?.requiresDeposit && (
                    <>
                      <div className="flex justify-between text-primary">
                        <span>العربون (30%)</span>
                        <span className="font-bold">{formatPrice(depositAmount)} {currency === 'YER' ? 'ر.ي' : 'ر.س'}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>الباقي عند الاستلام</span>
                        <span className="font-bold">{formatPrice(subtotal - depositAmount)} {currency === 'YER' ? 'ر.ي' : 'ر.س'}</span>
                      </div>
                    </>
                  )}
                </div>

                <Separator />

                <div className="flex justify-between text-lg font-bold">
                  <span>الإجمالي</span>
                  <span className="text-primary">{formatPrice(subtotal)} {currency === 'YER' ? 'ر.ي' : 'ر.س'}</span>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full h-14 text-lg font-extrabold rounded-xl"
                  disabled={isSubmitting}
                  data-testid="button-submit-order"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin ml-2" />
                      جاري الإرسال...
                    </>
                  ) : (
                    "تأكيد الطلب"
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
