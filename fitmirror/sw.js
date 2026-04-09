/**
 * FitMirror Service Worker
 * - 정적 에셋 캐싱 (Cache First 전략)
 * - MediaPipe CDN은 캐시하지 않음 (크기 제한)
 */

const CACHE_NAME = 'fitmirror-v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './main.js',
  './camera.js',
  './mediapipe-init.js',
  './fitting/hat.js',
  './fitting/earring.js',
  './fitting/necklace.js',
  './utils/landmark.js',
  './utils/transform.js',
  './utils/blend.js',
  './data/items.json',
  './assets/hats/beret_black.svg',
  './assets/hats/beret_black_thumb.svg',
  './assets/hats/cap_navy.svg',
  './assets/hats/cap_navy_thumb.svg',
  './assets/hats/bucket_white.svg',
  './assets/hats/bucket_white_thumb.svg',
  './assets/earrings/gold_drop.svg',
  './assets/earrings/gold_drop_thumb.svg',
  './assets/earrings/silver_hoop.svg',
  './assets/earrings/silver_hoop_thumb.svg',
  './assets/earrings/pearl_stud.svg',
  './assets/earrings/pearl_stud_thumb.svg',
  './assets/necklaces/pendant_silver.svg',
  './assets/necklaces/pendant_silver_thumb.svg',
  './assets/necklaces/gold_chain.svg',
  './assets/necklaces/gold_chain_thumb.svg',
];

// 설치: 정적 에셋 사전 캐싱
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] 일부 에셋 캐싱 실패:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 활성화: 구 캐시 정리
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// fetch: Cache First (CDN 요청은 네트워크 우선)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // CDN (MediaPipe) → Network Only
  if (url.hostname.includes('jsdelivr') || url.hostname.includes('googleapis')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // GET 요청만 캐시
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => {
      // 오프라인 & 캐시 없음 → index.html 반환 (SPA fallback)
      if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});
