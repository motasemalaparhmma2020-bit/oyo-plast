import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, X, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
    if (isStandalone) { setIsInstalled(true); return; }

    const dismissed = localStorage.getItem("pwa-banner-dismissed");
    if (dismissed) return;

    const iosDevice = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIos(iosDevice);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    if (iosDevice && !isStandalone) {
      setTimeout(() => setShowBanner(true), 3000);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (isIos) return;
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem("pwa-banner-dismissed", "true");
  };

  if (!showBanner || isInstalled) return null;

  return (
    <div
      className="fixed bottom-20 left-3 right-3 z-50 animate-in slide-in-from-bottom-4 duration-300"
      data-testid="pwa-install-banner"
    >
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl shadow-2xl p-4 flex items-center gap-3">
        <div className="flex-shrink-0 bg-white/20 rounded-xl p-2">
          <Smartphone className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">ثبّت تطبيق أويو بلاست</p>
          {isIos ? (
            <p className="text-xs text-blue-100 mt-0.5">
              اضغط على زر المشاركة ثم "أضف إلى الشاشة الرئيسية"
            </p>
          ) : (
            <p className="text-xs text-blue-100 mt-0.5">
              تسوّق بسرعة وسهولة من هاتفك
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!isIos && (
            <Button
              size="sm"
              onClick={handleInstall}
              className="bg-white text-blue-700 hover:bg-blue-50 font-bold text-xs px-3 h-8 rounded-xl"
              data-testid="btn-pwa-install"
            >
              <Download className="h-3 w-3 ml-1" />
              تثبيت
            </Button>
          )}
          <button
            onClick={handleDismiss}
            className="text-white/70 hover:text-white p-1"
            data-testid="btn-pwa-dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
