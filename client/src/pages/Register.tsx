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
import { User, Phone, MapPin, Building2, ArrowLeft, Globe, Map, Users, ShoppingCart } from "lucide-react";
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
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    phone: user?.phone || "",
    country: user?.country || "اليمن",
    governorate: user?.governorate || "",
    district: user?.district || "",
    city: user?.city || "",
    neighborhood: user?.neighborhood || "",
    street: user?.street || "",
    landmark: user?.landmark || "",
    businessType: user?.businessType || "",
    accountType: user?.accountType || "",
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
    
    if (!formData.accountType) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار نوع الحساب (مسوق أو عميل)",
        variant: "destructive",
      });
      return;
    }
    
    if (!formData.firstName || !formData.phone || !formData.governorate) {
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
      <div className="max-w-lg mx-auto">
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
              {/* Account Type Selection - REQUIRED */}
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

              <div className="border-t pt-4 mt-4">
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-sky-500" />
                  العنوان
                </h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="country">الدولة</Label>
                    <div className="relative">
                      <Globe className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="country"
                        value={formData.country}
                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                        className="pr-10"
                        placeholder="اليمن"
                        data-testid="input-country"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="governorate">المحافظة *</Label>
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
                      <Label htmlFor="district">المديرية</Label>
                      <Input
                        id="district"
                        value={formData.district}
                        onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                        placeholder="المديرية"
                        data-testid="input-district"
                      />
                    </div>
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
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="neighborhood">المنطقة / الحي</Label>
                      <Input
                        id="neighborhood"
                        value={formData.neighborhood}
                        onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                        placeholder="اسم الحي"
                        data-testid="input-neighborhood"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="street">الشارع</Label>
                      <Input
                        id="street"
                        value={formData.street}
                        onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                        placeholder="اسم الشارع"
                        data-testid="input-street"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="landmark">علامة مميزة (اختياري)</Label>
                    <div className="relative">
                      <Map className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="landmark"
                        value={formData.landmark}
                        onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
                        className="pr-10"
                        placeholder="بجوار محل... أو أمام مسجد..."
                        data-testid="input-landmark"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
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
