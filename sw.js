/**
 * Service worker: only here so the app can be installed (home screen icon,
 * full screen). It caches nothing, so every visit loads the latest version.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener("fetch", () => {
  // let the browser handle every request as usual
});
