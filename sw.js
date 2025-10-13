/* sw.js — network-only pass-through (no CacheStorage, no offline) */
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    if ('caches' in self) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request, { cache: 'no-store' }).catch(() =>
    new Response('Offline. This PWA intentionally does not cache.', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    })
  ));
});
