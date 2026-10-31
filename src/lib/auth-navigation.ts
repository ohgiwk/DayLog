export interface AuthState {
  ready: boolean
  signedIn: boolean
  recovery: boolean
}
interface AuthLocation {
  path: string
  fullPath: string
  query: Record<string, unknown>
}
const authPaths = ['/login', '/signup', '/reset-password']
export function isAuthPath(path: string) {
  return authPaths.includes(path)
}
export function loginDestination(value: unknown): string {
  // Only known, internal app routes can be used as a post-login destination.
  if (
    typeof value === 'string' &&
    /^\/journal\?date=\d{4}-\d{2}-\d{2}$/.test(value)
  )
    return value
  return typeof value === 'string' &&
    /^\/(?:records|memos|settings|journal|entry\/[\w-]+)?$/.test(value)
    ? value === '/'
      ? '/records'
      : value
    : '/records'
}
export function authRedirect(to: AuthLocation, state: AuthState) {
  if (!state.ready) return
  if (state.signedIn && state.recovery) {
    return to.path === '/reset-password'
      ? undefined
      : { path: '/reset-password', replace: true }
  }
  if (!state.signedIn) {
    if (to.path === '/login' || to.path === '/signup') return
    return {
      path: '/login',
      query: { next: loginDestination(to.fullPath) },
      replace: true,
    }
  }
  if (isAuthPath(to.path))
    return { path: loginDestination(to.query.next), replace: true }
}
