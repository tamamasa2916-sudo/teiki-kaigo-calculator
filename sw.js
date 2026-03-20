/* =====================================================
   Service Worker - 定期巡回 利用料計算ツール
   オフライン対応・キャッシュ管理
   ===================================================== */

const CACHE_NAME = 'teiki-kaigo-v1';

// キャッシュするリソース一覧
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// インストール時：キャッシュを事前ロード
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // 外部リソースはエラーを無視してキャッシュ
      return Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(err => {
            console.warn('[SW] キャッシュ失敗:', url, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// アクティブ時：古いキャッシュを削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// フェッチ時：キャッシュファースト戦略
self.addEventListener('fetch', event => {
  // POSTリクエストはスキップ
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      // キャッシュになければネットワークから取得してキャッシュ保存
      return fetch(event.request).then(response => {
        // 有効なレスポンスのみキャッシュ
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const cloned = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, cloned);
        });
        return response;
      }).catch(() => {
        // オフライン時はindex.htmlを返す（アプリ本体）
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
