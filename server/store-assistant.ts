/**
 * مساعد المتجر الذكي — أويو بلاست
 * مدعوم بـ DeepSeek، متصل بقاعدة البيانات ديناميكياً (يعرف المنتجات والأقسام).
 * يرشد العميل لاختيار المنتجات المناسبة ويجيب عن أسئلة المتجر.
 */
import { pool as dbPool } from "./db";

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;

export interface StoreChatInput {
  message: string;
  history: Array<{ role: "user" | "assistant"; text: string }>;
}

export interface StoreChatOutput {
  reply: string;
  error?: string;
}

// ─── جلب سياق المتجر (أقسام + أبرز المنتجات) ──────────────────────────────────
async function buildStoreContext(): Promise<string> {
  const parts: string[] = [];

  // الأقسام
  try {
    const cats = await dbPool.query(
      `SELECT name FROM categories WHERE is_active = true ORDER BY id LIMIT 40`,
    );
    if (cats.rows.length) {
      parts.push(
        `الأقسام المتاحة في المتجر:\n${cats.rows.map((c: any) => `• ${c.name}`).join("\n")}`,
      );
    }
  } catch (e: any) {
    console.warn("[StoreAssistant] فشل جلب الأقسام:", e?.message);
  }

  // أبرز المنتجات الفعّالة (مع السعر بالريال اليمني والسعودي)
  try {
    const prods = await dbPool.query(
      `SELECT name, price, price_sar, has_free_shipping
       FROM products
       WHERE is_active = true
       ORDER BY id DESC
       LIMIT 60`,
    );
    if (prods.rows.length) {
      const lines = prods.rows.map((p: any) => {
        const yer = p.price ? `${Number(p.price).toLocaleString()} ر.ي` : "";
        const sar = p.price_sar ? ` / ${Number(p.price_sar).toLocaleString()} ر.س` : "";
        const ship = p.has_free_shipping ? " (شحن مجاني)" : "";
        return `• ${p.name} — ${yer}${sar}${ship}`;
      });
      parts.push(`أبرز المنتجات المتاحة:\n${lines.join("\n")}`);
    }
  } catch (e: any) {
    console.warn("[StoreAssistant] فشل جلب المنتجات:", e?.message);
  }

  return parts.join("\n\n") || "لا توجد بيانات متجر متاحة حالياً.";
}

function buildSystemPrompt(context: string): string {
  return [
    "أنت \"أويو\" المساعد الذكي لمتجر أويو بلاست — متجر يمني متخصص في الطباعة على المنتجات البلاستيكية والمستلزمات.",
    "مهمتك مساعدة العملاء: ترشيح المنتجات المناسبة، شرح خيارات الطباعة، الإجابة عن الأسعار والشحن والأقسام، وتوجيه العميل لإتمام الطلب.",
    "",
    "قواعد مهمة:",
    "- أجب دائماً باللغة العربية وبأسلوب ودود ومختصر يناسب شاشة الجوال.",
    "- اعتمد فقط على بيانات المتجر التالية. لا تخترع منتجات أو أسعاراً غير موجودة.",
    "- إن لم تجد المعلومة في البيانات، اطلب من العميل التواصل مع خدمة العملاء بدل التخمين.",
    "- للطلبات الخاصة بالطباعة والتصميم، وجّه العميل إلى قسم الطباعة في التطبيق.",
    "- استخدم الأسعار كما هي في البيانات (ريال يمني / ريال سعودي).",
    "",
    "── بيانات المتجر الحالية ──",
    context,
  ].join("\n");
}

// ─── نداء DeepSeek مع دعم سجل المحادثة ───────────────────────────────────────
export async function handleStoreChat(input: StoreChatInput): Promise<StoreChatOutput> {
  if (!DEEPSEEK_KEY) {
    return {
      reply: "خدمة المساعد الذكي غير متاحة حالياً. تواصل مع خدمة العملاء وسنساعدك فوراً.",
      error: "DEEPSEEK_API_KEY missing",
    };
  }

  const context = await buildStoreContext();
  const systemPrompt = buildSystemPrompt(context);

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...input.history.slice(-12).map((m) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
      content: m.text,
    })),
    { role: "user" as const, content: input.message },
  ];

  try {
    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages,
        temperature: 0.6,
        max_tokens: 900,
      }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error(`[StoreAssistant] DeepSeek error ${res.status}: ${t.slice(0, 200)}`);
      return {
        reply: "عذراً، حصل خلل مؤقت في المساعد. حاول مرة أخرى بعد قليل.",
        error: `DeepSeek ${res.status}`,
      };
    }

    const data: any = await res.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();
    return { reply: reply || "عذراً، لم أفهم طلبك. هل يمكنك إعادة صياغته؟" };
  } catch (e: any) {
    console.error("[StoreAssistant] فشل النداء:", e?.message);
    return {
      reply: "تعذّر الاتصال بالمساعد حالياً. حاول مرة أخرى أو تواصل مع خدمة العملاء.",
      error: e?.message,
    };
  }
}
