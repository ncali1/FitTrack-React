/**
 * Tests for the auth store's sign-out: it signs out this device only, and doesn't show the
 * user as signed out when Supabase kept the session.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { User } from '@supabase/supabase-js'

const signOut = vi.hoisted(() => vi.fn())

vi.mock('@/services/supabaseClient', () => ({
  isCloudEnabled: () => true,
  getSupabase: () => ({ auth: { signOut } }),
}))

import { useAuthStore } from './auth'

const INITIAL = useAuthStore.getState()
const user = { id: 'u1' } as User

describe('auth store: signOut', () => {
  beforeEach(() => {
    useAuthStore.setState({ ...INITIAL, user }, true)
    signOut.mockReset()
  })

  // #11: the default global scope revoked every other device's session too.
  it('signs out this device only', async () => {
    signOut.mockResolvedValue({ error: null })

    await useAuthStore.getState().signOut()

    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('stays signed in and throws when Supabase could not sign out', async () => {
    const failure = new Error('Failed to fetch')
    signOut.mockResolvedValue({ error: failure })

    await expect(useAuthStore.getState().signOut()).rejects.toBe(failure)

    expect(useAuthStore.getState().user).toBe(user)
  })
})
