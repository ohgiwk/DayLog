import { computed, reactive } from 'vue'
import type { AppSettings, DiaryEntry } from '../types'
import { imageRepository } from '../lib/image-repository'
import { isUntouchedSample } from '../lib/sample-entries'
const KEY='daylog:v1:entries', SETTINGS='daylog:v1:settings'
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
 localStorage.setItem(KEY,JSON.stringify(next))
 diaryState.entries=next
}
export async function deleteEntry(id:string){
 const entry=diaryState.entries.find(e=>e.id===id)
 const next=diaryState.entries.filter(e=>e.id!==id)
 localStorage.setItem(KEY,JSON.stringify(next))
 diaryState.entries=next
 if(entry)await Promise.allSettled(entry.imageIds.map(imageRepository.delete))
}
export function persist(){localStorage.setItem(KEY,JSON.stringify(diaryState.entries))}
export function saveSettings(){localStorage.setItem(SETTINGS,JSON.stringify(settings));document.documentElement.classList.toggle('reduce-motion',settings.reducedMotion);document.documentElement.classList.toggle('large-text',settings.largeText)}
