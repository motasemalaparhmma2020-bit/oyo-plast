import { useState, useEffect, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowRight, Plus, Trash2, FileText, Package, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

type Supplier = { id: number; name: string; phone: string; type: string };
type Product = { id: number; name: string; smartVariants?: string | null; enableSmartVariants?: boolean };
type POItem = {
  id?: number;
  productId: number | null;
  productNameSnapshot: string;
  variantLabel: string | null;
  quantityOrdered: number;
  unitCost: number;
  lineTotal?: number;
  quantityReceived?: number;
};
type PO = {
  id: number;
  poNumber: string;
  supplierName?: string;
  supplierPhone?: string;
  supplierId: number | null;
  status: "draft" | "sent" | "partial" | "received" | "cancelled";
  subtotal: string;
  shippingCost: string;
  total: string;
  currency: "YER" | "SAR";
  notes: string | null;
  createdAt: string;
  receivedAt: string | null;
  itemsCount?: number;
  items?: any[];
};

const STATUS_LABEL: Record<string, { ar: string; cls: string }> = {
  draft: { ar: "مسودة", cls: "bg-gray-200 text-gray-800" },
  sent: { ar: "مُرسَل", cls: "bg-blue-100 text-blue-800" },
  partial: { ar: "استلام جزئي", cls: "bg-yellow-100 text-yellow-800" },
  received: { ar: "مستلَم", cls: "bg-green-100 text-green-800" },
  cancelled: { ar: "ملغى", cls: "bg-red-100 text-red-800" },
};

function fmt(n: number | string) {
  const v = Number(n) || 0;
  return v.toLocaleString("ar-EG");
}

function adminHeaders(token: string) {
  return { "x-admin-token": token, "Content-Type": "application/json" };
}

// ─── الصفحة الرئيسية ──────────────────────────────────────────────────────
export default function AdminPurchaseOrders() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("admin_token");
    if (!t) { setLocation("/admin"); return; }
    setToken(t);
  }, []);

  const { data: orders = [], isLoading } = useQuery<PO[]>({
    queryKey: ["/api/admin/purchase-orders", statusFilter],
    enabled: !!token,
    queryFn: async () => {
      const url = `/api/admin/purchase-orders${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`;
      const r = await fetch(url, { headers: { "x-admin-token": token! } });
      if (!r.ok) throw new Error("فشل الجلب");
      const data = await r.json();
      return data.map((d: any) => ({ ...d, supplierName: d.supplier_name, supplierPhone: d.supplier_phone, supplierId: d.supplier_id, poNumber: d.po_number, shippingCost: d.shipping_cost, createdAt: d.created_at, receivedAt: d.received_at, itemsCount: d.items_count }));
    },
  });

  if (!token) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20" dir="rtl">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/admin")} data-testid="button-back-admin">
              <ArrowRight className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" /> أوامر الشراء
              </h1>
              <p className="text-xs text-muted-foreground">إدارة المشتريات والمخزون الوارد</p>
            </div>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-1" data-testid="button-new-po">
            <Plus className="h-4 w-4" /> جديد
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-4 space-y-4">
        {/* فلتر الحالة */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { v: "all", l: "الكل" },
            { v: "draft", l: "مسودة" },
            { v: "sent", l: "مُرسَل" },
            { v: "partial", l: "جزئي" },
            { v: "received", l: "مستلَم" },
            { v: "cancelled", l: "ملغى" },
          ].map(f => (
            <Button
              key={f.v}
              variant={statusFilter === f.v ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(f.v)}
              data-testid={`filter-${f.v}`}
            >
              {f.l}
            </Button>
          ))}
        </div>

        {/* القائمة */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : orders.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>لا توجد أوامر شراء بعد</p>
            <Button className="mt-4 gap-1" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> إنشاء أول أمر شراء
            </Button>
          </CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {orders.map(po => (
              <Card
                key={po.id}
                className="cursor-pointer hover:shadow-md transition"
                onClick={() => setDetailId(po.id)}
                data-testid={`po-card-${po.id}`}
              >
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm" data-testid={`po-number-${po.id}`}>{po.poNumber}</span>
                      <Badge className={STATUS_LABEL[po.status]?.cls}>{STATUS_LABEL[po.status]?.ar}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {po.supplierName || "بدون مورد"} • {po.itemsCount || 0} منتج
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(po.createdAt).toLocaleDateString("ar-EG")}
                    </p>
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-blue-600" data-testid={`po-total-${po.id}`}>
                      {fmt(po.total)} {po.currency}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {createOpen && <CreatePODialog token={token} onClose={() => setCreateOpen(false)} />}
      {detailId && (
        <PODetailDialog
          token={token}
          id={detailId}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}

// ─── حوار إنشاء أمر شراء ──────────────────────────────────────────────────
function CreatePODialog({ token, onClose }: { token: string; onClose: () => void }) {
  const { toast } = useToast();
  const [supplierId, setSupplierId] = useState<string>("");
  const [currency, setCurrency] = useState<"YER" | "SAR">("YER");
  const [shippingCost, setShippingCost] = useState("0");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<POItem[]>([
    { productId: null, productNameSnapshot: "", variantLabel: null, quantityOrdered: 1, unitCost: 0 },
  ]);

  const { data: vendors = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/admin/vendors"],
    queryFn: async () => {
      const r = await fetch("/api/admin/vendors", { headers: { "x-admin-token": token } });
      if (!r.ok) throw new Error();
      return r.json();
    },
  });

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/products-light"],
    queryFn: async () => {
      const r = await fetch("/api/admin/products", { headers: { "x-admin-token": token } });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const subtotal = useMemo(
    () => items.reduce((s, it) => s + (Number(it.quantityOrdered) || 0) * (Number(it.unitCost) || 0), 0),
    [items]
  );
  const total = subtotal + (Number(shippingCost) || 0);

  const addItem = () => setItems([...items, { productId: null, productNameSnapshot: "", variantLabel: null, quantityOrdered: 1, unitCost: 0 }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, patch: Partial<POItem>) => setItems(items.map((it, idx) => idx === i ? { ...it, ...patch } : it));

  const onSelectProduct = (i: number, productId: string) => {
    const pid = Number(productId);
    const p = products.find(x => x.id === pid);
    if (!p) return;
    updateItem(i, {
      productId: pid,
      productNameSnapshot: p.name,
      variantLabel: null,
    });
  };

  const getVariants = (productId: number | null): string[] => {
    if (!productId) return [];
    const p = products.find(x => x.id === productId);
    if (!p?.enableSmartVariants || !p.smartVariants) return [];
    try {
      const sv = typeof p.smartVariants === "string" ? JSON.parse(p.smartVariants) : p.smartVariants;
      return (sv.variants || []).map((v: any) => String(v.label || "").trim()).filter(Boolean);
    } catch { return []; }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const body = {
        supplierId: supplierId ? Number(supplierId) : null,
        supplierNameSnapshot: vendors.find(v => v.id === Number(supplierId))?.name || null,
        currency,
        shippingCost: Number(shippingCost) || 0,
        notes: notes || null,
        items: items
          .filter(it => it.productNameSnapshot && it.quantityOrdered > 0 && it.unitCost >= 0)
          .map(it => ({
            productId: it.productId,
            productNameSnapshot: it.productNameSnapshot,
            variantLabel: it.variantLabel || null,
            quantityOrdered: Number(it.quantityOrdered),
            unitCost: Number(it.unitCost),
          })),
      };
      if (body.items.length === 0) throw new Error("أضف منتجاً واحداً على الأقل");
      const r = await fetch("/api/admin/purchase-orders", {
        method: "POST",
        headers: adminHeaders(token),
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.message || "فشل الإنشاء");
      }
      return r.json();
    },
    onSuccess: (po) => {
      toast({ title: "تم إنشاء أمر الشراء", description: po.po_number });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/purchase-orders"] });
      onClose();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>أمر شراء جديد</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* المورد */}
          <div>
            <Label>المورد (vendor)</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger data-testid="select-supplier"><SelectValue placeholder="اختر مورداً (اختياري)" /></SelectTrigger>
              <SelectContent>
                {vendors.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    لا يوجد موردون بنوع vendor. أضف من تبويب الموردين وعدّل النوع.
                  </div>
                ) : vendors.map(v => (
                  <SelectItem key={v.id} value={String(v.id)} data-testid={`supplier-opt-${v.id}`}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>العملة</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as any)}>
                <SelectTrigger data-testid="select-currency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="YER">ريال يمني</SelectItem>
                  <SelectItem value="SAR">ريال سعودي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>تكلفة الشحن</Label>
              <Input type="number" value={shippingCost} onChange={e => setShippingCost(e.target.value)} data-testid="input-shipping" />
            </div>
          </div>

          {/* العناصر */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base font-bold">العناصر</Label>
              <Button size="sm" variant="outline" onClick={addItem} className="gap-1" data-testid="button-add-item">
                <Plus className="h-3 w-3" /> إضافة
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((it, i) => (
                <Card key={i} className="border-2">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-muted-foreground">#{i + 1}</span>
                      {items.length > 1 && (
                        <Button size="icon" variant="ghost" onClick={() => removeItem(i)} data-testid={`button-remove-item-${i}`}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      )}
                    </div>
                    <Select
                      value={it.productId ? String(it.productId) : ""}
                      onValueChange={(v) => onSelectProduct(i, v)}
                    >
                      <SelectTrigger data-testid={`select-product-${i}`}><SelectValue placeholder="اختر منتجاً" /></SelectTrigger>
                      <SelectContent>
                        {products.map(p => (
                          <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {getVariants(it.productId).length > 0 && (
                      <Select
                        value={it.variantLabel || ""}
                        onValueChange={(v) => updateItem(i, { variantLabel: v })}
                      >
                        <SelectTrigger data-testid={`select-variant-${i}`}><SelectValue placeholder="اختر متغيراً (لون/حجم)" /></SelectTrigger>
                        <SelectContent>
                          {getVariants(it.productId).map(v => (
                            <SelectItem key={v} value={v}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">الكمية</Label>
                        <Input type="number" min={1} value={it.quantityOrdered}
                          onChange={e => updateItem(i, { quantityOrdered: Number(e.target.value) || 0 })}
                          data-testid={`input-qty-${i}`} />
                      </div>
                      <div>
                        <Label className="text-xs">تكلفة الوحدة</Label>
                        <Input type="number" min={0} step="0.01" value={it.unitCost}
                          onChange={e => updateItem(i, { unitCost: Number(e.target.value) || 0 })}
                          data-testid={`input-cost-${i}`} />
                      </div>
                    </div>
                    <div className="text-xs text-left text-muted-foreground">
                      الإجمالي: <span className="font-bold">{fmt(it.quantityOrdered * it.unitCost)} {currency}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <Label>ملاحظات</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} data-testid="input-notes" />
          </div>

          {/* الإجمالي */}
          <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200">
            <CardContent className="p-4 space-y-1">
              <div className="flex justify-between text-sm">
                <span>المجموع الفرعي:</span>
                <span className="font-bold">{fmt(subtotal)} {currency}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>الشحن:</span>
                <span>{fmt(Number(shippingCost) || 0)} {currency}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-blue-700 border-t pt-2 mt-2">
                <span>الإجمالي:</span>
                <span data-testid="text-total">{fmt(total)} {currency}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="flex-row gap-2">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} data-testid="button-submit-po">
            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
            حفظ كمسودة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── حوار التفاصيل + الاستلام ─────────────────────────────────────────────
function PODetailDialog({ token, id, onClose }: { token: string; id: number; onClose: () => void }) {
  const { toast } = useToast();
  const [showReceive, setShowReceive] = useState(false);

  const { data: po, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/admin/purchase-orders", id],
    queryFn: async () => {
      const r = await fetch(`/api/admin/purchase-orders/${id}`, { headers: { "x-admin-token": token } });
      if (!r.ok) throw new Error();
      return r.json();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const r = await fetch(`/api/admin/purchase-orders/${id}`, {
        method: "PATCH",
        headers: adminHeaders(token),
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error((await r.json()).message || "فشل");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "تم التحديث" });
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/purchase-orders"] });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/admin/purchase-orders/${id}`, {
        method: "DELETE",
        headers: { "x-admin-token": token },
      });
      if (!r.ok) throw new Error((await r.json()).message || "فشل");
    },
    onSuccess: () => {
      toast({ title: "حُذف" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/purchase-orders"] });
      onClose();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  if (isLoading || !po) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent dir="rtl"><div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div></DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {po.po_number}
            <Badge className={STATUS_LABEL[po.status]?.cls}>{STATUS_LABEL[po.status]?.ar}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted-foreground">المورد:</span> {po.supplier_name || "—"}</div>
            <div><span className="text-muted-foreground">العملة:</span> {po.currency}</div>
            <div><span className="text-muted-foreground">المجموع الفرعي:</span> {fmt(po.subtotal)}</div>
            <div><span className="text-muted-foreground">الشحن:</span> {fmt(po.shipping_cost)}</div>
            <div className="col-span-2 font-bold text-blue-700">الإجمالي: {fmt(po.total)} {po.currency}</div>
            {po.notes && <div className="col-span-2"><span className="text-muted-foreground">ملاحظات:</span> {po.notes}</div>}
          </div>

          <div>
            <h3 className="font-bold text-sm mb-2">العناصر:</h3>
            <div className="space-y-2">
              {(po.items || []).map((it: any) => (
                <Card key={it.id} className="bg-gray-50 dark:bg-gray-900">
                  <CardContent className="p-3 text-sm">
                    <div className="font-bold">{it.product_name_snapshot || it.product_name}</div>
                    {it.variant_label && <div className="text-xs text-muted-foreground">المتغير: {it.variant_label}</div>}
                    <div className="flex justify-between mt-1 text-xs">
                      <span>الكمية: <b>{it.quantity_ordered}</b> {it.quantity_received > 0 && `(مستلَم: ${it.quantity_received})`}</span>
                      <span>تكلفة الوحدة: <b>{fmt(it.unit_cost)}</b></span>
                      <span>الإجمالي: <b>{fmt(it.line_total)}</b></span>
                    </div>
                    {it.product_stock !== null && (
                      <div className="text-xs text-muted-foreground mt-1">المخزون الحالي: {it.product_stock}</div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* أزرار الإجراء */}
          <div className="flex flex-wrap gap-2 border-t pt-3">
            {po.status === "draft" && (
              <Button size="sm" onClick={() => updateStatusMutation.mutate("sent")} data-testid="button-mark-sent">
                وُضع كـ "مُرسَل"
              </Button>
            )}
            {(po.status === "draft" || po.status === "sent" || po.status === "partial") && (
              <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1" onClick={() => setShowReceive(true)} data-testid="button-receive">
                <CheckCircle2 className="h-4 w-4" /> تم الاستلام
              </Button>
            )}
            {po.status !== "received" && po.status !== "cancelled" && (
              <Button size="sm" variant="outline" onClick={() => updateStatusMutation.mutate("cancelled")} data-testid="button-cancel">
                إلغاء
              </Button>
            )}
            {(po.status === "draft" || po.status === "cancelled") && (
              <Button size="sm" variant="destructive" onClick={() => { if (confirm("حذف نهائي؟")) deleteMutation.mutate(); }} className="gap-1" data-testid="button-delete">
                <Trash2 className="h-4 w-4" /> حذف
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onClose}>إغلاق</Button>
          </div>
        </div>

        {showReceive && (
          <ReceiveDialog
            token={token}
            po={po}
            onClose={() => setShowReceive(false)}
            onDone={() => { setShowReceive(false); refetch(); queryClient.invalidateQueries({ queryKey: ["/api/admin/purchase-orders"] }); }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── حوار الاستلام مع معاينة WAC ──────────────────────────────────────────
function ReceiveDialog({ token, po, onClose, onDone }: { token: string; po: any; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [receipts, setReceipts] = useState<Record<number, number>>(() => {
    const r: Record<number, number> = {};
    (po.items || []).forEach((it: any) => {
      r[it.id] = Math.max(0, it.quantity_ordered - it.quantity_received);
    });
    return r;
  });
  const [report, setReport] = useState<any[] | null>(null);
  const [vendorBalanceAdded, setVendorBalanceAdded] = useState<number>(0);

  const receiveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        receipts: Object.entries(receipts)
          .filter(([, q]) => q > 0)
          .map(([itemId, q]) => ({ itemId: Number(itemId), quantityReceived: q })),
      };
      const r = await fetch(`/api/admin/purchase-orders/${po.id}/receive`, {
        method: "POST",
        headers: adminHeaders(token),
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json()).message || "فشل");
      return r.json();
    },
    onSuccess: (data) => {
      setReport(data.wacReport || []);
      setVendorBalanceAdded(Number(data.vendorBalanceAdded || 0));
      toast({ title: data.status === "received" ? "تم الاستلام الكامل" : "استلام جزئي", description: "تم تحديث المخزون والتكلفة" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>تأكيد الاستلام — حساب WAC</DialogTitle>
        </DialogHeader>

        {!report ? (
          <>
            <p className="text-sm text-muted-foreground">
              عدّل الكميات المستلَمة (الافتراضي = الكمية المتبقية). سيتم تحديث المخزون وحساب متوسط التكلفة المرجح (WAC) تلقائياً.
            </p>
            <div className="space-y-2">
              {(po.items || []).map((it: any) => {
                const remaining = it.quantity_ordered - it.quantity_received;
                return (
                  <Card key={it.id}>
                    <CardContent className="p-3 text-sm">
                      <div className="font-bold">{it.product_name_snapshot}</div>
                      {it.variant_label && <div className="text-xs text-muted-foreground mb-1">{it.variant_label}</div>}
                      <div className="text-xs text-muted-foreground">المتبقي: {remaining}</div>
                      <Input type="number" min={0} max={remaining} value={receipts[it.id] ?? 0}
                        onChange={e => setReceipts({ ...receipts, [it.id]: Math.max(0, Math.min(remaining, Number(e.target.value) || 0)) })}
                        className="mt-2"
                        data-testid={`input-receive-${it.id}`} />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <DialogFooter className="flex-row gap-2">
              <Button variant="outline" onClick={onClose}>إلغاء</Button>
              <Button onClick={() => receiveMutation.mutate()} disabled={receiveMutation.isPending} className="bg-green-600 hover:bg-green-700" data-testid="button-confirm-receive">
                {receiveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
                تأكيد الاستلام
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded text-sm">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-bold text-green-800">تم تحديث المخزون والتكلفة</p>
                <p className="text-xs text-green-700">إليك ملخص التأثير على كل منتج:</p>
              </div>
            </div>
            {vendorBalanceAdded > 0 && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded text-sm" data-testid="text-vendor-balance-added">
                <span className="text-lg">💰</span>
                <div>
                  <p className="font-bold text-amber-900">رصيد المورد زاد بـ {fmt(vendorBalanceAdded)} {report?.[0] ? "" : ""}</p>
                  <p className="text-xs text-amber-800">يظهر الآن في صفحة "سداد مستحقات الموردين" بانتظار الدفع.</p>
                </div>
              </div>
            )}
            <div className="space-y-2">
              {report.map((r, i) => (
                <Card key={i} className="bg-blue-50 border-blue-200">
                  <CardContent className="p-3 text-xs space-y-1">
                    <div className="font-bold text-sm">{r.productName}{r.variantLabel && ` — ${r.variantLabel}`}</div>
                    <div>المخزون: {r.oldStock} → <b>{r.newStock}</b> (+{r.recvQty})</div>
                    {r.newAvgCost != null ? (
                      <div>متوسط التكلفة (WAC): {r.oldAvgCost} → <b className="text-blue-700">{r.newAvgCost}</b> (شراء بـ {r.unitCost})</div>
                    ) : (
                      <div className="text-orange-700">⚠️ لم يُحدَّث WAC (المنتج بلا متغيرات أو لم يُحدَّد متغير)</div>
                    )}
                    {r.wacWarning && (
                      <div className="text-orange-800 bg-orange-100 rounded px-2 py-1 mt-1" data-testid={`text-wac-warning-${i}`}>
                        ⚠️ {r.wacWarning}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
            <DialogFooter>
              <Button onClick={onDone} data-testid="button-done">تم</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
