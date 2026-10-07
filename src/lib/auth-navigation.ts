export interface AuthState { ready: boolean; signedIn: boolean; recovery: boolean }
export interface AuthLocation { path: string; fullPath: string; query: Record<string, unknown> }
const authPaths = ['/login', '/signup', '/reset-password']
export function isAuthPath(path: string) { return authPaths.includes(path) }
export function loginDestination(value: unknown): string {
 // Only known, internal app routes can be used as a post-login destination.
 return typeof value === 'string' && /^\/(?:records|memos|insights|settings|journal|entry\/[\w-]+)?$/.test(value) ? value : '/'
}
export function authRedirect(to: AuthLocation, state: AuthState) {
 if (!state.ready) return
 if (state.signedIn && state.recovery) {
  return to.path === '/reset-password' ? undefined : { path: '/reset-password', replace: true }
 }
 if (!state.signedIn) {
  if (to.path === '/login' || to.path === '/signup') return
  return { path: '/login', query: { next: loginDestination(to.fullPath) }, replace: true }
 }
 if (isAuthPath(to.path)) return { path: loginDestination(to.query.next), replace: true }
}
