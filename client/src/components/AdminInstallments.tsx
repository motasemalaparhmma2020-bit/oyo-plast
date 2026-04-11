import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, SplitSquareVertical, Users, CheckCircle, XCircle,
  Clock, AlertCircle, DollarSign, ShoppingBag, ArrowRight, Phone, Bell
} from "lucide-react";

interface InstallmentPlan {
  id: number;
  order_id: number;
  customer_name: string;
  customer_phone: string;
  plan_type: string;
  total_amount: string;
  deposit_amount: string;
  remaining_amount: string;
  deposit_paid: boolean;
  deposit_paid_at: string | null;
  remaining_paid: boolean;
  remaining_paid_at: string | null;
  guarantor_supplier_name: string | null;
  guarantor_supplier_phone: string | null;
  guarantor_notes: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  order_status: string;
  shipping_city: string;
  order_phone: string;
}

const fmt = (n: number | string) => Number(n).toLocaleString("ar-YE");

function statusConfig(status: string) {
  switch (status) {
    case "pending": return { label: "بانتظار المقدّم", color: "bg-yellow-100 text-yellow-800", icon: Clock };
    case "deposit_paid": return { label: "المقدّم مدفوع", color: "bg-blue-100 text-blue-800", icon: CheckCircle };
    case "completed": return { label: "مكتمل", color: "bg-green-100 text-green-800", icon: CheckCircle };
    case "cancelled": return { label: "ملغي", color: "bg-red-100 text-red-800", icon: XCircle };
    default: return { label: status, color: "bg-gray-100 text-gray-700", icon: Clock };
  }
}

function PlanCard({ plan, adminToken, onUpdate }: { plan: InstallmentPlan; adminToken: string; onUpdate: () => void }) {
  const { toast } = useToast();
  const [notes, setNotes] = useState(plan.admin_notes || "");
  const [showNotes, setShowNotes] = useState(false);

  const mutation = useMutation({
    mutationFn: async (action: string) => {
      const res = await fetch(`/api/admin/installment-plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
        body: JSON.stringify({ action, adminNotes: notes || undefined }),
      });
      if (!res.ok) throw new Error("فشل التحديث");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "✅ تم التحديث بنجاح" });
      onUpdate();
    },
    onError: (e: any) => {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    },
  });

  const remindMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/installment-plans/${plan.id}/remind`, {
        method: "POST",
        headers: { "x-admin-token": adminToken },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "فشل إرسال التذكير");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "✅ تم إرسال التذكير عبر واتساب" });
      onUpdate();
    },
    onError: (e: any) => {
      toast({ title: "خطأ في الإرسال", description: e.message, variant: "destructive" });
    },
  });

  const cfg = statusConfig(plan.status);
  const StatusIcon = cfg.icon;
  const isDepositCod = plan.plan_type === "deposit_cod";

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className={`px-4 py-3 flex items-center justify-between gap-3 ${isDepositCod ? "bg-amber-50" : "bg-purple-50"}`}>
          <div className="flex items-center gap-2">
            {isDepositCod
              ? <SplitSquareVertical className="h-4 w-4 text-amber-600" />
              : <Users className="h-4 w-4 text-purple-600" />}
            <span className="font-bold text-sm">
              {isDepositCod ? "مقدّم + باقي عند التسليم" : "كفيل المورد"}
            </span>
            <span className="text-xs text-muted-foreground">طلب #{plan.order_id}</span>
          </div>
          <Badge className={`${cfg.color} border-0 text-xs flex items-center gap-1`}>
            <StatusIcon className="h-3 w-3" />
            {cfg.label}
          </Badge>
        </div>

        <div className="px-4 py-3 space-y-3">
          {/* بيانات العميل */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{plan.customer_name}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />{plan.customer_phone}
                {plan.shipping_city && ` — ${plan.shipping_city}`}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(plan.created_at).toLocaleDateString("ar-YE")}
            </p>
          </div>

          {/* المبالغ */}
          <div className={`rounded-xl p-3 ${isDepositCod ? "bg-amber-50/80" : "bg-purple-50/80"}`}>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-muted-foreground">الإجمالي</p>
                <p className="font-bold text-sm">{fmt(plan.total_amount)}</p>
              </div>
              <div className={`${isDepositCod ? "bg-amber-100" : "bg-purple-100"} rounded-lg p-1.5`}>
                <p className="text-xs text-muted-foreground">المقدّم</p>
                <p className={`font-black text-sm ${isDepositCod ? "text-amber-700" : "text-purple-700"}`}>
                  {fmt(plan.deposit_amount)}
                </p>
                {plan.deposit_paid && <p className="text-xs text-green-600">✓ مدفوع</p>}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">الباقي</p>
                <p className="font-bold text-sm text-gray-600">{fmt(plan.remaining_amount)}</p>
                {plan.remaining_paid && <p className="text-xs text-green-600">✓ مدفوع</p>}
              </div>
            </div>
          </div>

          {/* كفيل المورد */}
          {plan.guarantor_supplier_name && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-purple-50/60 border border-purple-100">
              <Users className="h-4 w-4 text-purple-500 shrink-0" />
              <div>
                <p className="text-xs font-bold text-purple-700">{plan.guarantor_supplier_name}</p>
                {plan.guarantor_supplier_phone && <p className="text-xs text-purple-600">📞 {plan.guarantor_supplier_phone}</p>}
                {plan.guarantor_notes && <p className="text-xs text-gray-500">{plan.guarantor_notes}</p>}
              </div>
            </div>
          )}

          {/* ملاحظات الإدارة */}
          {plan.admin_notes && !showNotes && (
            <p className="text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1">{plan.admin_notes}</p>
          )}

          {showNotes && (
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="ملاحظات الإدارة..."
              className="text-right text-sm min-h-[60px]"
            />
          )}

          {/* أزرار الإجراءات */}
          <div className="flex gap-2 flex-wrap">
            {plan.status === "pending" && !plan.deposit_paid && (
              <Button
                size="sm"
                className="bg-amber-500 hover:bg-amber-600 text-white gap-1"
                onClick={() => mutation.mutate("confirm_deposit")}
                disabled={mutation.isPending}
                data-testid={`button-confirm-deposit-${plan.id}`}
              >
                {mutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                تأكيد استلام المقدّم
              </Button>
            )}
            {plan.status === "deposit_paid" && !plan.remaining_paid && (
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white gap-1"
                onClick={() => mutation.mutate("confirm_remaining")}
                disabled={mutation.isPending}
                data-testid={`button-confirm-remaining-${plan.id}`}
              >
                {mutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                تأكيد استلام الباقي
              </Button>
            )}
            {plan.status === "supplier_guaranteed" && (
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white gap-1"
                onClick={() => mutation.mutate("confirm_remaining")}
                disabled={mutation.isPending}
                data-testid={`button-confirm-guaranteed-${plan.id}`}
              >
                <CheckCircle className="h-3.5 w-3.5" />
                تأكيد استلام المبلغ
              </Button>
            )}
            {plan.status !== "completed" && plan.status !== "cancelled" && (
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 border-red-200 gap-1"
                onClick={() => mutation.mutate("cancel")}
                disabled={mutation.isPending}
                data-testid={`button-cancel-plan-${plan.id}`}
              >
                <XCircle className="h-3.5 w-3.5" />
                إلغاء
              </Button>
            )}
            {plan.status !== "completed" && plan.status !== "cancelled" && (
              <Button
                size="sm"
                variant="outline"
                className="text-blue-600 border-blue-200 gap-1"
                onClick={() => remindMutation.mutate()}
                disabled={remindMutation.isPending}
                data-testid={`button-remind-plan-${plan.id}`}
              >
                {remindMutation.isPending
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <Bell className="h-3.5 w-3.5" />}
                إرسال تذكير
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowNotes(!showNotes)}
            >
              {showNotes ? "إخفاء الملاحظات" : "ملاحظة"}
            </Button>
            {showNotes && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => mutation.mutate("add_note")}
                disabled={mutation.isPending}
              >
                حفظ الملاحظة
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminInstallments({ adminToken }: { adminToken: string | null }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: summary } = useQuery<any>({
    queryKey: ["/api/admin/installment-plans/stats/summary"],
    queryFn: async () => {
      const res = await fetch("/api/admin/installment-plans/stats/summary", {
        headers: { "x-admin-token": adminToken || "" },
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: !!adminToken,
  });

  const { data: plans = [], isLoading, refetch } = useQuery<InstallmentPlan[]>({
    queryKey: ["/api/admin/installment-plans", statusFilter],
    queryFn: async () => {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const res = await fetch(`/api/admin/installment-plans${params}`, {
        headers: { "x-admin-token": adminToken || "" },
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: !!adminToken,
  });

  const onUpdate = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["/api/admin/installment-plans/stats/summary"] });
  };

  const filters = [
    { key: "all", label: "الكل" },
    { key: "pending", label: "بانتظار المقدّم" },
    { key: "deposit_paid", label: "المقدّم مدفوع" },
    { key: "completed", label: "مكتمل" },
    { key: "cancelled", label: "ملغي" },
  ];

  return (
    <div className="space-y-5 pb-10" dir="rtl">

      {/* ملخص إحصائيات */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-yellow-50 to-amber-50">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-black text-amber-700">{summary.pending || 0}</p>
              <p className="text-xs text-gray-500 mt-0.5">بانتظار المقدّم</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-black text-blue-700">{summary.deposit_paid || 0}</p>
              <p className="text-xs text-gray-500 mt-0.5">المقدّم مدفوع</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-emerald-50">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-black text-green-700">{fmt(summary.total_deposits || 0)}</p>
              <p className="text-xs text-gray-500 mt-0.5">مقدّمات محصّلة ر.ي</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-orange-50 to-red-50">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-black text-orange-700">{fmt(summary.pending_collection || 0)}</p>
              <p className="text-xs text-gray-500 mt-0.5">متبقٍّ للتحصيل ر.ي</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* تصفية */}
      <div className="flex gap-2 flex-wrap">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              statusFilter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            data-testid={`filter-installment-${f.key}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* قائمة الخطط */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <SplitSquareVertical className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">لا توجد خطط تقسيط</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              adminToken={adminToken || ""}
              onUpdate={onUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
