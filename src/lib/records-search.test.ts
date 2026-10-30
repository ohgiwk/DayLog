// @vitest-environment jsdom
import { expect, it } from 'vitest'
import { filterRecords } from './records-search'
import { writeRichText } from './rich-text'
import type { DiaryEntry } from '../types'
const entries = [
 { id:'a', date:'2026-10-31', guess:'旅行の日', body:writeRichText('<p>京都で Cafe</p>', '京都で Cafe'), tomorrow:'読書', tags:['旅行','秋'], environment:{place:'京都市'} },
 { id:'b', date:'2026-10-30', guess:'家で休む', body:'読書した', tomorrow:'', tags:['おうち時間'] },
] as DiaryEntry[]
it('searches visible rich text, title, tomorrow, place and date with normalized AND terms', () => {
 expect(filterRecords(entries, '京都 ＣＡＦＥ', '').map(e=>e.id)).toEqual(['a'])
 for (const query of ['旅行の日','読書','京都市','2026-10-31']) expect(filterRecords(entries,query,'')).not.toHaveLength(0)
 expect(filterRecords(entries, '<p>', '')).toEqual([])
 expect(filterRecords(entries, '京都 休む', '')).toEqual([])
})
it('combines an exact tag filter with text and preserves ordering', () => {
 expect(filterRecords(entries, '', '')).toEqual(entries)
 expect(filterRecords(entries, '読書', '旅行').map(e=>e.id)).toEqual(['a'])
 expect(filterRecords(entries, '', '旅')).toEqual([])
 expect(filterRecords(entries, '京都', 'おうち時間')).toEqual([])
})
