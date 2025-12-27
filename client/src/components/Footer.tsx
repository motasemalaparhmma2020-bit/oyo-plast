import { Phone, MapPin, FileText, Shield } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { Link } from "wouter";

import jawalyLogo from "@assets/stock_images/jawaly_yemen_mobile__6c3cc5d2.jpg";
import jeebLogo from "@assets/stock_images/jeeb_mobile_wallet_p_6fad2c62.jpg";
import onecashLogo from "@assets/stock_images/onecash_mobile_payme_acff727b.jpg";
import floosLogo from "@assets/stock_images/flooos_mobile_money__ad887803.jpg";
import kuraimiLogo from "@assets/stock_images/kuraimi_bank_yemen_l_d7702f30.jpg";

const paymentMethods = [
  { name: "جوالي", nameEn: "Jawaly", logo: jawalyLogo },
  { name: "جيب", nameEn: "Jeeb", logo: jeebLogo },
  { name: "ون كاش", nameEn: "OneCash", logo: onecashLogo },
  { name: "فلوسك", nameEn: "Flooos", logo: floosLogo },
  { name: "الكريمي", nameEn: "Kuraimi", logo: kuraimiLogo },
];

export function Footer() {
  const phoneNumber = "+967774997589";
  const whatsappLink = `https://wa.me/${phoneNumber.replace('+', '')}`;

  return (
    <footer className="bg-gradient-to-b from-card to-muted/30 border-t mt-auto hidden md:block" dir="rtl">
      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* من نحن */}
          <div>
            <h3 className="text-lg font-bold mb-4 text-primary" data-testid="text-about-title">أويو بلاست</h3>
            <p className="text-muted-foreground leading-relaxed" data-testid="text-about-description">
              أويو بلاست - الوجهة الأولى لمستلزمات التغليف والبلاستيك في اليمن. 
              نقدم منتجات عالية الجودة بأسعار منافسة مع خدمة توصيل لجميع المحافظات اليمنية.
            </p>
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="w-4 h-4 text-primary" />
              <span>رقم توثيق الاسم التجاري: <strong className="text-foreground">139688</strong></span>
            </div>
          </div>

          {/* تواصل معنا */}
          <div>
            <h3 className="text-lg font-bold mb-4 text-primary">تواصل معنا</h3>
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
        </div>

        {/* روابط قانونية */}
        <div className="border-t mt-8 pt-6">
          <div className="flex justify-center items-center gap-6 mb-4 flex-wrap">
            <Link href="/about" className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors" data-testid="link-about">
              <Shield className="w-4 h-4" />
              من نحن
            </Link>
            <Link href="/terms" className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors" data-testid="link-terms">
              <FileText className="w-4 h-4" />
              سياسة الأحكام والشروط
            </Link>
            <Link href="/privacy" className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors" data-testid="link-privacy">
              <Shield className="w-4 h-4" />
              سياسة الخصوصية
            </Link>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground">
              جميع الحقوق محفوظة © متجر <span className="font-bold text-primary">أويو بلاست</span> 2025
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              رقم توثيق الاسم التجاري: <strong>139688</strong>
            </p>
          </div>
        </div>
      </div>

      {/* وسائل الدفع - شريط أفقي في الأسفل */}
      <div className="bg-muted/50 border-t py-4">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-6">
            <span className="text-sm text-muted-foreground font-medium">وسائل الدفع المقبولة:</span>
            <div className="flex items-center justify-center gap-4">
              {paymentMethods.map((method) => (
                <div 
                  key={method.nameEn}
                  className="flex items-center gap-2 bg-white dark:bg-gray-800 border rounded-lg px-3 py-2 shadow-sm"
                  data-testid={`payment-${method.nameEn.toLowerCase()}`}
                >
                  <div className="w-8 h-8 rounded overflow-hidden bg-white flex items-center justify-center shrink-0">
                    <img 
                      src={method.logo} 
                      alt={method.name} 
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <span className="text-sm font-medium text-foreground whitespace-nowrap">{method.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* WhatsApp Floating Button */}
      <a
        href={whatsappLink}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-24 left-4 z-50 w-14 h-14 bg-green-500 rounded-full flex items-center justify-center shadow-lg hover:bg-green-600 transition-colors"
        data-testid="button-whatsapp-float"
        aria-label="تواصل عبر واتساب"
      >
        <SiWhatsapp className="w-7 h-7 text-white" />
      </a>
    </footer>
  );
}

export function MobileFooter() {
  const phoneNumber = "+967774997589";
  const whatsappLink = `https://wa.me/${phoneNumber.replace('+', '')}`;

  return (
    <div className="md:hidden bg-gradient-to-b from-card to-muted/30 border-t pb-20" dir="rtl">
      <div className="container mx-auto px-4 py-6">
        {/* من نحن */}
        <div className="mb-6">
          <h3 className="text-base font-bold mb-2 text-primary">أويو بلاست</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            أويو بلاست - الوجهة الأولى لمستلزمات التغليف والبلاستيك في اليمن.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            رقم توثيق الاسم التجاري: <strong className="text-foreground">139688</strong>
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

        {/* روابط قانونية */}
        <div className="flex justify-center gap-4 mb-4 flex-wrap">
          <Link href="/about" className="text-sm text-muted-foreground hover:text-primary" data-testid="mobile-link-about">
            من نحن
          </Link>
          <Link href="/terms" className="text-sm text-muted-foreground hover:text-primary" data-testid="mobile-link-terms">
            الأحكام والشروط
          </Link>
          <Link href="/privacy" className="text-sm text-muted-foreground hover:text-primary" data-testid="mobile-link-privacy">
            سياسة الخصوصية
          </Link>
        </div>

        {/* Copyright */}
        <div className="text-center pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            جميع الحقوق محفوظة © متجر <span className="font-bold text-primary">أويو بلاست</span> 2025
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            رقم توثيق الاسم التجاري: <strong>139688</strong>
          </p>
        </div>
      </div>

      {/* وسائل الدفع - شريط أفقي قابل للتمرير */}
      <div className="bg-muted/50 border-t py-3">
        <div className="container mx-auto px-4">
          <p className="text-xs text-muted-foreground text-center mb-2">وسائل الدفع المقبولة</p>
          <div className="flex items-center justify-start gap-3 overflow-x-auto pb-1">
            {paymentMethods.map((method) => (
              <div 
                key={method.nameEn}
                className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border rounded-lg px-2 py-1.5 shadow-sm shrink-0"
                data-testid={`mobile-payment-${method.nameEn.toLowerCase()}`}
              >
                <div className="w-6 h-6 rounded overflow-hidden bg-white flex items-center justify-center shrink-0">
                  <img 
                    src={method.logo} 
                    alt={method.name} 
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="text-xs font-medium text-foreground whitespace-nowrap">{method.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* WhatsApp Floating Button */}
      <a
        href={whatsappLink}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-24 left-4 z-50 w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-lg hover:bg-green-600 transition-colors"
        data-testid="mobile-button-whatsapp-float"
        aria-label="تواصل عبر واتساب"
      >
        <SiWhatsapp className="w-6 h-6 text-white" />
      </a>
    </div>
  );
}
