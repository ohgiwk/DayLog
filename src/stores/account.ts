import { reactive } from 'vue'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { setImageScope } from '../lib/image-repository'
import { switchDiaryScope } from './diary'
export const account = reactive({ user: null as User | null, ready: false, error: '', recovery: false })
export const cloudConfigured = !!supabase
function applyUser(user: User | null) {
 if (account.ready && account.user?.id === user?.id) { account.user = user; return }
 switchDiaryScope(user?.id ?? '')
 setImageScope(user?.id ?? '')
 account.user = user
 account.ready = true
}
export async function initializeAccount() {
 if (!supabase) { applyUser(null); return }
 supabase.auth.onAuthStateChange((event, session) => {
  // Do not call another auth method while the auth client holds its event lock.
  setTimeout(() => {
   if (event === 'PASSWORD_RECOVERY') account.recovery = true
   try { applyUser(session?.user ?? null) }
   catch { account.error = '端末の保存データを読み込めません。再読み込みしてください。' }
  }, 0)
 })
 try {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  applyUser(data.session?.user ?? null)
 } catch {
  account.error = 'ログイン状態を確認できません。通信を確認して再読み込みしてください。'
  // Fail closed: never mount guest editors over an unidentified account session.
 }
}
export function authError(error: { code?: string; message?: string }) {
 if (error.code === 'invalid_credentials') return 'メールアドレスまたはパスワードが違います。'
 if (error.code === 'email_not_confirmed') return '確認メールのリンクを開いてからログインしてください。'
 if (error.code?.includes('rate_limit')) return 'しばらく待ってから、もう一度お試しください。'
 if (error.code === 'weak_password') return 'より長く推測されにくいパスワードにしてください。'
 return '操作を完了できませんでした。入力内容と通信状態を確認してください。'
}
