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
      // إنشاء سجل افتراضي تلقائياً (يستخدم defaults من schema)
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
// المستوى 1: 1..tier_1_qty
// المستوى 2: (tier_1_qty+1)..tier_2_qty
// المستوى 3: (tier_2_qty+1)..tier_3_qty
// المستوى 4: > tier_3_qty
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
- مدة التصنيع الافتراضية (للمنتجات المصنّعة حسب الطلب): ${s.manufacturing_days_default} أيام.
- ⏱ إجمالي مدة التسليم = مدة تصنيع المنتج + مدة الشحن.`;
}

// ─── بناء سلّم الخصومات من الإعدادات ──────────────────────────────────────────
function buildDiscountContext(s: any): string {
  return `## سلّم الخصومات المعتمد (لا تتجاوزه مطلقاً):
- من 1 إلى ${s.discount_tier_1_qty} قطعة: ${s.discount_tier_1_percent}% خصم.
- من ${s.discount_tier_1_qty + 1} إلى ${s.discount_tier_2_qty} قطعة: ${s.discount_tier_2_percent}% خصم.
- من ${s.discount_tier_2_qty + 1} إلى ${s.discount_tier_3_qty} قطعة: ${s.discount_tier_3_percent}% خصم.
- من ${s.discount_tier_3_qty + 1} قطعة فأكثر: ${s.discount_tier_4_percent}% خصم.
- الحد الأقصى المطلق للخصم (لا يتجاوز تحت أي ظرف): ${s.max_discount_override}%.`;
}

// ─── بناء كتالوج شامل لكل المنتجات النشطة ────────────────────────────────────
async function buildFullCatalogContext(focusProductId?: number, maxItems = 60): Promise<string> {
  try {
    const r = await dbPool.query(`
      SELECT p.id, p.name, p.description, p.price, p.price_sar,
             p.sizes, p.colors, p.size_pricing, p.stock,
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
      return `- [#${p.id}] ${p.name}${category ? ` (${category})` : ""}
    السعر: ${priceStr}${freeShip}
    المقاسات: ${sizes || "—"} | الألوان: ${colors || "—"}
    المخزون: ${p.stock ?? "—"} | ${printing} | ${manufacturing}${p.description ? `
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

// ─── آلية البيع كرجل مبيعات حقيقي ────────────────────────────────────────────
const SALES_WORKFLOW = `
## خطوات البيع (اتبعها كرجل مبيعات محترف):
1. **الاستقبال**: رحّب بلطف واسأل عن احتياج العميل (النوع، الاستخدام، الكمية التقريبية).
2. **الاقتراح**: اقترح 2-3 منتجات من الكتالوج المرفق تناسب احتياجه، مع ذكر السعر والمميزات.
3. **التفصيل**: عند اختياره منتجاً، اسأل عن: المقاس، اللون، الكمية النهائية.
4. **الطباعة**: إن كان المنتج يقبل الطباعة، اسأل: "هل تريد طباعة شعارك؟ ارفع صورة شعارك (PNG/JPG) وسأجهّز لك نموذجاً مبدئياً (Mockup)".
5. **الحساب الشفّاف**: اعرض تفصيل الفاتورة:
   - سعر الوحدة × الكمية = المبلغ الأساسي
   - الخصم المطبّق (من سلّم الخصومات)
   - تكلفة الطباعة (إن وُجدت)
   - تكلفة الشحن (حسب الطريقة)
   - مدة التصنيع + مدة الشحن = مدة التسليم
   - الإجمالي النهائي
6. **التأكيد**: اسأل "هل توافق على الطلب بهذه التفاصيل؟".
7. **الإنهاء**: عند موافقة العميل الصريحة، اختم رسالتك بـ JSON إنشاء الطلب (أدناه).

## آلية إنهاء الصفقة:
عند موافقة العميل النهائية الصريحة، أضف في آخر رسالتك هذا الـ JSON بالضبط (في كتلة منفصلة):
\`\`\`json
{"action":"create_order","productId":<رقم>,"quantity":<كمية>,"agreedUnitPrice":<سعر القطعة بعد الخصم>,"selectedSize":"<المقاس>","selectedColor":"<اللون>","shippingOption":"<normal أو fast>","customPrinting":<true/false>,"designNotes":"<ملاحظات التصميم>","designFileUrl":"<رابط الشعار إن رُفع>","customerName":"<الاسم>","customerPhone":"<الجوال>","totalPrice":<الإجمالي شامل الشحن والطباعة>}
\`\`\`

## آلية طلب النموذج المبدئي (Mockup):
إذا طلب العميل نموذجاً لشعاره على المنتج، اختم رسالتك بـ:
\`\`\`json
{"action":"request_mockup","productId":<رقم>,"selectedColor":"<اللون>","message":"<اطلب من العميل رفع الشعار>"}
\`\`\`

## أسلوب الكتابة:
- ردود قصيرة ومباشرة (2-5 أسطر)، بدون إطالة.
- لهجة يمنية مهذبة (حياك الله، أبشر، تكرم، يا أستاذ).
- بدون إيموجي إلا نادراً.
- دائماً اعتمد على الأرقام من الكتالوج الحقيقي أدناه — ممنوع الاختراع.
`;

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

export interface ChatResponse {
  reply: string;
  orderCreated?: { id: number; total: string };
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

  const logoNote = params.uploadedLogoUrl
    ? `\n\n## 🖼️ رفع العميل شعاراً:\nرابط الشعار: ${params.uploadedLogoUrl}\nاذكر له أن النموذج المبدئي جاهز للمعاينة.`
    : "";

  const systemInstruction = `${settings.personality_prompt}

${settings.strict_rules}

${discounts}

${shipping}

${SALES_WORKFLOW}

${catalog}${logoNote}`;

  const contents = [
    ...params.history.map((m) => ({
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
      maxOutputTokens: 800,
    },
  });

  try {
    let result;
    try {
      result = await callGemini("gemini-2.5-flash");
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("overloaded")) {
        console.warn("[AI Sales] 2.5-flash overloaded, falling back to 2.0-flash");
        result = await callGemini("gemini-2.0-flash");
      } else {
        throw e;
      }
    }

    const replyRaw = result.text || "تكرم، كيف أقدر أساعدك؟";
    const action = extractActionJson(replyRaw);
    let cleanReply = replyRaw.replace(/```json[\s\S]*?```/gi, "").trim();
    if (!cleanReply) cleanReply = "تكرم...";

    const response: ChatResponse = { reply: cleanReply };

    // ─── إجراء: طلب Mockup ─────────────────────────────────────────
    if (action?.action === "request_mockup" && settings.allow_mockup_generation) {
      response.mockupRequest = {
        productId: Number(action.productId),
        selectedColor: action.selectedColor,
      };
    }

    // ─── إجراء: إنشاء طلب (مع حُرّاس الحماية T5) ───────────────────
    if (action?.action === "create_order" && action.productId && action.quantity) {
      const guardResult = await validateOrderAction(action, settings);
      if (!guardResult.ok) {
        console.warn("[AI Sales] ❌ Guard blocked order:", guardResult.reason);
        cleanReply += `\n\n⚠️ ${guardResult.reason} — سأحوّلك للإدارة لمراجعة الطلب.`;
        response.reply = cleanReply;
        return response;
      }

      try {
        const qty = Number(action.quantity);
        const unitPrice = Number(action.agreedUnitPrice);
        const shippingOption = action.shippingOption === "fast" ? "fast" : "normal";
        const shippingCost = shippingOption === "fast"
          ? Number(settings.shipping_fast_cost)
          : Number(settings.shipping_normal_cost);
        const subtotal = qty * unitPrice;
        const freeThreshold = Number(settings.free_shipping_threshold || 0);
        const effectiveShip = (freeThreshold > 0 && subtotal >= freeThreshold) ? 0 : shippingCost;
        // ⚠ نحسب الإجمالي من السيرفر — لا نثق بـ totalPrice القادم من LLM (حماية من التلاعب)
        const total = subtotal + effectiveShip;

        const order = await storage.createOrder({
          userId: params.userId || null,
          customerName: action.customerName || "عميل (محادثة ذكية)",
          customerPhone: action.customerPhone || null,
          customerEmail: null,
          shippingCity: null,
          shippingAddress: null,
          shippingOption,
          shippingCost: String(effectiveShip),
          notes: `تم الاتفاق عبر الموظف الذكي. ${action.designNotes ? "ملاحظات التصميم: " + action.designNotes : ""}`.trim(),
          total: String(total),
          paymentMethod: "cash_on_delivery",
          items: [{
            productId: Number(action.productId),
            quantity: qty,
            price: String(unitPrice),
            selectedSize: action.selectedSize || null,
            selectedColor: action.selectedColor || null,
            designNotes: action.designNotes || null,
            designFileUrl: action.designFileUrl || params.uploadedLogoUrl || null,
            customPrinting: !!(action.customPrinting || action.designNotes || params.uploadedLogoUrl),
          }],
        });

        response.orderCreated = { id: order.id, total: String(order.total) };
        cleanReply += `\n\n✅ تم إنشاء طلبك برقم #${order.id} بقيمة ${Number(total).toLocaleString("ar-SA")} ريال. سيتواصل معك فريقنا لاستكمال الشحن والدفع.`;
        response.reply = cleanReply;
      } catch (e: any) {
        console.error("[AI Sales] فشل إنشاء الطلب:", e?.message);
        cleanReply += `\n\n⚠️ حصل خلل فني في حفظ الطلب. تكرم تواصل مع الإدارة.`;
        response.reply = cleanReply;
      }
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
        [params.userId || null, params.productId || null, JSON.stringify(allMessages), response.orderCreated?.id || null]
      );
    } catch {}

    return response;
  } catch (e: any) {
    console.error("[AI Sales] خطأ Gemini:", e?.message);
    return { reply: "عذراً، حصل خلل تقني مؤقت. حاول مرة أخرى بعد قليل.", error: e?.message || "gemini_error" };
  }
}

// ─── T5: حُرّاس التحقق قبل إنشاء الطلب ───────────────────────────────────────
async function validateOrderAction(
  action: any,
  settings: any
): Promise<{ ok: boolean; reason?: string }> {
  const qty = Number(action.quantity);
  const unitPrice = Number(action.agreedUnitPrice);

  if (!qty || qty <= 0) return { ok: false, reason: "الكمية غير صحيحة" };
  if (!unitPrice || unitPrice <= 0) return { ok: false, reason: "السعر غير صحيح" };

  // جلب المنتج من DB للتحقق
  const r = await dbPool.query(
    `SELECT id, name, price, stock, size_pricing, is_active FROM products WHERE id = $1`,
    [Number(action.productId)]
  );
  const product = r.rows[0];
  if (!product) return { ok: false, reason: "المنتج غير موجود في النظام" };
  if (product.is_active === false) return { ok: false, reason: "المنتج غير متاح حالياً" };

  // تحديد السعر الأساسي (يحترم sizePricing لو موجود مع مقاس محدد)
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

  // هامش تسامح 1 ريال للتقريبات
  if (unitPrice + 1 < minAllowedPrice) {
    return {
      ok: false,
      reason: `السعر المقترح (${unitPrice} ر.ي) أقل من الحد المسموح للخصم (${Math.round(effectiveMax)}%). الحد الأدنى: ${Math.round(minAllowedPrice)} ر.ي`,
    };
  }

  // التحقق من المخزون (لو المخزون مسجّل)
  if (product.stock !== null && product.stock !== undefined && Number(product.stock) > 0 && qty > Number(product.stock)) {
    return { ok: false, reason: `الكمية المطلوبة (${qty}) أكبر من المخزون المتاح (${product.stock})` };
  }

  return { ok: true };
}

// ─── T4: توليد نموذج مبدئي (Mockup) بسيط ─────────────────────────────────────
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

    // رابط HTML ديناميكي لعرض المنتج + الشعار فوقه
    const mockupUrl = `/api/ai/mockup/render?product=${encodeURIComponent(productImage)}&logo=${encodeURIComponent(params.logoUrl)}&name=${encodeURIComponent(product.name)}`;

    return { mockupUrl, productImage, logoUrl: params.logoUrl };
  } catch (e: any) {
    console.error("[AI Mockup]", e.message);
    return null;
  }
}
