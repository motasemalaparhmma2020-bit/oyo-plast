import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

function urlBase64ToUint8Array(b64: string): Uint8Array {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const isSupported =
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

export function usePushNotifications(enabled = true) {
  const [permission, setPermission] = useState<NotificationPermission>(
    isSupported ? Notification.permission : "denied",
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: vapidData } = useQuery<{ publicKey: string }>({
    queryKey: ["/api/push/vapid-key"],
    enabled: isSupported && enabled,
    staleTime: Infinity,
    retry: false,
  });

  useEffect(() => {
    if (!isSupported || !enabled) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setIsSubscribed(!!sub))
      .catch(() => {});
  }, [enabled]);

  const subscribe = async (): Promise<boolean> => {
    if (!isSupported) { setError("المتصفح لا يدعم الإشعارات"); return false; }
    if (!vapidData?.publicKey) { setError("لم يتمكن الخادم من توليد مفتاح التشفير"); return false; }
    setIsLoading(true);
    setError(null);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") { setError("لم تُمنح صلاحية الإشعارات"); return false; }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey),
      });

      const json = sub.toJSON() as any;
      await apiRequest("POST", "/api/push/subscribe", {
        endpoint: json.endpoint,
        keys: { auth: json.keys.auth, p256dh: json.keys.p256dh },
      });
      setIsSubscribed(true);
      return true;
    } catch (e: any) {
      setError(e?.message || "فشل الاشتراك في الإشعارات");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribe = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await apiRequest("DELETE", "/api/push/subscribe", { endpoint });
      }
      setIsSubscribed(false);
    } catch (e: any) {
      setError(e?.message || "فشل إلغاء الاشتراك");
    } finally {
      setIsLoading(false);
    }
  };

  return { isSupported, permission, isSubscribed, isLoading, error, subscribe, unsubscribe };
}
