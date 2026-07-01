// El sufijo del CACHE_NAME lo reemplaza build.js con el hash del bundle — no
// editar a mano. Cada deploy genera un nombre de cache único → invalida el viejo.
const CACHE_NAME = 'salud-__CACHE_VERSION__';
const PRECACHE_URLS = [
  './',
  './index.html',
  './bundle.js',
  './manifest.json',
];

const NETWORK_FIRST_HOSTS = ['googleapis.com', 'accounts.google.com'];

self.addEventListener('install', (event) => {
  // skipWaiting: el SW nuevo toma control inmediatamente sin esperar a que
  // el usuario cierre todas las pestañas del SW anterior.
  self.skipWaiting();
  event.waitUntil(
    // Si el precache falla (p. ej. un recurso 404), no bloqueamos el install:
    // dejar el SW instalado igualmente evita el spinner enganchado.
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
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
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // El Cache API solo acepta http/https. Las extensiones del navegador inyectan
  // requests con scheme chrome-extension:// que reventaban cache.put() con un
  // TypeError. Los ignoramos para no romper el fetch handler.
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;

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
            event.request.method === 'GET' &&
            url.protocol === 'https:'
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
