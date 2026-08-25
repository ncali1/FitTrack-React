import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Lazily-initialised Supabase client. Cloud sync is entirely optional — if
 * VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY aren't set (e.g. in tests, or before you've
 * created a Supabase project), `getSupabase()` returns null and every caller falls back
 * to local-only (IndexedDB) behaviour. This means the app works exactly as before out of
 * the box, and cloud sync switches on the moment you add credentials.
 */
let client: SupabaseClient | null | undefined = undefined

/**
 * Returns a singleton Supabase client, or `null` if cloud sync isn't configured.
 * Safe to call from anywhere — never throws.
 */
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client

  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

  if (!url || !key) {
    client = null
    return client
  }

  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  return client
}

/** `true` when cloud sync is configured (credentials present), regardless of connectivity. */
export function isCloudEnabled(): boolean {
  return getSupabase() !== null
}
