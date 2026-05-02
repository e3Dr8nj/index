const CACHE_NAME = 'taskFlow-v1';
const MODULE_SCOPE = '/modules/taskFlow/';
const ASSETS = ["./index.html","./manifest.json","./megaicon.png"];

// Установка: кэшируем статику
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Активация: чистим старые кэши
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => 
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Запросы: обслуживаем ТОЛЬКО в пределах scope модуля
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  
  // ❌ Пропускаем неподдерживаемые схемы и чужие домены
  if (!['http:', 'https:'].includes(url.protocol)) return;
  if (url.hostname !== location.hostname) return;
  
  // 🔒 ГЛАВНЫЙ ФИКС: игнорируем запросы вне папки модуля
  const pathname = url.pathname;
  if (pathname !== MODULE_SCOPE && !pathname.startsWith(MODULE_SCOPE)) {
    return; // Браузер загрузит оригинал (оболочку / другие модули)
  }
  
  // Стратегия: Cache First, затем Network
  e.respondWith(
    caches.match(e.request).then(cached => {
      const networked = fetch(e.request).then(async res => {
        // Обновляем кэш в фоне
        const cache = await caches.open(CACHE_NAME);
        await cache.put(e.request, res.clone());
        return res;
      }).catch(() => cached);
      
      return cached || networked;
    })
  );
});