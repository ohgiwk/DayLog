import { createRouter, createWebHashHistory } from 'vue-router'
const AuthView = () => import('./views/AuthView.vue')
import { account } from './stores/account'
import { entries } from './stores/diary'
import { existingJournalPath } from './lib/journal-navigation'
import { authRedirect } from './lib/auth-navigation'
const JournalView = () => import('./views/JournalView.vue')
const RecordsView = () => import('./views/RecordsView.vue')
const DetailView = () => import('./views/DetailView.vue')
const MemosView = () => import('./views/MemosView.vue')
const SettingsView = () => import('./views/SettingsView.vue')
export const router=createRouter({history:createWebHashHistory(import.meta.env.BASE_URL),routes:[
 {path:'/login',component:AuthView},{path:'/signup',component:AuthView},{path:'/reset-password',component:AuthView},
 {path:'/memos',component:MemosView},{path:'/',redirect:'/records'},{path:'/journal',component:JournalView,beforeEnter:to=>{const path=existingJournalPath(entries.value,to.query.date);return path?{path,replace:true}:undefined}},{path:'/records',component:RecordsView},{path:'/entry/:id',component:DetailView},{path:'/insights',redirect:'/records'},{path:'/settings',component:SettingsView}
]})

router.beforeEach(to => authRedirect(to, { ready: account.ready, signedIn: !!account.user, recovery: account.recovery }))
