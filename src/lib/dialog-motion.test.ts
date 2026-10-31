// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { createDialogMotion } from './dialog-motion'
afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
  document.documentElement.classList.remove('reduce-motion')
})
function setup(reduced = false) {
  vi.stubGlobal('matchMedia', () => ({ matches: reduced }))
  const dialog = document.createElement('dialog')
  document.body.append(dialog)
  dialog.showModal = () => {
    dialog.open = true
  }
  dialog.close = vi.fn(() => {
    dialog.open = false
  })
  const effects: { finish: () => void; cancel: ReturnType<typeof vi.fn> }[] = []
  dialog.animate = vi.fn(() => {
    let finish!: () => void
    const finished = new Promise<void>((resolve) => {
      finish = resolve
    })
    const cancel = vi.fn(finish)
    effects.push({ finish, cancel })
    return { finished, cancel } as unknown as Animation
  })
  return { dialog, effects, motion: createDialogMotion() }
}
it('keeps the dialog modal until exit finishes and coalesces repeated close requests', async () => {
  const { dialog, effects, motion } = setup()
  motion.open(dialog)
  expect(dialog.open).toBe(true)
  expect(dialog.dataset.dialogMotion).toBe('opening')
  const closed = motion.close(dialog)
  expect(motion.close(dialog)).toBe(closed)
  expect(effects[0]!.cancel).toHaveBeenCalled()
  expect(dialog.open).toBe(true)
  expect(dialog.dataset.dialogMotion).toBe('closing')
  effects[1]!.finish()
  expect(await closed).toBe(true)
  expect(dialog.open).toBe(false)
  expect(dialog.dataset.dialogMotion).toBeUndefined()
  motion.open(dialog)
  expect(dialog.open).toBe(true)
  motion.dispose()
})
it.each(['system', 'setting'])(
  'skips motion for reduced motion from %s',
  async (source) => {
    const { dialog, motion } = setup(source === 'system')
    if (source === 'setting')
      document.documentElement.classList.add('reduce-motion')
    motion.open(dialog)
    expect(dialog.open).toBe(true)
    expect(await motion.close(dialog)).toBe(true)
    expect(dialog.animate).not.toHaveBeenCalled()
  },
)
it('cancels pending animation on teardown without completing a stale close', async () => {
  const { dialog, motion } = setup()
  motion.open(dialog)
  const closing = motion.close(dialog)
  motion.dispose()
  expect(await closing).toBe(false)
  expect(dialog.open).toBe(false)
})
