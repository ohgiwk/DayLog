const blockedTags = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'SVG', 'MATH', 'TEMPLATE'])
export function isInlineImage(source: string): boolean {
 return /^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(source)
}
interface HtmlPolicy {
 tags: ReadonlySet<string>
 inlineImages?: boolean
 fontSizes?: readonly string[]
}

// Rebuild from inert markup. Only policy-approved tags and attributes are copied;
// unknown containers retain their text, while executable subtrees are dropped.
export function sanitizeHtml(html: string, policy: HtmlPolicy): string {
 const source = document.createElement('template')
 source.innerHTML = html
 const output = document.createElement('div')
 function copy(node: Node, parent: Node) {
  if (node.nodeType === Node.TEXT_NODE) { parent.appendChild(document.createTextNode(node.textContent || '')); return }
  if (!(node instanceof HTMLElement) || blockedTags.has(node.tagName)) return
  if (node.tagName === 'IMG' && policy.inlineImages) {
   const src = node.getAttribute('src') || ''
   if (isInlineImage(src)) {
    const image = document.createElement('img')
    image.src = src; image.alt = node.getAttribute('alt') || 'メモの画像'
    parent.appendChild(image)
   }
   return
  }
  const target = policy.tags.has(node.tagName) ? document.createElement(node.tagName.toLowerCase()) : parent
  if (target !== parent) {
   const size = node.getAttribute('size') || ''
   if (node.tagName === 'FONT' && policy.fontSizes?.includes(size)) (target as HTMLElement).setAttribute('size', size)
   parent.appendChild(target)
  }
  node.childNodes.forEach(child => copy(child, target))
 }
 source.content.childNodes.forEach(node => copy(node, output))
 return output.innerHTML
}
