// Service Worker for PWA offline support
const CACHE_NAME = 'luckixf-pure-v2'
const RUNTIME_CACHE = 'luckixf-pure-runtime-v2'

// 需要预缓存的核心资源
const PRECACHE_URLS = ['/', '/offline', '/manifest.json', '/favicon.ico']

// 安装事件 - 预缓存核心资源
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...')

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Precaching core resources')
        return cache.addAll(
          PRECACHE_URLS.map((url) => new Request(url, { cache: 'reload' })),
        )
      })
      .then(() => self.skipWaiting())
      .catch((error) => {
        console.error('[SW] Precache failed:', error)
      }),
  )
})

// 激活事件 - 清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...')

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE
            })
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName)
              return caches.delete(cacheName)
            }),
        )
      })
      .then(() => self.clients.claim()),
  )
})

// Fetch 事件 - 网络优先策略，失败时使用缓存
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // 跳过非 GET 请求
  if (
    request.method !== 'GET' ||
    (url.pathname.startsWith('/api/') && url.pathname !== '/api/search.json')
  ) {
    return
  }

  // 跳过 chrome 扩展和其他协议
  if (!url.protocol.startsWith('http')) {
    return
  }

  // 跳过外部 API 和第三方资源
  if (url.origin !== self.location.origin) {
    // 对于外部资源，直接网络请求，不缓存
    event.respondWith(fetch(request))
    return
  }

  // 网络优先策略（Network First）
  event.respondWith(
    fetch(request)
      .then((response) => {
        // 如果请求成功，克隆响应并缓存
        if (response && response.status === 200) {
          const responseToCache = response.clone()

          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseToCache)
          })
        }

        return response
      })
      .catch(() => {
        // 网络请求失败，尝试从缓存中获取
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse
          }

          // 如果是导航请求且没有缓存，返回离线页面
          if (request.mode === 'navigate') {
            return caches.match('/offline') || caches.match('/')
          }

          // 其他请求返回 404
          return new Response('Network error happened', {
            status: 408,
            headers: { 'Content-Type': 'text/plain' },
          })
        })
      }),
  )
})

// 监听消息事件（可用于手动触发缓存更新等）
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName)),
        )
      }),
    )
  }
})
