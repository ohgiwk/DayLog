import { expect, it } from 'vitest'
import { coverStretch, shouldExpandCover, coverOpacity, coverOffset } from './cover-pull'
it('stretches with resistance and caps excessive pulling',()=>{
 expect(coverStretch(-20)).toBe(0)
 expect(coverStretch(100)).toBe(50)
 expect(coverStretch(10000)).toBe(128)
})
it('expands only after the threshold is crossed',()=>{
 expect(shouldExpandCover(139)).toBe(false)
 expect(shouldExpandCover(140)).toBe(true)
})

it('fades the fixed cover as content scrolls without fading during overscroll',()=>{
 expect(coverOpacity(-50)).toBe(1)
 expect(coverOpacity(0)).toBe(1)
 expect(coverOpacity(90)).toBe(.5)
 expect(coverOpacity(180)).toBe(0)
 expect(coverOpacity(1000)).toBe(0)
})

it('moves the background more slowly than the content',()=>{
 expect(coverOffset(-20)).toBe(0)
 expect(coverOffset(100)).toBe(-60)
 expect(coverOffset(1000)).toBe(-108)
})
