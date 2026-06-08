import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "wouter";
import {
  ArrowRight, UserX, Trash2, AlertTriangle, CheckCircle, Mail, Phone, Clock, Shield, Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SUPPORT_EMAIL = "motasemalaparh.m.m.a2020@gmail.com";
const SUPPORT_WHATSAPP = "https://wa.me/967774997589";

export default function DeleteAccount() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() && !phone.trim()) {
      toast({ title: "يرجى إدخال البريد أو الهاتف", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/account/delete-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, phone, reason }),
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
      <div className="bg-gradient-to-l from-red-600 to-red-500 text-white py-12 px-4">
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
            <UserX className="h-16 w-16 mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-2" data-testid="text-delete-account-title">حذف الحساب</h1>
            <p className="text-lg opacity-90">نأسف لرحيلك — نحن هنا لمساعدتك</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* معلومات أساسية */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <h2 className="font-bold text-lg mb-2">ما يحدث عند حذف الحساب</h2>
                <ul className="space-y-2 text-muted-foreground text-sm leading-relaxed">
                  <li className="flex items-start gap-2">
                    <Trash2 className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    <span>سيتم <strong>حذف حسابك نهائياً</strong> من قاعدة بياناتنا خلال 7 أيام عمل من استلام الطلب.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Trash2 className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    <span>سيتم حذف: بياناتك الشخصية، عناوينك، سجل الطلبات، محتوى السلة، قائمة المفضلة، وتصاميمك المرفوعة.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Shield className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <span>سيتم <strong>الاحتفاظ</strong> بسجلات المعاملات المالية (لمدة 5 سنوات) لأغراض ضريبية وقانونية، ولا ترتبط بأي بيانات شخصية قابلة للتعريف.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                    <span>بعد الحذف النهائي، <strong>لا يمكن استرجاع الحساب</strong>. إذا غيّرت رأيك، تواصل معنا قبل انتهاء المدة.</span>
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
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <h2 className="font-bold text-lg">طلب حذف الحساب</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  أدخل بياناتك المسجلة لدينا. إذا لم تكن مسجلاً، يمكنك طلب حذف البيانات المرتبطة برقم هاتفك من صفحة <Link href="/data-deletion" className="text-primary underline">حذف البيانات</Link>.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">البريد الإلكتروني المسجل</label>
                    <div className="relative">
                      <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="example@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pr-10"
                        data-testid="input-delete-email"
                        dir="ltr"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">رقم الهاتف المسجل</label>
                    <div className="relative">
                      <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="tel"
                        placeholder="+967 77 123 4567"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="pr-10"
                        data-testid="input-delete-phone"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">سبب الحذف (اختياري)</label>
                  <Textarea
                    placeholder="ساعدنا في تحسين خدماتنا..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    data-testid="textarea-delete-reason"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-red-600 hover:bg-red-700 text-white"
                  disabled={loading}
                  data-testid="button-submit-delete"
                >
                  {loading ? "جارٍ الإرسال..." : "إرسال طلب حذف الحساب"}
                </Button>
              </form>
            ) : (
              <div className="text-center py-8 space-y-4">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                <h2 className="text-xl font-bold">تم استلام طلبك</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  سنتواصل معك على البريد أو الواتساب خلال <strong>7 أيام عمل</strong> لتأكيد الحذف. إذا غيّرت رأيك، راسلنا فوراً.
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
            <h3 className="font-bold mb-2">تحتاج مساعدة؟</h3>
            <p className="text-sm text-muted-foreground mb-4">
              إذا واجهت مشكلة في الحذف أو تريد حذف البيانات بدون حساب، تواصل معنا مباشرة.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <a href={`mailto:${SUPPORT_EMAIL}`}>
                <Button variant="outline" className="gap-2">
                  <Mail className="h-4 w-4" /> البريد الإلكتروني
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
        </p>
      </div>
    </div>
  );
}
