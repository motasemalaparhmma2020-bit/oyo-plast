import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  ChevronRight, Globe, Bell, ShieldCheck, Lock, ChevronLeft as ChevLeftIcon, FileText, KeyRound,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function goBackSafe(setLocation: (p: string) => void) {
  try {
    const last = sessionStorage.getItem("lastSafePath");
    if (last && last !== "/settings") return setLocation(last);
  } catch {}
  setLocation("/account");
}

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [lang, setLang] = useState<string>(() => {
    try { return localStorage.getItem("appLang") || "ar"; } catch { return "ar"; }
  });

  const setLanguage = (v: string) => {
    setLang(v);
    try { localStorage.setItem("appLang", v); } catch {}
    toast({
      title: v === "ar" ? "تم تعيين اللغة: عربي" : "Language set: English",
      description: v === "en" ? "Full English translation coming soon." : "ترجمة الواجهة الكاملة قريباً.",
    });
  };

  const sections = [
    {
      id: "language",
      title: "اللغة",
      icon: Globe,
      color: "text-blue-600",
      bg: "bg-blue-100 dark:bg-blue-950/40",
      content: (
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
        </div>
      ),
    },
    {
      id: "notifications",
      title: "الإشعارات",
      icon: Bell,
      color: "text-purple-600",
      bg: "bg-purple-100 dark:bg-purple-950/40",
      content: (
        <Link href="/notification-settings">
          <Button variant="outline" size="sm" className="gap-1" data-testid="button-go-notif-settings">
            إدارة الإشعارات
            <ChevLeftIcon className="h-3.5 w-3.5" />
          </Button>
        </Link>
      ),
    },
    {
      id: "privacy",
      title: "الخصوصية",
      icon: ShieldCheck,
      color: "text-emerald-600",
      bg: "bg-emerald-100 dark:bg-emerald-950/40",
      content: (
        <Link href="/privacy">
          <Button variant="outline" size="sm" className="gap-1" data-testid="button-go-privacy">
            <FileText className="h-3.5 w-3.5" />
            عرض سياسة الخصوصية
          </Button>
        </Link>
      ),
    },
    {
      id: "security",
      title: "الأمان",
      icon: Lock,
      color: "text-orange-600",
      bg: "bg-orange-100 dark:bg-orange-950/40",
      content: (
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/30">
            <span className="flex items-center gap-1.5"><KeyRound className="h-4 w-4 text-muted-foreground" />تغيير كلمة المرور</span>
            <Badge2 label="قريباً" />
          </div>
          <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/30">
            <span>التحقق بخطوتين (2FA)</span>
            <Switch disabled data-testid="switch-2fa" />
          </div>
          <p className="text-[11px] text-muted-foreground">هذه الخصائص سيتم تفعيلها قريباً.</p>
        </div>
      ),
    },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-24" dir="rtl">
      <div className="bg-gradient-to-br from-slate-700 via-slate-600 to-slate-500 text-white">
        <div className="container max-w-2xl mx-auto px-4 pt-4 pb-6">
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
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.id} id={s.id} data-testid={`section-${s.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-full ${s.bg} flex items-center justify-center`}>
                    <Icon className={`h-5 w-5 ${s.color}`} />
                  </div>
                  <h2 className="font-bold text-base">{s.title}</h2>
                </div>
                {s.content}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Badge2({ label }: { label: string }) {
  return (
    <span className="text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded px-1.5 py-0.5 font-semibold">
      {label}
    </span>
  );
}
