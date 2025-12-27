import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

// GET /api/products
export function useProducts(categoryId?: string, search?: string) {
  return useQuery({
    queryKey: [api.products.list.path, categoryId, search],
    queryFn: async () => {
      const url = new URL(api.products.list.path, window.location.origin);
      if (categoryId) url.searchParams.append("categoryId", categoryId);
      if (search) url.searchParams.append("search", search);
      
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch products");
      return api.products.list.responses[200].parse(await res.json());
    },
  });
}

// GET /api/products/:id
export function useProduct(id: number) {
  return useQuery({
    queryKey: [api.products.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.products.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch product");
      return api.products.get.responses[200].parse(await res.json());
    },
  });
}

// GET /api/categories
export function useCategories() {
  return useQuery({
    queryKey: [api.categories.list.path],
    queryFn: async () => {
      const res = await fetch(api.categories.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch categories");
      return api.categories.list.responses[200].parse(await res.json());
    },
  });
}

// GET /api/products/bestselling
export function useBestsellingProducts(limit: number = 8) {
  return useQuery({
    queryKey: ["/api/products/bestselling", limit],
    queryFn: async () => {
      const res = await fetch(`/api/products/bestselling?limit=${limit}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch bestselling products");
      return res.json();
    },
  });
}
