/**
 * Comprehensive Error Handling
 * Centralized error handling with logging and user-friendly messages
 */

import { Response } from "express";
import { logEvent, logOrderError } from "./logger";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational: boolean = true,
    public orderId?: number
  ) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─── Error Types ───────────────────────────────────────────

export class ValidationError extends AppError {
  constructor(message: string, public field?: string) {
    super(400, message, true);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    super(
      404,
      identifier
        ? `${resource} #${identifier} غير موجود`
        : `${resource} غير موجود`,
      true
    );
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "غير مصرح") {
    super(401, message, true);
    this.name = "UnauthorizedError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, true);
    this.name = "ConflictError";
  }
}

export class InternalError extends AppError {
  constructor(message: string = "خطأ داخلي في الخادم", originalError?: Error) {
    super(500, message, true);
    this.name = "InternalError";
    if (originalError) {
      console.error("Internal Error:", originalError);
    }
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service: string) {
    super(503, `${service} غير متاح الآن`, true);
    this.name = "ServiceUnavailableError";
  }
}

// ─── Error Handlers ───────────────────────────────────────────

/**
 * Handle validation errors
 */
export function handleValidationError(
  field: string,
  message: string,
  orderId?: number
): ValidationError {
  logEvent(`Validation Error: ${field}`, "error", { field, message }, orderId);
  return new ValidationError(message, field);
}

export function validateOrderCreation(data: unknown): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!data || typeof data !== "object") {
    return { valid: false, errors: { form: "بيانات الطلب غير صالحة" } };
  }

  const input = data as Record<string, any>;

  if (!input.customerName) errors.customerName = "اسم العميل مطلوب";
  if (!input.customerEmail) errors.customerEmail = "البريد الإلكتروني مطلوب";
  if (!input.customerPhone) errors.customerPhone = "رقم الهاتف مطلوب";
  if (!input.shippingCity) errors.shippingCity = "المدينة مطلوبة";
  if (!input.shippingAddress) errors.shippingAddress = "العنوان مطلوب";
  if (!Array.isArray(input.items) || input.items.length === 0) errors.items = "السلة فارغة";
  if (input.total === undefined || input.total === null) errors.total = "الإجمالي مطلوب";

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Handle database errors
 */
export function handleDatabaseError(
  error: any,
  orderId?: number
): AppError {
  const isConstraint = error.code === "23505"; // Unique violation
  const isFK = error.code === "23503"; // Foreign key violation

  let message = "خطأ في قاعدة البيانات";

  if (isConstraint) {
    message = "هذا العنصر موجود بالفعل";
  } else if (isFK) {
    message = "خطأ في ربط البيانات";
  }

  logOrderError(orderId, error, { code: error.code });
  return new InternalError(message);
}

/**
 * Handle API errors
 */
export function handleAPIError(
  error: any,
  service: string,
  orderId?: number
): AppError {
  const statusCode = error.statusCode || error.status || 500;
  const message = `${service} خطأ (${statusCode})`;

  logOrderError(
    orderId,
    message,
    { service, statusCode, originalError: error.message }
  );

  if (statusCode >= 500) {
    return new ServiceUnavailableError(service);
  }

  return new InternalError(message);
}

/**
 * Send error response to client
 */
export function sendErrorResponse(
  res: Response,
  error: Error | AppError,
  orderId?: number
): void {
  if (error instanceof AppError) {
    logEvent(
      `Response: ${error.name}`,
      "warn",
      { statusCode: error.statusCode, message: error.message },
      orderId
    );

    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      error: process.env.NODE_ENV === "development" ? error.stack : undefined,
      ...(orderId && { orderId }),
    });
    return;
  }

  // Unknown error
  logEvent(
    "Unexpected Error",
    "error",
    { message: error.message, stack: error.stack },
    orderId
  );

  res.status(500).json({
    success: false,
    message: "خطأ غير متوقع. يرجى المحاولة لاحقاً",
    ...(process.env.NODE_ENV === "development" && { error: error.message }),
    ...(orderId && { orderId }),
  });
}

/**
 * Async error wrapper for routes
 */
export function asyncHandler(
  fn: (req: any, res: Response) => Promise<void>
) {
  return (req: any, res: Response, next: any) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}

// ─── Input Sanitization ───────────────────────────────────────────

/**
 * Sanitize string input
 */
export function sanitizeString(input: any): string {
  if (typeof input !== "string") {
    throw new ValidationError("المدخل يجب أن يكون نصاً");
  }

  return input
    .trim()
    .substring(0, 1000) // Prevent overflow
    .replace(/[<>]/g, ""); // Remove potential HTML
}

/**
 * Sanitize number input
 */
export function sanitizeNumber(
  input: any,
  min: number = 0,
  max: number = 999999999
): number {
  const num = Number(input);

  if (isNaN(num)) {
    throw new ValidationError("المدخل يجب أن يكون رقماً");
  }

  if (num < min || num > max) {
    throw new ValidationError(`الرقم يجب أن يكون بين ${min} و ${max}`);
  }

  return num;
}

/**
 * Sanitize phone number
 */
export function sanitizePhone(input: any): string {
  const phone = sanitizeString(input);

  // Basic validation: 10-15 digits
  if (!/^\+?[0-9]{10,15}$/.test(phone.replace(/[\s\-()]/g, ""))) {
    throw new ValidationError("رقم هاتف غير صحيح");
  }

  return phone;
}

/**
 * Sanitize email
 */
export function sanitizeEmail(input: any): string {
  const email = sanitizeString(input).toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError("بريد إلكتروني غير صحيح");
  }

  return email;
}
