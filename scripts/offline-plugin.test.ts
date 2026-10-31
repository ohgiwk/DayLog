import { expect, it, vi } from 'vitest'
import { runInNewContext } from 'node:vm'
import { offlinePlugin } from './offline-plugin'

type WorkerEvent = {
  waitUntil?: (promise: Promise<unknown>) => void
  request?: { method: string; mode?: string; url: string }
  respondWith?: (promise: Promise<unknown>) => void
}
type WorkerListener = (event: WorkerEvent) => void

it('precaches unopened routes and serves the shell offline under a deployment subpath', async () => {
  let source = ''
  const plugin = offlinePlugin('test')
  const generate = plugin.generateBundle as (
    this: { emitFile: (file: { source: string }) => void },
    options: object,
    bundle: Record<string, object>,
  ) => void
  generate.call(
    {
      emitFile: (file: { source: string }) => {
        source = file.source
      },
    },
    {},
    {
      'assets/editor.js': {},
      'assets/editor.css': {},
      'version.json': {},
    },
  )
  const listeners: Record<string, WorkerListener> = {}
  const shell = new Response('offline app')
  const cache = { addAll: vi.fn(), match: vi.fn().mockResolvedValue(shell) }
  const fetch = vi.fn().mockRejectedValue(new Error('offline'))
  runInNewContext(source, {
    self: {
      location: { href: 'https://example.com/DayLog/sw.js' },
      addEventListener: (name: string, handler: WorkerListener) => {
        listeners[name] = handler
      },
      clients: { claim: vi.fn() },
    },
    caches: { open: vi.fn().mockResolvedValue(cache) },
    URL,
    Response,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch,
  })
  let pending!: Promise<unknown>
  listeners.install({
    waitUntil: (promise: Promise<unknown>) => {
      pending = promise
    },
  })
  await pending
  expect(cache.addAll).toHaveBeenCalledWith([
    'https://example.com/DayLog/index.html',
    'https://example.com/DayLog/assets/editor.js',
    'https://example.com/DayLog/assets/editor.css',
  ])
  const respondWith = vi.fn((promise: Promise<unknown>) => {
    pending = promise
  })
  listeners.fetch({
    request: {
      method: 'GET',
      mode: 'navigate',
      url: 'https://example.com/DayLog/?code=private',
    },
    respondWith,
  })
  expect(await pending).toBe(shell)
  expect(cache.match).toHaveBeenLastCalledWith(
    'https://example.com/DayLog/index.html',
  )
  respondWith.mockClear()
  listeners.fetch({
    request: {
      method: 'GET',
      url: 'https://example.com/DayLog/version.json?t=1',
    },
    respondWith,
  })
  listeners.fetch({
    request: {
      method: 'GET',
      url: 'https://project.supabase.co/rest/v1/daylog_entries',
    },
    respondWith,
  })
  expect(respondWith).not.toHaveBeenCalled()
})
