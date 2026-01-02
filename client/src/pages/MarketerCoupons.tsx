import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { ArrowRight, Plus, Copy, Tag, Users, TrendingUp, Loader2, CheckCircle, XCircle } from "lucide-react";

interface Coupon {
  id: number;
  code: string;
  marketerId: string;
  discountPercent: number;
  marketerCommissionPercent: number;
  isActive: boolean;
  usageCount: number;
  maxUsage: number | null;
  expiresAt: string | null;
  createdAt: string;
}

export default function MarketerCoupons() {
  const { toast } = useToast();
  const [newCouponCode, setNewCouponCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState(5);
  const [commissionPercent, setCommissionPercent] = useState(5);

  const { data: coupons, isLoading } = useQuery<Coupon[]>({
    queryKey: ['/api/marketer/coupons'],
  });

  const createCouponMutation = useMutation({
    mutationFn: async (data: { code: string; discountPercent: number; marketerCommissionPercent: number }) => {
      return await apiRequest('POST', '/api/marketer/coupons', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketer/coupons'] });
      setNewCouponCode("");
      toast({
        title: "تم إنشاء الكوبون",
        description: "تم إنشاء كود الخصم بنجاح",
      });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error.message || "فشل في إنشاء الكوبون",
        variant: "destructive",
      });
    },
  });

  const handleCreateCoupon = () => {
    if (!newCouponCode || newCouponCode.length < 3) {
      toast({
        title: "خطأ",
        description: "كود الخصم يجب أن يكون 3 أحرف على الأقل",
        variant: "destructive",
      });
      return;
    }

    // Validate discount and commission percentages
    const validDiscount = discountPercent >= 1 && discountPercent <= 50 ? discountPercent : 5;
    const validCommission = commissionPercent >= 1 && commissionPercent <= 20 ? commissionPercent : 5;

    createCouponMutation.mutate({
      code: newCouponCode.toUpperCase(),
      discountPercent: validDiscount,
      marketerCommissionPercent: validCommission,
    });
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "تم النسخ",
      description: `تم نسخ الكود "${code}" إلى الحافظة`,
    });
  };

  const totalUsage = coupons?.reduce((sum, c) => sum + c.usageCount, 0) || 0;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-20 flex justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 pb-24" dir="rtl">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/profile">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowRight className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">إدارة كوبونات الخصم</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <Card data-testid="card-total-coupons">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <Tag className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">إجمالي الكوبونات</p>
              <p className="text-xl font-bold" data-testid="text-total-coupons-count">{coupons?.length || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-total-usage">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/20">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">مرات الاستخدام</p>
              <p className="text-xl font-bold" data-testid="text-total-usage-count">{totalUsage}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-2 md:col-span-1" data-testid="card-active-coupons">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/20">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">الكوبونات النشطة</p>
              <p className="text-xl font-bold" data-testid="text-active-coupons-count">{coupons?.filter(c => c.isActive).length || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create New Coupon */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            إنشاء كوبون جديد
          </CardTitle>
          <CardDescription>
            أنشئ كود خصم خاص بك ليستخدمه عملاؤك
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="coupon-code">كود الخصم</Label>
              <Input
                id="coupon-code"
                placeholder="مثال: AHMED5"
                value={newCouponCode}
                onChange={(e) => setNewCouponCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                maxLength={15}
                data-testid="input-new-coupon-code"
              />
              <p className="text-xs text-muted-foreground">أحرف إنجليزية وأرقام فقط</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount-percent">نسبة الخصم للعميل (%)</Label>
              <Input
                id="discount-percent"
                type="number"
                min={1}
                max={50}
                value={discountPercent}
                onChange={(e) => setDiscountPercent(Number(e.target.value))}
                data-testid="input-discount-percent"
              />
              <p className="text-xs text-muted-foreground">الخصم الذي يحصل عليه العميل</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="commission-percent">نسبة عمولتك (%)</Label>
              <Input
                id="commission-percent"
                type="number"
                min={1}
                max={20}
                value={commissionPercent}
                onChange={(e) => setCommissionPercent(Number(e.target.value))}
                data-testid="input-commission-percent"
              />
              <p className="text-xs text-muted-foreground">العمولة التي تحصل عليها من كل طلب</p>
            </div>
          </div>

          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm">
              <strong>مثال:</strong> إذا استخدم العميل الكود "{newCouponCode || 'AHMED5'}" على طلب بقيمة 10,000 ر.ي:
            </p>
            <ul className="text-sm text-muted-foreground mt-2 space-y-1">
              <li>• سيحصل العميل على خصم: <strong className="text-green-600">{(10000 * discountPercent / 100).toLocaleString()} ر.ي</strong></li>
              <li>• ستحصل أنت على عمولة: <strong className="text-primary">{(10000 * commissionPercent / 100).toLocaleString()} ر.ي</strong></li>
            </ul>
          </div>

          <Button 
            onClick={handleCreateCoupon}
            disabled={createCouponMutation.isPending}
            className="w-full md:w-auto"
            data-testid="button-create-coupon"
          >
            {createCouponMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin ml-2" />
            ) : (
              <Plus className="h-4 w-4 ml-2" />
            )}
            إنشاء الكوبون
          </Button>
        </CardContent>
      </Card>

      {/* Existing Coupons */}
      <Card>
        <CardHeader>
          <CardTitle>كوبوناتي</CardTitle>
          <CardDescription>
            قائمة بجميع أكواد الخصم الخاصة بك
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!coupons || coupons.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>لا توجد كوبونات حتى الآن</p>
              <p className="text-sm">أنشئ أول كوبون خصم لك من النموذج أعلاه</p>
            </div>
          ) : (
            <div className="space-y-4">
              {coupons.map((coupon) => (
                <div 
                  key={coupon.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-4"
                  data-testid={`coupon-item-${coupon.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <Tag className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-lg">{coupon.code}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(coupon.code)}
                          data-testid={`button-copy-${coupon.id}`}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        {coupon.isActive ? (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            <CheckCircle className="h-3 w-3 ml-1" />
                            نشط
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-red-600 border-red-600">
                            <XCircle className="h-3 w-3 ml-1" />
                            غير نشط
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        خصم {coupon.discountPercent}% للعميل • عمولة {coupon.marketerCommissionPercent}% لك
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 sm:gap-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary">{coupon.usageCount}</p>
                      <p className="text-xs text-muted-foreground">مرة استخدام</p>
                    </div>
                    {coupon.maxUsage && (
                      <>
                        <Separator orientation="vertical" className="h-8 hidden sm:block" />
                        <div className="text-center">
                          <p className="text-lg font-medium">{coupon.maxUsage}</p>
                          <p className="text-xs text-muted-foreground">الحد الأقصى</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tips Card */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>نصائح لزيادة الاستخدام</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• شارك كود الخصم مع عملائك عبر الواتساب ووسائل التواصل</li>
            <li>• استخدم أكواد سهلة التذكر مثل اسمك متبوعًا بالخصم (AHMED5)</li>
            <li>• أخبر عملاءك بالخصم الذي سيحصلون عليه عند استخدام الكود</li>
            <li>• تابع إحصائيات استخدام كل كوبون لمعرفة الأكثر نجاحًا</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
