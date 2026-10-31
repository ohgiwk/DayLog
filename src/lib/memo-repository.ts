import { withStore } from './indexed-db'
import {
  emptyMemoSnapshot,
  mergeMemoLibraries,
  sameMemoValue,
  type MemoSnapshot,
} from './memo-sync-model'
export interface MemoFolder {
  id: string
  name: string
}
export interface Memo {
  id: string
  folderId: string
  title: string
  html: string
  images?: string[]
  updatedAt: string
}
export interface MemoLibrary {
  folders: MemoFolder[]
  notes: Memo[]
}
let owner = ''
export function setMemoScope(id: string) {
  owner = id
}
export function memoOwner() {
  return owner
}
const listeners = new Set<(id: string, local: boolean) => void>()
export function onMemoChange(listener: (id: string, local: boolean) => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
const channel =
  typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('daylog-memos')
    : null
channel?.addEventListener('message', (event) => {
  if (typeof event.data?.id === 'string')
    listeners.forEach((fn) => fn(event.data.id, event.data.local === true))
})
function notify(id: string, local: boolean) {
  listeners.forEach((fn) => fn(id, local))
  channel?.postMessage({ id, local })
}
// Read-modify-write stays in one transaction, including sync acknowledgements.
function access<T>(
  key: string,
  update?: (value: T | undefined) => T,
): Promise<T | undefined> {
  return withStore(
    { name: 'daylog-memos', store: 'library' },
    update ? 'readwrite' : 'readonly',
    (store, result, abort) => {
      const read = store.get(key)
      read.onsuccess = () => {
        try {
          const value = update ? update(read.result) : read.result
          if (update) store.put(value, key)
          result(value)
        } catch (error) {
          abort(error)
        }
      }
    },
  )
}
export async function readMemoSnapshot(id = owner) {
  return (await access<MemoSnapshot>(`account:${id}`)) ?? emptyMemoSnapshot()
}
export async function updateMemoSnapshot(
  id: string,
  change: (snapshot: MemoSnapshot) => MemoSnapshot,
  local = false,
) {
  const value = (await access<MemoSnapshot>(`account:${id}`, (old) =>
    change(old ?? emptyMemoSnapshot()),
  ))!
  notify(id, local)
  return value
}
export async function legacyMemos(): Promise<MemoLibrary> {
  return (await access<MemoLibrary>('current')) ?? { folders: [], notes: [] }
}
export async function accessLibrary(
  value?: MemoLibrary,
  id = owner,
  base?: MemoLibrary,
): Promise<MemoLibrary> {
  if (!id) {
    if (value) throw new Error('authentication_required')
    return { folders: [], notes: [] }
  }
  if (!value) return (await readMemoSnapshot(id)).library
  const snapshot = await updateMemoSnapshot(
    id,
    (old) => {
      const merged = mergeMemoLibraries(base ?? old.library, value, old.library)
      if (merged.conflicts.length) throw new Error('memo_local_conflict')
      if (sameMemoValue(merged.library, old.library)) return old
      return { ...old, library: merged.library, pending: crypto.randomUUID() }
    },
    true,
  )
  return snapshot.library
}
export async function importLegacyMemos(id = owner) {
  if (!id) throw new Error('authentication_required')
  const legacy = await legacyMemos()
  return updateMemoSnapshot(
    id,
    (old) => {
      if (old.imported) return old
      const folders = legacy.folders.map((f) => ({
        ...f,
        id: crypto.randomUUID(),
      }))
      const mapping = new Map(
        legacy.folders.map((f, i) => [f.id, folders[i]!.id]),
      )
      const notes = legacy.notes.map((n) => {
        let folderId = mapping.get(n.folderId)
        if (!folderId) {
          folderId = crypto.randomUUID()
          mapping.set(n.folderId, folderId)
          folders.push({ id: folderId, name: '取り込んだメモ' })
        }
        return { ...n, id: crypto.randomUUID(), folderId }
      })
      return {
        ...old,
        library: {
          folders: [...old.library.folders, ...folders],
          notes: [...old.library.notes, ...notes],
        },
        pending:
          folders.length || notes.length ? crypto.randomUUID() : old.pending,
        imported: true,
      }
    },
    true,
  )
}
