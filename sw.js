/* sw.js — network-only pass-through (no CacheStorage, no offline) */

self.addEventListener('install', (event) => {
  // Don’t cache; just activate ASAP
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Belt-and-braces: wipe any legacy caches created by older builds
    if ('caches' in self) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    await self.clients.claim();
  })());
});

// Always fetch from network; avoid caches entirely
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Let non-GET requests pass through unmodified
  if (req.method !== 'GET') return;

  event.respondWith(
    fetch(req, { cache: 'no-store' }).catch(() => {
      // If the network is unavailable, fail fast (no offline fallback by design)
      return new Response('Offline. This PWA intentionally does not cache.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    })
  );
});