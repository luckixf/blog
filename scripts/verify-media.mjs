import assert from 'node:assert/strict'
import { createMarkdownProcessor } from '@astrojs/markdown-remark'
import media from '../src/lib/rehype/responsive-media.mjs'

const markdown = await createMarkdownProcessor({
  syntaxHighlight: false,
  rehypePlugins: [media],
})
const { code } = await markdown.render(`
<div style="display:flex;gap:10px"><img src="https://example.com/photo.jpg" alt="原图" style="max-width: 220px; height: auto"></div>

![Markdown 图片](https://example.com/markdown.jpg)

<a href="https://example.com/original"><img src="https://example.com/linked.jpg" loading="eager"></a>
`)
assert.match(code, /max-width: min\(100%, 220px\)/)
assert.equal((code.match(/decoding="async"/g) || []).length, 3)
assert.equal((code.match(/loading="lazy"/g) || []).length, 2)
assert.match(code, /loading="eager"/)
assert.match(code, /href="https:\/\/example.com\/original"/)
assert.match(code, /src="https:\/\/example.com\/photo.jpg"/)
assert.match(code, /<div style="display:flex;gap:10px">/)
console.log(
  'Media rendering verified: raw HTML, Markdown, original URLs, dimensions and explicit loading preference.',
)
