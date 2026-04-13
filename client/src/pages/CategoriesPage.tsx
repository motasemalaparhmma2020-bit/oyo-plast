import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CategoriesPage() {
  const { data: categories = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const active = categories.filter((c: any) => c.isActive);
  const circleSize = 80;

  return (
    <div className="pb-24 min-h-screen bg-white dark:bg-background" dir="rtl">
      <div className="sticky top-0 z-40 bg-white dark:bg-card border-b px-4 py-3 flex items-center gap-3">
        <Link href="/">
          <Button variant="ghost" size="icon" className="rounded-full h-9 w-9" data-testid="button-back">
            <ArrowRight className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-lg font-bold flex-1 text-center pr-9">جميع الأقسام</h1>
      </div>

      <div className="p-4">
        {isLoading ? (
          <div className="grid grid-cols-4 gap-4">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-full bg-gray-100 animate-pulse" />
                <div className="w-12 h-2 bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4">
            {active.map((category: any) => (
              <Link key={category.id} href={`/category/${encodeURIComponent((category.slug || "").trim())}`}>
                <div
                  className="flex flex-col items-center gap-1.5 cursor-pointer group"
                  data-testid={`cat-all-${category.id}`}
                >
                  <div
                    className="rounded-full overflow-hidden shadow-md group-hover:shadow-lg transition-all group-hover:scale-105 bg-gray-100 ring-2 ring-transparent group-hover:ring-primary/30"
                    style={{ width: `${circleSize}px`, height: `${circleSize}px` }}
                  >
                    <img
                      src={category.imageUrl}
                      alt={category.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <p className="text-center font-semibold text-gray-800 dark:text-white text-xs line-clamp-2 leading-tight">
                    {category.name}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
