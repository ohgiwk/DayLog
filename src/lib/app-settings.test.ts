import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadSettings, settingsKey } from './app-settings'
afterEach(() => vi.unstubAllGlobals())
const defaults = { notifications: true, location: true, weather: true, reducedMotion: false, largeText: false }
describe('resilient app settings', () => {
 it.each(['{broken', 'null', '[]', '123', '"text"'])('uses defaults for invalid stored settings: %s', value => {
  const setItem = vi.fn()
  vi.stubGlobal('localStorage', { getItem: () => value, setItem })
  expect(loadSettings()).toEqual(defaults)
  expect(setItem).not.toHaveBeenCalled()
 })
 it('uses only known boolean settings and fills missing values', () => {
  const getItem = vi.fn(() => JSON.stringify({ location: false, largeText: true, weather: 'false', reducedMotion: 1, unknown: true }))
  vi.stubGlobal('localStorage', { getItem })
  expect(loadSettings()).toEqual({ ...defaults, location: false, largeText: true })
  expect(getItem).toHaveBeenCalledWith(settingsKey)
 })
 it('keeps startup usable when browser storage is unavailable', () => {
  vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied') } })
  expect(loadSettings()).toEqual(defaults)
 })
})
