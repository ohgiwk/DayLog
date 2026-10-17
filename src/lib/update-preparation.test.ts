import { expect, it, vi } from 'vitest'
import { prepareEditorsForUpdate, registerUpdatePreparation } from './update-preparation'
it('waits for pending saves before allowing an update', async () => {
 let finish!: () => void
 const pending = new Promise<void>(resolve => { finish = resolve })
 const save = vi.fn(async () => { await pending; return true })
 const remove = registerUpdatePreparation(save)
 try {
  let ready = false
  const result = prepareEditorsForUpdate().then(value => { ready = value })
  expect(ready).toBe(false)
  finish(); await result
  expect(ready).toBe(true)
 } finally { remove() }
})
it('blocks reload on save failure and permits retry after recovery', async () => {
 const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true).mockRejectedValueOnce(new Error('quota'))
 const remove = registerUpdatePreparation(save)
 try {
  expect(await prepareEditorsForUpdate()).toBe(false)
  expect(await prepareEditorsForUpdate()).toBe(true)
  expect(await prepareEditorsForUpdate()).toBe(false)
 } finally { remove() }
})
it('unregisters closed editors and saves all mounted editors', async () => {
 const closed = vi.fn(), active = vi.fn(()=>true), questions = vi.fn(()=>true)
 registerUpdatePreparation(closed)()
 const remove = registerUpdatePreparation(active), removeQuestions = registerUpdatePreparation(questions)
 try {
  expect(await prepareEditorsForUpdate()).toBe(true)
  expect(closed).not.toHaveBeenCalled()
  expect(active).toHaveBeenCalledOnce()
  expect(questions).toHaveBeenCalledOnce()
 } finally { remove(); removeQuestions() }
})
