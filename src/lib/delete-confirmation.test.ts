import { afterEach, expect, it } from 'vitest'
import { confirmDelete, deleteConfirmation, finishDeleteConfirmation } from './delete-confirmation'
const options = { title: '削除しますか？', message: '削除を確認してください。' }
afterEach(() => finishDeleteConfirmation(false))
it('resolves only after an explicit confirmation and clears the dialog', async () => {
 const result = confirmDelete(options)
 expect(deleteConfirmation.value).toEqual(options)
 finishDeleteConfirmation(true)
 expect(await result).toBe(true)
 expect(deleteConfirmation.value).toBeNull()
})
it('rejects duplicate requests without replacing the active confirmation', async () => {
 const original = confirmDelete(options)
 expect(await confirmDelete({ title: '別の削除', message: '' })).toBe(false)
 expect(deleteConfirmation.value).toEqual(options)
 finishDeleteConfirmation(false)
 expect(await original).toBe(false)
})
it('can open another confirmation after cancellation and tolerates duplicate close events', async () => {
 const first = confirmDelete(options)
 finishDeleteConfirmation(false)
 finishDeleteConfirmation(true)
 expect(await first).toBe(false)
 const second = confirmDelete(options)
 finishDeleteConfirmation(true)
 expect(await second).toBe(true)
})
