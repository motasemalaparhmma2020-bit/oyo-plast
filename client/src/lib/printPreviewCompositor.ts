/**
 * مُركِّب المعاينة الفورية على الجهاز (client-side)
 * Client-side print-preview compositor.
 *
 * لماذا client-side؟ صور المنتجات هنا محلية (/products, /assets) وليست روابط رفع
 * على Cloudinary، كما أن Cloudinary fetch يرجع 401 على هذا الحساب، والشعار يُرفع
 * كـ base64 data URL لا يصلح لـ l_fetch. لذلك التركيب على <canvas> هو الحل الجذري
 * الذي يعمل لكل منتج ويضع الشعار **وسط الكيس** بدقة.
 */

export interface PrintArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CompositeOptions {
  /** رابط صورة المنتج (الكيس) */
  productImageUrl: string;
  /** رابط/داتا الشعار المرفوع (اختياري) */
  logoUrl?: string | null;
  /** موضع الشعار كنِسب مئوية 0-100؛ الافتراضي يضع الشعار في المنتصف */
  printArea?: PrintArea | null;
  /** لون كيس مقترح (hex) لتلوين الخلفية فقط دون التأثير على الشعار */
  bagColorTint?: string | null;
  /** أقصى بُعد للوحة لإبقاء حجم الناتج صغيراً */
  maxSize?: number;
}

const DEFAULT_AREA: PrintArea = { x: 25, y: 25, width: 50, height: 50 };

function isRemote(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false; // data:, blob:, نسبي = نفس الأصل
  try {
    return new URL(url).origin !== window.location.origin;
  } catch {
    return false;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // للصور الخارجية فقط: نطلب CORS كي لا تتلوّث اللوحة عند التصدير.
    if (isRemote(src)) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`فشل تحميل الصورة: ${src.slice(0, 60)}`));
    img.src = src;
  });
}

/**
 * يركّب الشعار وسط صورة المنتج ويُرجع dataURL.
 * يحافظ على نسبة الشعار (fit) ويضعه في **منتصف** صندوق printArea.
 */
export async function compositePrintPreview(opts: CompositeOptions): Promise<string> {
  const { productImageUrl, logoUrl, printArea, bagColorTint, maxSize = 900 } = opts;
  if (!productImageUrl) throw new Error("صورة المنتج مطلوبة");

  const product = await loadImage(productImageUrl);
  const ar = product.naturalWidth / product.naturalHeight || 1;

  let W = product.naturalWidth || 600;
  let H = product.naturalHeight || 600;
  if (Math.max(W, H) > maxSize) {
    if (W >= H) {
      W = maxSize;
      H = Math.round(maxSize / ar);
    } else {
      H = maxSize;
      W = Math.round(maxSize * ar);
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("تعذّر إنشاء سياق الرسم");

  // خلفية بيضاء ثم صورة المنتج كاملة اللوحة (الكيس)
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(product, 0, 0, W, H);

  // تلوين الكيس المقترح (multiply لا يؤثر على الشعار لأنه يُرسم بعده)
  if (bagColorTint) {
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = bagColorTint;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // رسم الشعار وسط صندوق المنطقة مع الحفاظ على نسبته
  if (logoUrl) {
    const logo = await loadImage(logoUrl);
    const area = printArea && typeof printArea === "object" ? printArea : DEFAULT_AREA;
    const boxX = (W * (Number(area.x) || 0)) / 100;
    const boxY = (H * (Number(area.y) || 0)) / 100;
    const boxW = (W * (Number(area.width) || DEFAULT_AREA.width)) / 100;
    const boxH = (H * (Number(area.height) || DEFAULT_AREA.height)) / 100;

    const logoAr = logo.naturalWidth / logo.naturalHeight || 1;
    let drawW = boxW;
    let drawH = boxW / logoAr;
    if (drawH > boxH) {
      drawH = boxH;
      drawW = boxH * logoAr;
    }
    // المنتصف الأفقي والعمودي داخل الصندوق
    const drawX = boxX + (boxW - drawW) / 2;
    const drawY = boxY + (boxH - drawH) / 2;
    ctx.drawImage(logo, drawX, drawY, drawW, drawH);
  }

  try {
    return canvas.toDataURL("image/jpeg", 0.9);
  } catch {
    // لوحة ملوّثة (صورة خارجية بلا CORS) — نرجع صورة المنتج كما هي
    throw new Error("tainted-canvas");
  }
}

/** ألوان أكياس مقترحة للمعاينات الفورية الثلاث */
export const SUGGESTION_BAG_COLORS: { name: string; hex: string }[] = [
  { name: "كحلي", hex: "#1e3a8a" },
  { name: "أخضر", hex: "#15803d" },
  { name: "بُني", hex: "#7c2d12" },
];

/**
 * يولّد عدة معاينات فورية بألوان أكياس مختلفة (بلا أي استدعاء خارجي).
 * يتجاهل أي لون يفشل تركيبه ويُرجع الناجح فقط.
 */
export async function compositeSuggestions(
  base: Omit<CompositeOptions, "bagColorTint">,
  colors: { name: string; hex: string }[] = SUGGESTION_BAG_COLORS
): Promise<{ name: string; hex: string; url: string }[]> {
  const out: { name: string; hex: string; url: string }[] = [];
  for (const c of colors) {
    try {
      const url = await compositePrintPreview({ ...base, bagColorTint: c.hex });
      out.push({ name: c.name, hex: c.hex, url });
    } catch {
      /* تجاهل الفشل لهذا اللون */
    }
  }
  return out;
}
