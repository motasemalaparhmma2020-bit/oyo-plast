import { Link } from "wouter";

interface Category {
  id: number;
  name: string;
  slug: string;
  imageUrl: string;
}

interface CategoryCirclesProps {
  categories: Category[];
  circleSize?: number; // بكسل
}

export function CategoryCircles({
  categories,
  circleSize = 144,
}: CategoryCirclesProps) {
  if (categories.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">لا توجد أقسام</p>
      </div>
    );
  }

  // تقسيم الأقسام إلى صفوف (4 أقسام لكل صف)
  const rows = [];
  for (let i = 0; i < categories.length; i += 4) {
    rows.push(categories.slice(i, i + 4));
  }

  return (
    <div className="w-full px-4 py-6 space-y-6" data-testid="category-circles">
      {rows.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className={`grid gap-4 ${
            row.length === 4
              ? "grid-cols-4"
              : row.length === 3
                ? "grid-cols-3"
                : row.length === 2
                  ? "grid-cols-2"
                  : "grid-cols-1"
          }`}
          data-testid={`category-row-${rowIndex}`}
        >
          {row.map((category) => (
            <Link
              key={category.id}
              href={`/products?category=${category.slug}`}
            >
              <div
                className="flex flex-col items-center gap-2 cursor-pointer group"
                data-testid={`category-circle-${category.id}`}
              >
                {/* الدائرة */}
                <div
                  className="rounded-full overflow-hidden flex-shrink-0 shadow-md group-hover:shadow-lg transition-shadow bg-gray-100 dark:bg-gray-800"
                  style={{
                    width: `${circleSize}px`,
                    height: `${circleSize}px`,
                  }}
                >
                  <img
                    src={category.imageUrl}
                    alt={category.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    data-testid={`category-image-${category.id}`}
                  />
                </div>

                {/* الاسم */}
                <p className="text-center text-xs font-medium text-gray-900 dark:text-white line-clamp-2">
                  {category.name}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}
