import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Product } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAddToCart } from "@/hooks/use-cart";
import { ShoppingCart, Loader2, Minus, Plus, ArrowRight, Upload, Check } from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

interface BulkPricing {
  minQty: number;
  price: string;
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { data: product, isLoading } = useQuery<Product>({
    queryKey: ['/api/products', id],
  });

  const { mutate: addToCart, isPending } = useAddToCart();
  
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [currency, setCurrency] = useState<'YER' | 'SAR'>(() => {
    return (localStorage.getItem('currency') as 'YER' | 'SAR') || 'YER';
  });

  useEffect(() => {
    const handleCurrencyChange = () => {
      setCurrency((localStorage.getItem('currency') as 'YER' | 'SAR') || 'YER');
    };
    window.addEventListener('currencyChange', handleCurrencyChange);
    return () => window.removeEventListener('currencyChange', handleCurrencyChange);
  }, []);

  const bulkPricing: BulkPricing[] = useMemo(() => {
    if (!product?.bulkPricing) return [];
    try {
      return JSON.parse(product.bulkPricing);
    } catch {
      return [];
    }
  }, [product?.bulkPricing]);

  const currentPrice = useMemo(() => {
    if (!product) return '0';
    
    let basePrice = currency === 'SAR' && product.priceSar 
      ? product.priceSar 
      : product.price;

    if (bulkPricing.length > 0) {
      const applicablePricing = [...bulkPricing]
        .sort((a, b) => b.minQty - a.minQty)
        .find(bp => quantity >= bp.minQty);
      
      if (applicablePricing) {
        basePrice = applicablePricing.price;
      }
    }

    return basePrice;
  }, [product, quantity, currency, bulkPricing]);

  const totalPrice = useMemo(() => {
    return Number(currentPrice) * quantity;
  }, [currentPrice, quantity]);

  const formatPrice = (price: number | string) => {
    return Number(price).toLocaleString('ar-YE');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      toast({
        title: "تم رفع الملف",
        description: `تم رفع ${file.name} بنجاح`,
      });
    }
  };

  const handleAddToCart = () => {
    if (!product) return;
    addToCart({ productId: product.id, quantity });
  };

  const colors = product?.colors || [];
  const sizes = product?.sizes || [];

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-8" />
          <div className="grid md:grid-cols-2 gap-8">
            <div className="aspect-square bg-gray-200 rounded-2xl" />
            <div className="space-y-4">
              <div className="h-8 bg-gray-200 rounded w-3/4" />
              <div className="h-6 bg-gray-200 rounded w-1/2" />
              <div className="h-24 bg-gray-200 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h2 className="text-2xl font-bold mb-4">المنتج غير موجود</h2>
        <Link href="/products">
          <Button>العودة للمنتجات</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 pb-24">
      <Link href="/products">
        <Button variant="ghost" className="mb-4 gap-2" data-testid="button-back">
          <ArrowRight className="h-4 w-4" />
          العودة للمنتجات
        </Button>
      </Link>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="relative">
          <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl overflow-hidden p-8">
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-contain"
            />
          </div>
          {product.stock <= 0 && (
            <Badge variant="destructive" className="absolute top-4 right-4 text-sm px-4 py-2">
              نفذت الكمية
            </Badge>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-foreground mb-2" data-testid="text-product-name">
              {product.name}
            </h1>
            <p className="text-muted-foreground leading-relaxed" data-testid="text-product-description">
              {product.description}
            </p>
          </div>

          <Card className="border-primary/20">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-end justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">السعر للوحدة</p>
                  <p className="text-3xl font-extrabold text-primary" data-testid="text-product-price">
                    {formatPrice(currentPrice)} 
                    <span className="text-lg font-normal text-muted-foreground mr-2">
                      {currency === 'YER' ? 'ر.ي' : 'ر.س'}
                    </span>
                  </p>
                </div>
                <div className="text-left">
                  <p className="text-sm text-muted-foreground mb-1">الإجمالي</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-total-price">
                    {formatPrice(totalPrice)} 
                    <span className="text-sm font-normal text-muted-foreground mr-1">
                      {currency === 'YER' ? 'ر.ي' : 'ر.س'}
                    </span>
                  </p>
                </div>
              </div>

              {bulkPricing.length > 0 && (
                <div className="bg-primary/5 rounded-lg p-3">
                  <p className="text-sm font-semibold text-primary mb-2">خصومات الكميات:</p>
                  <div className="flex flex-wrap gap-2">
                    {bulkPricing.map((bp, i) => (
                      <Badge 
                        key={i} 
                        variant={quantity >= bp.minQty ? "default" : "outline"}
                        className="text-xs"
                      >
                        {bp.minQty}+ قطعة: {formatPrice(bp.price)} {currency === 'YER' ? 'ر.ي' : 'ر.س'}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div>
              <Label className="text-base font-semibold mb-3 block">الكمية</Label>
              <div className="flex items-center gap-3">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                  data-testid="button-decrease-quantity"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  min={1}
                  max={product.stock}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.min(product.stock, parseInt(e.target.value) || 1)))}
                  className="w-20 text-center font-bold text-lg"
                  data-testid="input-quantity"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                  disabled={quantity >= product.stock}
                  data-testid="button-increase-quantity"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  متوفر: {product.stock} قطعة
                </span>
              </div>
            </div>

            {colors.length > 0 && (
              <div>
                <Label className="text-base font-semibold mb-3 block">اختر اللون</Label>
                <div className="flex flex-wrap gap-3">
                  {colors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center ${
                        selectedColor === color 
                          ? 'border-primary ring-2 ring-primary/30' 
                          : 'border-gray-200 hover:border-gray-400'
                      }`}
                      style={{ backgroundColor: color }}
                      data-testid={`button-color-${color}`}
                    >
                      {selectedColor === color && (
                        <Check className="h-5 w-5 text-white drop-shadow-md" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {sizes.length > 0 && (
              <div>
                <Label className="text-base font-semibold mb-3 block">اختر المقاس</Label>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`px-4 py-2 rounded-lg border-2 transition-all font-medium ${
                        selectedSize === size 
                          ? 'border-primary bg-primary/10 text-primary' 
                          : 'border-gray-200 hover:border-gray-400 text-foreground'
                      }`}
                      data-testid={`button-size-${size}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {product.allowDesignUpload && (
              <div>
                <Label className="text-base font-semibold mb-3 block">رفع التصميم الخاص بك</Label>
                <div 
                  className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf,.ai,.psd"
                    onChange={handleFileUpload}
                    className="hidden"
                    data-testid="input-design-upload"
                  />
                  {uploadedFile ? (
                    <div className="flex items-center justify-center gap-2 text-primary">
                      <Check className="h-5 w-5" />
                      <span className="font-medium">{uploadedFile.name}</span>
                    </div>
                  ) : (
                    <div className="text-muted-foreground">
                      <Upload className="h-8 w-8 mx-auto mb-2" />
                      <p>اضغط لرفع ملف التصميم</p>
                      <p className="text-xs mt-1">PDF, AI, PSD, أو صور</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <Button
            size="lg"
            className="w-full h-14 text-lg font-extrabold gap-3 rounded-xl shadow-lg shadow-primary/20"
            disabled={product.stock <= 0 || isPending}
            onClick={handleAddToCart}
            data-testid="button-add-to-cart"
          >
            {isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ShoppingCart className="h-5 w-5" />
            )}
            {product.stock <= 0 ? "غير متوفر حالياً" : "أضف إلى السلة"}
          </Button>
        </div>
      </div>
    </div>
  );
}
