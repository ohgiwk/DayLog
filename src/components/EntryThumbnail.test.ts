// @vitest-environment jsdom
import { createApp, nextTick, ref, type App } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import EntryThumbnail from './EntryThumbnail.vue'
import type { DiaryImage } from '../types'

const get = vi.hoisted(() => vi.fn())
vi.mock('../lib/image-repository', () => ({ imageRepository: { get } }))
let app: App | undefined
afterEach(() => {
  app?.unmount()
  app = undefined
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
  get.mockReset()
})

it('ignores stale image loads and releases each URL on replacement or unmount', async () => {
  const pending = new Map<string, (image: DiaryImage) => void>()
  get.mockImplementation(
    (id: string) =>
      new Promise<DiaryImage>((resolve) => pending.set(id, resolve)),
  )
  const createObjectURL = vi
    .fn()
    .mockReturnValueOnce('blob:b')
    .mockReturnValueOnce('blob:c')
  const revokeObjectURL = vi.fn()
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
  const id = ref('a')
  const root = document.createElement('div')
  document.body.append(root)
  app = createApp({
    components: { EntryThumbnail },
    setup: () => ({ id }),
    template: '<EntryThumbnail :id="id" />',
  })
  app.mount(root)
  id.value = 'b'
  await nextTick()
  const image = { blob: new Blob(['image']) } as DiaryImage
  pending.get('a')!(image)
  await nextTick()
  expect(createObjectURL).not.toHaveBeenCalled()
  pending.get('b')!(image)
  await nextTick()
  await nextTick()
  expect(root.querySelector('img')?.getAttribute('src')).toBe('blob:b')
  id.value = 'c'
  await nextTick()
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:b')
  pending.get('c')!(image)
  await nextTick()
  app.unmount()
  app = undefined
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:c')
  expect(revokeObjectURL).toHaveBeenCalledTimes(2)
})

it('does not create a URL when an image finishes loading after unmount', async () => {
  let resolve!: (image: DiaryImage) => void
  get.mockReturnValue(
    new Promise<DiaryImage>((done) => {
      resolve = done
    }),
  )
  const createObjectURL = vi.fn()
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() })
  app = createApp(EntryThumbnail, { id: 'a' })
  app.mount(document.createElement('div'))
  app.unmount()
  app = undefined
  resolve({ blob: new Blob(['image']) } as DiaryImage)
  await nextTick()
  expect(createObjectURL).not.toHaveBeenCalled()
})
