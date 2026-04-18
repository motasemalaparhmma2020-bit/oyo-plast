import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send, Search, X, Archive, RefreshCw, Loader2, User, Truck, Users } from "lucide-react";
import type { Conversation, Message } from "@shared/schema";

type Tab = "customer" | "supplier" | "internal";

export default function AdminInbox() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("customer");
  const [statusFilter, setStatusFilter] = useState<"open" | "closed" | "archived">("open");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // قائمة المحادثات
  const { data: conversations = [], isLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/admin/conversations", { type: tab, status: statusFilter, search }],
    queryFn: async () => {
      const params = new URLSearchParams({ type: tab, status: statusFilter });
      if (search) params.set("search", search);
      const r = await fetch(`/api/admin/conversations?${params}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    refetchInterval: 15000,
  });

  // عداد غير المقروء (للإحصاء أعلى الألسنة)
  const { data: unreadStats } = useQuery<{ total: number; byType: Record<string, number> }>({
    queryKey: ["/api/admin/conversations/unread-total"],
    refetchInterval: 15000,
  });

  // تفاصيل المحادثة المختارة
  const { data: details } = useQuery<{ conversation: Conversation; messages: Message[] }>({
    queryKey: ["/api/admin/conversations", selectedId],
    enabled: !!selectedId,
    refetchInterval: selectedId ? 5000 : false,
  });

  useEffect(() => {
    if (details?.messages?.length) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [details?.messages?.length]);

  // إرسال رسالة
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const r = await apiRequest("POST", `/api/admin/conversations/${selectedId}/messages`, { content });
      return r.json();
    },
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/conversations", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/conversations"] });
    },
    onError: (e: any) => toast({ title: "فشل الإرسال", description: e.message, variant: "destructive" }),
  });

  // تغيير حالة المحادثة
  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      await apiRequest("PATCH", `/api/admin/conversations/${selectedId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/conversations", selectedId] });
    },
  });

  const TAB_META: Record<Tab, { label: string; icon: any; color: string }> = {
    customer: { label: "عملاء", icon: User, color: "text-blue-600" },
    supplier: { label: "موردون", icon: Truck, color: "text-emerald-600" },
    internal: { label: "داخلي", icon: Users, color: "text-purple-600" },
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900" dir="rtl">
      <div className="max-w-7xl mx-auto p-3 md:p-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6" /> صندوق الرسائل
          </h1>
          <Button size="sm" variant="outline" onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/conversations"] });
          }} data-testid="button-refresh-inbox">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* الألسنة */}
        <div className="flex gap-2 mb-3 border-b">
          {(Object.keys(TAB_META) as Tab[]).map(t => {
            const M = TAB_META[t];
            const unread = unreadStats?.byType?.[t] || 0;
            const isActive = tab === t;
            return (
              <button key={t} onClick={() => { setTab(t); setSelectedId(null); }}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${isActive ? `border-primary ${M.color}` : "border-transparent text-muted-foreground hover:text-foreground"}`}
                data-testid={`tab-${t}`}>
                <M.icon className="h-4 w-4" /> {M.label}
                {unread > 0 && <Badge className="bg-red-500 text-white h-5 min-w-5 px-1.5">{unread}</Badge>}
              </button>
            );
          })}
        </div>

        <div className="grid md:grid-cols-[320px_1fr] gap-3 h-[calc(100vh-180px)]">
          {/* قائمة المحادثات */}
          <Card className="overflow-hidden flex flex-col">
            <div className="p-2 border-b space-y-2">
              <div className="relative">
                <Search className="h-4 w-4 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="بحث…" className="pr-8 h-8 text-sm" data-testid="input-search-conv" />
              </div>
              <div className="flex gap-1">
                {(["open", "closed", "archived"] as const).map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={`flex-1 text-xs py-1 rounded ${statusFilter === s ? "bg-primary text-white" : "bg-gray-100 dark:bg-gray-800"}`}
                    data-testid={`filter-status-${s}`}>
                    {s === "open" ? "مفتوح" : s === "closed" ? "مغلق" : "مؤرشف"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoading && <div className="p-4 text-center text-muted-foreground text-sm">جارٍ التحميل…</div>}
              {!isLoading && conversations.length === 0 && (
                <div className="p-6 text-center text-muted-foreground text-sm">لا توجد محادثات</div>
              )}
              {conversations.map(c => {
                const isSelected = selectedId === c.id;
                const title = c.type === "supplier" ? `مورد #${c.supplierId}` : c.customerName || c.customerPhone || `محادثة #${c.id}`;
                return (
                  <button key={c.id} onClick={() => setSelectedId(c.id)}
                    className={`w-full text-right px-3 py-2.5 border-b hover-elevate transition-colors ${isSelected ? "bg-primary/10" : ""}`}
                    data-testid={`conv-${c.id}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm truncate flex-1">{title}</span>
                      {(c.unreadAdmin || 0) > 0 && (
                        <Badge className="bg-red-500 text-white h-5 min-w-5 text-[10px]">{c.unreadAdmin}</Badge>
                      )}
                    </div>
                    {c.relatedOrderId && <div className="text-[10px] text-blue-600">طلب #{c.relatedOrderId}</div>}
                    <div className="text-xs text-muted-foreground truncate mt-0.5">{c.lastMessagePreview || "—"}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleString("ar") : ""}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* عرض المحادثة */}
          <Card className="overflow-hidden flex flex-col">
            {!selectedId && (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <MessageSquare className="h-12 w-12 opacity-30" />
                <span className="text-sm">اختر محادثة لعرضها</span>
              </div>
            )}
            {selectedId && details && (
              <>
                <div className="border-b px-3 py-2 flex items-center justify-between bg-gray-50 dark:bg-gray-800">
                  <div>
                    <div className="font-semibold text-sm">
                      {details.conversation.customerName || details.conversation.customerPhone || `محادثة #${details.conversation.id}`}
                    </div>
                    {details.conversation.relatedOrderId && (
                      <div className="text-xs text-blue-600">طلب #{details.conversation.relatedOrderId}</div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {details.conversation.status === "open" ? (
                      <Button size="sm" variant="outline" onClick={() => statusMutation.mutate("closed")} data-testid="button-close-conv">
                        <X className="h-3.5 w-3.5 ml-1" /> إغلاق
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => statusMutation.mutate("open")} data-testid="button-reopen-conv">
                        فتح
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => statusMutation.mutate("archived")} data-testid="button-archive-conv">
                      <Archive className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50/50 dark:bg-gray-900/40">
                  {details.messages.map(m => {
                    const isAdmin = m.senderType === "admin";
                    const isSystem = m.senderType === "system";
                    return (
                      <div key={m.id} className={`flex ${isAdmin ? "justify-start" : "justify-end"}`}>
                        <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                          isSystem ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-200 mx-auto text-center" :
                          isAdmin ? "bg-primary text-white" : "bg-white dark:bg-gray-800 border"
                        }`} data-testid={`msg-${m.id}`}>
                          {!isSystem && (
                            <div className="text-[10px] opacity-70 mb-0.5">{m.senderName || m.senderType}</div>
                          )}
                          <div className="whitespace-pre-wrap break-words">{m.content}</div>
                          <div className="text-[9px] opacity-60 mt-1 text-left">
                            {m.createdAt ? new Date(m.createdAt).toLocaleString("ar") : ""}
                            {m.channel !== "web" && <span className="mr-1">· {m.channel}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                <div className="border-t p-2 bg-white dark:bg-gray-800">
                  <div className="flex gap-2">
                    <Textarea value={draft} onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (draft.trim()) sendMutation.mutate(draft.trim());
                        }
                      }}
                      placeholder="اكتب رسالتك… (Enter للإرسال)"
                      className="min-h-[44px] text-sm resize-none" rows={2}
                      data-testid="textarea-draft" />
                    <Button onClick={() => draft.trim() && sendMutation.mutate(draft.trim())}
                      disabled={!draft.trim() || sendMutation.isPending}
                      data-testid="button-send-msg">
                      {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
