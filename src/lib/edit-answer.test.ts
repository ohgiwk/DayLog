import { describe, expect, it } from 'vitest'
import { editAnswer } from './edit-answer'
import type { DiaryEntry } from '../types'

const entry: DiaryEntry = {
 id: 'entry', date: '2026-10-07', mood: 4, condition: 4,
 answers: { mood: '4', condition: '4', exercise: 'yes', exerciseType: 'walk' },
 tags: ['運動', '散歩'], guess: '今日は外を散歩して、気分転換をした',
 body: '自分で書いた本文', tomorrow: '読書', imageIds: ['photo'], thumbnailImageId: 'photo',
 createdAt: 'created', updatedAt: 'updated',
}

describe('editing diary answers', () => {
 it('removes inapplicable follow-ups and recalculates the summary and tags', () => {
  const result = editAnswer(entry, 'exercise', 'no')
  expect(result.answers.exerciseType).toBeUndefined()
  expect(result.tags).toEqual([])
  expect(result.guess).not.toContain('散歩')
  expect(entry.answers.exerciseType).toBe('walk')
 })
 it('updates mood while preserving written content and photos', () => {
  const result = editAnswer(entry, 'mood', '1')
  expect(result.mood).toBe(1)
  for (const key of ['body', 'tomorrow', 'imageIds', 'thumbnailImageId', 'id', 'date', 'createdAt'] as const) {
   expect(result[key]).toEqual(entry[key])
  }
 })
 it('supports skips, clearing answers, and answering newly relevant questions', () => {
  expect(editAnswer(entry, 'condition', 'skip').condition).toBe(3)
  const cleared = editAnswer(entry, 'mood', '')
  expect(cleared.answers.mood).toBeUndefined()
  expect(cleared.mood).toBe(3)
  const result = editAnswer(editAnswer(entry, 'meeting', 'yes'), 'meetingType', 'friend')
  expect(result.answers.meetingType).toBe('friend')
  expect(result.tags).toContain('人と会った')
 })
})
