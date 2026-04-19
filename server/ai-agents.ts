import { GoogleGenAI } from "@google/genai";
import { storage } from "./storage";
import { pool as dbPool } from "./db";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("[AI Agents] ⚠️ GEMINI_API_KEY غير مضبوط - موظف المبيعات معطّل");
}

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// ─── جلب إعدادات الموظف الذكي (مع إنشاء تلقائي إن لم تكن موجودة) ──────────────
async function getAgentSettings() {
  try {
    let r = await dbPool.query(`SELECT * FROM ai_sales_settings WHERE id = 1`);
    if (!r.rows[0]) {
      await dbPool.query(`
        INSERT INTO ai_sales_settings (id) VALUES (1)
        ON CONFLICT (id) DO NOTHING
      `);
      r = await dbPool.query(`SELECT * FROM ai_sales_settings WHERE id = 1`);
      console.log("[AI Agents] ✅ تم إنشاء سجل إعدادات افتراضي تلقائياً");
    }
    return r.rows[0] || null;
  } catch (e: any) {
    console.error("[AI Agents] فشل جلب الإعدادات:", e?.message);
    return null;
  }
}

// ─── حساب الخصم المسموح حسب الكمية ────────────────────────────────────────────
function computeDiscountPercent(qty: number, s: any): number {
  if (qty > s.discount_tier_3_qty) return s.discount_tier_4_percent;
  if (qty > s.discount_tier_2_qty) return s.discount_tier_3_percent;
  if (qty > s.discount_tier_1_qty) return s.discount_tier_2_percent;
  return s.discount_tier_1_percent;
}

// ─── بناء سياق الشحن والتصنيع ─────────────────────────────────────────────────
function buildShippingContext(s: any): string {
  const freeThreshold = Number(s.free_shipping_threshold || 0);
  const freeLine = freeThreshold > 0
    ? `شحن مجاني عند تجاوز ${freeThreshold.toLocaleString("ar-SA")} ريال`
    : `لا يوجد شحن مجاني بشكل افتراضي`;
  return `## طرق الشحن والتوصيل:
- شحن عادي: ${s.shipping_normal_days} أيام عمل، تكلفة ${Number(s.shipping_normal_cost).toLocaleString("ar-SA")} ريال.
- شحن سريع: ${s.shipping_fast_days} أيام عمل، تكلفة ${Number(s.shipping_fast_cost).toLocaleString("ar-SA")} ريال.
- ${freeLine}.
- مدة التصنيع الافتراضية: ${s.manufacturing_days_default} أيام.
- ⏱ إجمالي مدة التسليم = مدة تصنيع المنتج + مدة الشحن.`;
}

// ─── بناء سلّم الخصومات ────────────────────────────────────────────────────────
function buildDiscountContext(s: any): string {
  return `## سلّم الخصومات المعتمد (لا تتجاوزه مطلقاً):
- من 1 إلى ${s.discount_tier_1_qty} قطعة: ${s.discount_tier_1_percent}% خصم.
- من ${s.discount_tier_1_qty + 1} إلى ${s.discount_tier_2_qty} قطعة: ${s.discount_tier_2_percent}% خصم.
- من ${s.discount_tier_2_qty + 1} إلى ${s.discount_tier_3_qty} قطعة: ${s.discount_tier_3_percent}% خصم.
- من ${s.discount_tier_3_qty + 1} قطعة فأكثر: ${s.discount_tier_4_percent}% خصم.
- الحد الأقصى المطلق للخصم (لا يتجاوز تحت أي ظرف): ${s.max_discount_override}%.`;
}

// ─── بناء سياق التسعير الخاص بالألوان والتصميم ────────────────────────────────
function buildPricingExtrasContext(s: any): string {
  const designFee = Number(s.design_fee_per_mockup || 300);
  const colorFee = Number(s.color_price_per_color || 20);
  return `## رسوم إضافية مهمة (احتسبها دائماً):
- رسوم التصميم: ${designFee.toLocaleString("ar-SA")} ريال لكل تصميم/نموذج مبدئي تُقدّمه للعميل في هذا الطلب — أضفها مرةً واحدةً في الطلب (ليس لكل رسالة).
- الطباعة بالألوان: كل لون = ${colorFee.toLocaleString("ar-SA")} ريال × الكمية. مثلاً: 100 قطعة × لونان = ${(100 * colorFee * 2).toLocaleString("ar-SA")} ريال طباعة.
- سعر المنتج: يُؤخذ من الكتالوج أدناه مباشرةً دون تعديل.`;
}

// ─── بناء كتالوج شامل لكل المنتجات النشطة ────────────────────────────────────
async function buildFullCatalogContext(focusProductId?: number, maxItems = 60): Promise<string> {
  try {
    const r = await dbPool.query(`
      SELECT p.id, p.name, p.description, p.price, p.price_sar,
             p.sizes, p.colors, p.size_pricing, p.stock, p.tags,
             p.has_printing_options, p.allow_design_upload, p.printing_price_per_unit,
             p.manufacturing_days, p.has_free_shipping,
             c.name AS category_name, sc.name AS subcategory_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN subcategories sc ON p.subcategory_id = sc.id
      WHERE (p.is_active IS NOT FALSE)
        AND (p.product_status IS NULL OR p.product_status = 'approved')
      ORDER BY (p.id = $1) DESC, p.id DESC
      LIMIT $2
    `, [focusProductId || 0, maxItems]);

    if (r.rows.length === 0) return "## كتالوج المنتجات: لا توجد منتجات حالياً.";

    const lines = r.rows.map((p: any) => {
      let priceStr = `${Number(p.price).toLocaleString("ar-SA")} ر.ي`;
      if (p.size_pricing) {
        try {
          const sp = JSON.parse(p.size_pricing);
          if (Array.isArray(sp) && sp.length) {
            const prices = sp.map((x: any) => Number(x.price)).filter((n: number) => !isNaN(n));
            if (prices.length) {
              const min = Math.min(...prices), max = Math.max(...prices);
              priceStr = min === max
                ? `${min.toLocaleString("ar-SA")} ر.ي`
                : `من ${min.toLocaleString("ar-SA")} إلى ${max.toLocaleString("ar-SA")} ر.ي حسب المقاس`;
            }
          }
        } catch {}
      }
      const sizes = (p.sizes || []).join("، ");
      const colors = (p.colors || []).join("، ");
      const printing = (p.has_printing_options || p.allow_design_upload)
        ? `طباعة مخصصة متاحة${p.printing_price_per_unit ? ` (${Number(p.printing_price_per_unit).toLocaleString("ar-SA")} ر.ي/قطعة)` : ""}`
        : "لا تقبل طباعة";
      const manufacturing = p.manufacturing_days > 0
        ? `تصنيع ${p.manufacturing_days} يوم`
        : "جاهز فوراً";
      const category = [p.category_name, p.subcategory_name].filter(Boolean).join(" › ");
      const freeShip = p.has_free_shipping ? " · شحن مجاني" : "";

      // ─── تحديد المخزون: مفتوح إذا كان المنتج يحمل وسم "مخزون-مفتوح"
      const tags: string[] = p.tags || [];
      const isUnlimited = tags.includes("مخزون-مفتوح") || tags.includes("unlimited-stock");
      const stockStr = isUnlimited ? "مخزون: غير محدود ✅" : `المخزون: ${p.stock ?? "—"}`;

      return `- [#${p.id}] ${p.name}${category ? ` (${category})` : ""}
    السعر: ${priceStr}${freeShip}
    المقاسات: ${sizes || "—"} | الألوان: ${colors || "—"}
    ${stockStr} | ${printing} | ${manufacturing}${p.description ? `
    الوصف: ${String(p.description).slice(0, 120)}` : ""}`;
    }).join("\n");

    const focus = focusProductId ? r.rows.find((p: any) => p.id === focusProductId) : null;
    const header = focus
      ? `## 🎯 المنتج محل النقاش حالياً: [#${focus.id}] ${focus.name}\n\n## الكتالوج الكامل المتاح:`
      : `## كتالوج المنتجات المتاحة الآن (${r.rows.length} منتج):`;

    return `${header}\n${lines}`;
  } catch (err: any) {
    console.error("[AI Catalog]", err.message);
    return "## كتالوج المنتجات: غير متاح مؤقتاً";
  }
}

// ─── آلية البيع الجديدة (عميل مسجّل + إضافة سلة + الموظف يقدّم التصميم) ───────
function buildSalesWorkflow(hasUserProfile: boolean, mockupsShown: number, settings: any): string {
  const designFee = Number(settings.design_fee_per_mockup || 300);
  const colorFee = Number(settings.color_price_per_color || 20);

  const profileNote = hasUserProfile
    ? `⚠️ بيانات العميل محفوظة في النظام (أنظر قسم "بيانات العميل" أدناه) — لا تطلب الاسم أو الجوال أو العنوان منه نهائياً.`
    : `ℹ️ العميل غير مسجّل — اطلب اسمه وجواله فقط (مرةً واحدةً) ثم لا تعد لطلبهما.`;

  const designFeeNote = mockupsShown > 0
    ? `🎨 تم تقديم ${mockupsShown} تصميم في هذه المحادثة — أضف رسوم تصميم: ${(mockupsShown * designFee).toLocaleString("ar-SA")} ريال في الطلب (designFee = ${mockupsShown * designFee}).`
    : `🎨 لم يُقدَّم تصميم حتى الآن (designFee = 0).`;

  return `
## خطوات البيع (اتبعها بالترتيب):

${profileNote}

1. **الاستقبال**: سؤال واحد فقط عن الاحتياج.
2. **الاقتراح**: اذكر منتجاً أو اثنين بسعرهما مباشرةً.
3. **التفصيل**: عند الاختيار اسأل عن المقاس والكمية والألوان — سؤالاً واحداً في كل رسالة.
4. **التصميم**: إذا قبل المنتج طباعة — أرسل request_mockup فوراً وأخبره بالرسوم (${designFee.toLocaleString("ar-SA")} ريال).
5. **الفاتورة**: اعرضها مرةً واحدةً فقط: سعر × كمية + طباعة + تصميم + شحن = الإجمالي.
6. **الإنهاء**: اسأل "هل توافق؟" مرةً واحدةً. عند الموافقة → أضف للسلة وأخبره يتوجه إليها.

${designFeeNote}

## ⛔ محظور تماماً (لا استثناء):
- قول "رفعت طلبك للإدارة" أو "ستتواصل معك الإدارة" أو أي إحالة لمدير أو مسؤول.
- تكرار التأكيدات أو إعادة صياغة ما قاله العميل.
- طرح أكثر من سؤال في رسالة واحدة.
- الوعد بأي خصم خارج سلّم الخصومات.
✅ عند اكتمال الطلب: أضف للسلة مباشرةً ثم قل "تكرم راجع سلتك وأكمل الدفع".

## آلية إضافة الطلب للسلة:
عند موافقة العميل الصريحة، أضف في آخر رسالتك هذا الـ JSON بالضبط:
\`\`\`json
{"action":"add_to_cart","productId":<رقم>,"quantity":<كمية>,"agreedUnitPrice":<سعر القطعة بعد الخصم>,"selectedSize":"<المقاس>","selectedColor":"<اللون>","shippingOption":"<normal أو fast>","colorsCount":<عدد الألوان 0-4>,"colorFeePerUnit":<عدد الألوان × ${colorFee}>,"customPrinting":<true/false>,"designNotes":"<ملاحظات التصميم>","designFileUrl":"<رابط الشعار إن رُفع>","designFee":<رسوم التصميم الإجمالية>,"totalPrice":<الإجمالي كامل>}
\`\`\`

## آلية تقديم النموذج المبدئي:
\`\`\`json
{"action":"request_mockup","productId":<رقم>,"selectedColor":"<اللون>","message":"<رسالة قصيرة>"}
\`\`\`

## أسلوب الكتابة الإلزامي:
- رد من 1-3 أسطر فقط — لا أكثر مطلقاً.
- لهجة يمنية مختصرة (حياك، أبشر، تكرم).
- لا إيموجي.
- أرقام حقيقية من الكتالوج فقط.
`;
}

// ─── استخراج JSON الإجراء من رد المساعد ──────────────────────────────────────
function extractActionJson(text: string): any | null {
  const fenceRegex = /```json\s*([\s\S]*?)\s*```/gi;
  const fenceMatches: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;
  while ((match = fenceRegex.exec(text)) !== null) fenceMatches.push(match);
  for (const m of fenceMatches.reverse()) {
    try {
      const obj = JSON.parse(m[1]);
      if (obj?.action) return obj;
    } catch {}
  }
  const braceMatch = text.match(/\{[^{}]*"action"[^{}]*\}/);
  if (braceMatch) {
    try { return JSON.parse(braceMatch[0]); } catch {}
  }
  return null;
}

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export interface AddToCartData {
  productId: number;
  quantity: number;
  unitPrice: number;
  selectedSize?: string | null;
  selectedColor?: string | null;
  customPrinting: boolean;
  designNotes?: string | null;
  designFileUrl?: string | null;
  printColorCount: number;
  designFee: number;
  shippingOption: string;
  totalBreakdown: string;
}

export interface ChatResponse {
  reply: string;
  addToCartData?: AddToCartData;
  mockupUrl?: string;
  mockupRequest?: { productId: number; selectedColor?: string };
  error?: string;
}

// ─── الدالة الرئيسية ─────────────────────────────────────────────────────────
export async function handleSalesChat(params: {
  history: ChatMessage[];
  message: string;
  productId?: number;
  userId?: string | null;
  uploadedLogoUrl?: string | null;
  userProfile?: {
    name?: string | null;
    phone?: string | null;
    city?: string | null;
    address?: string | null;
  } | null;
  mockupsShownCount?: number;
}): Promise<ChatResponse> {
  if (!ai) {
    return { reply: "عذراً، خدمة المساعد الذكي غير متاحة حالياً. يرجى التواصل مع الإدارة مباشرة.", error: "no_api_key" };
  }

  const settings = await getAgentSettings();
  if (!settings) {
    return { reply: "عذراً، إعدادات الموظف الذكي غير مكتملة. يرجى إبلاغ الإدارة.", error: "no_settings" };
  }
  if (!settings.is_enabled) {
    return { reply: "الموظف الذكي موقوف مؤقتاً من قبل الإدارة. تكرم تواصل معنا مباشرة.", error: "disabled" };
  }

  const catalog = await buildFullCatalogContext(params.productId, settings.max_products_in_context || 60);
  const shipping = buildShippingContext(settings);
  const discounts = buildDiscountContext(settings);
  const pricingExtras = buildPricingExtrasContext(settings);
  const mockupsShown = params.mockupsShownCount || 0;
  const hasUserProfile = !!(params.userProfile?.name || params.userProfile?.phone);
  const salesWorkflow = buildSalesWorkflow(hasUserProfile, mockupsShown, settings);

  // ─── سياق بيانات العميل المسجّل ───────────────────────────────────────────
  let customerContext = "";
  if (params.userProfile && (params.userProfile.name || params.userProfile.phone)) {
    const p = params.userProfile;
    customerContext = `
## بيانات العميل (محفوظة في النظام — استخدمها مباشرةً لا تطلبها):
- الاسم: ${p.name || "—"}
- الجوال: ${p.phone || "—"}
- المدينة: ${p.city || "—"}
- العنوان: ${p.address || "—"}
⚠️ هذه البيانات ستُستخدم تلقائياً عند إضافة الطلب للسلة. لا تطلبها من العميل.`;
  }

  const logoNote = params.uploadedLogoUrl
    ? `\n\n## 🖼️ رفع العميل شعاراً:\nرابط الشعار: ${params.uploadedLogoUrl}\nاعرض له النموذج المبدئي الآن.`
    : "";

  const systemInstruction = `${settings.personality_prompt}

${settings.strict_rules}

${discounts}

${shipping}

${pricingExtras}

${salesWorkflow}

${customerContext}

${catalog}${logoNote}`;

  // Gemini يشترط أن يبدأ التاريخ برسالة user — نحذف أي model في البداية
  const rawHistory = params.history.slice(-16);
  const firstUserIdx = rawHistory.findIndex((m) => m.role === "user");
  const cleanHistory = firstUserIdx >= 0 ? rawHistory.slice(firstUserIdx) : [];

  const contents = [
    ...cleanHistory.map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    })),
    { role: "user" as const, parts: [{ text: params.message }] },
  ];

  const callGemini = async (model: string) => ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction,
      temperature: Number(settings.temperature || 0.6),
      maxOutputTokens: 500,
    },
  });

  // فقط أخطاء الطلب الخاطئ (400 بدون سبب حصة) توقف المحاولات
  const isFatalError = (msg: string) =>
    msg.includes("400") && !msg.includes("quota") && !msg.includes("RESOURCE_EXHAUSTED");

  try {
    let result;
    const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash-latest", "gemini-1.5-pro"];
    let lastError: any = null;
    for (const model of models) {
      try {
        result = await callGemini(model);
        console.log(`[AI Sales] ✅ نجح النموذج: ${model}`);
        break;
      } catch (e: any) {
        const msg = String(e?.message || e || "");
        console.warn(`[AI Sales] ⚠️ فشل ${model}: ${msg.slice(0, 150)}`);
        lastError = e;
        if (isFatalError(msg)) throw e;
      }
    }
    if (!result) throw lastError;

    const replyRaw = result.text || "تكرم، كيف أقدر أساعدك؟";
    const action = extractActionJson(replyRaw);
    let cleanReply = replyRaw.replace(/```json[\s\S]*?```/gi, "").trim();
    if (!cleanReply) cleanReply = "تكرم...";

    const response: ChatResponse = { reply: cleanReply };

    // ─── إجراء: طلب Mockup (الموظف يُقدّمه بنفسه) ─────────────────
    if (action?.action === "request_mockup" && settings.allow_mockup_generation) {
      response.mockupRequest = {
        productId: Number(action.productId),
        selectedColor: action.selectedColor,
      };
    }

    // ─── إجراء: إضافة للسلة (مع حُرّاس الحماية) ────────────────────
    if (action?.action === "add_to_cart" && action.productId && action.quantity) {
      const guardResult = await validateCartAction(action, settings);
      if (!guardResult.ok) {
        console.warn("[AI Sales] ❌ Guard blocked cart:", guardResult.reason);
        cleanReply += `\n\n⚠️ ${guardResult.reason}`;
        response.reply = cleanReply;
        return response;
      }

      const qty = Number(action.quantity);
      const unitPrice = Number(action.agreedUnitPrice);
      const colorsCount = Number(action.colorsCount || 0);
      const colorFee = Number(settings.color_price_per_color || 20);
      const colorFeePerUnit = colorsCount * colorFee;
      const designFee = Number(action.designFee || 0);
      const shippingOption = action.shippingOption === "fast" ? "fast" : "normal";
      const shippingCost = shippingOption === "fast"
        ? Number(settings.shipping_fast_cost)
        : Number(settings.shipping_normal_cost);
      const freeThreshold = Number(settings.free_shipping_threshold || 0);
      const subtotal = qty * (unitPrice + colorFeePerUnit) + designFee;
      const effectiveShip = (freeThreshold > 0 && subtotal >= freeThreshold) ? 0 : shippingCost;
      const total = subtotal + effectiveShip;

      // ملاحظات الفاتورة
      const breakdown = [
        `${qty} قطعة × ${unitPrice.toLocaleString("ar-SA")} ريال`,
        colorsCount > 0 ? `طباعة ${colorsCount} لون × ${colorFee} ريال × ${qty} قطعة = ${(colorsCount * colorFee * qty).toLocaleString("ar-SA")} ريال` : null,
        designFee > 0 ? `رسوم التصميم: ${designFee.toLocaleString("ar-SA")} ريال` : null,
        `الشحن: ${effectiveShip.toLocaleString("ar-SA")} ريال`,
        `الإجمالي: ${total.toLocaleString("ar-SA")} ريال`,
      ].filter(Boolean).join(" | ");

      response.addToCartData = {
        productId: Number(action.productId),
        quantity: qty,
        unitPrice: unitPrice + colorFeePerUnit,
        selectedSize: action.selectedSize || null,
        selectedColor: action.selectedColor || null,
        customPrinting: !!(action.customPrinting || action.designNotes || params.uploadedLogoUrl || colorsCount > 0),
        designNotes: action.designNotes
          ? `${action.designNotes} | ${breakdown}`
          : breakdown,
        designFileUrl: action.designFileUrl || params.uploadedLogoUrl || null,
        printColorCount: colorsCount,
        designFee,
        shippingOption,
        totalBreakdown: breakdown,
      };

      cleanReply += `\n\n🛒 تم تجهيز طلبك بقيمة إجمالية ${total.toLocaleString("ar-SA")} ريال — سيُضاف للسلة تلقائياً، راجع سلتك وأكمل الطلب!`;
      response.reply = cleanReply;
    }

    // ─── حفظ المحادثة في السجل ─────────────────────────────────────
    try {
      const allMessages = [
        ...params.history,
        { role: "user", text: params.message },
        { role: "model", text: cleanReply },
      ];
      await dbPool.query(
        `INSERT INTO ai_conversations (user_id, product_id, messages, order_id) VALUES ($1, $2, $3, $4)`,
        [params.userId || null, params.productId || null, JSON.stringify(allMessages), null]
      );
    } catch {}

    return response;
  } catch (e: any) {
    console.error("[AI Sales] خطأ Gemini:", e?.message);
    return { reply: "عذراً، حصل خلل تقني مؤقت. حاول مرة أخرى بعد قليل.", error: e?.message || "gemini_error" };
  }
}

// ─── T5: حُرّاس التحقق قبل إضافة للسلة ──────────────────────────────────────
async function validateCartAction(
  action: any,
  settings: any
): Promise<{ ok: boolean; reason?: string }> {
  const qty = Number(action.quantity);
  const unitPrice = Number(action.agreedUnitPrice);

  if (!qty || qty <= 0) return { ok: false, reason: "الكمية غير صحيحة" };
  if (!unitPrice || unitPrice <= 0) return { ok: false, reason: "السعر غير صحيح" };

  const r = await dbPool.query(
    `SELECT id, name, price, stock, size_pricing, is_active, tags FROM products WHERE id = $1`,
    [Number(action.productId)]
  );
  const product = r.rows[0];
  if (!product) return { ok: false, reason: "المنتج غير موجود في النظام" };
  if (product.is_active === false) return { ok: false, reason: "المنتج غير متاح حالياً" };

  // تحديد السعر الأساسي
  let basePrice = Number(product.price);
  if (action.selectedSize && product.size_pricing) {
    try {
      const sp = JSON.parse(product.size_pricing);
      const match = Array.isArray(sp) ? sp.find((x: any) => x.size === action.selectedSize) : null;
      if (match?.price) basePrice = Number(match.price);
    } catch {}
  }

  // التحقق من الخصم
  const allowedPercent = computeDiscountPercent(qty, settings);
  const maxCap = Number(settings.max_discount_override || 30);
  const effectiveMax = Math.min(allowedPercent, maxCap);
  const minAllowedPrice = basePrice * (1 - effectiveMax / 100);

  if (unitPrice + 1 < minAllowedPrice) {
    return {
      ok: false,
      reason: `السعر المقترح (${unitPrice} ر.ي) أقل من الحد المسموح (${Math.round(effectiveMax)}%). الحد الأدنى: ${Math.round(minAllowedPrice)} ر.ي`,
    };
  }

  // التحقق من المخزون — يُتجاهل للمنتجات ذات المخزون المفتوح
  const tags: string[] = product.tags || [];
  const isUnlimited = tags.includes("مخزون-مفتوح") || tags.includes("unlimited-stock");
  if (!isUnlimited && product.stock !== null && product.stock !== undefined && Number(product.stock) > 0 && qty > Number(product.stock)) {
    return { ok: false, reason: `الكمية المطلوبة (${qty}) أكبر من المخزون المتاح (${product.stock})` };
  }

  return { ok: true };
}

// ─── T4: توليد نموذج مبدئي (Mockup) ──────────────────────────────────────────
export async function generateMockup(params: {
  productId: number;
  logoUrl: string;
  selectedColor?: string;
}): Promise<{ mockupUrl: string; productImage: string; logoUrl: string } | null> {
  try {
    const r = await dbPool.query(
      `SELECT id, name, image_url, color_images FROM products WHERE id = $1`,
      [params.productId]
    );
    const product = r.rows[0];
    if (!product) return null;

    let productImage = product.image_url;
    if (params.selectedColor && product.color_images) {
      try {
        const ci = JSON.parse(product.color_images);
        const match = Array.isArray(ci) ? ci.find((c: any) => c.color === params.selectedColor) : null;
        if (match?.imageUrl) productImage = match.imageUrl;
      } catch {}
    }

    const mockupUrl = `/api/ai/mockup/render?product=${encodeURIComponent(productImage)}&logo=${encodeURIComponent(params.logoUrl)}&name=${encodeURIComponent(product.name)}`;
    return { mockupUrl, productImage, logoUrl: params.logoUrl };
  } catch (e: any) {
    console.error("[AI Mockup]", e.message);
    return null;
  }
}
