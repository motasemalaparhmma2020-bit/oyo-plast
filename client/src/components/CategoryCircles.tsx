import { Link } from "wouter";

interface Category {
  id: number;
  name: string;
  slug: string;
  imageUrl: string;
  productCount?: number;
}

interface CategoryCirclesProps {
  categories: Category[];
  circleSize?: number;
  perRow?: number;
  maxRows?: number;
  showViewAll?: boolean;
  layout?: "scroll" | "grid";
  rows?: number;
  shape?: "circle" | "rounded";
  borderRadius?: number;
}

export function CategoryCircles({
  categories,
  circleSize = 72,
  perRow = 4,
  layout = "scroll",
  rows = 2,
  shape = "circle",
  borderRadius = 12,
}: CategoryCirclesProps) {
  if (categories.length === 0) return null;

  const shapeRadius = shape === "circle" ? "50%" : `${borderRadius}px`;
  const fontSize = `${Math.max(9, circleSize * 0.13)}px`;
  const itemWidth = circleSize + 16;

  // ─── مكوّن القسم الواحد ─────────────────────────────────────────
  const CategoryItem = ({ category }: { category: Category }) => (
    <Link href={`/category/${category.slug}`}>
      <div
        className="flex flex-col items-center gap-1.5 cursor-pointer group"
        data-testid={`category-circle-${category.id}`}
        style={{ width: `${itemWidth}px` }}
      >
        <div className="relative mx-auto flex-shrink-0">
          <div
            className="overflow-hidden shadow-md group-hover:shadow-lg transition-all group-hover:scale-105 bg-gray-100 dark:bg-gray-800 ring-2 ring-transparent group-hover:ring-primary/30"
            style={{ width: `${circleSize}px`, height: `${circleSize}px`, borderRadius: shapeRadius }}
          >
            {category.imageUrl ? (
              <img
                src={category.imageUrl}
                alt={category.name}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
                data-testid={`category-image-${category.id}`}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold text-lg">
                {category.name.charAt(0)}
              </div>
            )}
          </div>
          {/* شارة عدد المنتجات */}
          {typeof category.productCount === "number" && (
            <span
              className={`absolute -bottom-1 -left-1 text-white text-[9px] font-bold px-1 py-0.5 rounded-full min-w-[16px] text-center leading-none ${
                category.productCount > 0 ? "bg-primary" : "bg-gray-400"
              }`}
              style={{ fontSize: "9px" }}
            >
              {category.productCount > 0 ? category.productCount : "0"}
            </span>
          )}
        </div>
        <p
          className="text-center font-semibold text-gray-800 dark:text-white line-clamp-2 leading-tight w-full"
          style={{ fontSize }}
        >
          {category.name}
        </p>
      </div>
    </Link>
  );

  /* ─────────────────────────────────────────────────────────────────
     وضع الشبكة (grid) — عرض ثابت بعدد صفوف × أعمدة، بدون تمرير
  ───────────────────────────────────────────────────────────────── */
  if (layout === "grid") {
    const cols = perRow || 4;
    const maxVisible = rows * cols;
    const visible = categories.slice(0, maxVisible);

    return (
      <div className="w-full py-3 px-4" data-testid="category-circles">
        <div
          className="grid gap-x-2 gap-y-4"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
          dir="rtl"
        >
          {visible.map((category) => (
            <CategoryItem key={category.id} category={category} />
          ))}
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────────
     وضع السكرول (scroll) — تمرير أفقي بصفوف متعددة
     - rows > 1 : شبكة تتدفق عمودياً وتتحرك يميناً ويساراً
     - rows = 1 : صف أفقي واحد كلاسيكي
     - لا يوجد زر "عرض الكل" — جميع الأقسام مرئية بالتمرير
  ───────────────────────────────────────────────────────────────── */
  if (rows <= 1) {
    /* صف واحد أفقي */
    return (
      <div className="w-full py-3" data-testid="category-circles">
        <div
          className="flex gap-3 px-4 overflow-x-auto scrollbar-hide"
          style={{ WebkitOverflowScrolling: "touch" }}
          dir="rtl"
        >
          {categories.map((category) => (
            <CategoryItem key={category.id} category={category} />
          ))}
        </div>
      </div>
    );
  }

  /* صفوف متعددة — تمرير أفقي
     grid-auto-flow: column يجعل العناصر تملأ الأعمدة من الأعلى للأسفل
     فالأقسام 1..rows تملأ العمود الأول، و rows+1..2rows العمود الثاني، إلخ.
  */
  return (
    <div className="w-full py-3" data-testid="category-circles">
      <div
        className="overflow-x-auto scrollbar-hide px-4"
        style={{ WebkitOverflowScrolling: "touch" }}
        dir="rtl"
      >
        <div
          style={{
            display: "grid",
            gridTemplateRows: `repeat(${rows}, auto)`,
            gridAutoFlow: "column",
            columnGap: "12px",
            rowGap: "12px",
            width: "max-content",
          }}
        >
          {categories.map((category) => (
            <CategoryItem key={category.id} category={category} />
          ))}
        </div>
      </div>
    </div>
  );
}
