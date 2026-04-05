import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

if (typeof document !== "undefined") {
  const root = document.documentElement;
  const lock = () => {
    root.style.overscrollBehavior = "none";
    root.style.touchAction = "pan-y";
  };
  lock();
}

try {
  const container = document.getElementById("root");
  if (container) {
    createRoot(container).render(<App />);
  }
} catch (e) {
  console.error("Failed to render app:", e);
}
