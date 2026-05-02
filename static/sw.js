/* Moje Podróże — Service Worker (PWA Etap 2)
 * - Cache statyki (CSS/JS/ikon + Leaflet z CDN) → stale-while-revalidate
 * - /api/* → network-first (świeże dane gdy net, cache fallback offline)
 * - Nawigacja (HTML) → network-first z fallback do cache /
 *
 * UWAGA: ten plik jest serwowany przez endpoint /sw.js w app.py, który
 * wstrzykuje __VERSION__ (mtime statyk) i __APP_SHELL__ (auto-skan static/).
 * Nie edytuj wartości placeholderów ręcznie — wersja i lista plików
 * generują się same przy każdym deployu.
 */
const CACHE_VERSION = '__VERSION__';
const STATIC_CACHE = `travel-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `travel-runtime-${CACHE_VERSION}`;

const APP_SHELL = '__APP_SHELL__';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      // addAll jest atomowe — jak jeden zasób padnie, install się wywali. Cache.add per-item.
      Promise.all(APP_SHELL.map((url) =>
        cache.add(new Request(url, { cache: 'reload' })).catch((err) => {
          console.warn('[SW] precache fail:', url, err);
        })
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys
        .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
        .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Tile mapy OSM, healthz, export bazy — bez cache
  if (url.hostname.endsWith('.tile.openstreetmap.org') ||
      url.pathname === '/healthz' ||
      url.pathname === '/api/export') {
    return;
  }

  // Nawigacja (klik linka, reload) → network-first z fallback do cache /
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNav(request));
    return;
  }

  // /api/* → network-first
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Statyka lokalna + CDN unpkg → stale-while-revalidate
  if (url.origin === self.location.origin && url.pathname.startsWith('/static/')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
  if (url.hostname === 'unpkg.com') {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Reszta — passthrough
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached);
  return cached || fetchPromise;
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function networkFirstNav(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put('/', response.clone());
    }
    return response;
  } catch (err) {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match('/') || await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}
