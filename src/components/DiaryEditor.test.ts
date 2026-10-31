// @vitest-environment jsdom
import { createApp, nextTick, type App } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import DiaryEditor from './DiaryEditor.vue'
import type { DiaryEntry } from '../types'
const storage = vi.hoisted(() => ({
  save: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
  compress: vi.fn(),
  remove: vi.fn(),
  confirm: vi.fn(),
  entries: [] as DiaryEntry[],
}))
vi.mock('../stores/diary', () => ({
  diaryScope: { userId: 'a', generation: 1 },
  entries: {
    get value() {
      return storage.entries
    },
  },
  saveEntry: storage.save,
  deleteEntry: vi.fn(),
}))
vi.mock('../lib/image-repository', () => ({
  compressImage: storage.compress,
  imageRepository: {
    get: storage.get,
    put: storage.put,
    delete: storage.remove,
  },
}))
vi.mock('../lib/delete-confirmation', () => ({
  confirmDelete: storage.confirm,
}))
vi.mock('vue-router', () => ({ onBeforeRouteLeave: vi.fn() }))
vi.mock('./RichTextEditor.vue', () => ({ default: { template: '<div />' } }))
vi.mock('./DiaryEnvironmentPanel.vue', () => ({
  default: { template: '<div />' },
}))
vi.mock('./PhotoLightbox.vue', () => ({ default: { template: '<div />' } }))
let app: App | undefined
const initial = (
  imageIds = ['a', 'b', 'c'],
  thumbnailImageId: string | undefined = 'a',
): DiaryEntry => ({
  id: 'diary',
  date: '2026-10-26',
  guess: '日記',
  body: '本文',
  answers: {},
  tags: [],
  mood: 3,
  condition: 3,
  tomorrow: '',
  imageIds,
  thumbnailImageId,
  createdAt: '',
  updatedAt: '',
})
beforeEach(() => {
  vi.resetAllMocks()
  storage.entries = []
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    }),
  })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute('open')
    }),
  })
  storage.get.mockImplementation(async (id: string) => ({
    blob: new Blob([id]),
  }))
  storage.remove.mockResolvedValue(undefined)
  storage.confirm.mockResolvedValue(true)
  let sequence = 0
  vi.stubGlobal('URL', {
    createObjectURL: () => `blob:photo-${++sequence}`,
    revokeObjectURL: vi.fn(),
  })
})
afterEach(() => {
  app?.unmount()
  app = undefined
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
async function mount(
  entry = initial(),
  readonly = false,
  isNew = false,
  compose = false,
) {
  const root = document.createElement('div')
  document.body.append(root)
  app = createApp(DiaryEditor, { initial: entry, readonly, isNew, compose })
  app.mount(root)
  await vi.waitFor(() =>
    expect(document.querySelectorAll('img')).toHaveLength(
      entry.imageIds.length,
    ),
  )
  await nextTick()
}
async function deleteCover() {
  const button = document.querySelector<HTMLButtonElement>(
    '[aria-label="代表写真を削除"]',
  )
  expect(button).not.toBeNull()
  button!.click()
  await vi.waitFor(() => expect(storage.save).toHaveBeenCalled())
  await nextTick()
}
it.each([false, true])(
  'does not repeat the cover in the gallery (readonly: %s)',
  async (readonly) => {
    await mount(initial(), readonly)
    expect(
      document.querySelector('.diary-cover img')?.getAttribute('src'),
    ).toBe('blob:photo-1')
    expect(document.querySelectorAll('.photo-grid img')).toHaveLength(2)
    expect(
      [...document.querySelectorAll('img')].map((img) =>
        img.getAttribute('src'),
      ),
    ).toEqual(['blob:photo-1', 'blob:photo-2', 'blob:photo-3'])
    expect(!!document.querySelector('[aria-label="代表写真を削除"]')).toBe(
      !readonly,
    )
  },
)
it('automatically promotes the next remaining photo after deleting the cover', async () => {
  await mount()
  await deleteCover()
  expect(storage.save).toHaveBeenLastCalledWith(
    expect.objectContaining({ imageIds: ['b', 'c'], thumbnailImageId: 'b' }),
  )
  expect(document.querySelector('.diary-cover img')?.getAttribute('src')).toBe(
    'blob:photo-2',
  )
  expect(document.querySelectorAll('.photo-grid img')).toHaveLength(1)
  expect(storage.remove).toHaveBeenCalledWith('a', 'a')
})
it('uses the first photo for legacy diaries without a stored cover and promotes it correctly', async () => {
  const entry = initial()
  delete entry.thumbnailImageId
  await mount(entry)
  expect(document.querySelectorAll('.photo-grid img')).toHaveLength(2)
  await deleteCover()
  expect(storage.save).toHaveBeenLastCalledWith(
    expect.objectContaining({ thumbnailImageId: 'b' }),
  )
})
it('leaves an empty photo area after deleting the final photo', async () => {
  await mount(initial(['a']))
  expect(document.querySelector('.photo-empty')).toBeNull()
  await deleteCover()
  expect(storage.save).toHaveBeenLastCalledWith(
    expect.objectContaining({ imageIds: [], thumbnailImageId: undefined }),
  )
  expect(document.querySelector('.diary-cover')).toBeNull()
  expect(document.querySelector('.photo-empty')).not.toBeNull()
  expect(document.querySelector('[aria-label="写真を追加"]')).not.toBeNull()
})
it('keeps the cover and cached image when saving the deletion fails', async () => {
  await mount()
  storage.save.mockImplementation(() => {
    throw new Error('quota')
  })
  await deleteCover()
  expect(document.querySelector('.diary-cover img')?.getAttribute('src')).toBe(
    'blob:photo-1',
  )
  expect(document.querySelectorAll('img')).toHaveLength(3)
  expect(storage.remove).not.toHaveBeenCalled()
  expect(document.querySelector('[role="alert"]')?.textContent).toContain(
    '自動保存できませんでした',
  )
})
it('keeps all photos when deletion is cancelled', async () => {
  await mount()
  storage.confirm.mockResolvedValue(false)
  document
    .querySelector<HTMLButtonElement>('[aria-label="代表写真を削除"]')!
    .click()
  await nextTick()
  await nextTick()
  expect(storage.save).not.toHaveBeenCalled()
  expect(storage.remove).not.toHaveBeenCalled()
  expect(document.querySelectorAll('img')).toHaveLength(3)
})
it('moves the previous cover back to the gallery when another photo is selected', async () => {
  await mount()
  document.querySelector<HTMLButtonElement>('.set-cover')!.click()
  await nextTick()
  expect(storage.save).toHaveBeenLastCalledWith(
    expect.objectContaining({ thumbnailImageId: 'b' }),
  )
  expect(document.querySelector('.diary-cover img')?.getAttribute('src')).toBe(
    'blob:photo-2',
  )
  expect(
    [...document.querySelectorAll('.photo-grid img')].map((img) =>
      img.getAttribute('src'),
    ),
  ).toEqual(['blob:photo-1', 'blob:photo-3'])
})

it('opens the photo picker when the full-width empty cover is tapped', async () => {
  await mount(initial([], undefined), false, true)
  const picker = document.querySelector<HTMLInputElement>(
    '[aria-label="写真を選択"]',
  )!
  const click = vi.spyOn(picker, 'click').mockImplementation(() => {})
  const panel = document.querySelector<HTMLButtonElement>(
    '.photo-stage .cover-placeholder',
  )!
  expect(panel.textContent).toContain('この日の景色も、一緒に。')
  panel.click()
  expect(click).toHaveBeenCalledOnce()
  expect(document.querySelector('.photo-collection .photo-empty')).toBeNull()
})
it('replaces the placeholder with the real cover once photos are available', async () => {
  await mount(initial(), false, true)
  expect(document.querySelector('.cover-placeholder')).toBeNull()
  expect(document.querySelector('.diary-cover')).not.toBeNull()
})

it('adds and removes custom tags with durable saves and ignores duplicates', async () => {
  await mount(initial([]))
  document.querySelector<HTMLButtonElement>('.edit-tags')!.click()
  await nextTick()
  expect(document.querySelector('.tag-dialog')?.hasAttribute('open')).toBe(true)
  const input = document.querySelector<HTMLInputElement>('#diary-tag-input')!
  input.value = '  #旅行  '
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
  document
    .querySelector('.tag-form')!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await nextTick()
  expect(storage.save.mock.lastCall?.[0].tags).toEqual(['旅行'])
  input.value = '旅行'
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
  document
    .querySelector('.tag-form')!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await nextTick()
  expect(document.querySelectorAll('.tag-dialog .tag-list>span')).toHaveLength(
    1,
  )
  const close = document.querySelector<HTMLButtonElement>(
    '[aria-label="タグのダイアログを閉じる"]',
  )!
  close.click()
  await nextTick()
  expect(document.querySelector('.tag-dialog')?.hasAttribute('open')).toBe(
    false,
  )
  document
    .querySelector<HTMLButtonElement>(
      '.diary-tags [aria-label="旅行タグを削除"]',
    )!
    .click()
  await nextTick()
  expect(storage.save.mock.lastCall?.[0].tags).toEqual([])
})

it('offers unique tags from other diaries and saves a selected tag immediately', async () => {
  storage.entries = [
    { ...initial([]), id: 'other', tags: ['旅行', '読書'] },
    { ...initial([]), id: 'another', tags: ['旅行'] },
    { ...initial([]), tags: ['この日記のみ'] },
  ]
  await mount({ ...initial([]), tags: ['読書'] })
  document.querySelector<HTMLButtonElement>('.edit-tags')!.click()
  await nextTick()
  expect(
    [...document.querySelectorAll('.tag-suggestions button')].map(
      (button) => button.textContent,
    ),
  ).toEqual(['# 旅行'])
  document
    .querySelector<HTMLButtonElement>('[aria-label="旅行タグを追加"]')!
    .click()
  await nextTick()
  expect(storage.save.mock.lastCall?.[0].tags).toEqual(['読書', '旅行'])
  expect(document.querySelector('.tag-suggestions')).toBeNull()
  expect(document.querySelector('.diary-tags')?.textContent).toContain('旅行')
})

it('removes tags inside the dialog and offers them again when used by another diary', async () => {
  storage.entries = [{ ...initial([]), id: 'other', tags: ['旅行'] }]
  await mount({ ...initial([]), tags: ['旅行'] })
  document.querySelector<HTMLButtonElement>('.edit-tags')!.click()
  await nextTick()
  document
    .querySelector<HTMLButtonElement>(
      '.tag-dialog [aria-label="旅行タグを削除"]',
    )!
    .click()
  await nextTick()
  expect(storage.save.mock.lastCall?.[0].tags).toEqual([])
  expect(document.querySelector('.diary-tags .tag-list')).toBeNull()
  expect(
    document.querySelector('.tag-dialog [aria-label="旅行タグを追加"]'),
  ).not.toBeNull()
  expect(document.querySelector('.tag-dialog')?.hasAttribute('open')).toBe(true)
})

it('saves the final answer update once without persisting intermediate fields', async () => {
  await mount()
  storage.save.mockClear()
  const editor = app!._instance!.exposed!
  expect(editor.applyAnswers({ mood: '1', condition: '2', work: 'yes' })).toBe(
    true,
  )
  expect(storage.save).toHaveBeenCalledTimes(1)
  expect(storage.save.mock.calls[0][0]).toMatchObject({
    mood: 1,
    condition: 2,
    answers: { mood: '1', condition: '2', work: 'yes' },
    tags: ['仕事・勉強'],
  })
})

it('changes the compose date without losing the diary content', async () => {
  await mount(initial([], undefined), false, true)
  const date = document.querySelector<HTMLInputElement>(
    '[aria-label="日記の日付"]',
  )!
  storage.save.mockClear()
  date.value = '2026-10-25'
  date.dispatchEvent(new Event('change', { bubbles: true }))
  await nextTick()
  expect(storage.save).toHaveBeenLastCalledWith(
    expect.objectContaining({ date: '2026-10-25', body: '本文', id: 'diary' }),
  )
})
it('keeps the original date when another diary already exists on the selected date', async () => {
  storage.entries = [
    { ...initial([], undefined), id: 'other', date: '2026-10-25' },
  ]
  await mount(initial([], undefined), false, true)
  const date = document.querySelector<HTMLInputElement>(
    '[aria-label="日記の日付"]',
  )!
  storage.save.mockClear()
  date.value = '2026-10-25'
  date.dispatchEvent(new Event('change', { bubbles: true }))
  await nextTick()
  expect(date.value).toBe('2026-10-26')
  expect(storage.save).not.toHaveBeenCalled()
  expect(document.querySelector('[role="alert"]')?.textContent).toContain(
    'この日付には日記があります',
  )
})

it('uses the compose layout when reopening a saved diary for editing', async () => {
  await mount(initial([], undefined), false, false, true)
  expect(document.querySelector('.diary-editor.is-composing')).not.toBeNull()
  expect(document.querySelector('[aria-label="日記の日付"]')).not.toBeNull()
  expect(document.querySelector('.cover-placeholder')).not.toBeNull()
  expect(
    document.querySelector('.collection-actions .add-photo')?.textContent,
  ).toContain('写真を追加')
  expect(document.querySelector('.diary-date')).toBeNull()
})
it('keeps reading mode when compose is requested for a readonly diary', async () => {
  await mount(initial([], undefined), true, false, true)
  expect(document.querySelector('.is-composing')).toBeNull()
  expect(document.querySelector('[aria-label="日記の日付"]')).toBeNull()
})

it('reports an empty new diary, successful autosave, failure, and retry truthfully', async () => {
  await mount(
    { ...initial([], undefined), guess: '', body: '', tomorrow: '' },
    false,
    true,
  )
  const exposed = app!._instance!.exposed!
  expect(exposed.saveStatus.value).toBe('未入力')
  expect(exposed.saveState.value).toBe('empty')
  const title = document.querySelector<HTMLInputElement>(
    '[aria-label="タイトル"]',
  )!
  title.value = '自動保存の確認'
  title.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
  expect(storage.save).toHaveBeenLastCalledWith(
    expect.objectContaining({ guess: '自動保存の確認' }),
  )
  expect(exposed.saveStatus.value).toBe('保存しました')
  storage.save.mockImplementation(() => {
    throw new Error('quota')
  })
  title.value = '未保存の変更'
  title.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
  expect(exposed.saveState.value).toBe('error')
  expect(exposed.saveStatus.value).toBe('保存失敗')
  storage.save.mockReset()
  document.querySelector<HTMLButtonElement>('.text-button')!.click()
  await nextTick()
  expect(exposed.saveState.value).toBe('saved')
  expect(storage.save).toHaveBeenLastCalledWith(
    expect.objectContaining({ guess: '未保存の変更' }),
  )
})
it('reports photo saving and a failed image transaction without claiming success', async () => {
  await mount(initial([], undefined), false, false, true)
  let rejectUpload!: (reason: Error) => void
  storage.compress.mockResolvedValue(new Blob(['photo'], { type: 'image/png' }))
  storage.put.mockReturnValue(
    new Promise((_, reject) => {
      rejectUpload = reject
    }),
  )
  const input = document.querySelector<HTMLInputElement>(
    '[aria-label="写真を選択"]',
  )!
  Object.defineProperty(input, 'files', {
    value: [new File(['photo'], 'photo.png', { type: 'image/png' })],
  })
  input.dispatchEvent(new Event('change', { bubbles: true }))
  const exposed = app!._instance!.exposed!
  expect(exposed.saveStatus.value).toBe('保存中…')
  await vi.waitFor(() => expect(storage.put).toHaveBeenCalled())
  rejectUpload(new Error('quota'))
  await vi.waitFor(() =>
    expect(exposed.saveStatus.value).toBe('写真の保存失敗'),
  )
  expect(exposed.saveState.value).toBe('error')
})

it('updates the visible save confirmation and timestamp only after a successful write', async () => {
  await mount(initial([], undefined), false, false, true)
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-01T01:00:00Z'))
  const exposed = app!._instance!.exposed!
  const title = document.querySelector<HTMLInputElement>(
    '[aria-label="タイトル"]',
  )!
  title.value = '最初の変更'
  title.dispatchEvent(new Event('input', { bubbles: true }))
  expect(exposed.saveStatus.value).toBe('保存しました')
  expect(exposed.savedAt.value).toBe('2026-11-01T01:00:00.000Z')
  vi.advanceTimersByTime(1600)
  expect(exposed.saveStatus.value).toBe('保存済み')
  title.value = '次の変更'
  title.dispatchEvent(new Event('input', { bubbles: true }))
  expect(exposed.saveStatus.value).toBe('保存しました')
  expect(exposed.savedAt.value).toBe('2026-11-01T01:00:01.600Z')
  storage.save.mockImplementation(() => {
    throw new Error('quota')
  })
  vi.advanceTimersByTime(1000)
  title.value = '保存できない変更'
  title.dispatchEvent(new Event('input', { bubbles: true }))
  expect(exposed.saveStatus.value).toBe('保存失敗')
  expect(exposed.savedAt.value).toBe('2026-11-01T01:00:01.600Z')
})
