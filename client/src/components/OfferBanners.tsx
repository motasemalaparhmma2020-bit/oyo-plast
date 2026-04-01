import { Truck, Zap } from "lucide-react";

interface OfferBanner {
  id: number;
  title: string;
  description: string;
  icon: "truck" | "zap";
  backgroundColor: string;
}

interface OfferBannersProps {
  offers?: OfferBanner[];
  height?: number;
}

export function OfferBanners({
  offers = [
    {
      id: 1,
      title: "شحن مجاني",
      description: "احصل على شحن مجاني على جميع الطلبات",
      icon: "truck",
      backgroundColor: "bg-green-50 dark:bg-green-900/20",
    },
    {
      id: 2,
      title: "عروض سريعة",
      description: "تخفيضات كبيرة على المنتجات المختارة",
      icon: "zap",
      backgroundColor: "bg-yellow-50 dark:bg-yellow-900/20",
    },
  ],
  height = 144,
}: OfferBannersProps) {
  return (
    <div
      className="grid grid-cols-2 gap-3 px-4 py-3 w-full"
      data-testid="offer-banners"
    >
      {offers.map((offer) => (
        <div
          key={offer.id}
          className={`${offer.backgroundColor} rounded-xl p-4 flex flex-col items-start justify-center border border-gray-200 dark:border-gray-700`}
          style={{ minHeight: `${height}px` }}
          data-testid={`offer-${offer.id}`}
        >
          <div className="flex items-center gap-3 mb-2">
            {offer.icon === "truck" ? (
              <Truck className="w-6 h-6 text-green-600 dark:text-green-400" />
            ) : (
              <Zap className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            )}
            <h3 className="font-bold text-sm text-gray-900 dark:text-white">
              {offer.title}
            </h3>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 text-right">
            {offer.description}
          </p>
        </div>
      ))}
    </div>
  );
}
