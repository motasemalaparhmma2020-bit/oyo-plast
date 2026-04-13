import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useMemo } from "react";

// GET /api/products
export function useProducts(categorySlug?: string, search?: string, filter?: string, subcategorySlug?: string) {
  return useQuery({
    queryKey: [api.products.list.path, categorySlug, search, filter, subcategorySlug],
    queryFn: async () => {
      const url = new URL(api.products.list.path, window.location.origin);
      if (categorySlug) url.searchParams.append("category", categorySlug);
      if (search) url.searchParams.append("search", search);
      if (filter) url.searchParams.append("filter", filter);
      if (subcategorySlug) url.searchParams.append("subcategory", subcategorySlug);
      
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to fetch products: ${res.status}`);
      return await res.json();
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

// GET /api/categories
export function useCategories() {
  return useQuery({
    queryKey: [api.categories.list.path],
    queryFn: async () => {
      const res = await fetch(api.categories.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch categories");
      return await res.json();
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useCategoriesAndProducts(categorySlug?: string, search?: string, filter?: string, subcategorySlug?: string) {
  const productsQuery = useProducts(categorySlug, search, filter, subcategorySlug);
  const categoriesQuery = useCategories();
  return useMemo(() => ({
    products: productsQuery.data ?? [],
    categories: categoriesQuery.data ?? [],
    isLoading: productsQuery.isLoading || categoriesQuery.isLoading,
    isFetching: productsQuery.isFetching || categoriesQuery.isFetching,
    error: productsQuery.error || categoriesQuery.error,
  }), [productsQuery.data, categoriesQuery.data, productsQuery.isLoading, categoriesQuery.isLoading, productsQuery.isFetching, categoriesQuery.isFetching, productsQuery.error, categoriesQuery.error]);
}

// GET /api/products/:id
export function useProduct(id: number) {
  return useQuery({
    queryKey: [api.products.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.products.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Failed to fetch product: ${res.status}`);
      return api.products.get.responses[200].parse(await res.json());
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
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
