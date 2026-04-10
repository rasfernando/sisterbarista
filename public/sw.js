// Sister Barista — Service Worker
const CACHE_NAME = 'sister-barista-v1';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/styles.css',
  '/logo.png',
  '/name.png',
  '/icon-192.png',
  '/icon-512.png',
  '/qrcode.min.js',
  '/html5-qrcode.min.js',
  '/manifest.json'
];

// Install: cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API calls, cache-first for app shell
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always go to network for Supabase API calls
  if (url.hostname.includes('supabase.co')) {
    return;
  }

  // Always go to network for Google Fonts
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for app shell assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((response) => {
        // Update cache with fresh version
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
