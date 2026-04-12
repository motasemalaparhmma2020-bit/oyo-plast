import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Star, Trash2, CheckCircle2, XCircle, MessageSquare, Package, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReviewItem {
  id: number;
  product_id: number;
  product_name: string;
  user_name: string;
  rating: number;
  comment: string | null;
  image_url: string | null;
  is_approved: boolean;
  created_at: string;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} className={`h-4 w-4 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
      ))}
    </div>
  );
}

export function AdminReviews() {
  const { toast } = useToast();

  const { data: reviews = [], isLoading } = useQuery<ReviewItem[]>({
    queryKey: ["/api/admin/reviews"],
    refetchInterval: 30000,
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, approved }: { id: number; approved: boolean }) =>
      apiRequest("PATCH", `/api/admin/reviews/${id}/approve`, { approved }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      toast({ title: vars.approved ? "✅ تم نشر التقييم" : "تم إخفاء التقييم" });
    },
    onError: () => toast({ title: "فشل التحديث", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/reviews/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      toast({ title: "تم حذف التقييم" });
    },
    onError: () => toast({ title: "فشل حذف التقييم", variant: "destructive" }),
  });

  const pending = reviews.filter(r => !r.is_approved);
  const approved = reviews.filter(r => r.is_approved);
  const avgRating = approved.length
    ? (approved.reduce((s, r) => s + r.rating, 0) / approved.length).toFixed(1)
    : "—";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* ─── Header Stats ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 text-center">
            <MessageSquare className="h-5 w-5 mx-auto mb-1 text-blue-500" />
            <p className="text-2xl font-bold text-blue-600">{reviews.length}</p>
            <p className="text-xs text-gray-500">إجمالي التقييمات</p>
          </CardContent>
        </Card>
        <Card className="border-orange-200">
          <CardContent className="pt-4 text-center">
            <Clock className="h-5 w-5 mx-auto mb-1 text-orange-500" />
            <p className="text-2xl font-bold text-orange-600">{pending.length}</p>
            <p className="text-xs text-gray-500">بانتظار الموافقة</p>
          </CardContent>
        </Card>
        <Card className="border-green-200">
          <CardContent className="pt-4 text-center">
            <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-green-500" />
            <p className="text-2xl font-bold text-green-600">{approved.length}</p>
            <p className="text-xs text-gray-500">منشور</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Star className="h-5 w-5 mx-auto mb-1 text-yellow-500 fill-yellow-400" />
            <p className="text-2xl font-bold text-yellow-600">{avgRating}</p>
            <p className="text-xs text-gray-500">متوسط التقييم</p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Pending Reviews ─── */}
      {pending.length > 0 && (
        <div>
          <h3 className="font-bold text-orange-600 flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4" /> بانتظار موافقتك ({pending.length})
          </h3>
          <div className="space-y-3">
            {pending.map(review => (
              <ReviewCard
                key={review.id}
                review={review}
                onApprove={() => approveMutation.mutate({ id: review.id, approved: true })}
                onReject={() => deleteMutation.mutate(review.id)}
                isPending={approveMutation.isPending || deleteMutation.isPending}
                variant="pending"
              />
            ))}
          </div>
        </div>
      )}

      {/* ─── Approved Reviews ─── */}
      {approved.length > 0 && (
        <div>
          <h3 className="font-bold text-green-600 flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4" /> منشور للعملاء ({approved.length})
          </h3>
          <div className="space-y-3">
            {approved.map(review => (
              <ReviewCard
                key={review.id}
                review={review}
                onApprove={() => approveMutation.mutate({ id: review.id, approved: false })}
                onReject={() => deleteMutation.mutate(review.id)}
                isPending={approveMutation.isPending || deleteMutation.isPending}
                variant="approved"
              />
            ))}
          </div>
        </div>
      )}

      {reviews.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <Star className="h-12 w-12 mx-auto mb-3 text-gray-200" />
            <p className="text-gray-500 font-medium">لا يوجد تقييمات بعد</p>
            <p className="text-sm text-gray-400 mt-1">ستظهر هنا تقييمات العملاء بعد الشراء</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ReviewCard({
  review, onApprove, onReject, isPending, variant,
}: {
  review: ReviewItem;
  onApprove: () => void;
  onReject: () => void;
  isPending: boolean;
  variant: "pending" | "approved";
}) {
  return (
    <Card className={`border-2 ${variant === "pending" ? "border-orange-100 bg-orange-50/30" : "border-green-100 bg-green-50/20"}`}>
      <CardContent className="p-4">
        <div className="flex gap-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-bold text-sm">
            {(review.user_name || "م")?.charAt(0)}
          </div>

          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-gray-800">{review.user_name || "مجهول"}</span>
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                <Package className="h-3 w-3" />{review.product_name || `منتج #${review.product_id}`}
              </Badge>
              {variant === "approved" ? (
                <Badge className="bg-green-500 text-white text-xs">✅ منشور</Badge>
              ) : (
                <Badge className="bg-orange-400 text-white text-xs">⏳ بانتظار الموافقة</Badge>
              )}
              <span className="text-xs text-gray-400 mr-auto">
                {new Date(review.created_at).toLocaleDateString("ar")}
              </span>
            </div>

            {/* Stars */}
            <div className="mt-1"><StarRating rating={review.rating} /></div>

            {/* Comment */}
            {review.comment && (
              <p className="text-sm text-gray-700 mt-2 bg-white dark:bg-gray-800 rounded-lg p-2 border">
                "{review.comment}"
              </p>
            )}

            {/* Customer photo */}
            {review.image_url && (
              <img src={review.image_url} alt="صورة التقييم" className="mt-2 h-24 w-24 object-cover rounded-lg border" />
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-3 border-t pt-3">
          {variant === "pending" ? (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white gap-1"
              onClick={onApprove}
              disabled={isPending}
              data-testid={`button-approve-review-${review.id}`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> نشر التقييم
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="text-orange-500 border-orange-300 gap-1"
              onClick={onApprove}
              disabled={isPending}
              data-testid={`button-hide-review-${review.id}`}
            >
              <XCircle className="h-3.5 w-3.5" /> إخفاء
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-red-500 hover:bg-red-50 gap-1"
            onClick={onReject}
            disabled={isPending}
            data-testid={`button-delete-review-${review.id}`}
          >
            <Trash2 className="h-3.5 w-3.5" /> حذف
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
