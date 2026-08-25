import { useState } from 'react'
import { useRoutineStore, selectActiveRoutine } from '@/stores/routine'
import { useWorkoutSessionsStore } from '@/stores/workoutSessions'
import type { WeeklySummary as WeeklySummaryData } from '@/types'
import { WeekNavigator } from './WeekNavigator'
import { SummaryStats } from './SummaryStats'
import { DayBreakdown } from './DayBreakdown'

/** Returns the Monday Date of the week containing the given YYYY-MM-DD string. */
function getMondayOf(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year!, month! - 1, day!)
  const dow = d.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diff)
  return d
}

/** Formats a Date as a YYYY-MM-DD string. */
function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Adds `n` days to a YYYY-MM-DD string and returns the result. */
function addDays(dateStr: string, n: number): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year!, month! - 1, day!)
  d.setDate(d.getDate() + n)
  return toDateString(d)
}

const EMPTY_SUMMARY = (weekStart: string, weekEnd: string): WeeklySummaryData => ({
  weekStartDate: new Date(weekStart),
  weekEndDate: new Date(weekEnd),
  totalAssignedWorkouts: 0,
  totalCompletedWorkouts: 0,
  completionPercentage: 0,
  dailyBreakdown: {},
})

/**
 * Displays an overview of a calendar week's workout completion. Shows the total
 * assigned vs. completed workouts plus a per-day breakdown. Supports navigating to
 * previous weeks (navigation to future weeks is disabled).
 */
export function WeeklySummary() {
  const routines = useRoutineStore((s) => s.routines)
  const activeRoutine = selectActiveRoutine(routines)

  const [weekOffset, setWeekOffset] = useState(0)

  const todayStr = toDateString(new Date())
  const monday = getMondayOf(todayStr)
  monday.setDate(monday.getDate() + weekOffset * 7)
  const weekStart = toDateString(monday)
  const weekEnd = addDays(weekStart, 6)

  // Call the cached getter *inside* the selector (not select-then-call-later) so this
  // component re-renders whenever `sessions` changes — see the note on
  // `selectRoutineForDay` in stores/routine.ts for why that distinction matters with Zustand.
  const summary = useWorkoutSessionsStore((s) =>
    activeRoutine ? s.getCachedWeeklySummary(weekStart, activeRoutine) : EMPTY_SUMMARY(weekStart, weekEnd)
  )

  return (
    <div className="space-y-5">
      <WeekNavigator
        weekStart={weekStart}
        weekEnd={weekEnd}
        onPrev={() => setWeekOffset((o) => o - 1)}
        onNext={() => setWeekOffset((o) => (o < 0 ? o + 1 : o))}
      />

      <SummaryStats totalAssigned={summary.totalAssignedWorkouts} totalCompleted={summary.totalCompletedWorkouts} />

      <DayBreakdown breakdown={summary.dailyBreakdown} />
    </div>
  )
}
