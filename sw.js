// Network first so a new version shows up as soon as it is published,
// with the last good copy as the fallback when there is no signal.
const CACHE = 'ft-shell-v3';
const SHELL = [
  './', 'index.html', 'css/app.css', 'manifest.webmanifest', 'icons/icon-192.png',
  'js/app.js', 'js/install.js', 'icons/icon-512.png', 'js/util.js', 'js/store.js', 'js/secrets.js', 'js/gemini.js', 'js/places.js',
  'js/data/places.js', 'js/data/static.js',
  'js/views/plan.js', 'js/views/recommend.js', 'js/views/camera.js', 'js/views/missions.js', 'js/views/more.js', 'js/views/prep.js', 'js/data/prep.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ft-shell-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (e.request.method !== 'GET' || (url.origin !== location.origin && !isFont)) return;
  if (url.pathname.endsWith('secrets.enc.json')) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok || res.type === 'opaque') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html'))),
  );
});
