import { createApp } from 'vue'
import { initializeAccount } from './stores/account'
import './style.css'
import './responsive.css'
import './theme.css'

// Safari can ignore viewport zoom limits; cancel its native pinch gestures too.
function preventGestureZoom(event: Event) {
 if (event.cancelable) event.preventDefault()
}
document.addEventListener('gesturestart', preventGestureZoom, { passive: false })
document.addEventListener('gesturechange', preventGestureZoom, { passive: false })
// Trackpad pinch gestures are delivered as Ctrl+wheel in other browsers.
document.addEventListener('wheel', event => {
 if (event.ctrlKey) preventGestureZoom(event)
}, { passive: false })
// Finish processing the auth callback before the hash router changes the URL.
async function start() {
 // Load the shell while auth restores/refreshes the session. Creating the hash
 // router must still wait until auth has consumed its callback URL.
 const [{ default: App }] = await Promise.all([import('./App.vue'), initializeAccount()])
 const { router } = await import('./router')
 const app = createApp(App).use(router)
 await router.isReady()
 app.mount('#app')
}
void start().catch(() => {
 const status = document.querySelector('#startup-status')
 if (status) status.textContent = '起動できませんでした。通信を確認して再読み込みしてください。'
})
