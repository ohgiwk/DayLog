import { describe, expect, it } from 'vitest'
import { readRichText } from './rich-text'

describe('diary rich text compatibility', () => {
  it('keeps existing multiline text and literal markup unchanged', () => {
    const body = '以前の日記\n<strong>文字として残す</strong>'
    expect(readRichText(body)).toEqual({ text: body })
  })
  it('provides plain text for lists and conflict previews', () => {
    const content = {
      html: '<ul><li><b>散歩</b></li><li>読書</li></ul>',
      text: '散歩\n読書',
    }
    expect(
      readRichText('daylog-richtext-v1:' + JSON.stringify(content)),
    ).toEqual(content)
  })
  it('preserves invalid data instead of dropping a diary body', () => {
    for (const value of ['broken', 'null', '{"html":123,"text":"日記"}']) {
      const body = 'daylog-richtext-v1:' + value
      expect(readRichText(body)).toEqual({ text: body })
    }
  })
})
