import mediumZoom from 'medium-zoom/dist/pure/index.js'

// Shared by initial content and cards appended by the thoughts feed.
const selector = '.post-content img, .thought-content img, .home-thought-image'
// medium-zoom owns global listeners; reuse one instance across Astro navigation.
let sharedZoom: ReturnType<typeof mediumZoom> | undefined
export function setupMedia() {
  const controller = new AbortController()
  const options = { signal: controller.signal }
  const zoom = (sharedZoom ??= mediumZoom({
    margin: 20,
    background: 'rgba(15, 20, 28, 0.94)',
    scrollOffset: 80,
  }))
  const close = document.getElementById(
    'image-zoom-close',
  ) as HTMLButtonElement | null
  const prepared = new WeakSet<HTMLImageElement>()
  const timers = new Map<HTMLImageElement, ReturnType<typeof setTimeout>>()
  const notices = new Map<HTMLImageElement, HTMLElement>()
  let active: HTMLImageElement | null = null
  let opening: Promise<void> | undefined
  let finishOpening: (() => void) | undefined

  function clearTimer(img: HTMLImageElement) {
    clearTimeout(timers.get(img))
    timers.delete(img)
  }
  function removeNotice(img: HTMLImageElement) {
    notices.get(img)?.remove()
    notices.delete(img)
  }
  function notice(img: HTMLImageElement, slow: boolean) {
    if (!img.isConnected) return
    removeNotice(img)
    img.dataset.mediaState = slow ? 'slow' : 'error'
    const box = document.createElement('span')
    box.className = 'media-notice'
    box.setAttribute('role', 'status')
    const message = document.createElement('span')
    message.textContent = slow ? '图片加载较慢' : '图片暂时无法加载'
    const retry = document.createElement('button')
    retry.type = 'button'
    retry.textContent = '重试'
    const original = document.createElement('a')
    original.href = img.currentSrc || img.src
    original.target = '_blank'
    original.rel = 'noopener noreferrer'
    original.textContent = '查看原图'
    retry.addEventListener(
      'click',
      (event) => {
        event.preventDefault()
        event.stopPropagation()
        removeNotice(img)
        img.dataset.mediaState = 'loading'
        img.loading = 'eager'
        const src = img.getAttribute('src')
        img.removeAttribute('src')
        if (src) img.setAttribute('src', src)
        startTimer(img)
      },
      options,
    )
    box.append(message, retry, original)
    // Notices must not introduce nested links in linked images or home cards.
    const anchor = img.closest('a')
    ;(anchor || img).after(box)
    notices.set(img, box)
  }
  function startTimer(img: HTMLImageElement) {
    clearTimer(img)
    timers.set(
      img,
      setTimeout(() => notice(img, true), 15000),
    )
  }
  const viewport = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const img = entry.target as HTMLImageElement
        if (entry.isIntersecting) {
          if (!img.complete) startTimer(img)
          viewport.unobserve(img)
        }
      })
    },
    { rootMargin: '200px' },
  )

  function prepare(img: HTMLImageElement) {
    if (prepared.has(img) || !img.getAttribute('src')) return
    prepared.add(img)
    img.decoding = 'async'
    img.dataset.mediaState = 'loading'
    function loaded() {
      if (!img.naturalWidth) return
      clearTimer(img)
      removeNotice(img)
      img.dataset.mediaState = 'loaded'
      // Linked images retain their original navigation behavior.
      if (!img.closest('a')) {
        zoom.attach(img)
        img.tabIndex = 0
        img.setAttribute('role', 'button')
        img.setAttribute('aria-label', '放大图片：' + (img.alt || '文章配图'))
        img.setAttribute('aria-expanded', 'false')
      }
    }
    img.addEventListener('load', loaded, options)
    img.addEventListener(
      'error',
      () => {
        clearTimer(img)
        zoom.detach(img)
        notice(img, false)
      },
      options,
    )
    img.addEventListener(
      'keydown',
      (event) => {
        if (
          !img.closest('a') &&
          img.dataset.mediaState === 'loaded' &&
          (event.key === 'Enter' || event.key === ' ')
        ) {
          event.preventDefault()
          void zoom.open({ target: img })
        }
      },
      options,
    )
    if (img.complete && img.naturalWidth) loaded()
    else if (img.complete) notice(img, false)
    else viewport.observe(img)
  }
  function scan(root: ParentNode) {
    if (root instanceof HTMLImageElement && root.matches(selector))
      prepare(root)
    root.querySelectorAll<HTMLImageElement>(selector).forEach(prepare)
  }
  scan(document)
  const observer = new MutationObserver((records) => {
    for (const record of records)
      for (const node of record.addedNodes) {
        if (
          node instanceof Element &&
          !node.classList.contains('medium-zoom-image--opened')
        )
          scan(node)
      }
  })
  const main = document.getElementById('main-content')
  if (main) observer.observe(main, { childList: true, subtree: true })

  const onOpen = (event: Event) => {
    finishOpening?.()
    opening = undefined
    active = event.target as HTMLImageElement
    active.setAttribute('aria-expanded', 'true')
    if (close) {
      close.hidden = false
      close.focus({ preventScroll: true })
    }
  }
  const onOpening = () => {
    opening = new Promise<void>((resolve) => {
      finishOpening = resolve
    })
  }
  const onClosed = () => {
    if (close) close.hidden = true
    active?.setAttribute('aria-expanded', 'false')
    active?.focus({ preventScroll: true })
    active = null
  }
  zoom.on('open', onOpening)
  zoom.on('opened', onOpen)
  zoom.on('closed', onClosed)
  close?.addEventListener(
    'click',
    () => {
      void zoom.close()
    },
    options,
  )
  // A single close control and listeners per page, including after Astro navigation.
  async function closeBeforeNavigation() {
    await opening
    await zoom.close()
  }
  return {
    close: closeBeforeNavigation,
    destroy: () => {
      controller.abort()
      observer.disconnect()
      viewport.disconnect()
      timers.forEach((timer) => clearTimeout(timer))
      notices.forEach((node) => node.remove())
      zoom.off('open', onOpening)
      zoom.off('opened', onOpen)
      zoom.off('closed', onClosed)
      const images = zoom.getImages()
      void zoom.close().then(() => {
        if (images.length) zoom.detach(...images)
      })
      if (close) close.hidden = true
    },
  }
}
