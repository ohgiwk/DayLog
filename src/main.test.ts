import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const startup = vi.hoisted(() => ({
  initialize: vi.fn(),
  shellLoaded: vi.fn(),
  routerLoaded: vi.fn(),
  mount: vi.fn(),
  use: vi.fn(),
  ready: vi.fn(),
}))
vi.mock('./stores/account', () => ({ initializeAccount: startup.initialize }))
vi.mock('./App.vue', () => {
  startup.shellLoaded()
  return { default: {} }
})
vi.mock('./router', () => {
  startup.routerLoaded()
  return { router: { isReady: startup.ready } }
})
vi.mock('vue', () => ({ createApp: () => ({ use: startup.use }) }))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  startup.use.mockReturnValue({ mount: startup.mount })
  startup.ready.mockResolvedValue(undefined)
  vi.stubGlobal('document', {
    addEventListener: vi.fn(),
    querySelector: vi.fn(),
  })
})
afterEach(() => vi.unstubAllGlobals())

it('loads the shell during slow auth but preserves callback URLs until auth completes', async () => {
  let finishAuth!: () => void
  startup.initialize.mockReturnValue(
    new Promise<void>((resolve) => {
      finishAuth = resolve
    }),
  )
  await import('./main')
  await vi.waitFor(() => expect(startup.shellLoaded).toHaveBeenCalled())
  expect(startup.routerLoaded).not.toHaveBeenCalled()
  expect(startup.mount).not.toHaveBeenCalled()
  finishAuth()
  await vi.waitFor(() => expect(startup.mount).toHaveBeenCalledWith('#app'))
  expect(startup.routerLoaded).toHaveBeenCalledOnce()
})

it('shows a useful error if startup fails instead of leaving the loading message forever', async () => {
  const status = { textContent: '', hidden: true, closest: () => null }
  vi.stubGlobal('document', {
    addEventListener: vi.fn(),
    querySelector: () => status,
  })
  startup.initialize.mockRejectedValue(new Error('storage unavailable'))
  await import('./main')
  await vi.waitFor(() =>
    expect(status.textContent).toContain('起動できませんでした'),
  )
  expect(status.hidden).toBe(false)
  expect(startup.mount).not.toHaveBeenCalled()
})
