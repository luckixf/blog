import { getFingerprint } from './fingerprint'

const API_BASE = '/api/likes'
const LIKES_CACHE_KEY = 'blog_likes_cache'
const CACHE_TTL = 2 * 60 * 1000

export interface LikeInfo {
  total: number
  userToday: number
}

export interface LikeResult {
  success: boolean
  limited: boolean
  limitReason?: 'item' | 'daily_cap' | 'rate'
  message?: string
  total: number
  userToday: number
  dailyLimit: number
}

interface CacheEntry {
  data: Record<string, LikeInfo>
  ts: number
}

function getCachedLikes(): CacheEntry | null {
  try {
    const raw = sessionStorage.getItem(LIKES_CACHE_KEY)
    if (!raw) return null
    const entry: CacheEntry = JSON.parse(raw)
    if (Date.now() - entry.ts > CACHE_TTL) {
      sessionStorage.removeItem(LIKES_CACHE_KEY)
      return null
    }
    return entry
  } catch {
    return null
  }
}

function setCachedLikes(newData: Record<string, LikeInfo>): void {
  try {
    const existing = getCachedLikes()
    const merged = existing ? { ...existing.data, ...newData } : newData
    sessionStorage.setItem(
      LIKES_CACHE_KEY,
      JSON.stringify({ data: merged, ts: Date.now() }),
    )
  } catch {
    // ignore
  }
}

function updateCacheEntry(key: string, info: Partial<LikeInfo>): void {
  try {
    const existing = getCachedLikes()
    if (existing?.data[key]) {
      existing.data[key] = { ...existing.data[key], ...info }
      sessionStorage.setItem(LIKES_CACHE_KEY, JSON.stringify(existing))
    }
  } catch {
    // ignore
  }
}

let pendingGetIds: string[] = []
let pendingGetType = ''
let pendingGetResolvers: Array<{
  resolve: (value: Record<string, LikeInfo>) => void
  reject: (error: unknown) => void
}> = []
let getTimer: ReturnType<typeof setTimeout> | null = null

async function fetchLikesFromAPI(
  ids: string[],
  type: string,
): Promise<Record<string, LikeInfo>> {
  const fingerprint = await getFingerprint()
  const params = new URLSearchParams({ ids: ids.join(','), type, fingerprint })
  const response = await fetch(`${API_BASE}?${params}`)
  if (response.status === 404 || response.status === 405) return {}
  if (!response.ok) return {}
  const data = await response.json()
  return data.likes || {}
}

function flushGetBatch(): void {
  if (pendingGetIds.length === 0) return

  const ids = [...new Set(pendingGetIds)]
  const type = pendingGetType
  const resolvers = [...pendingGetResolvers]

  pendingGetIds = []
  pendingGetType = ''
  pendingGetResolvers = []
  getTimer = null

  fetchLikesFromAPI(ids, type)
    .then((result) => {
      setCachedLikes(result)
      for (const resolver of resolvers) resolver.resolve(result)
    })
    .catch((error) => {
      for (const resolver of resolvers) resolver.reject(error)
    })
}

export function getLikes(
  ids: string[],
  type: 'thought',
): Promise<Record<string, LikeInfo>> {
  const cached = getCachedLikes()
  const prefixedIds = ids.map((id) => `${type}:${id}`)
  if (cached && prefixedIds.every((id) => id in cached.data)) {
    const result: Record<string, LikeInfo> = {}
    for (const id of prefixedIds) result[id] = cached.data[id]
    return Promise.resolve(result)
  }

  return new Promise((resolve, reject) => {
    pendingGetIds.push(...ids)
    pendingGetType = type
    pendingGetResolvers.push({ resolve, reject })
    if (getTimer) clearTimeout(getTimer)
    getTimer = setTimeout(flushGetBatch, 50)
  })
}

interface PendingLikeOp {
  targetId: string
  type: 'thought'
  resolve: (result: LikeResult) => void
  reject: (error: unknown) => void
}

let pendingLikeOps: PendingLikeOp[] = []
let likeDebounceTimer: ReturnType<typeof setTimeout> | null = null

async function flushLikeBatch(): Promise<void> {
  if (pendingLikeOps.length === 0) return

  const operations = [...pendingLikeOps]
  pendingLikeOps = []
  likeDebounceTimer = null

  const fingerprint = await getFingerprint()

  if (operations.length === 1) {
    const operation = operations[0]
    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId: operation.targetId,
          type: operation.type,
          fingerprint,
        }),
      })
      if (!response.ok) {
        if (response.status === 404 || response.status === 405) {
          operation.reject(new Error('点赞功能未启用'))
          return
        }
        operation.reject(
          response.status === 429
            ? new Error('请求太频繁，请稍后再试')
            : response.status === 500 || response.status === 503
              ? new Error('点赞接口尚未配置完成')
              : new Error('点赞失败'),
        )
        return
      }
      const data: LikeResult = await response.json()
      updateCacheEntry(`${operation.type}:${operation.targetId}`, {
        total: data.total,
        userToday: data.userToday,
      })
      operation.resolve(data)
    } catch (error) {
      operation.reject(error)
    }
    return
  }

  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operations: operations.map((operation) => ({
          targetId: operation.targetId,
          type: operation.type,
        })),
        fingerprint,
      }),
    })

    if (!response.ok) {
      const error =
        response.status === 404 || response.status === 405
          ? new Error('点赞功能未启用')
          : response.status === 429
            ? new Error('请求太频繁，请稍后再试')
            : response.status === 500 || response.status === 503
              ? new Error('点赞接口尚未配置完成')
              : new Error('点赞失败')
      for (const operation of operations) operation.reject(error)
      return
    }

    const data = await response.json()
    if (!data.batch || !data.results) {
      const error = new Error('Unexpected response format')
      for (const operation of operations) operation.reject(error)
      return
    }

    const results: Record<string, LikeResult> = data.results
    for (const [key, result] of Object.entries(results)) {
      updateCacheEntry(key, {
        total: result.total,
        userToday: result.userToday,
      })
    }

    for (const operation of operations) {
      const key = `${operation.type}:${operation.targetId}`
      const result = results[key]
      if (result) {
        operation.resolve(result)
      } else {
        operation.resolve({
          success: false,
          limited: true,
          limitReason: 'daily_cap',
          message: '今天已经点赞了 10 条，明天再来吧',
          total: 0,
          userToday: 0,
          dailyLimit: 1,
        })
      }
    }
  } catch (error) {
    for (const operation of operations) operation.reject(error)
  }
}

export function sendLike(
  targetId: string,
  type: 'thought',
): Promise<LikeResult> {
  return new Promise((resolve, reject) => {
    pendingLikeOps.push({ targetId, type, resolve, reject })

    if (likeDebounceTimer) clearTimeout(likeDebounceTimer)
    likeDebounceTimer = setTimeout(() => {
      flushLikeBatch().catch(() => {
        // avoid unhandled rejection
      })
    }, 800)
  })
}

export function formatLikeCount(count: number): string {
  if (count === 0) return ''
  if (count < 1000) return `${count}`
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`
  return `${(count / 10000).toFixed(1)}w`
}
