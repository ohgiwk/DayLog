import { describe, expect, it } from 'vitest'
import { acknowledge, emptySnapshot, mergeRemote, queueEntry, resolveConflict } from './sync-model'
import type { DiaryEntry } from '../types'
const date = '2026-10-07'
const entry = (body = '本文'): DiaryEntry => ({ id: 'entry', date, body, mood: 3, condition: 3, answers: {}, tags: [], guess: '一日', tomorrow: '', imageIds: ['photo'], createdAt: '', updatedAt: '' })
describe('offline diary sync', () => {
 it('persists an edit made while an earlier upload is in flight', () => {
  const first = queueEntry(emptySnapshot(), date, entry('最初'))
  const second = queueEntry(first, date, entry('続き'))
  const result = acknowledge(second, date, first.pending[date])
  expect(result.entries[0].body).toBe('続き')
  expect(result.pending[date].entry?.body).toBe('続き')
  expect(result.pending[date].base).toBe(first.pending[date].version)
 })
 it('preserves both versions when devices edit the same date', () => {
  const base = mergeRemote(emptySnapshot(), [{ date, entry: entry(), version: 'v1' }])
  const local = queueEntry(base, date, entry('この端末'))
  const result = mergeRemote(local, [{ date, entry: entry('他の端末'), version: 'v2' }])
  expect(result.entries[0].body).toBe('この端末')
  expect(result.conflicts[date].entry?.body).toBe('他の端末')
  expect(resolveConflict(result, date, 'remote').entries[0].body).toBe('他の端末')
  expect(resolveConflict(result, date, 'local').pending[date].base).toBe('v2')
 })
 it('retries an acknowledged server write idempotently after a lost response', () => {
  const local = queueEntry(emptySnapshot(), date, entry())
  const result = mergeRemote(local, [{ date, entry: entry(), version: local.pending[date].version }])
  expect(result.pending).toEqual({})
  expect(result.conflicts).toEqual({})
 })
 it('keeps deletion tombstones and does not silently resurrect a remote deletion', () => {
  const base = mergeRemote(emptySnapshot(), [{ date, entry: entry(), version: 'v1' }])
  const local = queueEntry(base, date, null)
  expect(local.entries).toEqual([])
  expect(local.pending[date].base).toBe('v1')
  const result = mergeRemote(queueEntry(base, date, entry('offline')), [{ date, entry: null, version: 'v2' }])
  expect(result.conflicts[date].entry).toBeNull()
  expect(resolveConflict(result, date, 'remote').entries).toEqual([])
  expect(mergeRemote(base, [{ date, entry: null, version: 'v2' }]).entries).toEqual([])
 })
 it('merges different dates without dropping unsent changes', () => {
  const local = queueEntry(emptySnapshot(), date, entry())
  const result = mergeRemote(local, [{ date: '2026-10-06', entry: { ...entry(), date: '2026-10-06' }, version: 'remote' }])
  expect(result.entries).toHaveLength(2)
  expect(result.pending[date]).toEqual(local.pending[date])
 })
})

describe('photo cleanup queue', () => {
 it('defers remote cleanup until the entry update is acknowledged', () => {
  const base = mergeRemote(emptySnapshot(), [{ date, entry: entry(), version: 'v1' }])
  const local = queueEntry(base, date, { ...entry(), imageIds: [] })
  expect(local.cleanup).toEqual([])
  expect(local.pending[date].removed).toEqual(['photo'])
  expect(acknowledge(local, date, local.pending[date]).cleanup).toEqual(['photo'])
 })
 it('keeps cleanup queued when an acknowledged response was lost', () => {
  const base = mergeRemote(emptySnapshot(), [{ date, entry: entry(), version: 'v1' }])
  const local = queueEntry(base, date, null)
  const result = mergeRemote(local, [{ date, entry: null, version: local.pending[date].version }])
  expect(result.cleanup).toEqual(['photo'])
 })
})
