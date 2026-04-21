const CACHE_NAME = 'lapka-v1';
const RUNTIME_CACHE = 'lapka-runtime-v1';
const STATIC_ASSETS = [
  '/',
  '/login',
  '/offline.html',
  '/manifest.webmanifest',
  '/assets/img/logo-paw.svg',
];

const API_CACHE_DURATION = 5 * 60 * 1000;
const STATIC_CACHE_DURATION = 24 * 60 * 60 * 1000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, clone);
          });
          return response;
        })
        .catch(() => {
          if (request.destination === 'document') {
            return caches.match('/offline.html');
          }
          return new Response('Offline', { status: 503 });
        });
    })
  );
});

async function handleApiRequest(request) {
  try {
    const cached = await caches.match(request);
    if (cached) {
      const cachedTime = cached.headers.get('x-cached-time');
      if (cachedTime && Date.now() - parseInt(cachedTime) < API_CACHE_DURATION) {
        return cached;
      }
    }

    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      const cache = await caches.open(RUNTIME_CACHE);
      const headers = new Headers(clone.headers);
      headers.set('x-cached-time', String(Date.now()));
      const cachedResponse = new Response(clone.body, { headers });
      cache.put(request, cachedResponse);
    }
    return response;
  } catch (error) {
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'Новое уведомление от Лапки',
    icon: '/assets/img/logo-paw.svg',
    badge: '/assets/img/logo-paw.svg',
    vibrate: [100, 200, 100],
    tag: data.tag || 'lapka-notification',
    renotify: true,
    data: {
      url: data.url || '/owner/inbox',
      timestamp: Date.now(),
    },
  };

  event.waitUntil(self.registration.showNotification(data.title || 'Лапка', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/owner/inbox';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

export {};