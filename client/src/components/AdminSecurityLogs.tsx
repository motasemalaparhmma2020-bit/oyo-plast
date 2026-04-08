import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2, ShieldAlert, ShieldCheck, AlertTriangle, XCircle,
  Activity, Globe, Clock
} from "lucide-react";

function severityConfig(s: string) {
  switch (s) {
    case "critical": return { label: "حرج", icon: XCircle,       color: "text-red-600",    bg: "bg-red-50 dark:bg-red-950/20" };
    case "warning":  return { label: "تحذير", icon: AlertTriangle, color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950/20" };
    default:         return { label: "معلومة", icon: Activity,     color: "text-blue-600",   bg: "bg-blue-50 dark:bg-blue-950/20" };
  }
}

const EVENT_LABELS: Record<string, string> = {
  rate_limit_general:   "تجاوز الحد العام",
  rate_limit_admin:     "تجاوز حد الإدارة",
  brute_force_attempt:  "محاولة اختراق متكررة",
  order_spam:           "إغراق بالطلبات",
};

export default function AdminSecurityLogs({ adminToken }: { adminToken: string | null }) {
  const [severity, setSeverity] = useState<string>("all");

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/admin/security-logs", severity],
    queryFn: async () => {
      const params = severity !== "all" ? `?severity=${severity}` : "";
      const res = await fetch(`/api/admin/security-logs${params}`, {
        headers: { "x-admin-token": adminToken || "" },
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: !!adminToken,
    refetchInterval: 30000,
  });

  const logs: any[] = data?.logs || [];
  const summary: any[] = data?.summary || [];

  const criticalCount = summary.find(s => s.severity === "critical")?.count ?? 0;
  const warningCount  = summary.find(s => s.severity === "warning")?.count  ?? 0;
  const infoCount     = summary.find(s => s.severity === "info")?.count     ?? 0;

  return (
    <div className="space-y-5 pb-10" dir="rtl">

      {/* بطاقات ملخص آخر 24 ساعة */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-red-50 to-rose-50">
          <CardContent className="p-4 text-center">
            <XCircle className="h-5 w-5 mx-auto mb-1 text-red-600" />
            <p className="text-2xl font-black text-red-700">{criticalCount}</p>
            <p className="text-xs text-muted-foreground">أحداث حرجة (24س)</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-yellow-50 to-amber-50">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-yellow-600" />
            <p className="text-2xl font-black text-yellow-700">{warningCount}</p>
            <p className="text-xs text-muted-foreground">تحذيرات (24س)</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardContent className="p-4 text-center">
            <Activity className="h-5 w-5 mx-auto mb-1 text-blue-600" />
            <p className="text-2xl font-black text-blue-700">{infoCount}</p>
            <p className="text-xs text-muted-foreground">أحداث عامة (24س)</p>
          </CardContent>
        </Card>
      </div>

      {/* تصفية */}
      <div className="flex gap-2 flex-wrap items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {[
            { key: "all",      label: "الكل" },
            { key: "critical", label: "🔴 حرج" },
            { key: "warning",  label: "🟡 تحذير" },
            { key: "info",     label: "🔵 معلومة" },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setSeverity(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                severity === f.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
              data-testid={`filter-security-${f.key}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => refetch()}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <Activity className="h-3 w-3" />
          تحديث
        </button>
      </div>

      {/* قائمة الأحداث */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16">
          <ShieldCheck className="h-10 w-10 mx-auto mb-3 text-green-500 opacity-50" />
          <p className="text-sm text-muted-foreground font-medium">لا توجد أحداث أمنية مسجّلة</p>
          <p className="text-xs text-muted-foreground mt-1">المتجر آمن — لم يُرصد أي هجوم</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log: any) => {
            const cfg = severityConfig(log.severity);
            const Icon = cfg.icon;
            return (
              <div key={log.id} className={`rounded-xl px-4 py-3 ${cfg.bg} border border-transparent`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.color}`} />
                    <div className="min-w-0">
                      <p className={`text-sm font-bold ${cfg.color}`}>
                        {EVENT_LABELS[log.event_type] || log.event_type}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.details}</p>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {log.ip_address && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Globe className="h-3 w-3" />
                            {log.ip_address}
                          </span>
                        )}
                        {log.path && (
                          <span className="text-xs text-muted-foreground font-mono truncate max-w-[150px]">
                            {log.method} {log.path}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(log.created_at).toLocaleString("ar-YE")}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
