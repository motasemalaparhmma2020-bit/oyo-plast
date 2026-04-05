import { useCart } from "@/hooks/use-cart";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Link, useLocation } from "wouter";
import {
  ArrowRight, Upload, Check, Loader2, Banknote,
  MapPin, Smartphone, Copy, ChevronDown, ChevronUp,
  Clock, MessageSquare, Wallet, Tag, X, CheckCircle
} from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import type { Product } from "@shared/schema";
import { useDigitalWallets } from "@/hooks/use-digital-wallets";
import { GuestCartItem, getGuestCart, clearGuestCart } from "@/lib/cartUtils";

const YEMENI_CITIES = [
  "صنعاء","عدن","تعز","الحديدة","إب","ذمار","المكلا","سيئون",
  "البيضاء","حجة","صعدة","لحج","الضالع","المحويت","عمران","شبوة","أبين","الجوف"
];

export default function Checkout() {
  const { data: authCartItems, isLoading } = useCart();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLDivElement>(null);

  const [guestCart, setGuestCart] = useState<GuestCartItem[]>(() => getGuestCart());
  const { data: allProducts = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: !isAuthenticated && guestCart.length > 0,
  });

  const cartItems = isAuthenticated ? authCartItems : guestCart;
  const isLoadingCart = !isAuthenticated ? false : isLoading;

  const { data: digitalWallets = [] } = useDigitalWallets();

  const { data: displaySettings } = useQuery<any>({
    queryKey: ["/api/display-settings"],
  });

  const shippingFee: number = displaySettings?.shippingFee ?? 0;
  const freeShippingMin: number = displaySettings?.sadeemFreeShippingMin ?? 0;
  const codEnabled: boolean = displaySettings?.codEnabled ?? true;

  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    shippingCity: "",
    shippingAddress: "",
    paymentMethod: "cash_on_delivery",
    notes: "",
    gpsCoordinates: "",
    purchaseCode: "",
  });

  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deliveryTime, setDeliveryTime] = useState<"now" | "later">("now");
  const [currency] = useState<"YER" | "SAR">(() =>
    (localStorage.getItem("currency") as "YER" | "SAR") || "YER"
  );

  const [showCoupon, setShowCoupon] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [showWallets, setShowWallets] = useState(false);

  const [couponCode, setCouponCode] = useState("");
  const [couponData, setCouponData] = useState<{ code: string; discountPercent: number } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  const savedKey = isAuthenticated && user?.id ? `oyo_saved_address_${user.id}` : "oyo_saved_guest_address";

  useEffect(() => {
    try {
      const saved = localStorage.getItem(savedKey);
      if (!saved) return;
      const p = JSON.parse(saved);
      setFormData(prev => ({
        ...prev,
        customerName: p.customerName ?? prev.customerName,
        customerPhone: p.customerPhone ?? prev.customerPhone,
        shippingCity: p.shippingCity ?? prev.shippingCity,
        shippingAddress: p.shippingAddress ?? prev.shippingAddress,
      }));
    } catch { /* ignore */ }
  }, [savedKey]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    (async () => {
      try {
        const res = await fetch("/api/addresses", { credentials: "include" });
        if (!res.ok) return;
        const addresses = await res.json();
        const preferred = addresses.find((a: any) => a.isDefault) || addresses[0];
        if (!preferred) return;
        setFormData(prev => ({
          ...prev,
          customerName: prev.customerName || preferred.name || "",
          customerPhone: prev.customerPhone || preferred.phone || "",
          shippingCity: prev.shippingCity || preferred.city || "",
          shippingAddress: prev.shippingAddress || preferred.address || "",
        }));
      } catch { /* ignore */ }
    })();
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    const handleStorage = () => setGuestCart(getGuestCart());
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (!codEnabled && formData.paymentMethod === "cash_on_delivery") {
      const firstWallet = digitalWallets.find((w: any) => w.isActive);
      if (firstWallet) setFormData(prev => ({ ...prev, paymentMethod: `wallet_${firstWallet.id}` }));
    }
  }, [codEnabled, digitalWallets]);

  const subtotal = useMemo(() => {
    if (isAuthenticated) {
      return authCartItems?.reduce((acc, item: any) => {
        const price = currency === "SAR" && item.product.priceSar
          ? Number(item.product.priceSar) : Number(item.product.price);
        return acc + price * item.quantity;
      }, 0) || 0;
    }
    return guestCart.reduce((acc, item) => {
      const product = allProducts.find(p => p.id === item.productId);
      if (!product) return acc;
      const price = currency === "SAR" && product.priceSar
        ? Number(product.priceSar) : Number(product.price);
      return acc + price * item.quantity;
    }, 0);
  }, [authCartItems, guestCart, currency, isAuthenticated, allProducts]);

  const discountAmount = useMemo(() =>
    couponData ? Math.floor(subtotal * (couponData.discountPercent / 100)) : 0,
    [subtotal, couponData]
  );

  const effectiveShippingFee = useMemo(() => {
    if (freeShippingMin === 0) return 0;
    return subtotal - discountAmount >= freeShippingMin ? 0 : shippingFee;
  }, [subtotal, discountAmount, shippingFee, freeShippingMin]);

  const finalTotal = useMemo(() =>
    subtotal - discountAmount + effectiveShippingFee,
    [subtotal, discountAmount, effectiveShippingFee]
  );

  const formatPrice = (n: number) => n.toLocaleString("ar-YE");
  const currLabel = currency === "YER" ? "ر.ي" : "ر.س";

  const isWalletPayment = formData.paymentMethod.startsWith("wallet_");
  const selectedWallet = isWalletPayment
    ? digitalWallets.find((w: any) => `wallet_${w.id}` === formData.paymentMethod)
    : null;

  const validateCoupon = async () => {
    if (!couponCode.trim()) { setCouponError("أدخل كود الخصم"); return; }
    setIsValidatingCoupon(true); setCouponError("");
    try {
      const res = await fetch(`/api/coupons/validate/${encodeURIComponent(couponCode.trim())}`);
      const data = await res.json();
      if (data.valid) {
        setCouponData(data.coupon);
        setShowCoupon(false);
        toast({ title: `✅ خصم ${data.coupon.discountPercent}% تم تطبيقه` });
      } else {
        setCouponError(data.error || "كود الخصم غير صالح");
      }
    } catch { setCouponError("خطأ في التحقق"); }
    finally { setIsValidatingCoupon(false); }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setReceiptFile(file); toast({ title: "✅ تم رفع الإيصال" }); }
  };

  const handleSubmit = async () => {
    if (!formData.customerName.trim() || formData.customerName.trim().length < 2) {
      toast({ title: "خطأ", description: "الاسم مطلوب (حرفين على الأقل)", variant: "destructive" }); return;
    }
    if (!formData.customerPhone.trim()) {
      toast({ title: "خطأ", description: "رقم الهاتف مطلوب", variant: "destructive" }); return;
    }
    if (!formData.shippingCity || !formData.shippingAddress.trim() || formData.shippingAddress.trim().length < 5) {
      setShowAddressForm(true);
      setTimeout(() => {
        addressRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      toast({ title: "⚠️ العنوان مطلوب", description: "يرجى إضافة عنوان التوصيل قبل تنفيذ الطلب", variant: "destructive" });
      return;
    }
    if (isWalletPayment && !formData.purchaseCode?.trim()) {
      toast({ title: "خطأ", description: "أدخل رقم الحوالة أو كود الدفع", variant: "destructive" }); return;
    }
    if (isWalletPayment && selectedWallet?.requiresProof && !receiptFile) {
      toast({ title: "خطأ", description: "ارفع صورة إيصال التحويل", variant: "destructive" }); return;
    }

    setIsSubmitting(true);
    try {
      const normalizedPaymentMethod = isWalletPayment ? "digital_wallet" : formData.paymentMethod;
      const deliveryNote = deliveryTime === "later" ? "\n[وقت التسليم: لاحقاً]" : "";
      const response = await apiRequest("POST", "/api/orders/create", {
        customerName: formData.customerName || user?.fullName || "عميل",
        customerEmail: user?.email || "guest@oyoplast.com",
        customerPhone: formData.customerPhone,
        shippingCity: formData.shippingCity,
        shippingAddress: formData.shippingAddress,
        shippingOption: "standard",
        shippingCost: effectiveShippingFee,
        paymentMethod: normalizedPaymentMethod,
        purchaseCode: formData.purchaseCode || undefined,
        notes: (formData.notes || "") + deliveryNote,
        total: finalTotal,
        items: cartItems,
        couponCode: couponData?.code || null,
        discountAmount: discountAmount > 0 ? discountAmount : null,
      });

      try {
        localStorage.setItem(savedKey, JSON.stringify({
          customerName: formData.customerName,
          customerPhone: formData.customerPhone,
          shippingCity: formData.shippingCity,
          shippingAddress: formData.shippingAddress,
        }));
        if (isAuthenticated) {
          await apiRequest("POST", "/api/checkout/save-address", {
            name: formData.customerName, city: formData.shippingCity,
            address: formData.shippingAddress, phone: formData.customerPhone, isDefault: true,
          });
        }
      } catch { /* non-fatal */ }

      const orderId = (response as any)?.id;
      if (!orderId) {
        throw new Error("لم يتم إرجاع رقم الطلب من الخادم");
      }

      clearGuestCart();
      await queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      setLocation(`/order-confirmation/${orderId}`);
    } catch {
      toast({ title: "خطأ", description: "حدث خطأ أثناء إنشاء الطلب", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingCart) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!cartItems || cartItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4 text-center">
        <p className="text-lg font-bold text-muted-foreground">السلة فارغة</p>
        <Link href="/products"><Button>تصفح المنتجات</Button></Link>
      </div>
    );
  }

  const hasAddress = formData.customerName && formData.shippingCity && formData.shippingAddress;
  const selectedPaymentName = isWalletPayment
    ? (selectedWallet?.name ?? "محفظة إلكترونية")
    : "الدفع عند الاستلام";

  return (
    <div className="min-h-screen bg-muted/30 dark:bg-background pb-32" dir="rtl">
      {/* ── Header ── */}
      <div className="sticky top-0 z-40 bg-background border-b flex items-center justify-between px-4 py-3">
        <Link href="/cart">
          <button className="p-1 text-muted-foreground" data-testid="button-back">
            <ArrowRight className="h-5 w-5" />
          </button>
        </Link>
        <h1 className="font-bold text-base">تأكيد الطلب</h1>
        <div className="w-7" />
      </div>

      <div className="space-y-1">
        {/* ── قسيمة الخصم ── */}
        <div className="bg-background">
          <button
            className="w-full flex items-center justify-between px-4 py-3"
            onClick={() => setShowCoupon(!showCoupon)}
            data-testid="button-toggle-coupon"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Tag className="h-4 w-4 text-primary" />
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">هل لديك قسيمة تخفيض؟</p>
                {couponData && (
                  <p className="text-xs text-green-600 font-bold">{couponData.code} — خصم {couponData.discountPercent}%</p>
                )}
              </div>
            </div>
            <span className="text-xs text-primary font-semibold shrink-0">
              {couponData ? <X className="h-4 w-4 text-red-500" onClick={e => { e.stopPropagation(); setCouponData(null); setCouponCode(""); }} /> : "إضافة"}
            </span>
          </button>
          {showCoupon && !couponData && (
            <div className="px-4 pb-3 flex gap-2">
              <Input
                placeholder="أدخل كود الخصم"
                value={couponCode}
                onChange={e => setCouponCode(e.target.value.toUpperCase())}
                className="h-9 text-sm flex-1"
                data-testid="input-coupon-code"
              />
              <Button size="sm" onClick={validateCoupon} disabled={isValidatingCoupon} className="h-9 px-4" data-testid="button-apply-coupon">
                {isValidatingCoupon ? <Loader2 className="h-3 w-3 animate-spin" /> : "تطبيق"}
              </Button>
            </div>
          )}
          {couponError && <p className="px-4 pb-2 text-xs text-red-500">{couponError}</p>}
        </div>

        <div className="h-px bg-border mx-4" />

        {/* ── عنوان التوصيل ── */}
        <div className="bg-background" ref={addressRef}>
          <button
            className="w-full flex items-center justify-between px-4 py-3"
            onClick={() => setShowAddressForm(!showAddressForm)}
            data-testid="button-toggle-address"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                <MapPin className="h-4 w-4 text-red-500" />
              </div>
              <div className="text-right flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">عنوان التوصيل:</p>
                {hasAddress ? (
                  <p className="text-sm font-semibold truncate">
                    {formData.shippingCity}، {formData.shippingAddress}
                  </p>
                ) : (
                  <p className="text-sm text-orange-500 font-semibold">أضف عنوان التوصيل</p>
                )}
              </div>
            </div>
            <span className="text-xs text-primary font-semibold shrink-0 mr-2">تغيير</span>
          </button>

          {/* Phone row */}
          {formData.customerPhone && !showAddressForm && (
            <div className="flex items-center gap-3 px-4 pb-2">
              <div className="w-9 h-9 shrink-0" />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-mono text-foreground font-medium">{formData.customerPhone}</span>
                <span className="text-xs">رقم التواصل</span>
              </div>
            </div>
          )}

          {/* Address Form */}
          {showAddressForm && (
            <div className="px-4 pb-4 space-y-2 border-t pt-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">الاسم الكامل *</p>
                  <Input
                    placeholder="اسمك"
                    value={formData.customerName}
                    onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                    className="h-9 text-sm"
                    data-testid="input-customer-name"
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">رقم الهاتف *</p>
                  <Input
                    type="tel"
                    placeholder="777XXXXXX"
                    value={formData.customerPhone}
                    onChange={e => setFormData({ ...formData, customerPhone: e.target.value })}
                    className="h-9 text-sm"
                    data-testid="input-phone"
                  />
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">المدينة *</p>
                <select
                  value={formData.shippingCity}
                  onChange={e => setFormData({ ...formData, shippingCity: e.target.value })}
                  className="w-full h-9 text-sm border border-input rounded-md px-3 bg-background"
                  data-testid="select-city"
                >
                  <option value="">اختر المدينة</option>
                  {YEMENI_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">العنوان التفصيلي *</p>
                <Textarea
                  placeholder="الحي، الشارع، علامة مميزة..."
                  value={formData.shippingAddress}
                  onChange={e => setFormData({ ...formData, shippingAddress: e.target.value })}
                  className="text-sm resize-none"
                  rows={2}
                  data-testid="input-address"
                />
              </div>
              <Button
                type="button"
                size="sm"
                className="w-full h-9"
                onClick={() => setShowAddressForm(false)}
                data-testid="button-save-address"
              >
                <Check className="h-4 w-4 ml-1" /> حفظ العنوان
              </Button>
            </div>
          )}
        </div>

        <div className="h-px bg-border mx-4" />

        {/* ── ملاحظات الطلب ── */}
        <div className="bg-background">
          <button
            className="w-full flex items-center justify-between px-4 py-3"
            onClick={() => setShowNotes(!showNotes)}
            data-testid="button-toggle-notes"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <MessageSquare className="h-4 w-4 text-primary" />
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">ملاحظات الطلب</p>
                <p className="text-xs text-muted-foreground">
                  {formData.notes || "لا يوجد ملاحظة"}
                </p>
              </div>
            </div>
            <span className="text-xs text-primary font-semibold">{showNotes ? "إغلاق" : "إضافة"}</span>
          </button>
          {showNotes && (
            <div className="px-4 pb-3">
              <Textarea
                placeholder="أي ملاحظات للمندوب..."
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                className="text-sm resize-none"
                rows={2}
                data-testid="input-notes"
              />
            </div>
          )}
        </div>

        <div className="h-px bg-border mx-4" />

        {/* ── وقت الطلب ── */}
        <div className="bg-background px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <Clock className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold">تحديد وقت الطلب</p>
              <p className="text-xs text-muted-foreground">وقت تنفيذ الطلب</p>
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setDeliveryTime("now")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                deliveryTime === "now"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
              data-testid="button-delivery-now"
            >
              {deliveryTime === "now" && <span>✓ </span>}الآن
            </button>
            <button
              type="button"
              onClick={() => setDeliveryTime("later")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                deliveryTime === "later"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
              data-testid="button-delivery-later"
            >
              في وقت لاحق
            </button>
          </div>
        </div>

        <div className="h-px bg-border mx-4" />

        {/* ── طريقة الدفع ── */}
        <div className="bg-background">
          <button
            className="w-full flex items-center justify-between px-4 py-3"
            onClick={() => setShowWallets(!showWallets)}
            data-testid="button-toggle-payment"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                <Wallet className="h-4 w-4 text-orange-500" />
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">طريقة الدفع</p>
                <p className="text-sm font-semibold">( {selectedPaymentName} )</p>
              </div>
            </div>
            {showWallets ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          {/* قائمة الدفع */}
          {showWallets && (
            <div className="border-t">
              {/* COD */}
              {codEnabled && (
                <button
                  type="button"
                  className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                    formData.paymentMethod === "cash_on_delivery" ? "bg-primary/5" : "hover:bg-muted/50"
                  }`}
                  onClick={() => {
                    setFormData({ ...formData, paymentMethod: "cash_on_delivery", purchaseCode: "" });
                    setReceiptFile(null);
                  }}
                  data-testid="payment-method-cash_on_delivery"
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    formData.paymentMethod === "cash_on_delivery" ? "border-primary" : "border-muted-foreground"
                  }`}>
                    {formData.paymentMethod === "cash_on_delivery" && (
                      <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                    )}
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                    <Banknote className="h-4 w-4 text-green-600" />
                  </div>
                  <span className="text-sm font-medium">الدفع عند الاستلام</span>
                  {formData.paymentMethod === "cash_on_delivery" && (
                    <CheckCircle className="h-4 w-4 text-primary mr-auto shrink-0" />
                  )}
                </button>
              )}

              {/* Digital Wallets */}
              {digitalWallets.filter((w: any) => w.isActive).map((wallet: any) => {
                const wId = `wallet_${wallet.id}`;
                const isSelected = formData.paymentMethod === wId;
                return (
                  <div key={wallet.id}>
                    <button
                      type="button"
                      className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                        isSelected ? "bg-primary/5" : "hover:bg-muted/50"
                      }`}
                      onClick={() => {
                        setFormData({ ...formData, paymentMethod: wId, purchaseCode: "" });
                        setReceiptFile(null);
                      }}
                      data-testid={`payment-method-${wId}`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isSelected ? "border-primary" : "border-muted-foreground"
                      }`}>
                        {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                      </div>
                      {wallet.logoUrl ? (
                        <img src={wallet.logoUrl} alt={wallet.name} className="w-9 h-9 rounded-lg object-contain shrink-0 border bg-white p-0.5" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Smartphone className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <span className="text-sm font-medium flex-1 text-right">{wallet.name}</span>
                    </button>

                    {/* تفاصيل المحفظة المختارة */}
                    {isSelected && (
                      <div className="mx-4 mb-3 rounded-xl border bg-muted/30 overflow-hidden">
                        {/* معلومات الحساب */}
                        <div className="flex items-start gap-3 p-3 border-b">
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-0.5">اسم المستلم</p>
                            <p className="text-sm font-bold">{wallet.receiverName}</p>
                          </div>
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-0.5">رقم الحساب</p>
                            <div className="flex items-center gap-1">
                              <p className="text-sm font-mono font-bold">{wallet.phoneNumber}</p>
                              <button
                                type="button"
                                onClick={() => { navigator.clipboard.writeText(wallet.phoneNumber); toast({ title: "✅ تم نسخ الرقم" }); }}
                                className="text-primary"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {wallet.instructions && (
                          <p className="px-3 py-2 text-xs text-blue-600 dark:text-blue-400 border-b bg-blue-50 dark:bg-blue-900/20">
                            {wallet.instructions}
                          </p>
                        )}

                        <div className="p-3 space-y-2">
                          {/* كود الدفع */}
                          <div>
                            <p className="text-xs font-semibold mb-1">رقم الحوالة / كود الدفع *</p>
                            <Input
                              type="text"
                              value={formData.purchaseCode}
                              onChange={e => setFormData({ ...formData, purchaseCode: e.target.value })}
                              placeholder="أدخل رقم السند أو كود التحويل"
                              className="h-9 text-sm font-mono"
                              data-testid="input-purchase-code"
                            />
                          </div>
                          {/* رفع الإيصال */}
                          {wallet.requiresProof && (
                            <div>
                              <p className="text-xs font-semibold mb-1">صورة إيصال التحويل *</p>
                              <div
                                className="border-2 border-dashed rounded-lg p-3 text-center cursor-pointer hover:border-primary/50 transition-colors"
                                onClick={() => fileInputRef.current?.click()}
                                data-testid="upload-receipt-area"
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
                                  <div className="flex items-center justify-center gap-2 text-green-600">
                                    <Check className="h-4 w-4" />
                                    <span className="text-sm font-medium truncate max-w-[180px]">{receiptFile.name}</span>
                                  </div>
                                ) : (
                                  <div className="text-muted-foreground">
                                    <Upload className="h-5 w-5 mx-auto mb-1" />
                                    <p className="text-xs">اضغط لرفع صورة الإيصال</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* زر إغلاق القائمة */}
              <div className="px-4 pb-3">
                <button
                  type="button"
                  onClick={() => setShowWallets(false)}
                  className="w-full py-2 rounded-lg bg-muted text-sm font-medium text-muted-foreground"
                  data-testid="button-close-payment"
                >
                  إغلاق
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── قسم الإجماليات ── */}
        <div className="bg-background mx-0">
          <div className="px-4 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-bold text-muted-foreground">الإجمالي</span>
              <span className="font-semibold">{formatPrice(subtotal)} {currLabel}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>الخصم ({couponData?.discountPercent}%)</span>
                <span className="font-bold">- {formatPrice(discountAmount)} {currLabel}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">التوصيل</span>
              <span className={effectiveShippingFee === 0 ? "text-green-600 font-semibold" : "font-semibold"}>
                {effectiveShippingFee === 0 ? "مجاني" : `${formatPrice(effectiveShippingFee)} ${currLabel}`}
              </span>
            </div>
          </div>

          {/* الإجمالي الكلي */}
          <div className="mx-4 mt-3 mb-4 rounded-xl bg-amber-400/90 dark:bg-amber-600/80 px-4 py-3 flex justify-between items-center">
            <span className="font-extrabold text-base text-amber-900 dark:text-amber-100">الإجمالي الكلي</span>
            <span className="font-extrabold text-xl text-amber-900 dark:text-amber-100" data-testid="text-final-total">
              {formatPrice(finalTotal)} {currLabel}
            </span>
          </div>

          {/* جدول المنتجات */}
          <div className="border-t mx-0">
            <div className="px-4 py-2 bg-muted/50 flex justify-between text-xs font-bold text-muted-foreground">
              <span>المنتج</span>
              <span>الكمية × السعر</span>
            </div>
            {cartItems.map((item: any, idx: number) => {
              const isAuthItem = item.id && item.product;
              const product = isAuthItem ? item.product : allProducts.find((p: any) => p.id === item.productId);
              if (!product) return null;
              const price = currency === "SAR" && product.priceSar
                ? Number(product.priceSar) : Number(product.price);
              const qty = isAuthItem ? item.quantity : item.quantity;
              const selectedColor = item.selectedColor || item.color || "";
              const selectedSize  = item.selectedSize  || item.size  || "";
              const imageUrl = product.imageUrl?.startsWith("http")
                ? product.imageUrl
                : product.imageUrl
                  ? product.imageUrl
                  : null;
              return (
                <div
                  key={isAuthItem ? item.id : idx}
                  className="flex items-center gap-3 px-4 py-3 border-t"
                  data-testid={`checkout-item-${isAuthItem ? item.id : idx}`}
                >
                  {/* صورة المنتج */}
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={product.name}
                      className="w-14 h-14 object-cover rounded-lg shrink-0 border"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div className="w-14 h-14 bg-muted rounded-lg shrink-0 flex items-center justify-center text-xs text-muted-foreground">
                      📦
                    </div>
                  )}

                  {/* اسم المنتج + تفاصيل */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm line-clamp-2 leading-tight">{product.name}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedColor && (
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                          اللون: {selectedColor}
                        </span>
                      )}
                      {selectedSize && (
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                          المقاس: {selectedSize}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* الكمية والإجمالي */}
                  <div className="text-left shrink-0">
                    <p className="text-xs text-muted-foreground">{qty} × {formatPrice(price)}</p>
                    <p className="font-extrabold text-sm text-primary">{formatPrice(price * qty)} {currLabel}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── أزرار الأسفل الثابتة ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t px-4 py-4 flex gap-3 shadow-xl">
        <Link href="/cart" className="flex-1">
          <Button
            variant="outline"
            className="w-full h-13 text-base font-bold rounded-xl border-2"
            data-testid="button-edit-cart"
          >
            🛒 تعديل السلة
          </Button>
        </Link>
        <Button
          className="flex-1 h-13 font-extrabold text-base rounded-xl"
          style={{ minHeight: '52px' }}
          onClick={handleSubmit}
          disabled={isSubmitting}
          data-testid="button-submit-order"
        >
          {isSubmitting ? (
            <><Loader2 className="h-4 w-4 animate-spin ml-2" />جاري الإرسال...</>
          ) : "✅ تنفيذ الطلب"}
        </Button>
      </div>
    </div>
  );
}
