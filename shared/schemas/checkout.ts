/**
 * Checkout Validation Schemas
 * Frontend + Backend validation using Zod
 */

import { z } from "zod";

// ─── Basic Field Schemas ───────────────────────────────────────────

const phoneRegex = /^(009665|9665|\+9665|05|5)(5|0|3|6|4|2|1|8|9)([0-9]{7})$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const phoneSchema = z
  .string()
  .min(1, "رقم الهاتف مطلوب")
  .regex(phoneRegex, "رقم هاتف غير صحيح (استخدم 05XXXXXXXX أو +96605XXXXXXXX)");

export const emailSchema = z
  .string()
  .email("بريد إلكتروني غير صحيح");

export const citySchema = z
  .string()
  .min(1, "اختر المدينة");

export const addressSchema = z
  .string()
  .min(5, "العنوان يجب أن يكون أطول من 4 أحرف")
  .max(500, "العنوان طويل جداً");

export const nameSchema = z
  .string()
  .min(2, "الاسم يجب أن يكون أطول من حرف واحد")
  .max(100, "الاسم طويل جداً")
  .regex(/^[a-zA-Z0-9\u0600-\u06FF\s\-\.]+$/, "الاسم يحتوي على أحرف غير صحيحة");

// ─── Cart Item Schema ───────────────────────────────────────────

export const cartItemSchema = z.object({
  productId: z.number().positive("معرّف المنتج غير صحيح"),
  quantity: z.number().positive("الكمية يجب أن تكون أكبر من صفر"),
  selectedSize: z.string().optional(),
  selectedColor: z.string().optional(),
  customPrinting: z.boolean().optional(),
  designNotes: z.string().optional(),
  designFileUrl: z.string().optional(),
});

export type CartItemInput = z.infer<typeof cartItemSchema>;

// ─── Checkout Form Schema ───────────────────────────────────────────

export const checkoutFormSchema = z.object({
  // Customer Info
  customerName: nameSchema,
  customerEmail: emailSchema,
  customerPhone: phoneSchema,
  
  // Shipping
  shippingCity: citySchema,
  shippingAddress: addressSchema,
  gpsCoordinates: z.string().optional(),
  
  // Payment
  paymentMethod: z.enum(
    ["cash_on_delivery", "digital_wallet"],
    { errorMap: () => ({ message: "اختر طريقة دفع صحيحة" }) }
  ),
  
  // Digital Wallet (if selected)
  selectedWalletId: z.number().optional(),
  purchaseCode: z.string().optional(),
  receiptImageUrl: z.string().optional(),
  
  // Notes
  notes: z
    .string()
    .max(500, "الملاحظات طويلة جداً")
    .optional(),
  
  // Coupon
  couponCode: z.string().optional(),
});

export type CheckoutFormInput = z.infer<typeof checkoutFormSchema>;

// ─── Order Creation Schema (Backend) ───────────────────────────────────────────

export const orderCreationSchema = z.object({
  customerName: nameSchema,
  customerEmail: emailSchema,
  customerPhone: phoneSchema,
  shippingCity: citySchema,
  shippingAddress: addressSchema,
  gpsCoordinates: z.string().optional(),
  paymentMethod: z.enum(["cash_on_delivery", "digital_wallet"]),
  notes: z.string().optional(),
  items: z.array(cartItemSchema).min(1, "السلة لا تحتوي على منتجات"),
  total: z.number().positive("المجموع غير صحيح"),
  shippingCost: z.number().min(0),
  discount: z.number().min(0).default(0),
  
  // Digital wallet fields
  selectedWalletId: z.number().optional(),
  purchaseCode: z.string().optional(),
  receiptImageUrl: z.string().optional(),
  
  // Tracking
  couponCode: z.string().optional(),
});

export type OrderCreationInput = z.infer<typeof orderCreationSchema>;

// ─── Validation Helper Functions ───────────────────────────────────────────

/**
 * Validate checkout form with error handling
 */
export function validateCheckoutForm(
  data: unknown
): { valid: boolean; errors: Record<string, string> } {
  const result = checkoutFormSchema.safeParse(data);
  
  if (result.success) {
    return { valid: true, errors: {} };
  }
  
  const errors: Record<string, string> = {};
  result.error.errors.forEach((err) => {
    const path = err.path.join(".");
    errors[path] = err.message;
  });
  
  return { valid: false, errors };
}

/**
 * Validate order creation with error handling
 */
export function validateOrderCreation(
  data: unknown
): { valid: boolean; errors: Record<string, string> } {
  const result = orderCreationSchema.safeParse(data);
  
  if (result.success) {
    return { valid: true, errors: {} };
  }
  
  const errors: Record<string, string> = {};
  result.error.errors.forEach((err) => {
    const path = err.path.join(".");
    errors[path] = err.message;
  });
  
  return { valid: false, errors };
}

/**
 * Validate phone number
 */
export function isValidPhone(phone: string): boolean {
  return phoneSchema.safeParse(phone).success;
}

/**
 * Validate email
 */
export function isValidEmail(email: string): boolean {
  return emailSchema.safeParse(email).success;
}
