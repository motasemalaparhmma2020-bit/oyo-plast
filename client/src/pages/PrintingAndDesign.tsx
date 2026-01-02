import { useState, useRef } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { 
  ShoppingBag, 
  CreditCard, 
  Layers, 
  Package, 
  Leaf,
  ChevronLeft,
  ChevronRight,
  Upload,
  Loader2,
  Check,
  Home,
  X,
  Image as ImageIcon
} from "lucide-react";

const EXCHANGE_RATE = 140;

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('ar-YE').format(price);
};

interface PrintingCategory {
  id: string;
  name: string;
  icon: any;
  description: string;
  subcategories: PrintingSubcategory[];
}

interface PrintingSubcategory {
  id: string;
  name: string;
  nameEn?: string;
  description: string;
  imageUrl: string;
  basePrice: number;
  basePriceSar: number;
  sizes: string[];
  colors: string[];
}

const printingCategories: PrintingCategory[] = [
  {
    id: "fabric-bags",
    name: "طباعة أكياس قماشية",
    icon: ShoppingBag,
    description: "أكياس قماشية عالية الجودة بتصميمك الخاص",
    subcategories: [
      {
        id: "flat-bag",
        name: "كيس مسطح",
        nameEn: "Flat Bag",
        description: "كيس قماشي مسطح مناسب للتسوق والهدايا",
        imageUrl: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=400&h=400&fit=crop",
        basePrice: 2500,
        basePriceSar: 18,
        sizes: ["25x35", "30x40", "35x45", "40x50"],
        colors: ["أبيض", "أسود", "بيج", "رمادي", "أزرق", "أحمر"]
      },
      {
        id: "handle-flat-bag",
        name: "كيس شيال مسطح",
        nameEn: "Handle Flat Bag",
        description: "كيس قماشي مسطح مع يد للحمل",
        imageUrl: "https://images.unsplash.com/photo-1597484662317-9bd7bdda2907?w=400&h=400&fit=crop",
        basePrice: 3000,
        basePriceSar: 21,
        sizes: ["25x35", "30x40", "35x45", "40x50", "45x55"],
        colors: ["أبيض", "أسود", "بيج", "رمادي", "أزرق", "أخضر"]
      },
      {
        id: "box-bag",
        name: "كيس صندوقي",
        nameEn: "Box Bag",
        description: "كيس قماشي صندوقي واسع للمشتريات الكبيرة",
        imageUrl: "https://images.unsplash.com/photo-1594223274512-ad4803739b7c?w=400&h=400&fit=crop",
        basePrice: 4000,
        basePriceSar: 29,
        sizes: ["30x30x15", "35x35x20", "40x40x20", "45x45x25"],
        colors: ["أبيض", "أسود", "بيج", "كحلي", "بني"]
      }
    ]
  },
  {
    id: "business-cards",
    name: "طباعة كروت شخصية",
    icon: CreditCard,
    description: "كروت أعمال احترافية بجودة عالية",
    subcategories: [
      {
        id: "matte-card",
        name: "كرت مطفي",
        nameEn: "Matte Card",
        description: "كرت شخصي بتشطيب مطفي أنيق",
        imageUrl: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&h=400&fit=crop",
        basePrice: 15000,
        basePriceSar: 107,
        sizes: ["9x5.5 سم (قياسي)", "8.5x5 سم", "9x5 سم مربع"],
        colors: ["أبيض", "كريمي", "رمادي فاتح"]
      },
      {
        id: "glossy-card",
        name: "كرت لامع",
        nameEn: "Glossy Card",
        description: "كرت شخصي بتشطيب لامع براق",
        imageUrl: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400&h=400&fit=crop",
        basePrice: 18000,
        basePriceSar: 129,
        sizes: ["9x5.5 سم (قياسي)", "8.5x5 سم", "9x5 سم مربع"],
        colors: ["أبيض لامع", "ذهبي", "فضي"]
      },
      {
        id: "sticker-card",
        name: "ستيكر لاصق",
        nameEn: "Sticker Card",
        description: "ملصقات لاصقة بجودة عالية - كما في طلبات مصنع أرض سبأ",
        imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop",
        basePrice: 12000,
        basePriceSar: 86,
        sizes: ["5x5 سم", "7x7 سم", "10x10 سم", "مخصص"],
        colors: ["شفاف", "أبيض", "ذهبي", "فضي"]
      }
    ]
  },
  {
    id: "commercial-signs",
    name: "لوحات تجارية",
    icon: Layers,
    description: "لوحات إعلانية ولافتات للمحلات التجارية",
    subcategories: [
      {
        id: "acrylic-sign",
        name: "لوحة أكريليك",
        nameEn: "Acrylic Sign",
        description: "لوحة أكريليك شفافة أو ملونة",
        imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop",
        basePrice: 50000,
        basePriceSar: 357,
        sizes: ["50x30 سم", "80x40 سم", "100x50 سم", "120x60 سم"],
        colors: ["شفاف", "أبيض", "أسود", "ذهبي"]
      },
      {
        id: "flex-banner",
        name: "بنر فلكس",
        nameEn: "Flex Banner",
        description: "بنر مرن للإعلانات الخارجية",
        imageUrl: "https://images.unsplash.com/photo-1557838923-2985c318be48?w=400&h=400&fit=crop",
        basePrice: 25000,
        basePriceSar: 179,
        sizes: ["1x0.5 متر", "2x1 متر", "3x1.5 متر", "4x2 متر"],
        colors: ["طباعة ملونة كاملة"]
      }
    ]
  },
  {
    id: "plastic-bags",
    name: "أكياس بلاستيك",
    icon: Package,
    description: "أكياس بلاستيكية مطبوعة بشعارك",
    subcategories: [
      {
        id: "hdpe-bag",
        name: "كيس HDPE",
        nameEn: "HDPE Bag",
        description: "كيس بلاستيك عالي الكثافة متين",
        imageUrl: "https://images.unsplash.com/photo-1607082349566-187342175e2f?w=400&h=400&fit=crop",
        basePrice: 80000,
        basePriceSar: 571,
        sizes: ["20x30 سم", "25x35 سم", "30x40 سم", "35x45 سم"],
        colors: ["شفاف", "أبيض", "أسود", "ملون حسب الطلب"]
      },
      {
        id: "ldpe-bag",
        name: "كيس LDPE",
        nameEn: "LDPE Bag",
        description: "كيس بلاستيك منخفض الكثافة ناعم",
        imageUrl: "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=400&h=400&fit=crop",
        basePrice: 70000,
        basePriceSar: 500,
        sizes: ["20x30 سم", "25x35 سم", "30x40 سم"],
        colors: ["شفاف", "أبيض", "ملون"]
      }
    ]
  },
  {
    id: "spice-bags",
    name: "أكياس بهارات ومكسرات",
    icon: Leaf,
    description: "أكياس تغليف للمنتجات الغذائية",
    subcategories: [
      {
        id: "stand-pouch",
        name: "كيس وقوف",
        nameEn: "Stand Up Pouch",
        description: "كيس قائم بسحاب للبهارات والمكسرات",
        imageUrl: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400&h=400&fit=crop",
        basePrice: 120000,
        basePriceSar: 857,
        sizes: ["10x15 سم", "12x18 سم", "15x22 سم", "18x26 سم"],
        colors: ["شفاف", "كرافت", "ذهبي", "فضي", "أسود"]
      },
      {
        id: "flat-pouch",
        name: "كيس مسطح بسحاب",
        nameEn: "Flat Zipper Pouch",
        description: "كيس مسطح مع سحاب للإغلاق المتكرر",
        imageUrl: "https://images.unsplash.com/photo-1558618047-f4b511bcf751?w=400&h=400&fit=crop",
        basePrice: 100000,
        basePriceSar: 714,
        sizes: ["8x12 سم", "10x15 سم", "12x18 سم", "15x20 سم"],
        colors: ["شفاف", "كرافت", "أبيض", "ملون"]
      }
    ]
  }
];

export default function PrintingAndDesign() {
  const { toast } = useToast();
  const { isAuthenticated, user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedCategory, setSelectedCategory] = useState<PrintingCategory | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<PrintingSubcategory | null>(null);
  const [currency, setCurrency] = useState<'YER' | 'SAR'>('YER');
  
  const [formData, setFormData] = useState({
    size: '',
    color: '',
    quantity: 100,
    designFile: null as File | null,
    designPreview: '',
    notes: ''
  });
  
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "حجم الملف كبير جداً", description: "الحد الأقصى 10 ميجابايت", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formDataUpload,
      });

      if (response.ok) {
        const data = await response.json();
        setFormData(prev => ({
          ...prev,
          designFile: file,
          designPreview: data.url
        }));
        toast({ title: "تم رفع التصميم بنجاح" });
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      setFormData(prev => ({
        ...prev,
        designFile: file,
        designPreview: URL.createObjectURL(file)
      }));
      toast({ title: "تم اختيار التصميم", description: "سيتم رفعه عند إرسال الطلب" });
    } finally {
      setIsUploading(false);
    }
  };

  const calculatePrice = () => {
    if (!selectedSubcategory) return 0;
    
    const basePrice = currency === 'SAR' ? selectedSubcategory.basePriceSar : selectedSubcategory.basePrice;
    let multiplier = 1;
    
    if (formData.quantity >= 500) multiplier = 0.85;
    else if (formData.quantity >= 250) multiplier = 0.9;
    else if (formData.quantity >= 100) multiplier = 0.95;
    
    return Math.round(basePrice * formData.quantity * multiplier);
  };

  const addToCartMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSubcategory || !formData.size || !formData.color) {
        throw new Error("يرجى اختيار جميع الخيارات");
      }

      const orderDetails = {
        categoryName: selectedCategory?.name,
        subcategoryName: selectedSubcategory.name,
        size: formData.size,
        color: formData.color,
        quantity: formData.quantity,
        designUrl: formData.designPreview,
        notes: formData.notes,
        currency,
        totalPrice: calculatePrice()
      };

      return apiRequest('POST', '/api/printing-orders', orderDetails);
    },
    onSuccess: () => {
      toast({ title: "تم إرسال طلب الطباعة بنجاح!", description: "سنتواصل معك قريباً لتأكيد الطلب" });
      resetForm();
    },
    onError: (error: any) => {
      toast({ 
        title: "خطأ في إرسال الطلب", 
        description: error.message || "حاول مرة أخرى",
        variant: "destructive" 
      });
    }
  });

  const resetForm = () => {
    setSelectedSubcategory(null);
    setFormData({
      size: '',
      color: '',
      quantity: 100,
      designFile: null,
      designPreview: '',
      notes: ''
    });
  };

  const goBack = () => {
    if (selectedSubcategory) {
      setSelectedSubcategory(null);
      setFormData({
        size: '',
        color: '',
        quantity: 100,
        designFile: null,
        designPreview: '',
        notes: ''
      });
    } else if (selectedCategory) {
      setSelectedCategory(null);
    }
  };

  const breadcrumbs: { label: string; href?: string; onClick?: () => void }[] = [
    { label: "الرئيسية", href: "/" },
    { label: "طباعة وتصميم", onClick: () => { setSelectedCategory(null); setSelectedSubcategory(null); } },
  ];
  
  if (selectedCategory) {
    breadcrumbs.push({ 
      label: selectedCategory.name, 
      onClick: () => setSelectedSubcategory(null) 
    });
  }
  
  if (selectedSubcategory) {
    breadcrumbs.push({ label: selectedSubcategory.name });
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-800 pb-24">
      <div className="bg-primary text-white py-6 px-4">
        <div className="container mx-auto">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">طباعة وتصميم</h1>
              <p className="text-primary-foreground/80 text-sm">صمم منتجاتك بنفسك</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="bg-white/10 border-white/30 text-white gap-1"
              onClick={() => setCurrency(currency === 'YER' ? 'SAR' : 'YER')}
              data-testid="button-toggle-currency"
            >
              {currency === 'YER' ? 'ر.ي' : 'ر.س'}
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-3">
        <nav className="flex items-center gap-2 text-sm overflow-x-auto pb-2" data-testid="breadcrumbs">
          {breadcrumbs.map((crumb, index) => (
            <div key={index} className="flex items-center gap-2 whitespace-nowrap">
              {index > 0 && <ChevronLeft className="h-4 w-4 text-muted-foreground" />}
              {crumb.href ? (
                <Link href={crumb.href} className="text-muted-foreground hover:text-primary">
                  {crumb.label}
                </Link>
              ) : crumb.onClick ? (
                <button 
                  onClick={crumb.onClick} 
                  className="text-muted-foreground hover:text-primary"
                  data-testid={`breadcrumb-${index}`}
                >
                  {crumb.label}
                </button>
              ) : (
                <span className="text-foreground font-medium">{crumb.label}</span>
              )}
            </div>
          ))}
        </nav>
      </div>

      <div className="container mx-auto px-4">
        {!selectedCategory && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {printingCategories.map((category) => {
              const Icon = category.icon;
              return (
                <Card 
                  key={category.id}
                  className="cursor-pointer hover-elevate transition-all"
                  onClick={() => setSelectedCategory(category)}
                  data-testid={`category-${category.id}`}
                >
                  <CardContent className="p-4 text-center">
                    <div className="w-16 h-16 mx-auto mb-3 bg-primary/10 rounded-full flex items-center justify-center">
                      <Icon className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="font-bold text-sm mb-1">{category.name}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">{category.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {selectedCategory && !selectedSubcategory && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Button variant="ghost" size="icon" onClick={goBack} data-testid="button-back">
                <ChevronRight className="h-5 w-5" />
              </Button>
              <h2 className="text-xl font-bold">{selectedCategory.name}</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {selectedCategory.subcategories.map((sub) => (
                <Card 
                  key={sub.id}
                  className="cursor-pointer hover-elevate overflow-hidden"
                  onClick={() => setSelectedSubcategory(sub)}
                  data-testid={`subcategory-${sub.id}`}
                >
                  <div className="aspect-square relative">
                    <img 
                      src={sub.imageUrl} 
                      alt={sub.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                      <h3 className="font-bold text-white">{sub.name}</h3>
                      {sub.nameEn && <p className="text-white/70 text-sm">{sub.nameEn}</p>}
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground mb-2">{sub.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">يبدأ من</span>
                      <Badge variant="secondary">
                        {currency === 'SAR' 
                          ? `${formatPrice(sub.basePriceSar)} ر.س` 
                          : `${formatPrice(sub.basePrice)} ر.ي`
                        }
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {selectedSubcategory && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Button variant="ghost" size="icon" onClick={goBack} data-testid="button-back-form">
                <ChevronRight className="h-5 w-5" />
              </Button>
              <div>
                <h2 className="text-xl font-bold">{selectedSubcategory.name}</h2>
                <p className="text-sm text-muted-foreground">{selectedSubcategory.description}</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <div className="aspect-square rounded-lg overflow-hidden mb-4">
                  <img 
                    src={formData.designPreview || selectedSubcategory.imageUrl} 
                    alt={selectedSubcategory.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">معلومات المنتج</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• مقاسات متعددة متوفرة</li>
                    <li>• ألوان متنوعة للاختيار</li>
                    <li>• طباعة عالية الجودة</li>
                    <li>• خصومات على الكميات الكبيرة</li>
                  </ul>
                </div>
              </div>

              <Card>
                <CardContent className="p-6 space-y-4">
                  <div>
                    <Label>اختر المقاس</Label>
                    <Select 
                      value={formData.size} 
                      onValueChange={(v) => setFormData(prev => ({ ...prev, size: v }))}
                    >
                      <SelectTrigger data-testid="select-size">
                        <SelectValue placeholder="اختر المقاس المناسب" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedSubcategory.sizes.map((size) => (
                          <SelectItem key={size} value={size}>{size}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>اختر اللون</Label>
                    <Select 
                      value={formData.color} 
                      onValueChange={(v) => setFormData(prev => ({ ...prev, color: v }))}
                    >
                      <SelectTrigger data-testid="select-color">
                        <SelectValue placeholder="اختر اللون" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedSubcategory.colors.map((color) => (
                          <SelectItem key={color} value={color}>{color}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>الكمية</Label>
                    <div className="flex items-center gap-2">
                      <Input 
                        type="number"
                        min="50"
                        step="50"
                        value={formData.quantity}
                        onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 100 }))}
                        className="text-center"
                        data-testid="input-quantity"
                      />
                      <span className="text-sm text-muted-foreground">قطعة</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">الحد الأدنى 50 قطعة - خصم للكميات الكبيرة</p>
                  </div>

                  <div>
                    <Label>رفع التصميم</Label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf,.ai,.psd"
                      onChange={handleFileSelect}
                      className="hidden"
                      data-testid="input-design-file"
                    />
                    
                    {formData.designPreview ? (
                      <div className="relative mt-2">
                        <div className="aspect-video rounded-lg overflow-hidden border">
                          <img 
                            src={formData.designPreview} 
                            alt="التصميم"
                            className="w-full h-full object-contain bg-gray-100"
                          />
                        </div>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 left-2"
                          onClick={() => setFormData(prev => ({ ...prev, designFile: null, designPreview: '' }))}
                          data-testid="button-remove-design"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full mt-2 h-24 border-dashed gap-2"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        data-testid="button-upload-design"
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            جاري الرفع...
                          </>
                        ) : (
                          <>
                            <Upload className="h-5 w-5" />
                            اضغط لرفع التصميم من جهازك
                          </>
                        )}
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      الصيغ المدعومة: JPG, PNG, PDF, AI, PSD - حد أقصى 10MB
                    </p>
                  </div>

                  <div>
                    <Label>ملاحظات إضافية</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="أي ملاحظات خاصة بالطلب..."
                      className="mt-1"
                      data-testid="textarea-notes"
                    />
                  </div>

                  <div className="bg-primary/5 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-muted-foreground">السعر التقديري:</span>
                      <span className="text-2xl font-bold text-primary">
                        {formatPrice(calculatePrice())} {currency === 'SAR' ? 'ر.س' : 'ر.ي'}
                      </span>
                    </div>
                    {currency === 'YER' && (
                      <p className="text-xs text-muted-foreground text-left">
                        ≈ {formatPrice(Math.round(calculatePrice() / EXCHANGE_RATE))} ر.س
                      </p>
                    )}
                    {currency === 'SAR' && (
                      <p className="text-xs text-muted-foreground text-left">
                        ≈ {formatPrice(calculatePrice() * EXCHANGE_RATE)} ر.ي
                      </p>
                    )}
                  </div>

                  <Button 
                    className="w-full gap-2"
                    size="lg"
                    onClick={() => addToCartMutation.mutate()}
                    disabled={!formData.size || !formData.color || addToCartMutation.isPending}
                    data-testid="button-submit-order"
                  >
                    {addToCartMutation.isPending ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        جاري الإرسال...
                      </>
                    ) : (
                      <>
                        <Check className="h-5 w-5" />
                        إرسال طلب الطباعة
                      </>
                    )}
                  </Button>

                  {!isAuthenticated && (
                    <p className="text-xs text-center text-muted-foreground">
                      <Link href="/auth" className="text-primary underline">سجل دخولك</Link>
                      {" "}لتتبع طلباتك وكسب نقاط الولاء
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
