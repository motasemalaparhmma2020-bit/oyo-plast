import { useCompare } from "@/hooks/use-compare";
import { Button } from "@/components/ui/button";
import { X, GitCompare, Trash2 } from "lucide-react";
import { useLocation } from "wouter";

export function CompareBar() {
  const { compareItems, removeFromCompare, clearCompare, count } = useCompare();
  const [, setLocation] = useLocation();

  if (count === 0) return null;

  return (
    <div
      className="app-fixed-bar fixed bottom-20 left-0 right-0 z-40 px-3 animate-in slide-in-from-bottom-4 duration-300"
      data-testid="compare-bar"
    >
      <div className="bg-white dark:bg-gray-900 border border-border rounded-2xl shadow-2xl p-3">
        <div className="flex items-center gap-2 mb-2">
          <GitCompare className="h-4 w-4 text-primary" />
          <span className="font-bold text-sm flex-1">
            مقارنة المنتجات ({count}/3)
          </span>
          <button
            onClick={clearCompare}
            className="text-muted-foreground hover:text-destructive transition-colors"
            data-testid="btn-clear-compare"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-2 mb-3">
          {compareItems.map((product) => (
            <div
              key={product.id}
              className="relative flex-1 bg-muted/50 rounded-xl p-1.5 flex flex-col items-center"
              data-testid={`compare-item-${product.id}`}
            >
              <button
                onClick={() => removeFromCompare(product.id)}
                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full h-4 w-4 flex items-center justify-center shadow"
                data-testid={`btn-remove-compare-${product.id}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
              <img
                src={product.imageUrl}
                alt={product.name}
                className="h-12 w-12 object-contain rounded-lg"
              />
              <span className="text-xs font-medium mt-1 text-center line-clamp-1 w-full">
                {product.name}
              </span>
            </div>
          ))}

          {Array.from({ length: 3 - count }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="flex-1 border-2 border-dashed border-muted-foreground/30 rounded-xl flex items-center justify-center h-[76px]"
            >
              <span className="text-xs text-muted-foreground/50">أضف منتجاً</span>
            </div>
          ))}
        </div>

        <Button
          className="w-full gap-2 font-bold"
          onClick={() => setLocation("/compare")}
          disabled={count < 2}
          data-testid="btn-go-compare"
        >
          <GitCompare className="h-4 w-4" />
          {count < 2 ? "أضف منتجاً آخر للمقارنة" : "قارن الآن"}
        </Button>
      </div>
    </div>
  );
}
