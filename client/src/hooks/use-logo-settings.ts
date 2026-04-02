import { useQuery } from "@tanstack/react-query";

export interface LogoSettings {
  id?: number;
  logoUrl: string | null;
  splashBgUrl: string | null;
  splashBgColor: string;
  splashText: string;
  splashTextColor: string;
  showSplash: boolean;
}

export function useLogoSettings() {
  return useQuery<LogoSettings>({
    queryKey: ["/api/logo-settings"],
    queryFn: async () => {
      const res = await fetch("/api/logo-settings");
      if (!res.ok) throw new Error("Failed to fetch logo settings");
      return res.json();
    },
    staleTime: 30000,
    retry: 1,
  });
}
