import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'
import {
  buildGitHubHeaders,
  getRepoFromEnv,
  hasAnyEnv,
  setCorsHeaders,
} from '../src/lib/server/api-utils'
import { getDateKeyInTimeZone } from '../src/lib/server/timezone'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const SITE_TIMEZONE = process.env.SITE_TIMEZONE?.trim() || 'UTC'

const THOUGHT_DAILY_LIMIT = 1
const DAILY_UNIQUE_TARGETS_LIMIT = 10
const RATE_WINDOW_MS = 10_000
const RATE_MAX = 5
const WRITE_BUFFER_MS = 600
const ISSUE_CACHE_TTL_MS = 30_000
const CLEANUP_INTERVAL_MS = 5 * 60_000

const rateMap = new Map<string, { count: number; reset: number }>()
const ipDailyTargets = new Map<string, { targets: Set<string>; date: string }>()
const fpDailyTargets = new Map<string, { targets: Set<string>; date: string }>()

let writeTimer: ReturnType<typeof setTimeout> | null = null
let lastCleanup = Date.now()
let issueCacheTs = 0
let cachedIssue: { number: number; data: LikesData } | null = null

interface LikeRecord {
  userHash: string
  targetId: string
  date: string
}

interface LikesData {
  totalLikes: Record<string, number>
  records: LikeRecord[]
}

interface LikeOperation {
  targetId: string
  type: 'thought'
}

interface SingleLikePayload {
  targetId: string
  type: 'thought'
  fingerprint: string
}

interface PendingWrite {
  userHash: string
  ip: string
  storageKey: string
  resolve: (result: LikeResult) => void
  reject: (err: unknown) => void
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

function getLikesRepo() {
  return getRepoFromEnv('LIKES_REPO', 'COMMENTS_REPO', 'GITHUB_REPO')
}

function githubHeaders() {
  return buildGitHubHeaders(GITHUB_TOKEN, 'astro-doge-likes', true)
}

function getTodayDate(): string {
  return getDateKeyInTimeZone(new Date(), SITE_TIMEZONE)
}

function hashIdentifier(ip: string, fingerprint: string): string {
  return crypto
    .createHash('sha256')
    .update(`${ip}:${fingerprint}`)
    .digest('hex')
    .slice(0, 16)
}

function validateFingerprint(value: string): boolean {
  if (!value || typeof value !== 'string') return false
  if (value.length < 8 || value.length > 64) return false
  return /^[a-f0-9]+$/i.test(value)
}

function validateTargetId(value: string): boolean {
  if (!value || typeof value !== 'string') return false
  if (value.length > 200) return false
  return /^[a-zA-Z0-9\-_/]+$/.test(value)
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now()

  if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
    for (const [key, value] of rateMap) {
      if (now > value.reset) rateMap.delete(key)
    }
    for (const [key, value] of ipDailyTargets) {
      if (value.date !== getTodayDate()) ipDailyTargets.delete(key)
    }
    for (const [key, value] of fpDailyTargets) {
      if (value.date !== getTodayDate()) fpDailyTargets.delete(key)
    }
    lastCleanup = now
  }

  const record = rateMap.get(ip)
  if (!record || now > record.reset) {
    rateMap.set(ip, { count: 1, reset: now + RATE_WINDOW_MS })
    return true
  }
  if (record.count >= RATE_MAX) return false
  record.count++
  return true
}

function checkIpDailyCap(ip: string, storageKey: string): boolean {
  const today = getTodayDate()
  const entry = ipDailyTargets.get(ip)
  if (!entry || entry.date !== today) return true
  if (entry.targets.has(storageKey)) return true
  return entry.targets.size < DAILY_UNIQUE_TARGETS_LIMIT
}

function recordIpDailyTarget(ip: string, storageKey: string): void {
  const today = getTodayDate()
  const entry = ipDailyTargets.get(ip)
  if (!entry || entry.date !== today) {
    ipDailyTargets.set(ip, { targets: new Set([storageKey]), date: today })
    return
  }
  entry.targets.add(storageKey)
}

function checkFpDailyCap(userHash: string, storageKey: string): boolean {
  const today = getTodayDate()
  const entry = fpDailyTargets.get(userHash)
  if (!entry || entry.date !== today) return true
  if (entry.targets.has(storageKey)) return true
  return entry.targets.size < DAILY_UNIQUE_TARGETS_LIMIT
}

function recordFpDailyTarget(userHash: string, storageKey: string): void {
  const today = getTodayDate()
  const entry = fpDailyTargets.get(userHash)
  if (!entry || entry.date !== today) {
    fpDailyTargets.set(userHash, {
      targets: new Set([storageKey]),
      date: today,
    })
    return
  }
  entry.targets.add(storageKey)
}

function parseLikesData(body: string): LikesData {
  try {
    const match = body.match(/```json\n([\s\S]*?)\n```/)
    if (!match) return { totalLikes: {}, records: [] }
    const parsed = JSON.parse(match[1])
    return {
      totalLikes: parsed.totalLikes || {},
      records: Array.isArray(parsed.records) ? parsed.records : [],
    }
  } catch {
    return { totalLikes: {}, records: [] }
  }
}

function serializeLikesData(data: LikesData): string {
  const today = getTodayDate()
  const cutoff = new Date(new Date(today).getTime() - 7 * 86400_000)
    .toISOString()
    .split('T')[0]

  const trimmed: LikesData = {
    totalLikes: data.totalLikes,
    records: data.records.filter((record) => record.date >= cutoff),
  }

  return `\`\`\`json\n${JSON.stringify(trimmed)}\n\`\`\``
}

const LIKES_ISSUE_TITLE = 'blog-likes-data'
const LIKES_ISSUE_LABEL = 'likes-data'

async function findOrCreateIssue(): Promise<number> {
  const { owner, repo } = getLikesRepo()

  if (cachedIssue && Date.now() - issueCacheTs < ISSUE_CACHE_TTL_MS) {
    return cachedIssue.number
  }

  const searchRes = await fetch(
    `https://api.github.com/search/issues?q=repo:${owner}/${repo}+is:issue+label:${LIKES_ISSUE_LABEL}+"${LIKES_ISSUE_TITLE}"+in:title&per_page=1`,
    { headers: githubHeaders() },
  )
  if (!searchRes.ok) throw new Error('GitHub search failed')

  const searchData = await searchRes.json()
  if (searchData.total_count > 0) {
    const issue = searchData.items[0]
    cachedIssue = {
      number: issue.number,
      data: parseLikesData(issue.body || ''),
    }
    issueCacheTs = Date.now()
    return issue.number
  }

  const createRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues`,
    {
      method: 'POST',
      headers: githubHeaders(),
      body: JSON.stringify({
        title: LIKES_ISSUE_TITLE,
        body: serializeLikesData({ totalLikes: {}, records: [] }),
        labels: [LIKES_ISSUE_LABEL],
      }),
    },
  )
  if (!createRes.ok) throw new Error('GitHub create issue failed')

  const created = await createRes.json()
  cachedIssue = {
    number: created.number,
    data: { totalLikes: {}, records: [] },
  }
  issueCacheTs = Date.now()
  return created.number
}

async function readIssueData(): Promise<{ number: number; data: LikesData }> {
  if (cachedIssue && Date.now() - issueCacheTs < ISSUE_CACHE_TTL_MS) {
    return { number: cachedIssue.number, data: cachedIssue.data }
  }

  const issueNumber = await findOrCreateIssue()
  const { owner, repo } = getLikesRepo()
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
    { headers: githubHeaders() },
  )
  if (!response.ok) throw new Error('GitHub get issue failed')

  const issue = await response.json()
  const data = parseLikesData(issue.body || '')

  cachedIssue = { number: issueNumber, data }
  issueCacheTs = Date.now()

  return { number: issueNumber, data }
}

async function writeIssueData(
  issueNumber: number,
  data: LikesData,
): Promise<void> {
  const { owner, repo } = getLikesRepo()
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
    {
      method: 'PATCH',
      headers: githubHeaders(),
      body: JSON.stringify({ body: serializeLikesData(data) }),
    },
  )
  if (!response.ok) throw new Error('GitHub patch issue failed')

  if (cachedIssue) {
    cachedIssue.data = data
    issueCacheTs = Date.now()
  }
}

let pendingWrites: PendingWrite[] = []

async function flushWrites(): Promise<void> {
  if (pendingWrites.length === 0) return

  const batch = [...pendingWrites]
  pendingWrites = []
  writeTimer = null

  let issueNumber: number
  let data: LikesData

  try {
    issueCacheTs = 0
    const issue = await readIssueData()
    issueNumber = issue.number
    data = issue.data
  } catch (error) {
    for (const item of batch) item.reject(error)
    return
  }

  const today = getTodayDate()
  let anyWritten = false

  for (const item of batch) {
    const todayCount = data.records.filter(
      (record) =>
        record.userHash === item.userHash &&
        record.targetId === item.storageKey &&
        record.date === today,
    ).length

    if (todayCount >= THOUGHT_DAILY_LIMIT) {
      item.resolve({
        success: false,
        limited: true,
        limitReason: 'item',
        message: '今天已经点过赞了，明天再来吧',
        total: data.totalLikes[item.storageKey] ?? 0,
        userToday: todayCount,
        dailyLimit: THOUGHT_DAILY_LIMIT,
      })
      continue
    }

    const userTodayTargets = new Set(
      data.records
        .filter(
          (record) =>
            record.userHash === item.userHash && record.date === today,
        )
        .map((record) => record.targetId),
    )

    if (
      !userTodayTargets.has(item.storageKey) &&
      userTodayTargets.size >= DAILY_UNIQUE_TARGETS_LIMIT
    ) {
      item.resolve({
        success: false,
        limited: true,
        limitReason: 'daily_cap',
        message: `今天已经点赞了 ${DAILY_UNIQUE_TARGETS_LIMIT} 条，明天再来吧`,
        total: data.totalLikes[item.storageKey] ?? 0,
        userToday: 0,
        dailyLimit: THOUGHT_DAILY_LIMIT,
      })
      continue
    }

    data.records.push({
      userHash: item.userHash,
      targetId: item.storageKey,
      date: today,
    })
    data.totalLikes[item.storageKey] =
      (data.totalLikes[item.storageKey] ?? 0) + 1
    anyWritten = true

    item.resolve({
      success: true,
      limited: false,
      total: data.totalLikes[item.storageKey],
      userToday: todayCount + 1,
      dailyLimit: THOUGHT_DAILY_LIMIT,
    })
  }

  if (anyWritten) {
    try {
      await writeIssueData(issueNumber, data)
    } catch (error) {
      console.error('flushWrites: GitHub PATCH failed', error)
    }
  }
}

function enqueueLike(
  userHash: string,
  ip: string,
  storageKey: string,
): Promise<LikeResult> {
  return new Promise((resolve, reject) => {
    pendingWrites.push({ userHash, ip, storageKey, resolve, reject })

    if (writeTimer) clearTimeout(writeTimer)
    writeTimer = setTimeout(() => {
      flushWrites().catch(console.error)
    }, WRITE_BUFFER_MS)
  })
}

async function handleGetLikes(
  targetIds: string[],
  userHash: string,
): Promise<Record<string, { total: number; userToday: number }>> {
  const { data } = await readIssueData()
  const today = getTodayDate()

  const result: Record<string, { total: number; userToday: number }> = {}
  for (const targetId of targetIds) {
    result[targetId] = {
      total: data.totalLikes[targetId] ?? 0,
      userToday: userHash
        ? data.records.filter(
            (record) =>
              record.userHash === userHash &&
              record.targetId === targetId &&
              record.date === today,
          ).length
        : 0,
    }
  }
  return result
}

async function processLike(
  type: 'thought',
  targetId: string,
  ip: string,
  userHash: string,
): Promise<LikeResult> {
  const storageKey = `${type}:${targetId}`

  if (!checkIpDailyCap(ip, storageKey)) {
    return {
      success: false,
      limited: true,
      limitReason: 'daily_cap',
      message: `今天已经点赞了 ${DAILY_UNIQUE_TARGETS_LIMIT} 条，明天再来吧`,
      total: (await readIssueData()).data.totalLikes[storageKey] ?? 0,
      userToday: 0,
      dailyLimit: THOUGHT_DAILY_LIMIT,
    }
  }

  if (!checkFpDailyCap(userHash, storageKey)) {
    return {
      success: false,
      limited: true,
      limitReason: 'daily_cap',
      message: `今天已经点赞了 ${DAILY_UNIQUE_TARGETS_LIMIT} 条，明天再来吧`,
      total: (await readIssueData()).data.totalLikes[storageKey] ?? 0,
      userToday: 0,
      dailyLimit: THOUGHT_DAILY_LIMIT,
    }
  }

  const result = await enqueueLike(userHash, ip, storageKey)

  if (result.success) {
    recordIpDailyTarget(ip, storageKey)
    recordFpDailyTarget(userHash, storageKey)
  }

  return result
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res, 'GET, POST, OPTIONS')

  if (req.method === 'OPTIONS') return res.status(200).end()

  if (
    !GITHUB_TOKEN ||
    !hasAnyEnv('LIKES_REPO', 'COMMENTS_REPO', 'GITHUB_REPO')
  ) {
    return res.status(503).json({ error: 'Service unavailable' })
  }

  const ip = (
    (req.headers['x-forwarded-for'] as string | undefined)
      ?.split(',')[0]
      .trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  ).trim()

  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: '请求太频繁，请稍后再试' })
  }

  if (req.method === 'GET') {
    try {
      const { ids, fingerprint } = req.query

      if (!ids || typeof ids !== 'string') {
        return res.status(400).json({ error: 'Missing ids' })
      }

      const targetIds = ids
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0 && validateTargetId(item))
        .map((item) => `thought:${item}`)

      if (targetIds.length === 0 || targetIds.length > 50) {
        return res.status(400).json({ error: 'Invalid ids (1-50 allowed)' })
      }

      const fp = typeof fingerprint === 'string' ? fingerprint : ''
      const userHash =
        fp && validateFingerprint(fp) ? hashIdentifier(ip, fp) : ''

      const result = await handleGetLikes(targetIds, userHash)
      res.setHeader(
        'Cache-Control',
        'public, s-maxage=30, stale-while-revalidate=120',
      )
      return res.status(200).json({ likes: result })
    } catch (error) {
      console.error('GET /api/likes error:', error)
      return res.status(500).json({ error: '获取点赞数据失败' })
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body
      if (!body || typeof body !== 'object') {
        return res.status(400).json({ error: 'Invalid body' })
      }

      if (!body.fingerprint || !validateFingerprint(body.fingerprint)) {
        return res.status(400).json({ error: 'Invalid fingerprint' })
      }

      const userHash = hashIdentifier(ip, body.fingerprint)

      if (Array.isArray(body.operations)) {
        const operations = (body.operations as LikeOperation[]).filter(
          (operation) =>
            operation?.type === 'thought' &&
            typeof operation.targetId === 'string' &&
            validateTargetId(operation.targetId),
        )

        if (operations.length === 0) {
          return res.status(400).json({ error: 'No valid operations' })
        }
        if (operations.length > 20) {
          return res.status(400).json({ error: 'Too many operations (max 20)' })
        }

        const entries = await Promise.all(
          operations.map(async (operation) => {
            const key = `${operation.type}:${operation.targetId}`
            const result = await processLike(
              operation.type,
              operation.targetId,
              ip,
              userHash,
            )
            return [key, result] as const
          }),
        )

        return res
          .status(200)
          .json({ batch: true, results: Object.fromEntries(entries) })
      }

      if (body.targetId) {
        const payload = body as SingleLikePayload

        if (payload.type !== 'thought') {
          return res.status(400).json({ error: 'Invalid type' })
        }
        if (!validateTargetId(payload.targetId)) {
          return res.status(400).json({ error: 'Invalid targetId' })
        }

        const result = await processLike(
          payload.type,
          payload.targetId,
          ip,
          userHash,
        )
        return res.status(200).json(result)
      }

      return res.status(400).json({ error: 'Missing targetId or operations' })
    } catch (error) {
      console.error('POST /api/likes error:', error)
      return res.status(500).json({ error: '点赞失败，请稍后重试' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
