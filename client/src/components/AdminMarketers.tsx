import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Users, CheckCircle, XCircle, Clock, Wallet, Eye, Plus, Pencil,
  ChevronDown, ChevronUp, ExternalLink, AlertCircle,
} from "lucide-react";

function adminFetch(path: string, adminToken: string, options: RequestInit = {}) {
  return fetch(path, {
    ...options,
    headers: { ...(options.headers || {}), "x-admin-token": adminToken, "Content-Type": "application/json" },
  }).then(async (r) => {
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || "خطأ");
    return data;
  });
}

const APP_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "بانتظار المراجعة", color: "bg-yellow-100 text-yellow-700" },
  approved: { label: "مقبول", color: "bg-green-100 text-green-700" },
  rejected: { label: "مرفوض", color: "bg-red-100 text-red-700" },
};

const W_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "قيد المراجعة", color: "bg-yellow-100 text-yellow-700" },
  approved: { label: "معتمد", color: "bg-blue-100 text-blue-700" },
  paid: { label: "مدفوع", color: "bg-green-100 text-green-700" },
  rejected: { label: "مرفوض", color: "bg-red-100 text-red-700" },
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "واتساب", tiktok: "تيك توك", instagram: "إنستغرام",
  youtube: "يوتيوب", facebook: "فيسبوك", other: "أخرى",
};

// ═══════════════════════════════════════════════════════
// قسم طلبات الانضمام
// ═══════════════════════════════════════════════════════
function ApplicationsTab({ adminToken }: { adminToken: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [approveDlg, setApproveDlg] = useState<any>(null);
  const [approveForm, setApproveForm] = useState({ pin: "1234", couponCode: "", commissionRate: "5", discountRate: "5" });
  const [rejectDlg, setRejectDlg] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: apps = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/marketer-applications"],
    queryFn: () => adminFetch("/api/admin/marketer-applications", adminToken),
  });

  const processApp = useMutation({
    mutationFn: (payload: any) =>
      adminFetch(`/api/admin/marketer-applications/${payload.id}/status`, adminToken, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast({ title: "تم تحديث حالة الطلب" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketer-applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketers"] });
      setApproveDlg(null);
      setRejectDlg(null);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const pending = apps.filter((a) => a.status === "pending");
  const processed = apps.filter((a) => a.status !== "pending");

  return (
    <div className="space-y-6">
      {/* ── طلبات بانتظار القرار */}
      <div>
        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-yellow-500" />
          بانتظار المراجعة ({pending.length})
        </h3>
        {isLoading ? (
          <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
        ) : pending.length === 0 ? (
          <p className="text-gray-400 text-sm py-4 text-center">لا توجد طلبات معلقة</p>
        ) : (
          <div className="space-y-3">
            {pending.map((app) => (
              <div key={app.id} data-testid={`app-card-${app.id}`}
                className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-gray-800">{app.name}</span>
                    <Badge variant="outline" className="text-xs">{CHANNEL_LABELS[app.channel] || app.channel}</Badge>
                  </div>
                  <div className="text-sm text-gray-500 flex flex-wrap gap-3">
                    <span>📱 {app.phone}</span>
                    <span>📍 {app.city}</span>
                    {app.channel_handle && <span>🔗 {app.channel_handle}</span>}
                    {app.audience_size && <span>👥 {app.audience_size === "large" ? "جمهور كبير" : app.audience_size === "medium" ? "متوسط" : "صغير"}</span>}
                  </div>
                  {app.message && <p className="text-xs text-gray-400 mt-1 italic">"{app.message}"</p>}
                </div>
                <div className="flex gap-2">
                  <Button
                    data-testid={`button-approve-${app.id}`}
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => { setApproveDlg(app); setApproveForm({ pin: "1234", couponCode: app.name.substring(0,3).toUpperCase() + app.id, commissionRate: "5", discountRate: "5" }); }}
                  >
                    قبول
                  </Button>
                  <Button
                    data-testid={`button-reject-${app.id}`}
                    size="sm"
                    variant="outline"
                    className="border-red-300 text-red-600 hover:bg-red-50"
                    onClick={() => { setRejectDlg(app); setRejectReason(""); }}
                  >
                    رفض
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── طلبات مُعالجة */}
      {processed.length > 0 && (
        <div>
          <h3 className="font-bold text-gray-600 text-sm mb-2">الطلبات المُعالجة ({processed.length})</h3>
          <div className="space-y-2">
            {processed.map((app) => {
              const s = APP_STATUS_MAP[app.status] || { label: app.status, color: "bg-gray-100 text-gray-600" };
              return (
                <div key={app.id} className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">{app.name} — {app.phone}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${s.color}`}>{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Approve Dialog */}
      <Dialog open={!!approveDlg} onOpenChange={() => setApproveDlg(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>قبول طلب — {approveDlg?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm mb-1 block">كود الكوبون *</Label>
                <Input
                  data-testid="input-approve-coupon"
                  value={approveForm.couponCode}
                  onChange={(e) => setApproveForm({ ...approveForm, couponCode: e.target.value.toUpperCase() })}
                  placeholder="OYO25"
                  className="uppercase"
                />
              </div>
              <div>
                <Label className="text-sm mb-1 block">الرقم السري (PIN) *</Label>
                <Input
                  data-testid="input-approve-pin"
                  value={approveForm.pin}
                  onChange={(e) => setApproveForm({ ...approveForm, pin: e.target.value })}
                  placeholder="1234"
                  maxLength={8}
                />
              </div>
              <div>
                <Label className="text-sm mb-1 block">عمولة المسوق %</Label>
                <Input
                  type="number"
                  value={approveForm.commissionRate}
                  onChange={(e) => setApproveForm({ ...approveForm, commissionRate: e.target.value })}
                  min="1" max="20"
                />
              </div>
              <div>
                <Label className="text-sm mb-1 block">خصم العميل %</Label>
                <Input
                  type="number"
                  value={approveForm.discountRate}
                  onChange={(e) => setApproveForm({ ...approveForm, discountRate: e.target.value })}
                  min="1" max="30"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setApproveDlg(null)}>إلغاء</Button>
              <Button
                data-testid="button-confirm-approve"
                disabled={processApp.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => processApp.mutate({ id: approveDlg.id, status: "approved", ...approveForm })}
              >
                {processApp.isPending ? "جارٍ القبول..." : "تأكيد القبول"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Reject Dialog */}
      <Dialog open={!!rejectDlg} onOpenChange={() => setRejectDlg(null)}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>رفض طلب — {rejectDlg?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-sm mb-1 block">سبب الرفض (اختياري)</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="لا يستوفي الشروط..."
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setRejectDlg(null)}>إلغاء</Button>
              <Button
                data-testid="button-confirm-reject"
                disabled={processApp.isPending}
                variant="destructive"
                onClick={() => processApp.mutate({ id: rejectDlg.id, status: "rejected", rejectionReason: rejectReason })}
              >
                {processApp.isPending ? "جارٍ..." : "تأكيد الرفض"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// قسم المسوقين المعتمدين
// ═══════════════════════════════════════════════════════
function MarketersListTab({ adminToken }: { adminToken: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addDlg, setAddDlg] = useState(false);
  const [editDlg, setEditDlg] = useState<any>(null);
  const [addForm, setAddForm] = useState({ name: "", phone: "", city: "", channel: "", channelHandle: "", pin: "1234", couponCode: "", commissionRate: "5", discountRate: "5", notes: "" });
  const [editForm, setEditForm] = useState<any>({});

  const { data: marketers = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/marketers"],
    queryFn: () => adminFetch("/api/admin/marketers", adminToken),
  });

  const addMutation = useMutation({
    mutationFn: (data: any) =>
      adminFetch("/api/admin/marketers", adminToken, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: "تم إضافة المسوق" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketers"] });
      setAddDlg(false);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: (data: any) =>
      adminFetch(`/api/admin/marketers/${data.id}`, adminToken, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: "تم التحديث" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketers"] });
      setEditDlg(null);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-600" />
          المسوقون المعتمدون ({marketers.length})
        </h3>
        <Button data-testid="button-add-marketer" size="sm" onClick={() => setAddDlg(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="w-4 h-4 ml-1" />إضافة مسوق
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : marketers.length === 0 ? (
        <p className="text-center text-gray-400 py-8">لا يوجد مسوقون بعد</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs">
                <th className="px-3 py-2.5 text-right">الاسم</th>
                <th className="px-3 py-2.5 text-right">الهاتف</th>
                <th className="px-3 py-2.5 text-right">الكوبون</th>
                <th className="px-3 py-2.5 text-right">عمولة%</th>
                <th className="px-3 py-2.5 text-right">خصم%</th>
                <th className="px-3 py-2.5 text-right">الطلبات</th>
                <th className="px-3 py-2.5 text-right">المحفظة</th>
                <th className="px-3 py-2.5 text-right">انتظار</th>
                <th className="px-3 py-2.5 text-right">الحالة</th>
                <th className="px-3 py-2.5 text-right">تعديل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(marketers as any[]).map((m) => (
                <tr key={m.id} data-testid={`marketer-row-${m.id}`} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 font-medium">{m.name}</td>
                  <td className="px-3 py-2.5 text-gray-500 dir-ltr">{m.phone}</td>
                  <td className="px-3 py-2.5">
                    <code className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-xs font-bold">{m.coupon_code}</code>
                  </td>
                  <td className="px-3 py-2.5 text-center">{m.commission_rate}%</td>
                  <td className="px-3 py-2.5 text-center">{m.discount_rate}%</td>
                  <td className="px-3 py-2.5 text-center">{m.actual_orders || m.total_orders || 0}</td>
                  <td className="px-3 py-2.5 font-semibold text-emerald-700">
                    {Number(m.wallet_balance || 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-orange-600">
                    {Number(m.pending_payout || 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${m.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {m.is_active ? "نشط" : "موقوف"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      data-testid={`button-edit-marketer-${m.id}`}
                      onClick={() => { setEditDlg(m); setEditForm({ id: m.id, name: m.name, phone: m.phone, pin: m.pin, couponCode: m.coupon_code, commissionRate: m.commission_rate, discountRate: m.discount_rate, isActive: m.is_active, walletBalance: m.wallet_balance, notes: m.notes || "" }); }}
                      className="p-1.5 hover:bg-gray-100 rounded-lg"
                    >
                      <Pencil className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={addDlg} onOpenChange={setAddDlg}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>إضافة مسوق جديد</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-2">
            {[
              { label: "الاسم *", key: "name", placeholder: "محمد علي" },
              { label: "الهاتف *", key: "phone", placeholder: "77XXXXXXXX" },
              { label: "كود الكوبون *", key: "couponCode", placeholder: "OYO25", upper: true },
              { label: "PIN *", key: "pin", placeholder: "1234" },
              { label: "المدينة", key: "city", placeholder: "صنعاء" },
              { label: "القناة", key: "channel", placeholder: "whatsapp" },
              { label: "عمولة المسوق %", key: "commissionRate", placeholder: "5" },
              { label: "خصم العميل %", key: "discountRate", placeholder: "5" },
            ].map((f) => (
              <div key={f.key}>
                <Label className="text-xs mb-1 block">{f.label}</Label>
                <Input
                  value={(addForm as any)[f.key]}
                  onChange={(e) => setAddForm({ ...addForm, [f.key]: f.upper ? e.target.value.toUpperCase() : e.target.value })}
                  placeholder={f.placeholder}
                  className={f.upper ? "uppercase" : ""}
                />
              </div>
            ))}
            <div className="col-span-2">
              <Label className="text-xs mb-1 block">ملاحظات</Label>
              <Textarea value={addForm.notes} onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })} rows={2} />
            </div>
            <div className="col-span-2 flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAddDlg(false)}>إلغاء</Button>
              <Button
                data-testid="button-confirm-add-marketer"
                disabled={addMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => addMutation.mutate(addForm)}
              >
                {addMutation.isPending ? "جارٍ..." : "إضافة"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editDlg} onOpenChange={() => setEditDlg(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>تعديل — {editDlg?.name}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-2">
            {[
              { label: "الاسم", key: "name" },
              { label: "الهاتف", key: "phone" },
              { label: "الكوبون", key: "couponCode", upper: true },
              { label: "PIN", key: "pin" },
              { label: "عمولة%", key: "commissionRate" },
              { label: "خصم%", key: "discountRate" },
              { label: "رصيد المحفظة", key: "walletBalance" },
            ].map((f) => (
              <div key={f.key}>
                <Label className="text-xs mb-1 block">{f.label}</Label>
                <Input
                  value={editForm[f.key] ?? ""}
                  onChange={(e) => setEditForm({ ...editForm, [f.key]: f.upper ? e.target.value.toUpperCase() : e.target.value })}
                  className={f.upper ? "uppercase" : ""}
                />
              </div>
            ))}
            <div className="flex items-center gap-2 col-span-2">
              <Label className="text-sm">الحالة:</Label>
              <button
                onClick={() => setEditForm({ ...editForm, isActive: !editForm.isActive })}
                className={`px-3 py-1 rounded-full text-sm font-medium ${editForm.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
              >
                {editForm.isActive ? "نشط" : "موقوف"}
              </button>
            </div>
            <div className="col-span-2">
              <Label className="text-xs mb-1 block">ملاحظات</Label>
              <Textarea value={editForm.notes || ""} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={2} />
            </div>
            <div className="col-span-2 flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditDlg(null)}>إلغاء</Button>
              <Button
                data-testid="button-confirm-edit-marketer"
                disabled={editMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => editMutation.mutate(editForm)}
              >
                {editMutation.isPending ? "جارٍ..." : "حفظ"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// قسم طلبات السحب
// ═══════════════════════════════════════════════════════
function WithdrawalsTab({ adminToken }: { adminToken: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState("");

  const { data: withdrawals = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/marketer-withdrawals"],
    queryFn: () => adminFetch("/api/admin/marketer-withdrawals", adminToken),
  });

  const updateW = useMutation({
    mutationFn: (payload: any) =>
      adminFetch(`/api/admin/marketer-withdrawals/${payload.id}`, adminToken, {
        method: "PATCH", body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast({ title: "تم تحديث طلب السحب" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketer-withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketers"] });
      setSelected(null);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const pending = withdrawals.filter((w) => w.status === "pending");
  const processed = withdrawals.filter((w) => w.status !== "pending");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-orange-500" />
          طلبات معلقة ({pending.length})
        </h3>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : pending.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">لا توجد طلبات معلقة</p>
        ) : (
          <div className="space-y-3">
            {pending.map((w) => (
              <div key={w.id} data-testid={`withdrawal-card-${w.id}`}
                className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-gray-800">{w.marketer_name}</span>
                    <span className="text-xs text-gray-500">{w.marketer_phone}</span>
                  </div>
                  <div className="text-sm text-gray-600 flex flex-wrap gap-3">
                    <span className="font-bold text-orange-700">{Number(w.amount).toLocaleString()} ر.ي</span>
                    <span>• {w.payment_method}</span>
                    {w.payment_details && <span>• {w.payment_details}</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    رصيد المحفظة: {Number(w.wallet_balance || 0).toLocaleString()} ر.ي
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    data-testid={`button-pay-${w.id}`}
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => { setSelected(w); setAdminNotes(""); }}
                  >
                    معالجة
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {processed.length > 0 && (
        <div>
          <h3 className="font-bold text-gray-600 text-sm mb-2">الطلبات المُعالجة ({processed.length})</h3>
          <div className="space-y-1.5">
            {processed.map((w) => {
              const s = W_STATUS_MAP[w.status] || { label: w.status, color: "bg-gray-100 text-gray-600" };
              return (
                <div key={w.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2.5 text-sm">
                  <span>{w.marketer_name} — <strong>{Number(w.amount).toLocaleString()} ر.ي</strong></span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${s.color}`}>{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Process Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>معالجة طلب سحب — {selected?.marketer_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">المبلغ:</span><span className="font-bold">{Number(selected?.amount || 0).toLocaleString()} ر.ي</span></div>
              <div className="flex justify-between"><span className="text-gray-500">الطريقة:</span><span>{selected?.payment_method}</span></div>
              {selected?.payment_details && <div className="flex justify-between"><span className="text-gray-500">التفاصيل:</span><span className="font-medium">{selected?.payment_details}</span></div>}
            </div>
            <div>
              <Label className="text-sm mb-1 block">ملاحظات الأدمن</Label>
              <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={2} placeholder="ملاحظة اختيارية..." />
            </div>
            <div className="flex gap-2">
              <Button
                data-testid="button-mark-paid"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                disabled={updateW.isPending}
                onClick={() => updateW.mutate({ id: selected.id, status: "paid", adminNotes })}
              >
                ✅ تم الدفع
              </Button>
              <Button
                data-testid="button-reject-withdrawal"
                variant="destructive"
                disabled={updateW.isPending}
                onClick={() => updateW.mutate({ id: selected.id, status: "rejected", adminNotes })}
              >
                رفض
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// المكوّن الرئيسي
// ═══════════════════════════════════════════════════════
export function AdminMarketers({ adminToken }: { adminToken: string }) {
  const [activeTab, setActiveTab] = useState<"applications" | "marketers" | "withdrawals">("applications");

  const { data: apps = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/marketer-applications"],
    queryFn: () => adminFetch("/api/admin/marketer-applications", adminToken),
  });
  const { data: withdrawals = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/marketer-withdrawals"],
    queryFn: () => adminFetch("/api/admin/marketer-withdrawals", adminToken),
  });

  const pendingApps = (apps as any[]).filter((a) => a.status === "pending").length;
  const pendingW = (withdrawals as any[]).filter((w) => w.status === "pending").length;

  const tabs = [
    { id: "applications" as const, label: "طلبات الانضمام", badge: pendingApps },
    { id: "marketers" as const, label: "المسوقون المعتمدون", badge: 0 },
    { id: "withdrawals" as const, label: "طلبات السحب", badge: pendingW },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-xl flex items-center justify-center">
          <Users className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">إدارة المسوّقين</h2>
          <p className="text-sm text-gray-500">منظومة التسويق بالعمولة</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.id}
            data-testid={`admin-marketers-tab-${t.id}`}
            onClick={() => setActiveTab(t.id)}
            className={`relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === t.id
                ? "bg-emerald-600 text-white shadow-md"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t.label}
            {t.badge > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        {activeTab === "applications" && <ApplicationsTab adminToken={adminToken} />}
        {activeTab === "marketers" && <MarketersListTab adminToken={adminToken} />}
        {activeTab === "withdrawals" && <WithdrawalsTab adminToken={adminToken} />}
      </div>
    </div>
  );
}
