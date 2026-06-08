import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "wouter";
import {
  ArrowRight, Database, Trash2, Eye, Shield, CheckCircle, Mail, Phone, Clock, FileText, User, ShoppingCart, MapPin, CreditCard, AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SUPPORT_EMAIL = "motasemalaparh.m.m.a2020@gmail.com";
const SUPPORT_WHATSAPP = "https://wa.me/967774997589";

export default function DataDeletion() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dataTypes, setDataTypes] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const { data: settings } = useQuery<any>({
    queryKey: ["/api/home-settings"],
    queryFn: async () => {
      const res = await fetch("/api/home-settings", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const toggleDataType = (type: string) => {
    setDataTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const dataTypeOptions = [
    { key: "personal", label: "البيانات الشخصية (الاسم، الهاتف، البريد)", icon: User },
    { key: "addresses", label: "العناوين (منزل، عمل، توصيل)", icon: MapPin },
    { key: "orders", label: "سجل الطلبات والمشتريات", icon: ShoppingCart },
    { key: "designs", label: "التصاميم والملفات المرفوعة", icon: FileText },
    { key: "wallet", label: "بيانات المحفظة والرصيد", icon: CreditCard },
    { key: "all", label: "جميع البيانات المرتبطة بحسابي", icon: Database },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() && !phone.trim()) {
      toast({ title: "يرجى إدخال البريد أو الهاتف", variant: "destructive" });
      return;
    }
    if (dataTypes.length === 0) {
      toast({ title: "يرجى اختيار نوع البيانات المراد حذفها", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/account/data-deletion-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, phone, dataTypes, reason }),
      });
      if (res.ok) {
        setSubmitted(true);
        toast({ title: "تم إرسال الطلب بنجاح", description: "سنتواصل معك خلال 7 أيام عمل" });
      } else {
        const data = await res.json().catch(() => ({}));
        toast({ title: data.message || "فشل الإرسال", variant: "destructive" });
      }
    } catch {
      toast({ title: "خطأ في الاتصال", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background" dir="rtl">
      {/* Hero */}
      <div className="bg-gradient-to-l from-amber-600 to-amber-500 text-white py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-6">
            <Link href="/">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" data-testid="button-back-home">
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <span className="text-white/80">العودة للرئيسية</span>
          </div>
          <div className="text-center">
            <Database className="h-16 w-16 mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-2" data-testid="text-data-deletion-title">حذف البيانات الشخصية</h1>
            <p className="text-lg opacity-90">تحكم كامل ببياناتك — حقك القانوني</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* أنواع البيانات المجموعة */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <Eye className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <h2 className="font-bold text-lg mb-2">ما البيانات التي نجمعها</h2>
                <p className="text-sm text-muted-foreground mb-3">
                  نجمع البيانات اللازمة فقط لتقديم خدماتنا. إليك قائمة بأنواع البيانات المخزنة:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {dataTypeOptions.map(({ key, label, icon: Icon }) => (
                    <div key={key} className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* كيفية الحذف */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              <div>
                <h2 className="font-bold text-lg mb-2">كيفية حذف بياناتك</h2>
                <ul className="space-y-2 text-muted-foreground text-sm leading-relaxed">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span><strong>المستخدمون المسجّلون:</strong> استخدم النموذج أدناه لطلب حذف البيانات المحددة أو كلها. سيتم تأكيد الطلب عبر بريدك أو واتساب.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span><strong>المستخدمون غير المسجّلين:</strong> إذا قمتَ بطلب توصيل بدون حساب، أرسل لنا رقم هاتفك عبر الواتساب أو البريد لطلب حذف البيانات المرتبطة.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span><strong>وقت المعالجة:</strong> نعالج الطلبات خلال <strong>7 أيام عمل</strong>. سيتم إرسال تأكيد الحذف بعد الانتهاء.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span><strong>الاستثناءات القانونية:</strong> نحتفظ بسجلات المعاملات المالية (دون بيانات شخصية قابلة للتعريف) لمدة 5 سنوات لأغراض ضريبية.</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* نموذج الطلب */}
        <Card>
          <CardContent className="p-6">
            {!submitted ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <h2 className="font-bold text-lg">طلب حذف البيانات</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">البريد الإلكتروني</label>
                    <div className="relative">
                      <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="example@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pr-10"
                        data-testid="input-deletion-email"
                        dir="ltr"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">رقم الهاتف</label>
                    <div className="relative">
                      <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="tel"
                        placeholder="+967 77 123 4567"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="pr-10"
                        data-testid="input-deletion-phone"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">اختر البيانات المراد حذفها</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {dataTypeOptions.map(({ key, label, icon: Icon }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleDataType(key)}
                        className={`flex items-center gap-2 p-3 rounded-lg border text-sm transition-all text-right ${
                          dataTypes.includes(key)
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-gray-200 dark:border-gray-700 text-muted-foreground hover:border-primary/50"
                        }`}
                        data-testid={`toggle-deletion-${key}`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{label}</span>
                        {dataTypes.includes(key) && <CheckCircle className="h-4 w-4 mr-auto text-primary" />}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">سبب الحذف (اختياري)</label>
                  <Textarea
                    placeholder="ساعدنا في فهم سبب طلبك..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    data-testid="textarea-deletion-reason"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                  disabled={loading}
                  data-testid="button-submit-deletion"
                >
                  {loading ? "جارٍ الإرسال..." : "إرسال طلب حذف البيانات"}
                </Button>
              </form>
            ) : (
              <div className="text-center py-8 space-y-4">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                <h2 className="text-xl font-bold">تم استلام طلبك</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  سنتواصل معك خلال <strong>7 أيام عمل</strong> لتأكيد الحذف. إذا غيّرت رأيك، راسلنا فوراً.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex items-center gap-2 text-primary hover:underline">
                    <Mail className="h-4 w-4" /> {SUPPORT_EMAIL}
                  </a>
                  <a href={SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-primary hover:underline">
                    <Phone className="h-4 w-4" /> واتساب الدعم
                  </a>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* تواصل بديل */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-6 text-center">
            <h3 className="font-bold mb-2">طلب حذف بدون نموذج؟</h3>
            <p className="text-sm text-muted-foreground mb-4">
              يمكنك إرسال طلبك مباشرة عبر البريد أو الواتساب. اذكر رقم هاتفك أو بريدك المسجل مع نوع البيانات المراد حذفها.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <a href={`mailto:${SUPPORT_EMAIL}`}>
                <Button variant="outline" className="gap-2">
                  <Mail className="h-4 w-4" /> {SUPPORT_EMAIL}
                </Button>
              </a>
              <a href={SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="gap-2">
                  <Phone className="h-4 w-4" /> واتساب
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Footer legal */}
        <p className="text-center text-xs text-muted-foreground">
          {settings?.footerCopyright || "أويو بلاست — 2026. جميع الحقوق محفوظة."}
          <br />
          رقم حجز الاسم التجاري: 119688 | المالك: معتصم محمد أحمد الأهدل | الجمهورية اليمنية
          <br />
          <Link href="/privacy" className="text-primary underline">سياسة الخصوصية</Link> | <Link href="/delete-account" className="text-primary underline">حذف الحساب</Link>
        </p>
      </div>
    </div>
  );
}
