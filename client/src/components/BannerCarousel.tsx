import { useEffect, useState } from "react";

interface Banner {
  id: number;
  imageUrl: string;
  title?: string;
  description?: string;
}

interface BannerCarouselProps {
  banners: Banner[];
  height?: number; // في بكسل
}

export function BannerCarousel({ banners, height = 414 }: BannerCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-play carousel
  useEffect(() => {
    if (banners.length === 0) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 5000); // تغيير كل 5 ثوانٍ
    return () => clearInterval(timer);
  }, [banners.length]);

  if (banners.length === 0) {
    return (
      <div
        className="bg-gray-200 dark:bg-gray-800 w-full flex items-center justify-center"
        style={{ height: `${height}px` }}
        data-testid="banner-placeholder"
      >
        <p className="text-gray-500">لا توجد بنرات</p>
      </div>
    );
  }

  const banner = banners[currentIndex];

  return (
    <div
      className="relative w-full overflow-hidden bg-gray-100 dark:bg-gray-900"
      style={{ height: `${height}px` }}
      data-testid="banner-carousel"
    >
      {/* الصورة */}
      <img
        src={banner.imageUrl}
        alt={banner.title || "Banner"}
        className="w-full h-full object-cover transition-opacity duration-500"
        key={currentIndex}
        fetchPriority={currentIndex === 0 ? "high" : "low"}
        loading={currentIndex === 0 ? "eager" : "lazy"}
        decoding="async"
        data-testid={`banner-image-${currentIndex}`}
      />

      {/* مؤشر عدد الصور */}
      {banners.length > 1 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2" data-testid="banner-indicators">
          {banners.map((_, index) => (
            <button
              key={index}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex
                  ? "bg-white w-6"
                  : "bg-white/50 hover:bg-white/75"
              }`}
              onClick={() => setCurrentIndex(index)}
              data-testid={`indicator-${index}`}
              aria-label={`Go to banner ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
