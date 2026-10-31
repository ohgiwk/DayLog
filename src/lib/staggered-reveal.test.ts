// @vitest-environment jsdom
import { createApp, h, nextTick, ref, withDirectives, type App } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import { useStaggeredReveal } from './staggered-reveal'
let app: App | undefined
let observeCallback: IntersectionObserverCallback
const unobserve = vi.fn()
const disconnect = vi.fn()
const animate = vi.fn(() => ({
  finished: new Promise<void>(() => {}),
  cancel: vi.fn(),
}))
function mount(reduced = ref(false)) {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        observeCallback = callback
      }
      observe = vi.fn()
      unobserve = unobserve
      disconnect = disconnect
    },
  )
  vi.stubGlobal('Animation', class {})
  Object.defineProperty(HTMLElement.prototype, 'animate', {
    configurable: true,
    value: animate,
  })
  const root = document.createElement('div')
  document.body.append(root)
  app = createApp({
    setup() {
      const reveal = useStaggeredReveal(() => reduced.value)
      return () =>
        h(
          'div',
          [0, 1, 2].map((id) =>
            withDirectives(h('a', { href: '#', 'data-row': id }, String(id)), [
              [reveal],
            ]),
          ),
        )
    },
  })
  app.mount(root)
  return [...root.querySelectorAll<HTMLElement>('a')]
}
afterEach(() => {
  app?.unmount()
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  delete (HTMLElement.prototype as { animate?: unknown }).animate
})
it('staggers visible rows in list order and waits for offscreen rows to enter', () => {
  const rows = mount()
  expect(rows.every((row) => row.hasAttribute('data-reveal-pending'))).toBe(
    true,
  )
  observeCallback(
    [
      { target: rows[1], isIntersecting: true },
      { target: rows[2], isIntersecting: false },
      { target: rows[0], isIntersecting: true },
    ] as unknown as IntersectionObserverEntry[],
    {} as IntersectionObserver,
  )
  expect(animate).toHaveBeenCalledTimes(2)
  expect(
    animate.mock.calls.map(
      (call) =>
        (call as unknown as [unknown, KeyframeAnimationOptions])[1].delay,
    ),
  ).toEqual([80, 170])
  expect(rows[2]!.hasAttribute('data-reveal-pending')).toBe(true)
  observeCallback(
    [
      { target: rows[2], isIntersecting: true },
    ] as unknown as IntersectionObserverEntry[],
    {} as IntersectionObserver,
  )
  expect(animate).toHaveBeenCalledTimes(3)
  expect(rows[2]!.hasAttribute('data-reveal-pending')).toBe(false)
  observeCallback(
    [
      { target: rows[0], isIntersecting: true },
    ] as unknown as IntersectionObserverEntry[],
    {} as IntersectionObserver,
  )
  expect(animate).toHaveBeenCalledTimes(3)
})
it('reveals a focused offscreen row immediately', () => {
  const rows = mount()
  rows[2]!.dispatchEvent(new FocusEvent('focusin'))
  expect(rows[2]!.hasAttribute('data-reveal-pending')).toBe(false)
  expect(animate).not.toHaveBeenCalled()
})
it('reveals all pending rows if reduced motion is enabled', async () => {
  const reduced = ref(false)
  const rows = mount(reduced)
  reduced.value = true
  await nextTick()
  expect(rows.some((row) => row.hasAttribute('data-reveal-pending'))).toBe(
    false,
  )
  expect(animate).not.toHaveBeenCalled()
})
