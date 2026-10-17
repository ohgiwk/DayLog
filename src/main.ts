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
 await initializeAccount()
 const [{ default: App }, { router }] = await Promise.all([import('./App.vue'), import('./router')])
 const app = createApp(App).use(router)
 await router.isReady()
 app.mount('#app')
}
void start()
