import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface Category {
  id: number;
  name: string;
  imageUrl: string;
  slug: string;
}

interface MadelineCategoriesGridProps {
  categories: Category[];
  primaryColor: string;
  isLoading?: boolean;
}

export function MadelineCategoriesGrid({
  categories,
  primaryColor,
  isLoading,
}: MadelineCategoriesGridProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } =
        scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [categories]);

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 300;
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
      setTimeout(checkScroll, 300);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: primaryColor }}></div>
      </div>
    );
  }

  if (!categories.length) {
    return <div className="text-center py-12 text-gray-400">لا توجد أقسام</div>;
  }

  return (
    <div className="w-full py-8 px-4 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 px-4">
          <h2
            className="text-2xl font-bold"
            style={{ color: primaryColor }}
            data-testid="heading-categories"
          >
            الأقسام
          </h2>
        </div>

        {/* Carousel Container */}
        <div className="relative group">
          {/* Left Arrow */}
          {canScrollLeft && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 rounded-full shadow-lg hover:shadow-xl transition-all"
              style={{ backgroundColor: primaryColor, color: "white" }}
              onClick={() => scroll("left")}
              data-testid="button-categories-prev"
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
          )}

          {/* Right Arrow */}
          {canScrollRight && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 rounded-full shadow-lg hover:shadow-xl transition-all"
              style={{ backgroundColor: primaryColor, color: "white" }}
              onClick={() => scroll("right")}
              data-testid="button-categories-next"
            >
              <ChevronRight className="w-6 h-6" />
            </Button>
          )}

          {/* Grid Carousel */}
          <div
            ref={scrollContainerRef}
            className="flex gap-6 px-16 overflow-x-auto scroll-smooth scrollbar-hide pb-2"
            onScroll={checkScroll}
            data-testid="carousel-categories"
          >
            {categories.map((category) => (
              <Link key={category.id} href={`/products?category=${category.slug}`}>
                <a className="flex flex-col items-center gap-3 flex-shrink-0 group cursor-pointer">
                  {/* Circular Image */}
                  <div className="w-24 h-24 rounded-full bg-white shadow-md overflow-hidden flex-shrink-0 border-4 border-gray-100 dark:border-gray-800 group-hover:shadow-lg transition-shadow">
                    <img
                      src={category.imageUrl}
                      alt={category.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                      data-testid={`img-category-${category.id}`}
                    />
                  </div>
                  {/* Category Name */}
                  <p
                    className="text-sm font-semibold text-center text-gray-800 dark:text-gray-200 max-w-[100px]"
                    data-testid={`text-category-${category.id}`}
                  >
                    {category.name}
                  </p>
                </a>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
