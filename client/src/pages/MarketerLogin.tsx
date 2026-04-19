import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock, Phone, Megaphone } from "lucide-react";

export default function MarketerLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");

  const loginMutation = useMutation({
    mutationFn: async (data: { phone: string; pin: string }) => {
      const res = await apiRequest("POST", "/api/marketer/login", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      localStorage.setItem("marketerToken", data.token);
      localStorage.setItem("marketerData", JSON.stringify(data.marketer));
      setLocation("/marketer/dashboard");
    },
    onError: (e: any) =>
      toast({ title: "خطأ في الدخول", description: e.message || "الهاتف أو الرقم السري غير صحيح", variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !pin)
      return toast({ title: "بيانات ناقصة", description: "أدخل رقم الهاتف والرقم السري", variant: "destructive" });
    loginMutation.mutate({ phone: phone.trim(), pin });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Megaphone className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">لوحة المسوّقين</h1>
          <p className="text-gray-500 text-sm mt-1">أويو بلاست</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">تسجيل الدخول</h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label className="mb-1.5 block text-gray-700">رقم الهاتف</Label>
              <div className="relative">
                <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  data-testid="input-marketer-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="77X XXX XXXX"
                  className="pr-9 text-left"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <Label className="mb-1.5 block text-gray-700">الرقم السري (PIN)</Label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  data-testid="input-marketer-pin"
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••"
                  maxLength={8}
                  className="pr-9 text-center tracking-widest"
                />
              </div>
            </div>

            <Button
              data-testid="button-marketer-login"
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 text-base font-semibold"
            >
              {loginMutation.isPending ? "جارٍ التحقق..." : "دخول"}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-6">
            لا تملك حساباً بعد؟{" "}
            <button
              onClick={() => setLocation("/join-marketer")}
              className="text-emerald-600 font-medium hover:underline"
            >
              سجّل معنا
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
