// Rebuild markup using an allowlist, including on reload and clipboard input.
export function cleanMemoHtml(html: string): string {
 const source = new DOMParser().parseFromString(html, 'text/html')
 const result = document.createElement('div')
 const allowed = new Set(['P', 'DIV', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'H2', 'H3', 'UL', 'OL', 'LI', 'BLOCKQUOTE'])
 function copy(node: Node, parent: HTMLElement) {
  if (node.nodeType === Node.TEXT_NODE) { parent.append(document.createTextNode(node.textContent || '')); return }
  if (!(node instanceof HTMLElement)) return
  if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'SVG'].includes(node.tagName)) return
  if (node.tagName === 'IMG') {
   const src = node.getAttribute('src') || ''
   if (/^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(src)) {
    const img = document.createElement('img'); img.src = src; img.alt = node.getAttribute('alt') || 'メモの画像'; parent.append(img)
   }
   return
  }
  const target = allowed.has(node.tagName) ? document.createElement(node.tagName.toLowerCase()) : parent
  if (target !== parent) parent.append(target)
  node.childNodes.forEach(child => copy(child, target))
 }
 source.body.childNodes.forEach(node => copy(node, result))
 return result.innerHTML
}
