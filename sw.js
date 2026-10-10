/* Stumpffia service worker.
   Sube el número de CACHE cada vez que publiques cambios. */

var CACHE = "stumpffia-v6";

var ESENCIALES = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/assets/css/styles.css",
  "/assets/js/app.js",
  "/assets/js/games.js",
  "/assets/fonts/nunito-latin.woff2",
  "/assets/fonts/nunito-latin-ext.woff2",
  "/assets/img/logo.png",
  "/assets/img/logo-96.png",
  "/assets/img/icon-192.png",
  "/assets/img/icon-512.png",
  "/offline.html"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      /* addAll falla entero si un archivo falta; así no rompe la instalación */
      return Promise.all(ESENCIALES.map(function (url) {
        return c.add(url).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (claves) {
      return Promise.all(claves.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;

  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;

  /* Navegación: red primero (para ver cambios), caché si no hay internet. */
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(function (res) {
        var copia = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copia); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match("/offline.html") || caches.match("/");
        });
      })
    );
    return;
  }

  /* Recursos: caché primero (son chiquitos y casi nunca cambian). */
  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res.ok && res.type === "basic") {
          var copia = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copia); });
        }
        return res;
      });
    })
  );
});
