/**
 * Logging System for Orders and Notifications
 * Tracks all order and communication events
 */

interface LogEntry {
  timestamp: string;
  orderId?: string | number;
  event: string;
  type: "info" | "error" | "warn" | "success";
  details: Record<string, any>;
}

const logs: LogEntry[] = [];
const MAX_LOGS = 10000; // Keep last 10k logs in memory

/**
 * Log an event
 */
export function logEvent(
  event: string,
  type: "info" | "error" | "warn" | "success" = "info",
  details: Record<string, any> = {},
  orderId?: string | number
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    event,
    type,
    details,
    orderId,
  };

  logs.push(entry);

  // Prevent memory bloat
  if (logs.length > MAX_LOGS) {
    logs.shift();
  }

  // Console output with emoji
  const emoji = {
    info: "ℹ️",
    error: "❌",
    warn: "⚠️",
    success: "✅",
  }[type];

  const prefix = orderId ? `[Order #${orderId}]` : "[System]";
  console.log(
    `${emoji} ${prefix} ${event}`,
    Object.keys(details).length > 0 ? details : ""
  );
}

/**
 * Get logs for specific order
 */
export function getOrderLogs(orderId: string | number): LogEntry[] {
  return logs.filter((log) => log.orderId === orderId);
}

/**
 * Get recent logs
 */
export function getRecentLogs(limit: number = 50): LogEntry[] {
  return logs.slice(-limit);
}

/**
 * Clear all logs (for testing)
 */
export function clearLogs(): void {
  logs.length = 0;
}

/**
 * Export logs to JSON
 */
export function exportLogsToJSON(): string {
  return JSON.stringify(logs, null, 2);
}

// ─── Specific log helpers ───────────────────────────────────────────

export function logOrderCreation(
  orderId: number,
  details: Record<string, any>
): void {
  logEvent("Order Created", "success", details, orderId);
}

export function logOrderError(
  orderId: number | undefined,
  error: Error | string,
  context?: Record<string, any>
): void {
  const message = error instanceof Error ? error.message : String(error);
  logEvent(
    `Order Error: ${message}`,
    "error",
    {
      error: message,
      ...context,
    },
    orderId
  );
}

export function logNotificationAttempt(
  orderId: number,
  channel: string,
  recipient: string,
  status: "pending" | "success" | "failed"
): void {
  logEvent(
    `Notification ${status}: ${channel}`,
    status === "success" ? "success" : status === "failed" ? "error" : "info",
    { channel, recipient, status },
    orderId
  );
}

export function logRetry(
  orderId: number,
  action: string,
  attempt: number,
  maxAttempts: number
): void {
  logEvent(
    `Retry: ${action} (${attempt}/${maxAttempts})`,
    "warn",
    { action, attempt, maxAttempts },
    orderId
  );
}

export function logValidationError(
  field: string,
  error: string,
  value?: any
): void {
  logEvent(
    `Validation Error: ${field}`,
    "error",
    { field, error, value },
    undefined
  );
}

export function logStockCheck(
  productId: number,
  requestedQty: number,
  availableStock: number,
  success: boolean
): void {
  logEvent(
    `Stock Check: Product #${productId}`,
    success ? "success" : "warn",
    { productId, requestedQty, availableStock, success },
    undefined
  );
}
