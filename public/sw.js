// Fruitlink PWA service worker — app-shell caching only.
// The dashboard is a LIVE tool: data always comes fresh from the network.
// This SW makes the app install + load fast, and shows a clean state when offline.
// Bump this on any release that changes app behaviour. The old value was never
// changed, so cache-first script entries could survive a deploy and keep serving
// stale code to a phone that had already loaded the app once.
const CACHE = 'fruitlink-v3';
const SHELL = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // Only handle GET. Never touch API calls, auth, or Supabase — those must hit the network.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/')) return;        // live data — always network
  if (url.origin !== self.location.origin) return;     // third-party (mapbox, cdn) — let browser handle

  // Network-first for navigation (always try fresh; fall back to cached shell offline).
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match('/').then((r) => r || new Response(
        '<html><body style="font-family:sans-serif;text-align:center;padding:60px;color:#5b6478">' +
        '<h2 style="color:#FE6505">Fruitlink</h2><p>You appear to be offline.</p>' +
        '<p>The dashboard needs a connection to show live machine data.</p></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      )))
    );
    return;
  }

  // Scripts and styles carry the app's behaviour, so they go network-first: a
  // stale chunk is worse than a slow one. Images and fonts stay cache-first.
  const behavioural = req.destination === 'script' || req.destination === 'style';

  if (behavioural) {
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      if (res.ok && (req.destination === 'image' || req.destination === 'font')) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => cached))
  );
});
