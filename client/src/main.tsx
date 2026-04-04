import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

try {
  const container = document.getElementById("root");
  if (container) {
    createRoot(container).render(<App />);
  }
} catch (e) {
  console.error("Failed to render app:", e);
}
