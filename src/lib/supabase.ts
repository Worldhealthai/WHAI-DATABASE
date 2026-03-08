import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY env vars')
    }
    _supabase = createClient(url, key)
  }
  return _supabase
}

// Convenience getter for backward compat
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as any)[prop]
  },
})
