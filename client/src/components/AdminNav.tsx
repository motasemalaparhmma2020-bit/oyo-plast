import { Package, Grid3x3, Tags, ShoppingCart, Zap, Palette, Image, BarChart3, Settings, Printer, Wallet, LayoutDashboard, UserCog, MessageSquareWarning, Users, Receipt, Handshake, SplitSquareVertical } from "lucide-react";

interface AdminNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
}

export const adminNavItems: AdminNavItem[] = [
  { id: "products", label: "المنتجات", icon: <Package className="h-8 w-8" />, color: "from-blue-400 to-blue-600" },
  { id: "categories", label: "الأقسام", icon: <Grid3x3 className="h-8 w-8" />, color: "from-purple-400 to-purple-600" },
  { id: "inventory", label: "المخزون", icon: <ShoppingCart className="h-8 w-8" />, color: "from-orange-400 to-orange-600" },
  { id: "orders", label: "الطلبات", icon: <ShoppingCart className="h-8 w-8" />, color: "from-green-400 to-green-600" },
  { id: "dimensions", label: "مقاسات الصور", icon: <Image className="h-8 w-8" />, color: "from-cyan-400 to-cyan-600" },
  { id: "logo-splash", label: "الشعار والسبلاش", icon: <Palette className="h-8 w-8" />, color: "from-pink-400 to-pink-600" },
  { id: "home-sections", label: "أقسام الرئيسية", icon: <LayoutDashboard className="h-8 w-8" />, color: "from-teal-400 to-teal-600" },
  { id: "banners-offers", label: "العروض والبنرات", icon: <Zap className="h-8 w-8" />, color: "from-yellow-400 to-yellow-600" },
  { id: "financial", label: "المركز المالي", icon: <Wallet className="h-8 w-8" />, color: "from-red-400 to-red-600" },
  { id: "reports", label: "التقارير", icon: <BarChart3 className="h-8 w-8" />, color: "from-indigo-400 to-indigo-600" },
  { id: "navigation", label: "التنقل والطباعة", icon: <Printer className="h-8 w-8" />, color: "from-lime-400 to-lime-600" },
  { id: "login-management", label: "إدارة الدخول", icon: <UserCog className="h-8 w-8" />, color: "from-violet-400 to-violet-600" },
  { id: "sms-test", label: "بوابة فحص الرسائل", icon: <MessageSquareWarning className="h-8 w-8" />, color: "from-sky-400 to-sky-600" },
  { id: "suppliers", label: "الموردون والموزعون", icon: <Handshake className="h-8 w-8" />, color: "from-cyan-400 to-cyan-600" },
  { id: "installments", label: "التقسيط والمدفوعات", icon: <SplitSquareVertical className="h-8 w-8" />, color: "from-amber-400 to-orange-600" },
  { id: "invoice-settings", label: "إعدادات الفاتورة", icon: <Receipt className="h-8 w-8" />, color: "from-teal-400 to-teal-600" },
  { id: "team", label: "إدارة الفريق", icon: <Users className="h-8 w-8" />, color: "from-emerald-400 to-emerald-600" },
  { id: "settings", label: "الإعدادات", icon: <Settings className="h-8 w-8" />, color: "from-slate-400 to-slate-600" },
];

interface AdminNavProps {
  activeSection: string;
  onSelectSection: (id: string) => void;
}

export function AdminNav({ activeSection, onSelectSection }: AdminNavProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
      {adminNavItems.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelectSection(item.id)}
          className={`relative p-6 rounded-2xl cursor-pointer transition-all transform hover:scale-105 active:scale-95 ${
            activeSection === item.id
              ? `bg-gradient-to-br ${item.color} text-white shadow-lg scale-105`
              : `bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-2 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 shadow-md`
          }`}
          data-testid={`admin-nav-${item.id}`}
        >
          <div className="flex flex-col items-center gap-3">
            <div className={activeSection === item.id ? "text-white" : "text-gray-600 dark:text-gray-400"}>
              {item.icon}
            </div>
            <p className="text-center text-sm font-bold leading-tight">{item.label}</p>
          </div>
          {activeSection === item.id && (
            <div className="absolute top-2 right-2 w-3 h-3 bg-white rounded-full animate-pulse"></div>
          )}
        </button>
      ))}
    </div>
  );
}
