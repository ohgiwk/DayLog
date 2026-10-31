import { afterEach, expect, it, vi } from 'vitest'
import { formatReleaseDate, releaseDate } from './app-version'
afterEach(() => vi.useRealTimers())
it('uses the push event timestamp instead of a later build time', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-26T10:00:00Z'))
  const pushedAt = String(Date.parse('2026-10-26T03:04:05Z') / 1000)
  expect(releaseDate(pushedAt)).toBe('2026-10-26T03:04:05.000Z')
  expect(formatReleaseDate(releaseDate(pushedAt))).toBe('v2026.10.26-120405')
})
it('normalizes ISO dates and uses build time for manual or local builds', () => {
  expect(releaseDate('2026-10-26T12:04:05+09:00')).toBe(
    '2026-10-26T03:04:05.000Z',
  )
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-26T03:04:05Z'))
  expect(releaseDate()).toBe('2026-10-26T03:04:05.000Z')
  expect(releaseDate('')).toBe(releaseDate())
})
it('shows Japanese midnight correctly even when the UTC date differs', () => {
  expect(formatReleaseDate('2026-10-25T15:00:00Z')).toBe('v2026.10.26-000000')
})
it('rejects invalid release metadata instead of displaying an incorrect version', () => {
  expect(() => releaseDate('not-a-date')).toThrow('Invalid app release date')
})
