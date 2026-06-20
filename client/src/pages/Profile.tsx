import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  User, Phone, MapPin, Calendar, Building2, Pencil, Save, X,
  LogOut, KeyRound, ChevronRight, Loader2, Mail,
} from "lucide-react";

type EditForm = {
  fullName: string;
  phone: string;
  governorate: string;
  city: string;
  district: string;
  neighborhood: string;
  street: string;
  landmark: string;
  businessName: string;
};

const EMPTY: EditForm = {
  fullName: "", phone: "", governorate: "", city: "", district: "",
  neighborhood: "", street: "", landmark: "", businessName: "",
};

/* صف عرض بيان واحد */
function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 dark:border-border last:border-0">
      <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-muted flex items-center justify-center flex-shrink-0">
        <Icon className="h-4 w-4 text-gray-500 dark:text-gray-300" strokeWidth={1.7} />
      </div>
      <div className="flex-1 min-w-0 text-right">
        <p className="text-[11px] text-gray-400 dark:text-gray-500">{label}</p>
        <p className="text-sm font-semibold text-gray-800 dark:text-foreground truncate" data-testid={`value-${label}`}>
          {value && String(value).trim() ? value : "—"}
        </p>
      </div>
    </div>
  );
}

/* حقل إدخال في وضع التعديل */
function Field({
  label, value, onChange, placeholder, type = "text", testId,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; testId: string;
}) {
  return (
    <div className="text-right">
      <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        dir="rtl"
        className="w-full rounded-xl border border-gray-200 dark:border-border bg-gray-50 dark:bg-muted px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-gray-800 dark:text-foreground"
        data-testid={testId}
      />
    </div>
  );
}

export default function Profile() {
  const { user, isLoading: isAuthLoading, isAuthenticated, logout } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditForm>(EMPTY);

  const u = user as any;

  // ملء النموذج من بيانات المستخدم
  useEffect(() => {
    if (u) {
      setForm({
        fullName: u.fullName || [u.firstName, u.lastName].filter(Boolean).join(" ") || "",
        phone: u.phone || "",
        governorate: u.governorate || "",
        city: u.city || "",
        district: u.district || "",
        neighborhood: u.neighborhood || "",
        street: u.street || "",
        landmark: u.landmark || "",
        businessName: u.businessName || "",
      });
    }
  }, [u?.id, editing]);

  const userName = u?.fullName || [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.email?.split("@")[0] || "مستخدم";

  const saveMutation = useMutation({
    mutationFn: async (payload: EditForm) => {
      const res = await apiRequest("POST", "/api/auth/update-profile", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "تم الحفظ", description: "تم تحديث بياناتك الشخصية بنجاح" });
      setEditing(false);
    },
    onError: (e: any) => {
      toast({ title: "تعذّر الحفظ", description: e?.message || "حاول مرة أخرى", variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (form.fullName.trim().length < 2) {
      toast({ title: "الاسم مطلوب", description: "أدخل اسمك (حرفان على الأقل)", variant: "destructive" });
      return;
    }
    saveMutation.mutate(form);
  };

  const formatMemberSince = (date: any) => {
    if (!date) return null;
    try {
      const d = new Date(date);
      const months = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
      return `${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch { return null; }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  // ── زائر غير مسجّل ──────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#f2f2f7] dark:bg-background flex flex-col items-center justify-center px-6 text-center" dir="rtl">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <User className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-lg font-bold text-gray-800 dark:text-foreground mb-1">ملفي الشخصي</h2>
        <p className="text-sm text-gray-500 dark:text-muted-foreground mb-5">سجّل دخولك لعرض بياناتك الشخصية وتعديلها</p>
        <Link href="/auth">
          <span className="inline-block bg-primary text-white font-bold text-sm px-8 py-3 rounded-full active:scale-95 transition-transform" data-testid="link-login">
            تسجيل الدخول
          </span>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f2f7] dark:bg-background pb-10" dir="rtl">

      {/* ─── رأس الصفحة ─── */}
      <div className="bg-gradient-to-bl from-[#1a3a4a] to-[#0d2535] dark:from-[#0f2230] dark:to-[#070f17] pt-3 pb-6 px-4">
        <div className="flex items-center justify-between mb-4">
          <Link href="/account">
            <button className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20" data-testid="button-back">
              <ChevronRight className="h-5 w-5" />
            </button>
          </Link>
          <h1 className="text-white font-bold text-base">ملفي الشخصي</h1>
          <div className="w-9" />
        </div>

        <div className="flex items-center justify-end gap-3">
          <div className="text-right flex-1 min-w-0">
            <h2 className="text-white font-black text-lg leading-tight truncate" data-testid="text-username">{userName}</h2>
            {u?.email && (
              <p className="text-white/55 text-xs flex items-center justify-end gap-1.5 mt-0.5">
                <span className="truncate">{u.email}</span>
                <Mail className="h-3 w-3 text-white/40 flex-shrink-0" />
              </p>
            )}
            {u?.createdAt && (
              <p className="text-white/45 text-[11px] mt-0.5 flex items-center justify-end gap-1.5">
                <span>عضو منذ {formatMemberSince(u.createdAt)}</span>
                <Calendar className="h-3 w-3 text-white/35" />
              </p>
            )}
          </div>
          <div className="w-16 h-16 rounded-full border-2 border-white/25 overflow-hidden bg-white/15 flex items-center justify-center flex-shrink-0">
            {u?.profileImageUrl ? (
              <img src={u.profileImageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="h-9 w-9 text-white/70" strokeWidth={1.5} />
            )}
          </div>
        </div>
      </div>

      {/* ─── بطاقة البيانات الشخصية ─── */}
      <div className="mx-3 -mt-3 bg-white dark:bg-card rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-border">
          <span className="text-sm font-bold text-gray-800 dark:text-foreground">البيانات الشخصية</span>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 rounded-full px-3 py-1.5 active:scale-95 transition-transform"
              data-testid="button-edit"
            >
              <Pencil className="h-3.5 w-3.5" /> تعديل
            </button>
          ) : (
            <button
              onClick={() => setEditing(false)}
              className="flex items-center gap-1 text-xs font-semibold text-gray-500 bg-gray-100 dark:bg-muted rounded-full px-3 py-1.5"
              data-testid="button-cancel-edit"
            >
              <X className="h-3.5 w-3.5" /> إلغاء
            </button>
          )}
        </div>

        {/* وضع العرض */}
        {!editing && (
          <div className="px-4">
            <InfoRow icon={User} label="الاسم" value={form.fullName} />
            <InfoRow icon={Phone} label="رقم الجوال" value={form.phone} />
            <InfoRow icon={Building2} label="اسم المنشأة" value={form.businessName} />
            <InfoRow icon={MapPin} label="المحافظة" value={form.governorate} />
            <InfoRow icon={MapPin} label="المدينة" value={form.city} />
            <InfoRow icon={MapPin} label="المديرية" value={form.district} />
            <InfoRow icon={MapPin} label="الحي / المنطقة" value={form.neighborhood} />
            <InfoRow icon={MapPin} label="الشارع" value={form.street} />
            <InfoRow icon={MapPin} label="علامة مميزة" value={form.landmark} />
          </div>
        )}

        {/* وضع التعديل */}
        {editing && (
          <div className="p-4 space-y-3">
            <Field label="الاسم الكامل" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} placeholder="اسمك الكامل" testId="input-fullName" />
            <Field label="رقم الجوال" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="7XXXXXXXX" type="tel" testId="input-phone" />
            <Field label="اسم المنشأة (اختياري)" value={form.businessName} onChange={(v) => setForm({ ...form, businessName: v })} placeholder="مثال: مطعم الأصيل" testId="input-businessName" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="المحافظة" value={form.governorate} onChange={(v) => setForm({ ...form, governorate: v })} testId="input-governorate" />
              <Field label="المدينة" value={form.city} onChange={(v) => setForm({ ...form, city: v })} testId="input-city" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="المديرية" value={form.district} onChange={(v) => setForm({ ...form, district: v })} testId="input-district" />
              <Field label="الحي / المنطقة" value={form.neighborhood} onChange={(v) => setForm({ ...form, neighborhood: v })} testId="input-neighborhood" />
            </div>
            <Field label="الشارع" value={form.street} onChange={(v) => setForm({ ...form, street: v })} testId="input-street" />
            <Field label="علامة مميزة (بجوار…)" value={form.landmark} onChange={(v) => setForm({ ...form, landmark: v })} placeholder="بجانب جامع/مستشفى…" testId="input-landmark" />

            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold text-sm py-3 rounded-xl active:scale-95 transition-transform disabled:opacity-60 mt-2"
              data-testid="button-save"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              حفظ التغييرات
            </button>
          </div>
        )}
      </div>

      {/* ─── إجراءات الحساب ─── */}
      {!editing && (
        <div className="mx-3 mt-3 bg-white dark:bg-card rounded-2xl shadow-sm overflow-hidden">
          <Link href="/settings">
            <button className="w-full flex items-center justify-between px-4 py-3.5 border-b border-gray-100 dark:border-border hover:bg-gray-50 dark:hover:bg-muted transition-colors" data-testid="link-change-password">
              <ChevronRight className="h-4 w-4 text-gray-300 rotate-180" />
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-700 dark:text-foreground">الإعدادات وكلمة المرور</span>
                <KeyRound className="h-4 w-4 text-gray-400" />
              </div>
            </button>
          </Link>
          <button
            onClick={() => { logout(); setLocation("/"); }}
            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
            data-testid="button-logout"
          >
            <ChevronRight className="h-4 w-4 text-gray-300 rotate-180" />
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-red-600">تسجيل الخروج</span>
              <LogOut className="h-4 w-4 text-red-500" />
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
