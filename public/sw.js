// The portal's service worker: lets the installed app open even with no network, by showing a short "offline" page.
// Nothing else is cached, so staff always see live data.
const OFFLINE = "/offline.html";
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open("bd-v2").then((c) => c.addAll([OFFLINE, "/crest.png"])));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match(OFFLINE)));
  } else if (new URL(e.request.url).pathname === "/crest.png") {
    // The crest on the offline page.
    e.respondWith(fetch(e.request).catch(() => caches.match("/crest.png")));
  }
});
