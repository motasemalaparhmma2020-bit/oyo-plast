import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_INVOICE_SETTINGS, type InvoiceSettings as InvoiceSettingsType } from "@/components/PrintableInvoice";
import { Save, Eye, FileText, Truck, RefreshCw } from "lucide-react";

interface InvoiceSettingsProps {
  adminToken: string | null;
}

interface SettingToggleProps {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function SettingToggle({ label, desc, checked, onChange }: SettingToggleProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export default function InvoiceSettingsSection({ adminToken }: InvoiceSettingsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<InvoiceSettingsType>(DEFAULT_INVOICE_SETTINGS);
  const [isDirty, setIsDirty] = useState(false);

  const { data: savedSettings, isLoading } = useQuery<Partial<InvoiceSettingsType>>({
    queryKey: ["/api/admin/invoice-settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/invoice-settings", {
        headers: { "x-admin-token": adminToken! },
      });
      if (!res.ok) return {};
      return res.json();
    },
    enabled: !!adminToken,
  });

  useEffect(() => {
    if (savedSettings) {
      setSettings({ ...DEFAULT_INVOICE_SETTINGS, ...savedSettings });
      setIsDirty(false);
    }
  }, [savedSettings]);

  const updateField = <K extends keyof InvoiceSettingsType>(key: K, value: InvoiceSettingsType[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const { mutate: saveSettings, isPending: isSaving } = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/invoice-settings", {
        method: "PUT",
        headers: { "x-admin-token": adminToken!, "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("فشل الحفظ");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "✅ تم حفظ إعدادات الفاتورة" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invoice-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoice-settings"] });
      setIsDirty(false);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <RefreshCw className="w-6 h-6 animate-spin ml-2" />
        جاري تحميل الإعدادات...
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl" dir="rtl">
      {/* Save Button (sticky) */}
      {isDirty && (
        <div className="sticky top-4 z-10 flex justify-end">
          <Button onClick={() => saveSettings()} disabled={isSaving} className="gap-2 shadow-lg">
            <Save className="w-4 h-4" />
            {isSaving ? "جاري الحفظ..." : "حفظ التغييرات"}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ─── فاتورة العميل ─────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              فاتورة العميل
            </CardTitle>
            <CardDescription>ما يظهر في الفاتورة الكاملة للعميل</CardDescription>
          </CardHeader>
          <CardContent>
            <SettingToggle
              label="صور المنتجات"
              desc="عرض صورة مصغرة لكل منتج في الجدول"
              checked={settings.showProductImages}
              onChange={v => updateField("showProductImages", v)}
            />
            <SettingToggle
              label="عمود المقاس"
              desc="إظهار المقاس المختار لكل منتج"
              checked={settings.showSize}
              onChange={v => updateField("showSize", v)}
            />
            <SettingToggle
              label="عمود اللون"
              desc="إظهار اللون المختار مع مربع الألوان"
              checked={settings.showColor}
              onChange={v => updateField("showColor", v)}
            />
            <SettingToggle
              label="قسم الشحن والدفع"
              desc="نوع الشحن وطريقة الدفع ورسوم الشحن"
              checked={settings.showShipping}
              onChange={v => updateField("showShipping", v)}
            />
            <SettingToggle
              label="عرض الخصومات"
              desc="خصم الكوبون والسعر قبل الخصم"
              checked={settings.showDiscount}
              onChange={v => updateField("showDiscount", v)}
            />
            <SettingToggle
              label="رقم الحوالة / كود الطلب"
              desc="رقم التتبع / رقم الحوالة المرفق"
              checked={settings.showTransferCode}
              onChange={v => updateField("showTransferCode", v)}
            />
            <SettingToggle
              label="صورة الإيصال المرفق"
              desc="صورة التحويل التي أرفقها العميل"
              checked={settings.showReceiptImage}
              onChange={v => updateField("showReceiptImage", v)}
            />
            <SettingToggle
              label="ملاحظات العميل"
              desc="الملاحظات التي كتبها العميل عند الطلب"
              checked={settings.showCustomerNotes}
              onChange={v => updateField("showCustomerNotes", v)}
            />
            <SettingToggle
              label="إظهار الموقع GPS"
              desc="رابط خريطة Google للموقع"
              checked={settings.showGPS}
              onChange={v => updateField("showGPS", v)}
            />
            <SettingToggle
              label="ملاحظة إدارية"
              desc="ملاحظتك الخاصة تضاف في الفاتورة"
              checked={settings.showAdminNote}
              onChange={v => updateField("showAdminNote", v)}
            />
          </CardContent>
        </Card>

        {/* ─── فاتورة التوصيل ────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="w-5 h-5 text-orange-500" />
              بوليصة التوصيل
            </CardTitle>
            <CardDescription>ما يظهر في فاتورة المندوب</CardDescription>
          </CardHeader>
          <CardContent>
            <SettingToggle
              label="إظهار الأسعار للمندوب"
              desc="هل يرى المندوب أسعار المنتجات؟"
              checked={settings.deliveryInvoiceShowPrices}
              onChange={v => updateField("deliveryInvoiceShowPrices", v)}
            />
            <SettingToggle
              label="صور المنتجات في بوليصة التوصيل"
              desc="صور مصغرة لمساعدة المندوب على التعرف"
              checked={settings.deliveryInvoiceShowImages}
              onChange={v => updateField("deliveryInvoiceShowImages", v)}
            />
            <SettingToggle
              label="رقم الحوالة / كود الطلب"
              checked={settings.showTransferCode}
              onChange={v => updateField("showTransferCode", v)}
            />
            <SettingToggle
              label="ملاحظات العميل"
              checked={settings.showCustomerNotes}
              onChange={v => updateField("showCustomerNotes", v)}
            />
            <SettingToggle
              label="الموقع GPS"
              checked={settings.showGPS}
              onChange={v => updateField("showGPS", v)}
            />
            <SettingToggle
              label="ملاحظة للمندوب"
              desc="ملاحظتك تظهر للمندوب في بوليصته"
              checked={settings.showAdminNote}
              onChange={v => updateField("showAdminNote", v)}
            />
          </CardContent>
        </Card>

        {/* ─── معلومات المتجر ─────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">معلومات المتجر في الفاتورة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">رقم الهاتف الظاهر</Label>
              <Input
                value={settings.storePhone}
                onChange={e => updateField("storePhone", e.target.value)}
                placeholder="+967 774 997 589"
                dir="ltr"
                className="mt-1"
                data-testid="input-invoice-phone"
              />
            </div>
            <div>
              <Label className="text-xs">عنوان المتجر (اختياري)</Label>
              <Input
                value={settings.storeAddress}
                onChange={e => updateField("storeAddress", e.target.value)}
                placeholder="صنعاء - شارع..."
                className="mt-1"
                data-testid="input-invoice-address"
              />
            </div>
            <div>
              <Label className="text-xs">نص التذييل</Label>
              <Input
                value={settings.footerText}
                onChange={e => updateField("footerText", e.target.value)}
                placeholder="شكراً لثقتكم بنا"
                className="mt-1"
                data-testid="input-invoice-footer"
              />
            </div>
            <div>
              <Label className="text-xs">عرض العملة</Label>
              <Select value={settings.currency} onValueChange={(v: any) => updateField("currency", v)}>
                <SelectTrigger className="mt-1" data-testid="select-invoice-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="YER">ريال يمني فقط (ر.ي)</SelectItem>
                  <SelectItem value="SAR">ريال سعودي فقط (ر.س)</SelectItem>
                  <SelectItem value="both">كلاهما مع التحويل التقريبي</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* ─── التحكم اليدوي في المبالغ ─────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">التحكم اليدوي في المبالغ</CardTitle>
            <CardDescription>تعديلات تضاف على الفاتورة مؤقتاً</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">خصم إضافي يدوي (يُطرح من الإجمالي)</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="number"
                  min={0}
                  value={settings.manualDiscount}
                  onChange={e => updateField("manualDiscount", Number(e.target.value))}
                  placeholder="0"
                  dir="ltr"
                  className="flex-1"
                  data-testid="input-manual-discount"
                />
                <Input
                  value={settings.manualDiscountLabel}
                  onChange={e => updateField("manualDiscountLabel", e.target.value)}
                  placeholder="تسمية الخصم"
                  className="flex-1"
                  data-testid="input-discount-label"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                سيُطرح هذا المبلغ من إجمالي كل الفواتير. اجعله 0 لإلغائه.
              </p>
            </div>

            <div>
              <Label className="text-xs">ملاحظة إدارية (تظهر في الفاتورة)</Label>
              <Textarea
                value={settings.adminNote}
                onChange={e => updateField("adminNote", e.target.value)}
                placeholder="مثال: سيتم التواصل معك قريباً لتأكيد موعد التوصيل"
                rows={3}
                className="mt-1 resize-none"
                data-testid="textarea-admin-note"
              />
              <p className="text-xs text-muted-foreground mt-1">
                فعّل "ملاحظة إدارية" أعلاه حتى تظهر في الفاتورة.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save button at bottom */}
      <div className="flex justify-end gap-3 pt-2">
        <Button
          variant="outline"
          onClick={() => {
            setSettings({ ...DEFAULT_INVOICE_SETTINGS, ...(savedSettings || {}) });
            setIsDirty(false);
          }}
          disabled={!isDirty}
        >
          إلغاء التغييرات
        </Button>
        <Button
          onClick={() => saveSettings()}
          disabled={isSaving || !isDirty}
          className="gap-2"
          data-testid="button-save-invoice-settings"
        >
          <Save className="w-4 h-4" />
          {isSaving ? "جاري الحفظ..." : "حفظ الإعدادات"}
        </Button>
      </div>
    </div>
  );
}
