import type { Memo, MemoFolder, MemoLibrary } from './memo-repository'
export interface RemoteMemoLibrary {
  library: MemoLibrary
  version: string
}
export interface MemoSnapshot {
  library: MemoLibrary
  base: MemoLibrary
  version: string | null
  pending: string | null
  conflict: RemoteMemoLibrary | null
  imported: boolean
}
export const emptyLibrary = (): MemoLibrary => ({ folders: [], notes: [] })
export const emptyMemoSnapshot = (): MemoSnapshot => ({
  library: emptyLibrary(),
  base: emptyLibrary(),
  version: null,
  pending: null,
  conflict: null,
  imported: false,
})
// JSON key order can change in Postgres jsonb, so compare canonical objects.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    )
  return value
}
export function sameMemoValue(a: unknown, b: unknown) {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
}
export interface MemoConflict {
  kind: 'folders' | 'notes'
  id: string
  local?: MemoFolder | Memo
  remote?: MemoFolder | Memo
}
export function mergeMemoLibraries(
  base: MemoLibrary,
  local: MemoLibrary,
  remote: MemoLibrary,
  choice?: 'local' | 'remote',
) {
  const library = emptyLibrary(),
    conflicts: MemoConflict[] = []
  function merge<T extends { id: string }>(
    kind: 'folders' | 'notes',
    before: T[],
    ours: T[],
    theirs: T[],
  ): T[] {
    const b = new Map(before.map((v) => [v.id, v])),
      l = new Map(ours.map((v) => [v.id, v])),
      r = new Map(theirs.map((v) => [v.id, v]))
    return [...new Set([...l.keys(), ...r.keys(), ...b.keys()])].flatMap(
      (id) => {
        let value: T | undefined
        if (sameMemoValue(l.get(id), b.get(id))) value = r.get(id)
        else if (
          sameMemoValue(r.get(id), b.get(id)) ||
          sameMemoValue(l.get(id), r.get(id))
        )
          value = l.get(id)
        else {
          conflicts.push({
            kind,
            id,
            local: l.get(id) as Memo | MemoFolder | undefined,
            remote: r.get(id) as Memo | MemoFolder | undefined,
          })
          value = choice === 'remote' ? r.get(id) : l.get(id)
        }
        return value ? [JSON.parse(JSON.stringify(value)) as T] : []
      },
    )
  }
  library.folders = merge(
    'folders',
    base.folders,
    local.folders,
    remote.folders,
  )
  library.notes = merge('notes', base.notes, local.notes, remote.notes)
  // A folder deleted on one device must not hide a note edited/created on another.
  for (const note of library.notes) {
    if (library.folders.some((f) => f.id === note.folderId)) continue
    const folder = [...local.folders, ...remote.folders, ...base.folders].find(
      (f) => f.id === note.folderId,
    )
    library.folders.push(
      folder ? { ...folder } : { id: note.folderId, name: '復元したメモ' },
    )
  }
  return { library, conflicts }
}
export function receiveMemoRemote(
  snapshot: MemoSnapshot,
  remote: RemoteMemoLibrary,
): MemoSnapshot {
  if (snapshot.pending === remote.version)
    return {
      ...snapshot,
      base: remote.library,
      version: remote.version,
      pending: null,
      conflict: null,
    }
  if (!snapshot.pending)
    return {
      ...snapshot,
      library: remote.library,
      base: remote.library,
      version: remote.version,
      conflict: null,
    }
  if (snapshot.version === remote.version) return snapshot
  const merged = mergeMemoLibraries(
    snapshot.base,
    snapshot.library,
    remote.library,
  )
  if (merged.conflicts.length) return { ...snapshot, conflict: remote }
  return {
    ...snapshot,
    library: merged.library,
    base: remote.library,
    version: remote.version,
    pending: sameMemoValue(merged.library, remote.library)
      ? null
      : crypto.randomUUID(),
    conflict: null,
  }
}
export function acknowledgeMemo(
  snapshot: MemoSnapshot,
  sent: MemoSnapshot,
): MemoSnapshot {
  return {
    ...snapshot,
    base: sent.library,
    version: sent.pending,
    pending: snapshot.pending === sent.pending ? null : snapshot.pending,
    conflict: null,
  }
}
export function resolveMemoConflict(
  snapshot: MemoSnapshot,
  choice: 'local' | 'remote',
): MemoSnapshot {
  if (!snapshot.conflict) return snapshot
  const remote = snapshot.conflict
  const { library } = mergeMemoLibraries(
    snapshot.base,
    snapshot.library,
    remote.library,
    choice,
  )
  return {
    ...snapshot,
    library,
    base: remote.library,
    version: remote.version,
    pending: sameMemoValue(library, remote.library)
      ? null
      : crypto.randomUUID(),
    conflict: null,
  }
}
