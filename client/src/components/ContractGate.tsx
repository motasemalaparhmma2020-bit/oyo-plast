import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, CheckCircle2, ShieldCheck, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ContractGateProps {
  contractType: "supplier" | "employee" | "marketer";
  partyId: string;
  partyName?: string;
  partyRole?: string;
  onAccepted: () => void;
  children: React.ReactNode;
}

export function ContractGate({ contractType, partyId, partyName, partyRole, onAccepted, children }: ContractGateProps) {
  const { toast } = useToast();
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [agreed, setAgreed] = useState(false);

  // تحقق هل وقّع مسبقاً؟
  const { data: statusData, isLoading: statusLoading } = useQuery<{ accepted: boolean; record: any }>({
    queryKey: ["/api/contracts/status", contractType, partyId],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/status?type=${contractType}&partyId=${partyId}`);
      return res.json();
    },
    enabled: !!partyId,
  });

  // جلب نص العقد
  const { data: contractData, isLoading: contractLoading } = useQuery<any>({
    queryKey: ["/api/contracts", contractType],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/${contractType}`);
      if (res.status === 404) return null;
      return res.json();
    },
    enabled: !!partyId && statusData?.accepted === false,
  });

  // قبول العقد
  const acceptMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/contracts/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractType,
          partyId,
          partyName: partyName || partyId,
          partyRole: partyRole || contractType,
          contractVersion: contractData?.version || "1.0",
        }),
      });
      if (!res.ok) throw new Error("فشل التوثيق");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "✅ تم توثيق موافقتك بنجاح" });
      onAccepted();
    },
    onError: () => toast({ title: "فشل توثيق الموافقة، حاول مجدداً", variant: "destructive" }),
  });

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
      setScrolledToEnd(true);
    }
  };

  if (statusLoading || contractLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // إذا وقّع مسبقاً أو لا يوجد عقد → أظهر المحتوى مباشرة
  if (statusData?.accepted || !contractData) {
    return <>{children}</>;
  }

  const typeLabels: Record<string, string> = {
    supplier: "عقد المورد",
    employee: "عقد العمل",
    marketer: "اتفاقية التسويق",
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary/80 p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{typeLabels[contractType] || "العقد الرقمي"}</h2>
              <p className="text-white/80 text-sm mt-0.5">يرجى قراءة العقد كاملاً قبل المتابعة</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* معلومات */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 rounded-xl p-3 flex gap-2">
            <AlertCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              هذا العقد يحمي حقوقك ويحدد التزاماتك. موافقتك الإلكترونية تُسجَّل مع التاريخ والوقت وعنوان IP كدليل قانوني.
            </p>
          </div>

          {/* نص العقد */}
          <div>
            <h3 className="font-bold text-sm mb-2">{contractData.title}</h3>
            <div
              className="border rounded-xl p-4 max-h-72 overflow-y-auto bg-gray-50 dark:bg-gray-800 text-sm leading-relaxed"
              onScroll={handleScroll}
              data-testid="contract-text-scroll"
            >
              <pre className="whitespace-pre-wrap font-sans text-gray-700 dark:text-gray-300">
                {contractData.body}
              </pre>
            </div>
            {!scrolledToEnd && (
              <p className="text-xs text-amber-600 mt-1 text-center animate-pulse">
                ↓ قم بالتمرير لأسفل لقراءة العقد كاملاً
              </p>
            )}
          </div>

          {/* خانة الموافقة */}
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              disabled={!scrolledToEnd}
              className="mt-1 w-4 h-4 accent-primary"
              data-testid="checkbox-contract-agree"
            />
            <span className={`text-sm ${!scrolledToEnd ? "text-gray-400" : "text-gray-700 dark:text-gray-200"}`}>
              أقرّ بأنني قرأت هذا العقد بالكامل وأوافق على جميع بنوده. أفهم أن موافقتي هذه ملزمة قانونياً.
            </span>
          </label>

          {/* زر القبول */}
          <Button
            className="w-full gap-2"
            size="lg"
            disabled={!agreed || !scrolledToEnd || acceptMutation.isPending}
            onClick={() => acceptMutation.mutate()}
            data-testid="button-accept-contract"
          >
            {acceptMutation.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <CheckCircle2 className="h-4 w-4" />}
            {acceptMutation.isPending ? "جاري التوثيق..." : "أوافق وأمضي للمتابعة"}
          </Button>

          <div className="flex items-center justify-center gap-1 text-xs text-gray-400">
            <ShieldCheck className="h-3 w-3" />
            <span>توثيق إلكتروني محمي · إصدار {contractData.version}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
