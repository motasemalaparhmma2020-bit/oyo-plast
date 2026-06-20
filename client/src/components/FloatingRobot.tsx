import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { X, Send, Loader2, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const HIDE_PATHS = ["/printing", "/marketer/dashboard", "/supplier", "/admin", "/staff"];
const STORAGE_POS_KEY = "support_robot_pos_v2"; // v2: أُعيد ضبط الموضع لليسار

type ChatMsg = { role: "user" | "assistant"; text: string };

const QUICK_PROMPTS = [
  "ما هي المنتجات المتوفرة؟",
  "كيف أطلب طباعة على منتج؟",
  "ما هي أسعار الشحن؟",
];

function pageMatches(pages: string, location: string): boolean {
  if (!pages || pages === "all") return true;
  const list = pages.split(",").map((p) => p.trim()).filter(Boolean);
  return list.some((p) => location === p || location.startsWith(p + "/") || location.startsWith(p + "?"));
}

export function FloatingRobot() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(true);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const { data: settings } = useQuery<any>({
    queryKey: ["/api/display-settings"],
    staleTime: 60000,
  });

  // ── موضع الزر القابل للسحب (الافتراضي: يسار، فوق منطقة الواتساب) ──────────────
  const getDefaultPos = () => {
    const saved = localStorage.getItem(STORAGE_POS_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return null; // null = استخدام CSS الافتراضي (left-4 bottom-40)
  };

  const [pos, setPos] = useState<{ x: number; y: number } | null>(getDefaultPos);
  const dragging = useRef(false);
  const moved = useRef(false);
  const dragOffset = useRef({ dx: 0, dy: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!containerRef.current) return;
    dragging.current = true;
    moved.current = false;
    const rect = containerRef.current.getBoundingClientRect();
    dragOffset.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    containerRef.current.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current || !containerRef.current) return;
    moved.current = true;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const btnW = containerRef.current.offsetWidth;
    const btnH = containerRef.current.offsetHeight;
    const newX = Math.max(8, Math.min(W - btnW - 8, e.clientX - dragOffset.current.dx));
    const newY = Math.max(8, Math.min(H - btnH - 8, e.clientY - dragOffset.current.dy));
    setPos({ x: newX, y: newY });
  }, []);

  const onPointerUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    if (pos) localStorage.setItem(STORAGE_POS_KEY, JSON.stringify(pos));
  }, [pos]);

  useEffect(() => {
    const t = setTimeout(() => setPulse(false), 5000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, open, sending]);

  const send = useCallback(
    async (text: string) => {
      const msg = text.trim();
      if (!msg || sending) return;
      setDraft("");
      const history = messages.slice(-12);
      setMessages((prev) => [...prev, { role: "user", text: msg }]);
      setSending(true);
      try {
        const res = await fetch("/api/ai/store-assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: msg, history }),
        });
        const data = await res.json().catch(() => ({}));
        const reply =
          data?.reply || "عذراً، حصل خلل مؤقت. حاول مرة أخرى أو تواصل مع خدمة العملاء.";
        setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: "تعذّر الاتصال بالمساعد. تحقّق من الإنترنت وحاول مجدداً." },
        ]);
      } finally {
        setSending(false);
      }
    },
    [messages, sending],
  );

  const inHidePath = HIDE_PATHS.some((p) => location.startsWith(p));
  const showRobot: boolean = settings?.showSupportRobot !== false;
  const pagesOk = pageMatches(settings?.supportRobotPages ?? "all", location);

  if (inHidePath || !showRobot || !pagesOk) return null;

  // موضع الزر — سحب حر أو الافتراضي (يسار / فوق منطقة الواتساب)
  const btnStyle: React.CSSProperties = pos
    ? { position: "fixed", left: pos.x, top: pos.y, zIndex: 65, touchAction: "none" }
    : { position: "fixed", bottom: 160, left: 16, zIndex: 65, touchAction: "none" };

  return (
    <>
      {/* الزر العائم — قابل للسحب */}
      {!open && (
        <div ref={containerRef} style={btnStyle} className="select-none" dir="rtl">
          <button
            data-testid="button-floating-robot"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onClick={() => {
              if (moved.current) return;
              setOpen(true);
              setPulse(false);
            }}
            className="relative w-14 h-14 rounded-full shadow-xl flex items-center justify-center bg-gradient-to-br from-teal-400 to-cyan-600 text-white hover:scale-110 active:scale-95 transition-all"
            aria-label="المساعد الذكي"
            style={{ touchAction: "none" }}
          >
            {pulse && (
              <span className="absolute inset-0 rounded-full bg-teal-400/50 animate-ping" />
            )}
            <svg viewBox="0 0 40 40" className="w-9 h-9" fill="none">
              <rect x="6" y="10" width="28" height="22" rx="6" fill="white" fillOpacity="0.9" />
              <line x1="20" y1="4" x2="20" y2="10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="20" cy="3.5" r="2" fill="white" />
              <circle cx="13.5" cy="19" r="3.5" fill="#06b6d4" />
              <circle cx="26.5" cy="19" r="3.5" fill="#06b6d4" />
              <circle cx="14.5" cy="18" r="1.2" fill="white" />
              <circle cx="27.5" cy="18" r="1.2" fill="white" />
              <path d="M13 26 Q20 31 27 26" stroke="#06b6d4" strokeWidth="2" fill="none" strokeLinecap="round" />
              <rect x="2" y="17" width="4" height="8" rx="2" fill="white" fillOpacity="0.7" />
              <rect x="34" y="17" width="4" height="8" rx="2" fill="white" fillOpacity="0.7" />
            </svg>
          </button>
          {pulse && (
            <div className="absolute -top-8 left-0 bg-gray-800 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap shadow pointer-events-none">
              اسألني عن المنتجات والطباعة
              <span className="absolute -bottom-1 left-4 w-2 h-2 bg-gray-800 rotate-45" />
            </div>
          )}
        </div>
      )}

      {/* لوحة الدردشة — ورقة سفلية مناسبة للجوال */}
      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-[69]"
            onClick={() => setOpen(false)}
            data-testid="overlay-robot-chat"
          />
          <div
            className="fixed inset-x-0 bottom-0 z-[70] bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl flex flex-col max-h-[80vh]"
            dir="rtl"
          >
            {/* الرأس */}
            <div className="bg-gradient-to-l from-teal-500 to-cyan-600 text-white px-4 py-3 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                <div>
                  <div className="font-bold text-sm">مساعد أويو الذكي</div>
                  <div className="text-[10px] opacity-90">يعرف منتجات المتجر ويساعدك في الطلب</div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="hover:bg-white/20 rounded-full p-1.5"
                data-testid="button-close-robot-chat"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* الرسائل */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50 dark:bg-gray-900/40 min-h-[220px]">
              {messages.length === 0 && (
                <div className="text-center py-6">
                  <div className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    مرحباً 👋 أنا مساعدك في متجر أويو بلاست.
                    <br />
                    اسألني عن المنتجات أو الطباعة أو الأسعار.
                  </div>
                  <div className="flex flex-col gap-2">
                    {QUICK_PROMPTS.map((q) => (
                      <button
                        key={q}
                        onClick={() => send(q)}
                        className="text-xs bg-white dark:bg-gray-800 border border-teal-200 dark:border-teal-900 text-teal-700 dark:text-teal-300 rounded-full px-3 py-2 hover:bg-teal-50 transition-colors"
                        data-testid={`robot-quick-${q}`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                      m.role === "user"
                        ? "bg-teal-600 text-white rounded-tr-sm"
                        : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-tl-sm"
                    }`}
                    data-testid={`robot-msg-${i}`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-end">
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-tl-sm px-3 py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* الإدخال */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-2 bg-white dark:bg-gray-900 flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(draft);
                  }
                }}
                placeholder="اكتب سؤالك…"
                rows={1}
                className="flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 max-h-24"
                data-testid="textarea-robot-draft"
              />
              <button
                onClick={() => send(draft)}
                disabled={sending || !draft.trim()}
                className="shrink-0 w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform"
                data-testid="button-robot-send"
                aria-label="إرسال"
              >
                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
