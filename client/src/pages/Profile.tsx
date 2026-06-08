import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { useOrders } from "@/hooks/use-orders";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useState } from "react";
import {
  Moon, Sun, User, MapPin, Phone, Bell, Settings,
  ChevronLeft, LogIn, LogOut, Truck, Package, MessageSquare,
  RotateCcw, Wallet, Heart, ExternalLink, TrendingUp, Tag,
  Building2, UserPlus, Copy, CheckCheck, CreditCard, Award,
  Calendar, Headphones, Info,
} from "lucide-react";

const APP_VERSION = "1.0.0";
const WHATSAPP_SUPPORT  = "https://wa.me/967774997589";
const WHATSAPP_MARKETER = "https://wa.me/967774997589?text=%D8%A3%D8%B1%D9%8A%D8%AF%20%D8%A7%D9%84%D8%A7%D9%86%D8%B6%D9%85%D8%A7%D9%85%20%D9%83%D9%85%D8%B3%D9%88%D9%82";
const WHATSAPP_SUPPLIER = "https://wa.me/967774997589?text=%D8%A3%D8%B1%D9%8A%D8%AF%20%D8%A7%D9%84%D8%A7%D9%86%D8%B6%D9%85%D8%A7%D9%85%20%D9%83%D9%85%D9%88%D8%B1%D8%AF";

/* ─── بطاقة مالية صغيرة في الشريط ─── */
function FinancialCard({
  href, icon, label, value, accent, testId, external,
}: {
  href: string; icon: React.ReactNode; label: string; value: string;
  accent: string; testId: string; external?: boolean;
}) {
  const inner = (
    <div className="flex flex-col items-center gap-1 py-3 px-1 rounded-2xl bg-white dark:bg-card border border-gray-100 dark:border-border hover:shadow-md active:scale-95 transition-all cursor-pointer">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent}`}>{icon}</div>
      <span className="text-sm font-black leading-tight text-gray-800 dark:text-foreground">{value}</span>
      <span className="text-[10px] text-gray-500 dark:text-muted-foreground">{label}</span>
    </div>
  );
  if (external) {
    return <a href={href} target="_blank" rel="noopener noreferrer" data-testid={testId}>{inner}</a>;
  }
  return <Link href={href} data-testid={testId}>{inner}</Link>;
}

/* ─── أيقونة في شبكة الأدوات ─── */
function ToolIcon({
  href, icon: Icon, label, color, iconColor, badge, external, testId,
}: {
  href: string; icon: any; label: string; color: string; iconColor: string;
  badge?: number; external?: boolean; testId: string;
}) {
  const inner = (
    <button className="relative flex flex-col items-center gap-1.5 w-full py-3 px-1 rounded-2xl bg-white dark:bg-card border border-gray-100 dark:border-border hover:shadow-md active:scale-95 transition-all" data-testid={testId}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className={`h-5 w-5 ${iconColor}`} strokeWidth={1.7} />
      </div>
      <span className="text-[11px] font-semibold text-gray-700 dark:text-foreground leading-tight">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="absolute top-1.5 left-1.5 h-4 min-w-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1">{badge}</span>
      )}
    </button>
  );
  if (external) {
    return <a href={href} target="_blank" rel="noopener noreferrer">{inner}</a>;
  }
  return <Link href={href}>{inner}</Link>;
}

/* ═══════════════════════════════════════════════════════════════
   صفحة "حسابي" — تصميم نظيف مستوحى من Taobao/Rakuten/Shopee
   ═══════════════════════════════════════════════════════════════ */
export default function Profile() {
  const { user, isLoading: isAuthLoading, logout, isAuthenticated } = useAuth();
  const { data: orders } = useOrders();
  const { data: cart } = useCart();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [copiedCoupon, setCopiedCoupon] = useState(false);

  const { data: displaySettings } = useQuery<any>({ queryKey: ["/api/display-settings"], staleTime: 60_000 });
  const { data: walletData }      = useQuery<any>({ queryKey: ["/api/wallet"],            enabled: isAuthenticated, staleTime: 30_000 });
  const { data: pointsData }      = useQuery<any>({ queryKey: ["/api/points"],            enabled: isAuthenticated, staleTime: 30_000 });
  const { data: creditData }      = useQuery<any>({ queryKey: ["/api/my/credit"],         enabled: isAuthenticated, staleTime: 30_000, retry: false });
  const { data: marketerInfo }    = useQuery<any>({ queryKey: ["/api/me/marketer-info"],  enabled: isAuthenticated, staleTime: 60_000 });
  const { data: supplierInfo }    = useQuery<any>({ queryKey: ["/api/me/supplier-info"],  enabled: isAuthenticated, staleTime: 60_000 });
  const { data: wishlistItems = [] } = useQuery<any[]>({ queryKey: ["/api/wishlist"],   enabled: isAuthenticated, staleTime: 60_000 });
  const { data: addressList = [] }   = useQuery<any[]>({ queryKey: ["/api/addresses"], enabled: isAuthenticated, staleTime: 60_000 });

  const marketer       = marketerInfo?.isMarketer ? marketerInfo.marketer : null;
  const supplier       = supplierInfo?.isSupplier  ? supplierInfo.supplier  : null;
  const wishlistCount  = (wishlistItems as any[]).length;
  const defaultAddr    = (addressList as any[])[0];
  const cartCount      = (cart as any[])?.reduce((a, i) => a + (i.quantity || 0), 0) || 0;
  const totalOrders    = (orders as any[])?.length || 0;
  const loyaltyPoints  = pointsData?.points ?? 0;
  const walletBalance  = parseFloat(walletData?.balanceYer || "0");

  const userName = isAuthenticated
    ? (user?.firstName && user?.lastName
        ? `${user.firstName} ${user.lastName}`
        : (user as any)?.fullName || user?.firstName || user?.email?.split("@")[0] || "مستخدم")
    : "زائر";

  const userPhone   = (user as any)?.phone || defaultAddr?.phone;
  const userCity    = (user as any)?.city || defaultAddr?.city;
  const userDistrict= (user as any)?.district || defaultAddr?.district;
  const memberSince = (user as any)?.createdAt;

  // الفئة الائتمانية
  const tierName  = creditData?.tier_name_ar || "برونزي";
  const tierIcon  = creditData?.tier_icon || "🥉";
  const tierColor = creditData?.tier_color || "#cd7f32";
  const creditAvailable = Number(creditData?.available_credit ?? 0);
  const creditLimit     = Number(creditData?.effective_credit_limit ?? 0);

  // حالات الطلب
  const pendingOrders    = (orders as any[])?.filter(o => o.status === "pending").length    || 0;
  const processingOrders = (orders as any[])?.filter(o => o.status === "processing").length || 0;
  const shippedOrders    = (orders as any[])?.filter(o => o.status === "shipped").length    || 0;
  const reviewOrders     = (orders as any[])?.filter(o => o.status === "review").length     || 0;
  const returnedOrders   = (orders as any[])?.filter(o => ["returned","cancelled"].includes(o.status)).length || 0;

  const orderStatuses = [
    { icon: CreditCard,    label: "غير مدفوع", count: pendingOrders,    href: "/orders" },
    { icon: Package,       label: "تجهيز",      count: processingOrders, href: "/orders" },
    { icon: Truck,         label: "شحن",        count: shippedOrders,    href: "/orders" },
    { icon: MessageSquare, label: "تعليق",      count: reviewOrders,     href: "/orders" },
    { icon: RotateCcw,     label: "مسترجع",     count: returnedOrders,   href: "/orders" },
  ];

  // إعدادات قسم الشركاء
  const partnersEnabled    = displaySettings?.partnersOnAccount !== false; // افتراضياً مفعّل
  const partnersMinOrders  = Number(displaySettings?.partnersMinOrders ?? 3);
  const showPartners       = partnersEnabled && totalOrders >= partnersMinOrders;

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

  const formatMemberSince = (date: any) => {
    if (!date) return null;
    try {
      const d = new Date(date);
      const months = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
      return `${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch { return null; }
  };

  const formatNum = (n: number) => {
    if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}م`;
    if (n >= 1000) return `${(n/1000).toFixed(n >= 10_000 ? 0 : 1)}ك`;
    return n.toLocaleString("ar-YE");
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f2f7] dark:bg-background pb-24" dir="rtl">

      {/* ═══════════════════════ ١. بطاقة الهوية ═══════════════════════ */}
      <div className="bg-gradient-to-bl from-[#1a3a4a] to-[#0d2535] dark:from-[#0f2230] dark:to-[#070f17] pt-4 pb-5 px-5 relative">
        <button
          onClick={toggleDark}
          className="absolute top-4 left-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
          data-testid="button-dark-mode"
        >
          {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <div className="flex items-center justify-end gap-3">
          <div className="text-right flex-1 min-w-0">
            {/* الاسم + شارة الفئة */}
            <div className="flex items-center justify-end gap-2 mb-1.5 flex-wrap">
              {isAuthenticated && creditData && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full"
                  style={{ background: `${tierColor}30`, color: "#fff", border: `1px solid ${tierColor}80` }}
                  data-testid="badge-credit-tier"
                >
                  <span>{tierIcon}</span>
                  <span>فئة {tierName}</span>
                </span>
              )}
              <h2 className="text-white font-black text-xl leading-tight truncate" data-testid="text-username">
                {userName}
              </h2>
            </div>

            {/* هاتف */}
            {isAuthenticated && userPhone && (
              <p className="text-white/60 text-xs flex items-center justify-end gap-1.5" data-testid="text-phone">
                <span>{userPhone}</span>
                <Phone className="h-3.5 w-3.5 text-white/40" />
              </p>
            )}
            {/* مدينة + حي */}
            {isAuthenticated && (userCity || userDistrict) && (
              <p className="text-white/55 text-xs mt-0.5 flex items-center justify-end gap-1.5" data-testid="text-location">
                <span>{[userCity, userDistrict].filter(Boolean).join(" · ")}</span>
                <MapPin className="h-3.5 w-3.5 text-white/40" />
              </p>
            )}
            {/* تاريخ العضوية */}
            {isAuthenticated && memberSince && (
              <p className="text-white/45 text-[11px] mt-0.5 flex items-center justify-end gap-1.5" data-testid="text-member-since">
                <span>عضو منذ {formatMemberSince(memberSince)}</span>
                <Calendar className="h-3 w-3 text-white/35" />
              </p>
            )}
            {!isAuthenticated && (
              <p className="text-white/45 text-xs mt-1">
                <Link href="/auth">
                  <span className="text-primary/90 underline underline-offset-2" data-testid="link-login-prompt">سجّل دخولك الآن</span>
                </Link>
              </p>
            )}
          </div>

          {/* الصورة الرمزية */}
          <div className="w-16 h-16 rounded-full border-2 border-white/25 overflow-hidden bg-white/15 flex items-center justify-center flex-shrink-0">
            {isAuthenticated && (user as any)?.profileImageUrl ? (
              <img src={(user as any).profileImageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="h-9 w-9 text-white/70" strokeWidth={1.5} />
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════ ٢. شريط البطاقات المالية ═══════════════════════ */}
      {isAuthenticated && (
        <div className="mx-3 mt-3 grid grid-cols-4 gap-2" data-testid="financial-strip">
          <FinancialCard
            href="/wallet"
            icon={<Wallet className="h-5 w-5 text-white" />}
            label="محفظتي"
            value={formatNum(walletBalance)}
            accent="bg-gradient-to-br from-green-500 to-emerald-600"
            testId="card-wallet"
          />
          <FinancialCard
            href="/loyalty"
            icon={<Award className="h-5 w-5 text-white" />}
            label="نقاطي"
            value={formatNum(loyaltyPoints)}
            accent="bg-gradient-to-br from-yellow-500 to-amber-600"
            testId="card-points"
          />
          <FinancialCard
            href="/credit"
            icon={<CreditCard className="h-5 w-5 text-white" />}
            label="ائتمان"
            value={creditLimit > 0 ? formatNum(creditAvailable) : "—"}
            accent="bg-gradient-to-br from-orange-500 to-red-500"
            testId="card-credit"
          />
          <FinancialCard
            href="/wishlist"
            icon={<Heart className="h-5 w-5 text-white" />}
            label="المفضلة"
            value={formatNum(wishlistCount)}
            accent="bg-gradient-to-br from-pink-500 to-rose-600"
            testId="card-wishlist"
          />
        </div>
      )}

      {/* ═══════════════════════ ٣. شريط حالات الطلب ═══════════════════════ */}
      {isAuthenticated && (
        <div className="mx-3 mt-2 bg-white dark:bg-card rounded-2xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-border">
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
        </div>
      )}

      {/* ═══════════════════════ ٤. شبكة الأدوات (٣×٢) ═══════════════════════ */}
      <div className="mx-3 mt-2 bg-white dark:bg-card rounded-2xl overflow-hidden shadow-sm p-3" data-testid="tools-grid">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 tracking-widest uppercase">أدواتي</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <ToolIcon
            href="/addresses"
            icon={MapPin}
            label="العناوين"
            color="bg-orange-100 dark:bg-orange-900/30"
            iconColor="text-orange-600"
            testId="tool-addresses"
          />
          <ToolIcon
            href="/orders"
            icon={Package}
            label="طلباتي"
            color="bg-blue-100 dark:bg-blue-900/30"
            iconColor="text-blue-600"
            testId="tool-orders"
          />
          <ToolIcon
            href="/notifications"
            icon={Bell}
            label="الإشعارات"
            color="bg-yellow-100 dark:bg-yellow-900/30"
            iconColor="text-yellow-600"
            testId="tool-notifications"
          />
          <ToolIcon
            href={WHATSAPP_SUPPORT}
            icon={Headphones}
            label="دعم واتساب"
            color="bg-green-100 dark:bg-green-900/30"
            iconColor="text-green-600"
            external
            testId="tool-support"
          />
          <ToolIcon
            href="/settings"
            icon={Settings}
            label="الإعدادات"
            color="bg-gray-100 dark:bg-gray-800"
            iconColor="text-gray-500"
            testId="tool-settings"
          />
          <ToolIcon
            href="/about"
            icon={Info}
            label="معلومات"
            color="bg-indigo-100 dark:bg-indigo-900/30"
            iconColor="text-indigo-600"
            testId="tool-about"
          />
        </div>
      </div>

      {/* ═══════════════════════ ٥. لوحة المسوّق (شرطية) ═══════════════════════ */}
      {isAuthenticated && marketer && (
        <div className="mx-3 mt-2 bg-white dark:bg-card rounded-2xl overflow-hidden shadow-sm" data-testid="marketer-panel">
          <div className="bg-gradient-to-bl from-amber-500 to-orange-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-white/20 rounded-full p-1.5">
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-white/70 text-[10px]">رمز الكوبون</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-white font-black text-base tracking-widest" data-testid="text-coupon-code">{marketer.couponCode}</span>
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
              <p className="text-white font-bold text-sm">لوحة المسوّق</p>
              <p className="text-white/70 text-[10px]">{marketer.name}</p>
            </div>
          </div>

          <div className="grid grid-cols-4 divide-x divide-x-reverse divide-gray-100 dark:divide-border">
            {[
              { v: marketer.totalOrders ?? 0,                                  l: "الطلبات",     c: "text-amber-600" },
              { v: `${Number(marketer.commissionRate ?? 0)}%`,                  l: "عمولتك",      c: "text-green-600" },
              { v: `${Number(marketer.discountRate ?? 0)}%`,                    l: "خصم العملاء", c: "text-blue-600" },
              { v: `${Number(marketer.walletBalance ?? 0).toLocaleString()} ﷼`, l: "الرصيد",      c: "text-purple-600" },
            ].map((s, i) => (
              <div key={i} className="flex flex-col items-center py-2.5 gap-0.5">
                <span className={`font-black text-base leading-none ${s.c}`}>{s.v}</span>
                <span className="text-gray-400 text-[9px]">{s.l}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 p-3 border-t border-gray-100 dark:border-border">
            {[
              { icon: TrendingUp, label: "لوحة التحكم",  href: "/marketer/dashboard", color: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",   iconColor: "text-amber-600" },
              { icon: Package,    label: "طلباتي كمسوق", href: "/marketer/orders",    color: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",       iconColor: "text-blue-600" },
              { icon: Tag,        label: "كوبوناتي",      href: "/marketer/coupons",   color: "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800", iconColor: "text-purple-600" },
              { icon: Wallet,     label: "محفظتي",        href: "/marketer/wallet",    color: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800",   iconColor: "text-green-600" },
            ].map((btn, i) => (
              <Link key={i} href={btn.href}>
                <button
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border ${btn.color} hover:opacity-80 transition-opacity`}
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

      {/* ═══════════════════════ ٦. قسم الشركاء (شرطي: ٣+ طلبات) ═══════════════════════ */}
      {isAuthenticated && showPartners && (
        <div className="mx-3 mt-2 bg-white dark:bg-card rounded-2xl overflow-hidden shadow-sm" data-testid="partners-section">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-border flex items-center justify-between">
            <Building2 className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-bold text-gray-700 dark:text-foreground">شركاؤنا في النمو</span>
          </div>

          {/* لوحة المورد المعتمد */}
          {supplier && (
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
              <a href="/supplier" className="flex items-center justify-between px-4 py-3 hover:bg-teal-50 dark:hover:bg-teal-950/20 transition-colors" data-testid="link-supplier-portal">
                <ChevronLeft className="h-4 w-4 text-teal-500" />
                <span className="text-sm font-semibold text-teal-600">بوابة المورد</span>
              </a>
            </div>
          )}

          {/* دعوة الانضمام */}
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
      )}

      {/* ═══════════════════════ ٧. تسجيل الخروج / الدخول ═══════════════════════ */}
      <div className="mx-3 mt-3 bg-white dark:bg-card rounded-2xl overflow-hidden shadow-sm">
        {isAuthenticated ? (
          <button
            onClick={() => logout()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
            <span className="font-semibold text-sm">تسجيل الخروج</span>
          </button>
        ) : (
          <Link href="/auth">
            <div className="w-full flex items-center justify-center gap-2 px-4 py-3.5 cursor-pointer hover:bg-primary/5 dark:hover:bg-muted transition-colors" data-testid="button-login">
              <LogIn className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm text-gray-700 dark:text-foreground">تسجيل الدخول / إنشاء حساب</span>
            </div>
          </Link>
        )}
      </div>

      {/* ═══════════════════════ الإصدار ═══════════════════════ */}
      <div className="flex items-center justify-center gap-2 mt-4 mb-2">
        <span className="text-[11px] text-gray-400 dark:text-gray-600">الإصدار {APP_VERSION}</span>
        <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
        <span className="text-[11px] text-gray-400 dark:text-gray-600">أويو بلاست™</span>
      </div>
    </div>
  );
}
