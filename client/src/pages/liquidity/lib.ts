export interface LiquiditySource {
  id: string;
  name: string;
  kind: "bank" | "wallet" | "treasury";
  balance: number;
  icon: string;
}

export interface OrderRow {
  id: number;
  code: string;
  customerName: string;
  city: string;
  total: number;
  currency: string;
  status: string;
  statusLabel: string;
  statusTone: string;
  itemCount: number;
  createdAt: string;
}

export interface LiquidityData {
  generatedAt: string;
  isPlaceholderLiquidity: boolean;
  liquiditySources: LiquiditySource[];
  orders: {
    list: OrderRow[];
    stats: { total: number; delivered: number; processing: number; byStatus: Record<string, number> };
    error?: boolean;
  };
  sales: {
    today: number;
    yesterday: number;
    allTime: number;
    topProducts: { name: string; qty: number; total: number }[];
    error?: boolean;
  };
  suppliers: {
    count: number;
    totalDue: number;
    list: { name: string; totalSales: number; balanceDue: number; totalPaid: number }[];
    error?: boolean;
  };
  inventory: {
    lowStockCount: number;
    lowStock: { name: string; stock: number; reorderPoint: number }[];
    error?: boolean;
  };
  credit: {
    lateCount: number;
    lateCustomers: { name: string; ordersCount: number; amount: number }[];
    error?: boolean;
  };
}

export function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function currencyLabel(c: string): string {
  return c === "SAR" ? "ر.س" : "ر.ي";
}

export function relativeTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  const isYest = d.toDateString() === yest.toDateString();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (sameDay) return `اليوم — ${hh}:${mm}`;
  if (isYest) return `أمس — ${hh}:${mm}`;
  return `${d.getDate()}/${d.getMonth() + 1} — ${hh}:${mm}`;
}
