import type { VercelRequest, VercelResponse } from '@vercel/node'

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

export function getSiteUrl(): string {
  const raw = process.env.SITE_URL?.trim()
  return raw ? trimTrailingSlash(raw) : 'https://example.com'
}

export function getAllowedOrigin(req: VercelRequest): string {
  const configured = process.env.SITE_URL?.trim()
  if (configured) {
    try {
      return new URL(configured).origin
    } catch {
      return configured
    }
  }

  const origin = req.headers.origin?.trim()
  return origin || '*'
}

export function setCorsHeaders(
  req: VercelRequest,
  res: VercelResponse,
  methods: string,
  headers = 'Content-Type',
): void {
  res.setHeader('Access-Control-Allow-Origin', getAllowedOrigin(req))
  res.setHeader('Access-Control-Allow-Methods', methods)
  res.setHeader('Access-Control-Allow-Headers', headers)
}

export function hasAnyEnv(...envNames: string[]): boolean {
  return envNames.some((envName) => Boolean(process.env[envName]?.trim()))
}

export function getRepoFromEnv(...envNames: string[]): {
  fullName: string
  owner: string
  repo: string
} {
  const fullName = envNames
    .map((envName) => process.env[envName]?.trim())
    .find(Boolean)

  if (!fullName) {
    throw new Error(`${envNames[0]} not configured`)
  }

  const [owner, repo] = fullName.split('/')
  if (!owner || !repo) {
    throw new Error(`${envNames[0]} must use the format "owner/repo"`)
  }

  return { fullName, owner, repo }
}

export function buildGitHubHeaders(
  token: string | undefined,
  userAgent: string,
  includeJson = false,
): Record<string, string> {
  if (!token) {
    throw new Error('GITHUB_TOKEN not configured')
  }

  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': userAgent,
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
  }
}
