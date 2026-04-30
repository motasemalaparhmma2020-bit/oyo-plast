import { useState, useRef, useEffect, createContext, useContext, useCallback, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, MessageCircle, Send, X, User, Headphones, Minus, Maximize2, Minimize2, Sparkles, Paperclip, ShoppingCart, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

function pageMatches(pages: string, loc: string): boolean {
  if (!pages || pages === "all") return true;
  const list = pages.split(",").map(p => p.trim()).filter(Boolean);
  return list.some(p => loc === p || loc.startsWith(p + "/") || loc.startsWith(p + "?"));
}

const AI_HIDE_PATHS = ["/admin", "/supplier", "/staff", "/marketer/dashboard"];

type Msg = { role: "user" | "model"; text: string; attachUrl?: string };
type ChatMode = "closed" | "bubble" | "compact" | "expanded";

interface ChatContext {
  open: (opts?: { productId?: number; productName?: string }) => void;
  close: () => void;
  minimize: () => void;
}

const SalesChatCtx = createContext<ChatContext>({ open: () => {}, close: () => {}, minimize: () => {} });
export function useSalesChat() { return useContext(SalesChatCtx); }

const QUICK_SUGGESTIONS = ["كم السعر؟", "أريد طباعة مخصصة", "الكميات المتاحة", "موعد التوصيل"];
const MODE_KEY   = "oyo-sales-chat-mode";
const CHAT_KEY   = () => `oyo-chat-${new Date().toISOString().slice(0, 10)}`;   // يومي
const MAX_HISTORY_DAYS = 1;   // نُبقي فقط اليوم الحالي

/* ── حفظ واسترجاع المحادثة من localStorage ── */
type SavedChat = { messages: Msg[]; productId?: number; productName?: string; savedAt: number };

function loadTodayChat(): SavedChat | null {
  try {
    const raw = localStorage.getItem(CHAT_KEY());
    if (!raw) return null;
    const data: SavedChat = JSON.parse(raw);
    // مسح إذا مضى عليه أكثر من 24 ساعة
    if (Date.now() - data.savedAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(CHAT_KEY());
      return null;
    }
    return data;
  } catch { return null; }
}

function saveChat(msgs: Msg[], productId?: number, productName?: string) {
  try {
    // حذف مفاتيح قديمة (أقدم من اليوم)
    const todayKey = CHAT_KEY();
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("oyo-chat-") && k !== todayKey) {
        localStorage.removeItem(k);
        i--;
      }
    }
    const data: SavedChat = { messages: msgs, productId, productName, savedAt: Date.now() };
    localStorage.setItem(todayKey, JSON.stringify(data));
  } catch {}
}

export function SalesChatProvider({ children }: { children: ReactNode }) {
  const saved       = loadTodayChat();
  const [mode, setModeState]       = useState<ChatMode>("closed");
  const [productId, setProductId]   = useState<number | undefined>(saved?.productId);
  const [productName, setProductName] = useState<string | undefined>(saved?.productName);
  const [messages, setMessages]     = useState<Msg[]>(saved?.messages || []);
  const [input, setInput]           = useState("");
  const [sending, setSending]       = useState(false);
  const [unread, setUnread]         = useState(0);
  const [mockupsShown, setMockupsShown] = useState(0);
  const [bottomOffset, setBottomOffset] = useState(0);
  const [uploadedLogoUrl, setUploadedLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading]   = useState(false);
  const scrollRef  = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ y: number; mode: ChatMode } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast }  = useToast();
  const [location] = useLocation();

  const { data: dispSettings } = useQuery<any>({
    queryKey: ["/api/display-settings"],
    staleTime: 60000,
  });

  const aiVisible = (() => {
    if (AI_HIDE_PATHS.some(p => location.startsWith(p))) return false;
    if (dispSettings?.showAiEmployee === false) return false;
    return pageMatches(dispSettings?.aiEmployeePages ?? "all", location);
  })();

  // ── قياس ارتفاع الشريط السفلي ──────────────────────────────────────────────
  useEffect(() => {
    const measure = () => {
      const bars = document.querySelectorAll<HTMLElement>('.app-fixed-bar');
      let maxH = 0;
      bars.forEach((b) => {
        if (b.dataset.salesChat === 'true') return;
        const r = b.getBoundingClientRect();
        if (r.height > 0 && r.bottom >= window.innerHeight - 8) {
          if (r.height > maxH) maxH = r.height;
        }
      });
      setBottomOffset(maxH);
    };
    measure();
    const t = setInterval(measure, 600);
    window.addEventListener('resize', measure);
    return () => { clearInterval(t); window.removeEventListener('resize', measure); };
  }, []);

  const setMode = useCallback((m: ChatMode) => {
    setModeState(m);
    if (m === "compact" || m === "expanded") {
      try { localStorage.setItem(MODE_KEY, m); } catch {}
      setUnread(0);
    }
  }, []);

  const buildGreeting = useCallback((name?: string): Msg => ({
    role: "model",
    text: name
      ? `حياك الله! أنا موظف مبيعات أويو بلاست. أرى اهتمامك بـ "${name}" — كم قطعة تحتاج؟`
      : "حياك الله! أنا موظف مبيعات أويو بلاست. كيف أخدمك؟",
  }), []);

  // ── حفظ المحادثة عند أي تغيير ──────────────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      saveChat(messages, productId, productName);
    }
  }, [messages, productId, productName]);

  const open: ChatContext["open"] = useCallback((opts) => {
    const newPid   = opts?.productId;
    const newPname = opts?.productName;

    // إذا تغيّر المنتج — نُضيف رسالة ترحيب بالمنتج الجديد فقط في نهاية المحادثة الموجودة
    setProductId(prev => {
      if (prev !== newPid && newPid) {
        setMessages(cur => {
          const greeting = buildGreeting(newPname);
          // لا نُضيف رسالة ترحيب مكررة إذا كانت آخر رسالة هي نفسها
          if (cur.length > 0 && cur[cur.length - 1].text === greeting.text) return cur;
          return [...cur, greeting];
        });
      } else if (messages.length === 0) {
        setMessages([buildGreeting(newPname)]);
      }
      return newPid;
    });
    setProductName(newPname);

    // افتراضياً يبدأ مطوياً (فقاعة صغيرة) — يحترم اختيار المستخدم السابق
    let saved: ChatMode = "bubble";
    try {
      const s = localStorage.getItem(MODE_KEY);
      if (s === "expanded" || s === "compact" || s === "bubble") saved = s as ChatMode;
    } catch {}
    setMode(saved);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildGreeting, messages.length, setMode]);

  const close    = useCallback(() => { setModeState("closed"); setUnread(0); }, []);
  const minimize = useCallback(() => setModeState("bubble"), []);

  // ── تهيئة الترحيب إذا لم تكن هناك محادثة محفوظة ────────────────────────────
  useEffect(() => {
    if ((mode === "compact" || mode === "expanded") && messages.length === 0) {
      setMessages([buildGreeting(productName)]);
    }
  }, [mode, messages.length, productName, buildGreeting]);

  // ── تمرير للأسفل عند كل رسالة ───────────────────────────────────────────────
  useEffect(() => {
    if ((mode === "compact" || mode === "expanded") && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, mode, sending]);

  // ── رفع ملف التصميم ─────────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "فقط صور مدعومة (PNG, JPG, WebP)", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const res = await fetch("/api/ai/upload-logo", { method: "POST", credentials: "include", body: formData });
      const data = await res.json();
      if (data?.imageUrl) {
        setUploadedLogoUrl(data.imageUrl);
        // أضف رسالة مرئية من طرف العميل تُعلم الموظف
        const notifyMsg: Msg = {
          role: "user",
          text: "رفعت ملف التصميم (الشعار)",
          attachUrl: data.imageUrl,
        };
        const newHistory = [...messages, notifyMsg];
        setMessages(newHistory);
        // أرسل للموظف الذكي ليرى الملف
        setSending(true);
        const chatRes = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            message: "رفعت ملف التصميم (الشعار)",
            history: newHistory.slice(-12),
            productId,
            mockupsShownCount: mockupsShown,
            uploadedLogoUrl: data.imageUrl,
          }),
        });
        const chatData = await chatRes.json();
        setMessages(m => [...m, { role: "model", text: chatData.reply || "تكرم..." }]);
        if (chatData.mockupRequest) setMockupsShown(n => n + 1);
        await processCartAction(chatData);
        setSending(false);
      } else {
        toast({ title: "فشل رفع الملف، حاول مرة أخرى", variant: "destructive" });
      }
    } catch {
      toast({ title: "خطأ في رفع الملف", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── معالجة إضافة للسلة (مُشتركة) ───────────────────────────────────────────
  const processCartAction = async (data: any) => {
    if (!data.addToCartData) return;
    const cartData = data.addToCartData;
    try {
      const cartRes = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          productId:     cartData.productId,
          quantity:      cartData.quantity,
          selectedSize:  cartData.selectedSize,
          selectedColor: cartData.selectedColor,
          customPrinting: cartData.customPrinting,
          designNotes:   cartData.designNotes,
          designFileUrl: cartData.designFileUrl,
          printColorCount: cartData.printColorCount,
          unitPrice:     String(cartData.unitPrice),
          aiDesignFee:   String(cartData.designFee || 0),
        }),
      });
      if (cartRes.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
        toast({
          title: "🛒 تمت الإضافة للسلة",
          description: (cartData.totalBreakdown || "راجع سلتك وأكمل الطلب") + " — اضغط على السلة للدفع",
        });
      } else {
        toast({ title: "تعذّر الإضافة للسلة تلقائياً", variant: "destructive" });
      }
    } catch {
      toast({ title: "خطأ في الإضافة للسلة", variant: "destructive" });
    }
  };

  // ── إرسال رسالة نصية ────────────────────────────────────────────────────────
  const sendMessage = async (text: string) => {
    if (!text.trim() || sending) return;
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
          mockupsShownCount: mockupsShown,
          uploadedLogoUrl: uploadedLogoUrl || undefined,
        }),
      });
      const data = await res.json();
      const reply = data.reply || "...";
      setMessages(m => [...m, { role: "model", text: reply }]);

      if (mode === "bubble") {
        setUnread(n => n + 1);
        toast({
          title: "💬 رسالة من موظف المبيعات",
          description: reply.length > 80 ? reply.slice(0, 80) + "…" : reply,
        });
      }
      if (data.mockupRequest) setMockupsShown(n => n + 1);
      await processCartAction(data);
    } catch {
      setMessages(m => [...m, { role: "model", text: "عذراً، تعذّر الاتصال. حاول مرة أخرى." }]);
    } finally {
      setSending(false);
    }
  };

  const send = () => sendMessage(input.trim());

  // ── Drag handle ──────────────────────────────────────────────────────────────
  const onDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    const y = "touches" in e ? e.touches[0].clientY : e.clientY;
    dragStartRef.current = { y, mode };
  };
  const onDragEnd = (e: React.TouchEvent | React.MouseEvent) => {
    if (!dragStartRef.current) return;
    const endY = "changedTouches" in e ? e.changedTouches[0].clientY : (e as React.MouseEvent).clientY;
    const dy = endY - dragStartRef.current.y;
    const startMode = dragStartRef.current.mode;
    dragStartRef.current = null;
    if (Math.abs(dy) < 40) return;
    if (dy < -40) {
      if (startMode === "compact") setMode("expanded");
    } else if (dy > 40) {
      if (startMode === "expanded") setMode("compact");
      else if (startMode === "compact") minimize();
    }
  };

  const heightClass = mode === "expanded" ? "h-[75vh]" : "h-[42vh] min-h-[320px]";

  return (
    <SalesChatCtx.Provider value={{ open, close, minimize }}>
      {children}

      {/* الأيقونة الرئيسية */}
      {mode === "closed" && aiVisible && (
        <button
          onClick={() => open()}
          style={{ bottom: `calc(${bottomOffset + 16}px + env(safe-area-inset-bottom))` }}
          className="fixed left-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-500/30 transition-transform hover:scale-110 active:scale-95"
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

      {/* الفقاعة المصغّرة */}
      {mode === "bubble" && (
        <button
          onClick={() => setMode("compact")}
          style={{ bottom: `calc(${bottomOffset + 16}px + env(safe-area-inset-bottom))` }}
          className="fixed left-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-xl shadow-teal-500/40 transition-transform hover:scale-110 active:scale-95"
          data-testid="button-restore-sales-chat"
          aria-label="استعادة المحادثة"
        >
          <Bot className="h-6 w-6 animate-pulse" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 flex min-h-[20px] min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white ring-2 ring-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      )}

      {/* نافذة الشات */}
      {(mode === "compact" || mode === "expanded") && (
        <>
          {mode === "expanded" && (
            <div
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity"
              onClick={() => setMode("compact")}
            />
          )}
          <div
            data-sales-chat="true"
            className={`fixed left-0 right-0 z-50 mx-auto flex w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-teal-200 bg-white shadow-2xl transition-[height] duration-300 dark:border-teal-800 dark:bg-gray-900 sm:left-6 sm:right-auto sm:w-[26rem] sm:rounded-3xl ${heightClass}`}
            style={{
              bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom))`,
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
            dir="rtl"
            data-testid="dialog-sales-chat"
          >
            {/* Drag handle */}
            <div
              className="flex cursor-grab items-center justify-center bg-gradient-to-l from-teal-500 to-cyan-600 pt-2 active:cursor-grabbing"
              onTouchStart={onDragStart}
              onTouchEnd={onDragEnd}
              onMouseDown={onDragStart}
              onMouseUp={onDragEnd}
              data-testid="drag-handle-sales-chat"
            >
              <div className="h-1 w-12 rounded-full bg-white/40" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between bg-gradient-to-l from-teal-500 to-cyan-600 px-4 py-2 text-white">
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
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMode(mode === "expanded" ? "compact" : "expanded")}
                  className="rounded-full p-1.5 hover:bg-white/20"
                  data-testid="button-toggle-size-sales-chat"
                  aria-label={mode === "expanded" ? "تصغير" : "تكبير"}
                >
                  {mode === "expanded" ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
                <button
                  onClick={minimize}
                  className="rounded-full p-1.5 hover:bg-white/20"
                  data-testid="button-minimize-sales-chat"
                  aria-label="طي"
                >
                  <Minus className="h-5 w-5" />
                </button>
                <button
                  onClick={close}
                  className="rounded-full p-1.5 hover:bg-white/20"
                  data-testid="button-close-sales-chat"
                  aria-label="إغلاق"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* تنبيه الشعار المرفوع */}
            {uploadedLogoUrl && (
              <div className="flex items-center gap-2 border-b border-teal-100 bg-teal-50 px-3 py-1.5 text-xs text-teal-700 dark:border-teal-800 dark:bg-teal-900/30 dark:text-teal-300">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>تم رفع ملف التصميم — سيُستخدم في النموذج المبدئي</span>
                <button onClick={() => setUploadedLogoUrl(null)} className="mr-auto text-teal-400 hover:text-teal-600 text-[10px]">إزالة</button>
              </div>
            )}

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex flex-1 flex-col gap-3 overflow-y-auto bg-gray-50 px-3 py-4 dark:bg-gray-950"
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
                  <div className={`flex flex-col gap-1 max-w-[75%] ${m.role === "user" ? "items-end" : "items-start"}`}>
                    {m.attachUrl && (
                      <img
                        src={m.attachUrl}
                        alt="ملف التصميم"
                        className="h-16 w-16 rounded-xl object-cover border border-teal-200 shadow-sm"
                      />
                    )}
                    <div
                      className={`whitespace-pre-wrap rounded-2xl px-3 py-2 text-[15px] leading-relaxed ${
                        m.role === "user"
                          ? "rounded-br-sm bg-cyan-600 text-white"
                          : "rounded-bl-sm bg-white text-gray-800 shadow-sm dark:bg-gray-800 dark:text-gray-100"
                      }`}
                    >
                      {m.text}
                    </div>
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

            {/* Quick suggestions */}
            {messages.length <= 1 && !sending && (
              <div className="flex gap-2 overflow-x-auto border-t border-gray-100 bg-white px-3 py-2 scrollbar-hide dark:border-gray-800 dark:bg-gray-900">
                <Sparkles className="h-4 w-4 shrink-0 self-center text-amber-500" />
                {QUICK_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="shrink-0 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700 hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-900/30 dark:text-teal-300"
                    data-testid={`button-suggestion-${s}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="flex items-center gap-2 border-t border-gray-200 bg-white px-3 py-2 dark:border-gray-800 dark:bg-gray-900">
              {/* زر رفع التصميم (اختياري) */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                data-testid="input-file-design"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || sending}
                title="رفع ملف التصميم (اختياري)"
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  uploadedLogoUrl
                    ? "border-teal-400 bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400"
                    : "border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500"
                } disabled:opacity-50`}
                data-testid="button-upload-design"
              >
                {uploading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : uploadedLogoUrl
                    ? <CheckCircle2 className="h-4 w-4" />
                    : <Paperclip className="h-4 w-4" />
                }
              </button>

              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                }}
                placeholder="اكتب رسالتك..."
                disabled={sending}
                className="flex-1 border-gray-200 text-right text-[15px] dark:border-gray-700"
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
        </>
      )}
    </SalesChatCtx.Provider>
  );
}

// ─── زر "تواصل مع المبيعات" ────────────────────────────────────────────────
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
