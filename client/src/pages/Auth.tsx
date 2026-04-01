import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { UserPlus, LogIn, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Link } from "wouter";
import oyoLogo from "@assets/FB_IMG_1748731871206_1766877101101.jpg";

export default function Auth() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const loginMutation = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const response = await apiRequest("POST", "/api/auth/login", data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "فشل تسجيل الدخول");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "تم تسجيل الدخول",
        description: "مرحباً بك في أويو بلاست",
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      toast({
        title: "خطأ",
        description: "يرجى ملء جميع الحقول",
        variant: "destructive",
      });
      return;
    }
    if (!validateEmail(formData.email)) {
      toast({
        title: "خطأ",
        description: "البريد الإلكتروني غير صالح",
        variant: "destructive",
      });
      return;
    }
    if (formData.password.length < 6) {
      toast({
        title: "خطأ",
        description: "كلمة المرور يجب أن تكون 6 أحرف على الأقل",
        variant: "destructive",
      });
      return;
    }
    loginMutation.mutate(formData);
  };

  const handleReplitLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-background flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="mx-auto w-24 h-24 mb-4">
            <img src={oyoLogo} alt="OYO PLAST" className="w-full h-full object-contain rounded-2xl shadow-lg" />
          </div>
          <h1 className="text-3xl font-extrabold text-foreground">أويو بلاست</h1>
          <p className="text-muted-foreground mt-2">لطباعة ومستلزمات البلاستيك</p>
        </div>
        
        <Card className="border-none shadow-xl">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl">تسجيل الدخول</CardTitle>
            <CardDescription>
              أدخل بريدك الإلكتروني وكلمة المرور للمتابعة
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
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
                <Label htmlFor="password">كلمة المرور</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="pr-10 pl-10"
                    placeholder="كلمة المرور"
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

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="rememberMe"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                    data-testid="checkbox-remember-me"
                  />
                  <Label htmlFor="rememberMe" className="font-normal text-sm cursor-pointer">
                    تذكرني
                  </Label>
                </div>
                <Link href="/forgot-password">
                  <button 
                    type="button"
                    className="text-sm text-[#2196F3] hover:underline"
                    data-testid="link-forgot-password"
                  >
                    هل نسيت كلمتك؟
                  </button>
                </Link>
              </div>

              <Button 
                type="submit"
                className="w-full h-12 text-lg font-bold shadow-lg bg-[#2196F3] hover:bg-[#1976D2]" 
                disabled={loginMutation.isPending}
                data-testid="button-login"
              >
                {loginMutation.isPending ? (
                  "جاري تسجيل الدخول..."
                ) : (
                  <>
                    <LogIn className="h-5 w-5 ml-2" />
                    تسجيل الدخول
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 space-y-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">طرق أخرى</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-12 font-bold"
                  data-testid="button-google-login"
                >
                  <svg className="w-5 h-5 ml-2" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google
                </Button>
                <Button
                  variant="outline"
                  className="h-12 font-bold"
                  data-testid="button-apple-login"
                >
                  <svg className="w-5 h-5 ml-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.05 13.5c-.91 0-1.82.55-2.25 1.51.93.64 1.86 1.89 1.86 3.78 0 2.18-1.36 3.66-3.41 3.66-1.95 0-3.66-1.59-3.66-4.04 0-3.27 2.18-5.54 5.4-5.54.51 0 1.02.05 1.5.15-.09.6-.14 1.15-.14 1.82 0 2.05 1.3 4.07 3.41 4.07.81 0 1.64-.27 2.3-.81-1.02-2.08-2.55-3.6-4.01-3.6zm2.45.18c1.28 0 2.3-1.02 2.3-2.3 0-1.28-1.02-2.3-2.3-2.3s-2.3 1.02-2.3 2.3c0 1.28 1.02 2.3 2.3 2.3zm-11-4.54c-1.09 0-2.07-.79-2.3-1.86h6.64c.19-2.27 1.89-4.02 4.04-4.02 2.3 0 4.03 1.89 4.03 4.04 0 .29-.02.58-.07.86.07.81.13 1.61.13 2.44 0 3.02-1.55 4.53-3.36 4.53-1.7 0-2.89-1.02-3.91-2.35.74 1.28 2.44 2.04 4.04 2.04 2.55 0 4.25-1.64 4.25-4.33 0-1.46-.69-2.73-1.75-3.59-.79 1.16-1.86 2.08-3.16 2.08-2.34 0-3.59-1.87-3.59-4.04 0-.51.05-1.02.14-1.51-.62-.19-1.27-.27-1.93-.27z"/>
                  </svg>
                  Apple
                </Button>
              </div>
              
              <Link href="/register">
                <Button 
                  variant="outline"
                  className="w-full h-12 text-lg font-bold border-2 border-[#2196F3] text-[#2196F3] hover:bg-[#2196F3]/10"
                  data-testid="button-register"
                >
                  <UserPlus className="h-5 w-5 ml-2" />
                  إنشاء حساب جديد
                </Button>
              </Link>

              <Button 
                variant="ghost"
                className="w-full text-muted-foreground hover:text-foreground"
                onClick={handleReplitLogin}
                data-testid="button-replit-login"
              >
                تسجيل الدخول عبر Replit
              </Button>
              
              <p className="text-xs text-center text-muted-foreground mt-4">
                منصة آمنة وموثوقة لجميع احتياجات التغليف الخاصة بك
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
