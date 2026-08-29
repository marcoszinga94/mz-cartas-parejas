const CACHE = 'cartas-parejas-v3';
const ASSETS = [
  './', './index.html', './css/styles.css',
  './js/app.js', './js/cards.js', './js/sound.js', './js/timer.js',
  './data/cartas.json', './data/cartas-usuario.json',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-180.png', './icons/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then((resp) => {
      if (!resp.ok) return resp;
      const clone = resp.clone();
      caches.open(CACHE).then((c) => c.put(e.request, clone));
      return resp;
    }).catch(() => caches.match(e.request).then((r) => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});