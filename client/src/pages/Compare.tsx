import { useCompare } from "@/hooks/use-compare";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAddToCart } from "@/hooks/use-cart";
import { ArrowRight, ShoppingCart, Star, Trash2, GitCompare, CheckCircle, XCircle } from "lucide-react";
import { Product } from "@shared/schema";

function StarRow({ rating }: { rating: string | null | undefined }) {
  const r = Number(rating) || 0;
  return (
    <div className="flex items-center gap-1 justify-center">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${star <= Math.round(r) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
        />
      ))}
      <span className="text-sm font-medium mr-1">{r.toFixed(1)}</span>
    </div>
  );
}

function PriceCell({ product }: { product: Product }) {
  const currency = (localStorage.getItem("currency") as "YER" | "SAR") || "YER";
  const price = currency === "SAR" && product.priceSar ? product.priceSar : product.price;
  const unit = currency === "SAR" ? "ر.س" : "ر.ي";
  return (
    <div className="text-center">
      <span className="text-xl font-black text-primary">
        {Number(price).toLocaleString("ar-YE")}
      </span>
      <span className="text-sm text-muted-foreground mr-1">{unit}</span>
    </div>
  );
}

interface RowProps {
  label: string;
  values: React.ReactNode[];
  highlight?: boolean;
}

function CompareRow({ label, values, highlight }: RowProps) {
  return (
    <tr className={highlight ? "bg-primary/5" : "even:bg-muted/30"}>
      <td className="py-3 px-4 font-semibold text-sm text-muted-foreground border-b border-border text-right sticky right-0 bg-inherit z-10 min-w-[110px]">
        {label}
      </td>
      {values.map((v, i) => (
        <td key={i} className="py-3 px-4 text-center border-b border-border border-r first:border-r-0">
          {v}
        </td>
      ))}
    </tr>
  );
}

export default function Compare() {
  const { compareItems, removeFromCompare, clearCompare } = useCompare();
  const [, setLocation] = useLocation();
  const { mutate: addToCart, isPending } = useAddToCart();

  if (compareItems.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8" dir="rtl">
        <GitCompare className="h-16 w-16 text-muted-foreground/30" />
        <h1 className="text-xl font-bold">لا توجد منتجات للمقارنة</h1>
        <p className="text-muted-foreground text-center text-sm">
          اضغط على زر "قارن" في أي منتج لإضافته هنا
        </p>
        <Button onClick={() => setLocation("/products")} className="gap-2">
          <ArrowRight className="h-4 w-4" />
          تصفح المنتجات
        </Button>
      </div>
    );
  }

  const hasPrinting = compareItems.some((p) => p.hasPrintingOptions);
  const hasColors = compareItems.some((p) => p.colors && p.colors.length > 0);
  const hasSizes = compareItems.some((p) => p.sizes && p.sizes.length > 0);

  return (
    <div className="min-h-screen bg-background pb-20" dir="rtl">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <button
            onClick={() => setLocation(-1 as any)}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowRight className="h-5 w-5" />
            <span className="text-sm font-medium">رجوع</span>
          </button>
          <h1 className="font-black text-lg flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-primary" />
            مقارنة المنتجات
          </h1>
          <button
            onClick={() => { clearCompare(); setLocation("/products"); }}
            className="text-xs text-destructive flex items-center gap-1"
            data-testid="btn-clear-all-compare"
          >
            <Trash2 className="h-3.5 w-3.5" />
            مسح الكل
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 py-4 overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: compareItems.length * 180 }}>
          <thead>
            <tr>
              <th className="text-right py-2 px-4 text-sm text-muted-foreground font-medium sticky right-0 bg-background z-10 min-w-[110px]">
                المواصفة
              </th>
              {compareItems.map((product) => (
                <th key={product.id} className="pb-4 px-2 border-r first:border-r-0" style={{ minWidth: 160 }}>
                  <div className="relative">
                    <button
                      onClick={() => removeFromCompare(product.id)}
                      className="absolute -top-1 -left-1 bg-red-100 text-red-600 rounded-full h-5 w-5 flex items-center justify-center hover:bg-red-200 transition-colors z-10"
                      data-testid={`btn-remove-from-compare-${product.id}`}
                    >
                      ×
                    </button>
                    <div className="bg-muted/30 rounded-2xl p-3 flex flex-col items-center gap-2">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-24 w-24 object-contain rounded-xl"
                      />
                      <p className="font-bold text-sm text-center line-clamp-2 leading-tight">
                        {product.name}
                      </p>
                      <Badge variant={product.stock > 0 ? "default" : "destructive"} className="text-xs">
                        {product.stock > 0 ? "متوفر" : "نفذت الكمية"}
                      </Badge>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            <CompareRow
              label="السعر"
              highlight
              values={compareItems.map((p) => <PriceCell key={p.id} product={p} />)}
            />

            <CompareRow
              label="التقييم"
              values={compareItems.map((p) => (
                <StarRow key={p.id} rating={p.rating} />
              ))}
            />

            <CompareRow
              label="عدد التقييمات"
              values={compareItems.map((p) => (
                <span key={p.id} className="text-sm">{p.reviewCount || 0} تقييم</span>
              ))}
            />

            <CompareRow
              label="المبيعات"
              values={compareItems.map((p) => (
                <span key={p.id} className="text-sm font-medium">{p.soldCount || 0} وحدة</span>
              ))}
            />

            <CompareRow
              label="المخزون"
              values={compareItems.map((p) => (
                <span key={p.id} className={`text-sm font-bold ${p.stock > 10 ? "text-green-600" : p.stock > 0 ? "text-orange-500" : "text-red-500"}`}>
                  {p.stock > 0 ? `${p.stock} قطعة` : "نفذ"}
                </span>
              ))}
            />

            {hasColors && (
              <CompareRow
                label="الألوان"
                values={compareItems.map((p) => (
                  <div key={p.id} className="flex flex-wrap gap-1 justify-center">
                    {p.colors && p.colors.length > 0 ? (
                      p.colors.map((c, i) => (
                        <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded-full">{c}</span>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </div>
                ))}
              />
            )}

            {hasSizes && (
              <CompareRow
                label="المقاسات"
                values={compareItems.map((p) => (
                  <div key={p.id} className="flex flex-wrap gap-1 justify-center">
                    {p.sizes && p.sizes.length > 0 ? (
                      p.sizes.map((s, i) => (
                        <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded-full">{s}</span>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </div>
                ))}
              />
            )}

            {hasPrinting && (
              <CompareRow
                label="خيار الطباعة"
                values={compareItems.map((p) => (
                  p.hasPrintingOptions
                    ? <CheckCircle key={p.id} className="h-5 w-5 text-green-500 mx-auto" />
                    : <XCircle key={p.id} className="h-5 w-5 text-gray-300 mx-auto" />
                ))}
              />
            )}

            <CompareRow
              label="رفع تصميم"
              values={compareItems.map((p) => (
                p.allowDesignUpload
                  ? <CheckCircle key={p.id} className="h-5 w-5 text-green-500 mx-auto" />
                  : <XCircle key={p.id} className="h-5 w-5 text-gray-300 mx-auto" />
              ))}
            />

            <tr>
              <td className="py-4 px-4 sticky right-0 bg-background z-10" />
              {compareItems.map((product) => (
                <td key={product.id} className="py-4 px-2 border-r first:border-r-0">
                  <Button
                    className="w-full gap-2 font-bold text-sm"
                    size="sm"
                    disabled={product.stock <= 0 || isPending}
                    onClick={() => addToCart({ productId: product.id, quantity: 1 })}
                    data-testid={`btn-compare-add-cart-${product.id}`}
                  >
                    <ShoppingCart className="h-4 w-4" />
                    {product.stock <= 0 ? "غير متوفر" : "أضف للسلة"}
                  </Button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
