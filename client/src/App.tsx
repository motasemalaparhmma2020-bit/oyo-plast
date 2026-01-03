import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";

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
  const { isAuthenticated, user } = useAuth();
  
  // Check if user needs to complete registration (no accountType set)
  const needsAccountType = isAuthenticated && user && !user.accountType;

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
          
          {/* Protected pages - auth required AND accountType required */}
          <Route path="/">
            <RequireAccountType><Home /></RequireAccountType>
          </Route>
          <Route path="/products">
            <RequireAccountType><Products /></RequireAccountType>
          </Route>
          <Route path="/product/:id">
            <RequireAccountType><ProductDetail /></RequireAccountType>
          </Route>
          <Route path="/cart">
            <RequireAccountType><Cart /></RequireAccountType>
          </Route>
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
      <MobileFooter />
      <Footer />
      <BottomNav />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
