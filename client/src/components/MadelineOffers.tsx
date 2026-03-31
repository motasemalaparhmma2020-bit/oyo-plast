import { CheckCircle, Truck } from "lucide-react";

interface Offer {
  id: number;
  title: string;
  description: string;
  icon?: string;
}

interface MadelineOffersProps {
  offers: Offer[];
  accentColor: string;
  isLoading?: boolean;
}

const defaultOffers = [
  {
    id: 1,
    title: "شحن مجاني",
    description: "مؤهل للحصول على",
    icon: "check",
  },
  {
    id: 2,
    title: "شحن سريع",
    description: "مستتوع محلي",
    icon: "truck",
  },
];

export function MadelineOffers({
  offers = [],
  accentColor,
  isLoading,
}: MadelineOffersProps) {
  const displayOffers = offers.length > 0 ? offers : defaultOffers;

  if (isLoading) {
    return <div className="h-20 bg-gray-100 animate-pulse" />;
  }

  return (
    <div className="w-full py-6 px-4" style={{ backgroundColor: `${accentColor}15` }}>
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 gap-4">
          {displayOffers.map((offer, index) => (
            <div
              key={offer.id}
              className="bg-white dark:bg-gray-800 rounded-lg p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow"
              data-testid={`offer-${offer.id}`}
            >
              <div
                className="flex-shrink-0 p-2 rounded-lg"
                style={{ backgroundColor: accentColor }}
              >
                {offer.icon === "truck" ? (
                  <Truck className="w-5 h-5 text-white" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-white" />
                )}
              </div>
              <div className="flex-1 text-right" dir="rtl">
                <h3
                  className="font-bold text-gray-900 dark:text-white"
                  data-testid={`text-offer-title-${offer.id}`}
                >
                  {offer.title}
                </h3>
                <p
                  className="text-xs text-gray-500 dark:text-gray-400"
                  data-testid={`text-offer-desc-${offer.id}`}
                >
                  {offer.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
