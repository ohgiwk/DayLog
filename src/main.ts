import { createApp } from 'vue'
import { initializeAccount } from './stores/account'
import './style.css'
import './responsive.css'
import './theme.css'
// Finish processing the auth callback before the hash router changes the URL.
async function start() {
 await initializeAccount()
 const [{ default: App }, { router }] = await Promise.all([import('./App.vue'), import('./router')])
 const app = createApp(App).use(router)
 await router.isReady()
 app.mount('#app')
}
void start()
