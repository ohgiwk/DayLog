import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { emptySnapshot, queueEntry, type DiarySnapshot } from './sync-model'
import type { DiaryEntry } from '../types'
const mock = vi.hoisted(() => ({
 rpc: vi.fn(), select: vi.fn(), download: vi.fn(), upload: vi.fn(), exists: vi.fn(), getLocal: vi.fn(),
 scope: { userId: 'a', generation: 1 }, snapshot: null as DiarySnapshot | null,
}))
vi.mock('./supabase', () => ({ supabase: {
 rpc: mock.rpc,
 from: () => ({ select: () => {
  const chain = { eq: () => chain, order: () => chain, range: mock.select, single: mock.select }
  return chain
 } }),
 storage: { from: () => ({ download: mock.download, upload: mock.upload, exists: mock.exists }) },
} }))
vi.mock('../stores/account', () => ({ account: { user: { id: 'a' } } }))
vi.mock('../stores/diary', () => ({
 diaryScope: mock.scope,
 readAccountSnapshot: () => structuredClone(mock.snapshot),
 writeAccountSnapshot: (snapshot: DiarySnapshot) => { mock.snapshot = snapshot },
 onDiaryChange: vi.fn(), guestEntries: () => [], saveEntry: vi.fn(),
}))
vi.mock('./image-repository', () => ({ imageRepository: { getLocal: mock.getLocal }, setImageDownloader: vi.fn() }))
const entry: DiaryEntry = { id: 'entry', date: '2026-10-07', mood: 3, condition: 3, answers: {}, tags: [], guess: '', body: '本文', tomorrow: '', imageIds: [], createdAt: '', updatedAt: '' }
beforeEach(() => {
 vi.resetModules(); vi.clearAllMocks()
 vi.stubGlobal('navigator', { onLine: true })
 mock.scope.userId = 'a'; mock.scope.generation = 1
 mock.snapshot = queueEntry(emptySnapshot(), entry.date, entry)
 mock.rpc.mockResolvedValue({ error: null })
 mock.select.mockResolvedValue({ data: [], error: null })
 mock.exists.mockResolvedValue({ data: false, error: null })
 mock.upload.mockResolvedValue({ error: null })
 mock.getLocal.mockResolvedValue({ blob: new Blob(['photo']), type: 'image/webp' })
})
afterEach(() => vi.unstubAllGlobals())
describe('sync transport', () => {
 it('keeps offline edits queued and avoids a network request', async () => {
  vi.stubGlobal('navigator', { onLine: false })
  const { syncDiary } = await import('./diary-sync')
  expect(await syncDiary()).toBe(false)
  expect(mock.rpc).not.toHaveBeenCalled()
  expect(mock.snapshot!.pending[entry.date]).toBeDefined()
 })
 it('uploads photos before publishing an entry, and retries on failure', async () => {
  mock.snapshot = queueEntry(emptySnapshot(), entry.date, { ...entry, imageIds: ['photo'] })
  mock.upload.mockResolvedValueOnce({ error: new Error('network') })
  const { syncDiary } = await import('./diary-sync')
  expect(await syncDiary()).toBe(false)
  expect(mock.rpc).not.toHaveBeenCalled()
  expect(mock.snapshot!.pending[entry.date]).toBeDefined()
  expect(await syncDiary()).toBe(true)
  expect(mock.upload.mock.invocationCallOrder[1]).toBeLessThan(mock.rpc.mock.invocationCallOrder[0])
 })
 it('preserves new typing while a save is in flight', async () => {
  mock.rpc.mockImplementationOnce(async () => {
   mock.snapshot = queueEntry(mock.snapshot!, entry.date, { ...entry, body: '追記' })
   return { error: null }
  })
  const { syncDiary, setEditingCheck } = await import('./diary-sync')
  setEditingCheck(() => true)
  expect(await syncDiary()).toBe(false)
  expect(mock.snapshot!.pending[entry.date].entry?.body).toBe('追記')
  expect(mock.select).not.toHaveBeenCalled()
 })
 it('does not apply a late response to another account', async () => {
  mock.rpc.mockImplementationOnce(async () => {
   mock.scope.userId = 'b'; mock.scope.generation++
   mock.snapshot = emptySnapshot()
   return { error: null }
  })
  const { syncDiary } = await import('./diary-sync')
  expect(await syncDiary()).toBe(false)
  expect(mock.snapshot).toEqual(emptySnapshot())
 })
 it('keeps both entries when the server rejects an outdated revision', async () => {
  mock.rpc.mockResolvedValueOnce({ error: { message: 'sync_conflict' } })
  mock.select.mockResolvedValueOnce({ data: { date: entry.date, entry: { ...entry, body: '別端末' }, version: 'remote' }, error: null })
  const { syncDiary } = await import('./diary-sync')
  expect(await syncDiary()).toBe(false)
  expect(mock.snapshot!.entries[0].body).toBe('本文')
  expect(mock.snapshot!.conflicts[entry.date].entry?.body).toBe('別端末')
 })
})
