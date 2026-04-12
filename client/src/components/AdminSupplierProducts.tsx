import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle, XCircle, Eye, Package, Settings2,
  RefreshCw, Trash2, ImageIcon, AlertCircle,
} from "lucide-react";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:  { label: "قيد المراجعة", color: "bg-yellow-100 text-yellow-800" },
  approved: { label: "مقبول",        color: "bg-green-100 text-green-800"  },
  rejected: { label: "مرفوض",       color: "bg-red-100 text-red-800"      },
};

function formatPrice(p: any) {
  return Number(p || 0).toLocaleString("ar-YE");
}

interface Props {
  adminToken: string | null;
}

export default function AdminSupplierProducts({ adminToken }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState("pending");
  const [selected, setSelected] = useState<any | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [rejectNote, setRejectNote] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [imgSettings, setImgSettings] = useState<any>({});

  const headers = { "x-admin-token": adminToken ?? "" };

  // ─── جلب المنتجات ──────────────────────────────────────────────────
  const { data: products = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/supplier-products", filterStatus],
    queryFn: async () => {
      const res = await fetch(`/api/admin/supplier-products?status=${filterStatus}`, { headers });
      if (!res.ok) throw new Error("فشل الجلب");
      return res.json();
    },
  });

  // ─── جلب إعدادات الصور ─────────────────────────────────────────────
  const { data: imgSettingsData } = useQuery<any>({
    queryKey: ["/api/admin/image-settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/image-settings", { headers });
      if (!res.ok) return {};
      return res.json();
    },
  });

  // ─── موافقة ─────────────────────────────────────────────────────────
  const approveMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/admin/supplier-products/${id}/approve`, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("فشل الموافقة");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تمت الموافقة ✅", description: "المنتج أصبح مرئياً في المتجر" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/supplier-products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setSelected(null);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  // ─── رفض ────────────────────────────────────────────────────────────
  const rejectMutation = useMutation({
    mutationFn: async ({ id, note }: { id: number; note: string }) => {
      const res = await fetch(`/api/admin/supplier-products/${id}/reject`, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ adminNotes: note }),
      });
      if (!res.ok) throw new Error("فشل الرفض");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم الرفض", description: "تم إخطار المورد بسبب الرفض" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/supplier-products"] });
      setSelected(null);
      setRejectNote("");
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  // ─── حذف ────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/supplier-products/${id}`, {
        method: "DELETE", headers,
      });
      if (!res.ok) throw new Error("فشل الحذف");
    },
    onSuccess: () => {
      toast({ title: "تم الحذف" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/supplier-products"] });
      setSelected(null);
    },
  });

  // ─── حفظ إعدادات الصور ──────────────────────────────────────────────
  const saveImgSettings = async () => {
    const res = await fetch("/api/admin/image-settings", {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(imgSettings),
    });
    if (res.ok) {
      toast({ title: "تم حفظ الإعدادات ✅" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/image-settings"] });
      setShowSettings(false);
    }
  };

  function openProduct(p: any) {
    setSelected(p);
    setEditMode(false);
    setEditForm({
      name: p.name,
      description: p.description,
      price: p.price,
      imageUrl: p.image_url,
      stock: p.stock,
      adminNotes: p.admin_notes,
    });
    setRejectNote(p.admin_notes || "");
  }

  function openSettings() {
    setImgSettings({
      imgMaxWidth: imgSettingsData?.img_max_width ?? 1200,
      imgMaxHeight: imgSettingsData?.img_max_height ?? 1200,
      imgQuality: imgSettingsData?.img_quality ?? 80,
      imgMaxSizeMb: imgSettingsData?.img_max_size_mb ?? 5,
      supplierProductAutoApprove: imgSettingsData?.supplier_product_auto_approve ?? false,
    });
    setShowSettings(true);
  }

  const pendingCount = products.length;

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">منتجات الموردين</h2>
          <p className="text-sm text-gray-500 mt-0.5">مراجعة وموافقة المنتجات المقدمة من الموردين</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={openSettings} data-testid="button-img-settings">
            <Settings2 className="w-4 h-4 ml-1" /> إعدادات الصور
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { v: "pending",  l: "قيد المراجعة" },
          { v: "approved", l: "مقبولة" },
          { v: "rejected", l: "مرفوضة" },
        ].map(({ v, l }) => (
          <Button
            key={v}
            variant={filterStatus === v ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterStatus(v)}
            data-testid={`filter-${v}`}
          >
            {l}
          </Button>
        ))}
      </div>

      {/* Products list */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16">
          <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">لا توجد منتجات في هذه الفئة</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {products.map((p: any) => {
            const st = STATUS_LABELS[p.product_status] ?? STATUS_LABELS.pending;
            return (
              <Card
                key={p.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => openProduct(p)}
                data-testid={`product-card-${p.id}`}
              >
                <CardContent className="p-3 flex gap-3">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <ImageIcon className="h-6 w-6 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-sm text-gray-800 dark:text-white line-clamp-1">{p.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${st.color}`}>
                        {st.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      المورد: <span className="font-medium">{p.supplier_name}</span>
                    </p>
                    <p className="text-sm font-bold text-primary mt-1">{formatPrice(p.price)} ر.ي</p>
                    {p.admin_notes && (
                      <p className="text-xs text-red-500 mt-0.5 line-clamp-1">ملاحظة: {p.admin_notes}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ─── Dialog: تفاصيل المنتج + موافقة/رفض ─── */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">مراجعة المنتج</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              {/* صورة المنتج */}
              {selected.image_url && !editMode && (
                <img
                  src={selected.image_url}
                  alt={selected.name}
                  className="w-full h-48 object-contain rounded-xl bg-gray-50"
                />
              )}

              {/* معلومات المورد */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-sm">
                <p className="font-bold text-blue-800 dark:text-blue-300">
                  المورد: {selected.supplier_name}
                </p>
                <p className="text-blue-600 dark:text-blue-400 text-xs mt-0.5">
                  الهاتف: {selected.supplier_phone}
                </p>
              </div>

              {editMode ? (
                /* ── نموذج التعديل ── */
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">اسم المنتج *</Label>
                    <Input
                      value={editForm.name || ""}
                      onChange={e => setEditForm((f: any) => ({ ...f, name: e.target.value }))}
                      data-testid="input-edit-name"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">الوصف</Label>
                    <Textarea
                      value={editForm.description || ""}
                      onChange={e => setEditForm((f: any) => ({ ...f, description: e.target.value }))}
                      rows={2}
                      data-testid="input-edit-desc"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">السعر (ر.ي) *</Label>
                      <Input
                        type="number"
                        value={editForm.price || ""}
                        onChange={e => setEditForm((f: any) => ({ ...f, price: e.target.value }))}
                        data-testid="input-edit-price"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">المخزون</Label>
                      <Input
                        type="number"
                        value={editForm.stock || ""}
                        onChange={e => setEditForm((f: any) => ({ ...f, stock: e.target.value }))}
                        data-testid="input-edit-stock"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">رابط الصورة (اختياري — لتغيير الصورة)</Label>
                    <Input
                      value={editForm.imageUrl || ""}
                      onChange={e => setEditForm((f: any) => ({ ...f, imageUrl: e.target.value }))}
                      placeholder="اترك فارغاً للإبقاء على الصورة الحالية"
                      data-testid="input-edit-image"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">ملاحظة للمورد (اختيارية)</Label>
                    <Textarea
                      value={editForm.adminNotes || ""}
                      onChange={e => setEditForm((f: any) => ({ ...f, adminNotes: e.target.value }))}
                      rows={2}
                      placeholder="ستظهر للمورد بجانب منتجه"
                      data-testid="input-edit-notes"
                    />
                  </div>
                </div>
              ) : (
                /* ── عرض المعلومات ── */
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">الاسم:</span>
                    <span className="font-bold">{selected.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">السعر:</span>
                    <span className="font-bold text-primary">{formatPrice(selected.price)} ر.ي</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">المخزون:</span>
                    <span>{selected.stock ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">القسم:</span>
                    <span>{selected.category_name ?? "—"}</span>
                  </div>
                  {selected.description && (
                    <div>
                      <span className="text-gray-500">الوصف:</span>
                      <p className="mt-1 text-gray-700 dark:text-gray-300">{selected.description}</p>
                    </div>
                  )}
                  {selected.admin_notes && (
                    <div className="bg-red-50 dark:bg-red-900/20 rounded p-2">
                      <p className="text-xs text-red-700 dark:text-red-300">ملاحظة سابقة: {selected.admin_notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* منطقة الرفض */}
              {!editMode && selected.product_status !== "approved" && (
                <div>
                  <Label className="text-xs">سبب الرفض (يظهر للمورد)</Label>
                  <Textarea
                    value={rejectNote}
                    onChange={e => setRejectNote(e.target.value)}
                    rows={2}
                    placeholder="مثال: الصورة غير واضحة / السعر مرتفع جداً..."
                    data-testid="input-reject-note"
                  />
                </div>
              )}

              {/* أزرار الإجراءات */}
              <div className="flex gap-2 flex-wrap">
                {!editMode && selected.product_status !== "approved" && (
                  <>
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() => approveMutation.mutate({ id: selected.id, data: {} })}
                      disabled={approveMutation.isPending}
                      data-testid="button-approve"
                    >
                      {approveMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin ml-1" /> : <CheckCircle className="w-4 h-4 ml-1" />}
                      موافقة ونشر
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => rejectMutation.mutate({ id: selected.id, note: rejectNote })}
                      disabled={rejectMutation.isPending}
                      data-testid="button-reject"
                    >
                      {rejectMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin ml-1" /> : <XCircle className="w-4 h-4 ml-1" />}
                      رفض
                    </Button>
                  </>
                )}
                {!editMode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditMode(true)}
                    data-testid="button-edit"
                  >
                    تعديل قبل الموافقة
                  </Button>
                )}
                {editMode && (
                  <>
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() => approveMutation.mutate({ id: selected.id, data: editForm })}
                      disabled={approveMutation.isPending}
                      data-testid="button-approve-edited"
                    >
                      حفظ وموافقة
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={() => setEditMode(false)}>
                      إلغاء
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-500 hover:text-red-700"
                  onClick={() => deleteMutation.mutate(selected.id)}
                  disabled={deleteMutation.isPending}
                  data-testid="button-delete-product"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Dialog: إعدادات الصور ─── */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">إعدادات معالجة الصور</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-300 flex gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>كل صورة مرفوعة (سواء من الأدمن أو المورد) تُضغط تلقائياً بحسب هذه الإعدادات</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">أقصى عرض (بكسل)</Label>
                <Input
                  type="number"
                  value={imgSettings.imgMaxWidth || 1200}
                  onChange={e => setImgSettings((s: any) => ({ ...s, imgMaxWidth: +e.target.value }))}
                  data-testid="input-img-max-width"
                />
              </div>
              <div>
                <Label className="text-xs">أقصى ارتفاع (بكسل)</Label>
                <Input
                  type="number"
                  value={imgSettings.imgMaxHeight || 1200}
                  onChange={e => setImgSettings((s: any) => ({ ...s, imgMaxHeight: +e.target.value }))}
                  data-testid="input-img-max-height"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">جودة الضغط (1-100)</Label>
                <Input
                  type="number"
                  min={10} max={100}
                  value={imgSettings.imgQuality || 80}
                  onChange={e => setImgSettings((s: any) => ({ ...s, imgQuality: +e.target.value }))}
                  data-testid="input-img-quality"
                />
              </div>
              <div>
                <Label className="text-xs">أقصى حجم رفع (ميجابايت)</Label>
                <Input
                  type="number"
                  min={1} max={20}
                  value={imgSettings.imgMaxSizeMb || 5}
                  onChange={e => setImgSettings((s: any) => ({ ...s, imgMaxSizeMb: +e.target.value }))}
                  data-testid="input-img-max-size"
                />
              </div>
            </div>
            <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <div>
                <p className="text-sm font-medium">موافقة تلقائية على منتجات الموردين</p>
                <p className="text-xs text-gray-500">إذا كانت مفعّلة تُنشر المنتجات مباشرة دون مراجعة</p>
              </div>
              <Switch
                checked={imgSettings.supplierProductAutoApprove ?? false}
                onCheckedChange={v => setImgSettings((s: any) => ({ ...s, supplierProductAutoApprove: v }))}
                data-testid="switch-auto-approve"
              />
            </div>
            <Button className="w-full" onClick={saveImgSettings} data-testid="button-save-img-settings">
              حفظ الإعدادات
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
