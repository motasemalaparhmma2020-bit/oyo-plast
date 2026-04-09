import { Link } from "wouter";
import { ChevronLeft } from "lucide-react";

interface Category {
  id: number;
  name: string;
  slug: string;
  imageUrl: string;
}

interface CategoryCirclesProps {
  categories: Category[];
  circleSize?: number;
  perRow?: number;
  maxRows?: number;
  showViewAll?: boolean;
  layout?: "scroll" | "grid";
  rows?: number;
}

export function CategoryCircles({
  categories,
  circleSize = 72,
  showViewAll = true,
  layout = "scroll",
  rows = 2,
}: CategoryCirclesProps) {
  if (categories.length === 0) return null;

  const itemsPerRow = 4;

  /* ── وضع الشبكة (grid) — صفوف ثابتة ── */
  if (layout === "grid") {
    const maxItems = rows * itemsPerRow;
    const visible = categories.slice(0, maxItems);
    const hasMore = categories.length > maxItems;

    return (
      <div className="w-full py-3 px-4" data-testid="category-circles">
        <div
          className="grid gap-x-3 gap-y-4"
          style={{ gridTemplateColumns: `repeat(${itemsPerRow}, 1fr)` }}
          dir="rtl"
        >
          {visible.map((category) => (
            <Link key={category.id} href={`/category/${category.slug}`}>
              <div
                className="flex flex-col items-center gap-1.5 cursor-pointer group"
                data-testid={`category-circle-${category.id}`}
              >
                <div
                  className="rounded-full overflow-hidden flex-shrink-0 shadow-md group-hover:shadow-lg transition-all group-hover:scale-105 bg-gray-100 dark:bg-gray-800 ring-2 ring-transparent group-hover:ring-primary/30 mx-auto"
                  style={{ width: `${circleSize}px`, height: `${circleSize}px` }}
                >
                  <img
                    src={category.imageUrl}
                    alt={category.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                    data-testid={`category-image-${category.id}`}
                  />
                </div>
                <p
                  className="text-center font-semibold text-gray-800 dark:text-white line-clamp-2 leading-tight w-full"
                  style={{ fontSize: `${Math.max(9, circleSize * 0.13)}px` }}
                >
                  {category.name}
                </p>
              </div>
            </Link>
          ))}

          {/* زر عرض الكل — يظهر فقط إذا توجد أقسام مخفية */}
          {showViewAll && hasMore && (
            <Link href="/categories">
              <div
                className="flex flex-col items-center gap-1.5 cursor-pointer group"
                data-testid="category-view-all"
              >
                <div
                  className="rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 shadow-md group-hover:shadow-lg transition-all group-hover:scale-105 border-2 border-dashed border-gray-300 dark:border-gray-600 mx-auto"
                  style={{ width: `${circleSize}px`, height: `${circleSize}px` }}
                >
                  <ChevronLeft className="h-6 w-6 text-gray-500 group-hover:text-primary transition-colors" />
                </div>
                <p
                  className="text-center font-semibold text-gray-600 dark:text-gray-400 w-full"
                  style={{ fontSize: `${Math.max(9, circleSize * 0.13)}px` }}
                >
                  عرض الكل
                </p>
              </div>
            </Link>
          )}
        </div>
      </div>
    );
  }

  /* ── وضع السكرول (scroll) — صف واحد أفقي متحرك ── */
  return (
    <div className="w-full py-3" data-testid="category-circles">
      <div
        className="flex gap-3 px-4 overflow-x-auto scrollbar-hide"
        style={{ WebkitOverflowScrolling: "touch" }}
        dir="rtl"
      >
        {categories.map((category) => (
          <Link key={category.id} href={`/category/${category.slug}`}>
            <div
              className="flex flex-col items-center gap-1.5 cursor-pointer group flex-shrink-0"
              data-testid={`category-circle-${category.id}`}
              style={{ width: `${circleSize + 8}px` }}
            >
              <div
                className="rounded-full overflow-hidden flex-shrink-0 shadow-md group-hover:shadow-lg transition-all group-hover:scale-105 bg-gray-100 dark:bg-gray-800 ring-2 ring-transparent group-hover:ring-primary/30"
                style={{ width: `${circleSize}px`, height: `${circleSize}px` }}
              >
                <img
                  src={category.imageUrl}
                  alt={category.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                  data-testid={`category-image-${category.id}`}
                />
              </div>
              <p
                className="text-center font-semibold text-gray-800 dark:text-white line-clamp-2 leading-tight"
                style={{ fontSize: `${Math.max(9, circleSize * 0.13)}px`, width: `${circleSize + 8}px` }}
              >
                {category.name}
              </p>
            </div>
          </Link>
        ))}

        {/* زر عرض الكل */}
        {showViewAll && (
          <Link href="/categories">
            <div
              className="flex flex-col items-center gap-1.5 cursor-pointer group flex-shrink-0"
              style={{ width: `${circleSize + 8}px` }}
              data-testid="category-view-all"
            >
              <div
                className="rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 shadow-md group-hover:shadow-lg transition-all group-hover:scale-105 border-2 border-dashed border-gray-300 dark:border-gray-600"
                style={{ width: `${circleSize}px`, height: `${circleSize}px` }}
              >
                <ChevronLeft className="h-6 w-6 text-gray-500 group-hover:text-primary transition-colors" />
              </div>
              <p
                className="text-center font-semibold text-gray-600 dark:text-gray-400"
                style={{ fontSize: `${Math.max(9, circleSize * 0.13)}px` }}
              >
                عرض الكل
              </p>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
