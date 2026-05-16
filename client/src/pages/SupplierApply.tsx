import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle, Store, Package, BarChart3, ShieldCheck,
  Upload, FileText, X, Loader2
} from "lucide-react";

const BUSINESS_TYPES = [
  { value: "manufacturer", label: "مصنع/منتج" },
  { value: "trader", label: "تاجر جملة" },
  { value: "importer", label: "مستورد" },
  { value: "retailer", label: "متجر تجزئة" },
  { value: "other", label: "أخرى" },
];

const CATEGORIES = [
  "أكياس بلاستيك", "كؤوس وأطباق", "أدوات منزلية", "تغليف غذائي",
  "مواد طباعة", "خامات صناعية", "أخرى",
];

export default function SupplierApply() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    companyName: "",
    ownerName: "",
    phone: "",
    city: "",
    address: "",
    businessType: "",
    productCategories: [] as string[],
    message: "",
    documentsUrls: [] as string[],
    contractAccepted: false,
  });

  const applyMutation = useMutation({
    mutationFn: (data: typeof form) =>
      apiRequest("POST", "/api/partnership/supplier/apply", data),
    onSuccess: () => setSubmitted(true),
    onError: (e: any) =>
      toast({ title: "خطأ", description: e.message || "فشل الإرسال", variant: "destructive" }),
  });

  function toggleCategory(c: string) {
    setForm(f => ({
      ...f,
      productCategories: f.productCategories.includes(c)
        ? f.productCategories.filter(x => x !== c)
        : [...f.productCategories, c],
    }));
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (form.documentsUrls.length + files.length > 5) {
      toast({ title: "حد أقصى 5 ملفات", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
          toast({ title: `${file.name} أكبر من 5MB`, variant: "destructive" });
          continue;
        }
        const fd = new FormData();
        fd.append("design", file);
        const res = await fetch("/api/upload/design", { method: "POST", body: fd, credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          const url = data.designUrl || data.url;
          if (url) newUrls.push(url);
        } else {
          toast({ title: `فشل رفع ${file.name}`, variant: "destructive" });
        }
      }
      setForm(f => ({ ...f, documentsUrls: [...f.documentsUrls, ...newUrls] }));
    } catch (err: any) {
      toast({ title: "فشل رفع الملفات", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  function removeFile(idx: number) {
    setForm(f => ({ ...f, documentsUrls: f.documentsUrls.filter((_, i) => i !== idx) }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.companyName || !form.ownerName || !form.phone || !form.city) {
      return toast({
        title: "بيانات ناقصة",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive",
      });
    }
    if (!form.contractAccepted) {
      return toast({
        title: "الموافقة على العقد مطلوبة",
        description: "يجب الموافقة على شروط الشراكة للمتابعة",
        variant: "destructive",
      });
    }
    applyMutation.mutate(form);
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center" data-testid="card-supplier-submitted">
          <div className="w-20 h-20 bg-sky-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-sky-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">تم استلام طلبك!</h2>
          <p className="text-gray-600 mb-2">
            شكراً لاهتمامك بأن تكون شريكاً معنا في أويو بلاست.
          </p>
          <p className="text-gray-500 text-sm mb-8">
            سيتواصل معك فريقنا خلال 24-72 ساعة لمراجعة المستندات وإكمال خطوات الاعتماد.
          </p>
          <Button
            onClick={() => setLocation("/")}
            className="w-full bg-[#2196F3] hover:bg-[#1976D2]"
            data-testid="button-back-home"
          >
            العودة للرئيسية
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50 dark:from-slate-950 dark:to-slate-900" dir="rtl">
      {/* Hero */}
      <div className="bg-gradient-to-l from-[#1976D2] to-[#2196F3] text-white py-12 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Store className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3" data-testid="text-supplier-apply-title">
            انضم كمورّد لأويو بلاست
          </h1>
          <p className="text-white/90 text-base md:text-lg">
            اعرض منتجاتك على آلاف العملاء في اليمن وزد مبيعاتك
          </p>
        </div>
      </div>

      {/* Benefits */}
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {[
            { icon: Package, title: "منصة عرض احترافية", desc: "آلاف العملاء يومياً" },
            { icon: BarChart3, title: "لوحة مبيعات كاملة", desc: "إدارة كل تفاصيلك" },
            { icon: ShieldCheck, title: "تحصيل آمن ومضمون", desc: "تسوية منتظمة وشفافة" },
          ].map(b => (
            <div key={b.title} className="bg-white dark:bg-card rounded-xl p-5 text-center shadow-sm border border-sky-100 dark:border-sky-900/50">
              <div className="w-12 h-12 bg-sky-100 dark:bg-sky-950/50 rounded-xl flex items-center justify-center mx-auto mb-3">
                <b.icon className="w-6 h-6 text-sky-600" />
              </div>
              <h3 className="font-bold mb-1">{b.title}</h3>
              <p className="text-sm text-muted-foreground">{b.desc}</p>
            </div>
          ))}
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-card rounded-2xl shadow-lg p-6 md:p-8 max-w-2xl mx-auto">
          <h2 className="text-xl font-bold mb-6">بيانات الشركة / المنشأة</h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="companyName">اسم الشركة *</Label>
                <Input
                  id="companyName"
                  value={form.companyName}
                  onChange={e => setForm({ ...form, companyName: e.target.value })}
                  placeholder="مثال: مصنع الفجر للبلاستيك"
                  data-testid="input-company-name"
                />
              </div>
              <div>
                <Label htmlFor="ownerName">اسم المالك / المسؤول *</Label>
                <Input
                  id="ownerName"
                  value={form.ownerName}
                  onChange={e => setForm({ ...form, ownerName: e.target.value })}
                  placeholder="الاسم الثلاثي"
                  data-testid="input-owner-name"
                />
              </div>
              <div>
                <Label htmlFor="phone">رقم الهاتف / واتساب *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="7XX XXX XXX"
                  data-testid="input-phone"
                />
              </div>
              <div>
                <Label htmlFor="city">المدينة *</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={e => setForm({ ...form, city: e.target.value })}
                  placeholder="صنعاء، عدن، تعز..."
                  data-testid="input-city"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="address">العنوان التفصيلي (اختياري)</Label>
              <Input
                id="address"
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                placeholder="الحي، الشارع، علامة مميزة"
                data-testid="input-address"
              />
            </div>

            <div>
              <Label>نوع النشاط</Label>
              <Select
                value={form.businessType}
                onValueChange={v => setForm({ ...form, businessType: v })}
              >
                <SelectTrigger data-testid="select-business-type">
                  <SelectValue placeholder="اختر نوع نشاطك" />
                </SelectTrigger>
                <SelectContent>
                  {BUSINESS_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>الفئات التي توفرها (اختر فئة أو أكثر)</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {CATEGORIES.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCategory(c)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition ${
                      form.productCategories.includes(c)
                        ? "bg-[#2196F3] text-white border-[#2196F3]"
                        : "bg-white dark:bg-card border-gray-300 hover:border-[#2196F3]"
                    }`}
                    data-testid={`button-category-${c}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="message">رسالة تعريفية (اختياري)</Label>
              <Textarea
                id="message"
                value={form.message}
                onChange={e => setForm({ ...form, message: e.target.value })}
                placeholder="اخبرنا عن منشأتك، خبرتك، وعدد المنتجات المتوقع..."
                rows={3}
                data-testid="textarea-message"
              />
            </div>

            {/* Document Upload */}
            <div>
              <Label>المستندات الرسمية (اختياري - السجل التجاري، البطاقة الضريبية)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                صيغة PDF / JPG / PNG — أقصى حجم 5MB لكل ملف، حتى 5 ملفات
              </p>

              {form.documentsUrls.length > 0 && (
                <div className="space-y-2 mb-3">
                  {form.documentsUrls.map((url, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 bg-sky-50 dark:bg-sky-950/30 rounded-lg border border-sky-200"
                      data-testid={`row-document-${idx}`}
                    >
                      <FileText className="w-4 h-4 text-sky-600 shrink-0" />
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-sky-700 hover:underline flex-1 truncate"
                      >
                        مستند #{idx + 1}
                      </a>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="text-red-500 hover:text-red-700"
                        data-testid={`button-remove-document-${idx}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-sky-300 rounded-lg cursor-pointer hover:bg-sky-50 dark:hover:bg-sky-950/30 transition">
                {uploading ? (
                  <Loader2 className="w-5 h-5 text-sky-600 animate-spin" />
                ) : (
                  <Upload className="w-5 h-5 text-sky-600" />
                )}
                <span className="text-sm text-sky-700 font-medium">
                  {uploading ? "جارٍ الرفع..." : "اختر ملفات لرفعها"}
                </span>
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  data-testid="input-documents"
                />
              </label>
            </div>

            {/* Contract */}
            <div className="bg-gray-50 dark:bg-card/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <h3 className="font-bold text-sm mb-2">📜 ملخّص عقد الشراكة</h3>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc pr-4 mb-3">
                <li>تأكيد ملكية أو تفويض لبيع المنتجات المعروضة.</li>
                <li>الالتزام بجودة المنتج والتسليم خلال الوقت المحدد.</li>
                <li>عمولة المنصة الافتراضية 10% من قيمة كل بيع (قابلة للتفاوض).</li>
                <li>التسوية المالية كل أسبوع/أسبوعين بعد تأكيد التسليم.</li>
                <li>حق المنصة في إيقاف الحساب عند مخالفة الجودة أو الشروط.</li>
              </ul>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="contract"
                  checked={form.contractAccepted}
                  onCheckedChange={v => setForm({ ...form, contractAccepted: !!v })}
                  data-testid="checkbox-contract"
                />
                <Label htmlFor="contract" className="text-sm cursor-pointer leading-relaxed">
                  أوافق على شروط الشراكة المذكورة أعلاه وأقرّ بصحّة بياناتي
                </Label>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-[#2196F3] hover:bg-[#1976D2] text-white font-bold text-base"
              disabled={applyMutation.isPending || uploading}
              data-testid="button-submit-supplier-apply"
            >
              {applyMutation.isPending ? (
                <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جارٍ الإرسال...</>
              ) : (
                "إرسال طلب الشراكة"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
