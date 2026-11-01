export function excerpt(body = '') {
  return body
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/[#*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
}

export function firstImage(body = '') {
  const source =
    body.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1] ||
    body.match(/!\[[^\]]*\]\(([^)\s]+)(?:\s[^)]*)?\)/)?.[1]
  return source && /^(https?:\/\/|\/(?!\/))/.test(source) ? source : undefined
}
