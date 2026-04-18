import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, TrendingUp, Users, DollarSign, Megaphone } from "lucide-react";

const CHANNELS = [
  { value: "whatsapp", label: "واتساب" },
  { value: "tiktok", label: "تيك توك" },
  { value: "instagram", label: "إنستغرام" },
  { value: "youtube", label: "يوتيوب" },
  { value: "facebook", label: "فيسبوك" },
  { value: "other", label: "أخرى" },
];

const AUDIENCE_SIZES = [
  { value: "small", label: "صغير (أقل من 1,000)" },
  { value: "medium", label: "متوسط (1,000 – 10,000)" },
  { value: "large", label: "كبير (أكثر من 10,000)" },
];

export default function MarketerApply() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "", phone: "", city: "", channel: "", channelHandle: "", audienceSize: "", message: "",
  });

  const applyMutation = useMutation({
    mutationFn: (data: typeof form) => apiRequest("POST", "/api/marketer/apply", data),
    onSuccess: () => setSubmitted(true),
    onError: (e: any) => toast({ title: "خطأ", description: e.message || "فشل الإرسال", variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.city || !form.channel)
      return toast({ title: "بيانات ناقصة", description: "يرجى ملء جميع الحقول المطلوبة", variant: "destructive" });
    applyMutation.mutate(form);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">تم إرسال طلبك!</h2>
          <p className="text-gray-600 mb-8">سيتواصل معك فريقنا خلال 24–48 ساعة لإكمال التسجيل ومنحك كوبونك الخاص.</p>
          <Button onClick={() => setLocation("/")} className="w-full bg-emerald-600 hover:bg-emerald-700">
            العودة للرئيسية
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50" dir="rtl">
      {/* Hero */}
      <div className="bg-gradient-to-l from-emerald-700 to-teal-600 text-white py-14 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Megaphone className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">انضم كمسوّق لأويو بلاست</h1>
          <p className="text-emerald-100 text-lg">اكسب عمولة على كل طلب يأتي عبر كوبونك الخاص</p>
        </div>
      </div>

      {/* Benefits */}
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {[
            { icon: DollarSign, title: "عمولة نقدية", desc: "حتى 5% على كل طلب" },
            { icon: Users, title: "خصم للعملاء", desc: "5% خصم لمتابعيك" },
            { icon: TrendingUp, title: "لوحة أرباح", desc: "تتبع أرباحك لحظياً" },
          ].map((b) => (
            <div key={b.title} className="bg-white rounded-xl p-5 text-center shadow-sm border border-emerald-100">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <b.icon className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="font-bold text-gray-800 mb-1">{b.title}</h3>
              <p className="text-sm text-gray-500">{b.desc}</p>
            </div>
          ))}
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-xl mx-auto">
          <h2 className="text-xl font-bold text-gray-800 mb-6">أرسل طلب الانضمام</h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 block text-gray-700">الاسم الكامل *</Label>
                <Input
                  data-testid="input-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="محمد علي"
                  className="text-right"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-gray-700">رقم الهاتف *</Label>
                <Input
                  data-testid="input-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="77X XXX XXXX"
                  dir="ltr"
                  className="text-left"
                />
              </div>
            </div>

            <div>
              <Label className="mb-1.5 block text-gray-700">المدينة *</Label>
              <Input
                data-testid="input-city"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="صنعاء، عدن، تعز..."
                className="text-right"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 block text-gray-700">قناة التسويق *</Label>
                <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                  <SelectTrigger data-testid="select-channel" className="text-right">
                    <SelectValue placeholder="اختر القناة" />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block text-gray-700">حجم الجمهور</Label>
                <Select value={form.audienceSize} onValueChange={(v) => setForm({ ...form, audienceSize: v })}>
                  <SelectTrigger data-testid="select-audience" className="text-right">
                    <SelectValue placeholder="اختر الحجم" />
                  </SelectTrigger>
                  <SelectContent>
                    {AUDIENCE_SIZES.map((a) => (
                      <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="mb-1.5 block text-gray-700">اسم الحساب / الرابط</Label>
              <Input
                data-testid="input-channel-handle"
                value={form.channelHandle}
                onChange={(e) => setForm({ ...form, channelHandle: e.target.value })}
                placeholder="@username أو رابط القناة"
                dir="ltr"
                className="text-left"
              />
            </div>

            <div>
              <Label className="mb-1.5 block text-gray-700">رسالة إضافية (اختياري)</Label>
              <Textarea
                data-testid="input-message"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="أخبرنا عن طريقة تسويقك..."
                className="text-right resize-none"
                rows={3}
              />
            </div>

            <Button
              data-testid="button-submit-apply"
              type="submit"
              disabled={applyMutation.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 text-base font-semibold"
            >
              {applyMutation.isPending ? "جارٍ الإرسال..." : "إرسال طلب الانضمام"}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-5">
            لديك حساب بالفعل؟{" "}
            <button
              onClick={() => setLocation("/marketer/login")}
              className="text-emerald-600 font-medium hover:underline"
            >
              سجّل دخولك
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
