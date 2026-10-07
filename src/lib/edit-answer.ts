import { activityQuestions, buildGuess } from '../data/questions'
import type { DiaryEntry, MoodValue } from '../types'

export function editAnswer(entry: DiaryEntry, id: string, value: string): DiaryEntry {
 const answers = { ...entry.answers }
 if (value) answers[id] = value
 else delete answers[id]
 for (const question of activityQuestions) {
  if (question.when && !question.when(answers)) delete answers[question.id]
 }
 const guess = buildGuess(answers)
 return {
  ...entry, answers, tags: guess.tags, guess: guess.text, guessResult: undefined,
  mood: (Number(answers.mood) || 3) as MoodValue,
  condition: Number(answers.condition) || 3,
 }
}
