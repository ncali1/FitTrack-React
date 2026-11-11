/**
 * Startup must be local-first: a signed-in user sees their on-device data straight away,
 * however slow the network is, and cloud changes are folded in once the sync finishes.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'
import type { Exercise } from '@/types'

const sync = vi.hoisted(() => ({
  finish: (_changed: boolean): void => {},
  fail: (_err: Error): void => {},
}))

vi.mock('@/services/cloudSync', () => ({
  syncWithCloud: vi.fn(
    () =>
      new Promise<boolean>((resolve, reject) => {
        sync.finish = resolve
        sync.fail = reject
      })
  ),
}))

const stored = vi.hoisted(() => ({ exercises: [] as unknown[] }))

vi.mock('@/services/storage', () => ({
  StorageQuotaError: class StorageQuotaError extends Error {},
  storageService: {
    getAllExercises: vi.fn(async () => stored.exercises),
    getAllRoutines: vi.fn(async () => []),
    getAllWorkoutTemplates: vi.fn(async () => []),
    getAllWorkoutSessions: vi.fn(async () => []),
    getAllBodyWeightLogs: vi.fn(async () => []),
    getAllCardioSessions: vi.fn(async () => []),
  },
}))

import App from './App'
import { syncWithCloud } from '@/services/cloudSync'
import { useAuthStore } from '@/stores/auth'
import { useExercisesStore } from '@/stores/exercises'

const exercise = (id: string): Exercise => ({
  id,
  name: id,
  targetSets: 3,
  targetReps: 10,
  targetMuscleGroups: [],
  createdAt: 1,
  updatedAt: 1,
})

const signedIn = (user: User | null) =>
  useAuthStore.setState({ cloudEnabled: true, user, init: async () => {} })

describe('App startup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    localStorage.setItem('fittrack-onboarding-complete', 'true')
    stored.exercises = [exercise('bench')]
    useExercisesStore.setState({ exercises: [] })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('shows local data without waiting for the cloud sync to finish', async () => {
    signedIn({ id: 'u1' } as User)
    render(<App />)

    // The sync promise is still pending here — the app is up and has loaded from the device.
    await screen.findAllByRole('navigation')
    await waitFor(() => expect(useExercisesStore.getState().exercises).toHaveLength(1))
    expect(syncWithCloud).toHaveBeenCalledWith('u1')
  })

  it('reloads the stores when the sync changed data on this device', async () => {
    signedIn({ id: 'u1' } as User)
    render(<App />)
    await waitFor(() => expect(useExercisesStore.getState().exercises).toHaveLength(1))

    stored.exercises = [exercise('bench'), exercise('squat')]
    sync.finish(true)

    await waitFor(() => expect(useExercisesStore.getState().exercises).toHaveLength(2))
  })

  it('carries on with local data when the sync fails', async () => {
    signedIn({ id: 'u1' } as User)
    render(<App />)
    await waitFor(() => expect(syncWithCloud).toHaveBeenCalled())

    sync.fail(new Error('offline'))

    await screen.findAllByRole('navigation')
    expect(useExercisesStore.getState().exercises).toHaveLength(1)
  })

  it('does not sync when nobody is signed in', async () => {
    localStorage.setItem('fittrack-skip-auth', 'true')
    signedIn(null)
    render(<App />)

    await waitFor(() => expect(useExercisesStore.getState().exercises).toHaveLength(1))
    expect(syncWithCloud).not.toHaveBeenCalled()
  })
})
