import type { DiaryEntry } from '../types'
export interface RemoteEntry { date: string; entry: DiaryEntry | null; version: string }
export interface PendingEntry { entry: DiaryEntry | null; version: string; base: string | null; removed: string[] }
export interface DiarySnapshot {
 entries: DiaryEntry[]
 cleanup: string[]
 versions: Record<string, string>
 pending: Record<string, PendingEntry>
 conflicts: Record<string, RemoteEntry>
}
export function emptySnapshot(): DiarySnapshot { return { entries: [], cleanup: [], versions: {}, pending: {}, conflicts: {} } }
export function replaceDate(entries: DiaryEntry[], date: string, entry: DiaryEntry | null) {
 return [...entries.filter(e => e.date !== date), ...(entry ? [entry] : [])]
}
export function queueEntry(snapshot: DiarySnapshot, date: string, entry: DiaryEntry | null): DiarySnapshot {
 const previous = snapshot.entries.find(e => e.date === date)
 const removed = [...new Set([...(snapshot.pending[date]?.removed ?? []), ...(previous?.imageIds ?? []).filter(id => !entry?.imageIds.includes(id))])]
 return { ...snapshot, entries: replaceDate(snapshot.entries, date, entry), pending: {
  ...snapshot.pending, [date]: { entry, version: crypto.randomUUID(), removed, base: snapshot.pending[date]?.base ?? snapshot.versions[date] ?? null },
 } }
}
export function acknowledge(snapshot: DiarySnapshot, date: string, sent: PendingEntry): DiarySnapshot {
 const next = structuredClone(snapshot), current = next.pending[date]
 next.cleanup = [...new Set([...next.cleanup, ...sent.removed])]
 next.versions[date] = sent.version
 if (current?.version === sent.version) delete next.pending[date]
 else if (current) current.base = sent.version
 delete next.conflicts[date]
 return next
}
export function mergeRemote(snapshot: DiarySnapshot, rows: RemoteEntry[]): DiarySnapshot {
 const next = structuredClone(snapshot)
 for (const row of rows) {
  const pending = next.pending[row.date]
  if (pending) {
   // A server commit may have succeeded before the response was lost.
   if (pending.version === row.version) {
    next.cleanup = [...new Set([...next.cleanup, ...pending.removed])]
    delete next.pending[row.date]; delete next.conflicts[row.date]
    next.versions[row.date] = row.version
   } else if (pending.base !== row.version) next.conflicts[row.date] = row
  } else {
   next.entries = replaceDate(next.entries, row.date, row.entry)
   next.versions[row.date] = row.version
   delete next.conflicts[row.date]
  }
 }
 return next
}
export function resolveConflict(snapshot: DiarySnapshot, date: string, choice: 'local' | 'remote'): DiarySnapshot {
 const next = structuredClone(snapshot), remote = next.conflicts[date]
 if (!remote) return next
 next.versions[date] = remote.version
 if (choice === 'remote') {
  next.entries = replaceDate(next.entries, date, remote.entry)
  delete next.pending[date]
 } else if (next.pending[date]) {
  next.pending[date].removed = [...new Set([...next.pending[date].removed, ...(remote.entry?.imageIds ?? []).filter(id => !next.pending[date].entry?.imageIds.includes(id))])]
  next.pending[date].base = remote.version
  next.pending[date].version = crypto.randomUUID()
 }
 delete next.conflicts[date]
 return next
}
