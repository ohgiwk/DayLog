import { createApp } from 'vue'
import { initializeAccount } from './stores/account'
import './style.css'
import './responsive.css'
import './theme.css'

// Cache the production shell without blocking startup or auth callback handling.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`)
    .catch(() => {})
}

// Block native dragging of app controls/photos without intercepting text editing.
document.addEventListener('dragstart', (event) => {
  const target = event.target
  if (!(target instanceof Element)) return
  if (target.closest('input, textarea, [contenteditable="true"]')) return
  if (target.closest('button, a, img')) event.preventDefault()
})

// Safari can ignore viewport zoom limits; cancel its native pinch gestures too.
function preventGestureZoom(event: Event) {
  if (event.cancelable) event.preventDefault()
}
document.addEventListener('gesturestart', preventGestureZoom, {
  passive: false,
})
document.addEventListener('gesturechange', preventGestureZoom, {
  passive: false,
})
// Trackpad pinch gestures are delivered as Ctrl+wheel in other browsers.
document.addEventListener(
  'wheel',
  (event) => {
    if (event.ctrlKey) preventGestureZoom(event)
  },
  { passive: false },
)
// Finish processing the auth callback before the hash router changes the URL.
async function start() {
  // Load the shell while auth restores/refreshes the session. Creating the hash
  // router must still wait until auth has consumed its callback URL.
  const [{ default: App }] = await Promise.all([
    import('./App.vue'),
    initializeAccount(),
  ])
  const { router } = await import('./router')
  const app = createApp(App).use(router)
  await router.isReady()
  app.mount('#app')
}
void start().catch(() => {
  const status = document.querySelector<HTMLElement>('#startup-status')
  if (status) {
    status.hidden = false
    status.textContent =
      '起動できませんでした。通信を確認して再読み込みしてください。'
    status.closest('[aria-busy]')?.setAttribute('aria-busy', 'false')
  }
})
