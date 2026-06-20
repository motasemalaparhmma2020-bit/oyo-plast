import { useEffect, useRef, useState } from "react";
import { Bell, Package, CheckCheck, Wallet, MessageCircle, Megaphone, Settings, AlertCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { Link, useLocation } from "wouter";
import type { Notification } from "@shared/schema";

function iconForType(type: string) {
  switch (type) {
    case "new_message": return MessageCircle;
    case "commission":
    case "wallet_credit":
    case "payment":
    case "payment_due": return Wallet;
    case "promo": return Megaphone;
    case "system": return AlertCircle;
    default: return Package;
  }
}

function colorForType(type: string) {
  switch (type) {
    case "new_message": return "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400";
    case "commission":
    case "wallet_credit":
    case "payment":
    case "payment_due": return "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400";
    case "promo": return "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400";
    case "system": return "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300";
    default: return "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400";
  }
}

// Short pleasant beep — base64 WAV (~10kb) so we don't ship an asset file.
const BEEP_DATA_URL =
  "data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

export function NotificationBell() {
  const { isAuthenticated, user } = useAuth();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const lastCountRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const role = (user as any)?.role;
  const isStaff = ["owner", "order_manager", "finance", "product_manager", "delivery"].includes(role);

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    enabled: isAuthenticated && open,
  });

  const unreadCount = countData?.count ?? 0;

  // Play sound when count grows
  useEffect(() => {
    if (unreadCount > lastCountRef.current && lastCountRef.current >= 0) {
      try {
        if (!audioRef.current) audioRef.current = new Audio(BEEP_DATA_URL);
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      } catch {}
    }
    lastCountRef.current = unreadCount;
  }, [unreadCount]);

  const markAllRead = useMutation({
    mutationFn: async () => apiRequest("PATCH", "/api/notifications/read-all"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/notifications"] });
      qc.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markOneRead = useMutation({
    mutationFn: async (id: number) => apiRequest("PATCH", `/api/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/notifications"] });
      qc.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  if (!isAuthenticated) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          data-testid="button-notification-bell"
          className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="الإشعارات"
        >
          <Bell className={`h-5 w-5 ${unreadCount > 0 ? "text-[#2196F3]" : "text-gray-600 dark:text-gray-300"}`} />
          {unreadCount > 0 && (
            <span
              data-testid="badge-notification-count"
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        collisionPadding={12}
        className="w-[340px] max-w-[calc(100vw-24px)] p-0 max-h-[480px] overflow-hidden flex flex-col bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl z-[100]"
        dir="rtl"
      >
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-[#2196F3]" />
            <h3 className="font-bold text-sm">الإشعارات{isStaff ? " — الموظفين" : ""}</h3>
            {unreadCount > 0 && (
              <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                data-testid="button-bell-mark-all-read"
              >
                <CheckCheck className="h-3 w-3 ml-1" />
                قراءة الكل
              </Button>
            )}
            <Link href="/notification-settings">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setOpen(false)}
                data-testid="button-bell-settings"
                title="إعدادات الإشعارات"
              >
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">لا توجد إشعارات</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.slice(0, 20).map((n) => {
                const Icon = iconForType(n.type);
                const colorClass = colorForType(n.type);
                const actionUrl = (n as any).actionUrl as string | undefined;
                const priority = (n as any).priority as string | undefined;
                return (
                  <button
                    key={n.id}
                    data-testid={`bell-item-${n.id}`}
                    className={`w-full text-right p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors flex items-start gap-2 ${
                      !n.isRead ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
                    }`}
                    onClick={() => {
                      if (!n.isRead) markOneRead.mutate(n.id);
                      if (actionUrl) {
                        setOpen(false);
                        setLocation(actionUrl);
                      } else if (n.orderId) {
                        setOpen(false);
                        setLocation("/orders");
                      }
                    }}
                  >
                    <div className={`shrink-0 p-1.5 rounded-full ${colorClass}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold truncate">{n.title}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          {priority === "high" && <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />}
                          {!n.isRead && <span className="w-1.5 h-1.5 bg-[#2196F3] rounded-full" />}
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {n.createdAt && formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: ar })}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t p-2">
          <Link href="/notifications">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-[#2196F3]"
              onClick={() => setOpen(false)}
              data-testid="button-bell-view-all"
            >
              عرض كل الإشعارات
            </Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
