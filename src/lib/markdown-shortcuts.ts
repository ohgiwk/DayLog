export function blockShortcut(text: string): { command: string; value?: string } | undefined {
 if (/^#{1,3} $/.test(text)) return { command: 'formatBlock', value: `h${text.trim().length + 1}` }
 if (/^[-*+] $/.test(text)) return { command: 'insertUnorderedList' }
 if (/^1[.)] $/.test(text)) return { command: 'insertOrderedList' }
 if (text === '> ') return { command: 'formatBlock', value: 'blockquote' }
}

export function inlineShortcut(text: string): { start: number; html: string } | undefined {
 const patterns: [RegExp, string][] = [
  [/\*\*([^*\n]+)\*\*$/, 'strong'], [/__([^_\n]+)__$/, 'strong'],
  [/~~([^~\n]+)~~$/, 's'], [/`([^`\n]+)`$/, 'code'],
  [/(?:^|(?<=\s))\*([^*\n]+)\*$/, 'em'], [/(?:^|(?<=\s))_([^_\n]+)_$/, 'em'],
 ]
 for (const [pattern, tag] of patterns) {
  const match = pattern.exec(text)
  if (!match || match.index === undefined) continue
  // A backslash keeps a marker literal.
  if (match.index > 0 && text[match.index - 1] === '\\') continue
  const content = match[1]!.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  return { start: match.index, html: `<${tag}>${content}</${tag}>` }
 }
}
