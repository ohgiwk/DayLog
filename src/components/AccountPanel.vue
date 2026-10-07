<script setup lang="ts">
import { computed, ref } from 'vue'
import DiaryConflictPreview from './DiaryConflictPreview.vue'
import { account, authError, cloudConfigured } from '../stores/account'
import { supabase } from '../lib/supabase'
import { chooseConflict, importGuestDiaries, syncDiary, syncState } from '../lib/diary-sync'
import { guestEntries, readAccountSnapshot } from '../stores/diary'
const mode = ref<'login' | 'signup'>('login')
const email = ref(''), password = ref(''), busy = ref(false), message = ref(''), error = ref('')
const guestCount = computed(() => { void account.user?.id; return guestEntries().length })
const redirectTo = () => `${location.origin}${location.pathname}`
async function perform(action: () => Promise<void>) {
 if (busy.value) return
 busy.value = true; message.value = ''; error.value = ''
 try { await action() } catch (e) { error.value = e instanceof Error ? e.message : '操作を完了できませんでした。' }
 finally { busy.value = false; password.value = '' }
}
async function submit() {
 await perform(async () => {
  if (!supabase) return
  const credentials = { email: email.value.trim(), password: password.value }
  const result = account.recovery
   ? await supabase.auth.updateUser({ password: password.value })
   : mode.value === 'signup'
    ? await supabase.auth.signUp({ ...credentials, options: { emailRedirectTo: redirectTo() } })
    : await supabase.auth.signInWithPassword(credentials)
  if (result.error) throw new Error(authError(result.error))
  if (account.recovery) { account.recovery = false; message.value = 'パスワードを更新しました。' }
  else if (mode.value === 'signup') message.value = '確認メールが届いたらリンクを開いてください。確認後は各端末でログインできます。'
 })
}
async function resetPassword() {
 await perform(async () => {
  if (!email.value.trim()) throw new Error('メールアドレスを入力してください。')
  const { error: failure } = await supabase!.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: redirectTo() })
  if (failure) throw new Error(authError(failure))
  message.value = '登録済みの場合は再設定メールが届きます。このブラウザでリンクを開いてください。'
 })
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
  <h2 id="account-title">アカウントと同期</h2>
  <p>同じアカウントでログインすると、日記と写真を端末間で同期できます。</p>
  <p v-if="!cloudConfigured">アカウント機能は準備中です。日記はこの端末に保存されています。</p>
  <template v-else>
   <template v-if="account.user && !account.recovery">
    <p class="account-email">{{ account.user.email }}</p>
    <p role="status">{{ syncState.busy ? '同期中…' : syncState.pending ? `未同期の変更：${syncState.pending}件` : syncState.lastSynced ? '同期済み' : '同期を確認しています' }}</p>
    <p v-if="syncState.error" class="error" role="alert">{{ syncState.error }}</p>
    <div class="account-actions"><button class="outline-button" :disabled="busy || syncState.busy" @click="syncDiary">今すぐ同期</button><button class="text-button" :disabled="busy || syncState.busy" @click="signOut">ログアウト</button></div>
    <div v-if="guestCount" class="import-card">
     <p>この端末にログイン前の日記が{{ guestCount }}件あります。取り込むと、このアカウントへ日記と写真をアップロードします。</p>
     <button class="outline-button" :disabled="busy || syncState.busy" @click="perform(async () => { message = await importGuestDiaries() })">端末の日記を取り込む</button>
    </div>
    <article v-for="conflict in syncState.conflicts" :key="conflict.date" class="conflict-card">
     <h3>{{ conflict.date }}の変更が重複しています</h3>
     <p>本文・回答・写真を含め、残す日記を選んでください。</p>
     <details><summary>この端末の内容</summary><DiaryConflictPreview :entry="localEntry(conflict.date)"/></details>
     <details><summary>同期先の内容</summary><DiaryConflictPreview :entry="conflict.entry"/></details>
     <div class="account-actions"><button class="outline-button" :disabled="busy || syncState.busy" @click="perform(async () => { await chooseConflict(conflict.date, 'local') })">この端末を使う</button><button class="outline-button" :disabled="busy || syncState.busy" @click="perform(async () => { await chooseConflict(conflict.date, 'remote') })">同期先を使う</button></div>
    </article>
   </template>
   <form v-else @submit.prevent="submit">
    <div v-if="!account.recovery" class="account-actions"><button type="button" :aria-pressed="mode === 'login'" :disabled="busy" @click="mode = 'login'">ログイン</button><button type="button" :aria-pressed="mode === 'signup'" :disabled="busy" @click="mode = 'signup'">新規登録</button></div>
    <label v-if="!account.recovery">メールアドレス<input v-model="email" type="email" autocomplete="email" required :disabled="busy"></label>
    <label>{{ account.recovery ? '新しいパスワード' : 'パスワード' }}<input v-model="password" type="password" :autocomplete="mode === 'signup' || account.recovery ? 'new-password' : 'current-password'" :minlength="mode === 'signup' || account.recovery ? 8 : 1" required :disabled="busy"></label>
    <p v-if="mode === 'signup'">パスワードは8文字以上にしてください。</p>
    <button class="primary-button full" :disabled="busy">{{ busy ? '処理中…' : account.recovery ? 'パスワードを更新' : mode === 'signup' ? 'アカウントを作成' : 'ログイン' }}</button>
    <button v-if="!account.recovery" type="button" class="text-button" :disabled="busy" @click="resetPassword">パスワードを忘れた場合</button>
   </form>
  </template>
  <p v-if="message" role="status">{{ message }}</p><p v-if="error" class="error" role="alert">{{ error }}</p>
  <p class="account-footnote">メモと表示設定は、この端末だけに保存されます。</p>
 </section>
</template>
<style scoped>
.account-panel{margin-bottom:24px}.account-panel h2{font-size:1.1rem;margin:0 0 12px}.account-panel p{font-size:.8rem;line-height:1.7;color:var(--sub)}.account-email{overflow-wrap:anywhere;font-weight:700;color:var(--forest)!important}.account-panel label{display:grid;gap:6px;font-size:.8rem;margin:14px 0}.account-panel input{width:100%;min-height:44px;padding:12px;border:1px solid var(--line);border-radius:12px;background:white;color:var(--text);font-size:16px}.account-actions{display:flex;flex-wrap:wrap;gap:8px}.account-actions>button{min-height:44px;border:1px solid var(--line);border-radius:12px;padding:8px 12px;background:white;color:var(--forest)}.account-actions>button[aria-pressed=true]{background:var(--mist);border-color:var(--sage);font-weight:700}.account-panel button:disabled{opacity:.5;cursor:wait}.account-panel .error{color:#9d594e}.import-card,.conflict-card{margin-top:18px;padding-top:12px;border-top:1px solid var(--line)}.conflict-card h3{font-size:.85rem}.conflict-card pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;font-size:.75rem;max-height:200px;overflow:auto}.conflict-card summary{padding:10px 0;font-size:.8rem}.account-footnote{font-size:.7rem!important}.account-panel input:focus-visible,.account-panel button:focus-visible{outline:2px solid var(--sage);outline-offset:2px}
</style>
