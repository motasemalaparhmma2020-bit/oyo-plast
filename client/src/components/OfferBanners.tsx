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
  height = 72,
}: OfferBannersProps) {
  return (
    <div
      className="grid grid-cols-2 gap-2 px-4 py-2 w-full"
      data-testid="offer-banners"
    >
      {offers.map((offer) => (
        <div
          key={offer.id}
          className={`${offer.backgroundColor} rounded-xl px-3 py-2 flex flex-row items-center gap-2 border border-gray-200 dark:border-gray-700`}
          style={{ minHeight: `${height}px` }}
          data-testid={`offer-${offer.id}`}
        >
          {offer.icon === "truck" ? (
            <Truck className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          ) : (
            <Zap className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
          )}
          <div>
            <h3 className="font-bold text-xs text-gray-900 dark:text-white">
              {offer.title}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {offer.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
