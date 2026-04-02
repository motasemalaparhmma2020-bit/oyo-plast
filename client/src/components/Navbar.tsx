import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  ShoppingCart, 
  Menu, 
  User as UserIcon, 
  Search, 
  LogOut,
  Heart,
  Bell,
  X
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useLogoSettings } from "@/hooks/use-logo-settings";
import oyoLogo from "@assets/FB_IMG_1748731871206_1766877101101.jpg";

// ─── Search Bar Component ────────────────────────────────────────
function SearchBar({ onClose }: { onClose?: () => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();

  const { data: results = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/products", "search", query],
    queryFn: async () => {
      if (!query.trim() || query.length < 2) return [];
      const res = await fetch(`/api/products?search=${encodeURIComponent(query.trim())}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: query.length >= 2,
    staleTime: 5000,
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (productId: number) => {
    setQuery("");
    setOpen(false);
    onClose?.();
    navigate(`/product/${productId}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setOpen(false);
    onClose?.();
    navigate(`/products?search=${encodeURIComponent(query.trim())}`);
    setQuery("");
  };

  return (
    <div ref={containerRef} className="relative w-full" data-testid="search-container">
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(e.target.value.length >= 2);
          }}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder="ابحث عن منتج..."
          className="pr-9 pl-8 h-9 bg-gray-50 border-gray-200 focus:bg-white text-sm w-full"
          dir="rtl"
          data-testid="input-search"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            onClick={() => { setQuery(""); setOpen(false); }}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      {/* Dropdown Results */}
      {open && (
        <div className="absolute top-full right-0 left-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-[200] overflow-hidden">
          {isLoading && (
            <div className="p-3 text-center text-sm text-gray-500">جاري البحث...</div>
          )}
          {!isLoading && results.length === 0 && query.length >= 2 && (
            <div className="p-3 text-center text-sm text-gray-500">لا توجد نتائج لـ "{query}"</div>
          )}
          {results.slice(0, 6).map((product: any) => (
            <button
              key={product.id}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors text-right border-b border-gray-50 last:border-0"
              onClick={() => handleSelect(product.id)}
              data-testid={`search-result-${product.id}`}
            >
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-10 h-10 object-contain rounded-lg bg-gray-100 flex-shrink-0"
                loading="lazy"
              />
              <div className="flex-1 min-w-0 text-right">
                <p className="text-sm font-semibold text-gray-800 line-clamp-1">{product.name}</p>
                <p className="text-xs text-blue-600 font-bold">
                  {Number(product.price).toLocaleString("ar-YE")} ر.ي
                </p>
              </div>
            </button>
          ))}
          {results.length > 6 && (
            <button
              className="w-full p-2 text-sm text-center text-blue-600 hover:bg-blue-50 font-medium"
              onClick={handleSubmit as any}
            >
              عرض جميع النتائج ({results.length})
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Navbar ─────────────────────────────────────────────────────
export function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const { data: cart } = useCart();
  const { data: logoSettings } = useLogoSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [location] = useLocation();
  
  const logoSrc = logoSettings?.logoUrl || oyoLogo;
  const [currency, setCurrency] = useState<'YER' | 'SAR'>(() => {
    return (localStorage.getItem('currency') as 'YER' | 'SAR') || 'YER';
  });

  const toggleCurrency = () => {
    const newCurrency = currency === 'YER' ? 'SAR' : 'YER';
    setCurrency(newCurrency);
    localStorage.setItem('currency', newCurrency);
    window.dispatchEvent(new Event('currencyChange'));
  };

  const cartCount = cart?.reduce((acc: number, item: any) => acc + (item.quantity || 0), 0) || 0;

  const { data: unreadCount } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  const NavLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
    const isActive = location === href;
    return (
      <Link href={href} className={`
        text-sm font-medium transition-colors hover:text-primary
        ${isActive ? "text-primary font-bold" : "text-muted-foreground"}
      `}>
        {children}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white dark:bg-background shadow-sm">
      <div className="container mx-auto px-4 h-16 flex items-center gap-3">

        {/* Mobile Menu */}
        <div className="flex items-center md:hidden">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" data-testid="button-mobile-menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <div className="flex flex-col items-center pt-4 mb-6">
                <img src={logoSrc} alt="OYO PLAST" className="w-24 h-24 object-contain rounded-xl" />
              </div>
              <div className="flex flex-col space-y-4">
                <Link href="/" onClick={() => setIsOpen(false)} className="text-lg font-medium">الرئيسية</Link>
                <Link href="/products" onClick={() => setIsOpen(false)} className="text-lg font-medium">المنتجات</Link>
                <Link href="/orders" onClick={() => setIsOpen(false)} className="text-lg font-medium">طلباتي</Link>
                <Link href="/wishlist" onClick={() => setIsOpen(false)} className="text-lg font-medium flex items-center gap-2">
                  <Heart className="h-5 w-5" />المفضلة
                </Link>
                <Link href="/notifications" onClick={() => setIsOpen(false)} className="text-lg font-medium flex items-center gap-2">
                  <Bell className="h-5 w-5" />الإشعارات
                  {unreadCount && unreadCount.count > 0 && (
                    <Badge className="bg-red-500 text-white text-xs">{unreadCount.count}</Badge>
                  )}
                </Link>
                <Link href="/about" onClick={() => setIsOpen(false)} className="text-lg font-medium">من نحن</Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Logo */}
        <div className="flex-shrink-0">
          <Link href="/" className="flex items-center gap-2" data-testid="link-logo">
            <img 
              src={logoSrc} 
              alt="OYO PLAST" 
              className="h-10 w-10 md:h-12 md:w-12 object-contain rounded-lg shadow-md"
            />
            <div className="hidden sm:flex flex-col">
              <span className="text-base font-extrabold text-[#2196F3] leading-tight">OYO PLAST</span>
              <span className="text-[10px] text-muted-foreground font-medium">مستلزمات التغليف</span>
            </div>
          </Link>
        </div>

        {/* Search Bar — Desktop: next to logo, grows to fill space */}
        <div className="hidden md:flex flex-1 max-w-md">
          <SearchBar />
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6 flex-shrink-0">
          <NavLink href="/">الرئيسية</NavLink>
          <NavLink href="/products">المنتجات</NavLink>
          <NavLink href="/about">من نحن</NavLink>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-1 md:gap-2 mr-auto md:mr-0">

          {/* Mobile search toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileSearch(!mobileSearch)}
            data-testid="button-mobile-search"
          >
            {mobileSearch ? <X className="h-5 w-5" /> : <Search className="h-5 w-5 text-muted-foreground" />}
          </Button>

          {/* Currency toggle */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={toggleCurrency}
            className="font-bold border-2 border-[#2196F3] text-[#2196F3] hover:bg-[#2196F3] hover:text-white transition-all text-xs px-2"
            data-testid="button-toggle-currency"
          >
            {currency === 'YER' ? 'SAR' : 'YER'}
          </Button>

          {isAuthenticated && (
            <>
              <Link href="/notifications">
                <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
                  <Bell className="h-5 w-5 text-[#2196F3]" />
                  {unreadCount && unreadCount.count > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white rounded-full text-xs">
                      {unreadCount.count}
                    </Badge>
                  )}
                </Button>
              </Link>
            </>
          )}

          <Link href="/cart">
            <Button variant="ghost" size="icon" className="relative" data-testid="button-cart">
              <ShoppingCart className="h-5 w-5 text-[#2196F3]" />
              {cartCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-[#2196F3] text-white rounded-full text-xs">
                  {cartCount}
                </Badge>
              )}
            </Button>
          </Link>

          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full" data-testid="button-user-menu">
                  <UserIcon className="h-5 w-5 text-[#2196F3]" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>مرحباً، {user?.firstName || user?.email || "مستخدم"}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/register" className="cursor-pointer">ملفي الشخصي</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/orders" className="cursor-pointer">طلباتي</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/wishlist" className="cursor-pointer flex items-center gap-2">
                    <Heart className="h-4 w-4" />المفضلة
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/notifications" className="cursor-pointer flex items-center gap-2">
                    <Bell className="h-4 w-4" />الإشعارات
                    {unreadCount && unreadCount.count > 0 && (
                      <Badge className="bg-red-500 text-white text-xs mr-auto">{unreadCount.count}</Badge>
                    )}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()} className="text-red-500 cursor-pointer">
                  <LogOut className="ml-2 h-4 w-4" />تسجيل خروج
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/auth">
              <Button size="sm" className="hidden md:flex font-bold bg-[#2196F3] hover:bg-[#1976D2] text-xs px-3" data-testid="button-login">
                دخول
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Mobile Search Bar — slides down when toggled */}
      {mobileSearch && (
        <div className="md:hidden px-4 pb-3 border-t pt-3 bg-white">
          <SearchBar onClose={() => setMobileSearch(false)} />
        </div>
      )}
    </header>
  );
}
