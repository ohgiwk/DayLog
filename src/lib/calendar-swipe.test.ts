import { describe, expect, it } from 'vitest'
import { swipeDirection } from './calendar-swipe'
describe('calendar swipe', () => {
  it('accepts a short fast flick in either direction', () => {
    expect(swipeDirection(-20, 350, -0.5)).toBe(1)
    expect(swipeDirection(20, 350, 0.5)).toBe(-1)
  })
  it('returns small, paused, or reversed gestures to the current page', () => {
    expect(swipeDirection(-4, 350, -0.8)).toBe(0)
    expect(swipeDirection(-20, 350, 0)).toBe(0)
    expect(swipeDirection(-20, 350, 0.5)).toBe(0)
  })
  it('accepts a deliberate slow drag and rejects an unmeasured viewport', () => {
    expect(swipeDirection(-55, 350, 0)).toBe(1)
    expect(swipeDirection(55, 350, 0)).toBe(-1)
    expect(swipeDirection(-55, 0, -0.5)).toBe(0)
  })
})
