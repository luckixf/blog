import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'

const handlers = {}
const cached = new Map()
const deleted = []
let requests = 0
let network = async () => new Response('online')
let expire = false
const context = {
  URL,
  Request,
  Response,
  AbortController,
  setTimeout: (callback) => {
    if (expire) queueMicrotask(callback)
    return 1
  },
  clearTimeout() {},
  self: {
    location: { origin: 'https://blog.luckixf.top' },
    addEventListener: (event, handler) => {
      handlers[event] = handler
    },
    clients: { claim() {} },
    skipWaiting() {},
  },
  caches: {
    match: async (request) =>
      cached.get(typeof request === 'string' ? request : request.url)?.clone(),
    open: async () => ({
      put: async (request, response) => {
        cached.set(request.url, response)
      },
    }),
    keys: async () => [
      'unrelated-app',
      'luckixf-pure-v2',
      'luckixf-pure-v3',
      'luckixf-pure-runtime-v3',
    ],
    delete: async (name) => {
      deleted.push(name)
    },
  },
  fetch: async (...args) => {
    requests++
    return network(...args)
  },
}
vm.runInNewContext(
  readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'),
  context,
)
async function fetchEvent(path, mode = 'navigate') {
  let response
  const work = []
  handlers.fetch({
    request: {
      url: new URL(path, context.self.location.origin).href,
      method: 'GET',
      mode,
    },
    respondWith: (value) => {
      response = value
    },
    waitUntil: (value) => work.push(value),
  })
  const result = await response
  await Promise.all(work)
  return result
}
assert.equal(await fetchEvent('https://image.luckixf.top/photo.jpg'), undefined)
assert.equal(await fetchEvent('/api/comments'), undefined)
assert.equal(requests, 0)
cached.set('https://blog.luckixf.top/_astro/hash.js', new Response('immutable'))
assert.equal(
  await (await fetchEvent('/_astro/hash.js', 'cors')).text(),
  'immutable',
)
assert.equal(requests, 0)
assert.equal(await (await fetchEvent('/posts')).text(), 'online')
network = async () => {
  throw new Error('offline')
}
assert.equal(await (await fetchEvent('/posts')).text(), 'online')
cached.set('/', new Response('home fallback'))
assert.equal(await (await fetchEvent('/uncached')).text(), 'home fallback')
cached.set('/offline', new Response('offline page'))
assert.equal(await (await fetchEvent('/uncached')).text(), 'offline page')
assert.equal((await fetchEvent('/missing.jpg', 'cors')).status, 503)
expire = true
network = async (_request, { signal }) =>
  new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('timeout')))
  })
assert.equal(await (await fetchEvent('/stalled')).text(), 'offline page')
let activation
handlers.activate({
  waitUntil: (value) => {
    activation = value
  },
})
await activation
assert.deepEqual(deleted, ['luckixf-pure-v2'])
console.log(
  'Service Worker verified: external/API bypass, immutable cache, offline/timeout fallback and scoped cache cleanup.',
)
