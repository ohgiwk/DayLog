import { activityQuestions, buildGuess } from '../data/questions'
import type { DiaryEntry, MoodValue } from '../types'

export function editAnswer(
  entry: DiaryEntry,
  id: string,
  value: string,
): DiaryEntry {
  const answers = { ...entry.answers }
  if (value) answers[id] = value
  else delete answers[id]
  return editAnswers(entry, answers)
}

export function editAnswers(
  entry: DiaryEntry,
  values: Record<string, string>,
): DiaryEntry {
  const answers = { ...values }
  const customTitle =
    entry.guess.trim() && entry.guess !== buildGuess(entry.answers).text
  for (const question of activityQuestions) {
    if (question.when && !question.when(answers)) delete answers[question.id]
  }
  const guess = buildGuess(answers)
  return {
    ...entry,
    answers,
    tags: [
      ...new Set([
        ...entry.tags.filter(
          (tag) =>
            !buildGuess(entry.answers).tags.some(
              (previous) => previous === tag,
            ),
        ),
        ...guess.tags,
      ]),
    ],
    guess: customTitle ? entry.guess : guess.text,
    guessResult: undefined,
    mood: (Number(answers.mood) || 3) as MoodValue,
    condition: Number(answers.condition) || 3,
  }
}
