const CACHE_NAME = 'assistant-web-v9';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './dino.js',
  './manifest.json',
  './icon.svg'
];

// Установка Service Worker и кэширование ресурсов
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
  );
});

// Активация и очистка старого кэша
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames
        .filter((cache) => cache !== CACHE_NAME)
        .map((cache) => caches.delete(cache))
    )).then(() => self.clients.claim())
  );
});

// Перехват запросов: сначала кэш, затем сеть; для навигации fallback на index.html
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request)
        .then((networkResponse) => {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          return networkResponse;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') return caches.match('./index.html');
          return new Response('', { status: 504, statusText: 'Offline' });
        });
    })
  );
});
