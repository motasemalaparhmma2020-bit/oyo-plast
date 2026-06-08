import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Plus, Trash2, Save } from "lucide-react";

interface VolumeOffer {
  id: number;
  productId: number;
  minQuantity: number;
  maxQuantity: number | null;
  offerPriceYer: number;
  originalPriceYer: number | null;
  displayLabel: string | null;
  badgeText: string | null;
  hasFreeShipping: boolean;
  shippingFeeYer: number;
  marketerCommissionPercent: number | null;
  isActive: boolean;
  sortOrder: number;
}

interface ProductLite { id: number; name: string; }

const emptyForm = {
  minQuantity: "" as string,
  maxQuantity: "" as string,
  offerPriceYer: "" as string,
  originalPriceYer: "" as string,
  displayLabel: "",
  badgeText: "",
  hasFreeShipping: false,
  shippingFeeYer: "" as string,
  marketerCommissionPercent: "" as string,
  isActive: true,
  sortOrder: "0",
};

export default function AdminVolumeOffers() {
  const { toast } = useToast();
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<number | null>(null);

  const adminFetch = async (method: string, url: string, body?: any) => {
    const res = await fetch(url, {
      method,
      headers: {
        "x-admin-token": localStorage.getItem("admin_token") || "",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = (await res.text()) || res.statusText;
      throw new Error(`${res.status}: ${text}`);
    }
    return res;
  };

  const { data: products = [], isLoading: productsLoading } = useQuery<ProductLite[]>({
    queryKey: ["/api/admin/products"],
  });

  const { data: offers = [], isLoading: offersLoading } = useQuery<VolumeOffer[]>({
    queryKey: ["/api/admin/volume-offers", selectedProductId],
    queryFn: async () => {
      if (!selectedProductId) return [];
      const res = await adminFetch("GET", `/api/admin/volume-offers?productId=${selectedProductId}`);
      return res.json();
    },
    enabled: !!selectedProductId,
  });

  const resetForm = () => { setForm({ ...emptyForm }); setEditingId(null); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProductId) throw new Error("اختر منتجاً أولاً");
      const body: any = {
        productId: parseInt(selectedProductId),
        minQuantity: form.minQuantity === "" ? null : parseInt(form.minQuantity),
        maxQuantity: form.maxQuantity === "" ? null : parseInt(form.maxQuantity),
        offerPriceYer: form.offerPriceYer === "" ? null : Number(form.offerPriceYer),
        originalPriceYer: form.originalPriceYer === "" ? null : Number(form.originalPriceYer),
        displayLabel: form.displayLabel || null,
        badgeText: form.badgeText || null,
        hasFreeShipping: form.hasFreeShipping,
        shippingFeeYer: form.shippingFeeYer === "" ? 0 : Number(form.shippingFeeYer),
        marketerCommissionPercent: form.marketerCommissionPercent === "" ? null : Number(form.marketerCommissionPercent),
        isActive: form.isActive,
        sortOrder: parseInt(form.sortOrder) || 0,
      };
      if (editingId) {
        return adminFetch("PATCH", `/api/admin/volume-offers/${editingId}`, body);
      }
      return adminFetch("POST", "/api/admin/volume-offers", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/volume-offers", selectedProductId] });
      toast({ title: editingId ? "تم التحديث" : "تم الإنشاء" });
      resetForm();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message || "فشل الحفظ", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => adminFetch("DELETE", `/api/admin/volume-offers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/volume-offers", selectedProductId] });
      toast({ title: "تم الحذف" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message, variant: "destructive" }),
  });

  const startEdit = (o: VolumeOffer) => {
    setEditingId(o.id);
    setForm({
      minQuantity: String(o.minQuantity ?? ""),
      maxQuantity: o.maxQuantity == null ? "" : String(o.maxQuantity),
      offerPriceYer: String(o.offerPriceYer ?? ""),
      originalPriceYer: o.originalPriceYer == null ? "" : String(o.originalPriceYer),
      displayLabel: o.displayLabel || "",
      badgeText: o.badgeText || "",
      hasFreeShipping: o.hasFreeShipping,
      shippingFeeYer: String(o.shippingFeeYer ?? "0"),
      marketerCommissionPercent: o.marketerCommissionPercent == null ? "" : String(o.marketerCommissionPercent),
      isActive: o.isActive,
      sortOrder: String(o.sortOrder ?? 0),
    });
  };

  const productOptions = useMemo(() =>
    products.map(p => ({ value: String(p.id), label: `${p.name} (#${p.id})` })),
    [products]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            🎯 العروض التحفيزية حسب الكمية
          </h1>
          <Link href="/admin">
            <Button variant="outline" size="sm" data-testid="link-back-admin">
              <ArrowRight className="w-4 h-4 ml-1" /> رجوع
            </Button>
          </Link>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">اختر المنتج</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedProductId} onValueChange={(v) => { setSelectedProductId(v); resetForm(); }}>
              <SelectTrigger data-testid="select-product">
                <SelectValue placeholder={productsLoading ? "جاري التحميل..." : "اختر منتجاً"} />
              </SelectTrigger>
              <SelectContent>
                {productOptions.map(p => (
                  <SelectItem key={p.value} value={p.value} data-testid={`option-product-${p.value}`}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedProductId && (
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-base">{editingId ? "تعديل العرض" : "إضافة عرض جديد"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>الحد الأدنى للكمية *</Label>
                    <Input
                      type="number"
                      value={form.minQuantity}
                      onChange={e => setForm(f => ({ ...f, minQuantity: e.target.value }))}
                      placeholder="مثلاً 100"
                      data-testid="input-min-quantity"
                    />
                  </div>
                  <div>
                    <Label>الحد الأعلى (اختياري — اتركه فارغاً لـ ∞)</Label>
                    <Input
                      type="number"
                      value={form.maxQuantity}
                      onChange={e => setForm(f => ({ ...f, maxQuantity: e.target.value }))}
                      placeholder="مثلاً 499"
                      data-testid="input-max-quantity"
                    />
                  </div>
                  <div>
                    <Label>ترتيب العرض (sortOrder)</Label>
                    <Input
                      type="number"
                      value={form.sortOrder}
                      onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))}
                      data-testid="input-sort-order"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>سعر العرض لكل قطعة (YER) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.offerPriceYer}
                      onChange={e => setForm(f => ({ ...f, offerPriceYer: e.target.value }))}
                      placeholder="مثلاً 250"
                      data-testid="input-offer-price"
                    />
                    <p className="text-xs text-gray-500 mt-1">سعر شامل (يلغي smart variants + رسوم الطباعة)</p>
                  </div>
                  <div>
                    <Label>السعر الأصلي للشطب — Anchor (اختياري)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.originalPriceYer}
                      onChange={e => setForm(f => ({ ...f, originalPriceYer: e.target.value }))}
                      placeholder="مثلاً 350"
                      data-testid="input-original-price"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>نص العرض المعروض (اختياري)</Label>
                    <Input
                      value={form.displayLabel}
                      onChange={e => setForm(f => ({ ...f, displayLabel: e.target.value }))}
                      placeholder="عرض 100 كيس"
                      data-testid="input-display-label"
                    />
                  </div>
                  <div>
                    <Label>نص الشارة — Badge (اختياري)</Label>
                    <Input
                      value={form.badgeText}
                      onChange={e => setForm(f => ({ ...f, badgeText: e.target.value }))}
                      placeholder="الأكثر طلباً / أفضل قيمة"
                      data-testid="input-badge-text"
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-bold mb-3 text-sm">🚚 الشحن داخل العرض</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                      <Switch
                        checked={form.hasFreeShipping}
                        onCheckedChange={(c) => setForm(f => ({ ...f, hasFreeShipping: c }))}
                        data-testid="switch-free-shipping"
                      />
                      <Label className="flex-1">شحن مجاني</Label>
                    </div>
                    <div>
                      <Label>أو رسوم شحن رمزية (YER)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.shippingFeeYer}
                        onChange={e => setForm(f => ({ ...f, shippingFeeYer: e.target.value }))}
                        placeholder="اتركه 0 إذا كان مجانياً"
                        disabled={form.hasFreeShipping}
                        data-testid="input-shipping-fee"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-bold mb-3 text-sm">💼 عمولة المسوّق لهذا العرض</h4>
                  <div>
                    <Label>عمولة المسوّق (%) — اتركه فارغاً لاستخدام عمولة المنتج الافتراضية</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.marketerCommissionPercent}
                      onChange={e => setForm(f => ({ ...f, marketerCommissionPercent: e.target.value }))}
                      placeholder="مثلاً 5"
                      data-testid="input-marketer-commission"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 border-t pt-4">
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={(c) => setForm(f => ({ ...f, isActive: c }))}
                    data-testid="switch-active"
                  />
                  <Label>العرض مفعّل</Label>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending || !form.minQuantity || !form.offerPriceYer}
                    className="gap-2"
                    data-testid="button-save-offer"
                  >
                    <Save className="w-4 h-4" />
                    {saveMutation.isPending ? "جاري الحفظ..." : (editingId ? "تحديث العرض" : "إضافة العرض")}
                  </Button>
                  {editingId && (
                    <Button variant="outline" onClick={resetForm} data-testid="button-cancel-edit">إلغاء التعديل</Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">العروض الحالية لهذا المنتج ({offers.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {offersLoading ? (
                  <p className="text-center text-gray-500 py-6">جاري التحميل...</p>
                ) : offers.length === 0 ? (
                  <p className="text-center text-gray-500 py-6">لا يوجد عروض بعد — أضف عرضاً من النموذج أعلاه.</p>
                ) : (
                  <div className="space-y-3">
                    {offers.map(o => (
                      <div
                        key={o.id}
                        className="border rounded-lg p-4 flex flex-col md:flex-row md:items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800"
                        data-testid={`row-offer-${o.id}`}
                      >
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-bold text-lg">
                              {o.minQuantity}{o.maxQuantity ? ` – ${o.maxQuantity}` : "+"} قطعة
                            </span>
                            {o.badgeText && <Badge className="bg-orange-500">{o.badgeText}</Badge>}
                            {!o.isActive && <Badge variant="outline">معطّل</Badge>}
                            {o.hasFreeShipping && <Badge className="bg-green-500">🚚 مجاني</Badge>}
                          </div>
                          <div className="flex flex-wrap items-baseline gap-2 text-sm">
                            <span className="text-blue-600 font-bold text-base" data-testid={`text-offer-price-${o.id}`}>
                              {o.offerPriceYer.toLocaleString()} ر.ي / قطعة
                            </span>
                            {o.originalPriceYer && (
                              <span className="line-through text-gray-400">
                                {o.originalPriceYer.toLocaleString()} ر.ي
                              </span>
                            )}
                            {o.displayLabel && <span className="text-gray-600">— {o.displayLabel}</span>}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {!o.hasFreeShipping && o.shippingFeeYer > 0 && `شحن: ${o.shippingFeeYer} ر.ي · `}
                            {o.marketerCommissionPercent != null && `عمولة مسوّق: ${o.marketerCommissionPercent}% · `}
                            ترتيب: {o.sortOrder}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => startEdit(o)} data-testid={`button-edit-${o.id}`}>
                            تعديل
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => { if (confirm("حذف هذا العرض؟")) deleteMutation.mutate(o.id); }}
                            data-testid={`button-delete-${o.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
