<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { account, authError, cloudConfigured } from '../stores/account'
import { supabase } from '../lib/supabase'
const route = useRoute()
const mode = computed(() => route.path === '/signup' ? 'signup' : 'login')
const email = ref(''), password = ref(''), busy = ref(false), message = ref(''), error = ref('')
const title = computed(() => account.recovery ? 'パスワードを再設定' : mode.value === 'signup' ? 'アカウントを作成' : 'おかえりなさい')
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
</script>
<template>
 <div class="auth-page">
  <header class="auth-intro"><p class="eyebrow">DAYLOG</p><h1>今日の心に、<br>静かな居場所を。</h1><p>あなたの日々を、どの端末からでも。</p></header>
  <section class="soft-card auth-card" aria-labelledby="auth-title">
   <h2 id="auth-title">{{ title }}</h2>
   <p class="auth-description">{{ account.recovery ? '新しいパスワードを入力してください。' : mode === 'signup' ? '日記と写真を、あなたのアカウントに。' : 'ログインして、日記の続きを。' }}</p>
   <p v-if="!cloudConfigured" role="alert">現在ログインの準備中です。しばらくしてからもう一度開いてください。</p>
   <form v-else @submit.prevent="submit">
    <label v-if="!account.recovery" for="auth-email">メールアドレス<input id="auth-email" v-model="email" type="email" autocomplete="email" autocapitalize="none" spellcheck="false" required :disabled="busy"></label>
    <label for="auth-password">{{ account.recovery ? '新しいパスワード' : 'パスワード' }}<input id="auth-password" v-model="password" type="password" :autocomplete="mode === 'signup' || account.recovery ? 'new-password' : 'current-password'" :minlength="mode === 'signup' || account.recovery ? 8 : 1" required :disabled="busy" :aria-describedby="mode === 'signup' || account.recovery ? 'password-help' : undefined"></label>
    <p v-if="mode === 'signup' || account.recovery" id="password-help" class="auth-help">8文字以上のパスワードを入力してください。</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p><p v-if="message" class="auth-message" role="status">{{ message }}</p>
    <button class="primary-button full" type="submit" :disabled="busy">{{ busy ? '処理中…' : account.recovery ? 'パスワードを更新' : mode === 'signup' ? 'アカウントを作成' : 'ログイン' }}</button>
    <button v-if="mode === 'login' && !account.recovery" type="button" class="text-button reset-button" :disabled="busy" @click="resetPassword">パスワードを忘れた場合</button>
   </form>
   <p v-if="!account.recovery && !busy" class="auth-switch">{{ mode === 'signup' ? 'すでにアカウントをお持ちですか？' : 'はじめての方はこちら' }}<RouterLink :to="{ path: mode === 'signup' ? '/login' : '/signup', query: route.query }">{{ mode === 'signup' ? 'ログイン' : '新規登録' }}</RouterLink></p>
  </section>
  <p class="auth-footnote">これまで端末に保存した日記は、<br>ログイン後に設定から取り込めます。</p>
 </div>
</template>
<style scoped>
.auth-page{min-height:calc(100dvh - env(safe-area-inset-top,0px));padding:52px var(--page-right) max(28px,env(safe-area-inset-bottom,0px)) var(--page-left);background-image:linear-gradient(180deg,transparent,var(--paper) 420px),var(--gradient-hero);background-size:100% 480px;background-repeat:no-repeat}
.auth-intro{padding:0 6px 28px}.auth-intro h1{font-size:2rem;font-weight:700;line-height:1.55;letter-spacing:-.04em;margin:14px 0}.auth-intro>p:last-child{font-size:.82rem;color:var(--sub)}.auth-card{padding:24px;background:rgba(255,255,255,.95);box-shadow:var(--shadow);border-color:rgba(255,255,255,.8);border-radius:24px}.auth-card h2{font-size:1.2rem;margin:0 0 8px}.auth-description{font-size:.78rem;color:var(--sub);line-height:1.7;margin:0 0 24px}.auth-card label{display:grid;gap:8px;font-size:.8rem;font-weight:600;margin-top:18px}.auth-card input{width:100%;min-height:48px;padding:12px;border:1px solid var(--line);border-radius:12px;background:white;color:var(--text);font-size:16px}.auth-help,.auth-message{font-size:.75rem;line-height:1.7;color:var(--sub)}.auth-message{padding:12px;border-radius:12px;background:var(--mist)}.auth-card .full{margin-top:24px}.reset-button{display:block;margin:6px auto 0}.auth-switch{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;font-size:.75rem;line-height:1.7;color:var(--sub);margin:24px 0 0}.auth-switch a{color:var(--forest);font-weight:700;text-underline-offset:4px;padding:8px;margin:-8px}.auth-footnote{text-align:center;color:var(--sub);font-size:.72rem;line-height:1.8;margin:24px 0 0}.auth-card :is(input,button,a):focus-visible{outline:2px solid var(--sage);outline-offset:3px}.auth-card button:disabled{opacity:.5;cursor:wait}
</style>
