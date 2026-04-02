/**
 * IndexedDB wrapper for offline product storage & order queue.
 * Allows customers to browse, search, and place orders without internet.
 */

const DB_NAME = "oyoplast-offline";
const DB_VERSION = 1;
const STORES = {
  products: "products",
  categories: "categories",
  pendingOrders: "pendingOrders",
  cart: "offlineCart",
  settings: "offlineSettings",
};

let db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const database = (e.target as IDBOpenDBRequest).result;

      if (!database.objectStoreNames.contains(STORES.products)) {
        const store = database.createObjectStore(STORES.products, { keyPath: "id" });
        store.createIndex("categoryId", "categoryId", { unique: false });
        store.createIndex("name", "name", { unique: false });
      }
      if (!database.objectStoreNames.contains(STORES.categories)) {
        database.createObjectStore(STORES.categories, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(STORES.pendingOrders)) {
        database.createObjectStore(STORES.pendingOrders, { keyPath: "id", autoIncrement: true });
      }
      if (!database.objectStoreNames.contains(STORES.cart)) {
        database.createObjectStore(STORES.cart, { keyPath: "id", autoIncrement: true });
      }
      if (!database.objectStoreNames.contains(STORES.settings)) {
        database.createObjectStore(STORES.settings, { keyPath: "key" });
      }
    };

    request.onsuccess = (e) => {
      db = (e.target as IDBOpenDBRequest).result;
      resolve(db);
    };

    request.onerror = (e) => {
      reject((e.target as IDBOpenDBRequest).error);
    };
  });
}

function tx(storeName: string, mode: IDBTransactionMode = "readonly") {
  if (!db) throw new Error("DB not open");
  return db.transaction(storeName, mode).objectStore(storeName);
}

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─── Products ───────────────────────────────────────────────────
export async function saveProductsOffline(products: any[]): Promise<void> {
  await openDB();
  const store = tx(STORES.products, "readwrite");
  for (const p of products) {
    store.put(p);
  }
  // Save timestamp
  const settingsStore = tx(STORES.settings, "readwrite");
  settingsStore.put({ key: "productsCachedAt", value: Date.now() });
}

export async function getProductsOffline(categoryId?: number, search?: string): Promise<any[]> {
  await openDB();
  const store = tx(STORES.products);
  const all: any[] = await promisify(store.getAll());

  let filtered = all;
  if (categoryId) {
    filtered = filtered.filter((p) => p.categoryId === categoryId);
  }
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.tags?.some((t: string) => t.toLowerCase().includes(q))
    );
  }
  return filtered;
}

export async function getProductOffline(id: number): Promise<any | null> {
  await openDB();
  const store = tx(STORES.products);
  return promisify(store.get(id));
}

export async function getProductsCountOffline(): Promise<number> {
  await openDB();
  const store = tx(STORES.products);
  return promisify(store.count());
}

// ─── Categories ─────────────────────────────────────────────────
export async function saveCategoriesOffline(categories: any[]): Promise<void> {
  await openDB();
  const store = tx(STORES.categories, "readwrite");
  for (const c of categories) {
    store.put(c);
  }
}

export async function getCategoriesOffline(): Promise<any[]> {
  await openDB();
  const store = tx(STORES.categories);
  return promisify(store.getAll());
}

// ─── Pending Orders ─────────────────────────────────────────────
export async function savePendingOrder(order: any): Promise<number> {
  await openDB();
  const store = tx(STORES.pendingOrders, "readwrite");
  const result = await promisify(store.add({ ...order, savedAt: Date.now() }));
  return result as number;
}

export async function getPendingOrders(): Promise<any[]> {
  await openDB();
  const store = tx(STORES.pendingOrders);
  return promisify(store.getAll());
}

export async function deletePendingOrder(id: number): Promise<void> {
  await openDB();
  const store = tx(STORES.pendingOrders, "readwrite");
  await promisify(store.delete(id));
}

// ─── Settings cache ──────────────────────────────────────────────
export async function getCachedSetting(key: string): Promise<any> {
  await openDB();
  const store = tx(STORES.settings);
  const result: any = await promisify(store.get(key));
  return result?.value;
}

export async function setCachedSetting(key: string, value: any): Promise<void> {
  await openDB();
  const store = tx(STORES.settings, "readwrite");
  store.put({ key, value });
}

// ─── Check cache freshness ───────────────────────────────────────
export async function isProductCacheFresh(maxAgeMinutes = 60): Promise<boolean> {
  const cachedAt = await getCachedSetting("productsCachedAt");
  if (!cachedAt) return false;
  const ageMs = Date.now() - cachedAt;
  return ageMs < maxAgeMinutes * 60 * 1000;
}

export const offlineDb = {
  saveProductsOffline,
  getProductsOffline,
  getProductOffline,
  getProductsCountOffline,
  saveCategoriesOffline,
  getCategoriesOffline,
  savePendingOrder,
  getPendingOrders,
  deletePendingOrder,
  getCachedSetting,
  setCachedSetting,
  isProductCacheFresh,
};
