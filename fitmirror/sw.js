const CACHE = 'fitmirror-v1';

const PRECACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/main.js',
  '/camera.js',
  '/mediapipe-init.js',
  '/fitting/hat.js',
  '/fitting/earring.js',
  '/fitting/necklace.js',
  '/utils/landmark.js',
  '/utils/transform.js',
  '/utils/blend.js',
  '/utils/blend-shader.js',
  '/utils/threejs-hat.js',
  '/data/items.json',
  '/assets/hats/beret_black.svg',
  '/assets/hats/cap_white.svg',
  '/assets/earrings/gold_drop.svg',
  '/assets/earrings/silver_hoop.svg',
  '/assets/earrings/pearl_stud.svg',
  '/assets/necklaces/pendant_silver.svg',
  '/assets/necklaces/chain_gold.svg',
  '/assets/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE))
  );
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

// Cache-first 전략 (MediaPipe CDN 제외)
self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('cdn.jsdelivr.net')) {
    // CDN: network-first (최신 버전 우선, 오프라인 시 캐시)
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // 로컬 에셋: cache-first
  e.respondWith(
    caches.match(e.request).then((cached) => cached ?? fetch(e.request))
  );
});
