import { visit } from 'unist-util-visit'
import rehypeRaw from 'rehype-raw'

// Apply before HTML reaches the browser, including old inline HTML in Markdown.
// Keep the author's image URLs and preferred sizes, but constrain them to the screen.
export default function responsiveMedia() {
  return (tree) => {
    // Astro parses raw HTML after user plugins by default. Parse it here so
    // older HTML galleries receive the same attributes as Markdown images.
    tree = rehypeRaw({
      passThrough: [
        'mdxjsEsm',
        'mdxFlowExpression',
        'mdxTextExpression',
        'mdxJsxFlowElement',
        'mdxJsxTextElement',
      ],
    })(tree)
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'img') return
      node.properties ||= {}
      node.properties.loading ||= 'lazy'
      node.properties.decoding = 'async'
      const style = node.properties.style
      if (typeof style === 'string') {
        node.properties.style = style.replace(
          /max-width\s*:\s*(\d+(?:\.\d+)?(?:px|rem|em))/gi,
          'max-width: min(100%, $1)',
        )
      }
    })
    visit(tree, (node) => {
      if (
        !['mdxJsxFlowElement', 'mdxJsxTextElement'].includes(node.type) ||
        node.name !== 'img'
      )
        return
      for (const [name, value] of [
        ['loading', 'lazy'],
        ['decoding', 'async'],
      ]) {
        if (!node.attributes.some((attribute) => attribute.name === name)) {
          node.attributes.push({ type: 'mdxJsxAttribute', name, value })
        }
      }
    })
    return tree
  }
}
