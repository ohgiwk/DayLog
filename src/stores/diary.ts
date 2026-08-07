import { computed, reactive } from 'vue'
import type { AppSettings, DiaryEntry } from '../types'
import { imageRepository } from '../lib/image-repository'
const KEY='daylog:v1:entries', SETTINGS='daylog:v1:settings'
const today=()=>new Date().toISOString().slice(0,10)
function seed():DiaryEntry[]{const dates=[2,5,8,11,15,18,22].map(n=>{const d=new Date();d.setDate(d.getDate()-n);return d.toISOString().slice(0,10)});return dates.map((date,i)=>({id:crypto.randomUUID(),date,mood:([4,3,5,2,4,3,5] as const)[i],condition:3+(i%2),answers:{},tags:([['散歩'],['仕事・勉強'],['人と会った'],['おうち時間'],['買い物'],['運動'],['外出']] as DiaryEntry['tags'][])[i],guess:'穏やかな一日を過ごした',guessResult:'correct',body:['夕方の風が心地よかった。','集中して作業を進められた。','久しぶりにゆっくり話せた。'][i%3],tomorrow:'少し早く休む',imageIds:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}))}
function load(){try{const v=JSON.parse(localStorage.getItem(KEY)||'null');return Array.isArray(v)?v:seed()}catch{return seed()}}
export const diaryState=reactive({entries:load() as DiaryEntry[]})
export const settings=reactive<AppSettings>({...{notifications:true,location:true,weather:true,reducedMotion:false,largeText:false},...JSON.parse(localStorage.getItem(SETTINGS)||'{}')})
export const entries=computed(()=>[...diaryState.entries].sort((a,b)=>b.date.localeCompare(a.date)))
export const todaysEntry=computed(()=>diaryState.entries.find(e=>e.date===today()))
export function saveEntry(entry:DiaryEntry){const i=diaryState.entries.findIndex(e=>e.date===entry.date);if(i>=0)diaryState.entries[i]=entry;else diaryState.entries.push(entry);persist()}
export async function deleteEntry(id:string){const e=diaryState.entries.find(x=>x.id===id);if(e)await Promise.all(e.imageIds.map(imageRepository.delete));diaryState.entries=diaryState.entries.filter(x=>x.id!==id);persist()}
export function persist(){localStorage.setItem(KEY,JSON.stringify(diaryState.entries))}
export function saveSettings(){localStorage.setItem(SETTINGS,JSON.stringify(settings));document.documentElement.classList.toggle('reduce-motion',settings.reducedMotion);document.documentElement.classList.toggle('large-text',settings.largeText)}
