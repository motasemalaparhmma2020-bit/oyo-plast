import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Printer, X, MapPin, Phone, User, Package, FileText, Truck, ChevronDown, ChevronUp } from "lucide-react";
import logoImg from "@assets/FB_IMG_1748731871206_1766877101101.jpg";
import { OrderItemInlineMeta } from "@/components/OrderItemDetails";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface OrderItem {
  id: number;
  productId: number | null;
  quantity: number;
  price: string;
  productName?: string | null;
  selectedSize?: string | null;
  selectedColor?: string | null;
  selectedBagColor?: string | null;
  printColor1?: string | null;
  printColor2?: string | null;
  printColor3?: string | null;
  printColorCount?: number | null;
  customPrinting?: boolean | null;
  designNotes?: string | null;
  designFileUrl?: string | null;
}

export interface InvoiceSettings {
  showProductImages: boolean;
  showSize: boolean;
  showColor: boolean;
  showShipping: boolean;
  showDiscount: boolean;
  showReceiptImage: boolean;
  showTransferCode: boolean;
  showCustomerNotes: boolean;
  showAdminNote: boolean;
  adminNote: string;
  currency: "YER" | "SAR" | "both";
  storePhone: string;
  storeAddress: string;
  footerText: string;
  deliveryInvoiceShowPrices: boolean;
  deliveryInvoiceShowImages: boolean;
  showGPS: boolean;
  manualDiscount: number;
  manualDiscountLabel: string;
}

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
  showProductImages: true,
  showSize: true,
  showColor: true,
  showShipping: true,
  showDiscount: true,
  showReceiptImage: true,
  showTransferCode: true,
  showCustomerNotes: true,
  showAdminNote: false,
  adminNote: "",
  currency: "both",
  storePhone: "+967 774 997 589",
  storeAddress: "",
  footerText: "شكراً لثقتكم بنا — أويو بلاست",
  deliveryInvoiceShowPrices: true,
  deliveryInvoiceShowImages: false,
  showGPS: true,
  manualDiscount: 0,
  manualDiscountLabel: "خصم إضافي",
};

interface PrintableInvoiceProps {
  order: any;
  orderItems?: OrderItem[];
  isDeliveryInvoice?: boolean;
  onClose: () => void;
  adminToken?: string | null;
  overrideSettings?: Partial<InvoiceSettings>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseAlternateRecipient(notes: string | null | undefined) {
  if (!notes) return null;
  const marker = "--- المستلم البديل ---";
  const idx = notes.indexOf(marker);
  if (idx === -1) return null;
  const block = notes.slice(idx + marker.length).trim();
  const get = (label: string) => {
    const match = block.match(new RegExp(`${label}:\\s*(.+)`));
    return match ? match[1].trim() : "";
  };
  const name = get("الاسم");
  if (!name) return null;
  return { name, phone: get("الهاتف"), neighborhood: get("الحي"), city: get("المدينة/المحل"), address: get("العنوان") };
}

function getCleanNotes(notes: string | null | undefined): string {
  if (!notes) return "";
  const idx = notes.indexOf("--- المستلم البديل ---");
  return idx === -1 ? notes.trim() : notes.slice(0, idx).trim();
}

function getGoogleMapsUrl(coords: string | null | undefined): string | null {
  if (!coords) return null;
  const trimmed = coords.trim();
  if (trimmed.startsWith("http")) return trimmed;
  const parts = trimmed.split(",").map(p => p.trim());
  if (parts.length >= 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1])))
    return `https://maps.google.com/?q=${parts[0]},${parts[1]}`;
  return null;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash_on_delivery: "الدفع عند الاستلام 💵",
  digital_wallet: "محفظة إلكترونية",
  karimi: "الكريمي",
  najm: "النجم",
  bank_transfer: "تحويل بنكي",
};

const SHIPPING_LABELS: Record<string, string> = {
  normal: "شحن عادي (3-5 أيام)",
  fast: "شحن سريع (1-2 يوم)",
  free: "شحن مجاني 🎁",
};

const COLOR_MAP: Record<string, string> = {
  أبيض: "#FFFFFF", أسود: "#000000", أحمر: "#EF4444", أزرق: "#3B82F6",
  أخضر: "#22C55E", أصفر: "#EAB308", برتقالي: "#F97316", وردي: "#EC4899",
  بنفسجي: "#8B5CF6", رمادي: "#6B7280", بني: "#92400E", ذهبي: "#D97706",
  فضي: "#9CA3AF", شفاف: "transparent", سماوي: "#06B6D4", زهري: "#F472B6",
  كحلي: "#1E3A8A", بيج: "#D4A574",
};

function getColorHex(color: string | null | undefined): string {
  if (!color) return "transparent";
  if (color.startsWith("#")) return color;
  return COLOR_MAP[color] || "#888888";
}

// ─── Customer Invoice ─────────────────────────────────────────────────────────
function CustomerInvoice({ order, orderItems, settings }: {
  order: any; orderItems: OrderItem[]; settings: InvoiceSettings;
}) {
  const currency = order.currency === "SAR" ? "ر.س" : "ر.ي";
  const currencySar = "ر.س";
  const currencyYer = "ر.ي";

  const formatPrice = (price: number | string | null | undefined, curr?: string) => {
    if (!price) return "0";
    return `${Number(price).toLocaleString("ar-YE")} ${curr || currency}`;
  };

  const formatDate = (date: any) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("ar-YE", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const shippingCost = Number(order.shippingCost || 0);
  const subtotalBefore = Number(order.subtotalBeforeDiscount || 0);
  const discountAmount = Number(order.discountAmount || 0);
  const manualDiscount = Number(settings.manualDiscount || 0);
  const total = Number(order.total || 0);
  const adjustedTotal = Math.max(0, total - manualDiscount);
  const depositAmount = Number(order.depositAmount || 0);
  const balanceDue = order.paymentMethod === "cash_on_delivery" ? adjustedTotal - depositAmount : 0;

  const alternateRecipient = parseAlternateRecipient(order.notes);
  const cleanNotes = getCleanNotes(order.notes);
  const mapsUrl = getGoogleMapsUrl(order.gpsCoordinates);

  const trackingNumber = order.trackingNumber;
  const receiptImageUrl = order.receiptImageUrl;

  const hasAnySize = orderItems.some(i => i.selectedSize);
  const hasAnyColor = orderItems.some(i => i.selectedColor);

  const showCols = {
    images: settings.showProductImages,
    size: settings.showSize && hasAnySize,
    color: settings.showColor && hasAnyColor,
  };

  const getItemLabel = (item: OrderItem) => {
    if (item.productName && item.productName !== "null") return item.productName;
    if (item.productId) return `منتج #${item.productId}`;
    return "منتج محذوف";
  };

  return (
    <div id="invoice-content" className="p-6 print:p-4 bg-white" dir="rtl">

      {/* ═══ رأس الفاتورة ═══ */}
      <div className="flex items-start justify-between mb-5 pb-4 border-b-[3px] border-primary">
        <div className="flex items-center gap-3">
          <img src={logoImg} alt="أويو بلاست" className="h-16 w-16 rounded-full object-cover border-2 border-primary/20 shadow" />
          <div>
            <h1 className="text-xl font-black text-primary leading-tight">أويو بلاست</h1>
            <p className="text-xs text-gray-500">لطباعة ومستلزمات التغليف البلاستيكي</p>
            <p className="text-xs text-gray-400">السجل التجاري: 139688</p>
            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
              <Phone className="h-3 w-3" />
              <span dir="ltr">{settings.storePhone || "+967 774 997 589"}</span>
            </p>
            {settings.storeAddress && (
              <p className="text-xs text-gray-400">{settings.storeAddress}</p>
            )}
          </div>
        </div>
        <div className="text-left bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
          <div className="bg-primary text-white text-xs font-bold px-3 py-1 rounded-lg text-center mb-2">
            فاتورة مشتريات
          </div>
          <p className="text-gray-400 text-xs">رقم الفاتورة</p>
          <p className="font-black text-2xl text-primary leading-tight">#{order.id}</p>
          <p className="text-gray-400 text-xs mt-1">التاريخ</p>
          <p className="font-medium text-xs text-gray-600">{formatDate(order.createdAt)}</p>
        </div>
      </div>

      {/* ═══ بيانات العميل ═══ */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4">
        <h3 className="font-bold mb-2.5 text-blue-800 flex items-center gap-2 text-sm border-b border-blue-200 pb-2">
          <User className="h-4 w-4" /> بيانات العميل
        </h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {order.customerName && (
            <div className="col-span-2 flex items-center gap-2">
              <span className="text-gray-500 text-xs">الاسم:</span>
              <span className="font-bold">{order.customerName}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Phone className="h-3 w-3 text-gray-400" />
            <span className="font-medium text-sm" dir="ltr">{order.customerPhone || "-"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 text-xs">المدينة:</span>
            <span className="font-medium">{order.shippingCity || "-"}</span>
          </div>
          {order.shippingAddress && (
            <div className="col-span-2 flex items-start gap-1.5">
              <MapPin className="h-3 w-3 text-gray-400 mt-0.5 shrink-0" />
              <span className="font-medium text-sm">{order.shippingAddress}</span>
            </div>
          )}
          {settings.showGPS && mapsUrl && (
            <div className="col-span-2 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-green-600 shrink-0" />
              <span className="text-green-700 text-xs font-medium">الموقع:</span>
              <span className="text-green-600 text-xs font-mono break-all" dir="ltr">{mapsUrl}</span>
            </div>
          )}
        </div>
      </div>

      {/* ═══ رقم الحوالة / كود الطلب ═══ */}
      {settings.showTransferCode && trackingNumber && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 mb-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-xs text-indigo-500 font-medium">رقم الحوالة / كود الطلب</p>
            <p className="font-black text-indigo-800 text-lg tracking-wider" dir="ltr">{trackingNumber}</p>
          </div>
        </div>
      )}

      {/* ═══ صورة الحوالة (إيصال الدفع) ═══ */}
      {settings.showReceiptImage && receiptImageUrl && (
        <div className="border border-gray-200 rounded-xl p-3 mb-4">
          <p className="text-xs text-gray-500 font-medium mb-2 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> إيصال الدفع المرفق من العميل
          </p>
          <img
            src={receiptImageUrl}
            alt="إيصال الدفع"
            className="max-h-48 rounded-lg border border-gray-200 object-contain mx-auto block"
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}

      {/* ═══ جدول المنتجات ═══ */}
      {orderItems.length > 0 && (
        <div className="mb-4">
          <h3 className="font-bold mb-2.5 flex items-center gap-2 text-sm border-b pb-2">
            <Package className="h-4 w-4" /> تفاصيل الطلب
          </h3>
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="text-right py-2 px-2 font-semibold text-gray-600">#</th>
                  {showCols.images && <th className="py-2 px-1"></th>}
                  <th className="text-right py-2 px-2 font-semibold text-gray-600">المنتج</th>
                  {showCols.size && <th className="text-center py-2 px-1 font-semibold text-gray-600">المقاس</th>}
                  {showCols.color && <th className="text-center py-2 px-1 font-semibold text-gray-600">اللون</th>}
                  <th className="text-center py-2 px-1 font-semibold text-gray-600">الكمية</th>
                  <th className="text-left py-2 px-2 font-semibold text-gray-600">سعر الوحدة</th>
                  <th className="text-left py-2 px-2 font-semibold text-gray-600">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {orderItems.map((item, i) => {
                  const itemTotal = Number(item.price) * item.quantity;
                  const colorHex = getColorHex(item.selectedColor);
                  return (
                    <tr key={item.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="py-2.5 px-2 text-gray-400">{i + 1}</td>
                      {showCols.images && (
                        <td className="py-2.5 px-1">
                          {item.productId ? (
                            <img
                              src={`/api/products/image/${item.productId}`}
                              alt={item.productName || ""}
                              className="w-9 h-9 rounded-lg object-cover border border-gray-200 shrink-0"
                              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          ) : <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center"><Package className="w-4 h-4 text-gray-300" /></div>}
                        </td>
                      )}
                      <td className="py-2.5 px-2">
                        <p className="font-semibold text-gray-800 leading-tight">{getItemLabel(item)}</p>
                        {item.customPrinting && (
                          <span className="text-[9px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">طباعة مخصصة</span>
                        )}
                        <OrderItemInlineMeta item={item} />
                      </td>
                      {showCols.size && (
                        <td className="text-center py-2.5 px-1">
                          {item.selectedSize
                            ? <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-full text-xs font-medium">{item.selectedSize}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                      )}
                      {showCols.color && (
                        <td className="text-center py-2.5 px-1">
                          {item.selectedColor ? (
                            <div className="flex items-center justify-center gap-1">
                              <div
                                className="w-4 h-4 rounded-full border border-gray-300 shrink-0"
                                style={{ backgroundColor: colorHex }}
                              />
                              {!item.selectedColor.startsWith("#") && (
                                <span className="text-xs">{item.selectedColor}</span>
                              )}
                            </div>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                      )}
                      <td className="text-center py-2.5 px-1 font-bold text-base">{item.quantity}</td>
                      <td className="text-left py-2.5 px-2 text-gray-600">{formatPrice(item.price)}</td>
                      <td className="text-left py-2.5 px-2 font-bold text-primary">{formatPrice(itemTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ ملخص المبالغ ═══ */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* الدفع والشحن */}
        {settings.showShipping && (
          <div className="bg-gray-50 border rounded-xl p-3">
            <h4 className="font-bold text-gray-700 text-xs mb-2 border-b pb-1.5">طريقة الدفع والشحن</h4>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">الدفع:</span>
                <span className="font-semibold">{PAYMENT_LABELS[order.paymentMethod || ""] || order.paymentMethod || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">الشحن:</span>
                <span className="font-semibold">{SHIPPING_LABELS[order.shippingOption || ""] || order.shippingOption || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">رسوم الشحن:</span>
                <span className={`font-bold ${shippingCost === 0 ? "text-green-600" : ""}`}>
                  {shippingCost === 0 ? "مجاني 🎁" : formatPrice(shippingCost)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* الإجمالي */}
        <div className="bg-gray-50 border rounded-xl p-3">
          <h4 className="font-bold text-gray-700 text-xs mb-2 border-b pb-1.5">ملخص المبالغ</h4>
          <div className="space-y-1.5 text-xs">
            {settings.showDiscount && subtotalBefore > 0 && discountAmount > 0 && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-500">قبل الخصم:</span>
                  <span className="line-through text-gray-400">{formatPrice(subtotalBefore)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">
                    خصم الكوبون{order.couponCode ? ` (${order.couponCode})` : ''}:
                  </span>
                  <span className="text-green-600 font-semibold">- {formatPrice(discountAmount)}</span>
                </div>
              </>
            )}
            {manualDiscount > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">{settings.manualDiscountLabel || "خصم إضافي"}:</span>
                <span className="text-green-600 font-semibold">- {formatPrice(manualDiscount)}</span>
              </div>
            )}
            {depositAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">العربون:</span>
                <span className="font-semibold text-blue-600">{formatPrice(depositAmount)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1.5 border-t font-bold text-sm">
              <span>الإجمالي النهائي:</span>
              <span className="text-primary text-base">{formatPrice(adjustedTotal)}</span>
            </div>
            {settings.currency === "both" && order.currency !== "SAR" && (
              <div className="text-center text-xs text-gray-400 border-t pt-1">
                ≈ {(adjustedTotal / 530).toFixed(2)} {currencySar}
              </div>
            )}
            {balanceDue > 0 && (
              <div className="flex justify-between bg-orange-50 border border-orange-200 rounded-lg px-2 py-1.5 mt-1">
                <span className="text-orange-700 font-bold text-xs">المبلغ عند الاستلام:</span>
                <span className="font-black text-orange-700">{formatPrice(balanceDue)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ المستلم البديل ═══ */}
      {alternateRecipient && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
          <h4 className="font-bold text-amber-800 text-xs mb-2 border-b border-amber-200 pb-1.5 flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" /> المستلم البديل
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-gray-500">الاسم: </span><span className="font-bold">{alternateRecipient.name}</span></div>
            <div><span className="text-gray-500">الجوال: </span><span dir="ltr">{alternateRecipient.phone}</span></div>
            {alternateRecipient.city && <div><span className="text-gray-500">المدينة: </span><span>{alternateRecipient.city}</span></div>}
            {alternateRecipient.address && <div className="col-span-2"><span className="text-gray-500">العنوان: </span><span>{alternateRecipient.address}</span></div>}
          </div>
        </div>
      )}

      {/* ═══ ملاحظات العميل ═══ */}
      {settings.showCustomerNotes && cleanNotes && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4">
          <h4 className="font-bold text-yellow-800 text-xs mb-1.5">ملاحظات العميل</h4>
          <p className="text-xs text-yellow-700 whitespace-pre-wrap">{cleanNotes}</p>
        </div>
      )}

      {/* ═══ ملاحظة إدارية ═══ */}
      {settings.showAdminNote && settings.adminNote && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 mb-4">
          <h4 className="font-bold text-purple-800 text-xs mb-1.5">ملاحظة إدارية</h4>
          <p className="text-xs text-purple-700 whitespace-pre-wrap">{settings.adminNote}</p>
        </div>
      )}

      {/* ═══ التذييل ═══ */}
      <div className="text-center text-xs text-gray-400 pt-3 border-t mt-2">
        <p className="font-semibold text-gray-600 text-sm">{settings.footerText || "شكراً لثقتكم بنا"}</p>
        <p className="mt-0.5">أويو بلاست — لطباعة ومستلزمات التغليف</p>
        <p className="mt-0.5">معتصم محمد احمد الاهدل | هاتف: <span dir="ltr">{settings.storePhone}</span></p>
        {settings.storeAddress && <p>{settings.storeAddress}</p>}
      </div>
    </div>
  );
}

// ─── Delivery Invoice ─────────────────────────────────────────────────────────
function DeliveryInvoice({ order, orderItems, settings }: {
  order: any; orderItems: OrderItem[]; settings: InvoiceSettings;
}) {
  const [showProducts, setShowProducts] = useState(true);
  const [showNotes, setShowNotes] = useState(false);
  const [showSignature, setShowSignature] = useState(false);

  const currency = order.currency === "SAR" ? "ر.س" : "ر.ي";
  const total = Number(order.total || 0);
  const manualDiscount = Number(settings.manualDiscount || 0);
  const adjustedTotal = Math.max(0, total - manualDiscount);
  const mapsUrl = getGoogleMapsUrl(order.gpsCoordinates);
  const alternateRecipient = parseAlternateRecipient(order.notes);
  const cleanNotes = getCleanNotes(order.notes);
  const trackingNumber = order.trackingNumber;
  const isCOD = order.paymentMethod === "cash_on_delivery";
  const depositAmount = Number(order.depositAmount || 0);
  const balanceDue = isCOD ? adjustedTotal - depositAmount : 0;

  const formatDate = (date: any) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("ar-YE", { year: "numeric", month: "long", day: "numeric" });
  };

  const getProductLabel = (item: OrderItem) => {
    if (item.productName && item.productName !== "null") return item.productName;
    if (item.productId) return `منتج #${item.productId}`;
    return "منتج محذوف";
  };

  const SectionHeader = ({ title, icon, count, open, onToggle }: {
    title: string; icon: ReactNode; count?: number; open: boolean; onToggle: () => void;
  }) => (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex items-center justify-between py-2 px-3 rounded-lg font-bold text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors print:hidden`}
    >
      <span className="flex items-center gap-1.5">
        {icon}
        {title}
        {count !== undefined && (
          <span className="bg-primary text-white text-xs px-1.5 py-0.5 rounded-full font-bold">{count}</span>
        )}
      </span>
      {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
    </button>
  );

  return (
    <div id="invoice-content" className="p-4 print:p-3 bg-white" dir="rtl">

      {/* ═══ رأس مضغوط ═══ */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b-2 border-dashed border-gray-400">
        <div className="flex items-center gap-2">
          <img src={logoImg} alt="أويو بلاست" className="h-10 w-10 rounded-full object-cover border border-gray-200" />
          <div>
            <p className="font-black text-primary text-sm leading-tight">أويو بلاست</p>
            <p className="text-xs text-gray-500" dir="ltr">{settings.storePhone}</p>
          </div>
        </div>
        <div className="text-left">
          <div className="bg-primary text-white px-2.5 py-1 rounded-lg font-bold text-xs flex items-center gap-1">
            <Truck className="w-3.5 h-3.5" />
            بوليصة توصيل
          </div>
          <p className="font-black text-lg text-primary text-left">#{ order.id}</p>
          <p className="text-xs text-gray-400 text-left">{formatDate(order.createdAt)}</p>
        </div>
      </div>

      {/* ═══ المبلغ المطلوب — أبرز عنصر ═══ */}
      {isCOD && (
        <div className="bg-orange-500 text-white rounded-xl p-3 mb-3 text-center shadow">
          <p className="text-xs font-semibold opacity-90">💵 المبلغ المطلوب تحصيله</p>
          <p className="text-3xl font-black tracking-wide mt-0.5">
            {balanceDue.toLocaleString("ar-YE")} <span className="text-xl">{currency}</span>
          </p>
          {depositAmount > 0 && (
            <p className="text-xs opacity-75 mt-0.5">عربون مدفوع: {depositAmount.toLocaleString()} {currency}</p>
          )}
        </div>
      )}
      {!isCOD && (
        <div className="bg-green-50 border border-green-300 rounded-xl p-2.5 mb-3 text-center">
          <p className="text-xs text-green-600 font-semibold">✅ الإجمالي: {adjustedTotal.toLocaleString("ar-YE")} {currency} — مدفوع مسبقاً</p>
        </div>
      )}

      {/* ═══ قسم التوصيل — دائماً مفتوح ═══ */}
      <div className="border-2 border-gray-300 rounded-xl mb-3 overflow-hidden">
        <div className="bg-gray-50 px-3 py-2 flex items-center gap-1.5 border-b border-gray-200">
          <MapPin className="w-4 h-4 text-primary" />
          <span className="font-bold text-sm text-gray-700">عنوان التوصيل</span>
        </div>
        <div className="p-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span className="font-bold text-base">{(alternateRecipient ? alternateRecipient.name : order.customerName) || "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span className="font-bold text-base text-primary" dir="ltr">
              {alternateRecipient ? alternateRecipient.phone : (order.customerPhone || "—")}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 shrink-0">المدينة:</span>
            <span className="font-semibold">{alternateRecipient ? alternateRecipient.city : (order.shippingCity || "—")}</span>
          </div>
          {(order.shippingAddress || alternateRecipient?.address) && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
              <span className="font-semibold">{alternateRecipient ? alternateRecipient.address : order.shippingAddress}</span>
            </div>
          )}
          {settings.showGPS && mapsUrl && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5 text-xs flex items-start gap-1.5">
              <span className="text-green-700 font-bold shrink-0">📍</span>
              <span className="text-green-600 font-mono break-all" dir="ltr">{mapsUrl}</span>
            </div>
          )}
          {settings.showTransferCode && trackingNumber && (
            <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1.5 text-xs">
              <FileText className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span className="text-indigo-500">الكود:</span>
              <span className="font-black text-indigo-800" dir="ltr">{trackingNumber}</span>
            </div>
          )}
        </div>
      </div>

      {/* ═══ قسم المنتجات — قابل للطي ═══ */}
      {orderItems.length > 0 && (
        <div className="border border-gray-200 rounded-xl mb-3 overflow-hidden">
          <div className="print:block">
            <SectionHeader
              title="المنتجات"
              icon={<Package className="w-4 h-4" />}
              count={orderItems.length}
              open={showProducts}
              onToggle={() => setShowProducts(p => !p)}
            />
            {/* عنوان للطباعة */}
            <div className="hidden print:flex items-center gap-1.5 px-3 py-2 bg-gray-50 border-b border-gray-200">
              <Package className="w-4 h-4" />
              <span className="font-bold text-sm">المنتجات ({orderItems.length})</span>
            </div>
          </div>
          {showProducts && (
            <div className="divide-y divide-dashed divide-gray-200 print:block">
              {orderItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2 px-3 py-2.5">
                  {settings.deliveryInvoiceShowImages && item.productId && (
                    <img
                      src={`/api/products/image/${item.productId}`}
                      alt=""
                      className="w-9 h-9 rounded-lg object-cover border border-gray-200 shrink-0"
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm leading-tight">{getProductLabel(item)}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      {item.selectedSize && (
                        <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full font-medium">
                          📐 {item.selectedSize}
                        </span>
                      )}
                      {item.selectedColor && (
                        <span className="flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-1.5 py-0.5 rounded-full">
                          <span
                            className="w-3 h-3 rounded-full border border-gray-300 inline-block shrink-0"
                            style={{ backgroundColor: getColorHex(item.selectedColor) }}
                          />
                          {!item.selectedColor.startsWith("#") && item.selectedColor}
                        </span>
                      )}
                      {item.customPrinting && (
                        <span className="bg-orange-100 text-orange-700 text-xs px-1.5 py-0.5 rounded-full">طباعة مخصصة</span>
                      )}
                    </div>
                  </div>
                  <div className="text-left shrink-0 min-w-[50px]">
                    <p className="font-bold text-base text-center">×{item.quantity}</p>
                    {settings.deliveryInvoiceShowPrices && (
                      <p className="text-xs text-gray-500 text-center">{(Number(item.price) * item.quantity).toLocaleString()}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ الملاحظات — قابل للطي ═══ */}
      {(settings.showCustomerNotes && cleanNotes) || (settings.showAdminNote && settings.adminNote) ? (
        <div className="border border-yellow-200 rounded-xl mb-3 overflow-hidden">
          <SectionHeader
            title="الملاحظات"
            icon={<FileText className="w-4 h-4" />}
            open={showNotes}
            onToggle={() => setShowNotes(p => !p)}
          />
          <div className="hidden print:block px-3 py-2 bg-yellow-50 border-b border-yellow-200">
            <span className="font-bold text-sm text-yellow-800">الملاحظات</span>
          </div>
          {showNotes && (
            <div className="p-3 space-y-2">
              {settings.showCustomerNotes && cleanNotes && (
                <div>
                  <p className="text-xs text-yellow-700 font-bold mb-0.5">ملاحظات العميل:</p>
                  <p className="text-sm text-yellow-800 whitespace-pre-wrap">{cleanNotes}</p>
                </div>
              )}
              {settings.showAdminNote && settings.adminNote && (
                <div>
                  <p className="text-xs text-purple-600 font-bold mb-0.5">ملاحظة للمندوب:</p>
                  <p className="text-sm text-purple-800 whitespace-pre-wrap">{settings.adminNote}</p>
                </div>
              )}
            </div>
          )}
          {/* للطباعة دائماً */}
          <div className="hidden print:block p-3 space-y-2">
            {settings.showCustomerNotes && cleanNotes && (
              <p className="text-xs text-yellow-800 whitespace-pre-wrap">{cleanNotes}</p>
            )}
            {settings.showAdminNote && settings.adminNote && (
              <p className="text-xs text-purple-800 whitespace-pre-wrap">{settings.adminNote}</p>
            )}
          </div>
        </div>
      ) : null}

      {/* ═══ إقرار الاستلام — قابل للطي ═══ */}
      <div className="border-2 border-dashed border-gray-300 rounded-xl mb-3 overflow-hidden">
        <SectionHeader
          title="إقرار الاستلام والتسليم"
          icon={<User className="w-4 h-4" />}
          open={showSignature}
          onToggle={() => setShowSignature(p => !p)}
        />
        <div className="hidden print:block px-3 py-2 bg-gray-50 border-b border-gray-200 text-center font-bold text-sm text-gray-600">
          إقرار الاستلام والتسليم
        </div>
        {(showSignature) && (
          <div className="p-3">
            <div className="grid grid-cols-2 gap-4">
              {["المستلم", "مندوب التوصيل"].map(label => (
                <div key={label} className="space-y-2">
                  <p className="text-xs font-bold text-center text-gray-600">{label}</p>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">الاسم:</p>
                    <div className="border-b-2 border-gray-300 min-h-[20px]" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">التوقيع:</p>
                    <div className="border-b-2 border-gray-300 min-h-[32px]" />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-3 border-t pt-2">
              <span className="text-xs text-gray-600 shrink-0">تاريخ التسليم:</span>
              <div className="border-b-2 border-gray-300 flex-1 min-h-[18px]" />
            </div>
          </div>
        )}
        {/* للطباعة */}
        <div className="hidden print:block p-3">
          <div className="grid grid-cols-2 gap-4">
            {["المستلم", "مندوب التوصيل"].map(label => (
              <div key={label} className="space-y-2">
                <p className="text-xs font-bold text-center text-gray-600">{label}</p>
                <div><p className="text-xs text-gray-400 mb-0.5">الاسم:</p><div className="border-b-2 border-gray-300 min-h-[20px]" /></div>
                <div><p className="text-xs text-gray-400 mb-0.5">التوقيع:</p><div className="border-b-2 border-gray-300 min-h-[32px]" /></div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 mt-3 border-t pt-2">
            <span className="text-xs text-gray-600 shrink-0">تاريخ التسليم:</span>
            <div className="border-b-2 border-gray-300 flex-1 min-h-[18px]" />
          </div>
        </div>
      </div>

      {/* التذييل */}
      <p className="text-center text-xs text-gray-400">
        أويو بلاست | <span dir="ltr">{settings.storePhone}</span>
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PrintableInvoice({
  order,
  orderItems = [],
  isDeliveryInvoice = false,
  onClose,
  adminToken,
  overrideSettings,
}: PrintableInvoiceProps) {

  const { data: savedSettings } = useQuery<Partial<InvoiceSettings>>({
    queryKey: ["/api/invoice-settings"],
    queryFn: async () => {
      const res = await fetch("/api/invoice-settings");
      if (!res.ok) return {};
      return res.json();
    },
    staleTime: 30000,
  });

  const settings: InvoiceSettings = {
    ...DEFAULT_INVOICE_SETTINGS,
    ...(savedSettings || {}),
    ...(overrideSettings || {}),
  };

  const handlePrint = () => setTimeout(() => window.print(), 100);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-auto">
      <div className="bg-white max-w-2xl w-full rounded-xl shadow-2xl print:shadow-none print:rounded-none print:max-w-none print:w-full my-4 print:my-0">

        {/* شريط الأزرار */}
        <div className="p-4 border-b flex items-center justify-between print:hidden bg-gray-50 rounded-t-xl gap-2">
          <h2 className="text-base font-bold text-primary flex items-center gap-2">
            {isDeliveryInvoice ? <Truck className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            {isDeliveryInvoice ? "بوليصة توصيل" : "فاتورة العميل"}
            <span className="text-gray-400 text-sm font-normal">#{order.id}</span>
          </h2>
          <div className="flex gap-2">
            <Button onClick={handlePrint} className="gap-2" size="sm" data-testid="button-print-invoice">
              <Printer className="h-4 w-4" />
              طباعة
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-invoice">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* المحتوى */}
        {isDeliveryInvoice
          ? <DeliveryInvoice order={order} orderItems={orderItems} settings={settings} />
          : <CustomerInvoice order={order} orderItems={orderItems} settings={settings} />
        }
      </div>

      <style>{`
        @media print {
          * { margin:0; padding:0; box-sizing:border-box; }
          body, html { background:white; width:100%; }
          body * { visibility:hidden; }
          #invoice-content, #invoice-content * { visibility:visible !important; }
          #invoice-content {
            position:absolute; left:0; top:0; right:0;
            width:100%; background:white; padding:12px; margin:0;
          }
          .print\\:hidden { display:none !important; }
          table { width:100%; border-collapse:collapse; }
          td, th { border:1px solid #e5e7eb; padding:5px 7px; }
          img { max-width:36px !important; max-height:36px !important; }
          button { display:none !important; }
        }
        @page { margin:0.8cm; size:A4; }
      `}</style>
    </div>
  );
}
