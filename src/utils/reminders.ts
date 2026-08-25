/**
 * Pure utility for deciding whether to nudge the user to work out today.
 * No store dependencies — takes data as parameters, like calculations.ts.
 */
import type { Routine, WorkoutSession } from '@/types'
import { getDayOfWeek } from './calculations'

/**
 * Returns `true` when today is a day the active routine normally assigns a workout to,
 * and nothing has been logged as completed yet today.
 * @param routine - The active routine, or null if none exists yet
 * @param sessions - All workout sessions to check today's session against
 * @param todayStr - Today's date as a YYYY-MM-DD string
 */
export function shouldNudgeToday(routine: Routine | null, sessions: WorkoutSession[], todayStr: string): boolean {
  if (!routine) return false

  const day = getDayOfWeek(todayStr)
  const assigned = (routine.weeklyAssignments[day] ?? []).length > 0
  if (!assigned) return false

  const session = sessions.find((s) => s.date === todayStr)
  const alreadyLogged = session?.exercises.some((e) => e.completed) ?? false
  return !alreadyLogged
}
