const CACHE = "kusoma-tutor-shell-v1";

/** Precache only unauthenticated shell URLs. Auth pages 307 and would fail install. */
const PRECACHE = [
  "/",
  "/login",
  "/signup",
  "/offline",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

const TUTOR_SHELL = [
  "/",
  "/dashboard",
  "/students",
  "/login",
  "/signup",
  "/onboarding",
  "/offline",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname === "/sw.js") return;

  event.respondWith(handleGet(request, url.pathname));
});

async function handleGet(request, pathname) {
  try {
    const response = await fetch(request);
    if (response.ok && shouldCachePath(pathname)) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      const offline = await caches.match("/offline");
      if (offline) return offline;
    }
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

function shouldCachePath(pathname) {
  if (TUTOR_SHELL.includes(pathname)) return true;
  if (pathname.startsWith("/icons/")) return true;
  if (pathname.startsWith("/_next/static/")) return true;
  return false;
}
