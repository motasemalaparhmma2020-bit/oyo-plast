import { Order } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Printer, X, MapPin, Phone, User, Package } from "lucide-react";
import logoImg from "@assets/FB_IMG_1748731871206_1766877101101.jpg";

interface OrderItem {
  id: number;
  productId: number | null;
  quantity: number;
  price: string;
  productName?: string | null;
  selectedSize?: string | null;
  selectedColor?: string | null;
  customPrinting?: boolean | null;
  designNotes?: string | null;
}

interface PrintableInvoiceProps {
  order: Order;
  orderItems?: OrderItem[];
  isDeliveryInvoice?: boolean;
  onClose: () => void;
}

interface AlternateRecipient {
  name: string;
  phone: string;
  neighborhood: string;
  city: string;
  address: string;
}

function parseAlternateRecipient(notes: string | null | undefined): AlternateRecipient | null {
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
  return {
    name,
    phone: get("الهاتف"),
    neighborhood: get("الحي"),
    city: get("المدينة/المحل"),
    address: get("العنوان"),
  };
}

function getCleanNotes(notes: string | null | undefined): string {
  if (!notes) return "";
  const idx = notes.indexOf("--- المستلم البديل ---");
  if (idx === -1) return notes.trim();
  return notes.slice(0, idx).trim();
}

function getGoogleMapsUrl(coords: string | null | undefined): string | null {
  if (!coords) return null;
  const trimmed = coords.trim();
  if (trimmed.startsWith("http")) return trimmed;
  const parts = trimmed.split(",").map((p) => p.trim());
  if (parts.length >= 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
    return `https://maps.google.com/?q=${parts[0]},${parts[1]}`;
  }
  return null;
}

export default function PrintableInvoice({ order, orderItems, isDeliveryInvoice, onClose }: PrintableInvoiceProps) {
  const formatPrice = (price: string | number | null | undefined) => {
    if (!price) return "0";
    return Number(price).toLocaleString("ar-YE");
  };

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("ar-YE", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const paymentMethodLabels: Record<string, string> = {
    cash_on_delivery: "الدفع عند الاستلام",
    digital_wallet: "محفظة إلكترونية",
    karimi: "الكريمي",
    najm: "النجم",
  };

  const shippingOptionLabels: Record<string, string> = {
    normal: "شحن عادي (3-5 أيام)",
    fast: "شحن سريع (1-2 يوم)",
    free: "شحن مجاني",
  };

  const currency = order.currency === "SAR" ? "ر.س" : "ر.ي";
  const shippingCost = Number(order.shippingCost || 0);
  const subtotalBefore = Number(order.subtotalBeforeDiscount || 0);
  const discountAmount = Number(order.discountAmount || 0);
  const total = Number(order.total || 0);
  const depositAmount = Number(order.depositAmount || 0);
  const balanceDue = order.paymentMethod === "cash_on_delivery" ? total - depositAmount : 0;

  const alternateRecipient = parseAlternateRecipient(order.notes);
  const cleanNotes = getCleanNotes(order.notes);
  const mapsUrl = getGoogleMapsUrl(order.gpsCoordinates);

  const handlePrint = () => {
    setTimeout(() => {
      if (window.print) window.print();
    }, 100);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-auto">
      <div className="bg-white max-w-2xl w-full rounded-xl shadow-2xl print:shadow-none print:rounded-none print:max-w-none print:w-full my-4 print:my-0">

        {/* شريط الأزرار - يُخفى عند الطباعة */}
        <div className="p-4 border-b flex items-center justify-between print:hidden bg-gray-50 rounded-t-xl">
          <h2 className="text-lg font-bold text-primary">
            {isDeliveryInvoice ? "فاتورة التوصيل" : "فاتورة الشراء"}
          </h2>
          <div className="flex gap-2">
            <Button onClick={handlePrint} className="gap-2" data-testid="button-print-invoice">
              <Printer className="h-4 w-4" />
              طباعة
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-invoice">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* محتوى الفاتورة */}
        <div id="invoice-content" className="p-6 print:p-5" dir="rtl">

          {/* ═══ رأس الفاتورة ═══ */}
          <div className="flex items-start justify-between mb-6 pb-5 border-b-2 border-primary">
            <div className="flex items-center gap-4">
              <img src={logoImg} alt="أويو بلاست" className="h-16 w-16 rounded-full object-cover border-2 border-primary/20" />
              <div>
                <h1 className="text-2xl font-black text-primary">أويو بلاست</h1>
                <p className="text-sm text-gray-600">لطباعة ومستلزمات التغليف البلاستيكي</p>
                <p className="text-xs text-gray-500">السجل التجاري: 139688</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Phone className="h-3 w-3 text-gray-400" />
                  <span className="text-xs text-gray-500" dir="ltr">+967 774 997 589</span>
                </div>
              </div>
            </div>
            <div className="text-left">
              <div className={`px-4 py-2 rounded-lg text-center ${isDeliveryInvoice ? "bg-primary text-white" : "bg-gray-100"}`}>
                <p className="font-bold text-sm">{isDeliveryInvoice ? "فاتورة توصيل" : "فاتورة مشتريات"}</p>
              </div>
              <p className="text-gray-500 text-xs mt-2 text-left">رقم الفاتورة</p>
              <p className="font-black text-xl text-primary text-left">#{order.id}</p>
              <p className="text-gray-500 text-xs mt-1 text-left">التاريخ والوقت</p>
              <p className="font-medium text-xs text-left">{formatDate(order.createdAt)}</p>
            </div>
          </div>

          {/* ═══ بيانات العميل ═══ */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5">
            <h3 className="font-bold mb-3 text-blue-800 flex items-center gap-2 border-b border-blue-200 pb-2">
              <User className="h-4 w-4" />
              بيانات العميل
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {order.customerName && (
                <div className="col-span-2 flex items-center gap-2">
                  <span className="text-gray-500 shrink-0">الاسم:</span>
                  <span className="font-bold text-gray-800">{order.customerName}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <span className="font-medium" dir="ltr">{order.customerPhone || "-"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 shrink-0">المدينة:</span>
                <span className="font-medium">{order.shippingCity || "-"}</span>
              </div>
              {order.shippingAddress && (
                <div className="col-span-2 flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
                  <span className="font-medium">{order.shippingAddress}</span>
                </div>
              )}
              {mapsUrl && (
                <div className="col-span-2 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                  <MapPin className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="text-green-700 text-xs font-medium">موقع العميل على الخريطة:</span>
                  <span className="text-green-600 text-xs font-mono break-all" dir="ltr">{mapsUrl}</span>
                </div>
              )}
            </div>
          </div>

          {/* ═══ ملخص الطلب - المنتجات ═══ */}
          {orderItems && orderItems.length > 0 && (
            <div className="mb-5">
              <h3 className="font-bold mb-3 text-gray-800 flex items-center gap-2 border-b pb-2">
                <Package className="h-4 w-4" />
                ملخص الطلب
              </h3>
              <div className="overflow-hidden rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 border-b">
                      <th className="text-right py-2.5 px-3 font-semibold text-gray-600">#</th>
                      <th className="text-right py-2.5 px-3 font-semibold text-gray-600">المنتج</th>
                      <th className="text-center py-2.5 px-2 font-semibold text-gray-600">المقاس</th>
                      <th className="text-center py-2.5 px-2 font-semibold text-gray-600">اللون</th>
                      <th className="text-center py-2.5 px-2 font-semibold text-gray-600">الكمية</th>
                      <th className="text-left py-2.5 px-3 font-semibold text-gray-600">السعر</th>
                      <th className="text-left py-2.5 px-3 font-semibold text-gray-600">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderItems.map((item, index) => (
                      <tr key={item.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="py-3 px-3 text-gray-500">{index + 1}</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            {item.productId && (
                              <img
                                src={`/api/products/image/${item.productId}`}
                                alt={item.productName || ""}
                                className="w-10 h-10 rounded-lg object-cover border border-gray-200 shrink-0 print:w-8 print:h-8"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                            )}
                            <div>
                              <p className="font-medium text-gray-800">{item.productName || `منتج #${item.productId}`}</p>
                              {item.customPrinting && (
                                <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">طباعة مخصصة</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="text-center py-3 px-2">
                          {item.selectedSize ? (
                            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-medium">{item.selectedSize}</span>
                          ) : <span className="text-gray-400">-</span>}
                        </td>
                        <td className="text-center py-3 px-2">
                          {item.selectedColor ? (
                            <div className="flex items-center justify-center gap-1">
                              <div
                                className="w-4 h-4 rounded-full border border-gray-300 shrink-0"
                                style={{ backgroundColor: item.selectedColor.startsWith("#") ? item.selectedColor : "transparent" }}
                              />
                              <span className="text-xs">{item.selectedColor.startsWith("#") ? "" : item.selectedColor}</span>
                            </div>
                          ) : <span className="text-gray-400">-</span>}
                        </td>
                        <td className="text-center py-3 px-2 font-bold">{item.quantity}</td>
                        <td className="text-left py-3 px-3 text-gray-600">{formatPrice(item.price)} {currency}</td>
                        <td className="text-left py-3 px-3 font-bold text-primary">
                          {formatPrice(Number(item.price) * item.quantity)} {currency}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══ ملخص المبالغ والدفع والشحن ═══ */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            {/* الدفع والشحن */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <h3 className="font-bold mb-3 text-gray-700 border-b pb-2 text-sm">الدفع والشحن</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">طريقة الدفع:</span>
                  <span className="font-semibold">
                    {paymentMethodLabels[order.paymentMethod || ""] || order.paymentMethod || "-"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">طريقة الشحن:</span>
                  <span className="font-semibold">
                    {order.shippingOption ? (shippingOptionLabels[order.shippingOption] || order.shippingOption) : "-"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">رسوم الشحن:</span>
                  <span className={`font-semibold ${shippingCost === 0 ? "text-green-600" : ""}`}>
                    {shippingCost === 0 ? "مجاني ✓" : `${formatPrice(shippingCost)} ${currency}`}
                  </span>
                </div>
              </div>
            </div>

            {/* إجمالي المبالغ */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <h3 className="font-bold mb-3 text-gray-700 border-b pb-2 text-sm">الإجمالي</h3>
              <div className="space-y-2 text-sm">
                {subtotalBefore > 0 && discountAmount > 0 && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">السعر قبل الخصم:</span>
                      <span className="line-through text-gray-400">{formatPrice(subtotalBefore)} {currency}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">الخصم:</span>
                      <span className="text-green-600 font-semibold">- {formatPrice(discountAmount)} {currency}</span>
                    </div>
                  </>
                )}
                {depositAmount > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">العربون المدفوع:</span>
                    <span className="font-semibold text-blue-600">{formatPrice(depositAmount)} {currency}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t mt-2">
                  <span className="font-bold text-base">الإجمالي الكلي:</span>
                  <span className="font-black text-lg text-primary">{formatPrice(total)} {currency}</span>
                </div>
                {balanceDue > 0 && (
                  <div className="flex justify-between items-center bg-orange-50 border border-orange-200 rounded-lg px-2 py-1.5 mt-1">
                    <span className="text-orange-700 font-semibold text-xs">المبلغ عند التوصيل:</span>
                    <span className="font-black text-orange-700">{formatPrice(balanceDue)} {currency}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ═══ بيانات المستلم البديل ═══ */}
          {alternateRecipient && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
              <h3 className="font-bold mb-3 text-amber-800 border-b border-amber-300 pb-2 flex items-center gap-2">
                <User className="h-4 w-4" />
                تفاصيل المستلم البديل
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 shrink-0">اسم المستلم:</span>
                  <span className="font-bold text-gray-800">{alternateRecipient.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <span className="font-medium" dir="ltr">{alternateRecipient.phone || "-"}</span>
                </div>
                {alternateRecipient.neighborhood && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 shrink-0">الحي:</span>
                    <span className="font-medium">{alternateRecipient.neighborhood}</span>
                  </div>
                )}
                {alternateRecipient.city && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 shrink-0">المدينة/المحل:</span>
                    <span className="font-medium">{alternateRecipient.city}</span>
                  </div>
                )}
                {alternateRecipient.address && (
                  <div className="col-span-2 flex items-start gap-2">
                    <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
                    <span className="font-medium">{alternateRecipient.address}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ملاحظات (بدون المستلم البديل) */}
          {cleanNotes && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-5">
              <h3 className="font-bold mb-2 text-yellow-800 text-sm">ملاحظات العميل</h3>
              <p className="text-sm text-yellow-700 whitespace-pre-wrap">{cleanNotes}</p>
            </div>
          )}

          {/* ═══ قسم التسليم والتوقيعات ═══ */}
          {isDeliveryInvoice && (
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-5 mb-5">
              <h3 className="font-bold mb-4 text-gray-700 text-center border-b pb-3">إقرار الاستلام والتسليم</h3>

              <div className="grid grid-cols-2 gap-6 mb-5">
                {/* المستلم */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-gray-600 text-center">المستلم</p>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">الاسم:</p>
                    <div className="border-b-2 border-gray-300 pb-1 min-h-[24px]"></div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">التوقيع:</p>
                    <div className="border-b-2 border-gray-300 pb-1 min-h-[40px]"></div>
                  </div>
                </div>

                {/* المندوب */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-gray-600 text-center">مندوب التوصيل</p>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">الاسم:</p>
                    <div className="border-b-2 border-gray-300 pb-1 min-h-[24px]"></div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">التوقيع:</p>
                    <div className="border-b-2 border-gray-300 pb-1 min-h-[40px]"></div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 border-t pt-3 mt-2">
                <span className="text-sm font-semibold text-gray-600 shrink-0">تاريخ التسليم:</span>
                <div className="border-b-2 border-gray-300 flex-1 min-h-[24px]"></div>
                <span className="text-sm font-semibold text-gray-600 shrink-0">الوقت:</span>
                <div className="border-b-2 border-gray-300 w-24 min-h-[24px]"></div>
              </div>
            </div>
          )}

          {/* ═══ تذييل الفاتورة ═══ */}
          <div className="text-center text-xs text-gray-400 pt-4 border-t">
            <p className="font-semibold text-gray-600">شكراً لثقتكم بنا</p>
            <p>أويو بلاست — لطباعة ومستلزمات التغليف البلاستيكي</p>
            <p>معتصم محمد احمد الاهدل &nbsp;|&nbsp; هاتف: <span dir="ltr">+967 774 997 589</span></p>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body, html { background: white; width: 100%; height: 100%; }
          body * { visibility: hidden; }
          #invoice-content, #invoice-content * { visibility: visible !important; }
          #invoice-content {
            position: absolute; left: 0; top: 0; right: 0;
            width: 100%; background: white; padding: 12px; margin: 0;
          }
          .print\\:hidden { display: none !important; }
          table { width: 100%; border-collapse: collapse; }
          td, th { border: 1px solid #ddd; padding: 6px 8px; }
          img { max-width: 32px !important; max-height: 32px !important; }
          .no-print { display: none !important; }
        }
        @page { margin: 0.8cm; size: A4; }
      `}</style>
    </div>
  );
}
