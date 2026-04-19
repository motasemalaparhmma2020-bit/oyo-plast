import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { useOrders } from "@/hooks/use-orders";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useState } from "react";
import {
  Moon, Sun, User, MapPin, Ticket, LayoutGrid, Bell, Settings,
  Phone, MessageSquare, HelpCircle, FileText, Heart, ShoppingCart,
  Tag, ChevronLeft, ChevronDown, ChevronUp, LogIn, LogOut,
  Truck, Package, CreditCard, RotateCcw, Star,
  BadgeDollarSign, ShieldCheck, Award, Headphones, Users,
  ExternalLink, TrendingUp, Wallet, Copy, CheckCheck,
} from "lucide-react";

const APP_VERSION = "1.0.0";

/* ────────────────────────────────────────────────────
   مكوّن: صف قابل للطيّ داخل صفحة أنا
   يُظهر عنواناً بأيقونة، وعند الضغط يمتد المحتوى
   ──────────────────────────────────────────────────── */
function CollapsibleSection({
  icon,
  label,
  color,
  badge,
  children,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  badge?: string;
  children: React.ReactNode;
  testId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3.5 border-b border-gray-50 dark:border-border hover:bg-gray-50 dark:hover:bg-muted/50 transition-colors cursor-pointer"
        onClick={() => setOpen((v) => !v)}
        data-testid={testId}
      >
        <div className="flex items-center gap-2">
          {open
            ? <ChevronUp className="h-4 w-4 text-gray-300" />
            : <ChevronDown className="h-4 w-4 text-gray-300" />}
          {badge && (
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">{badge}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-700 dark:text-foreground">{label}</span>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
            {icon}
          </div>
        </div>
      </button>
      {open && (
        <div className="bg-gray-50/80 dark:bg-muted/30 border-b border-gray-100 dark:border-border">
          {children}
        </div>
      )}
    </div>
  );
}

/* ── بطاقة إحصائية صغيرة ── */
function StatChip({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 flex-1">
      <div className="text-white/80 mb-0.5">{icon}</div>
      <span className="text-white font-black text-lg leading-none">{value}</span>
      <span className="text-white/60 text-[10px] font-medium">{label}</span>
    </div>
  );
}

/* ────────────────────────────────────────────────────
   الصفحة الرئيسية
   ──────────────────────────────────────────────────── */
export default function Profile() {
  const { user, isLoading: isAuthLoading, logout, isAuthenticated } = useAuth();
  const { data: orders } = useOrders();
  const { data: cart } = useCart();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const { data: displaySettings } = useQuery<any>({
    queryKey: ["/api/display-settings"],
    staleTime: 60_000,
  });

  const { data: pointsData } = useQuery<any>({
    queryKey: ["/api/points"],
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const { data: marketerInfo } = useQuery<any>({
    queryKey: ["/api/me/marketer-info"],
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const { data: wishlistItems = [] } = useQuery<any[]>({
    queryKey: ["/api/wishlist"],
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const { data: addressList = [] } = useQuery<any[]>({
    queryKey: ["/api/addresses"],
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const [copiedCoupon, setCopiedCoupon] = useState(false);

  const copyCoupon = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopiedCoupon(true);
    setTimeout(() => setCopiedCoupon(false), 2000);
  };

  const marketer = marketerInfo?.isMarketer ? marketerInfo.marketer : null;
  const wishlistCount = (wishlistItems as any[]).length;
  const defaultAddress = (addressList as any[])[0];

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const cartCount = (cart as any[])?.reduce((a, i) => a + (i.quantity || 0), 0) || 0;
  const totalOrders = (orders as any[])?.length || 0;

  const pendingOrders    = (orders as any[])?.filter(o => o.status === "pending").length || 0;
  const processingOrders = (orders as any[])?.filter(o => o.status === "processing").length || 0;
  const shippedOrders    = (orders as any[])?.filter(o => o.status === "shipped").length || 0;
  const reviewOrders     = (orders as any[])?.filter(o => o.status === "review").length || 0;
  const returnedOrders   = (orders as any[])?.filter(o => ["returned","cancelled"].includes(o.status)).length || 0;

  const loyaltyPoints = pointsData?.points ?? 0;

  const userName = isAuthenticated
    ? (user?.firstName && user?.lastName
        ? `${user.firstName} ${user.lastName}`
        : user?.firstName || user?.email?.split("@")[0] || "مستخدم")
    : "زائر";

  const orderStatuses = [
    { icon: CreditCard,    label: "غير مدفوع",  count: pendingOrders,    href: "/orders" },
    { icon: Package,       label: "جاري التجهيز", count: processingOrders, href: "/orders" },
    { icon: Truck,         label: "تم الشحن",   count: shippedOrders,    href: "/orders" },
    { icon: MessageSquare, label: "تعليق",       count: reviewOrders,     href: "/orders" },
    { icon: RotateCcw,     label: "مسترجع",      count: returnedOrders,   href: "/orders" },
  ];

  const generalItems = [
    { icon: Truck,       label: "تتبع الطلب",  href: "/orders",              color: "bg-green-100 dark:bg-green-900/30",  iconColor: "text-green-600 dark:text-green-400" },
    { icon: MapPin,      label: "العناوين",     href: "/account",             color: "bg-orange-100 dark:bg-orange-900/30", iconColor: "text-orange-500" },
    { icon: Ticket,      label: "الكوبونات",    href: "/marketer/coupons",    color: "bg-purple-100 dark:bg-purple-900/30", iconColor: "text-purple-500" },
    { icon: LayoutGrid,  label: "الفئات",       href: "/products",            color: "bg-blue-100 dark:bg-blue-900/30",    iconColor: "text-blue-500" },
    { icon: Heart,       label: "المفضلة",      href: "/wishlist",            color: "bg-red-100 dark:bg-red-900/30",      iconColor: "text-red-500" },
    { icon: ShoppingCart,label: "السلة",        href: "/cart",                color: "bg-teal-100 dark:bg-teal-900/30",    iconColor: "text-teal-500", badge: cartCount > 0 ? cartCount : undefined },
    { icon: Bell,        label: "الإشعارات",    href: "/notifications",       color: "bg-yellow-100 dark:bg-yellow-900/30", iconColor: "text-yellow-600" },
    { icon: Settings,    label: "الإعدادات",    href: "/account",             color: "bg-gray-100 dark:bg-gray-800",       iconColor: "text-gray-500" },
  ];

  const supportItems = [
    { icon: Phone,         label: "تواصل معنا",      href: "/about",    active: true,  color: "bg-green-100 dark:bg-green-900/30",  iconColor: "text-green-600" },
    { icon: MessageSquare, label: "دعم واتساب",      href: "https://wa.me/967774997589", active: true, external: true, color: "bg-green-50 dark:bg-green-900/20", iconColor: "text-green-500" },
    { icon: FileText,      label: "سياسة الخصوصية",  href: "/privacy",  active: true,  color: "bg-gray-100 dark:bg-gray-800",       iconColor: "text-gray-500" },
    { icon: FileText,      label: "شروط الاستخدام",  href: "/terms",    active: true,  color: "bg-gray-100 dark:bg-gray-800",       iconColor: "text-gray-400" },
  ];

  /* ── بيانات لماذا أويو بلاست (مضغوطة) ── */
  const whyUsItems = [
    { icon: <BadgeDollarSign className="h-4 w-4" />, label: "أسعار الجملة",   color: "bg-green-500" },
    { icon: <ShieldCheck className="h-4 w-4" />,    label: "جودة مضمونة",    color: "bg-blue-500" },
    { icon: <Truck className="h-4 w-4" />,          label: "توصيل لكل اليمن", color: "bg-orange-500" },
    { icon: <Package className="h-4 w-4" />,        label: "500+ منتج",       color: "bg-purple-500" },
    { icon: <Headphones className="h-4 w-4" />,     label: "دعم واتساب",     color: "bg-teal-500" },
    { icon: <Award className="h-4 w-4" />,          label: "نقاط الولاء",    color: "bg-yellow-500" },
  ];

  const statsItems = [
    { value: "+500", label: "منتج" },
    { value: "+20",  label: "مورد" },
    { value: "+18",  label: "محافظة" },
    { value: "+1000",label: "عميل" },
  ];

  const faqItems = [
    { q: "كيف أطلب من أويو بلاست؟",              a: "سجّل حساباً، تصفّح المنتجات، أضف للسلة، ثم أكمل الطلب. سيتواصل معك فريقنا لتأكيد الطلب." },
    { q: "هل تبيعون بالجملة للتجار؟",             a: "نعم، نتخصص في بيع الجملة. كلما زادت الكمية انخفض السعر." },
    { q: "هل يمكن الطباعة على المنتجات؟",          a: "نعم، كثير من منتجاتنا تدعم الطباعة المخصصة بشعارك." },
    { q: "كيف يتم الدفع؟",                         a: "الدفع نقداً عند الاستلام أو بالتحويل البنكي. نظام التقسيط متاح للطلبات الكبيرة." },
    { q: "كيف أتواصل مع خدمة العملاء؟",           a: "عبر واتساب مباشرةً أو من خلال قسم الطلبات في حسابك." },
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

      {/* ══ HEADER ══════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-bl from-[#1a3a4a] to-[#0d2535] dark:from-[#0f2230] dark:to-[#070f17] relative pt-10 pb-5 px-5">
        {/* زر الوضع الداكن */}
        <button
          onClick={toggleDark}
          className="absolute top-4 left-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
          data-testid="button-dark-mode"
        >
          {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        {/* معلومات المستخدم */}
        <div className="flex items-center justify-end gap-3 mb-4">
          <div className="text-right">
            <h2 className="text-white font-bold text-lg leading-tight">{userName}</h2>
            {isAuthenticated && user?.email && (
              <p className="text-white/45 text-xs mt-0.5">{user.email}</p>
            )}
            {isAuthenticated && defaultAddress?.phone && (
              <p className="text-white/40 text-xs mt-0.5 flex items-center justify-end gap-1">
                <Phone className="h-3 w-3" />
                {defaultAddress.phone}
              </p>
            )}
            {isAuthenticated && defaultAddress?.city && (
              <p className="text-white/40 text-xs mt-0.5 flex items-center justify-end gap-1">
                <MapPin className="h-3 w-3" />
                {defaultAddress.city}{defaultAddress.district ? ` · ${defaultAddress.district}` : ""}
              </p>
            )}
            {!isAuthenticated && (
              <p className="text-white/45 text-xs mt-0.5">
                <Link href="/auth">
                  <span className="text-primary/90 underline underline-offset-2">سجّل دخولك الآن</span>
                </Link>
              </p>
            )}
          </div>
          <div className="w-14 h-14 rounded-full border-2 border-white/25 overflow-hidden bg-white/15 flex items-center justify-center flex-shrink-0">
            {isAuthenticated && user?.profileImageUrl ? (
              <img src={user.profileImageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="h-8 w-8 text-white/70" strokeWidth={1.5} />
            )}
          </div>
        </div>

        {/* شريط الإحصائيات السريعة — للمستخدمين المسجّلين */}
        {isAuthenticated && (
          <div className="flex items-center divide-x divide-x-reverse divide-white/15 bg-white/8 rounded-2xl px-2 py-2.5">
            <StatChip icon={<Package className="h-4 w-4" />} value={String(totalOrders)}   label="طلباتي" />
            <StatChip icon={<Star className="h-4 w-4" />}   value={String(loyaltyPoints)} label="نقاطي" />
            <StatChip icon={<Heart className="h-4 w-4" />}  value={String(wishlistCount)} label="المفضلة" />
          </div>
        )}
      </div>

      {/* ══ طلباتي ═══════════════════════════════════════════════════ */}
      {isAuthenticated && (
        <div className="mt-3 bg-white dark:bg-card mx-3 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-2.5 border-b border-gray-100 dark:border-border flex items-center justify-between">
            <Link href="/orders">
              <span className="text-xs text-primary flex items-center gap-0.5" data-testid="link-all-orders">
                كل الطلبات <ChevronLeft className="h-3 w-3" />
              </span>
            </Link>
            <span className="text-sm font-bold text-gray-800 dark:text-foreground">طلباتي</span>
          </div>
          <div className="grid grid-cols-5 gap-0 px-1 py-2">
            {orderStatuses.map((s, i) => (
              <Link key={i} href={s.href}>
                <button
                  className="flex flex-col items-center gap-1 w-full py-2 px-1 rounded-xl hover:bg-gray-50 dark:hover:bg-muted transition-colors relative"
                  data-testid={`order-status-${i}`}
                >
                  <div className="relative">
                    <s.icon className="h-[22px] w-[22px] text-gray-500 dark:text-gray-300" strokeWidth={1.5} />
                    {s.count > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-0.5">
                        {s.count}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] text-gray-500 dark:text-gray-400 text-center leading-tight">{s.label}</span>
                </button>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ══ لوحة المسوق ══════════════════════════════════════════════ */}
      {isAuthenticated && marketer && (
        <div className="mt-3 mx-3 rounded-2xl overflow-hidden shadow-sm" data-testid="marketer-panel">
          {/* هيدر المسوق */}
          <div className="bg-gradient-to-bl from-amber-500 to-orange-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-white/20 rounded-full p-1.5">
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-white/70 text-[10px]">رمز الكوبون</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-white font-black text-base tracking-widest">{marketer.couponCode}</span>
                  <button
                    onClick={() => copyCoupon(marketer.couponCode)}
                    className="bg-white/20 rounded p-0.5 hover:bg-white/30 transition-colors"
                    data-testid="btn-copy-coupon"
                  >
                    {copiedCoupon
                      ? <CheckCheck className="h-3 w-3 text-white" />
                      : <Copy className="h-3 w-3 text-white" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-white font-bold text-sm">لوحة المسوق</p>
              <p className="text-white/70 text-[10px]">{marketer.name}</p>
            </div>
          </div>
          {/* إحصائيات المسوق */}
          <div className="bg-white dark:bg-card grid grid-cols-3 divide-x divide-x-reverse divide-gray-100 dark:divide-border">
            <div className="flex flex-col items-center py-3 gap-0.5">
              <span className="text-amber-600 font-black text-lg">{marketer.totalOrders ?? 0}</span>
              <span className="text-gray-500 text-[10px]">إجمالي الطلبات</span>
            </div>
            <div className="flex flex-col items-center py-3 gap-0.5">
              <span className="text-green-600 font-black text-lg">{Number(marketer.commissionRate ?? 0)}%</span>
              <span className="text-gray-500 text-[10px]">عمولتك</span>
            </div>
            <div className="flex flex-col items-center py-3 gap-0.5">
              <span className="text-blue-600 font-black text-lg">{Number(marketer.discountRate ?? 0)}%</span>
              <span className="text-gray-500 text-[10px]">خصم العملاء</span>
            </div>
          </div>
          {/* محفظة */}
          <div className="bg-gray-50 dark:bg-muted/30 px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">رصيد المحفظة</span>
            <div className="flex items-center gap-1.5">
              <Wallet className="h-4 w-4 text-amber-500" />
              <span className="font-bold text-sm text-gray-800 dark:text-foreground">
                {Number(marketer.walletBalance ?? 0).toLocaleString()} ريال
              </span>
            </div>
          </div>
          {/* رابط لوحة التحكم الكاملة */}
          <Link href="/marketer/dashboard">
            <div
              className="bg-white dark:bg-card px-4 py-3 flex items-center justify-between hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors cursor-pointer border-t border-gray-100 dark:border-border"
              data-testid="link-marketer-dashboard"
            >
              <ChevronLeft className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold text-amber-600">لوحة تحكم المسوق الكاملة</span>
            </div>
          </Link>
        </div>
      )}

      {/* ══ القائمة العامة ════════════════════════════════════════════ */}
      <div className="mt-3 bg-white dark:bg-card mx-3 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-4 py-2 border-b border-gray-100 dark:border-border">
          <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 tracking-widest uppercase">عام</span>
        </div>
        {generalItems.map((item, i) => {
          const Row = (
            <div
              className="flex items-center justify-between px-4 py-3 border-b border-gray-50 dark:border-border/60 last:border-0 hover:bg-gray-50/80 dark:hover:bg-muted/50 cursor-pointer transition-colors"
              data-testid={`menu-general-${i}`}
            >
              <div className="flex items-center gap-2">
                <ChevronLeft className="h-3.5 w-3.5 text-gray-300" />
                {item.badge !== undefined && (
                  <span className="h-5 min-w-5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                    {item.badge}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-sm text-gray-700 dark:text-foreground">{item.label}</span>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${item.color}`}>
                  <item.icon className={`h-4 w-4 ${item.iconColor}`} strokeWidth={1.5} />
                </div>
              </div>
            </div>
          );
          return <Link key={i} href={item.href}>{Row}</Link>;
        })}
      </div>

      {/* ══ الدعم والمساعدة ══════════════════════════════════════════ */}
      <div className="mt-3 bg-white dark:bg-card mx-3 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-4 py-2 border-b border-gray-100 dark:border-border">
          <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 tracking-widest uppercase">المساعدة</span>
        </div>
        {supportItems.map((item, i) => {
          const Row = (
            <div
              className="flex items-center justify-between px-4 py-3 border-b border-gray-50 dark:border-border/60 last:border-0 hover:bg-gray-50/80 dark:hover:bg-muted/50 cursor-pointer transition-colors"
              data-testid={`menu-support-${i}`}
            >
              <div className="flex items-center gap-1.5">
                <ChevronLeft className="h-3.5 w-3.5 text-gray-300" />
                {(item as any).external && <ExternalLink className="h-3 w-3 text-gray-300" />}
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-sm text-gray-700 dark:text-foreground">{item.label}</span>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${item.color}`}>
                  <item.icon className={`h-4 w-4 ${item.iconColor}`} strokeWidth={1.5} />
                </div>
              </div>
            </div>
          );
          if ((item as any).external) {
            return (
              <a key={i} href={item.href!} target="_blank" rel="noopener noreferrer">{Row}</a>
            );
          }
          return item.href ? <Link key={i} href={item.href}>{Row}</Link> : <div key={i}>{Row}</div>;
        })}
      </div>

      {/* ══ تسجيل الخروج / الدخول ════════════════════════════════════ */}
      <div className="mt-3 mx-3">
        {isAuthenticated ? (
          <button
            onClick={() => logout()}
            className="w-full flex items-center justify-between px-4 py-3.5 bg-white dark:bg-card rounded-2xl shadow-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
            data-testid="button-logout"
          >
            <LogOut className="h-5 w-5" />
            <span className="font-semibold text-sm">تسجيل الخروج</span>
          </button>
        ) : (
          <Link href="/auth">
            <div
              className="w-full flex items-center justify-between px-4 py-3.5 bg-white dark:bg-card rounded-2xl shadow-sm cursor-pointer hover:bg-primary/5 dark:hover:bg-muted transition-colors"
              data-testid="button-login"
            >
              <LogIn className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm text-gray-700 dark:text-foreground">تسجيل الدخول / إنشاء حساب</span>
            </div>
          </Link>
        )}
      </div>

      {/* ══ الأقسام الذكية المضغوطة (تحكّم من الأدمن) ═══════════════
          كل قسم = صف قابل للطيّ — مضغوط بدون ضغط على الصفحة
         ══════════════════════════════════════════════════════════════ */}
      {(
        (displaySettings?.showWhyUs === true && displaySettings?.whyUsOnAccount === true) ||
        (displaySettings?.showStats === true && displaySettings?.statsOnAccount === true) ||
        (displaySettings?.showFaq   === true && displaySettings?.faqOnAccount   === true)
      ) && (
        <div className="mt-3 bg-white dark:bg-card mx-3 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-2 border-b border-gray-100 dark:border-border">
            <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 tracking-widest uppercase">أويو بلاست</span>
          </div>

          {/* لماذا أويو بلاست؟ */}
          {displaySettings?.showWhyUs === true && displaySettings?.whyUsOnAccount === true && (
            <CollapsibleSection
              icon={<ShieldCheck className="h-4 w-4 text-blue-600" />}
              label="لماذا تختار أويو بلاست؟"
              color="bg-blue-100 dark:bg-blue-900/30"
              badge="6 مزايا"
              testId="section-toggle-why-us"
            >
              <div className="grid grid-cols-3 gap-2 p-3">
                {whyUsItems.map((f, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5 bg-white dark:bg-card rounded-xl p-2.5 text-center shadow-sm">
                    <div className={`w-7 h-7 rounded-lg ${f.color} text-white flex items-center justify-center`}>
                      {f.icon}
                    </div>
                    <span className="text-[10px] font-semibold text-gray-700 dark:text-foreground leading-tight">{f.label}</span>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* أرقامنا تتحدث */}
          {displaySettings?.showStats === true && displaySettings?.statsOnAccount === true && (
            <CollapsibleSection
              icon={<Users className="h-4 w-4 text-indigo-600" />}
              label="أرقامنا تتحدث"
              color="bg-indigo-100 dark:bg-indigo-900/30"
              badge="4 إحصائيات"
              testId="section-toggle-stats"
            >
              <div className="grid grid-cols-4 gap-1.5 p-3">
                {statsItems.map((s, i) => (
                  <div key={i} className="bg-gradient-to-b from-blue-600 to-blue-700 rounded-xl py-2.5 px-1 flex flex-col items-center gap-0.5">
                    <span className="text-white font-black text-base leading-none">{s.value}</span>
                    <span className="text-blue-100 text-[9px] font-medium">{s.label}</span>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* الأسئلة الشائعة */}
          {displaySettings?.showFaq === true && displaySettings?.faqOnAccount === true && (
            <CollapsibleSection
              icon={<HelpCircle className="h-4 w-4 text-purple-600" />}
              label="الأسئلة الشائعة"
              color="bg-purple-100 dark:bg-purple-900/30"
              badge={`${faqItems.length} أسئلة`}
              testId="section-toggle-faq"
            >
              <div className="divide-y divide-gray-100 dark:divide-border mx-3 mb-3">
                {faqItems.map((item, i) => (
                  <div key={i} data-testid={`faq-item-${i}`}>
                    <button
                      className="w-full flex items-center justify-between py-2.5 text-right"
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      data-testid={`faq-toggle-${i}`}
                    >
                      <div className="text-gray-400">
                        {openFaq === i ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </div>
                      <span className="text-sm font-semibold text-gray-800 dark:text-foreground text-right flex-1 mr-2">{item.q}</span>
                    </button>
                    {openFaq === i && (
                      <p className="text-xs text-muted-foreground leading-relaxed pb-3 pr-2">{item.a}</p>
                    )}
                  </div>
                ))}
                <div className="pt-3 pb-1 flex justify-center">
                  <a
                    href="https://wa.me/967774997589"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 bg-green-500 text-white text-xs font-bold py-2 px-4 rounded-xl"
                    data-testid="btn-whatsapp-faq"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    تواصل عبر واتساب
                  </a>
                </div>
              </div>
            </CollapsibleSection>
          )}
        </div>
      )}

      {/* ══ الإصدار ══════════════════════════════════════════════════ */}
      <div className="flex items-center justify-center gap-2 mt-5 mb-2">
        <span className="text-[11px] text-gray-400 dark:text-gray-600">الإصدار {APP_VERSION}</span>
        <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
        <span className="text-[11px] text-gray-400 dark:text-gray-600">أويو بلاست™</span>
      </div>
    </div>
  );
}
