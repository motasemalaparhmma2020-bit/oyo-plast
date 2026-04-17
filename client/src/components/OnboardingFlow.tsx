import { useState, useMemo, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Loader2, CheckCircle, ArrowLeft, ArrowRight, MapPin,
  User, Building2, Store, AlertCircle, Locate,
} from "lucide-react";
import {
  YEMEN_GOVERNORATES, GOVERNORATE_NAMES, BUSINESS_TYPES,
} from "@shared/yemen-locations";

type Props = {
  initialFullName?: string;
  onComplete: () => void;
};

const STEPS = [
  { id: 1, label: "الاسم والنشاط" },
  { id: 2, label: "العنوان" },
  { id: 3, label: "تحديد الموقع" },
  { id: 4, label: "تأكيد" },
];

export default function OnboardingFlow({ initialFullName = "", onComplete }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);

  // الخطوة 1
  const [fullName, setFullName] = useState(initialFullName);
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");

  // الخطوة 2
  const [governorate, setGovernorate] = useState("");
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");

  // الخطوة 3
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState("");

  // المدن المتاحة لكل محافظة
  const availableCities = useMemo(
    () => (governorate ? YEMEN_GOVERNORATES[governorate] || [] : []),
    [governorate]
  );

  // عند تغيير المحافظة أعد تعيين المدينة
  useEffect(() => { setCity(""); }, [governorate]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/complete-onboarding", {
        fullName: fullName.trim(),
        businessName: businessName.trim() || null,
        businessType,
        governorate, city, street: street.trim(),
        gpsLatitude: lat, gpsLongitude: lng,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "🎉 تم", description: "اكتمل التسجيل بنجاح" });
      onComplete();
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  // ── طلب موقع GPS ──
  const requestGps = () => {
    if (!("geolocation" in navigator)) {
      setGpsError("المتصفح لا يدعم تحديد الموقع");
      return;
    }
    setGpsError("");
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(Number(pos.coords.latitude.toFixed(6)));
        setLng(Number(pos.coords.longitude.toFixed(6)));
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        const map: Record<number, string> = {
          1: "رفضت السماح بالوصول للموقع. فعّل الإذن من إعدادات المتصفح.",
          2: "تعذّر تحديد موقعك حالياً. تأكد من تفعيل GPS.",
          3: "انتهت مهلة تحديد الموقع. أعد المحاولة.",
        };
        setGpsError(map[err.code] || "تعذّر تحديد الموقع");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // ── التحقق من الخطوات ──
  const canNext = (): boolean => {
    if (step === 1) return fullName.trim().length >= 2 && !!businessType;
    if (step === 2) return !!governorate && !!city && street.trim().length >= 2;
    return true; // الخطوة 3 و 4 لا تشترطان شيئاً
  };

  const next = () => {
    if (!canNext()) {
      toast({ title: "بيانات ناقصة", description: "أكمل الحقول المطلوبة", variant: "destructive" });
      return;
    }
    if (step < 4) setStep((s) => s + 1);
    else submitMutation.mutate();
  };

  const back = () => step > 1 && setStep((s) => s - 1);

  const selectedBT = BUSINESS_TYPES.find((b) => b.id === businessType);

  // مجموعات نوع النشاط
  const groupedBT = useMemo(() => {
    const groups: Record<string, typeof BUSINESS_TYPES> = {};
    BUSINESS_TYPES.forEach((b) => {
      if (!groups[b.group]) groups[b.group] = [];
      groups[b.group].push(b);
    });
    return groups;
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/5 flex items-start justify-center py-6 px-4">
      <div className="w-full max-w-2xl">
        {/* شريط التقدم */}
        <div className="bg-white dark:bg-card rounded-2xl shadow-lg border p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-extrabold">إكمال بيانات حسابك</h1>
            <span className="text-xs text-muted-foreground" data-testid="text-step-counter">
              الخطوة {step} من {STEPS.length}
            </span>
          </div>
          <div className="flex gap-2">
            {STEPS.map((s) => (
              <div
                key={s.id}
                className={`flex-1 h-1.5 rounded-full transition-colors ${
                  s.id <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
          <p className="mt-2 text-sm font-semibold text-primary">{STEPS[step - 1].label}</p>
        </div>

        {/* محتوى الخطوة */}
        <div className="bg-white dark:bg-card rounded-2xl shadow-lg border p-6">
          {/* ── الخطوة 1 ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="text-sm font-semibold mb-1.5 block">
                  <User className="inline h-4 w-4 ml-1" />
                  اسم العميل <span className="text-red-500">*</span>
                </label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="مثال: محمد أحمد"
                  className="h-11"
                  data-testid="input-full-name"
                />
              </div>

              <div>
                <label className="text-sm font-semibold mb-1.5 block">
                  <Building2 className="inline h-4 w-4 ml-1" />
                  اسم المنشأة <span className="text-xs text-muted-foreground">(اختياري — مثل: مطعم الأصيل)</span>
                </label>
                <Input
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="اتركه فارغاً إذا كنت مستهلك فردي"
                  className="h-11"
                  data-testid="input-business-name"
                />
              </div>

              <div>
                <label className="text-sm font-semibold mb-2 block">
                  <Store className="inline h-4 w-4 ml-1" />
                  نوع النشاط <span className="text-red-500">*</span>
                </label>
                <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                  {Object.entries(groupedBT).map(([group, items]) => (
                    <div key={group}>
                      <p className="text-xs font-bold text-muted-foreground mb-1.5">{group}</p>
                      <div className="grid grid-cols-3 gap-2">
                        {items.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => setBusinessType(b.id)}
                            className={`p-3 rounded-xl border-2 text-center transition-all ${
                              businessType === b.id
                                ? "border-primary bg-primary/10 shadow-md"
                                : "border-input hover:border-primary/50 hover:bg-muted/50"
                            }`}
                            data-testid={`button-business-type-${b.id}`}
                          >
                            <div className="text-2xl mb-1">{b.emoji}</div>
                            <div className="text-xs font-semibold leading-tight">{b.label}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── الخطوة 2 ── */}
          {step === 2 && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                <MapPin className="inline h-4 w-4 ml-1 text-blue-600" />
                نحتاج عنوانك لتوصيل طلباتك بدقة وسرعة.
              </p>

              <div>
                <label className="text-sm font-semibold mb-1.5 block">
                  المحافظة <span className="text-red-500">*</span>
                </label>
                <select
                  value={governorate}
                  onChange={(e) => setGovernorate(e.target.value)}
                  className="w-full h-11 px-3 rounded-md border-2 border-input bg-background text-base"
                  data-testid="select-governorate"
                >
                  <option value="">اختر المحافظة</option>
                  {GOVERNORATE_NAMES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold mb-1.5 block">
                  المدينة / المديرية <span className="text-red-500">*</span>
                </label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={!governorate}
                  className="w-full h-11 px-3 rounded-md border-2 border-input bg-background text-base disabled:opacity-50"
                  data-testid="select-city"
                >
                  <option value="">{governorate ? "اختر المدينة" : "اختر المحافظة أولاً"}</option>
                  {availableCities.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold mb-1.5 block">
                  الشارع / الحي <span className="text-red-500">*</span>
                </label>
                <Input
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="مثال: شارع الزبيري، حي الجامعة"
                  className="h-11"
                  data-testid="input-street"
                />
              </div>
            </div>
          )}

          {/* ── الخطوة 3 ── */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 text-sm">
                <div className="flex gap-2">
                  <MapPin className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-900 dark:text-amber-100 mb-1">
                      تحديد موقعك يساعدنا في التوصيل بدقة
                    </p>
                    <p className="text-amber-800 dark:text-amber-200 text-xs">
                      نحفظ موقعك بأمان لمندوب التوصيل فقط. <span className="font-bold">يمكنك تخطي هذه الخطوة الآن وتحديده لاحقاً عند أول طلب.</span>
                    </p>
                  </div>
                </div>
              </div>

              {!lat ? (
                <Button
                  onClick={requestGps}
                  disabled={gpsLoading}
                  className="w-full h-14 text-base font-extrabold rounded-xl"
                  data-testid="button-get-gps"
                >
                  {gpsLoading ? (
                    <><Loader2 className="h-5 w-5 animate-spin ml-2" />جاري تحديد الموقع...</>
                  ) : (
                    <><Locate className="h-5 w-5 ml-2" />📍 تحديد موقعي الآن</>
                  )}
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-bold text-sm">تم تحديد موقعك ✓</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {lat}, {lng}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setLat(null); setLng(null); }}
                      className="text-xs text-primary font-bold underline"
                      data-testid="button-reset-gps"
                    >
                      تغيير
                    </button>
                  </div>

                  {/* خريطة OpenStreetMap (مجانية، بدون API key) */}
                  <div className="relative rounded-xl overflow-hidden border-2 border-primary/30">
                    <iframe
                      title="موقعك على الخريطة"
                      width="100%"
                      height="280"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.005},${lat - 0.003},${lng + 0.005},${lat + 0.003}&layer=mapnik&marker=${lat},${lng}`}
                      style={{ border: 0 }}
                      data-testid="map-preview"
                    />
                  </div>
                </div>
              )}

              {gpsError && (
                <div className="flex gap-2 bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-sm">
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <span className="text-red-800 dark:text-red-200">{gpsError}</span>
                </div>
              )}
            </div>
          )}

          {/* ── الخطوة 4 ── */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-2">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-lg font-extrabold">راجع بياناتك</h2>
                <p className="text-sm text-muted-foreground">تأكد قبل إكمال التسجيل</p>
              </div>

              <div className="bg-muted/30 rounded-xl p-4 space-y-2 text-sm">
                <Row label="اسم العميل" value={fullName} />
                {businessName && <Row label="اسم المنشأة" value={businessName} />}
                <Row label="نوع النشاط" value={selectedBT ? `${selectedBT.emoji} ${selectedBT.label}` : "—"} />
                <Row label="المحافظة" value={governorate} />
                <Row label="المدينة" value={city} />
                <Row label="الشارع" value={street} />
                <Row
                  label="الموقع GPS"
                  value={lat ? `✅ تم التحديد` : "⏭️ سيُحدد لاحقاً"}
                />
              </div>
            </div>
          )}

          {/* أزرار التنقل */}
          <div className="flex gap-2 mt-6">
            {step > 1 && (
              <Button
                variant="outline"
                onClick={back}
                className="h-12 px-5"
                data-testid="button-back"
              >
                <ArrowRight className="h-4 w-4 ml-1" />
                السابق
              </Button>
            )}
            <Button
              onClick={next}
              disabled={submitMutation.isPending || !canNext()}
              className="flex-1 h-12 text-base font-extrabold"
              data-testid="button-next"
            >
              {submitMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin ml-2" />جاري الحفظ...</>
              ) : step < 4 ? (
                <>التالي<ArrowLeft className="h-4 w-4 mr-1" /></>
              ) : (
                <><CheckCircle className="h-4 w-4 ml-2" />ابدأ التسوق</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1 border-b border-border/40 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold text-foreground text-left">{value}</span>
    </div>
  );
}
