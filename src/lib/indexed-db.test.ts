import { IDBFactory, IDBDatabase } from 'fake-indexeddb'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { withStore } from './indexed-db'
const schema = { name: 'transaction-test', store: 'values' }
beforeEach(() => vi.stubGlobal('indexedDB', new IDBFactory()))
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
it('does not report success for a request in an aborted transaction', async () => {
  const close = vi.spyOn(IDBDatabase.prototype, 'close')
  await expect(
    withStore(schema, 'readwrite', (store, result) => {
      const request = store.put('value', 'key')
      request.onsuccess = () => {
        result('request succeeded')
        store.transaction.abort()
      }
    }),
  ).rejects.toThrow()
  expect(close).toHaveBeenCalledOnce()
  const value = await withStore(schema, 'readonly', (store, result) => {
    const request = store.get('key')
    request.onsuccess = () => result(request.result)
  })
  expect(value).toBeUndefined()
})
it('closes the database and rejects synchronous request errors', async () => {
  const close = vi.spyOn(IDBDatabase.prototype, 'close')
  await expect(
    withStore(schema, 'readonly', (store) => {
      store.put('value', 'key')
    }),
  ).rejects.toThrow()
  expect(close).toHaveBeenCalledOnce()
})
it('rejects open failures without leaving a pending operation', async () => {
  vi.stubGlobal('indexedDB', {
    open: () => {
      throw new Error('storage unavailable')
    },
  })
  await expect(withStore(schema, 'readonly', () => {})).rejects.toThrow(
    'storage unavailable',
  )
})
it('rejects asynchronous request failures and preserves the previous committed value', async () => {
  await withStore(schema, 'readwrite', (store, result) => {
    const request = store.add('original', 'key')
    request.onsuccess = () => result(request.result)
  })
  await expect(
    withStore(schema, 'readwrite', (store, result) => {
      const request = store.add('duplicate', 'key')
      request.onsuccess = () => result(request.result)
    }),
  ).rejects.toThrow()
  expect(
    await withStore(schema, 'readonly', (store, result) => {
      const request = store.get('key')
      request.onsuccess = () => result(request.result)
    }),
  ).toBe('original')
})
