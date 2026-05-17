import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowRight, Wallet, History, DollarSign, Phone } from "lucide-react";

interface Supplier {
  id: number;
  name: string;
  phone: string;
  balanceDue?: number | string | null;
  balance_due?: number | string | null;
  totalSales?: number | string | null;
  total_sales?: number | string | null;
  totalPaid?: number | string | null;
  total_paid?: number | string | null;
  commissionRate?: number | string | null;
  commission_rate?: number | string | null;
}

interface SupplierPayment {
  id: number;
  supplier_id: number;
  amount: string;
  payment_method?: string | null;
  notes?: string | null;
  paid_at: string;
}

function n(v: any): number {
  return Number(v || 0);
}

function getDue(s: Supplier): number {
  return n(s.balanceDue ?? s.balance_due);
}
function getSales(s: Supplier): number {
  return n(s.totalSales ?? s.total_sales);
}
function getPaid(s: Supplier): number {
  return n(s.totalPaid ?? s.total_paid);
}

export default function AdminSupplierPayments() {
  const { toast } = useToast();
  const adminToken =
    typeof window !== "undefined"
      ? localStorage.getItem("adminToken") || ""
      : "";

  const [paySupplier, setPaySupplier] = useState<Supplier | null>(null);
  const [historySupplier, setHistorySupplier] = useState<Supplier | null>(null);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [filter, setFilter] = useState<"all" | "due">("due");

  const headers = adminToken
    ? { "x-admin-token": adminToken }
    : ({} as Record<string, string>);

  const {
    data: suppliers = [],
    isLoading,
  } = useQuery<Supplier[]>({
    queryKey: ["/api/admin/suppliers"],
    queryFn: async () => {
      const res = await fetch("/api/admin/suppliers", { headers });
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery<
    SupplierPayment[]
  >({
    queryKey: ["/api/admin/suppliers", historySupplier?.id, "payments"],
    queryFn: async () => {
      if (!historySupplier) return [];
      const res = await fetch(
        `/api/admin/suppliers/${historySupplier.id}/payments`,
        { headers }
      );
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    enabled: !!historySupplier,
  });

  const filtered = useMemo(() => {
    const list = filter === "due" ? suppliers.filter((s) => getDue(s) > 0) : suppliers;
    return [...list].sort((a, b) => getDue(b) - getDue(a));
  }, [suppliers, filter]);

  const totalDue = useMemo(
    () => suppliers.reduce((sum, s) => sum + getDue(s), 0),
    [suppliers]
  );

  const payMutation = useMutation({
    mutationFn: async (vars: {
      supplierId: number;
      amount: number;
      paymentMethod: string;
      notes: string;
    }) => {
      return apiRequest(
        "POST",
        `/api/admin/suppliers/${vars.supplierId}/pay`,
        {
          amount: vars.amount,
          paymentMethod: vars.paymentMethod,
          notes: vars.notes,
        }
      );
    },
    onSuccess: () => {
      toast({
        title: "تم تسجيل الدفعة",
        description: "تم تحديث رصيد المورد بنجاح",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/suppliers"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/suppliers", paySupplier?.id, "payments"],
      });
      setPaySupplier(null);
      setAmount("");
      setNotes("");
      setPaymentMethod("cash");
    },
    onError: (e: any) => {
      toast({
        title: "فشل تسجيل الدفعة",
        description: e?.message || "حاول مجدداً",
        variant: "destructive",
      });
    },
  });

  function handleOpenPay(s: Supplier) {
    setPaySupplier(s);
    setAmount(String(getDue(s) || ""));
    setPaymentMethod("cash");
    setNotes("");
  }

  function handleSubmitPay() {
    if (!paySupplier) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast({
        title: "أدخل مبلغاً صحيحاً",
        variant: "destructive",
      });
      return;
    }
    const due = getDue(paySupplier);
    if (amt > due && due > 0) {
      const confirmPay = window.confirm(
        `المبلغ ${amt.toLocaleString()} أكبر من المستحق ${due.toLocaleString()} ر.ي. هل تريد المتابعة؟`
      );
      if (!confirmPay) return;
    }
    payMutation.mutate({
      supplierId: paySupplier.id,
      amount: amt,
      paymentMethod,
      notes,
    });
  }

  const fmt = (v: number) => v.toLocaleString("ar-YE") + " ر.ي";

  return (
    <div className="container mx-auto p-4 max-w-7xl" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/admin" data-testid="link-back-admin">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowRight className="h-4 w-4" />
              العودة
            </Button>
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6 text-blue-600" />
            سداد مستحقات الموردين
          </h1>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Card className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950 border-red-200">
          <CardContent className="pt-4">
            <div className="text-xs text-red-700 dark:text-red-300 mb-1">
              إجمالي المستحقات
            </div>
            <div
              className="text-2xl font-bold text-red-700 dark:text-red-200"
              data-testid="text-total-due"
            >
              {fmt(totalDue)}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 border-blue-200">
          <CardContent className="pt-4">
            <div className="text-xs text-blue-700 dark:text-blue-300 mb-1">
              عدد الموردين بمستحقات
            </div>
            <div
              className="text-2xl font-bold text-blue-700 dark:text-blue-200"
              data-testid="text-due-count"
            >
              {suppliers.filter((s) => getDue(s) > 0).length}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200">
          <CardContent className="pt-4">
            <div className="text-xs text-green-700 dark:text-green-300 mb-1">
              إجمالي الموردين
            </div>
            <div
              className="text-2xl font-bold text-green-700 dark:text-green-200"
              data-testid="text-total-suppliers"
            >
              {suppliers.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-3">
        <Button
          variant={filter === "due" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("due")}
          data-testid="button-filter-due"
        >
          المستحقات فقط
        </Button>
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
          data-testid="button-filter-all"
        >
          جميع الموردين
        </Button>
      </div>

      {/* Suppliers table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {filter === "due" ? "موردون لديهم مستحقات" : "جميع الموردين"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">
              جاري التحميل...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {filter === "due"
                ? "لا توجد مستحقات حالياً ✓"
                : "لا يوجد موردون"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">المورد</TableHead>
                    <TableHead className="text-right">الهاتف</TableHead>
                    <TableHead className="text-right">إجمالي المبيعات</TableHead>
                    <TableHead className="text-right">المدفوع</TableHead>
                    <TableHead className="text-right">المستحق</TableHead>
                    <TableHead className="text-right">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => {
                    const due = getDue(s);
                    return (
                      <TableRow
                        key={s.id}
                        data-testid={`row-supplier-${s.id}`}
                      >
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {s.phone || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {fmt(getSales(s))}
                        </TableCell>
                        <TableCell className="text-sm text-green-700">
                          {fmt(getPaid(s))}
                        </TableCell>
                        <TableCell>
                          {due > 0 ? (
                            <Badge
                              variant="destructive"
                              data-testid={`badge-due-${s.id}`}
                            >
                              {fmt(due)}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">مسدّد</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            <Button
                              size="sm"
                              variant="default"
                              className="gap-1 bg-green-600 hover:bg-green-700"
                              onClick={() => handleOpenPay(s)}
                              disabled={due <= 0}
                              data-testid={`button-pay-${s.id}`}
                            >
                              <DollarSign className="h-3 w-3" />
                              تسديد
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => setHistorySupplier(s)}
                              data-testid={`button-history-${s.id}`}
                            >
                              <History className="h-3 w-3" />
                              السجل
                            </Button>
                            {s.phone && (
                              <a
                                href={`tel:${s.phone}`}
                                data-testid={`link-call-${s.id}`}
                              >
                                <Button size="sm" variant="outline" className="gap-1">
                                  <Phone className="h-3 w-3" />
                                </Button>
                              </a>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pay dialog */}
      <Dialog
        open={!!paySupplier}
        onOpenChange={(o) => !o && setPaySupplier(null)}
      >
        <DialogContent className="bg-white dark:bg-gray-900" dir="rtl">
          <DialogHeader>
            <DialogTitle>تسجيل دفعة للمورد: {paySupplier?.name}</DialogTitle>
            <DialogDescription>
              المستحق الحالي:{" "}
              <span className="font-bold text-red-600">
                {paySupplier ? fmt(getDue(paySupplier)) : ""}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="amount">المبلغ (ر.ي) *</Label>
              <Input
                id="amount"
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                data-testid="input-pay-amount"
              />
            </div>
            <div>
              <Label htmlFor="method">طريقة الدفع</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger
                  id="method"
                  data-testid="select-pay-method"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">نقدي</SelectItem>
                  <SelectItem value="bank_transfer">حوالة بنكية</SelectItem>
                  <SelectItem value="kuraimi">الكريمي</SelectItem>
                  <SelectItem value="jaib">جيب</SelectItem>
                  <SelectItem value="floosak">فلوسك</SelectItem>
                  <SelectItem value="jawali">جوالي</SelectItem>
                  <SelectItem value="other">أخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="notes">ملاحظات (اختياري)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="رقم العملية، التاريخ، ...إلخ"
                rows={2}
                data-testid="input-pay-notes"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setPaySupplier(null)}
              data-testid="button-cancel-pay"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleSubmitPay}
              disabled={payMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-submit-pay"
            >
              {payMutation.isPending ? "جارٍ التسجيل..." : "تأكيد الدفعة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      <Dialog
        open={!!historySupplier}
        onOpenChange={(o) => !o && setHistorySupplier(null)}
      >
        <DialogContent
          className="max-w-2xl bg-white dark:bg-gray-900"
          dir="rtl"
        >
          <DialogHeader>
            <DialogTitle>
              سجل دفعات: {historySupplier?.name}
            </DialogTitle>
            <DialogDescription>
              إجمالي المدفوع:{" "}
              <span className="font-bold text-green-700">
                {historySupplier ? fmt(getPaid(historySupplier)) : ""}
              </span>{" "}
              · المستحق المتبقي:{" "}
              <span className="font-bold text-red-600">
                {historySupplier ? fmt(getDue(historySupplier)) : ""}
              </span>
            </DialogDescription>
          </DialogHeader>
          {paymentsLoading ? (
            <div className="text-center py-6 text-gray-500">
              جاري التحميل...
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              لا توجد دفعات سابقة
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right">الطريقة</TableHead>
                    <TableHead className="text-right">ملاحظات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow
                      key={p.id}
                      data-testid={`row-payment-${p.id}`}
                    >
                      <TableCell className="text-sm">
                        {new Date(p.paid_at).toLocaleString("ar-YE")}
                      </TableCell>
                      <TableCell className="font-bold text-green-700">
                        {fmt(n(p.amount))}
                      </TableCell>
                      <TableCell className="text-sm">
                        {translateMethod(p.payment_method)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {p.notes || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setHistorySupplier(null)}
              data-testid="button-close-history"
            >
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function translateMethod(m?: string | null): string {
  const map: Record<string, string> = {
    cash: "نقدي",
    bank_transfer: "حوالة بنكية",
    kuraimi: "الكريمي",
    jaib: "جيب",
    floosak: "فلوسك",
    jawali: "جوالي",
    other: "أخرى",
  };
  return m ? map[m] || m : "—";
}
