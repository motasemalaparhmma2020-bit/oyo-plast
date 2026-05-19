import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, ArrowRight, ImageOff } from "lucide-react";

function getAdminToken(): string {
  return localStorage.getItem("admin_token") || "";
}

type ProductDiag = {
  id: number;
  name: string;
  isActive: boolean;
  productType: string | null;
  mainImage: { url: string | null; ok: boolean; status: number | string };
  gallery: { count: number; checked: number; broken: number };
  cloudinary: { publicId: string | null; hasCloudName: boolean; previewUrl: string | null; ok: boolean | null; status: any };
  availableColors: { present: boolean; valid: boolean; count: number; raw: string | null };
  printColorOptions: { present: boolean; valid: boolean; count: number };
  quantityTiers: { present: boolean; valid: boolean; count: number; data: any[] | null };
  smartVariants: { present: boolean; valid: boolean; count: number; activeTypes: string[] };
};

type DiagResponse = {
  summary: {
    totalProducts: number;
    activeProducts: number;
    brokenMainImages: number;
    withCloudinary: number;
    cloudinaryBroken: number;
    withAvailableColors: number;
    invalidColorsJson: number;
    withTiers: number;
    cloudName: string;
  };
  products: ProductDiag[];
};

function Status({ ok, label }: { ok: boolean | null; label?: string }) {
  if (ok === null) return <span className="text-xs text-gray-400">—</span>;
  return ok ? (
    <span className="inline-flex items-center gap-1 text-green-600 text-xs font-bold">
      <CheckCircle2 className="h-3.5 w-3.5" /> {label || "سليم"}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-red-600 text-xs font-bold">
      <XCircle className="h-3.5 w-3.5" /> {label || "مكسور"}
    </span>
  );
}

export default function AdminDiagnostics() {
  const [, setLocation] = useLocation();
  const [data, setData] = useState<DiagResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/diagnostics", {
        headers: { "x-admin-token": getAdminToken() },
      });
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
      setData(await r.json());
    } catch (e: any) {
      setError(e.message || "فشل الفحص");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { run(); }, []);

  const fixes = data ? buildFixList(data.products) : [];

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/admin")}
            className="flex items-center gap-1 text-sm text-sky-600 hover:underline"
            data-testid="link-back-admin"
          >
            <ArrowRight className="h-4 w-4" /> العودة للأدمن
          </button>
          <h1 className="text-2xl font-bold flex-1">🔍 فحص تشخيصي للمنتجات</h1>
          <button
            onClick={run}
            disabled={loading}
            className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
            data-testid="button-rerun-diagnostics"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            إعادة الفحص
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-800 p-4 rounded-lg" data-testid="alert-error">
            ❌ {error}
            {error.includes("401") && (
              <p className="mt-2 text-sm">سجّل دخول الأدمن أولاً ثم عُد لهذه الصفحة.</p>
            )}
          </div>
        )}

        {loading && !data && (
          <div className="text-center py-12 text-gray-500">جاري الفحص…</div>
        )}

        {data && (
          <>
            {/* ── Summary ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard label="إجمالي المنتجات" value={data.summary.totalProducts} />
              <SummaryCard label="المنتجات الفعّالة" value={data.summary.activeProducts} tone="green" />
              <SummaryCard label="صور رئيسية مكسورة" value={data.summary.brokenMainImages} tone={data.summary.brokenMainImages > 0 ? "red" : "green"} />
              <SummaryCard label="منتجات بـ Cloudinary" value={data.summary.withCloudinary} tone="sky" />
              <SummaryCard label="Cloudinary مكسورة" value={data.summary.cloudinaryBroken} tone={data.summary.cloudinaryBroken > 0 ? "red" : "green"} />
              <SummaryCard label="بألوان متاحة (JSON)" value={data.summary.withAvailableColors} tone="purple" />
              <SummaryCard label="JSON خاطئ" value={data.summary.invalidColorsJson} tone={data.summary.invalidColorsJson > 0 ? "red" : "green"} />
              <SummaryCard label="بعروض كميات" value={data.summary.withTiers} tone="amber" />
            </div>

            <div className="text-xs text-gray-500 text-center" data-testid="text-cloudname">
              Cloudinary Cloud Name: <strong>{data.summary.cloudName}</strong>
            </div>

            {/* ── Fix list ── */}
            {fixes.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300 rounded-xl p-4">
                <h3 className="font-bold text-amber-900 dark:text-amber-100 mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" /> ⚠️ مشاكل تحتاج إصلاحاً ({fixes.length})
                </h3>
                <ul className="space-y-1 text-sm text-amber-900 dark:text-amber-100">
                  {fixes.map((f, i) => (
                    <li key={i} className="flex gap-2" data-testid={`fix-item-${i}`}>
                      <span className="font-bold">#{f.productId}</span>
                      <span>{f.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── Products table ── */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                  <tr>
                    <th className="p-2 text-right">ID</th>
                    <th className="p-2 text-right">المنتج</th>
                    <th className="p-2 text-center">صورة</th>
                    <th className="p-2 text-center">Cloudinary</th>
                    <th className="p-2 text-center">ألوان كيس</th>
                    <th className="p-2 text-center">ألوان طباعة</th>
                    <th className="p-2 text-center">عروض</th>
                    <th className="p-2 text-center">smart variants</th>
                  </tr>
                </thead>
                <tbody>
                  {data.products.map(p => (
                    <tr key={p.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50" data-testid={`row-product-${p.id}`}>
                      <td className="p-2 font-mono">{p.id}</td>
                      <td className="p-2">
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-[10px] text-gray-500">
                          {p.productType} · {p.isActive ? "نشط" : "متوقف"}
                        </div>
                      </td>
                      <td className="p-2 text-center">
                        {p.mainImage.url ? (
                          <div className="flex flex-col items-center gap-1">
                            {p.mainImage.ok ? (
                              <img src={p.mainImage.url} alt="" className="w-12 h-12 object-cover rounded border" data-testid={`img-main-${p.id}`} />
                            ) : (
                              <div className="w-12 h-12 flex items-center justify-center rounded border bg-red-50">
                                <ImageOff className="h-6 w-6 text-red-500" />
                              </div>
                            )}
                            <Status ok={p.mainImage.ok} label={String(p.mainImage.status)} />
                          </div>
                        ) : (
                          <span className="text-red-500 text-xs font-bold">بلا صورة</span>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {p.cloudinary.publicId ? (
                          <div className="flex flex-col items-center gap-1">
                            {p.cloudinary.previewUrl && (
                              <img src={p.cloudinary.previewUrl} alt="" className="w-12 h-12 object-cover rounded border" data-testid={`img-cloud-${p.id}`} />
                            )}
                            <Status ok={p.cloudinary.ok} />
                            <div className="text-[9px] text-gray-500 truncate max-w-[120px]" title={p.cloudinary.publicId}>
                              {p.cloudinary.publicId}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {p.availableColors.present ? (
                          p.availableColors.raw === "INVALID_JSON" ? (
                            <span className="text-red-600 text-xs font-bold">JSON خاطئ</span>
                          ) : (
                            <span className={p.availableColors.valid ? "text-green-600" : "text-amber-600"}>
                              {p.availableColors.count} لون
                              {!p.availableColors.valid && " ⚠️"}
                            </span>
                          )
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {p.printColorOptions.present ? (
                          <span className={p.printColorOptions.valid ? "text-green-600" : "text-red-600"}>
                            {p.printColorOptions.count}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {p.quantityTiers.present ? (
                          <span className={p.quantityTiers.valid ? "text-green-600" : "text-red-600"}>
                            {p.quantityTiers.count} عرض
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {p.smartVariants.present ? (
                          <span className={p.smartVariants.valid ? "text-green-600" : "text-red-600"}>
                            {p.smartVariants.count} ({p.smartVariants.activeTypes.join(",")})
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone = "sky" }: { label: string; value: number; tone?: "sky" | "green" | "red" | "amber" | "purple" }) {
  const tones: Record<string, string> = {
    sky: "from-sky-500 to-sky-600",
    green: "from-green-500 to-green-600",
    red: "from-red-500 to-red-600",
    amber: "from-amber-500 to-amber-600",
    purple: "from-purple-500 to-purple-600",
  };
  return (
    <div className={`bg-gradient-to-br ${tones[tone]} text-white rounded-xl p-4 shadow`}>
      <div className="text-3xl font-extrabold" data-testid={`stat-${label}`}>{value}</div>
      <div className="text-xs opacity-90 mt-1">{label}</div>
    </div>
  );
}

function buildFixList(products: ProductDiag[]): { productId: number; message: string }[] {
  const out: { productId: number; message: string }[] = [];
  for (const p of products) {
    if (!p.isActive) continue;
    if (!p.mainImage.ok && p.mainImage.url) {
      out.push({ productId: p.id, message: `الصورة الرئيسية مكسورة (${p.mainImage.status}): ${p.mainImage.url}` });
    } else if (!p.mainImage.url) {
      out.push({ productId: p.id, message: `لا توجد صورة رئيسية` });
    }
    if (p.cloudinary.publicId && p.cloudinary.ok === false) {
      out.push({ productId: p.id, message: `Cloudinary public_id غير صالح: ${p.cloudinary.publicId}` });
    }
    if (p.availableColors.raw === "INVALID_JSON") {
      out.push({ productId: p.id, message: `availableColors يحتوي JSON خاطئ` });
    } else if (p.availableColors.present && !p.availableColors.valid) {
      out.push({ productId: p.id, message: `بعض الألوان فيها حقول ناقصة (id/name/code)` });
    }
    if (p.quantityTiers.present && !p.quantityTiers.valid) {
      out.push({ productId: p.id, message: `بعض عروض الكميات فيها قيم غير صالحة (qty/totalPrice)` });
    }
    if (p.gallery.broken > 0) {
      out.push({ productId: p.id, message: `${p.gallery.broken} صورة في الـgallery مكسورة` });
    }
  }
  return out;
}
