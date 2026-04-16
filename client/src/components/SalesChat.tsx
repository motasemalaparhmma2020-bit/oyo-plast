import { useState, useRef, useEffect, createContext, useContext, useCallback, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, MessageCircle, Send, X, User, Headphones } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Msg = { role: "user" | "model"; text: string };

interface ChatContext {
  open: (opts?: { productId?: number; productName?: string }) => void;
  close: () => void;
}

const SalesChatCtx = createContext<ChatContext>({ open: () => {}, close: () => {} });

export function useSalesChat() {
  return useContext(SalesChatCtx);
}

export function SalesChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [productId, setProductId] = useState<number | undefined>();
  const [productName, setProductName] = useState<string | undefined>();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const buildGreeting = useCallback((name?: string): Msg => ({
    role: "model",
    text: name
      ? `حياك الله! أنا موظف مبيعات أويو بلاست. أرى أنك مهتم بـ "${name}" — تكرم، كم قطعة تحتاج؟ وهل تريد طباعة مخصصة؟`
      : "حياك الله! أنا موظف مبيعات أويو بلاست. كيف أقدر أخدمك يا أستاذ؟",
  }), []);

  const open: ChatContext["open"] = useCallback((opts) => {
    const newPid = opts?.productId;
    const newPname = opts?.productName;
    // إعادة تهيئة المحادثة فقط عند تغيير المنتج المعروض
    setProductId((prev) => {
      if (prev !== newPid) {
        setMessages([buildGreeting(newPname)]);
      } else if (messages.length === 0) {
        setMessages([buildGreeting(newPname)]);
      }
      return newPid;
    });
    setProductName(newPname);
    setIsOpen(true);
  }, [buildGreeting, messages.length]);

  const close = useCallback(() => setIsOpen(false), []);

  // رسالة ترحيب أولية عند الفتح بدون منتج
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([buildGreeting(productName)]);
    }
  }, [isOpen, messages.length, productName, buildGreeting]);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen, sending]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    const newHistory: Msg[] = [...messages, { role: "user", text }];
    setMessages(newHistory);
    setSending(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: text,
          history: messages.slice(-12),
          productId,
        }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "model", text: data.reply || "..." }]);
      if (data.orderCreated) {
        toast({
          title: `✅ تم إنشاء طلبك #${data.orderCreated.id}`,
          description: `إجمالي ${Number(data.orderCreated.total).toLocaleString("ar-SA")} ريال يمني`,
        });
      }
    } catch {
      setMessages((m) => [...m, { role: "model", text: "عذراً، تعذّر الاتصال بالخادم. حاول مرة أخرى." }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <SalesChatCtx.Provider value={{ open, close }}>
      {children}

      {/* الأيقونة العائمة — تظهر في كل الصفحات */}
      {!isOpen && (
        <button
          onClick={() => open()}
          className="fixed bottom-24 left-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-500/30 transition-transform hover:scale-110 active:scale-95"
          data-testid="button-open-sales-chat-floating"
          aria-label="فتح محادثة المبيعات"
        >
          <MessageCircle className="h-6 w-6" />
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
          </span>
        </button>
      )}

      {/* نافذة الشات */}
      {isOpen && (
        <div
          className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-md flex-col rounded-2xl border border-teal-200 bg-white shadow-2xl dark:border-teal-800 dark:bg-gray-900 sm:bottom-6 sm:left-6 sm:right-auto sm:w-96"
          dir="rtl"
          data-testid="dialog-sales-chat"
        >
          <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-l from-teal-500 to-cyan-600 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-bold">موظف المبيعات الذكي</div>
                <div className="flex items-center gap-1 text-xs text-white/80">
                  <span className="h-2 w-2 rounded-full bg-green-400" />
                  متاح الآن
                </div>
              </div>
            </div>
            <button
              onClick={close}
              className="rounded-full p-1 hover:bg-white/20"
              data-testid="button-close-sales-chat"
              aria-label="إغلاق"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div
            ref={scrollRef}
            className="flex max-h-[420px] min-h-[280px] flex-col gap-3 overflow-y-auto bg-gray-50 px-3 py-4 dark:bg-gray-950"
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex items-end gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}
                data-testid={`message-${m.role}-${i}`}
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    m.role === "user" ? "bg-cyan-600 text-white" : "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300"
                  }`}
                >
                  {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                <div
                  className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "rounded-br-sm bg-cyan-600 text-white"
                      : "rounded-bl-sm bg-white text-gray-800 shadow-sm dark:bg-gray-800 dark:text-gray-100"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex gap-1 rounded-2xl bg-white px-3 py-3 shadow-sm dark:bg-gray-800">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-teal-500 [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-teal-500 [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-teal-500" />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 rounded-b-2xl border-t border-gray-200 bg-white px-3 py-2 dark:border-gray-800 dark:bg-gray-900">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="اكتب رسالتك..."
              disabled={sending}
              className="flex-1 border-gray-200 text-right dark:border-gray-700"
              data-testid="input-sales-chat-message"
            />
            <Button
              onClick={send}
              disabled={sending || !input.trim()}
              size="icon"
              className="bg-teal-600 hover:bg-teal-700"
              data-testid="button-send-sales-chat"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </SalesChatCtx.Provider>
  );
}

// ─── زر "تواصل مع المبيعات" يُستخدم في صفحة المنتج ─────────────────
export function ContactSalesButton({ productId, productName }: { productId?: number; productName?: string }) {
  const { open } = useSalesChat();
  return (
    <button
      onClick={() => open({ productId, productName })}
      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-teal-500 to-cyan-600 px-4 py-3 text-sm font-bold text-white shadow-md shadow-teal-500/20 transition-all hover:shadow-lg hover:shadow-teal-500/30 active:scale-[0.98]"
      data-testid="button-contact-sales"
    >
      <Headphones className="h-4 w-4" />
      تواصل مع المبيعات للتفاوض أو الطباعة
    </button>
  );
}
