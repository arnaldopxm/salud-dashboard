// CACHE_VERSION se reemplaza en build con el hash del bundle — no editar a mano.
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
  // cierren todas las pestañas del SW anterior.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', (event) => {
  // Limpia todas las caches antiguas (cualquier nombre distinto al actual).
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
  const isNetworkFirst = NETWORK_FIRST_HOSTS.some((host) =>
    url.hostname.endsWith(host)
  );

  if (isNetworkFirst) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  } else {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
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
