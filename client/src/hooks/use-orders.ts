import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

// POST /api/orders
export function useCreateOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.orders.create.path, {
        method: api.orders.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create order");
      return api.orders.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.cart.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.orders.list.path] });
      toast({
        title: "تم الطلب بنجاح",
        description: "شكراً لتسوقك معنا! جاري معالجة طلبك.",
      });
      setLocation("/profile");
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "فشل إتمام الطلب. يرجى المحاولة مرة أخرى.",
        variant: "destructive",
      });
    }
  });
}

// GET /api/orders
export function useOrders() {
  return useQuery({
    queryKey: [api.orders.list.path],
    queryFn: async () => {
      const res = await fetch(api.orders.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch orders");
      return api.orders.list.responses[200].parse(await res.json());
    },
  });
}
