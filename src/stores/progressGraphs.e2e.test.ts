/**
 * End-to-End: Progress Graphs full workflow
 *
 * Exercises the store's full path — exercises → routine → sessions →
 * getCachedProgressData — with a realistic 12-week progressive-overload history,
 * plus the UI store's selected-exercise/time-range state that ProgressGraphs.tsx reads.
 * The per-week aggregation math itself is already covered exhaustively by
 * utils/calculations.test.ts's aggregateProgressData suite — this file focuses on what
 * that doesn't: a real multi-week history flowing through the actual store, and
 * switching exercise/time-range via the UI store the component actually uses.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useExercisesStore } from './exercises'
import { useRoutineStore } from './routine'
import { useWorkoutSessionsStore } from './workoutSessions'
import { useUIStore } from './ui'
import { addDays } from '@/utils/calculations'

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
const INITIAL_UI = useUIStore.getState()

const WEEK1 = '2025-01-06' // Monday
const TWELVE_WEEKS_END = addDays(WEEK1, 11 * 7) // Monday of the 12th week

describe('E2E: Progress Graphs full workflow', () => {
  beforeEach(() => {
    useExercisesStore.setState(INITIAL_EXERCISES, true)
    useRoutineStore.setState(INITIAL_ROUTINE, true)
    useWorkoutSessionsStore.setState(INITIAL_SESSIONS, true)
    useUIStore.setState(INITIAL_UI, true)
    useWorkoutSessionsStore.getState().invalidateCache()
  })

  it('reflects 12 weeks of progressive overload for Bench Press', async () => {
    const bench = await useExercisesStore.getState().createExercise('Bench Press', 3, 10, ['Chest'])
    await useRoutineStore.getState().assignExercise('monday', bench.id)

    const { createSession, logPerformance } = useWorkoutSessionsStore.getState()
    for (let week = 0; week < 12; week++) {
      const date = addDays(WEEK1, week * 7)
      const session = await createSession(date)
      await logPerformance(session.id, bench.id, {
        completed: true,
        actualSets: 3,
        actualReps: 8 + week, // 8 -> 19 reps across the program
        weight: 60 + week * 2.5, // 60 -> 87.5 kg across the program
      })
    }

    const routine = useRoutineStore.getState().activeRoutine()!
    const progress = useWorkoutSessionsStore
      .getState()
      .getCachedProgressData(bench.id, 'Bench Press', WEEK1, TWELVE_WEEKS_END, routine)

    expect(progress.weeklyData).toHaveLength(12)
    expect(progress.weeklyData[0]!.averageReps).toBe(8)
    expect(progress.weeklyData[11]!.averageReps).toBe(19)
    expect(progress.weeklyData[0]!.averageWeight).toBe(60)
    expect(progress.weeklyData[11]!.averageWeight).toBe(87.5)
    // Every week's average is a genuine increase over the last — a real upward trend,
    // not just first-vs-last
    for (let i = 1; i < progress.weeklyData.length; i++) {
      expect(progress.weeklyData[i]!.averageWeight).toBeGreaterThan(progress.weeklyData[i - 1]!.averageWeight!)
    }
  })

  it('keeps progress data scoped to the selected exercise, not mixed with others', async () => {
    const { createExercise } = useExercisesStore.getState()
    const bench = await createExercise('Bench Press', 3, 10, ['Chest'])
    const squat = await createExercise('Squat', 4, 8, ['Legs'])
    const { assignExercise } = useRoutineStore.getState()
    await assignExercise('monday', bench.id)
    await assignExercise('tuesday', squat.id)

    const { createSession, logPerformance } = useWorkoutSessionsStore.getState()
    const benchSession = await createSession(WEEK1)
    await logPerformance(benchSession.id, bench.id, { completed: true, actualReps: 10, weight: 80 })
    const squatSession = await createSession(addDays(WEEK1, 1))
    await logPerformance(squatSession.id, squat.id, { completed: true, actualReps: 8, weight: 100 })

    const routine = useRoutineStore.getState().activeRoutine()!
    const { getCachedProgressData } = useWorkoutSessionsStore.getState()
    const benchProgress = getCachedProgressData(bench.id, 'Bench Press', WEEK1, WEEK1, routine)
    const squatProgress = getCachedProgressData(squat.id, 'Squat', WEEK1, WEEK1, routine)

    expect(benchProgress.weeklyData[0]!.averageWeight).toBe(80)
    expect(squatProgress.weeklyData[0]!.averageWeight).toBe(100)
  })

  it('reflects the exercise selected via the UI store', async () => {
    const bench = await useExercisesStore.getState().createExercise('Bench Press', 3, 10, ['Chest'])

    expect(useUIStore.getState().selectedExercise).toBeNull()
    useUIStore.getState().setSelectedExercise(bench.id)
    expect(useUIStore.getState().selectedExercise).toBe(bench.id)
  })

  it('filters correctly for a 4-week range carved out of a longer history', async () => {
    const bench = await useExercisesStore.getState().createExercise('Bench Press', 3, 10, ['Chest'])
    await useRoutineStore.getState().assignExercise('monday', bench.id)

    const { createSession, logPerformance } = useWorkoutSessionsStore.getState()
    for (let week = 0; week < 12; week++) {
      const session = await createSession(addDays(WEEK1, week * 7))
      await logPerformance(session.id, bench.id, { completed: true, actualReps: 10, weight: 60 + week })
    }

    const routine = useRoutineStore.getState().activeRoutine()!
    const fourWeekEnd = addDays(WEEK1, 3 * 7)
    const progress = useWorkoutSessionsStore
      .getState()
      .getCachedProgressData(bench.id, 'Bench Press', WEEK1, fourWeekEnd, routine)

    expect(progress.weeklyData).toHaveLength(4)
    // Only the first 4 weeks' worth of weight (60, 61, 62, 63), not weeks 5-12
    expect(progress.weeklyData.map((w) => w.averageWeight)).toEqual([60, 61, 62, 63])
  })

  it('updates the UI store time range and the resulting query picks it up', async () => {
    const bench = await useExercisesStore.getState().createExercise('Bench Press', 3, 10, ['Chest'])
    await useRoutineStore.getState().assignExercise('monday', bench.id)
    const { createSession, logPerformance } = useWorkoutSessionsStore.getState()
    const session = await createSession(WEEK1)
    await logPerformance(session.id, bench.id, { completed: true, actualReps: 10, weight: 60 })

    useUIStore.getState().setTimeRange(WEEK1, WEEK1)
    expect(useUIStore.getState().timeRange).toEqual({ start: WEEK1, end: WEEK1 })

    const routine = useRoutineStore.getState().activeRoutine()!
    const { start, end } = useUIStore.getState().timeRange
    const progress = useWorkoutSessionsStore.getState().getCachedProgressData(bench.id, 'Bench Press', start, end, routine)
    expect(progress.weeklyData).toHaveLength(1)
    expect(progress.weeklyData[0]!.averageWeight).toBe(60)
  })
})
