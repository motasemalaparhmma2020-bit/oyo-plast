import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Wallet, TrendingUp, ShoppingBag, Clock, Copy, ExternalLink, LogOut,
  ChevronDown, ChevronUp, DollarSign, CheckCircle, XCircle, AlertCircle, FileText, Shield,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const API_BASE = "";

function marketerFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("marketerToken") || "";
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...(options.headers || {}), "x-marketer-token": token, "Content-Type": "application/json" },
  }).then(async (r) => {
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || "خطأ");
    return data;
  });
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "بانتظار الدفع", color: "bg-yellow-100 text-yellow-700" },
  deposit_paid: { label: "دُفع العربون", color: "bg-blue-100 text-blue-700" },
  processing: { label: "قيد التجهيز", color: "bg-purple-100 text-purple-700" },
  shipped: { label: "تم الشحن", color: "bg-indigo-100 text-indigo-700" },
  delivered: { label: "تم التوصيل", color: "bg-emerald-100 text-emerald-700" },
  completed: { label: "مكتمل", color: "bg-green-100 text-green-700" },
  cancelled: { label: "ملغي", color: "bg-red-100 text-red-700" },
};

export default function MarketerDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showOrders, setShowOrders] = useState(true);
  const [showWithdrawal, setShowWithdrawal] = useState(false);
  const [wForm, setWForm] = useState({ amount: "", paymentMethod: "", paymentDetails: "" });
  const [showContractDialog, setShowContractDialog] = useState(false);
  const [contractRead, setContractRead] = useState(false);

  // حماية المسار
  useEffect(() => {
    if (!localStorage.getItem("marketerToken")) setLocation("/marketer/login");
  }, []);

  const token = localStorage.getItem("marketerToken") || "";

  const { data: myInfo } = useQuery<any>({
    queryKey: ["/api/marketer/me", token],
    queryFn: () => marketerFetch("/api/marketer/me"),
    enabled: !!token,
  });

  useEffect(() => {
    if (myInfo && !myInfo.contractAcceptedAt) {
      setShowContractDialog(true);
    }
  }, [myInfo]);

  const acceptContractMutation = useMutation({
    mutationFn: () => marketerFetch("/api/marketer/accept-contract", { method: "POST" }),
    onSuccess: () => {
      toast({ title: "✅ تم قبول العقد بنجاح", description: "يمكنك الآن استخدام لوحة التحكم كاملاً" });
      setShowContractDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/marketer/me"] });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/marketer/stats", token],
    queryFn: () => marketerFetch("/api/marketer/stats"),
    enabled: !!token,
    refetchInterval: 60000,
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery<any[]>({
    queryKey: ["/api/marketer/orders", token],
    queryFn: () => marketerFetch("/api/marketer/orders"),
    enabled: !!token,
  });

  const { data: withdrawals = [], isLoading: wLoading } = useQuery<any[]>({
    queryKey: ["/api/marketer/withdrawals", token],
    queryFn: () => marketerFetch("/api/marketer/withdrawals"),
    enabled: !!token,
  });

  const withdrawMutation = useMutation({
    mutationFn: (data: typeof wForm) =>
      marketerFetch("/api/marketer/withdrawals", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: "تم إرسال طلب السحب بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["/api/marketer/withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marketer/stats"] });
      setWForm({ amount: "", paymentMethod: "", paymentDetails: "" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const handleLogout = () => {
    localStorage.removeItem("marketerToken");
    localStorage.removeItem("marketerData");
    setLocation("/marketer/login");
  };

  const copyCode = () => {
    if (!stats?.couponCode) return;
    navigator.clipboard.writeText(stats.couponCode);
    toast({ title: "تم نسخ الكوبون" });
  };

  const copyLink = () => {
    if (!stats?.couponCode) return;
    navigator.clipboard.writeText(`https://oyoplast.com/m/${stats.couponCode}`);
    toast({ title: "تم نسخ الرابط" });
  };

  const submitWithdrawal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wForm.amount || !wForm.paymentMethod)
      return toast({ title: "بيانات ناقصة", variant: "destructive" });
    withdrawMutation.mutate(wForm);
  };

  const marketerName = JSON.parse(localStorage.getItem("marketerData") || "{}").name || "المسوّق";

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">

      {/* ── ديالوغ قبول العقد — يظهر تلقائياً عند أول دخول ── */}
      <Dialog open={showContractDialog} onOpenChange={() => {}}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto [&>button.absolute]:hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-800">
              <FileText className="h-5 w-5" />
              عقد شراكة تسويقية — أويو بلاست
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              يجب قراءة وقبول بنود الشراكة قبل استخدام لوحة التحكم
            </div>
            <div
              className="bg-gray-50 border rounded-lg p-4 text-sm leading-loose max-h-64 overflow-y-auto"
              onScroll={(e) => {
                const el = e.currentTarget;
                if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) setContractRead(true);
              }}
            >
              <pre className="whitespace-pre-wrap font-sans text-gray-700">
                {myInfo?.contractText || "جارٍ التحميل..."}
              </pre>
            </div>
            {!contractRead && (
              <p className="text-xs text-center text-muted-foreground">اقرأ العقد كاملاً بالتمرير للأسفل لتفعيل زر القبول</p>
            )}
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-xs text-emerald-800">بالضغط على "أوافق وأقبل"، يُعتبر هذا توقيعاً رقمياً ملزماً قانونياً</p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleLogout}
              >
                إلغاء وتسجيل الخروج
              </Button>
              <Button
                data-testid="button-accept-contract"
                disabled={!contractRead || acceptContractMutation.isPending}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => acceptContractMutation.mutate()}
              >
                {acceptContractMutation.isPending ? "جارٍ الحفظ..." : "✅ أوافق وأقبل العقد"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <header className="bg-gradient-to-l from-emerald-700 to-teal-600 text-white">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-emerald-200 text-sm">مرحباً</p>
            <h1 className="text-xl font-bold">{marketerName}</h1>
          </div>
          <button
            data-testid="button-logout"
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-emerald-200 hover:text-white text-sm"
          >
            <LogOut className="w-4 h-4" />
            خروج
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "رصيد المحفظة", value: statsLoading ? null : `${Number(stats?.walletBalance || 0).toLocaleString()} ر.ي`, icon: Wallet, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "إجمالي الأرباح", value: statsLoading ? null : `${Number(stats?.totalEarnings || 0).toLocaleString()} ر.ي`, icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "طلبات هذا الشهر", value: statsLoading ? null : String(stats?.monthOrders || 0), icon: ShoppingBag, color: "text-purple-600", bg: "bg-purple-50" },
            { label: "بانتظار الصرف", value: statsLoading ? null : `${Number(stats?.pendingPayout || 0).toLocaleString()} ر.ي`, icon: Clock, color: "text-orange-600", bg: "bg-orange-50" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className={`w-9 h-9 ${s.bg} rounded-lg flex items-center justify-center mb-2`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <p className="text-xs text-gray-500 mb-0.5">{s.label}</p>
              {s.value === null ? (
                <Skeleton className="h-6 w-20" />
              ) : (
                <p data-testid={`stat-${s.label}`} className="text-lg font-bold text-gray-800">{s.value}</p>
              )}
            </div>
          ))}
        </div>

        {/* Coupon Card */}
        <div className="bg-gradient-to-l from-emerald-600 to-teal-500 rounded-2xl p-6 text-white shadow-lg">
          <p className="text-emerald-100 text-sm mb-2">كوبونك الخاص</p>
          {statsLoading ? (
            <Skeleton className="h-10 w-40 bg-white/20" />
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                <span data-testid="text-coupon-code" className="text-3xl font-black tracking-widest">
                  {stats?.couponCode || "—"}
                </span>
                <button onClick={copyCode} className="p-2 bg-white/20 rounded-lg hover:bg-white/30">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                <div className="bg-white/20 rounded-lg px-3 py-1">
                  خصم العميل: <span className="font-bold">{stats?.discountRate}%</span>
                </div>
                <div className="bg-white/20 rounded-lg px-3 py-1">
                  عمولتك: <span className="font-bold">{stats?.commissionRate}%</span>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  data-testid="button-copy-link"
                  onClick={copyLink}
                  className="flex items-center gap-1.5 bg-white text-emerald-700 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-emerald-50"
                >
                  <Copy className="w-3.5 h-3.5" />
                  نسخ رابط المتجر
                </button>
                <a
                  href={`/m/${stats?.couponCode}`}
                  target="_blank"
                  className="flex items-center gap-1.5 bg-white/20 text-white text-xs font-medium px-3 py-2 rounded-lg hover:bg-white/30"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  صفحتك الخاصة
                </a>
              </div>
            </>
          )}
        </div>

        {/* Orders Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <button
            data-testid="button-toggle-orders"
            onClick={() => setShowOrders(!showOrders)}
            className="w-full flex items-center justify-between px-5 py-4"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-600" />
              <span className="font-bold text-gray-800">الطلبات ({orders.length})</span>
            </div>
            {showOrders ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {showOrders && (
            <div className="border-t border-gray-100">
              {ordersLoading ? (
                <div className="p-5 space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : orders.length === 0 ? (
                <p className="text-center text-gray-400 py-10">لا توجد طلبات بعد</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs">
                        <th className="px-4 py-2.5 text-right">#</th>
                        <th className="px-4 py-2.5 text-right">العميل</th>
                        <th className="px-4 py-2.5 text-right">المدينة</th>
                        <th className="px-4 py-2.5 text-right">المبلغ</th>
                        <th className="px-4 py-2.5 text-right">عمولتك</th>
                        <th className="px-4 py-2.5 text-right">الحالة</th>
                        <th className="px-4 py-2.5 text-right">الدفع</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {orders.map((o: any) => {
                        const s = STATUS_MAP[o.status] || { label: o.status, color: "bg-gray-100 text-gray-600" };
                        return (
                          <tr key={o.id} data-testid={`row-order-${o.id}`} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-500">{o.id}</td>
                            <td className="px-4 py-3 font-medium text-gray-800">{o.customer_name}</td>
                            <td className="px-4 py-3 text-gray-500">{o.shipping_city}</td>
                            <td className="px-4 py-3 font-semibold">{Number(o.total).toLocaleString()}</td>
                            <td className="px-4 py-3 text-emerald-700 font-bold">
                              {o.marketer_commission_amount ? Number(o.marketer_commission_amount).toLocaleString() : "—"}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${s.color}`}>{s.label}</span>
                            </td>
                            <td className="px-4 py-3">
                              {o.marketer_commission_paid
                                ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                                : <Clock className="w-4 h-4 text-orange-400" />}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Withdrawal Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <button
            data-testid="button-toggle-withdrawal"
            onClick={() => setShowWithdrawal(!showWithdrawal)}
            className="w-full flex items-center justify-between px-5 py-4"
          >
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              <span className="font-bold text-gray-800">طلب سحب الأرباح</span>
            </div>
            {showWithdrawal ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {showWithdrawal && (
            <div className="border-t border-gray-100 p-5">
              {/* New Request Form */}
              <form onSubmit={submitWithdrawal} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <Label className="mb-1.5 block text-sm text-gray-700">المبلغ (ر.ي)</Label>
                  <Input
                    data-testid="input-withdrawal-amount"
                    type="number"
                    value={wForm.amount}
                    onChange={(e) => setWForm({ ...wForm, amount: e.target.value })}
                    placeholder="0"
                    min="1"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block text-sm text-gray-700">طريقة الاستلام</Label>
                  <Select value={wForm.paymentMethod} onValueChange={(v) => setWForm({ ...wForm, paymentMethod: v })}>
                    <SelectTrigger data-testid="select-payment-method">
                      <SelectValue placeholder="اختر..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank">تحويل بنكي</SelectItem>
                      <SelectItem value="jawal">جوال</SelectItem>
                      <SelectItem value="kash">كاش</SelectItem>
                      <SelectItem value="cash">نقداً</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 block text-sm text-gray-700">تفاصيل الحساب</Label>
                  <Input
                    data-testid="input-payment-details"
                    value={wForm.paymentDetails}
                    onChange={(e) => setWForm({ ...wForm, paymentDetails: e.target.value })}
                    placeholder="رقم الحساب / المحفظة"
                  />
                </div>
                <div className="md:col-span-3">
                  <Button
                    data-testid="button-submit-withdrawal"
                    type="submit"
                    disabled={withdrawMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {withdrawMutation.isPending ? "جارٍ الإرسال..." : "إرسال طلب السحب"}
                  </Button>
                </div>
              </form>

              {/* Withdrawal History */}
              <h3 className="font-semibold text-gray-700 text-sm mb-3">سجل الطلبات السابقة</h3>
              {wLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : withdrawals.length === 0 ? (
                <p className="text-sm text-gray-400">لا توجد طلبات سحب سابقة</p>
              ) : (
                <div className="space-y-2">
                  {withdrawals.map((w: any) => (
                    <div key={w.id} data-testid={`withdrawal-${w.id}`}
                      className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 text-sm">
                      <div>
                        <span className="font-bold text-gray-800">{Number(w.amount).toLocaleString()} ر.ي</span>
                        <span className="text-gray-400 mx-2">·</span>
                        <span className="text-gray-500">{w.payment_method}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">
                          {new Date(w.requested_at).toLocaleDateString("ar-YE")}
                        </span>
                        {w.status === "paid" && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                        {w.status === "pending" && <AlertCircle className="w-4 h-4 text-orange-400" />}
                        {w.status === "rejected" && <XCircle className="w-4 h-4 text-red-400" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
