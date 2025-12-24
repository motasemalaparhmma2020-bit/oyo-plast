import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/hooks/use-auth";

import Home from "@/pages/Home";
import Products from "@/pages/Products";
import Cart from "@/pages/Cart";
import Profile from "@/pages/Profile";
import Auth from "@/pages/Auth";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null; // or a loading spinner
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col">
      <Navbar />
      <main className="flex-grow">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/products" component={Products} />
          <Route path="/cart">
            {isAuthenticated ? <Cart /> : <Auth />}
          </Route>
          <Route path="/profile">
            {isAuthenticated ? <Profile /> : <Auth />}
          </Route>
          <Route path="/auth">
            {isAuthenticated ? <Home /> : <Auth />}
          </Route>
          <Route component={NotFound} />
        </Switch>
      </main>
      <footer className="bg-white border-t py-12 mt-auto">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p className="font-medium mb-2">© {new Date().getFullYear()} باكجنج برو - جميع الحقوق محفوظة</p>
          <p className="text-sm">أفضل حلول التغليف لمشروعك التجاري في المملكة العربية السعودية</p>
        </div>
      </footer>
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
