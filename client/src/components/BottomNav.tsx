import { Link, useLocation } from "wouter";
import { Home, Grid3X3, ShoppingCart, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const [location] = useLocation();
  const { isAuthenticated } = useAuth();
  const { data: cart } = useCart();
  
  const cartCount = cart?.reduce((acc, item) => acc + item.quantity, 0) || 0;

  const items = [
    { id: 'home', label: 'الرئيسية', icon: Home, href: '/' },
    { id: 'categories', label: 'التصنيفات', icon: Grid3X3, href: '/products' },
    { id: 'cart', label: 'السلة', icon: ShoppingCart, href: '/cart', count: cartCount },
    { id: 'account', label: 'حسابي', icon: User, href: '/account' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-card border-t border-gray-200 px-2 py-2 shadow-[0_-2px_10px_rgba(0,0,0,0.08)]">
      <div className="flex justify-around items-center">
        {items.map((item) => {
          const isActive = item.href === '/' ? location === '/' : location.startsWith(item.href);
          const Icon = item.icon;
          
          return (
            <Link 
              key={item.id} 
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-4 py-1 transition-all duration-200 relative",
                isActive ? "text-teal-600" : "text-gray-400"
              )}
              data-testid={`nav-${item.id}`}
            >
              <div className="relative">
                <Icon className={cn("h-6 w-6", isActive && "stroke-[2.5]")} />
                {item.count && item.count > 0 ? (
                  <span className="absolute -top-2 -right-2 bg-teal-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                    {item.count > 9 ? '+9' : item.count}
                  </span>
                ) : null}
              </div>
              <span className={cn("text-[11px] font-medium", isActive && "font-bold")}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
