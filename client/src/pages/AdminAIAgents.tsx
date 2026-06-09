import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

function getAdminToken(): string {
  return localStorage.getItem("admin_token") || "";
}
async function adminFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    ...(opts.headers as any),
    "x-admin-token": getAdminToken(),
  };
  if (opts.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  const res = await fetch(url, { ...opts, headers, credentials: "include" });
  if (!res.ok) {
    const t = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${t}`);
  }
  return res;
}
async function adminApiRequest(method: string, url: string, data?: any) {
  return adminFetch(url, { method, body: data ? JSON.stringify(data) : undefined });
}
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Bot, Send, Sparkles, FileText, Check, X, Loader2, MessageSquare, RefreshCw, Settings, Crown, AlertTriangle } from "lucide-react";

interface Agent {
  id: number;
  name: string;
  display_name: string;
  role: string;
  model: string;
  provider: string;
  avatar_url: string | null;
  permissions: any;
  is_active: boolean;
  last_daily_report: string | null;
  actions_24h: number;
  pending_actions: number;
  conversations_24h: number;
}

interface CEOReport {
  date: string;
  summary: { total_actions: number; approved_actions: number; pending_actions: number; rejected_actions: number; total_conversations_24h: number };
  agents_report: Array<{ agent_id: number; display_name: string; role: string; actions_24h: number; conversations_24h: number; pending_tasks_count: number; performance_score: number; self_report?: string; achievements: Array<any> }>;
  db_facts: { new_orders_24h: number; delivered_orders_24h: number; new_users_24h: number; pending_credit_total: number };
  recommendations: string[];
  narrative: string;
  generated_at: string;
}

const AGENT_EMOJI: Record<string, string> = {
  safar: "💰", nour: "✍️", layla: "💬", huda: "📊", majed: "🎨",
  rami: "📈", omar: "🎭", oyo: "📦", rashed: "👑",
};

export default function AdminAIAgents() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [chatAgent, setChatAgent] = useState<Agent | null>(null);
  const [editAgent, setEditAgent] = useState<Agent | null>(null);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    if (!getAdminToken()) setLocation("/admin");
  }, [setLocation]);

  const { data: agents = [], isLoading } = useQuery<Agent[]>({
    queryKey: ['/api/ai/agents'],
    queryFn: async () => (await adminFetch('/api/ai/agents')).json(),
  });

  const { data: pendingActions = [] } = useQuery<any[]>({
    queryKey: ['/api/ai/agents/pending-actions'],
    queryFn: async () => {
      // Fetch all pending actions from all agents
      const results = await Promise.all(
        (agents || []).filter(a => a.pending_actions > 0).map(a =>
          adminFetch(`/api/ai/agents/${a.id}/actions?limit=50`)
            .then(r => r.json())
            .then(arr => (arr as any[]).filter(x => x.status === 'pending'))
            .catch(() => [])
        )
      );
      return results.flat();
    },
    enabled: agents.length > 0,
  });

  const { data: lastReport, isFetching: reportLoading } = useQuery<CEOReport>({
    queryKey: ['/api/ai/agents/ceo/last-report'],
    queryFn: async () => (await adminFetch('/api/ai/agents/ceo/last-report')).json(),
    retry: false,
  });

  const generateReportMutation = useMutation({
    mutationFn: async (force: boolean) => adminApiRequest('POST', '/api/ai/agents/ceo/daily-report', { force }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai/agents/ceo/last-report'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ai/agents'] });
      toast({ title: '✅ تم توليد التقرير', description: 'راجع قسم تقرير راشد بالأسفل' });
      setShowReport(true);
    },
    onError: (e: any) => toast({ title: 'فشل التوليد', description: e?.message || '', variant: 'destructive' }),
  });

  const approveMutation = useMutation({
    mutationFn: async (p: { id: number; approved: boolean }) =>
      (await adminApiRequest('POST', `/api/ai/actions/${p.id}/approve`, { approved: p.approved })).json(),
    onSuccess: (res: any, vars) => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai/agents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ai/agents/pending-actions'] });
      const exec = res?.execResult;
      if (!vars.approved) {
        toast({ title: 'تم رفض الإجراء' });
      } else if (exec) {
        toast({
          title: exec.ok ? '✅ تم التنفيذ' : '❌ فشل التنفيذ',
          description: exec.message,
          variant: exec.ok ? undefined : 'destructive',
        });
      } else {
        toast({ title: '✅ تمت الموافقة' });
      }
    },
    onError: (e: any) => toast({ title: 'خطأ', description: e?.message || '', variant: 'destructive' }),
  });

  if (isLoading) {
    return <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>;
  }

  return (
    <div className="container max-w-6xl mx-auto p-4 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-7 w-7 text-primary" />
            فريق الذكاء الاصطناعي
          </h1>
          <p className="text-sm text-muted-foreground mt-1">9 وكلاء + مدير تنفيذي يتفقد قاعدة البيانات</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => generateReportMutation.mutate(true)}
            disabled={generateReportMutation.isPending}
            className="gap-2"
            data-testid="button-generate-ceo-report">
            {generateReportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
            طلب تقرير راشد الفوري
          </Button>
        </div>
      </div>

      <Tabs defaultValue="agents" className="w-full">
        <TabsList>
          <TabsTrigger value="agents" data-testid="tab-agents">الوكلاء</TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending">
            الإجراءات المعلقة
            {pendingActions.length > 0 && <Badge variant="destructive" className="mr-2">{pendingActions.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="report" data-testid="tab-report">تقرير راشد</TabsTrigger>
        </TabsList>

        {/* === الوكلاء === */}
        <TabsContent value="agents">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map(a => {
              const isCeo = a.name === 'rashed';
              return (
                <Card key={a.id} className={`p-4 space-y-3 ${isCeo ? 'border-2 border-yellow-500/50 bg-gradient-to-br from-yellow-50/30 to-transparent dark:from-yellow-950/20' : ''}`} data-testid={`card-agent-${a.name}`}>
                  <div className="flex items-start gap-3">
                    <div className="text-4xl">{AGENT_EMOJI[a.name] || '🤖'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base">{a.display_name}</h3>
                        {isCeo && <Crown className="h-4 w-4 text-yellow-500" />}
                        {!a.is_active && <Badge variant="secondary" className="text-xs">معطّل</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{a.role}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Badge variant="outline" className="text-[10px]">{a.provider}</Badge>
                        <span className="text-[10px] text-muted-foreground">{a.model}</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-2">
                      <div className="font-bold text-blue-700 dark:text-blue-300">{a.actions_24h}</div>
                      <div className="text-[10px] text-muted-foreground">إجراءات اليوم</div>
                    </div>
                    <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-2">
                      <div className="font-bold text-green-700 dark:text-green-300">{a.conversations_24h}</div>
                      <div className="text-[10px] text-muted-foreground">محادثات</div>
                    </div>
                    <div className={`rounded-lg p-2 ${a.pending_actions > 0 ? 'bg-orange-50 dark:bg-orange-950/30' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
                      <div className={`font-bold ${a.pending_actions > 0 ? 'text-orange-700 dark:text-orange-300' : 'text-gray-500'}`}>{a.pending_actions}</div>
                      <div className="text-[10px] text-muted-foreground">معلّقة</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="default" className="flex-1 gap-1" onClick={() => setChatAgent(a)} data-testid={`button-chat-${a.name}`}>
                      <MessageSquare className="h-3 w-3" /> محادثة
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditAgent(a)} data-testid={`button-edit-${a.name}`}>
                      <Settings className="h-3 w-3" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* === الإجراءات المعلقة === */}
        <TabsContent value="pending">
          {pendingActions.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <Check className="h-12 w-12 mx-auto mb-2 text-green-500" />
              لا توجد إجراءات معلّقة
            </Card>
          ) : (
            <div className="space-y-3">
              {pendingActions.map((act: any) => {
                const agent = agents.find(a => a.id === act.agent_id);
                return (
                  <Card key={act.id} className="p-4" data-testid={`pending-action-${act.id}`}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-2xl">{agent ? AGENT_EMOJI[agent.name] : '🤖'}</span>
                          <div>
                            <p className="font-semibold text-sm">{act.title}</p>
                            <p className="text-xs text-muted-foreground">{agent?.display_name} • {act.action_type} • {new Date(act.created_at).toLocaleString('ar-YE')}</p>
                          </div>
                        </div>
                        {act.description && <p className="text-sm mt-2 whitespace-pre-wrap">{act.description}</p>}
                        {act.input_data?.tool && (
                          <div className="mt-2 rounded-md bg-muted/60 p-2 text-xs space-y-1" data-testid={`tool-args-${act.id}`}>
                            <div className="flex items-center gap-1 font-medium">
                              <span className="rounded bg-primary/15 text-primary px-1.5 py-0.5">{act.input_data.tool}</span>
                              <span className="text-muted-foreground">أداة تنفيذية</span>
                            </div>
                            {act.input_data.args && Object.keys(act.input_data.args).length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(act.input_data.args).map(([k, v]) => (
                                  <span key={k} className="rounded border px-1.5 py-0.5 bg-background">
                                    <span className="text-muted-foreground">{k}:</span> {String(v)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1" onClick={() => approveMutation.mutate({ id: act.id, approved: true })} data-testid={`approve-${act.id}`}>
                          <Check className="h-4 w-4" /> موافقة
                        </Button>
                        <Button size="sm" variant="destructive" className="gap-1" onClick={() => approveMutation.mutate({ id: act.id, approved: false })} data-testid={`reject-${act.id}`}>
                          <X className="h-4 w-4" /> رفض
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* === تقرير راشد === */}
        <TabsContent value="report">
          {!lastReport ? (
            <Card className="p-8 text-center space-y-4">
              <Crown className="h-12 w-12 mx-auto text-yellow-500" />
              <p className="text-muted-foreground">لم يتم إنشاء أي تقرير بعد. اضغط زر "طلب تقرير راشد الفوري" أعلاه.</p>
            </Card>
          ) : (
            <CEOReportView report={lastReport} loading={reportLoading} />
          )}
        </TabsContent>
      </Tabs>

      {/* Chat dialog */}
      {chatAgent && <ChatDialog agent={chatAgent} onClose={() => setChatAgent(null)} />}
      {/* Edit dialog */}
      {editAgent && <EditDialog agent={editAgent} onClose={() => setEditAgent(null)} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
function ChatDialog({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'agent'; text: string }>>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Load past conversations once
  useQuery({
    queryKey: ['/api/ai/agents', agent.id, 'conversations'],
    queryFn: async () => {
      const r = await adminFetch(`/api/ai/agents/${agent.id}/conversations?limit=10`);
      if (!r.ok) return [];
      const arr = (await r.json()) as any[];
      const past = arr.reverse().flatMap((c: any) => [
        { role: 'user' as const, text: c.message },
        ...(c.reply ? [{ role: 'agent' as const, text: c.reply }] : []),
      ]);
      setMessages(past);
      return arr;
    },
  });

  const chatMutation = useMutation({
    mutationFn: async (msg: string) => adminApiRequest('POST', `/api/ai/agents/${agent.id}/chat`, { message: msg }),
    onSuccess: async (res: any) => {
      const data = await res.json();
      setMessages(m => [...m, { role: 'agent', text: data.reply || '(لا يوجد رد)' }]);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50);
    },
    onError: (e: any) => toast({ title: 'فشل', description: e?.message || '', variant: 'destructive' }),
  });

  const send = () => {
    if (!input.trim() || chatMutation.isPending) return;
    setMessages(m => [...m, { role: 'user', text: input }]);
    chatMutation.mutate(input);
    setInput('');
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{AGENT_EMOJI[agent.name]}</span>
            محادثة مع {agent.display_name}
            <Badge variant="outline" className="text-[10px]">{agent.model}</Badge>
          </DialogTitle>
        </DialogHeader>
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
          {messages.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">ابدأ المحادثة — جرّب: "قدّم تقريراً عن آخر إنجازاتك"</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.role === 'user' ? 'bg-primary text-white' : 'bg-white dark:bg-gray-800 border'}`}>
                <pre className="whitespace-pre-wrap font-sans">{m.text}</pre>
              </div>
            </div>
          ))}
          {chatMutation.isPending && (
            <div className="flex justify-end">
              <div className="bg-white dark:bg-gray-800 border rounded-2xl px-3 py-2 flex items-center gap-2 text-sm">
                <Loader2 className="h-3 w-3 animate-spin" /> يكتب...
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
            placeholder="اكتب رسالتك..."
            disabled={chatMutation.isPending}
            data-testid="input-chat-message"
          />
          <Button onClick={send} disabled={!input.trim() || chatMutation.isPending} data-testid="button-send-chat">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ════════════════════════════════════════════════════════════════════════
function EditDialog({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    display_name: agent.display_name,
    role: agent.role,
    model: agent.model,
    system_prompt: '',
    is_active: agent.is_active,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { display_name: form.display_name, role: form.role, model: form.model, is_active: form.is_active };
      if (form.system_prompt.trim()) payload.system_prompt = form.system_prompt;
      return adminApiRequest('PATCH', `/api/ai/agents/${agent.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai/agents'] });
      toast({ title: '✅ تم الحفظ' });
      onClose();
    },
    onError: (e: any) => toast({ title: 'فشل', description: e?.message, variant: 'destructive' }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader><DialogTitle>إعدادات {agent.display_name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold">الاسم المعروض</label>
            <Input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} data-testid="input-display-name" />
          </div>
          <div>
            <label className="text-xs font-semibold">الدور</label>
            <Input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} data-testid="input-role" />
          </div>
          <div>
            <label className="text-xs font-semibold">النموذج</label>
            <Input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} data-testid="input-model" />
            <p className="text-[10px] text-muted-foreground mt-1">
              DeepSeek: <code>deepseek-chat</code> · Gemini: <code>gemini-2.5-flash</code>, <code>gemini-2.5-flash-lite</code>
            </p>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold">نشط</label>
            <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} data-testid="switch-active" />
          </div>
          <div>
            <label className="text-xs font-semibold">تعليمات النظام (system prompt) — اتركه فارغاً للإبقاء على الحالي</label>
            <Textarea
              rows={4}
              placeholder="(اتركه فارغاً لعدم التغيير)"
              value={form.system_prompt}
              onChange={e => setForm(f => ({ ...f, system_prompt: e.target.value }))}
              data-testid="input-system-prompt"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>إلغاء</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-agent">
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
              حفظ
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ════════════════════════════════════════════════════════════════════════
function CEOReportView({ report, loading }: { report: CEOReport; loading: boolean }) {
  return (
    <div className="space-y-4">
      {loading && <div className="text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>}

      {/* Narrative */}
      <Card className="p-4 border-2 border-yellow-500/40 bg-gradient-to-br from-yellow-50/40 to-transparent dark:from-yellow-950/20">
        <div className="flex items-center gap-2 mb-2">
          <Crown className="h-5 w-5 text-yellow-600" />
          <h3 className="font-bold">ملخّص راشد التنفيذي</h3>
          <Badge variant="outline" className="text-[10px]">{report.date}</Badge>
        </div>
        <p className="text-sm whitespace-pre-wrap leading-relaxed" data-testid="text-ceo-narrative">{report.narrative}</p>
      </Card>

      {/* DB Facts */}
      <Card className="p-4">
        <h3 className="font-bold mb-3 flex items-center gap-2"><FileText className="h-4 w-4" /> حقائق قاعدة البيانات (محقّقة)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-sm">
          <Stat label="طلبات جديدة" value={report.db_facts.new_orders_24h} />
          <Stat label="طلبات مسلّمة" value={report.db_facts.delivered_orders_24h} />
          <Stat label="مستخدمون جدد" value={report.db_facts.new_users_24h} />
          <Stat label="مستحقات (ر.ي)" value={Number(report.db_facts.pending_credit_total).toLocaleString('ar-YE')} />
        </div>
      </Card>

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <Card className="p-4 border-orange-500/30 bg-orange-50/30 dark:bg-orange-950/20">
          <h3 className="font-bold mb-2 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-orange-600" /> التوصيات</h3>
          <ul className="space-y-1 text-sm">
            {report.recommendations.map((r, i) => <li key={i} className="flex gap-2"><span>•</span><span>{r}</span></li>)}
          </ul>
        </Card>
      )}

      {/* Per-agent */}
      <Card className="p-4">
        <h3 className="font-bold mb-3">أداء كل وكيل</h3>
        <div className="space-y-2">
          {report.agents_report.map(ar => (
            <div key={ar.agent_id} className="flex items-center justify-between gap-3 border-b py-2 last:border-0 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{ar.display_name} — <span className="text-xs text-muted-foreground">{ar.role}</span></p>
                {ar.self_report && <p className="text-xs text-muted-foreground mt-1 italic line-clamp-2">{ar.self_report}</p>}
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span>{ar.actions_24h} إجراء</span>
                <span>{ar.conversations_24h} محادثة</span>
                <span className={`font-bold ${ar.performance_score >= 70 ? 'text-green-600' : ar.performance_score >= 50 ? 'text-orange-500' : 'text-red-500'}`}>
                  {ar.performance_score}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <p className="text-center text-[10px] text-muted-foreground">
        تم التوليد: {new Date(report.generated_at).toLocaleString('ar-YE')}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
