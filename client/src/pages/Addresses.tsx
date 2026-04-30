import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  MapPin, Plus, Edit2, Trash2, Star, ArrowRight, Phone, Building, Loader2, Home,
} from "lucide-react";
import { useSEO } from "@/hooks/use-seo";

interface UserAddress {
  id: number;
  userId: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  isDefault: boolean;
}

const YEMEN_CITIES = [
  "صنعاء", "عدن", "تعز", "الحديدة", "إب", "ذمار", "المكلا", "حضرموت",
  "صعدة", "حجة", "المحويت", "البيضاء", "ريمة", "الجوف", "أبين", "لحج",
  "شبوة", "مأرب", "سقطرى", "الضالع", "عمران", "المهرة",
];

export default function Addresses() {
  useSEO({
    title: "عناويني | أويو بلاست",
    description: "إدارة عناوين الشحن والتوصيل في حسابك على أويو بلاست",
  });
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    city: "صنعاء",
    address: "",
    phone: "",
    isDefault: false,
  });

  const { data: addresses = [], isLoading } = useQuery<UserAddress[]>({
    queryKey: ["/api/addresses"],
    enabled: isAuthenticated,
  });

  const resetForm = () => {
    setEditingId(null);
    setForm({ name: "", city: "صنعاء", address: "", phone: "", isDefault: false });
  };

  const openAdd = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (a: UserAddress) => {
    setEditingId(a.id);
    setForm({
      name: a.name,
      city: a.city,
      address: a.address,
      phone: a.phone,
      isDefault: a.isDefault,
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        return apiRequest("PATCH", `/api/addresses/${editingId}`, form);
      }
      return apiRequest("POST", "/api/addresses", form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/addresses"] });
      setDialogOpen(false);
      resetForm();
      toast({
        title: editingId ? "تم تحديث العنوان" : "تمت إضافة العنوان",
        description: "تم حفظ بياناتك بنجاح",
      });
    },
    onError: (err: any) => {
      toast({
        title: "فشل الحفظ",
        description: err?.message || "تعذّر حفظ العنوان، حاول مرة أخرى",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/addresses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/addresses"] });
      setDeleteId(null);
      toast({ title: "تم حذف العنوان" });
    },
    onError: (err: any) => {
      toast({
        title: "فشل الحذف",
        description: err?.message || "حاول مرة أخرى",
        variant: "destructive",
      });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("PATCH", `/api/addresses/${id}`, { isDefault: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/addresses"] });
      toast({ title: "تم تعيين العنوان الافتراضي" });
    },
    onError: (err: any) => {
      toast({
        title: "تعذّر التعيين",
        description: err?.message || "حاول مرة أخرى",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.city.trim() || !form.address.trim() || !form.phone.trim()) {
      toast({
        title: "بيانات ناقصة",
        description: "يرجى تعبئة جميع الحقول",
        variant: "destructive",
      });
      return;
    }
    if (form.phone.replace(/\D/g, "").length < 9) {
      toast({
        title: "رقم هاتف غير صحيح",
        description: "يرجى إدخال رقم هاتف صالح",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate();
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <MapPin className="h-16 w-16 mx-auto text-gray-300 mb-4" />
        <h2 className="text-xl font-bold mb-2 dark:text-foreground">يجب تسجيل الدخول</h2>
        <p className="text-gray-500 mb-6">سجّل دخولك لإدارة عناوينك</p>
        <Link href="/auth">
          <Button data-testid="button-login">تسجيل الدخول</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background pb-24">
      {/* رأس الصفحة */}
      <header className="sticky top-0 z-30 bg-white dark:bg-card border-b border-gray-100 dark:border-border shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate("/profile")}
            className="text-gray-600 dark:text-muted-foreground hover:text-gray-900"
            data-testid="button-back"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold dark:text-foreground flex-1">عناويني</h1>
          <Button
            size="sm"
            onClick={openAdd}
            className="bg-[#1a3a4a] hover:bg-[#0f2b3a] text-white"
            data-testid="button-add-address"
          >
            <Plus className="h-4 w-4 ml-1" />
            إضافة
          </Button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5">
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-32 rounded-2xl bg-white dark:bg-card animate-pulse" />
            ))}
          </div>
        ) : addresses.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="w-20 h-20 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center mx-auto mb-4">
              <MapPin className="h-10 w-10 text-orange-500" />
            </div>
            <h3 className="text-lg font-bold mb-2 dark:text-foreground">لا توجد عناوين بعد</h3>
            <p className="text-sm text-gray-500 dark:text-muted-foreground mb-6">
              أضف عنوان توصيل ليصلك طلبك بدون أي تأخير
            </p>
            <Button
              onClick={openAdd}
              className="bg-[#1a3a4a] hover:bg-[#0f2b3a] text-white"
              data-testid="button-add-first-address"
            >
              <Plus className="h-4 w-4 ml-2" />
              أضف عنوانك الأول
            </Button>
          </div>
        ) : (
          <div className="space-y-3" data-testid="addresses-list">
            {addresses.map(a => (
              <div
                key={a.id}
                className={`bg-white dark:bg-card rounded-2xl border-2 p-4 shadow-sm transition-all ${
                  a.isDefault
                    ? "border-orange-400 dark:border-orange-500"
                    : "border-gray-100 dark:border-border"
                }`}
                data-testid={`address-card-${a.id}`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                      a.isDefault
                        ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600"
                        : "bg-gray-100 dark:bg-muted text-gray-600 dark:text-muted-foreground"
                    }`}>
                      <Home className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base dark:text-foreground truncate" data-testid={`text-address-name-${a.id}`}>
                        {a.name}
                      </h3>
                      {a.isDefault && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-orange-600 dark:text-orange-400 font-bold">
                          <Star className="h-3 w-3 fill-current" />
                          عنوان افتراضي
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEdit(a)}
                      className="w-8 h-8 rounded-full bg-gray-100 dark:bg-muted hover:bg-gray-200 text-gray-600 dark:text-muted-foreground flex items-center justify-center transition-colors"
                      aria-label="تعديل"
                      data-testid={`button-edit-${a.id}`}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteId(a.id)}
                      className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/20 hover:bg-red-100 text-red-600 flex items-center justify-center transition-colors"
                      aria-label="حذف"
                      data-testid={`button-delete-${a.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 text-sm">
                  <div className="flex items-start gap-2 text-gray-700 dark:text-foreground">
                    <Building className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    <span className="font-semibold">{a.city}</span>
                    <span className="text-gray-400">—</span>
                    <span className="flex-1" data-testid={`text-address-${a.id}`}>{a.address}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700 dark:text-foreground">
                    <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <span dir="ltr">{a.phone}</span>
                  </div>
                </div>

                {!a.isDefault && (
                  <button
                    onClick={() => setDefaultMutation.mutate(a.id)}
                    disabled={setDefaultMutation.isPending}
                    className="mt-3 w-full text-xs font-bold py-2 rounded-lg border border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors disabled:opacity-50"
                    data-testid={`button-set-default-${a.id}`}
                  >
                    تعيين كعنوان افتراضي
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog إضافة/تعديل */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">
              {editingId ? "تعديل العنوان" : "إضافة عنوان جديد"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-right block mb-1.5">اسم العنوان *</Label>
              <Input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="مثل: المنزل، المكتب، المخزن"
                required
                data-testid="input-name"
              />
            </div>

            <div>
              <Label className="text-right block mb-1.5">المدينة *</Label>
              <select
                value={form.city}
                onChange={e => setForm({ ...form, city: e.target.value })}
                required
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                data-testid="select-city"
              >
                {YEMEN_CITIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-right block mb-1.5">العنوان التفصيلي *</Label>
              <Textarea
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                placeholder="الحي، الشارع، رقم المبنى، علامات مميزة"
                rows={3}
                required
                data-testid="input-address"
              />
            </div>

            <div>
              <Label className="text-right block mb-1.5">رقم الهاتف *</Label>
              <Input
                type="tel"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="مثل: 777123456"
                dir="ltr"
                required
                data-testid="input-phone"
              />
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={e => setForm({ ...form, isDefault: e.target.checked })}
                className="w-4 h-4"
                data-testid="checkbox-default"
              />
              <span className="dark:text-foreground">جعله العنوان الافتراضي</span>
            </label>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                data-testid="button-cancel"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={saveMutation.isPending}
                className="bg-[#1a3a4a] hover:bg-[#0f2b3a] text-white"
                data-testid="button-save"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                ) : null}
                {editingId ? "تحديث" : "إضافة"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* تأكيد الحذف */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right">حذف العنوان</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              هل أنت متأكد من حذف هذا العنوان؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel data-testid="button-cancel-delete">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
