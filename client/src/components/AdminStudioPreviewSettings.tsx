import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Camera, RefreshCcw, TrendingUp } from "lucide-react";

interface AdminStudioPreviewSettingsProps {
  adminToken: string | null;
}

const GEMINI_MODELS = [
  { value: "gemini-2.0-flash-exp-image-generation", label: "Gemini 2.0 Flash (image generation) — افتراضي" },
  { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro (نص + صورة)" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (الأحدث)" },
];

export function AdminStudioPreviewSettings({ adminToken }: AdminStudioPreviewSettingsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [logsPage, setLogsPage] = useState(0);
  const PAGE_SIZE = 20;

  const settingsQuery = useQuery({
    queryKey: ["/api/admin/studio-preview/settings"],
    queryFn: async () => {
      const r = await fetch("/api/admin/studio-preview/settings", {
        headers: { "x-admin-token": adminToken || "" },
      });
      if (!r.ok) throw new Error("فشل في تحميل الإعدادات");
      return r.json();
    },
    enabled: !!adminToken,
  });

  const logsQuery = useQuery({
    queryKey: ["/api/admin/studio-preview/logs", logsPage],
    queryFn: async () => {
      const r = await fetch(`/api/admin/studio-preview/logs?offset=${logsPage * PAGE_SIZE}&limit=${PAGE_SIZE}`, {
        headers: { "x-admin-token": adminToken || "" },
      });
      if (!r.ok) throw new Error("فشل في تحميل السجلات");
      return r.json();
    },
    enabled: !!adminToken,
  });

  const statsQuery = useQuery({
    queryKey: ["/api/admin/studio-preview/stats"],
    queryFn: async () => {
      const r = await fetch("/api/admin/studio-preview/stats", {
        headers: { "x-admin-token": adminToken || "" },
      });
      if (!r.ok) throw new Error("فشل في تحميل الإحصائيات");
      return r.json();
    },
    enabled: !!adminToken,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/admin/studio-preview/settings", {
        method: "PUT",
        headers: { "x-admin-token": adminToken || "", "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error("فشل في تحديث الإعدادات");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio-preview/settings"] });
      toast({ title: "✅ تم تحديث إعدادات معاينة الاستوديو" });
    },
    onError: () => {
      toast({ title: "❌ فشل في تحديث الإعدادات", variant: "destructive" });
    },
  });

  const [geminiModel, setGeminiModel] = useState("");
  const [firstFreeEnabled, setFirstFreeEnabled] = useState(true);
  const [previewFeePrice, setPreviewFeePrice] = useState(100);
  const [previewFeeCost, setPreviewFeeCost] = useState(0);
  const [maxAlternatives, setMaxAlternatives] = useState(3);
  const [quickPreviewEnabled, setQuickPreviewEnabled] = useState(true);

  // Sync local state with query data (API returns settings directly, not wrapped)
  const settings = settingsQuery.data;
  if (settings && geminiModel === "" && settings.geminiModel) {
    setGeminiModel(settings.geminiModel);
    setFirstFreeEnabled(settings.firstFreeEnabled ?? true);
    setPreviewFeePrice(settings.previewFeePrice ?? 100);
    setPreviewFeeCost(settings.previewFeeCost ?? 0);
    setMaxAlternatives(settings.maxAlternatives ?? 3);
    setQuickPreviewEnabled(settings.quickPreviewEnabled ?? true);
  }

  const handleSave = () => {
    updateSettingsMutation.mutate({
      geminiModel: geminiModel || undefined,
      firstFreeEnabled,
      previewFeePrice: Number(previewFeePrice),
      previewFeeCost: Number(previewFeeCost),
      maxAlternatives: Number(maxAlternatives),
      quickPreviewEnabled,
    });
  };

  const stats = statsQuery.data;
  const logs: any[] = Array.isArray(logsQuery.data) ? logsQuery.data : [];

  return (
    <div className="space-y-6">
      {/* إعدادات النموذج والرسوم */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Camera className="h-5 w-5 text-indigo-600" />
            إعدادات معاينة الاستوديو AI
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">نموذج Gemini</Label>
              <Select value={geminiModel} onValueChange={setGeminiModel}>
                <SelectTrigger data-testid="select-gemini-model">
                  <SelectValue placeholder="اختر النموذج" />
                </SelectTrigger>
                <SelectContent>
                  {GEMINI_MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">عدد البدائل الأقصى</Label>
              <Input
                type="number"
                min={1}
                max={5}
                value={maxAlternatives}
                onChange={(e) => setMaxAlternatives(Number(e.target.value))}
                data-testid="input-max-alternatives"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">سعر المعاينة (ر.ي)</Label>
              <Input
                type="number"
                min={0}
                value={previewFeePrice}
                onChange={(e) => setPreviewFeePrice(Number(e.target.value))}
                data-testid="input-preview-fee"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">تكلفة المعاينة (ر.ي)</Label>
              <Input
                type="number"
                min={0}
                value={previewFeeCost}
                onChange={(e) => setPreviewFeeCost(Number(e.target.value))}
                data-testid="input-preview-cost"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="first-free"
                checked={firstFreeEnabled}
                onCheckedChange={setFirstFreeEnabled}
                data-testid="switch-first-free"
              />
              <Label htmlFor="first-free" className="text-xs">أول معاينة مجانية</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="quick-preview"
                checked={quickPreviewEnabled}
                onCheckedChange={setQuickPreviewEnabled}
                data-testid="switch-quick-preview"
              />
              <Label htmlFor="quick-preview" className="text-xs">تفعيل المعاينة السريعة</Label>
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={updateSettingsMutation.isPending}
            className="bg-gradient-to-l from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white"
            data-testid="button-save-studio-settings"
          >
            {updateSettingsMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                جارٍ الحفظ...
              </>
            ) : (
              "حفظ الإعدادات"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* الإحصائيات */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              إحصائيات المعاينة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg">
                <p className="text-2xl font-extrabold text-indigo-700 dark:text-indigo-300">{stats.totalPreviews || 0}</p>
                <p className="text-[10px] font-bold text-muted-foreground">إجمالي المعاينات</p>
              </div>
              <div className="text-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                <p className="text-2xl font-extrabold text-green-700 dark:text-green-300">{stats.successCount || 0}</p>
                <p className="text-[10px] font-bold text-muted-foreground">ناجحة</p>
              </div>
              <div className="text-center p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                <p className="text-2xl font-extrabold text-amber-700 dark:text-amber-300">{stats.cachedCount || 0}</p>
                <p className="text-[10px] font-bold text-muted-foreground">من الكاش</p>
              </div>
              <div className="text-center p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                <p className="text-2xl font-extrabold text-red-700 dark:text-red-300">{stats.failedCount || 0}</p>
                <p className="text-[10px] font-bold text-muted-foreground">فاشلة</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* سجل المعاينات */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCcw className="h-5 w-5 text-sky-600" />
            سجل المعاينات
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLogsPage((p) => Math.max(0, p - 1))}
              disabled={logsPage === 0 || logsQuery.isLoading}
              data-testid="button-logs-prev"
            >
              السابق
            </Button>
            <span className="text-xs font-bold text-muted-foreground">صفحة {logsPage + 1}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLogsPage((p) => p + 1)}
              disabled={logs.length < PAGE_SIZE || logsQuery.isLoading}
              data-testid="button-logs-next"
            >
              التالي
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {logsQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">جارٍ التحميل...</span>
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">لا توجد سجلات معاينات بعد.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">التاريخ</TableHead>
                  <TableHead className="text-xs">الحالة</TableHead>
                  <TableHead className="text-xs">النموذج</TableHead>
                  <TableHead className="text-xs">المنتج</TableHead>
                  <TableHead className="text-xs">المستخدم</TableHead>
                  <TableHead className="text-xs">الوقت (ms)</TableHead>
                  <TableHead className="text-xs">الصورة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">
                      {new Date(log.createdAt).toLocaleDateString("ar-YE")}
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        log.status === "success"
                          ? "bg-green-100 text-green-700"
                          : log.status === "cached"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                      }`}>
                        {log.status === "success" ? "ناجحة" : log.status === "cached" ? "كاش" : "فاشلة"}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">{log.modelUsed || "—"}</TableCell>
                    <TableCell className="text-xs">{log.productId || "—"}</TableCell>
                    <TableCell className="text-xs">{log.userId || "—"}</TableCell>
                    <TableCell className="text-xs">{log.generationTime ? `${log.generationTime}ms` : "—"}</TableCell>
                    <TableCell className="text-xs">
                      {log.generatedUrl ? (
                        <a href={log.generatedUrl} target="_blank" rel="noreferrer" className="text-sky-600 hover:underline">
                          عرض
                        </a>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
