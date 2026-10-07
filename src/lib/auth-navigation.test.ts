import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { authRedirect, loginDestination, type AuthState } from './auth-navigation'
function setup(state: AuthState) {
 const component = { template: '<div />' }
 const router = createRouter({ history: createMemoryHistory(), routes: ['/', '/login', '/signup', '/reset-password', '/settings', '/entry/:id'].map(path => ({ path, component })) })
 router.beforeEach(to => authRedirect(to, state))
 return router
}
describe('account route access', () => {
 it('redirects a signed-out launch and direct diary links to login', async () => {
  const router = setup({ ready: true, signedIn: false, recovery: false })
  await router.push('/')
  expect(router.currentRoute.value.path).toBe('/login')
  await router.push('/entry/diary-123')
  expect(router.currentRoute.value.path).toBe('/login')
  expect(router.currentRoute.value.query.next).toBe('/entry/diary-123')
 })
 it('allows signup without redirect loops', async () => {
  const router = setup({ ready: true, signedIn: false, recovery: false })
  await router.push('/signup')
  expect(router.currentRoute.value.path).toBe('/signup')
 })
 it('returns signed-in users to the requested internal page', async () => {
  const router = setup({ ready: true, signedIn: true, recovery: false })
  await router.push('/login?next=/entry/diary-123')
  expect(router.currentRoute.value.path).toBe('/entry/diary-123')
  await router.push('/signup')
  expect(router.currentRoute.value.path).toBe('/')
 })
 it('blocks protected navigation again after logout', async () => {
  const state = { ready: true, signedIn: true, recovery: false }
  const router = setup(state)
  await router.push('/settings')
  state.signedIn = false
  await router.push('/entry/diary-123')
  expect(router.currentRoute.value.path).toBe('/login')
 })
 it('keeps password recovery on its dedicated screen until complete', async () => {
  const state = { ready: true, signedIn: true, recovery: true }
  const router = setup(state)
  await router.push('/')
  expect(router.currentRoute.value.path).toBe('/reset-password')
  await router.push('/settings')
  expect(router.currentRoute.value.path).toBe('/reset-password')
  state.recovery = false
  expect(authRedirect(router.currentRoute.value, state)).toEqual({ path: '/', replace: true })
 })
 it('rejects external URLs and authentication routes as return destinations', () => {
  for (const value of ['https://example.com', '//example.com', '/login', '/signup', '/reset-password', ['/settings']]) expect(loginDestination(value)).toBe('/')
  expect(loginDestination('/settings')).toBe('/settings')
 })
})
