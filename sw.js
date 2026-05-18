/* Service Worker — offline shell for PWA */
const CACHE = 'reflectflow-v1';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './css/animations.css',
  './css/responsive.css',
  './js/utils/security.js',
  './js/utils/date.js',
  './js/utils/browser.js',
  './js/core/state.js',
  './js/storage.js',
  './js/streak.js',
  './js/daily.js',
  './js/habits.js',
  './js/sidebar.js',
  './js/notes.js',
  './js/analytics.js',
  './js/notifications.js',
  './js/ui.js',
  './js/app.js',
  './manifest.json',
  './assets/icons/favicon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).catch(() => caches.match('./index.html')))
  );
});
