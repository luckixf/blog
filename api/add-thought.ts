import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  buildGitHubHeaders,
  getRepoFromEnv,
  getSiteUrl,
  hasAnyEnv,
  setCorsHeaders,
} from '../src/lib/server/api-utils'
import {
  getPathPartsInTimeZone,
  toZonedISOString,
} from '../src/lib/server/timezone'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const THOUGHT_API_TOKEN = process.env.THOUGHT_API_TOKEN
const CONTENT_BRANCH = process.env.CONTENT_BRANCH?.trim() || 'main'
const THOUGHTS_CONTENT_DIR =
  process.env.THOUGHTS_CONTENT_DIR?.trim() || 'src/content/thoughts'
const SITE_TIMEZONE = process.env.SITE_TIMEZONE?.trim() || 'UTC'
const SITE_URL = getSiteUrl()

interface ThoughtRequest {
  content: string
  tags?: string[]
  name?: string
}

interface GitHubCreateFileResponse {
  content: {
    name: string
    path: string
    sha: string
    html_url: string
  }
  commit: {
    sha: string
    html_url: string
  }
}

function getContentRepo() {
  return getRepoFromEnv('CONTENT_REPO', 'GITHUB_REPO')
}

function githubHeaders() {
  return {
    ...buildGitHubHeaders(GITHUB_TOKEN, 'astro-doge-add-thought', true),
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

function randomId(len = 3): string {
  let result = ''
  for (let index = 0; index < len; index++) {
    result += Math.floor(Math.random() * 10)
  }
  return result
}

function sanitizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

function generateThoughtContent(
  content: string,
  tags: string[],
  dateStr: string,
): string {
  const tagsStr = tags.map((tag) => `"${tag}"`).join(', ')
  return `---
date: ${dateStr}
tags: [${tagsStr}]
draft: false
---

${content}
`
}

function validateToken(authHeader: string | undefined): boolean {
  if (!authHeader || !THOUGHT_API_TOKEN) return false
  return authHeader.replace('Bearer ', '').trim() === THOUGHT_API_TOKEN
}

async function createFileOnGitHub(
  filePath: string,
  content: string,
  commitMessage: string,
): Promise<GitHubCreateFileResponse> {
  const { owner, repo } = getContentRepo()

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
    {
      method: 'PUT',
      headers: githubHeaders(),
      body: JSON.stringify({
        message: commitMessage,
        content: Buffer.from(content).toString('base64'),
        branch: CONTENT_BRANCH,
      }),
    },
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`GitHub API error: ${response.status} - ${errorText}`)
  }

  return response.json()
}

function getApiDocs() {
  return {
    name: 'Astro Doge Add Thought API',
    version: '1.0.0',
    description:
      'Create a new thought entry and commit it to your content repo.',
    endpoint: '/api/add-thought',
    method: 'POST',
    site: SITE_URL,
    timeZone: SITE_TIMEZONE,
    contentDirectory: THOUGHTS_CONTENT_DIR,
    requiredEnv: [
      'GITHUB_TOKEN',
      'CONTENT_REPO or GITHUB_REPO',
      'CONTENT_BRANCH',
      'THOUGHT_API_TOKEN',
    ],
  }
}

export default async function handler(
	req: VercelRequest,
	res: VercelResponse,
) {
  setCorsHeaders(req, res, 'GET, POST, OPTIONS', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Max-Age', '86400')
    return res.status(204).end()
  }

  if (req.method === 'GET') {
    return res.status(200).json(getApiDocs())
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (
    !GITHUB_TOKEN ||
    !THOUGHT_API_TOKEN ||
    !hasAnyEnv('CONTENT_REPO', 'GITHUB_REPO')
  ) {
    return res.status(500).json({
      success: false,
      error: 'Server configuration error',
      message: 'Missing required environment variables for /api/add-thought',
    })
  }

  if (!validateToken(req.headers.authorization)) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: '无效的 API Token',
    })
  }

  try {
    const body = req.body as ThoughtRequest
    if (!body.content || body.content.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: '内容不能为空',
      })
    }

    const now = new Date()
    const { year, month, day } = getPathPartsInTimeZone(now, SITE_TIMEZONE)
    const dateStr = toZonedISOString(now, SITE_TIMEZONE)
    const name = sanitizeName(body.name || '') || randomId()
    const tags = body.tags?.filter(Boolean) || ['日常']
    const content = body.content.trim()

    const filename = `${day}_${name}.md`
    const filePath = `${THOUGHTS_CONTENT_DIR}/${year}/${month}/${filename}`
    const fileContent = generateThoughtContent(content, tags, dateStr)
    const shortContent =
      content.length > 30 ? `${content.slice(0, 30)}...` : content
    const commitMessage = `feat(thoughts): add ${shortContent}`

    const result = await createFileOnGitHub(
      filePath,
      fileContent,
      commitMessage,
    )

    return res.status(201).json({
      success: true,
      message: '碎碎念创建成功！',
      data: {
        filePath,
        filename,
        date: dateStr,
        tags,
        content,
        github: {
          commitSha: result.commit.sha,
          commitUrl: result.commit.html_url,
          fileUrl: result.content.html_url,
        },
      },
    })
  } catch (error) {
    console.error('Error creating thought:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
