import { expect, it } from 'vitest'
import { viewportBottomInset } from './viewport-bottom'

it('keeps the normal bottom position when the keyboard is closed', () => {
 expect(viewportBottomInset(800, 800, 0)).toBe(0)
})

it('anchors above the keyboard and compensates for scrolling the visual viewport', () => {
 expect(viewportBottomInset(800, 480, 0)).toBe(320)
 expect(viewportBottomInset(800, 480, 120)).toBe(200)
 expect(viewportBottomInset(800, 480, 320)).toBe(0)
})

it('handles browsers that resize the layout viewport and clamps overscroll', () => {
 expect(viewportBottomInset(480, 480, 0)).toBe(0)
 expect(viewportBottomInset(800, 800, 20)).toBe(0)
})
