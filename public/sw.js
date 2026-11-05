// The portal's service worker: phone notifications, and an "offline" page when there's no network.
// Nothing else is cached, so staff always see live data.
const OFFLINE = "/offline.html";
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open("bd-v3").then((c) => c.addAll([OFFLINE, "/crest.png"])));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match(OFFLINE)));
  } else if (new URL(e.request.url).pathname === "/crest.png") {
    e.respondWith(fetch(e.request).catch(() => caches.match("/crest.png")));
  }
});

// A notification from the portal: { title, body, url }.
self.addEventListener("push", (e) => {
  let m = { title: "Bharath Dass School", body: "", url: "/" };
  try { m = { ...m, ...e.data.json() }; } catch {}
  e.waitUntil(self.registration.showNotification(m.title, {
    body: m.body, icon: "/icon-192.png", badge: "/icon-192.png", data: { url: m.url },
  }));
});

// Tapping it opens (or brings forward) the portal at the right page.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "/", self.location.origin).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin === self.location.origin) {
        await w.focus();
        return w.navigate(url);
      }
    }
    return self.clients.openWindow(url);
  })());
});
