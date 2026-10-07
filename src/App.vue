<script setup lang="ts">
import AppIcon from "./components/AppIcon.vue"

import { watch } from 'vue'
import { account } from './stores/account'
import { scheduleSync, setEditingCheck, startSync, syncState } from './lib/diary-sync'
import { RouterView, useRoute, useRouter } from 'vue-router'
import DeleteConfirmation from './components/DeleteConfirmation.vue'
import UpdateNotice from './components/UpdateNotice.vue'
import { saveSettings, settings } from './stores/diary'
saveSettings()
const route=useRoute(), router=useRouter()
setEditingCheck(() => route.path === '/journal' || route.path.startsWith('/entry/'))
startSync()
watch(() => account.user?.id, () => { syncState.error = ''; syncState.lastSynced = ''; scheduleSync() })
watch(() => route.path, scheduleSync)
watch(() => account.recovery, value => { if (value) void router.replace('/settings') }, { immediate: true })
function animateTab(event: MouseEvent) {
 if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return
 if (settings.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
 const target = event.target instanceof Element ? event.target.closest('a') : null
 const icon = target?.querySelector('svg')
 if (!icon) return
 icon.getAnimations().forEach(animation => animation.cancel())
 icon.animate([
  { transform: 'translateY(0) scale(.75)' },
  { transform: 'translateY(-6px) scale(1.22)', offset: .4 },
  { transform: 'translateY(1px) scale(.96)', offset: .75 },
  { transform: 'translateY(0) scale(1)' },
 ], { duration: 440, easing: 'cubic-bezier(.2,.7,.3,1)' })
}
</script>
<template>
 <div class="app-shell">
  <UpdateNotice />
  <DeleteConfirmation />
  <main v-if="account.ready">
   <RouterLink v-if="account.user && (syncState.error || syncState.conflicts.length)" to="/settings" class="sync-notice">{{ syncState.conflicts.length ? '別の端末の変更と重複しています。設定で確認' : '未同期の変更があります。設定で確認' }}</RouterLink>
   <RouterView v-slot="{ Component, route: currentRoute }">
    <Transition name="page-fade" mode="out-in">
     <component :is="Component" :key="`${account.user?.id ?? 'guest'}:${currentRoute.fullPath}`" />
    </Transition>
   </RouterView>
  </main>
  <p v-else class="page" role="alert">{{ account.error || 'ログイン状態を確認しています…' }}</p>
  <nav v-if="route.path!='/journal'" class="tabbar" aria-label="メインメニュー" @click="animateTab">
   <RouterLink to="/" aria-label="ホーム"><span><AppIcon name="home" /></span><small>ホーム</small></RouterLink>
   <RouterLink to="/records" aria-label="記録"><span><AppIcon name="records" /></span><small>記録</small></RouterLink>
   <RouterLink to="/journal" class="write-tab" aria-label="日記を書く"><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></span><small>日記を書く</small></RouterLink>
   <RouterLink to="/memos" aria-label="メモ"><span><AppIcon name="note" /></span><small>メモ</small></RouterLink>
   <RouterLink to="/insights" aria-label="振り返り"><span><AppIcon name="chart" /></span><small>振り返り</small></RouterLink>
  </nav>
 </div>
</template>

<style scoped>
.sync-notice{display:block;padding:12px 22px;background:#fff2dc;color:#77551e;font-size:.78rem;line-height:1.5;text-decoration:none}
</style>
