/*
 * Service worker mínimo de CobraVoz.
 *
 * ÚNICO propósito: cuando una navegación falla por falta de red, mostrar una
 * página informativa estática. No cachea rutas de la aplicación, respuestas de
 * API ni datos privados, y no permite crear cobros sin conexión (RN-19).
 */
const CACHE_NAME = "cobravoz-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Solo navegaciones de documento. Todo lo demás (API, RSC, estáticos) va a red.
  if (request.mode !== "navigate") {
    return;
  }

  event.respondWith(
    fetch(request).catch(() =>
      caches
        .open(CACHE_NAME)
        .then((cache) => cache.match(OFFLINE_URL))
        .then((cached) => cached ?? Response.error()),
    ),
  );
});
