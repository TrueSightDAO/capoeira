const CACHE = 'capoeira-tbm-v1';
const URLS = [
  '/',
  '/index.html',
  '/practice.html',
  '/library.html',
  '/transparency.html',
  '/assets/css/styles.css',
  '/assets/js/session-generator.js',
  '/assets/js/practice-flow.js',
  '/assets/js/move-library.js',
  '/assets/js/session-history.js',
  '/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(URLS)));
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
