import { buildGuess } from '../data/questions'
import type { DiaryEntry } from '../types'
import { readRichText } from './rich-text'

export function hasDiaryContent(entry: DiaryEntry): boolean {
 return Boolean(
  readRichText(entry.body).text.trim()
  || entry.tomorrow.trim()
  || (entry.guess.trim() && entry.guess !== buildGuess(entry.answers).text)
  || entry.environment?.place || entry.environment?.weather
  || entry.tags.length
  || entry.imageIds.length
  || Object.values(entry.answers).some(value => value.trim() && value !== 'skip')
 )
}
