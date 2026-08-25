/**
 * Unit tests for the pure calculation functions: weekly summary, progress-data
 * aggregation, exercise history, and daily-checklist merging.
 */
import { describe, it, expect } from 'vitest'
import {
  getWeekStart,
  addDays,
  calculateWeeklySummary,
  getWeeksInRange,
  aggregateProgressData,
  getExerciseHistory,
  getDayOfWeek,
  getExercisesForDate,
  mergeRoutineWithSession,
} from './calculations'
import { createMockRoutine, createMockWorkoutSession, createMockExercise } from '@/tests/factories'
import type { Routine, WorkoutSession } from '@/types'

const MONDAY = '2025-01-06'

function routineWith(weeklyAssignments: Record<string, string[]>): Routine {
  return createMockRoutine({ weeklyAssignments: { ...createMockRoutine().weeklyAssignments, ...weeklyAssignments } })
}

function sessionWith(date: string, exercises: WorkoutSession['exercises']): WorkoutSession {
  return createMockWorkoutSession({ date, exercises })
}

describe('date helpers', () => {
  it('getWeekStart returns the Monday of the containing week', () => {
    expect(getWeekStart(MONDAY)).toBe(MONDAY)
    expect(getWeekStart('2025-01-08')).toBe(MONDAY) // Wednesday -> Monday
    expect(getWeekStart('2025-01-12')).toBe(MONDAY) // Sunday -> preceding Monday
  })

  it('addDays adds (or subtracts) days across month boundaries', () => {
    expect(addDays('2025-01-30', 3)).toBe('2025-02-02')
    expect(addDays('2025-01-06', -1)).toBe('2025-01-05')
  })

  it('getDayOfWeek returns the lowercase day name', () => {
    expect(getDayOfWeek(MONDAY)).toBe('monday')
    expect(getDayOfWeek('2025-01-12')).toBe('sunday')
  })
})

describe('calculateWeeklySummary', () => {
  it('counts all exercises assigned across the week', () => {
    const routine = routineWith({ monday: ['ex1'], wednesday: ['ex2'], friday: ['ex3'] })
    const result = calculateWeeklySummary(MONDAY, routine, [])
    expect(result.totalAssignedWorkouts).toBe(3)
  })

  it('returns 0 assigned when routine is empty', () => {
    const result = calculateWeeklySummary(MONDAY, routineWith({}), [])
    expect(result.totalAssignedWorkouts).toBe(0)
  })

  it('counts only completed exercises as completed', () => {
    const routine = routineWith({ monday: ['ex1', 'ex2'] })
    const session = sessionWith(MONDAY, [
      { exerciseId: 'ex1', completed: true, timestamp: 1 },
      { exerciseId: 'ex2', completed: false, timestamp: 2 },
    ])
    const result = calculateWeeklySummary(MONDAY, routine, [session])
    expect(result.totalCompletedWorkouts).toBe(1)
  })

  it('counts completions across multiple days', () => {
    const routine = routineWith({ monday: ['ex1'], wednesday: ['ex2'], friday: ['ex3'] })
    const sessions = [
      sessionWith('2025-01-06', [{ exerciseId: 'ex1', completed: true, timestamp: 1 }]),
      sessionWith('2025-01-08', [{ exerciseId: 'ex2', completed: true, timestamp: 2 }]),
      // Friday not completed
    ]
    const result = calculateWeeklySummary(MONDAY, routine, sessions)
    expect(result.totalCompletedWorkouts).toBe(2)
  })

  it('calculates completion percentage as round(completed / assigned * 100)', () => {
    const routine = routineWith({ monday: ['ex1'], tuesday: ['ex2'], wednesday: ['ex3'], thursday: ['ex4'] })
    const sessions = [
      sessionWith('2025-01-06', [{ exerciseId: 'ex1', completed: true, timestamp: 1 }]),
      sessionWith('2025-01-07', [{ exerciseId: 'ex2', completed: true, timestamp: 2 }]),
      sessionWith('2025-01-08', [{ exerciseId: 'ex3', completed: true, timestamp: 3 }]),
    ]
    expect(calculateWeeklySummary(MONDAY, routine, sessions).completionPercentage).toBe(75)
  })

  it('returns 0% when nothing is assigned', () => {
    expect(calculateWeeklySummary(MONDAY, routineWith({}), []).completionPercentage).toBe(0)
  })

  it('returns 100% when everything assigned is completed', () => {
    const routine = routineWith({ monday: ['ex1'] })
    const session = sessionWith(MONDAY, [{ exerciseId: 'ex1', completed: true, timestamp: 1 }])
    expect(calculateWeeklySummary(MONDAY, routine, [session]).completionPercentage).toBe(100)
  })

  it('rounds the completion percentage to the nearest integer', () => {
    const routine = routineWith({ monday: ['ex1', 'ex2', 'ex3'] })
    const session = sessionWith(MONDAY, [{ exerciseId: 'ex1', completed: true, timestamp: 1 }])
    // 1/3 = 33.33...
    expect(calculateWeeklySummary(MONDAY, routine, [session]).completionPercentage).toBe(33)
  })

  it('includes all 7 days in the daily breakdown, even with nothing assigned', () => {
    const result = calculateWeeklySummary(MONDAY, routineWith({}), [])
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    for (const day of days) {
      expect(result.dailyBreakdown[day]).toEqual({ assigned: 0, completed: 0 })
    }
  })

  it('reports assigned/completed counts per day independently', () => {
    const routine = routineWith({ monday: ['ex1', 'ex2'] })
    const session = sessionWith(MONDAY, [{ exerciseId: 'ex1', completed: true, timestamp: 1 }])
    const result = calculateWeeklySummary(MONDAY, routine, [session])
    expect(result.dailyBreakdown.monday).toEqual({ assigned: 2, completed: 1 })
    expect(result.dailyBreakdown.tuesday).toEqual({ assigned: 0, completed: 0 })
  })
})

describe('getWeeksInRange', () => {
  it('generates weekly Monday buckets across a 4-week range', () => {
    const weeks = getWeeksInRange('2025-01-06', '2025-02-02')
    expect(weeks).toEqual(['2025-01-06', '2025-01-13', '2025-01-20', '2025-01-27'])
  })

  it('handles a single-week range', () => {
    expect(getWeeksInRange('2025-01-06', '2025-01-10')).toEqual(['2025-01-06'])
  })

  it('aligns the start date to the Monday of its containing week', () => {
    // 2025-01-08 is a Wednesday, so the first bucket is the preceding Monday. The end
    // date falls exactly on the *next* Monday too, so that week is legitimately included.
    expect(getWeeksInRange('2025-01-08', '2025-01-14')).toEqual(['2025-01-06', '2025-01-13'])
  })
})

describe('aggregateProgressData', () => {
  const routine = routineWith({ monday: ['ex1'] })

  it('calculates average reps for a week with one performance', () => {
    const session = sessionWith('2025-01-07', [{ exerciseId: 'ex1', completed: true, actualReps: 12, timestamp: 1 }])
    const result = aggregateProgressData('ex1', 'Squat', MONDAY, MONDAY, [session], routine)
    expect(result.weeklyData[0]!.averageReps).toBe(12)
  })

  it('averages reps across multiple completed performances in the same week', () => {
    const sessions = [
      sessionWith('2025-01-06', [{ exerciseId: 'ex1', completed: true, actualReps: 10, timestamp: 1 }]),
      sessionWith('2025-01-08', [{ exerciseId: 'ex1', completed: true, actualReps: 14, timestamp: 2 }]),
    ]
    const result = aggregateProgressData('ex1', 'Squat', MONDAY, MONDAY, sessions, routine)
    expect(result.weeklyData[0]!.averageReps).toBe(12)
  })

  it('only counts completed performances', () => {
    const sessions = [
      sessionWith('2025-01-06', [{ exerciseId: 'ex1', completed: true, actualReps: 10, timestamp: 1 }]),
      sessionWith('2025-01-07', [{ exerciseId: 'ex1', completed: false, actualReps: 20, timestamp: 2 }]),
    ]
    const result = aggregateProgressData('ex1', 'Squat', MONDAY, MONDAY, sessions, routine)
    expect(result.weeklyData[0]!.averageReps).toBe(10)
  })

  it('returns 0 average weight/reps for a week with no data, without throwing', () => {
    const result = aggregateProgressData('ex1', 'Squat', MONDAY, MONDAY, [], routine)
    expect(result.weeklyData[0]!.averageReps).toBe(0)
    expect(result.weeklyData[0]!.averageWeight).toBe(0)
  })

  it('excludes performances outside the requested time range', () => {
    const outOfRangeWeek = '2025-01-13'
    const sessions = [sessionWith('2025-01-06', [{ exerciseId: 'ex1', completed: true, actualReps: 99, timestamp: 1 }])]
    const result = aggregateProgressData('ex1', 'Squat', outOfRangeWeek, outOfRangeWeek, sessions, routine)
    expect(result.weeklyData[0]!.averageReps).toBe(0)
  })

  it('averages weight only across performances that logged a weight', () => {
    const sessions = [
      sessionWith('2025-01-06', [{ exerciseId: 'ex1', completed: true, weight: 50, timestamp: 1 }]),
      sessionWith('2025-01-07', [{ exerciseId: 'ex1', completed: true, actualReps: 8, timestamp: 2 }]), // no weight
    ]
    const result = aggregateProgressData('ex1', 'Squat', MONDAY, MONDAY, sessions, routine)
    expect(result.weeklyData[0]!.averageWeight).toBe(50)
  })

  it('counts totalAssigned as the number of days per week the exercise is scheduled', () => {
    const multiDayRoutine = routineWith({ monday: ['ex1'], wednesday: ['ex1'], friday: ['ex1'] })
    const result = aggregateProgressData('ex1', 'Squat', MONDAY, MONDAY, [], multiDayRoutine)
    expect(result.weeklyData[0]!.totalAssigned).toBe(3)
  })
})

describe('getExerciseHistory', () => {
  it('returns an empty array when no session logged the exercise', () => {
    const session = sessionWith('2025-01-06', [{ exerciseId: 'other', completed: true, timestamp: 1 }])
    expect(getExerciseHistory('ex1', [session])).toEqual([])
  })

  it('returns one entry per session that logged the exercise, newest first', () => {
    const sessions = [
      sessionWith('2025-01-06', [{ exerciseId: 'ex1', completed: true, timestamp: 1 }]),
      sessionWith('2025-01-20', [{ exerciseId: 'ex1', completed: true, timestamp: 2 }]),
      sessionWith('2025-01-13', [{ exerciseId: 'ex1', completed: true, timestamp: 3 }]),
    ]
    const history = getExerciseHistory('ex1', sessions)
    expect(history.map((h) => h.date)).toEqual(['2025-01-20', '2025-01-13', '2025-01-06'])
  })

  it('ignores other exercises logged in the same session', () => {
    const session = sessionWith('2025-01-06', [
      { exerciseId: 'ex1', completed: true, actualReps: 10, timestamp: 1 },
      { exerciseId: 'ex2', completed: true, actualReps: 20, timestamp: 2 },
    ])
    const history = getExerciseHistory('ex1', [session])
    expect(history).toHaveLength(1)
    expect(history[0]!.actualReps).toBe(10)
  })
})

describe('getExercisesForDate / mergeRoutineWithSession', () => {
  it('returns the exercise IDs assigned to the day of week for a date', () => {
    const routine = routineWith({ monday: ['ex1', 'ex2'] })
    expect(getExercisesForDate(MONDAY, routine)).toEqual(['ex1', 'ex2'])
  })

  it('merges routine assignments with session performance data', () => {
    const exercise = createMockExercise({ id: 'ex1', name: 'Bench Press' })
    const routine = routineWith({ monday: ['ex1'] })
    const session = sessionWith(MONDAY, [{ exerciseId: 'ex1', completed: true, actualReps: 10, timestamp: 1 }])

    const merged = mergeRoutineWithSession(MONDAY, routine, [session], [exercise])
    expect(merged).toHaveLength(1)
    expect(merged[0]!.exercise.name).toBe('Bench Press')
    expect(merged[0]!.completed).toBe(true)
    expect(merged[0]!.performance?.actualReps).toBe(10)
  })

  it('marks an exercise incomplete when no session exists for the date', () => {
    const exercise = createMockExercise({ id: 'ex1' })
    const routine = routineWith({ monday: ['ex1'] })
    const merged = mergeRoutineWithSession(MONDAY, routine, [], [exercise])
    expect(merged[0]!.completed).toBe(false)
    expect(merged[0]!.performance).toBeUndefined()
  })

  it('silently skips an assigned exercise ID that no longer exists in the library', () => {
    const routine = routineWith({ monday: ['deleted-exercise-id'] })
    const merged = mergeRoutineWithSession(MONDAY, routine, [], [])
    expect(merged).toEqual([])
  })
})
