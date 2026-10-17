import { expect, it } from 'vitest'
import { journalDate } from './journal-date'
it('accepts past dates and today', () => {
 expect(journalDate('2024-02-29', '2026-10-17')).toBe('2024-02-29')
 expect(journalDate('2026-10-17', '2026-10-17')).toBe('2026-10-17')
})
it('falls back to today for invalid dates, future dates and malformed queries', () => {
 for (const value of ['2026-02-30', '2025-02-29', '2026-13-01', '2026-10-18', 'invalid', ['2026-10-16'], undefined]) {
  expect(journalDate(value, '2026-10-17')).toBe('2026-10-17')
 }
})
