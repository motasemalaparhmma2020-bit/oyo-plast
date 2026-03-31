import { useQuery } from "@tanstack/react-query";

export interface HomePageSettings {
  id: number;
  primaryColor: string;
  accentColor: string;
  showHeader: boolean;
  showBanners: boolean;
  showOffers: boolean;
  showCategories: boolean;
  updatedAt: string;
}

export function useHomeSettings() {
  return useQuery<HomePageSettings>({
    queryKey: ["/api/home-settings"],
    queryFn: async () => {
      const res = await fetch("/api/home-settings", { credentials: "include" });
      if (!res.ok) {
        return {
          id: 1,
          primaryColor: "#06B6D4",
          accentColor: "#0891B2",
          showHeader: true,
          showBanners: true,
          showOffers: true,
          showCategories: true,
          updatedAt: new Date().toISOString(),
        };
      }
      return res.json();
    },
  });
}
