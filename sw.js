// Cache Storage is shared by every app on this origin. Include this SW scope.
const CACHE_PREFIX = `nutriflow:${self.registration.scope}:v`;
const CACHE_NAME = `${CACHE_PREFIX}1`;
const ASSETS = ["./index.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && /^\d+$/.test(k.slice(CACHE_PREFIX.length)) && k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.open(CACHE_NAME).then((cache) => cache.match(e.request)))
  );
});
