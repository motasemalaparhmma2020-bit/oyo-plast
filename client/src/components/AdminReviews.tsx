import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, Trash2, MessageSquare, Package, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReviewItem {
  id: number;
  product_id: number;
  product_name: string;
  user_name: string;
  rating: number;
  comment: string | null;
  image_url: string | null;
  created_at: string;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
        />
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

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/reviews/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      toast({ title: "تم حذف التقييم" });
    },
    onError: () => toast({ title: "فشل حذف التقييم", variant: "destructive" }),
  });

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : "0";

  const dist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-yellow-500" />
          إدارة التقييمات والمراجعات
        </h2>
        <Badge variant="secondary" className="text-base px-3 py-1">
          {reviews.length} تقييم
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-4xl font-bold text-yellow-500">{avgRating}</div>
            <StarRating rating={Math.round(Number(avgRating))} />
            <p className="text-sm text-muted-foreground mt-1">المتوسط العام</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-blue-600">{reviews.length}</div>
            <p className="text-sm text-muted-foreground mt-2">إجمالي التقييمات</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-green-600">
              {reviews.filter((r) => r.rating >= 4).length}
            </div>
            <p className="text-sm text-muted-foreground mt-2">تقييمات إيجابية</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-red-500">
              {reviews.filter((r) => r.rating <= 2).length}
            </div>
            <p className="text-sm text-muted-foreground mt-2">تقييمات سلبية</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">توزيع التقييمات</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {dist.map(({ star, count }) => {
            const pct = reviews.length ? Math.round((count / reviews.length) * 100) : 0;
            return (
              <div key={star} className="flex items-center gap-3">
                <div className="flex items-center gap-1 w-16 flex-shrink-0">
                  <span className="text-sm font-medium">{star}</span>
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                </div>
                <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                  <div
                    className="bg-yellow-400 h-2.5 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-sm text-muted-foreground w-10 text-left">{count}</span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {reviews.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>لا توجد تقييمات بعد</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <Card key={review.id} className="border border-border" data-testid={`review-card-${review.id}`}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <StarRating rating={review.rating} />
                      <Badge
                        variant={review.rating >= 4 ? "default" : review.rating >= 3 ? "secondary" : "destructive"}
                        className="text-xs"
                      >
                        {review.rating}/5
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2 flex-wrap">
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {review.user_name || "مجهول"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Package className="h-3.5 w-3.5" />
                        {review.product_name || `منتج #${review.product_id}`}
                      </span>
                      <span>{new Date(review.created_at).toLocaleDateString("ar-YE")}</span>
                    </div>
                    {review.comment && (
                      <p className="text-sm bg-muted/50 rounded-lg p-3">{review.comment}</p>
                    )}
                    {review.image_url && (
                      <img
                        src={review.image_url}
                        alt="صورة التقييم"
                        className="mt-2 h-20 w-20 object-cover rounded-lg border"
                      />
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(review.id)}
                    disabled={deleteMutation.isPending}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                    data-testid={`btn-delete-review-${review.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
