import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { useOrders } from "@/hooks/use-orders";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useState } from "react";
import {
  Moon, Sun, User, MapPin, Ticket, LayoutGrid, Bell, Settings,
  Phone, MessageSquare, HelpCircle, FileText, Heart, ShoppingCart,
  ChevronLeft, ChevronDown, ChevronUp, LogIn, LogOut,
  Truck, Package, CreditCard, RotateCcw, Star,
  BadgeDollarSign, ShieldCheck, Award, Headphones, Users,
  ExternalLink, TrendingUp, Wallet, Copy, CheckCheck,
  Building2, UserPlus, Tag,
} from "lucide-react";

const APP_VERSION = "1.0.0";
const WHATSAPP_MARKETER = "https://wa.me/967774997589?text=%D8%A3%D8%B1%D9%8A%D8%AF%20%D8%A7%D9%84%D8%A7%D9%86%D8%B6%D9%85%D8%A7%D9%85%20%D9%83%D9%85%D8%B3%D9%88%D9%82";
const WHATSAPP_SUPPLIER  = "https://wa.me/967774997589?text=%D8%A3%D8%B1%D9%8A%D8%AF%20%D8%A7%D9%84%D8%A7%D9%86%D8%B6%D9%85%D8%A7%D9%85%20%D9%83%D9%85%D9%88%D8%B1%D8%AF";

/* ── قسم قابل للطيّ ── */
function CollapsibleSection({
  icon, label, color, badge, children, testId,
}: {
  icon: React.ReactNode; label: string; color: string;
  badge?: string; children: React.ReactNode; testId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3.5 border-b border-gray-50 dark:border-border hover:bg-gray-50 dark:hover:bg-muted/50 transition-colors"
        onClick={() => setOpen(v => !v)}
        data-testid={testId}
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronUp className="h-4 w-4 text-gray-300" /> : <ChevronDown className="h-4 w-4 text-gray-300" />}
          {badge && <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">{badge}</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-700 dark:text-foreground">{label}</span>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>{icon}</div>
        </div>
      </button>
      {open && <div className="bg-gray-50/80 dark:bg-muted/30 border-b border-gray-100 dark:border-border">{children}</div>}
    </div>
  );
}

/* ── بطاقة إحصائية في الهيدر ── */
function StatChip({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 flex-1">
      <div className="text-white/80 mb-0.5">{icon}</div>
      <span className="text-white font-black text-lg leading-none">{value}</span>
      <span className="text-white/60 text-[10px] font-medium">{label}</span>
    </div>
  );
}

/* ── صف قائمة عادي ── */
function MenuRow({ icon: Icon, label, color, iconColor, badge, external }: {
  icon: any; label: string; color: string; iconColor: string; badge?: number; external?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 dark:border-border/60 last:border-0 hover:bg-gray-50/80 dark:hover:bg-muted/50 cursor-pointer transition-colors">
      <div className="flex items-center gap-2">
        <ChevronLeft className="h-3.5 w-3.5 text-gray-300" />
        {external && <ExternalLink className="h-3 w-3 text-gray-300" />}
        {badge !== undefined && badge > 0 && (
          <span className="h-5 min-w-5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">{badge}</span>
        )}
      </div>
      <div className="flex items-center gap-2.5">
        <span className="text-sm text-gray-700 dark:text-foreground">{label}</span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} strokeWidth={1.5} />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   الصفحة الرئيسية
   ═══════════════════════════════════════════════════════════════ */
export default function Profile() {
  const { user, isLoading: isAuthLoading, logout, isAuthenticated } = useAuth();
  const { data: orders } = useOrders();
  const { data: cart } = useCart();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [copiedCoupon, setCopiedCoupon] = useState(false);

  const { data: displaySettings } = useQuery<any>({ queryKey: ["/api/display-settings"], staleTime: 60_000 });
  const { data: pointsData }       = useQuery<any>({ queryKey: ["/api/points"],           enabled: isAuthenticated, staleTime: 60_000 });
  const { data: marketerInfo }     = useQuery<any>({ queryKey: ["/api/me/marketer-info"], enabled: isAuthenticated, staleTime: 60_000 });
  const { data: supplierInfo }     = useQuery<any>({ queryKey: ["/api/me/supplier-info"], enabled: isAuthenticated, staleTime: 60_000 });
  const { data: wishlistItems = [] } = useQuery<any[]>({ queryKey: ["/api/wishlist"],    enabled: isAuthenticated, staleTime: 60_000 });
  const { data: addressList = [] }   = useQuery<any[]>({ queryKey: ["/api/addresses"],  enabled: isAuthenticated, staleTime: 60_000 });

  const marketer      = marketerInfo?.isMarketer ? marketerInfo.marketer : null;
  const supplier      = supplierInfo?.isSupplier  ? supplierInfo.supplier  : null;
  const wishlistCount = (wishlistItems as any[]).length;
  const defaultAddr   = (addressList as any[])[0];
  const cartCount     = (cart as any[])?.reduce((a, i) => a + (i.quantity || 0), 0) || 0;
  const totalOrders   = (orders as any[])?.length || 0;
  const loyaltyPoints = pointsData?.points ?? 0;

  const pendingOrders    = (orders as any[])?.filter(o => o.status === "pending").length    || 0;
  const processingOrders = (orders as any[])?.filter(o => o.status === "processing").length || 0;
  const shippedOrders    = (orders as any[])?.filter(o => o.status === "shipped").length    || 0;
  const reviewOrders     = (orders as any[])?.filter(o => o.status === "review").length     || 0;
  const returnedOrders   = (orders as any[])?.filter(o => ["returned","cancelled"].includes(o.status)).length || 0;

  const userName = isAuthenticated
    ? (user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.firstName || user?.email?.split("@")[0] || "مستخدم")
    : "زائر";

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const copyCoupon = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopiedCoupon(true);
    setTimeout(() => setCopiedCoupon(false), 2000);
  };

  const orderStatuses = [
    { icon: CreditCard,    label: "غير مدفوع",   count: pendingOrders,    href: "/orders" },
    { icon: Package,       label: "تجهيز",        count: processingOrders, href: "/orders" },
    { icon: Truck,         label: "شحن",          count: shippedOrders,    href: "/orders" },
    { icon: MessageSquare, label: "تعليق",        count: reviewOrders,     href: "/orders" },
    { icon: RotateCcw,     label: "مسترجع",       count: returnedOrders,   href: "/orders" },
  ];

  const generalItems = [
    { icon: Truck,        label: "تتبع الطلب",   href: "/orders",           color: "bg-green-100 dark:bg-green-900/30",   iconColor: "text-green-600" },
    { icon: MapPin,       label: "العناوين",      href: "/account",          color: "bg-orange-100 dark:bg-orange-900/30", iconColor: "text-orange-500" },
    { icon: Ticket,       label: "الكوبونات",     href: "/marketer/coupons", color: "bg-purple-100 dark:bg-purple-900/30", iconColor: "text-purple-500" },
    { icon: LayoutGrid,   label: "الفئات",        href: "/products",         color: "bg-blue-100 dark:bg-blue-900/30",     iconColor: "text-blue-500" },
    { icon: Heart,        label: "المفضلة",       href: "/wishlist",         color: "bg-red-100 dark:bg-red-900/30",       iconColor: "text-red-500" },
    { icon: ShoppingCart, label: "السلة",         href: "/cart",             color: "bg-teal-100 dark:bg-teal-900/30",     iconColor: "text-teal-500", badge: cartCount },
    { icon: Bell,         label: "الإشعارات",     href: "/notifications",    color: "bg-yellow-100 dark:bg-yellow-900/30", iconColor: "text-yellow-600" },
    { icon: Settings,     label: "الإعدادات",     href: "/account",          color: "bg-gray-100 dark:bg-gray-800",        iconColor: "text-gray-500" },
  ];

  const supportItems = [
    { icon: Phone,         label: "تواصل معنا",      href: "/about",                      color: "bg-green-100 dark:bg-green-900/30",  iconColor: "text-green-600" },
    { icon: MessageSquare, label: "دعم واتساب",      href: "https://wa.me/967774997589",  color: "bg-green-50 dark:bg-green-900/20",   iconColor: "text-green-500", external: true },
    { icon: FileText,      label: "سياسة الخصوصية", href: "/privacy",                    color: "bg-gray-100 dark:bg-gray-800",       iconColor: "text-gray-500" },
    { icon: FileText,      label: "شروط الاستخدام", href: "/terms",                      color: "bg-gray-100 dark:bg-gray-800",       iconColor: "text-gray-400" },
  ];

  const whyUsItems = [
    { icon: <BadgeDollarSign className="h-4 w-4" />, label: "أسعار الجملة",    color: "bg-green-500" },
    { icon: <ShieldCheck className="h-4 w-4" />,    label: "جودة مضمونة",     color: "bg-blue-500" },
    { icon: <Truck className="h-4 w-4" />,          label: "توصيل لكل اليمن", color: "bg-orange-500" },
    { icon: <Package className="h-4 w-4" />,        label: "+500 منتج",        color: "bg-purple-500" },
    { icon: <Headphones className="h-4 w-4" />,     label: "دعم واتساب",      color: "bg-teal-500" },
    { icon: <Award className="h-4 w-4" />,          label: "نقاط الولاء",     color: "bg-yellow-500" },
  ];

  const statsItems = [
    { value: "+500", label: "منتج" },
    { value: "+20",  label: "مورد" },
    { value: "+18",  label: "محافظة" },
    { value: "+1000",label: "عميل" },
  ];

  const faqItems = [
    { q: "كيف أطلب من أويو بلاست؟",             a: "سجّل حساباً، تصفّح المنتجات، أضف للسلة، ثم أكمل الطلب. سيتواصل معك فريقنا لتأكيد الطلب." },
    { q: "هل تبيعون بالجملة للتجار؟",            a: "نعم، نتخصص في بيع الجملة. كلما زادت الكمية انخفض السعر." },
    { q: "هل يمكن الطباعة على المنتجات؟",         a: "نعم، كثير من منتجاتنا تدعم الطباعة المخصصة بشعارك." },
    { q: "كيف يتم الدفع؟",                        a: "الدفع نقداً عند الاستلام أو بالتحويل البنكي. نظام التقسيط متاح للطلبات الكبيرة." },
    { q: "كيف أتواصل مع خدمة العملاء؟",          a: "عبر واتساب مباشرةً أو من خلال قسم الطلبات في حسابك." },
  ];

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f2f7] dark:bg-background pb-24" dir="rtl">

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-bl from-[#1a3a4a] to-[#0d2535] dark:from-[#0f2230] dark:to-[#070f17] pt-10 pb-5 px-5 relative">
        <button
          onClick={toggleDark}
          className="absolute top-4 left-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
          data-testid="button-dark-mode"
        >
          {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        {/* بيانات المستخدم */}
        <div className="flex items-center justify-end gap-3 mb-4">
          <div className="text-right">
            <h2 className="text-white font-black text-xl leading-tight">{userName}</h2>

            {/* هاتف */}
            {isAuthenticated && defaultAddr?.phone && (
              <p className="text-white/55 text-xs mt-1 flex items-center justify-end gap-1.5">
                <Phone className="h-3.5 w-3.5 text-white/40" />
                {defaultAddr.phone}
              </p>
            )}
            {/* مدينة + حي */}
            {isAuthenticated && (defaultAddr?.city || defaultAddr?.district) && (
              <p className="text-white/50 text-xs mt-0.5 flex items-center justify-end gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-white/40" />
                {[defaultAddr.city, defaultAddr.district].filter(Boolean).join(" · ")}
              </p>
            )}
            {/* البريد الإلكتروني للزوار غير المسجلين */}
            {isAuthenticated && !defaultAddr?.city && user?.email && (
              <p className="text-white/40 text-xs mt-0.5">{user.email}</p>
            )}
            {!isAuthenticated && (
              <p className="text-white/45 text-xs mt-1">
                <Link href="/auth">
                  <span className="text-primary/90 underline underline-offset-2">سجّل دخولك الآن</span>
                </Link>
              </p>
            )}
          </div>
          <div className="w-14 h-14 rounded-full border-2 border-white/25 overflow-hidden bg-white/15 flex items-center justify-center flex-shrink-0">
            {isAuthenticated && (user as any)?.profileImageUrl ? (
              <img src={(user as any).profileImageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="h-8 w-8 text-white/70" strokeWidth={1.5} />
            )}
          </div>
        </div>

        {/* شريط الإحصائيات */}
        {isAuthenticated && (
          <div className="flex items-center divide-x divide-x-reverse divide-white/15 bg-white/8 rounded-2xl px-2 py-2.5">
            <StatChip icon={<Package className="h-4 w-4" />} value={String(totalOrders)}   label="طلباتي" />
            <StatChip icon={<Star className="h-4 w-4" />}   value={String(loyaltyPoints)} label="نقاطي" />
            <StatChip icon={<Heart className="h-4 w-4" />}  value={String(wishlistCount)} label="المفضلة" />
          </div>
        )}
      </div>

      {/* ══ البطاقة الرئيسية الموحّدة ══════════════════════════════════════ */}
      <div className="mx-3 mt-2 bg-white dark:bg-card rounded-2xl overflow-hidden shadow-sm">

        {/* طلباتي */}
        {isAuthenticated && (
          <>
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-border">
              <Link href="/orders">
                <span className="text-xs text-primary flex items-center gap-0.5" data-testid="link-all-orders">
                  كل الطلبات <ChevronLeft className="h-3 w-3" />
                </span>
              </Link>
              <span className="text-sm font-bold text-gray-800 dark:text-foreground">طلباتي</span>
            </div>
            <div className="grid grid-cols-5 gap-0 px-1 py-2 border-b border-gray-100 dark:border-border">
              {orderStatuses.map((s, i) => (
                <Link key={i} href={s.href}>
                  <button className="flex flex-col items-center gap-1 w-full py-2 px-1 rounded-xl hover:bg-gray-50 dark:hover:bg-muted transition-colors relative" data-testid={`order-status-${i}`}>
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
          </>
        )}

        {/* القائمة العامة */}
        <div className="px-4 py-2 border-b border-gray-100 dark:border-border">
          <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 tracking-widest uppercase">عام</span>
        </div>
        {generalItems.map((item, i) => {
          const row = <MenuRow key={i} icon={item.icon} label={item.label} color={item.color} iconColor={item.iconColor} badge={item.badge} />;
          return <Link key={i} href={item.href}>{row}</Link>;
        })}

        {/* الدعم والمساعدة */}
        <div className="px-4 py-2 border-t border-b border-gray-100 dark:border-border">
          <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 tracking-widest uppercase">المساعدة</span>
        </div>
        {supportItems.map((item, i) => {
          const row = <MenuRow key={i} icon={item.icon} label={item.label} color={item.color} iconColor={item.iconColor} external={(item as any).external} />;
          if ((item as any).external) return <a key={i} href={item.href!} target="_blank" rel="noopener noreferrer">{row}</a>;
          return item.href ? <Link key={i} href={item.href}>{row}</Link> : <div key={i}>{row}</div>;
        })}

        {/* تسجيل الخروج / الدخول */}
        <div className="border-t border-gray-100 dark:border-border">
          {isAuthenticated ? (
            <button
              onClick={() => logout()}
              className="w-full flex items-center justify-between px-4 py-3.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
              data-testid="button-logout"
            >
              <LogOut className="h-5 w-5" />
              <span className="font-semibold text-sm">تسجيل الخروج</span>
            </button>
          ) : (
            <Link href="/auth">
              <div className="w-full flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-primary/5 dark:hover:bg-muted transition-colors" data-testid="button-login">
                <LogIn className="h-5 w-5 text-primary" />
                <span className="font-semibold text-sm text-gray-700 dark:text-foreground">تسجيل الدخول / إنشاء حساب</span>
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* ══ لوحة المسوق (مشروطة) ══════════════════════════════════════════ */}
      {isAuthenticated && marketer && (
        <div className="mx-3 mt-[2px] bg-white dark:bg-card rounded-2xl overflow-hidden shadow-sm" data-testid="marketer-panel">
          {/* هيدر ذهبي */}
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
                    {copiedCoupon ? <CheckCheck className="h-3 w-3 text-white" /> : <Copy className="h-3 w-3 text-white" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-white font-bold text-sm">لوحة المسوق</p>
              <p className="text-white/70 text-[10px]">{marketer.name}</p>
            </div>
          </div>

          {/* إحصائيات */}
          <div className="grid grid-cols-4 divide-x divide-x-reverse divide-gray-100 dark:divide-border">
            {[
              { v: marketer.totalOrders ?? 0,                          l: "الطلبات",   c: "text-amber-600" },
              { v: `${Number(marketer.commissionRate ?? 0)}%`,          l: "عمولتك",   c: "text-green-600" },
              { v: `${Number(marketer.discountRate ?? 0)}%`,            l: "خصم العملاء", c: "text-blue-600" },
              { v: `${Number(marketer.walletBalance ?? 0).toLocaleString()} ﷼`, l: "الرصيد", c: "text-purple-600" },
            ].map((s, i) => (
              <div key={i} className="flex flex-col items-center py-2.5 gap-0.5">
                <span className={`font-black text-base leading-none ${s.c}`}>{s.v}</span>
                <span className="text-gray-400 text-[9px]">{s.l}</span>
              </div>
            ))}
          </div>

          {/* 4 أزرار كبيرة */}
          <div className="grid grid-cols-2 gap-2 p-3 border-t border-gray-100 dark:border-border">
            {[
              { icon: TrendingUp,  label: "لوحة التحكم",    href: "/marketer/dashboard", color: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800", iconColor: "text-amber-600" },
              { icon: Package,     label: "طلباتي كمسوق",   href: "/marketer/orders",    color: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",    iconColor: "text-blue-600" },
              { icon: Tag,         label: "كوبوناتي",        href: "/marketer/coupons",   color: "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800", iconColor: "text-purple-600" },
              { icon: Wallet,      label: "محفظتي",          href: "/marketer/wallet",    color: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800", iconColor: "text-green-600" },
            ].map((btn, i) => (
              <Link key={i} href={btn.href}>
                <button
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border ${btn.color} hover:opacity-80 transition-opacity`}
                  data-testid={`btn-marketer-${i}`}
                >
                  <btn.icon className={`h-5 w-5 flex-shrink-0 ${btn.iconColor}`} />
                  <span className="font-semibold text-sm text-gray-700 dark:text-foreground">{btn.label}</span>
                </button>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ══ قسم الشركاء (ثابت للجميع) ═══════════════════════════════════ */}
      <div className="mx-3 mt-[2px] bg-white dark:bg-card rounded-2xl overflow-hidden shadow-sm" data-testid="partners-section">
        {/* هيدر القسم */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-border flex items-center justify-between">
          <Building2 className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-bold text-gray-700 dark:text-foreground">شركاؤنا في النمو</span>
        </div>

        {/* لوحة المورد المعتمد */}
        {isAuthenticated && supplier && (
          <div className="border-b border-gray-100 dark:border-border">
            <div className="bg-gradient-to-bl from-cyan-600 to-teal-700 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-white/70 text-[10px]">مورد معتمد</p>
                <p className="text-white font-bold text-sm">{supplier.name}</p>
              </div>
              <div className="bg-white/20 rounded-full p-1.5">
                <Building2 className="h-4 w-4 text-white" />
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-x-reverse divide-gray-100 dark:divide-border">
              {[
                { v: `${Number(supplier.balanceDue ?? 0).toLocaleString()} ﷼`, l: "مستحق لك",    c: "text-teal-600" },
                { v: `${Number(supplier.totalSales ?? 0).toLocaleString()} ﷼`, l: "إجمالي المبيعات", c: "text-blue-600" },
                { v: String(supplier.totalOrders ?? 0),                         l: "الطلبات",      c: "text-gray-700" },
              ].map((s, i) => (
                <div key={i} className="flex flex-col items-center py-3 gap-0.5">
                  <span className={`font-black text-base leading-none ${s.c} dark:text-foreground`}>{s.v}</span>
                  <span className="text-gray-400 text-[9px]">{s.l}</span>
                </div>
              ))}
            </div>
            <a href="/supplier" className="flex items-center justify-between px-4 py-3 hover:bg-teal-50 dark:hover:bg-teal-950/20 transition-colors border-t border-gray-100 dark:border-border" data-testid="link-supplier-portal">
              <ChevronLeft className="h-4 w-4 text-teal-500" />
              <span className="text-sm font-semibold text-teal-600">بوابة المورد</span>
            </a>
          </div>
        )}

        {/* دعوة الانضمام — دائمة الظهور للجميع */}
        <div className="px-4 py-3">
          <p className="text-xs text-gray-400 text-right mb-3">انضم إلى شبكة شركائنا وابدأ الكسب معنا</p>
          <div className="grid grid-cols-2 gap-2">
            <a
              href={WHATSAPP_MARKETER}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 transition-colors"
              data-testid="btn-join-marketer"
            >
              <UserPlus className="h-4 w-4 text-white" />
              <span className="text-white font-bold text-sm">انضم كمسوق</span>
            </a>
            <a
              href={WHATSAPP_SUPPLIER}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 transition-colors"
              data-testid="btn-join-supplier"
            >
              <Building2 className="h-4 w-4 text-white" />
              <span className="text-white font-bold text-sm">انضم كمورد</span>
            </a>
          </div>
        </div>
      </div>

      {/* ══ الأقسام الذكية (تحكّم من الأدمن) ═══════════════════════════ */}
      {(
        (displaySettings?.showWhyUs === true && displaySettings?.whyUsOnAccount === true) ||
        (displaySettings?.showStats === true && displaySettings?.statsOnAccount === true) ||
        (displaySettings?.showFaq   === true && displaySettings?.faqOnAccount   === true)
      ) && (
        <div className="mx-3 mt-[2px] bg-white dark:bg-card rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-2 border-b border-gray-100 dark:border-border">
            <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 tracking-widest uppercase">أويو بلاست</span>
          </div>

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
                    <div className={`w-7 h-7 rounded-lg ${f.color} text-white flex items-center justify-center`}>{f.icon}</div>
                    <span className="text-[10px] font-semibold text-gray-700 dark:text-foreground leading-tight">{f.label}</span>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

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
                    {openFaq === i && <p className="text-xs text-muted-foreground leading-relaxed pb-3 pr-2">{item.a}</p>}
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

      {/* ══ الإصدار ══════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-center gap-2 mt-5 mb-2">
        <span className="text-[11px] text-gray-400 dark:text-gray-600">الإصدار {APP_VERSION}</span>
        <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
        <span className="text-[11px] text-gray-400 dark:text-gray-600">أويو بلاست™</span>
      </div>
    </div>
  );
}
