// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { cleanMemoHtml, splitMemoContent } from './memo-html'
import { readRichText, sanitizeRichText, writeRichText } from './rich-text'

for (const [name, clean] of [['diary', sanitizeRichText], ['memo', cleanMemoHtml]] as const) {
 describe(`${name} HTML sanitization`, () => {
  it('preserves formatting and plain text while dropping attributes and executable content', () => {
   expect(clean('<div onclick="evil()"><h2 style="color:red">見出し</h2><p><strong>本文</strong><br><a href="javascript:evil()">リンク文字</a></p><script>evil()</script><iframe>hidden</iframe><svg><text>svg</text></svg><math><mtext>math</mtext></math><template>hidden</template></div>'))
    .toBe('<div><h2>見出し</h2><p><strong>本文</strong><br>リンク文字</p></div>')
  })
  it('remains safe and stable when pasted markup is malformed or sanitized twice', () => {
   const once = clean('<p>本文<b>太字</p><img src=x onerror="evil()"><!--comment--><style>body{display:none}</style>')
   expect(clean(once)).toBe(once)
   expect(once).not.toMatch(/onerror|script|style|<!--|src=/)
   expect(once).toContain('太字')
  })
 })
}

it('allows only supported diary font sizes and removes diary images', () => {
 expect(sanitizeRichText('<font size="5" color="red">大</font><font size="99">標準</font><img src="data:image/png;base64,AAAA">'))
  .toBe('<font size="5">大</font><font>標準</font>')
})
it('round-trips rich text and preserves the empty-body contract', () => {
 expect(readRichText(writeRichText('<b onclick="evil()">日記</b>', '日記'))).toEqual({ html: '<b>日記</b>', text: '日記' })
 expect(writeRichText('<p><br></p>', ' \n')).toBe('')
})
it('keeps safe inline memo photos but blocks remote, SVG and executable sources', () => {
 expect(cleanMemoHtml('<img src="data:image/png;base64,AAAA" alt="写真" onload="evil()"><img src="https://example.com/tracker"><img src="data:image/svg+xml;base64,AAAA"><img src="javascript:evil()">'))
  .toBe('<img src="data:image/png;base64,AAAA" alt="写真">')
})
it('separates legacy inline photos and filters attachments without mutating the original list', () => {
 const attachments = ['data:image/webp;base64,BBBB', 'https://example.com/tracker']
 const result = splitMemoContent('<p>本文<img src="data:image/png;base64,AAAA"></p>', attachments)
 expect(result).toEqual({ html: '<p>本文</p>', images: ['data:image/webp;base64,BBBB', 'data:image/png;base64,AAAA'] })
 expect(attachments).toHaveLength(2)
 expect(splitMemoContent(result.html, result.images)).toEqual(result)
})
