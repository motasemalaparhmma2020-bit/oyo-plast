import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { User, Phone, MapPin, Building2, ArrowLeft } from "lucide-react";
import oyoLogo from "@assets/generated_images/oyo_plast_company_logo.png";

const YEMENI_CITIES = [
  "صنعاء", "عدن", "تعز", "الحديدة", "إب", "ذمار", "المكلا", "سيئون",
  "زنجبار", "لحج", "البيضاء", "مأرب", "صعدة", "عمران", "حجة", "المحويت", "ريمة", "الضالع"
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
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    phone: user?.phone || "",
    address: user?.address || "",
    city: user?.city || "",
    businessType: user?.businessType || "",
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("PATCH", "/api/user/profile", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "تم الحفظ",
        description: "تم حفظ بياناتك بنجاح",
      });
      setLocation("/");
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حفظ البيانات",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.firstName || !formData.phone || !formData.city) {
      toast({
        title: "خطأ",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive",
      });
      return;
    }

    updateProfileMutation.mutate(formData);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-20 h-20 mb-4">
              <img src={oyoLogo} alt="OYO PLAST" className="w-full h-full object-contain" />
            </div>
            <CardTitle className="text-2xl">تسجيل حساب جديد</CardTitle>
            <CardDescription>يرجى تسجيل الدخول أولاً</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full bg-sky-500 hover:bg-sky-600" 
              onClick={() => setLocation("/auth")}
              data-testid="button-go-to-login"
            >
              تسجيل الدخول
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-background">
      <div className="max-w-md mx-auto">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => setLocation("/")}
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 ml-2" />
          رجوع
        </Button>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-20 h-20 mb-4">
              <img src={oyoLogo} alt="OYO PLAST" className="w-full h-full object-contain" />
            </div>
            <CardTitle className="text-2xl">أكمل بياناتك</CardTitle>
            <CardDescription>أضف معلوماتك للحصول على تجربة تسوق أفضل</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">الاسم الأول *</Label>
                  <div className="relative">
                    <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="pr-10"
                      placeholder="الاسم الأول"
                      data-testid="input-first-name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">اسم العائلة</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    placeholder="اسم العائلة"
                    data-testid="input-last-name"
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

              <div className="space-y-2">
                <Label htmlFor="city">المدينة *</Label>
                <Select
                  value={formData.city}
                  onValueChange={(value) => setFormData({ ...formData, city: value })}
                >
                  <SelectTrigger data-testid="select-city">
                    <SelectValue placeholder="اختر المدينة" />
                  </SelectTrigger>
                  <SelectContent>
                    {YEMENI_CITIES.map((city) => (
                      <SelectItem key={city} value={city}>
                        {city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">العنوان التفصيلي</Label>
                <div className="relative">
                  <MapPin className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="pr-10"
                    placeholder="الحي، الشارع، رقم المبنى"
                    data-testid="input-address"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessType">نوع النشاط التجاري</Label>
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

              <Button
                type="submit"
                className="w-full bg-sky-500 hover:bg-sky-600"
                disabled={updateProfileMutation.isPending}
                data-testid="button-save-profile"
              >
                {updateProfileMutation.isPending ? "جاري الحفظ..." : "حفظ البيانات"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
