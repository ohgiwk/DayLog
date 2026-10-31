import { sanitizeHtml } from './html-sanitizer'

const prefix = 'daylog-richtext-v1:'

export function readRichText(body: string): { html?: string; text: string } {
  if (body.startsWith(prefix)) {
    try {
      const value = JSON.parse(body.slice(prefix.length))
      if (typeof value.html === 'string' && typeof value.text === 'string')
        return value
    } catch {
      /* Preserve malformed or legacy text verbatim. */
    }
  }
  return { text: body }
}

const richTextTags = new Set([
  'P',
  'DIV',
  'BR',
  'STRONG',
  'B',
  'EM',
  'I',
  'U',
  'UL',
  'OL',
  'LI',
  'H2',
  'H3',
  'H4',
  'FONT',
  'S',
  'CODE',
  'BLOCKQUOTE',
])
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, { tags: richTextTags, fontSizes: ['2', '3', '5'] })
}

export function writeRichText(html: string, text: string): string {
  return text.trim()
    ? prefix + JSON.stringify({ html: sanitizeRichText(html), text })
    : ''
}
