const CACHE_VERSION = "v6";
const CACHE_STATIC  = "oyoplast-static-"  + CACHE_VERSION;
const CACHE_IMAGES  = "oyoplast-images-"  + CACHE_VERSION;
const CACHE_PAGES   = "oyoplast-pages-"   + CACHE_VERSION;
const SYNC_TAG      = "oyoplast-bg-sync";

// موارد تُكاش فوراً عند التثبيت
const PRECACHE_URLS = [
  "/",
  "/products",
  "/manifest.json",
  "/offline.html",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

// ─── التثبيت: كاش الموارد الأساسية ───────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ─── التفعيل: حذف الكاش القديم ────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  const keep = [CACHE_STATIC, CACHE_IMAGES, CACHE_PAGES];
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// ─── Fetch: استراتيجية ذكية حسب نوع الطلب ────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // ── API: الشبكة أولاً — إذا فشلت فالكاش ──
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // كاش استجابات المنتجات والفئات لدعم وضع عدم الاتصال
          if (
            res.ok &&
            (url.pathname.startsWith("/api/products") ||
             url.pathname.startsWith("/api/categories"))
          ) {
            const clone = res.clone();
            caches.open(CACHE_PAGES).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // ── الصور: الكاش أولاً — إذا لم توجد نحملها ونُكاشها ──
  if (
    request.destination === "image" ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/screenshots/")
  ) {
    event.respondWith(
      caches.open(CACHE_IMAGES).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          }).catch(() => cached || new Response("", { status: 404 }));
        })
      )
    );
    return;
  }

  // ── JS/CSS/Fonts: الكاش أولاً ──
  if (
    request.destination === "script" ||
    request.destination === "style"  ||
    request.destination === "font"
  ) {
    event.respondWith(
      caches.open(CACHE_STATIC).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  // ── تنقّل SPA: الشبكة أولاً — عند الفشل نُعيد هيكل التطبيق المخزَّن ──
  // المفتاح: نُفضّل هيكل التطبيق "/" (app shell) قبل offline.html، حتى يُقلِع
  // التطبيق ويعمل التوجيه الداخلي + بيانات المنتجات المخزّنة في IndexedDB.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) caches.open(CACHE_PAGES).then((c) => c.put(request, res.clone()));
          return res;
        })
        .catch(async () => {
          return (
            (await caches.match("/")) ||
            (await caches.match(request)) ||
            (await caches.match("/offline.html")) ||
            new Response("التطبيق غير متصل", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })
          );
        })
    );
    return;
  }

  // ── صفحات/موارد أخرى same-origin: الشبكة أولاً ثم الكاش ──
  if (
    url.origin === self.location.origin &&
    !url.pathname.startsWith("/api/")
  ) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            caches.open(CACHE_PAGES).then((c) => c.put(request, res.clone()));
          }
          return res;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match("/"))
        )
    );
  }
});

// ─── Background Sync: إرسال طلبات مؤجّلة عند عودة الإنترنت ──────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(flushPendingRequests());
  }
});

async function flushPendingRequests() {
  try {
    const db  = await openDB();
    const reqs = await getAllPending(db);
    for (const req of reqs) {
      try {
        await fetch(req.url, {
          method:  req.method,
          headers: req.headers,
          body:    req.body,
        });
        await deletePending(db, req.id);
      } catch {}
    }
  } catch {}
}

// ── IndexedDB helpers (مبسّطة) ─────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("oyoplast-sync", 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore("pending", { keyPath: "id", autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}
function getAllPending(db) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction("pending", "readonly");
    const req = tx.objectStore("pending").getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = () => reject(req.error);
  });
}
function deletePending(db, id) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction("pending", "readwrite");
    const req = tx.objectStore("pending").delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

// ─── Push Notifications ───────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = { title: "أويو بلاست", body: "لديك إشعار جديد", icon: "/icons/icon-192x192.png" };
  try { data = { ...data, ...event.data.json() }; } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:  data.body,
      icon:  data.icon  || "/icons/icon-192x192.png",
      badge: "/icons/icon-96x96.png",
      dir:   "rtl",
      lang:  "ar",
      tag:   "oyoplast-notif",
      renotify: true,
      data:  { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(target);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(target);
    })
  );
});

// ─── رسائل من الصفحة ─────────────────────────────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
