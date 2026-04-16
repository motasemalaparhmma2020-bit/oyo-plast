import { GoogleGenAI } from "@google/genai";
import { storage } from "./storage";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("[AI Agents] ⚠️ GEMINI_API_KEY غير مضبوط - موظف المبيعات معطّل");
}

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// ─── دليل الموظف: شخصية + قواعد التفاوض والتسعير ─────────────────────
const SALES_AGENT_INSTRUCTIONS = `
أنت موظف مبيعات خبير في متجر "أويو بلاست" للبلاستيك في اليمن.

## شخصيتك وهدفك:
- رحّب بالعملاء بلهجة يمنية مهذبة واحترافية (مثل: "حياك الله"، "أبشر"، "تكرم"، "يا أستاذ").
- ركّز دائماً على جودة الأكياس والطباعة المخصصة كنقطة قوتنا.
- استخدم نظام الخصم المعتمد أدناه عند التفاوض.
- إذا سألك العميل عن شيء لا تعرفه أو خارج صلاحياتك، وجّهه برفع طلب رسمي وأخبره أن المدير سيراجعه.
- ❌ لا تخرج عن إطار منتجات البلاستيك والتغليف أبداً، ولا تجاوب على أي موضوع آخر.

## أسلوب الكتابة:
- ردود قصيرة ومباشرة (٢-٤ أسطر)، بلا إطالة أو تكرار.
- بدون إيموجي إلا نادراً جداً.
- خاطب العميل باحترام: "حضرتك"، "يا أستاذ"، "تفضّل".

## نظام الخصم المعتمد (لا تتجاوزه):
- من ١ إلى ٤٩ قطعة: السعر كامل، بدون خصم.
- من ٥٠ إلى ٩٩ قطعة: حتى ٥٪ خصم.
- من ١٠٠ إلى ٤٩٩ قطعة: حتى ١٥٪ خصم.
- من ٥٠٠ قطعة فأكثر: حتى ٢٥٪ خصم.

## حساب السعر:
السعر النهائي = (السعر الأساسي × الكمية) − الخصم + (تكلفة الطباعة × الكمية إن وُجدت).

## قواعد صارمة:
- ❌ لا تخترع منتجات أو أسعار خارج الكتالوج المرفق.
- ❌ لا تَعِد بتوصيل مجاني أو مواعيد دقيقة.
- ✅ إذا طلب خصماً أكبر من حدودك، اعتذر بأدب واعرض أقصى خصم مسموح.
- ✅ لطلبات التصميم المخصص: اطلب وصف التصميم (نص، شعار، ألوان) واحفظ الملاحظات.
- ✅ لأي سؤال خارج اختصاصك: "تكرم يا أستاذ، هذا الموضوع يحتاج مراجعة المدير، تقدر ترفع طلب رسمي وسنرد عليك في أقرب وقت."

## آلية إنهاء الصفقة:
عند موافقة العميل النهائية الصريحة على السعر، **اختم رسالتك بهذا الـ JSON بالضبط** (في سطر منفصل، لا تُظهره قبل الاتفاق):
\`\`\`json
{"action":"create_order","productId":<رقم المنتج>,"quantity":<الكمية>,"agreedUnitPrice":<السعر للقطعة بالريال اليمني>,"totalPrice":<الإجمالي>,"customerName":"<اسم العميل إن ذكره>","customerPhone":"<الجوال إن ذكره>","designNotes":"<ملاحظات التصميم إن وجدت>","notes":"تم الاتفاق عبر موظف المبيعات الذكي"}
\`\`\`
`;

// ─── استخراج JSON الإجراء من رد المساعد ──────────────────────────────
function extractActionJson(text: string): any | null {
  const fenceMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);
  const candidate = fenceMatch ? fenceMatch[1] : null;
  if (!candidate) {
    const braceMatch = text.match(/\{[\s\S]*"action"[\s\S]*\}/);
    if (!braceMatch) return null;
    try { return JSON.parse(braceMatch[0]); } catch { return null; }
  }
  try { return JSON.parse(candidate); } catch { return null; }
}

// ─── جلب كتالوج المنتجات للسياق ──────────────────────────────────────
async function buildCatalogContext(productId?: number): Promise<string> {
  try {
    const products = await storage.getPrintingProducts();
    if (productId) {
      const focus = products.find((p: any) => p.id === Number(productId));
      if (focus) {
        return `## المنتج محل النقاش:
- الرقم: ${focus.id}
- الاسم: ${focus.name}
- السعر الأساسي للقطعة: ${focus.price} ريال يمني
- الوصف: ${focus.description || "—"}
- المقاسات المتاحة: ${(focus.sizes || []).join(", ") || "—"}
- الألوان: ${(focus.colors || []).join(", ") || "—"}
- يقبل تصميم مخصص: ${focus.allowDesignUpload ? "نعم" : "لا"}
- سعر الطباعة للقطعة: ${focus.printingPricePerUnit || "0"} ريال`;
      }
    }
    const list = products.slice(0, 10).map((p: any) =>
      `- [${p.id}] ${p.name} | ${p.price} ريال`
    ).join("\n");
    return `## كتالوج منتجات الطباعة المتاحة:\n${list}`;
  } catch {
    return "## كتالوج المنتجات: غير متاح حالياً";
  }
}

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export interface ChatResponse {
  reply: string;
  orderCreated?: { id: number; total: string };
  error?: string;
}

// ─── موظف المبيعات: المعالج الرئيسي ──────────────────────────────────
export async function handleSalesChat(params: {
  history: ChatMessage[];
  message: string;
  productId?: number;
  userId?: string | null;
}): Promise<ChatResponse> {
  if (!ai) {
    return { reply: "عذراً، خدمة المساعد الذكي غير متاحة حالياً. يرجى التواصل مع الإدارة مباشرة.", error: "no_api_key" };
  }

  const catalog = await buildCatalogContext(params.productId);
  const systemInstruction = `${SALES_AGENT_INSTRUCTIONS}\n\n${catalog}`;

  // بناء سجل المحادثة بصيغة Gemini
  const contents = [
    ...params.history.map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    })),
    { role: "user" as const, parts: [{ text: params.message }] },
  ];

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction,
        temperature: 0.6,
        maxOutputTokens: 600,
      },
    });

    const replyRaw = result.text || "تكرم، كيف أقدر أساعدك؟";

    // البحث عن JSON إجراء
    const action = extractActionJson(replyRaw);
    let cleanReply = replyRaw.replace(/```json[\s\S]*?```/gi, "").trim();
    if (!cleanReply) cleanReply = "تم الاتفاق، جاري إنشاء طلبك الآن…";

    let orderCreated: { id: number; total: string } | undefined;

    // ─── إنشاء طلب معلّق إذا اتفق الطرفان ──────────────────────────
    if (action && action.action === "create_order" && action.productId && action.quantity) {
      try {
        const qty = Number(action.quantity);
        const unitPrice = Number(action.agreedUnitPrice);
        const total = action.totalPrice ? Number(action.totalPrice) : qty * unitPrice;

        const order = await storage.createOrder({
          userId: params.userId || null,
          customerName: action.customerName || "عميل (محادثة ذكية)",
          customerPhone: action.customerPhone || null,
          customerEmail: null,
          shippingCity: null,
          shippingAddress: null,
          shippingOption: "normal",
          shippingCost: "0",
          notes: action.notes || "تم الاتفاق عبر موظف المبيعات الذكي",
          total: String(total),
          paymentMethod: "cash_on_delivery",
          items: [{
            productId: Number(action.productId),
            quantity: qty,
            price: String(unitPrice),
            designNotes: action.designNotes || null,
            customPrinting: !!action.designNotes,
          }],
        });

        orderCreated = { id: order.id, total: String(order.total) };
        cleanReply += `\n\n✅ تم إنشاء طلبك المعلّق برقم #${order.id} بقيمة ${total.toLocaleString("ar-SA")} ريال يمني. سيتواصل معك فريقنا لاستكمال بيانات الشحن والدفع.`;
      } catch (e: any) {
        console.error("[AI Sales] فشل إنشاء الطلب:", e?.message);
        cleanReply += `\n\n⚠️ حصلت مشكلة فنية في حفظ الطلب. تكرم تواصل مع الإدارة وسنعالج الأمر فوراً.`;
      }
    }

    return { reply: cleanReply, orderCreated };
  } catch (e: any) {
    console.error("[AI Sales] خطأ Gemini:", e?.message);
    return { reply: "عذراً، حصل خلل تقني مؤقت. حاول مرة أخرى بعد قليل.", error: e?.message || "gemini_error" };
  }
}
