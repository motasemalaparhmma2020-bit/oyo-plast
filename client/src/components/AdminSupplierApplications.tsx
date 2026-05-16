import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, FileText, MapPin, Phone, Building2, CheckCircle, XCircle,
  Clock, ExternalLink, MessageCircle
} from "lucide-react";

async function adminFetch(path: string, adminToken: string, options: RequestInit = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { ...(options.headers || {}), "x-admin-token": adminToken, "Content-Type": "application/json" },
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `${res.status}`);
  }
  return res.json();
}

interface SupplierApp {
  id: number;
  company_name: string;
  owner_name: string;
  phone: string;
  city: string;
  address: string | null;
  business_type: string | null;
  product_categories: string[] | null;
  message: string | null;
  documents_urls: string[] | null;
  contract_accepted_at: string | null;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  processed_at: string | null;
  created_at: string;
}

const BUSINESS_LABELS: Record<string, string> = {
  manufacturer: "مصنع/منتج",
  trader: "تاجر جملة",
  importer: "مستورد",
  retailer: "متجر تجزئة",
  other: "أخرى",
};

const STATUS_BADGES: Record<string, { label: string; cls: string; icon: any }> = {
  pending: { label: "بانتظار المراجعة", cls: "bg-amber-100 text-amber-800 border-amber-300", icon: Clock },
  approved: { label: "مقبول", cls: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: CheckCircle },
  rejected: { label: "مرفوض", cls: "bg-red-100 text-red-800 border-red-300", icon: XCircle },
};

export default function AdminSupplierApplications({ adminToken }: { adminToken: string | null }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const token = adminToken || "";
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [commissionRate, setCommissionRate] = useState("10");

  const { data: apps = [], isLoading } = useQuery<SupplierApp[]>({
    queryKey: ["/api/admin/supplier-applications", token],
    queryFn: () => adminFetch("/api/admin/supplier-applications", token),
    enabled: !!token,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, rejectionReason, commissionRate }: any) =>
      adminFetch(`/api/admin/supplier-applications/${id}/status`, token, {
        method: "PATCH",
        body: JSON.stringify({ status, rejectionReason, commissionRate }),
      }),
    onSuccess: (_data, vars: any) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/supplier-applications", token] });
      toast({
        title: vars.status === "approved" ? "تم قبول الطلب" : "تم رفض الطلب",
        description: vars.status === "approved" ? "تم إضافة المورّد للنظام" : undefined,
      });
      setRejectingId(null);
      setApprovingId(null);
      setRejectionReason("");
    },
    onError: (e: any) =>
      toast({ title: "خطأ", description: e.message || "فشل التحديث", variant: "destructive" }),
  });

  const filtered = filter === "all" ? apps : apps.filter(a => a.status === filter);

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">طلبات الموردين الجدد</h2>
          <p className="text-sm text-muted-foreground">مراجعة طلبات الانضمام من بوابة الشراكة</p>
        </div>
        <div className="flex gap-2">
          {(["pending", "approved", "rejected", "all"] as const).map(f => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
              data-testid={`filter-${f}`}
            >
              {f === "pending" ? "قيد المراجعة" : f === "approved" ? "مقبولة" : f === "rejected" ? "مرفوضة" : "الكل"}
              <span className="mr-1.5 text-xs opacity-70">
                ({f === "all" ? apps.length : apps.filter(a => a.status === f).length})
              </span>
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
          لا توجد طلبات في هذه الفئة
        </CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map(app => {
            const sb = STATUS_BADGES[app.status];
            const StatusIcon = sb.icon;
            const waUrl = `https://wa.me/967${app.phone.replace(/\D/g, "").replace(/^967/, "").replace(/^0/, "")}?text=مرحباً ${encodeURIComponent(app.owner_name)}, بخصوص طلب الانضمام كمورّد لأويو بلاست`;
            return (
              <Card key={app.id} className="border-2" data-testid={`card-supplier-app-${app.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-sky-100 flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-sky-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg" data-testid={`text-company-${app.id}`}>{app.company_name}</h3>
                        <p className="text-sm text-muted-foreground">{app.owner_name}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={`gap-1 ${sb.cls}`}>
                      <StatusIcon className="h-3 w-3" />
                      {sb.label}
                    </Badge>
                  </div>

                  <div className="grid md:grid-cols-2 gap-3 text-sm mb-3">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono">{app.phone}</span>
                      <a href={waUrl} target="_blank" rel="noopener noreferrer"
                        className="text-emerald-600 hover:underline mr-auto" data-testid={`link-wa-${app.id}`}>
                        <MessageCircle className="h-4 w-4 inline" />
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{app.city}{app.address ? ` — ${app.address}` : ""}</span>
                    </div>
                  </div>

                  {(app.business_type || app.product_categories?.length) && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {app.business_type && (
                        <Badge variant="secondary" className="text-xs">
                          {BUSINESS_LABELS[app.business_type] || app.business_type}
                        </Badge>
                      )}
                      {(app.product_categories || []).map(c => (
                        <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                      ))}
                    </div>
                  )}

                  {app.message && (
                    <div className="bg-muted/50 rounded-lg p-3 text-sm mb-3">
                      <p className="text-xs font-bold mb-1 text-muted-foreground">رسالة مقدم الطلب:</p>
                      {app.message}
                    </div>
                  )}

                  {app.documents_urls && app.documents_urls.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-bold mb-2 text-muted-foreground">المستندات المرفقة:</p>
                      <div className="flex flex-wrap gap-2">
                        {app.documents_urls.map((url, idx) => (
                          <a key={idx} href={url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 rounded-lg text-xs text-sky-700 border border-sky-200"
                            data-testid={`link-doc-${app.id}-${idx}`}>
                            <FileText className="h-3 w-3" />
                            مستند #{idx + 1}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-3 border-t">
                    <span className="text-xs text-muted-foreground">
                      {new Date(app.created_at).toLocaleString("ar-YE")}
                      {app.contract_accepted_at && " · وقّع العقد ✓"}
                    </span>
                    {app.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-red-300 text-red-700 hover:bg-red-50"
                          onClick={() => setRejectingId(app.id)}
                          data-testid={`button-reject-${app.id}`}
                        >
                          <XCircle className="h-4 w-4 ml-1" />
                          رفض
                        </Button>
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => { setApprovingId(app.id); setCommissionRate("10"); }}
                          data-testid={`button-approve-${app.id}`}
                        >
                          <CheckCircle className="h-4 w-4 ml-1" />
                          قبول
                        </Button>
                      </div>
                    )}
                    {app.status === "rejected" && app.rejection_reason && (
                      <span className="text-xs text-red-600 italic">السبب: {app.rejection_reason}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Approve Dialog */}
      <Dialog open={!!approvingId} onOpenChange={(o) => !o && setApprovingId(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>قبول المورّد</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              سيتم إنشاء حساب مورّد جديد في النظام مع البيانات المُرسلة.
            </p>
            <div>
              <Label htmlFor="commission">عمولة المنصة (%)</Label>
              <Input
                id="commission"
                type="number"
                min="0"
                max="50"
                value={commissionRate}
                onChange={e => setCommissionRate(e.target.value)}
                data-testid="input-commission-rate"
              />
              <p className="text-xs text-muted-foreground mt-1">
                النسبة التي يخصمها المتجر من قيمة كل طلب يقوم به المورّد
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setApprovingId(null)}>إلغاء</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => updateMutation.mutate({
                id: approvingId,
                status: "approved",
                commissionRate: Number(commissionRate) || 10,
              })}
              disabled={updateMutation.isPending}
              data-testid="button-confirm-approve"
            >
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "تأكيد القبول"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectingId} onOpenChange={(o) => !o && setRejectingId(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>رفض الطلب</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="reason">سبب الرفض (اختياري — سيُعرض على المتقدّم)</Label>
            <Textarea
              id="reason"
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="مثال: المستندات غير واضحة، أو نوع النشاط غير مناسب حالياً..."
              rows={3}
              data-testid="textarea-rejection-reason"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejectingId(null)}>إلغاء</Button>
            <Button
              variant="destructive"
              onClick={() => updateMutation.mutate({
                id: rejectingId,
                status: "rejected",
                rejectionReason: rejectionReason || null,
              })}
              disabled={updateMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "تأكيد الرفض"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
