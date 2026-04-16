const CACHE_NAME = "trainlog-v3-master-fresh";

const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
];

function isFirebaseReservedPath(url) {
  return url.pathname.startsWith("/__/");
}

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isAppShellRequest(request, url) {
  return request.mode === "navigate" || APP_SHELL.includes(url.pathname);
}

function isStaticAsset(url) {
  return /\.[a-z0-9]+$/i.test(url.pathname);
}

function isMasterDataRequest(url) {
  return /\/vehicle_master\.csv($|\?)/i.test(url.pathname + url.search) || /\.csv($|\?)/i.test(url.pathname + url.search);
}


// インストール
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

// 有効化
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
    )
  );
  self.clients.claim();
});

// フェッチ処理
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // 🔥 Firebase Authは絶対に触らない（超重要）
  if (isFirebaseReservedPath(url)) return;

  // 他ドメインも触らない
  if (!isSameOrigin(url)) return;

  // HTML系 → ネット優先
  if (isAppShellRequest(request, url)) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((res) => res || caches.match("/index.html")))
    );
    return;
  }

  // CSVなどマスターデータ → ネット優先
  if (isMasterDataRequest(url)) {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 静的ファイル → キャッシュ優先
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return res;
        });
      })
    );
  }
});