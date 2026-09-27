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
   if (!stopped && id) notify(id === current ? null : id)
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
