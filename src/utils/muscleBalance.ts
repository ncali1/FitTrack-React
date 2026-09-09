/**
 * Aggregates completed sets by muscle group over a date range, to surface which muscle
 * groups are getting trained and which are being neglected. Counts completed *sets*
 * (not weight-based volume) so bodyweight exercises count equally alongside weighted
 * ones — an exercise with no weight logged would otherwise always contribute zero.
 * An exercise's full set count is attributed to *each* of its tagged muscle groups
 * (not split between them), matching how muscle groups are already treated as
 * non-exclusive tags elsewhere in the app (e.g. the Library's region filter).
 */
import type { Exercise, WorkoutSession } from '@/types'

export interface MuscleGroupSets {
  group: string
  sets: number
}

export function calculateMuscleGroupSets(
  sessions: WorkoutSession[],
  exercises: Exercise[],
  startDateStr: string,
  endDateStr: string
): MuscleGroupSets[] {
  const totals = new Map<string, number>()

  for (const session of sessions) {
    if (session.date < startDateStr || session.date > endDateStr) continue

    for (const performance of session.exercises) {
      if (!performance.completed || performance.isWarmup) continue
      const exercise = exercises.find((e) => e.id === performance.exerciseId)
      if (!exercise) continue

      const sets = performance.actualSets ?? 1
      for (const group of exercise.targetMuscleGroups) {
        totals.set(group, (totals.get(group) ?? 0) + sets)
      }
    }
  }

  return Array.from(totals.entries())
    .map(([group, sets]) => ({ group, sets }))
    .sort((a, b) => b.sets - a.sets)
}
