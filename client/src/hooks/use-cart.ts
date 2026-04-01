import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface GuestCartItem {
  productId: number;
  quantity: number;
  selectedSize?: string;
  selectedColor?: string;
  customPrinting?: boolean;
  designNotes?: string;
  designFileUrl?: string;
}

// Guest cart functions
function getGuestCart(): GuestCartItem[] {
  try {
    const saved = localStorage.getItem('guestCart');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function setGuestCart(cart: GuestCartItem[]): void {
  localStorage.setItem('guestCart', JSON.stringify(cart));
}

function addToGuestCart(item: GuestCartItem): void {
  const cart = getGuestCart();
  
  // For custom printing items, always add as new
  if (item.customPrinting) {
    cart.push(item);
    setGuestCart(cart);
    return;
  }
  
  // Find existing item with same product/size/color
  const existingIdx = cart.findIndex(existing => 
    existing.productId === item.productId &&
    existing.selectedSize === item.selectedSize &&
    existing.selectedColor === item.selectedColor &&
    !existing.customPrinting
  );
  
  if (existingIdx >= 0) {
    cart[existingIdx].quantity += item.quantity;
  } else {
    cart.push(item);
  }
  setGuestCart(cart);
}

// GET /api/cart
export function useCart() {
  const { isAuthenticated } = useAuth();
  
  return useQuery({
    queryKey: isAuthenticated ? [api.cart.list.path] : ['guestCart'],
    queryFn: async () => {
      if (!isAuthenticated) {
        return getGuestCart() as any[];
      }
      const res = await fetch(api.cart.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch cart");
      return api.cart.list.responses[200].parse(await res.json());
    },
    refetchOnWindowFocus: true,
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
      console.log("useAddToCart mutationFn called with data:", data);
      
      // Add to guest cart only if not authenticated
      if (!isAuthenticated) {
        console.log("Adding to guest cart (not authenticated)");
        addToGuestCart({
          productId: data.productId,
          quantity: data.quantity,
          selectedSize: data.selectedSize,
          selectedColor: data.selectedColor,
          customPrinting: data.customPrinting,
          designNotes: data.designNotes,
          designFileUrl: data.designFileUrl
        });
        console.log("Guest cart updated successfully");
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
        addToGuestCart({
          productId: data.productId,
          quantity: data.quantity,
          selectedSize: data.selectedSize,
          selectedColor: data.selectedColor,
          customPrinting: data.customPrinting,
          designNotes: data.designNotes,
          designFileUrl: data.designFileUrl
        });
        return { success: true, guest: true, fallback: true };
      }
      return api.cart.add.responses[201].parse(await res.json());
    },
    onSuccess: (result: unknown) => {
      const isGuest = result && typeof result === 'object' && 'guest' in result && result.guest;
      
      // Always invalidate both keys to ensure UI updates
      queryClient.invalidateQueries({ queryKey: ['guestCart'] });
      queryClient.invalidateQueries({ queryKey: [api.cart.list.path] });
      
      toast({
        title: "✅ تمت الإضافة للسلة",
        description: isGuest
          ? "سجّل دخولك لإتمام الطلب"
          : "تمت إضافة المنتج بنجاح",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ",
        description: "فشل إضافة المنتج للسلة. حاول مرة أخرى",
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
