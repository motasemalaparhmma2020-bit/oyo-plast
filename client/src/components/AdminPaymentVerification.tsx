import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, XCircle, Clock, Eye, ImageIcon,
  CreditCard, Smartphone, SplitSquareVertical, RefreshCw
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PendingPayment {
  id: number;
  customer_name: string;
  customer_phone: string;
  total: string;
  payment_method: string;
  payment_status: string;
  receipt_image_url: string;
  notes: string | null;
  created_at: string;
  shipping_city: string;
}

const methodLabel = (m: string) => {
  if (m === "bank_transfer") return { label: "تحويل بنكي", icon: <CreditCard className="h-4 w-4" />, color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" };
  if (m === "digital_wallet") return { label: "محفظة إلكترونية", icon: <Smartphone className="h-4 w-4" />, color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" };
  if (m === "installment_deposit_cod") return { label: "مقدّم تقسيط", icon: <SplitSquareVertical className="h-4 w-4" />, color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" };
  return { label: m, icon: <CreditCard className="h-4 w-4" />, color: "bg-gray-100 text-gray-700" };
};

const statusLabel = (s: string) => {
  if (s === "pending_verification") return { label: "بانتظار التحقق", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" };
  if (s === "unpaid") return { label: "غير مدفوع", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" };
  if (s === "partial") return { label: "دفع جزئي", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" };
  return { label: s, color: "bg-gray-100 text-gray-700" };
};

const fmt = (n: number | string) => Number(n).toLocaleString("ar-YE");

function ReceiptCard({
  payment,
  adminToken,
  onDone,
}: {
  payment: PendingPayment;
  adminToken: string | null;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [imgOpen, setImgOpen] = useState(false);

  const method = methodLabel(payment.payment_method);
  const status = statusLabel(payment.payment_status);

  const verifyMutation = useMutation({
    mutationFn: async (action: "approve" | "reject") => {
      const res = await fetch(`/api/admin/payment-verifications/${payment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken || "" },
        body: JSON.stringify({ action, note: note.trim() || undefined }),
      });
      if (!res.ok) throw new Error("فشل التحديث");
      return res.json();
    },
    onSuccess: (_, action) => {
      toast({
        title: action === "approve" ? "✅ تم قبول الدفع" : "❌ تم رفض الدفع",
        description: action === "approve" ? "تم تحديث حالة الدفع إلى مُحوَّل" : "تم إعادة الطلب لحالة غير مدفوع",
      });
      qc.invalidateQueries({ queryKey: ["/api/admin/payment-verifications"] });
      onDone();
    },
    onError: () => toast({ title: "خطأ", description: "فشل تحديث حالة الدفع", variant: "destructive" }),
  });

  return (
    <>
      <Card className="border border-border shadow-sm">
        <CardContent className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-bold text-base" data-testid={`text-customer-${payment.id}`}>{payment.customer_name}</p>
              <p className="text-sm text-muted-foreground">{payment.customer_phone} · {payment.shipping_city}</p>
            </div>
            <div className="text-left">
              <p className="font-bold text-lg text-primary">{fmt(payment.total)} ر.ي</p>
              <p className="text-xs text-muted-foreground">{new Date(payment.created_at).toLocaleDateString("ar-YE")}</p>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${method.color}`}>
              {method.icon}
              {method.label}
            </span>
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${status.color}`}>
              <Clock className="h-3 w-3" />
              {status.label}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
              #طلب {payment.id}
            </span>
          </div>

          {/* Notes preview */}
          {payment.notes && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2 line-clamp-2">{payment.notes}</p>
          )}

          {/* Receipt image */}
          <button
            data-testid={`btn-view-receipt-${payment.id}`}
            onClick={() => setImgOpen(true)}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors py-3 text-sm font-medium text-primary"
          >
            <ImageIcon className="h-4 w-4" />
            عرض إيصال الدفع
          </button>

          {/* Admin note */}
          <Textarea
            placeholder="ملاحظة للأدمن (اختياري)..."
            value={note}
            onChange={e => setNote(e.target.value)}
            className="text-sm resize-none h-16"
            data-testid={`input-note-${payment.id}`}
          />

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              data-testid={`btn-approve-${payment.id}`}
              onClick={() => verifyMutation.mutate("approve")}
              disabled={verifyMutation.isPending}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-1"
            >
              <CheckCircle2 className="h-4 w-4" />
              قبول الدفع
            </Button>
            <Button
              data-testid={`btn-reject-${payment.id}`}
              variant="destructive"
              onClick={() => verifyMutation.mutate("reject")}
              disabled={verifyMutation.isPending}
              className="flex-1 gap-1"
            >
              <XCircle className="h-4 w-4" />
              رفض
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Receipt image dialog */}
      <Dialog open={imgOpen} onOpenChange={setImgOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>إيصال دفع — {payment.customer_name}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            <img
              src={payment.receipt_image_url}
              alt="إيصال الدفع"
              className="max-h-[70vh] w-auto rounded-lg object-contain border"
            />
          </div>
          <div className="flex gap-2 mt-2">
            <Button
              data-testid={`btn-approve-dialog-${payment.id}`}
              onClick={() => { verifyMutation.mutate("approve"); setImgOpen(false); }}
              disabled={verifyMutation.isPending}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-1"
            >
              <CheckCircle2 className="h-4 w-4" />
              قبول الدفع
            </Button>
            <Button
              data-testid={`btn-reject-dialog-${payment.id}`}
              variant="destructive"
              onClick={() => { verifyMutation.mutate("reject"); setImgOpen(false); }}
              disabled={verifyMutation.isPending}
              className="flex-1 gap-1"
            >
              <XCircle className="h-4 w-4" />
              رفض
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function AdminPaymentVerification({ adminToken }: { adminToken: string | null }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: payments = [], isLoading, refetch } = useQuery<PendingPayment[]>({
    queryKey: ["/api/admin/payment-verifications"],
    queryFn: async () => {
      const res = await fetch("/api/admin/payment-verifications", {
        headers: { "x-admin-token": adminToken || "" },
      });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 60000,
  });

  const pending = payments.filter(p => p.payment_status === "pending_verification");
  const others = payments.filter(p => p.payment_status !== "pending_verification");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold">التحقق من إيصالات الدفع</h2>
          <p className="text-sm text-muted-foreground">مراجعة طلبات التحويل البنكي والمحافظ الإلكترونية</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          data-testid="btn-refresh-payments"
          className="gap-1"
        >
          <RefreshCw className="h-4 w-4" />
          تحديث
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-yellow-600 dark:text-yellow-400 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{pending.length}</p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400">بانتظار التحقق</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4 flex items-center gap-3">
            <CreditCard className="h-8 w-8 text-blue-600 dark:text-blue-400 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                {fmt(payments.filter(p => p.payment_method === "bank_transfer").reduce((a, b) => a + Number(b.total), 0))}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400">تحويلات بنكية (ر.ي)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
          <CardContent className="p-4 flex items-center gap-3">
            <Smartphone className="h-8 w-8 text-purple-600 dark:text-purple-400 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                {fmt(payments.filter(p => p.payment_method === "digital_wallet").reduce((a, b) => a + Number(b.total), 0))}
              </p>
              <p className="text-xs text-purple-600 dark:text-purple-400">محافظ إلكترونية (ر.ي)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : payments.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">لا توجد إيصالات بانتظار التحقق</p>
          <p className="text-sm">ستظهر هنا الطلبات التي رفع فيها العملاء إيصالات الدفع</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm text-yellow-700 dark:text-yellow-400 mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                بانتظار التحقق ({pending.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pending.map(p => (
                  <ReceiptCard key={p.id} payment={p} adminToken={adminToken} onDone={() => qc.invalidateQueries({ queryKey: ["/api/admin/payment-verifications"] })} />
                ))}
              </div>
            </div>
          )}
          {others.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-2">
                <Eye className="h-4 w-4" />
                إيصالات أخرى ({others.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {others.map(p => (
                  <ReceiptCard key={p.id} payment={p} adminToken={adminToken} onDone={() => qc.invalidateQueries({ queryKey: ["/api/admin/payment-verifications"] })} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
