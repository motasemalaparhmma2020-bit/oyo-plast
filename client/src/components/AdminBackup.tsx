import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Database, Download, CheckCircle2, AlertCircle, Clock,
  HardDrive, Loader2, RefreshCw, ShieldCheck, Calendar,
  Webhook, Trash2, Timer, PackageCheck, Save, Play,
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

function formatRelative(date: Date): string {
  const diff = date.getTime() - Date.now();
  if (diff <= 0) return "الآن";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `بعد ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `بعد ${hrs} ساعة و${mins % 60} د`;
  return `بعد ${Math.floor(hrs / 24)} يوم`;
}

export default function AdminBackup({ adminToken }: AdminBackupProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);
  const headers = { "x-admin-token": adminToken || "" };

  // ── حالة النسخ الاحتياطية ──
  const { data: status } = useQuery<any>({
    queryKey: ["/api/admin/backup/status"],
    queryFn: async () => (await fetch("/api/admin/backup/status", { headers })).json(),
    enabled: !!adminToken,
    refetchInterval: 30000,
  });

  // ── قائمة النسخ المحفوظة ──
  const { data: snapshots = [], isLoading: loadingSnaps } = useQuery<any[]>({
    queryKey: ["/api/admin/backup/snapshots"],
    queryFn: async () => (await fetch("/api/admin/backup/snapshots", { headers })).json(),
    enabled: !!adminToken,
    refetchInterval: 30000,
  });

  // ── سجل الطلبات المحمية ──
  const { data: orderEvents } = useQuery<any>({
    queryKey: ["/api/admin/backup/order-events"],
    queryFn: async () => (await fetch("/api/admin/backup/order-events", { headers })).json(),
    enabled: !!adminToken,
    refetchInterval: 60000,
  });

  // ── إعدادات النسخ ──
  const [settings, setSettings] = useState({
    auto_backup_enabled: true,
    backup_interval_hours: 1,
    webhook_url: "",
    retention_hourly: 24,
    retention_daily: 30,
    retention_monthly: 12,
  });
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    // نُحمّل الإعدادات مرة واحدة فقط — نتجنب الكتابة فوق تعديلات المستخدم أثناء الإدخال
    if (status?.settings && !settingsLoaded) {
      setSettings({
        auto_backup_enabled: status.settings.auto_backup_enabled ?? true,
        backup_interval_hours: status.settings.backup_interval_hours ?? 1,
        webhook_url: status.settings.webhook_url ?? "",
        retention_hourly: status.settings.retention_hourly ?? 24,
        retention_daily: status.settings.retention_daily ?? 30,
        retention_monthly: status.settings.retention_monthly ?? 12,
      });
      setSettingsLoaded(true);
    }
  }, [status?.settings, settingsLoaded]);

  const updateSetting = <K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
    setSettings(s => ({ ...s, [key]: value }));
    setIsDirty(true);
  };

  const saveSettings = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/backup/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("فشل الحفظ");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/backup/status"] });
      setIsDirty(false);
      toast({ title: "✅ تم حفظ إعدادات النسخ الاحتياطية" });
    },
    onError: () => toast({ title: "فشل الحفظ", variant: "destructive" }),
  });

  const triggerBackup = async () => {
    setIsRunning(true);
    try {
      const res = await fetch("/api/admin/backup/run", { method: "POST", headers });
      if (!res.ok) throw new Error();
      toast({ title: "✅ تم إنشاء النسخة الاحتياطية الآن" });
      qc.invalidateQueries({ queryKey: ["/api/admin/backup/snapshots"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/backup/status"] });
    } catch {
      toast({ title: "فشل إنشاء النسخة", variant: "destructive" });
    } finally { setIsRunning(false); }
  };

  const downloadSnapshot = (id: number) => {
    const url = `/api/admin/backup/snapshots/${id}/download`;
    fetch(url, { headers }).then(async (r) => {
      const blob = await r.blob();
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u;
      a.download = `oyoplast-backup-${id}.json`;
      a.click();
      URL.revokeObjectURL(u);
    });
  };

  const deleteSnapshot = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/admin/backup/snapshots/${id}`, { method: "DELETE", headers });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/backup/snapshots"] }),
  });

  const exportNow = async () => {
    try {
      const res = await fetch("/api/admin/backup/export", { headers });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u;
      a.download = `oyoplast-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(u);
      toast({ title: "✅ تم التصدير" });
    } catch {
      toast({ title: "فشل التصدير", variant: "destructive" });
    }
  };

  const snapCounts: Record<string, number> = {};
  (status?.snapshots || []).forEach((s: any) => { snapCounts[s.retention_type] = Number(s.count); });
  const nextBackupDate = status?.nextAutoBackup ? new Date(status.nextAutoBackup) : null;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Database className="h-6 w-6 text-blue-600" />
            نظام النسخ الاحتياطية الشامل
          </CardTitle>
          <CardDescription>
            5 طبقات حماية: فوري · ساعي · يومي · شهري · خارجي (webhook)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* NEXT BACKUP */}
            <div className="rounded-xl border-2 border-blue-200 bg-white p-3">
              <div className="flex items-center gap-2 mb-1">
                <Timer className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-semibold">النسخة القادمة</span>
              </div>
              <p className="text-sm font-bold text-blue-700" data-testid="text-next-backup">
                {nextBackupDate ? formatRelative(nextBackupDate) : "—"}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {status?.cronActive ? "🟢 الجدولة فعّالة" : "⚪ متوقف"}
              </p>
            </div>

            {/* TOTAL SNAPSHOTS */}
            <div className="rounded-xl border-2 border-purple-200 bg-white p-3">
              <div className="flex items-center gap-2 mb-1">
                <HardDrive className="h-4 w-4 text-purple-500" />
                <span className="text-xs font-semibold">نسخ مخزّنة</span>
              </div>
              <p className="text-2xl font-bold text-purple-700" data-testid="text-snapshots-total">
                {snapshots.length}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {snapCounts.hourly || 0}س · {snapCounts.daily || 0}ي · {snapCounts.monthly || 0}ش
              </p>
            </div>

            {/* PROTECTED ORDERS */}
            <div className="rounded-xl border-2 border-green-200 bg-white p-3">
              <div className="flex items-center gap-2 mb-1">
                <PackageCheck className="h-4 w-4 text-green-500" />
                <span className="text-xs font-semibold">طلبات محمية</span>
              </div>
              <p className="text-2xl font-bold text-green-700" data-testid="text-protected-orders">
                {orderEvents?.total ?? status?.orderEventsCount ?? 0}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">حدث مسجّل لحظياً</p>
            </div>

            {/* LAST BACKUP */}
            <div className="rounded-xl border-2 border-amber-200 bg-white p-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-semibold">آخر نسخة</span>
              </div>
              <p className="text-xs font-bold text-amber-700" data-testid="text-last-backup">
                {status?.lastAutoBackup
                  ? new Date(status.lastAutoBackup).toLocaleString("ar-EG", { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" })
                  : snapshots[0] ? new Date(snapshots[0].created_at).toLocaleString("ar-EG", { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" }) : "—"}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {snapshots[0] ? `${formatBytes(snapshots[0].size_bytes)} · ${snapshots[0].total_rows} سجل` : ""}
              </p>
            </div>
          </div>

          <div className="flex gap-2 mt-4 flex-wrap">
            <Button onClick={triggerBackup} disabled={isRunning} className="gap-2" data-testid="button-run-backup-now">
              {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              إنشاء نسخة احتياطية الآن
            </Button>
            <Button onClick={exportNow} variant="outline" className="gap-2" data-testid="button-export-now">
              <Download className="h-4 w-4" /> تصدير مباشر JSON
            </Button>
            <Button variant="ghost" size="icon" onClick={() => qc.invalidateQueries({ queryKey: ["/api/admin/backup/status"] })}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* إعدادات النسخ + Webhook */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Webhook className="h-4 w-4 text-primary" />
            الإعدادات والتكامل الخارجي
          </CardTitle>
          <CardDescription>ربط Google Sheets / Zapier / N8N لتنبيهك عند كل نسخة</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 border rounded-xl">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-green-600" />
              <Label className="cursor-pointer">تفعيل النسخ التلقائية كل ساعة</Label>
            </div>
            <Switch
              checked={settings.auto_backup_enabled}
              onCheckedChange={(v) => updateSetting("auto_backup_enabled", v)}
              data-testid="switch-auto-backup"
            />
          </div>

          <div>
            <Label className="text-xs text-gray-600">رابط Webhook (اختياري)</Label>
            <Input
              value={settings.webhook_url}
              onChange={(e) => updateSetting("webhook_url", e.target.value)}
              placeholder="https://script.google.com/macros/... أو https://hooks.zapier.com/..."
              className="font-mono text-xs"
              data-testid="input-webhook-url"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              سيستقبل JSON POST بعد كل نسخة: {"{ event, site, totalRows, sizeMB, retentionType, timestamp }"}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">احتفاظ ساعي</Label>
              <Input
                type="number"
                value={settings.retention_hourly}
                onChange={(e) => updateSetting("retention_hourly", parseInt(e.target.value) || 24)}
                data-testid="input-retention-hourly"
              />
            </div>
            <div>
              <Label className="text-xs">احتفاظ يومي</Label>
              <Input
                type="number"
                value={settings.retention_daily}
                onChange={(e) => updateSetting("retention_daily", parseInt(e.target.value) || 30)}
                data-testid="input-retention-daily"
              />
            </div>
            <div>
              <Label className="text-xs">احتفاظ شهري</Label>
              <Input
                type="number"
                value={settings.retention_monthly}
                onChange={(e) => updateSetting("retention_monthly", parseInt(e.target.value) || 12)}
                data-testid="input-retention-monthly"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => saveSettings.mutate()}
              disabled={saveSettings.isPending || !isDirty}
              className="gap-2"
              data-testid="button-save-backup-settings"
            >
              {saveSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              حفظ الإعدادات
            </Button>
            {isDirty && <span className="text-xs text-amber-600">• تعديلات غير محفوظة</span>}
          </div>
        </CardContent>
      </Card>

      {/* قائمة النسخ المخزنة */}
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              النسخ المخزنة في قاعدة البيانات
            </CardTitle>
            <Badge variant="secondary">{snapshots.length} نسخة</Badge>
          </div>
          <CardDescription>يمكنك إعادة تنزيل أي نسخة سابقة مباشرة من التطبيق</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingSnaps ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : snapshots.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">لم يتم حفظ أي نسخة بعد</div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {snapshots.map((s: any) => (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-900" data-testid={`snapshot-${s.id}`}>
                  <div className={`h-2 w-2 rounded-full ${s.retention_type === 'monthly' ? 'bg-purple-500' : s.retention_type === 'daily' ? 'bg-blue-500' : 'bg-green-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{new Date(s.created_at).toLocaleString("ar-EG")}</p>
                      <Badge variant="outline" className="text-[10px]">
                        {s.retention_type === 'monthly' ? 'شهرية' : s.retention_type === 'daily' ? 'يومية' : s.retention_type === 'event' ? 'حدث' : 'ساعية'}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">{s.triggered_by}</Badge>
                    </div>
                    <p className="text-xs text-gray-400">
                      {formatBytes(s.size_bytes)} · {s.tables_count} جدول · {s.total_rows} سجل
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => downloadSnapshot(s.id)} data-testid={`button-download-snapshot-${s.id}`} title="تنزيل">
                    <Download className="h-4 w-4 text-blue-600" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => { if (confirm("حذف هذه النسخة؟")) deleteSnapshot.mutate(s.id); }}
                    data-testid={`button-delete-snapshot-${s.id}`}
                    title="حذف"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* سجل أحداث الطلبات (T4) */}
      {orderEvents?.events?.length > 0 && (
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PackageCheck className="h-4 w-4 text-green-600" />
              أحدث الطلبات المحمية
              <Badge variant="secondary">{orderEvents.total}</Badge>
            </CardTitle>
            <CardDescription>كل طلب جديد يُسجَّل فوراً في سجل مستقل قبل أي نسخة</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {orderEvents.events.slice(0, 20).map((e: any) => (
                <div key={e.id} className="flex items-center gap-2 text-xs p-2 rounded border" data-testid={`order-event-${e.id}`}>
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  <span className="font-mono text-gray-500">#{e.order_id}</span>
                  <Badge variant="outline" className="text-[10px]">{e.event_type}</Badge>
                  <span className="text-gray-400 text-[10px] mr-auto">{new Date(e.created_at).toLocaleString("ar-EG")}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
