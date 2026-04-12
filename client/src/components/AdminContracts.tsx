import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText, CheckCircle2, Clock, Users, ShieldCheck, Save,
  Download, RefreshCw, Loader2, AlertCircle, Database, HardDrive,
  ChevronDown, ChevronUp, Truck, UserCheck, Megaphone, Globe
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CONTRACT_TYPES = [
  { key: "supplier",  label: "عقد الموردين",    icon: Truck,       color: "blue",   desc: "يُوقَّع عند تسجيل أي مورد في المنصة" },
  { key: "employee",  label: "عقد الموظفين",    icon: UserCheck,   color: "green",  desc: "يُوقَّع عند انضمام أي موظف للفريق" },
  { key: "marketer",  label: "عقد المسوّقين",   icon: Megaphone,   color: "purple", desc: "يُوقَّع عند تسجيل أي مسوّق" },
  { key: "terms",     label: "شروط الاستخدام",  icon: Globe,       color: "orange", desc: "تظهر للعملاء عند إنشاء الحساب" },
  { key: "privacy",   label: "سياسة الخصوصية", icon: ShieldCheck,  color: "teal",   desc: "توضح كيف نحمي بيانات المستخدمين" },
];

const DEFAULT_CONTRACTS: Record<string, { title: string; body: string }> = {
  supplier: {
    title: "اتفاقية الشراكة التجارية مع أويو بلاست",
    body: `اتفاقية الشراكة التجارية

بين: شركة أويو بلاست للتغليف (المنصة)
وبين: المورد الموقّع أدناه

المادة الأولى — نطاق الاتفاقية
يلتزم المورد بتقديم منتجات مطابقة للمواصفات المتفق عليها، وتسليمها في المواعيد المحددة.

المادة الثانية — العمولة والمدفوعات
تُخصم نسبة العمولة المتفق عليها من قيمة كل طلب مكتمل. تُصرف المستحقات خلال 7 أيام من نهاية كل أسبوع.

المادة الثالثة — الجودة والمرتجعات
في حالة الشكاوى الموثقة عن جودة المنتج، يتحمل المورد تكلفة الاستبدال أو الإرجاع.

المادة الرابعة — السرية
يلتزم المورد بعدم الإفصاح عن أسعار المنصة أو استراتيجياتها التجارية لأطراف خارجية.

المادة الخامسة — إنهاء الاتفاقية
يحق لأي من الطرفين إنهاء هذه الاتفاقية بإشعار كتابي قبل 14 يوماً، مع الوفاء بالالتزامات القائمة.

بالقبول الإلكتروني لهذه الاتفاقية، يُقرّ المورد بقراءتها وفهمها والموافقة على بنودها كاملةً.`,
  },
  employee: {
    title: "عقد العمل الإلكتروني — أويو بلاست",
    body: `عقد العمل

بين: شركة أويو بلاست (صاحب العمل)
وبين: الموظف الموقّع أدناه

المادة الأولى — طبيعة العمل والراتب
يُحدَّد الراتب الأساسي ونموذج الدفع (ثابت / بالطلب / مختلط) في ملف الموظف داخل النظام.

المادة الثانية — الحضور والانضباط
يلتزم الموظف بتسجيل حضوره وانصرافه عبر نظام الشركة. الغياب غير المبرر يُخصم من الراتب وفق السياسة المعتمدة.

المادة الثالثة — السرية والأمانة
لا يحق للموظف مشاركة بيانات العملاء أو الأسعار أو المعلومات الداخلية مع أي طرف خارجي.

المادة الرابعة — إنهاء العمل
يُبلَّغ إنهاء العقد كتابياً قبل 7 أيام على الأقل، مع استيفاء جميع المستحقات.

بالقبول الإلكتروني، يُقرّ الموظف بقراءة هذا العقد والموافقة على شروطه.`,
  },
  marketer: {
    title: "اتفاقية التسويق بالعمولة — أويو بلاست",
    body: `اتفاقية التسويق بالعمولة

بين: شركة أويو بلاست (المُعلِن)
وبين: المسوّق الموقّع أدناه

المادة الأولى — نسبة العمولة
تُحسب العمولة على كل طلب مكتمل يُحقَّق عبر رابط المسوّق الخاص، وفق النسبة المحددة في ملفه.

المادة الثانية — شروط الصرف
تُصرف العمولات أسبوعياً بعد التحقق من اكتمال الطلبات وعدم إرجاعها.

المادة الثالثة — المحظورات
يُحظر على المسوّق: التزوير في النقرات، إنشاء طلبات وهمية، أو الترويج بمعلومات مضللة عن المنتجات.

المادة الرابعة — إنهاء الاتفاقية
تُلغى الاتفاقية فوراً عند ثبوت أي مخالفة، مع فقدان العمولات غير المصروفة.

بالقبول الإلكتروني، يُقرّ المسوّق بقراءة هذه الاتفاقية والالتزام ببنودها.`,
  },
  terms: {
    title: "شروط الاستخدام — أويو بلاست",
    body: `شروط الاستخدام

آخر تحديث: 2025

1. القبول بالشروط
باستخدام منصة أويو بلاست، توافق على هذه الشروط بشكل كامل.

2. الخدمات المقدمة
تُوفّر المنصة خدمات بيع وشراء مستلزمات التغليف والتعبئة.

3. حساب المستخدم
أنت مسؤول عن الحفاظ على سرية بيانات حسابك وعدم مشاركتها مع أحد.

4. الطلبات والمدفوعات
تُعدّ الطلبات ملزمة بمجرد تأكيدها. يُرجى مراجعة سياسة الإرجاع قبل الشراء.

5. سياسة الإرجاع
يُقبل الإرجاع خلال 48 ساعة من الاستلام في حالة وجود عيب مصنعي موثق.

6. المسؤولية
لا تتحمل أويو بلاست مسؤولية الأضرار غير المباشرة الناجمة عن استخدام المنصة.

7. التعديلات
نحتفظ بحق تعديل هذه الشروط مع إشعار مسبق للمستخدمين.`,
  },
  privacy: {
    title: "سياسة الخصوصية — أويو بلاست",
    body: `سياسة الخصوصية وحماية البيانات

آخر تحديث: 2025

1. البيانات التي نجمعها
نجمع: الاسم، رقم الهاتف، العنوان، وسجل الطلبات لأغراض تشغيلية فقط.

2. استخدام البيانات
تُستخدم بياناتك لـ: معالجة طلباتك، التواصل معك، وتحسين خدماتنا.

3. مشاركة البيانات
لا نبيع بياناتك لأي طرف ثالث. نشاركها فقط مع الموردين المعتمدين لإتمام الطلبات.

4. أمان البيانات
نستخدم تشفيراً آمناً لحفظ بياناتك ونُجري نسخاً احتياطية منتظمة.

5. حقوقك
يحق لك طلب حذف بياناتك أو تصحيحها في أي وقت عبر التواصل معنا.

6. ملفات الكوكيز
نستخدم ملفات الكوكيز لتحسين تجربة الاستخدام فقط، ولا نستخدمها للتتبع الإعلاني.

7. التواصل
للاستفسارات المتعلقة بخصوصيتك: راسلنا عبر واتساب +967774997589`,
  },
};

interface AdminContractsProps {
  adminToken: string | null;
}

export default function AdminContracts({ adminToken }: AdminContractsProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeType, setActiveType] = useState("supplier");
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody]   = useState("");
  const [editVersion, setEditVersion] = useState("1.0");
  const [expandedAcc, setExpandedAcc] = useState<number | null>(null);

  const headers = { "x-admin-token": adminToken || "" };

  // جلب نص العقد
  const { data: contractData, isLoading: contractLoading, refetch: refetchContract } = useQuery<any>({
    queryKey: ["/api/contracts", activeType],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/${activeType}`, { headers });
      if (res.status === 404) return null;
      return res.json();
    },
    enabled: !!adminToken,
  });

  // جلب سجلات القبول
  const { data: acceptances = [], isLoading: accLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/contracts/acceptances", activeType],
    queryFn: async () => {
      const res = await fetch(`/api/admin/contracts/acceptances?type=${activeType}`, { headers });
      return res.json();
    },
    enabled: !!adminToken,
  });

  // إحصاء الموقّعين
  const { data: stats = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/contracts/stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/contracts/stats", { headers });
      return res.json();
    },
    enabled: !!adminToken,
  });

  // حفظ العقد
  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/contracts/${activeType}`, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, body: editBody, version: editVersion }),
      });
      if (!res.ok) throw new Error("فشل الحفظ");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/contracts", activeType] });
      setEditMode(false);
      toast({ title: "✅ تم حفظ العقد بنجاح" });
    },
    onError: () => toast({ title: "فشل حفظ العقد", variant: "destructive" }),
  });

  const startEdit = () => {
    const def = DEFAULT_CONTRACTS[activeType];
    setEditTitle(contractData?.title || def?.title || "");
    setEditBody(contractData?.body || def?.body || "");
    setEditVersion(contractData?.version || "1.0");
    setEditMode(true);
  };

  const statsMap: Record<string, number> = {};
  stats.forEach((s: any) => { statsMap[s.contract_type] = Number(s.total); });

  const currentContract = CONTRACT_TYPES.find(c => c.key === activeType)!;

  return (
    <div className="space-y-6" dir="rtl">
      {/* ─── Header ─── */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <FileText className="h-6 w-6 text-primary" />
            العقود الرقمية وتوثيق الموافقات
          </CardTitle>
          <CardDescription>
            إدارة عقود الموردين والموظفين والمسوّقين وشروط الاستخدام — مع سجل كامل لكل موافقة إلكترونية
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* بطاقات الإحصاء */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {CONTRACT_TYPES.map(ct => {
              const Icon = ct.icon;
              const count = statsMap[ct.key] || 0;
              return (
                <button
                  key={ct.key}
                  onClick={() => { setActiveType(ct.key); setEditMode(false); }}
                  className={`rounded-xl border-2 p-3 text-center transition-all ${activeType === ct.key ? "border-primary bg-primary/10" : "border-gray-200 hover:border-primary/40"}`}
                  data-testid={`button-contract-${ct.key}`}
                >
                  <Icon className={`h-5 w-5 mx-auto mb-1 ${activeType === ct.key ? "text-primary" : "text-gray-400"}`} />
                  <p className="text-xs font-semibold truncate">{ct.label}</p>
                  <p className="text-lg font-bold text-primary">{count}</p>
                  <p className="text-[10px] text-gray-400">موقّع</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ─── المحتوى الرئيسي ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* نص العقد */}
        <Card className="border-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <currentContract.icon className="h-4 w-4 text-primary" />
                  {currentContract.label}
                </CardTitle>
                <CardDescription className="text-xs mt-1">{currentContract.desc}</CardDescription>
              </div>
              {!editMode && (
                <Button size="sm" variant="outline" onClick={startEdit} data-testid="button-edit-contract">
                  {contractData ? "تعديل" : "إنشاء"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {contractLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : editMode ? (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">عنوان العقد</Label>
                  <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="text-sm mt-1" data-testid="input-contract-title" />
                </div>
                <div>
                  <Label className="text-xs">رقم الإصدار</Label>
                  <Input value={editVersion} onChange={e => setEditVersion(e.target.value)} className="text-sm mt-1 w-24" data-testid="input-contract-version" />
                </div>
                <div>
                  <Label className="text-xs">نص العقد</Label>
                  <Textarea
                    value={editBody}
                    onChange={e => setEditBody(e.target.value)}
                    rows={14}
                    className="text-sm mt-1 font-mono leading-relaxed"
                    data-testid="textarea-contract-body"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-contract">
                    {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin ml-1" /> : <Save className="h-3 w-3 ml-1" />}
                    حفظ العقد
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditMode(false)}>إلغاء</Button>
                </div>
              </div>
            ) : contractData ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline" className="text-xs">الإصدار {contractData.version}</Badge>
                  <span className="text-xs text-gray-400">
                    آخر تحديث: {new Date(contractData.updated_at).toLocaleDateString("ar")}
                  </span>
                </div>
                <h3 className="font-bold text-sm">{contractData.title}</h3>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 max-h-72 overflow-y-auto">
                  <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">
                    {contractData.body}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 space-y-3">
                <FileText className="h-12 w-12 mx-auto text-gray-200" />
                <p className="text-gray-500 font-medium">لم يُنشأ هذا العقد بعد</p>
                <Button size="sm" onClick={startEdit} data-testid="button-create-contract">
                  إنشاء العقد الآن
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* سجل الموافقات */}
        <Card className="border-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                سجل الموافقات ({acceptances.length})
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={() => qc.invalidateQueries({ queryKey: ["/api/admin/contracts/acceptances", activeType] })}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {accLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : acceptances.length === 0 ? (
              <div className="text-center py-10">
                <Clock className="h-10 w-10 mx-auto text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">لا يوجد موافقات مسجّلة بعد</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {acceptances.map((acc: any) => (
                  <div
                    key={acc.id}
                    className="border rounded-lg overflow-hidden"
                    data-testid={`acc-record-${acc.id}`}
                  >
                    <button
                      className="w-full flex items-center gap-2 p-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-right"
                      onClick={() => setExpandedAcc(expandedAcc === acc.id ? null : acc.id)}
                    >
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{acc.party_name || acc.party_id}</p>
                        <p className="text-xs text-gray-400">{acc.party_role} · {new Date(acc.accepted_at).toLocaleString("ar")}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">v{acc.contract_version}</Badge>
                      {expandedAcc === acc.id ? <ChevronUp className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />}
                    </button>
                    {expandedAcc === acc.id && (
                      <div className="border-t px-3 py-2 bg-gray-50 dark:bg-gray-900 space-y-1">
                        <p className="text-xs"><span className="text-gray-500">المعرّف:</span> {acc.party_id}</p>
                        <p className="text-xs"><span className="text-gray-500">IP:</span> {acc.ip_address}</p>
                        <p className="text-xs"><span className="text-gray-500">التاريخ:</span> {new Date(acc.accepted_at).toLocaleString("ar")}</p>
                        {acc.notes && <p className="text-xs"><span className="text-gray-500">ملاحظة:</span> {acc.notes}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
