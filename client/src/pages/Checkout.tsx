import { useCart } from "@/hooks/use-cart";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Link, useLocation } from "wouter";
import {
  ArrowRight, Upload, Check, Loader2, Banknote,
  MapPin, Smartphone, Copy, ChevronDown, ChevronUp,
  Clock, MessageSquare, Wallet, Tag, X, CheckCircle,
  SplitSquareVertical, Users, Phone, FileText, ChevronRight, Building2,
  CreditCard, Snowflake, AlertTriangle
} from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import type { Product } from "@shared/schema";
import { useDigitalWallets } from "@/hooks/use-digital-wallets";
import { GuestCartItem, getGuestCart, setGuestCart as saveGuestCart, clearGuestCart } from "@/lib/cartUtils";
import { useDisplaySettings } from "@/hooks/use-display-settings";
import { OrderItemCompactMeta, OrderItemCollapsibleMeta } from "@/components/OrderItemDetails";

const YEMENI_CITIES = [
  "صنعاء","عدن","تعز","الحديدة","إب","ذمار","المكلا","سيئون",
  "البيضاء","حجة","صعدة","لحج","الضالع","المحويت","عمران","شبوة","أبين","الجوف"
];

export default function Checkout() {
  const { data: authCartItems, isLoading } = useCart();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { isAuthenticated, user, isLoading: isAuthLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLDivElement>(null);

  const [guestCart, setGuestCart] = useState<GuestCartItem[]>(() => getGuestCart());

  // جلب المنتجات دائماً للضيوف — للتحقق من صلاحية سلتهم وعرض الأسعار
  const { data: allProducts = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: !isAuthenticated,
    staleTime: 60_000,
  });

  const cartItems = isAuthenticated ? authCartItems : guestCart;
  const isLoadingCart = !isAuthenticated ? false : isLoading;
  const itemDisplaySettings = useDisplaySettings();
  const checkoutCfg = itemDisplaySettings.checkout;

  const { data: digitalWallets = [] } = useDigitalWallets();

  const { data: bankAccounts = [] } = useQuery<any[]>({
    queryKey: ["/api/bank-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/bank-accounts");
      return res.ok ? res.json() : [];
    },
    staleTime: 300000,
  });

  const { data: displaySettings } = useQuery<any>({
    queryKey: ["/api/display-settings"],
  });

  const shippingFee: number = displaySettings?.shippingFee ?? 0;
  const freeShippingMin: number = displaySettings?.sadeemFreeShippingMin ?? 0;
  const codEnabled: boolean = displaySettings?.codEnabled ?? true;
  const installmentEnabled: boolean = displaySettings?.installmentEnabled ?? true;
  const installmentMin: number = displaySettings?.installmentMinAmount ?? 50000;
  const installmentPercentages: number[] = (displaySettings?.installmentPercentages ?? "30,40,50")
    .split(",").map((p: string) => parseInt(p.trim())).filter((p: number) => !isNaN(p) && p > 0);

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
  const [receiptAmountClaimed, setReceiptAmountClaimed] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deliveryTime, setDeliveryTime] = useState<"now" | "later">("now");
  const [currency] = useState<"YER" | "SAR">(() =>
    (localStorage.getItem("currency") as "YER" | "SAR") || "YER"
  );

  const [showCoupon, setShowCoupon] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [showWallets, setShowWallets] = useState(false);

  // ─── حالة نظام التقسيط ──────────────────────────────────────────────
  const [installmentType, setInstallmentType] = useState<null | "deposit_cod" | "supplier_guaranteed">(null);
  const [depositPercent, setDepositPercent] = useState<number>(30);
  const [guarantorName, setGuarantorName] = useState("");
  const [guarantorPhone, setGuarantorPhone] = useState("");
  const [guarantorNotes, setGuarantorNotes] = useState("");
  const [receiptCountdown, setReceiptCountdown] = useState<number | null>(null);

  // ── GPS / الموقع الجغرافي ────────────────────────────────────────────────
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [locationMethod, setLocationMethod] = useState<"gps" | "manual">("manual");
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationLabel, setLocationLabel] = useState<string>("");
  const [nearestDistributor, setNearestDistributor] = useState<{ name: string; distanceKm: number; withinRadius: boolean } | null>(null);

  // جلب الموردين النشطين للكفيل
  const { data: suppliersList = [] } = useQuery<any[]>({
    queryKey: ["/api/public/suppliers-list"],
    staleTime: 300000,
  });

  // ── جلب بيانات الائتمان للمستخدم المسجّل (للشراء بالأجل) ─────────
  const { data: creditInfo } = useQuery<any>({
    queryKey: ["/api/my/credit"],
    enabled: isAuthenticated,
    staleTime: 30000,
  });
  const creditAvailable = Number(creditInfo?.available_credit ?? 0);
  const creditLimit = Number(creditInfo?.effective_credit_limit ?? 0);
  const creditBalance = Number(creditInfo?.current_balance ?? 0);
  const creditPaymentTerm = Number(creditInfo?.tier_payment_term_days ?? 0);
  const creditDownPercent = Number(
    (creditInfo?.manual_override && creditInfo?.down_payment_override !== null
      ? creditInfo?.down_payment_override
      : creditInfo?.tier_down_payment_percent) ?? 0
  );
  const creditFrozen = !!creditInfo?.is_frozen;
  const creditTierName = creditInfo?.tier_name_ar || "";
  const creditTierIcon = creditInfo?.tier_icon || "";
  const creditTierColor = creditInfo?.tier_color || "#666";
  const creditEnabled =
    isAuthenticated &&
    !!creditInfo &&
    !creditFrozen &&
    creditLimit > 0 &&
    creditInfo?.tier !== "blocked";

  // تهيئة نسبة المقدّم من الإعدادات عند تحميلها
  useEffect(() => {
    if (installmentPercentages.length > 0) {
      setDepositPercent(prev => installmentPercentages.includes(prev) ? prev : installmentPercentages[0]);
    }
  }, [displaySettings]);

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

  // ── تنظيف سلة الضيف: إزالة المنتجات المحذوفة أو غير المتاحة ──────────
  useEffect(() => {
    if (isAuthenticated || allProducts.length === 0 || guestCart.length === 0) return;
    const validIds = new Set(allProducts.map(p => p.id));
    const invalid = guestCart.filter(item => !validIds.has(item.productId));
    if (invalid.length > 0) {
      const cleaned = guestCart.filter(item => validIds.has(item.productId));
      setGuestCart(cleaned);
      // حفظ السلة المنظفة في localStorage
      saveGuestCart(cleaned);
      toast({
        title: "⚠️ تم تحديث السلة",
        description: `تم إزالة ${invalid.length} منتج لم يعد متاحاً من سلتك`,
      });
    }
  }, [allProducts, isAuthenticated]);

  useEffect(() => {
    if (!codEnabled && formData.paymentMethod === "cash_on_delivery") {
      const firstWallet = digitalWallets.find((w: any) => w.isActive);
      if (firstWallet) setFormData(prev => ({ ...prev, paymentMethod: `wallet_${firstWallet.id}` }));
    }
  }, [codEnabled, digitalWallets]);

  const subtotal = useMemo(() => {
    // 🔧 إصلاح حرج (مايو 2026): استخدم item.unitPrice (السعر الفعلي للمتغيّر الذكي المختار)
    // بدل product.price (الذي يعكس أرخص متغيّر فقط). كان يسبب حساب الإجمالي بأرخص سعر للجميع.
    if (isAuthenticated) {
      return authCartItems?.reduce((acc, item: any) => {
        const rate = item.product?.priceSar && item.product?.price
          ? Number(item.product.price) / Number(item.product.priceSar)
          : 0;
        const unitY = item.unitPrice != null ? Number(item.unitPrice) : Number(item.product.price);
        const unitS = currency === "SAR"
          ? (rate > 0 ? unitY / rate : Number(item.product.priceSar || 0))
          : 0;
        const price = currency === "SAR" ? unitS : unitY;
        return acc + price * item.quantity;
      }, 0) || 0;
    }
    return guestCart.reduce((acc, item: any) => {
      const product = allProducts.find(p => p.id === item.productId);
      if (!product) return acc;
      const rate = product.priceSar && product.price
        ? Number(product.price) / Number(product.priceSar)
        : 0;
      const unitY = item.unitPrice != null ? Number(item.unitPrice) : Number(product.price);
      const unitS = currency === "SAR"
        ? (rate > 0 ? unitY / rate : Number(product.priceSar || 0))
        : 0;
      const price = currency === "SAR" ? unitS : unitY;
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

  const isBankTransfer = formData.paymentMethod.startsWith("bank_");
  const selectedBank = isBankTransfer
    ? bankAccounts.find((b: any) => `bank_${b.id}` === formData.paymentMethod)
    : null;

  // ─── حسابات التقسيط ───────────────────────────────────────────────
  const isInstallmentOrder = installmentType !== null;
  const depositAmount = isInstallmentOrder ? Math.round(finalTotal * (depositPercent / 100)) : 0;
  const remainingAmount = isInstallmentOrder ? finalTotal - depositAmount : 0;

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

  // ── تحديد الموقع الجغرافي بـ GPS ──────────────────────────────────────────
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "GPS غير مدعوم", description: "يرجى إدخال العنوان يدوياً", variant: "destructive" });
      return;
    }
    setLocationLoading(true);
    setNearestDistributor(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setLocationLat(latitude);
        setLocationLng(longitude);
        setLocationAccuracy(accuracy);
        setLocationMethod("gps");
        setLocationLabel(`${latitude.toFixed(5)}° ، ${longitude.toFixed(5)}°`);
        setLocationLoading(false);
        // جلب أقرب موزع
        try {
          const r = await fetch(`/api/location/nearest-distributors?lat=${latitude}&lng=${longitude}`);
          if (r.ok) {
            const data = await r.json();
            if (data.length > 0) setNearestDistributor(data[0]);
          }
        } catch { /* silent */ }
      },
      (err) => {
        setLocationLoading(false);
        const msg = err.code === 1
          ? "يرجى السماح للمتصفح بالوصول إلى موقعك، أو أدخل العنوان يدوياً"
          : "تعذّر تحديد الموقع، يرجى إدخال العنوان يدوياً";
        toast({ title: "⚠️ تعذّر تحديد الموقع", description: msg, variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 }
    );
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
    if (isBankTransfer && !formData.purchaseCode?.trim()) {
      toast({ title: "خطأ", description: "أدخل رقم الحوالة البنكية أو رقم الإيصال", variant: "destructive" }); return;
    }
    if (isBankTransfer && !receiptFile) {
      toast({ title: "خطأ", description: "ارفع صورة إيصال التحويل البنكي", variant: "destructive" }); return;
    }
    // تحقق من بيانات التقسيط
    if (installmentType === "deposit_cod" && !isWalletPayment && !isBankTransfer) {
      toast({ title: "خطأ", description: "اختر محفظة إلكترونية أو تحويل بنكي لدفع المقدّم", variant: "destructive" }); return;
    }
    if (installmentType === "supplier_guaranteed" && !guarantorName.trim()) {
      toast({ title: "خطأ", description: "أدخل اسم الكفيل (المورد)", variant: "destructive" }); return;
    }
    if (installmentType === "supplier_guaranteed" && !guarantorPhone.trim()) {
      toast({ title: "خطأ", description: "أدخل رقم هاتف الكفيل", variant: "destructive" }); return;
    }

    setIsSubmitting(true);
    try {
      const normalizedPaymentMethod = installmentType
        ? (installmentType === "deposit_cod" ? "installment_deposit_cod" : "supplier_guaranteed")
        : isWalletPayment ? "digital_wallet"
        : isBankTransfer ? "bank_transfer"
        : formData.paymentMethod;
      const deliveryNote = deliveryTime === "later" ? "\n[وقت التسليم: لاحقاً]" : "";
      const bankTransferNote = isBankTransfer && selectedBank
        ? `\n[تحويل بنكي إلى: ${selectedBank.bankName} — رقم الحوالة: ${formData.purchaseCode}]`
        : "";
      const installmentNote = installmentType === "deposit_cod"
        ? `\n[تقسيط: مقدّم ${depositPercent}% = ${formatPrice(depositAmount)} ${currLabel} + باقي ${formatPrice(remainingAmount)} ${currLabel} عند التسليم]`
        : installmentType === "supplier_guaranteed"
        ? `\n[تقسيط بكفيل مورد: ${guarantorName} / ${guarantorPhone}${guarantorNotes ? " - " + guarantorNotes : ""}]`
        : "";
      const rawRes = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          customerName: formData.customerName || user?.fullName || "عميل",
          customerEmail: user?.email || "guest@oyoplast.com",
          customerPhone: formData.customerPhone,
          shippingCity: formData.shippingCity,
          shippingAddress: formData.shippingAddress,
          shippingOption: "standard",
          shippingCost: effectiveShippingFee,
          paymentMethod: normalizedPaymentMethod,
          purchaseCode: formData.purchaseCode || undefined,
          notes: (formData.notes || "") + deliveryNote + bankTransferNote + installmentNote,
          total: finalTotal,
          depositAmount: installmentType ? depositAmount : undefined,
          items: cartItems,
          couponCode: couponData?.code || null,
          discountAmount: discountAmount > 0 ? discountAmount : null,
          subtotalBeforeDiscount: discountAmount > 0 ? subtotal : null,
          // ── GPS Coordinates ──
          customerLat: locationLat ?? undefined,
          customerLng: locationLng ?? undefined,
          locationAccuracy: locationAccuracy ?? undefined,
          locationMethod: locationLat ? "gps" : "manual",
        }),
      });

      let orderData: any;
      try {
        orderData = await rawRes.json();
      } catch {
        throw new Error("حدث خطأ في الاتصال بالخادم، يرجى المحاولة مرة أخرى");
      }
      if (!rawRes.ok) {
        throw new Error(orderData?.message || "حدث خطأ أثناء إنشاء الطلب، يرجى المحاولة مرة أخرى");
      }

      const orderId = orderData?.id;
      if (!orderId) {
        throw new Error("لم يتم إرجاع رقم الطلب من الخادم، يرجى المحاولة مرة أخرى");
      }

      // ─── إنشاء خطة التقسيط ───────────────────────────────────────────
      if (installmentType) {
        try {
          await fetch("/api/installment-plans", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId,
              customerId: user?.id || null,
              customerName: formData.customerName || user?.fullName || "عميل",
              customerPhone: formData.customerPhone,
              planType: installmentType,
              totalAmount: finalTotal,
              depositAmount,
              guarantorSupplierName: installmentType === "supplier_guaranteed" ? guarantorName : null,
              guarantorSupplierPhone: installmentType === "supplier_guaranteed" ? guarantorPhone : null,
              guarantorNotes: installmentType === "supplier_guaranteed" ? guarantorNotes : null,
            }),
          });
        } catch { /* non-fatal — plan can be created manually */ }
      }

      // ─── رفع إيصال الدفع إن وُجد ─────────────────────────────────────
      if (receiptFile && orderId) {
        try {
          const receiptForm = new FormData();
          receiptForm.append("receipt", receiptFile);
          if (receiptAmountClaimed) {
            receiptForm.append("amountClaimed", String(receiptAmountClaimed));
          }
          await fetch(`/api/orders/${orderId}/upload-receipt`, {
            method: "POST",
            body: receiptForm,
          });
        } catch { /* non-fatal — can be uploaded later */ }
      }

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

      clearGuestCart();
      await queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      // replace: true → نحذف /checkout من history لمنع رجوع المستخدم له بعد إنشاء الطلب
      setLocation(`/order-confirmation/${orderId}`, { replace: true });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message || "حدث خطأ أثناء إنشاء الطلب", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingCart || isAuthLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  // ── تسجيل الدخول إلزامي قبل إتمام الطلب ─────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <div className="bg-card border rounded-2xl shadow-xl p-8 w-full max-w-sm space-y-5">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <ArrowRight className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold mb-2">يجب تسجيل الدخول أولاً</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              لإتمام طلبك وتتبّعه لاحقاً، يرجى تسجيل الدخول أو إنشاء حساب
            </p>
          </div>
          <Link href="/auth?redirect=/checkout">
            <Button className="w-full h-12 text-base font-extrabold rounded-xl" data-testid="button-go-login">
              تسجيل الدخول / إنشاء حساب
            </Button>
          </Link>
          <Link href="/">
            <button className="text-sm text-muted-foreground hover:text-foreground w-full py-1" data-testid="button-back-home">
              العودة للمتجر
            </button>
          </Link>
        </div>
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
  const selectedPaymentName = installmentType === "deposit_cod"
    ? `مقدّم ${depositPercent}% + باقي عند التسليم`
    : installmentType === "supplier_guaranteed"
    ? "تقسيط بكفيل مورد"
    : formData.paymentMethod === "credit"
    ? `شراء بالأجل (${creditTierName})`
    : isWalletPayment
    ? (selectedWallet?.name ?? "محفظة إلكترونية")
    : isBankTransfer
    ? (selectedBank ? `تحويل بنكي — ${selectedBank.bankName}` : "تحويل بنكي")
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
                  <div>
                    <p className="text-sm font-semibold truncate">{formData.shippingCity}، {formData.shippingAddress}</p>
                    {locationLat && <p className="text-[10px] text-green-600 flex items-center gap-1 mt-0.5"><MapPin className="w-2.5 h-2.5" />📍 تم تحديد الموقع بنجاح</p>}
                  </div>
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
              {/* ── GPS Widget ── */}
              <div className="rounded-xl overflow-hidden border border-green-200">
                {locationLat ? (
                  <div className="bg-green-50 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-green-700">
                      <MapPin className="h-4 w-4 shrink-0 text-green-600" />
                      <div className="flex-1">
                        <p className="text-xs font-bold text-green-800">✅ تم تحديد موقعك بنجاح</p>
                        <p className="text-xs text-green-600 font-mono">{locationLabel}</p>
                        {locationAccuracy && <p className="text-[10px] text-green-500">دقة التحديد: ±{Math.round(locationAccuracy)} متر</p>}
                      </div>
                      <button onClick={() => { setLocationLat(null); setLocationLng(null); setLocationLabel(""); setNearestDistributor(null); }} className="text-green-400 hover:text-red-500 text-xs">✕</button>
                    </div>
                    {nearestDistributor && (
                      <div className={`flex items-center gap-2 text-xs rounded-lg px-2 py-1.5 ${nearestDistributor.withinRadius ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-700"}`}>
                        <span className="text-base">{nearestDistributor.withinRadius ? "✅" : "⚠️"}</span>
                        <span>
                          {nearestDistributor.withinRadius
                            ? "منطقتك ضمن نطاق التوصيل"
                            : "منطقتك خارج نطاق التغطية المعتادة — سنتواصل معك لترتيب التوصيل"}
                        </span>
                      </div>
                    )}
                    <button onClick={handleGetLocation} disabled={locationLoading} className="w-full text-xs text-green-600 underline text-center">
                      إعادة تحديد الموقع
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleGetLocation}
                    disabled={locationLoading}
                    className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-bold py-3 transition-colors"
                    data-testid="button-get-location"
                  >
                    {locationLoading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        جاري تحديد الموقع...
                      </>
                    ) : (
                      <>
                        <MapPin className="h-4 w-4" />
                        📍 تحديد موقعي تلقائياً (GPS)
                      </>
                    )}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 my-1">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground px-2">أو أدخل العنوان يدوياً</span>
                <div className="flex-1 h-px bg-border" />
              </div>

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
                    setReceiptFile(null); setReceiptAmountClaimed("");
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

              {/* ─── الشراء بالأجل (الائتمان) ──────────────────────────── */}
              {creditEnabled && (
                <button
                  type="button"
                  className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                    formData.paymentMethod === "credit" ? "bg-primary/5" : "hover:bg-muted/50"
                  }`}
                  onClick={() => {
                    setFormData({ ...formData, paymentMethod: "credit", purchaseCode: "" });
                    setReceiptFile(null); setReceiptAmountClaimed("");
                  }}
                  data-testid="payment-method-credit"
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    formData.paymentMethod === "credit" ? "border-primary" : "border-muted-foreground"
                  }`}>
                    {formData.paymentMethod === "credit" && (
                      <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                    )}
                  </div>
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${creditTierColor}25` }}
                  >
                    <CreditCard className="h-4 w-4" style={{ color: creditTierColor }} />
                  </div>
                  <div className="flex-1 text-right">
                    <p className="text-sm font-medium flex items-center gap-1">
                      <span>{creditTierIcon}</span>
                      شراء بالأجل ({creditTierName})
                    </p>
                    <p className="text-xs text-muted-foreground">
                      المتاح: {creditAvailable.toLocaleString()} ر.ي · مدة {creditPaymentTerm} يوم
                    </p>
                  </div>
                  {formData.paymentMethod === "credit" && (
                    <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                  )}
                </button>
              )}

              {/* لوحة تفاصيل الائتمان عند اختياره */}
              {formData.paymentMethod === "credit" && creditEnabled && (
                <div className="mx-4 mb-3 rounded-xl border-2 overflow-hidden"
                  style={{ borderColor: creditTierColor }}>
                  <div
                    className="p-3 flex items-center gap-3"
                    style={{ background: `${creditTierColor}15` }}
                  >
                    <span className="text-3xl">{creditTierIcon}</span>
                    <div className="flex-1 text-right">
                      <p className="text-xs text-muted-foreground">فئتك الائتمانية</p>
                      <p className="font-bold" style={{ color: creditTierColor }}>
                        {creditTierName}
                      </p>
                    </div>
                  </div>
                  <div className="p-3 grid grid-cols-2 gap-3 text-sm border-t">
                    <div>
                      <p className="text-xs text-muted-foreground">السقف الكلي</p>
                      <p className="font-bold">{creditLimit.toLocaleString()} ر.ي</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">رصيد مستحق</p>
                      <p className="font-bold text-amber-600">{creditBalance.toLocaleString()} ر.ي</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">المتاح للشراء</p>
                      <p className="font-bold text-green-600">{creditAvailable.toLocaleString()} ر.ي</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">مدة السداد</p>
                      <p className="font-bold">{creditPaymentTerm} يوم</p>
                    </div>
                    {creditDownPercent > 0 && (
                      <div className="col-span-2 p-2 rounded bg-amber-50 dark:bg-amber-950/30 text-xs">
                        <span className="font-bold">⚠️ دفعة مقدمة مطلوبة:</span>{" "}
                        {creditDownPercent}% من قيمة الطلب
                      </div>
                    )}
                  </div>
                  {finalTotal > creditAvailable && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/30 border-t text-sm flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-red-700 dark:text-red-400">
                          المبلغ يتجاوز الرصيد المتاح
                        </p>
                        <p className="text-xs text-red-600 mt-1">
                          تحتاج {(finalTotal - creditAvailable).toLocaleString()} ر.ي إضافية أو اختر طريقة دفع أخرى
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* تنبيه التجميد إن كان حساب العميل مجمَّداً */}
              {isAuthenticated && creditFrozen && (
                <div className="mx-4 mb-3 rounded-xl border border-cyan-300 bg-cyan-50 dark:bg-cyan-950/30 p-3 flex items-start gap-2">
                  <Snowflake className="h-5 w-5 text-cyan-600 shrink-0" />
                  <div className="text-sm">
                    <p className="font-bold text-cyan-800 dark:text-cyan-300">حسابك مجمَّد مؤقتاً</p>
                    <p className="text-xs text-cyan-700 dark:text-cyan-400 mt-1">
                      {creditInfo?.frozen_reason || "يرجى التواصل مع الإدارة"}
                    </p>
                  </div>
                </div>
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
                        setReceiptFile(null); setReceiptAmountClaimed("");
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
                              {/* المبلغ المُدّعى دفعه */}
                              {receiptFile && (
                                <div className="mt-2">
                                  <p className="text-xs font-semibold mb-1">المبلغ الذي حوّلته (ر.ي) *</p>
                                  <Input
                                    type="number"
                                    inputMode="numeric"
                                    value={receiptAmountClaimed}
                                    onChange={e => setReceiptAmountClaimed(e.target.value)}
                                    placeholder={`المبلغ المطلوب: ${Math.round(finalTotal).toLocaleString()}`}
                                    className="h-9 text-sm"
                                    data-testid="input-amount-claimed-wallet"
                                  />
                                  {receiptAmountClaimed && Number(receiptAmountClaimed) > 0 && Number(receiptAmountClaimed) < finalTotal && (
                                    <p className="text-[11px] text-red-600 mt-1 font-medium">
                                      ⚠️ المبلغ أقل من قيمة الطلب ({Math.round(finalTotal).toLocaleString()} ر.ي)
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* ── التحويل البنكي ── */}
              {bankAccounts.filter((b: any) => b.isActive).length > 0 && (
                <>
                  <div className="mx-4 mt-1 mb-1">
                    <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5 text-blue-600" />
                      تحويل بنكي
                    </p>
                  </div>
                  {bankAccounts.filter((b: any) => b.isActive).map((bank: any) => {
                    const bId = `bank_${bank.id}`;
                    const isSelected = formData.paymentMethod === bId;
                    return (
                      <div key={bank.id}>
                        <button
                          type="button"
                          className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                            isSelected ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-muted/50"
                          }`}
                          onClick={() => {
                            setFormData({ ...formData, paymentMethod: bId, purchaseCode: "" });
                            setReceiptFile(null); setReceiptAmountClaimed("");
                            setInstallmentType(null);
                          }}
                          data-testid={`payment-method-${bId}`}
                        >
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            isSelected ? "border-blue-600" : "border-muted-foreground"
                          }`}>
                            {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                          </div>
                          {bank.logoUrl ? (
                            <img src={bank.logoUrl} alt={bank.bankName} className="w-9 h-9 rounded-lg object-contain shrink-0 border bg-white p-0.5" />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                              <Building2 className="h-4 w-4 text-blue-600" />
                            </div>
                          )}
                          <div className="text-right flex-1">
                            <span className="text-sm font-medium">{bank.bankName}</span>
                            <p className="text-xs text-muted-foreground">{bank.accountName}</p>
                          </div>
                          {isSelected && <CheckCircle className="h-4 w-4 text-blue-600 shrink-0" />}
                        </button>

                        {isSelected && (
                          <div className="mx-4 mb-3 rounded-xl border bg-muted/30 overflow-hidden">
                            <div className="p-3 border-b space-y-1.5">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">اسم صاحب الحساب</span>
                                <span className="text-sm font-bold">{bank.accountName}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">رقم الحساب</span>
                                <div className="flex items-center gap-1">
                                  <span className="text-sm font-mono font-bold">{bank.accountNumber}</span>
                                  <button
                                    type="button"
                                    onClick={() => { navigator.clipboard.writeText(bank.accountNumber); toast({ title: "✅ تم نسخ رقم الحساب" }); }}
                                    className="text-primary"
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                              {bank.iban && (
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-muted-foreground">IBAN</span>
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs font-mono">{bank.iban}</span>
                                    <button type="button" onClick={() => { navigator.clipboard.writeText(bank.iban); toast({ title: "✅ تم نسخ IBAN" }); }} className="text-primary">
                                      <Copy className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              )}
                              {bank.branch && <p className="text-xs text-muted-foreground">الفرع: {bank.branch}</p>}
                            </div>
                            {bank.instructions && (
                              <p className="px-3 py-2 text-xs text-blue-600 dark:text-blue-400 border-b bg-blue-50 dark:bg-blue-900/20">
                                {bank.instructions}
                              </p>
                            )}
                            <div className="p-3 space-y-2">
                              <div>
                                <p className="text-xs font-semibold mb-1">رقم الحوالة البنكية *</p>
                                <Input
                                  type="text"
                                  value={formData.purchaseCode}
                                  onChange={e => setFormData({ ...formData, purchaseCode: e.target.value })}
                                  placeholder="أدخل رقم الحوالة أو رقم الإيصال"
                                  className="h-9 text-sm font-mono"
                                  data-testid="input-bank-transfer-code"
                                />
                              </div>
                              <div>
                                <p className="text-xs font-semibold mb-1">صورة إيصال التحويل *</p>
                                <div
                                  className="border-2 border-dashed rounded-lg p-3 text-center cursor-pointer hover:border-blue-400 transition-colors"
                                  onClick={() => fileInputRef.current?.click()}
                                  data-testid="upload-bank-receipt-area"
                                >
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
                              {/* المبلغ المُدّعى دفعه */}
                              {receiptFile && (
                                <div>
                                  <p className="text-xs font-semibold mb-1">المبلغ الذي حوّلته (ر.ي) *</p>
                                  <Input
                                    type="number"
                                    inputMode="numeric"
                                    value={receiptAmountClaimed}
                                    onChange={e => setReceiptAmountClaimed(e.target.value)}
                                    placeholder={`المبلغ المطلوب: ${Math.round(finalTotal).toLocaleString()}`}
                                    className="h-9 text-sm"
                                    data-testid="input-amount-claimed-bank"
                                  />
                                  {receiptAmountClaimed && Number(receiptAmountClaimed) > 0 && Number(receiptAmountClaimed) < finalTotal && (
                                    <p className="text-[11px] text-red-600 mt-1 font-medium">
                                      ⚠️ المبلغ أقل من قيمة الطلب ({Math.round(finalTotal).toLocaleString()} ر.ي)
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}

              {/* ── خيارات التقسيط ── */}
              {installmentEnabled && finalTotal >= installmentMin && (
                <>
                  <div className="mx-4 mt-1 mb-1">
                    <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                      <SplitSquareVertical className="h-3.5 w-3.5 text-primary" />
                      خيارات التقسيط (للطلبات الكبيرة)
                    </p>
                  </div>

                  {/* مقدّم + باقي عند التسليم */}
                  <button
                    type="button"
                    className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                      installmentType === "deposit_cod" ? "bg-amber-50 dark:bg-amber-900/20" : "hover:bg-muted/50"
                    }`}
                    onClick={() => {
                      setInstallmentType(installmentType === "deposit_cod" ? null : "deposit_cod");
                      setFormData(f => ({ ...f, paymentMethod: "cash_on_delivery" }));
                      setReceiptFile(null); setReceiptAmountClaimed("");
                    }}
                    data-testid="payment-method-deposit_cod"
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      installmentType === "deposit_cod" ? "border-amber-500" : "border-muted-foreground"
                    }`}>
                      {installmentType === "deposit_cod" && <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />}
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                      <SplitSquareVertical className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="text-right flex-1">
                      <span className="text-sm font-medium">مقدّم + باقي عند التسليم</span>
                      <p className="text-xs text-muted-foreground">ادفع جزءاً الآن والباقي حين تستلم الطلب</p>
                    </div>
                    {installmentType === "deposit_cod" && <CheckCircle className="h-4 w-4 text-amber-500 shrink-0" />}
                  </button>

                  {/* كفيل المورد */}
                  <button
                    type="button"
                    className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                      installmentType === "supplier_guaranteed" ? "bg-purple-50 dark:bg-purple-900/20" : "hover:bg-muted/50"
                    }`}
                    onClick={() => {
                      setInstallmentType(installmentType === "supplier_guaranteed" ? null : "supplier_guaranteed");
                      setFormData(f => ({ ...f, paymentMethod: "cash_on_delivery", purchaseCode: "" }));
                      setReceiptFile(null); setReceiptAmountClaimed("");
                    }}
                    data-testid="payment-method-supplier_guaranteed"
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      installmentType === "supplier_guaranteed" ? "border-purple-500" : "border-muted-foreground"
                    }`}>
                      {installmentType === "supplier_guaranteed" && <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />}
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                      <Users className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="text-right flex-1">
                      <span className="text-sm font-medium">كفيل المورد</span>
                      <p className="text-xs text-muted-foreground">المورد يكفلك ويستلم الطلب على مسؤوليته</p>
                    </div>
                    {installmentType === "supplier_guaranteed" && <CheckCircle className="h-4 w-4 text-purple-500 shrink-0" />}
                  </button>
                </>
              )}

              {/* زر إغلاق القائمة */}
              <div className="px-4 pb-3 pt-1">
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

        {/* ── قسم ضبط التقسيط ── */}
        {installmentType === "deposit_cod" && (
          <div className="bg-background border-t">
            <div className="px-4 py-4 space-y-4">
              <div className="flex items-center gap-2">
                <SplitSquareVertical className="h-4 w-4 text-amber-600" />
                <p className="font-semibold text-sm">ضبط المقدّم</p>
              </div>

              {/* نسبة المقدّم */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">اختر نسبة المقدّم</p>
                <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${Math.min(installmentPercentages.length, 4)}, 1fr)` }}>
                  {installmentPercentages.map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setDepositPercent(pct)}
                      className={`py-2.5 rounded-xl border-2 font-bold text-sm transition-all ${
                        depositPercent === pct
                          ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/30"
                          : "border-muted bg-muted/30 text-muted-foreground"
                      }`}
                      data-testid={`deposit-percent-${pct}`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* عرض المبالغ */}
              <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-amber-700 dark:text-amber-400">المقدّم (الآن)</span>
                  <span className="font-black text-amber-700 text-base">{formatPrice(depositAmount)} {currLabel}</span>
                </div>
                <div className="h-px bg-amber-200 dark:bg-amber-800" />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">الباقي (عند التسليم)</span>
                  <span className="font-bold text-gray-600">{formatPrice(remainingAmount)} {currLabel}</span>
                </div>
              </div>

              {/* اختيار طريقة دفع المقدّم */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">اختر طريقة دفع المقدّم الآن</p>
                <div className="space-y-1">
                  {digitalWallets.filter((w: any) => w.isActive).map((wallet: any) => {
                    const wId = `wallet_${wallet.id}`;
                    const isSel = formData.paymentMethod === wId;
                    return (
                      <button
                        key={wallet.id}
                        type="button"
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-right ${isSel ? "border-amber-500 bg-amber-50/80" : "border-muted hover:bg-muted/40"}`}
                        onClick={() => setFormData(f => ({ ...f, paymentMethod: wId, purchaseCode: "" }))}
                        data-testid={`deposit-wallet-${wallet.id}`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isSel ? "border-amber-500" : "border-gray-300"}`}>
                          {isSel && <div className="w-2 h-2 rounded-full bg-amber-500" />}
                        </div>
                        {wallet.logoUrl ? (
                          <img src={wallet.logoUrl} alt={wallet.name} className="w-7 h-7 rounded-md object-contain border bg-white" />
                        ) : (
                          <Smartphone className="h-4 w-4 text-amber-600" />
                        )}
                        <span className="text-sm font-medium">{wallet.name}</span>
                        <span className="text-xs text-muted-foreground mr-auto">{wallet.phoneNumber}</span>
                        <button type="button" className="text-primary shrink-0"
                          onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(wallet.phoneNumber); toast({ title: "✅ تم نسخ الرقم" }); }}>
                          <Copy className="h-3 w-3" />
                        </button>
                      </button>
                    );
                  })}
                  {bankAccounts.filter((b: any) => b.isActive).map((bank: any) => {
                    const bId = `bank_${bank.id}`;
                    const isSel = formData.paymentMethod === bId;
                    return (
                      <button
                        key={bank.id}
                        type="button"
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-right ${isSel ? "border-blue-500 bg-blue-50/80" : "border-muted hover:bg-muted/40"}`}
                        onClick={() => setFormData(f => ({ ...f, paymentMethod: bId, purchaseCode: "" }))}
                        data-testid={`deposit-bank-${bank.id}`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isSel ? "border-blue-500" : "border-gray-300"}`}>
                          {isSel && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                        </div>
                        {bank.logoUrl ? (
                          <img src={bank.logoUrl} alt={bank.bankName} className="w-7 h-7 rounded-md object-contain border bg-white" />
                        ) : (
                          <Building2 className="h-4 w-4 text-blue-600" />
                        )}
                        <span className="text-sm font-medium">{bank.bankName}</span>
                        <span className="text-xs text-muted-foreground mr-auto">{bank.accountNumber}</span>
                        <button type="button" className="text-primary shrink-0"
                          onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(bank.accountNumber); toast({ title: "✅ تم نسخ الرقم" }); }}>
                          <Copy className="h-3 w-3" />
                        </button>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* كود الحوالة للمقدّم */}
              {(isWalletPayment || isBankTransfer) && (
                <div>
                  <p className="text-xs font-semibold mb-1">
                    {isBankTransfer ? "رقم الحوالة البنكية *" : "رقم حوالة المقدّم *"}
                  </p>
                  <Input
                    value={formData.purchaseCode}
                    onChange={e => setFormData(f => ({ ...f, purchaseCode: e.target.value }))}
                    placeholder="أدخل رقم الحوالة بعد الدفع"
                    className="text-right"
                    data-testid="input-deposit-code"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── قسم بيانات كفيل المورد ── */}
        {installmentType === "supplier_guaranteed" && (
          <div className="bg-background border-t">
            <div className="px-4 py-4 space-y-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-600" />
                <p className="font-semibold text-sm">بيانات الكفيل (المورد)</p>
              </div>

              <div className="rounded-xl bg-purple-50 dark:bg-purple-900/20 p-3 text-xs text-purple-700 dark:text-purple-300 leading-relaxed">
                الكفيل هو الموزع أو المورد الذي يضمن طلبك. يتحمّل المسؤولية الكاملة عن دفعك، وسيتم إشعاره فور تقديم الطلب.
              </div>

              {/* اختيار من القائمة أو إدخال يدوي */}
              {suppliersList.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">اختر كفيلاً من القائمة</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {suppliersList.map((s: any) => (
                      <button
                        key={s.id}
                        type="button"
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-right transition-all ${
                          guarantorName === s.name ? "border-purple-500 bg-purple-50/80" : "border-muted hover:bg-muted/40"
                        }`}
                        onClick={() => { setGuarantorName(s.name); setGuarantorPhone(s.phone || ""); }}
                        data-testid={`guarantor-supplier-${s.id}`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${guarantorName === s.name ? "border-purple-500" : "border-gray-300"}`}>
                          {guarantorName === s.name && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                        </div>
                        <Users className="h-4 w-4 text-purple-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{s.name}</p>
                          {s.cities?.length > 0 && <p className="text-xs text-muted-foreground">{s.cities.slice(0, 2).join("، ")}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 mb-1">أو أدخل بيانات الكفيل يدوياً</p>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold mb-1">اسم الكفيل (المورد) *</p>
                  <Input
                    value={guarantorName}
                    onChange={e => setGuarantorName(e.target.value)}
                    placeholder="مثال: شركة الأهدل للتوزيع"
                    className="text-right"
                    data-testid="input-guarantor-name"
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold mb-1">رقم هاتف الكفيل *</p>
                  <Input
                    value={guarantorPhone}
                    onChange={e => setGuarantorPhone(e.target.value)}
                    placeholder="77X XXX XXXX"
                    className="text-right"
                    data-testid="input-guarantor-phone"
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold mb-1">ملاحظة للكفيل (اختياري)</p>
                  <Input
                    value={guarantorNotes}
                    onChange={e => setGuarantorNotes(e.target.value)}
                    placeholder="مثال: تعاملنا منذ 2 سنة"
                    className="text-right"
                    data-testid="input-guarantor-notes"
                  />
                </div>
              </div>

              {/* ملخص المبلغ للكفيل */}
              <div className="rounded-xl border border-purple-200 dark:border-purple-800 p-3">
                <p className="text-xs text-muted-foreground mb-1">إجمالي الطلب المكفول</p>
                <p className="font-black text-purple-700 text-xl">{formatPrice(finalTotal)} {currLabel}</p>
                <p className="text-xs text-gray-400 mt-0.5">سيتحمّل الكفيل المسؤولية الكاملة عن هذا المبلغ</p>
              </div>
            </div>
          </div>
        )}

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

          {/* ملخص التقسيط في الإجماليات */}
          {isInstallmentOrder && (
            <div className="mx-4 mt-3 space-y-2">
              {installmentType === "deposit_cod" && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-800 overflow-hidden">
                  <div className="flex justify-between items-center px-3 py-2 bg-amber-50 dark:bg-amber-900/20">
                    <span className="text-xs font-bold text-amber-700">المقدّم (تدفعه الآن)</span>
                    <span className="font-black text-amber-700 text-base">{formatPrice(depositAmount)} {currLabel}</span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2">
                    <span className="text-xs text-gray-500">الباقي (عند التسليم)</span>
                    <span className="font-bold text-gray-600">{formatPrice(remainingAmount)} {currLabel}</span>
                  </div>
                </div>
              )}
              {installmentType === "supplier_guaranteed" && (
                <div className="rounded-xl border border-purple-200 dark:border-purple-800 px-3 py-2 flex justify-between items-center">
                  <span className="text-xs font-bold text-purple-700">مكفول بواسطة: {guarantorName || "..."}</span>
                  <span className="font-black text-purple-700 text-base">{formatPrice(finalTotal)} {currLabel}</span>
                </div>
              )}
            </div>
          )}

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
              // 🔧 نفس الإصلاح: استخدم unitPrice الفعلي للمتغيّر الذكي المختار
              const rate = product.priceSar && product.price
                ? Number(product.price) / Number(product.priceSar)
                : 0;
              const unitY = item.unitPrice != null ? Number(item.unitPrice) : Number(product.price);
              const price = currency === "SAR"
                ? (rate > 0 ? unitY / rate : Number(product.priceSar || 0))
                : unitY;
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
                    {checkoutCfg.mode === "collapsible"
                      ? <OrderItemCollapsibleMeta item={{
                          selectedColor, selectedSize,
                          selectedBagColor: item.selectedBagColor || (item as any).selectedBagColor,
                          printColor1: item.printColor1 || (item as any).printColor1,
                          printColor2: item.printColor2 || (item as any).printColor2,
                          printColor3: item.printColor3 || (item as any).printColor3,
                          printColorCount: item.printColorCount || (item as any).printColorCount,
                          customPrinting: item.customPrinting || (item as any).customPrinting,
                          designNotes: item.designNotes || (item as any).designNotes,
                          designFileUrl: item.designFileUrl || (item as any).designFileUrl,
                        }} cfg={checkoutCfg} />
                      : <OrderItemCompactMeta item={{
                          selectedColor, selectedSize,
                          selectedBagColor: item.selectedBagColor || (item as any).selectedBagColor,
                          printColor1: item.printColor1 || (item as any).printColor1,
                          printColor2: item.printColor2 || (item as any).printColor2,
                          printColor3: item.printColor3 || (item as any).printColor3,
                          printColorCount: item.printColorCount || (item as any).printColorCount,
                          customPrinting: item.customPrinting || (item as any).customPrinting,
                          designNotes: item.designNotes || (item as any).designNotes,
                          designFileUrl: item.designFileUrl || (item as any).designFileUrl,
                        }} cfg={checkoutCfg} />
                    }
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
      <div className="app-fixed-bar fixed bottom-0 left-0 right-0 z-50 bg-background border-t px-4 py-4 flex gap-3 shadow-xl">
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
