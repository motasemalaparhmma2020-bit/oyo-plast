import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, Clock, DollarSign, Users, TrendingUp, Printer, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const roleLabels: Record<string, string> = {
  product_manager: "مدير المنتجات",
  order_manager: "مدير الطلبات",
  delivery: "مندوب التوصيل",
  finance: "المسؤول المالي",
  owner: "مالك مساعد",
};

const modelLabels: Record<string, string> = {
  fixed: "راتب ثابت",
  per_order: "بالطلب",
  hybrid: "مختلط",
};

interface PayrollEntry {
  userId: string;
  fullName: string;
  role: string;
  period: string;
  baseSalary: number;
  ratePerOrder: number;
  paymentModel: string;
  ordersCompleted: number;
  orderBonus: number;
  attendanceDays: number;
  absenceDays: number;
  deductions: number;
  bonuses: number;
  totalPay: number;
  isPaid: boolean;
  savedId: number | null;
  notes: string | null;
}

interface AdminPayrollProps {
  adminToken: string | null;
}

export default function AdminPayroll({ adminToken }: AdminPayrollProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [bonusEdits, setBonusEdits] = useState<Record<string, number>>({});
  const [notesEdits, setNotesEdits] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: entries = [], isLoading } = useQuery<PayrollEntry[]>({
    queryKey: ["/api/admin/payroll", period],
    queryFn: async () => {
      const res = await fetch(`/api/admin/payroll?period=${period}`, {
        headers: { "x-admin-token": adminToken || "" },
      });
      if (!res.ok) throw new Error("فشل جلب كشف الرواتب");
      return res.json();
    },
    enabled: !!adminToken,
  });

  const saveMutation = useMutation({
    mutationFn: async (entry: PayrollEntry & { bonusOverride?: number; notesOverride?: string; markPaid?: boolean }) => {
      const bonuses = entry.bonusOverride ?? entry.bonuses;
      const notes = entry.notesOverride ?? entry.notes ?? "";
      const isPaid = entry.markPaid !== undefined ? entry.markPaid : entry.isPaid;
      const deductionCalc = entry.paymentModel !== 'per_order' ? entry.deductions : 0;
      let totalPay = 0;
      if (entry.paymentModel === 'fixed') totalPay = entry.baseSalary - deductionCalc + bonuses;
      else if (entry.paymentModel === 'per_order') totalPay = entry.orderBonus + bonuses;
      else totalPay = (entry.baseSalary - deductionCalc) + entry.orderBonus + bonuses;

      const res = await fetch("/api/admin/payroll/save", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken || "" },
        body: JSON.stringify({ ...entry, bonuses, notes, isPaid, totalPay: Math.max(0, Math.round(totalPay)) }),
      });
      if (!res.ok) throw new Error("فشل الحفظ");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/payroll", period] });
      toast({ title: "✅ تم الحفظ بنجاح" });
    },
    onError: () => toast({ title: "فشل الحفظ", variant: "destructive" }),
  });

  const totalSalaries = entries.reduce((sum, e) => sum + e.totalPay, 0);
  const paidCount = entries.filter(e => e.isPaid).length;

  const toggleExpand = (uid: string) => setExpanded(prev => ({ ...prev, [uid]: !prev[uid] }));

  return (
    <div className="space-y-6" dir="rtl">
      {/* ─── Header ─────────────────────────────────────────── */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <DollarSign className="h-6 w-6 text-primary" />
                كشف الرواتب الشهري
              </CardTitle>
              <CardDescription>إدارة رواتب الفريق وتتبع المدفوعات</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">الشهر:</Label>
              <Input
                type="month"
                value={period}
                onChange={e => setPeriod(e.target.value)}
                className="w-40 text-sm"
                data-testid="input-payroll-period"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* ─── ملخص الكشف ─── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center border shadow-sm">
              <Users className="h-5 w-5 mx-auto mb-1 text-blue-500" />
              <p className="text-2xl font-bold text-blue-600">{entries.length}</p>
              <p className="text-xs text-gray-500">موظف</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center border shadow-sm">
              <DollarSign className="h-5 w-5 mx-auto mb-1 text-green-500" />
              <p className="text-lg font-bold text-green-600">{totalSalaries.toLocaleString("ar")}</p>
              <p className="text-xs text-gray-500">إجمالي ر.ي</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center border shadow-sm">
              <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-emerald-500" />
              <p className="text-2xl font-bold text-emerald-600">{paidCount}</p>
              <p className="text-xs text-gray-500">مدفوع</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center border shadow-sm">
              <Clock className="h-5 w-5 mx-auto mb-1 text-orange-500" />
              <p className="text-2xl font-bold text-orange-600">{entries.length - paidCount}</p>
              <p className="text-xs text-gray-500">معلق</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── قائمة الموظفين ─────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">لا يوجد موظفون نشطون</p>
            <p className="text-sm text-gray-400 mt-1">أضف موظفين من قسم "إدارة الفريق" أولاً</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const bonusVal = bonusEdits[entry.userId] ?? entry.bonuses;
            const notesVal = notesEdits[entry.userId] ?? entry.notes ?? "";
            const isExpanded = expanded[entry.userId];
            const deduction = entry.paymentModel !== 'per_order' ? entry.deductions : 0;
            let computed = 0;
            if (entry.paymentModel === 'fixed') computed = entry.baseSalary - deduction + bonusVal;
            else if (entry.paymentModel === 'per_order') computed = entry.orderBonus + bonusVal;
            else computed = (entry.baseSalary - deduction) + entry.orderBonus + bonusVal;
            const finalPay = Math.max(0, Math.round(computed));

            return (
              <Card key={entry.userId} className={`border-2 transition-all ${entry.isPaid ? "border-green-200 bg-green-50/30" : "border-gray-200"}`}>
                <CardContent className="p-4">
                  {/* ─── Row Header ─── */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-gray-800 dark:text-white">{entry.fullName}</p>
                        <Badge variant="outline" className="text-xs">{roleLabels[entry.role] || entry.role}</Badge>
                        <Badge variant="outline" className="text-xs text-purple-600 border-purple-200">{modelLabels[entry.paymentModel] || entry.paymentModel}</Badge>
                        {entry.isPaid ? (
                          <Badge className="bg-green-500 text-white text-xs gap-1"><CheckCircle2 className="h-3 w-3" />مدفوع</Badge>
                        ) : (
                          <Badge variant="outline" className="text-orange-500 border-orange-300 text-xs gap-1"><Clock className="h-3 w-3" />معلق</Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-xs text-gray-500">الراتب المستحق</p>
                        <p className="text-lg font-bold text-primary">{finalPay.toLocaleString("ar")} <span className="text-xs">ر.ي</span></p>
                      </div>
                      <button onClick={() => toggleExpand(entry.userId)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* ─── التفاصيل القابلة للطي ─── */}
                  {isExpanded && (
                    <div className="mt-4 space-y-4 border-t pt-4">
                      {/* الجدول التفصيلي */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
                          <p className="text-gray-500 text-xs">الراتب الأساسي</p>
                          <p className="font-bold">{entry.baseSalary.toLocaleString("ar")}</p>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-2 text-center">
                          <p className="text-gray-500 text-xs">أيام الحضور</p>
                          <p className="font-bold text-blue-600">{entry.attendanceDays} / {26}</p>
                        </div>
                        <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-2 text-center">
                          <p className="text-gray-500 text-xs">الخصومات</p>
                          <p className="font-bold text-red-500">-{Math.round(deduction).toLocaleString("ar")}</p>
                        </div>
                        {entry.paymentModel !== 'fixed' && (
                          <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-2 text-center">
                            <p className="text-gray-500 text-xs">مكافأة الطلبات ({entry.ordersCompleted})</p>
                            <p className="font-bold text-purple-600">+{Math.round(entry.orderBonus).toLocaleString("ar")}</p>
                          </div>
                        )}
                      </div>

                      {/* تعديل المكافأة والملاحظات */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">مكافأة إضافية (ر.ي)</Label>
                          <Input
                            type="number" min={0}
                            value={bonusVal}
                            onChange={e => setBonusEdits(prev => ({ ...prev, [entry.userId]: +e.target.value }))}
                            className="text-sm"
                            data-testid={`input-bonus-${entry.userId}`}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">ملاحظات</Label>
                          <Input
                            value={notesVal}
                            onChange={e => setNotesEdits(prev => ({ ...prev, [entry.userId]: e.target.value }))}
                            placeholder="ملاحظة اختيارية..."
                            className="text-sm"
                            data-testid={`input-notes-${entry.userId}`}
                          />
                        </div>
                      </div>

                      {/* الإجمالي النهائي */}
                      <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center justify-between">
                        <span className="font-bold text-gray-700 dark:text-gray-200">الإجمالي المستحق:</span>
                        <span className="text-2xl font-extrabold text-primary">{finalPay.toLocaleString("ar")} ر.ي</span>
                      </div>

                      {/* أزرار الإجراءات */}
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => saveMutation.mutate({ ...entry, bonusOverride: bonusVal, notesOverride: notesVal })}
                          disabled={saveMutation.isPending}
                          data-testid={`button-save-payroll-${entry.userId}`}
                        >
                          {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin ml-1" /> : null}
                          حفظ التعديلات
                        </Button>

                        {!entry.isPaid ? (
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => saveMutation.mutate({ ...entry, bonusOverride: bonusVal, notesOverride: notesVal, markPaid: true })}
                            disabled={saveMutation.isPending}
                            data-testid={`button-mark-paid-${entry.userId}`}
                          >
                            <CheckCircle2 className="h-3 w-3 ml-1" />
                            تأكيد الصرف ({finalPay.toLocaleString("ar")} ر.ي)
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-orange-500 border-orange-300"
                            onClick={() => saveMutation.mutate({ ...entry, bonusOverride: bonusVal, notesOverride: notesVal, markPaid: false })}
                            disabled={saveMutation.isPending}
                            data-testid={`button-mark-unpaid-${entry.userId}`}
                          >
                            إلغاء الصرف
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.print()}
                          className="mr-auto"
                          data-testid={`button-print-payroll-${entry.userId}`}
                        >
                          <Printer className="h-3 w-3 ml-1" />
                          طباعة
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ─── ملخص الكشف الكلي ─── */}
      {entries.length > 0 && (
        <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/10 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span className="font-bold text-gray-800 dark:text-white">إجمالي كشف {period}</span>
              </div>
              <div className="text-left">
                <p className="text-3xl font-extrabold text-primary">{totalSalaries.toLocaleString("ar")} <span className="text-base">ر.ي</span></p>
                <p className="text-xs text-gray-500">{paidCount} من {entries.length} موظف تم صرفهم</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
