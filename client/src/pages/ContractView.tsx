import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, FileText, Shield, Clock, AlertCircle } from "lucide-react";

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  pending:  { label: "بانتظار القبول", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  accepted: { label: "مقبول ومُوقَّع", color: "bg-green-100 text-green-700", icon: CheckCircle },
  rejected: { label: "مرفوض", color: "bg-red-100 text-red-700", icon: XCircle },
  expired:  { label: "منتهي الصلاحية", color: "bg-gray-100 text-gray-600", icon: AlertCircle },
};

const TYPE_MAP: Record<string, string> = {
  marketer: "عقد شراكة تسويقية",
  supplier: "عقد شراكة توريد",
  staff:    "عقد توظيف",
  other:    "عقد عام",
};

export default function ContractView() {
  const [, params] = useRoute("/contract/:id");
  const id = params?.id;
  const [contractRead, setContractRead] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const { data: contract, isLoading, error } = useQuery<any>({
    queryKey: ["/api/digital-contracts", id],
    queryFn: async () => {
      const r = await fetch(`/api/digital-contracts/${id}`);
      if (!r.ok) throw new Error("العقد غير موجود");
      return r.json();
    },
    enabled: !!id,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/digital-contracts/${id}/accept`, { method: "POST" });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: () => setAccepted(true),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">جارٍ تحميل العقد...</p>
        </div>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="py-12 text-center">
            <XCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-700 mb-2">العقد غير موجود</h2>
            <p className="text-muted-foreground text-sm">تأكد من الرابط أو تواصل مع الإدارة</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = STATUS_MAP[contract.status] || STATUS_MAP.pending;
  const StatusIcon = status.icon;
  const isExpired = contract.expires_at && new Date(contract.expires_at) < new Date();
  const canAccept = contract.status === "pending" && !isExpired && !accepted;

  if (accepted || contract.status === "accepted") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
        <Card className="max-w-md w-full mx-4 border-green-200">
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-20 w-20 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-green-700 mb-2">تم قبول العقد بنجاح</h2>
            <p className="text-muted-foreground text-sm mb-4">تم تسجيل موافقتك الرقمية بتاريخ وتوقيت دقيق</p>
            {contract.accepted_at && (
              <p className="text-xs text-gray-400">
                {new Date(contract.accepted_at).toLocaleDateString("ar-YE", {
                  year: "numeric", month: "long", day: "numeric",
                  hour: "2-digit", minute: "2-digit"
                })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4" dir="rtl">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* رأس العقد */}
        <Card className="border-2 border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">{contract.contract_title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{TYPE_MAP[contract.contract_type] || contract.contract_type}</p>
                </div>
              </div>
              <Badge className={`${status.color} flex items-center gap-1 shrink-0`}>
                <StatusIcon className="h-3.5 w-3.5" />
                {status.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">الطرف الثاني:</span>
              <span>{contract.party_name}</span>
              {contract.party_phone && <span className="text-xs">({contract.party_phone})</span>}
            </div>
            {contract.admin_signed_at && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">توقيع الإدارة:</span>
                <span>{new Date(contract.admin_signed_at).toLocaleDateString("ar-YE")}</span>
              </div>
            )}
            {contract.expires_at && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">صالح حتى:</span>
                <span className={isExpired ? "text-red-500 font-bold" : ""}>
                  {new Date(contract.expires_at).toLocaleDateString("ar-YE")}
                  {isExpired && " (منتهي)"}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* نص العقد */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">بنود العقد</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="bg-gray-50 rounded-lg p-4 max-h-80 overflow-y-auto border"
              onScroll={(e) => {
                const el = e.currentTarget;
                if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) setContractRead(true);
              }}
            >
              <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 leading-loose">
                {contract.contract_text}
              </pre>
            </div>
            {canAccept && !contractRead && (
              <p className="text-xs text-center text-muted-foreground mt-2">
                اقرأ العقد كاملاً بالتمرير للأسفل لتفعيل زر القبول
              </p>
            )}
          </CardContent>
        </Card>

        {/* قسم القبول */}
        {canAccept ? (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-2 text-sm text-emerald-800">
                <Shield className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
                <p>بالضغط على "أوافق وأوقّع"، يُسجَّل قبولك الرقمي مع الوقت والتاريخ الدقيق وعنوان IP الخاص بك كتوقيع إلكتروني ملزم.</p>
              </div>
              <Button
                data-testid="button-accept-contract-view"
                disabled={!contractRead || acceptMutation.isPending}
                className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-base font-bold"
                onClick={() => acceptMutation.mutate()}
              >
                {acceptMutation.isPending ? "جارٍ الحفظ..." : "✅ أوافق وأوقّع على العقد"}
              </Button>
            </CardContent>
          </Card>
        ) : isExpired ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4 text-center text-red-700 text-sm">
              انتهت صلاحية هذا العقد — تواصل مع الإدارة للحصول على رابط جديد
            </CardContent>
          </Card>
        ) : null}

      </div>
    </div>
  );
}
