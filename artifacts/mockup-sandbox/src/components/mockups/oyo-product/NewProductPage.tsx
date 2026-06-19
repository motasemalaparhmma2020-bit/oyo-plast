import React from "react";
import { useState, useRef, type ReactNode } from "react";
import {
  ChevronRight, Star, Search, ShoppingCart, Heart, Share2,
  Upload, Sparkles, Zap, Image as ImageIcon, MessageSquare,
  Check, Info, Loader2, Plus, Minus, Truck, ShieldCheck, Palette,
  Layers, Type, X, BadgeCheck, Gift, Camera,
} from "lucide-react";

const SKY = "#2196F3";
const RATE = 50;
const IMG = (n: string) => `/__mockup/images/${n}`;
const yer = (n: number) => Math.round(n).toLocaleString("ar-EG");
const sar = (n: number) => (n / RATE).toLocaleString("ar-EG", { maximumFractionDigits: 1 });

/* --------- 8 ألوان للكيس — CSS filter على صورة الكيس الأزرق الأصلية --------- */
/*
  صورة bag-plain.png أزرق (hue ~207°).
  نستخدم filter مباشرة على الـ img لإعادة تلوينها بدلاً من overlay منفصل.
  القيم محسوبة يدوياً لتقريب اللون المطلوب.
*/
const BAG_COLORS = [
  { id: "blue",  name: "أزرق",  hex: "#2196F3", add: 0,  filter: "none" },
  { id: "white", name: "أبيض",  hex: "#F4F6F8", add: 0,  filter: "saturate(0%) brightness(2.2)" },
  { id: "navy",  name: "كحلي",  hex: "#1B2A4A", add: 20, filter: "hue-rotate(15deg) saturate(180%) brightness(35%)" },
  { id: "kraft", name: "كرافت", hex: "#C9A06B", add: 30, filter: "hue-rotate(-55deg) saturate(65%) brightness(95%)" },
  { id: "black", name: "أسود",  hex: "#1A1A1A", add: 20, filter: "saturate(0%) brightness(10%)" },
  { id: "green", name: "أخضر",  hex: "#2E7D32", add: 20, filter: "hue-rotate(130deg) saturate(160%) brightness(65%)" },
  { id: "red",   name: "أحمر",  hex: "#C62828", add: 20, filter: "hue-rotate(162deg) saturate(280%) brightness(65%)" },
  { id: "pink",  name: "وردي",  hex: "#E91E8C", add: 30, filter: "hue-rotate(-145deg) saturate(300%) brightness(90%)" },
];

/* --------- 8 ألوان طباعة --------- */
const PRINT_COLORS = [
  { id: "black",  name: "أسود",      hex: "#1A1A1A", filter: "brightness(0)" },
  { id: "gold",   name: "ذهبي",      hex: "#C9A227", filter: "brightness(0) saturate(100%) invert(65%) sepia(80%) saturate(600%) hue-rotate(5deg) brightness(90%)" },
  { id: "silver", name: "فضي",       hex: "#9E9E9E", filter: "brightness(0) saturate(0%) invert(60%) brightness(110%)" },
  { id: "white",  name: "أبيض",      hex: "#FFFFFF", filter: "brightness(0) invert(100%)" },
  { id: "red",    name: "أحمر",      hex: "#E53935", filter: "brightness(0) saturate(100%) invert(20%) sepia(100%) saturate(700%) hue-rotate(340deg) brightness(90%)" },
  { id: "blue",   name: "أزرق",      hex: "#2196F3", filter: "brightness(0) saturate(100%) invert(42%) sepia(90%) saturate(400%) hue-rotate(190deg) brightness(100%)" },
  { id: "green",  name: "أخضر",      hex: "#2E7D32", filter: "brightness(0) saturate(100%) invert(30%) sepia(80%) saturate(500%) hue-rotate(90deg) brightness(80%)" },
  { id: "pink",   name: "وردي",      hex: "#E91E8C", filter: "brightness(0) saturate(100%) invert(20%) sepia(100%) saturate(700%) hue-rotate(295deg) brightness(95%)" },
];

const SIZES = [
  { id: "s", name: "صغير 20×30", add: 0 },
  { id: "m", name: "وسط 30×40",  add: 60 },
  { id: "l", name: "كبير 40×50", add: 120 },
];
const WEIGHTS = [
  { id: "light", name: "خفيف",      add: 0 },
  { id: "med",   name: "متوسط",     add: 40 },
  { id: "heavy", name: "سميك فاخر", add: 90 },
];
const BUNDLES = [
  { id: "b100",  name: "100 حبة",    count: 100,  save: 0,  note: "السعر الأساسي" },
  { id: "b500",  name: "500 حبة",    count: 500,  save: 12, note: "وفّر 12٪"       },
  { id: "b1000", name: "1000 حبة 🎁", count: 1000, save: 20, note: "وفّر 20٪"       },
];

const BASE = 600;
const FACE_SETUP  = 1500;
const COLOR_SETUP = 800;
const STUDIO_EXTRA = 100;

const VOLUME_TIERS = [
  { qty: "100 – 499",  off: 0  },
  { qty: "500 – 999",  off: 12 },
  { qty: "1000 فأكثر", off: 20 },
];

/* --------- helper components --------- */
function NewTag({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: SKY }}>
      <Sparkles className="h-3 w-3" /> {text}
    </span>
  );
}
function SectionHead({ icon, title, tag }: { icon: ReactNode; title: string; tag?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: "#E3F2FD", color: SKY }}>{icon}</span>
        <h3 className="text-[15px] font-extrabold text-slate-800">{title}</h3>
      </div>
      {tag && <NewTag text={tag} />}
    </div>
  );
}
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

/* ===== الصفحة الرئيسية ===== */
export function NewProductPage() {
  const [bagColor,    setBagColor]    = useState(BAG_COLORS[0]);
  const [printColor,  setPrintColor]  = useState(PRINT_COLORS[1]); // ذهبي
  const [size,        setSize]        = useState(SIZES[0]);
  const [weight,      setWeight]      = useState(WEIGHTS[0]);
  const [bundle,      setBundle]      = useState(BUNDLES[0]);
  const [faces,       setFaces]       = useState<1|2>(1);
  const [designColors,setDesignColors]= useState(1);

  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [designTab,    setDesignTab]    = useState<"upload"|"text">("upload");
  const [txt,          setTxt]          = useState({ shop: "", phone: "", addr: "", activity: "" });

  const [preview,     setPreview]     = useState<"plain"|"fast"|"studio">("plain");
  const [studioCount, setStudioCount] = useState(0);
  const [generating,  setGenerating]  = useState<null|"fast"|"studio">(null);
  const [cartCount,   setCartCount]   = useState(0);
  const [toast,       setToast]       = useState<string|null>(null);
  const [wish,        setWish]        = useState(false);

  const toastTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const showToast  = (m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };

  /* حسابات السعر */
  const perPieceBase = BASE + bagColor.add + size.add + weight.add;
  const pieceNow     = Math.round(perPieceBase * (1 - bundle.save / 100));
  const piecesTotal  = pieceNow * bundle.count;
  const facesFee     = faces === 2 ? FACE_SETUP : 0;
  const colorsFee    = (designColors - 1) * COLOR_SETUP;
  const studioFee    = Math.max(0, studioCount - 1) * STUDIO_EXTRA;
  const setupFees    = facesFee + colorsFee + studioFee;
  const grandTotal   = piecesTotal + setupFees;

  const busy      = generating !== null;
  const hasLogo   = !!uploadedFile;
  const hasText   = !!(txt.shop || txt.phone || txt.addr || txt.activity);
  /* النص يظهر فوراً على المعاينة السريعة */
  const showOverlay = preview === "fast" && (hasLogo || hasText);

  /* ---- رفع الملف ---- */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (uploadedFile) URL.revokeObjectURL(uploadedFile);
    const url = URL.createObjectURL(file);
    setUploadedFile(url);
    setPreview("fast"); // تبديل تلقائي للمعاينة السريعة
    showToast("✓ تم رفع الشعار — تشاهد المعاينة الآن!");
    /* إعادة تعيين input حتى يمكن رفع نفس الملف مجدداً */
    e.target.value = "";
  };

  const clearUpload = () => {
    if (uploadedFile) URL.revokeObjectURL(uploadedFile);
    setUploadedFile(null);
    if (!hasText) setPreview("plain");
    showToast("تم حذف الشعار");
  };

  /* ---- معاينة سريعة ---- */
  const runFast = () => {
    if (busy) return;
    setGenerating("fast");
    setTimeout(() => { setGenerating(null); setPreview("fast"); showToast("معاينة سريعة مجانية ✓"); }, 500);
  };

  /* ---- معاينة استوديو AI ---- */
  const STUDIO_IMGS = ["bag-studio.png", "alt-1.png", "alt-2.png", "alt-3.png"];
  const runStudio = (img = STUDIO_IMGS[0]) => {
    if (busy) return;
    setGenerating("studio");
    setTimeout(() => {
      setStudioCount(c => c + 1);
      setPreview("studio");
      setGenerating(null);
      showToast(studioCount === 0 ? "معاينة استوديو AI — مجانية 🎉" : `+${STUDIO_EXTRA} ر.ي أُضيفت للسلة`);
    }, 1400);
  };

  const addToCart = () => {
    setCartCount(c => c + 1);
    showToast(`أُضيف للسلة: ${bundle.count} حبة · ${yer(grandTotal)} ر.ي ✓`);
  };

  return (
    <div dir="rtl" className="min-h-screen w-full bg-slate-100" style={{ fontFamily: "Cairo, Tajawal, sans-serif" }}>
      <div className="mx-auto max-w-[480px] bg-slate-50 pb-28 shadow-xl">

        {/* شريط علوي */}
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

        {/* ===== صورة المنتج مع المعاينة ===== */}
        <section className="relative bg-white">
          <div className="relative aspect-square w-full overflow-hidden" style={{ background: "#F0F4F8" }}>

            {/* الكيس — الصورة الأساسية مع CSS filter مباشر لتغيير اللون */}
            <img
              src={preview === "studio" ? IMG("bag-studio.png") : IMG("bag-plain.png")}
              alt="الكيس"
              data-testid="img-product-main"
              className="h-full w-full object-contain transition-all duration-300"
              style={{ filter: preview === "studio" ? "none" : bagColor.filter }}
            />

            {/* ===== طبقة المعاينة السريعة: شعار + نص ===== */}
            {showOverlay && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2">

                {/* الشعار المرفوع ملوّن بلون الطباعة */}
                {hasLogo && (
                  <img
                    src={uploadedFile!}
                    alt="logo"
                    className="w-[30%] object-contain"
                    style={{
                      filter: `${printColor.filter} drop-shadow(0 1px 4px rgba(0,0,0,.3))`,
                    }}
                  />
                )}

                {/* النص يظهر فوراً بلون الطباعة */}
                {hasText && (
                  <div className="text-center leading-tight">
                    {txt.shop     && <div className="text-[15px] font-extrabold" style={{ color: printColor.hex, textShadow: "0 1px 3px rgba(0,0,0,.4)" }}>{txt.shop}</div>}
                    {txt.activity && <div className="text-[11px] font-bold"      style={{ color: printColor.hex, textShadow: "0 1px 2px rgba(0,0,0,.35)" }}>{txt.activity}</div>}
                    {txt.phone    && <div className="text-[11px] font-bold"      style={{ color: printColor.hex, textShadow: "0 1px 2px rgba(0,0,0,.35)" }}>{txt.phone}</div>}
                    {txt.addr     && <div className="text-[10px]"               style={{ color: printColor.hex, textShadow: "0 1px 2px rgba(0,0,0,.3)"  }}>{txt.addr}</div>}
                  </div>
                )}
              </div>
            )}

            {/* شارة نوع المعاينة */}
            {preview !== "plain" && (
              <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">
                {preview === "studio"
                  ? <><Sparkles className="h-3 w-3" /> معاينة استوديو AI</>
                  : <><Zap className="h-3 w-3" /> معاينة سريعة — {printColor.name}</>}
              </div>
            )}

            {/* شارة الخصم */}
            {bundle.save > 0 && (
              <div className="absolute right-3 top-3 rounded-lg bg-red-500 px-2 py-1 text-xs font-bold text-white shadow">
                وفّر {bundle.save}٪
              </div>
            )}

            {/* أزرار جانبية */}
            <div className="absolute bottom-3 left-3 flex flex-col gap-2">
              <button onClick={() => setWish(!wish)} data-testid="button-wishlist" className="grid h-9 w-9 place-items-center rounded-full bg-white/90 shadow">
                <Heart className={`h-4 w-4 ${wish ? "fill-red-500 text-red-500" : "text-slate-600"}`} />
              </button>
              <button className="grid h-9 w-9 place-items-center rounded-full bg-white/90 shadow">
                <Share2 className="h-4 w-4 text-slate-600" />
              </button>
            </div>

            {/* تحميل */}
            {busy && (
              <div className="absolute inset-0 grid place-items-center bg-white/70 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin" style={{ color: SKY }} />
                  <span className="text-sm font-bold text-slate-700">
                    {generating === "studio" ? "يُنشئ معاينة استوديو…" : "يُجهّز المعاينة…"}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* مصغّرات */}
          <div className="flex items-center gap-2 overflow-x-auto px-3 py-2.5">
            {[
              { k: "plain",  label: "المنتج",  thumb: IMG("bag-plain.png")  },
              ...(hasLogo || hasText ? [{ k: "fast",   label: "سريعة",   thumb: IMG("bag-plain.png")  }] : []),
              ...(studioCount > 0   ? [{ k: "studio", label: "استوديو", thumb: IMG("bag-studio.png") }] : []),
            ].map((t) => (
              <button
                key={t.k}
                onClick={() => t.k === "fast" && preview !== "fast" ? runFast() : setPreview(t.k as any)}
                data-testid={`thumb-${t.k}`}
                className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 transition ${preview === t.k ? "" : "border-slate-200"}`}
                style={preview === t.k ? { borderColor: SKY } : undefined}
              >
                <img src={t.thumb} alt={t.label} className="h-full w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 bg-black/55 text-center text-[8px] font-bold text-white">{t.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* معلومات المنتج */}
        <section className="bg-white px-4 pb-4">
          <div className="mb-1 flex items-end gap-2">
            <span className="text-2xl font-extrabold" style={{ color: SKY }} data-testid="text-price">{yer(pieceNow)} ر.ي</span>
            <span className="mb-0.5 text-xs text-slate-400">/ حبة</span>
            <span className="mb-0.5 text-sm text-slate-400">≈ {sar(pieceNow)} ر.س</span>
            {bundle.save > 0 && <span className="mb-0.5 text-sm text-slate-400 line-through">{yer(perPieceBase)}</span>}
          </div>
          <h1 className="text-[17px] font-extrabold leading-snug text-slate-800">
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

          {/* ===== الخيارات الذكية ===== */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <SectionHead icon={<Layers className="h-4 w-4" />} title="الخيارات الذكية" tag="موحّدة في قسم واحد" />

            {/* لون الكيس — 8 ألوان */}
            <Field label="لون الكيس" value={bagColor.name}>
              <div className="flex flex-wrap gap-2">
                {BAG_COLORS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setBagColor(c); if (preview === "plain") {} }}
                    data-testid={`color-${c.id}`}
                    title={c.name}
                    className={`relative grid h-10 w-10 place-items-center rounded-full border-2 transition ${bagColor.id === c.id ? "scale-110" : "border-slate-200"}`}
                    style={bagColor.id === c.id ? { borderColor: SKY } : undefined}
                  >
                    <span className="h-7 w-7 rounded-full border border-black/10" style={{ background: c.hex }} />
                    {bagColor.id === c.id && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <Check className="h-3.5 w-3.5 text-white drop-shadow" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </Field>

            {/* المقاس */}
            <Field label="المقاس" value={size.name}>
              <ChipRow items={SIZES} active={size.id} onPick={(i) => setSize(i)} prefix="size" />
            </Field>

            {/* الوزن */}
            <Field label="الوزن / السماكة" value={weight.name}>
              <ChipRow items={WEIGHTS} active={weight.id} onPick={(i) => setWeight(i)} prefix="weight" />
            </Field>

            {/* الكمية */}
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

          {/* ===== حاسبة الطباعة ===== */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <SectionHead icon={<Palette className="h-4 w-4" />} title="حاسبة الطباعة الذكية" />

            {/* عدد الأوجه */}
            <Field label="عدد الأوجه" value={faces === 2 ? `وجهان (+${yer(FACE_SETUP)} ر.ي)` : "وجه واحد (مجاني)"}>
              <div className="flex gap-2">
                {([1, 2] as const).map((f) => (
                  <button key={f} onClick={() => setFaces(f)} data-testid={`faces-${f}`}
                    className={`flex-1 rounded-xl border-2 py-2 text-sm font-bold transition ${faces === f ? "bg-sky-50 text-slate-800" : "border-slate-200 text-slate-500"}`}
                    style={faces === f ? { borderColor: SKY } : undefined}>
                    {f === 1 ? "وجه واحد" : "وجهان"}
                  </button>
                ))}
              </div>
            </Field>

            {/* لون الطباعة — 8 ألوان */}
            <div className="mt-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-700">لون الطباعة</span>
                <span className="text-[11px] text-slate-400">{printColor.name} — يظهر على الشعار</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {PRINT_COLORS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setPrintColor(c)}
                    data-testid={`print-${c.id}`}
                    title={c.name}
                    className={`flex items-center gap-1.5 rounded-full border-2 py-1.5 pl-3 pr-2 text-xs font-bold transition ${printColor.id === c.id ? "bg-sky-50 text-slate-800" : "border-slate-200 text-slate-500"}`}
                    style={printColor.id === c.id ? { borderColor: SKY } : undefined}
                  >
                    {c.name}
                    <span
                      className="h-4 w-4 rounded-full border border-black/20"
                      style={{ background: c.hex, boxShadow: c.id === "white" ? "inset 0 0 0 1px #ccc" : undefined }}
                    />
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(faces === 2 ? ["الوجه الأمامي", "الوجه الخلفي"] : ["الوجه الأمامي"]).map((f) => (
                  <div key={f} className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5">
                    <span className="h-3.5 w-3.5 rounded-full border border-black/15" style={{ background: printColor.hex }} />
                    <span className="text-[11px] font-bold text-slate-600">{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* عدد ألوان التصميم */}
            <div className="mt-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-slate-700">عدد ألوان التصميم</div>
                <div className="text-[11px] text-slate-400">اللون الأول مجاني — كل لون +{yer(COLOR_SETUP)} ر.ي</div>
              </div>
              <Stepper value={designColors} min={1} max={8} onChange={setDesignColors} testid="design-colors" />
            </div>
          </div>

          {/* ===== رفع الشعار / النص ===== */}
          <div className="rounded-2xl border-2 bg-white p-4" style={{ borderColor: "#BBDEFB" }}>
            <SectionHead icon={<Sparkles className="h-4 w-4" />} title="صمّم واطبع شعارك" tag="معاينة فورية" />

            {/* تبويبات */}
            <div className="mb-3 flex rounded-xl bg-slate-100 p-1">
              {[
                { k: "upload", label: "ارفع تصميم", icon: <ImageIcon className="h-4 w-4" /> },
                { k: "text",   label: "أضف نصاً",   icon: <Type       className="h-4 w-4" /> },
              ].map((t) => (
                <button key={t.k} onClick={() => setDesignTab(t.k as any)} data-testid={`tab-${t.k}`}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${designTab === t.k ? "bg-white text-slate-800 shadow" : "text-slate-500"}`}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {designTab === "upload" ? (
              <div>
                {!uploadedFile ? (
                  /* ---- زر الرفع — label بدل button.click ---- */
                  <label
                    htmlFor="file-upload"
                    className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed py-7 text-center transition hover:bg-sky-50"
                    style={{ borderColor: SKY }}
                    data-testid="label-upload"
                  >
                    <span className="grid h-12 w-12 place-items-center rounded-full" style={{ background: "#E3F2FD", color: SKY }}>
                      <Upload className="h-6 w-6" />
                    </span>
                    <span className="text-sm font-extrabold text-slate-700">اضغط هنا لرفع شعارك</span>
                    <span className="text-[11px] text-slate-400">PNG · JPG · PDF · PSD</span>
                    <input
                      id="file-upload"
                      type="file"
                      accept="image/*,.pdf,.ai,.psd"
                      onChange={handleFileChange}
                      className="hidden"
                      data-testid="input-file"
                    />
                  </label>
                ) : (
                  /* ---- معاينة الملف المرفوع ---- */
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5">
                      <img src={uploadedFile} alt="logo" className="h-14 w-14 rounded-lg border border-slate-200 bg-white object-contain p-1" />
                      <div className="flex-1">
                        <div className="flex items-center gap-1 text-sm font-bold text-slate-700">
                          <BadgeCheck className="h-4 w-4 text-green-600" /> تم الرفع بنجاح
                        </div>
                        <div className="text-[11px] text-slate-400">يظهر على الكيس أعلاه بلون الطباعة المختار</div>
                      </div>
                      <button onClick={clearUpload} className="grid h-8 w-8 place-items-center rounded-full hover:bg-slate-200" data-testid="button-clear-upload">
                        <X className="h-4 w-4 text-slate-400" />
                      </button>
                    </div>

                    {/* رفع شعار مختلف */}
                    <label
                      htmlFor="file-reupload"
                      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50"
                    >
                      <Upload className="h-3.5 w-3.5" /> رفع شعار مختلف
                      <input
                        id="file-reupload"
                        type="file"
                        accept="image/*,.pdf,.ai,.psd"
                        onChange={handleFileChange}
                        className="hidden"
                        data-testid="input-reupload"
                      />
                    </label>
                  </div>
                )}
              </div>
            ) : (
              /* ---- تبويب النص ---- */
              <div className="space-y-2">
                <p className="flex items-center gap-1 text-[11px] text-slate-400">
                  <MessageSquare className="h-3 w-3" /> النص يظهر فوراً على الكيس أعلاه
                </p>
                {[
                  { key: "shop",     ph: "اسم المتجر أو العلامة التجارية" },
                  { key: "phone",    ph: "رقم الهاتف"                     },
                  { key: "addr",     ph: "العنوان"                         },
                  { key: "activity", ph: "نشاط المتجر (مثال: مقهى، ملابس)" },
                ].map(({ key, ph }) => (
                  <input
                    key={key}
                    value={(txt as any)[key]}
                    onChange={(e) => {
                      const next = { ...txt, [key]: e.target.value };
                      setTxt(next);
                      /* التبديل التلقائي للمعاينة السريعة عند الكتابة */
                      const any = !!(next.shop || next.phone || next.addr || next.activity);
                      if (any && preview === "plain") setPreview("fast");
                      if (!any && !uploadedFile)     setPreview("plain");
                    }}
                    placeholder={ph}
                    data-testid={`input-${key}`}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-sky-400"
                  />
                ))}
                {hasText && (
                  <p className="flex items-center gap-1 text-[11px] font-bold text-green-600">
                    <Check className="h-3 w-3" /> النص يظهر على الكيس بلون الطباعة ({printColor.name})
                  </p>
                )}
              </div>
            )}

            {/* أزرار المعاينة */}
            {(hasLogo || hasText) && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={runFast}
                  disabled={busy}
                  data-testid="button-preview-fast"
                  className="flex flex-col items-center gap-0.5 rounded-xl border-2 py-2.5 disabled:opacity-50"
                  style={{ borderColor: "#90CAF9" }}
                >
                  <span className="flex items-center gap-1 text-sm font-bold text-slate-700">
                    <Zap className="h-4 w-4" style={{ color: SKY }} /> معاينة سريعة
                  </span>
                  <span className="text-[10px] font-bold text-green-600">مجانية · فورية</span>
                </button>
                <button
                  onClick={() => runStudio()}
                  disabled={busy}
                  data-testid="button-preview-studio"
                  className="flex flex-col items-center gap-0.5 rounded-xl py-2.5 text-white disabled:opacity-50"
                  style={{ background: SKY }}
                >
                  <span className="flex items-center gap-1 text-sm font-bold">
                    <Sparkles className="h-4 w-4" /> استوديو AI
                  </span>
                  <span className="text-[10px] font-bold text-white/90">
                    {studioCount === 0 ? "الأولى مجانية 🎉" : `+${STUDIO_EXTRA} ر.ي`}
                  </span>
                </button>
              </div>
            )}

            {/* تصاميم بديلة مقترحة */}
            {studioCount > 0 && (
              <div className="mt-4">
                <div className="mb-2 flex items-center gap-1 text-sm font-bold text-slate-700">
                  <Gift className="h-4 w-4" style={{ color: SKY }} /> تصاميم بديلة مقترحة
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { img: "alt-1.png", name: "شعار أعلى الكيس" },
                    { img: "alt-2.png", name: "شعار كبير بالوسط" },
                    { img: "alt-3.png", name: "نمط متكرر فاخر" },
                  ].map((a) => (
                    <button key={a.img} onClick={() => runStudio(a.img)} disabled={busy}
                      className="overflow-hidden rounded-xl border-2 border-slate-200 text-center transition hover:border-sky-300 disabled:opacity-50">
                      <img src={IMG(a.img)} alt={a.name} className="aspect-square w-full object-cover" />
                      <div className="bg-slate-50 px-1 py-1 text-[9px] font-bold text-slate-600">{a.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* جدول أسعار الكميات */}
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
                  <div className="px-3 py-2 font-bold" style={{ color: SKY }}>{yer(BASE * (1 - t.off / 100))} ر.ي</div>
                </div>
              ))}
            </div>
          </div>

          {/* ضمانات */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: <ShieldCheck className="h-5 w-5" />, t: "جودة مضمونة" },
              { icon: <Truck       className="h-5 w-5" />, t: "شحن لكل اليمن" },
              { icon: <Camera      className="h-5 w-5" />, t: "معاينة قبل الطباعة" },
            ].map((b, i) => (
              <div key={i} className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 bg-white p-3 text-center">
                <span style={{ color: SKY }}>{b.icon}</span>
                <span className="text-[10px] font-bold text-slate-600">{b.t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* الشريط السفلي */}
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
          <button
            onClick={addToCart}
            data-testid="button-add-cart"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-extrabold text-white"
            style={{ background: SKY }}
          >
            <ShoppingCart className="h-4 w-4" /> أضف إلى السلة
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-lg" data-testid="toast">
          {toast}
        </div>
      )}
    </div>
  );
}
