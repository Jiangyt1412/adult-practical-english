const CACHE_NAME = "adult-practical-english-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./lesson-01.html",
  "./styles.css",
  "./app.js",
  "./data/lessons.js",
  "./manifest.json",
  "./assets/icons/icon.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function (cache) { return cache.addAll(APP_SHELL); }));
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) { return key !== CACHE_NAME; }).map(function (key) { return caches.delete(key); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.headers.has("range")) {
    event.respondWith(fetch(request));
    return;
  }

  if (url.pathname.endsWith(".wav")) {
    event.respondWith(
      caches.match(request).then(function (cached) {
        if (cached) return cached;
        return fetch(request).then(function (response) {
          if (response.ok) caches.open(CACHE_NAME).then(function (cache) { cache.put(request, response.clone()); });
          return response;
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(request).then(function (response) {
      if (response.ok) caches.open(CACHE_NAME).then(function (cache) { cache.put(request, response.clone()); });
      return response;
    }).catch(function () { return caches.match(request).then(function (cached) { return cached || caches.match("./index.html"); }); })
  );
});
