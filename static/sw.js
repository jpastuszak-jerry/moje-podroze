/* Moje Podróże — Service Worker (PWA Etap 2 + 3)
 * Statyka:
 *   - /static/* + Leaflet CDN → stale-while-revalidate
 *   - Nawigacja (HTML)        → network-first, fallback do cache /
 * API:
 *   - GET /api/*    → network-first; po sukcesie zapis do IDB; offline czyta z IDB → cache → 503
 *   - POST/PUT/DELETE/PATCH /api/* → fetch; offline zwraca 503 z {error:'offline'}
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

/* ── IndexedDB mirror ────────────────────────────────────────
 * DB 'travel-mirror', store 'responses' z keyPath: 'url'.
 * Wartość: { url, body (parsed JSON), savedAt (ms timestamp) }.
 * Strona także otwiera tę DB (utils.js → idbLatestSync) by pokazać
 * w banerze offline timestamp ostatniej synchronizacji.
 */
const IDB_NAME = 'travel-mirror';
const IDB_VERSION = 1;
const IDB_STORE = 'responses';

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'url' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(url, body) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put({ url, body, savedAt: Date.now() });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function idbGet(url) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(url);
    req.onsuccess = () => { db.close(); resolve(req.result || null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
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
  const url = new URL(request.url);

  // Tile mapy OSM, healthz, export bazy — bez cache, bez interceptu
  if (url.hostname.endsWith('.tile.openstreetmap.org') ||
      url.pathname === '/healthz' ||
      url.pathname === '/api/export') {
    return;
  }

  const isApi = url.origin === self.location.origin && url.pathname.startsWith('/api/');

  // Mutacje API: fetch + offline error
  if (isApi && request.method !== 'GET') {
    event.respondWith(mutationOrOfflineError(request));
    return;
  }

  if (request.method !== 'GET') return;

  // Nawigacja (klik linka, reload) → network-first z fallback do cache /
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNav(request));
    return;
  }

  // GET /api/* → network-first z mirror IDB
  if (isApi) {
    event.respondWith(networkFirstApi(request));
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

async function networkFirstApi(request) {
  const url = new URL(request.url);
  const key = url.pathname + url.search;
  const cache = await caches.open(RUNTIME_CACHE);

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
      // Mirror do IDB — body jako parsed JSON. Klon bo body strumienia jest jednorazowe.
      response.clone().json().then((body) => {
        idbPut(key, body).catch((err) => console.warn('[SW] IDB put fail:', key, err));
      }).catch(() => { /* nie-JSON, pomiń mirror */ });
    }
    return response;
  } catch (err) {
    // Offline: IDB → Cache API → 503
    try {
      const entry = await idbGet(key);
      if (entry) {
        return new Response(JSON.stringify(entry.body), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Source': 'idb',
            'X-Saved-At': String(entry.savedAt),
          },
        });
      }
    } catch (e) {
      console.warn('[SW] IDB get fail:', e);
    }
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: 'offline', message: 'Brak danych w trybie offline' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function mutationOrOfflineError(request) {
  try {
    return await fetch(request);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'offline', message: 'Zapis wymaga połączenia z internetem' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
