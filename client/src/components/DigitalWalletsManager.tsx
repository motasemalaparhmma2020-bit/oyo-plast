import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  useCreateDigitalWallet,
  useUpdateDigitalWallet,
  useDeleteDigitalWallet,
} from "@/hooks/use-digital-wallets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Copy, Trash2, Edit2, Plus, Loader2 } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

export function DigitalWalletsManager({ adminToken }: { adminToken: string | null }) {
  const { toast } = useToast();
  const [openDialog, setOpenDialog] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    receiverName: "",
    phoneNumber: "",
    purchaseCode: "",
    isActive: true,
    sortOrder: 0,
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const { data: wallets = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/digital-wallets"],
    queryFn: async () => {
      const res = await fetch("/api/digital-wallets");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createMutation = useCreateDigitalWallet(adminToken);
  const updateMutation = useUpdateDigitalWallet(adminToken);
  const deleteMutation = useDeleteDigitalWallet(adminToken);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;

    try {
      const data = {
        ...form,
        logo: logoFile || undefined,
      };

      if (editingId) {
        await updateMutation.mutateAsync({ ...data, id: editingId } as any);
        toast({ title: "✅ تم تحديث المحفظة" });
      } else {
        await createMutation.mutateAsync(data as any);
        toast({ title: "✅ تم إضافة المحفظة" });
      }
      resetForm();
      setOpenDialog(false);
    } catch (err) {
      toast({ title: "❌ خطأ", variant: "destructive" });
    }
  };

  const handleEdit = (wallet: any) => {
    setEditingId(wallet.id);
    setForm({
      name: wallet.name,
      receiverName: wallet.receiverName,
      phoneNumber: wallet.phoneNumber,
      purchaseCode: wallet.purchaseCode,
      isActive: wallet.isActive,
      sortOrder: wallet.sortOrder,
    });
    if (wallet.logoUrl) {
      setLogoPreview(wallet.logoUrl);
    }
    setOpenDialog(true);
  };

  const resetForm = () => {
    setForm({
      name: "",
      receiverName: "",
      phoneNumber: "",
      purchaseCode: "",
      isActive: true,
      sortOrder: 0,
    });
    setLogoFile(null);
    setLogoPreview(null);
    setEditingId(null);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("هل متأكد من حذف هذه المحفظة؟")) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: "✅ تم حذف المحفظة" });
    } catch (err) {
      toast({ title: "❌ خطأ في الحذف", variant: "destructive" });
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `✅ تم نسخ ${label}` });
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold">المحافظ الإلكترونية</h3>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="bg-green-600 hover:bg-green-700">
              <Plus className="h-4 w-4 ml-2" /> إضافة محفظة
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "تعديل المحفظة" : "إضافة محفظة جديدة"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4" dir="rtl">
              {/* Logo Preview */}
              {logoPreview && (
                <div className="flex justify-center">
                  <img src={logoPreview} alt="logo preview" className="h-16 w-16 rounded-lg object-contain" />
                </div>
              )}

              <div>
                <Label>الشعار/اللوغو</Label>
                <Input type="file" accept="image/*" onChange={handleLogoChange} />
              </div>

              <div>
                <Label>اسم المحفظة *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="مثلاً: STC Pay"
                  required
                />
              </div>

              <div>
                <Label>اسم المستلم *</Label>
                <Input
                  value={form.receiverName}
                  onChange={(e) => setForm({ ...form, receiverName: e.target.value })}
                  placeholder="مثلاً: أحمد محمد"
                  required
                />
              </div>

              <div>
                <Label>رقم النقطة/الهاتف *</Label>
                <Input
                  value={form.phoneNumber}
                  onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                  placeholder="0501234567"
                  required
                />
              </div>

              <div>
                <Label>كود الشراء *</Label>
                <Input
                  value={form.purchaseCode}
                  onChange={(e) => setForm({ ...form, purchaseCode: e.target.value })}
                  placeholder="رمز التحقق"
                  required
                />
              </div>

              <div>
                <Label>ترتيب العرض</Label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) })}
                />
              </div>

              <div className="flex items-center justify-between border rounded-lg p-3">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                />
                <Label>تفعيل</Label>
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                  )}
                  {editingId ? "تحديث" : "إضافة"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setOpenDialog(false)}>
                  إلغاء
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8">جاري التحميل...</div>
      ) : wallets.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8 text-gray-500">
            لا توجد محافظ بعد
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الشعار</TableHead>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">المستلم</TableHead>
                  <TableHead className="text-right">الرقم</TableHead>
                  <TableHead className="text-right">الكود</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wallets.map((wallet) => (
                  <TableRow key={wallet.id}>
                    <TableCell>
                      {wallet.logoUrl && (
                        <img src={wallet.logoUrl} alt={wallet.name} className="h-8 w-8 rounded object-contain bg-white" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{wallet.name}</TableCell>
                    <TableCell>{wallet.receiverName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{wallet.phoneNumber}</span>
                        <button
                          onClick={() => copyToClipboard(wallet.phoneNumber, "الرقم")}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{wallet.purchaseCode}</span>
                        <button
                          onClick={() => copyToClipboard(wallet.purchaseCode, "الكود")}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>
                      {wallet.isActive ? (
                        <Badge className="bg-green-100 text-green-800">مفعل</Badge>
                      ) : (
                        <Badge variant="secondary">معطل</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(wallet)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(wallet.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
