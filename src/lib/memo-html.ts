import { isInlineImage, sanitizeHtml } from './html-sanitizer'

const memoTags = new Set([
  'P',
  'DIV',
  'BR',
  'STRONG',
  'B',
  'EM',
  'I',
  'U',
  'S',
  'H2',
  'H3',
  'UL',
  'OL',
  'LI',
  'BLOCKQUOTE',
])
export function cleanMemoHtml(html: string): string {
  return sanitizeHtml(html, { tags: memoTags, inlineImages: true })
}

// Separate legacy inline images without changing the stored document until save.
export function splitMemoContent(html: string, attachments: string[] = []) {
  const container = document.createElement('div')
  container.innerHTML = cleanMemoHtml(html)
  const images = attachments.filter(isInlineImage)
  container.querySelectorAll('img').forEach((img) => {
    images.push(img.getAttribute('src')!)
    img.remove()
  })
  return { html: container.innerHTML, images }
}

export function memoPreviewText(html: string): string {
  const container = document.createElement('div')
  container.innerHTML = cleanMemoHtml(html)
  container
    .querySelectorAll('br')
    .forEach((lineBreak) => lineBreak.replaceWith(' '))
  container
    .querySelectorAll('p, div, h2, h3, li, blockquote')
    .forEach((block) => block.append(' '))
  return (container.textContent || '').replace(/\s+/g, ' ').trim()
}
