import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Edit2, Upload, Bot, Eye, RefreshCcw, CheckCircle2, XCircle, Send } from "lucide-react";

interface AdminPrintingAITrainingProps {
  adminToken: string | null;
}

const TYPE_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  system_instruction: { label: "تعليمات النظام", color: "bg-purple-100 text-purple-800 border-purple-300", emoji: "⚙️" },
  rule:               { label: "قاعدة",           color: "bg-red-100 text-red-800 border-red-300",           emoji: "🔒" },
  faq:                { label: "سؤال وجواب",      color: "bg-blue-100 text-blue-800 border-blue-300",        emoji: "❓" },
  preference:         { label: "تفضيل",           color: "bg-green-100 text-green-800 border-green-300",      emoji: "💡" },
  reference_item:     { label: "مثال مرجعي",     color: "bg-amber-100 text-amber-800 border-amber-300",      emoji: "📸" },
};

const ORIGIN_MARKET_OPTIONS = [
  { value: "الصين", label: "🇨🇳 الصين" },
  { value: "أمريكا", label: "🇺🇸 أمريكا" },
  { value: "اليابان", label: "🇯🇵 اليابان" },
  { value: "أوروبا", label: "🇪🇺 أوروبا" },
  { value: "الشرق الأوسط", label: "🌙 الشرق الأوسط" },
  { value: "محلي", label: "🇾🇪 محلي" },
];

interface TrainingItem {
  id: number;
  type: string;
  title: string;
  content: string;
  image_url: string | null;
  tags: string;
  origin_market: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

const EMPTY_FORM = { type: "rule", title: "", content: "", image_url: "", tags: "", origin_market: "", is_active: true, sort_order: 0 };

export function AdminPrintingAITraining({ adminToken }: AdminPrintingAITrainingProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [imageUploading, setImageUploading] = useState(false);
  const [contextVisible, setContextVisible] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const [testReply, setTestReply] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  const headers = { "x-admin-token": adminToken || "", "Content-Type": "application/json" };
  const fetchHeaders = { "x-admin-token": adminToken || "" };

  const itemsQuery = useQuery({
    queryKey: ["/api/admin/printing-ai/training", filterType],
    queryFn: async () => {
      const url = filterType === "all"
        ? "/api/admin/printing-ai/training"
        : `/api/admin/printing-ai/training?type=${filterType}`;
      const r = await fetch(url, { headers: fetchHeaders });
      if (!r.ok) throw new Error("فشل في تحميل بيانات التدريب");
      return r.json() as Promise<{ items: TrainingItem[]; total: number }>;
    },
    enabled: !!adminToken,
  });

  const statsQuery = useQuery({
    queryKey: ["/api/admin/printing-ai/training/stats"],
    queryFn: async () => {
      const r = await fetch("/api/admin/printing-ai/training/stats", { headers: fetchHeaders });
      if (!r.ok) throw new Error("فشل في تحميل الإحصائيات");
      return r.json();
    },
    enabled: !!adminToken,
  });

  const contextQuery = useQuery({
    queryKey: ["/api/admin/printing-ai/training/context-preview"],
    queryFn: async () => {
      const r = await fetch("/api/admin/printing-ai/training/context-preview", { headers: fetchHeaders });
      if (!r.ok) throw new Error("فشل");
      return r.json() as Promise<{ context: string; charCount: number }>;
    },
    enabled: !!adminToken && contextVisible,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof EMPTY_FORM) => {
      const r = await fetch("/api/admin/printing-ai/training", { method: "POST", headers, body: JSON.stringify(data) });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/printing-ai/training"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/printing-ai/training/stats"] });
      setForm({ ...EMPTY_FORM });
      toast({ title: "✅ تم إضافة عنصر التدريب" });
    },
    onError: (e: any) => toast({ title: "❌ فشل الإضافة", description: e?.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<TrainingItem> }) => {
      const r = await fetch(`/api/admin/printing-ai/training/${id}`, { method: "PATCH", headers, body: JSON.stringify(data) });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/printing-ai/training"] });
      setEditingId(null);
      setForm({ ...EMPTY_FORM });
      toast({ title: "✅ تم التحديث" });
    },
    onError: (e: any) => toast({ title: "❌ فشل التحديث", description: e?.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/admin/printing-ai/training/${id}`, { method: "DELETE", headers: fetchHeaders });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/printing-ai/training"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/printing-ai/training/stats"] });
      toast({ title: "🗑️ تم الحذف" });
    },
    onError: (e: any) => toast({ title: "❌ فشل الحذف", description: e?.message, variant: "destructive" }),
  });

  function handleEdit(item: TrainingItem) {
    setEditingId(item.id);
    setForm({ type: item.type, title: item.title, content: item.content, image_url: item.image_url || "", tags: item.tags || "", origin_market: item.origin_market || "", is_active: item.is_active, sort_order: item.sort_order });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCancel() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const r = await fetch("/api/admin/printing-ai/training/upload-image", {
        method: "POST",
        headers: { "x-admin-token": adminToken || "" },
        body: fd,
      });
      const data = await r.json();
      if (data.imageUrl) {
        setForm(f => ({ ...f, image_url: data.imageUrl }));
        toast({ title: "✅ تم رفع الصورة المرجعية" });
      }
    } catch {
      toast({ title: "❌ فشل رفع الصورة", variant: "destructive" });
    } finally {
      setImageUploading(false);
    }
  }

  async function handleTest() {
    if (!testMessage.trim()) return;
    setTestLoading(true);
    setTestReply(null);
    try {
      const r = await fetch("/api/admin/printing-ai/training/test", {
        method: "POST",
        headers,
        body: JSON.stringify({ message: testMessage }),
      });
      const data = await r.json();
      setTestReply(data.reply || data.message || "لا يوجد رد");
    } catch {
      setTestReply("فشل الاختبار — تحقق من الاتصال");
    } finally {
      setTestLoading(false);
    }
  }

  const stats = statsQuery.data;
  const items = itemsQuery.data?.items || [];

  return (
    <div className="space-y-6 p-4" dir="rtl">
      {/* ─── Header ─────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg">
          <Bot className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold">لوحة تدريب وكيل الطباعة "أويو"</h2>
          <p className="text-sm text-muted-foreground">أضف تعليمات وقواعد وأمثلة لتحسين ردود الوكيل الذكي</p>
        </div>
      </div>

      {/* ─── Stats Cards ────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { label: "الكل", value: stats.total, color: "bg-slate-100 text-slate-800" },
            { label: "⚙️ تعليمات", value: stats.system_instructions, color: "bg-purple-100 text-purple-800" },
            { label: "🔒 قواعد", value: stats.rules, color: "bg-red-100 text-red-800" },
            { label: "❓ أسئلة", value: stats.faqs, color: "bg-blue-100 text-blue-800" },
            { label: "💡 تفضيلات", value: stats.preferences, color: "bg-green-100 text-green-800" },
          ].map(s => (
            <div key={s.label} className={`${s.color} rounded-xl p-3 text-center`}>
              <div className="text-2xl font-extrabold">{s.value ?? 0}</div>
              <div className="text-xs">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Add / Edit Form ────────────────────────────── */}
      <Card className="border-2 border-violet-200 dark:border-violet-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            {editingId ? <><Edit2 className="h-4 w-4 text-violet-600" /> تعديل عنصر التدريب</> : <><Plus className="h-4 w-4 text-violet-600" /> إضافة عنصر تدريب جديد</>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold mb-1 block">النوع</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger data-testid="select-training-type">
                  <SelectValue placeholder="اختر النوع" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([v, t]) => (
                    <SelectItem key={v} value={v}>{t.emoji} {t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">الترتيب</Label>
              <Input type="number" min={0} value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))} className="h-9" data-testid="input-sort-order" />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold mb-1 block">العنوان / السؤال</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="مثال: لا تذكر أسعار المنافسين" className="h-9" data-testid="input-training-title" />
          </div>

          <div>
            <Label className="text-xs font-semibold mb-1 block">المحتوى / الجواب</Label>
            <Textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="اكتب التعليمات أو الجواب هنا…" rows={3} data-testid="textarea-training-content" />
          </div>

          {/* صورة مرجعية */}
          <div>
            <Label className="text-xs font-semibold mb-1 block">صورة مرجعية (اختياري)</Label>
            <div className="flex gap-2 items-center">
              <Input value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} placeholder="رابط الصورة أو ارفع ملفاً" className="h-9 flex-1" data-testid="input-image-url" />
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} data-testid="input-image-upload" />
                <Button variant="outline" size="sm" className="h-9 px-3" disabled={imageUploading} asChild>
                  <span>{imageUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}</span>
                </Button>
              </label>
              {form.image_url && (
                <img src={form.image_url} alt="" className="h-9 w-9 object-cover rounded-lg border" />
              )}
            </div>
          </div>

          {/* حقول مخصصة للمثال المرجعي */}
          {form.type === "reference_item" && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 p-3 space-y-3">
              <p className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                📸 بيانات المثال المرجعي
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold mb-1 block">الوسوم (tags)</Label>
                  <Input
                    value={form.tags}
                    onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                    placeholder="مثال: أكياس، طباعة ملونة، حجم متوسط"
                    className="h-9 text-xs"
                    data-testid="input-tags"
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">افصل بين الوسوم بفاصلة</p>
                </div>
                <div>
                  <Label className="text-xs font-semibold mb-1 block">سوق المنشأ</Label>
                  <Select
                    value={form.origin_market || "_none_"}
                    onValueChange={v => setForm(f => ({ ...f, origin_market: v === "_none_" ? "" : v }))}>
                    <SelectTrigger className="h-9 text-xs" data-testid="select-origin-market">
                      <SelectValue placeholder="اختر السوق" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">— غير محدد</SelectItem>
                      {ORIGIN_MARKET_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} data-testid="switch-is-active" />
            <Label className="text-sm">مفعّل</Label>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              className="flex-1 bg-gradient-to-l from-violet-600 to-fuchsia-600 text-white"
              disabled={!form.title.trim() || !form.content.trim() || createMutation.isPending || updateMutation.isPending}
              onClick={() => {
                if (editingId) {
                  updateMutation.mutate({ id: editingId, data: form });
                } else {
                  createMutation.mutate(form);
                }
              }}
              data-testid="button-save-training"
            >
              {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}
              {editingId ? "حفظ التعديلات" : "إضافة"}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={handleCancel} data-testid="button-cancel-edit">إلغاء</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── Filter Tabs ─────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={filterType === "all" ? "default" : "outline"} onClick={() => setFilterType("all")} data-testid="filter-all">الكل</Button>
        {Object.entries(TYPE_LABELS).map(([v, t]) => (
          <Button key={v} size="sm" variant={filterType === v ? "default" : "outline"} onClick={() => setFilterType(v)} data-testid={`filter-${v}`}>
            {t.emoji} {t.label}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/printing-ai/training"] })} className="mr-auto">
          <RefreshCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* ─── Items List ──────────────────────────────────── */}
      {itemsQuery.isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-violet-500" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Bot className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">لا توجد عناصر تدريب بعد</p>
          <p className="text-sm">أضف قواعد وتعليمات لتحسين ردود الوكيل</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const typeInfo = TYPE_LABELS[item.type] || { label: item.type, color: "bg-gray-100 text-gray-800", emoji: "📌" };
            return (
              <Card key={item.id} className={`border ${!item.is_active ? "opacity-50" : ""}`} data-testid={`card-training-${item.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <Badge className={`text-xs border ${typeInfo.color}`}>{typeInfo.emoji} {typeInfo.label}</Badge>
                        {item.is_active ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-400" />
                        )}
                        <span className="text-xs text-muted-foreground">#{item.sort_order}</span>
                      </div>
                      <p className="font-bold text-sm">{item.title}</p>
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{item.content}</p>
                      {item.type === "reference_item" && (item.tags || item.origin_market) && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {item.origin_market && (
                            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50">
                              {ORIGIN_MARKET_OPTIONS.find(o => o.value === item.origin_market)?.label || item.origin_market}
                            </Badge>
                          )}
                          {item.tags && item.tags.split(",").map(tag => tag.trim()).filter(Boolean).map(tag => (
                            <Badge key={tag} variant="outline" className="text-[10px] border-blue-300 text-blue-700 bg-blue-50">#{tag}</Badge>
                          ))}
                        </div>
                      )}
                      {item.image_url && (
                        <img src={item.image_url} alt={item.title} className="mt-2 h-16 w-16 object-cover rounded-lg border" />
                      )}
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => handleEdit(item)} data-testid={`button-edit-${item.id}`}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 px-2 text-red-600 border-red-200 hover:bg-red-50" onClick={() => { if (confirm("حذف هذا العنصر؟")) deleteMutation.mutate(item.id); }} data-testid={`button-delete-${item.id}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ─── Context Preview ─────────────────────────────── */}
      <Card className="border-2 border-dashed border-amber-300 dark:border-amber-700">
        <CardHeader className="pb-2 cursor-pointer" onClick={() => setContextVisible(v => !v)}>
          <CardTitle className="text-sm flex items-center gap-2">
            <Eye className="h-4 w-4 text-amber-600" />
            معاينة سياق التدريب المُضاف إلى الوكيل
            <Badge variant="outline" className="text-xs mr-auto">{contextQuery.data?.charCount ?? "—"} حرف</Badge>
          </CardTitle>
        </CardHeader>
        {contextVisible && (
          <CardContent>
            {contextQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> جارٍ التحميل…</div>
            ) : contextQuery.data?.context ? (
              <pre className="text-xs bg-slate-50 dark:bg-slate-900 p-3 rounded-lg whitespace-pre-wrap max-h-64 overflow-y-auto border font-mono">{contextQuery.data.context}</pre>
            ) : (
              <p className="text-sm text-muted-foreground">لا يوجد سياق — أضف عناصر تدريب أولاً</p>
            )}
          </CardContent>
        )}
      </Card>

      {/* ─── Test Agent ──────────────────────────────────── */}
      <Card className="border-2 border-emerald-200 dark:border-emerald-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Send className="h-4 w-4 text-emerald-600" />
            اختبار الوكيل مباشرة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input value={testMessage} onChange={e => setTestMessage(e.target.value)} placeholder="اكتب سؤالاً لاختبار الوكيل…" className="flex-1" onKeyDown={e => e.key === "Enter" && handleTest()} data-testid="input-test-message" />
            <Button onClick={handleTest} disabled={testLoading || !testMessage.trim()} className="bg-emerald-600 text-white hover:bg-emerald-700" data-testid="button-test-send">
              {testLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          {testReply && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 p-3 text-sm whitespace-pre-wrap" data-testid="text-test-reply">
              <span className="font-bold text-emerald-700">أويو: </span>{testReply}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {["ما هو سعر كيس قماش 50×40؟", "ما ألوان الطباعة المتاحة؟", "كم مدة التوصيل إلى صنعاء؟", "أريد طباعة شعاري"].map(q => (
              <Button key={q} size="sm" variant="outline" className="text-xs h-7" onClick={() => { setTestMessage(q); }} data-testid={`button-quick-test-${q.slice(0, 10)}`}>
                {q}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
