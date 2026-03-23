/* ─────────────────────────────────────────
   定期巡回計算 Service Worker
   Cache First + Background Update (Stale-While-Revalidate)
   ───────────────────────────────────────── */

var CACHE_NAME = 'teiki-v1';
var OFFLINE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

/* ── インストール：必須リソースを事前キャッシュ ── */
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      /* 外部CDNはネットワーク不達でも失敗しないよう個別にキャッシュ */
      var essential = [
        './', './index.html', './manifest.json',
        './icons/icon-192.png', './icons/icon-512.png',
        './icons/splash/splash-iphone14pro.png',
        './icons/splash/splash-iphone14pm.png',
        './icons/splash/splash-iphone14.png',
        './icons/splash/splash-iphone13pm.png',
        './icons/splash/splash-iphone12m.png',
        './icons/splash/splash-iphonex.png',
        './icons/splash/splash-iphonexr.png',
        './icons/splash/splash-iphone8.png',
        './icons/splash/splash-ipadpro13.png',
        './icons/splash/splash-ipadpro11.png',
        './icons/splash/splash-ipad.png'
      ];
      var optional  = [
        'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap',
        'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
      ];
      return cache.addAll(essential).then(function() {
        return Promise.all(optional.map(function(url) {
          return cache.add(url).catch(function() {
            console.warn('[SW] optional cache miss:', url);
          });
        }));
      });
    }).then(function() {
      /* 旧バージョンを待たずに即座に有効化 */
      return self.skipWaiting();
    })
  );
});

/* ── アクティベート：古いキャッシュを削除 ── */
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) { return caches.delete(key); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

/* ── フェッチ：Cache First、バックグラウンドで更新 ── */
self.addEventListener('fetch', function(e) {
  /* POST やブラウザ拡張リクエストはスキップ */
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith('http')) return;

  /* フォントは stale-while-revalidate（キャッシュを返しつつ裏で更新） */
  if (e.request.url.includes('fonts.googleapis.com') ||
      e.request.url.includes('fonts.gstatic.com')) {
    e.respondWith(staleWhileRevalidate(e.request));
    return;
  }

  /* CDN ライブラリはキャッシュ優先（バージョン固定のため更新不要） */
  if (e.request.url.includes('cdnjs.cloudflare.com')) {
    e.respondWith(cacheFirst(e.request));
    return;
  }

  /* 自ファイル（index.html / manifest / icons）は stale-while-revalidate */
  e.respondWith(staleWhileRevalidate(e.request));
});

/* ── キャッシュ優先 ── */
function cacheFirst(request) {
  return caches.match(request).then(function(cached) {
    if (cached) return cached;
    return fetch(request).then(function(response) {
      if (response && response.ok) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) { cache.put(request, clone); });
      }
      return response;
    }).catch(function() {
      return new Response('', { status: 503, statusText: 'Service Unavailable' });
    });
  });
}

/* ── Stale-While-Revalidate ── */
function staleWhileRevalidate(request) {
  return caches.open(CACHE_NAME).then(function(cache) {
    return cache.match(request).then(function(cached) {
      var fetchPromise = fetch(request).then(function(response) {
        if (response && response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      }).catch(function() {
        return null;
      });
      /* キャッシュがあればすぐ返す。なければネットワーク待ち */
      return cached || fetchPromise;
    });
  });
}

/* ── メインスレッドからの skipWaiting メッセージ受信 ── */
self.addEventListener('message', function(e) {
  if (e.data && e.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
