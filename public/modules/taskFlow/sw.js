const CACHE_NAME = 'taskFlow-v1';
const ASSETS = ["./index.html","./manifest.json","./megaicon.png"];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => 
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (!['http:', 'https:'].includes(url.protocol)) return;
  if (url.hostname !== location.hostname) return;
  
  e.respondWith(
    caches.match(e.request).then(cached => {
      const networked = fetch(e.request).then(async res => {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(e.request, res.clone());
        return res;
      }).catch(() => cached);
      return cached || networked;
    })
  );
});