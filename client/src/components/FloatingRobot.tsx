import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { X, MessageCircle, ThumbsUp, AlertCircle, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const HIDE_PATHS = ["/printing", "/marketer/dashboard", "/supplier", "/admin", "/staff"];
const STORAGE_POS_KEY = "support_robot_pos";

function pageMatches(pages: string, location: string): boolean {
  if (!pages || pages === "all") return true;
  const list = pages.split(",").map(p => p.trim()).filter(Boolean);
  return list.some(p => location === p || location.startsWith(p + "/") || location.startsWith(p + "?"));
}

export function FloatingRobot() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(true);

  const { data: settings } = useQuery<any>({
    queryKey: ["/api/display-settings"],
    staleTime: 60000,
  });

  // ── موضع العنصر القابل للسحب ─────────────────────────────────────────────
  const getDefaultPos = () => {
    const saved = localStorage.getItem(STORAGE_POS_KEY);
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return null; // null = استخدام CSS الافتراضي (right-4 bottom-36)
  };

  const [pos, setPos] = useState<{ x: number; y: number } | null>(getDefaultPos);
  const dragging = useRef(false);
  const dragOffset = useRef({ dx: 0, dy: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!containerRef.current) return;
    e.preventDefault();
    dragging.current = true;
    const rect = containerRef.current.getBoundingClientRect();
    dragOffset.current = {
      dx: e.clientX - rect.left,
      dy: e.clientY - rect.top,
    };
    containerRef.current.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current || !containerRef.current) return;
    e.preventDefault();
    const W = window.innerWidth;
    const H = window.innerHeight;
    const btnW = containerRef.current.offsetWidth;
    const btnH = containerRef.current.offsetHeight;
    const newX = Math.max(8, Math.min(W - btnW - 8, e.clientX - dragOffset.current.dx));
    const newY = Math.max(8, Math.min(H - btnH - 8, e.clientY - dragOffset.current.dy));
    setPos({ x: newX, y: newY });
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    if (pos) localStorage.setItem(STORAGE_POS_KEY, JSON.stringify(pos));
  }, [pos]);

  // إيقاف النبض بعد 5 ثوانٍ
  useEffect(() => {
    const t = setTimeout(() => setPulse(false), 5000);
    return () => clearTimeout(t);
  }, []);

  const inHidePath = HIDE_PATHS.some(p => location.startsWith(p));
  const showRobot: boolean = settings?.showSupportRobot !== false;
  const pagesOk = pageMatches(settings?.supportRobotPages ?? "all", location);

  if (inHidePath || !showRobot || !pagesOk) return null;

  // نمط الموضع — إما سحب حر أو الافتراضي (يمين/فوق الواتساب)
  const style: React.CSSProperties = pos
    ? { position: "fixed", left: pos.x, top: pos.y, zIndex: 65, touchAction: "none" }
    : { position: "fixed", bottom: 144, right: 16, zIndex: 65, touchAction: "none" };

  const actions = [
    {
      icon: <AlertCircle className="w-4 h-4" />,
      label: "تقديم شكوى",
      color: "bg-red-50 text-red-600 border-red-200",
      href: `https://wa.me/${(settings?.whatsappNumber || "967774997589").replace(/\D/g, "")}?text=${encodeURIComponent("لدي شكوى أود الإبلاغ عنها")}`,
    },
    {
      icon: <ThumbsUp className="w-4 h-4" />,
      label: "اقتراح أو فكرة",
      color: "bg-emerald-50 text-emerald-600 border-emerald-200",
      href: `https://wa.me/${(settings?.whatsappNumber || "967774997589").replace(/\D/g, "")}?text=${encodeURIComponent("لدي اقتراح")}`,
    },
    {
      icon: <MessageCircle className="w-4 h-4" />,
      label: "تواصل مع الدعم",
      color: "bg-blue-50 text-blue-600 border-blue-200",
      href: `https://wa.me/${(settings?.whatsappNumber || "967774997589").replace(/\D/g, "")}?text=${encodeURIComponent("أحتاج مساعدة")}`,
    },
    {
      icon: <Search className="w-4 h-4" />,
      label: "تصفح الطباعة",
      color: "bg-teal-50 text-teal-600 border-teal-200",
      href: "/printing",
      internal: true,
    },
  ];

  return (
    <div
      ref={containerRef}
      style={style}
      className="flex flex-col items-end gap-2 select-none"
      dir="rtl"
    >
      {/* القائمة عند الفتح */}
      {open && (
        <div className="flex flex-col gap-2 mb-2 animate-in slide-in-from-bottom-2">
          {actions.map((a) =>
            a.internal ? (
              <a
                key={a.label}
                href={a.href}
                className={`flex items-center gap-2 border rounded-full px-3 py-2 text-xs font-medium shadow-md bg-white whitespace-nowrap ${a.color} hover:scale-105 transition-transform`}
                data-testid={`robot-action-${a.label}`}
                onClick={() => setOpen(false)}
              >
                {a.icon}
                {a.label}
              </a>
            ) : (
              <a
                key={a.label}
                href={a.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 border rounded-full px-3 py-2 text-xs font-medium shadow-md bg-white whitespace-nowrap ${a.color} hover:scale-105 transition-transform`}
                data-testid={`robot-action-${a.label}`}
              >
                {a.icon}
                {a.label}
              </a>
            )
          )}
        </div>
      )}

      {/* الزر الرئيسي — قابل للسحب */}
      <button
        ref={btnRef}
        data-testid="button-floating-robot"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={(e) => {
          if (dragging.current) { e.preventDefault(); return; }
          setOpen(!open);
          setPulse(false);
        }}
        className="relative w-14 h-14 rounded-full shadow-xl flex items-center justify-center bg-gradient-to-br from-teal-400 to-cyan-600 text-white hover:scale-110 active:scale-95 transition-all cursor-grab active:cursor-grabbing"
        aria-label="مساعد أويو"
        style={{ touchAction: "none" }}
      >
        {pulse && !open && (
          <span className="absolute inset-0 rounded-full bg-teal-400/50 animate-ping" />
        )}
        {/* نقطة السحب */}
        <span className="absolute -top-1 -left-1 w-4 h-4 bg-orange-400 rounded-full border-2 border-white text-[8px] flex items-center justify-center text-white font-bold">
          ✥
        </span>

        {open ? (
          <X className="w-6 h-6" />
        ) : (
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
        )}
      </button>

      {/* تلميح */}
      {!open && pulse && (
        <div className="absolute -top-8 right-0 bg-gray-800 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap shadow pointer-events-none">
          اسحبني أو اضغط للمساعدة
          <span className="absolute -bottom-1 right-4 w-2 h-2 bg-gray-800 rotate-45" />
        </div>
      )}
    </div>
  );
}
