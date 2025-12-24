import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";

export default function Auth() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="bg-primary inline-flex p-3 rounded-2xl mb-4 shadow-xl shadow-primary/20">
            <Package className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-foreground">باكجنج برو</h1>
          <p className="text-muted-foreground mt-2">وجهتك الأولى لحلول التغليف المتكاملة</p>
        </div>
        
        <Card className="border-none shadow-xl">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl">تسجيل الدخول</CardTitle>
            <CardDescription>
              سجل دخولك للمتابعة وإتمام طلباتك
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Button 
              className="w-full h-12 text-lg font-bold shadow-lg shadow-primary/10" 
              onClick={handleLogin}
            >
              تسجيل الدخول باستخدام Replit
            </Button>
            
            <p className="text-xs text-center text-muted-foreground mt-6">
              منصة آمنة وموثوقة لجميع احتياجات التغليف الخاصة بك
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
