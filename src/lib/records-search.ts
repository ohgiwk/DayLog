import type { DiaryEntry } from '../types'
import { readRichText } from './rich-text'
const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().trim()
export function filterRecords(entries: DiaryEntry[], query: string, tag: string): DiaryEntry[] {
 const words = normalize(query).split(/\s+/).filter(Boolean)
 return entries.filter(entry => {
  if (tag && !entry.tags.some(value => normalize(value) === normalize(tag))) return false
  const text = normalize([entry.guess, readRichText(entry.body).text, entry.tomorrow, entry.date, entry.environment?.place ?? '', ...entry.tags].join('\n'))
  return words.every(word => text.includes(word))
 })
}
