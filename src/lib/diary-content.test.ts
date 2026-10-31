import { expect, it } from 'vitest'
import { hasDiaryContent } from './diary-content'
import type { DiaryEntry } from '../types'
const blank: DiaryEntry = {
  id: 'new',
  date: '2026-10-17',
  mood: 3,
  condition: 3,
  answers: {},
  tags: [],
  guess: '今日は、自分のペースで一日を過ごした',
  body: '',
  tomorrow: '',
  imageIds: [],
  createdAt: '',
  updatedAt: '',
}
it('does not count defaults, whitespace, formatting or skipped questions as input', () => {
  expect(hasDiaryContent(blank)).toBe(false)
  expect(
    hasDiaryContent({
      ...blank,
      body: ' \n ',
      tomorrow: '　',
      answers: { mood: 'skip' },
    }),
  ).toBe(false)
  expect(
    hasDiaryContent({
      ...blank,
      body:
        'daylog-richtext-v1:' +
        JSON.stringify({ html: '<h2><br></h2>', text: '\n' }),
    }),
  ).toBe(false)
})
it('counts written text, tomorrow, photos and explicit answers independently', () => {
  const cases: Partial<DiaryEntry>[] = [
    { tags: ['旅行'] },
    { body: '日記' },
    { environment: { place: '東京都 千代田区', recordedAt: '' } },
    { guess: '自分で付けたタイトル' },
    { tomorrow: '散歩' },
    { imageIds: ['photo'] },
    { answers: { mood: '3' } },
    { answers: { exercise: 'no' } },
  ]
  for (const changes of cases) {
    expect(hasDiaryContent({ ...blank, ...changes })).toBe(true)
  }
  expect(
    hasDiaryContent({
      ...blank,
      body:
        'daylog-richtext-v1:' +
        JSON.stringify({ html: '<b>日記</b>', text: '日記' }),
    }),
  ).toBe(true)
})
