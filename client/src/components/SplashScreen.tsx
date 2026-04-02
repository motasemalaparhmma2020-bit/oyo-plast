import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLogoSettings } from "@/hooks/use-logo-settings";
import oyoLogo from "@assets/FB_IMG_1748731871206_1766877101101.jpg";

const SPLASH_KEY = "oyo-splash-v2";

export function SplashScreen() {
  const { data: settings, isLoading } = useLogoSettings();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    // Only show once per session
    const alreadyShown = sessionStorage.getItem(SPLASH_KEY);
    if (!alreadyShown && settings?.showSplash !== false) {
      setShow(true);
      sessionStorage.setItem(SPLASH_KEY, "1");
      const timer = setTimeout(() => setShow(false), 2800);
      return () => clearTimeout(timer);
    }
  }, [isLoading, settings]);

  const logoSrc = settings?.logoUrl || oyoLogo;
  const bgColor = settings?.splashBgColor || "#1565C0";
  const bgImage = settings?.splashBgUrl;
  const storeText = settings?.splashText || "أويو بلاست";
  const textColor = settings?.splashTextColor || "#ffffff";

  // Determine if bg is dark enough for white text
  const useLightText = bgImage || bgColor.startsWith("#1") || bgColor.startsWith("#0") || bgColor.startsWith("#2");

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
          style={{
            backgroundColor: bgColor,
            backgroundImage: bgImage ? `url(${bgImage})` : `linear-gradient(145deg, ${bgColor}, ${bgColor}cc)`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
          onClick={() => setShow(false)}
          data-testid="splash-screen"
        >
          {/* Overlay if bg image */}
          {bgImage && (
            <div className="absolute inset-0 bg-black/40" />
          )}

          <div className="relative z-10 flex flex-col items-center gap-6">
            {/* Logo */}
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
              className="w-40 h-40 md:w-52 md:h-52 rounded-3xl overflow-hidden bg-white shadow-2xl flex items-center justify-center p-3 border-4 border-white/30"
            >
              <img
                src={logoSrc}
                alt="أويو بلاست"
                className="w-full h-full object-contain"
                data-testid="img-splash-logo"
              />
            </motion.div>

            {/* Store Name */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.5 }}
              className="text-center"
              dir="rtl"
            >
              <h1
                className="text-3xl md:text-4xl font-extrabold drop-shadow-lg"
                style={{ color: bgImage ? "#ffffff" : textColor }}
              >
                {storeText}
              </h1>
              <p
                className="text-base mt-2 font-medium opacity-80"
                style={{ color: bgImage ? "#f0f0f0" : textColor }}
              >
                مستلزمات التغليف الاحترافية
              </p>
            </motion.div>

            {/* Loading dots */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="flex gap-2 mt-4"
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: bgImage ? "#ffffff" : textColor }}
                  animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </motion.div>

            <p className="text-xs opacity-40 mt-2" style={{ color: bgImage ? "#ffffff" : textColor }}>
              اضغط للتخطي
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
