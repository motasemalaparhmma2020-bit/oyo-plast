import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import oyoLogo from "@assets/FB_IMG_1748731871206_1766877101101.jpg";

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
      setTimeout(onComplete, 500);
    }, 2500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-b from-[#2196F3] to-[#1565C0]"
          data-testid="splash-screen"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ 
              duration: 0.8,
              ease: "easeOut",
              delay: 0.3
            }}
            className="flex flex-col items-center gap-6"
          >
            <div className="w-40 h-40 md:w-56 md:h-56 rounded-full overflow-hidden bg-white shadow-2xl flex items-center justify-center p-4">
              <img 
                src={oyoLogo} 
                alt="OYO PLAST" 
                className="w-full h-full object-contain"
                data-testid="img-splash-logo"
              />
            </div>
            
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="text-center mt-2"
            >
              <h1 className="text-white text-3xl md:text-4xl font-bold mb-2">
                أويو بلاست
              </h1>
              <p className="text-white/90 text-lg md:text-xl font-medium">
                لطباعة ومستلزمات البلاستيك
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="mt-8"
            >
              <div className="flex gap-2">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-3 h-3 rounded-full bg-white"
                    animate={{
                      scale: [1, 1.3, 1],
                      opacity: [0.4, 1, 0.4],
                    }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      delay: i * 0.15,
                    }}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
