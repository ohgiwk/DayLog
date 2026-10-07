import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import type { DiaryEntry } from '../types'
const images = vi.hoisted(() => ({ delete: vi.fn() }))
vi.mock('../lib/image-repository', () => ({ imageRepository: images }))
let data: Map<string, string>
let write: ReturnType<typeof vi.fn>
beforeEach(() => {
 vi.resetModules()
 data = new Map([['daylog:v1:entries', '[]']])
 write = vi.fn((key: string, value: string) => { data.set(key, value) })
 vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: write })
 images.delete.mockReset().mockResolvedValue(undefined)
})
afterEach(() => vi.unstubAllGlobals())
function entry(body = ''): DiaryEntry {
 return { id: 'diary-1', date: '2026-10-06', mood: 3, condition: 3, answers: {}, tags: [], guess: '今日の記録', body, tomorrow: '', imageIds: [], createdAt: '2026-10-06T00:00:00Z', updatedAt: '2026-10-06T00:00:00Z' }
}
describe('automatic diary persistence', () => {
 it('updates one entry repeatedly and persists empty text without inserting fallback content', async () => {
  const { saveEntry, diaryState } = await import('./diary')
  saveEntry(entry('一'))
  saveEntry(entry('一日を記録'))
  saveEntry(entry(''))
  expect(diaryState.entries).toHaveLength(1)
  expect(JSON.parse(data.get('daylog:v1:entries')!)).toEqual([entry('')])
 })
 it('keeps the last durable state when saving fails and allows a retry', async () => {
  const { saveEntry, diaryState } = await import('./diary')
  saveEntry(entry('保存済み'))
  write.mockImplementationOnce(() => { throw new Error('QuotaExceededError') })
  expect(() => saveEntry(entry('未保存'))).toThrow()
  expect(diaryState.entries[0].body).toBe('保存済み')
  expect(JSON.parse(data.get('daylog:v1:entries')!)[0].body).toBe('保存済み')
  saveEntry(entry('再試行'))
  expect(JSON.parse(data.get('daylog:v1:entries')!)[0].body).toBe('再試行')
 })
 it('does not remove photos when the entry deletion cannot be persisted', async () => {
  const { saveEntry, deleteEntry, diaryState } = await import('./diary')
  saveEntry({ ...entry(), imageIds: ['photo-1'] })
  write.mockImplementationOnce(() => { throw new Error('storage unavailable') })
  await expect(deleteEntry('diary-1')).rejects.toThrow()
  expect(diaryState.entries).toHaveLength(1)
  expect(images.delete).not.toHaveBeenCalled()
 })
 it('keeps the entry deleted even if unused image cleanup fails', async () => {
  const { saveEntry, deleteEntry, diaryState } = await import('./diary')
  saveEntry({ ...entry(), imageIds: ['photo-1'] })
  images.delete.mockRejectedValueOnce(new Error('image database unavailable'))
  await deleteEntry('diary-1')
  expect(diaryState.entries).toEqual([])
  expect(JSON.parse(data.get('daylog:v1:entries')!)).toEqual([])
 })
})

describe('sample data removal', () => {
 const sample = () => ({ ...entry('夕方の風が心地よかった。'), mood: 4, condition: 3, tags: ['散歩'], guess: '穏やかな一日を過ごした', guessResult: 'correct', tomorrow: '少し早く休む' })
 it('starts empty without generating examples on first launch', async () => {
  data.delete('daylog:v1:entries')
  const { diaryState } = await import('./diary')
  expect(diaryState.entries).toEqual([])
 })
 it('removes stored examples permanently while preserving real and edited diaries', async () => {
  const real = { ...entry('自分で書いた日記'), id: 'real' }
  const edited = { ...sample(), id: 'edited', body: '書き直した日記' }
  const touched = { ...sample(), id: 'touched', updatedAt: '2026-10-06T01:00:00Z' }
  data.set('daylog:v1:entries', JSON.stringify([sample(), real, edited, touched]))
  const { diaryState } = await import('./diary')
  expect(diaryState.entries).toEqual([real, edited, touched])
  expect(JSON.parse(data.get('daylog:v1:entries')!)).toEqual([real, edited, touched])
  vi.resetModules()
  expect((await import('./diary')).diaryState.entries).toEqual([real, edited, touched])
 })
 it('retains entries with actual answers or photos even when their text matches an example', async () => {
  const answered = { ...sample(), answers: { mood: '4' } }
  const photographed = { ...sample(), imageIds: ['photo'] }
  data.set('daylog:v1:entries', JSON.stringify([answered, photographed]))
  expect((await import('./diary')).diaryState.entries).toEqual([answered, photographed])
 })
 it('does not replace unreadable stored data with examples', async () => {
  data.set('daylog:v1:entries', '{broken')
  expect((await import('./diary')).diaryState.entries).toEqual([])
  expect(data.get('daylog:v1:entries')).toBe('{broken')
 })
})

describe('account storage isolation', () => {
 it('keeps guest diaries and different accounts separate across switches', async () => {
  const store = await import('./diary')
  store.saveEntry(entry('ゲスト'))
  store.switchDiaryScope('account-a')
  expect(store.diaryState.entries).toEqual([])
  store.saveEntry(entry('Aの日記'))
  expect(Object.keys(store.readAccountSnapshot().pending)).toHaveLength(1)
  store.switchDiaryScope('account-b')
  expect(store.diaryState.entries).toEqual([])
  store.saveEntry(entry('Bの日記'))
  store.switchDiaryScope('account-a')
  expect(store.diaryState.entries[0].body).toBe('Aの日記')
  store.switchDiaryScope('')
  expect(store.diaryState.entries[0].body).toBe('ゲスト')
 })
 it('writes offline account edits and their queue atomically', async () => {
  const store = await import('./diary')
  store.switchDiaryScope('a')
  store.saveEntry(entry('保存済み'))
  const previous = store.readAccountSnapshot()
  write.mockImplementationOnce(() => { throw new Error('QuotaExceededError') })
  expect(() => store.saveEntry(entry('失敗'))).toThrow()
  expect(store.readAccountSnapshot()).toEqual(previous)
  expect(store.diaryState.entries[0].body).toBe('保存済み')
 })
 it('queues a deletion without deleting cached photos or touching the guest data', async () => {
  const store = await import('./diary')
  store.saveEntry(entry('ゲスト'))
  store.switchDiaryScope('a')
  store.saveEntry({ ...entry('アカウント'), imageIds: ['photo'] })
  await store.deleteEntry('diary-1')
  expect(store.readAccountSnapshot().pending[entry().date].entry).toBeNull()
  expect(images.delete).not.toHaveBeenCalled()
  await store.deleteEntry('missing')
  expect(store.guestEntries()[0].body).toBe('ゲスト')
 })
})
