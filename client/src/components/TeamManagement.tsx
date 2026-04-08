import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, User, Shield, Truck, DollarSign, Package, Eye, EyeOff, ExternalLink, Users } from "lucide-react";

const roleOptions = [
  { value: "product_manager", label: "مدير المنتجات", desc: "إضافة وتعديل المنتجات والأسعار والصور", icon: Package, color: "bg-blue-100 text-blue-700" },
  { value: "order_manager",   label: "مدير الطلبات",   desc: "إدارة الطلبات وحالتها وتخصيص المندوبين", icon: Shield,  color: "bg-purple-100 text-purple-700" },
  { value: "delivery",        label: "مندوب التوصيل",  desc: "عرض الطلبات المخصصة وتحديث حالة التوصيل", icon: Truck,   color: "bg-orange-100 text-orange-700" },
  { value: "finance",         label: "المسؤول المالي", desc: "متابعة الدفع والتحصيل والتقارير المالية", icon: DollarSign, color: "bg-green-100 text-green-700" },
  { value: "owner",           label: "مالك مساعد",    desc: "صلاحيات كاملة مثل المالك الأصلي",         icon: User,    color: "bg-red-100 text-red-700" },
];

interface TeamManagementProps {
  adminToken: string | null;
}

export default function TeamManagement({ adminToken }: TeamManagementProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    email: "", password: "", fullName: "", phone: "", role: "", title: "",
  });

  // Fetch staff list
  const { data: staff = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/staff"],
    queryFn: async () => {
      const res = await fetch("/api/admin/staff", { headers: { "x-admin-token": adminToken! } });
      if (!res.ok) throw new Error("فشل جلب قائمة الموظفين");
      return res.json();
    },
    enabled: !!adminToken,
  });

  const resetForm = () => {
    setForm({ email: "", password: "", fullName: "", phone: "", role: "", title: "" });
    setEditingMember(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingMember ? `/api/admin/staff/${editingMember.id}` : "/api/admin/staff";
      const method = editingMember ? "PUT" : "POST";
      const body: any = { ...form };
      if (!body.password && editingMember) delete body.password;
      const res = await fetch(url, {
        method,
        headers: { "x-admin-token": adminToken!, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "فشل العملية");
      toast({ title: editingMember ? "✅ تم تحديث بيانات الموظف" : "✅ تم إنشاء حساب الموظف بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/staff"] });
      resetForm();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`هل تريد إلغاء تفعيل حساب ${name}؟`)) return;
    try {
      const res = await fetch(`/api/admin/staff/${id}`, {
        method: "DELETE",
        headers: { "x-admin-token": adminToken! },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast({ title: "تم إلغاء تفعيل الحساب" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/staff"] });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  const handleEdit = (member: any) => {
    setEditingMember(member);
    setForm({
      email: member.email || "",
      password: "",
      fullName: member.fullName || "",
      phone: member.phone || "",
      role: member.role || "",
      title: "",
    });
    setShowForm(true);
  };

  const getRoleInfo = (role: string) => roleOptions.find(r => r.value === role);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <Card className="border-emerald-200 bg-emerald-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-emerald-900">نظام إدارة الفريق</h3>
              <p className="text-sm text-emerald-700 mt-0.5">
                أنشئ حسابات لموظفيك بصلاحيات محددة. كل موظف يدخل عبر رابط{" "}
                <a href="/staff" target="_blank" className="underline font-medium">
                  /staff ↗
                </a>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Role guide */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {roleOptions.map(r => {
          const Icon = r.icon;
          return (
            <div key={r.value} className="flex items-start gap-3 p-3 rounded-xl border bg-white">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${r.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-sm">{r.label}</p>
                <p className="text-xs text-muted-foreground">{r.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Staff list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">أعضاء الفريق ({staff.length})</CardTitle>
            <CardDescription>جميع الموظفين وصلاحياتهم</CardDescription>
          </div>
          <Button onClick={() => { resetForm(); setShowForm(true); }} size="sm" className="gap-2" data-testid="button-add-staff">
            <Plus className="w-4 h-4" />
            موظف جديد
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">جاري التحميل...</p>
          ) : staff.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">لا يوجد موظفون بعد</p>
              <p className="text-sm mt-1">ابدأ بإضافة أول موظف من زر "موظف جديد"</p>
            </div>
          ) : (
            <div className="space-y-3">
              {staff.map((member: any) => {
                const roleInfo = getRoleInfo(member.role);
                const Icon = roleInfo?.icon || User;
                return (
                  <div key={member.id} className="flex items-center gap-3 p-3 rounded-xl border bg-slate-50 hover:bg-white transition-colors">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${roleInfo?.color || "bg-gray-100 text-gray-600"}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{member.fullName || member.email}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                      {member.phone && <p className="text-xs text-muted-foreground">{member.phone}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`text-xs ${roleInfo?.color || "bg-gray-100 text-gray-600"} border-0`}>
                        {roleInfo?.label || member.role}
                      </Badge>
                      <button
                        onClick={() => handleEdit(member)}
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors"
                        data-testid={`button-edit-staff-${member.id}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(member.id, member.fullName || member.email)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors"
                        data-testid={`button-delete-staff-${member.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Portal link */}
      <Card className="border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-sm">رابط بوابة الموظفين</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                أرسل هذا الرابط لكل موظف مع بياناته للدخول
              </p>
            </div>
            <div className="flex gap-2">
              <code className="bg-slate-100 px-3 py-1.5 rounded-lg text-xs font-mono">
                {window.location.origin}/staff
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/staff`);
                  toast({ title: "✅ تم نسخ الرابط" });
                }}
              >
                نسخ
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open("/staff", "_blank")}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) resetForm(); }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingMember ? "تعديل بيانات الموظف" : "إضافة موظف جديد"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">الاسم الكامل</Label>
                <Input
                  value={form.fullName}
                  onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                  placeholder="محمد أحمد"
                  className="mt-1"
                  data-testid="input-staff-fullname"
                />
              </div>
              <div>
                <Label className="text-xs">رقم الجوال</Label>
                <Input
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="0500000000"
                  className="mt-1"
                  dir="ltr"
                  data-testid="input-staff-phone"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">البريد الإلكتروني *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="staff@oyoplast.com"
                required
                className="mt-1"
                dir="ltr"
                disabled={!!editingMember}
                data-testid="input-staff-email-form"
              />
            </div>

            <div>
              <Label className="text-xs">{editingMember ? "كلمة مرور جديدة (اتركها فارغة لعدم التغيير)" : "كلمة المرور *"}</Label>
              <div className="relative mt-1">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  required={!editingMember}
                  className="pl-10"
                  dir="ltr"
                  data-testid="input-staff-password-form"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <Label className="text-xs">الدور والصلاحيات *</Label>
              <Select
                value={form.role}
                onValueChange={v => setForm(f => ({ ...f, role: v }))}
                required
              >
                <SelectTrigger className="mt-1" data-testid="select-staff-role">
                  <SelectValue placeholder="اختر الدور" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map(r => {
                    const Icon = r.icon;
                    return (
                      <SelectItem key={r.value} value={r.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          <div>
                            <span className="font-medium">{r.label}</span>
                            <span className="text-xs text-muted-foreground mr-2">{r.desc}</span>
                          </div>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {form.role && (
              <div className={`p-3 rounded-lg text-sm ${roleOptions.find(r => r.value === form.role)?.color || ""}`}>
                <strong>{roleOptions.find(r => r.value === form.role)?.label}</strong>: {roleOptions.find(r => r.value === form.role)?.desc}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1" data-testid="button-save-staff">
                {editingMember ? "حفظ التعديلات" : "إنشاء الحساب"}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm}>
                إلغاء
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
