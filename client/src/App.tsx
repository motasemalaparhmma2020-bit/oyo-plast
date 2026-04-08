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
import ProductDetail from "@/pages/ProductDetail";
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";
import OrderConfirmation from "@/pages/OrderConfirmation";
import OrderTracking from "@/pages/OrderTracking";
import Orders from "@/pages/Orders";
import Profile from "@/pages/Profile";
import Auth from "@/pages/Auth";
import Register from "@/pages/Register";
import Admin from "@/pages/Admin";
import Wishlist from "@/pages/Wishlist";
import Notifications from "@/pages/Notifications";
import MyAccount from "@/pages/MyAccount";
import MarketerCoupons from "@/pages/MarketerCoupons";
import Printing from "@/pages/Printing";
import StaffPortal from "@/pages/StaffPortal";
import SupplierPortal from "@/pages/SupplierPortal";
import About from "@/pages/About";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import Returns from "@/pages/Returns";
import NotFound from "@/pages/not-found";

import { Footer, MobileFooter } from "@/components/Footer";
import { GlobalBottomNav } from "@/components/GlobalBottomNav";
import { SplashScreen } from "@/components/SplashScreen";
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
    };
    fetch('/api/display-settings')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) applySettings(data); });

    // إعادة التطبيق عند تغيير الإعدادات (poll كل 10 ثوانٍ فقط في الإدارة)
    const interval = setInterval(() => {
      if (window.location.pathname === '/admin') return;
      fetch('/api/display-settings')
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) applySettings(data); });
    }, 30000);
    return () => clearInterval(interval);
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

function Router() {
  const { isAuthenticated, user, isLoading } = useAuth();
  const [location] = useLocation();

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
  if (location === '/staff') return <StaffPortal />;
  if (location === '/supplier') return <SupplierPortal />;

  const isProductDetail = /^\/products\/[^/]+$/.test(location);
  // إخفاء شريط التنقل السفلي في الصفحات التي لها شريط ثابت خاص بها
  const hideBottomNav =
    location === '/admin' ||
    location === '/checkout' ||
    location === '/guest-checkout' ||
    location === '/cart' ||
    location.startsWith('/order-confirmation') ||
    (isProductDetail && displaySettingsForNav?.showStickyCartBar === true);

  return (
    <>
      <MobilePwaLock />
      <SplashScreen />
      <CartMerger />
      <DisplaySettingsInjector />
      <VisitorTracker />
      <OfflineSyncProvider />
      <div className="min-h-screen bg-gray-50 dark:bg-background font-sans flex flex-col pb-16 md:pb-0">
        <LoginTopBanner />
        <Navbar />
        <main className="flex-grow">
          <Switch>
            {/* Public pages - no auth required */}
            <Route path="/auth">
              {isAuthenticated ? (needsAccountType ? <Redirect to="/register" /> : <Redirect to="/" />) : <Auth />}
            </Route>
            <Route path="/register" component={Register} />
            <Route path="/admin" component={Admin} />
            <Route path="/about" component={About} />
            <Route path="/privacy" component={Privacy} />
            <Route path="/terms" component={Terms} />
            <Route path="/returns" component={Returns} />
            
            {/* Public pages - no auth required */}
            <Route path="/" component={Home} />
            <Route path="/products" component={Products} />
            <Route path="/product/:id" component={ProductDetail} />
            <Route path="/products/:id" component={ProductDetail} />
            <Route path="/cart" component={Cart} />
            
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
            <Route path="/orders">
              <RequireAccountType><Orders /></RequireAccountType>
            </Route>
            <Route path="/profile" component={Profile} />
            <Route path="/wishlist">
              <RequireAccountType><Wishlist /></RequireAccountType>
            </Route>
            <Route path="/notifications">
              <RequireAccountType><Notifications /></RequireAccountType>
            </Route>
            <Route path="/account">
              <RequireAccountType><MyAccount /></RequireAccountType>
            </Route>
            <Route path="/marketer/coupons">
              <RequireAccountType><MarketerCoupons /></RequireAccountType>
            </Route>
            <Route path="/printing" component={Printing} />
            <Route path="/staff" component={StaffPortal} />
            <Route component={NotFound} />
          </Switch>
        </main>
        {!hideFooter && <MobileFooter />}
        {!hideFooter && <Footer />}
        {!hideBottomNav && <GlobalBottomNav />}
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
