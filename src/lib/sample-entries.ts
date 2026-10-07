import type { DiaryEntry } from '../types'

// Older versions did not mark generated examples. Match their full, untouched
// content rather than a title alone so that edited diaries remain intact.
const examples = [
 { mood: 4, condition: 3, tag: '散歩', body: '夕方の風が心地よかった。' },
 { mood: 3, condition: 4, tag: '仕事・勉強', body: '集中して作業を進められた。' },
 { mood: 5, condition: 3, tag: '人と会った', body: '久しぶりにゆっくり話せた。' },
 { mood: 2, condition: 4, tag: 'おうち時間', body: '夕方の風が心地よかった。' },
 { mood: 4, condition: 3, tag: '買い物', body: '集中して作業を進められた。' },
 { mood: 3, condition: 4, tag: '運動', body: '久しぶりにゆっくり話せた。' },
 { mood: 5, condition: 3, tag: '外出', body: '夕方の風が心地よかった。' },
]
export function isUntouchedSample(entry: DiaryEntry): boolean {
 return entry.guess === '穏やかな一日を過ごした'
  && entry.guessResult === 'correct'
  && entry.tomorrow === '少し早く休む'
  && entry.answers != null && Object.keys(entry.answers).length === 0
  && Array.isArray(entry.imageIds) && entry.imageIds.length === 0
  && !entry.thumbnailImageId
  && typeof entry.createdAt === 'string' && entry.createdAt === entry.updatedAt
  && Array.isArray(entry.tags) && entry.tags.length === 1
  && examples.some(example => entry.mood === example.mood && entry.condition === example.condition && entry.tags[0] === example.tag && entry.body === example.body)
}
