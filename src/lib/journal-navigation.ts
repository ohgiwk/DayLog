import type { DiaryEntry } from '../types'
import { journalDate } from './journal-date'

export function existingJournalPath(entries: DiaryEntry[], date?: unknown): string | undefined {
 const target = journalDate(date)
 const existing = entries.find(entry => entry.date === target)
 return existing ? `/entry/${existing.id}` : undefined
}
