import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import ProductDetail from "@/pages/ProductDetail";
import ProductDetailV2 from "@/pages/ProductDetailV2";
import type { PdpConfig } from "@shared/pdp-config";

interface PdpDecision {
  useNewPdp: boolean;
  config: PdpConfig | null;
}

// يقرّر الخادم — بناءً على نطاق التفعيل وحالة المنتج — أي صفحة تُعرض.
// أثناء التحميل نعرض مؤشراً (بلا وميض)، وعند أي خطأ/تعطيل نعود للصفحة القديمة.
export default function ProductDetailRouter() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery<PdpDecision>({
    queryKey: ["/api/pdp-layout/decision", id],
    queryFn: async () => {
      const r = await fetch(`/api/pdp-layout/decision/${id}`);
      if (!r.ok) return { useNewPdp: false, config: null };
      return r.json();
    },
    enabled: !!id,
    // مفتاح القتل الرئيسي يجب أن ينعكس فوراً: لا تخزين على العميل (الخادم يكاش 15ث فقط).
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" data-testid="pdp-router-loading">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (data?.useNewPdp && data.config) {
    return <ProductDetailV2 config={data.config} />;
  }
  return <ProductDetail />;
}
