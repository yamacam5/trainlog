const CACHE_NAME = "trainlog-v18";

// 更新を確実に反映させる対象
const NETWORK_FIRST_PATTERNS = [
  /\/trainlog\/$/,
  /\/trainlog\/index\.html$/,
  /\/trainlog\/sw\.js$/,
  /\/trainlog\/manifest\.webmanifest/,
  /\/trainlog\/assets\/.*\.(js|css)$/
];

function shouldUseNetworkFirst(request, url) {
  if (request.mode === "navigate") return true;
  return NETWORK_FIRST_PATTERNS.some((pattern) =>
    pattern.test(url.pathname + url.search)
  );
}

// インストール時 → 即有効化
self.addEventListener("install", () => {
  self.skipWaiting();
});

// 古いキャッシュを全削除
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// フェッチ処理
self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // 外部は無視
  if (url.origin !== self.location.origin) return;

  // 🔥 JS/CSS/HTMLは常に最新優先
  if (shouldUseNetworkFirst(req, url)) {
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

  // その他はキャッシュ優先
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

// 手動更新用
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING" || event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});