import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

export interface ImageDimension {
  id: number;
  imageType: string;
  width: number;
  height: number;
  description: string;
}

export function useImageDimensions() {
  return useQuery<ImageDimension[]>({
    queryKey: ["/api/image-dimensions"],
    queryFn: async () => {
      const res = await fetch("/api/image-dimensions");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60000,
  });
}

export function useUpdateImageDimension(adminToken: string | null) {
  return useMutation({
    mutationFn: async (data: { id: number; width: number; height: number; description?: string }) => {
      const res = await fetch(`/api/admin/image-dimensions/${data.id}`, {
        method: "PATCH",
        headers: {
          "x-admin-token": adminToken || "",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update dimensions");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/image-dimensions"] });
    },
  });
}
