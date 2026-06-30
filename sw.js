const CACHE_NAME = 'salud-v1';
const PRECACHE_URLS = [
  './',
  './index.html',
  './dist/bundle.js',
  './manifest.json',
];

const NETWORK_FIRST_HOSTS = ['googleapis.com', 'accounts.google.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isNetworkFirst = NETWORK_FIRST_HOSTS.some((host) =>
    url.hostname.endsWith(host)
  );

  if (isNetworkFirst) {
    // Network-first: intenta red, cae a cache si falla
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  } else {
    // Cache-first: sirve desde cache, cae a red y actualiza cache
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          // Solo cacheamos respuestas válidas de nuestro propio origen
          if (
            response.ok &&
            response.type === 'basic' &&
            event.request.method === 'GET'
          ) {
            const toCache = response.clone();
            caches.open(CACHE_NAME).then((cache) =>
              cache.put(event.request, toCache)
            );
          }
          return response;
        });
      })
    );
  }
});
