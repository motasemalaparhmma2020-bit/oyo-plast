import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  ShoppingBag, Wallet, Award, ChevronRight, Package, Clock,
  CheckCircle2, Truck, RefreshCcw, LogIn, UserPlus, Bell, Heart,
  MapPin, Settings as SettingsIcon, MessageCircle, Handshake,
  CreditCard, User, Ticket, ShieldCheck, HelpCircle, LogOut, ExternalLink, AlertTriangle,
} from "lucide-react";
import type { Order } from "@shared/schema";
import oyoLogo from "@assets/FB_IMG_1748731871206_1766877101101.jpg";

function goBackSafe(setLocation: (p: string) => void) {
  try {
    const last = sessionStorage.getItem("lastSafePath");
    if (last && last !== "/account") return setLocation(last);
  } catch {}
  setLocation("/");
}

export default function MyAccount() {
  const { isAuthenticated, user, logout, isLoggingOut } = useAuth();
  const [, setLocation] = useLocation();

  const { data: marketerAccount } = useQuery<any>({
    queryKey: ["/api/marketer/linked-account"],
    enabled: isAuthenticated,
    retry: false,
  });

  const { data: accountSummary } = useQuery<{
    wallet: { balanceYer: string; balanceSar: string };
    points: { current: number; lifetime: number };
    orders: { total: number; pending: number; completed: number };
  }>({
    queryKey: ["/api/account/summary"],
    enabled: isAuthenticated,
  });

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    enabled: isAuthenticated,
  });

  const { data: wishlistItems = [] } = useQuery<any[]>({
    queryKey: ["/api/wishlist"],
    enabled: isAuthenticated,
  });

  const { data: credit } = useQuery<any>({
    queryKey: ["/api/my/credit"],
    enabled: isAuthenticated,
    retry: false,
    staleTime: 30_000,
  });

  // Guest view
  if (!isAuthenticated) {
    return (
      <div className="container max-w-md mx-auto px-4 py-8 pb-24">
        <div className="text-center mb-6">
          <div className="mx-auto w-20 h-20 mb-3">
            <img src={oyoLogo} alt="OYO PLAST" className="w-full h-full object-contain rounded-2xl shadow-lg" />
          </div>
          <h1 className="text-2xl font-bold mb-1">حسابي</h1>
          <p className="text-muted-foreground text-sm">سجل دخولك للوصول لحسابك</p>
        </div>

        <Card className="border-none shadow-xl">
          <CardContent className="pt-5 space-y-3">
            <div className="grid gap-2 mb-4">
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-primary/5">
                <ShoppingBag className="h-5 w-5 text-primary" />
                <span className="text-sm">تتبع طلباتك ومشترياتك</span>
              </div>
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-green-500/5">
                <Wallet className="h-5 w-5 text-green-500" />
                <span className="text-sm">محفظتك الإلكترونية</span>
              </div>
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-yellow-500/5">
                <Award className="h-5 w-5 text-yellow-500" />
                <span className="text-sm">نقاط الولاء والمكافآت</span>
              </div>
            </div>

            <Link href="/auth">
              <Button
                className="w-full h-11 text-base font-bold shadow-lg bg-[#2196F3] hover:bg-[#1976D2]"
                data-testid="button-login"
              >
                <LogIn className="h-5 w-5 ml-2" />
                تسجيل الدخول
              </Button>
            </Link>
            <Link href="/register">
              <Button
                variant="outline"
                className="w-full h-11 text-base font-bold border-2 border-[#2196F3] text-[#2196F3]"
                data-testid="button-register"
              >
                <UserPlus className="h-5 w-5 ml-2" />
                إنشاء حساب جديد
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tierName = credit?.tier_name_ar || "برونزي";
  const tierIcon = credit?.tier_icon || "🥉";
  const tierColor = credit?.tier_color || "#cd7f32";
  const displayName = (user as any)?.fullName || (user as any)?.firstName || "عميلنا الكريم";
  const userInitial = displayName.charAt(0);
  const creditAvailable = Number(credit?.available_credit ?? 0);
  const showPartnership = (user as any)?.accountType !== "marketer" && !marketerAccount;

  const orderCounts = {
    pending: orders.filter(o => o.status === "pending" || o.status === "deposit_paid").length,
    processing: orders.filter(o => o.status === "processing").length,
    shipped: orders.filter(o => o.status === "shipped").length,
    onHold: orders.filter(o => o.status === "on_hold").length,
    cancelled: orders.filter(o => o.status === "cancelled" || o.status === "returned").length,
  };

  const balanceYer = parseFloat(accountSummary?.wallet.balanceYer || "0");
  const pointsCurrent = accountSummary?.points.current || 0;

  // 4 finance cards
  const financeCards = [
    { key: "wallet",   label: "المحفظة", value: balanceYer.toLocaleString("ar-YE"), suffix: "ر.ي", icon: Wallet,     bg: "#10B981", href: "/wallet" },
    { key: "points",   label: "النقاط",  value: pointsCurrent.toLocaleString("ar-YE"), suffix: "نقطة", icon: Award,    bg: "#F59E0B", href: "/loyalty" },
    { key: "credit",   label: "الائتمان", value: creditAvailable > 0 ? creditAvailable.toLocaleString("ar-YE") : "—", suffix: "ر.ي", icon: CreditCard, bg: "#F97316", href: "/credit" },
    { key: "wishlist", label: "المفضلة",  value: wishlistItems.length.toLocaleString("ar-YE"), suffix: "منتج", icon: Heart,    bg: "#EC4899", href: "/wishlist" },
  ];

  // 9 أدوات فريدة (3×3) — أُزيل المكرر مع بطاقات Finance أعلاه (المحفظة/النقاط/الائتمان)
  const tools: Array<{ icon: any; label: string; href?: string; color: string; bg: string; external?: boolean; onClick?: () => void; testid: string }> = [
    { icon: ShoppingBag,  label: "طلباتي",       href: "/orders",            color: "text-blue-600",   bg: "bg-blue-100 dark:bg-blue-950/40",     testid: "tool-orders" },
    { icon: AlertTriangle,label: "مديونياتي",    href: "/my-debts",          color: "text-rose-600",   bg: "bg-rose-100 dark:bg-rose-950/40",     testid: "tool-debts" },
    { icon: MapPin,       label: "عناويني",      href: "/addresses",         color: "text-indigo-600", bg: "bg-indigo-100 dark:bg-indigo-950/40", testid: "tool-addresses" },
    { icon: User,         label: "ملفي الشخصي",  href: "/profile",           color: "text-cyan-600",   bg: "bg-cyan-100 dark:bg-cyan-950/40",     testid: "tool-profile" },
    { icon: Bell,         label: "إشعاراتي",     href: "/notifications",     color: "text-purple-600", bg: "bg-purple-100 dark:bg-purple-950/40", testid: "tool-notifications" },
    { icon: Ticket,       label: "كوبوناتي",     href: "/my-coupons",        color: "text-rose-600",   bg: "bg-rose-100 dark:bg-rose-950/40",     testid: "tool-coupons" },
    { icon: ShieldCheck,  label: "أمان",         href: "/settings#security", color: "text-teal-600",   bg: "bg-teal-100 dark:bg-teal-950/40",     testid: "tool-security" },
    { icon: MessageCircle,label: "دعم واتساب",   href: "https://wa.me/967774997589?text=مرحباً،%20أحتاج%20للمساعدة", external: true, color: "text-green-600",  bg: "bg-green-100 dark:bg-green-950/40", testid: "tool-support" },
    { icon: HelpCircle,   label: "الإعدادات",    href: "/settings",          color: "text-slate-600",  bg: "bg-slate-100 dark:bg-slate-800",      testid: "tool-help" },
    { icon: LogOut,       label: "خروج",         onClick: () => { try { logout(); } catch {} },        color: "text-red-600",    bg: "bg-red-100 dark:bg-red-950/40",       testid: "tool-logout" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-24" dir="rtl">
      {/* ──────── Hero Header ──────── */}
      <div className="bg-gradient-to-br from-[#1976D2] via-[#2196F3] to-[#42A5F5] text-white">
        <div className="container max-w-2xl mx-auto px-4 pt-3 pb-6 relative">
          <div className="flex items-center justify-between mb-3">
            <Button
              variant="ghost" size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => goBackSafe(setLocation)}
              data-testid="button-back-account"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-bold">حسابي</h1>
            <Link href="/settings">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" data-testid="button-go-settings">
                <SettingsIcon className="h-5 w-5" />
              </Button>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Avatar className="w-14 h-14 ring-2 ring-white/40 shadow-lg">
              <AvatarImage src={(user as any)?.profileImageUrl || undefined} alt={displayName} />
              <AvatarFallback className="bg-white text-[#1976D2] text-xl font-bold">
                {userInitial}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold truncate" data-testid="text-user-name">{displayName}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <Badge
                  className="text-[10px] font-bold border-0 px-1.5 py-0"
                  style={{ background: tierColor, color: "white" }}
                  data-testid="badge-tier"
                >
                  {tierIcon} {tierName}
                </Badge>
                {(user as any)?.city && (
                  <span className="text-[11px] text-white/80 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {(user as any).city}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-2xl mx-auto px-4 -mt-5 relative z-10 space-y-3">
        {/* ──────── 4 Finance Cards ──────── */}
        <div className="grid grid-cols-4 gap-2">
          {financeCards.map(c => {
            const Icon = c.icon;
            return (
              <Link key={c.key} href={c.href}>
                <Card className="hover-elevate cursor-pointer h-full" data-testid={`card-${c.key}`}>
                  <CardContent className="p-2.5 text-center">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center mx-auto mb-1"
                      style={{ background: `${c.bg}20` }}
                    >
                      <Icon className="h-4.5 w-4.5" style={{ color: c.bg }} />
                    </div>
                    <p className="text-sm font-bold truncate" style={{ color: c.bg }} data-testid={`text-${c.key}-value`}>
                      {c.value}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{c.label}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* ──────── Orders Status Strip ──────── */}
        <Card data-testid="card-orders-strip">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-sm flex items-center gap-1.5">
                <ShoppingBag className="h-4 w-4 text-primary" />
                طلباتي
                {accountSummary?.orders.total ? (
                  <span className="text-xs text-muted-foreground">({accountSummary.orders.total})</span>
                ) : null}
              </h3>
              <Link href="/orders">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" data-testid="button-all-orders">
                  الكل
                  <ChevronRight className="h-3 w-3 rotate-180" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {[
                { key: "pending",    label: "غير مدفوع", icon: Clock,        color: "text-yellow-600", count: orderCounts.pending },
                { key: "processing", label: "تجهيز",     icon: Package,      color: "text-orange-600", count: orderCounts.processing },
                { key: "shipped",    label: "شحن",       icon: Truck,        color: "text-purple-600", count: orderCounts.shipped },
                { key: "on_hold",    label: "تعليق",     icon: CheckCircle2, color: "text-blue-600",   count: orderCounts.onHold },
                { key: "returned",   label: "مسترجع",    icon: RefreshCcw,   color: "text-red-600",    count: orderCounts.cancelled },
              ].map(s => {
                const Icon = s.icon;
                return (
                  <Link key={s.key} href="/orders">
                    <button
                      className="w-full relative flex flex-col items-center gap-1 py-2 rounded-lg hover-elevate transition"
                      data-testid={`status-${s.key}`}
                    >
                      <div className="relative">
                        <Icon className={`h-5 w-5 ${s.color}`} />
                        {s.count > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                            {s.count}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground">{s.label}</span>
                    </button>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ──────── 4 × 3 Tools Grid ──────── */}
        <Card data-testid="card-tools">
          <CardContent className="p-3">
            <h3 className="font-bold text-sm mb-2">أدواتي</h3>
            <div className="grid grid-cols-3 gap-2">
              {tools.map(t => {
                const Icon = t.icon;
                const inner = (
                  <div
                    className={`flex flex-col items-center gap-1 p-1.5 rounded-lg hover-elevate transition cursor-pointer ${isLoggingOut && t.testid === "tool-logout" ? "opacity-60 pointer-events-none" : ""}`}
                    data-testid={t.testid}
                  >
                    <div className={`w-10 h-10 rounded-full ${t.bg} flex items-center justify-center`}>
                      <Icon className={`h-5 w-5 ${t.color}`} />
                    </div>
                    <span className="text-[11px] font-medium text-center leading-tight">{t.label}</span>
                  </div>
                );
                if (t.onClick) {
                  return (
                    <button key={t.label} type="button" onClick={t.onClick} className="block w-full" disabled={isLoggingOut && t.testid === "tool-logout"}>
                      {inner}
                    </button>
                  );
                }
                if (t.external && t.href) {
                  return (
                    <a key={t.label} href={t.href} target="_blank" rel="noopener noreferrer">
                      {inner}
                    </a>
                  );
                }
                return (
                  <Link key={t.label} href={t.href!}>
                    {inner}
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ──────── Partnership Banner ──────── */}
        {showPartnership && (
          <Link href="/partnership">
            <Card className="bg-gradient-to-r from-[#1976D2] to-[#42A5F5] text-white border-0 hover-elevate cursor-pointer" data-testid="card-partnership">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <Handshake className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">انضم كمسوق أو مورد</p>
                  <p className="text-xs text-white/85 truncate">اربح عمولات أو وسّع تجارتك معنا</p>
                </div>
                <ExternalLink className="h-5 w-5 shrink-0" />
              </CardContent>
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
}
