import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ChevronRight, Globe, Bell, ShieldCheck, Lock, ChevronLeft as ChevLeftIcon,
  FileText, KeyRound, Eye, EyeOff, Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

function goBackSafe(setLocation: (p: string) => void) {
  try {
    const last = sessionStorage.getItem("lastSafePath");
    if (last && last !== "/settings") return setLocation(last);
  } catch {}
  setLocation("/profile");
}

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [lang, setLang] = useState<string>(() => {
    try { return localStorage.getItem("appLang") || "ar"; } catch { return "ar"; }
  });

  // ── Password change form state ──
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurr, setShowCurr] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const changePwd = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/me/change-password", {
        currentPassword: currentPassword || undefined,
        newPassword,
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "تم تحديث كلمة المرور بنجاح" });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    },
    onError: (e: any) => {
      toast({ title: "تعذر تحديث كلمة المرور", description: e?.message || "حاول لاحقاً", variant: "destructive" });
    },
  });

  const onSubmitPwd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({ title: "كلمة المرور قصيرة", description: "6 أحرف على الأقل", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "كلمتا المرور غير متطابقتين", variant: "destructive" });
      return;
    }
    changePwd.mutate();
  };

  const setLanguage = (v: string) => {
    setLang(v);
    try { localStorage.setItem("appLang", v); } catch {}
    toast({
      title: v === "ar" ? "تم تعيين اللغة: عربي" : "Language set: English",
      description: v === "en" ? "Full English translation coming soon." : "ترجمة الواجهة الكاملة قريباً.",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-24" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-700 via-slate-600 to-slate-500 text-white">
        <div className="container max-w-2xl mx-auto px-4 pt-3 pb-5">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost" size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => goBackSafe(setLocation)}
              data-testid="button-back-settings"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-bold">الإعدادات</h1>
            <div className="w-9" />
          </div>
        </div>
      </div>

      <div className="container max-w-2xl mx-auto px-4 py-4 space-y-3">
        {/* ─── اللغة ─── */}
        <Card id="language" data-testid="section-language">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center">
                <Globe className="h-5 w-5 text-blue-600" />
              </div>
              <h2 className="font-bold text-base">اللغة</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={lang === "ar" ? "default" : "outline"}
                onClick={() => setLanguage("ar")}
                data-testid="button-lang-ar"
              >
                العربية
              </Button>
              <Button
                size="sm"
                variant={lang === "en" ? "default" : "outline"}
                onClick={() => setLanguage("en")}
                data-testid="button-lang-en"
              >
                English
              </Button>
              <span className="text-[11px] text-muted-foreground mr-auto">
                ترجمة الواجهة الكاملة قريباً
              </span>
            </div>
          </CardContent>
        </Card>

        {/* ─── الإشعارات ─── */}
        <Card id="notifications" data-testid="section-notifications">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-950/40 flex items-center justify-center">
                <Bell className="h-5 w-5 text-purple-600" />
              </div>
              <h2 className="font-bold text-base">الإشعارات</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              تحكّم بأنواع الإشعارات (طلبات، رسائل، عروض) وفترات الإسكات.
            </p>
            <Link href="/notification-settings">
              <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-go-notif-settings">
                <Bell className="h-3.5 w-3.5" />
                إدارة الإشعارات
                <ChevLeftIcon className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* ─── الخصوصية ─── */}
        <Card id="privacy" data-testid="section-privacy">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
              </div>
              <h2 className="font-bold text-base">الخصوصية</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              اطلع على كيفية حفظ بياناتك واستخدامها داخل تطبيق أويو بلاست.
            </p>
            <Link href="/privacy">
              <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-go-privacy">
                <FileText className="h-3.5 w-3.5" />
                عرض سياسة الخصوصية
                <ChevLeftIcon className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* ─── الأمان: تغيير كلمة المرور ─── */}
        <Card id="security" data-testid="section-security">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center">
                <Lock className="h-5 w-5 text-orange-600" />
              </div>
              <h2 className="font-bold text-base">الأمان</h2>
            </div>

            <form onSubmit={onSubmitPwd} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="current-pwd" className="text-xs">كلمة المرور الحالية</Label>
                <div className="relative">
                  <Input
                    id="current-pwd"
                    type={showCurr ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="اتركها فارغة إذا لم تضع كلمة مرور سابقاً"
                    className="h-10 pl-9"
                    data-testid="input-current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurr(v => !v)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-label="إظهار/إخفاء"
                    data-testid="button-toggle-current"
                  >
                    {showCurr ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="new-pwd" className="text-xs">كلمة المرور الجديدة</Label>
                <div className="relative">
                  <Input
                    id="new-pwd"
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="6 أحرف على الأقل"
                    className="h-10 pl-9"
                    data-testid="input-new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(v => !v)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-label="إظهار/إخفاء"
                    data-testid="button-toggle-new"
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="confirm-pwd" className="text-xs">تأكيد كلمة المرور الجديدة</Label>
                <Input
                  id="confirm-pwd"
                  type={showNew ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="أعد إدخال كلمة المرور"
                  className="h-10"
                  data-testid="input-confirm-password"
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-[11px] text-red-600">الكلمتان غير متطابقتين</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                disabled={
                  changePwd.isPending ||
                  newPassword.length < 6 ||
                  newPassword !== confirmPassword
                }
                data-testid="button-submit-change-password"
              >
                {changePwd.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                    جارٍ الحفظ...
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4 ml-1" />
                    حفظ كلمة المرور
                  </>
                )}
              </Button>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                إذا سجّلت دخولك برقم الجوال فقط (بدون كلمة مرور)، اترك حقل "كلمة المرور الحالية" فارغاً
                لإنشاء كلمة مرور لأول مرة.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
