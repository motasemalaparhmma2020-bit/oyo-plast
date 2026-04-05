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

function Router() {
  const { isAuthenticated, user, isLoading } = useAuth();
  const [location] = useLocation();
  
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">جاري التحميل...</div>;
  }

  // Check if user needs to complete registration (no accountType set)
  const needsAccountType = isAuthenticated && user && !user.accountType;
  
  // Show traditional footer ONLY on the profile page
  const hideFooter = location !== '/profile';

  // قراءة إعدادات العرض (مخزنة في cache من ProductDetail)
  const { data: displaySettingsForNav } = useQuery<any>({
    queryKey: ['/api/display-settings'],
    staleTime: 60000,
  });

  // إخفاء زر التنقل السفلي على:
  // 1. صفحة الإدارة دائماً
  // 2. صفحة المنتج عند تفعيل الشريط الثابت (بديله يكون زر شراء)
  const isProductDetail = /^\/products\/[^/]+$/.test(location);
  const hideBottomNav = location === '/admin' ||
    (isProductDetail && displaySettingsForNav?.showStickyCartBar === true);

  return (
    <>
      <SplashScreen />
      <CartMerger />
      <DisplaySettingsInjector />
      <OfflineSyncProvider />
      <div className="min-h-screen bg-gray-50 dark:bg-background font-sans flex flex-col pb-16 md:pb-0">
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
            <Route path="/track/:id">
              <OrderTracking />
            </Route>
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
