import { createRouter, createWebHashHistory } from 'vue-router'
import AuthView from './views/AuthView.vue'
import { account } from './stores/account'
import { authRedirect } from './lib/auth-navigation'
import HomeView from './views/HomeView.vue'
import JournalView from './views/JournalView.vue'
import RecordsView from './views/RecordsView.vue'
import DetailView from './views/DetailView.vue'
import InsightsView from './views/InsightsView.vue'
import MemosView from './views/MemosView.vue'
import SettingsView from './views/SettingsView.vue'
export const router=createRouter({history:createWebHashHistory(import.meta.env.BASE_URL),routes:[
 {path:'/login',component:AuthView},{path:'/signup',component:AuthView},{path:'/reset-password',component:AuthView},
 {path:'/memos',component:MemosView},{path:'/',component:HomeView},{path:'/journal',component:JournalView},{path:'/records',component:RecordsView},{path:'/entry/:id',component:DetailView},{path:'/insights',component:InsightsView},{path:'/settings',component:SettingsView}
]})

router.beforeEach(to => authRedirect(to, { ready: account.ready, signedIn: !!account.user, recovery: account.recovery }))
