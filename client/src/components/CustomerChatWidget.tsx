import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Send, X, Loader2, ChevronDown } from "lucide-react";
import type { Conversation, Message } from "@shared/schema";

const HIDE_PATHS  = ["/printing", "/marketer/dashboard", "/supplier", "/admin", "/staff", "/checkout"];
const STORAGE_KEY = "customer_chat_phone";
const NAME_KEY    = "customer_chat_name";

/** تحويل الأرقام العربية/الهندية إلى أرقام غربية قبل الفلترة */
function normalizePhone(value: string): string {
  return value
    .replace(/[٠١٢٣٤٥٦٧٨٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰۱۲۳۴۵۶۷۸۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[^\d+]/g, "");
}

interface Props {
  relatedOrderId?: number;
  relatedProductId?: number;
  buttonLabel?: string;
  inline?: boolean;
}

export default function CustomerChatWidget({
  relatedOrderId,
  relatedProductId,
  buttonLabel = "تواصل مع المبيعات",
  inline = false,
}: Props) {
  const { toast }   = useToast();
  const [location]  = useLocation();
  const [open, setOpen]           = useState(inline);
  const [collapsed, setCollapsed] = useState(true); // inline: مطوي بالبداية
  const [phone, setPhone] = useState<string>(() => localStorage.getItem(STORAGE_KEY) || "");
  const [name,  setName]  = useState<string>(() => localStorage.getItem(NAME_KEY)    || "");
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const chatActive = open && (!inline || !collapsed);

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/customer/conversations", phone],
    enabled: !!phone && chatActive,
    queryFn: async () => {
      const r = await fetch(`/api/customer/conversations?phone=${encodeURIComponent(phone)}`);
      if (!r.ok) return [];
      return r.json();
    },
    refetchInterval: chatActive ? 10000 : false,
  });

  const activeConv =
    conversations.find(c =>
      (relatedOrderId && c.relatedOrderId === relatedOrderId) ||
      (!relatedOrderId && c.status === "open")
    ) || conversations[0];

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/customer/conversations", activeConv?.id, "messages", phone],
    enabled: !!activeConv?.id && !!phone && chatActive,
    queryFn: async () => {
      const r = await fetch(
        `/api/customer/conversations/${activeConv!.id}/messages?phone=${encodeURIComponent(phone)}`
      );
      if (!r.ok) return [];
      return r.json();
    },
    refetchInterval: chatActive && activeConv ? 5000 : false,
  });

  useEffect(() => {
    if (messages.length) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const r = await apiRequest("POST", "/api/customer/conversations", {
        customerPhone: phone,
        customerName: name,
        content,
        relatedOrderId,
        relatedProductId,
      });
      return r.json();
    },
    onSuccess: () => {
      setDraft("");
      localStorage.setItem(STORAGE_KEY, phone);
      if (name) localStorage.setItem(NAME_KEY, name);
      queryClient.invalidateQueries({ queryKey: ["/api/customer/conversations", phone] });
    },
    onError: (e: any) =>
      toast({ title: "فشل الإرسال", description: e.message, variant: "destructive" }),
  });

  const canSend = phone.trim().length >= 9 && draft.trim().length > 0;

  if (!inline && HIDE_PATHS.some((p) => location.startsWith(p))) return null;

  // ─── وضع inline — بطاقة أنيقة قابلة للطي ───────────────────────────────
  if (inline) {
    return (
      <div className="rounded-xl border shadow-sm overflow-hidden" dir="rtl" data-testid="inline-customer-chat">

        {/* رأس البطاقة — دائمًا ظاهر */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="w-full flex items-center justify-between bg-primary text-white px-4 py-3 transition-opacity active:opacity-80"
          data-testid="button-toggle-chat"
        >
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            <span className="font-semibold text-sm">المحادثة مع الإدارة</span>
          </div>
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${collapsed ? "" : "rotate-180"}`}
          />
        </button>

        {/* المحتوى — يظهر عند الفتح */}
        {!collapsed && (
          <div className="flex flex-col bg-white dark:bg-gray-800">
            {/* بيانات العميل */}
            {!phone && (
              <div className="p-3 space-y-2 border-b bg-amber-50 dark:bg-amber-900/20">
                <p className="text-xs text-muted-foreground">أدخل بياناتك للبدء (تُحفظ على جهازك):</p>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="اسمك"
                  className="h-9 text-sm"
                  data-testid="input-chat-name"
                />
                <Input
                  value={phone}
                  onChange={(e) => setPhone(normalizePhone(e.target.value))}
                  placeholder="رقم هاتفك (مع رمز الدولة)"
                  className="h-9 text-sm"
                  inputMode="tel"
                  type="tel"
                  data-testid="input-chat-phone"
                />
              </div>
            )}

            {/* الرسائل */}
            <div
              className="overflow-y-auto p-3 space-y-2 bg-gray-50 dark:bg-gray-900/40"
              style={{ minHeight: 140, maxHeight: "36vh" }}
            >
              {messages.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-6">
                  ابدأ محادثة مع فريق المبيعات.
                  {relatedOrderId && (
                    <span className="text-primary block mt-1">طلب #{relatedOrderId}</span>
                  )}
                </div>
              )}
              {messages.map(m => {
                const isCustomer = m.senderType === "customer";
                return (
                  <div key={m.id} className={`flex ${isCustomer ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        isCustomer ? "bg-primary text-white" : "bg-white dark:bg-gray-800 border"
                      }`}
                      data-testid={`customer-msg-${m.id}`}
                    >
                      <div className="whitespace-pre-wrap break-words">{m.content}</div>
                      <div className="text-[9px] opacity-60 mt-1 text-left">
                        {m.createdAt ? new Date(m.createdAt).toLocaleString("ar") : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>

            {/* شريط الإرسال */}
            <div className="border-t p-2">
              <div className="flex gap-2">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (canSend) sendMutation.mutate(draft.trim());
                    }
                  }}
                  placeholder="اكتب رسالتك…"
                  className="min-h-[40px] text-sm resize-none flex-1"
                  rows={2}
                  data-testid="textarea-customer-draft"
                />
                <Button
                  size="icon"
                  onClick={() => canSend && sendMutation.mutate(draft.trim())}
                  disabled={!canSend || sendMutation.isPending}
                  data-testid="button-customer-send"
                >
                  {sendMutation.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Send className="h-4 w-4" />}
                </Button>
              </div>
              {!phone && (
                <p className="text-[10px] text-amber-600 mt-1">أدخل رقم هاتفك أعلاه للإرسال</p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── وضع عائم (floating) ─────────────────────────────────────────────────
  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 left-4 z-40 bg-primary text-white rounded-full shadow-lg p-3 hover:scale-105 transition-transform flex items-center gap-2 px-4"
          data-testid="button-open-chat"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="text-sm font-medium hidden sm:inline">{buttonLabel}</span>
        </button>
      )}

      {open && (
        <div
          className="fixed bottom-4 left-4 right-4 sm:right-auto sm:w-[360px] z-50 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border flex flex-col max-h-[80vh]"
          dir="rtl"
          data-testid="floating-customer-chat"
        >
          {/* رأس */}
          <div className="bg-primary text-white px-3 py-2.5 rounded-t-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              <span className="font-semibold text-sm">المحادثة مع الإدارة</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="hover:bg-white/20 rounded p-1"
              data-testid="button-close-chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* بيانات العميل */}
          {!phone && (
            <div className="p-3 space-y-2 border-b bg-amber-50 dark:bg-amber-900/20">
              <p className="text-xs text-muted-foreground">أدخل بياناتك للبدء (تُحفظ على جهازك):</p>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="اسمك"
                className="h-8 text-sm"
                data-testid="input-chat-name"
              />
              <Input
                value={phone}
                onChange={(e) => setPhone(normalizePhone(e.target.value))}
                placeholder="رقم هاتفك (مع رمز الدولة)"
                className="h-8 text-sm"
                inputMode="tel"
                type="tel"
                data-testid="input-chat-phone"
              />
            </div>
          )}

          {/* الرسائل */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px] max-h-[50vh] bg-gray-50 dark:bg-gray-900/40">
            {messages.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-8">
                ابدأ محادثة مع فريق المبيعات.
                {relatedOrderId && (
                  <span className="text-blue-600 block mt-1">طلب #{relatedOrderId}</span>
                )}
              </div>
            )}
            {messages.map(m => {
              const isCustomer = m.senderType === "customer";
              return (
                <div key={m.id} className={`flex ${isCustomer ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      isCustomer ? "bg-primary text-white" : "bg-white dark:bg-gray-800 border"
                    }`}
                    data-testid={`customer-msg-${m.id}`}
                  >
                    <div className="whitespace-pre-wrap break-words">{m.content}</div>
                    <div className="text-[9px] opacity-60 mt-1 text-left">
                      {m.createdAt ? new Date(m.createdAt).toLocaleString("ar") : ""}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          {/* شريط الإرسال */}
          <div className="border-t p-2 bg-white dark:bg-gray-800 rounded-b-xl">
            <div className="flex gap-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (canSend) sendMutation.mutate(draft.trim());
                  }
                }}
                placeholder="اكتب رسالتك…"
                className="min-h-[40px] text-sm resize-none flex-1"
                rows={2}
                data-testid="textarea-customer-draft"
              />
              <Button
                size="icon"
                onClick={() => canSend && sendMutation.mutate(draft.trim())}
                disabled={!canSend || sendMutation.isPending}
                data-testid="button-customer-send"
              >
                {sendMutation.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Send className="h-4 w-4" />}
              </Button>
            </div>
            {!phone && (
              <p className="text-[10px] text-amber-600 mt-1">أدخل رقم هاتفك أعلاه للإرسال</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
