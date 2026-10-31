import { reactive } from 'vue'
import { supabase } from './supabase'
import {
  memoOwner,
  onMemoChange,
  readMemoSnapshot,
  updateMemoSnapshot,
} from './memo-repository'
import {
  acknowledgeMemo,
  receiveMemoRemote,
  resolveMemoConflict,
  type RemoteMemoLibrary,
  type MemoSnapshot,
} from './memo-sync-model'
export const memoSyncState = reactive({
  busy: false,
  error: '',
  pending: 0,
  lastSynced: '',
  conflict: null as MemoSnapshot | null,
})
let timer: ReturnType<typeof setTimeout> | undefined
let editing = () => false
let generation = 0
export function setMemoEditingCheck(check: () => boolean) {
  editing = check
}
export function resetMemoSync() {
  generation++
  memoSyncState.error = ''
  memoSyncState.pending = 0
  memoSyncState.lastSynced = ''
  memoSyncState.conflict = null
  scheduleMemoSync()
}
export async function refreshMemoSyncStatus() {
  const id = memoOwner(),
    token = generation
  if (!id) return
  const snapshot = await readMemoSnapshot(id)
  if (id !== memoOwner() || token !== generation) return
  memoSyncState.pending = snapshot.pending ? 1 : 0
  memoSyncState.conflict = snapshot.conflict ? snapshot : null
}
export function scheduleMemoSync() {
  clearTimeout(timer)
  timer = setTimeout(() => {
    void syncMemos()
  }, 800)
}
export async function syncMemos(): Promise<boolean> {
  const client = supabase,
    id = memoOwner(),
    token = generation
  const current = () => memoOwner() === id && token === generation
  if (!client || !id || memoSyncState.busy) return false
  memoSyncState.busy = true
  memoSyncState.error = ''
  try {
    if (!navigator.onLine) throw new Error('offline')
    const run = async () => {
      // Do not merge another device into an open editor/dialog. Local edits remain durable.
      for (let attempt = 0; attempt < 3; attempt++) {
        if (!current()) return false
        const sent = await readMemoSnapshot(id)
        if (!current()) return false
        if (sent.conflict) return false
        if (sent.pending) {
          const { error } = await client.rpc('daylog_write_memos', {
            p_library: sent.library,
            p_expected: sent.version,
            p_version: sent.pending,
          })
          if (!current()) return false
          if (error && !error.message.includes('sync_conflict')) throw error
          if (!error)
            await updateMemoSnapshot(id, (latest) =>
              current() ? acknowledgeMemo(latest, sent) : latest,
            )
        }
        if (!current()) return false
        if (editing()) return !(await readMemoSnapshot(id)).pending
        // Fetch payload only when its version changed (photos can be large).
        const { data: header, error: headError } = await client
          .from('daylog_memos')
          .select('version')
          .eq('user_id', id)
          .maybeSingle()
        if (headError) throw headError
        if (!current() || editing()) return false
        const latest = await readMemoSnapshot(id)
        if (header && header.version !== latest.version) {
          const { data, error } = await client
            .from('daylog_memos')
            .select('library,version')
            .eq('user_id', id)
            .single()
          if (error) throw error
          if (!current() || editing()) return false
          await updateMemoSnapshot(id, (value) =>
            current() && !editing()
              ? receiveMemoRemote(value, data as RemoteMemoLibrary)
              : value,
          )
        }
        if (!current()) return false
        const result = await readMemoSnapshot(id)
        if (result.conflict) return false
        if (!result.pending) {
          memoSyncState.lastSynced = new Date().toISOString()
          return true
        }
      }
      return false
    }
    return navigator.locks
      ? await navigator.locks.request(`daylog-memo-sync:${id}`, run)
      : await run()
  } catch {
    if (current())
      memoSyncState.error = navigator.onLine
        ? 'メモを同期できませんでした。変更は端末に残っています。通信を確認して再試行してください。'
        : 'メモは端末に保存されています。接続後に同期します。'
    return false
  } finally {
    memoSyncState.busy = false
    try {
      await refreshMemoSyncStatus()
    } catch {
      if (current())
        memoSyncState.error =
          '端末のメモを読み込めませんでした。再読み込みしてください。'
    }
  }
}
export async function chooseMemoConflict(choice: 'local' | 'remote') {
  if (memoSyncState.busy) return
  const id = memoOwner()
  if (!id) return
  await updateMemoSnapshot(
    id,
    (snapshot) => resolveMemoConflict(snapshot, choice),
    true,
  )
  await syncMemos()
}
export function startMemoSync() {
  onMemoChange((id, local) => {
    if (id === memoOwner()) {
      void refreshMemoSyncStatus().catch(() => {})
      if (local) scheduleMemoSync()
    }
  })
  window.addEventListener('online', scheduleMemoSync)
  window.addEventListener('focus', scheduleMemoSync)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleMemoSync()
  })
  window.setInterval(() => {
    if (!document.hidden) void syncMemos()
  }, 30000)
  scheduleMemoSync()
}
