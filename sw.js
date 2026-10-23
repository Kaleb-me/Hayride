const CACHE_NAME = 'hayride-tour-v3';

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
          .filter((name) => name.startsWith('hayride-tour-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Safari requests byte ranges for MP3 playback and seeking. The precache holds
// complete files; return a proper 206 response instead of ignoring Range.
async function cachedResponseFor(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request.url);
  if (!cached) return null;
  const range = request.headers.get('range');
  if (!range || !new URL(request.url).pathname.endsWith('.mp3')) return cached;
  const bytes = await cached.arrayBuffer();
  const length = bytes.byteLength;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!match || (!match[1] && !match[2])) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${length}` } });
  }
  const start = match[1] ? Number(match[1]) : Math.max(0, length - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), length - 1) : length - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= length) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${length}` } });
  }
  const headers = new Headers(cached.headers);
  headers.set('Content-Type', 'audio/mpeg');
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Range', `bytes ${start}-${end}/${length}`);
  headers.set('Content-Length', String(end - start + 1));
  return new Response(bytes.slice(start, end + 1), { status: 206, headers });
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cached = await cachedResponseFor(event.request);
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      // Never store a partial response as though it were a complete MP3.
      if (response.status === 200 && !event.request.headers.has('range')) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch (error) {
      return new Response('Offline and not cached.', { status: 503 });
    }
  })());
});
