import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Eye, Activity, Phone, Mail, Layout, ShoppingCart, UserPlus, RefreshCw
} from "lucide-react";

interface Props { adminToken: string; }

function Toggle({ checked, onChange, label, desc, testId }: {
  checked: boolean; onChange: (v: boolean) => void;
  label: string; desc?: string; testId?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex-1 min-w-0 ml-3">
        <p className="font-semibold text-sm text-right">{label}</p>
        {desc && <p className="text-xs text-muted-foreground text-right mt-0.5">{desc}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        data-testid={testId}
        className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${checked ? "bg-green-500" : "bg-gray-300"}`}
      >
        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${checked ? "right-1" : "left-1"}`} />
      </button>
    </div>
  );
}

export function LoginManagementSection({ adminToken }: Props) {
  const { toast } = useToast();
  const [tab, setTab] = useState("stats");

  // ── جلب الإعدادات ───────────────────────────────────────────────
  const { data: navSettings, isLoading: navLoading } = useQuery<any>({
    queryKey: ["/api/navigation-settings"],
  });

  // ── جلب الإحصائيات ──────────────────────────────────────────────
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<{
    registeredUsers: number;
    totalVisitors: number;
    activeNow: number;
  }>({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats", {
        headers: { "x-admin-token": adminToken },
      });
      if (!res.ok) throw new Error("فشل جلب الإحصائيات");
      return res.json();
    },
    refetchInterval: 30000,
  });

  // ── تحديث الإعدادات ─────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: async (patch: Record<string, boolean>) => {
      const res = await fetch("/api/admin/navigation-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("فشل التحديث");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/navigation-settings"] });
      toast({ title: "✅ تم الحفظ" });
    },
    onError: () => toast({ title: "خطأ", description: "فشل الحفظ", variant: "destructive" }),
  });

  const toggle = (key: string, val: boolean) => updateMutation.mutate({ [key]: val });

  const s = navSettings ?? {};

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-right text-lg">🔐 إدارة تسجيل الدخول</CardTitle>
        <CardDescription className="text-right text-sm">
          تحكم في تجربة الدخول وتتبع نشاط الزوار
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-3 mb-4 mx-4" style={{ width: "calc(100% - 2rem)" }}>
            <TabsTrigger value="stats" className="text-xs" data-testid="login-tab-stats">
              <Activity className="h-3.5 w-3.5 ml-1" />إحصائيات
            </TabsTrigger>
            <TabsTrigger value="methods" className="text-xs" data-testid="login-tab-methods">
              <Phone className="h-3.5 w-3.5 ml-1" />طرق الدخول
            </TabsTrigger>
            <TabsTrigger value="placement" className="text-xs" data-testid="login-tab-placement">
              <Layout className="h-3.5 w-3.5 ml-1" />مكان الظهور
            </TabsTrigger>
          </TabsList>

          {/* ── تبويب الإحصائيات ──────────────────────────────── */}
          <TabsContent value="stats" className="px-4 pb-4">
            <div className="grid grid-cols-3 gap-3 mb-4">
              <StatCard
                icon={<Users className="h-5 w-5 text-blue-500" />}
                label="عملاء مسجلون"
                value={statsLoading ? "..." : (stats?.registeredUsers ?? 0)}
                color="blue"
                testId="stat-registered-users"
              />
              <StatCard
                icon={<Eye className="h-5 w-5 text-purple-500" />}
                label="إجمالي الزوار"
                value={statsLoading ? "..." : (stats?.totalVisitors ?? 0)}
                color="purple"
                testId="stat-total-visitors"
              />
              <StatCard
                icon={<Activity className="h-5 w-5 text-green-500" />}
                label="نشط الآن"
                value={statsLoading ? "..." : (stats?.activeNow ?? 0)}
                color="green"
                testId="stat-active-now"
              />
            </div>
            <button
              onClick={() => refetchStats()}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-gray-200 text-sm text-muted-foreground hover:bg-gray-50 transition-colors"
              data-testid="button-refresh-stats"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              تحديث الإحصائيات
            </button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              يتحدث تلقائياً كل 30 ثانية • النشطون الآن = دخلوا آخر 5 دقائق
            </p>
          </TabsContent>

          {/* ── تبويب طرق الدخول ─────────────────────────────── */}
          <TabsContent value="methods" className="px-4 pb-4">
            {navLoading ? (
              <div className="text-center py-6 text-muted-foreground text-sm">جاري التحميل...</div>
            ) : (
              <div className="space-y-1">
                <Toggle
                  checked={s.enablePhoneLogin ?? true}
                  onChange={(v) => toggle("enablePhoneLogin", v)}
                  label="تسجيل الدخول برقم الهاتف"
                  desc="إرسال رمز OTP عبر SMS أو واتساب"
                  testId="toggle-phone-login"
                />
                <Toggle
                  checked={s.enableEmailLogin ?? true}
                  onChange={(v) => toggle("enableEmailLogin", v)}
                  label="تسجيل الدخول بالبريد الإلكتروني"
                  desc="للمسؤولين والحسابات القديمة"
                  testId="toggle-email-login"
                />
              </div>
            )}
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 text-right">
              ⚠️ يجب أن تبقى طريقة دخول واحدة على الأقل مفعّلة
            </div>
          </TabsContent>

          {/* ── تبويب مكان الظهور ────────────────────────────── */}
          <TabsContent value="placement" className="px-4 pb-4">
            {navLoading ? (
              <div className="text-center py-6 text-muted-foreground text-sm">جاري التحميل...</div>
            ) : (
              <div className="space-y-1">
                <Toggle
                  checked={s.loginShowOnTop ?? false}
                  onChange={(v) => toggle("loginShowOnTop", v)}
                  label="شريط الدخول أعلى الصفحة"
                  desc="يظهر تذكير بتسجيل الدخول للزوار غير المسجلين"
                  testId="toggle-login-on-top"
                />
                <Toggle
                  checked={s.loginShowOnCheckout ?? true}
                  onChange={(v) => toggle("loginShowOnCheckout", v)}
                  label="عند تأكيد الطلب في السلة"
                  desc="يطلب تسجيل الدخول قبل إكمال الطلب"
                  testId="toggle-login-on-checkout"
                />
                <Toggle
                  checked={s.loginShowOnAccount ?? true}
                  onChange={(v) => toggle("loginShowOnAccount", v)}
                  label="عند الضغط على إنشاء حساب"
                  desc="الصفحة الافتراضية لتسجيل الدخول"
                  testId="toggle-login-on-account"
                />
              </div>
            )}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 text-right">
              💡 يمكن تفعيل أكثر من خيار في آنٍ واحد
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function StatCard({ icon, label, value, color, testId }: {
  icon: React.ReactNode; label: string; value: number | string; color: string; testId: string;
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 border-blue-100",
    purple: "bg-purple-50 border-purple-100",
    green: "bg-green-50 border-green-100",
  };
  return (
    <div className={`rounded-xl border p-3 text-center ${colors[color] ?? ""}`} data-testid={testId}>
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-2xl font-extrabold leading-none" data-testid={`${testId}-value`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1 leading-tight">{label}</p>
    </div>
  );
}
