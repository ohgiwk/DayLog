const prefix = 'daylog-richtext-v1:'

export function readRichText(body: string): { html?: string; text: string } {
 if (body.startsWith(prefix)) {
  try {
   const value = JSON.parse(body.slice(prefix.length))
   if (typeof value.html === 'string' && typeof value.text === 'string') return value
  } catch { /* Preserve malformed or legacy text verbatim. */ }
 }
 return { text: body }
}

// Only formatting elements survive; attributes, URLs and executable content are discarded.
export function sanitizeRichText(html: string): string {
 const source = document.createElement('template')
 source.innerHTML = html
 const output = document.createElement('div')
 const allowed = new Set(['P', 'DIV', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'UL', 'OL', 'LI', 'H2', 'H3', 'H4', 'FONT', 'S', 'CODE', 'BLOCKQUOTE'])
 const blocked = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'SVG', 'MATH', 'TEMPLATE'])
 function copy(node: Node, parent: Node) {
  if (node.nodeType === Node.TEXT_NODE) { parent.appendChild(document.createTextNode(node.textContent || '')); return }
  if (!(node instanceof HTMLElement) || blocked.has(node.tagName)) return
  const target = allowed.has(node.tagName) ? document.createElement(node.tagName.toLowerCase()) : parent
  if (target !== parent) {
   if (node.tagName === 'FONT' && ['2', '3', '5'].includes(node.getAttribute('size') || '')) (target as HTMLElement).setAttribute('size', node.getAttribute('size')!)
   parent.appendChild(target)
  }
  for (const child of node.childNodes) copy(child, target)
 }
 for (const child of source.content.childNodes) copy(child, output)
 return output.innerHTML
}

export function writeRichText(html: string, text: string): string {
 return text.trim() ? prefix + JSON.stringify({ html: sanitizeRichText(html), text }) : ''
}
