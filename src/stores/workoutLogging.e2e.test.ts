/**
 * End-to-End: Log Workouts for a Full Week
 *
 * Validates the complete workout logging workflow:
 * - Exercises assigned to each day of the week
 * - Logging workout sessions with actual performance data (sets, reps, weight, difficulty)
 * - Verifying sessions are saved with all fields and a timestamp
 * - Marking exercises complete/incomplete
 * - Editing previously logged performance data
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useExercisesStore } from './exercises'
import { useRoutineStore } from './routine'
import { useWorkoutSessionsStore } from './workoutSessions'
import type { Exercise } from '@/types'

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

const INITIAL_EXERCISES = useExercisesStore.getState()
const INITIAL_ROUTINE = useRoutineStore.getState()
const INITIAL_SESSIONS = useWorkoutSessionsStore.getState()

// Week of 2025-01-06 (Monday) through 2025-01-12 (Sunday)
const WEEK_DATES: Record<string, string> = {
  monday: '2025-01-06',
  tuesday: '2025-01-07',
  wednesday: '2025-01-08',
  thursday: '2025-01-09',
  friday: '2025-01-10',
  saturday: '2025-01-11',
  sunday: '2025-01-12',
}

const DAYS = Object.keys(WEEK_DATES)

const weekPerformance = [
  { actualSets: 3, actualReps: 10, weight: 80, difficultyLevel: 'moderate' as const },
  { actualSets: 4, actualReps: 8, weight: 100, difficultyLevel: 'hard' as const },
  { actualSets: 3, actualReps: 5, weight: 140, difficultyLevel: 'hard' as const },
  { actualSets: 3, actualReps: 8, weight: 60, difficultyLevel: 'moderate' as const },
  { actualSets: 3, actualReps: 10, weight: undefined, difficultyLevel: 'easy' as const },
  { actualSets: 3, actualReps: 12, weight: 30, difficultyLevel: 'easy' as const },
  { actualSets: 3, actualReps: 60, weight: undefined, difficultyLevel: 'moderate' as const },
]

describe('E2E: Log Workouts for a Full Week', () => {
  let exercises: Exercise[]

  beforeEach(async () => {
    useExercisesStore.setState(INITIAL_EXERCISES, true)
    useRoutineStore.setState(INITIAL_ROUTINE, true)
    useWorkoutSessionsStore.setState(INITIAL_SESSIONS, true)
    useWorkoutSessionsStore.getState().invalidateCache()

    const { createExercise } = useExercisesStore.getState()
    exercises = await Promise.all([
      createExercise('Bench Press', 3, 10, ['Chest', 'Triceps']),
      createExercise('Squat', 4, 8, ['Legs', 'Glutes']),
      createExercise('Deadlift', 3, 5, ['Back', 'Legs']),
      createExercise('Overhead Press', 3, 8, ['Shoulders']),
      createExercise('Pull-up', 3, 10, ['Back', 'Biceps']),
      createExercise('Dumbbell Row', 3, 12, ['Back']),
      createExercise('Plank', 3, 60, ['Core']),
    ])

    const { assignExercise } = useRoutineStore.getState()
    for (let i = 0; i < DAYS.length; i++) {
      await assignExercise(DAYS[i]!, exercises[i]!.id)
    }
  })

  describe('Exercises assigned to each day are retrievable', () => {
    it('returns the correct exercise for each day of the week', () => {
      const { routineForDay } = useRoutineStore.getState()
      for (let i = 0; i < DAYS.length; i++) {
        expect(routineForDay(DAYS[i]!)).toContain(exercises[i]!.id)
      }
    })

    it('resolves exercise details for each day', () => {
      const { routineForDay } = useRoutineStore.getState()
      const { exerciseById } = useExercisesStore.getState()
      for (let i = 0; i < DAYS.length; i++) {
        const ids = routineForDay(DAYS[i]!)
        const resolved = ids.map((id) => exerciseById(id)).filter(Boolean)
        expect(resolved).toHaveLength(1)
        expect(resolved[0]!.name).toBe(exercises[i]!.name)
      }
    })
  })

  describe('Log a full week of workouts', () => {
    it('creates a session for each day of the week', async () => {
      const { createSession } = useWorkoutSessionsStore.getState()
      for (const day of DAYS) {
        const session = await createSession(WEEK_DATES[day]!)
        expect(session.date).toBe(WEEK_DATES[day]!)
        expect(session.id).toBeTruthy()
      }
      expect(useWorkoutSessionsStore.getState().sessions).toHaveLength(7)
    })

    it('logs performance data for each day and verifies all fields are stored', async () => {
      const { createSession, logPerformance, sessionByDate } = useWorkoutSessionsStore.getState()

      for (let i = 0; i < DAYS.length; i++) {
        const date = WEEK_DATES[DAYS[i]!]!
        const exercise = exercises[i]!
        const perf = weekPerformance[i]!

        const session = await createSession(date)
        const before = Date.now()
        await logPerformance(session.id, exercise.id, { completed: true, ...perf })
        const after = Date.now()

        const stored = sessionByDate(date)
        const storedPerf = stored!.exercises.find((e) => e.exerciseId === exercise.id)!

        expect(storedPerf.completed).toBe(true)
        expect(storedPerf.actualSets).toBe(perf.actualSets)
        expect(storedPerf.actualReps).toBe(perf.actualReps)
        if (perf.weight !== undefined) {
          expect(storedPerf.weight).toBe(perf.weight)
        } else {
          expect(storedPerf.weight).toBeUndefined()
        }
        expect(storedPerf.difficultyLevel).toBe(perf.difficultyLevel)
        expect(storedPerf.timestamp).toBeGreaterThanOrEqual(before)
        expect(storedPerf.timestamp).toBeLessThanOrEqual(after)
      }
    })

    it('stores all 7 sessions independently without cross-contamination', async () => {
      const { createSession, logPerformance, sessionByDate } = useWorkoutSessionsStore.getState()

      for (let i = 0; i < DAYS.length; i++) {
        const session = await createSession(WEEK_DATES[DAYS[i]!]!)
        await logPerformance(session.id, exercises[i]!.id, { completed: true, ...weekPerformance[i]! })
      }

      for (let i = 0; i < DAYS.length; i++) {
        const session = sessionByDate(WEEK_DATES[DAYS[i]!]!)!
        expect(session.exercises).toHaveLength(1)
        expect(session.exercises[0]!.exerciseId).toBe(exercises[i]!.id)
      }
    })
  })

  describe('Mark exercises complete and incomplete', () => {
    it('marks an exercise as completed', async () => {
      const { createSession, logPerformance, sessionByDate } = useWorkoutSessionsStore.getState()
      const session = await createSession(WEEK_DATES.monday!)
      await logPerformance(session.id, exercises[0]!.id, {
        completed: true,
        actualSets: 3,
        actualReps: 10,
        difficultyLevel: 'moderate',
      })
      expect(sessionByDate(WEEK_DATES.monday!)!.exercises[0]!.completed).toBe(true)
    })

    it('marks an exercise incomplete after it was completed', async () => {
      const { createSession, logPerformance, sessionByDate } = useWorkoutSessionsStore.getState()
      const session = await createSession(WEEK_DATES.tuesday!)
      await logPerformance(session.id, exercises[1]!.id, {
        completed: true,
        actualSets: 4,
        actualReps: 8,
        weight: 100,
        difficultyLevel: 'hard',
      })
      await logPerformance(session.id, exercises[1]!.id, { completed: false })

      const perf = sessionByDate(WEEK_DATES.tuesday!)!.exercises.find((e) => e.exerciseId === exercises[1]!.id)
      expect(perf!.completed).toBe(false)
    })

    it('toggles completion independently for multiple exercises in the same session', async () => {
      const { createExercise } = useExercisesStore.getState()
      const { assignExercise } = useRoutineStore.getState()
      const { createSession, logPerformance, sessionByDate } = useWorkoutSessionsStore.getState()

      const extra = await createExercise('Dips', 3, 12, ['Triceps'])
      await assignExercise('monday', extra.id)

      const session = await createSession(WEEK_DATES.monday!)
      await logPerformance(session.id, exercises[0]!.id, {
        completed: true,
        actualSets: 3,
        actualReps: 10,
        difficultyLevel: 'easy',
      })
      await logPerformance(session.id, extra.id, { completed: false })

      const stored = sessionByDate(WEEK_DATES.monday!)!
      expect(stored.exercises).toHaveLength(2)
      expect(stored.exercises.find((e) => e.exerciseId === exercises[0]!.id)!.completed).toBe(true)
      expect(stored.exercises.find((e) => e.exerciseId === extra.id)!.completed).toBe(false)
    })
  })

  describe('Edit previously logged performance data', () => {
    it('overwrites (not duplicates) performance data when re-logging the same exercise', async () => {
      const { createSession, logPerformance, sessionByDate } = useWorkoutSessionsStore.getState()
      const session = await createSession(WEEK_DATES.wednesday!)

      await logPerformance(session.id, exercises[2]!.id, {
        completed: true,
        actualSets: 3,
        actualReps: 5,
        weight: 140,
        difficultyLevel: 'hard',
      })
      await logPerformance(session.id, exercises[2]!.id, {
        completed: true,
        actualSets: 4,
        actualReps: 6,
        weight: 150,
        difficultyLevel: 'moderate',
      })

      const perfs = sessionByDate(WEEK_DATES.wednesday!)!.exercises.filter((e) => e.exerciseId === exercises[2]!.id)
      expect(perfs).toHaveLength(1)
      expect(perfs[0]).toMatchObject({ actualSets: 4, actualReps: 6, weight: 150, difficultyLevel: 'moderate' })
    })

    it('allows editing performance for every day of the week', async () => {
      const { createSession, logPerformance, sessionByDate } = useWorkoutSessionsStore.getState()
      const sessionIds: string[] = []

      for (let i = 0; i < DAYS.length; i++) {
        const session = await createSession(WEEK_DATES[DAYS[i]!]!)
        sessionIds.push(session.id)
        await logPerformance(session.id, exercises[i]!.id, {
          completed: true,
          actualSets: 3,
          actualReps: 10,
          difficultyLevel: 'easy',
        })
      }

      for (let i = 0; i < DAYS.length; i++) {
        await logPerformance(sessionIds[i]!, exercises[i]!.id, {
          completed: true,
          actualSets: 5,
          actualReps: 15,
          weight: i * 10 + 10,
          difficultyLevel: 'hard',
        })
      }

      for (let i = 0; i < DAYS.length; i++) {
        const perf = sessionByDate(WEEK_DATES[DAYS[i]!]!)!.exercises.find((e) => e.exerciseId === exercises[i]!.id)!
        expect(perf).toMatchObject({ actualSets: 5, actualReps: 15, weight: i * 10 + 10, difficultyLevel: 'hard' })
      }
    })
  })

  describe('Full week integration', () => {
    it('logs a complete week and verifies all sessions plus per-exercise history', async () => {
      const { createSession, logPerformance, performanceByExercise } = useWorkoutSessionsStore.getState()

      for (let i = 0; i < DAYS.length; i++) {
        const session = await createSession(WEEK_DATES[DAYS[i]!]!)
        await logPerformance(session.id, exercises[i]!.id, { completed: true, ...weekPerformance[i]! })
      }

      expect(useWorkoutSessionsStore.getState().sessions).toHaveLength(7)

      for (const exercise of exercises) {
        const history = performanceByExercise(exercise.id)
        expect(history).toHaveLength(1)
        expect(history[0]!.completed).toBe(true)
      }
    })

    it('handles a day with multiple exercises logged, mixing complete and incomplete', async () => {
      const { createExercise } = useExercisesStore.getState()
      const { assignExercise } = useRoutineStore.getState()
      const { createSession, logPerformance, sessionByDate } = useWorkoutSessionsStore.getState()

      const ex2 = await createExercise('Incline Press', 3, 8, ['Chest'])
      const ex3 = await createExercise('Cable Fly', 3, 15, ['Chest'])
      await assignExercise('monday', ex2.id)
      await assignExercise('monday', ex3.id)

      const session = await createSession(WEEK_DATES.monday!)
      await logPerformance(session.id, exercises[0]!.id, {
        completed: true,
        actualSets: 3,
        actualReps: 10,
        weight: 80,
        difficultyLevel: 'moderate',
      })
      await logPerformance(session.id, ex2.id, {
        completed: true,
        actualSets: 3,
        actualReps: 8,
        weight: 70,
        difficultyLevel: 'hard',
      })
      await logPerformance(session.id, ex3.id, { completed: false })

      const stored = sessionByDate(WEEK_DATES.monday!)!
      expect(stored.exercises).toHaveLength(3)
      expect(stored.exercises.find((e) => e.exerciseId === ex3.id)!.completed).toBe(false)
    })
  })
})
