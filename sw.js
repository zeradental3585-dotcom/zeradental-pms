// Minimal service worker for Zera PMS.
//
// Its only real job is to EXIST and be registered: both Android (Chrome's
// install criteria) and iOS 16.4+'s installability checks look for a
// registered service worker before treating the page as a real installable
// app. It is intentionally not a full offline cache — this dashboard shows
// live patient data pulled from /api/pms on every load, and serving a stale
// cached copy of that would be actively wrong (a clinic seeing yesterday's
// board). So this worker passes every request straight through to the
// network and caches nothing.
//
// If true offline support is ever wanted later, add a cache-first strategy
// here for static assets only (index.html shell, /assets/*) and keep
// /api/* requests always network-only.

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function(event) {
  // Network passthrough — no caching. This handler's presence is what
  // satisfies the browser's "has a fetch handler" installability check.
  event.respondWith(fetch(event.request));
});
