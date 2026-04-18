import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Package, Phone, MapPin, User, DollarSign, CheckCircle,
  Truck, XCircle, AlertTriangle, Loader2, ShoppingBag, Clock
} from "lucide-react";

const STATUS_INFO: Record<string, { label: string; cls: string }> = {
  pending:   { label: "في الانتظار",  cls: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  accepted:  { label: "تم القبول",   cls: "bg-blue-100 text-blue-800 border-blue-200" },
  shipped:   { label: "تم الشحن",    cls: "bg-purple-100 text-purple-800 border-purple-200" },
  delivered: { label: "تم التوصيل", cls: "bg-green-100 text-green-800 border-green-200" },
  cancelled: { label: "ملغي",        cls: "bg-red-100 text-red-800 border-red-200" },
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-YE", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4" dir="rtl">
      <div className="text-center max-w-sm">
        <AlertTriangle className="h-14 w-14 text-amber-400 mx-auto mb-4" />
        <h2 className="text-lg font-bold mb-2">تعذّر تحميل الطلب</h2>
        <p className="text-muted-foreground text-sm">{message}</p>
      </div>
    </div>
  );
}

export default function SupplierOrderView() {
  const [, params] = useRoute("/supplier/order/:token");
  const token = params?.token || "";
  const { toast } = useToast();
  const [cancelNote, setCancelNote] = useState("");
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [lastDone, setLastDone] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<{ order: any; items: any[] }>({
    queryKey: ["/api/supplier/order", token],
    queryFn: async () => {
      const r = await fetch(`/api/supplier/order/${token}`);
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "خطأ");
      return r.json();
    },
    enabled: !!token,
    retry: false,
    staleTime: 30_000,
  });

  const { mutate: updateStatus, isPending } = useMutation({
    mutationFn: async ({ status, note }: { status: string; note?: string }) => {
      const r = await fetch(`/api/supplier/order/${token}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "خطأ");
      return r.json();
    },
    onSuccess: (_, vars) => {
      setLastDone(vars.status);
      const msgs: Record<string, string> = {
        accepted:  "✅ تم تأكيد استلام الطلب — شكراً لك",
        shipped:   "🚚 تم تسجيل الشحن — العميل سيُبلَّغ فوراً",
        delivered: "🎉 ممتاز! تم تسجيل التوصيل بنجاح",
        cancelled: "⚠️ تم إرسال إشعار الإلغاء للإدارة",
      };
      toast({ title: msgs[vars.status] || "تم التحديث" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  if (!token) return <ErrorScreen message="رابط غير صالح — تأكد من نسخ الرابط كاملاً من رسالة الواتساب" />;
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-3" />
          <p className="text-muted-foreground">جاري تحميل تفاصيل الطلب...</p>
        </div>
      </div>
    );
  }
  if (isError || !data) return <ErrorScreen message="الرابط غير صالح أو انتهت صلاحيته — تواصل مع الإدارة" />;

  const { order, items } = data;
  const currency = order.currency || "ر.ي";
  const supplierStatus: string = lastDone || order.supplier_status || "pending";
  const statusInfo = STATUS_INFO[supplierStatus] || STATUS_INFO.pending;
  const isTerminal = supplierStatus === "delivered" || supplierStatus === "cancelled";

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-primary text-white px-4 py-4 shadow-md">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">بوابة المورد</h1>
            <p className="text-primary-foreground/80 text-xs">أويو بلاست — oyoplast.com</p>
          </div>
          <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${statusInfo.cls}`} data-testid="badge-supplier-status">
            {statusInfo.label}
          </span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* Order Header */}
        <Card className="border-2 border-primary/20 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                طلب رقم #{order.id}
              </CardTitle>
              <span className="text-xs text-muted-foreground">{fmtDate(order.created_at)}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <InfoRow icon={<User className="h-4 w-4 text-blue-500" />} label="العميل" value={order.customer_name || "—"} />
              <InfoRow icon={<Phone className="h-4 w-4 text-green-500" />} label="الجوال" value={order.customer_phone || "—"} />
              <InfoRow icon={<MapPin className="h-4 w-4 text-red-500" />} label="المدينة" value={order.shipping_city || "—"} />
              <InfoRow icon={<Clock className="h-4 w-4 text-orange-500" />} label="نوع الشحن" value={order.shipping_option === "fast" ? "سريع (1-2 يوم)" : "عادي (3-5 أيام)"} />
            </div>
            {order.shipping_address && (
              <div className="bg-gray-50 rounded-lg p-2.5 text-sm border">
                <span className="text-muted-foreground text-xs block mb-0.5">العنوان التفصيلي</span>
                <span>{order.shipping_address}</span>
              </div>
            )}
            {order.notes && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-sm">
                <span className="text-amber-700 text-xs font-semibold block mb-0.5">ملاحظات العميل</span>
                <span>{order.notes}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Products — فاتورة كاملة بالصور والتفاصيل */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-primary" />
              الفاتورة التفصيلية ({items.length} صنف)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {items.map((item: any, i: number) => {
              const imgSrc = item.product_image ||
                (item.product_id ? `/api/products/image/${item.product_id}/0` : null);
              const itemTotal = Number(item.price) * Number(item.quantity);
              const attrs: string[] = [];
              if (item.selected_color) attrs.push(`اللون: ${item.selected_color}`);
              if (item.selected_bag_color) attrs.push(`لون الكيس: ${item.selected_bag_color}`);
              if (item.selected_size) attrs.push(`المقاس: ${item.selected_size}`);
              if (item.print_color_count > 0) attrs.push(`طباعة ${item.print_color_count} لون`);
              if (item.print_color_1) attrs.push(item.print_color_1);
              if (item.design_notes) attrs.push(`ملاحظة التصميم: ${item.design_notes}`);
              return (
                <div
                  key={i}
                  className="flex gap-3 p-3 border-b last:border-0 hover:bg-gray-50/50 transition-colors"
                  data-testid={`item-row-${i}`}
                >
                  {/* صورة المنتج */}
                  <div className="shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-100 border">
                    {imgSrc ? (
                      <img
                        src={imgSrc}
                        alt={item.product_name || "منتج"}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' font-size='24' text-anchor='middle' dy='.3em'%3E📦%3C/text%3E%3C/svg%3E";
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl text-gray-300">
                        📦
                      </div>
                    )}
                  </div>

                  {/* تفاصيل المنتج */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm leading-snug text-gray-800" data-testid={`item-name-${i}`}>
                      {item.product_name || "منتج غير محدد"}
                    </p>
                    {attrs.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {attrs.map((attr, ai) => (
                          <span key={ai} className="text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded px-1.5 py-0.5">
                            {attr}
                          </span>
                        ))}
                      </div>
                    )}
                    {item.design_file_url && (
                      <a href={item.design_file_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-primary underline mt-0.5 block">
                        📎 ملف التصميم
                      </a>
                    )}
                  </div>

                  {/* الكمية والسعر */}
                  <div className="shrink-0 text-left space-y-1">
                    <Badge
                      variant="secondary"
                      className="text-sm font-bold block text-center min-w-[36px]"
                      data-testid={`badge-qty-${i}`}
                    >
                      ×{item.quantity}
                    </Badge>
                    <p className="text-xs text-muted-foreground text-center whitespace-nowrap">
                      {Number(item.price).toLocaleString("ar")}
                    </p>
                    <p className="text-xs font-bold text-primary text-center whitespace-nowrap">
                      {itemTotal.toLocaleString("ar")} {currency}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* مجموع الأصناف */}
            <div className="p-3 bg-gray-50 border-t">
              <div className="flex justify-between text-sm font-medium">
                <span className="text-muted-foreground">مجموع المنتجات</span>
                <span>
                  {items.reduce((s, it) => s + Number(it.price) * Number(it.quantity), 0).toLocaleString("ar")} {currency}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Summary */}
        <Card className="bg-green-50 border-green-200 shadow-sm">
          <CardContent className="pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">إجمالي الطلب</span>
              <span className="font-medium">{Number(order.total).toLocaleString()} {currency}</span>
            </div>
            <Separator className="bg-green-200" />
            <div className="flex justify-between items-center">
              <span className="font-bold text-green-800 flex items-center gap-1">
                <DollarSign className="h-4 w-4" /> مبلغك المستحق
              </span>
              <span className="font-bold text-green-700 text-xl" data-testid="text-supplier-amount">
                {Number(order.supplier_amount || 0).toLocaleString()} {currency}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">يُحدَّد طريقة الدفع حسب الاتفاق مع الإدارة</p>
          </CardContent>
        </Card>

        {/* ── المرحلة 2: أزرار تحديث الحالة ── */}
        {!isTerminal && (
          <Card className="shadow-sm border-2 border-blue-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="h-4 w-4 text-blue-500" />
                تحديث حالة الطلب
              </CardTitle>
              <p className="text-xs text-muted-foreground">كل تحديث يُرسَل تلقائياً للعميل</p>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {/* قبول الطلب */}
              {(supplierStatus === "pending") && (
                <Button
                  className="w-full gap-2 h-12 text-base bg-blue-600 hover:bg-blue-700"
                  data-testid="button-accept"
                  disabled={isPending}
                  onClick={() => updateStatus({ status: "accepted" })}
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
                  ✅ قبلت الطلب — سأبدأ التجهيز
                </Button>
              )}

              {/* تم الشحن */}
              {(supplierStatus === "pending" || supplierStatus === "accepted") && (
                <Button
                  className="w-full gap-2 h-12 text-base bg-purple-600 hover:bg-purple-700"
                  data-testid="button-shipped"
                  disabled={isPending}
                  onClick={() => updateStatus({ status: "shipped" })}
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-5 w-5" />}
                  🚚 تم الشحن — الطلب في الطريق
                </Button>
              )}

              {/* تم التوصيل */}
              {(supplierStatus === "accepted" || supplierStatus === "shipped") && (
                <Button
                  className="w-full gap-2 h-12 text-base bg-green-600 hover:bg-green-700"
                  data-testid="button-delivered"
                  disabled={isPending}
                  onClick={() => updateStatus({ status: "delivered" })}
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
                  🎉 تم التوصيل للعميل
                </Button>
              )}

              <Separator />

              {/* إلغاء */}
              {!showCancelForm ? (
                <Button
                  variant="outline"
                  className="w-full gap-2 text-red-600 border-red-200 hover:bg-red-50"
                  data-testid="button-show-cancel"
                  onClick={() => setShowCancelForm(true)}
                >
                  <XCircle className="h-4 w-4" />
                  لا أستطيع تنفيذ هذا الطلب
                </Button>
              ) : (
                <div className="space-y-2 bg-red-50 rounded-xl p-3 border border-red-200">
                  <p className="text-sm font-medium text-red-800">سبب الإلغاء (اختياري):</p>
                  <Textarea
                    placeholder="مثال: خارج نطاق التغطية، نفاد المخزون..."
                    value={cancelNote}
                    onChange={e => setCancelNote(e.target.value)}
                    className="text-sm bg-white"
                    rows={2}
                    data-testid="input-cancel-note"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      className="flex-1 gap-1"
                      data-testid="button-confirm-cancel"
                      disabled={isPending}
                      onClick={() => updateStatus({ status: "cancelled", note: cancelNote })}
                    >
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                      تأكيد الإلغاء
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={() => setShowCancelForm(false)}>
                      تراجع
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* حالة الإنجاز */}
        {isTerminal && (
          <Card className={`shadow-sm border-2 text-center ${supplierStatus === "cancelled" ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}>
            <CardContent className="pt-6 pb-5 space-y-2">
              {supplierStatus === "delivered" ? (
                <>
                  <CheckCircle className="h-14 w-14 text-green-500 mx-auto" />
                  <p className="font-bold text-green-800 text-xl">تم التوصيل بنجاح 🎉</p>
                  <p className="text-sm text-green-700">أُرسل إشعار واتساب للعميل تلقائياً</p>
                  <p className="text-sm text-green-700 font-medium">مبلغك: {Number(order.supplier_amount || 0).toLocaleString()} {currency}</p>
                </>
              ) : (
                <>
                  <XCircle className="h-14 w-14 text-red-400 mx-auto" />
                  <p className="font-bold text-red-800 text-xl">تم إبلاغ الإدارة بالإلغاء</p>
                  <p className="text-sm text-red-700">ستتواصل معك الإدارة قريباً إذا لزم</p>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground pb-6">
          هذا الرابط خاص بك — لا تشاركه مع أحد<br />
          أويو بلاست 🛍️
        </p>
      </div>
    </div>
  );
}
