import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'
import {
  buildGitHubHeaders,
  getRepoFromEnv,
  hasAnyEnv,
  getSiteUrl,
  setCorsHeaders,
} from '../src/lib/server/api-utils'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const SITE_URL = getSiteUrl()
const OWNER_NAME = process.env.OWNER_NAME?.trim() || ''
const OWNER_EMAIL = process.env.OWNER_EMAIL?.trim().toLowerCase() || ''
const OWNER_TOKEN = process.env.OWNER_TOKEN || process.env.THOUGHT_API_TOKEN

const RATE_LIMIT_WINDOW = 60 * 1000
const RATE_LIMIT_MAX = 3
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

interface CommentPayload {
  slug: string
  title: string
  name?: string
  email?: string
  website?: string
  content: string
  replyToId?: string
  replyToName?: string
  userAgent?: string
  ownerToken?: string
  _gotcha?: string
}

interface CommentMeta {
  name: string
  email?: string
  website?: string
  reply_to?: number
  reply_to_name?: string
  ua?: string
  is_owner?: boolean
}

const md5 = (value: string) =>
  crypto.createHash('md5').update(value).digest('hex')

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return true
  }
  if (record.count >= RATE_LIMIT_MAX) return false
  record.count++
  return true
}

function getCommentsRepo() {
  return getRepoFromEnv('COMMENTS_REPO', 'GITHUB_REPO')
}

function githubHeaders() {
  return buildGitHubHeaders(GITHUB_TOKEN, 'astro-doge-comments', true)
}

function buildCommentBody(meta: CommentMeta, content: string): string {
  const yamlLines = [
    `name: ${meta.name}`,
    meta.email && `email: ${meta.email}`,
    meta.website && `website: ${meta.website}`,
    meta.reply_to && `reply_to: ${meta.reply_to}`,
    meta.reply_to_name && `reply_to_name: ${meta.reply_to_name}`,
    meta.ua && `ua: ${meta.ua}`,
    meta.is_owner && `is_owner: ${meta.is_owner}`,
  ].filter(Boolean)

  const avatar = meta.email
    ? `https://weavatar.com/avatar/${md5(meta.email.toLowerCase())}?s=80&d=identicon`
    : 'https://weavatar.com/avatar/?d=mp'

  const websiteLink =
    meta.website && meta.website !== SITE_URL
      ? ` · [${new URL(meta.website).hostname}](${meta.website})`
      : ''

  return `<!--
${yamlLines.join('\n')}
-->

**${meta.name}**${websiteLink} · [头像](${avatar})

${content}`
}

async function findOrCreateIssue(slug: string, title: string): Promise<number> {
  const { owner, repo } = getCommentsRepo()

  const search = await fetch(
    `https://api.github.com/search/issues?q=repo:${owner}/${repo}+is:issue+label:comments+"slug:${slug}"+in:body`,
    { headers: githubHeaders() },
  )
  if (!search.ok) throw new Error('Failed to search issues')

  const data = await search.json()
  if (data.total_count > 0) return data.items[0].number

  const articleUrl = `${SITE_URL}/${slug}`.replace(/([^:]\/)\/+/g, '$1')

  const create = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues`,
    {
      method: 'POST',
      headers: githubHeaders(),
      body: JSON.stringify({
        title,
        body: `# 文章评论\n\n**文章**: [${title}](${articleUrl})\n\n<!-- slug:${slug} -->\n\n此 Issue 用于存储评论，请勿手动修改。`,
        labels: ['comments'],
      }),
    },
  )
  if (!create.ok) throw new Error('Failed to create issue')

  return (await create.json()).number
}

async function addComment(
  issueNumber: number,
  meta: CommentMeta,
  content: string,
): Promise<void> {
  const { owner, repo } = getCommentsRepo()

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    {
      method: 'POST',
      headers: githubHeaders(),
      body: JSON.stringify({ body: buildCommentBody(meta, content) }),
    },
  )

  if (!response.ok) throw new Error('Failed to add comment')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res, 'POST, OPTIONS')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!GITHUB_TOKEN || !hasAnyEnv('COMMENTS_REPO', 'GITHUB_REPO')) {
    return res.status(500).json({ error: 'Server configuration error' })
  }

  const ip = (
    req.headers['x-forwarded-for']?.toString().split(',')[0] ||
    req.socket?.remoteAddress ||
    'unknown'
  ).trim()

  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: '评论太频繁，请稍后再试' })
  }

  try {
    const body = req.body as CommentPayload

    if (body._gotcha) return res.status(200).json({ success: true })
    if (!body.slug || !body.title || !body.content?.trim()) {
      return res.status(400).json({ error: '请填写留言内容' })
    }

    const name = body.name?.trim() || '匿名'
    const email = body.email?.trim().toLowerCase() || undefined
    const website = body.website?.trim() || undefined
    const content = body.content.trim()

    if (name.length > 50) {
      return res.status(400).json({ error: '昵称不能超过 50 个字符' })
    }
    if (content.length > 1000) {
      return res.status(400).json({ error: '评论内容不能超过 1000 个字符' })
    }
    if (email && !isValidEmail(email)) {
      return res.status(400).json({ error: '请输入有效的邮箱地址' })
    }
    if (website) {
      try {
        new URL(website)
      } catch {
        return res.status(400).json({ error: '请输入有效的网站地址' })
      }
    }

    const isOwnerName = OWNER_NAME !== '' && name === OWNER_NAME
    const isOwnerEmail = OWNER_EMAIL !== '' && email === OWNER_EMAIL
    let isOwner = false

    if (isOwnerName || isOwnerEmail) {
      if (!OWNER_TOKEN) {
        return res
          .status(500)
          .json({ error: '服务器配置错误：未设置 OWNER_TOKEN' })
      }
      if (body.ownerToken !== OWNER_TOKEN) {
        return res.status(403).json({
          error:
            isOwnerName && isOwnerEmail
              ? '博主身份验证失败：token 无效'
              : '名称或邮箱与博主相同，需要验证身份',
        })
      }
      isOwner = isOwnerName && isOwnerEmail
    }

    const meta: CommentMeta = { name }
    if (email) meta.email = email
    if (website) meta.website = website
    if (body.userAgent) meta.ua = body.userAgent
    if (isOwner) meta.is_owner = true
    if (body.replyToId && body.replyToName) {
      meta.reply_to = Number.parseInt(body.replyToId, 10)
      meta.reply_to_name = body.replyToName
    }

    const issueNumber = await findOrCreateIssue(body.slug, body.title)
    await addComment(issueNumber, meta, content)

    return res.status(200).json({ success: true, message: '评论提交成功！' })
  } catch (error) {
    console.error('Comment error:', error)
    return res.status(500).json({ error: '提交评论时出错，请稍后重试' })
  }
}
