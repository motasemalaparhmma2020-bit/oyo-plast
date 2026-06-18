import React from "react";
import { useState, useRef, type ReactNode } from "react";
import {
  ChevronRight, Star, Search, ShoppingCart, Heart, Share2,
  Upload, Sparkles, Zap, Image as ImageIcon, MessageSquare,
  Check, Info, Loader2, Plus, Minus, Truck, ShieldCheck, Palette,
  Layers, Type, X, BadgeCheck, Gift, Camera,
} from "lucide-react";

/* ============================================================
   OYO PLAST — صفحة المنتج الجديدة (نموذج تفاعلي للمعاينة)
   RTL • Cairo • Sky blue #2196F3 • محاكاة AI (نانو بنانا)
   ============================================================ */

const SKY = "#2196F3";
const RATE = 50; // 1 ر.س = 50 ر.ي (للعرض فقط)
const IMG = (n: string) => `/__mockup/images/${n}`;

const yer = (n: number) => Math.round(n).toLocaleString("ar-EG");
const sar = (n: number) => (n / RATE).toLocaleString("ar-EG", { maximumFractionDigits: 1 });

/* ---------- بيانات تجريبية ---------- */
const BASE = 600; // سعر الحبة الأساسي (ر.ي)
const COLORS = [
  { id: "blue", name: "أزرق", hex: "#2196F3", add: 0 },
  { id: "white", name: "أبيض", hex: "#F4F6F8", add: 0 },
  { id: "navy", name: "كحلي", hex: "#1B2A4A", add: 20 },
  { id: "kraft", name: "كرافت", hex: "#C9A06B", add: 30 },
];
const SIZES = [
  { id: "s", name: "صغير 20×30", add: 0 },
  { id: "m", name: "وسط 30×40", add: 60 },
  { id: "l", name: "كبير 40×50", add: 120 },
];
const WEIGHTS = [
  { id: "light", name: "خفيف", add: 0 },
  { id: "med", name: "متوسط", add: 40 },
  { id: "heavy", name: "سميك فاخر", add: 90 },
];
const BUNDLES = [
  { id: "b100", name: "100 حبة", count: 100, save: 0, note: "السعر الأساسي" },
  { id: "b500", name: "500 حبة", count: 500, save: 12, note: "وفّر 12٪" },
  { id: "b1000", name: "1000 حبة 🎁", count: 1000, save: 20, note: "وفّر 20٪" },
];
// رسوم تجهيز لمرة واحدة (قوالب الطباعة)
const FACE_SETUP = 1500; // رسوم تجهيز الوجه الثاني
const COLOR_SETUP = 800; // رسوم تجهيز كل لون تصميم إضافي
const STUDIO_EXTRA = 100; // معاينة استوديو إضافية
// ألوان الطباعة تُقرأ من إعدادات المنتج (الإصلاح) — وليست قائمة ثابتة
const PRINT_COLORS = [
  { id: "black", name: "أسود", hex: "#1A1A1A" },
  { id: "gold", name: "ذهبي", hex: "#C9A227" },
  { id: "silver", name: "فضي", hex: "#B8BBC2" },
  { id: "red", name: "أحمر", hex: "#E53935" },
  { id: "white", name: "أبيض", hex: "#FFFFFF" },
];
const VOLUME_TIERS = [
  { qty: "100 - 499", off: 0 },
  { qty: "500 - 999", off: 12 },
  { qty: "1000 فأكثر", off: 20 },
];
const ALTS = [
  { id: 0, img: "alt-1.png", name: "شعار أعلى الكيس" },
  { id: 1, img: "alt-2.png", name: "شعار كبير بالوسط" },
  { id: 2, img: "alt-3.png", name: "نمط متكرر فاخر" },
];

/* ---------- شارة "جديد" صغيرة لتمييز التحسينات ---------- */
function NewTag({ text }: { text: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
      style={{ background: SKY }}
    >
      <Sparkles className="h-3 w-3" /> {text}
    </span>
  );
}

function SectionHead({ icon, title, tag }: { icon: ReactNode; title: string; tag?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: "#E3F2FD", color: SKY }}>
          {icon}
        </span>
        <h3 className="text-[15px] font-extrabold text-slate-800">{title}</h3>
      </div>
      {tag && <NewTag text={tag} />}
    </div>
  );
}

export function NewProductPage() {
  /* ---------- الحالة ---------- */
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[0]);
  const [weight, setWeight] = useState(WEIGHTS[0]);
  const [bundle, setBundle] = useState(BUNDLES[0]);
  const [faces, setFaces] = useState<1 | 2>(1);
  const [printColor, setPrintColor] = useState(PRINT_COLORS[1]); // ذهبي
  const [designColors, setDesignColors] = useState(1);

  const [uploaded, setUploaded] = useState(false);
  const [designTab, setDesignTab] = useState<"upload" | "text">("upload");
  const [txt, setTxt] = useState({ shop: "", phone: "", addr: "", activity: "" });
  const [textMerged, setTextMerged] = useState(false);

  const [preview, setPreview] = useState<"plain" | "fast" | "studio">("plain");
  const [studioImg, setStudioImg] = useState("bag-studio.png");
  const [generating, setGenerating] = useState<null | "fast" | "studio">(null);
  const [studioCount, setStudioCount] = useState(0); // عدد معاينات الاستوديو
  const [cartCount, setCartCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [wish, setWish] = useState(false);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };

  /* ---------- التسعير ---------- */
  const perPieceBase = BASE + color.add + size.add + weight.add;
  const pieceNow = Math.round(perPieceBase * (1 - bundle.save / 100));
  const piecesTotal = pieceNow * bundle.count;
  const facesFee = faces === 2 ? FACE_SETUP : 0;
  const colorsFee = (designColors - 1) * COLOR_SETUP; // أول لون مجاني
  const studioFee = Math.max(0, studioCount - 1) * STUDIO_EXTRA; // أول معاينة مجانية
  const setupFees = facesFee + colorsFee + studioFee;
  const grandTotal = piecesTotal + setupFees;

  /* ---------- صورة المعاينة الرئيسية ---------- */
  const mainImage = preview === "studio" ? IMG(studioImg) : IMG("bag-plain.png");
  const busy = generating !== null;

  const handleUpload = () => {
    setUploaded(true);
    showToast("تم رفع التصميم ✓ — جاهز للمعاينة");
  };

  const runFast = () => {
    if (busy) return;
    setGenerating("fast");
    setTimeout(() => {
      setGenerating(null);
      setPreview("fast");
      showToast("معاينة سريعة مجانية ✓");
    }, 700);
  };

  const runStudio = (altImg?: string) => {
    if (busy) return; // منع التشغيل المتزامن (تفادي عدّ خاطئ)
    setGenerating("studio");
    const next = studioCount + 1; // طلب واحد فقط في كل مرة
    setTimeout(() => {
      setStudioCount(next);
      if (altImg) setStudioImg(altImg);
      setPreview("studio");
      setGenerating(null);
      if (next === 1) showToast("معاينة استوديو AI — الأولى مجانية 🎉");
      else showToast(`معاينة استوديو إضافية (+${STUDIO_EXTRA} ر.ي) أُضيفت للسلة`);
    }, 1600);
  };

  const mergeText = () => {
    if (!txt.shop && !txt.phone && !txt.addr && !txt.activity) {
      showToast("أدخل بياناً واحداً على الأقل");
      return;
    }
    setTextMerged(true);
    showToast("تمت إضافة النص للتصميم ✓");
  };

  const addToCart = () => {
    setCartCount((c) => c + 1);
    showToast(`أُضيف للسلة: ${bundle.count} حبة · ${yer(grandTotal)} ر.ي ✓`);
  };

  return (
    <div dir="rtl" className="min-h-screen w-full bg-slate-100" style={{ fontFamily: "Cairo, Tajawal, sans-serif" }}>
      <div className="mx-auto max-w-[480px] bg-slate-50 pb-28 shadow-xl">

        {/* ===== شريط علوي ===== */}
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-white/95 px-3 py-2.5 backdrop-blur">
          <button data-testid="button-back" className="grid h-9 w-9 place-items-center rounded-full hover:bg-slate-100">
            <ChevronRight className="h-5 w-5 text-slate-700" />
          </button>
          <div className="flex flex-1 items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-slate-400">
            <Search className="h-4 w-4" />
            <span className="text-xs">ابحث في أويو بلاست…</span>
          </div>
          <button data-testid="button-cart" className="relative grid h-9 w-9 place-items-center rounded-full hover:bg-slate-100">
            <ShoppingCart className="h-5 w-5 text-slate-700" />
            {cartCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold text-white" style={{ background: SKY }}>
                {cartCount}
              </span>
            )}
          </button>
        </header>

        {/* ===== معرض الصور / المعاينة ===== */}
        <section className="relative bg-white">
          <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-b from-slate-50 to-slate-100">
            <img src={mainImage} alt="المنتج" className="h-full w-full object-cover transition-all duration-500" data-testid="img-product-main" />

            {/* طبقة المعاينة السريعة (CSS overlay مجاني) — تتلوّن بلون الطباعة المختار */}
            {preview === "fast" && (
              <div className="pointer-events-none absolute inset-0">
                <div
                  className="absolute left-1/2 top-[42%] aspect-square w-[34%] -translate-x-1/2 -translate-y-1/2"
                  style={{
                    WebkitMaskImage: `url(${IMG("logo-cut.png")})`,
                    maskImage: `url(${IMG("logo-cut.png")})`,
                    WebkitMaskRepeat: "no-repeat",
                    maskRepeat: "no-repeat",
                    WebkitMaskSize: "contain",
                    maskSize: "contain",
                    WebkitMaskPosition: "center",
                    maskPosition: "center",
                    backgroundColor: printColor.hex,
                    filter: printColor.id === "white" ? "drop-shadow(0 0 1.5px rgba(0,0,0,.45))" : "none",
                  }}
                />
                {textMerged && (
                  <div className="absolute bottom-[20%] left-1/2 -translate-x-1/2 text-center leading-tight">
                    {txt.shop && <div className="text-[13px] font-extrabold" style={{ color: printColor.hex }}>{txt.shop}</div>}
                    {txt.activity && <div className="text-[10px] font-bold" style={{ color: printColor.hex }}>{txt.activity}</div>}
                    {txt.phone && <div className="text-[10px] font-bold" style={{ color: printColor.hex }}>{txt.phone}</div>}
                  </div>
                )}
              </div>
            )}

            {/* شارة الوفورات */}
            {bundle.save > 0 && (
              <div className="absolute right-3 top-3 rounded-lg bg-red-500 px-2 py-1 text-xs font-bold text-white shadow">
                وفّر {yer(bundle.save)}٪
              </div>
            )}

            {/* شارة نوع المعاينة */}
            {preview !== "plain" && (
              <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">
                {preview === "studio" ? <><Sparkles className="h-3 w-3" /> معاينة استوديو AI</> : <><Zap className="h-3 w-3" /> معاينة سريعة ({printColor.name})</>}
              </div>
            )}

            {/* أدوات جانبية */}
            <div className="absolute bottom-3 left-3 flex flex-col gap-2">
              <button onClick={() => setWish(!wish)} data-testid="button-wishlist" className="grid h-9 w-9 place-items-center rounded-full bg-white/90 shadow">
                <Heart className={`h-4 w-4 ${wish ? "fill-red-500 text-red-500" : "text-slate-600"}`} />
              </button>
              <button className="grid h-9 w-9 place-items-center rounded-full bg-white/90 shadow">
                <Share2 className="h-4 w-4 text-slate-600" />
              </button>
            </div>

            {busy && (
              <div className="absolute inset-0 grid place-items-center bg-white/70 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-2 text-slate-700">
                  <Loader2 className="h-8 w-8 animate-spin" style={{ color: SKY }} />
                  <span className="text-sm font-bold">{generating === "studio" ? "يُنشئ معاينة الاستوديو…" : "يُجهّز المعاينة…"}</span>
                </div>
              </div>
            )}
          </div>

          {/* مصغّرات المعاينة */}
          <div className="flex items-center gap-2 overflow-x-auto px-3 py-2.5">
            {[
              { k: "plain", label: "المنتج", thumb: IMG("bag-plain.png") },
              ...(uploaded ? [{ k: "fast", label: "سريعة", thumb: IMG("bag-plain.png") }] : []),
              ...(studioCount > 0 ? [{ k: "studio", label: "استوديو", thumb: IMG(studioImg) }] : []),
            ].map((t) => (
              <button
                key={t.k}
                onClick={() => (t.k === "fast" && preview !== "fast" ? runFast() : setPreview(t.k as any))}
                className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 ${preview === t.k ? "" : "border-slate-200"}`}
                style={preview === t.k ? { borderColor: SKY } : undefined}
                data-testid={`thumb-${t.k}`}
              >
                <img src={t.thumb} alt={t.label} className="h-full w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 bg-black/55 text-center text-[8px] font-bold text-white">{t.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* ===== معلومات المنتج ===== */}
        <section className="bg-white px-4 pb-4">
          <div className="mb-1 flex items-end gap-2">
            <span className="text-2xl font-extrabold" style={{ color: SKY }} data-testid="text-price">{yer(pieceNow)} ر.ي</span>
            <span className="mb-0.5 text-xs text-slate-400">/ حبة</span>
            <span className="mb-0.5 text-sm text-slate-400">≈ {sar(pieceNow)} ر.س</span>
            {bundle.save > 0 && <span className="mb-0.5 text-sm text-slate-400 line-through">{yer(perPieceBase)}</span>}
          </div>
          <h1 className="text-[17px] font-extrabold leading-snug text-slate-800" data-testid="text-title">
            كيس بلاستيك مطبوع حسب الطلب — جودة فاخرة
          </h1>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500">
            <span className="flex items-center gap-0.5 font-bold text-amber-500">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> 4.8
            </span>
            <span>(320 تقييم)</span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1 font-bold text-green-600"><Truck className="h-3.5 w-3.5" /> شحن مجاني</span>
          </div>
        </section>

        <div className="space-y-2.5 px-3 py-3">

          {/* ===== الخيارات الذكية الموحّدة ===== */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <SectionHead icon={<Layers className="h-4 w-4" />} title="الخيارات الذكية" tag="موحّدة في قسم واحد" />

            {/* اللون */}
            <Field label="اللون" value={color.name}>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button key={c.id} onClick={() => setColor(c)} data-testid={`color-${c.id}`}
                    className={`grid h-9 w-9 place-items-center rounded-full border-2 transition ${color.id === c.id ? "scale-110" : "border-slate-200"}`}
                    style={color.id === c.id ? { borderColor: SKY } : undefined} title={c.name}>
                    <span className="h-6 w-6 rounded-full border border-black/10" style={{ background: c.hex }} />
                  </button>
                ))}
              </div>
            </Field>

            {/* المقاس */}
            <Field label="المقاس" value={size.name}>
              <ChipRow items={SIZES} active={size.id} onPick={(i) => setSize(i as any)} prefix="size" />
            </Field>

            {/* الوزن */}
            <Field label="الوزن / السماكة" value={weight.name}>
              <ChipRow items={WEIGHTS} active={weight.id} onPick={(i) => setWeight(i as any)} prefix="weight" />
            </Field>

            {/* الكمية / الباقات */}
            <Field label="اختر الكمية / الباقة" value={`${bundle.count} حبة`}>
              <div className="grid grid-cols-3 gap-2">
                {BUNDLES.map((b) => (
                  <button key={b.id} onClick={() => setBundle(b)} data-testid={`bundle-${b.id}`}
                    className={`rounded-xl border-2 p-2 text-center transition ${bundle.id === b.id ? "bg-sky-50" : "border-slate-200"}`}
                    style={bundle.id === b.id ? { borderColor: SKY } : undefined}>
                    <div className="text-[13px] font-extrabold text-slate-800">{b.name}</div>
                    <div className={`text-[10px] font-bold ${b.save ? "text-green-600" : "text-slate-400"}`}>{b.note}</div>
                  </button>
                ))}
              </div>
            </Field>
          </div>

          {/* ===== حاسبة الطباعة الذكية ===== */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <SectionHead icon={<Palette className="h-4 w-4" />} title="حاسبة الطباعة الذكية" />

            {/* عدد الأوجه */}
            <Field label="عدد الأوجه" value={faces === 2 ? `وجهان (+${yer(FACE_SETUP)} ر.ي تجهيز)` : "وجه واحد (مجاني)"}>
              <div className="flex gap-2">
                {[1, 2].map((f) => (
                  <button key={f} onClick={() => setFaces(f as 1 | 2)} data-testid={`faces-${f}`}
                    className={`flex-1 rounded-xl border-2 py-2 text-sm font-bold transition ${faces === f ? "bg-sky-50 text-slate-800" : "border-slate-200 text-slate-500"}`}
                    style={faces === f ? { borderColor: SKY } : undefined}>
                    {f === 1 ? "وجه واحد" : "وجهان"}
                  </button>
                ))}
              </div>
            </Field>

            {/* لون الطباعة — الإصلاح */}
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-700">لون الطباعة</span>
                <NewTag text="يُقرأ من إعدادات المنتج" />
              </div>
              <div className="flex flex-wrap gap-2">
                {PRINT_COLORS.map((c) => (
                  <button key={c.id} onClick={() => setPrintColor(c)} data-testid={`print-${c.id}`}
                    className={`flex items-center gap-1.5 rounded-full border-2 py-1 pl-3 pr-1.5 text-xs font-bold transition ${printColor.id === c.id ? "bg-sky-50 text-slate-800" : "border-slate-200 text-slate-500"}`}
                    style={printColor.id === c.id ? { borderColor: SKY } : undefined}>
                    <span>{c.name}</span>
                    <span className="h-4 w-4 rounded-full border border-black/15" style={{ background: c.hex }} />
                  </button>
                ))}
              </div>
              {/* مؤشر تطبيق نفس اللون على الوجهين (الإصلاح) */}
              <div className="mt-2.5 flex items-center gap-2">
                {(faces === 2 ? ["الوجه الأمامي", "الوجه الخلفي"] : ["الوجه الأمامي"]).map((f) => (
                  <div key={f} className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5">
                    <span className="h-3.5 w-3.5 rounded-full border border-black/15" style={{ background: printColor.hex }} />
                    <span className="text-[11px] font-bold text-slate-600">{f}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
                <Info className="h-3 w-3" /> يُطبع نفس اللون ({printColor.name}) على {faces === 2 ? "الوجهين" : "الوجه"}.
              </p>
            </div>

            {/* عدد ألوان التصميم */}
            <div className="mt-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-slate-700">عدد ألوان التصميم</div>
                <div className="text-[11px] text-slate-400">اللون الأول مجاني — كل لون إضافي +{yer(COLOR_SETUP)} ر.ي</div>
              </div>
              <Stepper value={designColors} min={1} max={4} onChange={setDesignColors} testid="design-colors" />
            </div>
          </div>

          {/* ===== التصميم والمعاينة الحية (AI) ===== */}
          <div className="rounded-2xl border-2 bg-white p-4" style={{ borderColor: "#BBDEFB" }}>
            <SectionHead icon={<Sparkles className="h-4 w-4" />} title="صمّم واطبع شعارك" tag="معاينة AI — نانو بنانا" />

            {!uploaded ? (
              <button onClick={handleUpload} data-testid="button-upload"
                className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed py-7 text-center transition hover:bg-sky-50"
                style={{ borderColor: SKY }}>
                <span className="grid h-12 w-12 place-items-center rounded-full" style={{ background: "#E3F2FD", color: SKY }}>
                  <Upload className="h-6 w-6" />
                </span>
                <span className="text-sm font-extrabold text-slate-700">ارفع شعارك أو تصميمك</span>
                <span className="text-[11px] text-slate-400">PDF · PNG · AI · PSD</span>
              </button>
            ) : (
              <>
                {/* تبويبات: رفع / نص */}
                <div className="mb-3 flex rounded-xl bg-slate-100 p-1">
                  {[
                    { k: "upload", label: "التصميم المرفوع", icon: <ImageIcon className="h-4 w-4" /> },
                    { k: "text", label: "أضف نصاً", icon: <Type className="h-4 w-4" /> },
                  ].map((t) => (
                    <button key={t.k} onClick={() => setDesignTab(t.k as any)} data-testid={`tab-${t.k}`}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${designTab === t.k ? "bg-white text-slate-800 shadow" : "text-slate-500"}`}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>

                {designTab === "upload" ? (
                  <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5">
                    <img src={IMG("logo-cut.png")} alt="logo" className="h-14 w-14 rounded-lg border border-slate-200 bg-white object-contain p-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-1 text-sm font-bold text-slate-700"><BadgeCheck className="h-4 w-4 text-green-600" /> logo-cafe.png</div>
                      <div className="text-[11px] text-slate-400">تم الرفع بنجاح · 512×512</div>
                    </div>
                    <button onClick={() => { setUploaded(false); setPreview("plain"); setStudioCount(0); setTextMerged(false); }} className="grid h-8 w-8 place-items-center rounded-full hover:bg-slate-200">
                      <X className="h-4 w-4 text-slate-400" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="flex items-center gap-1 text-[11px] text-slate-400"><MessageSquare className="h-3 w-3" /> ادمج بيانات متجرك داخل التصميم تلقائياً.</p>
                    <ChatInput placeholder="اسم المتجر" value={txt.shop} onChange={(v) => setTxt({ ...txt, shop: v })} testid="shop" />
                    <ChatInput placeholder="رقم الهاتف" value={txt.phone} onChange={(v) => setTxt({ ...txt, phone: v })} testid="phone" />
                    <ChatInput placeholder="العنوان" value={txt.addr} onChange={(v) => setTxt({ ...txt, addr: v })} testid="addr" />
                    <ChatInput placeholder="نشاط المتجر (مثال: مقهى)" value={txt.activity} onChange={(v) => setTxt({ ...txt, activity: v })} testid="activity" />
                    <button onClick={mergeText} data-testid="button-merge-text" className="w-full rounded-xl py-2.5 text-sm font-bold text-white" style={{ background: SKY }}>
                      ادمج النص في التصميم
                    </button>
                    {textMerged && <p className="flex items-center gap-1 text-[11px] font-bold text-green-600"><Check className="h-3 w-3" /> أُضيف النص إلى المعاينة السريعة.</p>}
                  </div>
                )}

                {/* زرّا المعاينة المزدوجة */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={runFast} disabled={busy} data-testid="button-preview-fast"
                    className="flex flex-col items-center gap-0.5 rounded-xl border-2 py-2.5 disabled:opacity-50" style={{ borderColor: "#90CAF9" }}>
                    <span className="flex items-center gap-1 text-sm font-bold text-slate-700"><Zap className="h-4 w-4" style={{ color: SKY }} /> معاينة سريعة</span>
                    <span className="text-[10px] font-bold text-green-600">مجانية · فورية</span>
                  </button>
                  <button onClick={() => runStudio()} disabled={busy} data-testid="button-preview-studio"
                    className="flex flex-col items-center gap-0.5 rounded-xl py-2.5 text-white disabled:opacity-50" style={{ background: SKY }}>
                    <span className="flex items-center gap-1 text-sm font-bold"><Sparkles className="h-4 w-4" /> معاينة استوديو AI</span>
                    <span className="text-[10px] font-bold text-white/90">{studioCount === 0 ? "الأولى مجانية 🎉" : `+${STUDIO_EXTRA} ر.ي للسلة`}</span>
                  </button>
                </div>

                {/* بدائل مقترحة — تظهر بعد الرفع فقط */}
                <div className="mt-4">
                  <div className="mb-2 flex items-center gap-1 text-sm font-bold text-slate-700">
                    <Gift className="h-4 w-4" style={{ color: SKY }} /> تصاميم بديلة مقترحة
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {ALTS.map((a) => (
                      <button key={a.id} onClick={() => runStudio(a.img)} disabled={busy} data-testid={`alt-${a.id}`}
                        className={`overflow-hidden rounded-xl border-2 text-center transition disabled:opacity-50 ${preview === "studio" && studioImg === a.img ? "" : "border-slate-200"}`}
                        style={preview === "studio" && studioImg === a.img ? { borderColor: SKY } : undefined}>
                        <img src={IMG(a.img)} alt={a.name} className="aspect-square w-full object-cover" />
                        <div className="bg-slate-50 px-1 py-1 text-[9px] font-bold text-slate-600">{a.name}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ===== جدول أسعار الكميات ===== */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <SectionHead icon={<Layers className="h-4 w-4" />} title="عروض الكميات" tag="كلما زادت الكمية قلّ السعر" />
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-2 bg-slate-50 text-xs font-bold text-slate-500">
                <div className="px-3 py-2">الكمية</div>
                <div className="px-3 py-2">سعر الحبة</div>
              </div>
              {VOLUME_TIERS.map((t, i) => (
                <div key={i} className="grid grid-cols-2 border-t border-slate-100 text-sm">
                  <div className="px-3 py-2 font-bold text-slate-700">{t.qty}</div>
                  <div className="px-3 py-2" style={{ color: SKY }}>{yer(BASE * (1 - t.off / 100))} ر.ي</div>
                </div>
              ))}
            </div>
          </div>

          {/* ===== ضمانات ===== */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: <ShieldCheck className="h-5 w-5" />, t: "جودة مضمونة" },
              { icon: <Truck className="h-5 w-5" />, t: "شحن لكل اليمن" },
              { icon: <Camera className="h-5 w-5" />, t: "معاينة قبل الطباعة" },
            ].map((b, i) => (
              <div key={i} className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 bg-white p-3 text-center">
                <span style={{ color: SKY }}>{b.icon}</span>
                <span className="text-[10px] font-bold text-slate-600">{b.t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== الشريط السفلي الثابت ===== */}
      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[480px] border-t border-slate-200 bg-white/95 px-3 py-2.5 backdrop-blur">
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-500">
          <span>{bundle.count} حبة × {yer(pieceNow)} ر.ي{setupFees ? ` + ${yer(setupFees)} تجهيز` : ""}</span>
          <span className="text-base font-extrabold" style={{ color: SKY }} data-testid="text-total">{yer(grandTotal)} ر.ي</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
            <Layers className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-extrabold text-slate-800" data-testid="text-bundle-qty">{bundle.count}</span>
          </div>
          <button onClick={addToCart} data-testid="button-add-cart"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-extrabold text-white" style={{ background: SKY }}>
            <ShoppingCart className="h-4 w-4" /> أضف إلى السلة
          </button>
        </div>
      </div>

      {/* ===== Toast ===== */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-lg" data-testid="toast">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ---------- مكوّنات مساعدة ---------- */
function Field({ label, value, children }: { label: string; value?: string; children: ReactNode }) {
  return (
    <div className="mt-3 first:mt-0">
      <div className="mb-1.5 flex items-center gap-1.5 text-sm">
        <span className="font-bold text-slate-700">{label}</span>
        {value && <span className="text-slate-400">: {value}</span>}
      </div>
      {children}
    </div>
  );
}

function ChipRow({ items, active, onPick, prefix }: { items: { id: string; name: string }[]; active: string; onPick: (i: any) => void; prefix: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => (
        <button key={it.id} onClick={() => onPick(it)} data-testid={`${prefix}-${it.id}`}
          className={`rounded-full border-2 px-3 py-1.5 text-xs font-bold transition ${active === it.id ? "bg-sky-50 text-slate-800" : "border-slate-200 text-slate-500"}`}
          style={active === it.id ? { borderColor: SKY } : undefined}>
          {it.name}
        </button>
      ))}
    </div>
  );
}

function Stepper({ value, min, max, onChange, testid }: { value: number; min: number; max: number; onChange: (n: number) => void; testid: string }) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
      <button onClick={() => onChange(Math.max(min, value - 1))} data-testid={`${testid}-minus`} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-slate-100">
        <Minus className="h-4 w-4 text-slate-600" />
      </button>
      <span className="w-7 text-center text-sm font-extrabold text-slate-800" data-testid={`${testid}-value`}>{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} data-testid={`${testid}-plus`} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-slate-100">
        <Plus className="h-4 w-4 text-slate-600" />
      </button>
    </div>
  );
}

function ChatInput({ placeholder, value, onChange, testid }: { placeholder: string; value: string; onChange: (v: string) => void; testid: string }) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} data-testid={`input-${testid}`}
      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-400" />
  );
}
