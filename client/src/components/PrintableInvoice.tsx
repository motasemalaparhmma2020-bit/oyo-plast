import { Order } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import logoImg from "@assets/FB_IMG_1748731871206_1766877101101.jpg";

interface OrderItem {
  id: number;
  productId: number;
  quantity: number;
  price: string;
  productName?: string;
}

interface PrintableInvoiceProps {
  order: Order;
  orderItems?: OrderItem[];
  isDeliveryInvoice?: boolean;
  onClose: () => void;
}

export default function PrintableInvoice({ order, orderItems, isDeliveryInvoice, onClose }: PrintableInvoiceProps) {
  const formatPrice = (price: string | number | null) => {
    if (!price) return '0';
    return Number(price).toLocaleString('ar-YE');
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('ar-YE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const paymentMethodLabels: Record<string, string> = {
    cash_on_delivery: 'الدفع عند الاستلام',
    karimi: 'الكريمي',
    najm: 'النجم',
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-auto">
      <div className="bg-white max-w-2xl w-full rounded-lg shadow-xl print:shadow-none print:rounded-none print:max-w-none print:w-full">
        <div className="p-4 border-b flex items-center justify-between print:hidden">
          <h2 className="text-lg font-bold">
            {isDeliveryInvoice ? 'فاتورة التوصيل' : 'فاتورة الشراء'}
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

        <div id="invoice-content" className="p-6 print:p-4" dir="rtl">
          <div className="text-center mb-6 pb-4 border-b-2 border-primary">
            <div className="flex justify-center mb-3">
              <img src={logoImg} alt="أويو بلاست" className="h-16 w-16 rounded-full object-cover" />
            </div>
            <h1 className="text-2xl font-bold text-primary">أويو بلاست</h1>
            <p className="text-sm text-gray-600">لطباعة ومستلزمات البلاستيك</p>
            <p className="text-xs text-gray-500 mt-1">السجل التجاري: 139688</p>
            <p className="text-xs text-gray-500">هاتف: 774997589</p>
          </div>

          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-bold mb-1">
                {isDeliveryInvoice ? 'فاتورة توصيل' : 'فاتورة مشتريات'}
              </h2>
              <p className="text-gray-600">رقم الفاتورة: #{order.id}</p>
              <p className="text-gray-600">التاريخ: {formatDate(order.createdAt)}</p>
            </div>
            <div className="text-left">
              {isDeliveryInvoice && (
                <div className="bg-primary/10 px-4 py-2 rounded-lg">
                  <p className="font-bold text-primary text-lg">للتوصيل</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h3 className="font-bold mb-3 text-primary border-b pb-2">بيانات العميل</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">الهاتف:</span>
                <span className="font-medium mr-2" dir="ltr">{order.customerPhone || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500">المدينة:</span>
                <span className="font-medium mr-2">{order.shippingCity || '-'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500">العنوان:</span>
                <span className="font-medium mr-2">{order.shippingAddress || '-'}</span>
              </div>
              {order.gpsCoordinates && (
                <div className="col-span-2">
                  <span className="text-gray-500">إحداثيات GPS:</span>
                  <span className="font-medium mr-2" dir="ltr">{order.gpsCoordinates}</span>
                </div>
              )}
            </div>
          </div>

          {orderItems && orderItems.length > 0 && (
            <div className="mb-6">
              <h3 className="font-bold mb-3 text-primary border-b pb-2">المنتجات</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-100">
                    <th className="text-right py-2 px-2">#</th>
                    <th className="text-right py-2 px-2">المنتج</th>
                    <th className="text-center py-2 px-2">الكمية</th>
                    <th className="text-left py-2 px-2">السعر</th>
                    <th className="text-left py-2 px-2">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {orderItems.map((item, index) => (
                    <tr key={item.id} className="border-b">
                      <td className="py-2 px-2">{index + 1}</td>
                      <td className="py-2 px-2">{item.productName || `منتج #${item.productId}`}</td>
                      <td className="text-center py-2 px-2">{item.quantity}</td>
                      <td className="text-left py-2 px-2">{formatPrice(item.price)} ر.ي</td>
                      <td className="text-left py-2 px-2 font-medium">
                        {formatPrice(Number(item.price) * item.quantity)} ر.ي
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h3 className="font-bold mb-3 text-primary border-b pb-2">ملخص الطلب</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>طريقة الدفع:</span>
                <span className="font-medium">
                  {paymentMethodLabels[order.paymentMethod || ''] || order.paymentMethod || '-'}
                </span>
              </div>
              {order.depositAmount && Number(order.depositAmount) > 0 && (
                <div className="flex justify-between">
                  <span>العربون المدفوع:</span>
                  <span className="font-medium">{formatPrice(order.depositAmount)} ر.ي</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-2 border-t mt-2">
                <span>الإجمالي:</span>
                <span className="text-primary">
                  {formatPrice(order.total)} {order.currency === 'SAR' ? 'ر.س' : 'ر.ي'}
                </span>
              </div>
              {order.paymentMethod === 'cash_on_delivery' && (
                <div className="flex justify-between text-lg font-bold text-green-700">
                  <span>المبلغ المطلوب عند التوصيل:</span>
                  <span>
                    {formatPrice(Number(order.total) - Number(order.depositAmount || 0))} ر.ي
                  </span>
                </div>
              )}
            </div>
          </div>

          {order.notes && (
            <div className="bg-yellow-50 p-4 rounded-lg mb-6">
              <h3 className="font-bold mb-2 text-yellow-800">ملاحظات</h3>
              <p className="text-sm text-yellow-700">{order.notes}</p>
            </div>
          )}

          {isDeliveryInvoice && (
            <div className="border-2 border-dashed border-gray-300 p-4 rounded-lg mb-6">
              <h3 className="font-bold mb-3">توقيع الاستلام</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 mb-8">توقيع المندوب:</p>
                  <div className="border-b border-gray-400"></div>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-8">توقيع العميل:</p>
                  <div className="border-b border-gray-400"></div>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-500">تاريخ التسليم: _______________</p>
              </div>
            </div>
          )}

          <div className="text-center text-xs text-gray-500 pt-4 border-t">
            <p>شكراً لتعاملكم معنا</p>
            <p>أويو بلاست - لطباعة ومستلزمات البلاستيك</p>
            <p>معتصم محمد احمد الاهدل | هاتف: +967774997589</p>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #invoice-content, #invoice-content * {
            visibility: visible;
          }
          #invoice-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
