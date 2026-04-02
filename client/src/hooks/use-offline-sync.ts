import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  saveProductsOffline,
  saveCategoriesOffline,
  getPendingOrders,
  deletePendingOrder,
  isProductCacheFresh,
} from "@/lib/offlineDb";

/**
 * useOfflineSync:
 * - Caches products and categories in IndexedDB on first load
 * - Syncs pending offline orders when internet is restored
 */
export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncedCount, setSyncedCount] = useState(0);
  const hasCached = useRef(false);
  const queryClient = useQueryClient();

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingOrders();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Cache products and categories when online
  useEffect(() => {
    if (!isOnline || hasCached.current) return;
    cacheData();
  }, [isOnline]);

  async function cacheData() {
    if (hasCached.current) return;
    try {
      const fresh = await isProductCacheFresh(120); // 2 hours
      if (fresh) {
        hasCached.current = true;
        return;
      }

      // Fetch ALL products for offline storage
      const [productsRes, categoriesRes] = await Promise.all([
        fetch("/api/products", { credentials: "include" }),
        fetch("/api/categories", { credentials: "include" }),
      ]);

      if (productsRes.ok) {
        const products = await productsRes.json();
        await saveProductsOffline(products);
        console.log(`[Offline] Cached ${products.length} products`);
      }

      if (categoriesRes.ok) {
        const categories = await categoriesRes.json();
        await saveCategoriesOffline(categories);
        console.log(`[Offline] Cached ${categories.length} categories`);
      }

      hasCached.current = true;
    } catch (err) {
      console.warn("[Offline] Cache failed:", err);
    }
  }

  async function syncPendingOrders() {
    try {
      const pending = await getPendingOrders();
      if (pending.length === 0) return;

      setIsSyncing(true);
      const res = await fetch("/api/sync/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders: pending }),
      });

      if (res.ok) {
        const data = await res.json();
        const syncedIds = data.results
          .filter((r: any) => r.success)
          .map((r: any) => r.localId);

        // Delete synced orders from pending
        for (const order of pending) {
          if (syncedIds.includes(order.localId)) {
            await deletePendingOrder(order.id);
          }
        }

        setSyncedCount(data.synced);
        queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
        console.log(`[Offline] Synced ${data.synced} orders`);
      }
    } catch (err) {
      console.warn("[Offline] Sync failed:", err);
    } finally {
      setIsSyncing(false);
    }
  }

  return { isOnline, isSyncing, syncedCount, syncPendingOrders, cacheData };
}
