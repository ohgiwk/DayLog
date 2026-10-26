export interface StoreSchema { name: string; store: string; keyPath?: string }

async function openDatabase(schema: StoreSchema): Promise<IDBDatabase> {
 return new Promise((resolve, reject) => {
  const request = indexedDB.open(schema.name, 1)
  request.onupgradeneeded = () => request.result.createObjectStore(schema.store, schema.keyPath ? { keyPath: schema.keyPath } : undefined)
  request.onsuccess = () => {
   const db = request.result
   db.onversionchange = () => db.close()
   resolve(db)
  }
  request.onerror = () => reject(request.error)
 })
}

// A request succeeding does not guarantee its transaction committed. Publish the
// result only on completion, and close the connection on every failure path.
export async function withStore<T>(
 schema: StoreSchema,
 mode: IDBTransactionMode,
 action: (store: IDBObjectStore, result: (value: T) => void, abort: (error: unknown) => void) => void,
): Promise<T> {
 const db = await openDatabase(schema)
 try {
  return await new Promise<T>((resolve, reject) => {
   const tx = db.transaction(schema.store, mode)
   let value: T, failure: unknown
   tx.oncomplete = () => resolve(value)
   tx.onabort = () => reject(failure ?? tx.error ?? new Error('storage_transaction_aborted'))
   const abort = (error: unknown) => { failure = error; tx.abort() }
   try { action(tx.objectStore(schema.store), result => { value = result }, abort) }
   catch (error) { abort(error) }
  })
 } finally { db.close() }
}
