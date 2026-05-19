import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  AlertTriangle, ChevronRight, Loader2, Upload, CheckCircle2,
  Sparkles, Building2, Wallet, Calendar, Receipt, X, Camera, ShieldCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { queryClient } from "@/lib/queryClient";

type Debt = {
  orderId: number;
  total: number;
  paid: number;
  remaining: number;
  currency: string;
  paymentStatus: string;
  hasReceipt: boolean;
  shippingCity?: string;
  createdAt: string;
  dueDate: string;
  tier?: string;
  cashDiscountPercent: number;
  planId?: number | null;
};

type BankAccount = {
  id: number;
  bankName: string;
  accountName: string;
  accountNumber: string;
  iban?: string;
  branch?: string;
  instructions?: string;
};

const fmt = (n: number) => Number(n || 0).toLocaleString("ar-YE");
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("ar-YE", { year: "numeric", month: "long", day: "numeric" });

export default function MyDebts() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [applyDiscount, setApplyDiscount] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"bank_transfer" | "wallet">("bank_transfer");
  const [transactionRef, setTransactionRef] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: debts = [], isLoading } = useQuery<Debt[]>({
    queryKey: ["/api/my-debts"],
    enabled: isAuthenticated,
    refetchOnWindowFocus: true,
  });

  const { data: banks = [] } = useQuery<BankAccount[]>({
    queryKey: ["/api/bank-accounts"],
    enabled: !!selectedDebt,
  });

  const payMutation = useMutation({
    mutationFn: async (vars: { orderId: number; formData: FormData }) => {
      const res = await fetch(`/api/my-debts/${vars.orderId}/pay`, {
        method: "POST",
        body: vars.formData,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "فشل التسجيل");
      return data;
    },
    onSuccess: () => {
      toast({
        title: "✅ تم استلام إيصالك",
        description: "سيتم التحقق منه خلال ساعات قليلة وستصلك إشعار بالنتيجة",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/my-debts"] });
      setSelectedDebt(null);
      setFile(null);
      setTransactionRef("");
      setApplyDiscount(false);
    },
    onError: (e: any) => {
      toast({ title: "❌ فشل", description: e?.message || "حاول مرة أخرى", variant: "destructive" });
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" dir="rtl">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertTriangle className="h-12 w-12 mx-auto text-orange-500" />
            <h2 className="text-xl font-bold">مديونياتي</h2>
            <p className="text-muted-foreground text-sm">يجب تسجيل الدخول لعرض مديونياتك</p>
            <Link href="/auth">
              <Button className="w-full" data-testid="button-login">تسجيل الدخول</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalRemaining = debts.reduce((s, d) => s + d.remaining, 0);
  const selectedRemaining = selectedDebt?.remaining || 0;
  const discountValue = applyDiscount ? Math.round(selectedRemaining * 0.01) : 0;
  const amountToPay = selectedRemaining - discountValue;

  const handleSubmit = () => {
    if (!selectedDebt || !file) {
      toast({ title: "❌ ناقص", description: "يجب رفع صورة إيصال الدفع", variant: "destructive" });
      return;
    }
    const fd = new FormData();
    fd.append("receipt", file);
    fd.append("amountClaimed", String(amountToPay));
    fd.append("applyEarlyDiscount", String(applyDiscount));
    fd.append("paymentMethod", paymentMethod);
    fd.append("transactionRef", transactionRef);
    payMutation.mutate({ orderId: selectedDebt.orderId, formData: fd });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-24" dir="rtl">
      {/* Hero */}
      <div className="bg-gradient-to-br from-rose-600 via-red-500 to-orange-500 text-white">
        <div className="container max-w-2xl mx-auto px-4 pt-4 pb-8">
          <div className="flex items-center gap-3 mb-3">
            <Link href="/account">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" data-testid="link-back">
                <ChevronRight className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-xl font-bold">مديونياتي</h1>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-2xl p-4">
            <p className="text-white/80 text-sm">إجمالي المتبقي عليك</p>
            <p className="text-3xl font-bold mt-1" data-testid="text-total-remaining">
              {fmt(totalRemaining)} <span className="text-base">ر.ي</span>
            </p>
            <p className="text-xs text-white/70 mt-2">
              {debts.length} {debts.length === 1 ? "طلب" : "طلبات"} بحاجة للسداد
            </p>
          </div>
        </div>
      </div>

      <div className="container max-w-2xl mx-auto px-4 -mt-4 space-y-3">
        {debts.length === 0 ? (
          <Card className="bg-white dark:bg-slate-900">
            <CardContent className="pt-8 pb-8 text-center">
              <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-3" />
              <h3 className="text-lg font-bold mb-1">رائع! لا مديونيات</h3>
              <p className="text-sm text-muted-foreground">جميع طلباتك مسددة بالكامل</p>
            </CardContent>
          </Card>
        ) : (
          debts.map((d) => {
            const overdue = new Date(d.dueDate) < new Date();
            return (
              <Card key={d.orderId} data-testid={`card-debt-${d.orderId}`} className="bg-white dark:bg-slate-900 border-r-4 border-r-rose-500">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground">طلب رقم</p>
                      <p className="font-bold text-base" data-testid={`text-order-id-${d.orderId}`}>#{d.orderId}</p>
                    </div>
                    {overdue ? (
                      <Badge variant="destructive" className="text-xs">متأخر</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        <Calendar className="h-3 w-3 ml-1" /> {fmtDate(d.dueDate)}
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                    <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-2">
                      <p className="text-[10px] text-muted-foreground">الإجمالي</p>
                      <p className="font-bold text-sm">{fmt(d.total)}</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-2">
                      <p className="text-[10px] text-muted-foreground">المدفوع</p>
                      <p className="font-bold text-sm text-green-700 dark:text-green-400">{fmt(d.paid)}</p>
                    </div>
                    <div className="bg-rose-50 dark:bg-rose-950/30 rounded-lg p-2">
                      <p className="text-[10px] text-muted-foreground">المتبقي</p>
                      <p className="font-bold text-sm text-rose-700 dark:text-rose-400" data-testid={`text-remaining-${d.orderId}`}>{fmt(d.remaining)}</p>
                    </div>
                  </div>

                  {d.hasReceipt && d.paymentStatus === "pending_verification" ? (
                    <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2">
                      <ShieldCheck className="h-4 w-4" />
                      تم رفع إيصالك — قيد التحقق من الإدارة
                    </div>
                  ) : (
                    <Button
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => setSelectedDebt(d)}
                      data-testid={`button-pay-${d.orderId}`}
                    >
                      <Wallet className="h-4 w-4 ml-2" /> ادفع الآن
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Payment Modal */}
      <Dialog open={!!selectedDebt} onOpenChange={(o) => !o && setSelectedDebt(null)}>
        <DialogContent dir="rtl" className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-right">سداد طلب #{selectedDebt?.orderId}</DialogTitle>
          </DialogHeader>

          {selectedDebt && (
            <div className="space-y-4">
              {/* Amount summary */}
              <Card className="bg-gradient-to-br from-rose-50 to-orange-50 dark:from-rose-950/30 dark:to-orange-950/30 border-rose-200">
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">المبلغ المطلوب</p>
                  <p className="text-3xl font-bold text-rose-700 dark:text-rose-400" data-testid="text-modal-amount">
                    {fmt(amountToPay)} <span className="text-base">ر.ي</span>
                  </p>
                  {applyDiscount && (
                    <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                      وفرت {fmt(discountValue)} ر.ي بخصم الدفع المبكّر ✨
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Early discount toggle */}
              <button
                type="button"
                onClick={() => setApplyDiscount(!applyDiscount)}
                className={`w-full p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                  applyDiscount
                    ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                    : "border-dashed border-gray-300 hover:border-green-400"
                }`}
                data-testid="button-toggle-discount"
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${applyDiscount ? "border-green-500 bg-green-500" : "border-gray-400"}`}>
                  {applyDiscount && <CheckCircle2 className="h-4 w-4 text-white" />}
                </div>
                <div className="flex-1 text-right">
                  <p className="font-bold text-sm flex items-center gap-1">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    ادفع اليوم واحصل على خصم 1%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    وفّر {fmt(Math.round(selectedRemaining * 0.01))} ر.ي
                  </p>
                </div>
              </button>

              {/* Payment method */}
              <div>
                <Label className="text-sm font-bold mb-2 block">طريقة الدفع</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("bank_transfer")}
                    className={`p-3 rounded-xl border-2 ${paymentMethod === "bank_transfer" ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" : "border-gray-200"}`}
                    data-testid="button-method-bank"
                  >
                    <Building2 className="h-5 w-5 mx-auto mb-1" />
                    <p className="text-xs font-bold">تحويل بنكي</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("wallet")}
                    className={`p-3 rounded-xl border-2 ${paymentMethod === "wallet" ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" : "border-gray-200"}`}
                    data-testid="button-method-wallet"
                  >
                    <Wallet className="h-5 w-5 mx-auto mb-1" />
                    <p className="text-xs font-bold">محفظة إلكترونية</p>
                  </button>
                </div>
              </div>

              {/* Bank accounts list */}
              {paymentMethod === "bank_transfer" && banks.length > 0 && (
                <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
                  <CardContent className="p-3 space-y-2">
                    <p className="text-xs font-bold text-blue-900 dark:text-blue-300">حوّل المبلغ إلى أحد الحسابات التالية:</p>
                    {banks.slice(0, 3).map((b) => (
                      <div key={b.id} className="bg-white dark:bg-slate-800 rounded-lg p-2 text-xs" data-testid={`bank-${b.id}`}>
                        <p className="font-bold">{b.bankName}</p>
                        <p className="text-muted-foreground">{b.accountName}</p>
                        <p className="font-mono select-all">{b.accountNumber}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Transaction ref */}
              <div>
                <Label htmlFor="ref" className="text-sm font-bold">رقم الحوالة (اختياري)</Label>
                <Input
                  id="ref"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  placeholder="مثال: TXN123456"
                  className="mt-1"
                  data-testid="input-ref"
                />
              </div>

              {/* Upload receipt */}
              <div>
                <Label className="text-sm font-bold mb-2 block">صورة الإيصال *</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  data-testid="input-receipt"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full p-4 rounded-xl border-2 border-dashed flex flex-col items-center gap-2 ${file ? "border-green-500 bg-green-50 dark:bg-green-950/30" : "border-gray-300 hover:border-blue-400"}`}
                  data-testid="button-upload-receipt"
                >
                  {file ? (
                    <>
                      <CheckCircle2 className="h-8 w-8 text-green-600" />
                      <p className="text-sm font-bold text-green-700">{file.name}</p>
                      <p className="text-xs text-muted-foreground">اضغط لاختيار صورة أخرى</p>
                    </>
                  ) : (
                    <>
                      <Camera className="h-8 w-8 text-gray-400" />
                      <p className="text-sm font-bold">اضغط لرفع صورة الإيصال</p>
                      <p className="text-xs text-muted-foreground">JPG/PNG</p>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setSelectedDebt(null)}
              className="flex-1"
              data-testid="button-cancel"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!file || payMutation.isPending}
              className="flex-1 bg-green-600 hover:bg-green-700"
              data-testid="button-confirm-pay"
            >
              {payMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Receipt className="h-4 w-4 ml-1" /> تأكيد الدفع
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
