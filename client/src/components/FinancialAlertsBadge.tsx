import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, AlertTriangle, Clock, DollarSign, TrendingUp, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

interface FinancialAlert {
  id: string;
  type: string;
  priority: string;
  title: string;
  message: string;
  orderId?: number;
  supplierId?: number;
  createdAt: string | Date;
}

interface AlertsResponse {
  total: number;
  highPriority: number;
  alerts: FinancialAlert[];
}

const iconMap: Record<string, React.ReactNode> = {
  supplier_timeout: <Clock className="h-4 w-4 text-red-500" />,
  pending_admin: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  commission_overdue: <DollarSign className="h-4 w-4 text-blue-500" />,
  supplier_high_balance: <TrendingUp className="h-4 w-4 text-orange-500" />,
  supplier_unpaid: <AlertCircle className="h-4 w-4 text-rose-500" />,
};

const priorityClass = (p: string) =>
  p === "high"
    ? "border-red-200 bg-red-50"
    : "border-amber-200 bg-amber-50";

export function FinancialAlertsBadge({ adminToken }: { adminToken: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data } = useQuery<AlertsResponse>({
    queryKey: ["/api/admin/financial-alerts"],
    queryFn: async () => {
      if (!adminToken) return { total: 0, highPriority: 0, alerts: [] };
      const res = await fetch("/api/admin/financial-alerts", {
        headers: { "x-admin-token": adminToken },
      });
      if (!res.ok) return { total: 0, highPriority: 0, alerts: [] };
      return res.json();
    },
    enabled: !!adminToken,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const total = data?.total || 0;
  const high = data?.highPriority || 0;
  const alerts = data?.alerts || [];

  return (
    <div ref={ref} className="relative">
      <Button
        size="sm"
        variant="secondary"
        className="relative gap-1.5"
        onClick={() => setOpen(!open)}
        data-testid="button-financial-alerts"
      >
        <Bell className="h-4 w-4" />
        <span className="hidden sm:inline">التنبيهات</span>
        {total > 0 && (
          <span
            className={`absolute -top-1 -left-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${
              high > 0 ? "bg-red-500" : "bg-amber-500"
            }`}
          >
            {total}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-xl sm:w-96">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-sm font-bold">تنبيهات مالية حرجة</h3>
            {high > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                {high} عاجل
              </span>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500">
                <Bell className="mx-auto mb-2 h-6 w-6 text-gray-300" />
                لا توجد تنبيهات مالية حالياً
              </div>
            ) : (
              <div className="divide-y">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`flex items-start gap-3 px-4 py-3 ${priorityClass(alert.priority)}`}
                  >
                    <div className="mt-0.5 shrink-0">{iconMap[alert.type] || <Bell className="h-4 w-4 text-gray-500" />}</div>
                    <div className="flex-1 text-xs">
                      <div className="font-bold text-gray-900">{alert.title}</div>
                      <div className="mt-0.5 text-gray-600">{alert.message}</div>
                      <div className="mt-1 flex items-center gap-2">
                        {alert.orderId && (
                          <Link href={`/admin?order=${alert.orderId}`}>
                            <span className="cursor-pointer text-primary underline">
                              طلب #{alert.orderId}
                            </span>
                          </Link>
                        )}
                        <span className="text-gray-400">
                          {new Date(alert.createdAt).toLocaleDateString("ar-YE")}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t px-4 py-2 text-center">
            <Link href="/admin?section=financial">
              <span className="text-xs text-primary underline">فتح المركز المالي</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
