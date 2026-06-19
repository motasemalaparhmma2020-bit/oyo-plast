/**
 * وكيل المعاينة الاستوديو بالذكاء الاصطناعي
 * AI Studio Preview Engine for OYO PLAST
 * 
 * • Gemini image generation (realistic studio preview with logo + text)
 * • Cloudinary quick overlay (free, instant)
 * • 3 alternative designs
 * • Caching + logging + settings
 */
import { GoogleGenAI } from "@google/genai";
import { pool as dbPool } from "./db";
import crypto from "crypto";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// ─── إعدادات الوكيل ───────────────────────────────────────────────
async function getSettings(): Promise<{
  geminiModel: string;
  firstFreeEnabled: boolean;
  previewFeePrice: number;
  previewFeeCost: number;
  maxAlternatives: number;
  quickPreviewEnabled: boolean;
}> {
  try {
    const r = await dbPool.query(`SELECT * FROM studio_preview_settings WHERE id = 1`);
    const s = r.rows[0];
    if (s) {
      return {
        geminiModel: s.gemini_model || "gemini-2.5-flash-image",
        firstFreeEnabled: s.first_free_enabled !== false,
        previewFeePrice: Number(s.preview_fee_price ?? 100),
        previewFeeCost: Number(s.preview_fee_cost ?? 0),
        maxAlternatives: Number(s.max_alternatives ?? 3),
        quickPreviewEnabled: s.quick_preview_enabled !== false,
      };
    }
  } catch (e: any) {
    console.warn("[Studio Preview] فشل جلب الإعدادات:", e?.message);
  }
  return {
    geminiModel: "gemini-2.5-flash-image",
    firstFreeEnabled: true,
    previewFeePrice: 100,
    previewFeeCost: 0,
    maxAlternatives: 3,
    quickPreviewEnabled: true,
  };
}

// ─── تخزين مؤقت بمفتاح مركّب ────────────────────────────────────────────────────────
function buildCacheKey(
  productImage: string,
  logoUrl: string,
  bagColor: string,
  printColor: string,
  text: string,
  altIndex: number = 0
): string {
  const hash = crypto
    .createHash("sha256")
    .update(`${productImage}|${logoUrl}|${bagColor}|${printColor}|${text}|${altIndex}`)
    .digest("hex")
    .slice(0, 24);
  return `studio_preview_${hash}`;
}

async function getCachedPreview(key: string): Promise<string | null> {
  try {
    const r = await dbPool.query(
      `SELECT generated_image_url FROM studio_preview_logs WHERE status = 'cached' AND logo_url = $1 ORDER BY created_at DESC LIMIT 1`,
      [key]
    );
    return r.rows[0]?.generated_image_url || null;
  } catch {
    return null;
  }
}

// ─── رفع صورة لـ Cloudinary ───────────────────────────────────────────────────────────────────
async function uploadImageToCloudinary(base64Data: string, folder: string): Promise<string> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary not configured");
  }
  const { v2: cloudinary } = await import("cloudinary");
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });

  const dataUrl = base64Data.startsWith("data:") ? base64Data : `data:image/png;base64,${base64Data}`;
  const uploadRes: any = await cloudinary.uploader.upload(dataUrl, {
    folder,
    resource_type: "image",
    transformation: [{ quality: "auto:good", fetch_format: "auto", width: 1200, crop: "limit" }],
  });
  return uploadRes.secure_url;
}

// ─── تحميل صورة من رابط وتحويلها لـ base64 ───────────────────────────────────
async function fetchImageAsBase64(url: string): Promise<string> {
  try {
    const res = await fetch(url, { timeout: 15000 } as any);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get("content-type") || "image/jpeg";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch (e: any) {
    throw new Error(`فشل تحميل الصورة: ${e?.message}`);
  }
}

// ─── إنشاء برومبت محادثة Gemini لتوليد صورة ───────────────────────────────────────────
async function generateStudioImage(params: {
  productImageBase64: string;
  logoBase64: string;
  bagColor?: string;
  printColor?: string;
  textContent?: string;
  businessType?: string;
  modelName: string;
  altIndex: number;
}): Promise<{ base64: string; modelUsed: string; timeMs: number }> {
  if (!ai) throw new Error("GEMINI_API_KEY not configured");

  const {
    productImageBase64,
    logoBase64,
    bagColor = "#FFFFFF",
    printColor = "#000000",
    textContent = "",
    businessType = "محل",
    modelName,
    altIndex,
  } = params;

  const start = Date.now();

  // نماذج توليد الصور — gemini-2.5-flash-image هو النموذج الوحيد المدعوم حالياً
  const models = Array.from(new Set([modelName, "gemini-2.5-flash-image"]));
  let lastError: any = null;

  const altStyles = [
    "تصميم احترافي محترف بألوان جريئة وتخطيط تجاري بارز",
    "تصميم بألوان فاتحة وباهتة وعصرية",
    "تصميم حديث بألوان باستل وتخطيط مبسط محافظ",
  ];
  const styleHint = altStyles[altIndex % altStyles.length] || altStyles[0];

  const prompt = `يمكنك إنشاء صورة استوديو واقعية لـ ${businessType} في اليمن،
عملاً من خلال وضع شعار المحل (في الصورة الثانية)
في منتصف الكيس على كلاه (واجهه وخلفه)،
بلون كيس ${bagColor} ولون طباعة ${printColor}.

النص المراد إدراجه: "${textContent}"

التصميم: ${styleHint}

المتطلبات:
- صورة واقعية واحترافية للكيس
- واجه وخلف للكيس في المنتصف
- شعار المحل واالنص موضعين بشكل منظم في منتصف الكيس
- خلفية واجهة ومستوياة في خلفية واجهة
- بائعة من ورقة بلاستيكية الكيس
- فاوصة رائعة، إضاءة جيدة، بيئة يمنية
- لا تجعل نص في الصورة من فضلك، ولا تخلف شعار المحل، ولا تجعل وهجي
`;

  for (const model of models) {
    try {
      const result = await ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              { inlineData: { mimeType: "image/jpeg", data: productImageBase64.split(",")[1] } },
              { inlineData: { mimeType: "image/png", data: logoBase64.split(",")[1] } },
            ],
          },
        ],
        config: {
          temperature: 0.7,
          maxOutputTokens: 2048,
          responseModalities: ["TEXT", "IMAGE"],
        },
      });

      // Extract image from response
      const parts = result?.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find((p: any) => p.inlineData?.data);
      if (imagePart?.inlineData?.data) {
        return {
          base64: imagePart.inlineData.data,
          modelUsed: model,
          timeMs: Date.now() - start,
        };
      }
      // Fallback: if text response suggests it generated an image but didn't return it
      const textPart = parts.find((p: any) => p.text);
      if (textPart?.text && textPart.text.includes("صورة")) {
        console.warn("[Studio Preview] النموذج رد بنص فقط لـ", model);
      }
    } catch (e: any) {
      lastError = e;
      console.warn(`[Studio Preview] فشل ${model}: ${String(e?.message || e).slice(0, 120)}`);
    }
  }

  throw new Error(`فشلت جميع النماذج: ${String(lastError?.message || lastError).slice(0, 200)}`);
}

// ─── المعاينة السريعة عبر Cloudinary overlay ────────────────────────────────────────
function buildQuickPreviewUrl(
  productImageUrl: string,
  logoUrl: string,
  bagColor?: string,
  text?: string,
  printColor?: string
): string {
  // Transform product image to the bag color via Cloudinary
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) return productImageUrl;

  // Extract public_id from a Cloudinary URL
  const match = productImageUrl.match(/\/image\/upload\/(?:v\d+\/)?([^\/]+)\/([^\/]+)$/);
  if (!match) return productImageUrl;
  const folder = match[1];
  const publicId = match[2];
  const fullId = `${folder}/${publicId}`;

  const overlays: string[] = [];

  // 1. Color replacement (if bagColor provided)
  if (bagColor) {
    const hex = bagColor.replace("#", "");
    overlays.push(`e_replace_color:${hex}:60:ffffff`);
  }

  // 2. Logo overlay (centered)
  if (logoUrl) {
    const encodedLogo = encodeURIComponent(logoUrl);
    overlays.push(`l_fetch:${encodedLogo},w_120,h_120,c_fit,g_center,o_90`);
  }

  // 3. Text overlay
  if (text) {
    const encodedText = encodeURIComponent(text.slice(0, 30)); // limit length
    const color = printColor?.replace("#", "") || "000000";
    overlays.push(`l_text:Cairo_20_bold:${encodedText},co_${color},g_south,y_20`);
  }

  const chain = overlays.join(",");
  return `https://res.cloudinary.com/${cloudName}/image/upload/${chain}/${fullId}`;
}

// ─── تسجيل عملية المعاينة ───────────────────────────────────────────────────────────────────────
async function logPreview(data: {
  userId?: string;
  productId?: number;
  productName?: string;
  logoUrl?: string;
  productImageUrl?: string;
  bagColor?: string;
  printColor?: string;
  textContent?: string;
  businessType?: string;
  generatedImageUrl?: string;
  alternatives?: string;
  isQuickPreview?: boolean;
  modelUsed?: string;
  generationTimeMs?: number;
  status?: string;
  errorMessage?: string;
}): Promise<void> {
  try {
    await dbPool.query(
      `
      INSERT INTO studio_preview_logs (
        user_id, product_id, product_name, logo_url, product_image_url,
        bag_color, print_color, text_content, business_type,
        generated_image_url, alternatives, is_quick_preview, model_used,
        generation_time_ms, status, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `,
      [
        data.userId || null,
        data.productId || null,
        data.productName || null,
        data.logoUrl || null,
        data.productImageUrl || null,
        data.bagColor || null,
        data.printColor || null,
        data.textContent || null,
        data.businessType || null,
        data.generatedImageUrl || null,
        data.alternatives || null,
        data.isQuickPreview || false,
        data.modelUsed || null,
        data.generationTimeMs || null,
        data.status || "success",
        data.errorMessage || null,
      ]
    );
  } catch (e: any) {
    console.warn("[Studio Preview] فشل تسجيل السجل:", e?.message);
  }
}

// ─── الواجهة الرئيسية التي تشجعها النقاط النهائية ─────────────────────────────────────────────────────────────────────
export async function generateStudioPreview(params: {
  productImageUrl: string;
  logoUrl: string;
  bagColor?: string;
  printColor?: string;
  textContent?: string;
  businessType?: string;
  userId?: string;
  productId?: number;
  productName?: string;
  altIndex?: number;
}): Promise<{
  imageUrl: string;
  modelUsed: string;
  timeMs: number;
  wasCached: boolean;
}> {
  const {
    productImageUrl,
    logoUrl,
    bagColor,
    printColor,
    textContent,
    businessType,
    userId,
    productId,
    productName,
    altIndex = 0,
  } = params;

  const settings = await getSettings();
  const cacheKey = buildCacheKey(productImageUrl, logoUrl, bagColor || "", printColor || "", textContent || "", altIndex);

  // Check cache
  const cached = await getCachedPreview(cacheKey);
  if (cached) {
    await logPreview({
      userId, productId, productName, logoUrl, productImageUrl,
      bagColor, printColor, textContent, businessType,
      generatedImageUrl: cached, isQuickPreview: false,
      status: "cached", modelUsed: "cached",
    });
    return { imageUrl: cached, modelUsed: "cached", timeMs: 0, wasCached: true };
  }

  // Generate image
  const productBase64 = await fetchImageAsBase64(productImageUrl);
  const logoBase64 = await fetchImageAsBase64(logoUrl);

  const result = await generateStudioImage({
    productImageBase64: productBase64,
    logoBase64,
    bagColor,
    printColor,
    textContent,
    businessType,
    modelName: settings.geminiModel,
    altIndex,
  });

  // Upload to Cloudinary
  const imageUrl = await uploadImageToCloudinary(
    `data:image/png;base64,${result.base64}`,
    "oyo-plast/studio-previews"
  );

  await logPreview({
    userId, productId, productName, logoUrl, productImageUrl,
    bagColor, printColor, textContent, businessType,
    generatedImageUrl: imageUrl, isQuickPreview: false,
    modelUsed: result.modelUsed, generationTimeMs: result.timeMs,
    status: "success",
  });

  return { imageUrl, modelUsed: result.modelUsed, timeMs: result.timeMs, wasCached: false };
}

export async function generateQuickPreview(params: {
  productImageUrl: string;
  logoUrl: string;
  bagColor?: string;
  printColor?: string;
  textContent?: string;
}): Promise<{ url: string }> {
  const { productImageUrl, logoUrl, bagColor, printColor, textContent } = params;
  const url = buildQuickPreviewUrl(productImageUrl, logoUrl, bagColor, textContent, printColor);
  return { url };
}

export async function generateAlternatives(params: {
  productImageUrl: string;
  logoUrl: string;
  bagColor?: string;
  printColor?: string;
  textContent?: string;
  businessType?: string;
  userId?: string;
  productId?: number;
  productName?: string;
}): Promise<{ urls: string[]; models: string[]; times: number[] }> {
  const settings = await getSettings();
  const maxAlt = Math.min(settings.maxAlternatives, 3);
  const results: string[] = [];
  const models: string[] = [];
  const times: number[] = [];

  for (let i = 0; i < maxAlt; i++) {
    try {
      const r = await generateStudioPreview({ ...params, altIndex: i });
      results.push(r.imageUrl);
      models.push(r.modelUsed);
      times.push(r.timeMs);
    } catch (e: any) {
      console.warn(`[Studio Preview] فشل التصميم البديل ${i}:`, e?.message);
    }
  }

  return { urls: results, models, times };
}

export async function getPreviewLogs(limit: number = 50, offset: number = 0): Promise<any[]> {
  const r = await dbPool.query(
    `SELECT * FROM studio_preview_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return r.rows;
}

export async function getPreviewStats(): Promise<{
  totalGenerated: number;
  totalQuick: number;
  totalFailed: number;
  avgTimeMs: number;
}> {
  const r = await dbPool.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'success') as total_generated,
      COUNT(*) FILTER (WHERE is_quick_preview = true) as total_quick,
      COUNT(*) FILTER (WHERE status = 'failed') as total_failed,
      AVG(generation_time_ms) FILTER (WHERE status = 'success') as avg_time_ms
    FROM studio_preview_logs
  `);
  const row = r.rows[0];
  return {
    totalGenerated: Number(row?.total_generated || 0),
    totalQuick: Number(row?.total_quick || 0),
    totalFailed: Number(row?.total_failed || 0),
    avgTimeMs: Math.round(Number(row?.avg_time_ms || 0)),
  };
}

export async function updateSettings(data: {
  geminiModel?: string;
  firstFreeEnabled?: boolean;
  previewFeePrice?: number | string;
  previewFeeCost?: number | string;
  maxAlternatives?: number;
  quickPreviewEnabled?: boolean;
}): Promise<void> {
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;
  if (data.geminiModel !== undefined) { fields.push(`gemini_model = $${idx++}`); values.push(data.geminiModel); }
  if (data.firstFreeEnabled !== undefined) { fields.push(`first_free_enabled = $${idx++}`); values.push(data.firstFreeEnabled); }
  if (data.previewFeePrice !== undefined) { fields.push(`preview_fee_price = $${idx++}`); values.push(data.previewFeePrice); }
  if (data.previewFeeCost !== undefined) { fields.push(`preview_fee_cost = $${idx++}`); values.push(data.previewFeeCost); }
  if (data.maxAlternatives !== undefined) { fields.push(`max_alternatives = $${idx++}`); values.push(data.maxAlternatives); }
  if (data.quickPreviewEnabled !== undefined) { fields.push(`quick_preview_enabled = $${idx++}`); values.push(data.quickPreviewEnabled); }
  if (fields.length === 0) return;
  fields.push(`updated_at = NOW()`);
  await dbPool.query(
    `UPDATE studio_preview_settings SET ${fields.join(", ")} WHERE id = 1`,
    values
  );
}

export { getSettings };
