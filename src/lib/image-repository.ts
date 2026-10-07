import type { DiaryImage } from '../types'
let scope = ''
let download: ((id: string, scope: string) => Promise<DiaryImage | undefined>) | undefined
export function setImageScope(value: string) { scope = value }
export function setImageDownloader(value: typeof download) { download = value }
const STORE = 'images'
const open = (owner: string) => new Promise<IDBDatabase>((resolve, reject) => {
 const request = indexedDB.open(owner ? `daylog-images:${owner}` : 'daylog-images', 1)
 request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' })
 request.onsuccess = () => resolve(request.result)
 request.onerror = () => reject(request.error)
})
async function access<T>(owner: string, write: boolean, action: (store: IDBObjectStore) => IDBRequest): Promise<T> {
 const db = await open(owner)
 return new Promise((resolve, reject) => {
  const tx = db.transaction(STORE, write ? 'readwrite' : 'readonly')
  const request = action(tx.objectStore(STORE))
  tx.oncomplete = () => { db.close(); resolve(request.result) }
  tx.onabort = tx.onerror = () => { db.close(); reject(tx.error) }
 })
}
export const imageRepository = {
 async put(image: DiaryImage, owner = scope) { await access(owner, true, store => store.put(image)) },
 async getLocal(id: string, owner = scope) { return access<DiaryImage | undefined>(owner, false, store => store.get(id)) },
 async get(id: string) {
  const owner = scope
  const local = await this.getLocal(id, owner)
  if (local) return local
  const remote = owner && download ? await download(id, owner) : undefined
  if (remote) await this.put(remote, owner)
  return owner === scope ? remote : undefined
 },
 async delete(id: string, owner = scope) { await access(owner, true, store => store.delete(id)) },
}
export async function compressImage(file:File):Promise<Blob>{
 const bitmap=await createImageBitmap(file);const max=1400;const scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();return new Promise((res,rej)=>canvas.toBlob(b=>b?res(b):rej(new Error('画像を処理できませんでした')),'image/webp',.82))
}
