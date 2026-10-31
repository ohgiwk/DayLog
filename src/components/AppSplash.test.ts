// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { createApp, type App } from 'vue'
import { afterEach, expect, it } from 'vitest'
import AppSplash from './AppSplash.vue'
let app: App | undefined
afterEach(() => {
  app?.unmount()
  document.body.innerHTML = ''
})
function mount(error?: string) {
  const root = document.createElement('div')
  document.body.append(root)
  app = createApp(AppSplash, { error })
  app.mount(root)
}
it('shows the branded splash during authentication without exposing login-check text', () => {
  mount()
  expect(document.querySelector('h1')?.textContent).toBe('DayLog')
  expect(
    document.querySelector('[role="status"]')?.getAttribute('aria-busy'),
  ).toBe('true')
  expect(document.querySelector('.splash-progress')).not.toBeNull()
  expect(document.querySelector('[role="alert"]')).toBeNull()
  expect(document.body.textContent).not.toContain('ログイン状態')
})
it('keeps failures visible and stops showing progress when startup cannot finish', () => {
  mount('ログイン状態を確認できません。再読み込みしてください。')
  expect(document.querySelector('[role="alert"]')?.textContent).toContain(
    '再読み込みしてください',
  )
  expect(document.querySelector('.splash-progress')).toBeNull()
  expect(
    document.querySelector('[role="status"]')?.getAttribute('aria-busy'),
  ).toBe('false')
})
it('includes the same splash in HTML before any JavaScript or auth response is available', () => {
  const html = readFileSync('index.html', 'utf8')
  const page = new DOMParser().parseFromString(html, 'text/html')
  expect(page.querySelector('#app .app-splash h1')?.textContent).toBe('DayLog')
  expect(page.querySelector('link[href="/src/splash.css"]')).not.toBeNull()
  expect(page.querySelector('#startup-status')?.hasAttribute('hidden')).toBe(
    true,
  )
  expect(page.body.textContent).not.toContain('ログイン状態')
})
