import { Link, useLocation } from "wouter";
import { Home, Grid3X3, Printer, ShoppingCart, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const [location] = useLocation();
  const { isAuthenticated } = useAuth();
  const { data: cart } = useCart();
  
  const cartCount = cart?.reduce((acc, item) => acc + item.quantity, 0) || 0;

  const items = [
    { id: 'home', label: 'متجر', icon: Home, href: '/' },
    { id: 'categories', label: 'الفئات', icon: Grid3X3, href: '/products' },
    { id: 'printing', label: 'طباعة وتصميم', icon: Printer, href: '/products?category=6' },
    { id: 'cart', label: 'حقيبة التسوق', icon: ShoppingCart, href: '/cart', count: cartCount },
    { id: 'profile', label: 'أنا', icon: User, href: '/profile' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 px-2 py-1 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      <div className="flex justify-around items-center">
        {items.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          
          return (
            <Link 
              key={item.id} 
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 p-2 transition-all duration-300 relative",
                isActive ? "text-[#E91E63]" : "text-gray-400"
              )}
            >
              <div className="relative">
                <Icon className={cn("h-6 w-6", isActive && "fill-current")} />
                {item.count ? (
                  <span className="absolute -top-1 -right-1 bg-[#E91E63] text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center">
                    {item.count}
                  </span>
                ) : null}
              </div>
              <span className="text-[10px] font-bold">{item.label}</span>
              {isActive && (
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#E91E63] rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
