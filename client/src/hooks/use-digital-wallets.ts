import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

export interface DigitalWallet {
  id: number;
  name: string;
  logoUrl: string | null;
  receiverName: string;
  phoneNumber: string;
  purchaseCode: string;
  isActive: boolean;
  sortOrder: number;
  requiresProof?: boolean;
  instructions?: string | null;
}

export function useDigitalWallets() {
  return useQuery<DigitalWallet[]>({
    queryKey: ["/api/digital-wallets"],
    queryFn: async () => {
      const res = await fetch("/api/digital-wallets");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30000,
  });
}

export function useUpdateDigitalWallet(adminToken: string | null) {
  return useMutation({
    mutationFn: async (data: Partial<DigitalWallet> & { id: number; logo?: File }) => {
      const formData = new FormData();
      formData.append("name", data.name || "");
      formData.append("receiverName", data.receiverName || "");
      formData.append("phoneNumber", data.phoneNumber || "");
      formData.append("purchaseCode", data.purchaseCode || "");
      formData.append("isActive", String(data.isActive ?? true));
      formData.append("sortOrder", String(data.sortOrder ?? 0));
      if (data.logo) {
        formData.append("logo", data.logo);
      }

      const res = await fetch(`/api/admin/digital-wallets/${data.id}`, {
        method: "PATCH",
        headers: { "x-admin-token": adminToken || "" },
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to update wallet");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/digital-wallets"] });
    },
  });
}

export function useCreateDigitalWallet(adminToken: string | null) {
  return useMutation({
    mutationFn: async (data: Omit<DigitalWallet, "id"> & { logo?: File }) => {
      const formData = new FormData();
      formData.append("name", data.name);
      formData.append("receiverName", data.receiverName);
      formData.append("phoneNumber", data.phoneNumber);
      formData.append("purchaseCode", data.purchaseCode);
      formData.append("isActive", String(data.isActive ?? true));
      formData.append("sortOrder", String(data.sortOrder ?? 0));
      if (data.logo) {
        formData.append("logo", data.logo);
      }

      const res = await fetch("/api/admin/digital-wallets", {
        method: "POST",
        headers: { "x-admin-token": adminToken || "" },
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to create wallet");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/digital-wallets"] });
    },
  });
}

export function useDeleteDigitalWallet(adminToken: string | null) {
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/digital-wallets/${id}`, {
        method: "DELETE",
        headers: { "x-admin-token": adminToken || "" },
      });
      if (!res.ok) throw new Error("Failed to delete wallet");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/digital-wallets"] });
    },
  });
}
