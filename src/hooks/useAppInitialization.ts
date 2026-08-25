import { useCallback, useRef, useState } from 'react'
import { useExercisesStore } from '@/stores/exercises'
import { useRoutineStore } from '@/stores/routine'
import { useWorkoutSessionsStore } from '@/stores/workoutSessions'
import { useBodyWeightStore } from '@/stores/bodyWeight'
import { storageService, StorageQuotaError } from '@/services/storage'

/**
 * Hook that manages the application's startup sequence and reset logic.
 *
 * Call `initializeApp` (e.g. from an effect on mount) to load all persisted data from
 * IndexedDB into the Zustand stores. Call `resetApp` to wipe all stored data and return
 * the stores to their initial empty state.
 */
export function useAppInitialization() {
  const loadExercises = useExercisesStore((s) => s.loadExercises)
  const loadRoutines = useRoutineStore((s) => s.loadRoutines)
  const loadSessions = useWorkoutSessionsStore((s) => s.loadSessions)
  const loadBodyWeightLogs = useBodyWeightStore((s) => s.loadLogs)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isInitializedRef = useRef(false)
  const [isInitialized, setIsInitialized] = useState(false)

  const initializeApp = useCallback(async () => {
    // Guarded synchronously (not just at the end) so React StrictMode's double-invoked
    // mount effect in dev doesn't kick off two concurrent loads.
    if (isInitializedRef.current) return
    isInitializedRef.current = true

    setIsLoading(true)
    setError(null)

    // Each load is independent — a failure in one shouldn't block the others (graceful
    // degradation to an empty state), except a quota error, which is surfaced to the user.
    try {
      await loadExercises()
    } catch (err) {
      if (err instanceof StorageQuotaError) setError(err.message)
      else console.error('Failed to load exercises, continuing with empty state:', err)
    }

    try {
      await loadRoutines()
    } catch (err) {
      if (err instanceof StorageQuotaError) setError(err.message)
      else console.error('Failed to load routines, continuing with empty state:', err)
    }

    try {
      await loadSessions()
    } catch (err) {
      if (err instanceof StorageQuotaError) setError(err.message)
      else console.error('Failed to load sessions, continuing with empty state:', err)
    }

    try {
      await loadBodyWeightLogs()
    } catch (err) {
      if (err instanceof StorageQuotaError) setError(err.message)
      else console.error('Failed to load body weight logs, continuing with empty state:', err)
    }

    setIsInitialized(true)
    setIsLoading(false)
  }, [loadExercises, loadRoutines, loadSessions, loadBodyWeightLogs])

  const resetApp = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      await storageService.clearAllData()
      useExercisesStore.setState({ exercises: [], loading: false, error: null })
      useRoutineStore.setState({ routines: [], loading: false, error: null })
      useWorkoutSessionsStore.setState({ sessions: [], currentSession: null, loading: false, error: null })
      useBodyWeightStore.setState({ logs: [], loading: false, error: null })

      isInitializedRef.current = false
      setIsInitialized(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset app'
      setError(message)
      console.error('App reset error:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    isLoading,
    error,
    isInitialized,
    isReady: isInitialized && !isLoading,
    hasDataError: error !== null,
    initializeApp,
    resetApp,
  }
}
