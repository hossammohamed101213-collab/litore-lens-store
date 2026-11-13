// Minimal service worker: makes the store installable. Always uses the network (no stale caching of prices/stock).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(
    fetch(e.request).catch(
      () => new Response("<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'><body style='font-family:sans-serif;text-align:center;padding:3rem;background:#fff5f6;color:#865466'><h1>Litore</h1><p>لا يوجد اتصال بالإنترنت / No internet connection</p>", { headers: { "content-type": "text/html; charset=utf-8" } }),
    ),
  );
});
