const CACHE_NAME = "trainlog-v17";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // GET以外は無視
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // 外部リクエストは無視
  if (url.origin !== self.location.origin) return;

  // ページ遷移 → ネット優先 + キャッシュ更新
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // その他リソース → キャッシュ優先 + バックグラウンド更新
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});


// 🔔 更新即反映（v17の安定化ポイント）
self.addEventListener("message", (event) => {
  const data = event.data;

  if (data === "SKIP_WAITING" || data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});