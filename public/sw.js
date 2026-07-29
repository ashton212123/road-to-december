const CACHE_VERSION = "rtd-v3";
// Perceived speed in standalone (phone-first pass §5): navigation was
// network-first with no timeout, so on cellular the installed PWA showed a
// blank screen for however long the server took. This races the network
// against a timer and falls back to a cached copy if one exists -- the
// network keeps running in the background either way, updating the cache
// for next time. No cached copy means there's nothing to race with, so we
// just keep waiting on the network rather than showing /offline while
// still online.
const NAVIGATION_TIMEOUT_MS = 3000;
const RUNTIME_CACHE_MAX_ENTRIES = 60;
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const OFFLINE_URL = "/offline";

const SHELL_ASSETS = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  OFFLINE_URL,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
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
            .filter((key) => key.startsWith("rtd-") && key !== SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isNavigationRequest(request) {
  return request.mode === "navigate";
}

// Runtime cache grows forever otherwise on a daily-driver PWA -- trim back
// to the max after every write, oldest entries first (insertion order).
async function trimRuntimeCache() {
  const cache = await caches.open(RUNTIME_CACHE);
  const keys = await cache.keys();
  if (keys.length <= RUNTIME_CACHE_MAX_ENTRIES) return;
  const excess = keys.length - RUNTIME_CACHE_MAX_ENTRIES;
  for (let i = 0; i < excess; i++) {
    await cache.delete(keys[i]);
  }
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    // Network-first for API data so logged data stays fresh when online;
    // fall back to the last successful response when offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy).then(trimRuntimeCache));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  if (isNavigationRequest(request)) {
    event.respondWith(
      (async () => {
        const networkPromise = fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy).then(trimRuntimeCache));
          return response;
        });

        const cached = await caches.match(request);

        if (!cached) {
          try {
            return await networkPromise;
          } catch {
            return caches.match(OFFLINE_URL);
          }
        }

        const timeout = new Promise((resolve) => setTimeout(() => resolve(null), NAVIGATION_TIMEOUT_MS));
        const winner = await Promise.race([networkPromise.catch(() => null), timeout]);
        return winner || cached;
      })()
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
            return response;
          })
      )
    );
    return;
  }
});
