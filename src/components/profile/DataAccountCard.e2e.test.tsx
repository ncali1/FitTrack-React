/**
 * End-to-end tests for "Delete all my data" in DataAccountCard: what gets deleted where,
 * that sync is paused around the reset, and that the result message says honestly whether
 * the cloud copy was touched.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from '@supabase/supabase-js'

/** Records the order things happen in, to check the reset runs inside the sync pause. */
const calls = vi.hoisted(() => [] as string[])

vi.mock('@/services/storage', () => ({
  storageService: {
    clearAllData: vi.fn(async () => void calls.push('clear local')),
  },
}))

vi.mock('@/services/cloudSync', () => ({
  deleteAllCloudData: vi.fn(async () => void calls.push('delete cloud')),
  clearSyncQueue: vi.fn(() => void calls.push('clear queue')),
  withSyncPaused: vi.fn(async (reset: () => Promise<unknown>) => {
    calls.push('pause sync')
    const result = await reset()
    calls.push('resume sync')
    return result
  }),
}))

vi.mock('@/stores/reloadAllStores', () => ({ reloadAllStores: vi.fn(async () => {}) }))
// Backup and storage protection have their own tests; keep them out of the way here.
vi.mock('@/components/settings/BackupControls', () => ({ BackupControls: () => null }))
vi.mock('@/hooks/useStorageProtection', () => ({
  useStorageProtection: () => ({ status: null, request: vi.fn() }),
}))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

import { DataAccountCard } from './DataAccountCard'
import { useAuthStore } from '@/stores/auth'
import { deleteAllCloudData } from '@/services/cloudSync'
import { storageService } from '@/services/storage'
import { toast } from 'sonner'

const INITIAL = useAuthStore.getState()
const user = { id: 'u1' } as User

const deleteEverything = async (confirmLabel: string) => {
  const clicker = userEvent.setup()
  render(<DataAccountCard />)
  await clicker.click(screen.getByRole('button', { name: 'Delete all my data' }))
  await clicker.click(screen.getByRole('button', { name: confirmLabel }))
}

describe('DataAccountCard: delete all my data', () => {
  beforeEach(() => {
    useAuthStore.setState(INITIAL, true)
    calls.length = 0
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('deletes the cloud copy first, then this device, all with sync paused', async () => {
    useAuthStore.setState({ cloudEnabled: true, user })

    await deleteEverything('Yes, delete everything')

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('All data deleted'))
    expect(deleteAllCloudData).toHaveBeenCalledWith('u1')
    expect(calls).toEqual(['pause sync', 'delete cloud', 'clear queue', 'clear local', 'resume sync'])
  })

  // #11: signed out (e.g. the session lapsed), the cloud copy is untouched — say so.
  it('says plainly that only this device was cleared when signed out', async () => {
    useAuthStore.setState({ cloudEnabled: true, user: null })

    await deleteEverything('Delete from this device')

    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    expect(deleteAllCloudData).not.toHaveBeenCalled()
    expect(storageService.clearAllData).toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalledWith('All data deleted')
    expect(vi.mocked(toast.success).mock.calls[0]![0]).toMatch(/cloud copy is unchanged/i)
  })

  it('reports plain success when the app has no cloud sync at all', async () => {
    useAuthStore.setState({ cloudEnabled: false, user: null })

    await deleteEverything('Yes, delete everything')

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('All data deleted'))
  })

  it('keeps this device untouched when the cloud delete fails', async () => {
    useAuthStore.setState({ cloudEnabled: true, user })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(deleteAllCloudData).mockRejectedValueOnce(new Error('offline'))

    await deleteEverything('Yes, delete everything')

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(storageService.clearAllData).not.toHaveBeenCalled()
  })
})
