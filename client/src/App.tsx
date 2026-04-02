import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
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
  
  // Hide traditional footer on mobile-first pages (they use GlobalBottomNav instead)
  const hideFooter = location === '/' || location === '/products' || location.startsWith('/product/');
  // Hide GlobalBottomNav only on admin/auth pages
  const hideBottomNav = location === '/admin' || location === '/auth' || location === '/register';

  return (
    <>
      <SplashScreen />
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
            <Route path="/cart" component={Cart} />
            
            {/* Protected pages - auth required AND accountType required */}
            <Route path="/checkout">
              <RequireAccountType><Checkout /></RequireAccountType>
            </Route>

            <Route path="/order-confirmation/:id">
              <OrderConfirmation />
            </Route>
            <Route path="/orders">
              <RequireAccountType><Orders /></RequireAccountType>
            </Route>
            <Route path="/profile">
              <RequireAccountType><Profile /></RequireAccountType>
            </Route>
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
