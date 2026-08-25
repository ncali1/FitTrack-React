/**
 * Property: Performance Data Prompt on Completion
 *
 * When an exercise is marked as complete, the system must capture and persist
 * performance data (sets, reps, weight, difficulty). For any valid combination of
 * performance inputs, the stored data must exactly match what was submitted.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useWorkoutSessionsStore } from './workoutSessions'
import { useExercisesStore } from './exercises'
import type { DifficultyLevel } from '@/types'

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
const INITIAL_SESSIONS = useWorkoutSessionsStore.getState()

interface PerformanceInput {
  actualSets: number
  actualReps: number
  weight?: number
  difficultyLevel: DifficultyLevel
}

/** Generates a wide range of valid performance inputs to exercise the property broadly. */
function generatePerformanceInputs(): PerformanceInput[] {
  const difficulties: DifficultyLevel[] = ['easy', 'moderate', 'hard']
  const inputs: PerformanceInput[] = []

  for (const sets of [1, 2, 3, 5, 10]) {
    for (const reps of [1, 5, 8, 10, 15, 20]) {
      for (const difficulty of difficulties) {
        inputs.push({ actualSets: sets, actualReps: reps, difficultyLevel: difficulty })
        inputs.push({ actualSets: sets, actualReps: reps, weight: sets * 10, difficultyLevel: difficulty })
      }
    }
  }
  return inputs
}

describe('Property: Performance Data Prompt on Completion', () => {
  beforeEach(() => {
    useExercisesStore.setState(INITIAL_EXERCISES, true)
    useWorkoutSessionsStore.setState(INITIAL_SESSIONS, true)
    useWorkoutSessionsStore.getState().invalidateCache()
  })

  it('stores exactly the submitted performance data for any valid input', async () => {
    const exercise = await useExercisesStore.getState().createExercise('Test Exercise', 3, 10, ['Chest'])
    const { createSession, logPerformance } = useWorkoutSessionsStore.getState()
    const inputs = generatePerformanceInputs()

    for (const [i, input] of inputs.entries()) {
      const session = await createSession(`session-${i}`)
      await logPerformance(session.id, exercise.id, { completed: true, ...input })

      const stored = useWorkoutSessionsStore
        .getState()
        .sessions.find((s) => s.id === session.id)
        ?.exercises.find((e) => e.exerciseId === exercise.id)

      expect(stored).toBeDefined()
      expect(stored?.completed).toBe(true)
      expect(stored?.actualSets).toBe(input.actualSets)
      expect(stored?.actualReps).toBe(input.actualReps)
      expect(stored?.difficultyLevel).toBe(input.difficultyLevel)
      if (input.weight !== undefined) {
        expect(stored?.weight).toBe(input.weight)
      }
      expect(stored?.timestamp).toBeGreaterThan(0)
    }
  })

  it('always records a timestamp within the call window when performance is logged', async () => {
    const exercise = await useExercisesStore.getState().createExercise('Timed Exercise', 3, 10, ['Legs'])
    const { createSession, logPerformance } = useWorkoutSessionsStore.getState()
    const difficulties: DifficultyLevel[] = ['easy', 'moderate', 'hard']

    for (const [i, difficulty] of difficulties.entries()) {
      const session = await createSession(`timed-${i}`)
      const before = Date.now()

      await logPerformance(session.id, exercise.id, {
        completed: true,
        actualSets: 3,
        actualReps: 10,
        difficultyLevel: difficulty,
      })

      const after = Date.now()
      const stored = useWorkoutSessionsStore
        .getState()
        .sessions.find((s) => s.id === session.id)
        ?.exercises.find((e) => e.exerciseId === exercise.id)

      expect(stored?.timestamp).toBeGreaterThanOrEqual(before)
      expect(stored?.timestamp).toBeLessThanOrEqual(after)
    }
  })

  it('overwrites (never duplicates) previous performance when re-logging the same exercise', async () => {
    const exercise = await useExercisesStore.getState().createExercise('Overwrite Exercise', 3, 10, ['Back'])
    const { createSession, logPerformance } = useWorkoutSessionsStore.getState()
    const session = await createSession('overwrite-session')

    const firstInputs: PerformanceInput[] = [
      { actualSets: 2, actualReps: 8, difficultyLevel: 'easy' },
      { actualSets: 3, actualReps: 10, difficultyLevel: 'moderate' },
      { actualSets: 4, actualReps: 12, difficultyLevel: 'hard' },
    ]
    const secondInputs: PerformanceInput[] = [
      { actualSets: 5, actualReps: 15, difficultyLevel: 'hard' },
      { actualSets: 1, actualReps: 5, difficultyLevel: 'easy' },
      { actualSets: 3, actualReps: 8, weight: 50, difficultyLevel: 'moderate' },
    ]

    for (let i = 0; i < firstInputs.length; i++) {
      await logPerformance(session.id, exercise.id, { completed: true, ...firstInputs[i]! })
      await logPerformance(session.id, exercise.id, { completed: true, ...secondInputs[i]! })

      const stored = useWorkoutSessionsStore
        .getState()
        .sessions.find((s) => s.id === session.id)
        ?.exercises.filter((e) => e.exerciseId === exercise.id)

      expect(stored).toHaveLength(1)
      expect(stored![0]).toMatchObject(secondInputs[i]!)
    }
  })

  it('handles multiple exercises in the same session independently', async () => {
    const { createExercise } = useExercisesStore.getState()
    const exercises = await Promise.all([
      createExercise('Exercise A', 3, 10, ['Chest']),
      createExercise('Exercise B', 4, 8, ['Back']),
      createExercise('Exercise C', 3, 12, ['Legs']),
    ])

    const { createSession, logPerformance } = useWorkoutSessionsStore.getState()
    const session = await createSession('multi-exercise-session')

    const performances: PerformanceInput[] = [
      { actualSets: 3, actualReps: 10, difficultyLevel: 'easy' },
      { actualSets: 4, actualReps: 8, weight: 60, difficultyLevel: 'hard' },
      { actualSets: 3, actualReps: 12, difficultyLevel: 'moderate' },
    ]

    for (let i = 0; i < exercises.length; i++) {
      await logPerformance(session.id, exercises[i]!.id, { completed: true, ...performances[i]! })
    }

    const stored = useWorkoutSessionsStore.getState().sessions.find((s) => s.id === session.id)
    expect(stored?.exercises).toHaveLength(exercises.length)

    for (let i = 0; i < exercises.length; i++) {
      const perf = stored?.exercises.find((e) => e.exerciseId === exercises[i]!.id)
      expect(perf).toMatchObject(performances[i]!)
    }
  })
})
