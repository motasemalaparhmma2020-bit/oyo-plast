import { useQuery } from "@tanstack/react-query";

export interface ItemDisplayConfig {
  showColor: boolean;
  showSize: boolean;
  showBagColor: boolean;
  showPrintColors: boolean;
  showDesignFile: boolean;
  showDesignNotes: boolean;
  mode: "compact" | "collapsible";
}

export interface DisplaySettingsConfig {
  cart: ItemDisplayConfig;
  checkout: ItemDisplayConfig;
  order: ItemDisplayConfig;
}

const DEFAULT: DisplaySettingsConfig = {
  cart: {
    showColor: true, showSize: true, showBagColor: true,
    showPrintColors: true, showDesignFile: true, showDesignNotes: true,
    mode: "compact",
  },
  checkout: {
    showColor: true, showSize: true, showBagColor: true,
    showPrintColors: true, showDesignFile: true, showDesignNotes: true,
    mode: "compact",
  },
  order: {
    showColor: true, showSize: true, showBagColor: true,
    showPrintColors: true, showDesignFile: true, showDesignNotes: true,
    mode: "collapsible",
  },
};

export function useDisplaySettings(): DisplaySettingsConfig {
  const { data } = useQuery<any>({
    queryKey: ["/api/display-settings"],
    staleTime: 60_000,
  });

  if (!data) return DEFAULT;

  return {
    cart: {
      showColor: data.cartShowColor ?? true,
      showSize: data.cartShowSize ?? true,
      showBagColor: data.cartShowBagColor ?? true,
      showPrintColors: data.cartShowPrintColors ?? true,
      showDesignFile: data.cartShowDesignFile ?? true,
      showDesignNotes: data.cartShowDesignNotes ?? true,
      mode: (data.cartItemMode ?? "compact") as "compact" | "collapsible",
    },
    checkout: {
      showColor: data.checkoutShowColor ?? true,
      showSize: data.checkoutShowSize ?? true,
      showBagColor: data.checkoutShowBagColor ?? true,
      showPrintColors: data.checkoutShowPrintColors ?? true,
      showDesignFile: data.checkoutShowDesignFile ?? true,
      showDesignNotes: data.checkoutShowDesignNotes ?? true,
      mode: (data.checkoutItemMode ?? "compact") as "compact" | "collapsible",
    },
    order: {
      showColor: data.orderShowColor ?? true,
      showSize: data.orderShowSize ?? true,
      showBagColor: data.orderShowBagColor ?? true,
      showPrintColors: data.orderShowPrintColors ?? true,
      showDesignFile: data.orderShowDesignFile ?? true,
      showDesignNotes: data.orderShowDesignNotes ?? true,
      mode: (data.orderItemMode ?? "collapsible") as "compact" | "collapsible",
    },
  };
}
