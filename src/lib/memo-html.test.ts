// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { memoPreviewText } from './memo-html'

describe('memo list text preview', () => {
  it('shows readable text from editor HTML without merging paragraphs or list items', () => {
    expect(
      memoPreviewText(
        '<div>週末の<b>予定</b></div><div>公園<br>喫茶店</div><ul><li>散歩</li><li>読書</li></ul>',
      ),
    ).toBe('週末の予定 公園 喫茶店 散歩 読書')
  })
  it('decodes entities once and removes executable content', () => {
    expect(
      memoPreviewText(
        '<p>A &amp; B&nbsp; &lt;好きなもの&gt;</p><script>alert(1)</script><style>body{color:red}</style>',
      ),
    ).toBe('A & B <好きなもの>')
  })
  it('keeps plain text and produces an empty preview for image-only memos', () => {
    expect(memoPreviewText('以前のメモ\n続き')).toBe('以前のメモ 続き')
    expect(
      memoPreviewText('<div><br></div><img src="data:image/png;base64,YQ==">'),
    ).toBe('')
  })
})
