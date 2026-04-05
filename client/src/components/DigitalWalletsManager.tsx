import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Trash2, Edit2, Plus, Loader2, X, Wallet } from "lucide-react";

interface DigitalWallet {
  id: number;
  name: string;
  logoUrl: string | null;
  receiverName: string;
  phoneNumber: string;
  purchaseCode: string;
  isActive: boolean;
  sortOrder: number;
  requiresProof: boolean;
  instructions: string | null;
}

const emptyForm = {
  name: "",
  receiverName: "",
  phoneNumber: "",
  purchaseCode: "",
  isActive: true,
  sortOrder: 0,
  requiresProof: true,
  instructions: "",
};

export function DigitalWalletsManager({ adminToken }: { adminToken: string | null }) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { data: wallets = [], isLoading } = useQuery<DigitalWallet[]>({
    queryKey: ["/api/admin/digital-wallets"],
    queryFn: async () => {
      if (!adminToken) return [];
      const res = await fetch("/api/admin/digital-wallets", {
        headers: { "x-admin-token": adminToken },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!adminToken,
  });

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setLogoFile(null);
    setLogoPreview(null);
    setShowForm(true);
  };

  const openEdit = (wallet: DigitalWallet) => {
    setEditingId(wallet.id);
    setForm({
      name: wallet.name ?? "",
      receiverName: wallet.receiverName ?? "",
      phoneNumber: wallet.phoneNumber ?? "",
      purchaseCode: wallet.purchaseCode ?? "",
      isActive: wallet.isActive ?? true,
      sortOrder: wallet.sortOrder ?? 0,
      requiresProof: wallet.requiresProof ?? true,
      instructions: wallet.instructions ?? "",
    });
    setLogoFile(null);
    setLogoPreview(wallet.logoUrl ?? null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
    setLogoFile(null);
    setLogoPreview(null);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    if (!form.name.trim() || !form.receiverName.trim() || !form.phoneNumber.trim()) {
      toast({ title: "خطأ", description: "الاسم والمستلم والرقم مطلوبة", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const fd = new FormData();
      fd.append("name", form.name.trim());
      fd.append("receiverName", form.receiverName.trim());
      fd.append("phoneNumber", form.phoneNumber.trim());
      fd.append("purchaseCode", form.purchaseCode.trim());
      fd.append("isActive", String(form.isActive));
      fd.append("sortOrder", String(form.sortOrder));
      fd.append("requiresProof", String(form.requiresProof));
      fd.append("instructions", form.instructions.trim());
      if (logoFile) fd.append("logo", logoFile);

      const url = editingId
        ? `/api/admin/digital-wallets/${editingId}`
        : "/api/admin/digital-wallets";

      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "x-admin-token": adminToken },
        body: fd,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "فشل الحفظ");
      }

      toast({ title: editingId ? "✅ تم التحديث" : "✅ تمت الإضافة" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/digital-wallets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/digital-wallets"] });
      closeForm();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`هل متأكد من حذف "${name}"؟`)) return;
    if (!adminToken) return;
    try {
      const res = await fetch(`/api/admin/digital-wallets/${id}`, {
        method: "DELETE",
        headers: { "x-admin-token": adminToken },
      });
      if (!res.ok) throw new Error("فشل الحذف");
      toast({ title: "✅ تم الحذف" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/digital-wallets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/digital-wallets"] });
    } catch {
      toast({ title: "خطأ في الحذف", variant: "destructive" });
    }
  };

  const handleToggleActive = async (wallet: DigitalWallet) => {
    if (!adminToken) return;
    try {
      const fd = new FormData();
      fd.append("name", wallet.name);
      fd.append("receiverName", wallet.receiverName);
      fd.append("phoneNumber", wallet.phoneNumber);
      fd.append("purchaseCode", wallet.purchaseCode ?? "");
      fd.append("isActive", String(!wallet.isActive));
      fd.append("sortOrder", String(wallet.sortOrder));
      fd.append("requiresProof", String(wallet.requiresProof));
      fd.append("instructions", wallet.instructions ?? "");

      const res = await fetch(`/api/admin/digital-wallets/${wallet.id}`, {
        method: "PATCH",
        headers: { "x-admin-token": adminToken },
        body: fd,
      });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/digital-wallets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/digital-wallets"] });
      toast({ title: wallet.isActive ? "تم التعطيل" : "✅ تم التفعيل" });
    } catch {
      toast({ title: "خطأ", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {wallets.length} محفظة · {wallets.filter(w => w.isActive).length} مفعّل
        </span>
        <Button onClick={openAdd} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          إضافة محفظة
        </Button>
      </div>

      {/* Wallet Cards */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : wallets.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Wallet className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>لا توجد محافظ بعد</p>
        </div>
      ) : (
        <div className="space-y-3">
          {wallets.map((wallet) => (
            <div
              key={wallet.id}
              className={`rounded-xl border p-4 flex items-center gap-4 transition-all ${
                wallet.isActive ? "bg-background" : "bg-muted/40 opacity-70"
              }`}
            >
              {/* Logo */}
              <div className="shrink-0 w-14 h-14 rounded-xl overflow-hidden border bg-muted flex items-center justify-center">
                {wallet.logoUrl ? (
                  <img src={wallet.logoUrl} alt={wallet.name} className="w-full h-full object-cover" />
                ) : (
                  <Wallet className="h-6 w-6 text-muted-foreground" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-sm">{wallet.name}</span>
                  <Badge
                    className={wallet.isActive
                      ? "bg-green-100 text-green-800 text-xs"
                      : "bg-gray-100 text-gray-500 text-xs"}
                    variant="secondary"
                  >
                    {wallet.isActive ? "مفعّل" : "معطّل"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">👤 {wallet.receiverName}</p>
                <p className="text-xs font-mono text-muted-foreground">📱 {wallet.phoneNumber}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={wallet.isActive}
                  onCheckedChange={() => handleToggleActive(wallet)}
                />
                <button
                  onClick={() => openEdit(wallet)}
                  className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(wallet.id, wallet.name)}
                  className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-background">
              <h2 className="font-bold text-lg">
                {editingId ? "تعديل المحفظة" : "إضافة محفظة جديدة"}
              </h2>
              <button onClick={closeForm} className="p-1 hover:bg-muted rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              {/* Logo Upload */}
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-20 h-20 rounded-2xl border-2 border-dashed border-muted-foreground/30 overflow-hidden flex items-center justify-center bg-muted cursor-pointer hover:border-primary transition-colors"
                  onClick={() => document.getElementById("logo-upload")?.click()}
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt="preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-2">
                      <Plus className="h-5 w-5 mx-auto text-muted-foreground" />
                      <p className="text-xs text-muted-foreground mt-1">شعار</p>
                    </div>
                  )}
                </div>
                <input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                <p className="text-xs text-muted-foreground">اضغط لرفع الشعار/اللوغو</p>
              </div>

              <div className="space-y-1">
                <Label>اسم المحفظة *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="مثال: محفظة جوالي" required />
              </div>

              <div className="space-y-1">
                <Label>اسم المستلم *</Label>
                <Input value={form.receiverName} onChange={e => setForm(f => ({ ...f, receiverName: e.target.value }))} placeholder="الاسم الكامل للمستلم" required />
              </div>

              <div className="space-y-1">
                <Label>رقم الهاتف/النقطة *</Label>
                <Input value={form.phoneNumber} onChange={e => setForm(f => ({ ...f, phoneNumber: e.target.value }))} placeholder="774997589" dir="ltr" required />
              </div>

              <div className="space-y-1">
                <Label>كود الشراء (اختياري)</Label>
                <Input value={form.purchaseCode} onChange={e => setForm(f => ({ ...f, purchaseCode: e.target.value }))} placeholder="رمز التحقق (اتركه فارغاً إن لم يكن لديك)" />
              </div>

              <div className="space-y-1">
                <Label>تعليمات الدفع (اختياري)</Label>
                <Input value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} placeholder="مثال: حوّل المبلغ ثم أرسل صورة الإيصال" />
              </div>

              <div className="space-y-1">
                <Label>ترتيب العرض</Label>
                <Input type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} min={0} />
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                <Label>تفعيل</Label>
                <Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                <Label>يتطلب صورة إيصال</Label>
                <Switch checked={form.requiresProof} onCheckedChange={v => setForm(f => ({ ...f, requiresProof: v }))} />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={closeForm}>
                  إلغاء
                </Button>
                <Button type="submit" className="flex-1" disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingId ? "تحديث" : "إضافة")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
