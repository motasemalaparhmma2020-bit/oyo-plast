import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Send, Bot, User, ShoppingCart, Palette, Sparkles,
  ChevronDown, ChevronUp, Loader2, RefreshCw, Paperclip, CheckCircle2, X,
} from "lucide-react";
import { useLocation } from "wouter";

type Msg = { role: "user" | "model"; text: string; action?: string | null };

const PRODUCT_TYPES = [
  { key: "cloth_bag", emoji: "👜", label: "أكياس قماش" },
  { key: "nut_bag", emoji: "🥜", label: "أكياس مكسرات" },
  { key: "invoice", emoji: "🧾", label: "فواتير" },
  { key: "business_card", emoji: "💼", label: "كروت شخصية" },
  { key: "sticker", emoji: "🏷️", label: "ملصقات" },
  { key: "sign_board", emoji: "📋", label: "لوحات إعلانية" },
  { key: "pen_notebook", emoji: "✏️", label: "أقلام ودفاتر" },
  { key: "tshirt", emoji: "👕", label: "فنايل" },
  { key: "mug", emoji: "☕", label: "أكواب" },
  { key: "medal", emoji: "🏅", label: "ميداليات" },
];

const QUICK_REPLIES = [
  "كم سعر الطلب؟",
  "ما هو الحد الأدنى للكمية؟",
  "كم يستغرق التسليم؟",
  "اقترح تركيبة ألوان",
];

const GREETING: Msg = {
  role: "model",
  text: "حياك الله! أنا أويو 🎨 موظف الطباعة في أويو بلاست.\n\nأساعدك تختار، تصمم، وتطلب — كل شيء من مكان واحد.\n\nاضغط على نوع المنتج أو اكتب طلبك مباشرة 👇",
};

function formatText(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

// استخراج بيانات الطلب من ملخص الموظف الذكي
function parseCartData(messages: Msg[]) {
  const modelMsgs = [...messages].reverse().filter(m => m.role === "model");
  let summary = "";
  for (const msg of modelMsgs) {
    if (msg.text.includes("📦") && msg.text.includes("━━")) {
      summary = msg.text;
      break;
    }
  }
  if (!summary) return null;

  const getLine = (emoji: string) => {
    const re = new RegExp(`${emoji}[^:：]*[:：]\\s*(.+)`);
    const m = summary.match(re);
    return m ? m[1].trim() : null;
  };

  // رقم المنتج
  const productIdStr = getLine("🆔");
  const productId = productIdStr ? parseInt(productIdStr.replace(/\D/g, "")) : null;

  // الكمية
  const qtyStr = getLine("🔢");
  const quantity = qtyStr ? parseInt(qtyStr.replace(/[^\d]/g, "")) : null;

  // لون المنتج
  const selectedColor = getLine("🎨 لون المنتج") || getLine("🎨");

  // المقاس
  const selectedSize = getLine("📐");

  // وصف التصميم (قد يمتد عدة أسطر)
  const designMatch = summary.match(/🎨 وصف التصميم[^:：]*[:：]\s*([\s\S]*?)(?:━━|💰|⏱️|$)/);
  const designNotes = designMatch ? designMatch[1].trim() : summary;

  return { productId, quantity, selectedColor, selectedSize, designNotes, fullSummary: summary };
}

export function PrintingAssistant() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [productType, setProductType] = useState<string | undefined>();
  const [showQuickTypes, setShowQuickTypes] = useState(true);
  const [designFile, setDesignFile] = useState<File | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [addedToCart, setAddedToCart] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: displaySettings } = useQuery<any>({
    queryKey: ["/api/display-settings"],
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // رفع ملف التصميم
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("design", file);
      const res = await fetch("/api/upload/design", { method: "POST", body: formData, credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "فشل رفع الملف");
      return data.designUrl as string;
    },
    onSuccess: (url) => {
      setUploadedUrl(url);
      toast({ title: "✅ تم رفع ملف التصميم", description: "سيُضاف مع طلبك في السلة" });
    },
    onError: () => {
      toast({ title: "فشل رفع الملف", description: "تأكد من نوع الملف وحاول مجدداً", variant: "destructive" });
    },
  });

  // إضافة الطلب للسلة
  const addToCartMutation = useMutation({
    mutationFn: async () => {
      const parsed = parseCartData(messages);
      if (!parsed?.productId) throw new Error("لم يتم تحديد المنتج بعد");
      if (!parsed?.quantity || parsed.quantity < 1) throw new Error("الكمية غير صحيحة");

      const body = {
        productId: parsed.productId,
        quantity: parsed.quantity,
        selectedColor: parsed.selectedColor || null,
        selectedSize: parsed.selectedSize || null,
        customPrinting: true,
        designNotes: parsed.designNotes || parsed.fullSummary,
        designFileUrl: uploadedUrl || null,
      };

      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "فشل إضافة الطلب");
      return data;
    },
    onSuccess: () => {
      setAddedToCart(true);
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({
        title: "✅ تمت إضافة الطلب للسلة",
        description: "يمكنك استكمال الطلب والدفع من السلة",
      });
    },
    onError: (e: any) => {
      toast({ title: "فشل إضافة الطلب", description: e.message, variant: "destructive" });
    },
  });

  const chatMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch("/api/ai/printing-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: text, history: messages.slice(-16), productType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "خطأ في الاتصال");
      return data;
    },
    onSuccess: (data) => {
      let action = data.action;
      if (!action && data.reply.includes("📦") && data.reply.includes("━━")) {
        action = "ready_to_order";
      }
      const reply: Msg = { role: "model", text: data.reply, action };
      setMessages((prev) => [...prev, reply]);
      setShowQuickTypes(false);
      setAddedToCart(false);
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

  const reset = () => {
    setMessages([GREETING]);
    setInput("");
    setProductType(undefined);
    setShowQuickTypes(true);
    setDesignFile(null);
    setUploadedUrl(null);
    setAddedToCart(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setDesignFile(f);
    uploadMutation.mutate(f);
  };

  const hasOrderSummary = messages.some(
    m => m.role === "model" && m.text.includes("📦") && m.text.includes("━━")
  );

  return (
    <div className="rounded-2xl border border-teal-100 shadow-xl bg-white overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-l from-teal-500 to-cyan-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
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
                <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold ${
                  msg.role === "model" ? "bg-gradient-to-br from-teal-400 to-cyan-600" : "bg-gray-400"
                }`}>
                  {msg.role === "model" ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>

                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line ${
                  msg.role === "model"
                    ? "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-tl-sm"
                    : "bg-teal-500 text-white rounded-tr-sm"
                }`}>
                  {msg.role === "model" ? formatText(msg.text) : msg.text}

                  {/* أزرار إضافة للسلة عند ظهور ملخص الطلب */}
                  {msg.action === "ready_to_order" && (
                    <div className="mt-3 space-y-2">
                      {/* رفع ملف التصميم */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,.pdf,.ai,.eps,.psd,.png,.jpg,.svg"
                        className="hidden"
                        data-testid="input-design-file"
                        onChange={handleFileChange}
                      />
                      <button
                        data-testid="button-upload-design"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadMutation.isPending}
                        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl w-full justify-center border transition-all ${
                          uploadedUrl
                            ? "bg-green-50 border-green-300 text-green-700"
                            : "bg-gray-50 border-gray-300 text-gray-600 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-700"
                        }`}
                      >
                        {uploadMutation.isPending ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جاري رفع الملف...</>
                        ) : uploadedUrl ? (
                          <><CheckCircle2 className="w-3.5 h-3.5" /> تم رفع ملف التصميم ✓</>
                        ) : (
                          <><Paperclip className="w-3.5 h-3.5" /> إرفاق ملف التصميم (اختياري)</>
                        )}
                      </button>
                      {designFile && !uploadedUrl && !uploadMutation.isPending && (
                        <p className="text-xs text-gray-400 text-center">{designFile.name}</p>
                      )}

                      {/* زر إضافة للسلة */}
                      {addedToCart ? (
                        <button
                          data-testid="button-go-to-cart"
                          onClick={() => setLocation("/cart")}
                          className="flex items-center gap-1.5 bg-green-600 text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-green-700 w-full justify-center"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          الذهاب للسلة لإتمام الطلب
                        </button>
                      ) : (
                        <button
                          data-testid="button-add-to-cart"
                          onClick={() => addToCartMutation.mutate()}
                          disabled={addToCartMutation.isPending || uploadMutation.isPending}
                          className="flex items-center gap-1.5 bg-teal-600 text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-teal-700 w-full justify-center disabled:opacity-60"
                        >
                          {addToCartMutation.isPending ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جاري الإضافة...</>
                          ) : (
                            <><ShoppingCart className="w-3.5 h-3.5" /> أضف للسلة 🛒</>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* مؤشر الكتابة */}
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

          {/* شريط رفع ملف التصميم — يظهر في أي وقت بعد بدء المحادثة */}
          {hasOrderSummary && (
            <div className="border-t border-teal-100 px-3 py-2 bg-teal-50 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs text-teal-700">
                {uploadedUrl ? (
                  <><CheckCircle2 className="w-3.5 h-3.5 text-green-600" /><span className="text-green-700">ملف التصميم مرفق</span></>
                ) : (
                  <><Paperclip className="w-3.5 h-3.5" /><span>لديك ملف تصميم جاهز؟</span></>
                )}
              </div>
              {uploadedUrl ? (
                <button
                  onClick={() => { setUploadedUrl(null); setDesignFile(null); }}
                  className="text-xs text-red-400 hover:text-red-600 flex items-center gap-0.5"
                >
                  <X className="w-3 h-3" /> إزالة
                </button>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadMutation.isPending}
                  className="text-xs bg-white border border-teal-300 text-teal-700 px-2 py-1 rounded-lg hover:bg-teal-100 transition-all"
                >
                  {uploadMutation.isPending ? "جاري الرفع..." : "ارفع الملف"}
                </button>
              )}
            </div>
          )}

          {/* اختيار نوع المنتج */}
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

          {/* ردود سريعة */}
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

          {/* حقل الإدخال */}
          <div className="border-t border-gray-100 px-3 py-2.5 bg-white">
            <div className="flex items-center gap-2">
              <Input
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
