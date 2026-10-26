import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { imageRepository, setImageDownloader, setImageScope, compressImage } from './image-repository'
import type { DiaryImage } from '../types'
const photo = (id = 'photo'): DiaryImage => ({ id, entryId: 'entry', blob: new Blob(['photo']), type: 'image/webp', createdAt: '' })
beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()); setImageScope(''); setImageDownloader(undefined) })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('account-scoped images', () => {
 it('isolates guest and account photos and deletes only the selected account cache', async () => {
  await imageRepository.put(photo())
  setImageScope('a')
  expect(await imageRepository.getLocal('photo')).toBeUndefined()
  await imageRepository.put({ ...photo(), entryId: 'a-entry' })
  expect((await imageRepository.get('photo'))?.entryId).toBe('a-entry')
  await imageRepository.delete('photo')
  expect(await imageRepository.getLocal('photo')).toBeUndefined()
  expect((await imageRepository.getLocal('photo', ''))?.entryId).toBe('entry')
 })
 it('downloads missing photos once and uses the cache on subsequent reads', async () => {
  setImageScope('a')
  const download = vi.fn().mockResolvedValue(photo())
  setImageDownloader(download)
  expect((await imageRepository.get('photo'))?.id).toBe('photo')
  expect((await imageRepository.get('photo'))?.id).toBe('photo')
  expect(download).toHaveBeenCalledExactlyOnceWith('photo', 'a')
 })
 it('does not download guest photos or cache failed downloads', async () => {
  const download = vi.fn().mockRejectedValue(new Error('offline'))
  setImageDownloader(download)
  expect(await imageRepository.get('missing')).toBeUndefined()
  expect(download).not.toHaveBeenCalled()
  setImageScope('a')
  await expect(imageRepository.get('missing')).rejects.toThrow('offline')
  expect(await imageRepository.getLocal('missing')).toBeUndefined()
 })
 it('does not return a cached photo from an account left during the database read', async () => {
  setImageScope('a')
  vi.spyOn(imageRepository, 'getLocal').mockImplementationOnce(async () => { setImageScope('b'); return photo() })
  expect(await imageRepository.get('photo')).toBeUndefined()
 })
 it('keeps a late download in its original account cache without returning it to the next account', async () => {
  setImageScope('a')
  setImageDownloader(async () => { setImageScope('b'); return photo() })
  expect(await imageRepository.get('photo')).toBeUndefined()
  expect(await imageRepository.getLocal('photo', 'b')).toBeUndefined()
  expect((await imageRepository.getLocal('photo', 'a'))?.id).toBe('photo')
 })
})

describe('photo compression', () => {
 function canvas(width: number, height: number) {
  const bitmap = { width, height, close: vi.fn() }
  const drawImage = vi.fn()
  const output = { width: 0, height: 0, getContext: vi.fn(() => ({ drawImage })), toBlob: vi.fn((done: (blob: Blob | null) => void) => done(new Blob(['webp']))) }
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))
  vi.stubGlobal('document', { createElement: () => output })
  return { bitmap, output, drawImage }
 }
 it.each([[2800, 1400, 1400, 700], [600, 800, 600, 800], [1400, 2800, 700, 1400]])('scales %sx%s to %sx%s without upscaling', async (w, h, expectedW, expectedH) => {
  const { bitmap, output } = canvas(w, h)
  await compressImage({} as File)
  expect([output.width, output.height]).toEqual([expectedW, expectedH])
  expect(bitmap.close).toHaveBeenCalledOnce()
  expect(output.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/webp', .82)
 })
 it('releases the bitmap when drawing fails', async () => {
  const { bitmap, drawImage } = canvas(100, 100)
  drawImage.mockImplementation(() => { throw new Error('draw failed') })
  await expect(compressImage({} as File)).rejects.toThrow('draw failed')
  expect(bitmap.close).toHaveBeenCalledOnce()
 })
 it('rejects an encoder failure instead of saving an empty photo', async () => {
  const { bitmap, output } = canvas(100, 100)
  output.toBlob.mockImplementation(done => done(null))
  await expect(compressImage({} as File)).rejects.toThrow('画像を処理できませんでした')
  expect(bitmap.close).toHaveBeenCalledOnce()
 })
})
