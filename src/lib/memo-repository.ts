export interface MemoFolder { id: string; name: string }
export interface Memo { id: string; folderId: string; title: string; html: string; updatedAt: string }
export interface MemoLibrary { folders: MemoFolder[]; notes: Memo[] }
// Keep image-containing documents out of localStorage's small quota.
export async function accessLibrary(value?: MemoLibrary): Promise<MemoLibrary> {
 const db = await new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open('daylog-memos', 1)
  request.onupgradeneeded = () => request.result.createObjectStore('library')
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
 })
 return new Promise((resolve, reject) => {
  const transaction = db.transaction('library', value ? 'readwrite' : 'readonly')
  const store = transaction.objectStore('library')
  const request = value ? store.put(value, 'current') : store.get('current')
  transaction.oncomplete = () => { db.close(); resolve(value ?? request.result ?? { folders: [], notes: [] }) }
  transaction.onabort = transaction.onerror = () => { db.close(); reject(transaction.error) }
 })
}
