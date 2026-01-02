import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Users, ArrowLeft, Check } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import logoPath from "@assets/FB_IMG_1748731871206_1766877101101.jpg";

export default function AccountTypeSelection() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const updateAccountTypeMutation = useMutation({
    mutationFn: async (accountType: "customer" | "marketer") => {
      const res = await apiRequest("POST", "/api/user/account-type", { accountType });
      return res.json();
    },
    onSuccess: (data, accountType) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      if (accountType === "marketer") {
        setLocation("/register-marketer");
      } else {
        setLocation("/register-customer");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "حدث خطأ",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-background flex flex-col" dir="rtl">
      <header className="sticky top-0 z-50 bg-background border-b p-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setLocation("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold">إنشاء حساب جديد</h1>
        </div>
      </header>

      <main className="flex-1 p-4 pb-8">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <img 
              src={logoPath} 
              alt="أويو بلاست" 
              className="w-24 h-24 mx-auto rounded-full object-cover mb-4"
            />
            <h2 className="text-2xl font-bold text-foreground mb-2">
              مرحباً بك في أويو بلاست
            </h2>
            <p className="text-muted-foreground">
              اختر نوع حسابك للمتابعة
            </p>
          </div>

          <div className="space-y-4">
            <Card 
              className="cursor-pointer transition-all border-2 hover:border-primary"
              onClick={() => updateAccountTypeMutation.mutate("customer")}
              data-testid="card-customer-type"
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    <ShoppingBag className="h-8 w-8 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold mb-1">عميل</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      للتسوق وشراء المنتجات لنفسك أو لعملك
                    </p>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>تصفح وشراء المنتجات</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>اكسب نقاط مكافآت</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>تتبع طلباتك بسهولة</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer transition-all border-2 hover:border-primary"
              onClick={() => updateAccountTypeMutation.mutate("marketer")}
              data-testid="card-marketer-type"
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-full bg-amber-500/10">
                    <Users className="h-8 w-8 text-amber-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold mb-1">مسوق / موزع</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      للتسويق والبيع لعملائك مقابل عمولة على كل طلب
                    </p>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>احصل على عمولة على كل طلب</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>سجل طلبات لعملائك</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>تتبع أرباحك ومحفظتك</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>اسحب أرباحك بسهولة</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-6">
            بالمتابعة، أنت توافق على <a href="/terms" className="text-primary underline">شروط الاستخدام</a> و <a href="/privacy" className="text-primary underline">سياسة الخصوصية</a>
          </p>
        </div>
      </main>
    </div>
  );
}
