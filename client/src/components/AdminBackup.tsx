import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Database, Download, CheckCircle2, AlertCircle, Clock,
  HardDrive, Loader2, RefreshCw, ShieldCheck, Calendar
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AdminBackupProps {
  adminToken: string | null;
}

function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function AdminBackup({ adminToken }: AdminBackupProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [isExporting, setIsExporting] = useState(false);

  const headers = { "x-admin-token": adminToken || "" };

  const { data: logs = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/backup/logs"],
    queryFn: async () => {
      const res = await fetch("/api/admin/backup/logs", { headers });
      return res.json();
    },
    enabled: !!adminToken,
    refetchInterval: 30000,
  });

  const lastBackup = logs[0];

  const handleExport = async () => {
    if (!adminToken) return;
    setIsExporting(true);
    try {
      const res = await fetch("/api/admin/backup/export", { headers });
      if (!res.ok) throw new Error("فشل التصدير");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `oyoplast-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      qc.invalidateQueries({ queryKey: ["/api/admin/backup/logs"] });
      toast({ title: "✅ تم تصدير النسخة الاحتياطية بنجاح" });
    } catch {
      toast({ title: "فشل تصدير النسخة الاحتياطية", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Database className="h-6 w-6 text-blue-600" />
            نظام النسخ الاحتياطية
          </CardTitle>
          <CardDescription>
            حماية بيانات المنصة الكاملة — طلبات، منتجات، عملاء، موظفون، عقود، مدفوعات
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* آخر نسخة */}
            <div className={`rounded-xl border-2 p-4 ${lastBackup?.status === "success" ? "border-green-200 bg-green-50/50" : "border-gray-200"}`}>
              <div className="flex items-center gap-2 mb-2">
                {lastBackup?.status === "success"
                  ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                  : <Clock className="h-5 w-5 text-gray-400" />}
                <span className="font-semibold text-sm">آخر نسخة احتياطية</span>
              </div>
              {lastBackup ? (
                <>
                  <p className="text-xs text-gray-600">{new Date(lastBackup.created_at).toLocaleString("ar")}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    الحجم: {formatBytes(lastBackup.size_bytes)} · {lastBackup.tables_count} جدول
                  </p>
                </>
              ) : (
                <p className="text-xs text-gray-400">لم يتم أخذ نسخة بعد</p>
              )}
            </div>

            {/* عدد النسخ */}
            <div className="rounded-xl border-2 border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <HardDrive className="h-5 w-5 text-blue-500" />
                <span className="font-semibold text-sm">سجل النسخ</span>
              </div>
              <p className="text-3xl font-bold text-blue-600">{logs.length}</p>
              <p className="text-xs text-gray-400">نسخة مسجّلة</p>
            </div>

            {/* الأمان */}
            <div className="rounded-xl border-2 border-purple-200 bg-purple-50/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="h-5 w-5 text-purple-500" />
                <span className="font-semibold text-sm">مستوى الحماية</span>
              </div>
              <p className="text-sm font-bold text-purple-600">يدوي + قابل للجدولة</p>
              <p className="text-xs text-gray-400 mt-1">JSON مشفّر · كامل البيانات</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* أزرار الإجراءات */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            تصدير نسخة احتياطية الآن
          </CardTitle>
          <CardDescription>
            يصدّر ملف JSON يحتوي على جميع بيانات المنصة. احفظه في مكان آمن.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-xl p-3 flex gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-200 space-y-1">
              <p className="font-semibold">تعليمات حفظ النسخة الاحتياطية:</p>
              <p>• احفظ الملف في Google Drive أو Dropbox أو قرص خارجي</p>
              <p>• يُنصح بأخذ نسخة أسبوعية على الأقل</p>
              <p>• الملف يحتوي على جميع البيانات الحساسة — احتفظ به بسرية</p>
            </div>
          </div>

          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="gap-2"
            size="lg"
            data-testid="button-export-backup"
          >
            {isExporting
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Download className="h-4 w-4" />}
            {isExporting ? "جاري التصدير..." : "تصدير نسخة احتياطية كاملة"}
          </Button>

          <p className="text-xs text-gray-400">
            يشمل: المنتجات، الطلبات، العملاء، الموردين، الموظفين، العقود، المدفوعات، التقييمات، الرواتب
          </p>
        </CardContent>
      </Card>

      {/* سجل النسخ السابقة */}
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              سجل النسخ السابقة
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={() => qc.invalidateQueries({ queryKey: ["/api/admin/backup/logs"] })}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-10">
              <Database className="h-10 w-10 mx-auto text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">لم يتم أخذ أي نسخة بعد</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log: any) => (
                <div key={log.id} className="flex items-center gap-3 p-3 rounded-lg border" data-testid={`backup-log-${log.id}`}>
                  {log.status === "success"
                    ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    : <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{new Date(log.created_at).toLocaleString("ar")}</p>
                    <p className="text-xs text-gray-400">
                      {log.tables_count} جدول · {formatBytes(log.size_bytes)}
                    </p>
                  </div>
                  <Badge
                    className={log.status === "success" ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700"}
                    variant="outline"
                  >
                    {log.status === "success" ? "✅ نجاح" : "❌ فشل"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
