import { describe, expect, it } from 'vitest'
import { calendarDays, dateKey, moveCalendar } from './records-calendar'

describe('records calendar', () => {
 it('includes leap day and aligns complete month rows to Sunday', () => {
  const days = calendarDays(new Date(2024, 1, 15, 12), 'month')
  expect(days).toHaveLength(35)
  expect(days.slice(0, 4)).toEqual([null, null, null, null])
  expect(days.filter(Boolean)).toHaveLength(29)
  expect(dateKey(days[32]!)).toBe('2024-02-29')
 })
 it('shows seven consecutive dates across a year boundary', () => {
  const days = calendarDays(new Date(2026, 11, 31, 12), 'week')
  expect(days.map(day => dateKey(day!))).toEqual(['2026-12-27', '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'])
 })
 it('moves months without skipping February and weeks by seven days', () => {
  expect(dateKey(moveCalendar(new Date(2026, 0, 31, 12), 'month', 1))).toBe('2026-02-01')
  expect(dateKey(moveCalendar(new Date(2027, 0, 2, 12), 'week', -1))).toBe('2026-12-26')
 })
})
