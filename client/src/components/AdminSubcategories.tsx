import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, ImagePlus, Loader2, FolderTree, X, RefreshCw, Filter } from "lucide-react";

interface SubcategoryForm {
  name: string;
  slug: string;
  imageUrl: string;
  categoryId: string;
  sortOrder: number;
  isActive: boolean;
}

const emptyForm: SubcategoryForm = {
  name: "",
  slug: "",
  imageUrl: "",
  categoryId: "",
  sortOrder: 0,
  isActive: true,
};

export function AdminSubcategories({ adminToken }: { adminToken?: string | null }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const token = adminToken || localStorage.getItem("adminToken") || "";

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<SubcategoryForm>(emptyForm);
  const [isUploading, setIsUploading] = useState(false);
  const [filterCat, setFilterCat] = useState<string>("all");

  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories");
      return res.ok ? res.json() : [];
    },
  });

  const { data: subcategories = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/subcategories"],
    queryFn: async () => {
      const res = await fetch("/api/subcategories");
      return res.ok ? res.json() : [];
    },
  });

  const createMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/admin/subcategories", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || "فشل الإنشاء"); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/subcategories"] });
      toast({ title: "✅ تم إضافة القسم الفرعي" });
      setShowForm(false);
      setForm(emptyForm);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/admin/subcategories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || "فشل التحديث"); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/subcategories"] });
      toast({ title: "✅ تم تحديث القسم الفرعي" });
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/subcategories/${id}`, {
        method: "DELETE",
        headers: { "x-admin-token": token },
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || "فشل الحذف"); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/subcategories"] });
      toast({ title: "✅ تم حذف القسم الفرعي" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { "x-admin-token": token },
        body: fd,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      const url = data.imageUrl || data.url || data.secure_url;
      if (!url) throw new Error("لم يتم استلام رابط الصورة");
      setForm((f) => ({ ...f, imageUrl: url }));
      toast({ title: "✅ تم رفع الصورة" });
    } catch {
      toast({ title: "فشل رفع الصورة", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.categoryId) {
      toast({ title: "اختر القسم الرئيسي", variant: "destructive" });
      return;
    }
    const payload = {
      ...form,
      categoryId: parseInt(form.categoryId),
    };
    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const startEdit = (sub: any) => {
    setEditing(sub);
    setForm({
      name: sub.name,
      slug: sub.slug,
      imageUrl: sub.imageUrl || "",
      categoryId: String(sub.categoryId),
      sortOrder: sub.sortOrder ?? 0,
      isActive: sub.isActive,
    });
    setShowForm(true);
  };

  const autoSlug = (name: string) =>
    name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\u0600-\u06FF-]/g, "");

  const filtered = filterCat === "all"
    ? subcategories
    : subcategories.filter((s: any) => String(s.categoryId) === filterCat);

  const getCatName = (id: number) =>
    categories.find((c: any) => c.id === id)?.name || String(id);

  return (
    <Card className="mt-6" data-testid="admin-subcategories">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FolderTree className="h-5 w-5 text-primary" />
          <CardTitle>الأقسام الفرعية</CardTitle>
          <Badge variant="secondary">{subcategories.length}</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} data-testid="button-refresh-subcategories">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            className="gap-2"
            onClick={() => { setShowForm(true); setEditing(null); setForm(emptyForm); }}
            data-testid="button-add-subcategory"
          >
            <Plus className="h-4 w-4" />
            إضافة قسم فرعي
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* نموذج الإضافة/التعديل */}
        {showForm && (
          <div className="mb-6 p-4 border rounded-xl bg-muted/30 relative">
            <button
              className="absolute top-3 left-3 text-gray-400 hover:text-gray-700"
              onClick={() => { setShowForm(false); setEditing(null); setForm(emptyForm); }}
              data-testid="button-close-subcategory-form"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="font-semibold mb-4">
              {editing ? "تعديل القسم الفرعي" : "إضافة قسم فرعي جديد"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>اسم القسم الفرعي</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: autoSlug(e.target.value) }))}
                    placeholder="مثال: كيس شيال"
                    required
                    data-testid="input-subcat-name"
                  />
                </div>
                <div>
                  <Label>الرابط (slug)</Label>
                  <Input
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                    placeholder="مثال: shayal"
                    required
                    data-testid="input-subcat-slug"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>القسم الرئيسي</Label>
                  <Select value={form.categoryId} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}>
                    <SelectTrigger data-testid="select-subcat-category">
                      <SelectValue placeholder="اختر القسم" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>ترتيب العرض</Label>
                  <Input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                    data-testid="input-subcat-sort"
                  />
                </div>
              </div>

              <div>
                <Label>صورة القسم الفرعي (اختيارية)</Label>
                <div className="flex items-center gap-4 mt-1">
                  <label
                    htmlFor="subcat-image-upload"
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md cursor-pointer hover:bg-primary/90 transition-colors text-sm"
                  >
                    <ImagePlus className="h-4 w-4" />
                    {isUploading ? "جاري الرفع..." : "رفع صورة"}
                  </label>
                  <input
                    type="file"
                    id="subcat-image-upload"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={isUploading}
                    data-testid="input-subcat-image"
                  />
                  {form.imageUrl && (
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100">
                      <img src={form.imageUrl} alt="معاينة" className="w-full h-full object-contain" />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                  id="subcat-active"
                  data-testid="switch-subcat-active"
                />
                <Label htmlFor="subcat-active">مفعّل</Label>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  disabled={createMut.isPending || updateMut.isPending}
                  className="gap-2"
                  data-testid="button-save-subcategory"
                >
                  {(createMut.isPending || updateMut.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editing ? "حفظ التعديلات" : "إضافة القسم الفرعي"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setShowForm(false); setEditing(null); setForm(emptyForm); }}
                >
                  إلغاء
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* فلتر حسب القسم */}
        <div className="mb-4 flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant={filterCat === "all" ? "default" : "outline"}
            onClick={() => setFilterCat("all")}
            data-testid="filter-subcat-all"
          >
            الكل ({subcategories.length})
          </Button>
          {categories.map((c: any) => {
            const count = subcategories.filter((s: any) => s.categoryId === c.id).length;
            return (
              <Button
                key={c.id}
                size="sm"
                variant={filterCat === String(c.id) ? "default" : "outline"}
                onClick={() => setFilterCat(String(c.id))}
                data-testid={`filter-subcat-${c.id}`}
              >
                {c.name} ({count})
              </Button>
            );
          })}
        </div>

        {/* قائمة الأقسام الفرعية */}
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <FolderTree className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>لا توجد أقسام فرعية بعد</p>
            <p className="text-sm mt-1">اضغط "إضافة قسم فرعي" للبدء</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((sub: any) => (
              <div
                key={sub.id}
                className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm hover:shadow-md transition-shadow"
                data-testid={`card-subcategory-${sub.id}`}
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted">
                  {sub.imageUrl ? (
                    <img src={sub.imageUrl} alt={sub.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-primary/10">
                      <FolderTree className="h-5 w-5 text-primary/60" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate text-sm">{sub.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{sub.slug}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Badge variant="outline" className="text-xs">{getCatName(sub.categoryId)}</Badge>
                    {!sub.isActive && <Badge variant="secondary" className="text-xs">مخفي</Badge>}
                  </div>
                </div>

                <div className="flex flex-col gap-1 shrink-0">
                  <div className="flex items-center gap-1" title={sub.isActive ? "ظاهر في المتجر" : "مخفي عن المتجر"}>
                    <Switch
                      checked={!!sub.isActive}
                      onCheckedChange={(v) => updateMut.mutate({ id: sub.id, data: { isActive: v } })}
                      data-testid={`switch-subcategory-visibility-${sub.id}`}
                    />
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => startEdit(sub)}
                    data-testid={`button-edit-subcategory-${sub.id}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm(`هل تريد حذف "${sub.name}"؟`)) deleteMut.mutate(sub.id);
                    }}
                    data-testid={`button-delete-subcategory-${sub.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
