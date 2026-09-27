<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Capacitor } from '@capacitor/core'
import { startUpdateChecks } from '../lib/app-update'

const route = useRoute()
const latest = ref<string | null>(null)
const dismissed = ref<string | null>(null)
const editing = computed(() => route.path === '/journal' || route.path.startsWith('/entry/'))
let stop: (() => void) | undefined
onMounted(() => {
 if (import.meta.env.PROD && !Capacitor.isNativePlatform()) {
  stop = startUpdateChecks(__APP_BUILD_ID__, import.meta.env.BASE_URL, id => { latest.value = id })
 }
})
onBeforeUnmount(() => stop?.())
function update() {
 if (editing.value || !latest.value) return
 const url = new URL(window.location.href)
 url.searchParams.set('_update', latest.value)
 window.location.replace(url.href)
}
</script>

<template>
 <aside v-if="latest && latest !== dismissed" class="update-notice" aria-label="アプリの更新">
  <div role="status" aria-live="polite">
   <strong>新しいバージョンが利用できます</strong>
   <p>{{ editing ? '日記を保存してホームに戻ると更新できます。' : '更新すると、新しい機能や改善が反映されます。' }}</p>
  </div>
  <div class="update-actions">
   <button type="button" class="update-later" @click="dismissed = latest">あとで</button>
   <button type="button" class="update-now" :disabled="editing" @click="update">更新する</button>
  </div>
 </aside>
</template>

<style scoped>
.update-notice { position: sticky; top: 0; z-index: 40; padding: calc(14px + env(safe-area-inset-top)) 20px 14px; background: #edf4ef; color: var(--forest); border-bottom: 1px solid var(--line); }
.update-notice strong { font-size: .88rem; }
.update-notice p { margin: 6px 0 10px; font-size: .76rem; line-height: 1.6; }
.update-actions { display: flex; justify-content: flex-end; gap: 10px; }
.update-actions button { min-height: 44px; padding: 8px 16px; border-radius: 12px; font: inherit; font-size: .8rem; cursor: pointer; }
.update-later { border: 1px solid var(--line); background: white; color: var(--forest); }
.update-now { border: 0; background: var(--forest); color: white; }
.update-now:disabled { opacity: .5; cursor: default; }
</style>
