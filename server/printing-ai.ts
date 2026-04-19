/**
 * موظف الطباعة الذكي — أويو بلاست
 * متصل بقاعدة البيانات بشكل ديناميكي — يعرف كل منتج جديد تلقائياً
 */
import { GoogleGenAI } from "@google/genai";
import { pool as dbPool } from "./db";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// ─── جلب منتجات الطباعة من قاعدة البيانات ──────────────────────────────────
async function fetchPrintingProducts(): Promise<string> {
  try {
    const result = await dbPool.query(`
      SELECT
        id, name, description, price, colors, sizes,
        printing_price_per_unit, base_bag_price, available_bag_colors,
        has_printing_options, stock, bulk_pricing, size_pricing
      FROM products
      WHERE show_in_printing = true AND is_active = true
      ORDER BY id
    `);

    if (!result.rows.length) {
      return "لا توجد منتجات طباعة متاحة حالياً.";
    }

    return result.rows.map((p: any) => {
      const colors = Array.isArray(p.colors) && p.colors.length
        ? `الألوان المتاحة: ${p.colors.join("، ")}`
        : "";
      const sizes = Array.isArray(p.sizes) && p.sizes.length
        ? `المقاسات: ${p.sizes.join(" | ")}`
        : "";
      const printPrice = p.printing_price_per_unit
        ? `سعر الطباعة للوحدة: ${Number(p.printing_price_per_unit).toLocaleString()} ريال`
        : "";
      const basePrice = p.base_bag_price
        ? `سعر المنتج بدون طباعة: ${Number(p.base_bag_price).toLocaleString()} ريال`
        : `السعر: ${Number(p.price).toLocaleString()} ريال`;
      const bagColors = Array.isArray(p.available_bag_colors) && p.available_bag_colors.length
        ? `ألوان الكيس للطباعة: ${p.available_bag_colors.join("، ")}`
        : "";
      const stock = p.stock > 0 ? `المخزون: ${p.stock.toLocaleString()} وحدة` : "غير متوفر حالياً";

      const parts = [
        `🖨️ **${p.name}**`,
        p.description ? `   ${p.description}` : "",
        `   ${basePrice}`,
        printPrice ? `   ${printPrice}` : "",
        sizes ? `   ${sizes}` : "",
        colors ? `   ${colors}` : "",
        bagColors ? `   ${bagColors}` : "",
        `   ${stock}`,
      ].filter(Boolean).join("\n");

      return parts;
    }).join("\n\n");
  } catch (err: any) {
    console.error("[Printing AI] فشل جلب المنتجات:", err?.message);
    return "تعذّر جلب المنتجات من قاعدة البيانات.";
  }
}

// ─── المعرفة الثابتة — أنواع الطباعة ─────────────────────────────────────────
const PRINTING_TYPES = `
## أنواع الطباعة المتاحة لدينا:

**1. طباعة السيلك (Silk Screen)**
- الأنسب لـ: الأكياس، الملابس، التيشيرتات
- المميزات: ألوان نابضة، متينة، تتحمل الغسيل
- الحد الأدنى: 50 قطعة
- ملاحظة: كل لون بالتصميم = طبقة منفصلة في السعر

**2. طباعة رقمية كاملة (Full Digital / DTG)**
- الأنسب لـ: الكميات الصغيرة، التصاميم المعقدة والصور
- المميزات: كامل الألوان بدون قيود، تفاصيل دقيقة
- الحد الأدنى: 1 قطعة

**3. طباعة UV مقاومة للشمس**
- الأنسب لـ: اللوحات الإعلانية للخارج، البانرات
- المميزات: مقاومة للأشعة فوق البنفسجية والمطر والرطوبة
- الحد الأدنى: 1 قطعة

**4. طباعة حرارية (Heat Transfer / DTF)**
- الأنسب لـ: الفنايل والملابس، كامل الألوان
- المميزات: مرونة عالية، تفاصيل دقيقة، كامل الألوان
- الحد الأدنى: 10 قطع

**5. نقش ليزر (Laser Engraving)**
- الأنسب لـ: الأقلام، الميداليات، الأكواب المعدنية، الهدايا الفاخرة
- المميزات: دائم، لا يُمسح، احترافي ولافت
- الحد الأدنى: 10 قطع

**6. طباعة حرارية للأكواب (Sublimation)**
- الأنسب لـ: الأكواب السيراميك والبلاستيك
- المميزات: كامل الألوان، تغطي الكوب بالكامل
- الحد الأدنى: 10 أكواب
`;

// ─── أوقات التسليم ─────────────────────────────────────────────────────────
const DELIVERY_TIMES = `
## أوقات التسليم التقريبية:

| المنتج | وقت الإنتاج |
|--------|-------------|
| كروت شخصية | 3-5 أيام عمل |
| ملصقات لاصقة | 3-5 أيام عمل |
| فواتير وإيصالات | 4-6 أيام عمل |
| أكياس قماش | 7-10 أيام عمل |
| فنايل مطبوعة | 5-7 أيام عمل |
| أكواب مطبوعة | 5-7 أيام عمل |
| لوحات إعلانية | 2-3 أيام عمل |
| أقلام ودفاتر | 5-7 أيام عمل |
| ميداليات وهدايا | 5-7 أيام عمل |

ملاحظة: تبدأ أيام العمل من لحظة تأكيد التصميم وإتمام الدفع.
`;

// ─── تركيبات الألوان ──────────────────────────────────────────────────────
const COLOR_GUIDE = `
## دليل تركيبات الألوان الناجحة عالمياً:

**للمحلات الغذائية والمطاعم:**
- كرافت بني + طباعة ذهبية = راقٍ واحترافي
- أبيض + طباعة أخضر داكن = نظيف وطبيعي
- أسود + طباعة ذهبية = فاخر ومميز

**للتجميل والعطور:**
- أبيض/كريمي + طباعة وردية أو ذهبية = أنوثي وأنيق
- أسود + طباعة فضية = عصري وفاخر

**للشركات والمؤسسات:**
- أزرق داكن + طباعة بيضاء = احترافي وموثوق
- رمادي + طباعة زرقاء = حديث ومنظم

**للأطفال والهدايا:**
- أبيض + طباعة ملونة كاملة = مبهج وجذاب
- سماوي/وردي + طباعة بيضاء = ناعم وودود

**القاعدة الذهبية:** لون خلفية + لون طباعة واحد رئيسي = أجمل وأرخص.
تجنب أكثر من 3 ألوان في تصميم واحد.
`;

// ─── قواعد إعداد وصف التصميم ──────────────────────────────────────────────
const DESIGN_DESCRIPTION_GUIDE = `
## كيفية إعداد وصف التصميم للمصمم:

بعد جمع المواصفات، أعدّ وصفاً واضحاً يشمل:
- لون الخلفية (مع رمز اللون إن أمكن مثل #808080)
- لون الطباعة (مثل أبيض #FFFFFF)
- المحتوى المطلوب (نص / شعار / صورة)
- مكان الطباعة (وسط / يمين / يسار / كامل السطح)
- أي ملاحظات خاصة (حجم الخط، نوع الخط المفضل)

مثال:
"خلفية رمادي (#808080) | طباعة أبيض (#FFFFFF) | نص: اسم المتجر + رقم الهاتف | مركزي | خط بسيط مقروء"
`;

// ─── بناء System Prompt ديناميكي ─────────────────────────────────────────────
async function buildPrintingSystemPrompt(): Promise<string> {
  const liveProducts = await fetchPrintingProducts();

  return `أنت "أويو" — موظف مبيعات ذكي ومتخصص في الطباعة بشركة أويو بلاست في اليمن.

## شخصيتك:
- تتكلم بالعربية مع لمسة يمنية ودية
- ترحيبي، صبور، خبير، محترف ومبدع في اقتراح الألوان
- تستشير العميل ببراعة لتفهم حاجته الحقيقية
- لا تتحدث عن أي شيء خارج منتجات الطباعة والتغليف
- رسائلك قصيرة وواضحة — لا أكثر من 4 أسطر في كل رد

## منتجاتنا المتاحة الآن (محدّثة تلقائياً من قاعدة البيانات):
${liveProducts}

${PRINTING_TYPES}

${DELIVERY_TIMES}

${COLOR_GUIDE}

${DESIGN_DESCRIPTION_GUIDE}

## طريقة عملك مع العميل (اتبع هذه الخطوات بالترتيب):

**الخطوة 1 — الترحيب:**
رحّب بدفء إذا كانت هذه أول رسالة.

**الخطوة 2 — جمع المواصفات (سؤال واحد في كل مرة):**
اسأل تدريجياً:
أ) نوع المنتج (إذا لم يحدده — اعرض قائمة من منتجاتنا المتاحة أعلاه)
ب) لون المنتج الأساسي (اعرض الألوان المتاحة من قاعدة البيانات)
ج) المقاس (اعرض الخيارات المتاحة من قاعدة البيانات)
د) الكمية المطلوبة (تحقق أنها تلبي حد المخزون المتاح)
هـ) لون ونوع الطباعة (اقترح تركيبات جاهزة)
و) محتوى الطباعة (نص / شعار / رقم هاتف)

**الخطوة 3 — اقتراح الألوان:**
اقترح 2-3 تشكيلات ألوان بناءً على نشاط العميل.

**الخطوة 4 — حساب السعر التقريبي:**
بعد معرفة المنتج والكمية والطباعة، احسب:
(سعر الوحدة × الكمية) + (سعر الطباعة × الكمية)
قدّم التقدير بوضوح.

**الخطوة 5 — عرض التصميم الأولي:**
بعد تأكيد كل المواصفات:
"يمكنني تحضير لك نموذج تصميم أولي بـ 300 ريال يمني فقط — يُخصم من الطلب النهائي. هل تريد؟"
إذا وافق، أضف {ACTION:ADD_DESIGN_SERVICE} في ردك وأعدّ وصف التصميم التفصيلي.

**الخطوة 6 — جمع بيانات التواصل:**
اطلب: الاسم الكامل، رقم الهاتف، المدينة.
ثم أضف {ACTION:READY_TO_ORDER} مع ملخص الطلب الكامل بهذا الشكل:

📦 طلب طباعة جديد — أويو بلاست
━━━━━━━━━━━━━━
👤 [الاسم الكامل]
📞 [رقم الهاتف] | [المدينة]
━━━━━━━━━━━━━━
📋 المنتج: [اسم المنتج]
📐 المقاس: [المقاس المختار]
🎨 لون المنتج: [اللون]
🖊️ الطباعة: [لون الطباعة + النوع + عدد الألوان]
📝 المحتوى: [ما سيُطبع]
🔢 الكمية: [العدد]
━━━━━━━━━━━━━━
🎨 وصف التصميم: [وصف تفصيلي للمصمم]
━━━━━━━━━━━━━━
💰 التقدير: [السعر × الكمية] = [الإجمالي] ريال يمني
⏱️ التسليم: [وقت التسليم المتوقع]

## قواعد مهمة:
- إذا لم يجد العميل ما يريد في منتجاتنا المتاحة، قل بأدب: "هذا المنتج غير متاح لدينا حالياً، لكن يمكنك التواصل عبر الواتساب لاستفسار خاص"
- لا تخترع منتجات أو أسعاراً غير موجودة في القائمة أعلاه
- إذا كان المخزون غير كافٍ، أعلم العميل بأدب
- الأسعار المعروضة تقديرية — السعر الدقيق يُحدد عند إتمام الطلب
- استخدم الإيموجي باعتدال`;
}

// ─── واجهة handlePrintingChat ─────────────────────────────────────────────────
export interface PrintingChatInput {
  message: string;
  history: Array<{ role: "user" | "model"; text: string }>;
  productType?: string;
}

export interface PrintingChatOutput {
  reply: string;
  action?: "add_design_service" | "ready_to_order" | null;
  collectedSpecs?: Record<string, string>;
}

export async function handlePrintingChat(input: PrintingChatInput): Promise<PrintingChatOutput> {
  if (!ai) {
    return {
      reply: "خدمة الموظف الذكي غير متاحة حالياً. يرجى التواصل على واتساب لطلب عرض سعر مخصص.",
      action: null,
    };
  }

  try {
    // جلب System Prompt ديناميكي من قاعدة البيانات
    const systemPrompt = await buildPrintingSystemPrompt();

    // تصفية التاريخ — Gemini يشترط أن يبدأ بـ user
    const rawHistory = input.history.slice(-16);
    const firstUserIdx = rawHistory.findIndex((m) => m.role === "user");
    const cleanHistory = firstUserIdx >= 0 ? rawHistory.slice(firstUserIdx) : [];

    const contents = [
      ...cleanHistory.map((m) => ({
        role: m.role as "user" | "model",
        parts: [{ text: m.text }],
      })),
      { role: "user" as const, parts: [{ text: input.message }] },
    ];

    const config = {
      systemInstruction: systemPrompt,
      temperature: 0.65,
      maxOutputTokens: 900,
    };

    // استدعاء Gemini مع fallback شامل لأربعة نماذج
    const callGemini = (model: string) =>
      ai.models.generateContent({ model, contents, config });

    const isFatalError = (msg: string) =>
      msg.includes("400") && !msg.includes("quota") && !msg.includes("RESOURCE_EXHAUSTED");

    let result;
    const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash-latest", "gemini-1.5-pro"];
    let lastError: any = null;
    for (const model of models) {
      try {
        result = await callGemini(model);
        console.log(`[Printing AI] ✅ نجح: ${model}`);
        break;
      } catch (e: any) {
        const msg = String(e?.message || e || "");
        console.warn(`[Printing AI] ⚠️ فشل ${model}: ${msg.slice(0, 120)}`);
        lastError = e;
        if (isFatalError(msg)) throw e;
      }
    }
    if (!result) throw lastError;

    let reply = result.text || "عذراً، لم أفهم. هل يمكنك الإعادة؟";

    // كشف الإجراءات المضمّنة في الرد
    let action: PrintingChatOutput["action"] = null;
    if (reply.includes("{ACTION:ADD_DESIGN_SERVICE}")) {
      action = "add_design_service";
      reply = reply.replace("{ACTION:ADD_DESIGN_SERVICE}", "").trim();
    } else if (reply.includes("{ACTION:READY_TO_ORDER}")) {
      action = "ready_to_order";
      reply = reply.replace("{ACTION:READY_TO_ORDER}", "").trim();
    }

    return { reply, action };
  } catch (e: any) {
    console.error("[Printing AI] خطأ:", String(e?.message || e).slice(0, 200));
    return {
      reply: "عذراً، حصل خلل تقني. حاول مرة ثانية أو تواصل معنا على واتساب.",
      action: null,
    };
  }
}
