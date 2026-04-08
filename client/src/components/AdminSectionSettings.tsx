import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, LayoutDashboard, HelpCircle, BarChart3, Save } from "lucide-react";
import { useState, useEffect } from "react";

type SizeOption = "small" | "medium" | "large";

interface SectionConfig {
  show: boolean;
  size: SizeOption;
  onHome: boolean;
  onAccount: boolean;
}

interface SectionSettings {
  showWhyUs: boolean;
  whyUsSize: SizeOption;
  whyUsOnHome: boolean;
  whyUsOnAccount: boolean;
  showStats: boolean;
  statsSize: SizeOption;
  statsOnHome: boolean;
  statsOnAccount: boolean;
  showFaq: boolean;
  faqSize: SizeOption;
  faqOnHome: boolean;
  faqOnAccount: boolean;
}

const SIZE_LABELS: Record<SizeOption, string> = {
  small: "صغير",
  medium: "متوسط",
  large: "كبير",
};

const SIZE_DESC: Record<SizeOption, string> = {
  small: "compact — حشو أقل وخط أصغر",
  medium: "افتراضي — مظهر متوازن",
  large: "spacious — حشو أكثر وخط أكبر",
};

function SizePicker({
  value,
  onChange,
}: {
  value: SizeOption;
  onChange: (v: SizeOption) => void;
}) {
  const sizes: SizeOption[] = ["small", "medium", "large"];
  return (
    <div className="flex gap-2">
      {sizes.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={`flex-1 py-2 rounded-xl border text-sm font-bold transition-colors ${
            value === s
              ? "bg-primary text-white border-primary"
              : "bg-muted border-border text-muted-foreground hover:border-primary"
          }`}
          data-testid={`size-btn-${s}`}
        >
          {SIZE_LABELS[s]}
        </button>
      ))}
    </div>
  );
}

function PageToggle({
  label,
  checked,
  onChange,
  testId,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  testId: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-muted/50">
      <Label className="text-sm font-medium cursor-pointer" htmlFor={testId}>
        {label}
      </Label>
      <Switch
        id={testId}
        checked={checked}
        onCheckedChange={onChange}
        data-testid={testId}
      />
    </div>
  );
}

interface SectionCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  colorClass: string;
  config: SectionConfig;
  onChange: (patch: Partial<SectionConfig>) => void;
  testPrefix: string;
}

function SectionCard({
  icon,
  title,
  subtitle,
  colorClass,
  config,
  onChange,
  testPrefix,
}: SectionCardProps) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden" dir="rtl">
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 ${colorClass}`}>
        <div className="flex items-center gap-3">
          <div className="text-white">{icon}</div>
          <div>
            <p className="font-black text-white text-sm">{title}</p>
            <p className="text-white/80 text-xs">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {config.show ? (
            <Badge className="bg-white/20 text-white border-0 text-xs flex items-center gap-1">
              <Eye className="h-3 w-3" /> مرئي
            </Badge>
          ) : (
            <Badge className="bg-black/20 text-white border-0 text-xs flex items-center gap-1">
              <EyeOff className="h-3 w-3" /> مخفي
            </Badge>
          )}
          <Switch
            checked={config.show}
            onCheckedChange={(v) => onChange({ show: v })}
            data-testid={`${testPrefix}-show`}
          />
        </div>
      </div>

      {/* Body */}
      <div
        className={`space-y-4 p-4 transition-opacity ${
          config.show ? "opacity-100" : "opacity-40 pointer-events-none"
        }`}
      >
        {/* Size */}
        <div>
          <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1">
            حجم القسم
          </p>
          <SizePicker
            value={config.size}
            onChange={(v) => onChange({ size: v })}
          />
          <p className="text-xs text-muted-foreground mt-1">{SIZE_DESC[config.size]}</p>
        </div>

        {/* Page placement */}
        <div>
          <p className="text-xs font-bold text-muted-foreground mb-2">
            يظهر في
          </p>
          <div className="space-y-2">
            <PageToggle
              label="الصفحة الرئيسية"
              checked={config.onHome}
              onChange={(v) => onChange({ onHome: v })}
              testId={`${testPrefix}-on-home`}
            />
            <PageToggle
              label="صفحة حسابي"
              checked={config.onAccount}
              onChange={(v) => onChange({ onAccount: v })}
              testId={`${testPrefix}-on-account`}
            />
          </div>
          {!config.onHome && !config.onAccount && config.show && (
            <p className="text-xs text-orange-500 mt-2 font-medium">
              ⚠️ القسم مفعّل ولكن لم تُحدد صفحة لعرضه فيها
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminSectionSettings() {
  const { toast } = useToast();

  const { data: raw, isLoading } = useQuery<any>({
    queryKey: ["/api/display-settings"],
  });

  const [cfg, setCfg] = useState<SectionSettings>({
    showWhyUs: true,
    whyUsSize: "medium",
    whyUsOnHome: true,
    whyUsOnAccount: false,
    showStats: true,
    statsSize: "medium",
    statsOnHome: true,
    statsOnAccount: false,
    showFaq: true,
    faqSize: "medium",
    faqOnHome: true,
    faqOnAccount: false,
  });

  useEffect(() => {
    if (!raw) return;
    setCfg({
      showWhyUs: raw.showWhyUs ?? true,
      whyUsSize: raw.whyUsSize ?? "medium",
      whyUsOnHome: raw.whyUsOnHome ?? true,
      whyUsOnAccount: raw.whyUsOnAccount ?? false,
      showStats: raw.showStats ?? true,
      statsSize: raw.statsSize ?? "medium",
      statsOnHome: raw.statsOnHome ?? true,
      statsOnAccount: raw.statsOnAccount ?? false,
      showFaq: raw.showFaq ?? true,
      faqSize: raw.faqSize ?? "medium",
      faqOnHome: raw.faqOnHome ?? true,
      faqOnAccount: raw.faqOnAccount ?? false,
    });
  }, [raw]);

  const mutation = useMutation({
    mutationFn: (data: Partial<SectionSettings>) =>
      apiRequest("PATCH", "/api/admin/display-settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/display-settings"] });
      toast({ title: "تم الحفظ", description: "تم تحديث إعدادات الأقسام بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في الحفظ", variant: "destructive" });
    },
  });

  function patchWhyUs(patch: Partial<SectionConfig>) {
    setCfg((prev) => ({
      ...prev,
      showWhyUs: patch.show !== undefined ? patch.show : prev.showWhyUs,
      whyUsSize: patch.size !== undefined ? patch.size : prev.whyUsSize,
      whyUsOnHome: patch.onHome !== undefined ? patch.onHome : prev.whyUsOnHome,
      whyUsOnAccount: patch.onAccount !== undefined ? patch.onAccount : prev.whyUsOnAccount,
    }));
  }

  function patchStats(patch: Partial<SectionConfig>) {
    setCfg((prev) => ({
      ...prev,
      showStats: patch.show !== undefined ? patch.show : prev.showStats,
      statsSize: patch.size !== undefined ? patch.size : prev.statsSize,
      statsOnHome: patch.onHome !== undefined ? patch.onHome : prev.statsOnHome,
      statsOnAccount: patch.onAccount !== undefined ? patch.onAccount : prev.statsOnAccount,
    }));
  }

  function patchFaq(patch: Partial<SectionConfig>) {
    setCfg((prev) => ({
      ...prev,
      showFaq: patch.show !== undefined ? patch.show : prev.showFaq,
      faqSize: patch.size !== undefined ? patch.size : prev.faqSize,
      faqOnHome: patch.onHome !== undefined ? patch.onHome : prev.faqOnHome,
      faqOnAccount: patch.onAccount !== undefined ? patch.onAccount : prev.faqOnAccount,
    }));
  }

  function handleSave() {
    mutation.mutate(cfg);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black">إعدادات الأقسام</h2>
          <p className="text-sm text-muted-foreground">
            تحكم في ظهور وحجم وموضع أقسام الصفحة الرئيسية
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={mutation.isPending}
          className="flex items-center gap-2 rounded-xl font-bold"
          data-testid="btn-save-section-settings"
        >
          <Save className="h-4 w-4" />
          {mutation.isPending ? "جاري الحفظ..." : "حفظ الإعدادات"}
        </Button>
      </div>

      {/* Why Us */}
      <SectionCard
        icon={<LayoutDashboard className="h-5 w-5" />}
        title="لماذا تختار أويو بلاست؟"
        subtitle="6 بطاقات ميزات"
        colorClass="bg-gradient-to-l from-blue-500 to-blue-600"
        config={{
          show: cfg.showWhyUs,
          size: cfg.whyUsSize,
          onHome: cfg.whyUsOnHome,
          onAccount: cfg.whyUsOnAccount,
        }}
        onChange={patchWhyUs}
        testPrefix="why-us"
      />

      {/* Stats */}
      <SectionCard
        icon={<BarChart3 className="h-5 w-5" />}
        title="أرقامنا تتحدث"
        subtitle="4 أرقام إحصائية"
        colorClass="bg-gradient-to-l from-emerald-500 to-emerald-600"
        config={{
          show: cfg.showStats,
          size: cfg.statsSize,
          onHome: cfg.statsOnHome,
          onAccount: cfg.statsOnAccount,
        }}
        onChange={patchStats}
        testPrefix="stats"
      />

      {/* FAQ */}
      <SectionCard
        icon={<HelpCircle className="h-5 w-5" />}
        title="الأسئلة الشائعة"
        subtitle="8 أسئلة قابلة للطي"
        colorClass="bg-gradient-to-l from-purple-500 to-purple-600"
        config={{
          show: cfg.showFaq,
          size: cfg.faqSize,
          onHome: cfg.faqOnHome,
          onAccount: cfg.faqOnAccount,
        }}
        onChange={patchFaq}
        testPrefix="faq"
      />
    </div>
  );
}
