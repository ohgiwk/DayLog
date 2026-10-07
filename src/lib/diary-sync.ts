import { reactive } from 'vue'
import { supabase } from './supabase'
import { account } from '../stores/account'
import { diaryScope, guestEntries, onDiaryChange, readAccountSnapshot, saveEntry, writeAccountSnapshot } from '../stores/diary'
import { imageRepository, setImageDownloader } from './image-repository'
import { acknowledge, mergeRemote, resolveConflict, type RemoteEntry } from './sync-model'

export const syncState = reactive({ busy: false, error: '', pending: 0, lastSynced: '', conflicts: [] as RemoteEntry[] })
let timer: ReturnType<typeof setTimeout> | undefined
let editing = () => false
export function setEditingCheck(check: () => boolean) { editing = check }
function current(id: string, generation: number) { return diaryScope.userId === id && diaryScope.generation === generation }
export function refreshSyncStatus() {
 if (!diaryScope.userId) { syncState.pending = 0; syncState.conflicts = []; return }
 const snapshot = readAccountSnapshot()
 syncState.pending = Object.keys(snapshot.pending).length + (snapshot.cleanup.length ? 1 : 0)
 syncState.conflicts = Object.values(snapshot.conflicts)
}
export function scheduleSync() {
 refreshSyncStatus()
 clearTimeout(timer)
 timer = setTimeout(() => { void syncDiary() }, 800)
}
async function fetchRows(id: string): Promise<RemoteEntry[]> {
 const rows: RemoteEntry[] = []
 for (let offset = 0; ; offset += 500) {
  const { data, error } = await supabase!.from('daylog_entries').select('date,entry,version').eq('user_id', id).order('date').range(offset, offset + 499)
  if (error) throw error
  rows.push(...data as RemoteEntry[])
  if (data.length < 500) return rows
 }
}
export async function syncDiary(): Promise<boolean> {
 const client = supabase, id = diaryScope.userId, generation = diaryScope.generation
 if (!client || !id || syncState.busy) return false
 if (!navigator.onLine) { syncState.error = 'オフラインです。変更は端末に保存し、接続後に同期します。'; return false }
 syncState.busy = true; syncState.error = ''
 const run = async () => {
  if (!current(id, generation)) return false
  // Copy durable state, never a Vue proxy. Edits made during await are reread before committing.
  const batch = readAccountSnapshot(id).pending
  for (const [date, sent] of Object.entries(batch)) {
   if (!current(id, generation)) return false
   if (readAccountSnapshot(id).conflicts[date]) continue
   for (const imageId of sent.entry?.imageIds ?? []) {
    const path = `${id}/${imageId}`
    const { data: exists } = await client.storage.from('daylog-photos').exists(path)
    if (!exists) {
     const photo = await imageRepository.getLocal(imageId, id)
     if (!photo) throw new Error('missing_photo')
     const { error } = await client.storage.from('daylog-photos').upload(path, photo.blob, { upsert: true, contentType: photo.type })
     if (error) throw error
    }
    if (!current(id, generation)) return false
   }
   const { error } = await client.rpc('daylog_write_entry', { p_date: date, p_entry: sent.entry, p_expected: sent.base, p_version: sent.version })
   if (!current(id, generation)) return false
   if (error) {
    if (error.message.includes('sync_conflict')) {
     const { data, error: readError } = await client.from('daylog_entries').select('date,entry,version').eq('user_id', id).eq('date', date).single()
     if (readError) throw readError
     if (!current(id, generation)) return false
     writeAccountSnapshot(mergeRemote(readAccountSnapshot(id), [data as RemoteEntry]), id)
     continue
    }
    throw error
   }
   writeAccountSnapshot(acknowledge(readAccountSnapshot(id), date, sent), id)
  }
  // Never replace a form's initial value while the user is editing it.
  if (!editing()) {
   const rows = await fetchRows(id)
   if (!current(id, generation)) return false
   if (!editing()) writeAccountSnapshot(mergeRemote(readAccountSnapshot(id), rows), id)
  }
  for (const imageId of readAccountSnapshot(id).cleanup) {
   if (!current(id, generation)) return false
   const snapshot = readAccountSnapshot(id)
   // Re-attached photos and unresolved edits must never be garbage-collected.
   const referenced = snapshot.entries.some(e => e.imageIds.includes(imageId)) || Object.values(snapshot.conflicts).some(row => row.entry?.imageIds.includes(imageId))
   if (!referenced) {
    const { error } = await client.storage.from('daylog-photos').remove([`${id}/${imageId}`])
    if (error) throw error
    await imageRepository.delete(imageId, id)
   }
   if (!current(id, generation)) return false
   const latest = readAccountSnapshot(id)
   latest.cleanup = latest.cleanup.filter(value => value !== imageId)
   writeAccountSnapshot(latest, id)
  }
  syncState.lastSynced = new Date().toISOString()
  refreshSyncStatus()
  return syncState.pending === 0
 }
 try {
  return navigator.locks ? await navigator.locks.request(`daylog-sync:${id}`, run) : await run()
 } catch {
  if (current(id, generation)) syncState.error = '同期できませんでした。変更は端末に残っています。通信を確認して再試行してください。'
  return false
 } finally {
  syncState.busy = false
  refreshSyncStatus()
 }
}
export async function chooseConflict(date: string, choice: 'local' | 'remote') {
 if (syncState.busy) return
 writeAccountSnapshot(resolveConflict(readAccountSnapshot(), date, choice))
 refreshSyncStatus()
 await syncDiary()
}
export async function importGuestDiaries() {
 const id = diaryScope.userId, generation = diaryScope.generation
 if (!id || !await syncDiary()) throw new Error('先に同期を完了してください。')
 let count = 0, skipped = 0
 for (const entry of guestEntries()) {
  if (!current(id, generation)) throw new Error('アカウントが切り替わりました。')
  const snapshot = readAccountSnapshot(id)
  // Do not overwrite a cloud entry, pending edit, or deletion from another device.
  if (snapshot.versions[entry.date] || snapshot.pending[entry.date]) { skipped++; continue }
  for (const imageId of entry.imageIds) {
   const photo = await imageRepository.getLocal(imageId, '')
   if (!photo) throw new Error('読み込めない写真があります。元の日記は端末に残っています。')
   await imageRepository.put(photo, id)
  }
  if (!current(id, generation)) throw new Error('アカウントが切り替わりました。')
  saveEntry(entry); count++
 }
 await syncDiary()
 return `${count}件を取り込みました。${skipped ? `同じ日付の${skipped}件は元の端末データに残しています。` : ''}`
}
export function startSync() {
 onDiaryChange(scheduleSync)
 setImageDownloader(async (imageId, id) => {
  if (!supabase || account.user?.id !== id) return undefined
  const { data, error } = await supabase.storage.from('daylog-photos').download(`${id}/${imageId}`)
  if (error) throw error
  return { id: imageId, entryId: '', blob: data, type: data.type, createdAt: '' }
 })
 window.addEventListener('online', scheduleSync)
 window.addEventListener('focus', scheduleSync)
 document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleSync() })
 // Poll only while visible. Pushes are debounced separately after local edits.
 window.setInterval(() => { if (!document.hidden) void syncDiary() }, 30000)
 scheduleSync()
}
