import { Link, useLocation } from "wouter";
import { ShoppingBag, Grid, Palette, User } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { useQuery } from "@tanstack/react-query";

export function GlobalBottomNav() {
  const [location] = useLocation();
  const { data: cart } = useCart();
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
  const isHome = location === "/";

  const navItemClass = (active: boolean) =>
    `flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-colors flex-1 min-w-0`;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 z-50"
      data-testid="global-bottom-nav"
    >
      <div className="flex items-stretch justify-around h-16 w-full px-1">

        {/* متجر */}
        <Link href="/products">
          <button
            className={navItemClass(location.startsWith("/products"))}
            data-testid="nav-shop"
            style={{ color: location.startsWith("/products") ? primaryColor : undefined }}
          >
            <ShoppingBag
              className="h-5 w-5"
              style={{ color: location.startsWith("/products") ? primaryColor : "#6b7280" }}
            />
            <span
              className="text-xs font-medium"
              style={{ color: location.startsWith("/products") ? primaryColor : "#6b7280" }}
            >
              متجر
            </span>
          </button>
        </Link>

        {/* الفئات */}
        <Link href="/products">
          <button
            className={navItemClass(false)}
            data-testid="nav-categories"
          >
            <Grid className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              الفئات
            </span>
          </button>
        </Link>

        {/* طباعة وتصميم */}
        {navSettings?.showPrintingSection !== false && (
          <Link href="/printing">
            <button
              className={navItemClass(location.startsWith("/printing"))}
              data-testid="nav-printing"
              style={{ color: location.startsWith("/printing") ? primaryColor : undefined }}
            >
              <Palette
                className="h-5 w-5"
                style={{ color: location.startsWith("/printing") ? primaryColor : "#6b7280" }}
              />
              <span
                className="text-xs font-medium"
                style={{ color: location.startsWith("/printing") ? primaryColor : "#6b7280" }}
              >
                طباعة
              </span>
            </button>
          </Link>
        )}

        {/* السلة */}
        <Link href="/cart">
          <button
            className={navItemClass(location.startsWith("/cart"))}
            data-testid="nav-cart"
          >
            <div className="relative">
              <ShoppingBag
                className="h-5 w-5"
                style={{ color: location.startsWith("/cart") ? primaryColor : "#6b7280" }}
              />
              {cartCount > 0 && (
                <span
                  className="absolute -top-2 -right-2 text-white text-[10px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1"
                  style={{ backgroundColor: primaryColor }}
                  data-testid="badge-cart-count"
                >
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </div>
            <span
              className="text-xs font-medium"
              style={{ color: location.startsWith("/cart") ? primaryColor : "#6b7280" }}
            >
              السلة
            </span>
          </button>
        </Link>

        {/* أنا */}
        <Link href="/profile">
          <button
            className={navItemClass(location.startsWith("/profile"))}
            data-testid="nav-profile"
            style={{ color: location.startsWith("/profile") ? primaryColor : undefined }}
          >
            <User
              className="h-5 w-5"
              style={{ color: location.startsWith("/profile") ? primaryColor : "#6b7280" }}
            />
            <span
              className="text-xs font-medium"
              style={{ color: location.startsWith("/profile") ? primaryColor : "#6b7280" }}
            >
              أنا
            </span>
          </button>
        </Link>

      </div>
    </nav>
  );
}
