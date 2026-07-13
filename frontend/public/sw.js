// Service Worker for PoPV
// Network-first for localhost, cache-first for production.
const CACHE_NAME = 'popv-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always bypass cache for localhost, API calls, and Stellar
  if (
    url.hostname === 'localhost' ||
    url.hostname.includes('stellar.org') ||
    url.hostname.includes('popv.quest') ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  // Network-first for all other assets
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
