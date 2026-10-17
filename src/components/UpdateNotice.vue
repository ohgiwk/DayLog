<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { Capacitor } from '@capacitor/core'
import { prepareEditorsForUpdate } from '../lib/update-preparation'
import { prepareAppUpdate, startUpdateChecks } from '../lib/app-update'

const latest = ref<string | null>(null)
const dismissed = ref<string | null>(null)
const updating = ref(false), updateError = ref('')
let stop: (() => void) | undefined
onMounted(() => {
 if (import.meta.env.PROD && !Capacitor.isNativePlatform()) {
  stop = startUpdateChecks(__APP_BUILD_ID__, import.meta.env.BASE_URL, id => { latest.value = id })
 }
})
onBeforeUnmount(() => stop?.())
async function update() {
 if (!latest.value || updating.value) return
 updating.value = true; updateError.value = ''
 try {
  if (!await prepareEditorsForUpdate()) {
   updateError.value = '入力内容を保存できませんでした。保存状態を確認してから、もう一度更新してください。'
   updating.value = false
   return
  }
  const target = await prepareAppUpdate(window.location.href, latest.value)
  if (!await prepareEditorsForUpdate()) {
   updateError.value = '入力内容を保存できませんでした。保存状態を確認してから、もう一度更新してください。'
   updating.value = false
   return
  }
  window.location.replace(target)
 } catch {
  updateError.value = '更新を取得できませんでした。通信を確認して、もう一度お試しください。'
  updating.value = false
 }
}
</script>

<template>
 <aside v-if="latest && latest !== dismissed" class="update-notice" aria-label="アプリの更新">
  <div role="status" aria-live="polite">
   <strong>新しいバージョンが利用できます</strong>
   <p>入力内容を保存してから、新しいバージョンに更新します。</p>
  </div>
  <p v-if="updateError" role="alert">{{ updateError }}</p>
  <div class="update-actions">
   <button type="button" class="update-later" :disabled="updating" @click="dismissed = latest">あとで</button>
   <button type="button" class="update-now" :disabled="updating" @click="update">{{ updating ? '更新中…' : '更新する' }}</button>
  </div>
 </aside>
</template>

<style scoped>
.update-notice { position: sticky; top: 0; z-index: 40; padding: calc(env(safe-area-inset-top, 0px) + 14px) 20px 14px; background: #edf4ef; color: var(--forest); border-bottom: 1px solid var(--line); }
.update-notice strong { font-size: .88rem; }
.update-notice p { margin: 6px 0 10px; font-size: .76rem; line-height: 1.6; }
.update-actions { display: flex; justify-content: flex-end; gap: 10px; }
.update-actions button { min-height: 44px; padding: 8px 16px; border-radius: 12px; font: inherit; font-size: .8rem; cursor: pointer; }
.update-later { border: 1px solid var(--line); background: white; color: var(--forest); }
.update-now { border: 0; background: var(--forest); color: white; }
.update-now:disabled { opacity: .5; cursor: default; }
</style>
