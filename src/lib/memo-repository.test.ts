import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MemoLibrary } from './memo-repository'
import { withStore } from './indexed-db'

const library = (title = 'メモ'): MemoLibrary => ({
  folders: [{ id: 'folder', name: 'フォルダ' }],
  notes: [
    {
      id: 'note',
      folderId: 'folder',
      title,
      html: '<p>本文</p>',
      updatedAt: '',
    },
  ],
})
beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('indexedDB', new IDBFactory())
  vi.stubGlobal('BroadcastChannel', undefined)
})
afterEach(() => vi.unstubAllGlobals())

describe('durable memo storage', () => {
  it('requires an account before writing and does not expose legacy notes to guests', async () => {
    const repo = await import('./memo-repository')
    expect(await repo.accessLibrary()).toEqual({ folders: [], notes: [] })
    await expect(repo.accessLibrary(library())).rejects.toThrow(
      'authentication_required',
    )
    await expect(repo.importLegacyMemos()).rejects.toThrow(
      'authentication_required',
    )
  })
  it('keeps account caches and queues isolated', async () => {
    const repo = await import('./memo-repository')
    repo.setMemoScope('a')
    await repo.accessLibrary(library('A'))
    repo.setMemoScope('b')
    expect(await repo.accessLibrary()).toEqual({ folders: [], notes: [] })
    await repo.accessLibrary(library('B'))
    expect((await repo.readMemoSnapshot('a')).library).toEqual(library('A'))
    expect((await repo.readMemoSnapshot('b')).library).toEqual(library('B'))
    expect((await repo.readMemoSnapshot('a')).pending).toBeTruthy()
  })
  it('publishes changes only after a durable commit and unregisters listeners', async () => {
    const repo = await import('./memo-repository')
    const listener = vi.fn()
    const unsubscribe = repo.onMemoChange(listener)
    await repo.accessLibrary(library(), 'a')
    expect(listener).toHaveBeenCalledWith('a', true)
    expect((await repo.readMemoSnapshot('a')).library).toEqual(library())
    unsubscribe()
    await repo.accessLibrary(library('変更'), 'a')
    expect(listener).toHaveBeenCalledTimes(1)
  })
  it('rolls back a failed change without notifying or replacing the last saved value', async () => {
    const repo = await import('./memo-repository')
    await repo.accessLibrary(library(), 'a')
    const previous = await repo.readMemoSnapshot('a')
    const listener = vi.fn()
    repo.onMemoChange(listener)
    await expect(
      repo.updateMemoSnapshot(
        'a',
        (old) => {
          old.library.notes[0].title = '失敗した変更'
          throw new Error('save_failed')
        },
        true,
      ),
    ).rejects.toThrow('save_failed')
    expect(await repo.readMemoSnapshot('a')).toEqual(previous)
    expect(listener).not.toHaveBeenCalled()
    await repo.accessLibrary(library('再試行'), 'a')
    expect((await repo.accessLibrary(undefined, 'a')).notes[0].title).toBe(
      '再試行',
    )
  })
  it('merges concurrent changes from different screens in a single transaction', async () => {
    const repo = await import('./memo-repository')
    const base = library()
    await repo.accessLibrary(base, 'a')
    const first = library('タイトル変更')
    const second = library()
    second.notes.push({ ...second.notes[0], id: 'second', title: '追加' })
    await Promise.all([
      repo.accessLibrary(first, 'a', base),
      repo.accessLibrary(second, 'a', base),
    ])
    expect(
      (await repo.accessLibrary(undefined, 'a')).notes.map((n) => n.title),
    ).toEqual(['タイトル変更', '追加'])
  })
  it('rejects same-note conflicts instead of overwriting a newer screen', async () => {
    const repo = await import('./memo-repository')
    const base = library()
    await repo.accessLibrary(base, 'a')
    await repo.accessLibrary(library('先に保存'), 'a', base)
    await expect(
      repo.accessLibrary(library('後から保存'), 'a', base),
    ).rejects.toThrow('memo_local_conflict')
    expect((await repo.accessLibrary(undefined, 'a')).notes[0].title).toBe(
      '先に保存',
    )
  })
  it('does not generate a new revision for unchanged content', async () => {
    const repo = await import('./memo-repository')
    await repo.accessLibrary(library(), 'a')
    const previous = await repo.readMemoSnapshot('a')
    await repo.accessLibrary(library(), 'a')
    expect(await repo.readMemoSnapshot('a')).toEqual(previous)
  })
  it('imports legacy notes once, remaps ids and restores missing folders', async () => {
    const repo = await import('./memo-repository')
    const legacy = library('過去のメモ')
    legacy.notes.push({ ...legacy.notes[0], id: 'orphan', folderId: 'missing' })
    await withStore(
      { name: 'daylog-memos', store: 'library' },
      'readwrite',
      (store, result) => {
        store.put(legacy, 'current').onsuccess = () => result(undefined)
      },
    )
    await repo.accessLibrary(library('既存'), 'a')
    const imported = await repo.importLegacyMemos('a')
    expect(imported.imported).toBe(true)
    expect(imported.library.notes).toHaveLength(3)
    expect(new Set(imported.library.notes.map((n) => n.id)).size).toBe(3)
    for (const n of imported.library.notes)
      expect(imported.library.folders.some((f) => f.id === n.folderId)).toBe(
        true,
      )
    expect(await repo.importLegacyMemos('a')).toEqual(imported)
    expect(await repo.legacyMemos()).toEqual(legacy)
  })
})
