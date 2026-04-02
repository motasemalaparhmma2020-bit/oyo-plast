const CACHE_VERSION = 'v1.0.0';
const STATIC_CACHE = `oyo-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `oyo-dynamic-${CACHE_VERSION}`;
const API_CACHE = `oyo-api-${CACHE_VERSION}`;

// Minimal files to cache (lightweight only)
const STATIC_ASSETS = [
  '/manifest.json',
  '/robots.txt'
];

// Install event - cache only lightweight files
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching minimal assets');
        // Use addAll with error handling
        return Promise.allSettled(
          STATIC_ASSETS.map(url => cache.add(url))
        );
      })
      .then(() => {
        console.log('[SW] Installation complete');
        self.skipWaiting();
      })
      .catch((err) => {
        console.warn('[SW] Install warning:', err);
        self.skipWaiting(); // Skip waiting even on error
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.allSettled(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && 
                cacheName !== DYNAMIC_CACHE && 
                cacheName !== API_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Activation complete');
        return self.clients.claim();
      })
  );
});

// Fetch event - network first for everything, cache fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // API calls - network first, fall back to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request, { timeout: 10000 })
        .then((response) => {
          if (!response || response.status !== 200) {
            return response;
          }
          const responseClone = response.clone();
          caches.open(API_CACHE)
            .then((cache) => cache.put(request, responseClone))
            .catch(() => {}); // Ignore cache errors
          return response;
        })
        .catch(() => {
          // Try cache, but don't fail if not there
          return caches.match(request)
            .catch(() => new Response('Offline', { status: 503 }));
        })
    );
    return;
  }

  // Images - cache first
  if (request.destination === 'image') {
    event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) return response;
          return fetch(request)
            .then((response) => {
              if (!response || response.status !== 200) {
                return response;
              }
              const responseClone = response.clone();
              caches.open(DYNAMIC_CACHE)
                .then((cache) => cache.put(request, responseClone))
                .catch(() => {});
              return response;
            })
            .catch(() => {
              // Placeholder SVG
              return new Response(
                '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="#f0f0f0" width="100" height="100"/></svg>',
                { headers: { 'Content-Type': 'image/svg+xml' } }
              );
            });
        })
    );
    return;
  }

  // HTML documents - network first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (!response || response.status !== 200) {
            return response;
          }
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE)
            .then((cache) => cache.put(request, responseClone))
            .catch(() => {});
          return response;
        })
        .catch(() => {
          return caches.match(request)
            .then((response) => response || caches.match('/index.html'))
            .catch(() => new Response('Offline', { status: 503 }));
        })
    );
    return;
  }

  // Default - network first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (!response || response.status !== 200) {
          return response;
        }
        const responseClone = response.clone();
        caches.open(DYNAMIC_CACHE)
          .then((cache) => cache.put(request, responseClone))
          .catch(() => {});
        return response;
      })
      .catch(() => caches.match(request))
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[SW] Service Worker ready');
