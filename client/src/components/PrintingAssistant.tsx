import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Send, Bot, User, ShoppingCart, Palette, Sparkles,
  ChevronDown, ChevronUp, Loader2, RefreshCw,
} from "lucide-react";

type Msg = { role: "user" | "model"; text: string; action?: string | null };

const PRODUCT_TYPES = [
  { key: "cloth_bag", emoji: "👜", label: "أكياس قماش" },
  { key: "nut_bag", emoji: "🥜", label: "أكياس مكسرات" },
  { key: "invoice", emoji: "🧾", label: "فواتير" },
  { key: "business_card", emoji: "💼", label: "كروت شخصية" },
  { key: "sticker", emoji: "🏷️", label: "لاصق ملصقات" },
  { key: "sign_board", emoji: "📋", label: "لوحات إعلانية" },
  { key: "pen_notebook", emoji: "✏️", label: "أقلام ودفاتر" },
  { key: "tshirt", emoji: "👕", label: "فنايل مطبوعة" },
  { key: "mug", emoji: "☕", label: "أكواب" },
  { key: "medal", emoji: "🏅", label: "ميداليات" },
];

const QUICK_REPLIES = [
  "كم سعر الطلب؟",
  "ما هو الحد الأدنى للكمية؟",
  "كم يستغرق التصنيع؟",
  "اقترح تركيبة ألوان",
];

const GREETING: Msg = {
  role: "model",
  text: "حياك الله! أنا أويو 🎨 موظف الطباعة في أويو بلاست.\n\nأساعدك تختار، تصمم، وتطلب — كل شيء من مكان واحد.\n\nاضغط على نوع المنتج الذي تريده أو اكتب سؤالك مباشرة 👇",
};

function formatText(text: string) {
  // Bold **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

export function PrintingAssistant() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [productType, setProductType] = useState<string | undefined>();
  const [showQuickTypes, setShowQuickTypes] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const chatMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch("/api/ai/printing-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: text,
          history: messages.slice(-16),
          productType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "خطأ في الاتصال");
      return data;
    },
    onSuccess: (data) => {
      const reply: Msg = { role: "model", text: data.reply, action: data.action };
      setMessages((prev) => [...prev, reply]);
      setShowQuickTypes(false);

      // إذا طلب إضافة خدمة التصميم للسلة
      if (data.action === "add_design_service") {
        addDesignServiceToCart();
      }
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        { role: "model", text: "عذراً، حصل خلل تقني. حاول مرة أخرى." },
      ]);
    },
  });

  const sendMessage = (text: string) => {
    if (!text.trim() || chatMutation.isPending) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    chatMutation.mutate(text);
  };

  const selectProductType = (pt: typeof PRODUCT_TYPES[0]) => {
    setProductType(pt.key);
    setShowQuickTypes(false);
    const msg = `أريد ${pt.emoji} ${pt.label}`;
    setMessages((prev) => [...prev, { role: "user", text: msg }]);
    chatMutation.mutate(msg);
  };

  const addDesignServiceToCart = () => {
    // جمع ملخص المحادثة
    const specsSummary = messages
      .filter((m) => m.role === "user")
      .slice(-5)
      .map((m) => m.text)
      .join(" | ");

    const waText = encodeURIComponent(
      `مرحباً، أريد نموذج تصميم أولي بـ 300 ريال يمني 🎨\n\nتفاصيل طلبي:\n${specsSummary}\n\nأرجو التواصل لإتمام التصميم.`
    );
    window.open(`https://wa.me/967000000000?text=${waText}`, "_blank");
    toast({
      title: "✅ يتم تحويلك للواتساب",
      description: "أرسل الرسالة وسيتواصل معك فريق التصميم خلال دقائق",
    });
  };

  const reset = () => {
    setMessages([GREETING]);
    setInput("");
    setProductType(undefined);
    setShowQuickTypes(true);
  };

  return (
    <div className="rounded-2xl border border-teal-100 shadow-xl bg-white overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-l from-teal-500 to-cyan-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {/* Robot Avatar */}
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 40 40" className="w-7 h-7" fill="none">
              <rect x="6" y="10" width="28" height="22" rx="6" fill="white" fillOpacity="0.9" />
              <line x1="20" y1="4" x2="20" y2="10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="20" cy="3.5" r="2" fill="white" />
              <circle cx="13.5" cy="19" r="3.5" fill="#06b6d4" />
              <circle cx="26.5" cy="19" r="3.5" fill="#06b6d4" />
              <circle cx="14.5" cy="18" r="1.2" fill="white" />
              <circle cx="27.5" cy="18" r="1.2" fill="white" />
              <path d="M13 26 Q20 31 27 26" stroke="#06b6d4" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">أويو — موظف الطباعة</p>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <p className="text-teal-100 text-xs">متاح الآن</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            data-testid="button-reset-chat"
            onClick={reset}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
            title="بدء محادثة جديدة"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            data-testid="button-toggle-assistant"
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Messages */}
          <div
            ref={scrollRef}
            className="h-[340px] overflow-y-auto px-3 py-3 space-y-3 bg-gray-50"
          >
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex items-end gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* Avatar */}
                <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold ${
                  msg.role === "model" ? "bg-gradient-to-br from-teal-400 to-cyan-600" : "bg-gray-400"
                }`}>
                  {msg.role === "model" ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>

                {/* Bubble */}
                <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line ${
                  msg.role === "model"
                    ? "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-tl-sm"
                    : "bg-teal-500 text-white rounded-tr-sm"
                }`}>
                  {msg.role === "model" ? formatText(msg.text) : msg.text}

                  {/* Design service CTA */}
                  {msg.action === "add_design_service" && (
                    <button
                      data-testid="button-add-design"
                      onClick={addDesignServiceToCart}
                      className="mt-2 flex items-center gap-1.5 bg-teal-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-teal-700 w-full justify-center"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      إضافة تصميم أولي — 300 ريال
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {chatMutation.isPending && (
              <div className="flex items-end gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-400 to-cyan-600 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-2 h-2 bg-teal-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Product Type Quick Selection */}
          {showQuickTypes && (
            <div className="border-t border-gray-100 px-3 py-2.5 bg-white">
              <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                <Palette className="w-3 h-3" />
                اختر نوع المنتج بسرعة:
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {PRODUCT_TYPES.map((pt) => (
                  <button
                    key={pt.key}
                    data-testid={`product-type-${pt.key}`}
                    onClick={() => selectProductType(pt)}
                    disabled={chatMutation.isPending}
                    className="flex-shrink-0 flex flex-col items-center gap-1 bg-gray-50 hover:bg-teal-50 border border-gray-200 hover:border-teal-300 rounded-xl px-3 py-2 text-xs transition-all hover:scale-105 active:scale-95 min-w-[60px]"
                  >
                    <span className="text-xl">{pt.emoji}</span>
                    <span className="text-gray-600 text-center leading-tight">{pt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Replies */}
          {!showQuickTypes && messages.length > 1 && (
            <div className="border-t border-gray-100 px-3 py-2 bg-white">
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {QUICK_REPLIES.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    disabled={chatMutation.isPending}
                    className="flex-shrink-0 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-700 text-xs px-3 py-1.5 rounded-full transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-gray-100 px-3 py-2.5 bg-white">
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                data-testid="input-printing-chat"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                placeholder="اكتب سؤالك أو وصف طلبك..."
                className="flex-1 rounded-xl border-gray-200 text-sm"
                disabled={chatMutation.isPending}
              />
              <Button
                data-testid="button-send-printing-chat"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || chatMutation.isPending}
                size="icon"
                className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl h-9 w-9 flex-shrink-0"
              >
                {chatMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-center text-xs text-gray-300 mt-1.5">
              <Sparkles className="w-3 h-3 inline ml-1" />
              مدعوم بالذكاء الاصطناعي — أويو بلاست
            </p>
          </div>
        </>
      )}
    </div>
  );
}
