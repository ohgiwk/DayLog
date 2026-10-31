import { expect, it } from 'vitest'
import { coverOpacity, coverOffset } from './cover-pull'
it('fades the fixed cover as content scrolls without fading during overscroll', () => {
  expect(coverOpacity(-50)).toBe(1)
  expect(coverOpacity(0)).toBe(1)
  expect(coverOpacity(90)).toBe(0.5)
  expect(coverOpacity(180)).toBe(0)
  expect(coverOpacity(1000)).toBe(0)
})

it('moves the background more slowly than the content', () => {
  expect(coverOffset(-20)).toBe(0)
  expect(coverOffset(100)).toBe(-60)
  expect(coverOffset(1000)).toBe(-108)
})
