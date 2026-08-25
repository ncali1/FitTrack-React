/**
 * End-to-End: View Weekly Summary
 *
 * Exercises the store's full path — exercises → routine → sessions →
 * getCachedWeeklySummary — with a realistic full week, rather than the isolated
 * `calculateWeeklySummary` unit tests in utils/calculations.test.ts. Focuses on what
 * those unit tests don't cover: retrieving *independent* summaries for different weeks
 * (i.e. the store's per-week-start cache) without sessions from one week leaking into
 * another's calculation.
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

const WEEK_START = '2025-01-06'
const WEEK_DATES: Record<string, string> = {
  monday: '2025-01-06',
  tuesday: '2025-01-07',
  wednesday: '2025-01-08',
  thursday: '2025-01-09',
  friday: '2025-01-10',
  saturday: '2025-01-11',
  sunday: '2025-01-12',
}
const PREV_WEEK_START = '2024-12-30'
const DAYS = Object.keys(WEEK_DATES)

describe('E2E: View Weekly Summary', () => {
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

  it('produces a correct summary for a fully logged week through the real store path', async () => {
    const { createSession, logPerformance } = useWorkoutSessionsStore.getState()
    for (let i = 0; i < DAYS.length; i++) {
      const session = await createSession(WEEK_DATES[DAYS[i]!]!)
      await logPerformance(session.id, exercises[i]!.id, { completed: true, actualSets: 3, actualReps: 10 })
    }

    const routine = useRoutineStore.getState().activeRoutine()!
    const summary = useWorkoutSessionsStore.getState().getCachedWeeklySummary(WEEK_START, routine)

    expect(summary.totalAssignedWorkouts).toBe(7)
    expect(summary.totalCompletedWorkouts).toBe(7)
    expect(summary.completionPercentage).toBe(100)
  })

  it('produces a correct summary for a partially logged week', async () => {
    const { createSession, logPerformance } = useWorkoutSessionsStore.getState()
    // Only log Monday, Wednesday, Friday (3 of 7)
    for (const day of ['monday', 'wednesday', 'friday']) {
      const i = DAYS.indexOf(day)
      const session = await createSession(WEEK_DATES[day]!)
      await logPerformance(session.id, exercises[i]!.id, { completed: true, actualSets: 3, actualReps: 10 })
    }

    const routine = useRoutineStore.getState().activeRoutine()!
    const summary = useWorkoutSessionsStore.getState().getCachedWeeklySummary(WEEK_START, routine)

    expect(summary.totalCompletedWorkouts).toBe(3)
    expect(summary.completionPercentage).toBe(43) // 3/7 rounded
  })

  it('returns independent, non-leaking summaries for different weeks', async () => {
    const { createSession, logPerformance, getCachedWeeklySummary } = useWorkoutSessionsStore.getState()

    // This week: complete Monday only
    const thisWeekSession = await createSession(WEEK_DATES.monday!)
    await logPerformance(thisWeekSession.id, exercises[0]!.id, { completed: true, actualSets: 3, actualReps: 10 })

    // Previous week: complete Monday AND Tuesday
    const prevMonday = await createSession('2024-12-30')
    await logPerformance(prevMonday.id, exercises[0]!.id, { completed: true, actualSets: 3, actualReps: 10 })
    const prevTuesday = await createSession('2024-12-31')
    await logPerformance(prevTuesday.id, exercises[1]!.id, { completed: true, actualSets: 4, actualReps: 8 })

    const routine = useRoutineStore.getState().activeRoutine()!
    const thisWeek = getCachedWeeklySummary(WEEK_START, routine)
    const prevWeek = getCachedWeeklySummary(PREV_WEEK_START, routine)

    expect(thisWeek.totalCompletedWorkouts).toBe(1)
    expect(prevWeek.totalCompletedWorkouts).toBe(2)
    // Assigned counts come from the (date-agnostic) routine, so both weeks see all 7 assignments
    expect(thisWeek.totalAssignedWorkouts).toBe(7)
    expect(prevWeek.totalAssignedWorkouts).toBe(7)
  })

  it('shows an empty previous week when no sessions were logged for it', () => {
    const routine = useRoutineStore.getState().activeRoutine()!
    const summary = useWorkoutSessionsStore.getState().getCachedWeeklySummary(PREV_WEEK_START, routine)

    expect(summary.totalCompletedWorkouts).toBe(0)
    expect(summary.completionPercentage).toBe(0)
    // Still reports assigned counts — the routine applies to every week, logged or not
    expect(summary.totalAssignedWorkouts).toBe(7)
  })
})
