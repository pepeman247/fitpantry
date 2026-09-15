/**
 * FitPantry PRO - Service Worker
 * Offline-First Caching Strategy for Gym Basements
 */

const CACHE_NAME = 'fitpantry-el-green-v2.2';

const ASSETS_TO_PRECACHE = [
  './',
  './index.html',
  './app.js',
  './data_presets.js',
  './styles.css',
  './manifest.json',
  './icons/icon.svg',
  './data/lista_compra_aldi_3dias.csv',
  './data/lista_compra_aldi_5dias.csv',
  './data/plan_mensual_3dias_entrenamiento.csv',
  './data/plan_mensual_5dias_entrenamiento.csv',
  './data/plan_mensual_3dias_nutricion.csv',
  './data/plan_mensual_5dias_nutricion.csv',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest',
  'https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_PRECACHE))
      .then(() => self.skipWaiting())
      .catch((error) => console.warn('[SW] Pre-caching warning:', error))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Stale-while-revalidate for freshness
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
            return networkResponse;
          }
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return networkResponse;
        })
        .catch(() => {
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('./index.html');
          }
        });
    })
  );
});
