import { describe, expect, it } from 'vitest'
import { editAnswers } from './edit-answer'
import type { DiaryEntry } from '../types'

const entry: DiaryEntry = {
  id: 'entry',
  date: '2026-10-07',
  mood: 4,
  condition: 4,
  answers: { mood: '4', condition: '4', exercise: 'yes', exerciseType: 'walk' },
  tags: ['運動', '散歩'],
  guess: '今日は外を散歩して、気分転換をした',
  body: '自分で書いた本文',
  tomorrow: '読書',
  imageIds: ['photo'],
  thumbnailImageId: 'photo',
  createdAt: 'created',
  updatedAt: 'updated',
}

describe('editing diary answers', () => {
  it('removes inapplicable follow-ups and recalculates the summary and tags', () => {
    const result = editAnswers(entry, { ...entry.answers, exercise: 'no' })
    expect(result.answers.exerciseType).toBeUndefined()
    expect(result.tags).toEqual([])
    expect(result.guess).not.toContain('散歩')
    expect(entry.answers.exerciseType).toBe('walk')
  })
  it('updates mood while preserving written content and photos', () => {
    const result = editAnswers(entry, { ...entry.answers, mood: '1' })
    expect(result.mood).toBe(1)
    for (const key of [
      'body',
      'tomorrow',
      'imageIds',
      'thumbnailImageId',
      'id',
      'date',
      'createdAt',
    ] as const) {
      expect(result[key]).toEqual(entry[key])
    }
  })
  it('supports skips, clearing answers, and answering newly relevant questions', () => {
    expect(
      editAnswers(entry, { ...entry.answers, condition: 'skip' }).condition,
    ).toBe(3)
    const remaining = { ...entry.answers }
    delete remaining.mood
    const cleared = editAnswers(entry, remaining)
    expect(cleared.answers.mood).toBeUndefined()
    expect(cleared.mood).toBe(3)
    const result = editAnswers(entry, {
      ...entry.answers,
      meeting: 'yes',
      meetingType: 'friend',
    })
    expect(result.answers.meetingType).toBe('friend')
    expect(result.tags).toContain('人と会った')
  })
})

it('preserves a custom title when answers change', () => {
  const custom = { ...entry, guess: '秋の散歩と読書' }
  expect(editAnswers(custom, { ...custom.answers, exercise: 'no' }).guess).toBe(
    custom.guess,
  )
  expect(editAnswers(custom, { work: 'yes' }).guess).toBe(custom.guess)
})
it('updates an automatic title when answering a full question session', () => {
  expect(editAnswers(entry, { work: 'yes' }).guess).toBe(
    '今日は仕事や勉強に取り組んだ',
  )
})

it('preserves custom tags when answers are changed', () => {
  const entry = {
    id: 'custom',
    answers: {},
    tags: ['旅行'],
    guess: '',
    body: '',
  } as unknown as DiaryEntry
  expect(editAnswers(entry, { ...entry.answers, mood: '4' }).tags).toContain(
    '旅行',
  )
})
