import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'
import { getSupabase, isCloudEnabled } from '@/services/supabaseClient'

interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
  cloudEnabled: boolean
  /**
   * `true` when the user has followed a "reset password" email link and Supabase has
   * established a recovery session. While true, the app should show the "set a new
   * password" form instead of the normal authenticated app.
   */
  passwordRecoveryMode: boolean

  /** Initialises the auth listener and hydrates the current session. Call once on app boot. */
  init: () => Promise<void>
  /** Creates a new account with email + password. */
  signUp: (email: string, password: string) => Promise<void>
  /** Signs in with email + password. */
  signIn: (email: string, password: string) => Promise<void>
  /** Signs the current user out. */
  signOut: () => Promise<void>
  /** Sends a "reset your password" email containing a link back to this app. */
  sendPasswordReset: (email: string) => Promise<void>
  /** Sets a new password for the current session (recovery flow or voluntary change). */
  updatePassword: (newPassword: string) => Promise<void>
  clearError: () => void
  exitPasswordRecovery: () => void
}

/**
 * Zustand store wrapping Supabase Auth. Tracks the current session, exposes
 * sign-up / sign-in / sign-out actions plus password reset ("forgot password") and
 * in-session password change, and stays in sync with auth state changes (e.g. token
 * refresh, sign-out in another tab, or landing back from a password-reset email link).
 * When cloud sync isn't configured (`cloudEnabled` is false), the store simply runs in
 * local-only mode — no auth gate, no password features shown.
 */
export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  loading: true,
  error: null,
  cloudEnabled: isCloudEnabled(),
  passwordRecoveryMode: false,

  init: async () => {
    if (!isCloudEnabled()) {
      set({ loading: false })
      return
    }
    const supabase = getSupabase()!

    const { data } = await supabase.auth.getSession()
    set({ user: data.session?.user ?? null, loading: false })

    supabase.auth.onAuthStateChange((event, session) => {
      set({ user: session?.user ?? null })
      if (event === 'PASSWORD_RECOVERY') {
        set({ passwordRecoveryMode: true })
      }
    })
  },

  signUp: async (email, password) => {
    if (!isCloudEnabled()) return
    set({ error: null })
    const supabase = getSupabase()!
    const { data, error: err } = await supabase.auth.signUp({ email, password })
    if (err) {
      set({ error: err.message })
      throw err
    }
    set({ user: data.user })
  },

  signIn: async (email, password) => {
    if (!isCloudEnabled()) return
    set({ error: null })
    const supabase = getSupabase()!
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) {
      set({ error: err.message })
      throw err
    }
    set({ user: data.user })
  },

  signOut: async () => {
    if (!isCloudEnabled()) return
    const supabase = getSupabase()!
    await supabase.auth.signOut()
    set({ user: null })
  },

  /**
   * Always resolves the same way regardless of whether the email has an account, so as
   * not to leak which addresses are registered — callers should show a generic
   * confirmation message rather than branching on success/failure of this call.
   */
  sendPasswordReset: async (email) => {
    if (!isCloudEnabled()) return
    set({ error: null })
    const supabase = getSupabase()!
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    if (err) {
      set({ error: err.message })
      throw err
    }
  },

  updatePassword: async (newPassword) => {
    if (!isCloudEnabled()) return
    set({ error: null })
    const supabase = getSupabase()!
    const { error: err } = await supabase.auth.updateUser({ password: newPassword })
    if (err) {
      set({ error: err.message })
      throw err
    }
    set({ passwordRecoveryMode: false })
  },

  clearError: () => set({ error: null }),
  exitPasswordRecovery: () => set({ passwordRecoveryMode: false }),
}))
