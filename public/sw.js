const CACHE_NAME = "kwenik-v1";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/branton_logo.png",
  "/og_gas.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
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
  // Only handle GET requests
  if (event.request.method !== "GET") return;
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) return;
  // Skip Next.js internals and API routes
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful static asset responses
        if (response.ok && (url.pathname.match(/\.(png|jpg|jpeg|svg|ico|webp|woff2?)$/) || url.pathname === "/")) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached ?? new Response("Offline", { status: 503 })))
  );
});
