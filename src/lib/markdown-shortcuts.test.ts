import { expect, it } from 'vitest'
import { blockShortcut, inlineShortcut } from './markdown-shortcuts'
it('converts completed block markers only', () => {
 expect(blockShortcut('# ')).toEqual({ command: 'formatBlock', value: 'h2' })
 expect(blockShortcut('### ')).toEqual({ command: 'formatBlock', value: 'h4' })
 expect(blockShortcut('- ')?.command).toBe('insertUnorderedList')
 expect(blockShortcut('1. ')?.command).toBe('insertOrderedList')
 expect(blockShortcut('> ')?.value).toBe('blockquote')
 for (const text of ['#', '本文 # ', '2026. ', '普通の文章']) expect(blockShortcut(text)).toBeUndefined()
})
it('converts inline markers while escaping HTML', () => {
 expect(inlineShortcut('今日は**いい日**')).toEqual({ start: 3, html: '<strong>いい日</strong>' })
 expect(inlineShortcut('*強調*')?.html).toBe('<em>強調</em>')
 expect(inlineShortcut('~~取消~~')?.html).toBe('<s>取消</s>')
 expect(inlineShortcut('`<img>`')?.html).toBe('<code>&lt;img&gt;</code>')
 expect(inlineShortcut('**途中')).toBeUndefined()
 expect(inlineShortcut('word_with_underscores_')).toBeUndefined()
 expect(inlineShortcut('\\**そのまま**')).toBeUndefined()
})
