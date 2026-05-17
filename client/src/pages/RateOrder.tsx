import { useState, useMemo } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Star, CheckCircle2, Camera, X, ArrowRight, PartyPopper } from "lucide-react";

interface RateableProduct {
  productId: number;
  productName: string;
  productImage: string;
  alreadyRated: boolean;
  previousRating: number | null;
}

interface RateableResponse {
  orderId: number;
  products: RateableProduct[];
}

interface DraftRating {
  rating: number;
  comment: string;
  imageUrl: string | null;
  uploading: boolean;
}

export default function RateOrder() {
  const [, params] = useRoute("/rate-order/:orderId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const orderId = params?.orderId ? parseInt(params.orderId) : 0;

  const [drafts, setDrafts] = useState<Record<number, DraftRating>>({});
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading, error } = useQuery<RateableResponse>({
    queryKey: ["/api/orders", orderId, "rateable"],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${orderId}/rateable`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "فشل التحميل");
      }
      return res.json();
    },
    enabled: !!orderId,
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: async (ratings: Array<{ productId: number; rating: number; comment?: string; imageUrl?: string }>) => {
      return apiRequest("POST", `/api/orders/${orderId}/rate`, { ratings });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders", orderId, "rateable"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setSubmitted(true);
    },
    onError: (e: any) => {
      toast({ title: "فشل حفظ التقييم", description: e?.message || "حاول لاحقاً", variant: "destructive" });
    },
  });

  const pending = useMemo(() => (data?.products || []).filter(p => !p.alreadyRated), [data]);
  const done = useMemo(() => (data?.products || []).filter(p => p.alreadyRated), [data]);

  const setDraft = (productId: number, patch: Partial<DraftRating>) => {
    setDrafts(prev => {
      const current: DraftRating = prev[productId] || { rating: 0, comment: "", imageUrl: null, uploading: false };
      return { ...prev, [productId]: { ...current, ...patch } };
    });
  };

  const handleImageUpload = async (productId: number, file: File) => {
    setDraft(productId, { uploading: true });
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/upload/review", { method: "POST", body: fd, credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "فشل الرفع");
      setDraft(productId, { imageUrl: json.imageUrl, uploading: false });
    } catch (e: any) {
      toast({ title: "فشل رفع الصورة", description: e?.message, variant: "destructive" });
      setDraft(productId, { uploading: false });
    }
  };

  const handleSubmit = () => {
    const ratings = Object.entries(drafts)
      .filter(([_, d]) => d.rating > 0)
      .map(([pid, d]) => ({
        productId: parseInt(pid),
        rating: d.rating,
        comment: d.comment.trim() || undefined,
        imageUrl: d.imageUrl || undefined,
      }));
    if (ratings.length === 0) {
      toast({ title: "اختر تقييماً بالنجوم على الأقل لمنتج واحد", variant: "destructive" });
      return;
    }
    submitMutation.mutate(ratings);
  };

  // ─── الحالات ─────────────────────────────────────────────────────
  if (!orderId) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4" dir="rtl">
        <p className="text-gray-500">طلب غير صالح</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center" dir="rtl">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 p-4 text-center" dir="rtl">
        <p className="text-red-500 font-medium" data-testid="text-rate-error">{(error as Error).message}</p>
        <Link href={`/orders/${orderId}`}>
          <Button variant="outline" data-testid="link-back-to-order">العودة لتفاصيل الطلب</Button>
        </Link>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 p-4 text-center" dir="rtl">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <PartyPopper className="h-10 w-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800" data-testid="text-rate-success">شكراً لك! 💚</h2>
        <p className="text-gray-600 max-w-md">
          تم استلام تقييمك وسيظهر بعد مراجعته من فريقنا. آراؤك تساعد بقية العملاء على اتخاذ القرار الصحيح.
        </p>
        <div className="flex gap-2 mt-2">
          <Link href={`/orders/${orderId}`}>
            <Button variant="outline" data-testid="button-back-order">تفاصيل الطلب</Button>
          </Link>
          <Link href="/">
            <Button data-testid="button-go-home">العودة للمتجر</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 pb-24" dir="rtl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation(`/orders/${orderId}`)}
          data-testid="button-back"
        >
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-gray-800">قيّم منتجات طلبك #{orderId}</h1>
          <p className="text-sm text-gray-500">رأيك يهمنا — أخبر بقية العملاء عن تجربتك</p>
        </div>
      </div>

      {/* المنتجات بانتظار التقييم */}
      {pending.length === 0 && done.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center text-gray-500">
            <Star className="h-12 w-12 mx-auto mb-3 text-gray-200" />
            لا توجد منتجات قابلة للتقييم في هذا الطلب
          </CardContent>
        </Card>
      )}

      {pending.length > 0 && (
        <div className="space-y-4">
          {pending.map(product => {
            const draft = drafts[product.productId] || { rating: 0, comment: "", imageUrl: null, uploading: false };
            return (
              <Card key={product.productId} data-testid={`card-rate-${product.productId}`}>
                <CardContent className="p-4">
                  {/* Product header */}
                  <div className="flex gap-3 items-center mb-4">
                    {product.productImage ? (
                      <img
                        src={product.productImage}
                        alt={product.productName}
                        className="w-16 h-16 rounded-lg object-cover border"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300">
                        <Star className="h-6 w-6" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <Link href={`/product/${product.productId}`}>
                        <a className="font-semibold text-gray-800 hover:text-primary line-clamp-2 text-sm" data-testid={`link-product-${product.productId}`}>
                          {product.productName}
                        </a>
                      </Link>
                    </div>
                  </div>

                  {/* Star rating */}
                  <div className="flex items-center justify-center gap-1 mb-4">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setDraft(product.productId, { rating: star })}
                        className="p-1 transition-transform active:scale-90 hover:scale-110"
                        data-testid={`star-${product.productId}-${star}`}
                      >
                        <Star
                          className={`h-9 w-9 ${star <= draft.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                        />
                      </button>
                    ))}
                  </div>

                  {draft.rating > 0 && (
                    <p className="text-center text-sm text-gray-600 mb-3">
                      {draft.rating === 5 && "رائع! 🌟"}
                      {draft.rating === 4 && "جيد جداً 👍"}
                      {draft.rating === 3 && "جيد"}
                      {draft.rating === 2 && "مقبول"}
                      {draft.rating === 1 && "غير راضٍ 😕"}
                    </p>
                  )}

                  {/* Comment */}
                  <Textarea
                    placeholder="اكتب رأيك عن المنتج (اختياري)..."
                    value={draft.comment}
                    onChange={e => setDraft(product.productId, { comment: e.target.value })}
                    maxLength={500}
                    className="mb-3 resize-none"
                    rows={3}
                    data-testid={`textarea-comment-${product.productId}`}
                  />

                  {/* Image upload */}
                  {draft.imageUrl ? (
                    <div className="relative inline-block">
                      <img src={draft.imageUrl} alt="صورة التقييم" className="h-24 w-24 rounded-lg object-cover border" />
                      <button
                        onClick={() => setDraft(product.productId, { imageUrl: null })}
                        className="absolute -top-2 -left-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
                        data-testid={`button-remove-image-${product.productId}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="inline-flex items-center gap-2 text-sm text-gray-600 cursor-pointer hover:text-primary">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={draft.uploading}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(product.productId, file);
                        }}
                        data-testid={`input-image-${product.productId}`}
                      />
                      <Camera className="h-4 w-4" />
                      {draft.uploading ? "جاري الرفع..." : "إضافة صورة (اختياري)"}
                    </label>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* المنتجات المُقيَّمة سابقاً */}
      {done.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            تم تقييمها سابقاً ({done.length})
          </h3>
          <div className="space-y-2">
            {done.map(product => (
              <Card key={product.productId} className="bg-gray-50">
                <CardContent className="p-3 flex items-center gap-3">
                  {product.productImage && (
                    <img src={product.productImage} alt="" className="w-10 h-10 rounded-md object-cover" />
                  )}
                  <span className="flex-1 text-sm text-gray-700 line-clamp-1">{product.productName}</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star
                        key={s}
                        className={`h-3.5 w-3.5 ${s <= (product.previousRating || 0) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Submit bar */}
      {pending.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t shadow-lg p-3 z-50">
          <div className="max-w-3xl mx-auto flex gap-2">
            <Button
              variant="outline"
              onClick={() => setLocation("/")}
              data-testid="button-skip"
            >
              لاحقاً
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
              data-testid="button-submit-ratings"
            >
              {submitMutation.isPending ? "جاري الإرسال..." : `إرسال التقييم (${Object.values(drafts).filter(d => d.rating > 0).length}/${pending.length})`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
