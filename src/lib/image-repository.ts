import { withStore } from './indexed-db'
import type { DiaryImage } from '../types'
let scope = ''
let download:
  ((id: string, scope: string) => Promise<DiaryImage | undefined>) | undefined
export function setImageScope(value: string) {
  scope = value
}
export function setImageDownloader(value: typeof download) {
  download = value
  return () => {
    if (download === value) download = undefined
  }
}
function access<T>(
  owner: string,
  write: boolean,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return withStore(
    {
      name: owner ? `daylog-images:${owner}` : 'daylog-images',
      store: 'images',
      keyPath: 'id',
    },
    write ? 'readwrite' : 'readonly',
    (store, result) => {
      const request = action(store)
      request.onsuccess = () => result(request.result)
    },
  )
}
export const imageRepository = {
  async put(image: DiaryImage, owner = scope) {
    await access(owner, true, (store) => store.put(image))
  },
  async getLocal(id: string, owner = scope) {
    return access<DiaryImage | undefined>(owner, false, (store) =>
      store.get(id),
    )
  },
  async get(id: string) {
    const owner = scope
    const local = await this.getLocal(id, owner)
    if (owner !== scope) return undefined
    if (local) return local
    const remote = owner && download ? await download(id, owner) : undefined
    if (remote) await this.put(remote, owner)
    return owner === scope ? remote : undefined
  },
  async delete(id: string, owner = scope) {
    await access(owner, true, (store) => store.delete(id))
  },
}
export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  try {
    const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height))
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('画像を処理できませんでした')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  } finally {
    bitmap.close()
  }
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('画像を処理できませんでした')),
      'image/webp',
      0.82,
    ),
  )
}
