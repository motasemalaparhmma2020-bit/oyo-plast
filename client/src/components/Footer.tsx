import { Phone, MapPin, CreditCard, Building2, Wallet, Banknote } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { Link } from "wouter";

export function Footer() {
  const phoneNumber = "+967774997589";
  const whatsappLink = `https://wa.me/${phoneNumber.replace('+', '')}`;

  return (
    <footer className="bg-card border-t mt-auto hidden md:block" dir="rtl">
      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* من نحن */}
          <div>
            <h3 className="text-lg font-bold mb-4 text-foreground" data-testid="text-about-title">من نحن</h3>
            <p className="text-muted-foreground leading-relaxed" data-testid="text-about-description">
              اويو بلاست - الوجهة الأولى لمستلزمات التغليف والبلاستيك في اليمن. 
              نقدم منتجات عالية الجودة بأسعار منافسة مع خدمة توصيل لجميع المحافظات اليمنية.
              نسعى دائماً لتلبية احتياجات عملائنا من الأفراد والشركات.
            </p>
          </div>

          {/* تواصل معنا */}
          <div>
            <h3 className="text-lg font-bold mb-4 text-foreground">تواصل معنا</h3>
            <div className="space-y-4">
              <a 
                href={`tel:${phoneNumber}`}
                className="flex items-center gap-3 text-muted-foreground hover-elevate p-2 rounded-md transition-colors"
                data-testid="link-phone"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm">اتصل بنا</p>
                  <p className="font-medium text-foreground" dir="ltr">{phoneNumber}</p>
                </div>
              </a>
              
              <a 
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-muted-foreground hover-elevate p-2 rounded-md transition-colors"
                data-testid="link-whatsapp"
              >
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <SiWhatsapp className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm">واتساب</p>
                  <p className="font-medium text-foreground" dir="ltr">{phoneNumber}</p>
                </div>
              </a>

              <div className="flex items-center gap-3 text-muted-foreground p-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm">الموقع</p>
                  <p className="font-medium text-foreground">اليمن - جميع المحافظات</p>
                </div>
              </div>
            </div>
          </div>

          {/* طرق الدفع */}
          <div>
            <h3 className="text-lg font-bold mb-4 text-foreground">طرق الدفع المتاحة</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 bg-muted/50 p-3 rounded-md" data-testid="text-payment-jawali">
                <Wallet className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium">جوالي</span>
              </div>
              <div className="flex items-center gap-2 bg-muted/50 p-3 rounded-md" data-testid="text-payment-onecash">
                <Wallet className="w-5 h-5 text-orange-500" />
                <span className="text-sm font-medium">ون كاش</span>
              </div>
              <div className="flex items-center gap-2 bg-muted/50 p-3 rounded-md" data-testid="text-payment-jeeb">
                <Wallet className="w-5 h-5 text-purple-500" />
                <span className="text-sm font-medium">جيب</span>
              </div>
              <div className="flex items-center gap-2 bg-muted/50 p-3 rounded-md" data-testid="text-payment-mobilemoney">
                <CreditCard className="w-5 h-5 text-blue-500" />
                <span className="text-sm font-medium">موبايل موني</span>
              </div>
              <div className="flex items-center gap-2 bg-muted/50 p-3 rounded-md" data-testid="text-payment-cash">
                <Banknote className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium">كاش</span>
              </div>
              <div className="flex items-center gap-2 bg-muted/50 p-3 rounded-md" data-testid="text-payment-alkarimi">
                <Building2 className="w-5 h-5 text-yellow-600" />
                <span className="text-sm font-medium">بنك الكريمي</span>
              </div>
            </div>
          </div>
        </div>

        {/* روابط سريعة */}
        <div className="border-t mt-8 pt-6">
          <div className="flex justify-center gap-6 mb-4">
            <Link href="/about" className="text-muted-foreground hover:text-primary transition-colors" data-testid="link-about">
              من نحن
            </Link>
            <Link href="/privacy" className="text-muted-foreground hover:text-primary transition-colors" data-testid="link-privacy">
              سياسة الخصوصية
            </Link>
            <Link href="/products" className="text-muted-foreground hover:text-primary transition-colors" data-testid="link-products-footer">
              المنتجات
            </Link>
            <Link href="/cart" className="text-muted-foreground hover:text-primary transition-colors" data-testid="link-cart-footer">
              السلة
            </Link>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground">
              © {new Date().getFullYear()} <span className="font-bold text-primary">اويو بلاست</span> - جميع الحقوق محفوظة
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              أفضل حلول التغليف والبلاستيك لمشروعك التجاري في اليمن
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function MobileFooter() {
  const phoneNumber = "+967774997589";
  const whatsappLink = `https://wa.me/${phoneNumber.replace('+', '')}`;

  return (
    <div className="md:hidden bg-card border-t pb-20" dir="rtl">
      <div className="container mx-auto px-4 py-6">
        {/* من نحن */}
        <div className="mb-6">
          <h3 className="text-base font-bold mb-2 text-foreground">من نحن</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            اويو بلاست - الوجهة الأولى لمستلزمات التغليف والبلاستيك في اليمن.
          </p>
        </div>

        {/* تواصل معنا */}
        <div className="flex gap-3 mb-6">
          <a 
            href={`tel:${phoneNumber}`}
            className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-md font-medium"
            data-testid="mobile-link-phone"
          >
            <Phone className="w-5 h-5" />
            <span>اتصل بنا</span>
          </a>
          <a 
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 bg-green-500 text-white py-3 rounded-md font-medium"
            data-testid="mobile-link-whatsapp"
          >
            <SiWhatsapp className="w-5 h-5" />
            <span>واتساب</span>
          </a>
        </div>

        {/* طرق الدفع */}
        <div className="mb-4">
          <h3 className="text-base font-bold mb-3 text-foreground">طرق الدفع</h3>
          <div className="flex flex-wrap gap-2">
            {[
              { name: "جوالي", id: "jawali" },
              { name: "ون كاش", id: "onecash" },
              { name: "جيب", id: "jeeb" },
              { name: "موبايل موني", id: "mobilemoney" },
              { name: "كاش", id: "cash" },
              { name: "الكريمي", id: "alkarimi" }
            ].map((method) => (
              <span 
                key={method.id} 
                className="bg-muted/50 px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground"
                data-testid={`mobile-text-payment-${method.id}`}
              >
                {method.name}
              </span>
            ))}
          </div>
        </div>

        {/* روابط سريعة */}
        <div className="flex justify-center gap-4 mb-4">
          <Link href="/about" className="text-sm text-muted-foreground hover:text-primary" data-testid="mobile-link-about">
            من نحن
          </Link>
          <Link href="/privacy" className="text-sm text-muted-foreground hover:text-primary" data-testid="mobile-link-privacy">
            سياسة الخصوصية
          </Link>
        </div>

        {/* Copyright */}
        <div className="text-center pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} <span className="font-bold text-primary">اويو بلاست</span>
          </p>
        </div>
      </div>
    </div>
  );
}
