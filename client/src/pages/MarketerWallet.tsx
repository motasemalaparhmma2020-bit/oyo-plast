import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useSEO } from "@/hooks/use-seo";
import {
  ArrowRight, Wallet, TrendingUp, Clock, CheckCircle2, XCircle,
  AlertCircle, RefreshCw, Send,
} from "lucide-react";

const METHOD_LABELS: Record<string, string> = {
  bank: "تحويل بنكي",
  jawal: "جوال",
  kash: "كاش",
  cash: "نقداً",
};

const STATUS_MAP: Record<string, { label: string; icon: any; color: string }> = {
  pending:  { label: "قيد المراجعة", icon: Clock,          color: "text-yellow-600 bg-yellow-50" },
  approved: { label: "موافق عليه",   icon: CheckCircle2,   color: "text-blue-600 bg-blue-50" },
  paid:     { label: "تم الصرف",     icon: CheckCircle2,   color: "text-green-600 bg-green-50" },
  rejected: { label: "مرفوض",        icon: XCircle,        color: "text-red-600 bg-red-50" },
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("ar-YE", { day: "numeric", month: "short", year: "numeric" });
}

export default function MarketerWallet() {
  useSEO({ title: "محفظتي | أويو بلاست" });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank");
  const [details, setDetails] = useState("");

  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["/api/me/marketer/wallet"],
    staleTime: 0,
    retry: 2,
  });

  const withdrawMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/me/marketer/withdraw", {
      amount: Number(amount),
      paymentMethod: method,
      paymentDetails: details,
    }),
    onSuccess: () => {
      toast({ title: "✅ تم إرسال طلب السحب" });
      setShowForm(false);
      setAmount("");
      setDetails("");
      queryClient.invalidateQueries({ queryKey: ["/api/me/marketer/wallet"] });
    },
    onError: (e: any) => toast({ title: "فشل الطلب", description: e.message, variant: "destructive" }),
  });

  const balance = data?.walletBalance ?? 0;
  const earnings = data?.totalEarnings ?? 0;
  const pending = data?.pendingPayout ?? 0;
  const withdrawals: any[] = data?.withdrawals ?? [];
  const hasPendingRequest = withdrawals.some(w => w.status === "pending");

  return (
    <div className="min-h-screen bg-[#f2f2f7] dark:bg-background pb-28" dir="rtl">
      {/* هيدر */}
      <div className="bg-gradient-to-bl from-amber-500 to-orange-600 pt-10 pb-6 px-4 relative">
        <Link href="/profile">
          <button className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/20 text-white" data-testid="btn-back-wallet">
            <ArrowRight className="h-5 w-5" />
          </button>
        </Link>
        <h1 className="text-white font-black text-xl text-center">محفظتي</h1>
        <p className="text-white/70 text-xs text-center mt-0.5">رصيدك وعمولاتك المتراكمة</p>

        {!isLoading && data && (
          <div className="mt-5 grid grid-cols-3 gap-2">
            {[
              { label: "رصيد المحفظة",   value: `${balance.toLocaleString()} ﷼`, highlight: true },
              { label: "إجمالي الأرباح", value: `${earnings.toLocaleString()} ﷼` },
              { label: "بانتظار الصرف",  value: `${pending.toLocaleString()} ﷼` },
            ].map((s, i) => (
              <div key={i} className={`rounded-xl p-2.5 text-center ${s.highlight ? "bg-white/25" : "bg-white/15"}`}>
                <p className="text-white font-black text-sm leading-none">{s.value}</p>
                <p className="text-white/60 text-[10px] mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mx-3 mt-3 space-y-[2px]">
        {isLoading && (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-white dark:bg-card rounded-2xl animate-pulse" />)}
          </div>
        )}

        {isError && (
          <div className="bg-white dark:bg-card rounded-2xl p-8 flex flex-col items-center gap-3">
            <XCircle className="h-10 w-10 text-red-300" />
            <p className="text-sm text-gray-500">تعذّر تحميل البيانات</p>
            <button onClick={() => refetch()} className="text-xs text-amber-600 font-bold flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> إعادة المحاولة
            </button>
          </div>
        )}

        {!isLoading && data && (
          <>
            {/* زر طلب السحب */}
            <div className="bg-white dark:bg-card rounded-2xl overflow-hidden shadow-sm">
              {!showForm ? (
                <button
                  onClick={() => setShowForm(true)}
                  disabled={balance <= 0 || hasPendingRequest}
                  className="w-full flex items-center justify-between px-4 py-4 disabled:opacity-50"
                  data-testid="btn-show-withdraw-form"
                >
                  <Wallet className="h-5 w-5 text-amber-500" />
                  <div className="text-right">
                    <p className="font-bold text-sm text-gray-800 dark:text-foreground">
                      {hasPendingRequest ? "يوجد طلب سحب معلّق" : "طلب سحب الرصيد"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {balance <= 0 ? "رصيدك صفر حالياً" : `متاح: ${balance.toLocaleString()} ﷼`}
                    </p>
                  </div>
                </button>
              ) : (
                <div className="p-4 space-y-3">
                  <p className="text-sm font-bold text-gray-800 dark:text-foreground text-right mb-3">طلب سحب الرصيد</p>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block text-right">المبلغ (ريال)</label>
                    <input
                      type="number"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      max={balance}
                      min={1}
                      placeholder={`الحد الأقصى ${balance.toLocaleString()}`}
                      className="w-full border border-gray-200 dark:border-border rounded-xl px-3 py-2.5 text-sm text-right bg-white dark:bg-background"
                      data-testid="input-withdraw-amount"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block text-right">طريقة الاستلام</label>
                    <select
                      value={method}
                      onChange={e => setMethod(e.target.value)}
                      className="w-full border border-gray-200 dark:border-border rounded-xl px-3 py-2.5 text-sm text-right bg-white dark:bg-background"
                      data-testid="select-withdraw-method"
                    >
                      {Object.entries(METHOD_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block text-right">تفاصيل الحساب</label>
                    <textarea
                      value={details}
                      onChange={e => setDetails(e.target.value)}
                      rows={2}
                      placeholder="رقم الحساب أو رقم الجوال..."
                      className="w-full border border-gray-200 dark:border-border rounded-xl px-3 py-2.5 text-sm text-right bg-white dark:bg-background resize-none"
                      data-testid="input-withdraw-details"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setShowForm(false)}
                      className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-border text-sm text-gray-500"
                      data-testid="btn-cancel-withdraw"
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={() => withdrawMutation.mutate()}
                      disabled={!amount || Number(amount) <= 0 || withdrawMutation.isPending}
                      className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
                      data-testid="btn-submit-withdraw"
                    >
                      <Send className="h-4 w-4" />
                      {withdrawMutation.isPending ? "جاري الإرسال..." : "إرسال الطلب"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* سجل طلبات السحب */}
            {withdrawals.length > 0 && (
              <div className="bg-white dark:bg-card rounded-2xl overflow-hidden shadow-sm">
                <div className="px-4 py-2.5 border-b border-gray-100 dark:border-border">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">سجل طلبات السحب</span>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-border">
                  {withdrawals.map((w: any) => {
                    const st = STATUS_MAP[w.status] ?? STATUS_MAP.pending;
                    const StIcon = st.icon;
                    return (
                      <div key={w.id} className="px-4 py-3 flex items-center gap-3" data-testid={`withdrawal-${w.id}`}>
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${st.color}`}>
                          <StIcon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 dark:text-foreground">
                            {Number(w.amount).toLocaleString()} ﷼
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {METHOD_LABELS[w.paymentMethod] ?? w.paymentMethod} · {formatDate(w.requestedAt)}
                          </p>
                          {w.adminNotes && <p className="text-[10px] text-gray-500 mt-0.5">{w.adminNotes}</p>}
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${st.color}`}>{st.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
