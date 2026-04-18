/**
 * موظف الطباعة الذكي — أويو بلاست
 * متخصص بالكامل في منتجات الطباعة والتغليف
 */
import { GoogleGenAI } from "@google/genai";
import { pool as dbPool } from "./db";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// ─── أنواع منتجات الطباعة مع معلوماتها ─────────────────────────────────────
export const PRINTING_PRODUCTS = [
  {
    key: "cloth_bag",
    name: "أكياس قماش",
    emoji: "👜",
    desc: "أكياس قماش عالية الجودة قابلة لإعادة الاستخدام",
    sizes: ["20×30 سم", "25×35 سم", "30×40 سم", "35×45 سم", "مقاس مخصص"],
    colors: ["أبيض طبيعي", "كريمي", "أسود", "أخضر داكن", "أزرق داكن", "بني كرافت"],
    printColors: ["1 لون", "2 لون", "3 ألوان", "طباعة رقمية كاملة"],
    minQty: 50,
    unitPrice: 800,
    notes: "أفضل للهدايا والمحلات البيئية والبقالة",
  },
  {
    key: "nut_bag",
    name: "أكياس مكسرات",
    emoji: "🥜",
    desc: "أكياس بلاستيك/كرافت مخصصة للمكسرات والمنتجات الغذائية",
    sizes: ["100 غرام", "250 غرام", "500 غرام", "1 كيلو", "مقاس مخصص"],
    colors: ["شفاف", "كرافت بني", "أبيض", "ذهبي معدني", "فضي معدني"],
    printColors: ["1 لون", "2 لون", "4 ألوان", "طباعة فوتوية كاملة"],
    minQty: 500,
    unitPrice: 120,
    notes: "مناسب للمواد الغذائية — يدعم الطباعة الفوتوية والكرافت",
  },
  {
    key: "invoice",
    name: "فواتير وإيصالات",
    emoji: "🧾",
    desc: "دفاتر فواتير مخصصة بشعارك وبياناتك",
    sizes: ["A5 (نسختين)", "A4 (نسختين)", "A5 (ثلاث نسخ)", "A4 (ثلاث نسخ)"],
    colors: ["أبيض/أصفر", "أبيض/أزرق/أصفر", "تصميم مخصص"],
    printColors: ["1 لون", "2 لون", "كامل الألوان"],
    minQty: 100,
    unitPrice: 50,
    notes: "دفاتر مترابطة بورق كربون أو بدون كربون",
  },
  {
    key: "business_card",
    name: "كروت شخصية",
    emoji: "💼",
    desc: "كروت بزنس احترافية بتصميمات راقية",
    sizes: ["85×55 سم (قياسي)", "90×50 سم", "مطوية"],
    colors: ["ورق مطفي", "ورق لامع", "ورق سميك فاخر", "بلاستيك شفاف"],
    printColors: ["وجه واحد", "وجهين", "وجهين + UV"],
    minQty: 100,
    unitPrice: 15,
    notes: "خامات راقية — تصميم مجاني مع الطلبات فوق 500 قطعة",
  },
  {
    key: "sticker",
    name: "ملصقات لاصقة",
    emoji: "🏷️",
    desc: "ملصقات لاصقة مقطوعة أو على شكل مخصص",
    sizes: ["5×5 سم", "7×7 سم", "10×10 سم", "A4 ورقة كاملة", "شكل مخصص"],
    colors: ["ورق أبيض", "ورق فضي معدني", "ورق ذهبي", "شفاف"],
    printColors: ["طباعة رقمية كاملة الألوان"],
    minQty: 100,
    unitPrice: 25,
    notes: "مقاومة للماء والحرارة — تصلح للمنتجات الغذائية والتجميل",
  },
  {
    key: "sign_board",
    name: "لوحات إعلانية",
    emoji: "📋",
    desc: "لوحات للمحلات التجارية والمطاعم والمكاتب",
    sizes: ["50×70 سم", "60×90 سم", "80×120 سم", "100×150 سم", "مقاس مخصص"],
    colors: ["ألومنيوم مطفي", "ألومنيوم لامع", "PVC", "فليكس"],
    printColors: ["طباعة UV كاملة الألوان"],
    minQty: 1,
    unitPrice: 8000,
    notes: "طباعة مقاومة للأشعة فوق البنفسجية — مناسبة للخارج والداخل",
  },
  {
    key: "pen_notebook",
    name: "أقلام ودفاتر",
    emoji: "✏️",
    desc: "أقلام وأطقم دفاتر مطبوعة بشعار شركتك",
    sizes: ["قلم بحته", "دفتر A5", "دفتر A4", "طقم قلم + دفتر"],
    colors: ["أزرق", "أسود", "أحمر", "أبيض", "ذهبي", "فضي"],
    printColors: ["نقش ليزر", "طباعة حرارية", "1 لون مطبوع"],
    minQty: 50,
    unitPrice: 300,
    notes: "مثالية للمؤتمرات والهدايا المؤسسية",
  },
  {
    key: "tshirt",
    name: "فنايل مطبوعة",
    emoji: "👕",
    desc: "فنايل وملابس مطبوعة لفرق العمل والفعاليات",
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["أبيض", "أسود", "رمادي", "كحلي", "أحمر", "أخضر", "أزرق سماوي"],
    printColors: ["طباعة سيلك 1 لون", "طباعة سيلك متعددة", "DTF كاملة الألوان"],
    minQty: 10,
    unitPrice: 1500,
    notes: "قطن 100% أو مزيج — طباعة داخل اليمن",
  },
  {
    key: "mug",
    name: "أكواب مطبوعة",
    emoji: "☕",
    desc: "أكواب سيراميك وبلاستيك بتصاميم مخصصة",
    sizes: ["11 أونصة (قياسي)", "15 أونصة (كبير)", "كوب سفر"],
    colors: ["أبيض", "أسود", "ملون (تغير عند التسخين)", "شفاف"],
    printColors: ["طباعة حرارية كاملة الألوان"],
    minQty: 10,
    unitPrice: 2000,
    notes: "مثالي كهدايا مؤسسية وتذكارات",
  },
  {
    key: "medal",
    name: "ميداليات وميدالت",
    emoji: "🏅",
    desc: "ميداليات وحلقات مفاتيح مخصصة",
    sizes: ["دائري 3 سم", "دائري 5 سم", "مستطيل 3×5 سم", "شكل مخصص"],
    colors: ["ذهبي", "فضي", "برونزي", "أسود"],
    printColors: ["نقش ليزر", "طباعة UV"],
    minQty: 10,
    unitPrice: 1200,
    notes: "للمسابقات والمناسبات والهدايا الشركات",
  },
];

// ─── تركيبات الألوان المقترحة (بالاستناد لمعايير عالمية) ─────────────────────
const COLOR_COMBINATIONS = `
## تركيبات الألوان الناجحة عالمياً (اقترحها دائماً):

**للمحلات الغذائية والمطاعم:**
- كيس كرافت بني + طباعة بلون ذهبي = راقي واحترافي
- كيس أبيض + طباعة بلون أخضر داكن = نظيف وطبيعي
- كيس أسود + طباعة بلون ذهبي = فاخر ومميز

**للتجميل والعطور:**
- كيس أبيض / كريمي + طباعة وردية أو ذهبية = أنوثي وأنيق
- كيس أسود + طباعة فضية = عصري وفاخر

**للتقنية والشركات:**
- كيس أزرق داكن + طباعة بيضاء = احترافي وموثوق
- كيس رمادي + طباعة أزرق = حديث ومنظم

**للأطفال والهدايا:**
- كيس أبيض + طباعة ملونة كاملة = مبهج وجذاب
- كيس أزرق سماوي / وردي + طباعة بيضاء = ناعم وودود

**نصيحة ذهبية**: اختر لون واحد رئيسي + لون ثانوي فقط.
الأقل هو الأكثر — تجنب أكثر من 3 ألوان في تصميم واحد.
`;

// ─── System Prompt الموظف الذكي ──────────────────────────────────────────────
function buildPrintingSystemPrompt(): string {
  const productsList = PRINTING_PRODUCTS.map(p =>
    `• ${p.emoji} **${p.name}**: ${p.desc} | أقل كمية: ${p.minQty} | سعر الوحدة يبدأ من ${p.unitPrice.toLocaleString()} ريال`
  ).join("\n");

  return `أنت "أويو" — موظف مبيعات ذكي ومتخصص في الطباعة بشركة أويو بلاست في اليمن.

## شخصيتك:
- تتكلم بالعربية الفصحى مع لمسة يمنية ودية
- ترحيبي، صبور، خبير، محترف ومبدع
- تحب مساعدة العميل ليحصل على أفضل نتيجة
- لا تتحدث عن أي شيء خارج منتجات الطباعة والتغليف
- تجعل التجربة ممتعة وسلسة مثل تماماً التحدث مع خبير متجاوب

## منتجاتنا المتاحة للطباعة:
${productsList}

${COLOR_COMBINATIONS}

## طريقة عملك مع العميل (اتبع هذه الخطوات):

**1. الترحيب والتعرف:**
رحّب بدفء، اسأل عن نوع المنتج المطلوب.
مثال: "حياك الله! أنا أويو، موظف الطباعة في أويو بلاست 🎨 شو نوع المنتج اللي تحتاجه اليوم؟"

**2. جمع المواصفات:**
اسأل تدريجياً (سؤال واحد في كل مرة):
- نوع المنتج (إذا لم يحدده)
- لون الخلفية / المادة الأساسية
- المقاس (اعرض خيارات جاهزة)
- الكمية المطلوبة (تأكد أنها تلبي الحد الأدنى)
- عدد الألوان المطبوعة
- النص / الشعار / بيانات الاتصال المطلوبة

**3. اقتراح الألوان:**
اقترح 2-3 تشكيلات ألوان جاهزة بناءً على نوع نشاط العميل.
استخدم الأمثلة من قاعدة الألوان أعلاه.

**4. عرض التصميم الأولي:**
بعد جمع كل المواصفات، عرض: 
"يمكنني تحضير لك نموذج تصميم أولي بسعر 300 ريال يمني فقط — وهذا المبلغ يُخصم من الطلب النهائي إذا وافقت على التصميم. هل تريد؟"

إذا وافق، أضف {ACTION:ADD_DESIGN_SERVICE} في ردك.

**5. إتمام الطلب:**
بعد الموافقة على التصميم، اطلب تفاصيل التواصل (اسم، هاتف، مدينة).
ثم أضف {ACTION:READY_TO_ORDER} في ردك.

## قواعد مهمة:
- لا تعطِ سعراً نهائياً إلا بعد جمع كل المواصفات
- التصميم الأولي = 300 ريال يمني (يُخصم من الفاتورة النهائية)
- إذا كانت الكمية أقل من الحد الأدنى، اشرح ذلك بلطف واقترح بديلاً
- اعرض تركيبات الألوان كخيارات، لا كإلزام
- رسائلك قصيرة وواضحة — لا أكثر من 3 أسطر في كل رد
- استخدم الإيموجي باعتدال لتحسين التواصل`;
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
    const systemPrompt = buildPrintingSystemPrompt();

    // بناء محتوى المحادثة (تاريخ + الرسالة الجديدة)
    // ملاحظة: Gemini API تشترط أن يبدأ التاريخ بـ role:"user"
    // لذا نحذف أي رسائل model في بداية التاريخ
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
      temperature: 0.7,
      maxOutputTokens: 400,
    };

    // استدعاء Gemini مع fallback شامل — نجرب كل النماذج
    const callGemini = (model: string) =>
      ai.models.generateContent({ model, contents, config });

    // الأخطاء التي تعني مشكلة في الطلب نفسه (لا فائدة من تجربة نماذج أخرى)
    const isFatalError = (msg: string) =>
      msg.includes("400") && !msg.includes("quota") && !msg.includes("RESOURCE_EXHAUSTED");

    let result;
    const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash-latest", "gemini-1.5-pro"];
    let lastError: any = null;
    for (const model of models) {
      try {
        result = await callGemini(model);
        console.log(`[Printing AI] ✅ نجح النموذج: ${model}`);
        break;
      } catch (e: any) {
        const msg = String(e?.message || e || "");
        console.warn(`[Printing AI] ⚠️ فشل ${model}: ${msg.slice(0, 150)}`);
        lastError = e;
        // فقط أخطاء الطلب الخاطئ (400) توقف المحاولات — باقي الأخطاء نستكمل
        if (isFatalError(msg)) {
          throw e;
        }
        // استمر للنموذج التالي
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
    console.error("[Printing AI] خطأ:", JSON.stringify(e?.message || e));
    return {
      reply: "عذراً، حصل خلل تقني. حاول مرة ثانية أو تواصل معنا على واتساب.",
      action: null,
    };
  }
}
