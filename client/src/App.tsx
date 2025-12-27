import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/hooks/use-auth";
import { SplashScreen } from "@/components/SplashScreen";

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
import About from "@/pages/About";
import Privacy from "@/pages/Privacy";
import NotFound from "@/pages/not-found";

import { BottomNav } from "@/components/BottomNav";
import { Footer, MobileFooter } from "@/components/Footer";

function Router() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background font-sans flex flex-col pb-16 md:pb-0">
      <Navbar />
      <main className="flex-grow">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/products" component={Products} />
          <Route path="/product/:id" component={ProductDetail} />
          <Route path="/cart">
            {isAuthenticated ? <Cart /> : <Auth />}
          </Route>
          <Route path="/checkout">
            {isAuthenticated ? <Checkout /> : <Auth />}
          </Route>
          <Route path="/orders">
            {isAuthenticated ? <Orders /> : <Auth />}
          </Route>
          <Route path="/profile" component={Profile} />
          <Route path="/auth">
            {isAuthenticated ? <Home /> : <Auth />}
          </Route>
          <Route path="/register" component={Register} />
          <Route path="/admin" component={Admin} />
          <Route path="/wishlist">
            {isAuthenticated ? <Wishlist /> : <Auth />}
          </Route>
          <Route path="/notifications">
            {isAuthenticated ? <Notifications /> : <Auth />}
          </Route>
          <Route path="/about" component={About} />
          <Route path="/privacy" component={Privacy} />
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
  const [showSplash, setShowSplash] = useState(() => {
    const hasSeenSplash = sessionStorage.getItem("hasSeenSplash");
    return !hasSeenSplash;
  });

  const handleSplashComplete = () => {
    sessionStorage.setItem("hasSeenSplash", "true");
    setShowSplash(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
