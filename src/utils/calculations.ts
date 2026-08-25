/**
 * Pure utility functions for fitness tracker business logic and calculations.
 * No store dependencies — all functions take data as parameters.
 */

import type { Routine, WorkoutSession, ExercisePerformance, Exercise, WeeklySummary, ProgressData } from '@/types'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

const DAY_NAMES: Record<number, string> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
}

// ── Date helpers ──────────────────────────────────────────────────────────────

/** Formats a Date as a YYYY-MM-DD string. */
function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Returns the Monday of the week containing the given YYYY-MM-DD date string.
 */
export function getWeekStart(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year!, month! - 1, day!)
  const dow = d.getDay() // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diff)
  return toDateString(d)
}

/** Adds n days to a YYYY-MM-DD date string and returns the result. */
export function addDays(dateStr: string, n: number): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year!, month! - 1, day!)
  d.setDate(d.getDate() + n)
  return toDateString(d)
}

// ── Weekly Summary ──────────────────────────────────────────────────────

/** Calculates the weekly summary for the week starting on weekStartStr (Monday). */
export function calculateWeeklySummary(
  weekStartStr: string,
  routine: Routine,
  sessions: WorkoutSession[]
): WeeklySummary {
  const dailyBreakdown: WeeklySummary['dailyBreakdown'] = {}
  let totalAssigned = 0
  let totalCompleted = 0

  DAYS.forEach((day, i) => {
    const dateStr = addDays(weekStartStr, i)
    const assigned = (routine.weeklyAssignments[day] ?? []).length
    const session = sessions.find((s) => s.date === dateStr)
    const completed = session ? session.exercises.filter((e) => e.completed).length : 0

    dailyBreakdown[day] = { assigned, completed }
    totalAssigned += assigned
    totalCompleted += completed
  })

  const completionPercentage =
    totalAssigned === 0 ? 0 : Math.round((totalCompleted / totalAssigned) * 100)

  const [sy, sm, sd] = weekStartStr.split('-').map(Number)
  const weekEndStr = addDays(weekStartStr, 6)
  const [ey, em, ed] = weekEndStr.split('-').map(Number)

  return {
    weekStartDate: new Date(sy!, sm! - 1, sd!),
    weekEndDate: new Date(ey!, em! - 1, ed!),
    totalAssignedWorkouts: totalAssigned,
    totalCompletedWorkouts: totalCompleted,
    completionPercentage,
    dailyBreakdown,
  }
}

// ── Progress Data Aggregation ──────────────────────────────────────────

/** Returns an array of Monday date strings for all weeks within [startStr, endStr]. */
export function getWeeksInRange(startStr: string, endStr: string): string[] {
  const weeks: string[] = []
  let current = getWeekStart(startStr)
  while (current <= endStr) {
    weeks.push(current)
    current = addDays(current, 7)
  }
  return weeks
}

/** Aggregates progress data for a given exercise over a date range. */
export function aggregateProgressData(
  exerciseId: string,
  exerciseName: string,
  startStr: string,
  endStr: string,
  sessions: WorkoutSession[],
  routine: Routine
): ProgressData {
  const weeks = getWeeksInRange(startStr, endStr)

  const weeklyData = weeks.map((weekStart) => {
    const weekEnd = addDays(weekStart, 6)

    const weekSessions = sessions.filter((s) => s.date >= weekStart && s.date <= weekEnd)
    const completedPerfs = weekSessions
      .flatMap((s) => s.exercises)
      .filter((e) => e.exerciseId === exerciseId && e.completed)

    const averageReps =
      completedPerfs.length > 0
        ? completedPerfs.reduce((sum, e) => sum + (e.actualReps ?? 0), 0) / completedPerfs.length
        : 0

    const perfsWithWeight = completedPerfs.filter((e) => e.weight != null)
    const averageWeight =
      perfsWithWeight.length > 0
        ? perfsWithWeight.reduce((sum, e) => sum + (e.weight ?? 0), 0) / perfsWithWeight.length
        : 0

    const completionCount = completedPerfs.length

    const totalAssigned = DAYS.filter((day) =>
      (routine.weeklyAssignments[day] ?? []).includes(exerciseId)
    ).length

    const [wsy, wsm, wsd] = weekStart.split('-').map(Number)

    return {
      weekStartDate: new Date(wsy!, wsm! - 1, wsd!),
      averageReps,
      averageWeight,
      completionCount,
      totalAssigned,
    }
  })

  const [sy, sm, sd] = startStr.split('-').map(Number)
  const [ey, em, ed] = endStr.split('-').map(Number)

  return {
    exerciseId,
    exerciseName,
    timeRange: {
      startDate: new Date(sy!, sm! - 1, sd!),
      endDate: new Date(ey!, em! - 1, ed!),
    },
    weeklyData,
  }
}

// ── Exercise History ──────────────────────────────────────────────────────────

/** A single logged instance of an exercise, with the date it was logged. */
export interface ExerciseHistoryEntry extends ExercisePerformance {
  date: string
}

/**
 * Returns every logged instance of an exercise across all sessions, newest first.
 */
export function getExerciseHistory(exerciseId: string, sessions: WorkoutSession[]): ExerciseHistoryEntry[] {
  return sessions
    .filter((s) => s.exercises.some((e) => e.exerciseId === exerciseId))
    .map((s) => ({ ...s.exercises.find((e) => e.exerciseId === exerciseId)!, date: s.date }))
    .sort((a, b) => b.date.localeCompare(a.date))
}

// ── Daily Checklist ─────────────────────────────────────────────────────

/** Returns the lowercase day name (e.g. 'monday') for a YYYY-MM-DD date string. */
export function getDayOfWeek(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year!, month! - 1, day!)
  return DAY_NAMES[d.getDay()] ?? 'monday'
}

/** Returns the exercise IDs assigned to the day of week for the given date. */
export function getExercisesForDate(dateStr: string, routine: Routine): string[] {
  const day = getDayOfWeek(dateStr)
  return routine.weeklyAssignments[day] ?? []
}

/** Finds the workout session matching the given date string, or undefined. */
export function getSessionForDate(dateStr: string, sessions: WorkoutSession[]): WorkoutSession | undefined {
  return sessions.find((s) => s.date === dateStr)
}

/** Merges routine assignments with session performance data for a given date. */
export function mergeRoutineWithSession(
  dateStr: string,
  routine: Routine,
  sessions: WorkoutSession[],
  exercises: Exercise[]
): Array<{ exercise: Exercise; performance: ExercisePerformance | undefined; completed: boolean }> {
  const exerciseIds = getExercisesForDate(dateStr, routine)
  const session = getSessionForDate(dateStr, sessions)

  return exerciseIds
    .map((id) => {
      const exercise = exercises.find((e) => e.id === id)
      if (!exercise) return null
      const performance = session?.exercises.find((p) => p.exerciseId === id)
      return {
        exercise,
        performance,
        completed: performance?.completed ?? false,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
}
