import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronUp, ChevronDown, Save, Eye, EyeOff, Image, DollarSign, Type, Star, Shield, Palette, Tag, Hash, Truck, RefreshCcw, CreditCard, Printer, AlignLeft, MessageSquare, Grid, Layers, Settings, GripVertical } from "lucide-react";

const SECTION_META: Record<string, { label: string; icon: any; hasDims?: boolean }> = {
  images:      { label: "صور المنتج",          icon: Image,        hasDims: true },
  price:       { label: "السعر",               icon: DollarSign,   hasDims: true },
  title:       { label: "اسم المنتج",          icon: Type },
  rating:      { label: "التقييم والمبيعات",   icon: Star },
  trust_badges:{ label: "شارات الثقة",         icon: Shield },
  variants:    { label: "الخيارات (لون/مقاس)", icon: Palette },
  bulk:        { label: "أسعار الكميات",       icon: Tag },
  quantity:    { label: "الكمية",              icon: Hash },
  shipping:    { label: "معلومات الشحن",       icon: Truck },
  returns:     { label: "سياسة الإرجاع",       icon: RefreshCcw },
  installment: { label: "خيار التقسيط",        icon: CreditCard },
  printing:    { label: "الطباعة المخصصة",    icon: Printer },
  description: { label: "وصف المنتج",          icon: AlignLeft },
  reviews:     { label: "التقييمات والمراجعات", icon: MessageSquare },
  related:     { label: "منتجات مشابهة",       icon: Grid, hasDims: true },
};

interface PdpSection {
  id: string;
  visible: boolean;
  height?: number;
  thumbSize?: number;
  mode?: string;
  showThumbs?: boolean;
  fontSize?: number;
  count?: number;
}

interface PdpLayout {
  sections: PdpSection[];
  stickyBar: { visible: boolean; cartHeight: number };
  margins: { h: number; v: number; gap: number };
}

const DEFAULT_LAYOUT: PdpLayout = {
  sections: [
    { id: "images",      visible: true, height: 420, thumbSize: 64, mode: "contain", showThumbs: true },
    { id: "price",       visible: true, fontSize: 22 },
    { id: "title",       visible: true },
    { id: "rating",      visible: true },
    { id: "trust_badges",visible: true },
    { id: "variants",    visible: true },
    { id: "bulk",        visible: true },
    { id: "quantity",    visible: true },
    { id: "shipping",    visible: true },
    { id: "returns",     visible: true },
    { id: "installment", visible: true },
    { id: "printing",    visible: true },
    { id: "description", visible: true },
    { id: "reviews",     visible: true },
    { id: "related",     visible: true, count: 4 },
  ],
  stickyBar: { visible: true, cartHeight: 52 },
  margins: { h: 16, v: 8, gap: 12 },
};

export default function AdminPDPLayout({ adminToken }: { adminToken: string | null | undefined }) {
  const { toast } = useToast();
  const [layout, setLayout] = useState<PdpLayout>(DEFAULT_LAYOUT);
  const [saving, setSaving] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const reorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    setLayout(l => {
      const secs = [...l.sections];
      const [moved] = secs.splice(from, 1);
      secs.splice(to, 0, moved);
      return { ...l, sections: secs };
    });
  };

  const handleDrop = (to: number) => {
    if (dragIdx !== null) reorder(dragIdx, to);
    setDragIdx(null);
    setOverIdx(null);
  };

  const { data: serverLayout, isLoading } = useQuery<PdpLayout>({
    queryKey: ["/api/pdp-layout"],
    staleTime: 30000,
  });

  useEffect(() => {
    if (serverLayout) {
      const merged = { ...DEFAULT_LAYOUT, ...serverLayout };
      const existingIds = serverLayout.sections.map((s: PdpSection) => s.id);
      const missingDefaults = DEFAULT_LAYOUT.sections.filter(d => !existingIds.includes(d.id));
      merged.sections = [...serverLayout.sections, ...missingDefaults];
      setLayout(merged);
    }
  }, [serverLayout]);

  const moveSection = (idx: number, dir: -1 | 1) => {
    const newSecs = [...layout.sections];
    const target = idx + dir;
    if (target < 0 || target >= newSecs.length) return;
    [newSecs[idx], newSecs[target]] = [newSecs[target], newSecs[idx]];
    setLayout(l => ({ ...l, sections: newSecs }));
  };

  const toggleVisible = (id: string) => {
    setLayout(l => ({
      ...l,
      sections: l.sections.map(s => s.id === id ? { ...s, visible: !s.visible } : s),
    }));
  };

  const updateSection = (id: string, patch: Partial<PdpSection>) => {
    setLayout(l => ({
      ...l,
      sections: l.sections.map(s => s.id === id ? { ...s, ...patch } : s),
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch("/api/admin/pdp-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken ?? "" },
        body: JSON.stringify(layout),
      });
      if (r.ok) toast({ title: "✅ تم حفظ تخطيط صفحة المنتج" });
      else toast({ title: "❌ فشل الحفظ", variant: "destructive" });
    } catch {
      toast({ title: "❌ خطأ في الحفظ", variant: "destructive" });
    }
    setSaving(false);
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            تخطيط صفحة المنتج
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            رتّب الأقسام وتحكم في الإظهار والأبعاد لكل قسم
          </p>
        </div>
        <Button onClick={save} disabled={saving} className="gap-2" data-testid="button-save-pdp-layout">
          <Save className="h-4 w-4" />
          {saving ? "جاري الحفظ..." : "حفظ التخطيط"}
        </Button>
      </div>

      {/* Sections List */}
      <div className="space-y-2">
        {layout.sections.map((section, idx) => {
          const meta = SECTION_META[section.id];
          if (!meta) return null;
          const Icon = meta.icon;
          return (
            <div
              key={section.id}
              onDragOver={(e) => { e.preventDefault(); if (overIdx !== idx) setOverIdx(idx); }}
              onDrop={(e) => { e.preventDefault(); handleDrop(idx); }}
              className={`border rounded-xl p-3 transition-all ${
                dragIdx === idx ? "opacity-40" : ""
              } ${
                overIdx === idx && dragIdx !== null && dragIdx !== idx ? "ring-2 ring-primary border-primary" : ""
              } ${
                section.visible
                  ? "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                  : "bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800 opacity-60"
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Drag handle */}
                <div
                  draggable
                  onDragStart={() => setDragIdx(idx)}
                  onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                  className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
                  title="اسحب لإعادة الترتيب"
                  data-testid={`drag-pdp-${section.id}`}
                >
                  <GripVertical className="h-5 w-5" />
                </div>

                {/* Up/Down */}
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => moveSection(idx, -1)}
                    disabled={idx === 0}
                    className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
                    data-testid={`button-pdp-up-${section.id}`}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => moveSection(idx, 1)}
                    disabled={idx === layout.sections.length - 1}
                    className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
                    data-testid={`button-pdp-down-${section.id}`}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>

                {/* Order badge */}
                <span className="text-xs font-bold text-muted-foreground w-5 text-center">{idx + 1}</span>

                {/* Icon */}
                <div className={`p-2 rounded-lg ${section.visible ? "bg-primary/10 text-primary" : "bg-gray-200 text-gray-400"}`}>
                  <Icon className="h-4 w-4" />
                </div>

                {/* Label */}
                <span className="flex-1 font-medium text-sm">{meta.label}</span>

                {/* Dimensions (if applicable) */}
                {section.id === "images" && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">ارتفاع:</span>
                      <Input
                        type="number"
                        value={section.height ?? 420}
                        onChange={e => updateSection("images", { height: Number(e.target.value) })}
                        className="w-16 h-7 text-xs text-center px-1"
                        data-testid="input-pdp-images-height"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">مصغر:</span>
                      <Input
                        type="number"
                        value={section.thumbSize ?? 64}
                        onChange={e => updateSection("images", { thumbSize: Number(e.target.value) })}
                        className="w-14 h-7 text-xs text-center px-1"
                        data-testid="input-pdp-images-thumbsize"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">وضع:</span>
                      <Select
                        value={section.mode ?? "contain"}
                        onValueChange={v => updateSection("images", { mode: v })}
                      >
                        <SelectTrigger className="w-24 h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="contain">contain</SelectItem>
                          <SelectItem value="cover">cover</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Switch
                        checked={section.showThumbs !== false}
                        onCheckedChange={v => updateSection("images", { showThumbs: v })}
                        data-testid="switch-pdp-images-thumbs"
                      />
                      <span className="text-xs text-muted-foreground">مصغرات</span>
                    </div>
                  </div>
                )}

                {section.id === "price" && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">حجم الخط:</span>
                    <Input
                      type="number"
                      value={section.fontSize ?? 22}
                      onChange={e => updateSection("price", { fontSize: Number(e.target.value) })}
                      className="w-16 h-7 text-xs text-center px-1"
                      data-testid="input-pdp-price-fontsize"
                    />
                  </div>
                )}

                {section.id === "related" && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">عدد المنتجات:</span>
                    <Input
                      type="number"
                      min={2}
                      max={12}
                      value={section.count ?? 4}
                      onChange={e => updateSection("related", { count: Number(e.target.value) })}
                      className="w-14 h-7 text-xs text-center px-1"
                      data-testid="input-pdp-related-count"
                    />
                  </div>
                )}

                {/* Visibility toggle */}
                <div className="flex items-center gap-1.5 mr-2">
                  <Switch
                    checked={section.visible}
                    onCheckedChange={() => toggleVisible(section.id)}
                    data-testid={`switch-pdp-visible-${section.id}`}
                  />
                  {section.visible
                    ? <Eye className="h-4 w-4 text-primary" />
                    : <EyeOff className="h-4 w-4 text-muted-foreground" />
                  }
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky Bar + Margins */}
      <div className="border rounded-xl p-4 space-y-4">
        <h4 className="font-semibold flex items-center gap-2">
          <Settings className="h-4 w-4" />
          إعدادات إضافية
        </h4>

        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Switch
              checked={layout.stickyBar.visible}
              onCheckedChange={v => setLayout(l => ({ ...l, stickyBar: { ...l.stickyBar, visible: v } }))}
              data-testid="switch-pdp-sticky-bar"
            />
            <Label>الشريط اللاصق السفلي (أضف للسلة)</Label>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">ارتفاع الزر:</span>
            <Input
              type="number"
              value={layout.stickyBar.cartHeight}
              onChange={e => setLayout(l => ({ ...l, stickyBar: { ...l.stickyBar, cartHeight: Number(e.target.value) } }))}
              className="w-16 h-7 text-xs text-center"
              data-testid="input-pdp-sticky-height"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          {[
            { key: "h" as const, label: "هامش جانبي" },
            { key: "v" as const, label: "حشو عمودي" },
            { key: "gap" as const, label: "مسافة بين الأقسام" },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">{label}:</span>
              <Input
                type="number"
                value={layout.margins[key]}
                onChange={e => setLayout(l => ({ ...l, margins: { ...l.margins, [key]: Number(e.target.value) } }))}
                className="w-14 h-7 text-xs text-center"
                data-testid={`input-pdp-margin-${key}`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
        💡 <strong>تلميح:</strong> اسحب الأقسام من المقبض <GripVertical className="inline h-3.5 w-3.5" /> لإعادة ترتيبها، أو استخدم الأسهم. الأقسام المخفية لا تظهر للعملاء. الترتيب يؤثر على ترتيب الظهور في صفحة المنتج من الأعلى للأسفل.
      </div>
    </div>
  );
}
