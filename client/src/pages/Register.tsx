import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { User, Phone, MapPin, Building2, ArrowLeft, Globe, Map, Users, ShoppingCart, Mail, Lock, Eye, EyeOff } from "lucide-react";
import oyoLogo from "@assets/FB_IMG_1748731871206_1766877101101.jpg";

const YEMENI_GOVERNORATES = [
  "أمانة العاصمة",
  "عدن",
  "تعز",
  "الحديدة",
  "إب",
  "ذمار",
  "حضرموت",
  "المهرة",
  "أبين",
  "لحج",
  "البيضاء",
  "مأرب",
  "صعدة",
  "عمران",
  "حجة",
  "المحويت",
  "ريمة",
  "الضالع",
  "شبوة",
  "الجوف",
  "صنعاء"
];

const BUSINESS_TYPES = [
  "محل تجاري",
  "مطعم أو مقهى",
  "سوبر ماركت",
  "شركة تغليف",
  "مصنع",
  "مخبز وحلويات",
  "صيدلية",
  "محل ملابس",
  "محل هدايا",
  "مستشفى أو عيادة",
  "فندق",
  "شركة مواد غذائية",
  "أخرى"
];

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    phone: "",
    country: "اليمن",
    governorate: "",
    district: "",
    city: "",
    neighborhood: "",
    street: "",
    landmark: "",
    businessType: "",
    accountType: "",
  });

  const registerMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/auth/register", {
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        phone: data.phone,
        accountType: data.accountType || "customer",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "فشل إنشاء الحساب");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "تم إنشاء الحساب",
        description: "مرحباً بك في أويو بلاست!",
      });
      window.location.href = "/";
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateStep1 = () => {
    if (!formData.email) {
      toast({ title: "خطأ", description: "البريد الإلكتروني مطلوب", variant: "destructive" });
      return false;
    }
    if (!validateEmail(formData.email)) {
      toast({ title: "خطأ", description: "البريد الإلكتروني غير صالح (مثال: example@email.com)", variant: "destructive" });
      return false;
    }
    if (formData.password.length < 6) {
      toast({ title: "خطأ", description: "كلمة المرور يجب أن تكون 6 أحرف على الأقل", variant: "destructive" });
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      toast({ title: "خطأ", description: "كلمتا المرور غير متطابقتين", variant: "destructive" });
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.accountType) {
      toast({ title: "خطأ", description: "يرجى اختيار نوع الحساب", variant: "destructive" });
      return false;
    }
    if (!formData.fullName || formData.fullName.length < 2) {
      toast({ title: "خطأ", description: "الاسم الكامل مطلوب", variant: "destructive" });
      return false;
    }
    if (!formData.phone) {
      toast({ title: "خطأ", description: "رقم الجوال مطلوب", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep2()) return;
    registerMutation.mutate(formData);
  };

  return (
    <div className="min-h-screen p-4 bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-background">
      <div className="max-w-lg mx-auto">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => step === 1 ? setLocation("/auth") : setStep(1)}
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 ml-2" />
          {step === 1 ? "رجوع لتسجيل الدخول" : "رجوع"}
        </Button>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-20 h-20 mb-4">
              <img src={oyoLogo} alt="OYO PLAST" className="w-full h-full object-contain rounded-xl" />
            </div>
            <CardTitle className="text-2xl">إنشاء حساب جديد</CardTitle>
            <CardDescription>
              {step === 1 ? "أدخل بريدك الإلكتروني وكلمة المرور" : "أكمل بياناتك الشخصية"}
            </CardDescription>
            <div className="flex justify-center gap-2 mt-4">
              <div className={`w-3 h-3 rounded-full ${step >= 1 ? "bg-sky-500" : "bg-gray-300"}`} />
              <div className={`w-3 h-3 rounded-full ${step >= 2 ? "bg-sky-500" : "bg-gray-300"}`} />
            </div>
          </CardHeader>
          <CardContent>
            {step === 1 ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">البريد الإلكتروني *</Label>
                  <div className="relative">
                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="pr-10"
                      placeholder="example@email.com"
                      dir="ltr"
                      data-testid="input-email"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">كلمة المرور *</Label>
                  <div className="relative">
                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="pr-10 pl-10"
                      placeholder="6 أحرف على الأقل"
                      dir="ltr"
                      data-testid="input-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">تأكيد كلمة المرور *</Label>
                  <div className="relative">
                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className="pr-10"
                      placeholder="أعد كتابة كلمة المرور"
                      dir="ltr"
                      data-testid="input-confirm-password"
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={handleNext}
                  className="w-full bg-sky-500 hover:bg-sky-600"
                  data-testid="button-next"
                >
                  التالي
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  لديك حساب بالفعل؟{" "}
                  <Link href="/auth" className="text-sky-500 hover:underline">
                    تسجيل الدخول
                  </Link>
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-3">
                  <Label className="text-lg font-bold text-center block">نوع الحساب *</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, accountType: "customer" })}
                      className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                        formData.accountType === "customer"
                          ? "border-sky-500 bg-sky-50 dark:bg-sky-900/20"
                          : "border-gray-200 dark:border-gray-700 hover:border-sky-300"
                      }`}
                      data-testid="button-account-type-customer"
                    >
                      <ShoppingCart className={`w-8 h-8 ${formData.accountType === "customer" ? "text-sky-500" : "text-gray-400"}`} />
                      <span className={`font-bold ${formData.accountType === "customer" ? "text-sky-600" : "text-foreground"}`}>عميل</span>
                      <span className="text-xs text-muted-foreground text-center">للشراء والتسوق</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, accountType: "marketer" })}
                      className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                        formData.accountType === "marketer"
                          ? "border-sky-500 bg-sky-50 dark:bg-sky-900/20"
                          : "border-gray-200 dark:border-gray-700 hover:border-sky-300"
                      }`}
                      data-testid="button-account-type-marketer"
                    >
                      <Users className={`w-8 h-8 ${formData.accountType === "marketer" ? "text-sky-500" : "text-gray-400"}`} />
                      <span className={`font-bold ${formData.accountType === "marketer" ? "text-sky-600" : "text-foreground"}`}>مسوق</span>
                      <span className="text-xs text-muted-foreground text-center">للتسويق والعمولات</span>
                    </button>
                  </div>
                </div>

                <div className="border-t pt-4" />

                <div className="space-y-2">
                  <Label htmlFor="fullName">الاسم الكامل *</Label>
                  <div className="relative">
                    <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="pr-10"
                      placeholder="اسمك الكامل"
                      data-testid="input-full-name"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">رقم الجوال *</Label>
                  <div className="relative">
                    <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="pr-10"
                      placeholder="777123456"
                      dir="ltr"
                      data-testid="input-phone"
                    />
                  </div>
                </div>

                <div className="border-t pt-4 mt-4">
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-sky-500" />
                    العنوان (اختياري)
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="governorate">المحافظة</Label>
                      <Select
                        value={formData.governorate}
                        onValueChange={(value) => setFormData({ ...formData, governorate: value })}
                      >
                        <SelectTrigger data-testid="select-governorate">
                          <SelectValue placeholder="اختر المحافظة" />
                        </SelectTrigger>
                        <SelectContent>
                          {YEMENI_GOVERNORATES.map((gov) => (
                            <SelectItem key={gov} value={gov}>
                              {gov}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">المدينة</Label>
                        <Input
                          id="city"
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          placeholder="المدينة"
                          data-testid="input-city"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="neighborhood">الحي</Label>
                        <Input
                          id="neighborhood"
                          value={formData.neighborhood}
                          onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                          placeholder="اسم الحي"
                          data-testid="input-neighborhood"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="businessType">نوع النشاط التجاري (اختياري)</Label>
                    <Select
                      value={formData.businessType}
                      onValueChange={(value) => setFormData({ ...formData, businessType: value })}
                    >
                      <SelectTrigger data-testid="select-business-type">
                        <Building2 className="w-4 h-4 ml-2 text-muted-foreground" />
                        <SelectValue placeholder="اختر نوع النشاط" />
                      </SelectTrigger>
                      <SelectContent>
                        {BUSINESS_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-sky-500 hover:bg-sky-600"
                  disabled={registerMutation.isPending}
                  data-testid="button-register"
                >
                  {registerMutation.isPending ? "جاري إنشاء الحساب..." : "إنشاء الحساب"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
