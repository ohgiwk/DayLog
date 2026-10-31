// @vitest-environment jsdom
import { createApp, h, nextTick, type App } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { afterEach, expect, it, vi } from 'vitest'
import type { MemoLibrary } from '../lib/memo-repository'
import MemosView from './MemosView.vue'
const state = vi.hoisted(() => ({
  library: {
    folders: [{ id: 'folder', name: '日常' }],
    notes: [],
  } as MemoLibrary,
  writes: vi.fn(),
  completeClose: undefined as (() => void) | undefined,
}))
vi.mock('../lib/memo-repository', () => ({
  memoOwner: () => 'test',
  onMemoChange: () => () => {},
  accessLibrary: async (value?: MemoLibrary) => {
    if (value) {
      state.writes(value)
      state.library = value
    }
    return state.library
  },
}))
vi.mock('../lib/memo-sync', () => ({
  setMemoEditingCheck: vi.fn(),
  scheduleMemoSync: vi.fn(),
}))
vi.mock('../lib/image-repository', () => ({ compressImage: vi.fn() }))
vi.mock('../lib/delete-confirmation', () => ({ confirmDelete: vi.fn() }))
vi.mock('../components/LegacyMemoImport.vue', () => ({
  default: { render: () => null },
}))
vi.mock('../lib/dialog-motion', () => ({
  createDialogMotion: () => ({
    open: (dialog: HTMLDialogElement) => {
      dialog.open = true
    },
    close: (dialog: HTMLDialogElement) =>
      new Promise<boolean>((resolve) => {
        state.completeClose = () => {
          dialog.open = false
          resolve(true)
        }
      }),
    dispose: vi.fn(),
  }),
}))
let app: App | undefined
afterEach(() => {
  app?.unmount()
  document.body.innerHTML = ''
  vi.clearAllMocks()
})
it('does not create duplicate memos when submit is repeated during the closing animation', async () => {
  const root = document.createElement('div')
  document.body.append(root)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: MemosView }],
  })
  await router.push('/')
  app = createApp({ render: () => h(RouterView) }).use(router)
  app.mount(root)
  await vi.waitFor(() =>
    expect(document.querySelector('[aria-label="メモを書く"]')).not.toBeNull(),
  )
  document
    .querySelector<HTMLButtonElement>('[aria-label="メモを書く"]')!
    .click()
  await nextTick()
  const form = document.querySelector<HTMLFormElement>(
    'dialog[aria-labelledby="memo-create-title"] form',
  )!
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await vi.waitFor(() => expect(state.completeClose).toBeDefined())
  expect(state.writes).toHaveBeenCalledTimes(1)
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await nextTick()
  expect(state.writes).toHaveBeenCalledTimes(1)
  state.completeClose!()
  await nextTick()
  expect(state.library.notes).toHaveLength(1)
})
