import { Link } from "wouter";

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
}

export function CategoryCircles({
  categories,
  circleSize = 72,
  perRow = 4,
}: CategoryCirclesProps) {
  if (categories.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">لا توجد أقسام</p>
      </div>
    );
  }

  const rows = [];
  for (let i = 0; i < categories.length; i += perRow) {
    rows.push(categories.slice(i, i + perRow));
  }

  const gridCols: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
    5: "grid-cols-5",
    6: "grid-cols-6",
  };

  return (
    <div className="w-full px-4 py-4 space-y-4" data-testid="category-circles">
      {rows.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className={`grid gap-3 ${gridCols[row.length] || "grid-cols-4"}`}
          data-testid={`category-row-${rowIndex}`}
        >
          {row.map((category) => (
            <Link
              key={category.id}
              href={`/products?category=${category.slug}`}
            >
              <div
                className="flex flex-col items-center gap-1 cursor-pointer group"
                data-testid={`category-circle-${category.id}`}
              >
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
                <p
                  className="text-center font-medium text-gray-900 dark:text-white line-clamp-2"
                  style={{ fontSize: `${Math.max(9, circleSize * 0.13)}px` }}
                >
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
