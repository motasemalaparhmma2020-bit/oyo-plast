import { useCart } from "@/hooks/use-cart";
import { useAuth } from "@/hooks/use-auth";
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
import { ArrowRight, Upload, Check, Loader2, Banknote, MapPin, Wallet, Smartphone, CreditCard, Building2, CheckCircle, X, Copy } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import type { Product } from "@shared/schema";
import { useDigitalWallets } from "@/hooks/use-digital-wallets";

interface GuestCartItem {
  productId: number;
  quantity: number;
  selectedSize?: string;
  selectedColor?: string;
  customPrinting?: boolean;
  designNotes?: string;
  designFileUrl?: string;
}

function getGuestCart(): GuestCartItem[] {
  try {
    const saved = localStorage.getItem('guestCart');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

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
    description: "ادفع المبلغ كاملاً لمندوب التوصيل عند استلام الطلب",
    icon: Banknote,
    requiresDeposit: false,
    instructions: null
  },
  {
    id: "jawali",
    name: "جوالي",
    description: "التحويل عبر محفظة جوالي",
    icon: Smartphone,
    requiresDeposit: true,
    instructions: "حوّل العربون (30%) إلى رقم: 774997589 ثم ارفع صورة الإشعار"
  },
  {
    id: "jaib",
    name: "جيب",
    description: "التحويل عبر محفظة جيب",
    icon: Wallet,
    requiresDeposit: true,
    instructions: "حوّل العربون (30%) إلى رقم: 774997589 ثم ارفع صورة الإشعار"
  },
  {
    id: "onecash",
    name: "ون كاش",
    description: "التحويل عبر محفظة ون كاش",
    icon: CreditCard,
    requiresDeposit: true,
    instructions: "حوّل العربون (30%) إلى رقم: 774997589 ثم ارفع صورة الإشعار"
  },
  {
    id: "cash",
    name: "كاش",
    description: "التحويل عبر محفظة كاش",
    icon: Wallet,
    requiresDeposit: true,
    instructions: "حوّل العربون (30%) إلى رقم: 774997589 ثم ارفع صورة الإشعار"
  },
  {
    id: "mahfazati",
    name: "محفظتي",
    description: "التحويل عبر محفظة محفظتي",
    icon: Smartphone,
    requiresDeposit: true,
    instructions: "حوّل العربون (30%) إلى رقم: 774997589 ثم ارفع صورة الإشعار"
  },
  {
    id: "mobile_money",
    name: "موبايل موني",
    description: "التحويل عبر موبايل موني",
    icon: Smartphone,
    requiresDeposit: true,
    instructions: "حوّل العربون (30%) إلى رقم: 774997589 ثم ارفع صورة الإشعار"
  },
  {
    id: "kuraimi_bank",
    name: "بنك الكريمي",
    description: "التحويل عبر بنك الكريمي",
    icon: Building2,
    requiresDeposit: true,
    instructions: "حوّل العربون (30%) إلى حساب رقم: 1234567890 باسم: أويو بلاست"
  },
  {
    id: "digital_wallet",
    name: "المحفظة الإلكترونية",
    description: "ادفع باستخدام المحافظ الإلكترونية المتاحة",
    icon: Wallet,
    requiresDeposit: false,
    instructions: null
  }
];

export default function Checkout() {
  const { data: authCartItems, isLoading } = useCart();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  // Guests can checkout without authentication
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Support for guest cart
  const [guestCart, setGuestCart] = useState<GuestCartItem[]>(() => getGuestCart());
  
  // Fetch all products for guest cart display
  const { data: allProducts = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: !isAuthenticated && guestCart.length > 0,
  });

  // Use guest cart if not authenticated, otherwise use auth cart
  const cartItems = isAuthenticated ? authCartItems : guestCart;
  const isLoading_checkout = !isAuthenticated ? false : isLoading;
  
  const [formData, setFormData] = useState({
    customerPhone: "",
    shippingCity: "",
    shippingAddress: "",
    paymentMethod: "cash_on_delivery",
    notes: "",
    gpsCoordinates: "",
    selectedWalletId: null as number | null,
    purchaseCode: ""
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  
  // Fetch digital wallets
  const { data: digitalWallets = [] } = useDigitalWallets();
  
  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [couponData, setCouponData] = useState<{
    code: string;
    discountPercent: number;
    marketerCommissionPercent: number;
  } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  
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

  // Update guest cart from localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      setGuestCart(getGuestCart());
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const subtotal = useMemo(() => {
    if (isAuthenticated) {
      return authCartItems?.reduce((acc, item) => {
        const price = currency === 'SAR' && item.product.priceSar 
          ? Number(item.product.priceSar) 
          : Number(item.product.price);
        return acc + (price * item.quantity);
      }, 0) || 0;
    } else {
      // For guests, calculate from guest cart with product data
      return guestCart.reduce((acc, item) => {
        const product = allProducts.find(p => p.id === item.productId);
        if (!product) return acc;
        const price = currency === 'SAR' && product.priceSar 
          ? Number(product.priceSar) 
          : Number(product.price);
        return acc + (price * item.quantity);
      }, 0);
    }
  }, [authCartItems, guestCart, currency, isAuthenticated, allProducts]);

  const discountAmount = useMemo(() => {
    if (couponData) {
      return Math.floor(subtotal * (couponData.discountPercent / 100));
    }
    return 0;
  }, [subtotal, couponData]);

  const finalTotal = useMemo(() => {
    return subtotal - discountAmount;
  }, [subtotal, discountAmount]);

  const depositAmount = useMemo(() => {
    return Math.ceil(finalTotal * 0.3);
  }, [finalTotal]);

  const selectedPayment = PAYMENT_METHODS.find(p => p.id === formData.paymentMethod);
  
  const validateCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError("الرجاء إدخال كود الخصم");
      return;
    }
    
    setIsValidatingCoupon(true);
    setCouponError("");
    
    try {
      const response = await fetch(`/api/coupons/validate/${encodeURIComponent(couponCode.trim())}`);
      const data = await response.json();
      
      if (data.valid) {
        setCouponData(data.coupon);
        toast({
          title: "تم تطبيق الخصم",
          description: `خصم ${data.coupon.discountPercent}% تم تطبيقه بنجاح`,
        });
      } else {
        setCouponError(data.error || "كود الخصم غير صالح");
        setCouponData(null);
      }
    } catch (error) {
      setCouponError("حدث خطأ أثناء التحقق من الكود");
      setCouponData(null);
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setCouponData(null);
    setCouponCode("");
    setCouponError("");
    toast({
      title: "تم إزالة الخصم",
      description: "تم إزالة كود الخصم من طلبك",
    });
  };

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
        setFormData(prev => ({
          ...prev,
          gpsCoordinates: coordinates
        }));
        toast({
          title: "تم تحديد الموقع",
          description: "تم الحصول على إحداثيات موقعك بنجاح"
        });
        setIsGettingLocation(false);
      },
      (error) => {
        let errorMessage = "حدث خطأ في تحديد الموقع";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "تم رفض الإذن بتحديد الموقع";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "معلومات الموقع غير متاحة";
            break;
          case error.TIMEOUT:
            errorMessage = "انتهت مهلة تحديد الموقع";
            break;
        }
        toast({
          title: "فشل تحديد الموقع",
          description: errorMessage,
          variant: "destructive"
        });
        setIsGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
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

    // Validate digital wallet payment
    if (formData.paymentMethod === "digital_wallet") {
      if (!formData.selectedWalletId) {
        toast({
          title: "خطأ",
          description: "يرجى اختيار محفظة إلكترونية",
          variant: "destructive"
        });
        return;
      }
      if (!formData.purchaseCode || formData.purchaseCode.trim() === "") {
        toast({
          title: "خطأ",
          description: "يرجى إدخال رقم الحوالة أو كود الشراء",
          variant: "destructive"
        });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const orderData = {
        ...formData,
        total: finalTotal.toString(),
        depositAmount: selectedPayment?.requiresDeposit ? depositAmount.toString() : null,
        receiptImageUrl: receiptFile ? receiptFile.name : null,
        couponCode: couponData?.code || null,
        discountAmount: discountAmount > 0 ? discountAmount.toString() : null
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

  if (isLoading_checkout) {
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
                  <div className="flex items-center justify-between mb-1">
                    <Label htmlFor="gps">إحداثيات الموقع (GPS)</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={getCurrentLocation}
                      disabled={isGettingLocation}
                      className="gap-2"
                      data-testid="button-get-location"
                    >
                      {isGettingLocation ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MapPin className="h-4 w-4" />
                      )}
                      {isGettingLocation ? 'جارٍ التحديد...' : 'تحديد موقعي'}
                    </Button>
                  </div>
                  <Input
                    id="gps"
                    type="text"
                    placeholder="سيتم تعبئتها تلقائياً عند الضغط على الزر"
                    value={formData.gpsCoordinates}
                    onChange={(e) => setFormData({...formData, gpsCoordinates: e.target.value})}
                    className="mt-1"
                    readOnly
                    data-testid="input-gps"
                  />
                  {formData.gpsCoordinates && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Check className="h-3 w-3 text-green-600" />
                      تم تحديد الموقع بنجاح
                    </p>
                  )}
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
                      data-testid={`payment-method-${method.id}`}
                    >
                      <RadioGroupItem value={method.id} id={method.id} className="mt-1" />
                      <div className="flex-grow">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                            <method.icon className="h-4 w-4 text-primary" />
                          </div>
                          <Label htmlFor={method.id} className="font-bold cursor-pointer">
                            {method.name}
                          </Label>
                          {method.requiresDeposit && (
                            <Badge variant="secondary" className="text-xs">عربون 30%</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{method.description}</p>
                        {formData.paymentMethod === method.id && method.instructions && (
                          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                            <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                              {method.instructions}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </RadioGroup>

                {/* Digital Wallets Section */}
                {formData.paymentMethod === "digital_wallet" && digitalWallets.length > 0 && (
                  <div className="mt-6 space-y-4">
                    <h3 className="font-semibold text-lg">اختر المحفظة الإلكترونية</h3>
                    <div className="space-y-3">
                      {digitalWallets.map((wallet: any) => (
                        <div
                          key={wallet.id}
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            formData.selectedWalletId === wallet.id
                              ? "border-primary bg-primary/5"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                          onClick={() => setFormData({ ...formData, selectedWalletId: wallet.id })}
                        >
                          <div className="flex items-start gap-4">
                            {wallet.logoUrl && (
                              <img src={wallet.logoUrl} alt={wallet.name} className="w-12 h-12 rounded object-contain flex-shrink-0" />
                            )}
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-3">
                                <p className="font-bold text-base">{wallet.name}</p>
                                {formData.selectedWalletId === wallet.id && (
                                  <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                                )}
                              </div>
                              
                              {/* Receiver Name */}
                              <div className="mb-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">باسم المستلم</p>
                                <p className="font-bold text-sm">{wallet.receiverName}</p>
                              </div>

                              {/* Phone Number */}
                              <div className="flex items-center gap-2">
                                <div className="flex-1 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">رقم التحويل/الدفع</p>
                                  <p className="font-mono font-bold text-sm">{wallet.phoneNumber}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(wallet.phoneNumber);
                                    toast({ title: "✅ تم نسخ الرقم" });
                                  }}
                                  className="p-3 bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-lg text-blue-600 dark:text-blue-400 transition-colors flex-shrink-0"
                                >
                                  <Copy className="h-5 w-5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Purchase Code Input - REQUIRED */}
                    {formData.selectedWalletId && (
                      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                        <Label className="font-semibold mb-2 block">كود الشراء/رقم الحوالة *</Label>
                        <Input
                          type="text"
                          value={formData.purchaseCode}
                          onChange={(e) => setFormData({ ...formData, purchaseCode: e.target.value })}
                          placeholder="أدخل رقم السند/الحوالة أو كود التحويل"
                          className="font-mono"
                          required
                        />
                        <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                          ⚠️ <strong>إلزامي:</strong> يجب إدخال رقم الحوالة أو كود الدفع الذي حصلت عليه من المحفظة - الإدارة ستتحقق منه للموافقة على طلبك
                        </p>
                      </div>
                    )}
                  </div>
                )}

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
                  {cartItems.map((item, idx) => {
                    // For auth cart items
                    const authItem = item as any;
                    if (authItem.id && authItem.product) {
                      return (
                        <div key={authItem.id} className="flex gap-3">
                          <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                            <img 
                              src={authItem.product.imageUrl} 
                              alt={authItem.product.name}
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <div className="flex-grow">
                            <p className="font-medium text-sm line-clamp-1">{authItem.product.name}</p>
                            <p className="text-xs text-muted-foreground">الكمية: {authItem.quantity}</p>
                            <p className="text-sm font-bold text-primary">
                              {formatPrice(
                                (currency === 'SAR' && authItem.product.priceSar 
                                  ? Number(authItem.product.priceSar) 
                                  : Number(authItem.product.price)) * authItem.quantity
                              )} {currency === 'YER' ? 'ر.ي' : 'ر.س'}
                            </p>
                          </div>
                        </div>
                      );
                    }
                    
                    // For guest cart items
                    const guestItem = item as GuestCartItem;
                    const product = allProducts.find(p => p.id === guestItem.productId);
                    if (!product) return null;
                    
                    return (
                      <div key={`guest-${idx}`} className="flex gap-3">
                        <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                          <img 
                            src={product.imageUrl} 
                            alt={product.name}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="flex-grow">
                          <p className="font-medium text-sm line-clamp-1">{product.name}</p>
                          <p className="text-xs text-muted-foreground">الكمية: {guestItem.quantity}</p>
                          <p className="text-sm font-bold text-primary">
                            {formatPrice(
                              (currency === 'SAR' && product.priceSar 
                                ? Number(product.priceSar) 
                                : Number(product.price)) * guestItem.quantity
                            )} {currency === 'YER' ? 'ر.ي' : 'ر.س'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Separator />

                {/* Coupon Input */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">كود الخصم</label>
                  {couponData ? (
                    <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <div>
                          <span className="font-bold text-green-700 dark:text-green-400">{couponData.code}</span>
                          <span className="text-sm text-green-600 mr-2">خصم {couponData.discountPercent}%</span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={removeCoupon}
                        className="text-red-500"
                        data-testid="button-remove-coupon"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder="أدخل كود الخصم"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        className="flex-1"
                        data-testid="input-coupon-code"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={validateCoupon}
                        disabled={isValidatingCoupon}
                        data-testid="button-apply-coupon"
                      >
                        {isValidatingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : "تطبيق"}
                      </Button>
                    </div>
                  )}
                  {couponError && (
                    <p className="text-sm text-red-500">{couponError}</p>
                  )}
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">المجموع</span>
                    <span className="font-bold">{formatPrice(subtotal)} {currency === 'YER' ? 'ر.ي' : 'ر.س'}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>الخصم ({couponData?.discountPercent}%)</span>
                      <span className="font-bold">-{formatPrice(discountAmount)} {currency === 'YER' ? 'ر.ي' : 'ر.س'}</span>
                    </div>
                  )}
                  {selectedPayment?.requiresDeposit && (
                    <>
                      <div className="flex justify-between text-primary">
                        <span>العربون (30%)</span>
                        <span className="font-bold">{formatPrice(depositAmount)} {currency === 'YER' ? 'ر.ي' : 'ر.س'}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>الباقي عند الاستلام</span>
                        <span className="font-bold">{formatPrice(finalTotal - depositAmount)} {currency === 'YER' ? 'ر.ي' : 'ر.س'}</span>
                      </div>
                    </>
                  )}
                </div>

                <Separator />

                <div className="flex justify-between text-lg font-bold">
                  <span>الإجمالي</span>
                  <span className="text-primary">{formatPrice(finalTotal)} {currency === 'YER' ? 'ر.ي' : 'ر.س'}</span>
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
