// @vitest-environment jsdom
import { createApp, h, type App } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { afterEach, expect, it, vi } from 'vitest'
import type { DiaryEntry } from '../types'
import RecordsView from './RecordsView.vue'
const images = vi.hoisted(() => ({ get: vi.fn(async () => undefined) }))
vi.mock('../lib/image-repository', () => ({ imageRepository: images }))
vi.mock('../lib/staggered-reveal', () => ({ useStaggeredReveal: () => ({}) }))
vi.mock('../stores/diary', async () => {
  const { ref } = await import('vue')
  const entry: DiaryEntry = {
    id: 'entry',
    date: '2026-10-31',
    mood: 3,
    condition: 3,
    answers: {},
    tags: [],
    guess: '代表写真の日記',
    body: '本文',
    tomorrow: '',
    imageIds: ['cover', 'unused-photo'],
    thumbnailImageId: 'cover',
    createdAt: '',
    updatedAt: '',
  }
  return {
    entries: ref([
      entry,
      {
        ...entry,
        id: 'text',
        date: '2026-10-30',
        imageIds: [],
        thumbnailImageId: undefined,
      },
    ]),
    settings: { reducedMotion: false },
  }
})
let app: App | undefined
afterEach(() => {
  app?.unmount()
  document.body.innerHTML = ''
  vi.clearAllMocks()
})
it('loads only the cover displayed in the record list', async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/records', component: RecordsView },
      { path: '/:pathMatch(.*)*', component: { render: () => null } },
    ],
  })
  await router.push('/records')
  const root = document.createElement('div')
  document.body.append(root)
  app = createApp({ render: () => h(RouterView) }).use(router)
  app.mount(root)
  await vi.waitFor(() => expect(images.get).toHaveBeenCalledTimes(1))
  expect(images.get).toHaveBeenCalledWith('cover')
  expect(root.querySelectorAll('.entry-row')).toHaveLength(2)
  expect(root.querySelectorAll('.timeline-date')).toHaveLength(2)
  expect(root.querySelectorAll('.entry-photo')).toHaveLength(1)
})
