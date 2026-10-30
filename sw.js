/*
 * Ghost Discipline / SciFe — service worker
 *
 * Strategy:
 *  - App shell (HTML/manifest/icons) is precached on install and served
 *    stale-while-revalidate so an available shell opens immediately, with
 *    successful same-origin requests refreshing the cache in the background.
 *  - Everything cross-origin (Supabase, Google Fonts, jsDelivr, speech
 *    APIs, etc.) is left completely alone — never intercepted, never
 *    cached — so auth, live data, and voice features always hit the
 *    network as normal.
 *  - Bump CACHE_VERSION on every deploy. The activate step deletes any
 *    cache that doesn't match the current version, so old app shells
 *    never linger and serve stale code.
 */

const CACHE_VERSION = 'gd-shell-v32';
const APP_SHELL = [
  './index.html',
  './app.html',
  './glass-interactions.js',
  './space-background.js',
  './home',
  './workspace?signin=1',
  './companion?full=1',
  './landing.html',
  './scife.html',
  './manifest.json',
  './scife-manifest.json',
  './ghost-discipline-icon-v3.png',
  './ghost-discipline-logo-v2.png',
  './ghost-discipline-share-v2.png',
  './preview-daily-brief.svg',
  './preview-trade-journal.svg',
  './preview-analytics.svg',
  './preview-scife.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only ever handle same-origin GET requests for the app shell.
  // Everything else (Supabase, CDN scripts, fonts, speech services,
  // POST/PUT calls, etc.) passes straight through to the network
  // untouched — the service worker doesn't intercept it at all.
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  const networkPromise = fetch(req).then((res) => {
    if (res && res.status === 200 && res.type === 'basic') {
      const copy = res.clone();
      caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
    }
    return res;
  });
  event.waitUntil(networkPromise.then(() => undefined).catch(() => undefined));
  event.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try {
      return await networkPromise;
    } catch (error) {
      return await caches.match('./home') || await caches.match('./index.html');
    }
  })());
});

