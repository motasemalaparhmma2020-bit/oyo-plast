import {
  Package, Grid3x3, ShoppingCart, Zap, Palette, Image, BarChart3,
  Settings, Printer, Wallet, LayoutDashboard, UserCog, MessageSquareWarning,
  Users, Receipt, Handshake, SplitSquareVertical, TrendingUp, ShieldAlert,
  Star, Layers, BadgeCheck, ClipboardCheck, ChevronDown, ChevronUp,
  FileText, HardDrive, PrinterCheck, Megaphone
} from "lucide-react";
import { useState } from "react";

interface AdminNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  badge?: string;
}

interface AdminNavGroup {
  groupLabel: string;
  groupIcon: string;
  groupColor: string;
  items: AdminNavItem[];
}

export const adminNavItems: AdminNavItem[] = [
  { id: "products", label: "المنتجات", icon: <Package />, color: "from-blue-400 to-blue-600" },
  { id: "categories", label: "الأقسام", icon: <Grid3x3 />, color: "from-purple-400 to-purple-600" },
  { id: "subcategories", label: "الأقسام الفرعية", icon: <Layers />, color: "from-fuchsia-400 to-purple-600" },
  { id: "inventory", label: "المخزون", icon: <ShoppingCart />, color: "from-orange-400 to-orange-600" },
  { id: "orders", label: "الطلبات", icon: <ShoppingCart />, color: "from-green-400 to-green-600" },
  { id: "dimensions", label: "مقاسات الصور", icon: <Image />, color: "from-cyan-400 to-cyan-600" },
  { id: "logo-splash", label: "الشعار والسبلاش", icon: <Palette />, color: "from-pink-400 to-pink-600" },
  { id: "home-sections", label: "أقسام الرئيسية", icon: <LayoutDashboard />, color: "from-teal-400 to-teal-600" },
  { id: "banners-offers", label: "العروض والبنرات", icon: <Zap />, color: "from-yellow-400 to-yellow-600" },
  { id: "financial", label: "المركز المالي", icon: <Wallet />, color: "from-red-400 to-red-600" },
  { id: "reports", label: "التقارير", icon: <BarChart3 />, color: "from-indigo-400 to-indigo-600" },
  { id: "navigation", label: "التنقل والطباعة", icon: <Printer />, color: "from-lime-400 to-lime-600" },
  { id: "login-management", label: "إدارة الدخول", icon: <UserCog />, color: "from-violet-400 to-violet-600" },
  { id: "sms-test", label: "فحص الرسائل SMS", icon: <MessageSquareWarning />, color: "from-sky-400 to-sky-600" },
  { id: "suppliers", label: "الموردون والموزعون", icon: <Handshake />, color: "from-cyan-400 to-cyan-600" },
  { id: "marketers", label: "المسوّقون", icon: <Megaphone />, color: "from-emerald-400 to-teal-600" },
  { id: "supplier-products", label: "منتجات الموردين", icon: <ClipboardCheck />, color: "from-lime-500 to-green-600" },
  { id: "installments", label: "التقسيط والمدفوعات", icon: <SplitSquareVertical />, color: "from-amber-400 to-orange-600" },
  { id: "payment-verify", label: "التحقق من الدفع", icon: <BadgeCheck />, color: "from-green-400 to-emerald-600" },
  { id: "pricing", label: "التسعير الذكي", icon: <TrendingUp />, color: "from-emerald-400 to-teal-600" },
  { id: "security", label: "السجلات الأمنية", icon: <ShieldAlert />, color: "from-red-400 to-rose-600" },
  { id: "invoice-settings", label: "إعدادات الفاتورة", icon: <Receipt />, color: "from-teal-400 to-teal-600" },
  { id: "team", label: "إدارة الفريق", icon: <Users />, color: "from-emerald-400 to-emerald-600" },
  { id: "reviews", label: "التقييمات", icon: <Star />, color: "from-yellow-400 to-yellow-600" },
  { id: "section-settings", label: "إعدادات عرض المنتج", icon: <Layers />, color: "from-rose-400 to-rose-600" },
  { id: "contracts", label: "العقود الرقمية", icon: <FileText />, color: "from-blue-500 to-indigo-600" },
  { id: "backup", label: "النسخ الاحتياطية", icon: <HardDrive />, color: "from-green-500 to-emerald-600" },
  { id: "settings", label: "إعدادات المتجر", icon: <Settings />, color: "from-slate-400 to-slate-600" },
];

const navGroups: AdminNavGroup[] = [
  {
    groupLabel: "المنتجات والمخزون",
    groupIcon: "📦",
    groupColor: "border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800",
    items: [
      { id: "orders", label: "الطلبات", icon: <ShoppingCart className="h-6 w-6" />, color: "from-green-400 to-green-600", badge: "مهم" },
      { id: "products", label: "المنتجات", icon: <Package className="h-6 w-6" />, color: "from-blue-400 to-blue-600" },
      { id: "categories", label: "الأقسام", icon: <Grid3x3 className="h-6 w-6" />, color: "from-purple-400 to-purple-600" },
      { id: "subcategories", label: "الأقسام الفرعية", icon: <Layers className="h-6 w-6" />, color: "from-fuchsia-400 to-purple-600" },
      { id: "inventory", label: "المخزون", icon: <ShoppingCart className="h-6 w-6" />, color: "from-orange-400 to-orange-600" },
      { id: "supplier-products", label: "منتجات الموردين", icon: <ClipboardCheck className="h-6 w-6" />, color: "from-lime-500 to-green-600" },
      { id: "printing-categories", label: "فئات الطباعة", icon: <PrinterCheck className="h-6 w-6" />, color: "from-cyan-500 to-blue-600", badge: "جديد" },
    ],
  },
  {
    groupLabel: "المدفوعات والمالية",
    groupIcon: "💰",
    groupColor: "border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800",
    items: [
      { id: "payment-verify", label: "التحقق من الدفع", icon: <BadgeCheck className="h-6 w-6" />, color: "from-green-400 to-emerald-600", badge: "مراجعة" },
      { id: "financial", label: "المركز المالي", icon: <Wallet className="h-6 w-6" />, color: "from-red-400 to-red-600" },
      { id: "installments", label: "التقسيط", icon: <SplitSquareVertical className="h-6 w-6" />, color: "from-amber-400 to-orange-600" },
      { id: "pricing", label: "التسعير الذكي", icon: <TrendingUp className="h-6 w-6" />, color: "from-emerald-400 to-teal-600" },
      { id: "invoice-settings", label: "إعدادات الفاتورة", icon: <Receipt className="h-6 w-6" />, color: "from-teal-400 to-teal-600" },
    ],
  },
  {
    groupLabel: "واجهة المتجر",
    groupIcon: "🎨",
    groupColor: "border-purple-200 bg-purple-50 dark:bg-purple-950/30 dark:border-purple-800",
    items: [
      { id: "home-sections", label: "أقسام الرئيسية", icon: <LayoutDashboard className="h-6 w-6" />, color: "from-teal-400 to-teal-600" },
      { id: "banners-offers", label: "البنرات والعروض", icon: <Zap className="h-6 w-6" />, color: "from-yellow-400 to-yellow-600" },
      { id: "logo-splash", label: "الشعار والسبلاش", icon: <Palette className="h-6 w-6" />, color: "from-pink-400 to-pink-600" },
      { id: "dimensions", label: "مقاسات الصور", icon: <Image className="h-6 w-6" />, color: "from-cyan-400 to-cyan-600" },
      { id: "section-settings", label: "عرض صفحة المنتج", icon: <Layers className="h-6 w-6" />, color: "from-rose-400 to-rose-600" },
      { id: "navigation", label: "قائمة التنقل", icon: <Printer className="h-6 w-6" />, color: "from-lime-400 to-lime-600" },
    ],
  },
  {
    groupLabel: "الموردون والفريق",
    groupIcon: "🤝",
    groupColor: "border-cyan-200 bg-cyan-50 dark:bg-cyan-950/30 dark:border-cyan-800",
    items: [
      { id: "suppliers", label: "الموردون والموزعون", icon: <Handshake className="h-6 w-6" />, color: "from-cyan-400 to-cyan-600" },
      { id: "marketers", label: "المسوّقون", icon: <Megaphone className="h-6 w-6" />, color: "from-emerald-400 to-teal-600", badge: "جديد" },
      { id: "team", label: "إدارة الفريق", icon: <Users className="h-6 w-6" />, color: "from-emerald-400 to-emerald-600" },
      { id: "reviews", label: "تقييمات العملاء", icon: <Star className="h-6 w-6" />, color: "from-yellow-400 to-yellow-600" },
    ],
  },
  {
    groupLabel: "التقارير والتحليل",
    groupIcon: "📊",
    groupColor: "border-indigo-200 bg-indigo-50 dark:bg-indigo-950/30 dark:border-indigo-800",
    items: [
      { id: "reports", label: "تقارير المبيعات", icon: <BarChart3 className="h-6 w-6" />, color: "from-indigo-400 to-indigo-600" },
    ],
  },
  {
    groupLabel: "الثقة والتوثيق",
    groupIcon: "🔒",
    groupColor: "border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800",
    items: [
      { id: "contracts", label: "العقود الرقمية", icon: <FileText className="h-6 w-6" />, color: "from-blue-500 to-indigo-600" },
      { id: "backup", label: "النسخ الاحتياطية", icon: <HardDrive className="h-6 w-6" />, color: "from-green-500 to-emerald-600" },
      { id: "ai-sales", label: "الموظف الذكي", icon: <MessageSquareWarning className="h-6 w-6" />, color: "from-violet-500 to-fuchsia-600", badge: "جديد" },
    ],
  },
  {
    groupLabel: "الإعدادات والنظام",
    groupIcon: "⚙️",
    groupColor: "border-slate-200 bg-slate-50 dark:bg-slate-900/50 dark:border-slate-700",
    items: [
      { id: "settings", label: "إعدادات المتجر", icon: <Settings className="h-6 w-6" />, color: "from-slate-400 to-slate-600" },
      { id: "login-management", label: "إدارة الدخول", icon: <UserCog className="h-6 w-6" />, color: "from-violet-400 to-violet-600" },
      { id: "security", label: "السجلات الأمنية", icon: <ShieldAlert className="h-6 w-6" />, color: "from-red-400 to-rose-600" },
      { id: "sms-test", label: "فحص الرسائل SMS", icon: <MessageSquareWarning className="h-6 w-6" />, color: "from-sky-400 to-sky-600" },
    ],
  },
];

interface AdminNavProps {
  activeSection: string;
  onSelectSection: (id: string) => void;
}

export function AdminNav({ activeSection, onSelectSection }: AdminNavProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleGroup = (label: string) => {
    setCollapsed(prev => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <div className="space-y-4 mb-8" dir="rtl">
      {navGroups.map((group) => {
        const isOpen = !collapsed[group.groupLabel];
        const hasActive = group.items.some(i => i.id === activeSection);
        return (
          <div
            key={group.groupLabel}
            className={`rounded-2xl border-2 overflow-hidden transition-all ${group.groupColor} ${hasActive ? "ring-2 ring-primary/30" : ""}`}
          >
            {/* ─── Group Header ─── */}
            <button
              className="w-full flex items-center justify-between px-4 py-3 cursor-pointer select-none"
              onClick={() => toggleGroup(group.groupLabel)}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{group.groupIcon}</span>
                <span className="font-bold text-gray-800 dark:text-gray-100 text-sm">{group.groupLabel}</span>
                {hasActive && (
                  <span className="text-[10px] bg-primary text-white px-2 py-0.5 rounded-full font-bold">نشط</span>
                )}
              </div>
              <div className="text-gray-500 dark:text-gray-400">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </button>

            {/* ─── Group Items ─── */}
            {isOpen && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 p-3 pt-0 border-t border-black/5 dark:border-white/5">
                {group.items.map((item) => {
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSelectSection(item.id)}
                      data-testid={`admin-nav-${item.id}`}
                      className={`relative flex flex-col items-center gap-2 p-3 rounded-xl cursor-pointer transition-all hover:scale-105 active:scale-95 text-center ${
                        isActive
                          ? `bg-gradient-to-br ${item.color} text-white shadow-lg scale-105`
                          : `bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 shadow-sm hover:shadow-md border border-gray-100 dark:border-gray-700`
                      }`}
                    >
                      <div className={isActive ? "text-white" : "text-gray-500 dark:text-gray-400"}>
                        {item.icon}
                      </div>
                      <p className="text-xs font-bold leading-tight">{item.label}</p>
                      {item.badge && !isActive && (
                        <span className="absolute -top-1 -left-1 text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                          {item.badge}
                        </span>
                      )}
                      {isActive && (
                        <span className="absolute top-1.5 left-1.5 w-2 h-2 bg-white rounded-full animate-pulse" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
