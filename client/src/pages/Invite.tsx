import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Gift, Copy, Check, Share2, Users, Wallet, ArrowRight, UserPlus,
} from "lucide-react";

interface ReferralMe {
  referralEnabled: boolean;
  referralCode: string | null;
  friendDiscountPercent: number;
  rewardYer: number;
  totalReferrals: number;
  rewardedReferrals: number;
  totalEarnedYer: number;
}

export default function Invite() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  const { data, isLoading } = useQuery<ReferralMe>({
    queryKey: ["/api/referral/me"],
    enabled: isAuthenticated,
    retry: false,
  });

  const code = data?.referralCode || "";
  const link = code ? `${window.location.origin}/r/${code}` : "";
  const friendPct = data?.friendDiscountPercent ?? 15;
  const rewardYer = data?.rewardYer ?? 0;

  const shareText =
    `🎁 خصم ${friendPct}% على أول طلب لك من متجر أويو بلاست!\n` +
    `استخدم رابط دعوتي الخاص:\n${link}`;

  function copy(value: string, which: "code" | "link") {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(which);
      toast({ title: "✅ تم النسخ" });
      setTimeout(() => setCopied(null), 1800);
    });
  }

  function shareWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  }

  function shareNative() {
    if (navigator.share) {
      navigator.share({ title: "دعوة أويو بلاست", text: shareText, url: link }).catch(() => {});
    } else {
      shareWhatsApp();
    }
  }

  if (authLoading || (isAuthenticated && isLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center px-6 text-center" dir="rtl">
        <UserPlus className="h-14 w-14 text-primary mb-4" />
        <h1 className="text-xl font-bold mb-2">ادعُ أصدقاءك واربح</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
          سجّل الدخول للحصول على رابط الدعوة الخاص بك.
        </p>
        <Link href="/auth">
          <Button className="px-8" data-testid="button-login-to-invite">تسجيل الدخول</Button>
        </Link>
      </div>
    );
  }

  if (data && !data.referralEnabled) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center px-6 text-center" dir="rtl">
        <Gift className="h-14 w-14 text-gray-300 mb-4" />
        <h1 className="text-xl font-bold mb-2">برنامج الدعوة غير مفعّل حالياً</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
          تابعنا — سنطلق برنامج "ادعُ صديقاً" قريباً.
        </p>
        <Link href="/">
          <Button variant="outline" className="px-8" data-testid="button-back-home">العودة للرئيسية</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-10" dir="rtl">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary to-primary/80 text-white">
        <div className="max-w-xl mx-auto px-4 py-9 text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-1.5 mb-3">
            <Gift className="h-4 w-4" />
            <span className="text-sm font-medium">ادعُ صديقاً</span>
          </div>
          <h1 className="text-2xl font-bold mb-2 leading-relaxed">
            صديقك يوفّر {friendPct}% — وأنت تربح {rewardYer.toLocaleString("ar-YE")} ر.ي
          </h1>
          <p className="text-white/80 text-sm">
            شارك رابطك الخاص. عند أول طلب لصديقك، تُضاف المكافأة إلى محفظتك تلقائياً.
          </p>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 -mt-6">
        {/* بطاقة الكود + الرابط */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">كود الدعوة الخاص بك</p>
            <div className="flex items-center justify-between gap-3 mb-4">
              <span
                className="text-2xl font-black tracking-widest text-primary"
                data-testid="text-referral-code"
              >
                {code || "—"}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copy(code, "code")}
                disabled={!code}
                data-testid="button-copy-code"
              >
                {copied === "code" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span className="mr-1">نسخ</span>
              </Button>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">رابط الدعوة</p>
            <div className="flex items-center gap-2 mb-4">
              <div
                className="flex-1 truncate text-xs bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2"
                data-testid="text-referral-link"
              >
                {link || "—"}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copy(link, "link")}
                disabled={!link}
                data-testid="button-copy-link"
              >
                {copied === "link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={shareWhatsApp}
                className="bg-green-600 hover:bg-green-700"
                disabled={!link}
                data-testid="button-share-whatsapp"
              >
                <Share2 className="h-4 w-4 ml-1" />
                مشاركة واتساب
              </Button>
              <Button
                onClick={shareNative}
                variant="outline"
                disabled={!link}
                data-testid="button-share-native"
              >
                <Share2 className="h-4 w-4 ml-1" />
                مشاركة أخرى
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* الإحصائيات */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <Users className="h-6 w-6 mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold" data-testid="text-total-referrals">
                {(data?.rewardedReferrals ?? 0).toLocaleString("ar-YE")}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">أصدقاء مكافأون</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <Wallet className="h-6 w-6 mx-auto mb-1 text-green-600" />
              <p className="text-2xl font-bold text-green-600" data-testid="text-total-earned">
                {(data?.totalEarnedYer ?? 0).toLocaleString("ar-YE")}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">إجمالي الأرباح (ر.ي)</p>
            </CardContent>
          </Card>
        </div>

        {/* كيف تعمل */}
        <Card className="border-0 shadow-sm mt-4">
          <CardContent className="p-5">
            <h2 className="font-bold mb-3">كيف تعمل؟</h2>
            <ol className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center">١</span>
                شارك رابط الدعوة مع أصدقائك.
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center">٢</span>
                صديقك يحصل على خصم {friendPct}% عند أول طلب.
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center">٣</span>
                تُضاف {rewardYer.toLocaleString("ar-YE")} ر.ي إلى محفظتك تلقائياً.
              </li>
            </ol>
            <Link href="/wallet">
              <Button variant="ghost" className="w-full mt-4 text-primary" data-testid="button-go-wallet">
                عرض محفظتي
                <ArrowRight className="h-4 w-4 mr-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
