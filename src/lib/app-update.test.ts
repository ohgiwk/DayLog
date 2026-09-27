import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchBuildId, startUpdateChecks } from './app-update'

let page: EventTarget & { visibilityState: string }
let browser: EventTarget
let network: { onLine: boolean }
const request = vi.fn()
const reply = (buildId: string) => ({ ok: true, json: async () => ({ buildId }) })
let stop: (() => void) | undefined
beforeEach(() => {
 vi.useFakeTimers()
 page = Object.assign(new EventTarget(), { visibilityState: 'visible' })
 browser = new EventTarget()
 network = { onLine: true }
 vi.stubGlobal('document', page)
 vi.stubGlobal('window', browser)
 vi.stubGlobal('navigator', network)
 vi.stubGlobal('fetch', request)
 request.mockReset()
})
afterEach(() => { stop?.(); stop = undefined; vi.useRealTimers(); vi.unstubAllGlobals() })

describe('update checks', () => {
 it('detects a new build at startup and clears it when the current build is served', async () => {
  request.mockResolvedValue(reply('new'))
  const notify = vi.fn()
  stop = startUpdateChecks('current', '/DayLog/', notify)
  await vi.advanceTimersByTimeAsync(0)
  expect(notify).toHaveBeenLastCalledWith('new')
  expect(request).toHaveBeenCalledWith(expect.stringMatching(/^\/DayLog\/version.json\?t=/), expect.objectContaining({ cache: 'no-store' }))
  request.mockResolvedValue(reply('current'))
  await vi.advanceTimersByTimeAsync(60000)
  expect(notify).toHaveBeenLastCalledWith(null)
 })
 it('skips hidden and offline checks, checks on return, and removes listeners on stop', async () => {
  page.visibilityState = 'hidden'
  request.mockResolvedValue(reply('new'))
  const notify = vi.fn()
  stop = startUpdateChecks('old', '/', notify)
  await vi.advanceTimersByTimeAsync(60000)
  expect(request).not.toHaveBeenCalled()
  page.visibilityState = 'visible'
  network.onLine = false
  page.dispatchEvent(new Event('visibilitychange'))
  expect(request).not.toHaveBeenCalled()
  network.onLine = true
  browser.dispatchEvent(new Event('online'))
  await vi.advanceTimersByTimeAsync(0)
  expect(notify).toHaveBeenCalledWith('new')
  stop()
  browser.dispatchEvent(new Event('focus'))
  await vi.advanceTimersByTimeAsync(60000)
  expect(request).toHaveBeenCalledTimes(1)
 })
 it('ignores network failures, bad responses, and invalid metadata', async () => {
  const signal = new AbortController().signal
  request.mockRejectedValueOnce(new Error('offline'))
   .mockResolvedValueOnce({ ok: false })
   .mockResolvedValueOnce({ ok: true, json: async () => { throw new Error('HTML') } })
   .mockResolvedValueOnce({ ok: true, json: async () => ({ buildId: 123 }) })
   .mockResolvedValueOnce(reply(' '))
  for (let i = 0; i < 5; i++) expect(await fetchBuildId('/', signal)).toBeNull()
 })
 it('deduplicates pending requests, times out, and retries', async () => {
  request.mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
   options.signal.addEventListener('abort', () => reject(new Error('aborted')))
  })).mockResolvedValue(reply('new'))
  const notify = vi.fn()
  stop = startUpdateChecks('old', '/', notify)
  browser.dispatchEvent(new Event('focus'))
  expect(request).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(10000)
  expect(notify).not.toHaveBeenCalled()
  browser.dispatchEvent(new Event('focus'))
  await vi.advanceTimersByTimeAsync(0)
  expect(notify).toHaveBeenCalledWith('new')
 })
 it('does not notify after disposal even if a request completes', async () => {
  let resolve!: (value: unknown) => void
  request.mockImplementation(() => new Promise(r => { resolve = r }))
  const notify = vi.fn()
  stop = startUpdateChecks('old', '/', notify)
  stop()
  resolve(reply('new'))
  await vi.advanceTimersByTimeAsync(0)
  expect(notify).not.toHaveBeenCalled()
 })
})
