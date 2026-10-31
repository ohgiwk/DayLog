// @vitest-environment jsdom
import { createApp, nextTick, type App } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import UpdateNotice from './UpdateNotice.vue'
const update = vi.hoisted(() => ({
  check: vi.fn(),
  stop: vi.fn(),
  applied: vi.fn(),
  acknowledge: vi.fn(),
  prepare: vi.fn(),
  save: vi.fn(),
  native: vi.fn(),
  notify: undefined as undefined | ((id: string | null) => void),
}))
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: update.native },
}))
vi.mock('../lib/app-update', () => ({
  startUpdateChecks: update.check,
  hasUnacknowledgedUpdate: update.applied,
  acknowledgeAppBuild: update.acknowledge,
  prepareAppUpdate: update.prepare,
}))
vi.mock('../lib/update-preparation', () => ({
  prepareEditorsForUpdate: update.save,
}))
let app: App | undefined
beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers()
  vi.stubEnv('PROD', true)
  update.notify = undefined
  update.check.mockImplementation(
    (_current: string, _base: string, notify: (id: string | null) => void) => {
      update.notify = notify
      return update.stop
    },
  )
  update.native.mockReturnValue(false)
  update.applied.mockReturnValue(false)
  update.save.mockResolvedValue(true)
})
afterEach(() => {
  app?.unmount()
  app = undefined
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.unstubAllEnvs()
})
function mount() {
  const root = document.createElement('div')
  document.body.append(root)
  app = createApp(UpdateNotice)
  app.mount(root)
}
function button(text: string) {
  const value = [...document.querySelectorAll('button')].find(
    (b) => b.textContent === text,
  )
  expect(value, `button: ${text}`).toBeDefined()
  return value!
}
it('renders an update outside the scrolling app and unregisters checks on unmount', async () => {
  mount()
  update.notify!('new')
  await nextTick()
  expect(document.body.querySelector(':scope > aside')?.textContent).toContain(
    '新しいバージョンが利用できます',
  )
  app!.unmount()
  app = undefined
  expect(update.stop).toHaveBeenCalledOnce()
  expect(document.querySelector('aside')).toBeNull()
})
it('reminds about a postponed update after ten minutes and shows a different build immediately', async () => {
  mount()
  update.notify!('new')
  await nextTick()
  button('あとで').click()
  await nextTick()
  expect(document.querySelector('aside')).toBeNull()
  update.notify!('new')
  await nextTick()
  expect(document.querySelector('aside')).toBeNull()
  await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
  update.notify!('new')
  await nextTick()
  expect(document.querySelector('aside')).not.toBeNull()
  button('あとで').click()
  await nextTick()
  update.notify!('newer')
  await nextTick()
  expect(document.querySelector('aside')).not.toBeNull()
})
it('shows a restart-applied update until the user acknowledges it', async () => {
  update.applied.mockReturnValue(true)
  mount()
  await nextTick()
  expect(document.body.textContent).toContain(
    '新しいバージョンに更新されました',
  )
  button('確認しました').click()
  await nextTick()
  expect(update.acknowledge).toHaveBeenCalledOnce()
  expect(document.querySelector('aside')).toBeNull()
})
it('does not fetch or navigate when editor saving fails and allows a retry', async () => {
  update.save.mockResolvedValueOnce(false)
  update.prepare.mockRejectedValue(new Error('offline'))
  mount()
  update.notify!('new')
  await nextTick()
  button('更新する').click()
  await vi.advanceTimersByTimeAsync(0)
  expect(document.querySelector('[role="alert"]')?.textContent).toContain(
    '入力内容を保存できませんでした',
  )
  expect(update.prepare).not.toHaveBeenCalled()
  expect(button('更新する').disabled).toBe(false)
  button('更新する').click()
  await vi.advanceTimersByTimeAsync(0)
  expect(update.prepare).toHaveBeenCalledOnce()
  expect(document.querySelector('[role="alert"]')?.textContent).toContain(
    '更新を取得できませんでした',
  )
})
it('checks editor saves again after downloading the update, preserving edits made during the download', async () => {
  update.save.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
  update.prepare.mockResolvedValue('https://example.com/update')
  mount()
  update.notify!('new')
  await nextTick()
  button('更新する').click()
  await vi.advanceTimersByTimeAsync(0)
  expect(update.save).toHaveBeenCalledTimes(2)
  expect(document.querySelector('[role="alert"]')?.textContent).toContain(
    '入力内容を保存できませんでした',
  )
  expect(button('更新する').disabled).toBe(false)
})
it('does not run web update checks in a native app', () => {
  update.native.mockReturnValue(true)
  mount()
  expect(update.check).not.toHaveBeenCalled()
  expect(update.applied).not.toHaveBeenCalled()
})
