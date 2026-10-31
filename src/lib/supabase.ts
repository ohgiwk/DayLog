import type { User } from '@supabase/supabase-js'
import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
        },
      })
    : null

// Only restores the local editor scope. Server access still requires Supabase's
// normal session validation and RLS, even when the stored token has expired.
export function readOfflineUser(): User | null {
  if (!url) return null
  try {
    const key = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`
    const session = JSON.parse(localStorage.getItem(key) || 'null')
    if (
      typeof session?.access_token !== 'string' ||
      typeof session?.refresh_token !== 'string' ||
      typeof session?.user?.id !== 'string' ||
      !session.user.id
    )
      return null
    return session.user as User
  } catch {
    return null
  }
}
