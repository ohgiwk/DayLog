import { shallowRef } from 'vue'
export interface DeleteConfirmation { title: string; message: string }
export const deleteConfirmation = shallowRef<DeleteConfirmation | null>(null)
let resolvePending: ((confirmed: boolean) => void) | undefined
export function confirmDelete(options: DeleteConfirmation): Promise<boolean> {
 // Ignore repeated requests while a confirmation is already open.
 if (resolvePending) return Promise.resolve(false)
 deleteConfirmation.value = options
 return new Promise(resolve => { resolvePending = resolve })
}
export function finishDeleteConfirmation(confirmed: boolean) {
 const resolve = resolvePending
 resolvePending = undefined
 deleteConfirmation.value = null
 resolve?.(confirmed)
}
