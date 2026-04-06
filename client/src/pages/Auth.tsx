import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Phone, MessageCircle, Smartphone, ArrowRight, Loader2,
  CheckCircle, RefreshCw, User, Mail, Lock, Eye, EyeOff, ChevronDown
} from "lucide-react";
import { Link } from "wouter";
import oyoLogo from "@assets/FB_IMG_1748731871206_1766877101101.jpg";

// ── أكواد الدول الشائعة ──────────────────────────────────────────
const COUNTRY_CODES = [
  { code: "+967", flag: "🇾🇪", name: "اليمن" },
  { code: "+966", flag: "🇸🇦", name: "السعودية" },
  { code: "+974", flag: "🇶🇦", name: "قطر" },
  { code: "+971", flag: "🇦🇪", name: "الإمارات" },
  { code: "+965", flag: "🇰🇼", name: "الكويت" },
  { code: "+973", flag: "🇧🇭", name: "البحرين" },
  { code: "+968", flag: "🇴🇲", name: "عُمان" },
  { code: "+962", flag: "🇯🇴", name: "الأردن" },
  { code: "+20",  flag: "🇪🇬", name: "مصر" },
];

type Step = "phone" | "otp" | "name";
type Channel = "whatsapp" | "sms";
type LoginMode = "phone" | "email";

export default function Auth() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // إعدادات تسجيل الدخول من لوحة الإدارة
  const { data: navSettings } = useQuery<any>({
    queryKey: ["/api/navigation-settings"],
    staleTime: 60000,
  });
  const enablePhone = navSettings?.enablePhoneLogin ?? true;
  const enableEmail = navSettings?.enableEmailLogin ?? true;

  const [loginMode, setLoginMode] = useState<LoginMode>("phone");
  const [step, setStep] = useState<Step>("phone");
  const [channel, setChannel] = useState<Channel>("sms");
  const [countryCode, setCountryCode] = useState(COUNTRY_CODES[0]);
  const [showCountries, setShowCountries] = useState(false);
  const [normalizedPhone, setNormalizedPhone] = useState("");

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [fullName, setFullName] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);

  // العدّاد
  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef<NodeJS.Timeout>();

  // البريد الإلكتروني
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // بدء عدّاد إعادة الإرسال
  const startResendTimer = () => {
    setResendTimer(60);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  // ── مساعد: استخراج رسالة الخطأ بوضوح من أي استجابة ──────────────
  const extractErrorMessage = (err: Error): string => {
    // الخطأ يأتي بشكل "500: {"message":"..."}" — نستخرج الرسالة العربية
    try {
      const match = err.message.match(/^\d+:\s*([\s\S]+)$/);
      if (match) {
        const parsed = JSON.parse(match[1]);
        if (parsed.message) return parsed.message;
      }
    } catch {}
    return err.message;
  };

  // ── إرسال OTP ──────────────────────────────────────────────────
  const sendOtpMutation = useMutation({
    mutationFn: async () => {
      const rawPhone = `${countryCode.code}${phone.replace(/^0/, "")}`;
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone: rawPhone, channel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "فشل إرسال الرمز");
      return data;
    },
    onSuccess: (data) => {
      setNormalizedPhone(data.phone || "");
      // تحديث القناة الفعلية إن غيّرها السيرفر (مثلاً من واتساب لـ SMS تلقائياً)
      if (data.channel && (data.channel === "sms" || data.channel === "whatsapp")) {
        setChannel(data.channel as Channel);
      }
      setStep("otp");
      startResendTimer();
      toast({ title: "✅ تم الإرسال", description: data.message });
      // في وضع التطوير: عرض الكود تلقائياً
      if (data.devCode) {
        const digits = data.devCode.split("");
        setOtp(digits);
        setTimeout(() => otpRefs.current[5]?.focus(), 100);
        toast({ title: `كود التطوير: ${data.devCode}`, description: "هذا فقط في بيئة التطوير" });
      } else {
        setTimeout(() => otpRefs.current[0]?.focus(), 300);
      }
    },
    onError: (err: Error) => {
      toast({ title: "تعذّر إرسال الرمز", description: extractErrorMessage(err), variant: "destructive" });
    },
  });

  // ── التحقق من OTP ──────────────────────────────────────────────
  const verifyOtpMutation = useMutation({
    mutationFn: async (nameOverride?: string) => {
      const code = otp.join("");
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone: normalizedPhone, code, fullName: nameOverride || fullName || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "الرمز غير صحيح");
      return data;
    },
    onSuccess: (data) => {
      if (data.isNewUser && !fullName) {
        setIsNewUser(true);
        setStep("name");
        return;
      }
      toast({ title: "🎉 مرحباً بك!", description: "تم تسجيل الدخول بنجاح" });
      window.location.href = "/";
    },
    onError: (err: Error) => {
      toast({ title: "رمز غير صحيح", description: err.message, variant: "destructive" });
      setOtp(["", "", "", "", "", ""]);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    },
  });

  // ── تسجيل دخول بالبريد ──────────────────────────────────────────
  const emailLoginMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "فشل تسجيل الدخول");
      return data;
    },
    onSuccess: () => {
      toast({ title: "✅ تم تسجيل الدخول" });
      window.location.href = "/";
    },
    onError: (err: Error) => {
      toast({ title: "فشل تسجيل الدخول", description: err.message, variant: "destructive" });
    },
  });

  // ── معالجة إدخال OTP ────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
    if (newOtp.every(d => d) && newOtp.join("").length === 6) {
      setTimeout(() => verifyOtpMutation.mutate(), 100);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length === 6) {
      setOtp(text.split(""));
      setTimeout(() => verifyOtpMutation.mutate(), 200);
    }
  };

  // ── واجهة الخطوة 1: الهاتف ──────────────────────────────────────
  const renderPhoneStep = () => (
    <div className="space-y-5">
      {/* قناة الإرسال */}
      <div className="flex rounded-xl overflow-hidden border-2 border-primary/20">
        {(["sms", "whatsapp"] as Channel[]).map((ch) => (
          <button
            key={ch}
            type="button"
            onClick={() => setChannel(ch)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold transition-colors ${
              channel === ch
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted/50"
            }`}
            data-testid={`button-channel-${ch}`}
          >
            {ch === "whatsapp" ? (
              <><MessageCircle className="h-4 w-4" /> واتساب</>
            ) : (
              <><Smartphone className="h-4 w-4" /> رسالة نصية</>
            )}
          </button>
        ))}
      </div>

      {/* حقل الهاتف */}
      <div>
        <label className="text-sm font-semibold text-foreground mb-1.5 block">رقم الهاتف</label>
        <div className="flex gap-2">
          {/* كود الدولة */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowCountries(!showCountries)}
              className="flex items-center gap-1.5 px-3 h-11 rounded-lg border-2 border-input bg-background hover:border-primary transition-colors text-sm font-bold min-w-[90px]"
              data-testid="button-country-code"
            >
              <span className="text-lg">{countryCode.flag}</span>
              <span className="text-xs">{countryCode.code}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
            {showCountries && (
              <div className="absolute top-12 right-0 z-50 bg-background border rounded-xl shadow-xl overflow-hidden min-w-[180px]">
                {COUNTRY_CODES.map(c => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => { setCountryCode(c); setShowCountries(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted text-sm"
                  >
                    <span className="text-lg">{c.flag}</span>
                    <span className="font-medium">{c.name}</span>
                    <span className="text-muted-foreground mr-auto">{c.code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* رقم الهاتف */}
          <Input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value.replace(/\D/g, ""))}
            placeholder={countryCode.code === "+967" ? "7XXXXXXXX" : "5XXXXXXXX"}
            className="flex-1 h-11 text-base font-mono"
            dir="ltr"
            onKeyDown={e => e.key === "Enter" && sendOtpMutation.mutate()}
            data-testid="input-phone"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          سيصلك رمز التحقق على {channel === "whatsapp" ? "واتساب" : "رسالة نصية"}
        </p>
        {channel === "whatsapp" && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            ⚠️ إذا لم تستلم عبر واتساب، جرّب "رسالة نصية"
          </p>
        )}
      </div>

      <Button
        className="w-full h-12 text-base font-extrabold rounded-xl shadow-lg"
        onClick={() => sendOtpMutation.mutate()}
        disabled={sendOtpMutation.isPending || phone.length < 7}
        data-testid="button-send-otp"
      >
        {sendOtpMutation.isPending ? (
          <><Loader2 className="h-4 w-4 animate-spin ml-2" />جاري الإرسال...</>
        ) : (
          <>{channel === "whatsapp" ? <MessageCircle className="h-4 w-4 ml-2" /> : <Smartphone className="h-4 w-4 ml-2" />}إرسال رمز التحقق</>
        )}
      </Button>
    </div>
  );

  // ── واجهة الخطوة 2: OTP ────────────────────────────────────────
  const renderOtpStep = () => (
    <div className="space-y-5">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-3">
          {channel === "whatsapp" ? (
            <MessageCircle className="h-8 w-8 text-primary" />
          ) : (
            <Smartphone className="h-8 w-8 text-primary" />
          )}
        </div>
        <h3 className="font-extrabold text-lg">أدخل رمز التحقق</h3>
        <p className="text-sm text-muted-foreground mt-1">
          أُرسل إلى <span className="font-bold text-foreground dir-ltr">{normalizedPhone}</span>
          {" "}عبر {channel === "whatsapp" ? "واتساب" : "رسالة نصية"}
        </p>
      </div>

      {/* حقول OTP */}
      <div className="flex gap-2 justify-center" dir="ltr">
        {otp.map((digit, i) => (
          <input
            key={i}
            ref={el => { otpRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={e => handleOtpChange(i, e.target.value)}
            onKeyDown={e => handleOtpKeyDown(i, e)}
            onPaste={i === 0 ? handleOtpPaste : undefined}
            className={`w-12 h-14 text-center text-2xl font-extrabold border-2 rounded-xl outline-none transition-colors ${
              digit ? "border-primary bg-primary/5 text-primary" : "border-input bg-background"
            } focus:border-primary`}
            data-testid={`input-otp-${i}`}
          />
        ))}
      </div>

      {/* زر التحقق */}
      <Button
        className="w-full h-12 text-base font-extrabold rounded-xl"
        onClick={() => verifyOtpMutation.mutate()}
        disabled={verifyOtpMutation.isPending || otp.join("").length < 6}
        data-testid="button-verify-otp"
      >
        {verifyOtpMutation.isPending ? (
          <><Loader2 className="h-4 w-4 animate-spin ml-2" />جاري التحقق...</>
        ) : (
          <><CheckCircle className="h-4 w-4 ml-2" />تأكيد الرمز</>
        )}
      </Button>

      {/* إعادة الإرسال */}
      <div className="text-center space-y-2">
        {resendTimer > 0 ? (
          <p className="text-sm text-muted-foreground">
            يمكنك إعادة الإرسال بعد <span className="font-bold text-primary">{resendTimer}</span> ثانية
          </p>
        ) : (
          <button
            type="button"
            onClick={() => sendOtpMutation.mutate()}
            disabled={sendOtpMutation.isPending}
            className="text-sm text-primary hover:underline font-semibold flex items-center justify-center gap-1 mx-auto"
            data-testid="button-resend-otp"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            إعادة إرسال الرمز
          </button>
        )}
        <button
          type="button"
          onClick={() => { setStep("phone"); setOtp(["", "", "", "", "", ""]); }}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 mx-auto"
          data-testid="button-back-to-phone"
        >
          <ArrowRight className="h-3 w-3" />
          تغيير رقم الهاتف
        </button>
      </div>
    </div>
  );

  // ── واجهة الخطوة 3: الاسم (مستخدم جديد) ──────────────────────
  const renderNameStep = () => (
    <div className="space-y-5">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-3">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="font-extrabold text-lg">تم التحقق ✅</h3>
        <p className="text-sm text-muted-foreground mt-1">أدخل اسمك لإكمال إنشاء الحساب</p>
      </div>

      <div>
        <label className="text-sm font-semibold mb-1.5 block">الاسم الكامل</label>
        <div className="relative">
          <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="مثال: محمد أحمد"
            className="h-11 pr-10"
            onKeyDown={e => e.key === "Enter" && fullName.trim().length >= 2 && verifyOtpMutation.mutate(fullName)}
            data-testid="input-full-name"
          />
        </div>
      </div>

      <Button
        className="w-full h-12 text-base font-extrabold rounded-xl"
        onClick={() => verifyOtpMutation.mutate(fullName)}
        disabled={verifyOtpMutation.isPending || fullName.trim().length < 2}
        data-testid="button-complete-profile"
      >
        {verifyOtpMutation.isPending ? (
          <><Loader2 className="h-4 w-4 animate-spin ml-2" />جاري الإنشاء...</>
        ) : "إنشاء الحساب والدخول"}
      </Button>

      <button
        type="button"
        onClick={() => verifyOtpMutation.mutate("")}
        className="w-full text-xs text-muted-foreground hover:text-foreground py-2"
        data-testid="button-skip-name"
      >
        تخطي (يمكن إضافة الاسم لاحقاً)
      </button>
    </div>
  );

  // ── واجهة تسجيل دخول بالبريد ────────────────────────────────────
  const renderEmailLogin = () => (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-semibold mb-1.5 block">البريد الإلكتروني</label>
        <div className="relative">
          <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="example@email.com"
            className="h-11 pr-10"
            dir="ltr"
            data-testid="input-email"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-semibold mb-1.5 block">كلمة المرور</label>
        <div className="relative">
          <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="كلمة المرور"
            className="h-11 pr-10 pl-10"
            dir="ltr"
            onKeyDown={e => e.key === "Enter" && emailLoginMutation.mutate()}
            data-testid="input-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <Button
        className="w-full h-12 text-base font-extrabold rounded-xl"
        onClick={() => emailLoginMutation.mutate()}
        disabled={emailLoginMutation.isPending}
        data-testid="button-login"
      >
        {emailLoginMutation.isPending ? (
          <><Loader2 className="h-4 w-4 animate-spin ml-2" />جاري الدخول...</>
        ) : "تسجيل الدخول"}
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex flex-col items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-sm">
        {/* الشعار */}
        <div className="text-center mb-6">
          <div className="mx-auto w-20 h-20 mb-3">
            <img src={oyoLogo} alt="OYO PLAST" className="w-full h-full object-contain rounded-2xl shadow-lg" />
          </div>
          <h1 className="text-2xl font-extrabold">أويو بلاست</h1>
          <p className="text-sm text-muted-foreground mt-1">لمستلزمات التغليف</p>
        </div>

        {/* البطاقة الرئيسية */}
        <div className="bg-card border rounded-2xl shadow-xl p-6">
          {/* تبديل بين الهاتف والبريد — يظهر فقط إذا الاثنان مفعّلان */}
          {enablePhone && enableEmail && (
            <div className="flex rounded-xl overflow-hidden border mb-5">
              <button
                type="button"
                onClick={() => { setLoginMode("phone"); setStep("phone"); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold transition-colors ${
                  loginMode === "phone" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"
                }`}
                data-testid="button-mode-phone"
              >
                <Phone className="h-4 w-4" /> رقم الهاتف
              </button>
              <button
                type="button"
                onClick={() => setLoginMode("email")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold transition-colors ${
                  loginMode === "email" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"
                }`}
                data-testid="button-mode-email"
              >
                <Mail className="h-4 w-4" /> البريد الإلكتروني
              </button>
            </div>
          )}

          {/* المحتوى — مرتبط بالإعداد الفعلي */}
          {(enablePhone && (!enableEmail || loginMode === "phone")) ? (
            <>
              {step === "phone" && renderPhoneStep()}
              {step === "otp"   && renderOtpStep()}
              {step === "name"  && renderNameStep()}
            </>
          ) : enableEmail ? (
            renderEmailLogin()
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              تسجيل الدخول غير متاح حالياً
            </div>
          )}
        </div>

        {/* روابط أسفل البطاقة */}
        <div className="text-center mt-4 space-y-2">
          {loginMode === "email" && (
            <Link href="/register">
              <button className="text-sm text-primary hover:underline font-semibold" data-testid="link-register">
                إنشاء حساب جديد بالبريد الإلكتروني
              </button>
            </Link>
          )}
          <p className="text-xs text-muted-foreground">
            منصة آمنة وموثوقة لجميع احتياجات التغليف
          </p>
        </div>
      </div>
    </div>
  );
}
