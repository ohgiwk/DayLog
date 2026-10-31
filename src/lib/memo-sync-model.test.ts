import { describe, expect, it } from 'vitest'
import type { Memo, MemoLibrary } from './memo-repository'
import {
  acknowledgeMemo,
  emptyMemoSnapshot,
  mergeMemoLibraries,
  receiveMemoRemote,
  resolveMemoConflict,
  sameMemoValue,
  type MemoSnapshot,
} from './memo-sync-model'

const note = (id: string, title = id, folderId = 'folder'): Memo => ({
  id,
  title,
  folderId,
  html: '<p>本文</p>',
  images: ['data:image/png;base64,AAAA'],
  updatedAt: '2026-10-26',
})
const library = (...notes: Memo[]): MemoLibrary => ({
  folders: [{ id: 'folder', name: '日記' }],
  notes,
})
const pending = (base: MemoLibrary, local: MemoLibrary): MemoSnapshot => ({
  ...emptyMemoSnapshot(),
  base,
  library: local,
  version: 'base',
  pending: 'local',
})

describe('three-way memo merging', () => {
  it('ignores JSON object key order but preserves array order', () => {
    expect(
      sameMemoValue(
        { a: { b: 1, c: 2 }, d: [1, 2] },
        { d: [1, 2], a: { c: 2, b: 1 } },
      ),
    ).toBe(true)
    expect(sameMemoValue([1, 2], [2, 1])).toBe(false)
  })
  it('merges independent creations, edits and deletions without mutating inputs', () => {
    const base = library(note('edit'), note('delete'))
    const local = library(note('edit', '編集'), note('delete'))
    const remote = library(note('edit'), note('new'))
    const original = structuredClone({ base, local, remote })
    const result = mergeMemoLibraries(base, local, remote)
    expect(result.conflicts).toEqual([])
    expect(result.library.notes).toEqual([note('edit', '編集'), note('new')])
    result.library.notes[0].title = '結果だけを変更'
    expect({ base, local, remote }).toEqual(original)
  })
  it('accepts identical edits from both devices', () => {
    const edited = library(note('a', '同じ編集'))
    expect(
      mergeMemoLibraries(library(note('a')), edited, edited).conflicts,
    ).toEqual([])
  })
  it('keeps both sides available when a deletion conflicts with an edit', () => {
    const result = mergeMemoLibraries(
      library(note('a')),
      library(),
      library(note('a', '編集')),
    )
    expect(result.conflicts).toEqual([
      { kind: 'notes', id: 'a', local: undefined, remote: note('a', '編集') },
    ])
    expect(result.library.notes).toEqual([])
  })
  it('restores a deleted folder when another device creates a note in it', () => {
    const result = mergeMemoLibraries(
      library(),
      { folders: [], notes: [] },
      library(note('new')),
    )
    expect(result.library).toEqual(library(note('new')))
    expect(result.conflicts).toEqual([])
  })
  it('provides a fallback folder for orphaned notes', () => {
    const result = mergeMemoLibraries(library(), library(), {
      folders: [],
      notes: [note('a', 'a', 'missing')],
    })
    expect(result.library.folders).toContainEqual({
      id: 'missing',
      name: '復元したメモ',
    })
  })
})

describe('memo sync revisions', () => {
  it('receives remote data when there are no local changes', () => {
    const remote = { library: library(note('remote')), version: 'remote' }
    expect(receiveMemoRemote(emptyMemoSnapshot(), remote)).toMatchObject({
      library: remote.library,
      base: remote.library,
      version: 'remote',
      pending: null,
    })
  })
  it('recognizes a successful write after its response was lost', () => {
    const snapshot = pending(library(), library(note('a')))
    const result = receiveMemoRemote(snapshot, {
      library: snapshot.library,
      version: 'local',
    })
    expect(result.pending).toBeNull()
    expect(result.version).toBe('local')
    expect(result.library).toEqual(snapshot.library)
  })
  it('ignores an unchanged remote revision while local edits are queued', () => {
    const snapshot = pending(library(), library(note('a')))
    expect(
      receiveMemoRemote(snapshot, { library: library(), version: 'base' }),
    ).toBe(snapshot)
  })
  it('queues a merged revision when independent remote changes arrive', () => {
    const result = receiveMemoRemote(
      pending(library(), library(note('local'))),
      { library: library(note('remote')), version: 'remote' },
    )
    expect(result.library.notes.map((n) => n.id)).toEqual(['local', 'remote'])
    expect(result.version).toBe('remote')
    expect(result.pending).toBeTruthy()
    expect(result.pending).not.toBe('local')
    expect(result.conflict).toBeNull()
  })
  it('clears the queue when the merge already matches the remote', () => {
    const local = library(note('same'))
    expect(
      receiveMemoRemote(pending(library(), local), {
        library: local,
        version: 'remote',
      }).pending,
    ).toBeNull()
  })
  it('preserves typing that happened while an earlier revision was being sent', () => {
    const sent = pending(library(), library(note('a', '送信した内容')))
    const current = {
      ...sent,
      library: library(note('a', '送信中の追記')),
      pending: 'new-edit',
    }
    const result = acknowledgeMemo(current, sent)
    expect(result.library).toEqual(current.library)
    expect(result.pending).toBe('new-edit')
    expect(result.base).toEqual(sent.library)
    expect(result.version).toBe('local')
  })
  it.each(['local', 'remote'] as const)(
    'resolves only conflicting items using the %s choice',
    (choice) => {
      const base = library(note('a'))
      const local = library(note('a', 'この端末'), note('local-only'))
      const remote = {
        library: library(note('a', '別端末'), note('remote-only')),
        version: 'remote',
      }
      const conflicted = receiveMemoRemote(pending(base, local), remote)
      expect(conflicted.library).toEqual(local)
      expect(conflicted.conflict).toEqual(remote)
      const result = resolveMemoConflict(conflicted, choice)
      expect(result.library.notes.find((n) => n.id === 'a')?.title).toBe(
        choice === 'local' ? 'この端末' : '別端末',
      )
      expect(result.library.notes.map((n) => n.id)).toEqual(
        expect.arrayContaining(['local-only', 'remote-only']),
      )
      expect(result.conflict).toBeNull()
      expect(result.version).toBe('remote')
      expect(result.pending).toBeTruthy()
    },
  )
  it('does not queue an unnecessary write when choosing the entire remote value', () => {
    const remote = { library: library(note('a', '別端末')), version: 'remote' }
    const conflicted = receiveMemoRemote(
      pending(library(note('a')), library(note('a', 'この端末'))),
      remote,
    )
    expect(resolveMemoConflict(conflicted, 'remote')).toMatchObject({
      library: remote.library,
      pending: null,
      conflict: null,
    })
  })
})
