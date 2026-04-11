import { Link, useLocation } from "wouter";
import { ShoppingBag, Grid, Palette, User, Home, Heart, Package, Bell } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { useQuery } from "@tanstack/react-query";

export function DesktopSidebar() {
  const [location] = useLocation();
  const { data: cart } = useCart();

  if (location === '/admin' || location === '/staff' || location === '/supplier') return null;
  const cartCount = cart?.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0) || 0;

  const { data: navSettings = { showPrintingSection: true } } = useQuery<any>({
    queryKey: ["/api/navigation-settings"],
    queryFn: async () => {
      const res = await fetch("/api/navigation-settings", { credentials: "include" });
      if (!res.ok) return { showPrintingSection: true };
      return res.json();
    },
    staleTime: 60000,
  });

  const { data: homeSettings } = useQuery<any>({
    queryKey: ["/api/home-settings"],
    queryFn: async () => {
      const res = await fetch("/api/home-settings", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60000,
  });

  const primaryColor = homeSettings?.primaryColor || "#06B6D4";

  const navItem = (href: string, icon: React.ReactNode, label: string, testId: string, badge?: number) => {
    const active = href === "/" ? location === "/" : location.startsWith(href);
    return (
      <Link href={href}>
        <button
          data-testid={testId}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-right ${
            active
              ? "bg-gray-100 dark:bg-gray-800 font-semibold"
              : "hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-600 dark:text-gray-400"
          }`}
          style={{ color: active ? primaryColor : undefined }}
        >
          <div className="relative flex-shrink-0">
            {icon}
            {badge && badge > 0 && (
              <span
                className="absolute -top-2 -right-2 text-white text-[10px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1"
                style={{ backgroundColor: primaryColor }}
              >
                {badge > 9 ? "9+" : badge}
              </span>
            )}
          </div>
          <span className="text-sm">{label}</span>
        </button>
      </Link>
    );
  };

  return (
    <aside className="hidden lg:flex flex-col fixed right-0 top-0 h-full w-56 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 pt-20 pb-6 z-30 overflow-y-auto">
      <div className="flex flex-col gap-1 px-3">
        {navItem("/", <Home className="h-5 w-5" />, "الرئيسية", "desktop-nav-home")}
        {navItem("/products", <Grid className="h-5 w-5" />, "جميع المنتجات", "desktop-nav-products")}
        {navItem("/categories", <ShoppingBag className="h-5 w-5" />, "الأقسام", "desktop-nav-categories")}
        {navSettings?.showPrintingSection !== false && navItem("/printing", <Palette className="h-5 w-5" />, "طباعة وتصميم", "desktop-nav-printing")}
        {navItem("/cart", <ShoppingBag className="h-5 w-5" />, "سلة التسوق", "desktop-nav-cart", cartCount)}
        {navItem("/wishlist", <Heart className="h-5 w-5" />, "المفضلة", "desktop-nav-wishlist")}
        {navItem("/orders", <Package className="h-5 w-5" />, "طلباتي", "desktop-nav-orders")}
        {navItem("/notifications", <Bell className="h-5 w-5" />, "الإشعارات", "desktop-nav-notifications")}
        {navItem("/profile", <User className="h-5 w-5" />, "حسابي", "desktop-nav-profile")}
      </div>

      <div className="mt-auto px-4 pt-4 border-t border-gray-100 dark:border-gray-800 mx-3">
        <p className="text-xs text-gray-400 text-center">أويو بلاست</p>
        <p className="text-xs text-gray-300 text-center mt-0.5">مستلزمات التغليف</p>
      </div>
    </aside>
  );
}
