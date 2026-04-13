import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { runMigrations } from "./migrate";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import { generalLimiter, sanitizeInputs } from "./security";

const app = express();
const httpServer = createServer(app);

// ══ Security Headers (Helmet) ══════════════════════════════════════════
app.use(helmet({
  contentSecurityPolicy: false, // نعطّله لأن Vite يحتاج مرونة في dev
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
}));

// ══ Rate Limiting العام ════════════════════════════════════════════════
app.use("/api", generalLimiter);

// ══ تنظيف المدخلات من XSS ════════════════════════════════════════════
app.use(sanitizeInputs);

// Get directory name - use process.cwd() for production compatibility
const rootDir = process.cwd();

// Serve attached_assets for product images (using /uploaded-assets to avoid conflict with Vite's /assets)
app.use('/uploaded-assets', express.static(path.resolve(rootDir, 'attached_assets')));

// Serve uploaded product images
app.use('/products', express.static(path.resolve(rootDir, 'public', 'products')));

// Serve admin-uploaded images (persistent across deploys)
app.use('/uploads', express.static(path.resolve(rootDir, 'public', 'uploads')));

// ── ضغط تلقائي لصور /assets/ ────────────────────────────────────────────────
// يعترض طلبات الصور من attached_assets/ ويُرسل نسخة مضغوطة بدلاً من الملف الكامل
app.get('/assets/:filename(*)', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { filename } = req.params;
    // قبول فقط صيغ الصور الشائعة
    if (!/\.(jpe?g|png|webp|gif)$/i.test(filename)) return next();

    const filePath = path.resolve(rootDir, 'attached_assets', filename);
    if (!fs.existsSync(filePath)) return next();

    // حجم الصورة المطلوبة من query param ?w=N أو افتراضي 400px
    const w = Math.min(parseInt(String(req.query.w || '400'), 10) || 400, 1200);

    const sharp = (await import('sharp')).default;
    const buffer = await sharp(filePath)
      .resize(w, w, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 75, progressive: true })
      .toBuffer();

    res.set({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Image-Optimized': 'true',
    });
    res.send(buffer);
  } catch {
    next();
  }
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "50mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

async function startServer() {
  const port = parseInt(process.env.PORT || "5000", 10);

  try {
    // Log startup
    console.log("[INFO] Starting Oyo Plast server...");
    console.log(`[INFO] Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`[INFO] Database: ${process.env.DATABASE_URL ? "configured" : "not configured"}`);
    console.log(`[INFO] Port: ${port}`);

    // Add health check endpoint BEFORE listening
    app.get("/health", (_req, res) => {
      res.json({ status: "ok", timestamp: new Date().toISOString() });
    });

    // ── حارس مؤقت: أثناء التهيئة يُعيد JSON بدل HTML لأي /api/* ──
    let serverReady = false;
    app.use("/api", (req, res, next) => {
      if (serverReady) return next();
      res.status(503).json({
        message: "الخادم يتهيأ، أعد المحاولة بعد ثوانٍ.",
        code: "SERVER_STARTING",
      });
    });

    // Start listening FIRST - this is critical for deployment health checks
    await new Promise<void>((resolve, reject) => {
      httpServer.listen(
        {
          port,
          host: "0.0.0.0",
          reusePort: true,
        },
        () => {
          console.log(`[SUCCESS] Server listening on port ${port}`);
          console.log(`[SUCCESS] Health check available at http://0.0.0.0:${port}/health`);
          resolve();
        }
      );

      httpServer.on("error", (error: any) => {
        console.error(`[ERROR] Failed to listen on port ${port}:`, error.message);
        reject(error);
      });
    });

    // Run DB migrations at runtime (not build time)
    await runMigrations();

    // Now initialize routes
    console.log("[INFO] Registering routes...");
    await registerRoutes(httpServer, app);
    console.log("[SUCCESS] Routes registered");

    // ── بدء خدمة النسخ الاحتياطي التلقائي ──────────────────────────────
    try {
      const { startAutoCron } = await import("./backup-service");
      startAutoCron();
      console.log("[SUCCESS] Auto backup cron service started");
    } catch (err: any) {
      console.warn("[WARN] Could not start backup cron:", err.message);
    }

    // ── أطلق الحارس المؤقت: المسارات جاهزة ──
    serverReady = true;

    // Error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      console.error(`[ERROR] ${status}: ${message}`);
      res.status(status).json({ message });
    });

    // Setup static files or vite
    if (process.env.NODE_ENV === "production") {
      console.log("[INFO] Setting up production static file serving...");
      serveStatic(app);
      console.log("[SUCCESS] Static file serving ready");
    } else {
      console.log("[INFO] Setting up Vite development server...");
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
      console.log("[SUCCESS] Vite dev server ready");
    }

    console.log("[SUCCESS] Application ready to accept requests");
    console.log("[INFO] Oyo Plast server is running!");

  } catch (error) {
    console.error("[FATAL] Failed to start server:", error instanceof Error ? error.message : String(error));
    if (error instanceof Error) {
      console.error("[FATAL] Stack trace:", error.stack);
    }
    process.exit(1);
  }
}

// Start the server
startServer().catch((error) => {
  console.error("[FATAL] Unhandled error:", error);
  process.exit(1);
});
