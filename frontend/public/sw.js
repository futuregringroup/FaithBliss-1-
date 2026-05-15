const CACHE_NAME = 'faithbliss-pwa-v3';
const APP_SHELL = [
  '/',
  '/index.html',
  '/site.webmanifest',
  '/logo.svg',
  '/favicon.svg',
  '/pwa-192.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {
        // Ignore cache warmup errors; runtime cache can still work.
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Network-first for app navigation, with offline shell fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy)).catch(() => {});
          return response;
        })
        .catch(async () => (await caches.match(request)) || caches.match('/index.html'))
    );
    return;
  }

  const isStaticAsset =
    url.pathname.startsWith('/assets/')
    || /\.(?:js|css|png|jpg|jpeg|svg|webp|gif|ico|woff|woff2)$/i.test(url.pathname);

  if (!isStaticAsset) return;

  const isCodeAsset = /\.(?:js|css)$/i.test(url.pathname);

  if (isCodeAsset) {
    // Network-first for code assets so new deployments win on the first load.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(async () => caches.match(request))
    );
    return;
  }

  // Stale-while-revalidate for media and other static assets.
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});

self.addEventListener('message', (event) => {
  const payload = event.data;
  if (!payload || payload.type !== 'SHOW_NOTIFICATION') return;

  const title = typeof payload.title === 'string' && payload.title.trim()
    ? payload.title.trim()
    : 'Notification';
  const body = typeof payload.body === 'string' && payload.body.trim()
    ? payload.body.trim()
    : 'You have a new notification.';
  const url = typeof payload.url === 'string' && payload.url.trim()
    ? payload.url.trim()
    : '/notifications';
  const tag = typeof payload.tag === 'string' && payload.tag.trim()
    ? payload.tag.trim()
    : undefined;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag,
      data: { url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const rawUrl = event.notification?.data?.url;
  const targetUrl = typeof rawUrl === 'string' && rawUrl.trim()
    ? new URL(rawUrl, self.location.origin).toString()
    : new URL('/notifications', self.location.origin).toString();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const clientUrl = typeof client.url === 'string' ? client.url : '';
        if (clientUrl.startsWith(self.location.origin)) {
          return client.navigate(targetUrl).then(() => client.focus());
        }
      }

      return self.clients.openWindow(targetUrl);
    })
  );
});
