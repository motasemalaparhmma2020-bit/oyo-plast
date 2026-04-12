import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { useOrders } from "@/hooks/use-orders";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useState } from "react";
import {
  Moon, Sun, User, MapPin, Ticket, LayoutGrid, Bell, Settings,
  Phone, MessageSquare, HelpCircle, FileText, Heart, ShoppingCart,
  Tag, ChevronLeft, LogIn, LogOut, Truck, Package, CreditCard,
  RotateCcw
} from "lucide-react";
import { WhyUsSection, StatsSection, FaqSection } from "@/components/HomeSections";

const APP_VERSION = "1.0.0";

export default function Profile() {
  const { user, isLoading: isAuthLoading, logout, isAuthenticated } = useAuth();
  const { data: orders } = useOrders();
  const { data: cart } = useCart();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  const { data: displaySettings } = useQuery<any>({
    queryKey: ["/api/display-settings"],
    staleTime: 60_000,
  });

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const cartCount = (cart as any[])?.reduce((acc, item) => acc + (item.quantity || 0), 0) || 0;

  const pendingOrders = (orders as any[])?.filter(o => o.status === "pending").length || 0;
  const processingOrders = (orders as any[])?.filter(o => o.status === "processing").length || 0;
  const shippedOrders = (orders as any[])?.filter(o => o.status === "shipped").length || 0;
  const reviewOrders = (orders as any[])?.filter(o => o.status === "review").length || 0;
  const returnedOrders = (orders as any[])?.filter(o => ["returned","cancelled"].includes(o.status)).length || 0;

  const userName = isAuthenticated
    ? (user?.firstName && user?.lastName
        ? `${user.firstName} ${user.lastName}`
        : user?.firstName || user?.email?.split("@")[0] || "مستخدم")
    : "Guest";

  const topCards = [
    { icon: Heart,        label: "قائمة المفضلة", href: "/wishlist", badge: null },
    { icon: ShoppingCart, label: "السلة",          href: "/cart",     badge: cartCount > 0 ? cartCount : null },
    { icon: Tag,          label: "العروض",          href: "/products", badge: null },
  ];

  const orderStatuses = [
    { icon: CreditCard,  label: "غير مدفوع",           count: pendingOrders,    href: "/orders" },
    { icon: Package,     label: "قيد التجهيز",          count: processingOrders, href: "/orders" },
    { icon: Truck,       label: "تم الشحن",              count: shippedOrders,    href: "/orders" },
    { icon: MessageSquare, label: "تعليق",              count: reviewOrders,     href: "/orders" },
    { icon: RotateCcw,   label: "مسترجع",               count: returnedOrders,   href: "/orders" },
  ];

  const generalItems = [
    { icon: Truck,       label: "تتبع الطلب",   href: "/orders" },
    { icon: MapPin,      label: "العناوين",      href: "/account" },
    { icon: Ticket,      label: "الكوبونات",     href: "/marketer/coupons" },
    { icon: LayoutGrid,  label: "الفئات",        href: "/products" },
    { icon: Bell,        label: "الإشعارات",     href: "/notifications" },
    { icon: Settings,    label: "الإعدادات",     href: "/account" },
  ];

  const supportItems = [
    { icon: Phone,       label: "تواصل معنا",       href: "/about" },
    { icon: MessageSquare, label: "تذاكر الدعم",   href: null },
    { icon: HelpCircle,  label: "الأسئلة الشائعة",  href: null },
    { icon: FileText,    label: "سياسة الخصوصية",   href: "/privacy" },
  ];

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-background pb-24" dir="rtl">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="bg-[#1a3a4a] dark:bg-[#0f2230] relative pt-10 pb-8 px-5">
        <button
          onClick={toggleDark}
          className="absolute top-4 left-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
          data-testid="button-dark-mode"
        >
          {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <div className="flex items-center justify-end gap-4">
          <div className="text-right">
            <h2 className="text-white font-bold text-xl leading-tight">{userName}</h2>
            {isAuthenticated && user?.email && (
              <p className="text-white/50 text-xs mt-0.5">{user.email}</p>
            )}
            {!isAuthenticated && (
              <p className="text-white/50 text-xs mt-0.5">ضيف</p>
            )}
          </div>
          <div className="w-16 h-16 rounded-full border-2 border-white/30 overflow-hidden bg-white/20 flex items-center justify-center flex-shrink-0">
            {isAuthenticated && user?.profileImageUrl ? (
              <img src={user.profileImageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="h-9 w-9 text-white/80" strokeWidth={1.5} />
            )}
          </div>
        </div>
      </div>

      {/* ── Top Quick-Access Cards ─────────────────────────────── */}
      <div className="bg-white dark:bg-card px-4 py-4 grid grid-cols-3 gap-3 shadow-sm">
        {topCards.map((card, i) => (
          <Link key={i} href={card.href}>
            <div
              className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-muted hover:bg-primary/5 transition-colors relative cursor-pointer"
              data-testid={`card-${i}`}
            >
              <div className="relative">
                <card.icon className="h-7 w-7 text-gray-600 dark:text-gray-300" strokeWidth={1.5} />
                {card.badge !== null && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {card.badge}
                  </span>
                )}
              </div>
              <span className="text-xs text-center text-gray-600 dark:text-gray-400 leading-tight">{card.label}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Order Statuses (for logged-in users) ──────────────── */}
      {isAuthenticated && (
        <div className="mt-3 bg-white dark:bg-card mx-3 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-2.5 border-b border-gray-100 dark:border-border flex items-center justify-between">
            <Link href="/orders">
              <span className="text-xs text-primary flex items-center gap-1">
                كل الطلبات <ChevronLeft className="h-3 w-3" />
              </span>
            </Link>
            <span className="text-sm font-bold text-gray-800 dark:text-foreground">طلباتي</span>
          </div>
          <div className="grid grid-cols-5 gap-1 px-2 py-3">
            {orderStatuses.map((s, i) => (
              <Link key={i} href={s.href}>
                <button
                  className="flex flex-col items-center gap-1.5 w-full p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-muted transition-colors relative"
                  data-testid={`order-status-${i}`}
                >
                  <div className="relative">
                    <s.icon className="h-6 w-6 text-gray-600 dark:text-gray-300" strokeWidth={1.5} />
                    {s.count > 0 && (
                      <span className="absolute -top-2 -right-2 h-5 min-w-5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-medium px-1">
                        {s.count}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 text-center leading-tight">{s.label}</span>
                </button>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── General Section ───────────────────────────────────── */}
      <div className="mt-3 bg-white dark:bg-card mx-3 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-4 py-2.5 border-b border-gray-100 dark:border-border">
          <span className="text-xs font-bold text-gray-400 tracking-widest">عام</span>
        </div>
        {generalItems.map((item, i) => {
          const Row = (
            <div
              className="flex items-center justify-between px-4 py-3.5 border-b border-gray-50 dark:border-border last:border-0 hover:bg-gray-50 dark:hover:bg-muted cursor-pointer transition-colors"
              data-testid={`menu-${i}`}
            >
              <ChevronLeft className="h-4 w-4 text-gray-300" />
              <div className="flex items-center gap-3 flex-1 justify-end">
                <span className="text-sm text-gray-700 dark:text-foreground">{item.label}</span>
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <item.icon className="h-4 w-4 text-primary" strokeWidth={1.5} />
                </div>
              </div>
            </div>
          );
          return item.href
            ? <Link key={i} href={item.href}>{Row}</Link>
            : <div key={i} className="opacity-50">{Row}</div>;
        })}
      </div>

      {/* ── Support Section ───────────────────────────────────── */}
      <div className="mt-3 bg-white dark:bg-card mx-3 rounded-2xl overflow-hidden shadow-sm">
        {supportItems.map((item, i) => {
          const Row = (
            <div
              className="flex items-center justify-between px-4 py-3.5 border-b border-gray-50 dark:border-border last:border-0 hover:bg-gray-50 dark:hover:bg-muted cursor-pointer transition-colors"
              data-testid={`support-${i}`}
            >
              <ChevronLeft className="h-4 w-4 text-gray-300" />
              <div className="flex items-center gap-3 flex-1 justify-end">
                <span className="text-sm text-gray-700 dark:text-foreground">{item.label}</span>
                <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-muted flex items-center justify-center">
                  <item.icon className="h-4 w-4 text-gray-500 dark:text-gray-400" strokeWidth={1.5} />
                </div>
              </div>
            </div>
          );
          return item.href
            ? <Link key={i} href={item.href}>{Row}</Link>
            : <div key={i}>{Row}</div>;
        })}
      </div>

      {/* ── Login / Logout ────────────────────────────────────── */}
      <div className="mt-3 mx-3">
        {isAuthenticated ? (
          <button
            onClick={() => logout()}
            className="w-full flex items-center justify-between px-4 py-4 bg-white dark:bg-card rounded-2xl shadow-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
            data-testid="button-logout"
          >
            <LogOut className="h-5 w-5" />
            <span className="font-semibold text-sm">تسجيل الخروج</span>
          </button>
        ) : (
          <Link href="/auth">
            <div
              className="w-full flex items-center justify-between px-4 py-4 bg-white dark:bg-card rounded-2xl shadow-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-muted transition-colors"
              data-testid="button-login"
            >
              <LogIn className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm text-gray-700 dark:text-foreground">تسجيل الدخول</span>
            </div>
          </Link>
        )}
      </div>

      {/* ── Dynamic Sections (controlled by admin) ────────────── */}
      {displaySettings?.showWhyUs === true && displaySettings?.whyUsOnAccount === true && (
        <div className="mt-3">
          <WhyUsSection size={displaySettings.whyUsSize ?? "medium"} />
        </div>
      )}
      {displaySettings?.showStats === true && displaySettings?.statsOnAccount === true && (
        <div className="mt-3">
          <StatsSection size={displaySettings.statsSize ?? "medium"} />
        </div>
      )}
      {displaySettings?.showFaq === true && displaySettings?.faqOnAccount === true && (
        <div className="mt-3">
          <FaqSection size={displaySettings.faqSize ?? "medium"} />
        </div>
      )}

      {/* ── Version ───────────────────────────────────────────── */}
      <div className="text-center mt-6 mb-2">
        <span className="text-xs text-gray-400">الإصدار {APP_VERSION}</span>
      </div>
    </div>
  );
}
