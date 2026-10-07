import { computed, reactive } from 'vue'
import type { AppSettings, DiaryEntry } from '../types'
import { imageRepository } from '../lib/image-repository'
import { isUntouchedSample } from '../lib/sample-entries'
import { emptySnapshot, queueEntry, type DiarySnapshot } from '../lib/sync-model'
const KEY='daylog:v1:entries', SETTINGS='daylog:v1:settings'
export const diaryScope = reactive({ userId: '', generation: 0 })
let onChange = () => {}
export function onDiaryChange(callback: () => void) { onChange = callback }
const accountKey = (id: string) => `daylog:v2:account:${id}`
export function readAccountSnapshot(id = diaryScope.userId): DiarySnapshot {
 const raw = localStorage.getItem(accountKey(id))
 if (!raw) return emptySnapshot()
 const snapshot = JSON.parse(raw) as DiarySnapshot
 snapshot.cleanup ??= []
 for (const pending of Object.values(snapshot.pending)) pending.removed ??= []
 return snapshot
}
export function writeAccountSnapshot(snapshot: DiarySnapshot, id = diaryScope.userId) {
 localStorage.setItem(accountKey(id), JSON.stringify(snapshot))
 if (id === diaryScope.userId) diaryState.entries = snapshot.entries
}
export function switchDiaryScope(id: string) {
 const next = id ? readAccountSnapshot(id).entries : load()
 diaryScope.userId = id; diaryScope.generation++
 diaryState.entries = next
}
export function guestEntries() { return load() }
const today=()=>new Date().toISOString().slice(0,10)
function load():DiaryEntry[]{
 let stored:DiaryEntry[]
 try {
  const value=JSON.parse(localStorage.getItem(KEY)||'[]')
  if(!Array.isArray(value))return []
  stored=value
 }catch{return []}
 const entries=stored.filter(entry=>!isUntouchedSample(entry))
 if(entries.length!==stored.length){
  // Retry migration on a later load if storage is temporarily unavailable.
  try{localStorage.setItem(KEY,JSON.stringify(entries))}catch{}
 }
 return entries
}
export const diaryState=reactive({entries:load() as DiaryEntry[]})
export const settings=reactive<AppSettings>({...{notifications:true,location:true,weather:true,reducedMotion:false,largeText:false},...JSON.parse(localStorage.getItem(SETTINGS)||'{}')})
export const entries=computed(()=>[...diaryState.entries].sort((a,b)=>b.date.localeCompare(a.date)))
export const todaysEntry=computed(()=>diaryState.entries.find(e=>e.date===today()))
export function saveEntry(entry:DiaryEntry){
 const next=[...diaryState.entries],i=next.findIndex(e=>e.date===entry.date)
 if(i>=0)next[i]=entry;else next.push(entry)
 if (diaryScope.userId) writeAccountSnapshot(queueEntry(readAccountSnapshot(), entry.date, entry))
 else { localStorage.setItem(KEY,JSON.stringify(next)); diaryState.entries=next }
 onChange()
}
export async function deleteEntry(id:string){
 const entry=diaryState.entries.find(e=>e.id===id)
 const next=diaryState.entries.filter(e=>e.id!==id)
 if (diaryScope.userId && entry) writeAccountSnapshot(queueEntry(readAccountSnapshot(), entry.date, null))
 else if (!diaryScope.userId) { localStorage.setItem(KEY,JSON.stringify(next)); diaryState.entries=next }
 onChange()
 // Keep account photos cached until the deletion has synced; other devices may still refer to them.
 if(entry && !diaryScope.userId)await Promise.allSettled(entry.imageIds.map(id => imageRepository.delete(id)))
}
export function persist(){if (!diaryScope.userId) localStorage.setItem(KEY,JSON.stringify(diaryState.entries))}
export function saveSettings(){localStorage.setItem(SETTINGS,JSON.stringify(settings));document.documentElement.classList.toggle('reduce-motion',settings.reducedMotion);document.documentElement.classList.toggle('large-text',settings.largeText)}
