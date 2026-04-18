/**
 * 🛡️ خدمة النسخ الاحتياطي التلقائي — أويو بلاست
 * نظام من 5 طبقات: لحظي · ساعي · يومي · أسبوعي · شهري
 * مستوحى من ممارسات: Amazon · Alibaba · Rakuten · Shopify
 */

import cron from "node-cron";
import { pool as dbPool } from "./db";

// ── قائمة جميع الجداول ─────────────────────────────────────────────────────
const ALL_TABLES = [
  "users","products","categories","subcategories","orders","order_items",
  "reviews","suppliers","team_members","banners","offers","settings",
  "display_settings","navigation_settings","home_sections","home_page_settings",
  "reward_points","points_transactions","wallets","wallet_transactions",
  "notifications","user_addresses","wishlist","cart_items",
  "marketer_profiles","marketer_commissions","coupons","attendance",
  "payroll_periods","staff_rate_config","contract_texts","contract_acceptances",
  "installment_plans","supplier_payments","printing_categories",
  "product_costs","backup_settings","backup_logs","order_events",
  // نظام الرسائل الموحّد (مُضافة 2026-04)
  "conversations","messages",
];

// ── دالة إنشاء النسخة الاحتياطية ─────────────────────────────────────────
export async function createBackupSnapshot(
  triggeredBy: "auto" | "admin" | "order_event" | "deploy" = "auto",
  retentionType: "hourly" | "daily" | "monthly" | "event" = "hourly"
): Promise<{ success: boolean; sizeBytes: number; totalRows: number; tablesCount: number }> {
  try {
    const backup: Record<string, any[]> = {};
    let totalRows = 0;
    let successfulTables = 0;

    for (const table of ALL_TABLES) {
      try {
        const r = await dbPool.query(`SELECT * FROM ${table}`);
        backup[table] = r.rows;
        totalRows += r.rows.length;
        successfulTables++;
      } catch {
        backup[table] = [];
      }
    }

    const exportObj = {
      exportedAt: new Date().toISOString(),
      version: "OyoPlast-v2",
      tablesCount: successfulTables,
      totalRows,
      triggeredBy,
      retentionType,
      data: backup,
    };

    const json = JSON.stringify(exportObj);
    const sizeBytes = Buffer.byteLength(json, "utf8");

    // حفظ في backup_snapshots
    await dbPool.query(
      `INSERT INTO backup_snapshots (triggered_by, snapshot_json, size_bytes, tables_count, total_rows, retention_type)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [triggeredBy, json, sizeBytes, successfulTables, totalRows, retentionType]
    );

    // تسجيل في backup_logs
    await dbPool.query(
      `INSERT INTO backup_logs (triggered_by, size_bytes, tables_count, total_rows, retention_type, status)
       VALUES ($1, $2, $3, $4, $5, 'success')`,
      [triggeredBy, sizeBytes, successfulTables, totalRows, retentionType]
    );

    // تنظيف النسخ القديمة (سياسة الاحتفاظ)
    await applyRetentionPolicy();

    // إطلاق webhook خارجي (Google Sheets / Zapier / N8N...)
    await fireWebhook({ triggeredBy, retentionType, sizeBytes, totalRows, tablesCount: successfulTables });

    console.log(`[Backup] ✅ ${retentionType} backup by ${triggeredBy} — ${totalRows} rows, ${(sizeBytes / 1024 / 1024).toFixed(2)} MB`);
    return { success: true, sizeBytes, totalRows, tablesCount: successfulTables };

  } catch (err: any) {
    console.error("[Backup] ❌ Failed:", err.message);
    try {
      await dbPool.query(
        `INSERT INTO backup_logs (triggered_by, status, notes) VALUES ($1, 'failed', $2)`,
        [triggeredBy, err.message]
      );
    } catch {}
    return { success: false, sizeBytes: 0, totalRows: 0, tablesCount: 0 };
  }
}

// ── إطلاق Webhook خارجي (T3) ────────────────────────────────────────────────
async function fireWebhook(summary: {
  triggeredBy: string; retentionType: string;
  sizeBytes: number; totalRows: number; tablesCount: number;
}): Promise<void> {
  try {
    const r = await dbPool.query(`SELECT webhook_url FROM backup_settings WHERE id = 1`);
    const url = r.rows[0]?.webhook_url?.trim();
    if (!url || !/^https?:\/\//i.test(url)) return;

    const payload = {
      event: "backup_completed",
      site: "OyoPlast",
      timestamp: new Date().toISOString(),
      ...summary,
      sizeMB: Number((summary.sizeBytes / 1024 / 1024).toFixed(2)),
    };
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      console.log(`[Backup] 🔔 Webhook fired → ${url.slice(0, 60)}...`);
    } finally { clearTimeout(t); }
  } catch (err: any) {
    console.error("[Backup] Webhook error:", err.message);
  }
}

// ── سياسة الاحتفاظ (كما تفعل Alibaba و Amazon) ─────────────────────────────
export async function applyRetentionPolicy(): Promise<void> {
  try {
    const settingsRes = await dbPool.query(`SELECT * FROM backup_settings WHERE id = 1`);
    const s = settingsRes.rows[0] || { retention_hourly: 24, retention_daily: 30, retention_monthly: 12 };

    // احتفظ بآخر N نسخة ساعية
    await dbPool.query(`
      DELETE FROM backup_snapshots
      WHERE retention_type = 'hourly'
        AND id NOT IN (
          SELECT id FROM backup_snapshots WHERE retention_type = 'hourly'
          ORDER BY created_at DESC LIMIT $1
        )
    `, [s.retention_hourly]);

    // احتفظ بآخر N نسخة يومية
    await dbPool.query(`
      DELETE FROM backup_snapshots
      WHERE retention_type = 'daily'
        AND id NOT IN (
          SELECT id FROM backup_snapshots WHERE retention_type = 'daily'
          ORDER BY created_at DESC LIMIT $1
        )
    `, [s.retention_daily]);

    // احتفظ بآخر N نسخة شهرية
    await dbPool.query(`
      DELETE FROM backup_snapshots
      WHERE retention_type = 'monthly'
        AND id NOT IN (
          SELECT id FROM backup_snapshots WHERE retention_type = 'monthly'
          ORDER BY created_at DESC LIMIT $1
        )
    `, [s.retention_monthly]);

    // احتفظ بآخر 100 حدث طلب
    await dbPool.query(`
      DELETE FROM order_events
      WHERE id NOT IN (
        SELECT id FROM order_events ORDER BY created_at DESC LIMIT 1000
      )
    `);

  } catch (err: any) {
    console.error("[Backup] Retention policy error:", err.message);
  }
}

// ── تسجيل حدث طلب فوري (T4) ────────────────────────────────────────────────
export async function logOrderEvent(
  orderId: number | null,
  eventType: "created" | "updated" | "cancelled" | "delivered",
  orderData: any
): Promise<void> {
  try {
    await dbPool.query(
      `INSERT INTO order_events (order_id, event_type, snapshot_json)
       VALUES ($1, $2, $3)`,
      [orderId, eventType, JSON.stringify(orderData)]
    );
  } catch (err: any) {
    console.error("[Backup] Order event log error:", err.message);
  }
}

// ── إعداد الـ Cron (T2) ─────────────────────────────────────────────────────
let cronJob: cron.ScheduledTask | null = null;
let dailyCronJob: cron.ScheduledTask | null = null;
let monthlyCronJob: cron.ScheduledTask | null = null;
let lastAutoBackupTime: Date | null = null;
let nextAutoBackupTime: Date | null = null;
let activeIntervalHours: number = 1;

/**
 * يقرأ من backup_settings: auto_backup_enabled + backup_interval_hours
 * يبني تعبير cron مناسب (1=كل ساعة، 2=كل ساعتين، 6=كل 6 س، 24=يومياً)
 */
export async function startAutoCron(): Promise<void> {
  // إيقاف أي جداول سابقة
  for (const j of [cronJob, dailyCronJob, monthlyCronJob]) {
    try { j?.destroy(); } catch {}
  }
  cronJob = null; dailyCronJob = null; monthlyCronJob = null;

  // قراءة الإعدادات من DB
  let enabled = true;
  let interval = 1;
  try {
    const r = await dbPool.query(`SELECT auto_backup_enabled, backup_interval_hours FROM backup_settings WHERE id = 1`);
    if (r.rows[0]) {
      enabled = r.rows[0].auto_backup_enabled !== false;
      interval = Math.max(1, Math.min(24, parseInt(r.rows[0].backup_interval_hours) || 1));
    }
  } catch (e: any) {
    console.warn("[Backup] ⚠️ Could not read settings, using defaults:", e.message);
  }

  if (!enabled) {
    console.log("[Backup] ⏸️ Auto backup is disabled in settings");
    return;
  }

  activeIntervalHours = interval;
  const cronExpr = interval === 1 ? "0 * * * *" : `0 */${interval} * * *`;

  // النسخة الساعية (حسب الفترة المُعدّة)
  cronJob = cron.schedule(cronExpr, async () => {
    lastAutoBackupTime = new Date();
    nextAutoBackupTime = new Date(lastAutoBackupTime.getTime() + activeIntervalHours * 60 * 60 * 1000);
    console.log(`[Backup] 🕐 Auto backup starting (every ${activeIntervalHours}h)...`);
    await createBackupSnapshot("auto", "hourly");
  });

  // النسخة اليومية — مستقلة في منتصف الليل
  dailyCronJob = cron.schedule("0 0 * * *", async () => {
    console.log("[Backup] 🌙 Daily backup starting...");
    await createBackupSnapshot("auto", "daily");
  });

  // النسخة الشهرية — مستقلة في أول كل شهر
  monthlyCronJob = cron.schedule("0 0 1 * *", async () => {
    console.log("[Backup] 📅 Monthly backup starting...");
    await createBackupSnapshot("auto", "monthly");
  });

  // حساب وقت النسخة القادمة
  const now = new Date();
  nextAutoBackupTime = new Date(now);
  nextAutoBackupTime.setMinutes(0, 0, 0);
  // التقريب إلى أقرب فترة مستقبلية
  while (nextAutoBackupTime <= now || nextAutoBackupTime.getHours() % activeIntervalHours !== 0) {
    nextAutoBackupTime.setHours(nextAutoBackupTime.getHours() + 1);
  }

  console.log(`[Backup] ✅ Auto cron started — every ${activeIntervalHours}h — next backup at`, nextAutoBackupTime.toISOString());
}

export function stopAutoCron(): void {
  for (const j of [cronJob, dailyCronJob, monthlyCronJob]) {
    try { j?.destroy(); } catch {}
  }
  cronJob = null; dailyCronJob = null; monthlyCronJob = null;
  console.log("[Backup] ⏹️ Auto cron stopped");
}

export function getBackupStatus() {
  return {
    cronActive: cronJob !== null,
    lastAutoBackup: lastAutoBackupTime?.toISOString() ?? null,
    nextAutoBackup: nextAutoBackupTime?.toISOString() ?? null,
  };
}

// بدء الـ cron تلقائياً عند استيراد الملف
startAutoCron().catch(err => console.error("[Backup] startAutoCron error:", err));
