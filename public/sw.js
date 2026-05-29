// Minimal, safe service worker for akrobacja.com PWA installability.
// Deliberately does NOT cache /api/ responses - admin/pilot data must never go stale.
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  let url;
  try { url = new URL(req.url); } catch { return; }

  // Never intercept/cache API calls - always go to network.
  if (url.pathname.startsWith('/api/')) return;

  // Network-first passthrough for navigations so the app is installable
  // without ever serving stale shell content.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => Response.error()));
    return;
  }
  // Everything else: default browser behaviour (no-op).
});
