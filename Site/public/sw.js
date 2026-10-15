// Hand-rolled service worker — see spec §1.2. Strategies:
//   navigations      → network-first, offline fallback to cached '/'
//   /assets/* (hashed, immutable) → cache-first
//   everything else same-origin   → stale-while-revalidate
//   /api/time → not handled: network-only, never cached
// Bump CACHE to invalidate every cached response at once.
const CACHE = 'time-app-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(['/'])).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // A cached timestamp is a wrong one: the clock sync must always reach the network.
  if (url.pathname === '/api/time') return;
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(event, request));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    // '/' is the only navigation cache key — single-route assumption (no per-path nav caching).
    if (fresh.ok && fresh.status !== 206) await cache.put('/', fresh.clone());
    return fresh;
  } catch {
    const hit = await cache.match('/');
    return hit ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const fresh = await fetch(request);
  if (fresh.ok && fresh.status !== 206) await cache.put(request, fresh.clone());
  return fresh;
}

async function staleWhileRevalidate(event, request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  const refresh = fetch(request)
    .then(async (fresh) => {
      if (fresh.ok && fresh.status !== 206) await cache.put(request, fresh.clone());
      return fresh;
    })
    .catch(() => undefined);
  if (hit) {
    // The cache write above can't be awaited before returning the hit, so extend
    // the fetch event's lifetime instead — otherwise the runtime may tear the
    // worker down mid-write once respondWith's promise settles.
    event.waitUntil(refresh);
    return hit;
  }
  return (await refresh) ?? Response.error();
}
