import { Heart, Camera, Search, ShoppingBag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface MadelineHeaderProps {
  primaryColor: string;
  cartCount: number;
  onSearch: (query: string) => void;
  onFavClick?: () => void;
}

export function MadelineHeader({
  primaryColor,
  cartCount,
  onSearch,
  onFavClick,
}: MadelineHeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch(searchQuery);
    }
  };

  return (
    <div
      className="w-full py-4 px-4 shadow-sm"
      style={{ backgroundColor: primaryColor }}
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        {/* Left Icons */}
        <div className="flex gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onFavClick}
            className="text-white hover:bg-white/20"
            data-testid="button-favorites"
          >
            <Heart className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            data-testid="button-camera"
          >
            <Camera className="w-5 h-5" />
          </Button>
        </div>

        {/* Center Search */}
        <form onSubmit={handleSearch} className="flex-1 max-w-md">
          <div className="relative">
            <Input
              placeholder="ابحث عن المنتجات..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white/90 placeholder:text-gray-400 pr-10 text-right"
              dir="rtl"
              data-testid="input-search"
            />
            <button
              type="submit"
              className="absolute left-3 top-1/2 -translate-y-1/2"
              data-testid="button-search"
            >
              <Search className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </form>

        {/* Right Cart Icon */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            data-testid="button-cart-header"
          >
            <ShoppingBag className="w-5 h-5" />
          </Button>
          {cartCount > 0 && (
            <span
              className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
              data-testid="badge-cart-count"
            >
              {cartCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
