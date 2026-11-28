// Cache only this site's resources; image hosts keep native browser behavior.
const CACHE_NAME = 'luckixf-pure-v3'
const RUNTIME_CACHE = 'luckixf-pure-runtime-v3'
const PRECACHE_URLS = ['/', '/offline', '/manifest.json', '/favicon.ico']
const ownedCache = (name) =>
  name.startsWith('luckixf-pure-') || name.startsWith('astro-doge-')

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        cache.addAll(
          PRECACHE_URLS.map((url) => new Request(url, { cache: 'reload' })),
        ),
      )
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter(
              (name) =>
                ownedCache(name) &&
                name !== CACHE_NAME &&
                name !== RUNTIME_CACHE,
            )
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    (url.pathname.startsWith('/api/') && url.pathname !== '/api/search.json')
  )
    return

  async function fallback() {
    return (
      (await caches.match(request)) ||
      (request.mode === 'navigate' &&
        ((await caches.match('/offline')) || (await caches.match('/')))) ||
      new Response('Network unavailable', { status: 503 })
    )
  }
  // Only hashed build assets are immutable. Pages and search check the network.
  async function respond() {
    if (url.pathname.startsWith('/_astro/')) {
      const cached = await caches.match(request)
      if (cached) return cached
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    try {
      const response = await fetch(request, { signal: controller.signal })
      if (response.ok) {
        const copy = response.clone()
        event.waitUntil(
          caches
            .open(RUNTIME_CACHE)
            .then((cache) => cache.put(request, copy))
            .catch(() => {}),
        )
      }
      return response.status >= 500 ? fallback() : response
    } catch {
      return fallback()
    } finally {
      clearTimeout(timer)
    }
  }
  event.respondWith(respond())
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
  if (event.data?.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches
        .keys()
        .then((names) =>
          Promise.all(
            names.filter(ownedCache).map((name) => caches.delete(name)),
          ),
        ),
    )
  }
})
