// Refresh the launch URL too, so reopening a home-screen app does not reuse old HTML.
export async function prepareAppUpdate(href: string, buildId: string): Promise<string> {
 const launch = new URL(href)
 launch.hash = ''
 launch.searchParams.delete('_update')
 launch.searchParams.delete('_reload')
 const controller = new AbortController()
 const timeout = setTimeout(() => controller.abort(), 10000)
 try {
  const response = await fetch(launch.href, { cache: 'reload', signal: controller.signal })
  if (!response.ok) throw new Error('update_fetch_failed')
  await response.text()
 } finally { clearTimeout(timeout) }
 const target = new URL(href)
 target.searchParams.set('_update', buildId)
 target.searchParams.set('_reload', crypto.randomUUID())
 return target.href
}

// A failed check is deliberately silent; the next interval or focus retries it.
export async function fetchBuildId(base: string, signal: AbortSignal): Promise<string | null> {
 try {
  const response = await fetch(`${base}version.json?t=${Date.now()}`, { cache: 'no-store', signal })
  if (!response.ok) return null
  const data: unknown = await response.json()
  if (typeof data !== 'object' || data === null || !('buildId' in data)) return null
  return typeof data.buildId === 'string' && data.buildId.trim() ? data.buildId : null
 } catch { return null }
}

export function startUpdateChecks(current: string, base: string, notify: (id: string | null) => void) {
 let pending: AbortController | undefined
 let stopped = false
 async function check() {
  if (stopped || pending || document.visibilityState === 'hidden' || !navigator.onLine) return
  const controller = new AbortController()
  pending = controller
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
   const id = await fetchBuildId(base, controller.signal)
   // A stale CDN response must not erase an update already detected.
   if (!stopped && id && id !== current) notify(id)
  } finally {
   clearTimeout(timeout)
   pending = undefined
  }
 }
 const interval = setInterval(check, 60000)
 window.addEventListener('focus', check)
 window.addEventListener('online', check)
 document.addEventListener('visibilitychange', check)
 void check()
 return () => {
  stopped = true
  clearInterval(interval)
  pending?.abort()
  window.removeEventListener('focus', check)
  window.removeEventListener('online', check)
  document.removeEventListener('visibilitychange', check)
 }
}

const acknowledgedBuildKey = 'daylog:last-acknowledged-build'

// Remember the last version the user saw, including across full app restarts.
// Storage failures must never prevent launching or checking for updates.
export function hasUnacknowledgedUpdate(current: string): boolean {
 try {
  const previous = localStorage.getItem(acknowledgedBuildKey)
  if (!previous) { localStorage.setItem(acknowledgedBuildKey, current); return false }
  return previous !== current
 } catch { return false }
}

export function acknowledgeAppBuild(current: string) {
 try { localStorage.setItem(acknowledgedBuildKey, current) } catch { /* storage unavailable */ }
}
