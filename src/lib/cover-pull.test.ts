import { expect, it } from 'vitest'
import { coverStretch, shouldExpandCover } from './cover-pull'
it('stretches with resistance and caps excessive pulling',()=>{
 expect(coverStretch(-20)).toBe(0)
 expect(coverStretch(100)).toBe(50)
 expect(coverStretch(10000)).toBe(128)
})
it('expands only after the threshold is crossed',()=>{
 expect(shouldExpandCover(139)).toBe(false)
 expect(shouldExpandCover(140)).toBe(true)
})
