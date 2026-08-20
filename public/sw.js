// =============================================================================
// Secure Service Worker for the Personal Dashboard PWA.
// =============================================================================
//
// SECURITY RULES (CRITICAL):
//   1. NEVER cache /api/auth/*          — auth must always be fresh
//   2. NEVER cache /api/* (data routes) — data is multi-tenant + user-scoped
//   3. NEVER cache anything containing a session token
//   4. Cache ONLY the app shell + static assets (_next/static, images, fonts)
//   5. Use network-first for navigation so users get updates quickly
//
// This SW is intentionally minimal — the app already has offline-first
// support via the localStorage-backed fetch interceptor (guest/APK mode),
// so the SW only needs to cache the HTML/CSS/JS shell for instant reloads.

const SHELL_CACHE = "dashboard-shell-v2";
const ASSET_CACHE = "dashboard-assets-v2";

const PRECACHE_URLS = [
  "/",
  "/manifest.json",
  "/logo.svg",
  "/icon-192.png",
  "/icon-512.png",
];

// URLs that must NEVER be cached (security boundaries)
const NEVER_CACHE = [
  /^\/api\/auth\//,
  /^\/api\//, // all API data routes
  /\/_next\/data\//, // next data routes
];

function shouldNeverCache(url) {
  const path = new URL(url).pathname;
  return NEVER_CACHE.some((re) => re.test(path));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        Promise.all(
          PRECACHE_URLS.map((u) =>
            cache.add(u).catch(() => {
              /* ignore individual failures */
            })
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Never intercept non-GET requests — POST/PUT/DELETE go straight to network
  if (req.method !== "GET") return;

  // SECURITY: bypass the SW entirely for auth + API data routes
  if (shouldNeverCache(req.url)) {
    return; // let the browser handle it normally
  }

  // Navigation requests (HTML pages) → network-first, fall back to cached shell
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const clone = resp.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(req, clone));
          return resp;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match("/")))
    );
    return;
  }

  // Static assets (_next/static/*, images, fonts) → cache-first
  if (
    req.url.includes("/_next/static/") ||
    req.url.endsWith(".css") ||
    req.url.endsWith(".js") ||
    req.url.endsWith(".woff2") ||
    req.url.endsWith(".png") ||
    req.url.endsWith(".svg")
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        return (
          cached ||
          fetch(req)
            .then((resp) => {
              if (resp && resp.status === 200 && resp.type === "basic") {
                const clone = resp.clone();
                caches.open(ASSET_CACHE).then((c) => c.put(req, clone));
              }
              return resp;
            })
            .catch(() => cached)
        );
      })
    );
    return;
  }

  // Everything else → straight to network (no caching)
  // (fall through — don't call event.respondWith)
});

// Allow the page to trigger an immediate SW update
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
