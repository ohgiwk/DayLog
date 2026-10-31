// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { memoPreview } from './memo-html'

describe('memo list text preview', () => {
  it('shows readable text from editor HTML without merging paragraphs or list items', () => {
    expect(
      memoPreview(
        '<div>週末の<b>予定</b></div><div>公園<br>喫茶店</div><ul><li>散歩</li><li>読書</li></ul>',
      ).text,
    ).toBe('週末の予定 公園 喫茶店 散歩 読書')
  })
  it('keeps plain text and produces an empty preview for image-only memos', () => {
    expect(memoPreview('以前のメモ\n続き').text).toBe('以前のメモ 続き')
    expect(
      memoPreview('<div><br></div><img src="data:image/png;base64,YQ==">').text,
    ).toBe('')
  })
})

it('extracts text and a thumbnail together while preferring explicit attachments', () => {
  const inline = 'data:image/png;base64,YQ=='
  const attachment = 'data:image/png;base64,Yg=='
  const html = `<div>週末の<b>予定</b></div><img src="${inline}">`
  expect(memoPreview(html, [attachment])).toEqual({
    text: '週末の予定',
    image: attachment,
  })
  expect(memoPreview(html)).toEqual({ text: '週末の予定', image: inline })
})
