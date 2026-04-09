import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, ImagePlus, Loader2, Building2, X, RefreshCw, Copy } from "lucide-react";

interface BankAccountForm {
  bankName: string;
  accountName: string;
  accountNumber: string;
  iban: string;
  branch: string;
  instructions: string;
  isActive: boolean;
  sortOrder: number;
  logoFile?: File | null;
  logoUrl?: string;
}

const emptyForm: BankAccountForm = {
  bankName: "",
  accountName: "",
  accountNumber: "",
  iban: "",
  branch: "",
  instructions: "",
  isActive: true,
  sortOrder: 0,
  logoFile: null,
  logoUrl: "",
};

interface BankAccount {
  id: number;
  bankName: string;
  accountName: string;
  accountNumber: string;
  iban?: string;
  branch?: string;
  logoUrl?: string;
  instructions?: string;
  isActive: boolean;
  sortOrder: number;
}

async function submitBankAccount(url: string, method: string, form: BankAccountForm, adminToken: string) {
  const fd = new FormData();
  fd.append("bankName", form.bankName);
  fd.append("accountName", form.accountName);
  fd.append("accountNumber", form.accountNumber);
  fd.append("iban", form.iban);
  fd.append("branch", form.branch);
  fd.append("instructions", form.instructions);
  fd.append("isActive", String(form.isActive));
  fd.append("sortOrder", String(form.sortOrder));
  if (form.logoFile) fd.append("logo", form.logoFile);
  const res = await fetch(url, {
    method,
    headers: { "x-admin-token": adminToken },
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "فشل الحفظ");
  }
  return res.json();
}

export default function AdminBankAccounts({ adminToken }: { adminToken: string | null }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [form, setForm] = useState<BankAccountForm>(emptyForm);

  const { data: accounts = [], isLoading, refetch } = useQuery<BankAccount[]>({
    queryKey: ["/api/admin/bank-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/admin/bank-accounts", {
        headers: { "x-admin-token": adminToken || "" },
      });
      return res.ok ? res.json() : [];
    },
    enabled: !!adminToken,
  });

  const createMut = useMutation({
    mutationFn: () => submitBankAccount("/api/admin/bank-accounts", "POST", form, adminToken || ""),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/bank-accounts"] });
      qc.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      toast({ title: "✅ تم إضافة الحساب البنكي" });
      setShowForm(false);
      setForm(emptyForm);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: () =>
      submitBankAccount(`/api/admin/bank-accounts/${editing!.id}`, "PATCH", form, adminToken || ""),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/bank-accounts"] });
      qc.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      toast({ title: "✅ تم تحديث الحساب البنكي" });
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin/bank-accounts/${id}`, {
        method: "DELETE",
        headers: { "x-admin-token": adminToken || "" },
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/bank-accounts"] });
      qc.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      toast({ title: "✅ تم حذف الحساب" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const startEdit = (acc: BankAccount) => {
    setEditing(acc);
    setForm({
      bankName: acc.bankName,
      accountName: acc.accountName,
      accountNumber: acc.accountNumber,
      iban: acc.iban || "",
      branch: acc.branch || "",
      instructions: acc.instructions || "",
      isActive: acc.isActive,
      sortOrder: acc.sortOrder,
      logoFile: null,
      logoUrl: acc.logoUrl || "",
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) updateMut.mutate();
    else createMut.mutate();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "✅ تم النسخ" });
  };

  return (
    <Card className="mt-6" data-testid="admin-bank-accounts">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-blue-600" />
          <CardTitle>الحسابات البنكية (التحويل البنكي)</CardTitle>
          <Badge variant="secondary">{accounts.length}</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} data-testid="button-refresh-bank-accounts">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            className="gap-2"
            onClick={() => { setShowForm(true); setEditing(null); setForm(emptyForm); }}
            data-testid="button-add-bank-account"
          >
            <Plus className="h-4 w-4" />
            إضافة حساب بنكي
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* نموذج */}
        {showForm && (
          <div className="mb-6 p-4 border rounded-xl bg-muted/30 relative">
            <button
              className="absolute top-3 left-3 text-gray-400 hover:text-gray-700"
              onClick={() => { setShowForm(false); setEditing(null); setForm(emptyForm); }}
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="font-semibold mb-4">{editing ? "تعديل الحساب البنكي" : "إضافة حساب بنكي جديد"}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>اسم البنك *</Label>
                  <Input
                    value={form.bankName}
                    onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))}
                    placeholder="مثال: بنك كريمي الدولي"
                    required
                    data-testid="input-bank-name"
                  />
                </div>
                <div>
                  <Label>اسم صاحب الحساب *</Label>
                  <Input
                    value={form.accountName}
                    onChange={e => setForm(f => ({ ...f, accountName: e.target.value }))}
                    placeholder="الاسم كما هو في البنك"
                    required
                    data-testid="input-account-name"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>رقم الحساب / رقم البطاقة *</Label>
                  <Input
                    value={form.accountNumber}
                    onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value }))}
                    placeholder="XXXX-XXXX-XXXX"
                    required
                    data-testid="input-account-number"
                  />
                </div>
                <div>
                  <Label>IBAN (اختياري)</Label>
                  <Input
                    value={form.iban}
                    onChange={e => setForm(f => ({ ...f, iban: e.target.value }))}
                    placeholder="YE00XXXX..."
                    data-testid="input-iban"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>الفرع (اختياري)</Label>
                  <Input
                    value={form.branch}
                    onChange={e => setForm(f => ({ ...f, branch: e.target.value }))}
                    placeholder="مثال: فرع صنعاء الرئيسي"
                    data-testid="input-branch"
                  />
                </div>
                <div>
                  <Label>ترتيب العرض</Label>
                  <Input
                    type="number"
                    value={form.sortOrder}
                    onChange={e => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                    data-testid="input-bank-sort"
                  />
                </div>
              </div>

              <div>
                <Label>تعليمات التحويل (اختيارية)</Label>
                <Textarea
                  value={form.instructions}
                  onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
                  placeholder="مثال: قم بالتحويل ثم أرسل إيصال الدفع مع رقم طلبك..."
                  className="min-h-[80px] text-right"
                  data-testid="textarea-bank-instructions"
                />
              </div>

              <div>
                <Label>شعار البنك (اختياري)</Label>
                <div className="flex items-center gap-4 mt-1">
                  <label
                    htmlFor="bank-logo-upload"
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md cursor-pointer hover:bg-primary/90 transition-colors text-sm"
                  >
                    <ImagePlus className="h-4 w-4" />
                    {form.logoFile ? form.logoFile.name : "رفع شعار"}
                  </label>
                  <input
                    type="file"
                    id="bank-logo-upload"
                    accept="image/*"
                    className="hidden"
                    onChange={e => setForm(f => ({ ...f, logoFile: e.target.files?.[0] || null }))}
                    data-testid="input-bank-logo"
                  />
                  {(form.logoUrl || form.logoFile) && (
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 border">
                      <img
                        src={form.logoFile ? URL.createObjectURL(form.logoFile) : form.logoUrl}
                        alt="معاينة"
                        className="w-full h-full object-contain p-1"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))}
                  id="bank-active"
                  data-testid="switch-bank-active"
                />
                <Label htmlFor="bank-active">مفعّل (يظهر للعملاء في الدفع)</Label>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  disabled={createMut.isPending || updateMut.isPending}
                  className="gap-2"
                  data-testid="button-save-bank-account"
                >
                  {(createMut.isPending || updateMut.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editing ? "حفظ التعديلات" : "إضافة الحساب"}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditing(null); setForm(emptyForm); }}>
                  إلغاء
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* قائمة الحسابات */}
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>لا توجد حسابات بنكية بعد</p>
            <p className="text-sm mt-1">أضف حساباتك البنكية ليتمكن العملاء من التحويل إليها</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {accounts.map(acc => (
              <div
                key={acc.id}
                className={`rounded-xl border p-4 shadow-sm ${acc.isActive ? "bg-card" : "bg-muted/40 opacity-70"}`}
                data-testid={`card-bank-account-${acc.id}`}
              >
                <div className="flex items-start gap-3">
                  {acc.logoUrl ? (
                    <img src={acc.logoUrl} alt={acc.bankName} className="w-12 h-12 rounded-lg object-contain border bg-white p-1 shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                      <Building2 className="h-6 w-6 text-blue-600" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold">{acc.bankName}</p>
                      {!acc.isActive && <Badge variant="secondary" className="text-xs">مخفي</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{acc.accountName}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <p className="text-sm font-mono font-bold">{acc.accountNumber}</p>
                      <button
                        className="text-primary hover:opacity-70"
                        onClick={() => copyToClipboard(acc.accountNumber)}
                        data-testid={`button-copy-account-${acc.id}`}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {acc.iban && <p className="text-xs text-muted-foreground mt-0.5">IBAN: {acc.iban}</p>}
                    {acc.branch && <p className="text-xs text-muted-foreground">{acc.branch}</p>}
                    {acc.instructions && (
                      <p className="text-xs text-blue-600 mt-1 line-clamp-2">{acc.instructions}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(acc)} data-testid={`button-edit-bank-${acc.id}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => { if (confirm(`حذف حساب "${acc.bankName}"؟`)) deleteMut.mutate(acc.id); }}
                      data-testid={`button-delete-bank-${acc.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
