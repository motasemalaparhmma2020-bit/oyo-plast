import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save } from "lucide-react";

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

/**
 * محرّر عروض الكميات (product_volume_offers) لمنتج واحد — نسخة مُدمَجة داخل نموذج المنتج.
 * يقرأ/يكتب نفس بيانات صفحة /admin/volume-offers (نفس الـ API ومفاتيح الكاش) فيبقى الموضعان متزامنين.
 */
export default function InlineVolumeOffers({ productId, adminToken }: { productId: number; adminToken: string | null }) {
  const { toast } = useToast();
  const pid = String(productId);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const adminFetch = async (method: string, url: string, body?: any) => {
    const res = await fetch(url, {
      method,
      headers: {
        "x-admin-token": adminToken || "",
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

  const { data: offers = [], isLoading: offersLoading } = useQuery<VolumeOffer[]>({
    queryKey: ["/api/admin/volume-offers", pid],
    queryFn: async () => {
      const res = await adminFetch("GET", `/api/admin/volume-offers?productId=${pid}`);
      return res.json();
    },
  });

  const resetForm = () => { setForm({ ...emptyForm }); setEditingId(null); setShowForm(false); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        productId,
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
      if (editingId) return adminFetch("PATCH", `/api/admin/volume-offers/${editingId}`, body);
      return adminFetch("POST", "/api/admin/volume-offers", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/volume-offers", pid] });
      toast({ title: editingId ? "تم التحديث" : "تم الإنشاء" });
      resetForm();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message || "فشل الحفظ", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => adminFetch("DELETE", `/api/admin/volume-offers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/volume-offers", pid] });
      toast({ title: "تم الحذف" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message, variant: "destructive" }),
  });

  const startEdit = (o: VolumeOffer) => {
    setEditingId(o.id);
    setShowForm(true);
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

  return (
    <div className="space-y-3" data-testid="inline-volume-offers">
      {/* قائمة العروض الحالية */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">العروض الحالية ({offers.length})</p>
        {!showForm && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => { setForm({ ...emptyForm }); setEditingId(null); setShowForm(true); }}
            className="text-xs h-7 gap-1"
            data-testid="button-inline-add-offer"
          >
            <Plus className="w-3.5 h-3.5" /> إضافة عرض
          </Button>
        )}
      </div>

      {offersLoading ? (
        <p className="text-center text-xs text-gray-500 py-3">جاري التحميل...</p>
      ) : offers.length === 0 ? (
        <p className="text-center text-xs text-gray-500 py-3">لا يوجد عروض بعد — أضف عرضاً.</p>
      ) : (
        <div className="space-y-2">
          {offers.map(o => (
            <div
              key={o.id}
              className="border rounded-lg p-2.5 flex flex-col md:flex-row md:items-center gap-2 bg-white dark:bg-gray-900"
              data-testid={`inline-row-offer-${o.id}`}
            >
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                  <span className="font-bold text-sm">
                    {o.minQuantity}{o.maxQuantity ? ` – ${o.maxQuantity}` : "+"} قطعة
                  </span>
                  {o.badgeText && <Badge className="bg-orange-500 text-[10px]">{o.badgeText}</Badge>}
                  {!o.isActive && <Badge variant="outline" className="text-[10px]">معطّل</Badge>}
                  {o.hasFreeShipping && <Badge className="bg-green-500 text-[10px]">🚚 مجاني</Badge>}
                </div>
                <div className="flex flex-wrap items-baseline gap-1.5 text-xs">
                  <span className="text-blue-600 font-bold">{o.offerPriceYer.toLocaleString()} ر.ي / قطعة</span>
                  {o.originalPriceYer && <span className="line-through text-gray-400">{o.originalPriceYer.toLocaleString()} ر.ي</span>}
                  {o.displayLabel && <span className="text-gray-600">— {o.displayLabel}</span>}
                </div>
              </div>
              <div className="flex gap-1.5">
                <Button type="button" size="sm" variant="outline" onClick={() => startEdit(o)} className="h-7 text-xs" data-testid={`button-inline-edit-${o.id}`}>تعديل</Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => { if (confirm("حذف هذا العرض؟")) deleteMutation.mutate(o.id); }}
                  className="h-7 w-7 p-0"
                  data-testid={`button-inline-delete-${o.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* نموذج الإضافة/التعديل */}
      {showForm && (
        <div className="border rounded-lg p-3 bg-muted/30 space-y-3" data-testid="inline-offer-form">
          <p className="font-bold text-xs">{editingId ? "تعديل العرض" : "إضافة عرض جديد"}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px]">الحد الأدنى للكمية *</Label>
              <Input type="number" value={form.minQuantity} onChange={e => setForm(f => ({ ...f, minQuantity: e.target.value }))} placeholder="100" className="h-8 text-sm" data-testid="input-inline-min-quantity" />
            </div>
            <div>
              <Label className="text-[10px]">الحد الأعلى (فارغ = ∞)</Label>
              <Input type="number" value={form.maxQuantity} onChange={e => setForm(f => ({ ...f, maxQuantity: e.target.value }))} placeholder="499" className="h-8 text-sm" data-testid="input-inline-max-quantity" />
            </div>
            <div>
              <Label className="text-[10px]">ترتيب العرض</Label>
              <Input type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))} className="h-8 text-sm" data-testid="input-inline-sort-order" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">سعر العرض لكل قطعة (YER) *</Label>
              <Input type="number" step="0.01" value={form.offerPriceYer} onChange={e => setForm(f => ({ ...f, offerPriceYer: e.target.value }))} placeholder="250" className="h-8 text-sm" data-testid="input-inline-offer-price" />
            </div>
            <div>
              <Label className="text-[10px]">السعر الأصلي للشطب (اختياري)</Label>
              <Input type="number" step="0.01" value={form.originalPriceYer} onChange={e => setForm(f => ({ ...f, originalPriceYer: e.target.value }))} placeholder="350" className="h-8 text-sm" data-testid="input-inline-original-price" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">نص العرض (اختياري)</Label>
              <Input value={form.displayLabel} onChange={e => setForm(f => ({ ...f, displayLabel: e.target.value }))} placeholder="عرض 100 كيس" className="h-8 text-sm" data-testid="input-inline-display-label" />
            </div>
            <div>
              <Label className="text-[10px]">نص الشارة (اختياري)</Label>
              <Input value={form.badgeText} onChange={e => setForm(f => ({ ...f, badgeText: e.target.value }))} placeholder="الأكثر طلباً" className="h-8 text-sm" data-testid="input-inline-badge-text" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
              <Switch checked={form.hasFreeShipping} onCheckedChange={(c) => setForm(f => ({ ...f, hasFreeShipping: c }))} data-testid="switch-inline-free-shipping" />
              <Label className="flex-1 text-xs">شحن مجاني</Label>
            </div>
            <div>
              <Label className="text-[10px]">أو رسوم شحن رمزية (YER)</Label>
              <Input type="number" step="0.01" value={form.shippingFeeYer} onChange={e => setForm(f => ({ ...f, shippingFeeYer: e.target.value }))} placeholder="0" disabled={form.hasFreeShipping} className="h-8 text-sm" data-testid="input-inline-shipping-fee" />
            </div>
          </div>
          <div>
            <Label className="text-[10px]">عمولة المسوّق (%) — فارغ = افتراضي المنتج</Label>
            <Input type="number" step="0.01" value={form.marketerCommissionPercent} onChange={e => setForm(f => ({ ...f, marketerCommissionPercent: e.target.value }))} placeholder="5" className="h-8 text-sm" data-testid="input-inline-marketer-commission" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.isActive} onCheckedChange={(c) => setForm(f => ({ ...f, isActive: c }))} data-testid="switch-inline-active" />
            <Label className="text-xs">العرض مفعّل</Label>
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !form.minQuantity || !form.offerPriceYer}
              className="gap-1.5 h-8 text-xs"
              data-testid="button-inline-save-offer"
            >
              <Save className="w-3.5 h-3.5" />
              {saveMutation.isPending ? "جاري الحفظ..." : (editingId ? "تحديث العرض" : "إضافة العرض")}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={resetForm} className="h-8 text-xs" data-testid="button-inline-cancel-offer">إلغاء</Button>
          </div>
        </div>
      )}
    </div>
  );
}
