import { useState, useEffect, useCallback } from "react";
import { Product } from "@shared/schema";

const MAX_COMPARE = 3;
const STORAGE_KEY = "oyoplast-compare";

function loadFromStorage(): Product[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

let listeners: Array<() => void> = [];
let compareItems: Product[] = loadFromStorage();

function notify() {
  listeners.forEach((fn) => fn());
}

export function useCompare() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const fn = () => forceUpdate((n) => n + 1);
    listeners.push(fn);
    return () => {
      listeners = listeners.filter((l) => l !== fn);
    };
  }, []);

  const addToCompare = useCallback((product: Product) => {
    if (compareItems.find((p) => p.id === product.id)) return;
    if (compareItems.length >= MAX_COMPARE) return;
    compareItems = [...compareItems, product];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(compareItems));
    notify();
  }, []);

  const removeFromCompare = useCallback((productId: number) => {
    compareItems = compareItems.filter((p) => p.id !== productId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(compareItems));
    notify();
  }, []);

  const clearCompare = useCallback(() => {
    compareItems = [];
    localStorage.removeItem(STORAGE_KEY);
    notify();
  }, []);

  const isInCompare = useCallback((productId: number) => {
    return compareItems.some((p) => p.id === productId);
  }, []);

  return {
    compareItems,
    addToCompare,
    removeFromCompare,
    clearCompare,
    isInCompare,
    isFull: compareItems.length >= MAX_COMPARE,
    count: compareItems.length,
  };
}
