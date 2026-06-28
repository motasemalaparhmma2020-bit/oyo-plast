import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { mockupPreviewPlugin } from "./mockupPreviewPlugin";

// Read environment values but be tolerant in CI/production builds.
const rawPort = process.env.PORT;
// If PORT is provided, parse it; otherwise leave undefined for Vite to pick a default in CI.
const port = rawPort ? Number(rawPort) : undefined;

// Validate only when a value is provided or when running in non-production (dev) environments.
if (rawPort && (Number.isNaN(port as number) || (port as number) <= 0)) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Require PORT in development to catch configuration mistakes early, but allow omission in production/CI.
if (!rawPort && process.env.NODE_ENV !== "production") {
  throw new Error("PORT environment variable is required but was not provided.");
}

// Allow a sensible default for BASE_PATH in production (root '/') while enforcing it in development.
const basePath = process.env.BASE_PATH ?? "/";
if (!process.env.BASE_PATH && process.env.NODE_ENV !== "production") {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

export default defineConfig({
  base: basePath,
  plugins: [
    mockupPreviewPlugin(),
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    // Temporarily disable minification on CI (prevents OOM kills during terser/minify step)
    minify: false,
  },
  optimizeDeps: {
    include: ["react", "react-dom", "lucide-react"],
    force: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
