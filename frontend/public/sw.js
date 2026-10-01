// Crave Service Worker: macht bereits besuchte Seiten (v. a. die Einkaufsliste) offline aufrufbar.
// Bewusst schlicht gehalten – es werden nur eigene, nicht-personalisierte Dateien gecacht.
// API-Aufrufe (anderer Ursprung, mit Token) werden nie angefasst.
const CACHE = "crave-v1";
const OFFLINE_FALLBACK = "/einkaufsliste";

self.addEventListener("install", () => {
    // Kein Vorab-Cache: Seiten samt ihrer Skripte landen beim ersten Online-Besuch im Cache.
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
            .then(() => self.clients.claim()),
    );
});

async function putInCache(request, response) {
    if (response && response.ok && response.type === "basic") {
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone());
    }
    return response;
}

self.addEventListener("fetch", (event) => {
    const { request } = event;
    if (request.method !== "GET") return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    // React-Server-Component-Anfragen nicht cachen; Next fällt offline auf eine normale Navigation zurück.
    if (url.searchParams.has("_rsc") || request.headers.get("RSC") === "1") return;

    // Gehashte Build-Dateien ändern sich nie: Cache zuerst.
    if (url.pathname.startsWith("/_next/static/")) {
        event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => putInCache(request, response))));
        return;
    }

    // Seiten: immer frisch aus dem Netz, offline aus dem Cache (oder die Einkaufsliste als Fallback).
    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request)
                .then((response) => putInCache(request, response))
                .catch(async () => (await caches.match(request, { ignoreSearch: url.pathname === OFFLINE_FALLBACK })) || Response.error()),
        );
        return;
    }

    // Sonstige eigene Dateien (Icons, Manifest): Cache, im Hintergrund aktualisieren.
    event.respondWith(
        caches.match(request).then((cached) => {
            const network = fetch(request).then((response) => putInCache(request, response)).catch(() => cached);
            return cached || network;
        }),
    );
});
