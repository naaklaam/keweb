const CACHE_NAME = 'keweb-pwa-v3';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Drop previous cache versions (e.g. v2 that may hold a stale index.html)
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Never intercept API calls or audio streams; they must stay fresh and keep
  // range-request semantics.
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Navigation (index.html): NETWORK-FIRST so users always get the current
  // index that points to current hashed bundles. A stale index would reference
  // bundle files that no longer exist after a rebuild -> blank screen on
  // phones. Fall back to cache only when offline.
  if (request.mode === 'navigate' || request.headers.get('sec-fetch-dest') === 'document') {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const fresh = await fetch(request);
          if (fresh && fresh.ok) cache.put(request, fresh.clone());
          return fresh;
        } catch (e) {
          const cached = await cache.match(request);
          return cached || Response.error();
        }
      })
    );
    return;
  }

  // Static assets are content-hashed by Vite: safe to serve stale-while-revalidate.
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});