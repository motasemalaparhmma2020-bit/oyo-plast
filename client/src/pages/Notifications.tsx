import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Bell, Package, CheckCheck, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Notification } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

export default function Notifications() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    enabled: isAuthenticated,
  });

  const markAsRead = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", "/api/notifications/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <Bell className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold mb-2">الإشعارات</h2>
        <p className="text-muted-foreground mb-4">يرجى تسجيل الدخول لعرض الإشعارات</p>
        <Link href="/auth">
          <Button className="bg-[#2196F3] hover:bg-[#1976D2]" data-testid="button-login-notifications">
            تسجيل الدخول
          </Button>
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2196F3]"></div>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Bell className="h-6 w-6 text-[#2196F3]" />
            <h1 className="text-2xl font-bold">الإشعارات</h1>
            {unreadCount > 0 && (
              <span className="bg-[#2196F3] text-white text-xs px-2 py-1 rounded-full">
                {unreadCount} جديد
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllAsRead.mutate()}
              disabled={markAllAsRead.isPending}
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="h-4 w-4 ml-1" />
              قراءة الكل
            </Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Bell className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">لا توجد إشعارات</h2>
            <p className="text-muted-foreground text-center">
              ستظهر هنا إشعارات الطلبات والعروض الجديدة
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <Card
                key={notification.id}
                className={`p-4 cursor-pointer transition-colors ${
                  !notification.isRead ? "bg-[#2196F3]/5 border-[#2196F3]/20" : ""
                }`}
                onClick={() => !notification.isRead && markAsRead.mutate(notification.id)}
                data-testid={`notification-${notification.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-full ${
                    notification.type === "order" ? "bg-[#2196F3]/10" : "bg-green-100"
                  }`}>
                    {notification.type === "order" ? (
                      <Package className="h-5 w-5 text-[#2196F3]" />
                    ) : (
                      <Bell className="h-5 w-5 text-green-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold">{notification.title}</h3>
                      {!notification.isRead && (
                        <span className="w-2 h-2 bg-[#2196F3] rounded-full"></span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {notification.createdAt && formatDistanceToNow(new Date(notification.createdAt), {
                        addSuffix: true,
                        locale: ar
                      })}
                    </p>
                    {notification.orderId && (
                      <Link href={`/orders`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[#2196F3] p-0 h-auto mt-2"
                          data-testid={`button-view-order-${notification.orderId}`}
                        >
                          عرض الطلب
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
