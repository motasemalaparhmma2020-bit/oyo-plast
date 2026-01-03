import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, LogIn } from "lucide-react";
import { Link } from "wouter";
import oyoLogo from "@assets/FB_IMG_1748731871206_1766877101101.jpg";

export default function Auth() {
  const handleLogin = () => {
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
            <CardTitle className="text-2xl">مرحباً بك</CardTitle>
            <CardDescription>
              سجل دخولك أو أنشئ حساب جديد للمتابعة
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <Button 
              className="w-full h-12 text-lg font-bold shadow-lg bg-[#2196F3] hover:bg-[#1976D2]" 
              onClick={handleLogin}
              data-testid="button-login"
            >
              <LogIn className="h-5 w-5 ml-2" />
              تسجيل الدخول
            </Button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">أو</span>
              </div>
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
            
            <p className="text-xs text-center text-muted-foreground mt-4">
              منصة آمنة وموثوقة لجميع احتياجات التغليف الخاصة بك
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
