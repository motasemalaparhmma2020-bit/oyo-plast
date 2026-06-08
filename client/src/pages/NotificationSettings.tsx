import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Bell, ArrowRight, Moon, Megaphone, Package, MessageCircle, Wallet, AlertCircle } from "lucide-react";

interface Pref {
  type: string;
  inAppEnabled: boolean;
  telegramEnabled: boolean;
  mutedUntil: string | null;
}

interface TypeMeta {
  type: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultEnabled: boolean;
  audience: string[]; // which roles see this
}

const TYPE_CATALOG: TypeMeta[] = [
  { type: "order_created", label: "طلب جديد", description: "عند إنشاء طلب جديد لك", icon: Package, defaultEnabled: true, audience: ["customer", "owner", "order_manager", "finance", "product_manager", "delivery"] },
  { type: "order_status", label: "تحديث الطلب", description: "تأكيد، تجهيز، شحن، توصيل", icon: Package, defaultEnabled: true, audience: ["customer"] },
  { type: "new_message", label: "رسالة جديدة", description: "عند وصول رسالة من الدعم", icon: MessageCircle, defaultEnabled: true, audience: ["customer", "marketer", "supplier"] },
  { type: "wallet_credit", label: "حركة المحفظة", description: "إيداع أو خصم من محفظتك", icon: Wallet, defaultEnabled: true, audience: ["customer", "marketer"] },
  { type: "commission", label: "عمولة جديدة", description: "عند إضافة عمولة من إحالاتك", icon: Wallet, defaultEnabled: true, audience: ["marketer"] },
  { type: "payment_due", label: "تذكير سداد", description: "عند اقتراب موعد السداد", icon: AlertCircle, defaultEnabled: true, audience: ["customer"] },
  { type: "low_stock", label: "تنبيه مخزون منخفض", description: "عند انخفاض رصيد منتج عندك", icon: AlertCircle, defaultEnabled: true, audience: ["supplier", "product_manager"] },
  { type: "delivery_assigned", label: "مهمة توصيل", description: "عند تعيينك لتوصيل طلب", icon: Package, defaultEnabled: true, audience: ["delivery"] },
  { type: "promo", label: "إشعارات تسويقية", description: "خصومات وعروض خاصة (مغلق افتراضياً)", icon: Megaphone, defaultEnabled: false, audience: ["customer", "marketer"] },
  { type: "system", label: "إشعارات النظام", description: "إعلانات هامة من المنصة", icon: AlertCircle, defaultEnabled: true, audience: ["customer", "marketer", "supplier", "owner", "order_manager", "finance", "product_manager", "delivery"] },
];

export default function NotificationSettings() {
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const role = (user as any)?.role || "customer";

  const { data: prefs = [], isLoading } = useQuery<Pref[]>({
    queryKey: ["/api/notification-preferences"],
    enabled: isAuthenticated,
  });

  const prefMap = new Map<string, Pref>();
  prefs.forEach(p => prefMap.set(p.type, p));

  const visibleTypes = TYPE_CATALOG.filter(t => t.audience.includes(role));

  const savePref = useMutation({
    mutationFn: async (payload: { type: string; inAppEnabled: boolean; telegramEnabled?: boolean }) =>
      apiRequest("PUT", "/api/notification-preferences", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/notification-preferences"] });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message || "فشل الحفظ", variant: "destructive" }),
  });

  const snooze = useMutation({
    mutationFn: async (hours: number) => apiRequest("POST", "/api/notification-preferences/snooze", { hours }),
    onSuccess: (_, hours) => {
      qc.invalidateQueries({ queryKey: ["/api/notification-preferences"] });
      toast({ title: "تم", description: `تم إيقاف الإشعارات لمدة ${hours} ساعة` });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message || "فشل الإيقاف", variant: "destructive" }),
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-6 text-center max-w-sm">
          <Bell className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
          <p className="mb-4">يرجى تسجيل الدخول لإدارة الإشعارات</p>
          <Link href="/auth">
            <Button data-testid="button-login">تسجيل الدخول</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const anyMuted = prefs.some(p => p.mutedUntil && new Date(p.mutedUntil).getTime() > Date.now());

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background p-4" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Link href="/profile">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">إعدادات الإشعارات</h1>
          </div>
        </div>

        {/* DND Section */}
        <Card className="p-4 mb-4 bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900">
          <div className="flex items-start gap-3">
            <Moon className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-sm mb-1">وضع عدم الإزعاج</h3>
              <p className="text-xs text-muted-foreground mb-3">
                {anyMuted ? "الإشعارات موقوفة مؤقتاً." : "أوقف كل الإشعارات لفترة محددة."}
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => snooze.mutate(1)} disabled={snooze.isPending} data-testid="button-snooze-1h">
                  ساعة واحدة
                </Button>
                <Button size="sm" variant="outline" onClick={() => snooze.mutate(4)} disabled={snooze.isPending} data-testid="button-snooze-4h">
                  4 ساعات
                </Button>
                <Button size="sm" variant="outline" onClick={() => snooze.mutate(24)} disabled={snooze.isPending} data-testid="button-snooze-24h">
                  24 ساعة
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Type Toggles */}
        <Card className="p-4">
          <h3 className="font-bold mb-3 text-sm">أنواع الإشعارات</h3>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">جارٍ التحميل...</div>
          ) : (
            <div className="space-y-3">
              {visibleTypes.map(meta => {
                const p = prefMap.get(meta.type);
                const enabled = p ? p.inAppEnabled : meta.defaultEnabled;
                const Icon = meta.icon;
                return (
                  <div
                    key={meta.type}
                    className="flex items-center justify-between gap-3 py-2 border-b last:border-b-0"
                    data-testid={`pref-row-${meta.type}`}
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="shrink-0 p-2 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#2196F3]">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{meta.label}</p>
                        <p className="text-xs text-muted-foreground">{meta.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={enabled}
                      onCheckedChange={(checked) => savePref.mutate({ type: meta.type, inAppEnabled: checked })}
                      disabled={savePref.isPending}
                      data-testid={`switch-${meta.type}`}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <p className="text-xs text-muted-foreground text-center mt-4">
          الإشعارات تظهر داخل التطبيق فقط. لا نرسل أي رسائل خارجية بدون موافقتك.
        </p>
      </div>
    </div>
  );
}
