import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { X, MessageCircle, ThumbsUp, AlertCircle, Search, Phone } from "lucide-react";

const HIDE_PATHS = ["/printing", "/marketer/dashboard", "/supplier", "/admin", "/staff"];

export function FloatingRobot() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(true);
  const [visible, setVisible] = useState(false);

  // إخفاء في الصفحات المستثناة
  useEffect(() => {
    const hide = HIDE_PATHS.some((p) => location.startsWith(p));
    setVisible(!hide);
  }, [location]);

  // إيقاف النبض بعد 5 ثوانٍ
  useEffect(() => {
    const t = setTimeout(() => setPulse(false), 5000);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  const actions = [
    {
      icon: <AlertCircle className="w-4 h-4" />,
      label: "تقديم شكوى",
      color: "bg-red-50 text-red-600 border-red-200",
      href: "https://wa.me/967000000000?text=لدي شكوى أود الإبلاغ عنها",
      external: true,
    },
    {
      icon: <ThumbsUp className="w-4 h-4" />,
      label: "اقتراح أو فكرة",
      color: "bg-emerald-50 text-emerald-600 border-emerald-200",
      href: "https://wa.me/967000000000?text=لدي اقتراح",
      external: true,
    },
    {
      icon: <MessageCircle className="w-4 h-4" />,
      label: "تواصل مع الدعم",
      color: "bg-blue-50 text-blue-600 border-blue-200",
      href: "https://wa.me/967000000000?text=أحتاج مساعدة",
      external: true,
    },
    {
      icon: <Search className="w-4 h-4" />,
      label: "تصفح الطباعة",
      color: "bg-teal-50 text-teal-600 border-teal-200",
      href: "/printing",
      external: false,
    },
  ];

  return (
    <div className="fixed bottom-24 left-3 z-50 flex flex-col items-start gap-2" dir="rtl">
      {/* Action Buttons */}
      {open && (
        <div className="flex flex-col gap-2 mb-2 animate-in slide-in-from-bottom-2">
          {actions.map((a) => (
            a.external ? (
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
            ) : (
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
            )
          ))}
        </div>
      )}

      {/* Robot Button */}
      <button
        data-testid="button-floating-robot"
        onClick={() => { setOpen(!open); setPulse(false); }}
        className="relative w-14 h-14 rounded-full shadow-xl flex items-center justify-center bg-gradient-to-br from-teal-400 to-cyan-600 text-white hover:scale-110 active:scale-95 transition-all"
        aria-label="مساعد أويو"
      >
        {/* Pulse Ring */}
        {pulse && !open && (
          <span className="absolute inset-0 rounded-full bg-teal-400/50 animate-ping" />
        )}

        {/* Robot SVG Face */}
        {open ? (
          <X className="w-6 h-6" />
        ) : (
          <svg viewBox="0 0 40 40" className="w-9 h-9" fill="none">
            {/* Head */}
            <rect x="6" y="10" width="28" height="22" rx="6" fill="white" fillOpacity="0.9" />
            {/* Antenna */}
            <line x1="20" y1="4" x2="20" y2="10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="20" cy="3.5" r="2" fill="white" />
            {/* Eyes */}
            <circle cx="13.5" cy="19" r="3.5" fill="#06b6d4" />
            <circle cx="26.5" cy="19" r="3.5" fill="#06b6d4" />
            <circle cx="14.5" cy="18" r="1.2" fill="white" />
            <circle cx="27.5" cy="18" r="1.2" fill="white" />
            {/* Smile */}
            <path d="M13 26 Q20 31 27 26" stroke="#06b6d4" strokeWidth="2" fill="none" strokeLinecap="round" />
            {/* Ears */}
            <rect x="2" y="17" width="4" height="8" rx="2" fill="white" fillOpacity="0.7" />
            <rect x="34" y="17" width="4" height="8" rx="2" fill="white" fillOpacity="0.7" />
          </svg>
        )}
      </button>

      {/* Label */}
      {!open && pulse && (
        <div className="absolute -top-8 left-0 bg-gray-800 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap shadow">
          كيف أساعدك؟
          <span className="absolute -bottom-1 left-4 w-2 h-2 bg-gray-800 rotate-45" />
        </div>
      )}
    </div>
  );
}
