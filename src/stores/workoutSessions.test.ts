import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useWorkoutSessionsStore } from './workoutSessions'
import { createMockRoutine } from '@/tests/factories'

vi.mock('@/services/storage', () => ({
  storageService: {
    saveExercise: vi.fn(async () => {}),
    getExercise: vi.fn(async () => undefined),
    getAllExercises: vi.fn(async () => []),
    deleteExercise: vi.fn(async () => {}),
    saveRoutine: vi.fn(async () => {}),
    getAllRoutines: vi.fn(async () => []),
    deleteRoutine: vi.fn(async () => {}),
    saveWorkoutSession: vi.fn(async () => {}),
    getWorkoutSession: vi.fn(async () => undefined),
    getWorkoutSessionByDate: vi.fn(async () => undefined),
    getAllWorkoutSessions: vi.fn(async () => []),
    deleteWorkoutSession: vi.fn(async () => {}),
    clearAllData: vi.fn(async () => {}),
  },
}))

const INITIAL_STATE = useWorkoutSessionsStore.getState()

describe('useWorkoutSessionsStore', () => {
  beforeEach(() => {
    useWorkoutSessionsStore.setState(INITIAL_STATE, true)
    // The weekly-summary/progress/history caches are module-level Maps, not part of
    // Zustand state, so setState(..., true) above doesn't clear them — do that too, or
    // a fixed date-string key from an earlier test (e.g. '2025-01-06') can leak a stale
    // cached result into this one.
    useWorkoutSessionsStore.getState().invalidateCache()
  })

  describe('Creating sessions and logging performance', () => {
    it('creates a session and logs a performance entry when marking complete', async () => {
      const { createSession, logPerformance, sessionByDate } = useWorkoutSessionsStore.getState()
      const date = '2025-01-06'

      const session = await createSession(date)
      await logPerformance(session.id, 'ex1', { completed: true, actualSets: 3, actualReps: 10, difficultyLevel: 'moderate' })

      const updated = sessionByDate(date)
      expect(updated?.exercises).toHaveLength(1)
      expect(updated?.exercises[0]).toMatchObject({ exerciseId: 'ex1', completed: true })
    })

    it('marks an exercise incomplete when toggled off', async () => {
      const { createSession, logPerformance, sessionByDate } = useWorkoutSessionsStore.getState()
      const date = '2025-01-06'

      const session = await createSession(date)
      await logPerformance(session.id, 'ex1', { completed: true, actualSets: 3, actualReps: 15, difficultyLevel: 'easy' })
      await logPerformance(session.id, 'ex1', { completed: false })

      const perf = sessionByDate(date)?.exercises.find((e) => e.exerciseId === 'ex1')
      expect(perf?.completed).toBe(false)
    })

    it('replaces (not duplicates) the entry when re-logging the same exercise', async () => {
      const { createSession, logPerformance, sessionByDate } = useWorkoutSessionsStore.getState()
      const date = '2025-01-07'

      const session = await createSession(date)
      await logPerformance(session.id, 'ex1', { completed: true, actualSets: 3, actualReps: 8, difficultyLevel: 'hard' })
      await logPerformance(session.id, 'ex1', { completed: true, actualSets: 4, actualReps: 8, difficultyLevel: 'moderate' })

      const exercises = sessionByDate(date)?.exercises.filter((e) => e.exerciseId === 'ex1')
      expect(exercises).toHaveLength(1)
      expect(exercises![0]!.actualSets).toBe(4)
    })

    it('tracks multiple exercises within the same session', async () => {
      const { createSession, logPerformance, sessionByDate } = useWorkoutSessionsStore.getState()
      const date = '2025-01-09'

      const session = await createSession(date)
      await logPerformance(session.id, 'ex1', { completed: true, actualSets: 3, actualReps: 12, difficultyLevel: 'easy' })
      await logPerformance(session.id, 'ex2', { completed: true, actualSets: 3, actualReps: 10, difficultyLevel: 'hard' })

      expect(sessionByDate(date)?.exercises).toHaveLength(2)
    })

    it('throws when logging performance against an unknown session id', async () => {
      await expect(
        useWorkoutSessionsStore.getState().logPerformance('missing-id', 'ex1', { completed: true })
      ).rejects.toThrow('Session not found')
    })
  })

  describe('sessionByDate / performanceByExercise', () => {
    it('returns undefined for a date with no session', () => {
      expect(useWorkoutSessionsStore.getState().sessionByDate('2099-01-01')).toBeUndefined()
    })

    it('collects every logged performance for an exercise across sessions', async () => {
      const { createSession, logPerformance, performanceByExercise } = useWorkoutSessionsStore.getState()
      const s1 = await createSession('2025-01-06')
      await logPerformance(s1.id, 'ex1', { completed: true, actualReps: 8 })
      const s2 = await createSession('2025-01-13')
      await logPerformance(s2.id, 'ex1', { completed: true, actualReps: 10 })

      expect(performanceByExercise('ex1')).toHaveLength(2)
    })
  })

  describe('getCachedExerciseHistory', () => {
    it('reflects logged performances newest first', async () => {
      const { createSession, logPerformance, getCachedExerciseHistory } = useWorkoutSessionsStore.getState()
      const s1 = await createSession('2025-01-06')
      await logPerformance(s1.id, 'ex1', { completed: true, actualReps: 8, weight: 40 })
      const s2 = await createSession('2025-01-13')
      await logPerformance(s2.id, 'ex1', { completed: true, actualReps: 10, weight: 45 })

      const history = getCachedExerciseHistory('ex1')
      expect(history.map((h) => h.date)).toEqual(['2025-01-13', '2025-01-06'])
    })

    it('invalidates the cache when a new performance is logged', async () => {
      const { createSession, logPerformance, getCachedExerciseHistory } = useWorkoutSessionsStore.getState()
      expect(getCachedExerciseHistory('ex1')).toHaveLength(0)

      const session = await createSession('2025-01-06')
      await logPerformance(session.id, 'ex1', { completed: true, actualReps: 8 })

      expect(getCachedExerciseHistory('ex1')).toHaveLength(1)
    })
  })

  describe('getCachedWeeklySummary', () => {
    it('caches by week-start key and returns a fresh result after invalidation', async () => {
      const routine = createMockRoutine({ weeklyAssignments: { ...createMockRoutine().weeklyAssignments, monday: ['ex1'] } })
      const { getCachedWeeklySummary, createSession, logPerformance } = useWorkoutSessionsStore.getState()

      const first = getCachedWeeklySummary('2025-01-06', routine)
      expect(first.totalCompletedWorkouts).toBe(0)

      const session = await createSession('2025-01-06')
      await logPerformance(session.id, 'ex1', { completed: true, actualReps: 8 })

      // logPerformance invalidates the cache, so this recomputes rather than reusing `first`
      const second = useWorkoutSessionsStore.getState().getCachedWeeklySummary('2025-01-06', routine)
      expect(second.totalCompletedWorkouts).toBe(1)
    })
  })
})
