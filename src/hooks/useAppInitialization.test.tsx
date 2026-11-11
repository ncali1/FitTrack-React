import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

const storage = vi.hoisted(() => ({
  releaseExercises: (): void => {},
  failSessions: null as Error | null,
}))

vi.mock('@/services/storage', () => {
  class StorageQuotaError extends Error {}
  return {
    StorageQuotaError,
    storageService: {
      getAllExercises: vi.fn(
        () => new Promise<unknown[]>((resolve) => (storage.releaseExercises = () => resolve([{ id: 'ex1' }])))
      ),
      getAllRoutines: vi.fn(async () => []),
      getAllWorkoutTemplates: vi.fn(async () => []),
      getAllWorkoutSessions: vi.fn(async () => {
        if (storage.failSessions) throw storage.failSessions
        return []
      }),
      getAllBodyWeightLogs: vi.fn(async () => [{ id: 'w1', date: '2026-01-15' }]),
      getAllCardioSessions: vi.fn(async () => []),
    },
  }
})

import { useAppInitialization } from './useAppInitialization'
import { storageService, StorageQuotaError } from '@/services/storage'
import { useExercisesStore } from '@/stores/exercises'
import { useBodyWeightStore } from '@/stores/bodyWeight'

describe('useAppInitialization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storage.failSessions = null
    useExercisesStore.setState({ exercises: [] })
    useBodyWeightStore.setState({ logs: [] })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('loads every store at once rather than one after another', async () => {
    const { result } = renderHook(() => useAppInitialization())
    act(() => void result.current.initializeApp())

    // Exercises are still loading, yet the stores queued behind them have already been read.
    await waitFor(() => expect(useBodyWeightStore.getState().logs).toHaveLength(1))
    expect(storageService.getAllCardioSessions).toHaveBeenCalled()
    expect(result.current.isLoading).toBe(true)

    await act(async () => storage.releaseExercises())
    await waitFor(() => expect(result.current.isReady).toBe(true))
    expect(useExercisesStore.getState().exercises).toHaveLength(1)
  })

  it('carries on with the other stores when one fails to load', async () => {
    storage.failSessions = new Error('corrupt')
    const { result } = renderHook(() => useAppInitialization())
    act(() => void result.current.initializeApp())
    await act(async () => storage.releaseExercises())

    await waitFor(() => expect(result.current.isReady).toBe(true))
    expect(result.current.error).toBeNull()
    expect(useExercisesStore.getState().exercises).toHaveLength(1)
    expect(useBodyWeightStore.getState().logs).toHaveLength(1)
  })

  it('surfaces a storage-quota failure to the user', async () => {
    storage.failSessions = new StorageQuotaError('Storage limit reached')
    const { result } = renderHook(() => useAppInitialization())
    act(() => void result.current.initializeApp())
    await act(async () => storage.releaseExercises())

    await waitFor(() => expect(result.current.error).toBe('Storage limit reached'))
  })
})
