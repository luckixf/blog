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

interface GitHubComment {
  id: number
  body: string
  created_at: string
}

interface ParsedComment {
  id: number
  name: string
  avatar: string
  website?: string
  content: string
  createdAt: string
  userAgent?: string
  replyTo?: { id: number; name: string }
  isOwner?: boolean
  replies?: ParsedComment[]
}

const md5 = (value: string) =>
  crypto.createHash('md5').update(value).digest('hex')

const getAvatar = (email?: string) =>
  email
    ? `https://weavatar.com/avatar/${md5(email.toLowerCase())}?s=80&d=identicon`
    : 'https://weavatar.com/avatar/?d=mp'

function getCommentsRepo() {
  return getRepoFromEnv('COMMENTS_REPO', 'GITHUB_REPO')
}

function githubHeaders() {
  return buildGitHubHeaders(GITHUB_TOKEN, 'astro-doge-comments')
}

function parseYamlMeta(yamlContent: string): Record<string, string> {
  const meta: Record<string, string> = {}
  for (const line of yamlContent.split('\n')) {
    const colonIndex = line.indexOf(': ')
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim()
      const value = line.slice(colonIndex + 2).trim()
      meta[key] = value
    }
  }
  return meta
}

function extractContent(body: string): string {
  let content = body.replace(/<!--\n[\s\S]*?\n-->\n\n/, '')
  content = content.replace(/^\*\*[^*]+\*\*[^\n]*\n\n/, '')
  return content.trim()
}

function parseComment(comment: GitHubComment): ParsedComment | null {
  const metaMatch = comment.body.match(/<!--\n([\s\S]*?)\n-->/)
  if (!metaMatch) return null

  try {
    const meta = parseYamlMeta(metaMatch[1])
    const content = extractContent(comment.body)

    return {
      id: comment.id,
      name: meta.name || '匿名',
      avatar: getAvatar(meta.email),
      website:
        meta.website && meta.website !== SITE_URL ? meta.website : undefined,
      content,
      createdAt: comment.created_at,
      userAgent: meta.ua,
      replyTo: meta.reply_to
        ? {
            id: Number.parseInt(meta.reply_to, 10),
            name: meta.reply_to_name || '',
          }
        : undefined,
      isOwner: meta.is_owner === 'true',
    }
  } catch {
    return null
  }
}

function buildTree(comments: ParsedComment[]): ParsedComment[] {
  const map = new Map<number, ParsedComment & { replies: ParsedComment[] }>()
  const roots: (ParsedComment & { replies: ParsedComment[] })[] = []

  for (const comment of comments) {
    map.set(comment.id, { ...comment, replies: [] })
  }

  for (const comment of comments) {
    const node = map.get(comment.id)
    if (!node) continue

    if (comment.replyTo?.id) {
      const parent = map.get(comment.replyTo.id)
      if (parent) parent.replies.push(node)
    } else {
      roots.push(node)
    }
  }

  roots.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  for (const root of roots) {
    root.replies.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
  }

  return roots
}

async function fetchComments(slug: string): Promise<ParsedComment[]> {
  const { owner, repo } = getCommentsRepo()

  const search = await fetch(
    `https://api.github.com/search/issues?q=repo:${owner}/${repo}+is:issue+label:comments+"slug:${slug}"+in:body`,
    { headers: githubHeaders() },
  )
  if (!search.ok) throw new Error('Failed to search issues')

  const data = await search.json()
  if (data.total_count === 0) return []

  const issueNumber = data.items[0].number
  const comments = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100`,
    { headers: githubHeaders() },
  )
  if (!comments.ok) throw new Error('Failed to fetch comments')

  const list: GitHubComment[] = await comments.json()
  const parsed = list
    .map(parseComment)
    .filter((item): item is ParsedComment => !!item)
  return buildTree(parsed)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res, 'GET, OPTIONS')
  res.setHeader(
    'Cache-Control',
    'public, s-maxage=60, stale-while-revalidate=300',
  )

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!GITHUB_TOKEN || !hasAnyEnv('COMMENTS_REPO', 'GITHUB_REPO')) {
    return res.status(500).json({ error: 'Server configuration error' })
  }

  const slug = req.query.slug
  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Missing slug parameter' })
  }

  try {
    const comments = await fetchComments(slug)
    return res.status(200).json({ comments, count: comments.length })
  } catch (error) {
    console.error('Fetch comments error:', error)
    return res.status(500).json({ error: '获取评论时出错' })
  }
}
