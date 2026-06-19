import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { 
  GuestCartItem, 
  getGuestCart, 
  setGuestCart, 
  addToGuestCart 
} from "@/lib/cartUtils";

// GET /api/cart
export function useCart() {
  const { isAuthenticated } = useAuth();
  
  return useQuery({
    queryKey: isAuthenticated ? [api.cart.list.path] : ["guestCart"],
    queryFn: async () => {
      if (!isAuthenticated) return getGuestCart() as any[];
      const res = await fetch(api.cart.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch cart");
      return api.cart.list.responses[200].parse(await res.json());
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// Hook to get guest cart count
export function useGuestCartCount(): number {
  const cart = getGuestCart();
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

// POST /api/cart - with guest fallback
export function useAddToCart() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();

  return useMutation({
    mutationFn: async (data: z.infer<typeof api.cart.add.input>) => {
      // Add to guest cart only if not authenticated
      if (!isAuthenticated) {
        addToGuestCart({
          productId: data.productId,
          quantity: data.quantity,
          selectedSize: data.selectedSize,
          selectedColor: data.selectedColor,
          customPrinting: data.customPrinting,
          designNotes: data.designNotes,
          designFileUrl: data.designFileUrl,
          selectedBagColor: data.selectedBagColor,
          printColor1: data.printColor1,
          printColor2: data.printColor2,
          printColor3: data.printColor3,
          printColorCount: data.printColorCount,
          unitPrice: data.unitPrice,
          designOptions: (data as any).designOptions,
        });
        return { success: true, guest: true };
      }
      
      // Retry logic for authenticated users (up to 3 attempts)
      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const controller = new AbortController();
          // 30 second timeout for large file uploads
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          const res = await fetch(api.cart.add.path, {
            method: api.cart.add.method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
            credentials: "include",
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (res.ok) {
            return api.cart.add.responses[201].parse(await res.json());
          }

          // If server error, retry
          if (res.status >= 500 && attempt < 3) {
            await new Promise(r => setTimeout(r, 500 * attempt)); // Exponential backoff
            continue;
          }

          // On final failure, fallback to guest cart
          throw new Error(`Server error: ${res.status}`);
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          
          // If last attempt or network error, fallback
          if (attempt === 3) break;
          
          // Wait before retry
          await new Promise(r => setTimeout(r, 500 * attempt));
        }
      }

      // For authenticated users: throw error — do NOT silently fallback to guest cart
      throw lastError ?? new Error("فشل الاتصال بالخادم بعد عدة محاولات");
    },
    onSuccess: (result: unknown) => {
      const isGuest = !!(result && typeof result === "object" && "guest" in result && (result as any).guest);
      const isFallback = !!(result && typeof result === "object" && "fallback" in result && (result as any).fallback);
      
      // For guest cart: set data directly into cache (localStorage doesn't trigger re-query automatically)
      if (isGuest) {
        queryClient.setQueryData(['guestCart'], getGuestCart());
      }
      // Always invalidate both to ensure freshness
      queryClient.invalidateQueries({ queryKey: ['guestCart'] });
      queryClient.invalidateQueries({ queryKey: [api.cart.list.path] });
      
      if (isFallback) {
        toast({
          title: "⚠️ تم الحفظ محلياً",
          description: "سيتم مزامنة الطلب عند تسجيل الدخول",
          variant: "default"
        });
      } else {
        toast({
          title: "✅ تمت الإضافة للسلة",
          description: isGuest
            ? "سجّل دخولك لإتمام الطلب"
            : "تمت إضافة المنتج بنجاح",
        });
      }
    },
    onError: (error: Error) => {
      console.error('❌ Cart mutation error:', error);
      toast({
        title: "❌ خطأ في الإضافة",
        description: error.message || "فشل إضافة المنتج. تأكد من الاتصال بالإنترنت وحاول مرة أخرى",
        variant: "destructive"
      });
    }
  });
}

// PATCH /api/cart/:id
export function useUpdateCartItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, quantity }: { id: number; quantity: number }) => {
      const url = buildUrl(api.cart.update.path, { id });
      const res = await fetch(url, {
        method: api.cart.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update cart");
      return api.cart.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.cart.list.path] });
    },
  });
}

// DELETE /api/cart/:id
export function useRemoveFromCart() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.cart.delete.path, { id });
      const res = await fetch(url, { 
        method: api.cart.delete.method,
        credentials: "include" 
      });
      if (!res.ok) throw new Error("Failed to remove item");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.cart.list.path] });
      toast({
        title: "تم الحذف",
        description: "تم حذف المنتج من السلة",
      });
    },
  });
}
