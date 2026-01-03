import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

// Check if guest mode is active
function isGuestMode(): boolean {
  return localStorage.getItem('guestMode') === 'true';
}

// Guest cart functions
function getGuestCart(): { productId: number; quantity: number }[] {
  try {
    const saved = localStorage.getItem('guestCart');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function setGuestCart(cart: { productId: number; quantity: number }[]): void {
  localStorage.setItem('guestCart', JSON.stringify(cart));
}

function addToGuestCart(productId: number, quantity: number): void {
  const cart = getGuestCart();
  const existingIdx = cart.findIndex(item => item.productId === productId);
  if (existingIdx >= 0) {
    cart[existingIdx].quantity += quantity;
  } else {
    cart.push({ productId, quantity });
  }
  setGuestCart(cart);
}

// GET /api/cart
export function useCart() {
  return useQuery({
    queryKey: [api.cart.list.path],
    queryFn: async () => {
      const res = await fetch(api.cart.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch cart");
      return api.cart.list.responses[200].parse(await res.json());
    },
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
      // Check if user is in guest mode (not authenticated or explicitly set as guest)
      if (!isAuthenticated || isGuestMode()) {
        // Add to guest cart in localStorage
        addToGuestCart(data.productId, data.quantity);
        return { success: true, guest: true };
      }
      
      const res = await fetch(api.cart.add.path, {
        method: api.cart.add.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      
      if (!res.ok) {
        // On API failure for authenticated users, fallback to guest cart
        addToGuestCart(data.productId, data.quantity);
        return { success: true, guest: true, fallback: true };
      }
      return api.cart.add.responses[201].parse(await res.json());
    },
    onSuccess: (result: unknown) => {
      const isGuest = result && typeof result === 'object' && 'guest' in result && result.guest;
      const isFallback = result && typeof result === 'object' && 'fallback' in result && result.fallback;
      
      if (isGuest) {
        queryClient.invalidateQueries({ queryKey: ['guestCart'] });
        toast({
          title: "تمت الإضافة للسلة",
          description: isFallback 
            ? "تمت إضافة المنتج. يمكنك إتمام الشراء من صفحة الشراء كزائر"
            : "تمت إضافة المنتج. يمكنك إتمام الشراء كزائر أو تسجيل الدخول",
        });
      } else {
        queryClient.invalidateQueries({ queryKey: [api.cart.list.path] });
        toast({
          title: "تمت الإضافة للسلة",
          description: "تمت إضافة المنتج بنجاح إلى سلة التسوق الخاصة بك",
        });
      }
    },
    onError: (error: Error, variables) => {
      // On network/unexpected error, fallback to guest cart
      addToGuestCart(variables.productId, variables.quantity);
      toast({
        title: "تمت الإضافة للسلة",
        description: "تمت إضافة المنتج. يمكنك إتمام الشراء من صفحة الشراء كزائر",
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
