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

class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error?: Error }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error) { 
    return { hasError: true, error };
  }
  componentDidCatch(error: Error) {
    console.error("Error Boundary caught:", error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center text-center p-8 bg-white">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">حدث خطأ غير متوقع</h2>
          <p className="text-gray-500 mb-6">نأسف على الإزعاج، يرجى تحديث الصفحة</p>
          {this.state.error && (
            <p className="text-red-600 text-sm mb-4 max-w-md break-words">
              {this.state.error.message}
            </p>
          )}
          <button
            onClick={() => window.location.reload()}
            className="bg-teal-600 text-white px-6 py-2 rounded-full font-medium"
          >
            تحديث الصفحة
          </button>
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
import Orders from "@/pages/Orders";
import Profile from "@/pages/Profile";
import Auth from "@/pages/Auth";
import Register from "@/pages/Register";
import Admin from "@/pages/Admin";
import Wishlist from "@/pages/Wishlist";
import Notifications from "@/pages/Notifications";
import MyAccount from "@/pages/MyAccount";
import MarketerCoupons from "@/pages/MarketerCoupons";
import PrintingAndDesign from "@/pages/PrintingAndDesign";
import About from "@/pages/About";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import Returns from "@/pages/Returns";
import NotFound from "@/pages/not-found";

import { BottomNav } from "@/components/BottomNav";
import { Footer, MobileFooter } from "@/components/Footer";

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

function Router() {
  const { isAuthenticated, user, isLoading } = useAuth();
  const [location] = useLocation();
  
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">جاري التحميل...</div>;
  }

  // Check if user needs to complete registration (no accountType set)
  const needsAccountType = isAuthenticated && user && !user.accountType;
  
  // Hide footer on home, products, and product detail pages
  const hideFooter = location === '/' || location === '/products' || location.startsWith('/product/');

  return (
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
          <Route path="/printing">
            <RequireAccountType><PrintingAndDesign /></RequireAccountType>
          </Route>
          <Route component={NotFound} />
        </Switch>
      </main>
      {!hideFooter && <MobileFooter />}
      {!hideFooter && <Footer />}
      <BottomNav />
    </div>
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

export default App;
