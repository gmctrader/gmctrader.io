/*
 * Ghost Discipline / SciFe — service worker
 *
 * Strategy:
 *  - App shell (HTML/manifest/icons) is precached on install and served
 *    "network-first, falling back to cache" so a fresh deploy is picked up
 *    immediately when online, but the last-known-good shell still loads
 *    offline or on a flaky connection.
 *  - Everything cross-origin (Supabase, Google Fonts, jsDelivr, speech
 *    APIs, etc.) is left completely alone — never intercepted, never
 *    cached — so auth, live data, and voice features always hit the
 *    network as normal.
 *  - Bump CACHE_VERSION on every deploy. The activate step deletes any
 *    cache that doesn't match the current version, so old app shells
 *    never linger and serve stale code.
 */

const CACHE_VERSION = 'gd-shell-v2';
const APP_SHELL = [
  './index.html',
  './scife.html',
  './manifest.json',
  './scife-manifest.json',
  './icon.png',
  './logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
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

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Only cache successful, basic (same-origin) responses.
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
  );
});
