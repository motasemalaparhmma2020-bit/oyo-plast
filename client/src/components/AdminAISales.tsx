import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Bot, Loader2, Save, MessageSquare, TestTube2 } from "lucide-react";

interface AdminAISalesProps { adminToken: string | null }

export default function AdminAISales({ adminToken }: AdminAISalesProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<any>(null);
  const [testMessage, setTestMessage] = useState("ما هي أنواع أكياس المطاعم المتوفرة لديكم وأسعارها؟");
  const [testReply, setTestReply] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const { data: settings, isLoading } = useQuery<any>({
    queryKey: ['/api/admin/ai-settings'],
    enabled: !!adminToken,
    queryFn: async () => {
      const res = await fetch('/api/admin/ai-settings', {
        headers: { 'x-admin-token': adminToken || '' },
      });
      if (!res.ok) throw new Error('failed');
      return res.json();
    },
  });

  const { data: conversations } = useQuery<any[]>({
    queryKey: ['/api/admin/ai-conversations'],
    enabled: !!adminToken,
    queryFn: async () => {
      const res = await fetch('/api/admin/ai-conversations', {
        headers: { 'x-admin-token': adminToken || '' },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload: any = {};
      for (const [k, v] of Object.entries(data)) {
        const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        payload[camel] = v;
      }
      return apiRequest('PATCH', '/api/admin/ai-settings', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ai-settings'] });
      toast({ title: "✅ تم الحفظ", description: "تم تحديث إعدادات الموظف الذكي" });
    },
    onError: (e: any) => toast({ title: "❌ فشل الحفظ", description: e.message, variant: "destructive" }),
  });

  const handleTest = async () => {
    if (!testMessage.trim()) return;
    setTesting(true);
    setTestReply(null);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: testMessage, history: [] }),
      });
      const data = await res.json();
      setTestReply(data.reply || data.error || 'لا يوجد رد');
    } catch (e: any) {
      setTestReply('خطأ: ' + e.message);
    } finally {
      setTesting(false);
    }
  };

  if (isLoading || !form) {
    return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  const update = (k: string, v: any) => setForm({ ...form, [k]: v });

  return (
    <div className="space-y-6">
      {/* العنوان */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">الموظف الذكي — موظف المبيعات</h2>
            <p className="text-sm text-muted-foreground">تحكّم كامل في سلوك الموظف الذكي وقواعد البيع</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Label>مُفعَّل</Label>
          <Switch
            checked={!!form.is_enabled}
            onCheckedChange={(v) => update('is_enabled', v)}
            data-testid="switch-ai-enabled"
          />
        </div>
      </div>

      {/* الشخصية والقواعد */}
      <Card>
        <CardHeader><CardTitle>📝 الشخصية والقواعد</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>شخصية الموظف (System Prompt)</Label>
            <Textarea
              rows={6}
              value={form.personality_prompt || ''}
              onChange={(e) => update('personality_prompt', e.target.value)}
              data-testid="textarea-personality"
              className="font-mono text-sm"
            />
          </div>
          <div>
            <Label>القواعد الصارمة</Label>
            <Textarea
              rows={6}
              value={form.strict_rules || ''}
              onChange={(e) => update('strict_rules', e.target.value)}
              data-testid="textarea-rules"
              className="font-mono text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* سلّم الخصومات */}
      <Card>
        <CardHeader><CardTitle>💰 سلّم الخصومات</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>من 1 إلى (كمية) — 0%</Label>
              <Input type="number" value={form.discount_tier_1_qty ?? 49}
                onChange={(e) => update('discount_tier_1_qty', Number(e.target.value))} data-testid="input-tier1-qty" />
            </div>
            <div>
              <Label>خصم المستوى 1 (%)</Label>
              <Input type="number" value={form.discount_tier_1_percent ?? 0}
                onChange={(e) => update('discount_tier_1_percent', Number(e.target.value))} data-testid="input-tier1-pct" />
            </div>
            <div>
              <Label>حتى (كمية) — مستوى 2</Label>
              <Input type="number" value={form.discount_tier_2_qty ?? 99}
                onChange={(e) => update('discount_tier_2_qty', Number(e.target.value))} data-testid="input-tier2-qty" />
            </div>
            <div>
              <Label>خصم المستوى 2 (%)</Label>
              <Input type="number" value={form.discount_tier_2_percent ?? 5}
                onChange={(e) => update('discount_tier_2_percent', Number(e.target.value))} data-testid="input-tier2-pct" />
            </div>
            <div>
              <Label>حتى (كمية) — مستوى 3</Label>
              <Input type="number" value={form.discount_tier_3_qty ?? 499}
                onChange={(e) => update('discount_tier_3_qty', Number(e.target.value))} data-testid="input-tier3-qty" />
            </div>
            <div>
              <Label>خصم المستوى 3 (%)</Label>
              <Input type="number" value={form.discount_tier_3_percent ?? 15}
                onChange={(e) => update('discount_tier_3_percent', Number(e.target.value))} data-testid="input-tier3-pct" />
            </div>
            <div>
              <Label>خصم المستوى 4 (أكثر من مستوى 3) (%)</Label>
              <Input type="number" value={form.discount_tier_4_percent ?? 25}
                onChange={(e) => update('discount_tier_4_percent', Number(e.target.value))} data-testid="input-tier4-pct" />
            </div>
            <div>
              <Label>الحد الأقصى المطلق للخصم (%)</Label>
              <Input type="number" value={form.max_discount_override ?? 30}
                onChange={(e) => update('max_discount_override', Number(e.target.value))} data-testid="input-max-discount" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* الشحن والتصنيع */}
      <Card>
        <CardHeader><CardTitle>🚚 الشحن والتصنيع</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>أيام الشحن العادي</Label>
              <Input type="number" value={form.shipping_normal_days ?? 4}
                onChange={(e) => update('shipping_normal_days', Number(e.target.value))} data-testid="input-ship-normal-days" />
            </div>
            <div>
              <Label>تكلفة الشحن العادي (ر.ي)</Label>
              <Input type="number" value={form.shipping_normal_cost ?? 1500}
                onChange={(e) => update('shipping_normal_cost', e.target.value)} data-testid="input-ship-normal-cost" />
            </div>
            <div>
              <Label>أيام الشحن السريع</Label>
              <Input type="number" value={form.shipping_fast_days ?? 2}
                onChange={(e) => update('shipping_fast_days', Number(e.target.value))} data-testid="input-ship-fast-days" />
            </div>
            <div>
              <Label>تكلفة الشحن السريع (ر.ي)</Label>
              <Input type="number" value={form.shipping_fast_cost ?? 3000}
                onChange={(e) => update('shipping_fast_cost', e.target.value)} data-testid="input-ship-fast-cost" />
            </div>
            <div>
              <Label>حد الشحن المجاني (ر.ي — 0 = معطّل)</Label>
              <Input type="number" value={form.free_shipping_threshold ?? 0}
                onChange={(e) => update('free_shipping_threshold', e.target.value)} data-testid="input-free-ship" />
            </div>
            <div>
              <Label>مدة التصنيع الافتراضية (أيام)</Label>
              <Input type="number" value={form.manufacturing_days_default ?? 3}
                onChange={(e) => update('manufacturing_days_default', Number(e.target.value))} data-testid="input-mfg-days" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* الإعدادات المتقدمة */}
      <Card>
        <CardHeader><CardTitle>⚙️ إعدادات متقدمة</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>درجة الإبداع (0.0 - 1.0)</Label>
              <Input type="number" step="0.1" min="0" max="1"
                value={form.temperature ?? 0.6}
                onChange={(e) => update('temperature', e.target.value)} data-testid="input-temperature" />
            </div>
            <div>
              <Label>أقصى عدد منتجات في السياق</Label>
              <Input type="number" value={form.max_products_in_context ?? 60}
                onChange={(e) => update('max_products_in_context', Number(e.target.value))} data-testid="input-max-products" />
            </div>
            <div className="flex items-end">
              <div className="flex items-center gap-2">
                <Switch checked={!!form.allow_mockup_generation}
                  onCheckedChange={(v) => update('allow_mockup_generation', v)}
                  data-testid="switch-mockup" />
                <Label>السماح بالنموذج المبدئي (Mockup)</Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* زر الحفظ */}
      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}
          size="lg" data-testid="button-save-ai-settings">
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          حفظ جميع الإعدادات
        </Button>
      </div>

      {/* اختبار سريع */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube2 className="h-5 w-5" /> اختبار محادثة سريع
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea rows={2} value={testMessage} onChange={(e) => setTestMessage(e.target.value)}
            placeholder="اكتب رسالة اختبار..." data-testid="input-test-message" />
          <Button onClick={handleTest} disabled={testing} data-testid="button-test-chat">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube2 className="h-4 w-4" />}
            جرّب الرد
          </Button>
          {testReply && (
            <div className="p-4 rounded-lg bg-muted whitespace-pre-wrap text-sm" data-testid="text-test-reply">
              {testReply}
            </div>
          )}
        </CardContent>
      </Card>

      {/* آخر المحادثات */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            آخر المحادثات ({conversations?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!conversations?.length ? (
            <p className="text-muted-foreground text-sm">لا توجد محادثات بعد</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {conversations.slice(0, 20).map((c: any) => {
                let msgs: any[] = [];
                try { msgs = JSON.parse(c.messages); } catch {}
                const first = msgs.find((m: any) => m.role === 'user')?.text || '';
                return (
                  <div key={c.id} className="p-3 rounded border bg-card text-sm" data-testid={`conv-${c.id}`}>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>#{c.id} — {new Date(c.created_at).toLocaleString('ar')}</span>
                      {c.order_id && <span className="text-green-600">✅ طلب #{c.order_id}</span>}
                    </div>
                    <p className="truncate">{first.slice(0, 150)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
