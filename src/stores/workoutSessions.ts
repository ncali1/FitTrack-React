import { create } from 'zustand'
import type { WorkoutSession, ExercisePerformance, Routine, WeeklySummary, ProgressData } from '@/types'
import { storageService } from '@/services/storage'
import { calculateWeeklySummary, aggregateProgressData, getExerciseHistory } from '@/utils/calculations'
import type { ExerciseHistoryEntry } from '@/utils/calculations'
import { useAuthStore } from './auth'
import { syncUpsertSession } from '@/services/cloudSync'

/** Simple key-value caches for expensive computed results, cleared on any session change. */
const weeklySummaryCache = new Map<string, WeeklySummary>()
const progressDataCache = new Map<string, ProgressData>()
const historyCache = new Map<string, ExerciseHistoryEntry[]>()

function invalidateAllCaches() {
  weeklySummaryCache.clear()
  progressDataCache.clear()
  historyCache.clear()
}

interface WorkoutSessionsState {
  sessions: WorkoutSession[]
  currentSession: WorkoutSession | null
  loading: boolean
  error: string | null

  sessionByDate: (date: string) => WorkoutSession | undefined
  performanceByExercise: (exerciseId: string) => ExercisePerformance[]
  createSession: (date: string) => Promise<WorkoutSession>
  updateSession: (id: string, updates: Partial<Omit<WorkoutSession, 'id' | 'createdAt'>>) => Promise<WorkoutSession>
  logPerformance: (
    sessionId: string,
    exerciseId: string,
    performance: Omit<ExercisePerformance, 'exerciseId' | 'timestamp'>
  ) => Promise<void>
  loadSessions: () => Promise<void>

  getCachedWeeklySummary: (weekStartStr: string, routine: Routine) => WeeklySummary
  getCachedProgressData: (
    exerciseId: string,
    exerciseName: string,
    startStr: string,
    endStr: string,
    routine: Routine
  ) => ProgressData
  getCachedExerciseHistory: (exerciseId: string) => ExerciseHistoryEntry[]
  /** Manually invalidate all caches (call when routine changes). */
  invalidateCache: () => void
}

/**
 * Zustand store for workout sessions and performance logging, backed by IndexedDB.
 */
export const useWorkoutSessionsStore = create<WorkoutSessionsState>()((set, get) => ({
  sessions: [],
  currentSession: null,
  loading: false,
  error: null,

  sessionByDate: (date) => get().sessions.find((s) => s.date === date),

  performanceByExercise: (exerciseId) => {
    const performances: ExercisePerformance[] = []
    get().sessions.forEach((session) => {
      const perf = session.exercises.find((e) => e.exerciseId === exerciseId)
      if (perf) performances.push(perf)
    })
    return performances
  },

  createSession: async (date) => {
    set({ loading: true, error: null })
    try {
      const session: WorkoutSession = {
        id: crypto.randomUUID(),
        date,
        exercises: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      set((state) => ({ sessions: [...state.sessions, session], currentSession: session }))
      invalidateAllCaches()
      await storageService.saveWorkoutSession(session)

      const authUser = useAuthStore.getState().user
      if (authUser) syncUpsertSession(authUser.id, session)

      return session
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to create session' })
      throw err
    } finally {
      set({ loading: false })
    }
  },

  updateSession: async (id, updates) => {
    set({ loading: true, error: null })
    try {
      const existing = get().sessions.find((s) => s.id === id)
      if (!existing) {
        throw new Error('Session not found')
      }

      const updated: WorkoutSession = {
        id: existing.id,
        date: updates.date ?? existing.date,
        exercises: updates.exercises ?? existing.exercises,
        createdAt: existing.createdAt,
        updatedAt: Date.now(),
      }

      set((state) => ({
        sessions: state.sessions.map((s) => (s.id === id ? updated : s)),
        currentSession: state.currentSession?.id === id ? updated : state.currentSession,
      }))
      invalidateAllCaches()
      await storageService.saveWorkoutSession(updated)

      const authUser = useAuthStore.getState().user
      if (authUser) syncUpsertSession(authUser.id, updated)

      return updated
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to update session' })
      throw err
    } finally {
      set({ loading: false })
    }
  },

  logPerformance: async (sessionId, exerciseId, performance) => {
    set({ loading: true, error: null })
    try {
      const session = get().sessions.find((s) => s.id === sessionId)
      if (!session) {
        throw new Error('Session not found')
      }

      const newPerformance: ExercisePerformance = { ...performance, exerciseId, timestamp: Date.now() }
      const existingIndex = session.exercises.findIndex((e) => e.exerciseId === exerciseId)
      const exercises =
        existingIndex >= 0
          ? session.exercises.map((e, i) => (i === existingIndex ? newPerformance : e))
          : [...session.exercises, newPerformance]

      const updated: WorkoutSession = { ...session, exercises, updatedAt: Date.now() }

      set((state) => ({
        sessions: state.sessions.map((s) => (s.id === sessionId ? updated : s)),
        currentSession: state.currentSession?.id === sessionId ? updated : state.currentSession,
      }))
      invalidateAllCaches()
      await storageService.saveWorkoutSession(updated)

      const authUser = useAuthStore.getState().user
      if (authUser) syncUpsertSession(authUser.id, updated)
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to log performance' })
      throw err
    } finally {
      set({ loading: false })
    }
  },

  loadSessions: async () => {
    set({ loading: true, error: null })
    try {
      const loaded = await storageService.getAllWorkoutSessions()
      set({ sessions: loaded })
      invalidateAllCaches()
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load sessions' })
      throw err
    } finally {
      set({ loading: false })
    }
  },

  getCachedWeeklySummary: (weekStartStr, routine) => {
    const cached = weeklySummaryCache.get(weekStartStr)
    if (cached) return cached
    const result = calculateWeeklySummary(weekStartStr, routine, get().sessions)
    weeklySummaryCache.set(weekStartStr, result)
    return result
  },

  getCachedProgressData: (exerciseId, exerciseName, startStr, endStr, routine) => {
    const key = `${exerciseId}|${startStr}|${endStr}`
    const cached = progressDataCache.get(key)
    if (cached) return cached
    const result = aggregateProgressData(exerciseId, exerciseName, startStr, endStr, get().sessions, routine)
    progressDataCache.set(key, result)
    return result
  },

  getCachedExerciseHistory: (exerciseId) => {
    const cached = historyCache.get(exerciseId)
    if (cached) return cached
    const result = getExerciseHistory(exerciseId, get().sessions)
    historyCache.set(exerciseId, result)
    return result
  },

  invalidateCache: invalidateAllCaches,
}))
