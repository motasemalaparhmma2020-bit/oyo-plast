import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { Button } from "@/components/ui/button";
import {
  ShoppingCart,
  Menu,
  User as UserIcon,
  Search,
  LogOut,
  Heart,
  Bell,
  X,
  Package,
  Printer,
  ShoppingBag,
  Tag,
  Scissors,
  Box,
  ChevronLeft,
  Phone,
  Star,
  LayoutDashboard,
  Truck,
  Camera,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
import { useCategories } from "@/hooks/use-products";
import oyoLogo from "@assets/FB_IMG_1748731871206_1766877101101.jpg";
import { NotificationBell } from "@/components/NotificationBell";

// ─── Search Bar Component ────────────────────────────────────────
function SearchBar({ compact, onClose, glassy }: { compact?: boolean; onClose?: () => void; glassy?: boolean }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [visualLoading, setVisualLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: results = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/products", "search", query],
    queryFn: async () => {
      if (!query.trim() || query.length < 2) return [];
      const res = await fetch(`/api/products?search=${encodeURIComponent(query.trim())}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: query.length >= 2,
    staleTime: 5000,
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (productId: number) => {
    setQuery(""); setOpen(false); onClose?.(); navigate(`/product/${productId}`);
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setOpen(false); onClose?.();
    navigate(`/products?search=${encodeURIComponent(query.trim())}`);
    setQuery("");
  };

  // ─── البحث بالكاميرا (Visual Search) ─────────────────────────────
  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // إعادة تعيين للسماح برفع نفس الصورة لاحقاً

    if (!file.type.startsWith("image/")) {
      toast({ title: "ملف غير صالح", description: "يرجى اختيار صورة فقط", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "الصورة كبيرة", description: "الحد الأقصى 5 ميجابايت", variant: "destructive" });
      return;
    }

    setVisualLoading(true);
    toast({
      title: "🔍 جاري تحليل الصورة...",
      description: "الذكاء الاصطناعي يبحث عن منتج مماثل، لحظة من فضلك",
    });
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/visual-search", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "فشل تحليل الصورة");
      }
      if (!data.recognized || !data.keywords) {
        toast({
          title: "لم نتعرّف على المنتج",
          description: data?.message || "جرّب صورة أوضح أو اكتب اسم المنتج يدوياً",
        });
        return;
      }
      toast({
        title: "🔍 تم التعرّف",
        description: `نبحث عن: ${data.keywords}`,
      });
      setOpen(false);
      onClose?.();
      navigate(`/products?search=${encodeURIComponent(data.keywords)}`);
    } catch (err: any) {
      toast({
        title: "تعذّر البحث بالصورة",
        description: err?.message || "حاول مرة أخرى",
        variant: "destructive",
      });
    } finally {
      setVisualLoading(false);
    }
  };

  const h = compact ? 36 : 40;
  return (
    <div ref={containerRef} className="relative w-full" data-testid="search-container">
      <form
        onSubmit={handleSubmit}
        className={`flex items-center rounded-full overflow-hidden border shadow-sm transition-all ${
          glassy ? "border-white/40 bg-white/20 backdrop-blur-md" : "border-gray-200 bg-white"
        }`}
        style={{ height: h }}
      >
        <button type="submit" className="flex-shrink-0 bg-[#1a3a4a] hover:bg-[#0f2b3a] text-white flex items-center justify-center transition-colors" style={{ width: h, height: h }} data-testid="button-search-submit">
          <Search className="h-4 w-4" />
        </button>
        <input
          ref={inputRef} type="text" value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(e.target.value.length >= 2); }}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder="ابحث عن منتج..."
          className={`flex-1 min-w-0 bg-transparent text-sm outline-none px-3 text-right ${glassy ? "text-white placeholder-white/70" : "text-gray-700 placeholder-gray-400"}`}
          style={{ direction: "rtl" }} data-testid="input-search" autoComplete="off"
        />
        {query && (
          <button type="button" className="flex-shrink-0 px-2 text-gray-400 hover:text-gray-600" onClick={() => { setQuery(""); setOpen(false); }}>
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {/* زر البحث بالكاميرا */}
        <button
          type="button"
          onClick={handleCameraClick}
          disabled={visualLoading}
          aria-label="البحث بالكاميرا"
          title="البحث بالكاميرا — صوّر منتجاً للعثور على مثله"
          className={`flex-shrink-0 flex items-center justify-center transition-colors ${
            glassy
              ? "text-white/90 hover:text-white"
              : "text-[#1a3a4a] hover:text-[#0f2b3a]"
          } ${visualLoading ? "opacity-50" : ""}`}
          style={{ width: h, height: h }}
          data-testid="button-visual-search"
        >
          {visualLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
        </button>
      </form>
      {/* مدخل الصورة المخفي — يفتح الكاميرا الخلفية على الجوال */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImageSelected}
        className="hidden"
        data-testid="input-camera-file"
      />

      {open && (
        <div className="absolute top-full right-0 left-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-[200] overflow-hidden">
          {isLoading && <div className="p-3 text-center text-sm text-gray-500">جاري البحث...</div>}
          {!isLoading && results.length === 0 && query.length >= 2 && (
            <div className="p-3 text-center text-sm text-gray-500">لا توجد نتائج لـ "{query}"</div>
          )}
          {results.slice(0, 6).map((product: any) => (
            <button key={product.id} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors text-right border-b border-gray-50 last:border-0" onClick={() => handleSelect(product.id)} data-testid={`search-result-${product.id}`}>
              <img src={product.imageUrl} alt={product.name} className="w-10 h-10 object-contain rounded-lg bg-gray-100 flex-shrink-0" loading="lazy" />
              <div className="flex-1 min-w-0 text-right">
                <p className="text-sm font-semibold text-gray-800 line-clamp-1">{product.name}</p>
                <p className="text-xs text-blue-600 font-bold price-num" style={{ fontFamily: 'var(--font-numbers)' }} data-price="true">{Number(product.price).toLocaleString("en-US")} ر.ي</p>
              </div>
            </button>
          ))}
          {results.length > 6 && (
            <button className="w-full p-2 text-sm text-center text-blue-600 hover:bg-blue-50 font-medium" onClick={handleSubmit as any}>
              عرض جميع النتائج ({results.length})
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Category Icon Mapper ─────────────────────────────────────────
function getCategoryIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes("طباعة") || n.includes("print")) return <Printer className="h-5 w-5" />;
  if (n.includes("أكياس") || n.includes("كيس") || n.includes("bag")) return <ShoppingBag className="h-5 w-5" />;
  if (n.includes("علاق") || n.includes("شماعة") || n.includes("hanger")) return <Tag className="h-5 w-5" />;
  if (n.includes("قماش") || n.includes("نسيج") || n.includes("fabric")) return <Scissors className="h-5 w-5" />;
  if (n.includes("تغليف") || n.includes("pack")) return <Package className="h-5 w-5" />;
  return <Box className="h-5 w-5" />;
}

// ─── Category color by index ──────────────────────────────────────
const CAT_COLORS = [
  "bg-blue-100 text-blue-600",
  "bg-purple-100 text-purple-600",
  "bg-emerald-100 text-emerald-600",
  "bg-orange-100 text-orange-600",
  "bg-pink-100 text-pink-600",
  "bg-indigo-100 text-indigo-600",
  "bg-yellow-100 text-yellow-700",
  "bg-rose-100 text-rose-600",
];

// ─── Rich Side Drawer ─────────────────────────────────────────────
function SideDrawer({
  isOpen, setIsOpen, user, isAuthenticated, logout,
  unreadCount, cartCount, logoSrc, displaySettings,
}: {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  user: any;
  isAuthenticated: boolean;
  logout: () => void;
  unreadCount: { count: number } | undefined;
  cartCount: number;
  logoSrc: string;
  displaySettings: any;
}) {
  const { data: categories = [] } = useCategories();
  const close = () => setIsOpen(false);

  const bgFrom = displaySettings?.drawerBgFrom || "#0891B2";
  const bgTo   = displaySettings?.drawerBgTo   || "#164e63";
  const width  = displaySettings?.drawerWidth   || 300;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" data-testid="button-mobile-menu">
          <Menu className="h-5 w-5 transition-colors" id="drawer-menu-icon" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="p-0 overflow-y-auto border-l-0"
        style={{ width: `${width}px`, maxWidth: "95vw" }}
      >
        {/* ══ 1. منطقة الترحيب ══════════════════════════════════ */}
        <div
          className="relative flex flex-col items-center justify-center pt-10 pb-6 px-4 text-white"
          style={{ background: `linear-gradient(135deg, ${bgFrom} 0%, ${bgTo} 100%)` }}
          dir="rtl"
        >
          {/* زر الإغلاق */}
          <button onClick={close} className="absolute top-3 left-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors">
            <X className="h-4 w-4 text-white" />
          </button>

          {/* الشعار */}
          <img src={logoSrc} alt="OYO PLAST" className="w-16 h-16 rounded-2xl object-cover shadow-lg mb-3 ring-2 ring-white/40" />

          {/* اسم المستخدم أو زر الدخول */}
          {isAuthenticated ? (
            <div className="text-center">
              <p className="font-bold text-base leading-tight">
                مرحباً، {user?.firstName || user?.email?.split("@")[0] || "عزيزي"}
              </p>
              <p className="text-white/70 text-xs mt-0.5">{user?.email || ""}</p>
            </div>
          ) : (
            <div className="text-center space-y-2 w-full">
              <p className="text-white/90 text-sm">مرحباً بك في أويو بلاست</p>
              <Link href="/auth" onClick={close}>
                <button className="w-full bg-white text-[#0891B2] font-bold text-sm py-2 rounded-xl hover:bg-white/90 transition-colors" data-testid="drawer-btn-login">
                  تسجيل الدخول / إنشاء حساب
                </button>
              </Link>
            </div>
          )}
        </div>

        {/* ══ 2. شريط الإجراءات السريعة ═════════════════════════ */}
        <div className="grid grid-cols-3 gap-2 px-3 py-3 bg-gray-50 border-b" dir="rtl">
          <Link href="/orders" onClick={close}>
            <div className="flex flex-col items-center gap-1 p-2 bg-white rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer" data-testid="drawer-link-orders">
              <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
                <Truck className="h-4 w-4 text-green-600" />
              </div>
              <span className="text-[11px] font-bold text-gray-700">طلباتي</span>
            </div>
          </Link>
          <Link href="/wishlist" onClick={close}>
            <div className="flex flex-col items-center gap-1 p-2 bg-white rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer" data-testid="drawer-link-wishlist">
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">
                <Heart className="h-4 w-4 text-red-500" />
              </div>
              <span className="text-[11px] font-bold text-gray-700">مفضلتي</span>
            </div>
          </Link>
          <Link href="/notifications" onClick={close}>
            <div className="relative flex flex-col items-center gap-1 p-2 bg-white rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer" data-testid="drawer-link-notifications">
              {unreadCount && unreadCount.count > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{unreadCount.count}</span>
              )}
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                <Bell className="h-4 w-4 text-blue-600" />
              </div>
              <span className="text-[11px] font-bold text-gray-700">الإشعارات</span>
            </div>
          </Link>
        </div>

        {/* ══ 3. أقسام المتجر ════════════════════════════════════ */}
        {categories.length > 0 && (
          <div className="px-3 pt-4 pb-2" dir="rtl">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">أقسام المتجر</p>
            <div className="space-y-1">
              {categories.map((cat: any, idx: number) => (
                <Link key={cat.id} href={`/category/${encodeURIComponent((cat.slug || "").trim())}`} onClick={close}>
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer group" data-testid={`drawer-category-${cat.id}`}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${CAT_COLORS[idx % CAT_COLORS.length]}`}>
                      {getCategoryIcon(cat.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 leading-tight">{cat.name}</p>
                      {typeof cat.productCount === "number" && cat.productCount > 0 && (
                        <p className="text-[11px] text-gray-400">{cat.productCount} منتج</p>
                      )}
                    </div>
                    <ChevronLeft className="h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ══ 4. روابط إضافية ════════════════════════════════════ */}
        <div className="px-3 pt-3 pb-2 border-t mt-2" dir="rtl">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">معلومات</p>
          <div className="space-y-1">
            {[
              { href: "/", label: "الصفحة الرئيسية", icon: <LayoutDashboard className="h-4 w-4" /> },
              { href: "/about", label: "من نحن", icon: <Star className="h-4 w-4" /> },
            ].map(link => (
              <Link key={link.href} href={link.href} onClick={close}>
                <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer">
                  <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0">
                    {link.icon}
                  </div>
                  <span className="text-sm font-medium text-gray-700">{link.label}</span>
                </div>
              </Link>
            ))}

            {isAuthenticated && (
              <button
                onClick={() => { logout(); close(); }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors text-red-500"
                data-testid="drawer-btn-logout"
              >
                <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                  <LogOut className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">تسجيل الخروج</span>
              </button>
            )}
          </div>
        </div>

        {/* ══ 5. واتساب ══════════════════════════════════════════ */}
        <div className="px-3 pb-6 pt-2 border-t" dir="rtl">
          <a
            href="https://wa.me/967774997589"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-2xl hover:bg-green-100 transition-colors"
            data-testid="drawer-btn-whatsapp"
          >
            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 shadow-sm">
              <Phone className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-green-800">تواصل معنا عبر واتساب</p>
              <p className="text-xs text-green-600 font-mono" dir="ltr">+967 774 997 589</p>
            </div>
          </a>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Navbar ─────────────────────────────────────────────────────
export function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const { data: cart } = useCart();
  const { data: logoSettings } = useLogoSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();
  const [scrolled, setScrolled] = useState(false);

  const isHome = location === "/";

  useEffect(() => {
    if (!isHome) { setScrolled(true); return; }
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  const transparent = isHome && !scrolled;
  const logoSrc = logoSettings?.logoUrl || oyoLogo;

  const [currency, setCurrency] = useState<'YER' | 'SAR'>(() => (localStorage.getItem('currency') as 'YER' | 'SAR') || 'YER');
  const toggleCurrency = () => {
    const c = currency === 'YER' ? 'SAR' : 'YER';
    setCurrency(c); localStorage.setItem('currency', c);
    window.dispatchEvent(new Event('currencyChange'));
  };

  const cartCount = cart?.reduce((acc: number, item: any) => acc + (item.quantity || 0), 0) || 0;

  const { data: unreadCount } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  const { data: displaySettings } = useQuery<any>({
    queryKey: ["/api/display-settings"],
    staleTime: 60000,
  });

  const NavLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
    const isActive = location === href;
    return (
      <Link href={href} className={`text-sm font-medium transition-colors hover:text-primary ${isActive ? "text-primary font-bold" : "text-muted-foreground"}`}>
        {children}
      </Link>
    );
  };

  return (
    <header className={`sticky top-0 z-50 w-full transition-all duration-300 ${transparent ? "bg-transparent border-transparent shadow-none" : "bg-white/95 dark:bg-background/95 backdrop-blur-md border-b shadow-sm"}`}>
      <div className="container mx-auto px-3 h-14 flex items-center gap-2">

        {/* زر القائمة — موبايل فقط */}
        <div className="flex items-center md:hidden flex-shrink-0">
          <SideDrawer
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            user={user}
            isAuthenticated={isAuthenticated}
            logout={logout}
            unreadCount={unreadCount}
            cartCount={cartCount}
            logoSrc={logoSrc}
            displaySettings={displaySettings}
          />
          {/* تطبيق لون أيقونة الهامبرجر بعد الرندر */}
          <style>{`#drawer-menu-icon { color: ${transparent ? "white" : "inherit"}; filter: ${transparent ? "drop-shadow(0 1px 2px rgba(0,0,0,0.4))" : "none"}; }`}</style>
        </div>

        {/* الشعار */}
        <div className="flex-shrink-0">
          <Link href="/" className="flex items-center gap-1.5" data-testid="link-logo">
            <img src={logoSrc} alt="OYO PLAST" className={`h-9 w-9 md:h-11 md:w-11 object-contain rounded-lg ${transparent ? "shadow-xl ring-2 ring-white/30" : "shadow-md"}`} />
            <div className="hidden sm:flex flex-col">
              <span className={`text-base font-extrabold leading-tight transition-colors ${transparent ? "text-white drop-shadow-md" : "text-[#2196F3]"}`}>OYO PLAST</span>
              <span className={`text-[10px] font-medium transition-colors ${transparent ? "text-white/80 drop-shadow" : "text-muted-foreground"}`}>مستلزمات التغليف</span>
            </div>
          </Link>
        </div>

        {/* شريط البحث */}
        <div className="flex-1 min-w-0 md:max-w-md">
          <SearchBar compact glassy={transparent} />
        </div>

        {/* روابط الديسكتوب */}
        <nav className="hidden md:flex items-center gap-6 flex-shrink-0">
          <NavLink href="/">الرئيسية</NavLink>
          <NavLink href="/products">المنتجات</NavLink>
          <NavLink href="/about">من نحن</NavLink>
        </nav>

        {/* أزرار الإجراءات */}
        <div className="flex items-center gap-1 flex-shrink-0">

          {/* تغيير العملة */}
          <Button variant="outline" size="sm" onClick={toggleCurrency}
            className={`font-bold border-2 transition-all text-xs px-2 ${transparent ? "border-white/60 text-white bg-white/10 hover:bg-white/25" : "border-[#2196F3] text-[#2196F3] hover:bg-[#2196F3] hover:text-white"}`}
            data-testid="button-toggle-currency"
          >
            {currency === 'YER' ? 'SAR' : 'YER'}
          </Button>

          {/* الإشعارات (مع جرس + صوت) */}
          {isAuthenticated && <NotificationBell />}

          {/* السلة */}
          <Link href="/cart">
            <Button variant="ghost" size="icon" className="relative" data-testid="button-cart">
              <ShoppingCart className={`h-5 w-5 transition-colors ${transparent ? "text-white drop-shadow" : "text-[#2196F3]"}`} />
              {cartCount > 0 && (
                <Badge className={`absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-white rounded-full text-xs ${transparent ? "bg-white/90 text-[#2196F3]" : "bg-[#2196F3]"}`}>{cartCount}</Badge>
              )}
            </Button>
          </Link>

          {/* المستخدم — ديسكتوب */}
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full hidden md:flex" data-testid="button-user-menu">
                  <UserIcon className={`h-5 w-5 transition-colors ${transparent ? "text-white drop-shadow" : "text-[#2196F3]"}`} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>مرحباً، {user?.firstName || user?.email || "مستخدم"}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link href="/register" className="cursor-pointer">ملفي الشخصي</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/orders" className="cursor-pointer">طلباتي</Link></DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/wishlist" className="cursor-pointer flex items-center gap-2"><Heart className="h-4 w-4" />المفضلة</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/notifications" className="cursor-pointer flex items-center gap-2">
                    <Bell className="h-4 w-4" />الإشعارات
                    {unreadCount && unreadCount.count > 0 && <Badge className="bg-red-500 text-white text-xs mr-auto">{unreadCount.count}</Badge>}
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
              <Button size="sm" className="hidden md:flex font-bold bg-[#2196F3] hover:bg-[#1976D2] text-xs px-3" data-testid="button-login">دخول</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
