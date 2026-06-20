import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Crown, Loader2, Play, Users, ShieldAlert, ListChecks, RefreshCw,
  ChevronDown, ChevronLeft, Save, Bot, User as UserIcon, Check, X, Zap,
} from "lucide-react";

// ─── أنواع ──────────────────────────────────────────────────────────────────
interface Dept { id: string; label: string; icon?: string; agentNames: string[]; staffRoles: string[]; }
interface TeamAgent { id: number; name: string; display_name: string; role: string; model: string; provider: string; is_active: boolean; pending_actions: number; actions_24h: number; }
interface StaffRow { id: string; full_name: string | null; phone: string | null; role: string; }
interface PendingAction { id: number; agent_id: number; agent_name: string; agent_display_name: string; action_type: string; title: string; description: string | null; input_data: any; created_at: string; }
interface TeamData { enabled: boolean; departments: Dept[]; agents: TeamAgent[]; staff: StaffRow[]; pending: PendingAction[]; }

interface RedLines {
  maxDiscountPercent: number; maxPriceDecreasePercent: number; minPriceYer: number;
  allowProductDeactivation: boolean; protectedProductIds: number[];
  maxBroadcastsPerDay: number; blockedWords: string[]; freeText: string[];
}
interface Orchestration { maxProposalsPerRun: number; cooldownMinutes: number; dailyRunCap: number; }
interface MMConfig {
  version: number; enabled: boolean; strategy: string; rules: string[];
  redLines: RedLines; departments: Dept[]; orchestration: Orchestration;
}
interface RunResult { runId: string; created: number; narrative: string; skipped: string[]; proposals: any[]; }

const AGENT_EMOJI: Record<string, string> = {
  safar: "💰", nour: "✍️", layla: "💬", huda: "📊", majed: "🎨",
  rami: "📈", omar: "🎭", oyo: "📦", rashed: "👑", obo: "🤖",
};
const ROLE_LABEL: Record<string, string> = {
  owner: "المالك", product_manager: "مدير المنتجات", order_manager: "مدير الطلبات",
  delivery: "مندوب توصيل", finance: "محاسب/مالية",
};

type Section = "center" | "team" | "approvals" | "strategy";

export default function AdminCommandCenter({ adminToken }: { adminToken: string | null }) {
  const { toast } = useToast();
  const [section, setSection] = useState<Section>("center");
  const [instruction, setInstruction] = useState("");
  const [lastRun, setLastRun] = useState<RunResult | null>(null);
  const [openDept, setOpenDept] = useState<string | null>(null);
  const [form, setForm] = useState<MMConfig | null>(null);

  const token = adminToken || localStorage.getItem("admin_token") || "";
  async function mmFetch(url: string, opts: RequestInit = {}): Promise<Response> {
    const headers: Record<string, string> = { ...(opts.headers as any), "x-admin-token": token };
    if (opts.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
    const res = await fetch(url, { ...opts, headers, credentials: "include" });
    if (!res.ok) throw new Error(`${res.status}: ${await res.text().catch(() => res.statusText)}`);
    return res;
  }

  const { data: config } = useQuery<MMConfig>({
    queryKey: ["/api/ai/mastermind/config"],
    queryFn: async () => (await mmFetch("/api/ai/mastermind/config")).json(),
  });
  const { data: team, isLoading: teamLoading } = useQuery<TeamData>({
    queryKey: ["/api/ai/mastermind/team"],
    queryFn: async () => (await mmFetch("/api/ai/mastermind/team")).json(),
  });

  useEffect(() => { if (config && !form) setForm(config); }, [config, form]);

  const runMut = useMutation({
    mutationFn: async () => (await mmFetch("/api/ai/mastermind/run-strategy", {
      method: "POST", body: JSON.stringify({ instruction: instruction.trim() || undefined }),
    })).json(),
    onSuccess: (r: RunResult) => {
      setLastRun(r);
      setInstruction("");
      queryClient.invalidateQueries({ queryKey: ["/api/ai/mastermind/team"] });
      toast({ title: "تم تشغيل الخطة", description: `راشد اقترح ${r.created} إجراء.` });
      setSection("approvals");
    },
    onError: (e: any) => toast({ title: "تعذّر التشغيل", description: e.message, variant: "destructive" }),
  });

  const approveMut = useMutation({
    mutationFn: async (v: { id: number; approved: boolean; force?: boolean }) =>
      (await mmFetch(`/api/ai/actions/${v.id}/approve`, {
        method: "POST", body: JSON.stringify({ approved: v.approved, force: v.force }),
      })).json(),
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/mastermind/team"] });
      const ex = r?.execResult;
      toast({
        title: r?.status === "executed" ? "تم التنفيذ" : r?.status === "rejected" ? "تم الرفض" : "تمت المعالجة",
        description: ex ? `${ex.ok ? "✅" : "❌"} ${ex.message}` : undefined,
        variant: ex && !ex.ok ? "destructive" : undefined,
      });
    },
    onError: (e: any) => toast({ title: "فشل", description: e.message, variant: "destructive" }),
  });

  const saveMut = useMutation({
    mutationFn: async (cfg: MMConfig) => (await mmFetch("/api/ai/mastermind/config", {
      method: "PUT", body: JSON.stringify(cfg),
    })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/mastermind/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/mastermind/team"] });
      toast({ title: "تم حفظ الإعدادات" });
    },
    onError: (e: any) => toast({ title: "فشل الحفظ", description: e.message, variant: "destructive" }),
  });

  const rashed = team?.agents.find((a) => a.name === "rashed");

  // ─── محرّرات الحقول ──────────────────────────────────────────────────────
  const setRL = (patch: Partial<RedLines>) => form && setForm({ ...form, redLines: { ...form.redLines, ...patch } });
  const setOrch = (patch: Partial<Orchestration>) => form && setForm({ ...form, orchestration: { ...form.orchestration, ...patch } });

  const NAV: { id: Section; label: string; icon: any }[] = [
    { id: "center", label: "المركز", icon: Crown },
    { id: "team", label: "الفريق", icon: Users },
    { id: "approvals", label: "الموافقات", icon: ListChecks },
    { id: "strategy", label: "الاستراتيجية", icon: ShieldAlert },
  ];

  return (
    <div className="space-y-4" dir="rtl" data-testid="command-center">
      {/* رأس */}
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-xl">👑</div>
        <div>
          <h2 className="text-lg font-bold leading-tight">العقل المدبّر</h2>
          <p className="text-xs text-muted-foreground">راشد ينسّق الفريق وفق استراتيجيتك وخطوطك الحمراء</p>
        </div>
      </div>

      {/* تنقّل الأقسام (أزرار، لا تبويبات متداخلة) */}
      <div className="grid grid-cols-4 gap-1">
        {NAV.map((n) => {
          const Icon = n.icon;
          const active = section === n.id;
          const badge = n.id === "approvals" ? team?.pending.length || 0 : 0;
          return (
            <button
              key={n.id}
              onClick={() => setSection(n.id)}
              data-testid={`section-${n.id}`}
              className={`relative flex flex-col items-center gap-1 py-2 rounded-lg text-xs font-medium transition ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              <Icon className="w-4 h-4" />
              {n.label}
              {badge > 0 && <span className="absolute -top-1 -left-1 bg-red-500 text-white rounded-full text-[10px] w-4 h-4 flex items-center justify-center">{badge}</span>}
            </button>
          );
        })}
      </div>

      {/* ─── المركز ─── */}
      {section === "center" && (
        <div className="space-y-3">
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">👑</span>
                <div>
                  <div className="font-bold">راشد — المدير التنفيذي</div>
                  <div className="text-xs text-muted-foreground">{rashed ? `${rashed.model} · ${rashed.provider}` : "—"}</div>
                </div>
              </div>
              <Badge variant={config?.enabled ? "default" : "secondary"}>{config?.enabled ? "مُفعّل" : "معطّل"}</Badge>
            </div>
            {rashed && !rashed.is_active && (
              <p className="text-xs text-red-600">⚠️ راشد غير نشط — فعّله من لوحة وكلاء الذكاء قبل التشغيل.</p>
            )}
            <Textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="توجيه إضافي اختياري لهذه الجولة (مثال: ركّز على تصريف المخزون الراكد)…"
              className="text-sm min-h-[72px]"
              data-testid="input-instruction"
            />
            <Button
              className="w-full"
              disabled={runMut.isPending || config?.enabled === false}
              onClick={() => runMut.mutate()}
              data-testid="button-run-strategy"
            >
              {runMut.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Play className="w-4 h-4 ml-2" />}
              تشغيل خطة استراتيجية
            </Button>
            <p className="text-[11px] text-muted-foreground">
              يقرأ راشد حقائق متجرك ويقترح إجراءات معلّقة فقط — لا يُنفَّذ شيء إلا بموافقتك في «الموافقات».
            </p>
          </Card>

          {lastRun && (
            <Card className="p-4 space-y-2" data-testid="card-last-run">
              <div className="font-semibold text-sm flex items-center gap-1"><Zap className="w-4 h-4 text-amber-500" /> ملخّص آخر خطة</div>
              <p className="text-sm whitespace-pre-wrap">{lastRun.narrative}</p>
              <div className="text-xs text-muted-foreground">عدد الاقتراحات: {lastRun.created}</div>
              {lastRun.skipped?.length > 0 && (
                <div className="text-[11px] text-amber-600">تم تجاهل: {lastRun.skipped.join("، ")}</div>
              )}
              <Button variant="outline" size="sm" className="w-full" onClick={() => setSection("approvals")} data-testid="button-goto-approvals">
                مراجعة الاقتراحات ←
              </Button>
            </Card>
          )}
        </div>
      )}

      {/* ─── الفريق ─── */}
      {section === "team" && (
        <div className="space-y-2">
          {teamLoading && <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" /></div>}
          {(team?.departments || []).map((d) => {
            const agents = (team?.agents || []).filter((a) => d.agentNames.includes(a.name));
            const staff = (team?.staff || []).filter((s) => d.staffRoles.includes(s.role));
            const open = openDept === d.id;
            return (
              <Card key={d.id} className="overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-3"
                  onClick={() => setOpenDept(open ? null : d.id)}
                  data-testid={`dept-${d.id}`}
                >
                  <span className="font-semibold text-sm flex items-center gap-2">
                    <span className="text-lg">{d.icon || "📁"}</span>{d.label}
                    <Badge variant="secondary" className="text-[10px]">{agents.length + staff.length}</Badge>
                  </span>
                  {open ? <ChevronDown className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
                {open && (
                  <div className="px-3 pb-3 space-y-2">
                    {agents.length > 0 && (
                      <div>
                        <div className="text-[11px] text-muted-foreground mb-1 flex items-center gap-1"><Bot className="w-3 h-3" /> وكلاء ذكاء</div>
                        <div className="space-y-1">
                          {agents.map((a) => (
                            <div key={a.id} className="flex items-center justify-between bg-muted/50 rounded-md px-2 py-1.5" data-testid={`team-agent-${a.name}`}>
                              <span className="text-sm flex items-center gap-1.5">{AGENT_EMOJI[a.name] || "🤖"} {a.display_name}</span>
                              <span className="flex items-center gap-1">
                                {a.pending_actions > 0 && <Badge className="text-[10px] bg-amber-500">{a.pending_actions} معلّق</Badge>}
                                <span className={`w-2 h-2 rounded-full ${a.is_active ? "bg-green-500" : "bg-gray-400"}`} />
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {staff.length > 0 && (
                      <div>
                        <div className="text-[11px] text-muted-foreground mb-1 flex items-center gap-1"><UserIcon className="w-3 h-3" /> موظفون</div>
                        <div className="space-y-1">
                          {staff.map((s) => (
                            <div key={s.id} className="flex items-center justify-between bg-muted/50 rounded-md px-2 py-1.5" data-testid={`team-staff-${s.id}`}>
                              <span className="text-sm">{s.full_name || "بدون اسم"}</span>
                              <Badge variant="outline" className="text-[10px]">{ROLE_LABEL[s.role] || s.role}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {agents.length === 0 && staff.length === 0 && (
                      <p className="text-xs text-muted-foreground">لا يوجد أعضاء في هذا القسم.</p>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ─── الموافقات ─── */}
      {section === "approvals" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">إجراءات معلّقة ({team?.pending.length || 0})</span>
            <Button variant="ghost" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/ai/mastermind/team"] })} data-testid="button-refresh-pending">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          {(team?.pending || []).length === 0 && (
            <Card className="p-6 text-center text-sm text-muted-foreground">لا توجد اقتراحات معلّقة. شغّل خطة من «المركز».</Card>
          )}
          {(team?.pending || []).map((p) => {
            const isTool = p.action_type.startsWith("tool:");
            const isDirective = p.action_type === "directive";
            const kindLabel = isTool ? "أداة" : isDirective ? "توجيه" : "توصية";
            const args = p.input_data?.args;
            return (
              <Card key={p.id} className="p-3 space-y-2" data-testid={`pending-${p.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm">{p.title}</div>
                    <div className="text-[11px] text-muted-foreground">{AGENT_EMOJI[p.agent_name] || "🤖"} {p.agent_display_name || p.agent_name}</div>
                  </div>
                  <Badge variant={isTool ? "default" : isDirective ? "secondary" : "outline"} className="text-[10px] shrink-0">{kindLabel}</Badge>
                </div>
                {p.description && <p className="text-xs whitespace-pre-wrap text-muted-foreground">{p.description}</p>}
                {isTool && args && (
                  <div className="text-[11px] bg-muted rounded-md p-2 font-mono break-all">{JSON.stringify(args)}</div>
                )}
                {isDirective && p.input_data?.targetAgent && (
                  <div className="text-[11px] text-muted-foreground">إلى الوكيل: {AGENT_EMOJI[p.input_data.targetAgent] || ""} {p.input_data.targetAgent}</div>
                )}
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" disabled={approveMut.isPending} onClick={() => approveMut.mutate({ id: p.id, approved: true })} data-testid={`approve-${p.id}`}>
                    <Check className="w-4 h-4 ml-1" /> موافقة
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" disabled={approveMut.isPending} onClick={() => approveMut.mutate({ id: p.id, approved: false })} data-testid={`reject-${p.id}`}>
                    <X className="w-4 h-4 ml-1" /> رفض
                  </Button>
                </div>
                {isTool && (
                  <Button size="sm" variant="ghost" className="w-full text-amber-600 text-xs" disabled={approveMut.isPending}
                    onClick={() => { if (confirm("تنفيذ مع تجاوز الخطوط الحمراء؟ هذا قرارك الصريح.")) approveMut.mutate({ id: p.id, approved: true, force: true }); }}
                    data-testid={`force-${p.id}`}>
                    <ShieldAlert className="w-3.5 h-3.5 ml-1" /> تنفيذ بتجاوز الخط الأحمر
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ─── الاستراتيجية ─── */}
      {section === "strategy" && form && (
        <div className="space-y-3">
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">تفعيل العقل المدبّر</span>
              <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} data-testid="switch-enabled" />
            </div>
            <div>
              <label className="text-xs font-medium">استراتيجية المتجر</label>
              <Textarea value={form.strategy} onChange={(e) => setForm({ ...form, strategy: e.target.value })}
                placeholder="مثال: الأولوية لرفع هامش الربح وتصريف الراكد، مع الحفاظ على أسعار تنافسية…"
                className="text-sm min-h-[80px] mt-1" data-testid="input-strategy" />
            </div>
            <div>
              <label className="text-xs font-medium">القواعد العامة (سطر لكل قاعدة)</label>
              <Textarea value={form.rules.join("\n")} onChange={(e) => setForm({ ...form, rules: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                className="text-sm min-h-[64px] mt-1" placeholder={"لا ترسل إشعارات بعد منتصف الليل\nاذكر سعر المنتج دائماً"} data-testid="input-rules" />
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="text-sm font-semibold flex items-center gap-1"><ShieldAlert className="w-4 h-4 text-red-500" /> الخطوط الحمراء</div>
            <div className="grid grid-cols-2 gap-2">
              <NumField label="أقصى خصم %" value={form.redLines.maxDiscountPercent} onChange={(v) => setRL({ maxDiscountPercent: v })} testid="rl-maxDiscount" />
              <NumField label="أقصى تخفيض سعر %" value={form.redLines.maxPriceDecreasePercent} onChange={(v) => setRL({ maxPriceDecreasePercent: v })} testid="rl-maxPriceDrop" />
              <NumField label="أدنى سعر (ر.ي)" value={form.redLines.minPriceYer} onChange={(v) => setRL({ minPriceYer: v })} testid="rl-minPrice" />
              <NumField label="أقصى حملات/يوم" value={form.redLines.maxBroadcastsPerDay} onChange={(v) => setRL({ maxBroadcastsPerDay: v })} testid="rl-maxBroadcasts" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">السماح بإخفاء/إيقاف المنتجات</span>
              <Switch checked={form.redLines.allowProductDeactivation} onCheckedChange={(v) => setRL({ allowProductDeactivation: v })} data-testid="rl-allowDeactivation" />
            </div>
            <div>
              <label className="text-xs font-medium">منتجات محميّة (أرقام مفصولة بفاصلة)</label>
              <Input value={form.redLines.protectedProductIds.join(",")} inputMode="numeric"
                onChange={(e) => setRL({ protectedProductIds: e.target.value.split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n)) })}
                className="text-sm mt-1" placeholder="52, 71, 90" data-testid="rl-protectedIds" />
            </div>
            <div>
              <label className="text-xs font-medium">كلمات ممنوعة (مفصولة بفاصلة)</label>
              <Input value={form.redLines.blockedWords.join(",")}
                onChange={(e) => setRL({ blockedWords: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                className="text-sm mt-1" placeholder="مجاني, أرخص سعر" data-testid="rl-blockedWords" />
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="text-sm font-semibold">ضوابط التشغيل</div>
            <div className="grid grid-cols-3 gap-2">
              <NumField label="اقتراحات/جولة" value={form.orchestration.maxProposalsPerRun} onChange={(v) => setOrch({ maxProposalsPerRun: v })} testid="orch-maxProposals" />
              <NumField label="تهدئة (دقيقة)" value={form.orchestration.cooldownMinutes} onChange={(v) => setOrch({ cooldownMinutes: v })} testid="orch-cooldown" />
              <NumField label="جولات/يوم" value={form.orchestration.dailyRunCap} onChange={(v) => setOrch({ dailyRunCap: v })} testid="orch-dailyCap" />
            </div>
          </Card>

          <Button className="w-full" disabled={saveMut.isPending} onClick={() => form && saveMut.mutate(form)} data-testid="button-save-config">
            {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Save className="w-4 h-4 ml-2" />}
            حفظ الإعدادات
          </Button>
        </div>
      )}
    </div>
  );
}

function NumField({ label, value, onChange, testid }: { label: string; value: number; onChange: (v: number) => void; testid: string }) {
  return (
    <div>
      <label className="text-[11px] font-medium block mb-1">{label}</label>
      <Input type="number" inputMode="numeric" value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="text-sm h-9" data-testid={testid} />
    </div>
  );
}
