<script setup lang="ts">
import AppSplash from './components/AppSplash.vue'
import AppIcon from "./components/AppIcon.vue"

import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { authRedirect, isAuthPath } from './lib/auth-navigation'
import { account } from './stores/account'
import { startMemoSync, resetMemoSync, scheduleMemoSync, memoSyncState } from './lib/memo-sync'
import { scheduleSync, setEditingCheck, startSync, syncState } from './lib/diary-sync'
import { RouterView, useRoute, useRouter } from 'vue-router'
import DeleteConfirmation from './components/DeleteConfirmation.vue'
import UpdateNotice from './components/UpdateNotice.vue'
import { existingJournalPath } from './lib/journal-navigation'
import { entries, saveSettings, settings } from './stores/diary'
saveSettings()
const route=useRoute(), router=useRouter()
const writeTarget = computed(() => existingJournalPath(entries.value) || '/journal')
const authScreen = computed(() => isAuthPath(route.path))
setEditingCheck(() => route.path === '/journal' || route.path.startsWith('/entry/'))
startSync()
startMemoSync()
watch(() => account.user?.id, () => { syncState.error = ''; syncState.lastSynced = ''; scheduleSync(); resetMemoSync() })
watch(() => route.path, () => { scheduleSync(); scheduleMemoSync() })
watch(() => [account.ready, account.user?.id, account.recovery], () => {
 const target = authRedirect(route, { ready: account.ready, signedIn: !!account.user, recovery: account.recovery })
 if (target) void router.replace(target)
}, { immediate: true })
// Keep the navigation at its pre-keyboard position while writing a diary.
const tabKeyboardOffset = ref(0)
let restingViewportBottom = 0
let editingInput = false
function viewportBottom() {
 const viewport = window.visualViewport
 return viewport ? viewport.height + viewport.offsetTop : window.innerHeight
}
function updateTabPosition() {
 const active = document.activeElement
 const diaryInput = active instanceof HTMLElement && !!active.closest('.diary-editor') &&
  (active.matches('input:not([type="file"]), textarea') || active.isContentEditable)
 if (diaryInput && !editingInput) restingViewportBottom = Math.max(window.innerHeight, viewportBottom())
 editingInput = diaryInput
 const displacement = restingViewportBottom - viewportBottom()
 tabKeyboardOffset.value = editingInput && displacement > 100 ? displacement : 0
 if (!editingInput) restingViewportBottom = viewportBottom()
}
onMounted(() => {
 restingViewportBottom = viewportBottom()
 document.addEventListener('focusin', updateTabPosition)
 document.addEventListener('focusout', updateTabPosition)
 window.addEventListener('resize', updateTabPosition)
 window.visualViewport?.addEventListener('resize', updateTabPosition)
 window.visualViewport?.addEventListener('scroll', updateTabPosition)
})
onBeforeUnmount(() => {
 document.removeEventListener('focusin', updateTabPosition)
 document.removeEventListener('focusout', updateTabPosition)
 window.removeEventListener('resize', updateTabPosition)
 window.visualViewport?.removeEventListener('resize', updateTabPosition)
 window.visualViewport?.removeEventListener('scroll', updateTabPosition)
})
watch(() => route.path, () => { editingInput = false; tabKeyboardOffset.value = 0 })
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
  <main v-if="account.ready" :class="{ 'auth-main': authScreen }">
   <RouterLink v-if="!authScreen && account.user && (syncState.error || syncState.conflicts.length || memoSyncState.error || memoSyncState.conflict)" to="/settings" class="sync-notice">{{ (syncState.conflicts.length || memoSyncState.conflict) ? '別の端末の変更と重複しています。設定で確認' : '未同期の変更があります。設定で確認' }}</RouterLink>
   <RouterView v-if="account.user || authScreen" v-slot="{ Component, route: currentRoute }">
    <div class="route-stack">
     <Transition name="page-crossfade" :duration="settings.reducedMotion ? 0 : 220">
      <component :is="Component" :key="`${account.user?.id ?? 'guest'}:${currentRoute.fullPath}`" />
     </Transition>
    </div>
   </RouterView>
  </main>
  <AppSplash v-else :error="account.error" />
  <nav v-if="account.ready && account.user && !authScreen && route.path!='/journal'" class="tabbar" :style="tabKeyboardOffset ? {transform:`translate(-50%, ${tabKeyboardOffset}px)`} : undefined" aria-label="メインメニュー" @click="animateTab">
   <RouterLink to="/records" aria-label="記録"><span><AppIcon name="records" /></span><small>記録</small></RouterLink>
   <RouterLink :to="writeTarget" class="write-tab" aria-label="日記を書く"><span><AppIcon name="notebook-pen" /></span><small>日記を書く</small></RouterLink>
   <RouterLink to="/memos" aria-label="メモ"><span><AppIcon name="note" /></span><small>メモ</small></RouterLink>
  </nav>
 </div>
</template>

<style scoped>
.auth-main{padding-bottom:0}
.sync-notice{display:block;padding:12px 22px;background:#fff2dc;color:#77551e;font-size:.78rem;line-height:1.5;text-decoration:none}
</style>
