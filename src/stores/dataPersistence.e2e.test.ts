/**
 * End-to-End: Data Persistence Across App Reload
 *
 * Tests that all data (exercises, routine assignments, workout sessions) is persisted
 * to storage and fully restored after a simulated app reload.
 *
 * The 'app reload' is simulated by:
 * 1. Creating data using the stores (which write through to the stateful mock storage)
 * 2. Resetting each store back to its empty initial state (clearing in-memory state,
 *    like a fresh page load before anything has been fetched)
 * 3. Calling the load actions (loadExercises, loadRoutines, loadSessions), which read
 *    from the stateful mock storage
 * 4. Verifying all data is present and intact in the reloaded stores
 *
 * A stateful mock storage is used so data written in step 1 is readable in step 3,
 * matching real IndexedDB behaviour.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useExercisesStore } from './exercises'
import { useRoutineStore } from './routine'
import { useWorkoutSessionsStore } from './workoutSessions'
import type { Exercise, Routine, WorkoutSession } from '@/types'

// ---------------------------------------------------------------------------
// Stateful mock storage — persists data between the 'write' and 'reload' phases
// ---------------------------------------------------------------------------

const mockDb: {
  exercises: Record<string, Exercise>
  routines: Record<string, Routine>
  workoutSessions: Record<string, WorkoutSession>
} = { exercises: {}, routines: {}, workoutSessions: {} }

vi.mock('@/services/storage', () => ({
  storageService: {
    saveExercise: vi.fn(async (exercise: Exercise) => {
      mockDb.exercises[exercise.id] = { ...exercise }
    }),
    getExercise: vi.fn(async (id: string) => mockDb.exercises[id]),
    getAllExercises: vi.fn(async () => Object.values(mockDb.exercises).map((e) => ({ ...e }))),
    deleteExercise: vi.fn(async (id: string) => {
      delete mockDb.exercises[id]
    }),

    saveRoutine: vi.fn(async (routine: Routine) => {
      mockDb.routines[routine.id] = { ...routine, weeklyAssignments: { ...routine.weeklyAssignments } }
    }),
    getAllRoutines: vi.fn(async () =>
      Object.values(mockDb.routines).map((r) => ({ ...r, weeklyAssignments: { ...r.weeklyAssignments } }))
    ),
    deleteRoutine: vi.fn(async (id: string) => {
      delete mockDb.routines[id]
    }),

    saveWorkoutSession: vi.fn(async (session: WorkoutSession) => {
      mockDb.workoutSessions[session.id] = { ...session, exercises: session.exercises.map((e) => ({ ...e })) }
    }),
    getWorkoutSession: vi.fn(async (id: string) => {
      const s = mockDb.workoutSessions[id]
      return s ? { ...s, exercises: s.exercises.map((e) => ({ ...e })) } : undefined
    }),
    getWorkoutSessionByDate: vi.fn(async (date: string) => {
      const s = Object.values(mockDb.workoutSessions).find((s) => s.date === date)
      return s ? { ...s, exercises: s.exercises.map((e) => ({ ...e })) } : undefined
    }),
    getAllWorkoutSessions: vi.fn(async () =>
      Object.values(mockDb.workoutSessions).map((s) => ({ ...s, exercises: s.exercises.map((e) => ({ ...e })) }))
    ),
    deleteWorkoutSession: vi.fn(async (id: string) => {
      delete mockDb.workoutSessions[id]
    }),
    clearAllData: vi.fn(async () => {
      mockDb.exercises = {}
      mockDb.routines = {}
      mockDb.workoutSessions = {}
    }),
  },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const INITIAL_EXERCISES = useExercisesStore.getState()
const INITIAL_ROUTINE = useRoutineStore.getState()
const INITIAL_SESSIONS = useWorkoutSessionsStore.getState()

/** Resets all three stores to their empty initial state, like a fresh page load. */
function resetStores() {
  useExercisesStore.setState(INITIAL_EXERCISES, true)
  useRoutineStore.setState(INITIAL_ROUTINE, true)
  useWorkoutSessionsStore.setState(INITIAL_SESSIONS, true)
  useWorkoutSessionsStore.getState().invalidateCache()
}

/** The single routine created by these tests' lazy-create-on-assign flow, if any. */
function firstRoutine(): Routine | undefined {
  return Object.values(mockDb.routines)[0]
}

/** Simulate closing and reopening the app: clear in-memory state and load all data from storage. */
async function simulateAppReload() {
  resetStores()
  await useExercisesStore.getState().loadExercises()
  await useRoutineStore.getState().loadRoutines()
  await useWorkoutSessionsStore.getState().loadSessions()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('E2E: Data Persistence Across App Reload', () => {
  beforeEach(() => {
    mockDb.exercises = {}
    mockDb.routines = {}
    mockDb.workoutSessions = {}
    vi.clearAllMocks()
    resetStores()
  })

  describe('Exercises persist to storage', () => {
    it('saves an exercise to storage when created', async () => {
      await useExercisesStore.getState().createExercise('Bench Press', 3, 10, ['Chest', 'Triceps'])

      const stored = Object.values(mockDb.exercises)
      expect(stored).toHaveLength(1)
      expect(stored[0]).toMatchObject({ name: 'Bench Press', targetSets: 3, targetReps: 10 })
      expect(stored[0]!.targetMuscleGroups).toEqual(['Chest', 'Triceps'])
    })

    it('persists all exercises created in a session', async () => {
      const { createExercise } = useExercisesStore.getState()
      await createExercise('Bench Press', 3, 10, ['Chest', 'Triceps'])
      await createExercise('Squat', 4, 8, ['Legs', 'Glutes'])
      await createExercise('Deadlift', 3, 5, ['Back', 'Legs'])

      expect(Object.values(mockDb.exercises)).toHaveLength(3)
    })

    it('persists exercise updates to storage', async () => {
      const { createExercise, updateExercise } = useExercisesStore.getState()
      const exercise = await createExercise('Bench Press', 3, 10, ['Chest'])
      await updateExercise(exercise.id, { name: 'Incline Bench Press', targetSets: 4 })

      expect(mockDb.exercises[exercise.id]).toMatchObject({ name: 'Incline Bench Press', targetSets: 4 })
    })

    it('removes exercise from storage on delete', async () => {
      const { createExercise, deleteExercise } = useExercisesStore.getState()
      const exercise = await createExercise('Bench Press', 3, 10, ['Chest'])
      expect(Object.keys(mockDb.exercises)).toHaveLength(1)

      await deleteExercise(exercise.id)
      expect(Object.keys(mockDb.exercises)).toHaveLength(0)
    })
  })

  describe('Weekly routine assignments persist to storage', () => {
    it('saves routine to storage when an exercise is assigned to a day', async () => {
      const exercise = await useExercisesStore.getState().createExercise('Squat', 3, 8, ['Legs'])
      await useRoutineStore.getState().assignExercise('monday', exercise.id)

      expect(firstRoutine()!.weeklyAssignments.monday).toContain(exercise.id)
    })

    it('persists assignments for all 7 days to storage', async () => {
      const { createExercise } = useExercisesStore.getState()
      const { assignExercise } = useRoutineStore.getState()
      const exercises = await Promise.all([
        createExercise('Bench Press', 3, 10, ['Chest']),
        createExercise('Squat', 4, 8, ['Legs']),
        createExercise('Deadlift', 3, 5, ['Back']),
        createExercise('OHP', 3, 8, ['Shoulders']),
        createExercise('Pull-up', 3, 10, ['Back']),
        createExercise('Row', 3, 12, ['Back']),
        createExercise('Plank', 3, 60, ['Core']),
      ])

      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      for (let i = 0; i < days.length; i++) {
        await assignExercise(days[i]!, exercises[i]!.id)
      }

      for (let i = 0; i < days.length; i++) {
        expect(firstRoutine()!.weeklyAssignments[days[i]!]).toContain(exercises[i]!.id)
      }
    })
  })

  describe('Workout session data persists to storage', () => {
    it('saves a workout session to storage when created', async () => {
      const session = await useWorkoutSessionsStore.getState().createSession('2025-01-06')
      expect(mockDb.workoutSessions[session.id]).toMatchObject({ date: '2025-01-06' })
    })

    it('persists performance data to storage after logging', async () => {
      const exercise = await useExercisesStore.getState().createExercise('Bench Press', 3, 10, ['Chest'])
      const { createSession, logPerformance } = useWorkoutSessionsStore.getState()
      const session = await createSession('2025-01-06')
      await logPerformance(session.id, exercise.id, {
        completed: true,
        actualSets: 3,
        actualReps: 10,
        weight: 80,
        difficultyLevel: 'moderate',
      })

      const stored = mockDb.workoutSessions[session.id]!
      expect(stored.exercises).toHaveLength(1)
      expect(stored.exercises[0]).toMatchObject({
        exerciseId: exercise.id,
        completed: true,
        actualSets: 3,
        actualReps: 10,
        weight: 80,
        difficultyLevel: 'moderate',
      })
    })
  })

  describe('All previously saved data loads after app reload', () => {
    it('reloads exercises after app restart', async () => {
      const created = await useExercisesStore.getState().createExercise('Bench Press', 3, 10, ['Chest', 'Triceps'])

      await simulateAppReload()

      expect(useExercisesStore.getState().exercises).toHaveLength(1)
      const restored = useExercisesStore.getState().exerciseById(created.id)
      expect(restored).toMatchObject({ name: 'Bench Press', targetSets: 3, targetReps: 10 })
    })

    it('reloads routine assignments after app restart', async () => {
      const exercise = await useExercisesStore.getState().createExercise('Squat', 4, 8, ['Legs'])
      const { assignExercise } = useRoutineStore.getState()
      await assignExercise('monday', exercise.id)
      await assignExercise('wednesday', exercise.id)
      await assignExercise('friday', exercise.id)

      await simulateAppReload()

      const { routineForDay } = useRoutineStore.getState()
      expect(routineForDay('monday')).toContain(exercise.id)
      expect(routineForDay('wednesday')).toContain(exercise.id)
      expect(routineForDay('friday')).toContain(exercise.id)
      expect(routineForDay('tuesday')).toHaveLength(0)
    })

    it('reloads workout sessions after app restart', async () => {
      const exercise = await useExercisesStore.getState().createExercise('Deadlift', 3, 5, ['Back'])
      const { createSession, logPerformance } = useWorkoutSessionsStore.getState()
      const session = await createSession('2025-01-08')
      await logPerformance(session.id, exercise.id, {
        completed: true,
        actualSets: 3,
        actualReps: 5,
        weight: 140,
        difficultyLevel: 'hard',
      })

      await simulateAppReload()

      const restored = useWorkoutSessionsStore.getState().sessionByDate('2025-01-08')
      expect(restored!.id).toBe(session.id)
      expect(restored!.exercises[0]).toMatchObject({
        exerciseId: exercise.id,
        completed: true,
        actualSets: 3,
        actualReps: 5,
        weight: 140,
        difficultyLevel: 'hard',
      })
    })

    it('reloads all data types simultaneously after app restart', async () => {
      const { createExercise } = useExercisesStore.getState()
      const { assignExercise } = useRoutineStore.getState()
      const { createSession, logPerformance } = useWorkoutSessionsStore.getState()

      const bench = await createExercise('Bench Press', 3, 10, ['Chest', 'Triceps'])
      const squat = await createExercise('Squat', 4, 8, ['Legs', 'Glutes'])
      const deadlift = await createExercise('Deadlift', 3, 5, ['Back', 'Legs'])

      await assignExercise('monday', bench.id)
      await assignExercise('monday', squat.id)
      await assignExercise('wednesday', deadlift.id)
      await assignExercise('friday', bench.id)
      await assignExercise('friday', squat.id)
      await assignExercise('friday', deadlift.id)

      const mondaySession = await createSession('2025-01-06')
      await logPerformance(mondaySession.id, bench.id, {
        completed: true,
        actualSets: 3,
        actualReps: 10,
        weight: 80,
        difficultyLevel: 'moderate',
      })
      await logPerformance(mondaySession.id, squat.id, {
        completed: true,
        actualSets: 4,
        actualReps: 8,
        weight: 100,
        difficultyLevel: 'hard',
      })

      const wednesdaySession = await createSession('2025-01-08')
      await logPerformance(wednesdaySession.id, deadlift.id, {
        completed: true,
        actualSets: 3,
        actualReps: 5,
        weight: 140,
        difficultyLevel: 'hard',
      })

      await simulateAppReload()

      expect(useExercisesStore.getState().exercises).toHaveLength(3)

      const { routineForDay } = useRoutineStore.getState()
      expect(routineForDay('monday')).toEqual(expect.arrayContaining([bench.id, squat.id]))
      expect(routineForDay('wednesday')).toContain(deadlift.id)
      expect(routineForDay('friday')).toEqual(expect.arrayContaining([bench.id, squat.id, deadlift.id]))
      expect(routineForDay('tuesday')).toHaveLength(0)

      const restoredMonday = useWorkoutSessionsStore.getState().sessionByDate('2025-01-06')!
      expect(restoredMonday.exercises).toHaveLength(2)
      const restoredWednesday = useWorkoutSessionsStore.getState().sessionByDate('2025-01-08')!
      expect(restoredWednesday.exercises).toHaveLength(1)
    })

    it('preserves exercise IDs across reload (ids used in routine and sessions remain valid)', async () => {
      const exercise = await useExercisesStore.getState().createExercise('Pull-up', 3, 10, ['Back', 'Biceps'])
      await useRoutineStore.getState().assignExercise('tuesday', exercise.id)
      const { createSession, logPerformance } = useWorkoutSessionsStore.getState()
      const session = await createSession('2025-01-07')
      await logPerformance(session.id, exercise.id, {
        completed: true,
        actualSets: 3,
        actualReps: 10,
        difficultyLevel: 'moderate',
      })

      await simulateAppReload()

      expect(useExercisesStore.getState().exerciseById(exercise.id)?.id).toBe(exercise.id)
      expect(useRoutineStore.getState().routineForDay('tuesday')).toContain(exercise.id)
      expect(useWorkoutSessionsStore.getState().sessionByDate('2025-01-07')!.exercises[0]!.exerciseId).toBe(
        exercise.id
      )
    })

    it('preserves a bodyweight exercise (no weight logged) across reload', async () => {
      const exercise = await useExercisesStore.getState().createExercise('Plank', 3, 60, ['Core'])
      const { createSession, logPerformance } = useWorkoutSessionsStore.getState()
      const session = await createSession('2025-01-09')
      await logPerformance(session.id, exercise.id, {
        completed: true,
        actualSets: 3,
        actualReps: 60,
        difficultyLevel: 'easy',
      })

      await simulateAppReload()

      const perf = useWorkoutSessionsStore
        .getState()
        .sessionByDate('2025-01-09')!
        .exercises.find((e) => e.exerciseId === exercise.id)!
      expect(perf.weight).toBeUndefined()
      expect(perf.actualReps).toBe(60)
    })

    it('reloads multiple sessions across different dates', async () => {
      const exercise = await useExercisesStore.getState().createExercise('Bench Press', 3, 10, ['Chest'])
      const { createSession, logPerformance } = useWorkoutSessionsStore.getState()
      const dates = ['2025-02-03', '2025-02-05', '2025-02-07']
      const weights = [75, 77.5, 80]

      for (let i = 0; i < dates.length; i++) {
        const session = await createSession(dates[i]!)
        await logPerformance(session.id, exercise.id, {
          completed: true,
          actualSets: 3,
          actualReps: 10,
          weight: weights[i],
          difficultyLevel: 'moderate',
        })
      }

      await simulateAppReload()

      expect(useWorkoutSessionsStore.getState().sessions).toHaveLength(3)
      for (let i = 0; i < dates.length; i++) {
        const perf = useWorkoutSessionsStore
          .getState()
          .sessionByDate(dates[i]!)!
          .exercises.find((e) => e.exerciseId === exercise.id)!
        expect(perf.weight).toBe(weights[i])
      }
    })

    it('leaves empty state empty after reload when no data was created', async () => {
      await simulateAppReload()

      expect(useExercisesStore.getState().exercises).toHaveLength(0)
      expect(useWorkoutSessionsStore.getState().sessions).toHaveLength(0)
      const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      for (const day of allDays) {
        expect(useRoutineStore.getState().routineForDay(day)).toHaveLength(0)
      }
    })
  })
})
