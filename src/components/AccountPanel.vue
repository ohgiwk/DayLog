<script setup lang="ts">
import { computed, ref } from 'vue'
import DiaryConflictPreview from './DiaryConflictPreview.vue'
import { account, authError, cloudConfigured } from '../stores/account'
import { supabase } from '../lib/supabase'
import { chooseConflict, importGuestDiaries, syncDiary, syncState } from '../lib/diary-sync'
import { guestEntries, readAccountSnapshot } from '../stores/diary'
const busy = ref(false), message = ref(''), error = ref('')
const guestCount = computed(() => { void account.user?.id; return guestEntries().length })
async function perform(action: () => Promise<void>) {
 if (busy.value) return
 busy.value = true; message.value = ''; error.value = ''
 try { await action() } catch (e) { error.value = e instanceof Error ? e.message : '操作を完了できませんでした。' }
 finally { busy.value = false }
}
async function signOut() {
 await perform(async () => {
  // Keep offline edits recoverable instead of making the account disappear prematurely.
  await syncDiary()
  if (Object.keys(readAccountSnapshot().pending).length || readAccountSnapshot().cleanup.length) throw new Error('未同期の変更があります。同期・重複の解決後にログアウトしてください。')
  const { error: failure } = await supabase!.auth.signOut({ scope: 'local' })
  if (failure) throw new Error(authError(failure))
 })
}
function localEntry(date: string) { return readAccountSnapshot().pending[date]?.entry ?? null }
</script>
<template>
 <section class="soft-card account-panel" aria-labelledby="account-title">
  <div class="account-heading"><h2 id="account-title">アカウントと同期</h2><span v-if="account.user" class="sync-status" role="status">{{ syncState.busy ? '同期中…' : syncState.pending ? `未同期 ${syncState.pending}件` : syncState.lastSynced ? '同期済み' : '確認中' }}</span></div>
  <p v-if="!cloudConfigured">アカウント機能は準備中です。日記はこの端末に保存されています。</p>
  <template v-else>
   <template v-if="account.user">
    <p class="account-email">{{ account.user.email }}</p>
    <p v-if="syncState.error" class="error" role="alert">{{ syncState.error }}</p>
    <div class="account-actions"><button class="outline-button" :disabled="busy || syncState.busy" @click="syncDiary">今すぐ同期</button><button class="text-button" :disabled="busy || syncState.busy" @click="signOut">ログアウト</button></div>
    <details class="account-details">
     <summary>{{ guestCount ? `端末の日記を取り込む（${guestCount}件）` : '同期するデータについて' }}</summary>
     <template v-if="guestCount">
      <p>ログイン前の日記と写真を、このアカウントへアップロードします。</p>
      <button class="outline-button" :disabled="busy || syncState.busy" @click="perform(async () => { message = await importGuestDiaries() })">取り込む</button>
     </template>
     <p>日記と写真を同期します。メモと表示設定は、この端末だけに保存されます。</p>
    </details>
    <article v-for="conflict in syncState.conflicts" :key="conflict.date" class="conflict-card">
     <h3>{{ conflict.date }}の変更が重複しています</h3>
     <p>本文・回答・写真を含め、残す日記を選んでください。</p>
     <details><summary>この端末の内容</summary><DiaryConflictPreview :entry="localEntry(conflict.date)"/></details>
     <details><summary>同期先の内容</summary><DiaryConflictPreview :entry="conflict.entry"/></details>
     <div class="account-actions"><button class="outline-button" :disabled="busy || syncState.busy" @click="perform(async () => { await chooseConflict(conflict.date, 'local') })">この端末を使う</button><button class="outline-button" :disabled="busy || syncState.busy" @click="perform(async () => { await chooseConflict(conflict.date, 'remote') })">同期先を使う</button></div>
    </article>
   </template>

  </template>
  <p v-if="message" role="status">{{ message }}</p><p v-if="error" class="error" role="alert">{{ error }}</p>
 </section>
</template>
<style scoped>
.account-panel{margin-bottom:20px;padding:16px}
.account-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.account-heading h2{font-size:.9rem;margin:0;line-height:1.5}
.sync-status{font-size:.68rem;line-height:1.5;color:var(--forest);background:var(--mist);border-radius:20px;padding:4px 8px;white-space:nowrap}
.account-panel p{font-size:.75rem;line-height:1.6;color:var(--sub);margin:8px 0}
.account-panel .account-email{overflow-wrap:anywhere;margin:6px 0 10px;font-size:.78rem;color:var(--forest)}
.account-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.account-actions>button,.account-details>button{min-height:44px;cursor:pointer}
.account-actions>.outline-button{padding:8px 12px;border-radius:12px}
.account-actions>.text-button{margin-left:auto;padding:8px;font-size:.72rem}
.account-panel button:disabled{opacity:.5;cursor:wait}
.account-panel .error{color:#9d594e}
.account-details{margin-top:10px;border-top:1px solid var(--line)}
.account-details>summary{min-height:44px;padding:13px 0 8px;font-size:.72rem;line-height:1.5;color:var(--sub);cursor:pointer}
.conflict-card{margin-top:12px;padding-top:10px;border-top:1px solid var(--line)}
.conflict-card h3{font-size:.82rem;margin:4px 0}
.conflict-card summary{padding:12px 0;font-size:.75rem;cursor:pointer}
.account-panel :is(button,summary):focus-visible{outline:2px solid var(--sage);outline-offset:2px}
</style>
