import { createRouter, createWebHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'
import JournalView from './views/JournalView.vue'
import RecordsView from './views/RecordsView.vue'
import DetailView from './views/DetailView.vue'
import InsightsView from './views/InsightsView.vue'
import SettingsView from './views/SettingsView.vue'
export const router=createRouter({history:createWebHistory(),routes:[
 {path:'/',component:HomeView},{path:'/journal',component:JournalView},{path:'/records',component:RecordsView},{path:'/entry/:id',component:DetailView},{path:'/insights',component:InsightsView},{path:'/settings',component:SettingsView}
]})
