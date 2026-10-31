// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { applySeasonTheme, seasonForDate } from './season-theme'
describe('seasonal theme', () => {
  it.each([
    [1, 'winter'],
    [2, 'winter'],
    [3, 'spring'],
    [5, 'spring'],
    [6, 'summer'],
    [8, 'summer'],
    [9, 'autumn'],
    [11, 'autumn'],
    [12, 'winter'],
  ])('resolves month %s as %s', (month, expected) => {
    expect(seasonForDate(new Date(2026, Number(month) - 1, 1))).toBe(expected)
  })
  it('changes automatically at the season boundary and preserves a manual choice', () => {
    applySeasonTheme('auto', new Date(2026, 10, 30, 23, 59))
    expect(document.documentElement.dataset.season).toBe('autumn')
    applySeasonTheme('auto', new Date(2026, 11, 1))
    expect(document.documentElement.dataset.season).toBe('winter')
    applySeasonTheme('summer', new Date(2026, 11, 1))
    expect(document.documentElement.dataset.season).toBe('summer')
  })
})
