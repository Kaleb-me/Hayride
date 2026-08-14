const CACHE_NAME = 'hayride-tour-v1';

const PRECACHE_URLS = [
  './',
  './index.html',
  './farmlogo.png',
  './audios/background.mp3',
  './audios/audio1.mp3',
  './audios/audio2.mp3',
  './audios/audio3.mp3',
  './audios/audio4.mp3',
  './audios/audio5.mp3'
];

// Install: pre-cache everything needed for the tour to run fully offline
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch: cache-first (so GPS lookups don't get slowed by network attempts,
// and everything works with zero signal in the field)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // No cache, no network — nothing more we can do for this request
          return new Response('Offline and not cached.', { status: 503 });
        });
    })
  );
});