import { useState } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Megaphone, AlertTriangle, ChevronLeft, Send } from "lucide-react";

const ROLE_OPTIONS = [
  { value: "customer", label: "العملاء" },
  { value: "marketer", label: "المسوقون" },
  { value: "supplier", label: "الموردون" },
];

export default function AdminBroadcastNotifications() {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [actionUrl, setActionUrl] = useState("");
  const [roles, setRoles] = useState<string[]>(["customer"]);
  const [confirmBypass, setConfirmBypass] = useState(false);
  const [lastResult, setLastResult] = useState<{ recipients: number; mode: string } | null>(null);

  const send = useMutation({
    mutationFn: async (mode: "opt_in" | "bypass") =>
      apiRequest("POST", "/api/admin/notifications/broadcast", {
        title: title.trim(),
        message: message.trim(),
        actionUrl: actionUrl.trim() || undefined,
        mode,
        roles: roles.length ? roles : undefined,
      }),
    onSuccess: async (res: any) => {
      const data = await res.json?.() ?? res;
      setLastResult({ recipients: data.recipients ?? 0, mode: data.mode });
      toast({
        title: "تم البث",
        description: `تم إرسال الإشعار إلى ${data.recipients ?? 0} مستخدم.`,
      });
      setTitle("");
      setMessage("");
      setActionUrl("");
      setConfirmBypass(false);
    },
    onError: (e: any) => {
      toast({ title: "فشل البث", description: e?.message || "حدث خطأ", variant: "destructive" });
    },
  });

  const canSend = title.trim().length >= 2 && message.trim().length >= 2 && roles.length > 0;

  const toggleRole = (r: string) => {
    setRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background pb-20" dir="rtl">
      <div className="bg-primary text-white px-4 py-3">
        <div className="container mx-auto flex items-center gap-2">
          <Link href="/admin">
            <Button variant="secondary" size="icon" data-testid="button-back-admin">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            بث إشعار تسويقي
          </h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">محتوى الإشعار</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">العنوان</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: عروض اليوم على المنتجات البلاستيكية"
                maxLength={120}
                data-testid="input-broadcast-title"
              />
            </div>
            <div>
              <Label htmlFor="message">النص</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="اكتب نص الإشعار باللغة العربية..."
                rows={4}
                maxLength={500}
                data-testid="input-broadcast-message"
              />
            </div>
            <div>
              <Label htmlFor="actionUrl">رابط الإجراء (اختياري)</Label>
              <Input
                id="actionUrl"
                value={actionUrl}
                onChange={(e) => setActionUrl(e.target.value)}
                placeholder="/products أو /offers"
                data-testid="input-broadcast-url"
              />
              <p className="text-xs text-muted-foreground mt-1">
                عند الضغط على الإشعار يفتح هذا الرابط داخل التطبيق.
              </p>
            </div>
            <div>
              <Label>الفئات المستهدفة</Label>
              <div className="flex gap-3 mt-2 flex-wrap">
                {ROLE_OPTIONS.map(r => (
                  <label key={r.value} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={roles.includes(r.value)}
                      onCheckedChange={() => toggleRole(r.value)}
                      data-testid={`checkbox-role-${r.value}`}
                    />
                    <span className="text-sm">{r.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* وضع البث */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">اختر وضع الإرسال</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* الزر 1: opt-in */}
            <div className="border rounded-lg p-4 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
              <div className="flex items-start gap-3 mb-3">
                <div className="shrink-0 p-2 rounded-full bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400">
                  <Send className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-sm">إرسال بموافقة العميل (مُوصى به)</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    يُرسل فقط للمستخدمين الذين فعّلوا الإشعارات التسويقية في إعداداتهم.
                  </p>
                </div>
              </div>
              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={() => send.mutate("opt_in")}
                disabled={!canSend || send.isPending}
                data-testid="button-broadcast-opt-in"
              >
                {send.isPending ? "جاري الإرسال..." : "إرسال للمشتركين فقط"}
              </Button>
            </div>

            {/* الزر 2: bypass */}
            <div className="border rounded-lg p-4 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
              <div className="flex items-start gap-3 mb-3">
                <div className="shrink-0 p-2 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-sm">تجاوز موافقة العميل (للحالات الطارئة فقط)</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    يُرسل لجميع المستخدمين بصرف النظر عن إعداداتهم. استخدمه فقط للإعلانات الحرجة جداً
                    (تحديث منصة، تعطل خدمة، إشعار قانوني).
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <Checkbox
                  id="confirm-bypass"
                  checked={confirmBypass}
                  onCheckedChange={(v) => setConfirmBypass(Boolean(v))}
                  data-testid="checkbox-confirm-bypass"
                />
                <Label htmlFor="confirm-bypass" className="text-xs cursor-pointer">
                  أؤكد أن هذا إعلان حرج ويستحق تجاوز إعدادات المستخدم
                </Label>
              </div>
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => send.mutate("bypass")}
                disabled={!canSend || !confirmBypass || send.isPending}
                data-testid="button-broadcast-bypass"
              >
                {send.isPending ? "جاري الإرسال..." : "إرسال للجميع (تجاوز)"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {lastResult && (
          <Card className="mt-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200">
            <CardContent className="py-4">
              <p className="text-sm">
                ✅ آخر بث: تم الإرسال إلى <b>{lastResult.recipients}</b> مستخدم
                <span className="text-muted-foreground"> ({lastResult.mode === "bypass" ? "تجاوز" : "بموافقة"})</span>
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
