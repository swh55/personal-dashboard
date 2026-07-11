// Simple service worker for offline caching
const CACHE_NAME = "dashboard-v1";
const PRECACHE_URLS = ["/", "/logo.svg", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request)
          .then((resp) => {
            if (resp && resp.status === 200 && resp.type === "basic") {
              const clone = resp.clone();
              caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
            }
            return resp;
          })
          .catch(() => cached)
      );
    })
  );
});
