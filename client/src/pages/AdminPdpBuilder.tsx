import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowRight, ArrowUp, ArrowDown, Save, Lock, Loader2, Search,
  ExternalLink, Eye, EyeOff, Power,
} from "lucide-react";
import {
  DEFAULT_PDP_CONFIG, type PdpConfig, type PdpSection, type PdpElements,
} from "@shared/pdp-config";

interface ProductLite { id: number; name: string; }

// تسميات عربية للعناصر الدقيقة + القسم الذي تتبعه (للتجميع البصري)
const ELEMENT_GROUPS: { title: string; items: { key: keyof PdpElements; label: string; hint?: string }[] }[] = [
  {
    title: "الشريط العلوي",
    items: [
      { key: "wishlist", label: "زر المفضلة ❤️" },
      { key: "share", label: "زر المشاركة / القائمة" },
    ],
  },
  {
    title: "الخيارات الذكية",
    items: [
      { key: "bagColor", label: "اختيار لون الكيس" },
      { key: "printColor", label: "اختيار لون الطباعة" },
    ],
  },
  {
    title: "استوديو التصميم",
    items: [
      { key: "logoUpload", label: "رفع الشعار" },
      { key: "quickPreview", label: "المعاينة الفورية للشعار" },
      { key: "studioPreview", label: "التحسين بالذكاء الاصطناعي ✨" },
    ],
  },
  {
    title: "الكمية والثقة",
    items: [
      { key: "quantityStepper", label: "بطاقات اختيار الكمية" },
      { key: "trustBadges", label: "شارات الثقة (شحن/دفع/جودة)" },
    ],
  },
];

export default function AdminPdpBuilder() {
  const { toast } = useToast();
  const [cfg, setCfg] = useState<PdpConfig | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [previewId, setPreviewId] = useState<string>("");

  const adminFetch = async (method: string, url: string, body?: any) => {
    const res = await fetch(url, {
      method,
      headers: {
        "x-admin-token": localStorage.getItem("admin_token") || "",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = (await res.text()) || res.statusText;
      throw new Error(`${res.status}: ${text}`);
    }
    return res;
  };

  const { data: serverConfig, isLoading: configLoading, error: configError } = useQuery<PdpConfig>({
    queryKey: ["/api/admin/pdp-config"],
    queryFn: async () => (await adminFetch("GET", "/api/admin/pdp-config")).json(),
  });

  const { data: products = [], isLoading: productsLoading } = useQuery<ProductLite[]>({
    queryKey: ["/api/admin/products"],
    queryFn: async () => (await adminFetch("GET", "/api/admin/products")).json(),
  });

  // حمّل الإعداد من الخادم إلى الحالة القابلة للتعديل عند أول وصول
  useEffect(() => {
    if (serverConfig && !cfg) setCfg(serverConfig);
  }, [serverConfig, cfg]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!cfg) throw new Error("لا يوجد إعداد للحفظ");
      return (await adminFetch("POST", "/api/admin/pdp-config", cfg)).json();
    },
    onSuccess: (saved: PdpConfig) => {
      setCfg(saved);
      queryClient.setQueryData(["/api/admin/pdp-config"], saved);
      toast({ title: "تم الحفظ ✅", description: "انعكست إعدادات صفحة المنتج فوراً." });
    },
    onError: (e: any) => {
      toast({ title: "فشل الحفظ", description: e.message, variant: "destructive" });
    },
  });

  const dirty = useMemo(
    () => Boolean(cfg && serverConfig && JSON.stringify(cfg) !== JSON.stringify(serverConfig)),
    [cfg, serverConfig],
  );

  const sortedSections = useMemo(
    () => (cfg ? [...cfg.sections].sort((a, b) => a.order - b.order) : []),
    [cfg],
  );

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name?.toLowerCase().includes(q) || String(p.id).includes(q));
  }, [products, productSearch]);

  // ── محررات الحالة ──────────────────────────────────────────────────────────
  const setEnabled = (v: boolean) => cfg && setCfg({ ...cfg, enabled: v });
  const setScopeMode = (mode: PdpConfig["scope"]["mode"]) =>
    cfg && setCfg({ ...cfg, scope: { ...cfg.scope, mode } });
  const toggleProductInScope = (id: number) => {
    if (!cfg) return;
    const has = cfg.scope.productIds.includes(id);
    const productIds = has
      ? cfg.scope.productIds.filter((x) => x !== id)
      : [...cfg.scope.productIds, id];
    setCfg({ ...cfg, scope: { ...cfg.scope, productIds } });
  };
  const setSectionVisible = (id: string, visible: boolean) => {
    if (!cfg) return;
    setCfg({ ...cfg, sections: cfg.sections.map((s) => (s.id === id ? { ...s, visible } : s)) });
  };
  const moveSection = (id: string, dir: -1 | 1) => {
    if (!cfg) return;
    const sorted = [...cfg.sections].sort((a, b) => a.order - b.order);
    const i = sorted.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= sorted.length) return;
    if (sorted[i].locked || sorted[j].locked) return; // لا تُحرّك الأقسام المثبتة ولا تتجاوزها
    const oi = sorted[i].order, oj = sorted[j].order;
    setCfg({
      ...cfg,
      sections: cfg.sections.map((s) => {
        if (s.id === sorted[i].id) return { ...s, order: oj };
        if (s.id === sorted[j].id) return { ...s, order: oi };
        return s;
      }),
    });
  };
  const setElement = (key: keyof PdpElements, v: boolean) =>
    cfg && setCfg({ ...cfg, elements: { ...cfg.elements, [key]: v } });
  const resetToDefault = () => setCfg({ ...DEFAULT_PDP_CONFIG });

  // ── حالات التحميل/الخطأ ─────────────────────────────────────────────────────
  if (configLoading || !cfg) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        {configError ? (
          <div className="text-center p-6">
            <p className="text-red-600 font-semibold mb-2">تعذّر تحميل الإعدادات</p>
            <p className="text-sm text-muted-foreground mb-4">{(configError as Error).message}</p>
            <Link href="/admin">
              <Button variant="outline" data-testid="link-back-admin">العودة للوحة التحكم</Button>
            </Link>
          </div>
        ) : (
          <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
        )}
      </div>
    );
  }

  const canReorder = (s: PdpSection, idx: number) => !s.locked;

  return (
    <div className="min-h-screen bg-muted/30 pb-28" dir="rtl">
      {/* رأس الصفحة */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="max-w-2xl mx-auto px-3 py-3 flex items-center justify-between gap-2">
          <Link href="/admin">
            <Button variant="ghost" size="sm" className="gap-1" data-testid="button-back">
              <ArrowRight className="h-4 w-4" /> رجوع
            </Button>
          </Link>
          <h1 className="text-base font-bold flex items-center gap-2">🧩 منشئ صفحة المنتج</h1>
          <Button
            size="sm"
            className="gap-1 bg-cyan-600 hover:bg-cyan-700"
            disabled={!dirty || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            data-testid="button-save"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            حفظ
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-3 py-4 space-y-4">
        {/* المفتاح الرئيسي */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold flex items-center gap-2">
                  <Power className={`h-4 w-4 ${cfg.enabled ? "text-green-600" : "text-muted-foreground"}`} />
                  المفتاح الرئيسي للصفحة الجديدة
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {cfg.enabled
                    ? "الصفحة الجديدة مفعّلة وفق النطاق المحدد أدناه."
                    : "مُعطّلة بالكامل — كل المنتجات تعرض الصفحة القديمة."}
                </p>
              </div>
              <Switch
                checked={cfg.enabled}
                onCheckedChange={setEnabled}
                data-testid="switch-master-enabled"
              />
            </div>
          </CardContent>
        </Card>

        {/* نطاق التفعيل */}
        <Card className={cfg.enabled ? "" : "opacity-60"}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">نطاق التفعيل</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-3">
            <Select value={cfg.scope.mode} onValueChange={(v) => setScopeMode(v as any)}>
              <SelectTrigger data-testid="select-scope-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="printable" data-testid="scope-printable">منتجات الطباعة فقط (تجريبي)</SelectItem>
                <SelectItem value="all" data-testid="scope-all">كل المنتجات</SelectItem>
                <SelectItem value="specific" data-testid="scope-specific">منتجات محددة فقط</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {cfg.scope.mode === "printable" && "تُعرض الصفحة الجديدة فقط للمنتجات القابلة للطباعة (تصميم/طباعة/معاينة)."}
              {cfg.scope.mode === "all" && "تُعرض الصفحة الجديدة لكل منتجات المتجر."}
              {cfg.scope.mode === "specific" && "اختر المنتجات التي ستظهر لها الصفحة الجديدة فقط."}
            </p>

            {cfg.scope.mode === "specific" && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pr-9"
                    placeholder="ابحث باسم المنتج أو رقمه…"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    data-testid="input-product-search"
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  المختار: {cfg.scope.productIds.length} منتج
                </div>
                <div className="max-h-72 overflow-y-auto rounded-md border divide-y">
                  {productsLoading ? (
                    <div className="p-4 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
                  ) : filteredProducts.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">لا توجد نتائج</div>
                  ) : (
                    filteredProducts.map((p) => {
                      const checked = cfg.scope.productIds.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className="flex items-center justify-between gap-2 p-2.5 cursor-pointer hover:bg-muted/50"
                          data-testid={`row-product-${p.id}`}
                        >
                          <span className="text-sm truncate">
                            <span className="text-muted-foreground">#{p.id}</span> {p.name}
                          </span>
                          <Switch
                            checked={checked}
                            onCheckedChange={() => toggleProductInScope(p.id)}
                            data-testid={`switch-product-${p.id}`}
                          />
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ترتيب وإظهار الأقسام */}
        <Card className={cfg.enabled ? "" : "opacity-60"}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">أقسام الصفحة — الترتيب والإظهار</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-2">
            {sortedSections.map((s, idx) => (
              <div
                key={s.id}
                className="flex items-center gap-2 p-2.5 rounded-md border bg-background"
                data-testid={`section-row-${s.id}`}
              >
                <div className="flex flex-col">
                  <Button
                    variant="ghost" size="icon" className="h-6 w-6"
                    disabled={!canReorder(s, idx) || idx === 0 || sortedSections[idx - 1]?.locked}
                    onClick={() => moveSection(s.id, -1)}
                    data-testid={`button-up-${s.id}`}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-6 w-6"
                    disabled={!canReorder(s, idx) || idx === sortedSections.length - 1 || sortedSections[idx + 1]?.locked}
                    onClick={() => moveSection(s.id, 1)}
                    data-testid={`button-down-${s.id}`}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate flex items-center gap-1.5">
                    {s.label}
                    {s.locked && (
                      <Badge variant="secondary" className="gap-1 text-[10px] px-1.5 py-0">
                        <Lock className="h-2.5 w-2.5" /> أساسي
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {s.visible
                    ? <Eye className="h-4 w-4 text-green-600" />
                    : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                  <Switch
                    checked={s.visible}
                    disabled={s.locked}
                    onCheckedChange={(v) => setSectionVisible(s.id, v)}
                    data-testid={`switch-section-${s.id}`}
                  />
                </div>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground pt-1">
              الأقسام «الأساسية» (المعرض وشريط الشراء) مثبّتة في طرفي الصفحة ولا يمكن تحريكها أو إخفاؤها — لضمان ظهور الصور وزر الشراء دائماً.
            </p>
          </CardContent>
        </Card>

        {/* تفعيل/تعطيل العناصر */}
        <Card className={cfg.enabled ? "" : "opacity-60"}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">العناصر الدقيقة — تفعيل/تعطيل</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-4">
            {ELEMENT_GROUPS.map((group) => (
              <div key={group.title} className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground">{group.title}</div>
                {group.items.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-2 p-2 rounded-md border bg-background"
                    data-testid={`element-row-${item.key}`}
                  >
                    <span className="text-sm">{item.label}</span>
                    <Switch
                      checked={cfg.elements[item.key]}
                      onCheckedChange={(v) => setElement(item.key, v)}
                      data-testid={`switch-element-${item.key}`}
                    />
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* معاينة + إعادة ضبط */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">معاينة على جهازك</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-3">
            <p className="text-xs text-muted-foreground">
              احفظ أولاً، ثم افتح صفحة منتج لمعاينة الشكل النهائي على هاتفك مباشرة.
            </p>
            <div className="flex gap-2">
              <Select value={previewId} onValueChange={setPreviewId}>
                <SelectTrigger className="flex-1" data-testid="select-preview-product">
                  <SelectValue placeholder="اختر منتجاً للمعاينة" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)} data-testid={`preview-opt-${p.id}`}>
                      #{p.id} {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <a
                href={previewId ? `/product/${previewId}` : undefined}
                target="_blank"
                rel="noreferrer"
                className={previewId ? "" : "pointer-events-none opacity-50"}
              >
                <Button variant="outline" className="gap-1" disabled={!previewId} data-testid="button-open-preview">
                  <ExternalLink className="h-4 w-4" /> افتح
                </Button>
              </a>
            </div>
            <div className="pt-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={resetToDefault}
                data-testid="button-reset-default"
              >
                استعادة الإعداد الافتراضي (بدون حفظ)
              </Button>
            </div>
          </CardContent>
        </Card>

        {dirty && (
          <div className="text-center text-xs text-amber-600 dark:text-amber-400">
            لديك تغييرات غير محفوظة — اضغط «حفظ» في الأعلى.
          </div>
        )}
      </div>
    </div>
  );
}
