import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(join(directory, entry.name))
      : [join(directory, entry.name)],
  )
}
function entries(collection) {
  return walk(join(root, 'src/content', collection))
    .filter((file) => /\.mdx?$/.test(file))
    .map((file) => ({
      file,
      frontmatter: readFileSync(file, 'utf8').split(/^---\s*$/m)[1] || '',
    }))
    .filter((entry) => !/^draft:\s*true\s*$/m.test(entry.frontmatter))
}
function scalar(frontmatter, key) {
  const value = frontmatter
    .match(new RegExp('^' + key + ':\\s*(.+)$', 'm'))?.[1]
    ?.trim()
  return value?.replace(/^(['"])(.*)\1$/, '$2')
}
function builtPath(url) {
  const pathname = decodeURIComponent(
    new URL(url, 'https://blog.luckixf.top').pathname,
  )
  const path = resolve(dist, '.' + pathname)
  assert(
    path.startsWith(dist + sep) || path === dist,
    'Route escapes dist: ' + url,
  )
  return existsSync(path) && statSync(path).isFile()
    ? path
    : join(path, 'index.html')
}
assert(existsSync(dist), 'Run bun run build before verifying content.')
const posts = entries('posts')
const thoughts = entries('thoughts')
const search = JSON.parse(readFileSync(join(dist, 'api/search.json'), 'utf8'))
assert.equal(
  search.filter((item) => item.type === 'post').length,
  posts.length,
  'Search must contain every published post',
)
assert.equal(
  search.filter((item) => item.type === 'thought').length,
  thoughts.length,
  'Search must contain every published thought',
)
for (const post of posts) {
  const id = relative(join(root, 'src/content/posts'), post.file)
    .split(sep)
    .join('/')
    .replace(/\.mdx?$/, '')
    .toLowerCase()
  const slug = scalar(post.frontmatter, 'slug') || id
  assert(
    existsSync(join(dist, slug, 'index.html')),
    'Missing original post URL: /' + slug,
  )
  assert(
    search.some((item) => item.url === '/' + slug),
    'Post absent from search: ' + slug,
  )
}
for (const route of [
  '',
  'posts',
  'thoughts',
  'thoughts/new',
  'about',
  'friends',
  'messages',
  'offline',
]) {
  assert(existsSync(join(dist, route, 'index.html')), 'Missing page: /' + route)
}
const thoughtFiles = [
  join(dist, 'thoughts/index.html'),
  ...walk(join(dist, 'thoughts/chunks')).filter((file) =>
    file.endsWith('.html'),
  ),
]
const ids = new Set()
for (const file of thoughtFiles) {
  const html = readFileSync(file, 'utf8')
  for (const match of html.matchAll(/<li\b[^>]*\bdata-thought-item[^>]*>/g)) {
    const id = match[0].match(/\sid="(\d+)"/)?.[1]
    assert(id, 'Thought missing its original anchor')
    assert(!ids.has(id), 'Duplicate thought: ' + id)
    ids.add(id)
  }
}
assert.equal(
  ids.size,
  thoughts.length,
  'All thoughts must be present in the paginated output',
)
for (let id = 1; id <= thoughts.length; id++)
  assert(ids.has(String(id)), 'Missing thought #' + id)
const rss = readFileSync(join(dist, 'rss.xml'), 'utf8')
assert.equal(
  [...rss.matchAll(/<item>/g)].length,
  posts.length,
  'RSS must include every published article',
)
let checkedLinks = 0
const htmlFiles = walk(dist).filter((file) => file.endsWith('.html'))
for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8')
  assert(
    !html.includes('kawaii-theme-layer'),
    'Old decorative layout still present: ' + file,
  )
  for (const match of html.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
    const url = match[1]
    if (
      url.startsWith('//') ||
      (url.startsWith('/api/') && url !== '/api/search.json')
    )
      continue
    assert(
      existsSync(builtPath(url)),
      'Broken internal resource ' + url + ' in ' + relative(dist, file),
    )
    checkedLinks++
  }
}
console.log(
  JSON.stringify(
    {
      posts: posts.length,
      thoughts: thoughts.length,
      searchEntries: search.length,
      preservedThoughtAnchors: ids.size,
      htmlPages: htmlFiles.length,
      checkedLinks,
      status: 'passed',
    },
    null,
    2,
  ),
)
