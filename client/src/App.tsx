import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/hooks/use-auth";
import React, { useEffect, Component } from "react";

// Cleanup legacy localStorage on app init
if (typeof window !== 'undefined') {
  localStorage.removeItem('guestMode');
}

class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { 
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.error("Error:", error.message);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-white p-4">
          <div className="text-center">
            <p className="text-red-600 mb-4">خطأ في التطبيق</p>
            <button
              onClick={() => location.reload()}
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              أعد تحميل
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

import Home from "@/pages/Home";
import Products from "@/pages/Products";
import CategoryPage from "@/pages/CategoryPage";
import CategoriesPage from "@/pages/CategoriesPage";
import ProductDetail from "@/pages/ProductDetail";
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";
import OrderConfirmation from "@/pages/OrderConfirmation";
import OrderTracking from "@/pages/OrderTracking";
import Orders from "@/pages/Orders";
import RateOrder from "@/pages/RateOrder";
import Profile from "@/pages/Profile";
import Addresses from "@/pages/Addresses";
import Auth from "@/pages/Auth";
import Register from "@/pages/Register";
import Admin from "@/pages/Admin";
import AdminInbox from "@/pages/AdminInbox";
import AdminBroadcastNotifications from "@/pages/AdminBroadcastNotifications";
import AdminPurchaseOrders from "@/pages/AdminPurchaseOrders";
import AdminSupplierPayments from "@/pages/AdminSupplierPayments";
import AdminAIAgents from "@/pages/AdminAIAgents";
import AdminVolumeOffers from "@/pages/AdminVolumeOffers";
import AdminStaff from "@/pages/AdminStaff";
import Wishlist from "@/pages/Wishlist";
import Notifications from "@/pages/Notifications";
import NotificationSettings from "@/pages/NotificationSettings";
import MyAccount from "@/pages/MyAccount";
import WalletPage from "@/pages/Wallet";
import LoyaltyPage from "@/pages/Loyalty";
import SettingsPage from "@/pages/Settings";
import MyCredit from "@/pages/MyCredit";
import MarketerCoupons from "@/pages/MarketerCoupons";
import MyCouponsPage from "@/pages/MyCoupons";
import Printing from "@/pages/Printing";
import StaffPortal from "@/pages/StaffPortal";
import SupplierPortal from "@/pages/SupplierPortal";
import SupplierOrderView from "@/pages/SupplierOrderView";
import MarketerLanding from "@/pages/MarketerLanding";
import MarketerApply from "@/pages/MarketerApply";
import MarketerLogin from "@/pages/MarketerLogin";
import MarketerDashboard from "@/pages/MarketerDashboard";
import MarketerOrders from "@/pages/MarketerOrders";
import MarketerWallet from "@/pages/MarketerWallet";
import Partnership from "@/pages/Partnership";
import SupplierApply from "@/pages/SupplierApply";
import ContractView from "@/pages/ContractView";
import About from "@/pages/About";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import Returns from "@/pages/Returns";
import NotFound from "@/pages/not-found";

import { Footer, MobileFooter } from "@/components/Footer";
import { GlobalBottomNav } from "@/components/GlobalBottomNav";
import { SplashScreen } from "@/components/SplashScreen";
import { PwaInstallBanner } from "@/components/PwaInstallBanner";
import { FloatingRobot } from "@/components/FloatingRobot";
import { CompareBar } from "@/components/CompareBar";
import Compare from "@/pages/Compare";
import OnboardingFlow from "@/components/OnboardingFlow";
import { useOfflineSync } from "@/hooks/use-offline-sync";

// Component to redirect users who need to complete registration
function RequireAccountType({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();
  
  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        setLocation('/auth');
      } else if (isAuthenticated && user && !user.accountType) {
        // User is logged in but hasn't selected account type
        if (location !== '/register') {
          setLocation('/register');
        }
      }
    }
  }, [isAuthenticated, user, isLoading, location, setLocation]);
  
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">جاري التحميل...</div>;
  }
  
  if (!isAuthenticated) {
    return <Auth />;
  }
  
  if (user && !user.accountType) {
    return <Register />;
  }
  
  return <>{children}</>;
}

function StaffGate() {
  return <StaffPortal />;
}

// المسارات التي لا تخضع لإجبار إكمال البيانات
const ONBOARDING_EXEMPT = ["/auth", "/register", "/admin", "/staff", "/supplier", "/onboarding", "/api"];

function OnboardingGate({ location }: { location: string }) {
  const { isAuthenticated, user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  const exempt = ONBOARDING_EXEMPT.some((p) => location === p || location.startsWith(p + "/"));
  const u = user as any;
  // فقط العملاء العاديون يخضعون للويزارد. لا الموظفون ولا المسوّقون.
  const isStaffRole = u && ["owner", "product_manager", "order_manager", "delivery", "finance"].includes(u.role);
  const isMarketer = u && u.accountType === "marketer";
  const needsOnboarding =
    isAuthenticated &&
    u &&
    !isStaffRole &&
    !isMarketer &&
    u.accountType === "customer" &&
    String(u.onboardingCompleted || "false") !== "true";

  if (isLoading || exempt || !needsOnboarding) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-background overflow-y-auto">
      <OnboardingFlow
        initialFullName={(user as any)?.fullName || ""}
        onComplete={() => setLocation(location)}
      />
    </div>
  );
}

function OnboardingPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  return (
    <OnboardingFlow
      initialFullName={(user as any)?.fullName || ""}
      onComplete={() => setLocation("/")}
    />
  );
}

// Merges guest cart into server cart when user logs in
function CartMerger() {
  const { isAuthenticated } = useAuth();
  const wasAuthenticated = React.useRef(false);

  useEffect(() => {
    if (isAuthenticated && !wasAuthenticated.current) {
      // User just logged in — merge guest cart to server cart
      const guestCart: any[] = JSON.parse(localStorage.getItem('guestCart') || '[]');
      if (guestCart.length > 0) {
        (async () => {
          const remaining: any[] = [];
          for (const item of guestCart) {
            try {
              const res = await fetch('/api/cart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  productId: item.productId,
                  quantity: item.quantity,
                  selectedSize: item.selectedSize,
                  selectedColor: item.selectedColor,
                  customPrinting: item.customPrinting,
                  designNotes: item.designNotes,
                  designFileUrl: item.designFileUrl,
                  selectedBagColor: item.selectedBagColor,
                  printColor1: item.printColor1,
                  printColor2: item.printColor2,
                  printColor3: item.printColor3,
                  printColorCount: item.printColorCount,
                  unitPrice: item.unitPrice,
                  designOptions: typeof item.designOptions === 'object'
                    ? JSON.stringify(item.designOptions)
                    : item.designOptions,
                }),
              });
              if (!res.ok) remaining.push(item);
            } catch {
              remaining.push(item);
            }
          }
          // Only clear items that were successfully synced
          if (remaining.length === 0) {
            localStorage.removeItem('guestCart');
          } else {
            localStorage.setItem('guestCart', JSON.stringify(remaining));
          }
          queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
        })();
      }
    }
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated]);

  return null;
}

// تحميل إعدادات العرض وتطبيقها كـ CSS Variables على مستوى الجذر
function DisplaySettingsInjector() {
  useEffect(() => {
    const FONT_MAP: Record<string, string> = {
      'cairo':           "'Cairo', 'Segoe UI', sans-serif",
      'tajawal':         "'Tajawal', sans-serif",
      'almarai':         "'Almarai', sans-serif",
      'ibm-plex-arabic': "'IBM Plex Sans Arabic', sans-serif",
      'noto-kufi':       "'Noto Kufi Arabic', sans-serif",
      'roboto-condensed':"'Roboto Condensed', sans-serif",
      'barlow':          "'Barlow', sans-serif",
      'inter':           "'Inter', sans-serif",
      'oswald':          "'Oswald', sans-serif",
    };
    const applySettings = (data: any) => {
      const root = document.documentElement;
      root.style.setProperty('--card-image-height', `${data.productCardHeight ?? 200}px`);
      root.style.setProperty('--card-margin', `${data.productCardMargin ?? 8}px`);
      root.style.setProperty('--card-padding-v', `${data.productCardPaddingV ?? 8}px`);
      root.style.setProperty('--price-font-size', `${data.priceFontSize ?? 16}px`);
      root.style.setProperty('--qty-btn-height', `${data.quantityButtonHeight ?? 40}px`);
      const bubbleSize = data.discountBubbleSize ?? 28;
      root.style.setProperty('--discount-bubble', `${bubbleSize}px`);
      root.style.setProperty('--discount-bubble-display', bubbleSize > 0 ? 'flex' : 'none');
      const isFullBleed = (data.imageMode ?? 'card') === 'full-bleed';
      root.style.setProperty('--card-border-radius', isFullBleed ? '4px' : '16px');
      root.style.setProperty('--card-width', `${data.productCardWidth ?? 160}px`);
      root.style.setProperty('--discount-badge-bg', data.discountBadgeBg ?? '#ef4444');
      // خطوط الواجهة
      const arabicFont = FONT_MAP[data.appFontArabic ?? 'cairo'] ?? FONT_MAP['cairo'];
      const numFont = FONT_MAP[data.appFontNumbers ?? 'cairo'] ?? FONT_MAP['cairo'];
      root.style.setProperty('--font-arabic', arabicFont);
      root.style.setProperty('--font-numbers', numFont);
      root.style.setProperty('--font-sans', arabicFont);
      root.style.setProperty('--font-display', arabicFont);
      root.style.setProperty('--font-family-arabic', arabicFont);
      root.style.setProperty('--font-family-numbers', numFont);
      document.body.style.fontFamily = arabicFont;
      document.documentElement.style.setProperty('font-family', arabicFont);
    };
    fetch('/api/display-settings')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) applySettings(data); });

    // الاستماع لحدث تغيير الخط من الأدمن — يُطبَّق فوراً دون poll
    const onFontChange = () => {
      fetch('/api/display-settings')
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) applySettings(data); });
    };
    window.addEventListener('oyo-font-numbers-change', onFontChange);
    // poll كل 60 ثانية فقط للحالات الأخرى
    const interval = setInterval(() => {
      fetch('/api/display-settings')
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) applySettings(data); });
    }, 60000);
    return () => {
      clearInterval(interval);
      window.removeEventListener('oyo-font-numbers-change', onFontChange);
    };
  }, []);
  return null;
}

// تتبع زيارة المستخدم (بدون بيانات شخصية — session ID عشوائي فقط)
function VisitorTracker() {
  useEffect(() => {
    let sessionId = sessionStorage.getItem("oyo_sid");
    if (!sessionId) {
      sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem("oyo_sid", sessionId);
    }
    fetch("/api/track-visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).catch(() => {});
  }, []);
  return null;
}

// ── قفل الشاشة في وضع الموبايل PWA ──────────────────────────────
function MobilePwaLock() {
  const { data: displaySettings } = useQuery<any>({
    queryKey: ['/api/display-settings'],
    staleTime: 60000,
  });

  const isLockEnabled = displaySettings?.lockMobilePwaMode !== false;

  // هل الجهاز موبايل فعلاً (عرض صغير أو شاشة لمس)
  const isMobileDevice = () =>
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    window.matchMedia('(max-width: 768px)').matches ||
    ('ontouchstart' in window);

  // هل التطبيق مثبّت كـ PWA Standalone
  const isPWAStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;

  useEffect(() => {
    if (!isLockEnabled) return;
    if (!isMobileDevice() && !isPWAStandalone()) return;

    const lockOrientation = async () => {
      try {
        if (screen.orientation && (screen.orientation as any).lock) {
          await (screen.orientation as any).lock('portrait-primary');
        }
      } catch {
        // المتصفح لا يدعم القفل — نعتمد على CSS overlay
      }
    };

    lockOrientation();
    const handleChange = () => { lockOrientation(); };
    screen.orientation?.addEventListener?.('change', handleChange);
    return () => screen.orientation?.removeEventListener?.('change', handleChange);
  }, [isLockEnabled]);

  const [isLandscape, setIsLandscape] = React.useState(
    () => window.innerWidth > window.innerHeight
  );

  useEffect(() => {
    if (!isLockEnabled) return;
    const check = () => setIsLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, [isLockEnabled]);

  // الـ overlay يظهر فقط على الموبايل أو PWA — وليس على سطح المكتب
  const shouldShow = isLockEnabled && isLandscape && (isMobileDevice() || isPWAStandalone());
  if (!shouldShow) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-[#1976D2] flex flex-col items-center justify-center text-white select-none"
      style={{ touchAction: 'none' }}
    >
      <div className="text-6xl mb-6" style={{ animation: 'spin 2s linear infinite' }}>🔄</div>
      <p className="text-xl font-bold mb-2">يرجى تدوير الجهاز</p>
      <p className="text-sm opacity-80">هذا التطبيق مُصمَّم للعرض العمودي فقط</p>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function OfflineSyncProvider() {
  const { isOnline, syncedCount } = useOfflineSync();
  
  useEffect(() => {
    if (syncedCount > 0) {
      // Could show a toast here, but we keep it silent
      console.log(`[Offline] ${syncedCount} orders synced`);
    }
  }, [syncedCount]);

  return (
    <>
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-orange-500 text-white text-center text-xs py-1 font-medium" dir="rtl">
          📴 أنت غير متصل بالإنترنت - يمكنك التسوق بشكل طبيعي، طلباتك ستُرسل عند الاتصال
        </div>
      )}
    </>
  );
}

function LoginTopBanner() {
  const { isAuthenticated } = useAuth();
  const { data: navSettings } = useQuery<any>({
    queryKey: ["/api/navigation-settings"],
    staleTime: 60000,
  });
  const [, setLocation] = useLocation();
  const [dismissed, setDismissed] = React.useState(false);

  if (!navSettings?.loginShowOnTop || isAuthenticated || dismissed) return null;

  return (
    <div className="bg-primary text-primary-foreground text-center text-xs py-2 px-4 flex items-center justify-between gap-2" dir="rtl">
      <span className="flex-1">👋 سجّل دخولك للاستفادة من جميع المزايا والعروض الحصرية</span>
      <button
        onClick={() => setLocation("/auth")}
        className="font-bold underline whitespace-nowrap"
        data-testid="button-login-banner"
      >
        تسجيل الدخول
      </button>
      <button onClick={() => setDismissed(true)} className="opacity-70 hover:opacity-100 text-base leading-none" data-testid="button-dismiss-banner">
        ✕
      </button>
    </div>
  );
}

function pageMatchesWa(pages: string, loc: string): boolean {
  if (!pages || pages === "all") return true;
  const list = pages.split(",").map(p => p.trim()).filter(Boolean);
  return list.some(p => loc === p || loc.startsWith(p + "/") || loc.startsWith(p + "?"));
}

function WhatsAppButton({ settings }: { settings: any }) {
  const [location] = useLocation();
  if (!settings?.showWhatsappButton || !settings?.whatsappNumber) return null;
  if (!pageMatchesWa(settings?.whatsappPages ?? "all", location)) return null;
  const phone = settings.whatsappNumber.replace(/\D/g, "");
  const msg = encodeURIComponent(settings.whatsappMessage || "مرحباً، أحتاج مساعدة");
  const url = `https://wa.me/${phone}?text=${msg}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="button-whatsapp-float"
      className="fixed bottom-20 right-4 z-[60] w-14 h-14 rounded-full bg-[#25D366] shadow-lg flex items-center justify-center hover:bg-[#1EB855] transition-all hover:scale-110 active:scale-95"
      style={{ boxShadow: "0 4px 20px rgba(37,211,102,0.5)" }}
      title="تواصل معنا عبر واتساب"
    >
      <svg viewBox="0 0 24 24" fill="white" className="w-7 h-7">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
      </svg>
    </a>
  );
}

function Router() {
  const { isAuthenticated, user, isLoading } = useAuth();
  const [location] = useLocation();

  // تفعيل وضع العرض الكامل على صفحات الأدمن والموردين
  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) return;
    const isFullwidth = location === '/admin' || location === '/staff' || location === '/supplier';
    if (isFullwidth) {
      root.classList.add('fullwidth-mode');
    } else {
      root.classList.remove('fullwidth-mode');
    }
  }, [location]);

  // تتبع آخر صفحة "آمنة" زارها المستخدم — تُستخدم لزر الرجوع الذكي في السلة
  // نتجاهل صفحات ما بعد الشراء (cart/checkout/order-confirmation/orders) حتى لا يرجع لها
  useEffect(() => {
    const isPostPurchasePage = /^\/(cart|checkout|order-confirmation|orders)(\/|$|\?)/.test(location);
    if (!isPostPurchasePage) {
      try { sessionStorage.setItem('lastSafePath', location); } catch {}
    }
  }, [location]);

  // ⚠️ جميع hooks يجب أن تكون قبل أي return مشروط (قواعد React Hooks)
  // قراءة إعدادات العرض لإخفاء شريط التنقل السفلي على صفحة المنتج
  const { data: displaySettingsForNav } = useQuery<any>({
    queryKey: ['/api/display-settings'],
    staleTime: 60000,
  });

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">جاري التحميل...</div>;
  }

  // Check if user needs to complete registration (no accountType set)
  const needsAccountType = isAuthenticated && user && !user.accountType;
  
  // Show traditional footer ONLY on the profile page
  const hideFooter = location !== '/profile';

  // إخفاء زر التنقل السفلي على:
  // 1. صفحة الإدارة دائماً
  // 2. صفحة المنتج عند تفعيل الشريط الثابت (بديله يكون زر شراء)
  // صفحة الموظفين وبوابة الموردين مستقلة تماماً بدون navbar/footer
  if (location === '/staff') return <StaffGate />;
  if (location === '/supplier') return <SupplierPortal />;

  const isProductDetail = /^\/products?\/[^/]+$/.test(location);
  // إخفاء شريط التنقل السفلي في الصفحات التي لها شريط ثابت خاص بها
  const hideBottomNav =
    location === '/admin' ||
    location === '/checkout' ||
    location === '/guest-checkout' ||
    location === '/cart' ||
    location.startsWith('/order-confirmation') ||
    isProductDetail; // إخفاء دائم في صفحة المنتج لتجنب تراكم الأشرطة

  return (
    <>
      <MobilePwaLock />
      <SplashScreen />
      <OnboardingGate location={location} />
      <CartMerger />
      <DisplaySettingsInjector />
      <VisitorTracker />
      <OfflineSyncProvider />
      <div className="min-h-screen bg-gray-50 dark:bg-background font-sans flex flex-col pb-16">
        <LoginTopBanner />
        {!isProductDetail && <Navbar />}
        <main className="flex-grow">
          <Switch>
            {/* Public pages - no auth required */}
            <Route path="/auth">
              {isAuthenticated ? (needsAccountType ? <Redirect to="/register" /> : <Redirect to="/" />) : <Auth />}
            </Route>
            <Route path="/register" component={Register} />
            <Route path="/onboarding" component={OnboardingPage} />
            <Route path="/admin" component={Admin} />
            <Route path="/admin/inbox" component={AdminInbox} />
            <Route path="/admin/broadcast" component={AdminBroadcastNotifications} />
            <Route path="/admin/purchase-orders" component={AdminPurchaseOrders} />
            <Route path="/admin/supplier-payments" component={AdminSupplierPayments} />
            <Route path="/admin/ai-agents" component={AdminAIAgents} />
            <Route path="/admin/volume-offers" component={AdminVolumeOffers} />
            <Route path="/admin/staff" component={AdminStaff} />
            <Route path="/about" component={About} />
            <Route path="/privacy" component={Privacy} />
            <Route path="/terms" component={Terms} />
            <Route path="/returns" component={Returns} />
            
            {/* Public pages - no auth required */}
            <Route path="/" component={Home} />
            <Route path="/products" component={Products} />
            <Route path="/categories" component={CategoriesPage} />
            <Route path="/category/:slug" component={CategoryPage} />
            <Route path="/product/:id" component={ProductDetail} />
            <Route path="/products/:id" component={ProductDetail} />
            <Route path="/cart" component={Cart} />
            <Route path="/compare" component={Compare} />
            
            {/* Guest Checkout - no auth required */}
            <Route path="/guest-checkout">
              <Checkout />
            </Route>

            {/* Protected pages - auth required AND accountType required */}
            <Route path="/checkout">
              <RequireAccountType><Checkout /></RequireAccountType>
            </Route>

            <Route path="/order-confirmation/:id">
              <OrderConfirmation />
            </Route>
            <Route path="/track" component={OrderTracking} />
            <Route path="/track/:id">
              <OrderTracking />
            </Route>
            <Route path="/supplier" component={SupplierPortal} />
            <Route path="/supplier/order/:token" component={SupplierOrderView} />
            <Route path="/m/:code" component={MarketerLanding} />
            <Route path="/join-marketer" component={MarketerApply} />
            <Route path="/marketer/login" component={MarketerLogin} />
            <Route path="/marketer/dashboard" component={MarketerDashboard} />
            <Route path="/marketer/orders" component={MarketerOrders} />
            <Route path="/marketer/wallet" component={MarketerWallet} />
            <Route path="/partnership" component={Partnership} />
            <Route path="/partnership/supplier/apply" component={SupplierApply} />
            <Route path="/contract/:id" component={ContractView} />
            <Route path="/orders">
              <RequireAccountType><Orders /></RequireAccountType>
            </Route>
            <Route path="/orders/:id">
              <RequireAccountType><Orders /></RequireAccountType>
            </Route>
            <Route path="/rate-order/:orderId">
              <RequireAccountType><RateOrder /></RequireAccountType>
            </Route>
            <Route path="/profile" component={Profile} />
            <Route path="/addresses">
              <RequireAccountType><Addresses /></RequireAccountType>
            </Route>
            <Route path="/wishlist">
              <RequireAccountType><Wishlist /></RequireAccountType>
            </Route>
            <Route path="/notifications">
              <RequireAccountType><Notifications /></RequireAccountType>
            </Route>
            <Route path="/notification-settings">
              <RequireAccountType><NotificationSettings /></RequireAccountType>
            </Route>
            <Route path="/account">
              <RequireAccountType><MyAccount /></RequireAccountType>
            </Route>
            <Route path="/account/credit">
              <RequireAccountType><MyCredit /></RequireAccountType>
            </Route>
            <Route path="/wallet">
              <RequireAccountType><WalletPage /></RequireAccountType>
            </Route>
            <Route path="/loyalty">
              <RequireAccountType><LoyaltyPage /></RequireAccountType>
            </Route>
            <Route path="/settings">
              <RequireAccountType><SettingsPage /></RequireAccountType>
            </Route>
            <Route path="/marketer/coupons">
              <RequireAccountType><MarketerCoupons /></RequireAccountType>
            </Route>
            <Route path="/my-coupons">
              <RequireAccountType><MyCouponsPage /></RequireAccountType>
            </Route>
            <Route path="/printing" component={Printing} />
            <Route path="/staff" component={StaffGate} />
            <Route component={NotFound} />
          </Switch>
        </main>
        {!hideFooter && <MobileFooter />}
        {!hideFooter && <Footer />}
        {!hideBottomNav && <GlobalBottomNav />}
        <CompareBar />
        <PwaInstallBanner />
        <WhatsAppButton settings={displaySettingsForNav} />
        <FloatingRobot />
      </div>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

// Wrap Router with wouter's necessary context
function AppWrapper() {
  return <App />;
}

export default App;
